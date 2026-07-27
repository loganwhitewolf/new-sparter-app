---
phase: 74-group-anchor-and-reconciliation
plan: 02
subsystem: database
tags: [drizzle, postgres, decimal.js, sql, reimbursement, residual]

# Dependency graph
requires:
  - phase: 74-group-anchor-and-reconciliation
    provides: "Plan 74-01's uniform proportional-spread effectiveAmount() (Expense OR Expense Group anchor) and the seedExpenseGroup/seedReimbursementOnGroup fixtures reused here for the Group-anchor test case"
provides:
  - "getReimbursementAggregates(reimbursementId, userId) -- IDOR-safe DAL read resolving outflowSum (Expense's own totalAmount, or SUM across expense_group_membership members for a Group anchor) and refundSum (SUM of linked reimbursement_refund transaction amounts)"
  - "computeReimbursementResidual(reimbursementId, userId) -- service-layer residual = outflowSum + refundSum via Decimal.js, with state owed/settled/surplus derived purely from sign, no magnitude guard"
  - "7-case real-Postgres test suite proving residual correctness across empty-refund/owed, partial/owed, full/settled, over-repayment/surplus, order-independence, Group-anchor SUM, and cross-user IDOR"
affects: [75-linking-surfaces, 76-reimbursements-section]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Raw SQL with an explicit outer-row alias (`r`) instead of Drizzle's typed column proxies inside correlated subqueries -- Drizzle renders `${table.column}` as a BARE quoted column name, not table-qualified, which is ambiguous once the subquery joins tables sharing that column name (id, expense_id)"
    - "vi.doMock('@/lib/db', ...) + vi.resetModules() + dynamic import to feed a DAL/service module the real-Postgres test harness client, reusing captureAggregationSnapshot's existing technique (tests/helpers/reimbursement-test-db.ts) for a plain (non-snapshot) DAL/service pair"

key-files:
  created:
    - lib/dal/reimbursement.ts
    - lib/services/reimbursement.ts
    - tests/reimbursement-residual.test.ts
  modified: []

key-decisions:
  - "getReimbursementAggregates() written as one db.execute(sql`...`) raw statement with an explicit `r` alias for the outer reimbursement row, not Drizzle's .select({...}).from(reimbursement).where(...) with typed column refs -- the latter rendered `${reimbursement.id}`/`${reimbursement.expenseId}` as bare unqualified column names, which Postgres rejected as ambiguous inside the correlated subqueries (reimbursement_refund + transaction both have an `id` column). Same convention as effectiveAmount() in lib/dal/transaction-pairs-sql.ts (Rule 1 bug fix, no semantic change to the plan's specified query shape)."
  - "Test file feeds lib/dal/reimbursement.ts the real-Postgres harness client via vi.doMock('@/lib/db', () => ({ db: harness.db })) + vi.resetModules() + dynamic import, mirroring captureAggregationSnapshot's existing technique -- required because a plain static import of the DAL/service would build its own connection off the ambient (unset in test) DATABASE_URL and fail with a SASL auth error."

patterns-established:
  - "A DAL/service pair with no UI consumer yet (Phase 75/76 will render it) is still tested end-to-end against real Postgres, not a chain-mocked stub -- correctness proven before any surface exists."

requirements-completed: [RMB-06]

coverage:
  - id: D1
    description: "computeReimbursementResidual on an Expense anchor returns the exact residual + state for empty-refund (owed), 3-of-4-partial (owed, -25.00 -- the exact 'ancora dovuti €25' motivating example), full-repayment (settled, 0.00 exact zero boundary), and over-repayment (surplus, +20.00, never blocked)"
    requirement: "RMB-06"
    verification:
      - kind: integration
        ref: "tests/reimbursement-residual.test.ts#computeReimbursementResidual — Expense anchor (Task 1) [4 of 5 cases]"
        status: pass
    human_judgment: false
  - id: D2
    description: "residual is order-independent: linking the same set of refunds in two different insertion orders yields the identical residual (it is a SUM)"
    requirement: "RMB-06"
    verification:
      - kind: integration
        ref: "tests/reimbursement-residual.test.ts#computeReimbursementResidual — Expense anchor (Task 1) > order-independence"
        status: pass
    human_judgment: false
  - id: D3
    description: "A Group-anchored reimbursement's residual sums totalAmount across every expense_group_membership member (2-member group -300.00/-100.00, one partial refund of 150.00 -> residual=-250.00, owed) -- exercises the Group-branch SUM, not just its declared existence"
    requirement: "RMB-06"
    verification:
      - kind: integration
        ref: "tests/reimbursement-residual.test.ts#computeReimbursementResidual — Group anchor + cross-user IDOR (Task 2) > Group anchor"
        status: pass
    human_judgment: false
  - id: D4
    description: "Querying another user's reimbursementId returns undefined from both getReimbursementAggregates and computeReimbursementResidual -- never leaks residual data across users (IDOR, T-74-05)"
    requirement: "RMB-06"
    verification:
      - kind: integration
        ref: "tests/reimbursement-residual.test.ts#computeReimbursementResidual — Group anchor + cross-user IDOR (Task 2) > cross-user IDOR"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-07-24
