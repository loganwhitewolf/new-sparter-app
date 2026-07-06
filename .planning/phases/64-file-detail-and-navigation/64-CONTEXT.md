# Phase 64: file-detail-and-navigation - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

<domain>
## Phase Boundary

`/import/[fileId]` becomes the detail page for an imported file (DET-08): `displayName`
editable inline, platform/format/stats readonly, the file's transactions listed with links
out, and the existing file actions preserved (R2 download, suggestions, delete). Plus the
navigation wiring across all three tables (DET-09): row-title click → detail page, menu
"Dettagli" entries, and consistent back behavior.

**Carried forward from Phase 63 (do NOT re-litigate):**
- D-02 (63): the file page adopts the shared `DetailPageShell` — stacked cards, single
  column, mobile-first, uniform across the three detail pages.
- D-16 (63): the file cross-ref on `/transactions/[id]` and `/expenses/[id]` currently
  points at `/import?file=…` through a single constant — this phase repoints it to
  `/import/[fileId]` (one-line change by design).
- Milestone contract: on a file only `displayName` is editable; pencil per-field
  immediate save (D-05), delete → redirect to origin table with toast (D-11), actions as
  1–2 visible buttons + "⋯" overflow with destructive Elimina in menu (D-09).
- 63-04 already added "Dettagli" menu entries to the transaction and expense tables.

</domain>

<decisions>
## Implementation Decisions

### File transactions list (DET-08)
- **D-01 — Preview + link.** A card with the first ~10–20 transactions of the file
  (date, description, amount; each row links to `/transactions/[id]`) plus a "Vedi tutte"
  link opening `/transactions` filtered by file (the file filter already exists). No full
  inline table with its own pagination — files can hold hundreds of rows.
- **D-02 — Full readonly stats set.** The summary card shows: platform, format, import
  date, row counts (total/imported/duplicates/errors), covered period (first–last
  transaction date), total amounts. Reuse the counts already computed for the import
  table — no new heavy queries invented.
- **D-03 — Actions per the D-09 (Phase 63) pattern.** 1–2 frequent actions visible in the
  header (Scarica file, Suggerimenti when available); the rest in the "⋯" overflow menu;
  Elimina always in the menu, destructive red, reusing the existing delete confirmation
  dialog (`import-delete-dialog`); delete → redirect to `/import` with confirmation toast.

