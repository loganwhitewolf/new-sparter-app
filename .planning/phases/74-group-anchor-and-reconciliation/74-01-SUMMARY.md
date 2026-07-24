---
phase: 74-group-anchor-and-reconciliation
plan: 01
subsystem: database
tags: [drizzle, postgres, decimal.js, sql, netting, reimbursement]

# Dependency graph
requires:
  - phase: 73-reimbursement-schema-and-netting
    provides: reimbursement/reimbursement_refund schema (XOR anchor: expenseId or expenseGroupId), isNotSecondary()/effectiveAmount() netting fragment, reimbursement-invariant.ts sign-only guard, the real-Postgres regression harness (tests/helpers/reimbursement-test-db.ts, tests/fixtures/reimbursement-seed.ts)
provides:
  - "effectiveAmount() rewritten as one uniform proportional-spread mechanism (D-01/D-02): every member transaction of a reimbursement's anchor (Expense OR Expense Group) absorbs refundNet * memberAmount / SigmaMemberOutflow, largest-remainder cent assigned to the largest-magnitude member"
  - "Group-anchor netting is no longer a documented gap -- the expenseGroupId branch of effectiveAmount() is fully implemented and regression-proven"
  - "3 new fixture builders (seedSecondEssentialCategory, seedExpenseGroup, seedReimbursementOnGroup) for constructing Group-anchor test scenarios natively"
  - "8-scenario regression suite (5 pre-existing Expense-anchor scenarios + 3 new Group-anchor scenarios) proving numerical correctness across every dashboard aggregation site"
affects: [74-02-residual-and-aggregates, 74-03-amount-edit-guard-message, 75-linking-surfaces, 76-reimbursements-section]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Proportional netting share expressed as a correlated WITH-clause scalar subquery embedded inside a SELECT list (Postgres allows WITH inside a scalar subquery)"
    - "Largest-remainder cent assignment via ROW_NUMBER() OVER (ORDER BY ABS(amount) DESC, occurredAt ASC, id ASC) tie-break, reused from Phase 73's Q3 deterministic ordering convention"
    - "Zero-sum division guard via NULLIF(denominator, 0) + COALESCE(share, 0) so a pathological zero-sum member set degrades to each member's raw amount instead of a Postgres division-by-zero error"

key-files:
  created: []
  modified:
    - lib/dal/transaction-pairs-sql.ts
    - tests/reimbursement-regression.test.ts
    - tests/fixtures/reimbursement-seed.ts

key-decisions:
  - "effectiveAmount() rewritten as a single CTE-chain expression (anchor -> member_expense_ids -> member_transactions -> refund_total -> raw_shares -> member_shares) instead of a two-branch CASE, so Expense and Group anchors share exactly one code path (D-02)"
  - "Anchor resolution: a transaction's anchor is the reimbursement whose expense_id equals the transaction's own expense_id, OR whose expense_group_id matches the group the transaction's expense belongs to (via expense_group_membership) -- at most one match given the existing unique constraints"
  - "refund_total resolved by reimbursement id (not expense_id directly), generalizing the old expense_id-keyed lookup so it also covers Group anchors"
  - "Q3 scenario's expected per-transaction values updated from 0.00/-50.00 to -25.00/-25.00 (the earliest-wins rule is now the N=1/N=2-equal-magnitude degenerate case of the same proportional formula); its aggregation-surface assertion (-50.00 combined) is unchanged, as specified"

patterns-established:
  - "Group-anchor test fixtures follow the same additive, one-row-then-loop shape as the Expense-anchor fixtures (seedExpenseGroup mirrors seedReimbursement; seedReimbursementOnGroup is seedReimbursement with expenseGroupId instead of expenseId)"

requirements-completed: [RMB-02]

