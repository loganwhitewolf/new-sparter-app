---
quick_id: 260703-na4
slug: full-description-tooltip-widen-expense-t
type: quick
branch: gsd/quick-full-description-tooltip
autonomous: true
files_modified:
  - lib/db/schema.ts
  - drizzle/migrations/0025_*.sql
  - lib/services/import.ts
  - lib/services/transaction-detach.ts
  - lib/validations/expense.ts
  - scripts/seed-extras.ts
  - components/transactions/transaction-title-edit.tsx
  - components/expenses/expense-table.tsx
  - components/expenses/expense-title-edit.tsx
  - components/expenses/expense-transactions-dialog.tsx
  - tests/import-service.test.ts
  - tests/transaction-detach-service.test.ts
  - tests/expense-actions.test.ts
  - tests/seed-extras-steps.test.ts

must_haves:
  truths:
    - "Hovering a transaction title shows the full bank description, even when the visible label is a shorter custom/expense title"
    - "Hovering an expense title (expenses table + inline edit) shows the complete title text, not a 120-char truncation"
    - "The expense details dialog shows each linked transaction's full description, wrapped and untruncated"
    - "Importing a >120-char bank description stores the full description as expense.title (no write-time truncation)"
    - "Detaching a transaction with a >120-char title preserves the full trimmed title"
    - "Existing expenses whose title is exactly the 120-char truncation are backfilled from a linked transaction's full description"
  artifacts:
    - "drizzle/migrations/0025_*.sql — ALTER COLUMN expense.title TYPE text"
    - "scripts/seed-extras.ts — new idempotent backfill STEP registered last in STEPS"
  key_links:
    - "expense.title (text) ← import.ts / transaction-detach.ts write full description; zod .max(500) permits re-save"
    - "transaction-title-edit main span title= carries description prop (full bank text), not displayTitle"
    - "expense-transactions-dialog renders ExpenseTransactionRow.description (already selected in DAL)"
---

<objective>
Make the full bank description visible on hover across the transactions table, the
expenses table, and the expense details dialog. Fix the root cause rather than the
symptom: `expense.title` is `varchar(120)` and is truncated at write time (import and
detach), so no tooltip can ever show more than 120 characters for an expense.

Widen `expense.title` to `text`, stop truncating on both write paths, raise the zod
title bound so a backfilled >120 title can be re-saved, backfill existing 120-char
truncated titles from the linked transaction's full description, and pass the complete
text to the native `title=""` tooltips on all three surfaces.

Purpose: users must be able to read the complete bank description (real example: a
185-char "Beneficiario: … IBAN: … Causale: …" string) without opening the source file.
Output: a widening migration, two de-truncated write paths, widened zod limits, an
idempotent seed-extras backfill STEP, three fixed UI surfaces, and regression tests.

Locked decisions (CONTEXT.md, 2026-07-03) are non-negotiable and must not be reopened:
native `title=""` tooltip (no shadcn Tooltip), widen-not-cap, backfill via seed-extras.
</objective>

<execution_context>
Quick task. Execute tasks in order — each is an atomic, independently-committable unit.
Do NOT create a branch (already on `gsd/quick-full-description-tooltip`).
</execution_context>

<context>
@.planning/quick/260703-na4-full-description-tooltip-widen-expense-t/CONTEXT.md
@CLAUDE.md
@lib/db/schema.ts
@lib/services/import.ts
@lib/services/transaction-detach.ts
@lib/validations/expense.ts
@scripts/seed-extras.ts
@components/transactions/transaction-title-edit.tsx
@components/expenses/expense-table.tsx
@components/expenses/expense-title-edit.tsx
@components/expenses/expense-transactions-dialog.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Widen expense.title to text + generate migration</name>
  <files>lib/db/schema.ts, drizzle/migrations/0025_*.sql</files>
  <action>
    In `lib/db/schema.ts` change the `expense` table `title` column (line 386) from
    `varchar("title", { length: 120 }).notNull()` to `text("title").notNull()`. Confirm
    `text` is already imported from `drizzle-orm/pg-core` at the top of the file (it is —
    `transaction.description` uses it); do not add a duplicate import. Do not touch
    `transaction.description` (already `text`) or any other column.

    Then run `yarn db:generate`. Drizzle emits the next sequential migration
    (`0025_*.sql`) containing an `ALTER TABLE "expense" ALTER COLUMN "title" SET DATA TYPE
    text;` (widening — safe, no data loss, no backfill in the SQL). Latest existing
    migration is `0024`, so the new file is `0025`. Do NOT run `drizzle-kit push`; do NOT
    run `db:migrate` here (operator applies it live — see success_criteria run order).
    Commit the schema change and the generated migration together.
  </action>
  <verify>
    <automated>yarn db:generate && ls drizzle/migrations/0025_*.sql && grep -n "SET DATA TYPE text" drizzle/migrations/0025_*.sql && npx tsc --noEmit</automated>
  </verify>
  <done>schema.ts declares `title: text("title").notNull()`; migration 0025 exists and its only expense.title change is an ALTER COLUMN … SET DATA TYPE text (no data backfill in SQL); tsc passes.</done>
