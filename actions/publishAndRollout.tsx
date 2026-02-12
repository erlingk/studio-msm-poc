import {useState, useEffect, useCallback} from 'react'
import {type DocumentActionComponent, useClient} from 'sanity'

interface SiteDoc {
  _id: string
  title: string
  siteId: string
}

interface ExistingSitePost {
  _id: string
  siteRef: string
  inheritanceEnabled: boolean
  overriddenFields: string[]
}

interface RolloutSite extends SiteDoc {
  existing: ExistingSitePost | null
}

interface MasterPostContent {
  title?: string
  slug?: {current: string}
  publishedAt?: string
  image?: Record<string, unknown>
  body?: unknown[]
}

export const rolloutAction: DocumentActionComponent = ({id, type, onComplete}) => {
  const client = useClient({apiVersion: '2024-01-01'})
  const [dialogOpen, setDialogOpen] = useState(false)
  const [sites, setSites] = useState<RolloutSite[]>([])
  const [loading, setLoading] = useState(false)
  const [executing, setExecuting] = useState(false)

  const loadSites = useCallback(async () => {
    setLoading(true)
    try {
      const [allSites, existingSitePosts] = await Promise.all([
        client.fetch<SiteDoc[]>(`*[_type == "site"]{ _id, title, siteId }`),
        client.fetch<ExistingSitePost[]>(
          `*[_type == "sitePost" && masterPost._ref == $postId && !(_id in path("drafts.**"))]{
            _id,
            "siteRef": site._ref,
            inheritanceEnabled,
            "overriddenFields": coalesce(overriddenFields, [])
          }`,
          {postId: id},
        ),
      ])

      const existingBySiteRef = new Map(existingSitePosts.map((sp) => [sp.siteRef, sp]))

      setSites(
        allSites.map((site) => ({
          ...site,
          existing: existingBySiteRef.get(site._id) ?? null,
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
      const masterPost = await client.fetch<MasterPostContent>(
        `*[_type == "post" && _id == $id][0]{ title, slug, publishedAt, image, body }`,
        {id},
      )

      const contentFields = {
        ...(masterPost?.title != null && {title: masterPost.title}),
        ...(masterPost?.slug != null && {slug: masterPost.slug}),
        ...(masterPost?.publishedAt != null && {publishedAt: masterPost.publishedAt}),
        ...(masterPost?.image != null && {image: masterPost.image}),
        ...(masterPost?.body != null && {body: masterPost.body}),
      }

      const transaction = client.transaction()

      for (const site of sites) {
        if (!site.existing) {
          transaction.create({
            _type: 'sitePost',
            masterPost: {_type: 'reference', _ref: id},
            site: {_type: 'reference', _ref: site._id},
            inheritanceEnabled: true,
            ...contentFields,
          })
        } else if (site.existing.inheritanceEnabled !== false) {
          const overridden = new Set(site.existing.overriddenFields)
          const fieldsToSync: Record<string, unknown> = {}
          for (const [key, value] of Object.entries(contentFields)) {
            if (!overridden.has(key)) {
              fieldsToSync[key] = value
            }
          }
          if (Object.keys(fieldsToSync).length > 0) {
            transaction.patch(site.existing._id, (p) => p.set(fieldsToSync))
          }
        }
      }

      await transaction.commit()

      setDialogOpen(false)
      onComplete()
    } finally {
      setExecuting(false)
    }
  }, [client, id, sites, onComplete])

  if (type !== 'post') return null

  const newCount = sites.filter((s) => !s.existing).length
  const syncCount = sites.filter(
    (s) => s.existing && s.existing.inheritanceEnabled !== false,
  ).length
  const localCount = sites.filter(
    (s) => s.existing && s.existing.inheritanceEnabled === false,
  ).length

  return {
    label: executing ? 'Rolling out...' : 'Rollout',
    disabled: executing,
    onHandle: () => setDialogOpen(true),
    dialog: dialogOpen
      ? {
          type: 'confirm' as const,
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
                This will sync the master post content to all site posts with inheritance enabled.
              </p>
              <ul style={{listStyle: 'none', padding: 0, margin: '1em 0'}}>
                {sites.map((site) => {
                  const isNew = !site.existing
                  const isLocal = site.existing?.inheritanceEnabled === false
                  const color = isNew ? '#2a9d2a' : isLocal ? '#c4841d' : '#888'
                  const prefix = isNew ? '+ ' : isLocal ? '! ' : '~ '
                  const label = isNew
                    ? '(will be created)'
                    : isLocal
                      ? '(local — will not be synced)'
                      : '(will sync inherited fields)'
                  return (
                    <li key={site._id} style={{padding: '0.4em 0', color}}>
                      {prefix}
                      <strong>{site.title}</strong> {label}
                    </li>
                  )
                })}
              </ul>
              <p style={{color: '#888', fontSize: '0.9em'}}>
                {newCount > 0 && <>{newCount} new. </>}
                {syncCount > 0 && <>{syncCount} synced. </>}
                {localCount > 0 && <>{localCount} skipped (local). </>}
              </p>
            </div>
          ),
        }
      : null,
  }
}
