---
phase: 61-standalone-expense
plan: 02
subsystem: frontend
tags: [react, server-actions, categorization, dialog, transaction-table]

# Dependency graph
requires:
  - phase: 61-standalone-expense (plan 01, commit d2493a9)
    provides: "detachTransactionToDedicatedExpense(subCategoryId?), detachTransaction action forwarding subCategoryId, SINGLE_TRANSACTION_EXPENSE guard removed"
provides:
  - "DetachExpenseDialog — captures title AND subcategory in one flow (title Input, then reused SubcategoryPicker sheet), forwards subCategoryId to detachTransaction, onSuccess payload gains subCategoryId"
  - "TransactionTable standalone action — available on any transaction with a linked expense (count gate removed), lands already categorized (no mandatory second ExpenseCategorizeDialog step)"
  - "TransactionTitleEdit fallbackTitle prop — row title precedence customTitle -> expenseTitle -> description"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dialog-then-sheet composition: title Input dialog stays open only until the reused SubcategoryPicker sheet takes over (open && !pickerOpen), avoiding a new picker component"
    - "onSuccess payload widened (subCategoryId?: number) lets the table apply an optimistic category update via the existing markExpensesCategorized helper instead of opening a second dialog"

key-files:
  created: []
  modified:
    - components/transactions/detach-expense-dialog.tsx
    - components/transactions/transaction-table.tsx
    - components/transactions/transaction-title-edit.tsx
    - tests/transaction-title-edit.test.tsx
    - .planning/phases/61-standalone-expense/deferred-items.md

key-decisions:
  - "Placement: kept the existing title Input dialog, added a 'Scegli sottocategoria' button that opens the reused SubcategoryPicker sheet (Dialog visible only while open && !pickerOpen) — no new picker component built"
  - "onSuccess({ newExpenseId, newExpenseTitle, subCategoryId }) — table calls markExpenseDetached then, when subCategoryId is defined, markExpensesCategorized([newExpenseId], String(subCategoryId)) to land the row already categorized in one optimistic update"
  - "subCategoryId type coercion: SubcategoryPicker.onChange delivers a string; Number(subCategoryIdRaw) at the dialog boundary, String(subCategoryId) at the table's markExpensesCategorized call site (that helper types subCategoryId as string) — matches the plan's flagged coercion point"
  - "Menu-item gate reduced to transaction.expenseId only (STEXP-02) — action hidden only when there is no linked expense to detach from"
  - "Copy: 'Spesa a sé (non aggregare)' replaces 'Separa in spesa dedicata' — reads as one-off/do-not-aggregate rather than a mechanical split, per ADR 0016 decision 2 (general action, not a counterparty category)"
  - "Bug fix (found during Task 3 checkpoint): row title precedence was customTitle ?? description, never consulting the linked expense's title, so a freshly-named standalone expense still showed the raw bank description on the row. Added TransactionTitleEdit.fallbackTitle prop; precedence is now customTitle -> expenseTitle -> description. The 'Originale: {description}' caption is unchanged (documents the true raw bank description)."

requirements-completed: [STEXP-01, STEXP-02]

coverage:
  - id: D1
    description: "DetachExpenseDialog captures a title and a subcategory via the reused SubcategoryPicker and forwards subCategoryId to detachTransaction; onSuccess carries the chosen subCategoryId"
    requirement: "STEXP-01"
    verification:
      - kind: manual
        ref: "Task 3 human checkpoint — multi-transaction case: title + subcategory prompt confirmed, row shows dedicated expense with chosen category, other same-description transactions unaffected"
        status: pass
      - kind: automated
        ref: "yarn tsc --noEmit && yarn check:language (run at Task 1 commit b2fc326) — clean for this plan's files"
        status: pass
    human_judgment: true
  - id: D2
    description: "Standalone action is offered on any transaction with a linked expense, including when the source expense holds only that single transaction (count gate removed); the row updates optimistically to the categorized standalone expense with no mandatory second categorize step"
    requirement: "STEXP-02"
    verification:
      - kind: manual
        ref: "Task 3 human checkpoint — single-transaction case: action present (previously hidden), invoked successfully with no 'cannot separate the only transaction' error, same expense row re-hashed in place, row shows chosen category"
        status: pass
      - kind: automated
        ref: "yarn tsc --noEmit (run at Task 2 commit 9af9475) — clean for transaction-table.tsx / detach-expense-dialog.tsx"
        status: pass
    human_judgment: true
  - id: D3
    description: "Row title displays the standalone expense's chosen title (not the raw bank description) after detach, via TransactionTitleEdit fallback precedence"
    verification:
      - kind: unit
        ref: "tests/transaction-title-edit.test.tsx — fallbackTitle precedence (customTitle > expenseTitle > description) and edit-mode seed value"
        status: pass
    human_judgment: false

