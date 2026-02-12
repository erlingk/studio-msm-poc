import {useState, useCallback, useMemo, useEffect} from 'react'
import {type FieldProps, useClient, useFormValue, useDocumentOperation} from 'sanity'
import {Switch, Flex, Box, Tooltip, Text} from '@sanity/ui'

export function InheritableField(props: FieldProps) {
  const fieldName = props.name
  const client = useClient({apiVersion: '2024-01-01'})
  const inheritanceEnabled = useFormValue(['inheritanceEnabled']) as boolean | undefined
  const overriddenFields = (useFormValue(['overriddenFields']) as string[] | undefined) ?? []
  const documentId = useFormValue(['_id']) as string
  const masterPostRef = useFormValue(['masterPost', '_ref']) as string | undefined

  const publishedId = documentId.replace(/^drafts\./, '')
  const {patch, publish} = useDocumentOperation(publishedId, 'sitePost')

  const [pendingPublish, setPendingPublish] = useState(false)

  const isOverridden = useMemo(
    () => overriddenFields.includes(fieldName),
    [overriddenFields, fieldName],
  )

  // Auto-publish after turning off override and syncing from master
  useEffect(() => {
    if (pendingPublish && !publish.disabled) {
      publish.execute()
      setPendingPublish(false)
    }
  }, [pendingPublish, publish])

  const handleToggle = useCallback(async () => {
    const turningOffOverride = isOverridden
    const newOverridden = turningOffOverride
      ? overriddenFields.filter((f) => f !== fieldName)
      : [...overriddenFields, fieldName]

    if (turningOffOverride) {
      // Switching back to inherited — sync from master, then auto-publish
      const patchFields: Record<string, unknown> = {overriddenFields: newOverridden}
      if (masterPostRef) {
        const masterPost = await client.fetch(
          `*[_type == "post" && _id == $id][0]{ ${fieldName} }`,
          {id: masterPostRef},
        )
        if (masterPost && masterPost[fieldName] != null) {
          patchFields[fieldName] = masterPost[fieldName]
        }
      }
      patch.execute([{set: patchFields}])
      setPendingPublish(true)
    } else {
      // Switching to override — creates a draft, Publish button will activate
      patch.execute([{set: {overriddenFields: newOverridden}}])
    }
  }, [client, fieldName, isOverridden, overriddenFields, masterPostRef, patch])

  // If inheritance is disabled at document level, all fields are editable — no toggle needed
  if (inheritanceEnabled === false) {
    return props.renderDefault(props)
  }

  return (
    <Flex gap={3} align="flex-start">
      <Box flex={1}>{props.renderDefault(props)}</Box>
      <Tooltip
        content={
          <Box padding={2}>
            <Text size={1}>{isOverridden ? 'Overriding master' : 'Inherited from master'}</Text>
          </Box>
        }
        placement="top"
      >
        <Box paddingTop={4}>
          <Switch checked={isOverridden} onChange={handleToggle} />
        </Box>
      </Tooltip>
    </Flex>
  )
}
