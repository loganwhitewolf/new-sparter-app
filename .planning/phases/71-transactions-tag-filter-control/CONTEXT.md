# Phase 71 — transactions-tag-filter-control — CONTEXT

**Requirements:** TAG-14
**Goal:** Add a tag filter control to the transactions toolbar, integrated into the existing unified declarative filter system, so the user can filter `/transactions` by tag from the UI (not only via a `?tag=` link).

## What already exists (REUSE — do not duplicate)

- **URL param + DAL:** `/transactions?tag=<id>` is fully wired. `app/(app)/transactions/page.tsx` parses it, calls `resolveOwnedTagId` (IDOR fail-closed), and passes `tagId` to `getTransactions`, which applies `tagScopedTransactions(tagId)` (`lib/dal/transactions.ts`). `ParsedTransactionFilters.tagId` exists in `lib/validations/transactions.ts`. **No DAL/param/parsing change is needed** — only the UI control is missing.
- **Declarative filter system:** `app/(app)/transactions/transactions.table.ts` exports `transactionsTableConfig: TableConfig` with a `filters: [{ key, label, type, options, toChip }]` array consumed by `DataTableToolbar`. Adding an entry gives active-chip, clear-all, and sessionStorage persistence automatically (the unified table-filter-sort system, ADR 0009/0010).
- The transactions page already loads `tags` via `getTags(userId)` (used for per-row tag chips) — reuse that list to populate the control's options.

## Locked decisions

- **D1 — Add a `tag` filter to `transactionsTableConfig`.** New entry `{ key: 'tag', label: 'Tag', type: 'select', options: [], toChip: (v) => \`Tag: ${label}\` }`, following EXACTLY the pattern of the existing `platform`/`category` select filters (whose `options: []` are injected at runtime). Determine how platform/category options are injected (page → toolbar) and inject the tag options the same way. The chip label should show the tag NAME, not the id.
- **D2 — Options from the user's tags.** Value = `String(tag.id)`, label = `tag.name`. Include archived tags too (they can carry historical transactions) — mark archived ones (e.g. name + " (archiviato)") consistent with how archived tags are shown elsewhere. Sort as `getTags` returns.
- **D3 — Param mapping.** The config `key` must map to the `?tag=` URL param that `page.tsx`/parsing already consume (confirm the toolbar's key→searchParam convention; existing filters like `platform` map key→param directly). Selecting a tag writes `?tag=<id>`; clearing removes it. Reuse the existing param — do NOT invent a new one.
- **D4 — Do NOT reuse `TagFilterSelect`.** That component is the dashboard control and is removed in Phase 70. The transactions control lives in the transactions filter system (`transactionsTableConfig` + its toolbar). Phase 71 is independent of Phase 70 — different surface, different component, no shared file.

## Scope fences / out of scope

| Item | Why |
|------|-----|
| Any change to `getTransactions`, `resolveOwnedTagId`, or the `?tag=` parsing | Already implemented and correct — reuse only. |
| Dashboard `?tag=` filter / `TagFilterSelect` | Phase 70's scope, not here. |
| The `/tags` pages or `getTagDetail` | Phase 69, shipped. |
| Multi-tag (AND/OR) filtering | Single-tag only, matching the existing `tagId` DAL path. |

## Project constraints

- Layers: page (RSC) loads data; the toolbar/filters are the client UI. No new DAL query.
- Language: code/comments English; UI copy Italian ("Tag", "Tutti i tag", chip "Tag: {nome}"). Run `yarn check:language`.
- IDOR: ownership already enforced by `resolveOwnedTagId` in the page — the control only emits a tagId into the URL.

## Verification hooks

- Selecting a tag in the toolbar filters the table to that tag; the active chip shows the tag name; clear-all removes it; the filter persists across bare navigation (sessionStorage restore layer).
- A foreign/invalid `?tag=` is still dropped by the page's `resolveOwnedTagId` (unchanged).
- `./node_modules/.bin/tsc --noEmit` clean on touched files; ESLint clean; `yarn check:language` passes; relevant vitest suites green.
