# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sanity Studio v5 for a Multi-Site Management (MSM) POC. Master `post` documents are authored once and rolled out to site-specific `sitePost` documents that can selectively override individual fields. Connects to Sanity project `n3sgk7y6` / dataset `production`.

## Commands

```bash
npm run dev          # Start Studio at localhost:3333
npm run build        # Build for production
npm run deploy       # Deploy Studio to Sanity hosting
```

## Content Model

Three document types defined in `schemaTypes/`:

- **`post`** — Master content (title, slug, publishedAt, image, body)
- **`site`** — Tenant configuration (title, siteId)
- **`sitePost`** — Site-specific post linking a `post` and a `site`, with inheritance controls

## Inheritance Architecture

### Data model on `sitePost`

- `inheritanceEnabled` (boolean, default `true`) — document-level toggle. When `false`, all fields are editable locally.
- `overriddenFields` (string array, hidden from UI) — tracks which fields are locally overridden when inheritance is enabled.
- Each content field (title, slug, publishedAt, image, body) has a `readOnly` callback that checks both `inheritanceEnabled` and `overriddenFields`.

### Custom components (`components/`)

- **`InheritableField`** — wraps each content field with a per-field toggle Switch. Uses `useDocumentOperation` to create drafts (toggle ON override) or sync from master + auto-publish (toggle OFF override). Switch left = inherited, right = overridden.
- **`InheritanceToggle`** — renders an inverted Switch for the document-level toggle. Uses `useDocumentOperation` with auto-publish via `useEffect` watching `publish.disabled`. Switch left = inheriting from master, right = override all fields locally.

### Key implementation detail

Field mutations use `useDocumentOperation` (not `client.patch()`) to properly integrate with Studio's draft/publish system. Direct client patches bypass form state tracking and cause the Publish button to not activate.

## Rollout Action (`actions/publishAndRollout.tsx`)

Custom document action on `post` documents, added alongside the default Publish in `sanity.config.ts`:

1. Fetches all `site` documents and existing `sitePost` references
2. Shows confirmation dialog with per-site status (new / sync / local-skip)
3. Creates new sitePosts with all content copied from master
4. Patches existing inherited sitePosts — only non-overridden fields are synced
5. Skips sitePosts where `inheritanceEnabled === false`
6. Queries exclude drafts (`!(_id in path("drafts.**"))`) to patch published documents

## Slug Uniqueness

The `sitePost` slug field has a custom `isUnique` in its options that scopes uniqueness per site (`site._ref`) and excludes both `drafts.X` and `X` versions of the current document to avoid false positives.

## Studio Structure

Defined in `structure/index.ts`. Sidebar navigation: Master Content → per-site sections (Bank, SMN, Østlandet) filtered by `site->siteId`. Sites are hardcoded in the `SITES` array in the structure config.
