---
phase: 50-transaction-pairing
plan: "02"
subsystem: database
tags: [drizzle, migration, schema, transaction-pairing, netting, sql-helpers]

# Dependency graph
requires:
  - phase: 50-01
    provides: RED test scaffolds for netting helpers (dashboard-dal.test.ts, transaction-pairs tests)
provides:
  - transactionPair pgTable with dual single-column unique constraints and ON DELETE CASCADE FKs
  - drizzle/migrations/0020_transaction_pair.sql applied to local dev DB
  - isNotSecondary() and effectiveAmount() shared SQL fragment helpers in lib/dal/transaction-pairs-sql.ts
affects:
  - 50-03 (service createPair/deletePair — writes to this table)
  - 50-04 (DAL netting — consumes isNotSecondary()/effectiveAmount())
  - 50-05 (UI — reads netting-aware totals from DAL)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual single-column UNIQUE constraints for 1:1 pairing (not a composite UNIQUE) — D-02"
    - "Shared SQL fragment helpers (isNotSecondary/effectiveAmount) exported once, imported by all aggregation sites"
    - "drizzle-kit --name flag to bypass TTY prompt in automated/CI contexts (D-07 pattern)"

key-files:
  created:
    - lib/dal/transaction-pairs-sql.ts
    - drizzle/migrations/0020_transaction_pair.sql
    - drizzle/migrations/meta/0020_snapshot.json
  modified:
    - lib/db/schema.ts
    - drizzle/migrations/meta/_journal.json

key-decisions:
  - "D-07 resolved: yarn db:generate --name transaction_pair bypasses drizzle-kit TTY prompt; --name flag is the standard workaround for automated generation contexts"
  - "0020 migration applied to local dev DB via yarn db:migrate; table transaction_pair is LIVE"
  - "transactionPair has no userId column (T-50-01/D-01) — ownership is enforced in Plan 03 service layer, not at DB level"
  - "Two separate single-column UNIQUEs (not composite) enforce 1:1 pairing: each transaction can appear at most once as A and once as B"

patterns-established:
  - "isNotSecondary() + effectiveAmount() are always applied together in netting queries (Pitfall 1/2 from 50-RESEARCH.md)"
  - "Migration generation: yarn db:generate --name <name> to skip TTY; review additive-only before yarn db:migrate"

requirements-completed: [PAIR-01, PAIR-03]

# Metrics
duration: 35min
completed: 2026-06-14
---

# Phase 50 Plan 02: Data Layer Foundation Summary

**Drizzle transaction_pair table (dual single-column UNIQUEs + cascade FKs) materialized in local DB via 0020 migration, plus shared isNotSecondary()/effectiveAmount() SQL fragment helpers**

## Performance

- **Duration:** ~35 min (including human-action checkpoint for migration generation)
- **Started:** 2026-06-14T08:00:00Z
- **Completed:** 2026-06-14T08:52:00Z
- **Tasks:** 2 (Task 1 auto; Task 2 human-action checkpoint)
- **Files modified:** 5

## Accomplishments

- `transactionPair` pgTable added to `lib/db/schema.ts` with dual single-column UNIQUE constraints (`transaction_pair_a_unique`, `transaction_pair_b_unique`), two FK references to `transaction.id` with `ON DELETE CASCADE`, two btree lookup indexes, and `transactionPairRelations`
- `lib/dal/transaction-pairs-sql.ts` created with `isNotSecondary()` (NOT EXISTS WHERE fragment) and `effectiveAmount()` (CASE-WHEN SUM expression) — consumed by Plan 04 DAL aggregation sites
- Migration `0020_transaction_pair.sql` generated via `yarn db:generate --name transaction_pair` and applied via `yarn db:migrate`; table is LIVE in local dev DB
- Plan 01 RED test cases for netting helpers (`tests/dashboard-dal.test.ts`) all pass GREEN (39/39)

## Task Commits

1. **Task 1: Add transactionPair table + relations and shared netting SQL helpers** - `8265b25` (feat)
2. **Task 2: Generate and apply 0020 transaction_pair migration** - `1ddc166` (feat)

## Files Created/Modified

- `lib/db/schema.ts` — `transactionPair` pgTable + `transactionPairRelations` appended after `transaction` table
- `lib/dal/transaction-pairs-sql.ts` — `isNotSecondary()` and `effectiveAmount()` shared SQL fragment helpers (server-only)
- `drizzle/migrations/0020_transaction_pair.sql` — additive CREATE TABLE + UNIQUE constraints + FK + btree indexes; no DROP/ALTER
- `drizzle/migrations/meta/0020_snapshot.json` — drizzle-kit snapshot for 0020
- `drizzle/migrations/meta/_journal.json` — journal entry idx=20 added

## Decisions Made

- **D-07 resolved via `--name` flag:** `yarn db:generate --name transaction_pair` bypasses drizzle-kit's interactive TTY prompt. This is the standard workaround for headless/automated contexts; document in PATTERNS.md for future migrations.
- **No userId on transaction_pair (T-50-01/D-01):** Ownership is enforced by the Plan 03 service `createPair` function (validates both transactions belong to requesting user). The DB enforces only FK integrity + uniqueness — no IDOR risk because service layer is the trust boundary.
- **Migration applied to local dev DB only:** `yarn db:migrate` ran against local dev DB. Production deploy is a separate operator step (Vercel / managed DB migration runbook).

## Deviations from Plan

### Human-Action Checkpoint Resolved

**Task 2 was a `checkpoint:human-action` (gate=blocking)** because drizzle-kit `generate` requires a TTY for interactive prompts. The orchestrator resolved this by running `yarn db:generate --name transaction_pair` (the `--name` flag suppresses the TTY prompt and names the migration directly). Migration was reviewed as additive-only and applied via `yarn db:migrate`.

This is not a deviation per se — the task was designed as `autonomous: false` specifically because of this TTY limitation. Resolution pattern documented for future migrations.

---

**Total deviations:** 0 auto-fixed (human-action checkpoint resolved as designed)
**Impact on plan:** None — plan executed exactly as written; checkpoint resolved correctly.

## Issues Encountered

- `yarn check:language` reports 8 pre-existing violations in files not touched by this plan (`overview-movers-panel.tsx`, test fixtures, `suggestion-promote-form.test.tsx`). Out of scope — logged to deferred-items, not fixed here.

## Threat Surface Scan

No new network endpoints, auth paths, or trust-boundary schema changes introduced beyond what is in the plan's `<threat_model>`. T-50-01 (no userId), T-50-02 (dual unique constraints), and T-50-06 (cascade delete) are all confirmed implemented as specified.

## Known Stubs

None — this plan creates infrastructure (schema + migration + SQL helpers), not UI or data-rendering surfaces.

## Next Phase Readiness

- `transaction_pair` table is LIVE in local dev DB — Plan 03 service (`createPair`, `deletePairByTransactionId`) can write to it immediately
- `isNotSecondary()` and `effectiveAmount()` are importable from `lib/dal/transaction-pairs-sql.ts` — Plan 04 DAL netting can consume them
- 39/39 netting-helper tests are GREEN — no regressions

---
*Phase: 50-transaction-pairing*
*Completed: 2026-06-14*