</task>

<task type="auto">
  <name>Task 2: Stop truncating title on import + detach; widen zod limits</name>
  <files>lib/services/import.ts, lib/services/transaction-detach.ts, lib/validations/expense.ts</files>
  <action>
    Remove both write-time truncations and raise the zod bound so a backfilled long title
    round-trips through the update action.

    1. `lib/services/import.ts` line 613 — change `title: acc.description.slice(0, 120)`
       to `title: acc.description` (store the full normalized description). Do not change
       the surrounding insert or the `db.transaction` wrapper.

    2. `lib/services/transaction-detach.ts` line 56 — change
       `const trimmedTitle = input.title.trim().slice(0, 120)` to
       `const trimmedTitle = input.title.trim()`. Keep the empty-title guard immediately
       after (the `if (!trimmedTitle) throw …` block) and both downstream uses of
       `trimmedTitle` (lines 110 and 126) unchanged.

    3. `lib/validations/expense.ts` — raise the two title bounds from `.max(120)` to
       `.max(500)` (consistent with the existing `notes` bound) and update the Italian
       message text accordingly: `CreateExpenseSchema.title` (line 8) and
       `UpdateExpenseTitleSchema.title` (line 23). New IT message for both:
       "Il titolo non può superare i 500 caratteri." (product/domain surface — Italian is
       correct here per the language convention). Leave `min(2)` and `.trim()` untouched.
       Without this, re-saving a backfilled 185-char title fails validation.
  </action>
  <verify>
    <automated>grep -n "acc.description.slice" lib/services/import.ts | grep -v '^#' | wc -l | grep -qx 0 && grep -n "trim().slice" lib/services/transaction-detach.ts | grep -v '^#' | wc -l | grep -qx 0 && grep -c "max(500" lib/validations/expense.ts && npx tsc --noEmit</automated>
  </verify>
  <done>No `.slice(0, 120)` remains on either write path; both title bounds are `.max(500)` with the updated Italian message; the empty-title detach guard and `min(2)` are preserved; tsc passes.</done>
</task>

