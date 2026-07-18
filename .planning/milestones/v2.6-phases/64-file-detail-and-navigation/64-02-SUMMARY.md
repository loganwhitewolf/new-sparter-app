---
phase: 64-file-detail-and-navigation
plan: 02
subsystem: ui
tags: [next-link, react, table-cell, navigation]

# Dependency graph
requires:
  - phase: 63-detail-pages-tx-expense
    provides: transactionDetailHref / expenseDetailHref route helpers and the /transactions/[id] and /expenses/[id] detail pages these links now point to
provides:
  - Row-title click navigates to the transaction/expense detail page (D-04)
  - Pencil icon remains an independent inline-edit trigger, unchanged edit-mode form behavior
affects: [file-detail-and-navigation, transaction-table, expense-table]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Title-cell link+pencil split: non-edit-mode renders a next/link Link wrapping the title span, and a sibling <button type=\"button\"> wrapping only the Pencil icon — mirrors the existing coexistence pattern from import-display-name-edit's caption row, but now with the title itself as a real anchor"

key-files:
  created:
    - tests/expense-title-edit.test.tsx
  modified:
    - components/transactions/transaction-title-edit.tsx
    - components/expenses/expense-title-edit.tsx
    - tests/transaction-title-edit.test.tsx

key-decisions:
  - "Expense pencil aria-label changed from the plan's literal \"Modifica nome spesa\" to \"Rinomina spesa\" to avoid colliding with the pre-existing expense-table-menu.test.tsx guard 'never renders a Modifica menu entry', which does a substring match for 'Modifica' anywhere in the rendered row (Rule 1 bug fix)."
  - "Transaction pencil aria-label kept as the plan's literal \"Modifica titolo\" — no equivalent guard test exists for transactions."

patterns-established:
  - "Table-cell title-as-link + pencil-as-edit split (D-04): same shape now used consistently in TransactionTitleEdit and ExpenseTitleEdit."

requirements-completed: [DET-09]

coverage:
  - id: D1
    description: "TransactionTitleEdit renders the title as a real Link to /transactions/{id}, with the pencil as an independent edit-trigger button"
    requirement: "DET-09"
    verification:
      - kind: unit
        ref: "tests/transaction-title-edit.test.tsx#renders the title as a link to the transaction detail page"
        status: pass
      - kind: unit
        ref: "tests/transaction-title-edit.test.tsx#renders the pencil trigger as a plain button, not wrapped in the link"
        status: pass
    human_judgment: false
  - id: D2
    description: "ExpenseTitleEdit renders the title as a real Link to /expenses/{id}, with the pencil as an independent edit-trigger button"
    requirement: "DET-09"
    verification:
      - kind: unit
        ref: "tests/expense-title-edit.test.tsx#renders the title as a link to the expense detail page"
        status: pass
      - kind: unit
        ref: "tests/expense-title-edit.test.tsx#renders the pencil trigger as a plain button, not wrapped in the link"
        status: pass
    human_judgment: false
  - id: D3
    description: "Restructure does not regress existing title-edit display-precedence tests or the Dettagli-menu table tests"
    verification:
      - kind: unit
        ref: "tests/transaction-title-edit.test.tsx (4 pre-existing tests, unmodified assertions)"
        status: pass
      - kind: unit
        ref: "tests/transaction-table-menu.test.tsx"
        status: pass
      - kind: unit
        ref: "tests/expense-table-menu.test.tsx"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-07-06
status: complete
---

# Phase 64 Plan 02: Title-as-Link Split Summary

**TransactionTitleEdit and ExpenseTitleEdit now render the row title as a genuine `next/link` Link to the entity's detail page, with the pencil icon split into its own independent edit-trigger button — closing the DET-09 gap where clicking a row title never navigated anywhere.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-06T12:55:00Z
- **Completed:** 2026-07-06T12:57:45Z
- **Tasks:** 2
- **Files modified:** 4 (2 components, 2 test files — 1 new)

## Accomplishments
- `TransactionTitleEdit` non-edit-mode markup now contains `<a href="/transactions/{id}">` wrapping the title text, sitting beside a separate `<button type="button" aria-label="Modifica titolo">` for the pencil
- `ExpenseTitleEdit` non-edit-mode markup now contains `<a href="/expenses/{id}">` wrapping the title text, sitting beside a separate `<button type="button" aria-label="Rinomina spesa">` for the pencil
- Edit-mode form behavior (value seeding, escape-to-cancel, `useActionState` wiring, MIN_TITLE_LENGTH disable rule) is byte-for-byte unchanged in both components
- New `tests/expense-title-edit.test.tsx` created (file did not exist before); `tests/transaction-title-edit.test.tsx` extended with 2 new link/pencil-isolation tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Split TransactionTitleEdit into a link (title) + button (pencil)** - `839c297` (feat, TDD)
2. **Task 2: Split ExpenseTitleEdit into a link (title) + button (pencil)** - `2c5a0a5` (feat, TDD)

