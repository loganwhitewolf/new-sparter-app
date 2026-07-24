---
phase: 74-group-anchor-and-reconciliation
plan: 04
gap_closure: true
subsystem: services
tags: [drizzle, decimal.js, postgres, pair-guard, reimbursement, correlated-subquery]

# Dependency graph
requires:
  - phase: 74-group-anchor-and-reconciliation
    provides: "74-REVIEW.md CR-01/CR-02 findings; expense_group_id/expense_group_membership schema and effectiveAmount()'s member-set resolution pattern (74-01)"
provides:
  - "updateTransaction()'s pair guard detects a GROUP-anchored reimbursement on any member transaction of the group (CR-01), not just a single Expense-anchor's earliest transaction"
  - "The refund-edit branch's anchor magnitude resolves ΣmemberOutflow for a Group anchor instead of silently defaulting to 0 (CR-02)"
  - "The anchor-magnitude and refund-count subqueries in the refund-edit branch correlate via a bound reimbursementId parameter (through an `anchor` CTE wrapped in scalar subqueries) instead of a bare, unqualified Drizzle column reference — closing a correlation-ambiguity/tautology bug that silently broke this branch for EVERY anchor shape, discovered by this plan's real-Postgres tests (the first time updateTransaction() has ever been run against a real database)"
affects: [75-linking-surfaces-and-lifecycle, 76-reimbursements-section]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Correlating a nested SQL fragment back to an outer Drizzle query builder row: never splice a Drizzle Column proxy (${table.column}) directly into a correlated subquery — it renders as a bare, unqualified identifier that Postgres binds to the INNERMOST scope with a same-named column, not necessarily the intended outer row. Wrap the value in its own scalar subquery against a small CTE (or bind a JS value as a parameter) instead."

key-files:
  created:
    - tests/reimbursement-guard-group-anchor.test.ts
  modified:
    - lib/services/transaction-edit.ts

key-decisions:
  - "CR-01 fix mirrors the review's suggested shape exactly: asAnchorReimbursementId gains an OR branch matching any transaction whose expense is a member of the anchor's expense_group_id (via expense_group_membership), alongside the unchanged Expense-anchor earliest-transaction branch."
  - "CR-02 fix keeps the Expense-anchor subquery byte-identical (still the earliest transaction's own amount) and adds a CASE ELSE branch computing ΣmemberOutflow for a Group anchor: SUM over every member Expense's own (non-refund-linked) transactions, mirroring effectiveAmount()'s member_transactions CTE."
  - "WR-01 (the Expense-anchor tie-break only recognizing the earliest transaction of a multi-transaction Expense) is explicitly OUT of scope for this gap-closure per plan instructions — left unchanged, not touched."
  - "WR-02 (extract a shared anchor-resolution helper) declined — the plan marked it optional, and the fix stayed correctly scoped as inline SQL changes to the two touched query fragments."
  - "Additional in-scope bug fix (not one of the two named CRs, but blocking correctness of the exact code CR-02 touches): the refund-edit branch's anchorAmount/otherRefundsSum/refundCount subqueries previously referenced reimbursement.expenseId / reimbursement.id as bare Drizzle column proxies inside nested correlated subqueries that already had same-named local columns (t3.expense_id, rr.id) — Postgres silently bound to the wrong local column instead of correlating outward. Fixed by routing every anchor-row reference through the already-resolved reimbursementId JS value (a bound parameter), wrapped in an `anchor` CTE for the two values (expense_id, expense_group_id) that must come from the reimbursement row itself."

patterns-established:
  - "Real-Postgres test coverage for updateTransaction() (previously untested against a live database at all) using the same vi.doMock('@/lib/db', ...) + vi.resetModules() + dynamic import pattern as tests/reimbursement-residual.test.ts"

requirements-completed: [RMB-09]

