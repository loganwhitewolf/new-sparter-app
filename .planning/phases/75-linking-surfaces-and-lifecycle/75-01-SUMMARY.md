---
phase: 75-linking-surfaces-and-lifecycle
plan: 01
subsystem: database
tags: [drizzle, postgres, reimbursement, netting, sql, vitest]

# Dependency graph
requires:
  - phase: 74-group-anchor-and-reconciliation
    provides: "effectiveAmount() proportional-spread CTE chain (anchor -> member_expense_ids -> member_transactions -> refund_total -> raw_shares -> member_shares), the reimbursement/reimbursement_refund schema, and the real-Postgres regression harness this plan repoints"
provides:
  - "reimbursement_anchor_transaction join table (frozen anchored-transaction set) + migration 0031 + idempotent backfill for every existing Expense-anchored reimbursement"
  - "effectiveAmount()'s Expense-anchor branch resolves its member set EXCLUSIVELY from the frozen set; Group-anchor branch stays byte-identical"
  - "createPair() records the frozen set unconditionally on every call (create path today; also covers Plan 75-02's future append path)"
  - "contamination-guard regression proof: a same-expense_id transaction imported after linking never inherits a share of the linked refund"
affects: [75-02-create-or-append, 75-03-unlink-baseline-restore, 75-04-linking-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Frozen-set join table pattern: record exact member ids at write time instead of resolving membership dynamically from a mutable FK (expense_id), closing an import-time re-use contamination gap"
    - "UNION ALL branch split inside a single CTE to give two anchor shapes (Expense vs Group) fully independent resolution logic without duplicating the downstream share-computation CTEs"

key-files:
  created:
    - drizzle/migrations/0031_reimbursement_anchor_transaction.sql
  modified:
    - lib/db/schema.ts
    - lib/dal/transaction-pairs-sql.ts
    - lib/services/transaction-pairs.ts
    - tests/fixtures/reimbursement-seed.ts
    - tests/reimbursement-regression.test.ts
    - tests/transaction-pairs-service.test.ts

key-decisions:
  - "Frozen set stored as a new join table (reimbursement_anchor_transaction), not a column — mirrors expense_group_membership's composite-unique + both-side-index convention exactly"
  - "member_transactions CTE split into a UNION ALL of two branches by anchor shape (Expense frozen-set / Group expense_group_membership) instead of a runtime CASE, so the Group branch's SQL text is provably untouched from Phase 74"
  - "seedReimbursement() fixture populates the frozen set by querying ALL transactions currently under the anchor expenseId (not just one), required by the pre-existing Q3 multi-transaction-Expense sibling scenario"
  - "requirements.mark-complete NOT run for RMB-08 in this plan: 75-01 delivers only the backend prerequisite (D-08 frozen set); the actual user-facing capability (create/manage a reimbursement from the Expense/Group detail page) ships in 75-04. Marking RMB-08 Complete here would be a false positive in REQUIREMENTS.md's traceability table."

patterns-established:
  - "Pitfall-3-safe write: any service that creates or appends to a reimbursement must record the frozen anchor set UNCONDITIONALLY on every call — never skipped as a create-only special case"

requirements-completed: []  # RMB-08 intentionally NOT marked complete — see key-decisions

coverage:
  - id: D1
    description: "reimbursement_anchor_transaction table + migration 0031 (CREATE TABLE, composite unique, both-side indexes) + idempotent backfill for every existing Expense-anchored reimbursement, Group-anchored rows deliberately excluded"
    requirement: "RMB-08"
    verification:
      - kind: integration
        ref: "yarn db:migrate (applies 0031 cleanly against local Postgres, including the hand-appended backfill INSERT)"
        status: pass
      - kind: integration
        ref: "tests/reimbursement-regression.test.ts (full suite runs migrate() via connectReimbursementTestDb())"
        status: pass
    human_judgment: false
  - id: D2
    description: "effectiveAmount()'s member_transactions CTE split into Branch A (Expense anchor, resolves exclusively via the frozen set) / Branch B (Group anchor, byte-identical to pre-Phase-75) — full existing regression suite numerically inert"
    requirement: "RMB-08"
    verification:
      - kind: integration
        ref: "tests/reimbursement-regression.test.ts (19 pre-existing scenarios: N=1 Amazon, empty-refund, dinner N=3, adjacency-exceeds, ordering x2, Q3 multi-transaction, Group A/B/C)"
        status: pass
    human_judgment: false
  - id: D3
    description: "createPair() records one reimbursement_anchor_transaction row for the anchor transaction id on every call, unconditionally (Pitfall 3 — never skipped at N=1)"
    requirement: "RMB-08"
    verification:
      - kind: integration
        ref: "tests/reimbursement-regression.test.ts#createPair frozen-set write — records the frozen anchor-transaction set unconditionally"
        status: pass
    human_judgment: false
  - id: D4
    description: "Contamination guard: a same-expense_id transaction inserted directly after linking (simulating import.ts's descriptionHash upsert) is excluded from effectiveAmount()'s member set (returns its own raw amount, 0 inherited share) and the original anchor's share is unchanged"
    requirement: "RMB-08"
    verification:
      - kind: integration
        ref: "tests/reimbursement-regression.test.ts#createPair frozen-set write — contamination guard"
        status: pass
    human_judgment: false

# Metrics
duration: 27min
completed: 2026-07-24
status: complete
---

# Phase 75 Plan 1: Frozen anchored-transaction set (D-08 tracer) Summary

**Closed the reimbursement anchor-contamination gap by making the anchor transaction-granular via a new frozen `reimbursement_anchor_transaction` join table, repointed `effectiveAmount()`'s Expense-anchor branch to read it exclusively, and proved a same-merchant re-import can no longer inherit a share of a past refund.**

## Performance

- **Duration:** ~27 min (includes one interactive checkpoint pause for tracer-slice human-verify)
- **Started:** 2026-07-24T15:11:53Z
- **Completed:** 2026-07-24T15:38:50Z
- **Tasks:** 2
- **Files modified:** 9 (1 created: migration SQL; 8 modified, incl. 2 meta/journal files)

## Accomplishments

- New `reimbursement_anchor_transaction` schema table + relations, generated migration `0031_reimbursement_anchor_transaction.sql` with a hand-appended idempotent backfill INSERT covering every existing Expense-anchored reimbursement (Group-anchored rows deliberately excluded)
- `effectiveAmount()`'s `member_transactions` CTE split into a `UNION ALL`: Branch A (Expense anchor) resolves exclusively via the frozen set; Branch B (Group anchor) is byte-identical to pre-Phase-75 SQL text
- `createPair()` now records the frozen anchor-transaction row unconditionally on every call, closing Pitfall 3 (a create-only special case would silently re-open the N=1 contamination hole)
- Two new real-Postgres tests against the LIVE `createPair()` service prove: (1) a fresh link records exactly one frozen-set row, and (2) a later same-merchant transaction inserted directly into the anchor's `expense_id` never inherits a share of the linked refund and the original anchor's share is unaffected

## Task Commits

Each task was committed atomically:

1. **Task 1: Frozen anchored-transaction set — schema, migration, backfill, CTE repoint (the D-08 tracer)** - `6358403` (feat)
2. **Task 2: Wire createPair's frozen-set write + prove the contamination guard** - `47e4b7d` (feat)

**Plan metadata:** committed alongside this SUMMARY (see final commit below)

## Files Created/Modified

- `lib/db/schema.ts` - `reimbursementAnchorTransaction` table (composite unique, both-side indexes) + `reimbursementAnchorTransactionRelations` + `anchorTransactions` relation on `reimbursementRelations`
- `drizzle/migrations/0031_reimbursement_anchor_transaction.sql` - generated CREATE TABLE diff + hand-appended idempotent backfill INSERT (Expense-anchored reimbursements only)
- `drizzle/migrations/meta/0031_snapshot.json`, `drizzle/migrations/meta/_journal.json` - drizzle-kit generate output, migration tag renamed from the auto-generated slug to match the plan's specified filename
- `lib/dal/transaction-pairs-sql.ts` - `effectiveAmount()`'s `member_transactions` CTE split into a Branch A (frozen-set, Expense anchor) / Branch B (`expense_group_membership`, Group anchor, unchanged) `UNION ALL`
- `lib/services/transaction-pairs.ts` - `createPair()` inserts one `reimbursementAnchorTransaction` row immediately after the `reimbursementRefund` insert, unconditional on every call
- `tests/fixtures/reimbursement-seed.ts` - `seedReimbursement()` now also populates the frozen set for every transaction currently under the anchor `expenseId` (covers the multi-transaction Q3 sibling scenario)
- `tests/reimbursement-regression.test.ts` - added a `createPair` dynamic-import setup (harness-db-bound, mirrors `reimbursement-guard-group-anchor.test.ts`'s technique) + 2 new Task 2 test blocks (frozen-set write, contamination guard)
- `tests/transaction-pairs-service.test.ts` - deviation fix: added `reimbursementAnchorTransaction` to the mocked schema and corrected an insert-count assertion from `toHaveLength(2)` to `toHaveLength(3)`

## Decisions Made

- Frozen set is a new join table (not a column on `reimbursement` or `transaction`) — mirrors `expenseGroupMembership`'s composite-unique + both-side-index shape exactly, per the plan's Claude's Discretion scope.
- `member_transactions`'s two anchor-shape branches are a `UNION ALL` inside one CTE (not a runtime `CASE`), so the Group-anchor branch's SQL text is provably byte-identical to Phase 74, satisfying the plan's must-have literally rather than by inspection.
- `seedReimbursement()` queries ALL transactions currently under the given `expenseId` (not just a single passed-in id) to populate the frozen set — required because the pre-existing Q3 scenario (one Expense, two sibling transactions) needs both siblings in the frozen set for the spread to work; a single-id parameter would have silently broken that scenario.
- `requirements mark-complete RMB-08` was deliberately NOT run. This plan is Plan 1 of 4 in Phase 75; RMB-08 (the user-facing linking capability) also appears in Plans 75-02 and 75-04, and the actual UI mounts only in 75-04. Marking it "Complete" now would corrupt REQUIREMENTS.md's traceability table with a false positive before the UI exists.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected the plan's verify command — `test:unit` script does not exist**
- **Found during:** Task 1 verification
- **Issue:** The plan's `<verify>` blocks specify `yarn test:unit -- ...`; this repo's `package.json` has no `test:unit` script (only `test: vitest run`).
- **Fix:** Ran `yarn test <path>` / `yarn test <path> -t "<pattern>"` instead — functionally identical filtering, correct script name.
- **Files modified:** none (command-only correction)
- **Verification:** Both the per-file and `-t "frozen-set"`-filtered invocations ran and passed as expected.
- **Committed in:** N/A (no file change)

**2. [Rule 1 - Bug] Fixed a mocked-schema gap that would throw in `transaction-pairs-service.test.ts`**
- **Found during:** Task 2 (after adding the `reimbursementAnchorTransaction` insert to `createPair`)
- **Issue:** The file's `vi.mock('@/lib/db/schema', ...)` factory didn't export `reimbursementAnchorTransaction`. Several tests branch on `(table as { title?: string }).title` inside `dbInsertChain.mockImplementation` — with the import resolving to `undefined`, this would throw `Cannot read properties of undefined` the moment `createPair`'s new unconditional insert ran.
- **Fix:** Added a `reimbursementAnchorTransaction` entry to the mocked schema (mirrors the existing `reimbursementRefund` shape) and corrected the "both inserts fire" assertion in the refund-cleanup describe block from `toHaveLength(2)` to `toHaveLength(3)`, since a third insert (the frozen-set row) now always fires.
- **Files modified:** `tests/transaction-pairs-service.test.ts`
- **Verification:** `yarn test tests/transaction-pairs-service.test.ts` → 33/33 passed.
- **Committed in:** `47e4b7d` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking command correction, 1 bug fix directly caused by Task 2's action)
**Impact on plan:** Both fixes were required to complete verification as specified; no scope creep — both are scoped strictly to files this plan already touches.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None - no external service configuration required. `yarn db:migrate` was already run locally against the dev Postgres container; the operator must still run it against staging/production before those environments see migration 0031 (standard project deploy flow, no new step).

## Next Phase Readiness

- The frozen-set prerequisite (D-08) is fully in place and regression-proven; Plan 75-02 (create-or-append) can now safely append refunds to an existing anchor without re-opening the contamination gap, since `createPair`'s frozen-set write already covers both the create path (this plan) and — once 75-02 lands — the append path (same code path, same unconditional insert).
- No blockers. `effectiveAmount()`'s public signature and every aggregation call site are unchanged — Plans 75-02/75-03/75-04 need no additional wiring at the DAL layer for this fix to take effect.

---
*Phase: 75-linking-surfaces-and-lifecycle*
*Completed: 2026-07-24*

## Self-Check: PASSED

All 8 declared files verified present on disk; both task commits (`6358403`, `47e4b7d`) verified present in git history.
