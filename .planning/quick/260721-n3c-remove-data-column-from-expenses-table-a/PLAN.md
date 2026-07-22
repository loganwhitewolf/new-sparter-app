---
quick_id: 260721-n3c
description: Remove the "Data" column from the expenses table and move transaction-period info into the expense/group detail views
type: execute
wave: 1
depends_on: []
files_modified:
  - components/expenses/expense-table.tsx
  - components/expenses/expense-detail-client.tsx
  - components/expenses/group-detail-client.tsx
autonomous: true
must_haves:
  truths:
    - "The expenses table no longer shows a first–last transaction date range that overflows w-24 and overlaps the Piattaforma header"
    - "A user viewing an expense's or a group's detail page can still see its transaction period (first–last movement date)"
    - "Expenses remain sortable by creation date via the existing filters dropdown/mobile sort sheet even though the clickable column header is gone"
  artifacts:
    - "components/expenses/expense-table.tsx — no 'Data' HeaderSortButton, no firstTransactionAt–lastTransactionAt TableCell"
    - "components/expenses/expense-detail-client.tsx — 'Periodo' row in riepilogoCard"
    - "components/expenses/group-detail-client.tsx — 'Periodo' row in riepilogoCard"
  key_links:
    - "expense-detail-client.tsx riepilogoCard -> expense.firstTransactionAt/lastTransactionAt (already present on ExpenseDetailRow via lib/dal/expenses.ts ExpenseRow — no DAL change needed)"
    - "group-detail-client.tsx riepilogoCard -> derived min/max of group.transactions[].occurredAt (ExpenseGroupDetailRow has no firstTransactionAt/lastTransactionAt field of its own)"
    - "expense-filters.tsx DEFAULT_SORT='createdAt' + expenses.table.ts defaultSort + sortable 'Data' mobile-sheet entry stay wired to createdAt desc — untouched by this fix, they are independent of the desktop HeaderSortButton being removed"
---

<objective>
Remove the "Data" column (clickable header + first–last transaction-date cell) from the expenses table in `expense-table.tsx` — it currently renders a range like "01 giu – 15 giu" in a `w-24` cell that overflows and visually overlaps the adjacent `w-36` Piattaforma column. Move that transaction-period information into the two detail views instead: add a "Periodo" row to `expense-detail-client.tsx`'s and `group-detail-client.tsx`'s riepilogoCard, so the data isn't lost — it's relocated to where there's room to display it without truncation.

Purpose: fix a v2.6 layout bug (overflow/overlap in the table) without deleting the underlying information — users can still find an expense's or group's transaction date range on its detail page.
Output: `expense-table.tsx` with the Data column and its now-dead `formatDate` helper removed; `expense-detail-client.tsx` and `group-detail-client.tsx` each with a new "Periodo" summary row.
</objective>

<context>
@CLAUDE.md

Sorting is NOT touched by this fix and needs no code changes: `expense-filters.tsx`'s `DEFAULT_SORT = 'createdAt'` and its `{ value: 'createdAt', label: 'Data creazione' }` dropdown option, and `expenses.table.ts`'s `defaultSort: { key: 'createdAt', dir: 'desc' }` plus its `sortable: [{ key: 'createdAt', label: 'Data' }, ...]` entry (which drives the separate mobile "Ordina" bottom sheet in `DataTableToolbar.tsx`, not the desktop table header) are completely independent of the `HeaderSortButton` being deleted from `expense-table.tsx`'s `<TableHeader>`. Do not edit `expense-filters.tsx` or `expenses.table.ts` in this plan — sorting by createdAt must keep working exactly as it does today, only the desktop column header disappears.

