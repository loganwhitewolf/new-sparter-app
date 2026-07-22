---
phase: 66-expense-group-lifecycle
fixed_at: 2026-07-20T10:17:50Z
review_path: .planning/phases/66-expense-group-lifecycle/66-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 66: Code Review Fix Report

**Fixed at:** 2026-07-20T10:17:50Z
**Source review:** .planning/phases/66-expense-group-lifecycle/66-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (2 critical, 3 warning — `fix_scope: critical_warning`; IN-01 excluded by scope, no action required per the reviewer's own note)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: `ignoreExpense` has no group-membership guard

**Files modified:** `lib/actions/expenses.ts`
**Commit:** f47825d
**Applied fix:** Added the same D-03 defense-in-depth guard used by `categorizeExpense`/`deleteExpensesWithOptions` before the status update — queries `expenseGroupMembership` joined to `expense` (scoped to `userId`) and rejects with `'Questa spesa fa parte di un gruppo: rimuovila dal gruppo prima di ignorarla.'` if the target expense is currently a group member. Verified against a real (non-mocked) tsc pass and the full `expense-actions.test.ts` suite (32/32 passing).

### CR-02: `addExpensesToGroupAction` admits an uncategorized expense into a categorized group

**Files modified:** `lib/actions/expenses.ts`, `tests/expense-actions.test.ts`
**Commit:** 0473025
**Applied fix:** Added an explicit `rows.some((row) => row.subCategoryId === null)` rejection (`'Categorizza prima di aggiungere al gruppo.'`) before the "same category" comparison, mirroring `mergeExpenses`' outright null rejection. Per instructions, also fixed the test that previously asserted the gap as intended behavior: renamed/narrowed `'calls addExpensesToGroup when all additions are uncategorized-or-matching'` to `'... when all additions already match the group category'` (fixture now uses a matching non-null `subCategoryId` instead of `null`), added a new test `'rejects an uncategorized addition without calling addExpensesToGroup'` asserting the corrected rejection, and adjusted the unrelated `'surfaces addExpensesToGroup errors verbatim'` fixture (which incidentally used `subCategoryId: null`) to a matching category so it still exercises service-error passthrough rather than tripping the new guard.

### WR-01: `removeExpenseFromGroupAction` discards the `autoDissolved` signal

**Files modified:** `lib/actions/expenses.ts`, `components/expenses/remove-group-member-button.tsx`, `components/expenses/group-detail-client.tsx`, `tests/expense-actions.test.ts`
**Commit:** a6b0556
**Applied fix:** Introduced `RemoveExpenseFromGroupActionState = ActionState & { autoDissolved: boolean }` as the action's return type (safe to widen — the action is invoked via a direct manual `await`, not bound through `useActionState`/`useFormState`, so no prev/return type coupling to any other caller). `removeExpenseFromGroupAction` now threads the service's `autoDissolved` result through on every path (success, validation failure, and the caught-error path all return an explicit `autoDissolved: false` except the genuine service result). `RemoveGroupMemberButton`'s `onSuccess` prop signature changed to `(autoDissolved: boolean) => void`; `GroupDetailClient` now redirects to `APP_ROUTES.expenses` on `autoDissolved === true` (mirroring `handleDissolve`'s redirect) instead of calling `router.refresh()` into a since-deleted group detail page. Added a new unit test asserting the `autoDissolved: true` passthrough and updated the two existing `removeExpenseFromGroupAction` assertions to include the new field. Note: `tests/group-detail-page.test.tsx`'s `GroupDetailClient` describe block only exercises SSR (`renderToStaticMarkup`), so the redirect branch itself is verified by type-checking + the straightforward conditional logic + the action-level `autoDissolved` unit test, not by a DOM-interaction test — this file has no existing jsdom/user-event harness to hook into without introducing new test infrastructure beyond this finding's scope.

### WR-02: No invariance coverage for add-to-group or remove-member

**Files modified:** `tests/expense-group-invariance.test.ts`
**Commit:** c4c052c
**Applied fix:** Added a new `describe('WR-02: add-to-group / remove-member invariance', ...)` block with three scenarios against the same real-action / fixture-db harness as the existing GRP-09 suite: (1) adding an already-categorized, ungrouped member to an existing group leaves the dashboard-breakdown snapshot byte-identical, and adding an uncategorized one is rejected (CR-02) without moving the aggregate either; (2) removing a member down to the auto-dissolve boundary (`autoDissolved: true`) leaves the aggregate byte-identical and the freed member keeps its category; (3) removing a member from a 3-member group (`autoDissolved: false`) also never moves the aggregate. Extended the in-memory fixture db in two ways needed to support these scenarios faithfully: added `count()` aggregate-select support (previously only per-row projection existed) for `removeExpenseFromGroup`'s TOCTOU membership count, and added cascade-delete of membership rows when their parent `expenseGroup` row is deleted, mirroring the real schema's `ON DELETE CASCADE` on `expenseGroupMembership.groupId` (`lib/db/schema.ts`) — without this the fixture left an orphaned membership row after auto-dissolve that the real Postgres schema would never produce.

### WR-03: Inconsistent monetary-string formatting helpers in the same component

**Files modified:** `components/expenses/group-detail-client.tsx`
**Commit:** 2b2043a
**Applied fix:** Rewrote `formatTransactionAmount` to route the DECIMAL string through `toDecimal` before formatting (with the same try/catch fallback pattern already used by `formatSignedAmount` in the same file), replacing the raw `parseFloat`. No behavior change intended (neither helper performs arithmetic) — this is purely the consistency fix the reviewer asked for.

## Skipped Issues

None — all in-scope findings (2 critical, 3 warning) were fixed.

## Verification

- `node_modules/.bin/tsc --noEmit -p tsconfig.json` — no errors in any modified file (checked per-commit and after all commits).
- `node_modules/.bin/vitest run tests/` — full suite: **120 test files passed, 1463 tests passed, 1 pre-existing todo** (post all five fixes).
- `node scripts/check-code-language.mjs` — English code convention check passed (dev-facing comments/identifiers stayed English; new/changed user-facing strings are Italian, consistent with existing product surfaces).

---

_Fixed: 2026-07-20T10:17:50Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