# Metrics
duration: 90min
completed: 2026-07-01
status: complete
---

# Phase 61 Plan 02: Standalone Expense UI Summary

**Inline "Spesa a sé (non aggregare)" action wired into the transactions table row menu on any transaction with a linked expense, capturing title + subcategory in one dialog flow via the reused SubcategoryPicker, landing the detached expense already categorized without a second dialog step — human-verified in-browser on both multi- and single-transaction cases.**

## Performance

- **Duration:** ~90 min (including the mid-checkpoint bug-fix cycle)
- **Started:** 2026-07-01T10:04:xxZ (Task 1)
- **Completed:** 2026-07-01T11:36:10Z (bug-fix commit) + human approval
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint), plus 1 deviation fix
- **Files modified:** 5 (detach-expense-dialog.tsx, transaction-table.tsx, transaction-title-edit.tsx, transaction-title-edit.test.tsx, deferred-items.md)

## Accomplishments

- `DetachExpenseDialog` now captures a title AND a subcategory in one flow: the existing title `Input` dialog is followed by the reused `SubcategoryPicker` sheet (no new picker component); on subcategory selection it calls `detachTransaction({ transactionId, title, subCategoryId })` and reports `{ newExpenseId, newExpenseTitle, subCategoryId }` to `onSuccess`.
- New `categories`/`mostUsed` props on `DetachExpenseDialog`, typed as in `expense-categorize-dialog.tsx`, threaded down from `TransactionTable` (which already held both).
- `TransactionTable`'s standalone menu item is now gated only on `transaction.expenseId` — the `(transaction.expenseTransactionCount ?? 0) > 1` guard is gone (STEXP-02). The item is relabeled "Spesa a sé (non aggregare)" to read as one-off/do-not-aggregate rather than a mechanical split (ADR 0016 decision 2: general action, never a counterparty category).
- On successful detach, the table calls `markExpenseDetached(...)` and, when `subCategoryId` is present, immediately `markExpensesCategorized([newExpenseId], String(subCategoryId))` — the row lands already categorized. The old mandatory second `ExpenseCategorizeDialog` step after detach is removed.
- **Deviation fix (found during Task 3 human verification):** the row's visible title computed `customTitle ?? description` and never consulted the linked expense's title, so renaming a transaction into a standalone expense still showed the raw bank description on the row. Added `TransactionTitleEdit.fallbackTitle` prop (fed `transaction.expenseTitle`); new precedence is `customTitle -> expenseTitle -> description`. The "Originale: {description}" caption is unchanged — it documents the true raw bank description regardless of the displayed title.
- **Task 3 (human checkpoint):** human tested in-browser, including a re-test after the bug fix, and responded **"approvato"** — both the multi-transaction and single-transaction detach flows work as specified, and the row shows the correct title/category with no full reload.

## Task Commits

1. **Task 1: capture title + subcategory in one step** — `b2fc326` (feat)
2. **Task 2: lift transaction-count gate, wire optimistic categorized row** — `9af9475` (feat)
3. **Checkpoint bug fix: row title fallback precedence** — `899541f` (fix)
4. **Task 3: human checkpoint** — no code change; verified "approvato" after re-test of the fix above

## Files Created/Modified

- `components/transactions/detach-expense-dialog.tsx` — title + subcategory capture via reused `SubcategoryPicker`; `categories`/`mostUsed` props; `onSuccess` payload gains `subCategoryId`
- `components/transactions/transaction-table.tsx` — standalone menu item gated only on `expenseId`; relabeled copy; `DetachExpenseDialog` gets `categories`/`mostUsed`; `onSuccess` applies `markExpensesCategorized` instead of opening a second categorize dialog
- `components/transactions/transaction-title-edit.tsx` — new `fallbackTitle` prop; display/edit-seed precedence `customTitle -> fallbackTitle -> description`
- `tests/transaction-title-edit.test.tsx` — new test file covering the fallback precedence
- `.planning/phases/61-standalone-expense/deferred-items.md` — re-confirmed pre-existing, out-of-scope `check:language`/`vitest`/`tsc` failures unrelated to this plan's files

## Decisions Made