`lib/dal/expenses.ts` already carries the raw data needed for Task 2: `ExpenseDetailRow` (= `ExpenseRow & {...}`, lines 498-501) already has `firstTransactionAt: Date | null` / `lastTransactionAt: Date | null` directly on the row (computed by `composeExpenseRows`/`getExpenseForDetail`) — no DAL change needed for the expense detail view. `ExpenseGroupDetailRow` (lines 617-630) has NO such field; it only exposes `transactions: ExpenseTransactionRow[]` (each with `occurredAt: Date`, sorted `occurredAt DESC` by `getExpenseGroupForDetail`) — the group detail view must derive first/last from that array in the component itself.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Delete the "Data" column (header + cell) and its now-dead formatDate helper from expense-table.tsx</name>
  <files>components/expenses/expense-table.tsx</files>
  <read_first>
    components/expenses/expense-table.tsx lines 228-234 (the local `formatDate(date: Date): string` helper — after this task it has zero remaining call sites, so it must be deleted too, not left as dead code); lines 264-266 (the `sr-only` `TableCaption` reading "Elenco spese con categoria, stato, totale e data." — update to drop "e data" since the visible Data column goes away); lines 296-303 (the `<HeaderSortButton column={{ key: 'createdAt', label: 'Data' }} ... className="w-24 ...">` block inside `<TableRow className="bg-secondary/70">` — this is the header that overflows/overlaps Piattaforma's `w-36` header at line 304-306); lines 382-386 (the `<TableCell className="text-right font-mono tabular-nums text-sm">` immediately after the Totale cell, rendering `formatDate(exp.firstTransactionAt) – formatDate(exp.lastTransactionAt)` or `formatDate(exp.createdAt)` — the only call site of the helper being deleted).
  </read_first>
  <action>
    Delete the `<HeaderSortButton column={{ key: 'createdAt', label: 'Data' }} .../>` element (~lines 296-303) from the `<TableRow>` inside `<TableHeader>` — do not touch the surrounding `HeaderSortButton` elements for `title`, `totalAmount`, or `category`, and do not touch the plain `<TableHead>` elements for Piattaforma or Stato. Delete the corresponding `<TableCell>` (~lines 382-386) from the row-mapping body that renders the first–last transaction range or the createdAt fallback — it sits directly between the Totale `<TableCell>` and the Piattaforma `<TableCell>`; after deletion the Totale cell must be immediately followed by the Piattaforma cell with no gap left behind. Delete the local `formatDate` function definition (~lines 228-234) since the cell that called it no longer exists and an unused function would fail lint. Update the `sr-only` `TableCaption` text (~line 265) from "Elenco spese con categoria, stato, totale e data." to "Elenco spese con categoria, stato e totale." — it must stay accurate to the columns actually rendered. Leave the `ExpenseRow` type import and the `firstTransactionAt`/`lastTransactionAt` fields on that type completely alone — they are still populated by the DAL and are read by Task 2's detail views; only their rendering inside this table file is removed.
  </action>
  <verify>
    <automated>! grep -q "label: 'Data'" components/expenses/expense-table.tsx && ! grep -q "firstTransactionAt" components/expenses/expense-table.tsx && ! grep -q "function formatDate" components/expenses/expense-table.tsx && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `expense-table.tsx` no longer renders a `HeaderSortButton` with `label: 'Data'`, nor any `firstTransactionAt`/`lastTransactionAt` reference
    - The local `formatDate` helper function is fully removed (no dead code)
    - The `sr-only` `TableCaption` no longer mentions "data"
    - The Totale column header/cell and the Piattaforma column header/cell are unchanged and now sit adjacent to each other with no gap
    - All other columns (Spese, Categoria, Stato, row actions) and their `HeaderSortButton`/`TableHead` elements are untouched
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Add a "Periodo" row to expense-detail-client.tsx and group-detail-client.tsx riepilogoCard</name>
  <files>components/expenses/expense-detail-client.tsx, components/expenses/group-detail-client.tsx</files>
  <read_first>
    components/expenses/expense-detail-client.tsx lines 48-56 (existing `dateFormatter`/`formatDate` helper — reuse as-is, do not add a new date util) and lines 241-266 (the `riepilogoCard` JSX: `Totale` row at 246-256, `Transazioni` row at 257-260, `Creata il` row at 261-264, each using the `flex items-center justify-between gap-2` pattern — the new row follows this exact pattern); components/expenses/group-detail-client.tsx lines 60-62 (its own separately-defined `formatDate` helper — reuse as-is) and lines 269-294 (its `riepilogoCard`: `Totale` at 274-284, `Transazioni` at 285-288, `Creato il` at 289-292, same row pattern); lib/dal/expenses.ts lines 55-76 (`ExpenseRow` — confirms `firstTransactionAt`/`lastTransactionAt: Date | null` are present directly on the row type `ExpenseDetailRow` extends) and lines 617-630 (`ExpenseGroupDetailRow` — confirms it has no such field, only `transactions: ExpenseTransactionRow[]` with `occurredAt: Date`).
  </read_first>
  <action>
    In `expense-detail-client.tsx`, add a local helper near the existing `formatDate`/`formatSignedAmount` helpers (~line 56): `formatPeriodo(first: Date | null, last: Date | null): string` — returns `'—'` when `first` is null; returns a single `formatDate(first)` when `last` is null or `last.getTime() === first.getTime()`; otherwise returns `` `${formatDate(first)} – ${formatDate(last)}` `` (en dash, matching the range format the removed table cell used). Inside `riepilogoCard` (~lines 241-266), add a new row using the exact same `<div className="flex items-center justify-between gap-2">` pattern as the existing "Creata il" row, placed immediately after it, with label `Periodo` and value `formatPeriodo(expense.firstTransactionAt, expense.lastTransactionAt)`. Do not touch `expense.transactions` for this — the range is already computed on the row itself.
    In `group-detail-client.tsx`, add the same `formatPeriodo(first: Date | null, last: Date | null): string` helper (duplicated locally next to its own `formatDate`, matching this file's existing per-file duplication convention for `formatDate`/`formatSignedAmount`/`formatTransactionAmount` — do not import it from the other component or a new shared util). Since `ExpenseGroupDetailRow` has no `firstTransactionAt`/`lastTransactionAt`, derive them from `group.transactions` (each entry has `occurredAt: Date`): compute `first`/`last` via a reduce over `group.transactions.map((t) => t.occurredAt)` finding the min and max Date (do not assume the array's DESC sort order is preserved; compute explicitly), yielding `null`/`null` when `group.transactions.length === 0`. Inside `riepilogoCard` (~lines 269-294), add a "Periodo" row in the same pattern immediately after the existing "Creato il" row, with value `formatPeriodo(first, last)`.
  </action>
  <verify>
    <automated>grep -q "Periodo" components/expenses/expense-detail-client.tsx && grep -q "Periodo" components/expenses/group-detail-client.tsx && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `expense-detail-client.tsx` renders a "Periodo" row in `riepilogoCard`, positioned immediately after "Creata il", using `expense.firstTransactionAt`/`expense.lastTransactionAt` directly
    - `group-detail-client.tsx` renders a "Periodo" row in `riepilogoCard`, positioned immediately after "Creato il", with the range derived from `group.transactions[].occurredAt` (min/max), showing "—" when there are zero transactions
    - Both existing "Creata il"/"Creato il" rows are unchanged
    - No new shared date utility file was created — each component reuses its own existing `formatDate`
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Full verification — suite, lint, language check</name>
  <files>(none — verification only, no files modified)</files>
  <read_first>
    tests/expense-table-menu.test.tsx (existing `ExpenseTable` tests — none assert the removed "Data" header or cell text, so no test edits are needed here, only a regression run) and tests/group-detail-page.test.tsx (existing `GroupDetailClient` tests — none assert "Creato il"/period text, so the new "Periodo" row cannot break any existing assertion, only a regression run is needed).
  </read_first>
  <action>
    Run the full test suite, linter, and the project's language checker to confirm Tasks 1–2 introduced no regressions and left no dead code: `yarn vitest run`, `yarn lint`, `yarn check:language`. All three must be green. Pay particular attention to `tests/expense-table-menu.test.tsx` and `tests/group-detail-page.test.tsx` passing unchanged — confirming the column removal and the new "Periodo" rows don't break any existing static-markup assertion in either suite. Do not edit any test file — this task is verification-only.
  </action>
  <verify>
    <automated>yarn vitest run && yarn lint && yarn check:language</automated>
  </verify>
  <acceptance_criteria>
    - `yarn vitest run` full suite passes (0 failed), including `tests/expense-table-menu.test.tsx` and `tests/group-detail-page.test.tsx`
    - `yarn lint` reports zero errors (confirms no unused `formatDate`/dead imports left in `expense-table.tsx`)
    - `yarn check:language` reports no violations
  </acceptance_criteria>
</task>

</tasks>

<verification>
- `yarn vitest run` — full suite green, no regressions
- `yarn lint` — clean
- `yarn check:language` — clean
- `git diff --stat` shows changes only in `components/expenses/expense-table.tsx`, `components/expenses/expense-detail-client.tsx`, `components/expenses/group-detail-client.tsx` — `expense-filters.tsx` and `expenses.table.ts` are untouched
- Manual sanity (optional): `/expenses` no longer shows a Data column overlapping Piattaforma; an expense's and a group's detail page each show a "Periodo" row with the correct first–last transaction date
</verification>

<success_criteria>
- The expenses table no longer renders the overflowing/overlapping Data column
- The transaction-period information previously shown in that column is now visible on both the expense detail page and the group detail page
- createdAt sorting (dropdown option, mobile sheet entry, defaultSort) is completely unaffected
- No dead code, no new shared utility, no test regressions
</success_criteria>

<output>
Create `.planning/quick/260721-n3c-remove-data-column-from-expenses-table-a/260721-n3c-SUMMARY.md` when done
</output>
