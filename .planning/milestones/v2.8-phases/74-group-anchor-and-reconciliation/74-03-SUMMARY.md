---
phase: 74-group-anchor-and-reconciliation
plan: 03
subsystem: services
tags: [drizzle, decimal.js, italian-copy, pair-guard, reimbursement]

# Dependency graph
requires:
  - phase: 73-reimbursement-schema-and-netting
    provides: "reimbursement + reimbursement_refund schema (1:N), transaction-edit.ts pair guard already generalized to SUM over any N linked refunds"
provides:
  - "buildPairGuardMessage() exported pure helper — N<=1 returns the unchanged 'Scollega prima il rimborso'; N>1 appends the blocking reimbursement's title"
  - "Both amount-edit guard throw sites (anchor-edit and refund-edit branches) in updateTransaction() enriched with reimbursement.title + a COUNT(*) refundCount subquery"
affects: [75-linking-surfaces-and-lifecycle, 76-reimbursements-section]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Exported pure function for direct unit testing (buildPairGuardMessage), mirroring computeMergeEligibility/isGroupTitleValid — a DB-mock-free test file imports it directly, relying on vitest.config.ts's global server-only stub"

key-files:
  created:
    - tests/pair-guard-message.test.ts
  modified:
    - lib/services/transaction-edit.ts
    - tests/transaction-edit.test.ts

key-decisions:
  - "N>1 message format: Scollega prima il rimborso \"{title}\" — double-quoted title interpolated, no escaping (plain Italian display copy, never re-parsed)"
  - "refundCount for the refund-edit branch counts ALL linked refunds (not excluding the one being edited) — total N determines ambiguity, not the remaining count"
  - "The guard's block condition (oppositeSign check) is untouched — verified via git diff showing only the throw-site argument and the new export changed"

patterns-established:
  - "Pair-guard message enrichment reads reimbursement.title via the existing sumRows query (no extra round trip) — same pattern as adding a COUNT(*) FILTER subquery alongside an existing SUM subquery"

requirements-completed: [RMB-09]

coverage:
  - id: D1
    description: "buildPairGuardMessage() returns the unchanged 'Scollega prima il rimborso' at N<=1 and appends the reimbursement title when N>1"
    requirement: "RMB-09"
    verification:
      - kind: unit
        ref: "tests/pair-guard-message.test.ts#buildPairGuardMessage"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both updateTransaction() guard throw sites (anchor-edit, refund-edit) enrich the N>1 message with the blocking reimbursement's title; all 5 pre-existing DET-03 tests pass unmodified; exact-zero-amount boundary explicitly proven blocked"
    requirement: "RMB-09"
    verification:
      - kind: unit
        ref: "tests/transaction-edit.test.ts#DET-03 -- pair guard"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-07-24
status: complete
---

# Phase 74 Plan 03: Pair-Guard N>1 Message Enrichment Summary

**buildPairGuardMessage() names the blocking reimbursement by title when N>1 linked refunds exist; N<=1 stays byte-identical to the pre-Phase-74 message — the guard's hard-block condition itself is untouched.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 completed
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Added `buildPairGuardMessage()`, an exported pure helper in `lib/services/transaction-edit.ts`: `refundCount <= 1` returns the literal `'Scollega prima il rimborso'` unchanged; `refundCount > 1` returns `Scollega prima il rimborso "{title}"`.
- Both `updateTransaction()` throw sites (anchor-edit branch and refund-edit branch) now select `reimbursement.title` and a `COUNT(*)::int` `refundCount` alongside their existing SUM subquery, and route the throw through `buildPairGuardMessage()`.
- Extended `tests/transaction-edit.test.ts`'s DET-03 describe block with 2 new N>1 title-enrichment cases plus an explicit zero-amount boundary test (0 is neither `gt(0)` nor `lt(0)`, so the pre-existing `oppositeSign` check already rejects it — no code change needed there, only a new assertion proving it).
- Added `tests/pair-guard-message.test.ts`, a DB-mock-free pure-function unit test covering N=1 (plain message, title never interpolated), N=0 defensive fallback, N>1 title encoding, and a title containing embedded double-quotes left unmangled.
- Full test suite (143 files, 1773 tests + 1 pre-existing todo) passes; `git diff` on `lib/services/transaction-edit.ts` confirms only the two throw sites' arguments and the new exported helper changed — the block condition (`oppositeSign` logic) is byte-for-byte unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: Enrich the N>1 pair-guard message with the blocking reimbursement's title** - `9bdeeed` (feat)
2. **Task 2: Dedicated pure-function unit test for buildPairGuardMessage** - `8db17dc` (test)

## Files Created/Modified
- `lib/services/transaction-edit.ts` - Added `buildPairGuardMessage()` export; both guard throw sites now select `reimbursement.title` + `refundCount` and route through it
- `tests/transaction-edit.test.ts` - Mocked `reimbursement` schema object extended with `title`; DET-03 describe block gains 3 new cases (2 title-enrichment + 1 zero-boundary), all 5 pre-existing tests untouched
- `tests/pair-guard-message.test.ts` - New DB-mock-free unit test, 4 cases, no `vi.mock` calls

## Decisions Made
- N>1 message format locked as `Scollega prima il rimborso "{title}"` (double-quoted, interpolated, no escaping) per the plan's `<action>` spec.
- `refundCount` in the refund-edit branch counts ALL linked refunds on the reimbursement (not excluding the transaction being edited) — the total N is what determines message ambiguity, matching the plan's explicit instruction.
- No vitest mock setup needed for the new pure-function test file — `vitest.config.ts` already globally aliases `server-only` to an empty stub, so `buildPairGuardMessage` imports cleanly with zero DB/service dependencies of its own.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. No schema/migration changes (message enrichment reads an existing column and an already-indexed FK, per the plan's threat model note).

## Next Phase Readiness

- Phase 74 (group-anchor-and-reconciliation) is now complete: 74-01 (proportional-spread `effectiveAmount()`), 74-02 (residual value), 74-03 (pair-guard N>1 message) all shipped.
- RMB-02, RMB-06, RMB-09 all satisfied — no gaps carried forward.
- Phase 75 (linking-surfaces-and-lifecycle) can proceed: the guard's improved message and the residual value from 74-02 are both available as-is for the linking UI to surface.

---
*Phase: 74-group-anchor-and-reconciliation*
*Completed: 2026-07-24*

## Self-Check: PASSED

- FOUND: .planning/phases/74-group-anchor-and-reconciliation/74-03-SUMMARY.md
- FOUND: tests/pair-guard-message.test.ts
- FOUND: commit 9bdeeed
- FOUND: commit 8db17dc