coverage:
  - id: D1
    description: "A same-sign amount edit on a member transaction of a GROUP-anchored reimbursement is blocked with the pair-guard message (CR-01 regression) — previously unguarded entirely"
    requirement: "RMB-09"
    verification:
      - kind: integration
        ref: "tests/reimbursement-guard-group-anchor.test.ts#CR-01: blocks a same-sign amount edit on a member transaction of a GROUP-anchored reimbursement"
        status: pass
    human_judgment: false
  - id: D2
    description: "A valid opposite-sign amount edit on a group-anchor member is allowed and persisted"
    requirement: "RMB-09"
    verification:
      - kind: integration
        ref: "tests/reimbursement-guard-group-anchor.test.ts#a valid opposite-sign amount edit on a group-anchor member PASSES and is persisted"
        status: pass
    human_judgment: false
  - id: D3
    description: "A refund edit on a GROUP-anchored reimbursement evaluates against the anchor's real ΣmemberOutflow, not zero — both the opposite-sign-allowed and same-sign-blocked directions (CR-02 regression)"
    requirement: "RMB-09"
    verification:
      - kind: integration
        ref: "tests/reimbursement-guard-group-anchor.test.ts#CR-02: a refund edit on a GROUP-anchored reimbursement evaluates against the anchor's real ΣmemberOutflow, not zero"
        status: pass
      - kind: integration
        ref: "tests/reimbursement-guard-group-anchor.test.ts#CR-02: a same-sign refund edit on a GROUP-anchored reimbursement is still correctly blocked"
        status: pass
    human_judgment: false
  - id: D4
    description: "Expense-anchor N=1 refund-edit path (unchanged by this fix) still evaluates correctly for the first time against real Postgres, and the pre-existing DB-mocked/regression suites (transaction-edit, pair-guard-message, reimbursement-regression, reimbursement-residual, reimbursement-invariant) all stay green unchanged"
    requirement: "RMB-09"
    verification:
      - kind: integration
        ref: "tests/reimbursement-guard-group-anchor.test.ts#sanity check: the Expense-anchor N=1 refund-edit path (unchanged by this fix) still evaluates correctly against real Postgres"
        status: pass
      - kind: unit
        ref: "full vitest run (yarn vitest run) — 144 files, 1778 tests + 1 todo, all pass"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-07-24
status: complete
---

# Phase 74 Plan 04: Group-Anchor Pair-Guard Gap Closure Summary

**Closed both CONFIRMED critical gaps from 74-REVIEW.md (CR-01/CR-02) in the RMB-09 amount-edit pair guard, plus a correlation-ambiguity bug the fix's own real-Postgres tests surfaced in the same code block — the pair guard's refund-edit branch had never been exercised against a real database until this plan.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 1 gap-closure task (fix CR-01 + CR-02 + write real-Postgres tests + iterate to green)
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- **CR-01 closed:** `asAnchorReimbursementId` in `updateTransaction()` now matches a Group-anchored reimbursement via `reimbursement.expense_group_id` (resolved through `expense_group_membership`), in addition to the unchanged Expense-anchor earliest-transaction branch. Any member transaction of a Group anchor now triggers the guard, mirroring `effectiveAmount()`'s member-set semantics.
- **CR-02 closed:** the refund-edit branch's `anchorAmount` subquery now branches on which XOR column is set — Expense anchor keeps the exact pre-existing earliest-transaction lookup (byte-identical); Group anchor sums every member Expense's own (non-refund-linked) transactions (ΣmemberOutflow), never silently defaulting to `0`.
- **Additional bug found and fixed by the fix's own tests:** the refund-edit branch's `anchorAmount`/`otherRefundsSum`/`refundCount` subqueries previously spliced `reimbursement.expenseId` / `reimbursement.id` as bare Drizzle column proxies into nested correlated subqueries that already had a same-named local column (`t3.expense_id`, `rr.id`). Postgres silently bound the bare reference to the wrong LOCAL column (a self-referential tautology for `expense_id`, an ambiguity error for `id` once joined) instead of correlating outward to the intended reimbursement row — meaning the refund-edit guard had never actually evaluated against the correct anchor magnitude, for EITHER anchor shape, since this code was introduced. Fixed by wrapping every reference to the anchor row's own columns in a small `anchor` CTE accessed via scalar subqueries, and by using the already-resolved `reimbursementId` JS value (a bound parameter) instead of a bare `${reimbursement.id}` proxy.
- Added `tests/reimbursement-guard-group-anchor.test.ts` — 5 real-Postgres tests (the harness pattern from `tests/reimbursement-residual.test.ts`) proving: CR-01's block on a group member, a valid opposite-sign group-member edit passing, CR-02's refund-edit evaluating against the real ΣmemberOutflow in both directions (allow/block), and a sanity check that the Expense-anchor N=1 refund-edit path — now run against a real database for the first time — still resolves correctly.
- Verified: full `vitest run` (144 files, 1778 tests + 1 pre-existing todo) green, `tsc --noEmit` clean, `yarn check:language` clean, all 6 focused runs of the guard/regression suites green across repeated executions (the correlation bug was intermittent/order-dependent before the fix — now deterministic).

## Task Commits

Each logical change was committed atomically:

1. **Fix CR-01/CR-02 + correlation-ambiguity bug + add real-Postgres guard tests** - `2a4cbc6` (fix)

**Plan metadata:** (this commit)

## Files Created/Modified

