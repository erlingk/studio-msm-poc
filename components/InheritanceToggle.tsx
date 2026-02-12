import {useCallback, useRef, useEffect, useState} from 'react'
import {type FieldProps, useClient, useFormValue, useDocumentOperation, set} from 'sanity'
import {Switch, Flex, Box, Text, Stack, Card} from '@sanity/ui'

const CONTENT_FIELDS = ['title', 'slug', 'publishedAt', 'image', 'body']

export function InheritanceToggle(props: FieldProps) {
  const client = useClient({apiVersion: '2024-01-01'})
  const documentId = useFormValue(['_id']) as string
  const masterPostRef = useFormValue(['masterPost', '_ref']) as string | undefined
  const inheritanceEnabled = useFormValue(['inheritanceEnabled']) as boolean | undefined
  const overriddenFields = (useFormValue(['overriddenFields']) as string[] | undefined) ?? []

  const publishedId = documentId.replace(/^drafts\./, '')
  const {patch, publish} = useDocumentOperation(publishedId, 'sitePost')

  const prevInheritanceRef = useRef(inheritanceEnabled)
  const [pendingPublish, setPendingPublish] = useState(false)

  // Auto-publish after syncing from master
  useEffect(() => {
    if (pendingPublish && !publish.disabled) {
      publish.execute()
      setPendingPublish(false)
    }
  }, [pendingPublish, publish])

  const syncFromMaster = useCallback(async () => {
    if (!masterPostRef) return

    const projection = CONTENT_FIELDS.join(', ')
    const masterPost = await client.fetch(
      `*[_type == "post" && _id == $id][0]{ ${projection} }`,
      {id: masterPostRef},
    )
    if (!masterPost) return

    const overridden = new Set(overriddenFields)
    const fieldsToSync: Record<string, unknown> = {}
    for (const field of CONTENT_FIELDS) {
      if (!overridden.has(field) && masterPost[field] != null) {
        fieldsToSync[field] = masterPost[field]
      }
    }

    if (Object.keys(fieldsToSync).length > 0) {
      patch.execute([{set: fieldsToSync}])
      setPendingPublish(true)
    }
  }, [client, masterPostRef, overriddenFields, patch])

  // Detect when inheritance transitions from false → true and sync from master
  useEffect(() => {
    if (prevInheritanceRef.current === false && inheritanceEnabled === true) {
      syncFromMaster()
    }
    prevInheritanceRef.current = inheritanceEnabled
  }, [inheritanceEnabled, syncFromMaster])

  // Inverted display: switch OFF (left) = inheritance on, switch ON (right) = override all
  const isOverrideAll = inheritanceEnabled === false

  const handleToggle = useCallback(() => {
    props.inputProps.onChange(set(!inheritanceEnabled))
  }, [props.inputProps, inheritanceEnabled])

  return (
    <Stack space={2}>
      <Text size={1} weight="semibold">
        {props.title}
      </Text>
      {props.description && (
        <Text size={1} muted>
          {props.description}
        </Text>
      )}
      <Card paddingY={2}>
        <Flex align="center" gap={3}>
          <Switch checked={isOverrideAll} onChange={handleToggle} />
          <Text size={1} muted>
            {isOverrideAll ? 'All fields editable locally' : 'Inheriting from master'}
          </Text>
        </Flex>
      </Card>
    </Stack>
  )
}