### Row-click navigation (DET-09)
- **D-04 — Title-only click target.** In all three tables the title/name text becomes a
  link to the detail page. Pencil icon stays the inline-edit affordance (text = link,
  pencil = edit — same coexistence as today's file-name link). No whole-row click: bulk
  checkboxes, category cells, and menus stay untouched.
- **D-05 — File name in the transactions table repoints to `/import/[fileId]`** (today it
  goes to `/import?file=…`). Filtered transactions remain reachable from the file page via
  "Vedi tutte". Consistent with D-16 (63): all file references converge on the detail page.
- **D-06 — Menu entries:** only the import table needs a new "Dettagli" menu entry
  (tx + expense tables got theirs in 63-04).

### Back behavior (DET-09)
- **D-07 — Back link only, no breadcrumb.** The `DetailPageShell` back link
  (← Transazioni / ← Spese / ← Import) is the sole hierarchy affordance — the hierarchy is
  flat (table → detail), a multi-level breadcrumb would be redundant.
- **D-08 — Smart back via `router.back()` with static fallback.** When the user arrived
  from the table, back uses browser history so ephemeral URL filters/sort/scroll are
  preserved; when the page is opened directly or from another detail page, fall back to
  the static table route. Implemented in the shared shell, so Phase 63's tx/expense pages
  get the same behavior (this IS the "consistent back" of DET-09).

### Non-imported file states
- **D-09 — Detail page only for `imported` files; others redirect to their workflow
  step.** For `pending_upload`/`uploaded`/`analyzing`/`analyzed`/`importing` the RSC
  redirects to the corresponding wizard step (analyze/configure), matching the existing
  import-flow routing; `failed` stays handled by the table (delete). The title link in the
  import table follows the same logic.

### Claude's Discretion
- Exact preview row count (10 vs 20) and card ordering within the shell.
- Which stats the DAL already exposes vs needs a cheap aggregate for — prefer existing
  queries; don't invent fields the DAL doesn't have (cf. Phase 63 Riepilogo precedent).
- How "Suggerimenti" appears when the file has no pending suggestions (hidden vs disabled).
- Exact redirect mapping per non-imported status — follow the existing wizard routing
  (e.g. the logic used by the import table's row actions / configure/analyze pages).
- Loading/skeleton and 404/ownership handling — follow the `/import/[fileId]/suggestions`
  RSC pattern (ownership in DAL query + `notFound()`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone contract
- `.planning/REQUIREMENTS.md` — DET-08/DET-09 exact scope + Out of scope list.
- `.planning/STATE.md` §Accumulated Context — v2.5 locked decisions (file: `displayName`
  only editable) + Phase 63 decisions.
- `.planning/phases/63-detail-pages-tx-expense/63-CONTEXT.md` — D-02/D-05/D-09/D-11/D-16
  patterns this phase inherits.

### Existing UI to reuse / extend
- `components/detail-pages/detail-page-shell.tsx` — shared shell (D-02 of 63); gains the
  smart-back behavior (D-08).
- `components/import/import-display-name-edit.tsx` — existing inline pencil edit for
  `displayName` (quick task 260630-gbv) — reuse on the page.
- `components/import/import-row-actions.tsx` — R2 download, suggestions, delete actions to
  lift onto the page; `components/import/import-delete-dialog.tsx` +
  `import-delete-impact-summary.tsx` — delete confirmation reuse.
- `components/import/import-table.tsx` — title link + "Dettagli" menu entry (D-04, D-06).
- `components/transactions/transaction-table.tsx`,
  `components/expenses/expense-table.tsx` — title-link wiring (D-04); file-name link
  repoint (D-05).
- `lib/routes.ts` — `transactionDetailHref`/`expenseDetailHref` precedent; add
  `importFileDetailHref`; repoint the file cross-ref constant (D-16 of 63).
- `app/(app)/import/[fileId]/suggestions/page.tsx` — dynamic-route RSC pattern
  (ownership check, `notFound()`); `configure/` and `analyze/` pages — redirect targets
  for non-imported states (D-09).
- `lib/db/schema.ts` `fileStatusEnum` — the seven file states driving D-09.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DetailPageShell` (Phase 63) — header + card slots; the file page is its third consumer.
- `import-display-name-edit` — the exact per-field pencil-save pattern already built for
  file rename; drop-in on the detail page.
- Import row actions + delete dialogs — all client components openable from any parent
  (same full-reuse doctrine as 63 D-10).
- Transactions file filter (`/transactions?file=…` style) — target of "Vedi tutte" (D-01).

### Established Patterns
- Dynamic authenticated RSC pages under `app/(app)/import/[fileId]/*` — ownership via DAL
  query + `notFound()`.
- DAL/services/actions layering; Decimal.js for amounts; Drizzle DECIMAL as strings.
- Italian product copy, English code; run `yarn check:language` after touching
  routes/strings.

### Integration Points
- New route `app/(app)/import/[fileId]/page.tsx` inside the authenticated group (note:
  sibling of existing `configure/`, `analyze/`, `suggestions/` subroutes).
- `lib/routes.ts` — new `importFileDetailHref` + repointed file cross-ref constant.
- Three table components (import, transactions, expenses) for title-link wiring.

</code_context>

<specifics>
## Specific Ideas

- Header: back link, `displayName` with pencil (custom title mechanism), status/platform
  context, actions per D-03.
- Transactions preview card mirrors the linked-transactions card structure from
  `/expenses/[id]` (63 D-04) for cross-page uniformity.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 64-file-detail-and-navigation*
*Context gathered: 2026-07-06*