- `lib/services/transaction-edit.ts` - `asAnchorReimbursementId` gains the Group-anchor OR branch (CR-01); the refund-edit branch's `anchorAmount` gains a Group-anchor CASE branch (CR-02) and both it and `otherRefundsSum`/`refundCount` now correlate via the bound `reimbursementId` parameter instead of a bare column proxy
- `tests/reimbursement-guard-group-anchor.test.ts` - New real-Postgres suite: 5 tests covering CR-01, CR-02 (both directions), a passing group-member edit, and an Expense-anchor N=1 sanity check

## Decisions Made

- Kept the fix minimal and inline (no extraction of a shared anchor-resolution DAL helper, per WR-02's explicit "optional" status) — the diff stays scoped to the two touched query fragments.
- Left WR-01 (Expense-anchor tie-break only recognizing the earliest transaction of a multi-transaction Expense) untouched, exactly as instructed — it is a separate, non-required warning.
- Chose to fix the bare-column-proxy correlation bug in the same query block as CR-02, rather than deferring it: without the fix, the refund-edit branch could not be proven correct by any real-Postgres test (the anchor magnitude would resolve to an arbitrary transaction's amount instead of the anchor's), which is exactly the correctness gap this gap-closure plan exists to close.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a correlation-ambiguity/tautology bug in the refund-edit branch's anchor-magnitude and refund-count subqueries**
- **Found during:** writing the real-Postgres tests for CR-02 (the "sanity check" Expense-anchor N=1 test failed intermittently)
- **Issue:** `${reimbursement.expenseId}` and `${reimbursement.id}` (Drizzle Column proxies) were spliced directly into nested correlated subqueries that already had a same-named local column (`t3.expense_id`, `rr.id`/`rt.id`). Postgres bound the bare, unqualified reference to the innermost local column instead of correlating outward — for `expense_id` this created a self-referential tautology (`t3.expense_id = t3.expense_id`, true for every row), silently returning an arbitrary/globally-earliest transaction's amount instead of the anchor's; for `id` it either threw "column reference is ambiguous" (once joined with `transaction rt`) or, worse, silently matched the wrong row with no error at all (the `refundCount` subquery, unjoined).
- **Fix:** Wrapped every anchor-row column reference in a small `anchor` CTE, accessed only via its own scalar subquery (`(SELECT expense_id FROM anchor)`), which forces unambiguous resolution regardless of nesting depth; replaced the bare `${reimbursement.id}` references with the already-resolved `reimbursementId` JS bound parameter.
- **Files modified:** `lib/services/transaction-edit.ts`
- **Verification:** 6 repeated full runs of the guard/regression suites (`transaction-edit`, `pair-guard-message`, `reimbursement-regression`, `reimbursement-residual`, `reimbursement-invariant`, `reimbursement-guard-group-anchor`) all green with zero flakiness after the fix, versus intermittent failure before it.
- **Committed in:** `2a4cbc6` (same commit as CR-01/CR-02, since it is in the identical query block and the gap-closure could not be proven correct without it)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug, discovered via the plan's own required real-Postgres testing)
**Impact on plan:** Necessary for correctness — CR-02 could not be verified true without it, since the pre-existing bug silently broke the refund-edit branch for both anchor shapes, not just the Group one. No scope creep beyond the plan's two named gaps plus this directly-blocking discovery.

## Issues Encountered

The "sanity check" real-Postgres test (Expense-anchor N=1 refund edit) failed intermittently when run alongside the other reimbursement test files, but passed reliably in isolation — traced to the correlation-ambiguity bug above (order/UUID-dependent, since the bare `expense_id` reference resolved to whichever transaction happened to sort first by `occurred_at`/`id` across the whole table, not necessarily the anchor's own). Debugged via a temporary `GSD_DEBUG_GUARD` env-gated `console.error` + `.toSQL()` dump (removed before the final commit) to confirm the exact rendered SQL and observed `anchorAmount` value, which pinpointed the bare bare-identifier tautology.

## User Setup Required

None - no external service configuration required. No schema/migration changes.

## Next Phase Readiness

- Phase 74 (group-anchor-and-reconciliation) is now fully closed: 74-01 (proportional-spread `effectiveAmount()`), 74-02 (residual value), 74-03 (pair-guard N>1 message), 74-04 (this gap-closure) all shipped and reviewed clean.
- RMB-02, RMB-06, RMB-09 all satisfied — no gaps carried forward.
- Phase 75 (linking-surfaces-and-lifecycle) can proceed: the guard now correctly protects Group-anchored reimbursements on any member transaction, and the refund-edit branch evaluates against the real anchor magnitude for both anchor shapes.

---
*Phase: 74-group-anchor-and-reconciliation*
*Completed: 2026-07-24*

## Self-Check: PASSED

- FOUND: .planning/phases/74-group-anchor-and-reconciliation/74-04-SUMMARY.md
- FOUND: tests/reimbursement-guard-group-anchor.test.ts
- FOUND: commit 2a4cbc6
