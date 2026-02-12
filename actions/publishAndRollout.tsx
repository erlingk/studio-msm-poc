import {useState, useEffect, useCallback} from 'react'
import {type DocumentActionComponent, useClient, useDocumentOperation} from 'sanity'

interface SiteDoc {
  _id: string
  title: string
  siteId: string
}

interface RolloutSite extends SiteDoc {
  alreadyExists: boolean
}

export const publishAndRolloutAction: DocumentActionComponent = ({id, type, onComplete}) => {
  const client = useClient({apiVersion: '2024-01-01'})
  const {publish} = useDocumentOperation(id, type)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [sites, setSites] = useState<RolloutSite[]>([])
  const [loading, setLoading] = useState(false)
  const [executing, setExecuting] = useState(false)

  const loadSites = useCallback(async () => {
    setLoading(true)
    try {
      const [allSites, existingSitePosts] = await Promise.all([
        client.fetch<SiteDoc[]>(`*[_type == "site"]{ _id, title, siteId }`),
        client.fetch<{siteRef: string}[]>(
          `*[_type == "sitePost" && masterPost._ref == $postId]{ "siteRef": site._ref }`,
          {postId: id},
        ),
      ])

      const existingSiteIds = new Set(existingSitePosts.map((sp) => sp.siteRef))

      setSites(
        allSites.map((site) => ({
          ...site,
          alreadyExists: existingSiteIds.has(site._id),
        })),
      )
    } finally {
      setLoading(false)
    }
  }, [client, id])

  useEffect(() => {
    if (dialogOpen) {
      loadSites()
    }
  }, [dialogOpen, loadSites])

  const handleConfirm = useCallback(async () => {
    setExecuting(true)
    try {
      publish.execute()

      const sitesToCreate = sites.filter((s) => !s.alreadyExists)

      if (sitesToCreate.length > 0) {
        const transaction = client.transaction()
        for (const site of sitesToCreate) {
          transaction.create({
            _type: 'sitePost',
            masterPost: {_type: 'reference', _ref: id},
            site: {_type: 'reference', _ref: site._id},
            inheritanceEnabled: true,
          })
        }
        await transaction.commit()
      }

      setDialogOpen(false)
      onComplete()
    } finally {
      setExecuting(false)
    }
  }, [client, id, sites, publish, onComplete])

  if (type !== 'post') return null

  return {
    label: executing ? 'Publishing...' : 'Publish & Rollout',
    disabled: publish.disabled === 'NOTHING_TO_PUBLISH' || executing,
    onHandle: () => setDialogOpen(true),
    dialog: dialogOpen
      ? {
          type: 'confirm',
          onCancel: () => {
            setDialogOpen(false)
            onComplete()
          },
          onConfirm: handleConfirm,
          message: loading ? (
            <p>Loading sites...</p>
          ) : (
            <div>
              <p>
                This will <strong>publish</strong> the master post and create site posts for all
                sites that don't have one yet.
              </p>
              <ul style={{listStyle: 'none', padding: 0, margin: '1em 0'}}>
                {sites.map((site) => (
                  <li
                    key={site._id}
                    style={{
                      padding: '0.4em 0',
                      color: site.alreadyExists ? '#888' : '#2a9d2a',
                    }}
                  >
                    {site.alreadyExists ? '-- ' : '+ '}
                    <strong>{site.title}</strong>
                    {site.alreadyExists ? ' (already exists)' : ' (will be created)'}
                  </li>
                ))}
              </ul>
              {sites.filter((s) => !s.alreadyExists).length === 0 && (
                <p style={{color: '#888'}}>All sites already have a site post for this master.</p>
              )}
            </div>
          ),
        }
      : null,
  }
}
