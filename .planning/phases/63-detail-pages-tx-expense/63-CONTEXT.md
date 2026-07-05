# Phase 63: detail-pages-tx-expense - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning

<domain>
## Phase Boundary

`/transactions/[id]` and `/expenses/[id]` become the single place to view and edit
everything editable about a transaction/expense (DET-05, DET-06), with cross-references
between entities; the expense "dettagli" and "modifica" dialogs collapse into the page
(DET-07). Backend is already done — Phase 62 shipped `updateTransaction` (amount/occurredAt/
customTitle, atomic expense reconciliation, pair-guard) and the extended atomic
`updateExpense` DAL. This phase is UI: two RSC route pages, inline editing wired to the
Phase 62 actions, existing action dialogs reused in place, and old dialogs removed.

**Milestone contract already locked (grill 2026-07-05 — do NOT re-litigate):**
`transactionHash`/`descriptionHash`/`description` immutable; editable sets are
tx → amount/occurredAt/customTitle/category-via-expense, expense → title/notes/subCategoryId;
derived aggregates never directly writable (auto-reconcile in the same `db.transaction`);
pair-guard blocks with Italian message, never auto-unlinks; pencil-inline editing;
`SubcategoryPicker` reuse.

</domain>

<decisions>
## Implementation Decisions

### Layout
- **D-01 — Stacked cards, single column, mobile-first.** Header with title + signed amount +
  actions, then cards: Dati, Categoria, Collegamenti (and, on the expense page, Riepilogo +
  Transazioni). No two-column sidebar layout.
- **D-02 — Shared shell.** A shared `DetailPageShell` component (header + card-section slots)
  used by both pages — designed so the Phase 64 file page can adopt it too. Uniformity across
  the three detail pages is a milestone goal.
