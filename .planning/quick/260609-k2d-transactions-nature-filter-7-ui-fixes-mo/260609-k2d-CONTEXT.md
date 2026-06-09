# Quick Task 260609-k2d: Transactions nature filter + 7 UI fixes - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning

<domain>
## Task Boundary

One feature + seven UI refinements across the transactions, expenses, and import tables.

**Feature:** Filter transactions by FlowNature.

**Refinements:**
1. Categorize modal — autofocus the search input on open (keyboard-first, no mouse).
2. Expenses table — add a Platform column.
3. Loading indicator on POST/mutation actions + table reload (invisible locally, very visible on slow free-tier server).
4. Transactions — add an In / Out / Transfer filter.
5. Transaction row colors (dark theme): IN green, OUT red, Transfer dimmed.
6. Filter popover — add an explicit close button (currently only closes by clicking outside).
7. Import list — add "Totale entrate" and "Totale uscite" columns.
</domain>

<code_context>
## Key facts discovered (verify before building)

- **Transactions have no `nature` or `type` column.** Both derive from the assigned category: `categoryTypeEnum = ["in","out","system","transfer"]` (on `category`, schema.ts:26/165) and FlowNature (on `subCategory`). Nature filter and in/out/transfer filter must join transaction → subCategory → category.
- **Uncategorized transactions** have neither nature nor type.
- Filters today: `components/transactions/transaction-filters.tsx` (Card + shadcn `Select`, URL searchParams + `useTransition` → `isPending` already available as a loader hook + `router.replace`). Same pattern in `expense-filters.tsx`, `import-filters.tsx`.
- Unified data-table system exists: `components/data-table/` (`DataTableToolbar.tsx`, `MonthMultiPicker.tsx`) — the popover filter referenced in fix 6 lives here (uses `components/ui/popover.tsx`).
- Tables: `transaction-table.tsx` (585), `expense-table.tsx` (548). Categorize modal: `components/categorization/subcategory-picker.tsx` (461) + `expense-categorize-dialog.tsx` / `bulk-categorize-dialog.tsx`.
- Import list page: `app/(app)/import/page.tsx` (119).
- Nature taxonomy: `lib/utils/nature-labels.ts` — `NATURE_LABELS`/`NATURE_COLORS` already include `unclassified`. Color tokens `--total-in` (green) / `--total-out` (red) used by the dashboard.
- DAL: `lib/dal/transactions.ts`, validations: `lib/validations/transactions.ts` (`ParsedTransactionFilters`).
</code_context>

<decisions>
## Implementation Decisions (LOCKED)

### Uncategorized handling in Nature + In/Out/Transfer filters
- Add an explicit **"Non classificato"** option to BOTH the nature filter and the in/out/transfer filter, so uncategorized transactions can be isolated. Reuse the existing `unclassified` taxonomy entry (`NATURE_LABELS`/`NATURE_COLORS`).

### Transaction row colors (dark theme)
- **Colored amount + dimmed transfer**: IN amount in green (`--total-in`), OUT amount in red (`--total-out`), Transfer rows at reduced opacity (~0.6). Reuse the existing dashboard tokens — no heavy left borders or badges. Must read well on the dark theme.

### Loader scope (fix 3)
- **All mutations + table reload.** A loading indicator on every action that waits on the server: categorize (single + bulk), edit, delete, and the table reload after a filter change or action. Implement as a shared/consistent pattern reused across transactions, expenses, and import tables. The existing `useTransition` `isPending` is the natural hook for filter/reload; mutation dialogs need a pending state on their submit/confirm controls.

### Claude's Discretion
- Fix 1 (autofocus): wire focus to the picker search input on open (controlled focus via ref / `autoFocus`, respecting the bottom-sheet/dialog mount timing).
- Fix 6 (popover close button): identify the actual popover filter(s) in `components/data-table/` and add an explicit close (and/or "Applica e chiudi") control; keep click-outside working.
- Fix 2 / 7 (columns): match existing table column patterns; Platform column on expenses mirrors how transactions show platform; import totals reuse Decimal.js aggregation (DECIMAL columns are strings).
- Nature filter UI placement (inline Select vs popover) — follow the existing filter component pattern for that table.
</decisions>

<specifics>
## Specific Ideas

- Nature filter is the headline feature; the in/out/transfer filter (fix 4) is its sibling — both are category-derived and both get a "Non classificato" option.
- Loaders matter specifically because of slow free-tier server latency; local is fast so they're invisible there — do not gate them behind a delay that hides them online.
</specifics>

<canonical_refs>
## Canonical References

- CLAUDE.md hard rules: Decimal.js for money (DECIMAL columns are strings), Italian only for product/UI copy, English for code/comments, `dal`/`services`/`actions` layering, run `yarn check:language` on touched strings/comments.
- CONTEXT.md domain language: Transaction vs Expense, Nature, Reference Period.
- Related shipped work: unified subcategory picker (Phase 39), table filter & sort (v1.14 / ADR 0009+0010).
</canonical_refs>
