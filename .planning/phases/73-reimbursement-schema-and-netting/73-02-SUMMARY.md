---
phase: 73-reimbursement-schema-and-netting
plan: 02
subsystem: database
tags: [drizzle, postgres, vitest, decimal.js, netting, invariants]

# Dependency graph
requires:
  - phase: 73-01
    provides: "reimbursement + reimbursement_refund schema, backfill migration, generalized effectiveAmount()/isNotSecondary(), captureAggregationSnapshot harness, seedLegacyPair/seedMinimalTaxonomy fixtures"
provides:
  - "D-02 invariant enforcement module (assertOutflowAnchorAmount/assertInflowRefundAmount/assertReimbursementAmounts), reusable by Plan 73-04's repointed createPair"
  - "Full N>1 regression proof: dinner (N=3), both adjacency directions, refund-order determinism, Q3 multi-transaction-Expense tie-break — each across the 10 (or 8 non-tag-scoped) verified aggregation functions"
  - "First real numeric proof of migration 0029's backfill correctness (K=5 independent pairs, zero orphans, zero cross-wiring, 0-row safety)"
  - "seedReimbursement/seedIndependentLegacyPair fixture builders"
  - "Cross-file test-harness serialization (Postgres advisory lock) fixing a real race between reimbursement-regression.test.ts and migration-backfill.test.ts"
affects: [73-03-reimbursement-schema-and-netting, 73-04-reimbursement-schema-and-netting]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Session-level Postgres advisory lock (pg_advisory_lock) held for a test file's pool lifetime, serializing cross-FILE access to the shared real-Postgres harness — vitest's default file-level parallelism otherwise interleaves two files' TRUNCATE/insert cycles against the same DB"
    - "Native reimbursement/reimbursement_refund fixture seeding (seedReimbursement) for N>1 scenarios that have no legacy transaction_pair equivalent"
    - "Shared-taxonomy pattern for bulk multi-user fixtures: direction.code/nature.code are globally unique (not user-scoped), so seedMinimalTaxonomy is seeded ONCE and passed into per-user helpers, never re-seeded per user"

key-files:
  created:
    - lib/services/reimbursement-invariant.ts
    - tests/reimbursement-invariant.test.ts
    - tests/migration-backfill.test.ts
  modified:
    - tests/reimbursement-regression.test.ts
    - tests/fixtures/reimbursement-seed.ts
    - tests/helpers/reimbursement-test-db.ts

key-decisions:
  - "Q3's per-transaction attribution is proven via a direct raw effectiveAmount() fragment probe per sibling transaction (not through any of the 10 aggregation functions), then via the COMBINED category/month total across the aggregation surface — because getCategoryDetail's topTransactions carries the RAW transaction.amount (not effectiveAmount()), and 5 of the 8 non-tag-scoped functions hard-code their date scope to captureAggregationSnapshot's fixed 'last-month' preset regardless of the harness's dateRange argument, making true per-sibling date-range isolation impossible across all 8."
  - "getOverviewChart's out.* segments ARE abs()'d when bucketed (lib/dal/overview.ts), even though the underlying SELECT computes a raw signed SUM — only getMonthlyTrendByNature truly preserves sign. Adjacency-exceeds/ordering/Q3 scenarios assert accordingly per function, not uniformly."
  - "seedIndependentLegacyPair takes a pre-seeded MinimalTaxonomy parameter instead of calling seedMinimalTaxonomy internally per pair (Rule 1 fix, discovered via failing test): direction.code/nature.code carry a global unique constraint, not scoped per user."
  - "connectReimbursementTestDb() now serializes cross-file access via a session-level Postgres advisory lock with idleTimeoutMillis: 0 (Rule 3 fix, discovered via failing full-suite run): vitest's default parallel file execution let two harness-using test files corrupt each other's fixtures via concurrent TRUNCATE/insert cycles against the same local Postgres instance."

requirements-completed: [RMB-03, RMB-04, RMB-05]

