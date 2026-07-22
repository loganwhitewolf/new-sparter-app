---
phase: 66-expense-group-lifecycle
plan: 03
subsystem: testing
tags: [vitest, expense-group, dashboard, invariance-test, drizzle]

# Dependency graph
requires:
  - phase: 66-expense-group-lifecycle
    plan: 02
    provides: categorizeExpenseGroup/dissolveExpenseGroupAction/categorizeExpense server actions (lib/actions/expenses.ts)
  - phase: 66-expense-group-lifecycle
    plan: 01
    provides: createExpenseGroup/dissolveExpenseGroup DbOrTx-accepting service functions (lib/services/expense-group.ts)
provides:
  - tests/expense-group-invariance.test.ts — GRP-09 acceptance gate proving merge/dissolve never move a dashboard total and group-recategorize's movement equals individual recategorization
  - createFixtureDb() — reusable-pattern stateful in-memory fake db (select/insert/update/delete, nested-row innerJoin support, table-identity dispatch) exercising REAL action/service code, not re-derived mock logic
affects: [phase-66 completion gate, any future phase touching dashboard aggregation or expense-group lifecycle]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stateful fixture db (createFixtureDb) as a factory, not a module singleton — each test/scenario gets fully independent closured state, while db.transaction(fn) still passes through as fn(db) directly (no real transactional semantics), matching the established mocks.dbTransaction precedent"
    - "vi.hoisted mutable currentDb pointer proxied by the module-scope vi.mock('@/lib/db', ...) factory — lets a single hoisted mock still serve per-test fresh fixture instances"
    - "Column-ref resolution (getField) works uniformly across nested (joined select) and flat (update/delete/insert) rows by checking for a table-keyed wrapper before falling back to direct field lookup — avoids needing two separate resolvers"

key-files:
  created:
    - tests/expense-group-invariance.test.ts
  modified: []

key-decisions:
  - "snapshotBreakdown hand-computes the GROUP BY (categoryId, subCategoryId) step mirroring getCategoriesBreakdown's semantics, then delegates to the REAL buildBreakdownData export — only the SQL aggregation itself (which needs live Postgres) is faked, not the shape/percentage logic"
  - "Two subcategories (CAT_A_SUB 'Bollette', CAT_C_SUB 'Affitto') deliberately share one parent category (Casa) so Assertion B proves a SUBcategory-level movement, not a category-level one that recategorization-within-the-same-category would trivially satisfy"
  - "Scenario A and Scenario B are independent createFixtureDb() instances seeded identically; Scenario B reads Scenario A's captured post-recategorize snapshot via a describe-scope variable, relying on Vitest's default sequential in-file test order (both in one describe block)"

patterns-established:
  - "Fixture db's insert().values() and update().set().where() return values are themselves Promises with an attached .returning() method — this lets production code call either `await x.insert(t).values(v)` (no .returning()) or `await x.insert(t).values(v).returning(f)` against the identical mock without branching"

requirements-completed: [GRP-09]

coverage:
  - id: D1
    description: "GRP-09 invariance test drives the real mergeExpenses/categorizeExpenseGroup/dissolveExpenseGroupAction/categorizeExpense actions and createExpenseGroup/dissolveExpenseGroup services against a stateful fake db, proving merge and dissolve never move a dashboard aggregate and group-recategorize's movement equals individual recategorization"
    requirement: "GRP-09"
    verification:
      - kind: unit
        ref: "tests/expense-group-invariance.test.ts (Scenario A: merge/recategorize/dissolve; Scenario B: individual comparison) — both passing"
        status: pass
    human_judgment: false
  - id: D2
    description: "Test is not vacuously true — manually verified during development that breaking categorizeExpenseGroup's member update makes Assertion B fail (production code reverted, not committed)"
    verification:
      - kind: unit
        ref: "manual scratch verification (see Deviations/notes below) — not a committed test, documented for audit trail"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-07-19
status: complete
---

# Phase 66 Plan 03: Expense Group Invariance Test Summary

**GRP-09 acceptance test proving merge/dissolve never move a dashboard total and group-recategorize's movement exactly matches recategorizing the same members individually, driving the real actions/services against a stateful in-memory fake db**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-19T22:32:48+02:00
- **Tasks:** 1
- **Files modified:** 1 (created)

