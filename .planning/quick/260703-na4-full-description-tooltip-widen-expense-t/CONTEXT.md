# Quick Task Context — Full description on hover (widen expense.title, stop truncating)

## Problem
The hover tooltip on a transaction/expense title (and the details dialog) never
shows the full bank description. Two distinct bugs:

1. **Data (expenses):** `expense.title` is `varchar(120)` (schema.ts:386) and
   `import.ts:613` writes `title: acc.description.slice(0, 120)`; the detach
   service (`transaction-detach.ts:56`) also does `input.title.trim().slice(0, 120)`.
   So a 185-char bank description (real example: "Beneficiario: Andrea Bernardini
   IBAN: IT23… Causale: Ricarica conto TRN: …") is **truncated at write time** —
   no tooltip can ever show more than 120 chars for an expense.
2. **UI (transactions):** `transaction-title-edit.tsx:50` uses `title={displayTitle}`
   where `displayTitle = customTitle ?? expenseTitle ?? description`. When an expense
   is linked, it shows the (120-truncated) `expenseTitle`, not the full `description`
   (which is `text`, intact). The native browser `title=""` shows exactly the string
   passed — the truncation is in the value, not the browser.

`transaction.description` is `text` (schema.ts:426, full); `expense.title` is the
truncated one.

## Locked decisions (user, 2026-07-03)
1. **Widen `expense.title` `varchar(120)` → `text`**, remove BOTH `.slice(0, 120)`
   truncations (import.ts:613 keeps the full `acc.description`; transaction-detach.ts
   keeps `.trim()` but drops `.slice(0,120)`), and **backfill** existing truncated
   expenses by regenerating the title from the full description of a linked
   transaction. Requires a Drizzle migration (widening — safe) + a seed-extras backfill step.
2. **Tooltip = native `title=""` with the COMPLETE text.** No shadcn Tooltip component.
   Pass the full string (description for transactions; the now-full title/description
   for expenses) to the existing `title` attribute.
3. **Surfaces:** transactions table, expenses table, details dialog(s).

## Implementation shape
- **Schema/migration:** `lib/db/schema.ts:386` `title: varchar("title",{length:120}).notNull()`
  → `text("title").notNull()`. `yarn db:generate` → ALTER COLUMN TYPE text (widening,
  no data loss). Never `drizzle-kit push`.
- **Stop truncating (writes):**
  - `lib/services/import.ts:613` — `title: acc.description` (drop `.slice(0, 120)`).
  - `lib/services/transaction-detach.ts:56` — keep `.trim()`, drop `.slice(0, 120)`
    (used at lines 110/126). Keep the empty-title guard.
- **Zod limits:** `lib/validations/expense.ts` — `CreateExpenseSchema.title` (line 8)
  and `UpdateExpenseTitleSchema.title` (line 23) `.max(120)` → a generous bound
  (e.g. `.max(500)`, consistent with `notes`), and update the Italian message
  accordingly. Without this, re-saving a backfilled 185-char title would fail validation.
- **Backfill (seed-extras STEP, idempotent):** append a STEP to `scripts/seed-extras.ts`
  that UPDATEs `expense.title` = the full `transaction.description` of a linked
  transaction, ONLY for expenses whose current title is exactly the 120-char
  truncation (`char_length(title) = 120`) AND that have a linked transaction whose
  description is longer. Do NOT touch manually-edited/short titles or standalone
  ("spesa a sé") titles (< 120). Pick one linked transaction's description (all
  transactions of an expense share the same descriptionHash → same normalized
  description); `MIN(description)` or the earliest is fine. Guard: skip expenses with
  no linked transaction. This is a data backfill on existing rows → seed-extras
  (project rule), not a new column in seed-data.ts.
- **UI tooltips (native `title=`, full text) — 3 surfaces:**
  - `components/transactions/transaction-title-edit.tsx` — the main title `<span title={...}>`
    (line ~50) should carry the **full `description`** (the complete bank text), so hover
    always reveals it even when the visible label is a shorter custom/expense title. The
    secondary line already uses `title={description}`; keep it consistent.
  - `components/expenses/expense-table.tsx:273` `title={exp.title}` — now the full title
    (post widening + backfill). Confirm the DAL selects `expense.title` untruncated (it
    does; widening doesn't change the select).
  - `components/expenses/expense-title-edit.tsx:43` `title={title}` — full title post-fix.
  - Details dialog: `components/expenses/expense-transactions-dialog.tsx` — show each
    transaction's full `description` readably (wrap, not truncated) so details always
    show the complete text. Add/verify a transaction-details surface if one exists.
- **DAL check:** ensure expense/transaction list DALs select `title`/`description` as-is
  (no substring/slice in SQL). Widening is transparent to reads.

## Verification
- Unit/service: import preserves a >120-char title (no slice); detach preserves a
  >120-char title (trim only); zod accepts a >120 title.
- Backfill step: updates only `char_length(title)=120` rows with a longer linked
  description; leaves short/edited titles untouched; idempotent.
- `yarn test`, `npx tsc --noEmit` (no `typecheck` script), `yarn lint`, `yarn check:language`.
- `yarn db:generate` produced an ALTER COLUMN TYPE text migration (no backfill in the SQL).
- Operator run order (live DB): `yarn db:migrate && yarn db:seed-extras`.
- Note pre-existing unrelated failures on main (expense-actions, import-table-actions,
  overview-interactions, + the transaction-table set-state-in-effect lint) — not this task.

## Constraints
- Monetary values via Decimal.js; import writes inside `db.transaction`.
- Layers: dal/services/actions. Dev strings English; Italian only for product copy
  (the zod message, tooltip copy).
- Seeds additive: backfill is a new seed-extras STEP, never edit seed-data.ts shapes.
- Migration via drizzle-kit generate + migrate.ts; never push in prod.
