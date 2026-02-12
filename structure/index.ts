import type {StructureResolver} from 'sanity/structure'

const SITES = [
  {id: 'bank', title: 'Bank'},
  {id: 'smn', title: 'SMN'},
  {id: 'ostlandet', title: 'Østlandet'},
]

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      S.listItem()
        .title('Master Content')
        .child(
          S.list()
            .title('Master Content')
            .items([
              S.listItem()
                .title('Posts')
                .schemaType('post')
                .child(S.documentTypeList('post').title('Master Posts')),
            ]),
        ),
      S.divider(),
      ...SITES.map((site) =>
        S.listItem()
          .title(site.title)
          .child(
            S.documentTypeList('sitePost')
              .title(`${site.title} Posts`)
              .filter('_type == "sitePost" && site->siteId == $siteId')
              .params({siteId: site.id}),
          ),
      ),
    ])