status: complete
---

# Phase 74 Plan 02: Reimbursement Residual Summary

**`getReimbursementAggregates()` + `computeReimbursementResidual()` deliver residual as a Decimal-safe, on-the-fly computed value (never persisted) — owed/settled/surplus across Expense and Expense Group anchors, IDOR-safe by WHERE-clause construction, proven by 7 real-Postgres tests.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-07-24T09:35:00Z (approx)
- **Completed:** 2026-07-24T10:13:00Z
- **Tasks:** 2
- **Files modified:** 3 (all new)

## Accomplishments
- `lib/dal/reimbursement.ts`: `getReimbursementAggregates({ reimbursementId, userId })` resolves `{ outflowSum, refundSum }` — the anchor's own outflow (single Expense's `totalAmount`, or the SUM across `expense_group_membership` members for a Group anchor) and the SUM of every linked `reimbursement_refund` transaction's amount. IDOR-safe by construction: the WHERE clause scopes both `id` and `userId` together, returning `undefined` on any mismatch — the same generic "not found" shape as `updateTransaction`'s ownership check.
- `lib/services/reimbursement.ts`: `computeReimbursementResidual({ reimbursementId, userId })` derives `residual = outflowSum + refundSum` via Decimal.js and classifies `state: 'owed' | 'settled' | 'surplus'` purely by sign — negative/zero/positive, no magnitude guard (D-03).
- 7 real-Postgres test cases in `tests/reimbursement-residual.test.ts`, all passing: empty-refund (owed), 3-of-4-partial (owed, -25.00), full-repayment (settled, 0.00), over-repayment (surplus, +20.00), order-independence, Group-anchor SUM (-250.00, owed), and cross-user IDOR (undefined for both functions, confirmed still resolves for the real owner).
- No schema footprint — no migration, no new column, residual is a pure computed read (D-03).

## Task Commits

Each task was committed atomically:

1. **Task 1: getReimbursementAggregates() + computeReimbursementResidual() — core states (Expense anchor)** - `05b93fa` (test, RED) then `3e36301` (feat, GREEN)

**Plan metadata:** (this commit)

_Task 1 was `tdd="true"`: RED committed first (failing tests importing not-yet-existing modules, confirmed via module-resolution failure), then GREEN (DAL + service implementation, all 5 behavior cases passing). Task 2's Group-anchor and cross-user IDOR test cases were authored together with Task 1's test file in the same session and are included in the `3e36301` GREEN commit — both tasks' full 7-case suite was verified green before that commit, so no separate Task 2 commit exists (see Deviations)._

## Files Created/Modified
- `lib/dal/reimbursement.ts` - `getReimbursementAggregates()`, IDOR-safe raw-SQL aggregate read
- `lib/services/reimbursement.ts` - `computeReimbursementResidual()`, Decimal-safe residual + state classification
- `tests/reimbursement-residual.test.ts` - 7-case real-Postgres suite (5 Expense-anchor cases + Group-anchor + cross-user IDOR)