## Accomplishments
- Built `tests/expense-group-invariance.test.ts` with a reusable `createFixtureDb()` factory: a stateful in-memory fake `db` supporting `select`/`insert`/`update`/`delete`, table-identity dispatch (matching `expense`/`expenseGroup`/`expenseGroupMembership` string-keyed schema mocks), a nested-row `innerJoin` implementation (specifically the `expenseGroupMembership → expense` join pattern used by `categorizeExpenseGroup` and `categorizeExpense`'s D-03 guard), and a generic `evalCond`/`getField` descriptor evaluator reused across select/update/delete.
- Implemented `snapshotBreakdown(expenses, transactions)` — hand-computes the `(categoryId, subCategoryId)` GROUP BY step mirroring `getCategoriesBreakdown`'s live SQL semantics, then delegates to the REAL `buildBreakdownData` export from `lib/dal/dashboard.ts` for shape/percentage computation.
- Scenario A (grouped path): merge → recategorize → dissolve, asserting (A) merge is byte-identical to pre-merge, (B) recategorize moves the `Casa/Bollette → Casa/Affitto` subcategory total (60.00 → 0.00 / 0.00 → 60.00) while `Svago/Cinema` stays untouched at 15.00, (C) dissolve is byte-identical to the immediately-prior post-recategorize state, plus a D-09 structural assertion that freed members keep the RECATEGORIZED subcategory (not reverted) and the dissolved group/memberships are gone.
- Scenario B (individual comparison path): a fresh, identically-seeded fixture recategorizes the same three expenses one at a time via `categorizeExpense`, proving the resulting aggregate snapshot is byte-identical to Scenario A's post-recategorize snapshot — the actual GRP-09 "no hidden movement" proof.
- Manually verified (scratch, not committed) that the test is not vacuously true: temporarily skipping `categorizeExpenseGroup`'s member update made both assertions fail as expected; production code was reverted immediately after and confirmed clean via `git diff`.

## Task Commits

1. **Task 1: GRP-09 invariance test** — `e4e1ef2` (test)

**Plan metadata:** commit pending (final docs commit, see below)

## Files Created/Modified
- `tests/expense-group-invariance.test.ts` — the GRP-09 acceptance test; internal (non-exported) helpers `createFixtureDb()` and `snapshotBreakdown(...)` live only in this file, per the plan's scope note

## Decisions Made
- Reused the exact `@/lib/db/schema` mock shape from `tests/expense-actions.test.ts` (including `category`/`subCategory`/`userSubcategoryOverride` stubs) because `lib/actions/expenses.ts` transitively imports `lib/dal/expenses.ts`, which computes several `sql\`\`` sort-key constants at MODULE SCOPE referencing those tables directly — omitting them would throw on import, not just on call.
- Used `values` (not `vals`) as the `inArray` mock's second property name, matching `tests/expense-group-dal.test.ts`'s convention rather than `tests/expense-group-service.test.ts`'s (`vals`) — the plan explicitly named the DAL test file as the source of truth for this operator shape.

## Deviations from Plan

None — plan executed exactly as written. One scratch-only production-code edit was made and reverted during the "not vacuously true" manual verification step (see Accomplishments); `git diff` confirmed `lib/actions/expenses.ts` was clean before committing.

## Issues Encountered
None. The test passed on first implementation attempt; only a single TypeScript type-only forward-reference fix was needed (`ReturnType<typeof createFixtureDbForHoist>` → direct `FixtureDb` type reference) to satisfy `tsc --noEmit` cleanly.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- Phase 66's stated acceptance gate (`vitest tests/expense-group-invariance.test.ts --run` exits 0) is green; full suite (`vitest run`) confirms no regressions (124 test files, 1508 tests passing, 1 pre-existing todo).
- `yarn check:language` passes — no Italian leaked into developer-facing test code.
- Phase 66 is now ready for Plans 04 (table/dialog UI) and 05 (group detail UI), both already backed by the complete GRP-05/06/07 server-action surface from Plans 01/02, now with GRP-09's safety guarantee proven against real code.

---
*Phase: 66-expense-group-lifecycle*
*Completed: 2026-07-19*

## Self-Check: PASSED

`tests/expense-group-invariance.test.ts` exists on disk; commit hash `e4e1ef2` verified present in `git log --oneline --all`.