<task type="auto">
  <name>Task 3: Add idempotent seed-extras backfill STEP for truncated titles</name>
  <files>scripts/seed-extras.ts</files>
  <action>
    Append a new async STEP `backfillTruncatedExpenseTitles(database: Db)` to
    `scripts/seed-extras.ts` and register it LAST in the `STEPS` array (append-only
    invariant — never reorder or delete existing steps). This backfills only expenses
    whose title is exactly the 120-char truncation, from a linked transaction's full
    description.

    Import `transaction` from `../lib/db/schema` (add it to the existing schema import
    block — `expense` is already imported). Use raw SQL via `database.execute(sql`…`)`
    following the pattern of `v2BackfillOverrideNatureId`, because the update must join
    expense→transaction and pick a single description per expense:

    Behavior the SQL must satisfy:
    - UPDATE `expense` SET `title` = the chosen linked transaction's full `description`.
    - Match a linked transaction via `transaction.expense_id = expense.id`.
    - Restrict to `char_length(expense.title) = 120` (the exact truncation length) AND the
      chosen transaction's `char_length(description) > 120` (there is genuinely more text
      to reveal). This makes the step idempotent: a re-run finds no `char_length = 120`
      rows that still have a longer linked description because the first run already
      lengthened them.
    - Skip expenses with no linked transaction (an inner correlation naturally excludes
      them). Do NOT touch short titles (< 120), manually-edited titles, or standalone
      titles whose length ≠ 120.
    - All transactions of an expense share the same descriptionHash → the same normalized
      description; pick one deterministically (e.g. `MIN(t.description)` grouped by
      `t.expense_id`, or the earliest by `occurred_at`). Either is acceptable per CONTEXT.
    - Log the affected row count like the other steps
      (`(result as unknown as { rowCount?: number }).rowCount ?? 0`).

    Head-comment the step: what it does, why it is idempotent (the `char_length = 120`
    guard), and that it is a data backfill on existing rows (seed-extras, not seed-data —
    project rule). Do not add columns to seed-data.ts.
  </action>
  <verify>
    <automated>grep -c "backfillTruncatedExpenseTitles\|backfill-truncated-expense-titles" scripts/seed-extras.ts && grep -q "char_length" scripts/seed-extras.ts && npx tsc --noEmit</automated>
  </verify>
  <done>A new backfill function exists, is registered last in STEPS with a kebab-case name, uses a `char_length(title) = 120` + longer-linked-description guard (idempotent), joins expense→transaction, and typechecks. No seed-data.ts change.</done>
</task>

<task type="auto">
  <name>Task 4: Pass full text to native title="" tooltips on all three surfaces</name>
  <files>components/transactions/transaction-title-edit.tsx, components/expenses/expense-table.tsx, components/expenses/expense-title-edit.tsx, components/expenses/expense-transactions-dialog.tsx</files>
  <action>
    Wire the complete text into the existing native `title=""` attributes (no shadcn
    Tooltip — locked decision 2). Visible labels stay truncated by CSS; only the tooltip
    value changes.

    1. `components/transactions/transaction-title-edit.tsx` — the main title `<span>`
       (line 51) currently uses `title={displayTitle}`, which is the (possibly truncated)
       custom/expense fallback. Change it to `title={description}` so hover always reveals
       the full raw bank description even when the visible label is a shorter
       custom/expense title. Leave the rendered child `{displayTitle}` unchanged and the
       secondary "Originale:" line's `title={description}` (line 59) as-is.

    2. `components/expenses/expense-table.tsx` — line 273 passes `title={exp.title}` into
       `ExpenseTitleEdit`; this is now the full title after widening + backfill, so no
       code change is needed here. Verify the value flows through untruncated (the
       expenses DAL selects `title: expense.title` with no SQL substring — confirmed). No
       edit unless the prop path is broken.

    3. `components/expenses/expense-title-edit.tsx` — line 43 already renders
       `title={title}` on the title span; `title` is now the full expense title. No change
       needed beyond confirming it. Do not add a shadcn Tooltip.

    4. `components/expenses/expense-transactions-dialog.tsx` — the linked-transactions
       table currently renders only `#`, `Importo`, `Data` and does NOT show the
       description at all. `ExpenseTransactionRow` already carries `description` (selected
       in `getTransactionsByExpenseId`). Add a "Descrizione" column: a new `<TableHead>`
       and a `<TableCell>` per row rendering `tx.description` readably — wrapped, not
       truncated (use `break-words` / `whitespace-normal`; do NOT use `whitespace-nowrap`
       or `truncate` on this cell). This makes the dialog the always-complete view of the
       bank text. Keep the amount/date cells' existing `whitespace-nowrap`.
  </action>
  <verify>
    <automated>grep -n "title={description}" components/transactions/transaction-title-edit.tsx && grep -c "tx.description" components/expenses/expense-transactions-dialog.tsx && npx tsc --noEmit && yarn lint</automated>
  </verify>
  <done>The transactions main-title span uses `title={description}`; the details dialog renders each transaction's full `description` in a wrapping cell; expense table + inline edit tooltips carry the full title; tsc and lint pass.</done>
</task>

