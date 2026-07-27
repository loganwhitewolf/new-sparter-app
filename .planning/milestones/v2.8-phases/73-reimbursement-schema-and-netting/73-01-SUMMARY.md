---
phase: 73-reimbursement-schema-and-netting
plan: 01
subsystem: database
tags: [drizzle, postgres, migrations, decimal.js, vitest, netting]

# Dependency graph
requires: []
provides:
  - "reimbursement + reimbursement_refund tables (D-03 XOR anchor shape)"
  - "backfill migration from transaction_pair (D-06)"
  - "generalized effectiveAmount()/isNotSecondary() reading only the new tables (D-05)"
  - "real-Postgres regression harness proving N=1 + empty-refund correctness (D-07)"
  - "locked decision: transaction_pair fate = option-b (drop at Plan 73-04 Task 3)"
affects: [73-02-reimbursement-schema-and-netting, 73-03-reimbursement-schema-and-netting, 73-04-reimbursement-schema-and-netting]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vi.doMock('@/lib/db', ...) + vi.doUnmock('@/lib/dal/transaction-pairs-sql') + vi.resetModules() + dynamic import to run REAL production DAL query bodies against a host-guarded real-Postgres harness client, swapping only the netting fragment under test"
    - "Custom hand-authored data migration scaffolded via `drizzle-kit generate --custom --name <name>` (precedent: 0022_wonderful_eternals.sql), applied via `yarn db:migrate`"
    - "Anchor resolution by SIGN (amount < 0) in migration SQL, not by a legacy service's magnitude-based 'primary' label — a DB-migration-time invariant guard for D-02"

key-files:
  created:
    - drizzle/migrations/0028_daffy_exodus.sql
    - drizzle/migrations/0029_reimbursement_backfill.sql
    - tests/helpers/reimbursement-test-db.ts
    - tests/fixtures/reimbursement-seed.ts
    - tests/reimbursement-regression.test.ts
  modified:
    - lib/db/schema.ts
    - lib/dal/transaction-pairs-sql.ts
    - tests/dashboard-dal.test.ts

key-decisions:
  - "DECISION (Task 1, locked): option-b — drop transaction_pair at phase end (Plan 73-04 Task 3). Plan 73-04's executor must read this as its locked input for the conditional DROP TABLE migration; do not re-open this choice."
  - "Migration 0029 resolves the reimbursement anchor by transaction SIGN (amount < 0 = outflow), not by trusting the legacy transaction_pairs.ts service's magnitude-based 'primary' assignment — closes a theoretical D-02 violation where a historical pair's refund exceeded its spend in absolute value (Rule 2 deviation, user-approved at the Task 2 tracer checkpoint)."
  - "Migration 0029 groups by anchor expense_id (one reimbursement per distinct outflow expense, N refunds) rather than one reimbursement per transaction_pair row — required for correctness against the reimbursement_expenseId_unique partial index (Rule 2 deviation, user-approved)."

patterns-established:
  - "Frozen-fragment regression technique (captureAggregationSnapshot): reusable by Plan 73-02's expanded N>1/adjacency/ordering proof matrix without re-deriving the mocking mechanics."

requirements-completed: [RMB-01, RMB-04, RMB-05]

coverage:
  - id: D1
    description: "reimbursement + reimbursement_refund schema with D-03 XOR anchor shape (CHECK constraint + two partial unique indexes)"
    requirement: "RMB-01"
    verification:
      - kind: manual_procedural
        ref: "drizzle/migrations/0028_daffy_exodus.sql (generated SQL inspected for CHECK + partial unique index text)"
        status: pass
    human_judgment: true
    rationale: "XOR CHECK / partial-unique enforcement verified by inspecting the generated migration SQL and running it against a live Postgres, not by an automated INSERT-that-violates-the-constraint test (no such test was in this plan's task actions)."
  - id: D2
    description: "transaction_pair backfill migration into reimbursement + reimbursement_refund (sign-based anchor resolution, grouped by anchor expense)"
    requirement: "RMB-05"
    verification:
      - kind: integration
        ref: "tests/reimbursement-regression.test.ts > reimbursement N=1 regression (Phase 73, ADR 0018 D-07) — applyReimbursementBackfillMigration against a seeded legacy pair"
        status: pass
    human_judgment: false
  - id: D3
    description: "effectiveAmount()/isNotSecondary() generalized to read only reimbursement/reimbursement_refund (D-05)"
    requirement: "RMB-04"
    verification:
      - kind: unit
        ref: "tests/dashboard-dal.test.ts > isNotSecondary() SQL fragment / effectiveAmount() SQL fragment"
        status: pass
      - kind: integration
        ref: "tests/reimbursement-regression.test.ts > empty-refund probe (RMB-04)"
        status: pass
    human_judgment: false
  - id: D4
    description: "N=1 regression proof: byte-identical (Decimal.js) results before/after migration across all 10 verified aggregation call sites"
    requirement: "RMB-05"
    verification:
      - kind: integration
        ref: "tests/reimbursement-regression.test.ts > reimbursement N=1 regression (Phase 73, ADR 0018 D-07) — 10 it() blocks, one per function"
        status: pass
    human_judgment: false
  - id: D5
    description: "Empty-refund probe: an anchor with zero linked refunds returns its own raw amount and is never excluded from aggregation"
    requirement: "RMB-04"
    verification:
      - kind: integration
        ref: "tests/reimbursement-regression.test.ts > empty-refund probe (RMB-04)"
        status: pass
    human_judgment: false
  - id: D6
    description: "transaction_pair post-migration fate decided (option-b: drop at Plan 73-04 Task 3) and recorded for downstream consumption"
    verification: []
    human_judgment: true
    rationale: "A recorded decision for a future plan's executor to read, not a code behavior to unit test."