coverage:
  - id: D1
    description: "effectiveAmount() implements one uniform proportional-spread mechanism for both Expense- and Group-shaped anchors; every pre-existing single-transaction-anchor (N=1) scenario stays numerically inert"
    requirement: "RMB-02"
    verification:
      - kind: integration
        ref: "tests/reimbursement-regression.test.ts#reimbursement N=1 regression (Phase 73, ADR 0018 D-07) [10 assertions]"
        status: pass
      - kind: integration
        ref: "tests/reimbursement-regression.test.ts#empty-refund probe (RMB-04)"
        status: pass
      - kind: integration
        ref: "tests/reimbursement-regression.test.ts#dinner N=3 / adjacency-exceeds / ordering scenarios"
        status: pass
    human_judgment: false
  - id: D2
    description: "Q3 multi-transaction Expense anchor scenario updated to the new proportional-spread values (-25.00/-25.00 instead of 0.00/-50.00), aggregation-surface assertion (-50.00 combined) unchanged"
    requirement: "RMB-02"
    verification:
      - kind: integration
        ref: "tests/reimbursement-regression.test.ts#Q3 -- multi-transaction Expense anchor proportional spread"
        status: pass
    human_judgment: false
  - id: D3
    description: "Group anchor spanning two subcategories nets each member transaction in its own subcategory via the same proportional spread -- invisible on top-line totalOut, correct per-category (D-05)"
    requirement: "RMB-02"
    verification:
      - kind: integration
        ref: "tests/reimbursement-regression.test.ts#Group anchor spanning two subcategories -- proportional spread per D-05 (Scenario A)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Per-transaction shares sum back to the exact linked-refund total at the centesimo via largest-remainder cent assignment, tie-broken by ABS(amount) DESC, occurredAt ASC, id ASC"
    requirement: "RMB-02"
    verification:
      - kind: integration
        ref: "tests/reimbursement-regression.test.ts#Group anchor largest-remainder cent exactness (Scenario B)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A Group anchor whose member transactions sum to exactly zero never causes effectiveAmount() to throw or divide by zero -- it falls back to each member's raw, unnetted amount"
    requirement: "RMB-02"
    verification:
      - kind: integration
        ref: "tests/reimbursement-regression.test.ts#Group anchor division-by-zero guard -- zero-sum member set (Scenario C)"
        status: pass
    human_judgment: false

duration: 75min
completed: 2026-07-24
status: complete
---

# Phase 74 Plan 01: Group-Anchor Proportional Spread Summary

**Rewrote `effectiveAmount()` from a two-branch earliest-transaction-wins CASE into one uniform proportional-spread SQL expression covering both Expense and Expense Group anchors, with largest-remainder cent exactness and a zero-sum division guard, proven against 8 regression scenarios (19 tests) on real Postgres.**

## Performance