- Kept the title `Input` dialog and added a "Scegli sottocategoria" button that opens the reused `SubcategoryPicker` sheet, rather than building a combined single-screen control — the `Dialog` is only rendered while `open && !pickerOpen`, so the sheet fully takes over without stacking overlays.
- `subCategoryId` type coercion happens at two boundaries: `Number(subCategoryIdRaw)` when the picker (string output) hands off to `detachTransaction` (number input), and `String(subCategoryId)` when the table's `onSuccess` calls `markExpensesCategorized` (which types `subCategoryId` as `string`) — both call sites match the coercion the plan explicitly flagged.
- Menu-item copy changed from "Separa in spesa dedicata" to "Spesa a sé (non aggregare)" to avoid implying a mechanical split and to read as the general one-off/do-not-aggregate action mandated by ADR 0016 decision 2.
- Row title fallback fix scoped narrowly to `TransactionTitleEdit` (new optional prop, backward compatible for any other caller that doesn't pass it) rather than touching the DAL/query shape.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Row title did not reflect the standalone expense's title after detach**
- **Found during:** Task 3 human-verify checkpoint (first pass)
- **Issue:** `TransactionTitleEdit` computed `displayTitle = customTitle ?? description`, skipping the linked expense's title entirely. After detaching a transaction into a newly-titled standalone expense, the row kept showing the original bank description instead of the chosen title.
- **Fix:** Added `fallbackTitle?: string | null` prop (fed `transaction.expenseTitle`); precedence is now `customTitle ?? fallbackTitle ?? description`, applied both to the display value and the edit-mode seed value. The "Originale: {description}" caption is untouched.
- **Files modified:** `components/transactions/transaction-title-edit.tsx`, `components/transactions/transaction-table.tsx` (pass the new prop), `tests/transaction-title-edit.test.tsx` (new)
- **Commit:** `899541f`

No architectural changes (Rule 4) were needed. No auth gates encountered.

## Issues Encountered

- Pre-existing, out-of-scope failures re-confirmed during this plan's verification runs (not fixed, per scope-boundary rule) — see `.planning/phases/61-standalone-expense/deferred-items.md`:
  - 4 pre-existing `check:language` violations in files this plan does not touch.
  - Pre-existing `vitest`/`tsc` failures in `tests/expense-actions.test.ts`, `tests/import-table-actions.test.tsx`, `tests/overview-interactions.test.tsx`, `tests/cascade-options.test.ts`, `tests/category-combobox.test.tsx`, `tests/file-download-api.test.ts`, `tests/suggestion-card.test.tsx`, `tests/suggestion-promote-form.test.tsx`, `tests/transactions-dal.test.ts` — none reference the files this plan modified.
  - All tests directly relevant to this plan (`transaction-detach-service`, `transaction-detach-action`, and the new `transaction-title-edit`) are GREEN: 18/18 passing when run together at close-out.

## Human Verification (Task 3)

- **What was built:** Inline "Spesa a sé (non aggregare)" action on any transaction with a linked expense (Transazioni table row menu), capturing a title and a subcategory in one dialog and detaching into a dedicated, already-categorized expense — including when the source expense holds only that single transaction.
- **How verified:** Human ran `yarn dev`, tested the multi-transaction case (title + subcategory prompt, correct row update, other same-description transactions unaffected) and the single-transaction case (action now present, no guard error, in-place re-hash, category shown on the row), confirmed the copy reads as general/one-off rather than counterparty-specific.
- **First pass:** flagged the row-title regression (raw bank description shown instead of the standalone expense's title).
- **Fix applied:** commit `899541f` (see Deviations above).
- **Re-test outcome:** **"approvato"** — checkpoint closed, no further issues raised.

## User Setup Required

None — no external service configuration, no schema migration (consistent with ADR 0016; confirmed no changes under `drizzle/migrations/`).

## Next Phase Readiness

Phase 61 (standalone-expense) is now fully delivered: STEXP-01 and STEXP-02 land in this plan (backend groundwork in 61-01, UI surfacing here); STEXP-03 (isolation property) was proven at the hash level in 61-01. All 3 requirements are satisfied. This closes out the single-phase v2.4 milestone (Standalone Expense) — no further phases planned for v2.4.

No blockers.

---
*Phase: 61-standalone-expense*
*Completed: 2026-07-01*

## Self-Check: PASSED

All modified files (detach-expense-dialog.tsx, transaction-table.tsx, transaction-title-edit.tsx, transaction-title-edit.test.tsx, deferred-items.md) and all 3 commit hashes (b2fc326, 9af9475, 899541f) verified present on disk and in git log. Targeted test run (transaction-title-edit.test.tsx, transaction-detach-service.test.ts, transaction-detach-action.test.ts) — 18/18 passing.
