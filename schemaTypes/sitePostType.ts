import {defineField, defineType} from 'sanity'

const OVERRIDABLE_FIELDS = [
  {title: 'Title', value: 'title'},
  {title: 'Slug', value: 'slug'},
  {title: 'Published At', value: 'publishedAt'},
  {title: 'Image', value: 'image'},
  {title: 'Body', value: 'body'},
]

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
      title: 'Inheritance Enabled',
      description:
        'When enabled, this post inherits content from the master post. Disable to make all fields locally editable.',
      type: 'boolean',
      initialValue: true,
    }),

    // --- Field-level inheritance ---
    defineField({
      name: 'overriddenFields',
      title: 'Overridden Fields',
      description: 'Select which fields to override with local values. Unselected fields inherit from master.',
      type: 'array',
      of: [{type: 'string'}],
      options: {
        list: OVERRIDABLE_FIELDS,
      },
      hidden: ({document}) => document?.inheritanceEnabled === false,
    }),

    // --- Content fields (override values) ---
    defineField({
      name: 'title',
      type: 'string',
      hidden: ({document}) => {
        if (document?.inheritanceEnabled === false) return false
        return !(document?.overriddenFields as string[] | undefined)?.includes('title')
      },
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      options: {source: 'title'},
      hidden: ({document}) => {
        if (document?.inheritanceEnabled === false) return false
        return !(document?.overriddenFields as string[] | undefined)?.includes('slug')
      },
    }),
    defineField({
      name: 'publishedAt',
      type: 'datetime',
      hidden: ({document}) => {
        if (document?.inheritanceEnabled === false) return false
        return !(document?.overriddenFields as string[] | undefined)?.includes('publishedAt')
      },
    }),
    defineField({
      name: 'image',
      type: 'image',
      hidden: ({document}) => {
        if (document?.inheritanceEnabled === false) return false
        return !(document?.overriddenFields as string[] | undefined)?.includes('image')
      },
    }),
    defineField({
      name: 'body',
      type: 'array',
      of: [{type: 'block'}],
      hidden: ({document}) => {
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