coverage:
  - id: D1
    description: "D-02 invariant enforcement module: assertOutflowAnchorAmount/assertInflowRefundAmount/assertReimbursementAmounts — pure Decimal.js checks, zero DB dependencies, reusable by Plan 73-04's createPair"
    requirement: "RMB-03"
    verification:
      - kind: unit
        ref: "tests/reimbursement-invariant.test.ts — 8/8 behavior cases (outflow accept/reject/zero, inflow accept/reject/zero, dinner-shaped accept, one-bad-refund-in-a-set reject)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Dinner (N=3 refunds netting to exactly the anchor magnitude, tagged anchor): nets to 0 across all 10 aggregation functions; every refund directly excluded via isNotSecondary(); anchor row stays present at amount 0 (adjacency-exact)"
    requirement: "RMB-04"
    verification:
      - kind: integration
        ref: "tests/reimbursement-regression.test.ts > 'dinner — N=3 refunds netting to exactly the anchor magnitude (Phase 73 Plan 02, scenarios 1+2)'"
        status: pass
    human_judgment: false
  - id: D3
    description: "Adjacency-exceeds (refunds summing to MORE than the anchor magnitude, internal N=2): net flips positive, reflected identically per each function's own established sign convention (abs() vs raw signed sum)"
    requirement: "RMB-04"
    verification:
      - kind: integration
        ref: "tests/reimbursement-regression.test.ts > 'adjacency-exceeds — refunds summing to MORE than the anchor magnitude (Phase 73 Plan 02, scenario 3)'"
        status: pass
    human_judgment: false
  - id: D4
    description: "Ordering — refund insert order does not affect the SUM used by effectiveAmount(), pinned explicitly across both possible insert orders"
    requirement: "RMB-04"
    verification:
      - kind: integration
        ref: "tests/reimbursement-regression.test.ts > 'ordering — refund insert order does not affect the SUM used by effectiveAmount() (Phase 73 Plan 02, scenario 4)' (it.each, both orders)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Q3 — multi-transaction Expense anchor tie-break: nets only the earliest transaction of the anchor expense; the later sibling stays at its raw amount"
    requirement: "RMB-04"
    verification:
      - kind: integration
        ref: "tests/reimbursement-regression.test.ts > 'Q3 — multi-transaction Expense anchor tie-break (Phase 73 Plan 02, scenario 5)'"
        status: pass
    human_judgment: false
  - id: D6
    description: "Migration-backfill row-count reconciliation: K=5 independent legacy transaction_pair rows across different users backfill to exactly 5 reimbursement + 5 reimbursement_refund rows, zero orphans, zero cross-wiring; an empty transaction_pair table backfills to zero rows with no error"
    requirement: "RMB-05"
    verification:
      - kind: integration
        ref: "tests/migration-backfill.test.ts > 'migration-backfill row-count reconciliation (Phase 73 Plan 02, RMB-05)' (2 tests)"
        status: pass
    human_judgment: false

# Metrics
duration: ~55min active execution (interrupted once mid-Task-2 by an API connection error; resumed and reconciled against on-disk state and prior commits per orchestrator instruction, no rework)
completed: 2026-07-23
status: complete
---

# Phase 73 Plan 02: D-02 Invariant Module and Full N>1 Regression Matrix Summary

**D-02 outflow-anchor/inflow-refund invariant module plus a 5-scenario real-Postgres regression matrix (dinner N=3, both adjacency directions, refund-order determinism, Q3 tie-break) and the first numeric proof of migration 0029's backfill correctness, each scenario asserted across the full 10-function aggregation surface via 73-01's captureAggregationSnapshot harness.**

## Performance

- **Duration:** ~55 min active execution (one API-connection interruption mid-Task-2; resumed from on-disk state, no rework needed)
- **Completed:** 2026-07-23
- **Tasks:** 2 (1 TDD, 1 auto)
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments

- `lib/services/reimbursement-invariant.ts` — `assertOutflowAnchorAmount`/`assertInflowRefundAmount`/`assertReimbursementAmounts`: pure, dependency-free Decimal.js checks mirroring the existing opposite-sign convention in `lib/services/transaction-pairs.ts`, ready for Plan 73-04's repointed `createPair` as defense-in-depth alongside the DB-level XOR/uniqueness constraints.
- Expanded `tests/reimbursement-regression.test.ts` from 73-01's single N=1 scenario to 5 additional real-Postgres scenarios (dinner N=3, adjacency-exact, adjacency-exceeds, refund-order determinism, Q3 multi-transaction-Expense tie-break), each asserted across the full aggregation surface (10 functions for the tagged dinner case, 8 non-tag-scoped for the rest) using 73-01's `captureAggregationSnapshot` helper unchanged.
- New `tests/migration-backfill.test.ts` — the first real numeric proof that migration 0029 correctly backfills K=5 independent legacy `transaction_pair` rows across different users into `reimbursement`/`reimbursement_refund`, with zero orphans, zero cross-wiring, and 0-row safety.
- Extended `tests/fixtures/reimbursement-seed.ts` with `seedReimbursement` (native reimbursement + N refunds, for scenarios with no legacy-pair equivalent) and `seedIndependentLegacyPair` (bulk multi-user backfill fixtures).
- Discovered and fixed a real cross-file test race in `tests/helpers/reimbursement-test-db.ts`: two harness-using test files running in parallel vitest workers corrupted each other's fixtures via concurrent `TRUNCATE`/insert cycles against the same local Postgres instance. Fixed with a session-level Postgres advisory lock, scoped entirely to the harness file.

## Task Commits

Each task was committed atomically:

1. **Task 1: D-02 invariant enforcement module** (TDD) — `e9bfe78` (test, RED) → `b2025ab` (feat, GREEN); no refactor commit needed (module was minimal and clean as written)
2. **Task 2: Full regression matrix + migration-backfill correctness, across all 10 aggregation functions** — `8306086` (test)

**Plan metadata:** committed alongside this SUMMARY (see final commit)

## Files Created/Modified

- `lib/services/reimbursement-invariant.ts` — D-02 invariant enforcement (RMB-03): `assertOutflowAnchorAmount`, `assertInflowRefundAmount`, `assertReimbursementAmounts`
- `tests/reimbursement-invariant.test.ts` — 8 unit tests for the invariant module
- `tests/reimbursement-regression.test.ts` — added 4 new `describe` blocks (5 scenarios total: dinner+adjacency-exact combined, adjacency-exceeds, ordering (`it.each`, 2 orders), Q3)
- `tests/migration-backfill.test.ts` — K=5 row-count reconciliation + 0-row safety
- `tests/fixtures/reimbursement-seed.ts` — added `seedReimbursement`, `seedIndependentLegacyPair`
- `tests/helpers/reimbursement-test-db.ts` — added the cross-file advisory-lock serialization and `idleTimeoutMillis: 0`

## Decisions Made

- **Q3's per-transaction attribution proof technique (Claude's discretion, documented in-test).** The plan's literal wording asked to "call captureAggregationSnapshot scoped to each of the two sibling transactionIds." No such per-transaction scoping parameter exists on any of the 10 functions. Investigation found: (a) `getCategoryDetail`'s `topTransactions` list carries the RAW `transaction.amount`, never `effectiveAmount()` (confirmed by reading `buildCategoryDetailData` in `lib/dal/dashboard.ts`) — so no function exposes a per-row netted amount at all; (b) 5 of the 8 non-tag-scoped functions (`getCategoriesBreakdown`, `getCategoryRanking`, `getCategoryDeviations`, `getCategoryDetail`, `getMonthlyTrendByNature`) hard-code their date scope to `captureAggregationSnapshot`'s fixed `'last-month'` preset, ignoring the harness's `dateRange` argument entirely — so isolating each sibling by month, as the frozen-fragment N=1 proof does, only works for the other 3 functions. Resolution: prove the tie-break rule directly via a raw `effectiveAmount()` fragment probe per sibling transaction (0.00 for the earlier/anchor, -50.00 unchanged for the later), then prove it holds through the aggregation surface via the COMBINED category/month total (-50.00), which is a value that uniquely distinguishes correct Q3 behaviour from both failure modes (no netting: -100.00; over-netting both legs: 0.00). This preserves the underlying intent (proving Q3 across the real aggregation surface) given the actual function signatures available.
- **getOverviewChart's out.* segments are abs()'d, not raw-signed.** Read `lib/dal/overview.ts`'s bucket-building loop and found `const absAmount = toDecimal(rawAmount).abs().toFixed(2)` is applied before adding to `bucket.out.essential/discretionary/debt`, even though the underlying SELECT computes a raw signed SUM. Only `getMonthlyTrendByNature` (via `buildMonthlyNatureTrendData`) preserves sign. The adjacency-exceeds/ordering/Q3 scenarios assert `chartPoint.out.essential` against `expectedNet.abs()`, not the signed value — corrected after an initial wrong assumption produced 3 failing assertions during Task 2 verification.
- **Shared-taxonomy pattern for `seedIndependentLegacyPair`.** `direction.code` and `nature.code` carry a global (not user-scoped) unique constraint. Calling `seedMinimalTaxonomy` once per independent backfill pair (as first written) violated it on the second call. Fixed by seeding taxonomy ONCE and passing it into every `seedIndependentLegacyPair` call — sharing category/subcategory ownership across the K backfill users does not affect backfill correctness, since the migration keys strictly on transaction/expense `user_id`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `seedIndependentLegacyPair` re-seeding global taxonomy per call**
- **Found during:** Task 2 (running `tests/migration-backfill.test.ts` for the first time)
- **Issue:** `seedIndependentLegacyPair` called `seedMinimalTaxonomy(db, userId)` internally for every one of the K=5 loop iterations; `direction.code`/`nature.code` have a global unique constraint, so the second call threw a duplicate-key error.
- **Fix:** Changed `seedIndependentLegacyPair`'s signature to accept a pre-seeded `taxonomy: MinimalTaxonomy` parameter; the test seeds one taxonomy-owner user + taxonomy once, before the K-iteration loop.
- **Files modified:** `tests/fixtures/reimbursement-seed.ts`, `tests/migration-backfill.test.ts`
- **Verification:** `./node_modules/.bin/vitest run tests/migration-backfill.test.ts` — 2/2 pass
- **Committed in:** `8306086`