- **Duration:** 75 min (includes a tracer feedback checkpoint pause between Task 1 and Task 2)
- **Started:** 2026-07-24T09:33:45Z (approx, session start)
- **Completed:** 2026-07-24T10:01:02Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `effectiveAmount()` (`lib/dal/transaction-pairs-sql.ts`) rewritten as a single correlated `WITH`-clause scalar subquery: `anchor` -> `member_expense_ids` -> `member_transactions` -> `refund_total` -> `raw_shares` -> `member_shares`, replacing the old "anchor gets everything via earliest-transaction tie-break" CASE. Every member transaction of a reimbursement's anchor (Expense OR Expense Group) now absorbs `refundNet * memberAmount / SigmaMemberOutflow`, rounded to the cent, with the fractional-cent remainder assigned to the largest-magnitude member (tie-break: `occurredAt ASC, id ASC`).
- `isNotSecondary()` confirmed byte-identical (verified via `git diff` at Task 1 commit time — the diff touched only `effectiveAmount()`'s body).
- Fills the documented Phase 73 gap: the `expense_group_id` branch of `effectiveAmount()` is no longer a silent no-op — it is the same mechanism as the Expense branch (D-02, one mechanism, no special case).
- 3 new additive fixture builders in `tests/fixtures/reimbursement-seed.ts`: `seedSecondEssentialCategory`, `seedExpenseGroup`, `seedReimbursementOnGroup` — `seedReimbursement`'s existing signature is untouched.
- 3 new Group-anchor regression scenarios proving RMB-02's remaining gray areas: cross-subcategory attribution (D-05), largest-remainder cent exactness (RMB-02/precision + RMB-02/ordering), and the division-by-zero landmine (RMB-02/empty).
- Full regression suite: 8 `describeIfReachable` blocks, 19 tests, all green against the real local Postgres harness (Docker container `sparter-postgres`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Proportional-spread `effectiveAmount()` rewrite + N=1/N=2-member inertness proof** - `ebeab65` (feat)
2. **Task 2: Group-anchor regression matrix — multi-subcategory spread, largest-remainder exactness, division-by-zero guard** - `93fd7ca` (test)

**Plan metadata:** (this commit)

_Task 1 was a `type="tracer"` task; because this run is interactive (not auto-mode), the executor stopped after committing it and returned a `checkpoint:human-verify` presenting the already-green regression run before proceeding to Task 2. The orchestrator approved and Task 2 proceeded as additive fixtures/tests only, with no further changes to `effectiveAmount()`._

## Files Created/Modified
- `lib/dal/transaction-pairs-sql.ts` - `effectiveAmount()` rewritten to the proportional-spread CTE chain; `isNotSecondary()` untouched
- `tests/reimbursement-regression.test.ts` - Q3 scenario updated to the new spread values; 3 new Group-anchor `describeIfReachable` blocks (Scenarios A/B/C) appended
- `tests/fixtures/reimbursement-seed.ts` - 3 new additive fixture builders (`seedSecondEssentialCategory`, `seedExpenseGroup`, `seedReimbursementOnGroup`)

## Decisions Made
- effectiveAmount() implemented exactly per the plan's specified CTE shape (anchor resolution via `reimbursement.expense_id OR reimbursement.expense_group_id` matched through `expense_group_membership`), with one adjustment for SQL correctness: the plan's pseudocode referenced a `raw_share` alias within the same `member_shares` SELECT list (residual/final_share computed from `SUM(raw_share) OVER()` in the same statement as `raw_share`'s own definition) — Postgres does not allow referencing a SELECT-list alias from another expression in the same SELECT level. Split into two CTEs instead: `raw_shares` (computes `raw_share` + `rn` via `ROW_NUMBER()`) then `member_shares` (computes `final_share` from `raw_shares`, referencing the now-materialized `raw_share` column). This is a pure SQL-structuring fix, not a semantic change — the formula, tie-break, and guard behavior are identical to the plan's spec (Rule 1 — bug fix, auto-applied, verified: all 8 scenarios pass with the exact expected numeric values specified in the plan, including the -25.00/-25.00 Q3 values and the -66.66/-66.67/-66.67 largest-remainder values).
- Q3 scenario's expected per-transaction values updated from `0.00`/`-50.00` to `-25.00`/`-25.00` per the plan's explicit instruction; the aggregation-surface assertion (`expectedCombined = '-50.00'`) left unchanged, as specified.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Split the `member_shares` CTE into `raw_shares` + `member_shares` to avoid an invalid same-level SELECT-list alias reference**
- **Found during:** Task 1 (writing the `effectiveAmount()` rewrite)
- **Issue:** The plan's pseudocode computes `residual` and `final_share` in the same SELECT statement that defines `raw_share`, referencing `raw_share` via `SUM(raw_share) OVER ()` — Postgres rejects referencing a SELECT-list output alias from another expression at the same query level.
- **Fix:** Split into two CTEs: `raw_shares` computes `raw_share` (with `NULLIF`/`ROUND`) and `rn` (via `ROW_NUMBER()`); `member_shares` then reads `raw_shares.raw_share` to compute `final_share` (`COALESCE(raw_share, 0) + CASE WHEN rn = 1 THEN total - SUM(raw_share) OVER () ELSE 0 END`). The formula, tie-break, and zero-sum-guard semantics are unchanged from the plan's spec.
- **Files modified:** lib/dal/transaction-pairs-sql.ts
- **Verification:** All 8 regression scenarios (19 tests) pass with the exact expected values specified in the plan (Q3: -25.00/-25.00; Scenario B: -66.66/-66.67/-66.67; Scenario C: -50.00/50.00 unchanged).
- **Committed in:** ebeab65 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — SQL structuring fix, no semantic change)
**Impact on plan:** The fix was necessary for the SQL to be valid at all; the specified formula, tie-break rule, and zero-sum guard are implemented exactly as designed. No scope creep.

## Issues Encountered
None beyond the SQL-structuring deviation documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `effectiveAmount()` is now a complete, regression-proven proportional-spread mechanism usable unchanged by every consumer (`lib/dal/dashboard.ts`, `lib/dal/overview.ts`, `lib/dal/tags.ts`) with zero call-site changes — ready for Plan 74-02's residual/reconciliation DAL to build on top of the same reimbursement/reimbursement_refund schema.
- `lib/services/reimbursement-invariant.ts` (sign-only invariant) confirmed still correct and untouched — no magnitude guard needed for Plan 74-02's residual work (D-03).
- No blockers for Plan 74-02 (`getReimbursementAggregates()`/`computeReimbursementResidual()`) or Plan 74-03 (amount-edit guard message improvement) — both build on the now-complete netting layer without depending on any further change to `transaction-pairs-sql.ts`.

---
*Phase: 74-group-anchor-and-reconciliation*
*Completed: 2026-07-24*