<task type="auto">
  <name>Task 5: Regression tests — no truncation on write, zod accepts >120, step registered</name>
  <files>tests/import-service.test.ts, tests/transaction-detach-service.test.ts, tests/expense-actions.test.ts, tests/seed-extras-steps.test.ts</files>
  <action>
    Add focused regression tests proving the truncation is gone and the new step is wired.

    1. `tests/import-service.test.ts` — add a case where an imported row has a bank
       description longer than 120 characters and assert the inserted `expense.title`
       equals the full description (length > 120, no truncation). Follow the existing
       import-service test setup/mocks in this file.

    2. `tests/transaction-detach-service.test.ts` — add a case that detaches with a
       >120-char title and asserts the resulting `newExpenseTitle` (and the persisted
       title) is the full trimmed value, length > 120. Reuse the existing detach test
       harness; keep the existing empty-title guard test passing.

    3. `tests/expense-actions.test.ts` — add a zod/validation case asserting
       `UpdateExpenseTitleSchema` (and `CreateExpenseSchema`) accept a 185-char title and
       reject a > 500-char title with the Italian 500-char message. Follow the existing
       validation-assertion style in this file (or add to the nearest existing schema
       test if this file already imports the schemas).

    4. `tests/seed-extras-steps.test.ts` — add an assertion that `STEP_NAMES` contains the
       new backfill step name and that it appears LAST in the registry (its index equals
       `STEP_NAMES.length - 1`), preserving the append-only ordering invariant.

    Do not attempt a live-DB test of the backfill SQL body — the existing seed-extras
    transform steps are verified by registry/ordering tests plus the operator run, not by
    DB-touching unit tests (matches project convention). Correctness of the SQL guard is
    covered by the operator run order in success_criteria.
  </action>
  <verify>
    <automated>yarn test tests/import-service.test.ts tests/transaction-detach-service.test.ts tests/expense-actions.test.ts tests/seed-extras-steps.test.ts</automated>
  </verify>
  <done>New tests pass: import preserves a >120 title, detach preserves a >120 trimmed title, zod accepts 185 chars and rejects >500 with the Italian message, and the backfill step is registered last in STEP_NAMES.</done>
</task>

</tasks>

<verification>
Run the full gate suite before finishing:
- `npx tsc --noEmit` — no type errors (note: repo has no `typecheck` script; use tsc directly).
- `yarn lint` — clean (a pre-existing set-state-in-effect warning on the transaction table is unrelated to this task; do not attempt to fix it here).
- `yarn check:language` — clean (developer strings English; the only new Italian is the zod
  500-char message, which is an intentional product/domain surface).
- `yarn db:generate` — produced `drizzle/migrations/0025_*.sql` with an ALTER COLUMN … SET
  DATA TYPE text (widening, no backfill in SQL).
- `yarn test` — full run green except the known pre-existing unrelated failures documented
  below.

Known pre-existing unrelated failures on this branch (NOT introduced by this task, do not
chase them): `expense-actions`, `import-table-actions`, `overview-interactions`, plus the
transaction-table set-state-in-effect lint. Verify your new/edited tests pass and that you
did not add new failures beyond this known set.
</verification>

<success_criteria>
- `expense.title` is `text`; migration 0025 widens it (ALTER COLUMN TYPE text only).
- Neither `import.ts` nor `transaction-detach.ts` truncates the title; detach still trims
  and still guards empty titles.
- Zod `CreateExpenseSchema.title` and `UpdateExpenseTitleSchema.title` are `.max(500)` with
  the Italian 500-char message; `min(2)` preserved.
- A new idempotent seed-extras STEP backfills only `char_length(title)=120` expenses that
  have a linked transaction with a longer description; it is registered last in STEPS.
- Transactions main-title tooltip shows the full `description`; the details dialog renders
  each linked transaction's full, wrapped `description`; expense table + inline-edit
  tooltips show the full title.
- All gates pass except the documented pre-existing failures.

Operator run order (live DB, after merge — never `drizzle-kit push`):
  `yarn db:migrate && yarn db:seed-extras`
(`db:seed` is idempotent and unchanged here; run it too if following the canonical order,
but the widening + backfill only require migrate + seed-extras.)
</success_criteria>

<output>
Atomic commits, one per task (5 total). No SUMMARY file required for a quick task beyond
the standard quick-task tracking; report completion when all gates pass.
</output>