**2. [Rule 3 - Blocking] Cross-file test race corrupting shared real-Postgres fixtures**
- **Found during:** Task 2 (running `tests/reimbursement-regression.test.ts` and `tests/migration-backfill.test.ts` together, per the plan's own `<verify>` command)
- **Issue:** vitest runs separate test files in parallel worker processes by default. Both harness-using files open independent `pg.Pool` connections against the same local Postgres and call `resetReimbursementFixtures` (TRUNCATE) at arbitrary times relative to each other — producing FK violations, unique-constraint violations, and spurious assertion failures that did not reproduce when either file ran alone.
- **Fix:** `connectReimbursementTestDb()` now acquires a session-level Postgres advisory lock (`pg_advisory_lock`) on a dedicated pool connection immediately after connecting, held for the whole pool's lifetime (released automatically when `pool.end()` closes the connection in the caller's `afterAll`). Added `idleTimeoutMillis: 0` to the pool config to prevent pg's default 10s idle-connection reaping from silently releasing the lock mid-run.
- **Files modified:** `tests/helpers/reimbursement-test-db.ts`
- **Verification:** `./node_modules/.bin/vitest run tests/reimbursement-invariant.test.ts tests/reimbursement-regression.test.ts tests/migration-backfill.test.ts` — 26/26 pass together; full project suite `./node_modules/.bin/vitest run` — 142 files / 1753 tests pass; confirmed graceful skip (8 passed, 18 skipped) with Docker stopped, then confirmed green again after restart.
- **Committed in:** `8306086`

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug, 1 Rule 3 blocking issue)
**Impact on plan:** Both fixes were required for the plan's own literal verification command to pass (running both new test files together) and for the full suite to stay green. No scope creep — changes confined to the test harness/fixtures this plan already owns.

## Issues Encountered

- Initial assertions in the adjacency-exceeds/ordering/Q3 scenarios wrongly assumed `getOverviewChart`'s `out.essential` preserves the raw signed sum like `getMonthlyTrendByNature` does. Reading the actual bucket-building code in `lib/dal/overview.ts` showed it applies `.abs()` before accumulating into `bucket.out.essential` — fixed by asserting `expectedNet.abs()` for that one function while keeping the signed assertion for `getMonthlyTrendByNature`.
- Mid-Task-2, the execution session was interrupted by an API connection error after the 4 new `describe` blocks had been appended to `tests/reimbursement-regression.test.ts` but before `tests/migration-backfill.test.ts` was created or anything was verified/committed. Resumed by reading the on-disk state fresh (per orchestrator instruction), confirming the prior Task 1 commits (`e9bfe78`, `b2025ab`) and the partial Task 2 edits were intact, then continuing without redoing any completed work.

## User Setup Required

None — no external service configuration required. Local Docker Postgres via `yarn db:up` is required to run `tests/reimbursement-regression.test.ts` and `tests/migration-backfill.test.ts` with real, non-skipped assertions; it was already running in this environment (and the harness's `resetReimbursementFixtures` truncates local dev data as documented in 73-01-SUMMARY.md — restore via `yarn db:seed && yarn db:seed-extras && yarn db:seed-patterns` if needed).

## Next Phase Readiness

- D-02's invariant module is ready for Plan 73-04's `createPair` repoint — import `assertReimbursementAmounts` (or the two granular functions) directly, no further design work needed.
- The regression matrix now covers every real scenario named in ADR 0018/73-CONTEXT.md (dinner N>1, both adjacency directions, ordering, Q3) across the full 10-function aggregation surface, plus a real numeric proof of the migration backfill at K=5 and K=0. Phase 73's D-07 acceptance gate (dashboard regression before any expansion) is now substantively proven, not just structurally.
- `transaction_pair` is still untouched in row content and still exists in the schema — Plans 73-03/73-04 must still repoint the remaining consumers (`lib/dal/transactions.ts`, `lib/services/transaction-edit.ts`, `lib/services/transaction-pairs.ts`, `lib/dal/transaction-pairs.ts`) before Plan 73-04 Task 3's locked `option-b` drop migration can run safely.
- The cross-file advisory-lock serialization in `tests/helpers/reimbursement-test-db.ts` is now a permanent property of this harness — any future plan adding a THIRD file that uses `connectReimbursementTestDb()` inherits this serialization automatically, no further wiring needed.

---
*Phase: 73-reimbursement-schema-and-netting*
*Completed: 2026-07-23*

## Self-Check: PASSED

All created/modified files (`lib/services/reimbursement-invariant.ts`, `tests/reimbursement-invariant.test.ts`, `tests/reimbursement-regression.test.ts`, `tests/migration-backfill.test.ts`, `tests/fixtures/reimbursement-seed.ts`, `tests/helpers/reimbursement-test-db.ts`) and all 3 commit hashes (`e9bfe78`, `b2025ab`, `8306086`) verified present.
