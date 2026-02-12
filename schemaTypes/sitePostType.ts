import {defineField, defineType} from 'sanity'
import {InheritableField} from '../components/InheritableField'
import {InheritanceToggle} from '../components/InheritanceToggle'

export const sitePostType = defineType({
  name: 'sitePost',
  title: 'Site Post',
  type: 'document',
  fields: [
    // --- Relationship fields ---
    defineField({
      name: 'masterPost',
      title: 'Master Post',
      type: 'reference',
      to: [{type: 'post'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'site',
      title: 'Site',
      type: 'reference',
      to: [{type: 'site'}],
      validation: (rule) => rule.required(),
    }),

    // --- Document-level inheritance ---
    defineField({
      name: 'inheritanceEnabled',
      title: 'Override all fields',
      description:
        'Enable to override all fields locally. Disable to inherit content from the master post.',
      type: 'boolean',
      initialValue: true,
      components: {field: InheritanceToggle},
    }),

    // --- Backing field for per-field override tracking (hidden from UI) ---
    defineField({
      name: 'overriddenFields',
      type: 'array',
      of: [{type: 'string'}],
      hidden: true,
    }),

    // --- Content fields with per-field inheritance toggle ---
    defineField({
      name: 'title',
      type: 'string',
      components: {field: InheritableField},
      readOnly: ({document}) => {
        if (document?.inheritanceEnabled === false) return false
        return !(document?.overriddenFields as string[] | undefined)?.includes('title')
      },
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      options: {
        source: 'title',
        isUnique: async (slug, context) => {
          const {document, getClient} = context
          const client = getClient({apiVersion: '2024-01-01'})
          const siteRef = (document?.site as {_ref?: string} | undefined)?._ref
          if (!siteRef) return true
          const id = document?._id ?? ''
          const publishedId = id.replace(/^drafts\./, '')
          const draftId = `drafts.${publishedId}`
          const count = await client.fetch(
            `count(*[_type == "sitePost" && slug.current == $slug && site._ref == $siteRef && !(_id in [$publishedId, $draftId])])`,
            {slug, siteRef, publishedId, draftId},
          )
          return count === 0
        },
      },
      components: {field: InheritableField},
      readOnly: ({document}) => {
        if (document?.inheritanceEnabled === false) return false
        return !(document?.overriddenFields as string[] | undefined)?.includes('slug')
      },
    }),
    defineField({
      name: 'publishedAt',
      type: 'datetime',
      components: {field: InheritableField},
      readOnly: ({document}) => {
        if (document?.inheritanceEnabled === false) return false
        return !(document?.overriddenFields as string[] | undefined)?.includes('publishedAt')
      },
    }),
    defineField({
      name: 'image',
      type: 'image',
      components: {field: InheritableField},
      readOnly: ({document}) => {
        if (document?.inheritanceEnabled === false) return false
        return !(document?.overriddenFields as string[] | undefined)?.includes('image')
      },
    }),
    defineField({
      name: 'body',
      type: 'array',
      of: [{type: 'block'}],
      components: {field: InheritableField},
      readOnly: ({document}) => {
        if (document?.inheritanceEnabled === false) return false
        return !(document?.overriddenFields as string[] | undefined)?.includes('body')
      },
    }),
  ],
  preview: {
    select: {
      title: 'title',
      masterTitle: 'masterPost.title',
      siteTitle: 'site.title',
      inheritanceEnabled: 'inheritanceEnabled',
    },
    prepare({title, masterTitle, siteTitle, inheritanceEnabled}) {
      const displayTitle = title || masterTitle || 'Untitled'
      const subtitle = [
        siteTitle,
        inheritanceEnabled === false ? 'Local' : 'Inherited',
      ]
        .filter(Boolean)
        .join(' | ')
      return {title: displayTitle, subtitle}
    },
  },
})