_Note: both tasks were completed test-first (existing/new assertions written or extended before the implementation split), per `tdd="true"`._

## Files Created/Modified
- `components/transactions/transaction-title-edit.tsx` - non-edit-mode branch restructured: `<Link href={transactionDetailHref(id)}>` wraps the title span; a sibling `<button aria-label="Modifica titolo">` wraps the Pencil icon
- `components/expenses/expense-title-edit.tsx` - non-edit-mode branch restructured: `<Link href={expenseDetailHref(id)}>` wraps the title span; a sibling `<button aria-label="Rinomina spesa">` wraps the Pencil icon
- `tests/transaction-title-edit.test.tsx` - added 2 tests asserting the link href and pencil-button isolation; all 4 pre-existing tests pass unmodified
- `tests/expense-title-edit.test.tsx` - new file (3 tests): title visibility, link href, pencil-button isolation

## Decisions Made
- Changed the expense pencil's `aria-label` from the plan's literal `"Modifica nome spesa"` to `"Rinomina spesa"` — the literal string collided with `tests/expense-table-menu.test.tsx`'s pre-existing guard `expect(html).not.toContain('Modifica')` (asserting the retired "Modifica" dialog menu entry from Phase 63 never reappears). The guard does a substring match across the whole rendered row, so any string containing "Modifica" trips it regardless of context. `"Rinomina spesa"` preserves the same semantic (rename affordance) without the collision, consistent with `ImportDisplayNameEdit`'s existing `aria-label={"Rinomina importazione " + displayTitle}` convention in this codebase.
- Kept the transaction pencil's `aria-label` as `"Modifica titolo"` per the plan literally — no equivalent guard test exists in `tests/transaction-table-menu.test.tsx`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Expense pencil aria-label collided with existing "no Modifica menu entry" guard test**
- **Found during:** Task 2 (ExpenseTitleEdit split)
- **Issue:** The plan's `<action>` block specified `aria-label="Modifica nome spesa"` for the new pencil button. Running the plan's own verification step (`tests/expense-table-menu.test.tsx`) after implementing showed the pre-existing test `'never renders a Modifica menu entry'` failing — that test does a blanket `expect(html).not.toContain('Modifica')` over the full rendered table row, guarding against the retired Phase-63 "Modifica" dialog menu item. The new aria-label's substring accidentally tripped that unrelated guard.
- **Fix:** Renamed the aria-label to `"Rinomina spesa"` (no literal "Modifica" substring), matching the existing `ImportDisplayNameEdit` rename-labeling convention already used elsewhere in the codebase.
- **Files modified:** `components/expenses/expense-title-edit.tsx`, `tests/expense-title-edit.test.tsx` (updated the new test's aria-label selector to match)
- **Verification:** `yarn vitest run tests/transaction-title-edit.test.tsx tests/expense-title-edit.test.tsx tests/transaction-table-menu.test.tsx tests/expense-table-menu.test.tsx` — 17/17 pass
- **Committed in:** `2c5a0a5` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix, Rule 1)
**Impact on plan:** Cosmetic string-only fix to avoid a false test collision; no scope creep, no behavior change beyond the label text.

## Issues Encountered
- Broader `yarn vitest run` (full suite) surfaced 4 pre-existing failing test files (`tests/overview-interactions.test.tsx`, `lib/validations/__tests__/expense.test.ts`) unrelated to this plan's files — confirmed via `git log` that those files were last touched by unrelated prior commits (`19143a8`, `3d99988`), and this plan's diff (`git diff HEAD~2 --stat`) touches only the 4 files listed above. Out of scope per the scope-boundary rule; not fixed, not re-run.

## Next Phase Readiness
- DET-09 title-link behavior is now consistent between `TransactionTitleEdit` and `ExpenseTitleEdit`, matching the existing file-name link pattern (D-04) referenced in `64-CONTEXT.md`.
- No blockers for remaining Phase 64 plans (file-detail page, navigation wiring).

---
*Phase: 64-file-detail-and-navigation*
*Completed: 2026-07-06*
