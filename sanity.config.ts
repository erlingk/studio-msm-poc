import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'
import {structure} from './structure'
import {publishAndRolloutAction} from './actions/publishAndRollout'

export default defineConfig({
  name: 'default',
  title: 'MsmPoc',

  projectId: 'n3sgk7y6',
  dataset: 'production',

  plugins: [structureTool({structure}), visionTool()],

  schema: {
    types: schemaTypes,
  },

  document: {
    actions: (prev, context) => {
      if (context.schemaType === 'post') {
        return [...prev, publishAndRolloutAction]
      }
      return prev
    },
  },
})