- **D-03 — Immutable fields: description visible with lock, hashes hidden.** The bank
  description is shown as readonly text with a lock badge/icon + tooltip ("chiave di
  deduplicazione/riconciliazione bancaria — non modificabile"). `transactionHash`/
  `descriptionHash` do NOT appear anywhere on the page.
- **D-04 — Expense page linked transactions: inline table in a card** (date, description,
  amount; each row links to `/transactions/[id]`) — reuse the structure from
  `expense-transactions-dialog`. Readonly derived totals (totalAmount, count, first/last
  dates) live in a Riepilogo card or the header.

### Inline edit mechanics
- **D-05 — Per-field immediate save.** Each pencil edits one field; Enter/blur saves via
  server action, Esc cancels — same pattern as the existing `transaction-title-edit` /
  `expense-title-edit`. No aggregate edit-mode/Save button.
- **D-06 — Amount edit: free signed input** (accepts `-12,99` / `12,99`; sign is part of the
  value, like `transaction-form-dialog`). Zod validation server-side; Italian display format.
- **D-07 — Errors inline under the field.** Pair-guard and validation errors render in red
  under the failed field, field stays in edit with the attempted value; the service's Italian
  message (e.g. "Scollega prima il rimborso") is shown as-is.
- **D-08 — Silent refresh after reconciliation.** After an amount/date edit, `router.refresh()`
  updates the page; no toast/notice about the linked expense reconciliation — it's an
  internal detail.

### Actions & post-action
- **D-09 — Buttons + overflow menu.** 1–2 frequent actions as visible header buttons
  (Cerca su internet; Categorizza CTA per D-12); the rest (collega/scollega rimborso,
  spesa a sé) in a "⋯" overflow menu. Elimina always in the menu, styled destructive/red,
  keeping the existing confirmation dialog.
- **D-10 — Full reuse of existing dialogs.** `counterpart-picker-dialog`,
  `detach-expense-dialog`, and `SubcategoryPicker` are invoked from the page exactly as from
  the tables — zero duplication, identical behavior; `router.refresh()` on completion.
- **D-11 — Delete → redirect to the origin table** (`/transactions` or `/expenses`) with a
  confirmation toast. The linked-entities delete confirmation dialog (quick task 260703-l2b)
  stays unchanged.
- **D-12 — Category has one edit point.** The Categoria card opens `SubcategoryPicker` on tap.
  No duplicate "Categorizza" header button — EXCEPT when the expense is uncategorized, where
  an amber "Categorizza" CTA in the header opens the same picker.

### Transition from dialogs (DET-07)
- **D-13 — Expense table menu: single "Dettagli" entry navigating to `/expenses/[id]`.**
  "Modifica" menu entry removed. `expense-form-dialog` survives only for "Nuova spesa"
  (mode `create`); `expense-transactions-dialog` is deleted.
- **D-14 — Table→page wiring in this phase is menu-entry only** (tx + expense tables get a
  "Dettagli" entry to the new pages). Row-title click navigation, breadcrumbs, and
  consistent back behavior are Phase 64 scope (DET-09) — no overlap.
- **D-15 — Table quick flows all stay:** inline title-edit, quick categorize via picker, bulk
  actions, spesa a sé from the categorization flow. DET-07 removes only the expense
  "dettagli"+"modifica" dialogs.
- **D-16 — File cross-ref keeps pointing at the filtered import table** (`/import?file=…`,
  current behavior from quick task 260630-h1j). Phase 64 introduces `/import/[fileId]` and
  repoints the link there — route it through a single constant so the change is one-line.

### Claude's Discretion
- Date editing control (native date input vs calendar popover) — follow existing patterns.
- Exact card/section naming and ordering within the shell; loading/skeleton states.
- 404/ownership handling for `/transactions/[id]` and `/expenses/[id]` (follow the
  `/import/[fileId]/*` pattern: ownership check in the RSC page, `notFound()` otherwise).
- Whether "scollega rimborso" is a menu toggle (collega ↔ scollega based on pair state) —
  behavior must match the existing pair popover semantics.
- How the transaction page shows/edits category (it goes through the linked expense; if the
  transaction's expense holds multiple transactions, editing category affects the whole
  expense — surface that however the categorize flow already does).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone contract
- `.planning/REQUIREMENTS.md` — DET-05/06/07 exact scope + Out of scope list (no hash/description edit, no direct aggregate edit, no bulk edit from detail pages, SPLIT-01 deferred).
- `.planning/STATE.md` §Accumulated Context — v2.5 locked decisions (immutability boundary, editable sets, pair guard) + Phase 62 decisions (updateExpense three-state `subCategoryId` contract, non-fatal history write).
- `CONTEXT.md` (repo root) — domain vocabulary (Transaction vs Expense, Standalone Expense, refund/netting doctrine).

### Phase 62 backend to wire against
- `lib/services/transaction-edit.ts` — `updateTransaction` service: editable fields, pair-guard error message, atomic reconciliation.
- `lib/actions/transaction-edit.ts` — the server action wrapper the page edit controls call.
- `lib/dal/expenses.ts` — extended `updateExpense` (title/notes/subCategoryId three-state, classification-history-aware).
- `.planning/phases/62-transaction-edit-core/62-01-SUMMARY.md` / `62-02-SUMMARY.md` — what was actually built and its error contracts.

### Existing UI to reuse / replace
- `components/transactions/transaction-title-edit.tsx`, `components/expenses/expense-title-edit.tsx` — the per-field pencil-edit pattern to follow (D-05).
- `components/expenses/expense-form-dialog.tsx` — keep create mode; edit mode collapses into the page (D-13).
- `components/expenses/expense-transactions-dialog.tsx` — source of the linked-transactions table + source-file/platform cross-refs; deleted at the end (D-04, D-13).
- `components/expenses/expense-categorize-dialog.tsx`, `components/categorization/subcategory-picker.tsx` — category edit point (D-12).
- `components/transactions/counterpart-picker-dialog.tsx`, `components/transactions/transaction-pair-popover.tsx` — collega/scollega rimborso (D-10).
- `components/transactions/detach-expense-dialog.tsx` — spesa a sé (D-10).
- `components/transactions/transaction-table.tsx`, `components/expenses/expense-table.tsx` — menu entries to change (D-13/D-14); "cerca su internet" implementation to lift.
- `lib/routes.ts` — add the two new route constants; file cross-ref constant (D-16).
- `app/(app)/import/[fileId]/suggestions/page.tsx` — existing dynamic-route RSC pattern (ownership check, notFound).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Pencil inline-edit components (`transaction-title-edit`, `expense-title-edit`) — the exact save-on-Enter/blur pattern D-05 standardizes on.
- All action dialogs (counterpart picker, detach, categorize, delete confirmations) are client components openable from any parent — full reuse per D-10.
- `SubcategoryPicker` bottom sheet — the single category control (v1.13 doctrine).
- "Cerca su internet" already exists in `transaction-table.tsx` and `expense-transactions-dialog.tsx` — extract/lift rather than reimplement.

### Established Patterns
- Dynamic authenticated RSC pages under `app/(app)/import/[fileId]/*` — ownership via DAL query + `notFound()`; new pages follow this.
- DAL/services/actions layering; Decimal.js for amounts (never native arithmetic); Drizzle DECIMAL as strings.
- Italian product copy, English code; `yarn check:language` when touching routes/strings.

### Integration Points
- New routes `app/(app)/transactions/[id]/page.tsx` and `app/(app)/expenses/[id]/page.tsx` inside the authenticated group.
- `lib/routes.ts` route constants + table menu entries (tx + expense) pointing at the new pages.
- Phase 62 actions (`lib/actions/transaction-edit.ts`, `updateExpense` path in `lib/actions/expenses.ts`) are the only write paths — no new edit services needed.

</code_context>

<specifics>
## Specific Ideas

- Header reads as: back link, entity title (custom title precedence `customTitle → expenseTitle → description` for tx), signed amount prominent, action buttons + overflow.
- Uncategorized expense: amber "Categorizza" CTA in the header (mirrors the existing uncategorized affordances), same `SubcategoryPicker`.
- Description lock tooltip copy along the lines of "chiave di riconciliazione bancaria — non modificabile".

</specifics>

<deferred>
## Deferred Ideas

- Row-title click navigation, breadcrumbs, consistent back behavior → Phase 64 (DET-09).
- `/import/[fileId]` detail page + repointing the file cross-ref → Phase 64 (DET-08).
- Description editing, bulk edit from detail pages, revision history, SPLIT-01 — milestone-level deferred (REQUIREMENTS.md Out of scope).

</deferred>

---

*Phase: 63-detail-pages-tx-expense*
*Context gathered: 2026-07-05*