## Decisions Made
- `getReimbursementAggregates()` written as a single `db.execute(sql\`...\`)` raw statement with an explicit `r` alias for the outer `reimbursement` row, instead of Drizzle's `.select({...}).from(reimbursement).where(...)` with typed column proxies. The typed-proxy form rendered `${reimbursement.id}` / `${reimbursement.expenseId}` as bare unqualified column names (`"id"`, `"expense_id"`), which Postgres rejected as ambiguous once referenced inside correlated subqueries whose own joined tables (`reimbursement_refund`, `transaction`) also carry an `id` column. Same raw-alias convention `effectiveAmount()` already uses in `lib/dal/transaction-pairs-sql.ts`. Pure SQL-structuring fix — the query's specified shape and semantics (CASE branch for Expense vs. Group, COALESCE/SUM behavior) are unchanged from the plan.
- The test file feeds `lib/dal/reimbursement.ts` the real-Postgres harness client via `vi.doMock('@/lib/db', () => ({ db: harness.db }))` + `vi.resetModules()` + dynamic import — the same technique `captureAggregationSnapshot()` (`tests/helpers/reimbursement-test-db.ts`) already uses, applied here to a plain DAL/service pair rather than a snapshot function. Without this, the DAL would build its own connection off the ambient (unset in test) `DATABASE_URL` and fail with a SASL auth error, never reaching the harness database at all.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Raw-SQL with explicit `r` alias instead of Drizzle typed column proxies**
- **Found during:** Task 1 (implementing `getReimbursementAggregates()`)
- **Issue:** The plan's action block described the query using Drizzle's typed column style (`${reimbursement.expenseId}` etc.) inside CASE/subquery expressions. Running it against real Postgres threw `column reference "id" is ambiguous` — Drizzle renders those typed refs as bare unqualified column names, not table-qualified, and the correlated subqueries below (`reimbursement_refund rr INNER JOIN transaction rt`) both have their own `id` column, making the bare reference ambiguous.
- **Fix:** Rewrote the query as one `db.execute(sql\`...\`)` raw statement with an explicit `FROM reimbursement r` alias, referencing `r.expense_id` / `r.expense_group_id` / `r.id` explicitly everywhere — the same convention `effectiveAmount()` already established in `lib/dal/transaction-pairs-sql.ts`. Formula, CASE branches, and COALESCE/SUM semantics are unchanged from the plan's spec.
- **Files modified:** lib/dal/reimbursement.ts
- **Verification:** All 7 test cases pass with the exact expected values specified in the plan (owed -25.00, settled 0.00, surplus +20.00, Group-anchor -250.00, IDOR undefined).
- **Committed in:** 3e36301 (Task 1 GREEN commit)

**2. [Process deviation] Task 2's test cases committed together with Task 1's GREEN commit, no separate Task 2 commit**
- **Found during:** Task 2 (Group-anchor + cross-user IDOR test cases)
- **Issue:** Both tasks' test cases were authored in the same test-writing pass (all 7 cases written to `tests/reimbursement-residual.test.ts` before the RED run), rather than Task 1's 5 cases being committed and verified independently before Task 2 added its 2 cases.
- **Fix:** No functional fix needed — this is a commit-granularity deviation, not a code defect. Both tasks' acceptance criteria are independently verifiable in the final state (5 Task 1 cases + 2 Task 2 cases, all passing) and the plan's own verification step (`vitest run tests/reimbursement-residual.test.ts` exits 0, 7 cases) is satisfied.
- **Files modified:** none beyond what Task 1's commit already includes.
- **Verification:** `node_modules/.bin/vitest run tests/reimbursement-residual.test.ts` — 7/7 tests pass, including the Group-anchor (-250.00, owed) and cross-user IDOR (undefined for both functions, confirmed resolves for the real owner) cases specified in Task 2.
- **Committed in:** 3e36301 (no separate Task 2 commit exists)

---

**Total deviations:** 2 (1 auto-fixed bug — Rule 1; 1 process/commit-granularity deviation, no code impact)
**Impact on plan:** The SQL fix was necessary for the query to be valid at all; the specified aggregation logic, sign convention, and IDOR scoping are implemented exactly as designed. The commit-granularity deviation does not affect correctness or the plan's own verification gate — both tasks' acceptance criteria are met in the final committed state.

## Issues Encountered
An earlier agent run in this same plan hit an API transport error (connection closed) after both task commits (05b93fa, 3e36301) landed but before SUMMARY.md was written. Verified before writing this SUMMARY: both commits are present in `git log`, all three target files exist on disk with the expected content, the working tree was clean, and `node_modules/.bin/vitest run tests/reimbursement-residual.test.ts` re-confirmed 7/7 passing — no re-implementation or re-commit was needed, only this close-out (SUMMARY + STATE + ROADMAP).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `computeReimbursementResidual()` and `getReimbursementAggregates()` are ready for Phase 75/76 to render — no UI consumer exists yet, by design (this plan's job was correctness only, per the objective).
- Both functions build on Plan 74-01's now-complete proportional-spread `effectiveAmount()` layer without depending on any further change to `lib/dal/transaction-pairs-sql.ts` — confirmed via `git diff` showing only the two new files (`lib/dal/reimbursement.ts`, `lib/services/reimbursement.ts`) touched.
- No blockers for Plan 74-03 (amount-edit guard message improvement, RMB-09) — it builds on `lib/services/transaction-edit.ts`, untouched by this plan.

---
*Phase: 74-group-anchor-and-reconciliation*
*Completed: 2026-07-24*