# Metrics
duration: ~95min (across 2 human checkpoints: tracer approval after Task 2, Task 1 decision)
completed: 2026-07-23
status: complete
---

# Phase 73 Plan 01: Reimbursement Schema, Migration, and Netting Generalization Summary

**Generalized 1:1 `transaction_pair` into `reimbursement`/`reimbursement_refund` (D-03 XOR anchor), backfilled via a sign-based migration, rewrote `effectiveAmount()`/`isNotSecondary()` to read only the new tables, and proved N=1 + empty-refund correctness with a real-Postgres regression harness across all 10 aggregation call sites.**

## Performance

- **Duration:** ~95 min of active execution, spanning 2 interactive checkpoints (Task 1 decision + Task 2 tracer approval)
- **Completed:** 2026-07-23
- **Tasks:** 3 (1 decision checkpoint, 1 tracer, 1 auto)
- **Files modified:** 8 (3 modified, 5 created — excluding drizzle meta snapshots)

## Accomplishments

- `reimbursement` + `reimbursement_refund` tables landed with the full D-03 shape: anchor XOR CHECK constraint (`reimbursement_anchor_xor`), two partial unique indexes (at most one reimbursement per anchor Expense/Expense Group), FK/index conventions mirroring `transactionPair`/`expenseGroup`.
- Hand-authored backfill migration (0029) migrates every existing `transaction_pair` row, resolving the anchor by transaction **sign** (not the legacy service's magnitude-based "primary" label) and grouping by anchor `expense_id` so multiple pairs sharing one anchor land as a single reimbursement with N refunds.
- `effectiveAmount()`/`isNotSecondary()` rewritten in `lib/dal/transaction-pairs-sql.ts` to read only `reimbursement`/`reimbursement_refund` — names/signatures unchanged, so all 10 consuming call sites (`dashboard.ts` x6, `overview.ts` x2, `tags.ts` x2) pick up the change transparently, with zero edits to those files.
- Built a reusable real-Postgres regression harness (`captureAggregationSnapshot`) that runs the REAL, unmodified production query bodies against a host-guarded local DB, swapping only the netting fragment (frozen pre-Task-2 vs current) — proving the Amazon order/refund (N=1) case is byte-identical (Decimal.js, never string equality) across all 10 aggregation functions, plus the empty-refund probe (RMB-04).
- Task 1's checkpoint decision (`option-b` — drop `transaction_pair` at Plan 73-04 Task 3) is recorded here as this plan's locked, machine-greppable output for Plan 73-04's fresh executor.

## Task Commits

Each task was committed atomically:

1. **Task 1: Confirm the one-way migration and choose `transaction_pair`'s post-migration fate** — decision only, no file changes (recorded above; user selected `option-b` at the blocking checkpoint)
2. **Task 2: reimbursement + reimbursement_refund schema, migration, and netting generalization** — `b06a396` (feat)
3. **Task 3: N=1 regression proof — real-Postgres harness, byte-identical before/after across all 10 aggregation functions** — `177d200` (test)

**Plan metadata:** committed alongside this SUMMARY (see final commit)

## Files Created/Modified

- `lib/db/schema.ts` - Added `reimbursement`/`reimbursement_refund` pgTables (D-03 XOR CHECK + partial unique indexes) and their relations
- `drizzle/migrations/0028_daffy_exodus.sql` - Auto-generated CREATE TABLE migration for both new tables
- `drizzle/migrations/0029_reimbursement_backfill.sql` - Hand-authored backfill migration (sign-based anchor resolution, grouped by anchor expense)
- `drizzle/migrations/meta/_journal.json`, `drizzle/migrations/meta/0028_snapshot.json`, `drizzle/migrations/meta/0029_snapshot.json` - drizzle-kit migration tracking metadata
- `lib/dal/transaction-pairs-sql.ts` - Rewrote `effectiveAmount()`/`isNotSecondary()` to read `reimbursement`/`reimbursement_refund`; documented the Q3 anchor tie-break and the Phase-74 expense-group netting gap
- `tests/dashboard-dal.test.ts` - Updated the two Phase-50 SQL-fragment-contract assertions to match the new fragment text
- `tests/helpers/reimbursement-test-db.ts` - Host-guarded (localhost/127.0.0.1 only) real-Postgres harness: connect + idempotent migrate, `resetReimbursementFixtures`, `applyReimbursementBackfillMigration` (runs the actual 0029 file), `captureAggregationSnapshot`
- `tests/fixtures/reimbursement-seed.ts` - `seedUser`, `seedMinimalTaxonomy`, `seedExpenseWithTransaction`, `seedLegacyPair`, `seedTag`, `attachTagToTransaction`
- `tests/reimbursement-regression.test.ts` - N=1 regression (10 assertions) + empty-refund probe

## Decisions Made

- **Task 1 (locked, machine-greppable): `option-b — drop transaction_pair at phase end (Plan 73-04 Task 3)`.** `transaction_pair` is NOT dropped in this plan — it stays in the schema, unread by the live netting path, until every remaining consumer (`lib/dal/transactions.ts`, `lib/services/transaction-edit.ts`, `lib/services/transaction-pairs.ts`, `lib/dal/transaction-pairs.ts`) is repointed away from it in Plans 73-02/73-03, at which point Plan 73-04 Task 3 runs the `DROP TABLE` migration.
- **Sign-based anchor resolution in the backfill migration (Rule 2 — auto-add missing critical functionality, user-approved at the Task 2 tracer checkpoint).** The plan's literal action text said "anchor = the primary transaction's (transaction_a_id's) expense_id." The legacy `transaction-pairs.ts` service resolves "primary" by **magnitude** (`|amount|`), not sign. A historical pair where a refund's absolute amount exceeded its spend (e.g. a refund plus goodwill credit) could have `transaction_a_id` be the *inflow* leg — migrating that naively would violate D-02 (anchor must always be an outflow) and this plan's locked prohibition against a non-negative anchor amount. Migration 0029 instead resolves the anchor via `CASE WHEN amount < 0 THEN ... END`, which is a no-op for every normal case and closes the edge case unconditionally.
- **Grouping backfill by anchor `expense_id` (Rule 2, user-approved).** Two `transaction_pair` rows can share one anchor expense (an expense with two transactions, each individually paired with a different refund). One reimbursement per `transaction_pair` row would violate the `reimbursement_expenseId_unique` partial index; migration 0029 groups by anchor expense and creates one reimbursement with N linked refunds instead.
- **Anchor resolution tie-break for `effectiveAmount()` (Q3, 73-CONTEXT.md Claude's Discretion):** a transaction T is the reimbursement anchor when its expense has a `reimbursement` row AND T is the earliest transaction of that expense (`ORDER BY occurred_at ASC, id ASC`), documented in code.
- **The `expense_group_id` branch is intentionally not netted yet** — no code path creates Group-anchored reimbursement rows until Phase 74 (RMB-02); documented as a deliberate, not silent, gap.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Sign-based anchor resolution instead of trusting `transaction_a_id`**
- **Found during:** Task 2 (migration 0029 authoring)
- **Issue:** The plan's literal action named `transaction_a_id` as the anchor source; the legacy pairing service resolves "primary" by magnitude, which could in theory assign `transaction_a_id` to the inflow leg, violating D-02
- **Fix:** Resolve the anchor by `amount < 0` (sign) in the migration SQL instead
- **Files modified:** `drizzle/migrations/0029_reimbursement_backfill.sql`
- **Verification:** Applied cleanly against local Postgres (`yarn db:migrate` exit 0); regression test's `seedLegacyPair` explicitly constructs a sign-correct legacy pair and proves the migrated result matches the frozen-fragment baseline
- **Committed in:** `b06a396` (Task 2 commit) — approved by the user at the Task 2 tracer checkpoint

**2. [Rule 2 - Missing Critical] Group backfill by anchor `expense_id`, not one reimbursement per `transaction_pair` row**
- **Found during:** Task 2 (migration 0029 authoring)
- **Issue:** A literal one-reimbursement-per-pair-row backfill would violate the `reimbursement_expenseId_unique` partial index when two pairs share one anchor expense
- **Fix:** Migration 0029's step 1 groups by anchor `expense_id` (one reimbursement per distinct anchor); step 2 links every pair's inflow transaction to that reimbursement as a `reimbursement_refund` row
- **Files modified:** `drizzle/migrations/0029_reimbursement_backfill.sql`
- **Verification:** SQL reviewed and applied cleanly; consistent with the unique index added in the same task
- **Committed in:** `b06a396` (Task 2 commit) — approved by the user at the Task 2 tracer checkpoint

---

**Total deviations:** 2 auto-fixed (both Rule 2 — missing critical correctness/invariant enforcement)
**Impact on plan:** Both changes strengthen D-02's outflow-anchor invariant and the D-03 unique-index correctness beyond the plan's literal wording; no scope creep — same files, same task, both user-approved before Task 3 began.

## Known Limitations (flagged for Plan 73-02, per orchestrator review)

These are not defects in this plan's work — they are documented scope boundaries that Plan 73-02's expanded proof matrix and row-count reconciliation must treat as **expected**, not as unexplained discrepancies:

1. **Pairs whose outflow leg has no `expense_id` are filtered out of the backfill.** Migration 0029's `WHERE outflow_expense_id IS NOT NULL` guard means any historical `transaction_pair` row whose outflow transaction lost its `expense_id` (e.g. via a prior expense deletion cascading `SET NULL`) is silently skipped — it cannot be migrated, since D-03 requires a non-null anchor. This is structurally unavoidable (a reimbursement cannot anchor on nothing) and was accepted as-is rather than expanding scope to backfill orphaned pairs. **Plan 73-02's row-count reconciliation / zero-orphans suite should assert on this as a known discrepancy class**, not discover it as an unexplained mismatch.
2. **The backfill has not been proven numerically against real historical data.** The local dev database had 0 `transaction_pair` rows at execution time, so migration 0029 ran as a structural no-op against real data — it applied cleanly but backfilled nothing. Task 3's seeded fixtures (`seedLegacyPair` + `applyReimbursementBackfillMigration`) are the first, and so far only, real numeric proof of the backfill's correctness, and they exercise a single N=1 scenario. Anyone running this migration against a database with real `transaction_pair` rows is the first real-data validation.

## Issues Encountered

- **`vi.resetModules()` interaction with `vi.mock('@/lib/dal/auth', ...)`:** initial test run failed (`verifySession()` resolved to `undefined`) because the `mockResolvedValue` call was omitted entirely on first pass. Fixed by setting `vi.mocked(verifySession).mockResolvedValue({ userId })` before each `captureAggregationSnapshot` call in the test file — confirmed empirically that Vitest's hoisted `vi.mock` factory instance survives `vi.resetModules()` (only non-mocked modules get fresh instances), so the plan's literal instruction (mock at module scope, set the resolved value before calling the helper) works as written.
- **Deadlock (`40P01`) on `TRUNCATE` after the above failure:** the first failure left orphaned in-flight queries against the shared harness `pool`, which then deadlocked against the next test's `TRUNCATE`. Resolved as a side effect of the `verifySession` fix (root cause eliminated, not worked around).
- **Local dev Postgres was truncated by this session's test runs** (by design — the harness's `resetReimbursementFixtures` targets the exact docker-compose connection string, which is also this repo's local dev `DATABASE_URL`). Restored via `yarn db:seed && yarn db:seed-extras && yarn db:seed-patterns` before finishing this plan. **Anyone running `tests/reimbursement-regression.test.ts` locally should expect their local dev DB's `user`/`category`/`sub_category`/`transaction`/etc. rows to be wiped and will need to re-run the seed chain afterward** if they want dev data back — this is the harness's documented, intentional behavior (T-73-03), not a bug.

## User Setup Required

None - no external service configuration required. (Local Docker Postgres via `yarn db:up` is required to run `tests/reimbursement-regression.test.ts` with real, non-skipped assertions; it was already running in this environment.)

## Next Phase Readiness

- Schema, migration, and netting core are in place and regression-proven for N=1 and the empty-refund case. Plan 73-02 can build directly on `captureAggregationSnapshot`/`reimbursement-seed.ts` to expand the proof matrix (N>1, adjacency, ordering, the dinner-split N=3 case, Q3 multi-transaction Expense) without re-deriving the harness mechanics.
- `transaction_pair` is untouched in row content and still exists in the schema — Plans 73-02/73-03 must repoint `lib/dal/transactions.ts`, `lib/services/transaction-edit.ts`, `lib/services/transaction-pairs.ts`, `lib/dal/transaction-pairs.ts` away from it before Plan 73-04 Task 3 can safely drop it (locked decision: option-b).
- The two known limitations above are pre-flagged for Plan 73-02's reconciliation suite — no new discovery needed, just accounting for them as expected.

---
*Phase: 73-reimbursement-schema-and-netting*
*Completed: 2026-07-23*

## Self-Check: PASSED

All created files and both task commit hashes (`b06a396`, `177d200`) verified present.
