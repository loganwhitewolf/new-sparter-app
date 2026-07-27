---
phase: 75-linking-surfaces-and-lifecycle
plan: 03
subsystem: database
tags: [drizzle, postgres, reimbursement, netting, sql, vitest]

# Dependency graph
requires:
  - phase: 75-02
    provides: "createPairTx (dual anchor, create-or-append core) — the single write site both the create and append path go through, which this plan's snapshot recording hooks into"
provides:
  - "reimbursement_refund_snapshot table + migration 0032 — one row per reimbursement_refund link, capturing the refund's expense title/descriptionHash/subCategoryId/status immediately before applyDetachCleanupTx mutates them"
  - "restoreRefundBaseline(tx, {refundTransactionId, userId}) — shared restore helper reused by both unlink paths"
  - "deletePairByTransactionId's refund-side branch now restores baseline (D-10) before removing the link row"
  - "deleteReimbursementForAnchor(userId, reimbursementId) — restores EVERY linked refund before deleting the whole reimbursement (D-09's second lifecycle action)"
  - "removeRefundAction / deleteReimbursementAction server actions (D-09's two lifecycle actions)"
affects: [75-04-linking-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-link snapshot + shared restore helper: a service records the pre-mutation state of a row it is about to recategorize, then a single restore function (re-derives its own join from a transaction id, not a passed-in row id) is reused by every unlink/delete path that needs to revert it — no duplicated restore logic between 'remove one' and 'delete all'"
    - "onDelete:'set null' FK as a free existence signal: reimbursement_refund_snapshot.expenseId nullable + set-null lets restore logic branch on 'expense still exists' vs 'deleted after linking' by checking one column, no manual existence SELECT"

key-files:
  created:
    - drizzle/migrations/0032_reimbursement_refund_snapshot.sql
  modified:
    - lib/db/schema.ts
    - lib/services/transaction-pairs.ts
    - lib/validations/transaction-pairs.ts
    - lib/actions/transaction-pairs.ts
    - tests/reimbursement-phase-75.test.ts
    - tests/transaction-pairs-service.test.ts

key-decisions:
  - "reimbursementRefundSnapshot.expenseId is nullable with onDelete:'set null' (not cascade) — deliberately, per the plan's action spec, so restore logic can tell 'original expense still exists' from 'expense deleted after linking' by checking the column, no manual existence SELECT"
  - "restoreRefundBaseline resolves its own reimbursement_refund row via an inner join on refundTransactionId (not a passed-in reimbursementRefundId) — this is what lets deleteReimbursementForAnchor reuse it directly with a list of refund transactionIds loaded from reimbursementRefund, no adapter needed"
  - "removeRefundAction is a direct alias of deleteTransactionPairAction, not a duplicate thin wrapper — deletePairByTransactionId's refund-side branch already restores baseline post-Task-2, so the existing action's behavior is already correct for D-09's 'remove a single refund' vocabulary"
  - "deletePairByTransactionId's anchor-side branch (unlink via the anchor transaction id) is deliberately left UNCHANGED per the plan's action spec — D-09's 'delete the whole reimbursement' lifecycle action is deleteReimbursementForAnchor (invoked by reimbursementId), not this legacy anchor-side path"

patterns-established:
  - "Snapshot-then-mutate write site: any service step that is about to recategorize/re-hash a row on behalf of another workflow must record a pre-mutation snapshot in the SAME transaction, immediately before the mutating call — not as an afterthought bolted onto a different code path"

requirements-completed: []  # RMB-07 NOT marked complete — see key-decisions in 75-01/75-02: this plan ships the unlink/delete backend lifecycle; the user-facing linking/management UI (the surfaces RMB-07/RMB-08 actually describe) ships in Plan 75-04. Marking either Complete now would be a false positive in REQUIREMENTS.md's traceability table.

coverage:
  - id: D1
    description: "Every refund link that triggers refund-cleanup (applyDetachCleanupTx) also records a pre-link reimbursement_refund_snapshot row capturing the refund's expense state (title/descriptionHash/subCategoryId/status) as it was BEFORE the mutation — for both the create path and Plan 75-02's append path, since both go through createPairTx's single write site. Links that skip cleanup (donor uncategorized, or refund shares the anchor's own Expense) record no snapshot."
    requirement: "RMB-07"
    verification:
      - kind: integration
        ref: "tests/reimbursement-phase-75.test.ts#reimbursement_refund_snapshot — record-on-link > Test 1/2/3"
        status: pass
    human_judgment: false
  - id: D2
    description: "Unlinking a single refund (removeRefundAction / deletePairByTransactionId) restores that refund's expense to its exact pre-link title/descriptionHash/subCategoryId/status, then removes the link row; the now-empty reimbursement collapses when it was the last refund."
    requirement: "RMB-07"
    verification:
      - kind: integration
        ref: "tests/reimbursement-phase-75.test.ts#unlink and delete-reimbursement restore baseline > Test 1 (Amazon 1:1 unlink)"
        status: pass
      - kind: integration
        ref: "tests/reimbursement-phase-75.test.ts#unlink and delete-reimbursement restore baseline > Test 2 (dinner 1:N per-refund unlink)"
        status: pass
      - kind: integration
        ref: "tests/reimbursement-phase-75.test.ts#unlink and delete-reimbursement restore baseline > Test 3 (final unlink collapses)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Deleting the whole reimbursement (deleteReimbursementAction / deleteReimbursementForAnchor) restores baseline for EVERY linked refund, not just the last one removed, before deleting the reimbursement row (which cascades refund/frozen-set/snapshot rows)."
    requirement: "RMB-07"
    verification:
      - kind: integration
        ref: "tests/reimbursement-phase-75.test.ts#unlink and delete-reimbursement restore baseline > Test 4 (delete-whole-reimbursement)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A Group-anchor refund's subcategory is restored from its OWN pre-link snapshot on unlink (Option B) — never left uncategorized just because the anchor spans multiple subcategories with no single anchor.subCategoryId to fall back to."
    requirement: "RMB-07"
    verification:
      - kind: integration
        ref: "tests/reimbursement-phase-75.test.ts#unlink and delete-reimbursement restore baseline > Test 5 (Group-anchor Option B)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Removing an already-unlinked refund transaction a second time is a silent no-op (matches deletePairByTransactionId's existing role-not-found convention) — never a thrown error or a double-restore mutating the already-restored expense."
    requirement: "RMB-07"
    verification:
      - kind: integration
        ref: "tests/reimbursement-phase-75.test.ts#unlink and delete-reimbursement restore baseline > Test 6 (idempotent no-op)"
        status: pass
    human_judgment: false
  - id: D6
    description: "removeRefundAction and deleteReimbursementAction (D-09's two lifecycle actions) exist as server actions with Zod-validated input and verifySession() ownership gating, ready for Plan 75-04's UI to call."
    requirement: "RMB-08"
    verification: []
    human_judgment: true
    rationale: "No UI consumes these actions yet (Plan 75-04 ships the linking surfaces) — the actions themselves are unit-untested thin wrappers over already-integration-tested services; a human should confirm the wiring once the UI calls them in 75-04, not before."

# Metrics
duration: 24min
completed: 2026-07-24
status: complete
---

# Phase 75 Plan 3: Unlink and delete-reimbursement restore baseline (D-09, D-10) Summary

**Pre-link snapshot table + shared restore helper close the reversibility gap: unlinking a refund or deleting a whole reimbursement now reverts the refund-cleanup recategorization createPairTx applies at link time, not just the link row.**

## Performance

- **Duration:** ~24 min
- **Started:** 2026-07-24T19:33:00Z (approx, continuing directly after 75-02)
- **Completed:** 2026-07-24T19:56:43Z
- **Tasks:** 2
- **Files modified:** 7 (1 created: migration SQL; 6 modified)

## Accomplishments

- New `reimbursementRefundSnapshot` schema table (migration `0032_reimbursement_refund_snapshot.sql`, pure CREATE TABLE) — one row per `reimbursement_refund` link, `expenseId` nullable + `onDelete:'set null'` so restore logic can distinguish "expense still exists" from "deleted after linking" by checking one column
- `createPairTx` now records the snapshot immediately before calling `applyDetachCleanupTx`, inside the existing refund-cleanup guard — the same write site covers both the create path and Plan 75-02's append path; links that skip cleanup record no snapshot
- New shared `restoreRefundBaseline(tx, { refundTransactionId, userId })` helper: reads the snapshot via a join on the refund's `reimbursement_refund` row, restores the expense's title/descriptionHash/subCategoryId/status in place (or inserts a fresh replacement expense + repoints the transaction if the original was deleted after linking), and no-ops when no snapshot exists — idempotent by construction
- `deletePairByTransactionId`'s refund-side branch now calls `restoreRefundBaseline` BEFORE deleting the link row; the anchor-side branch and the now-empty-reimbursement collapse check are unchanged
- New `deleteReimbursementForAnchor(userId, reimbursementId)`: loads every linked refund's transaction id, restores each one's baseline IN ORDER inside one `db.transaction`, THEN deletes the reimbursement row — never just the last refund removed, and a mid-loop failure rolls back the whole batch
- New `RemoveRefundSchema`/`DeleteReimbursementSchema` validations and `removeRefundAction`/`deleteReimbursementAction` server actions (D-09's two lifecycle actions); `removeRefundAction` is a direct alias of `deleteTransactionPairAction` since its refund-side behavior is already correct post-restore

## Task Commits

Each task was committed atomically:

1. **Task 1: reimbursement_refund_snapshot schema + record-on-link** - `da73186` (feat)
2. **Task 2: Unlink and delete-reimbursement restore baseline (D-09, D-10, RMB-07)** - `298846f` (feat)

**Plan metadata:** committed alongside this SUMMARY (see final commit below)

## Files Created/Modified

- `lib/db/schema.ts` — `reimbursementRefundSnapshot` table + `reimbursementRefundSnapshotRelations` + `snapshot: one(...)` relation on `reimbursementRefundRelations`
- `drizzle/migrations/0032_reimbursement_refund_snapshot.sql` — generated CREATE TABLE diff (no backfill — this table only ever gets rows going forward from links created after this migration)
- `lib/services/transaction-pairs.ts` — `createPairTx` (snapshot write, Task 1) + `restoreRefundBaseline` (new shared helper, Task 2) + `deletePairByTransactionId` (refund-side restore call) + `deleteReimbursementForAnchor` (new, Task 2)
- `lib/validations/transaction-pairs.ts` — `RemoveRefundSchema` (alias of `DeletePairSchema`), `DeleteReimbursementSchema` (coerced positive int)
- `lib/actions/transaction-pairs.ts` — `removeRefundAction` (alias), `deleteReimbursementAction` (new)
- `tests/reimbursement-phase-75.test.ts` — 3 new real-Postgres tests for Task 1 (snapshot recorded/skipped/appended) + 6 new real-Postgres tests for Task 2 (Amazon 1:1 unlink, dinner 1:N per-refund unlink, final-unlink collapse, delete-whole-reimbursement restores all refunds, Group-anchor Option B, idempotent no-op)
- `tests/transaction-pairs-service.test.ts` — Rule 3 auto-fix: mocked schema extended with `reimbursementRefundSnapshot` + `expense.descriptionHash`/`expense.status`; `reimbursementRefund` insert mocks given `.returning()` ids (createPairTx now captures `reimbursementRefundId`); `deletePairByTransactionId`'s mocked select sequence updated for the new snapshot-lookup call; added `db.update` mock support (`dbUpdateChain`/`makeUpdateChain`) and one new test asserting the restore `UPDATE` fires

## Decisions Made

- `reimbursementRefundSnapshot.expenseId` is nullable with `onDelete:'set null'` (not cascade), exactly as the plan's `<action>` spec required — this lets `restoreRefundBaseline` branch on "original expense still exists" (UPDATE in place) vs. "deleted after linking" (INSERT a fresh replacement + repoint) purely by checking the column, no manual existence `SELECT`.
- `restoreRefundBaseline` re-derives its own `reimbursement_refund` row via a join on `refundTransactionId` rather than accepting a pre-resolved `reimbursementRefundId` — this is exactly what let `deleteReimbursementForAnchor` reuse it directly against a list of transaction ids loaded from `reimbursementRefund`, with no adapter or second helper shape needed.
- `removeRefundAction` is a direct alias of `deleteTransactionPairAction` (`export const removeRefundAction = deleteTransactionPairAction`), not a duplicated thin wrapper — per the plan's own note that `deletePairByTransactionId`'s refund-side behavior is "now already correct post-restore," reusing the existing action satisfies D-09's "remove a single refund" vocabulary without adding a second code path that could drift from the first.
- `deletePairByTransactionId`'s anchor-side branch (unlinking via the anchor transaction id, not a refund) is deliberately left completely unchanged, per the plan's action spec — D-09's "delete the whole reimbursement" lifecycle action is the new `deleteReimbursementForAnchor`, invoked by `reimbursementId` directly from the future management UI, not this legacy per-transaction path.
- `requirements mark-complete` NOT run for RMB-07 — same rationale as 75-01/75-02: this plan ships the unlink/delete backend lifecycle (D-09/D-10); the user-facing linking/management UI that RMB-07/RMB-08 actually describe ships in Plan 75-04. Marking either Complete now would be a false positive in REQUIREMENTS.md's traceability table.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] createPairTx's new .returning() call on the reimbursementRefund insert breaks tests/transaction-pairs-service.test.ts's mocked db**
- **Found during:** Task 1, running the full suite after adding the snapshot write
- **Issue:** `createPairTx` now captures `reimbursementRefundId` from `tx.insert(reimbursementRefund).values(...).returning({ id: reimbursementRefund.id })` (needed to reference the just-inserted link row when writing its snapshot). Three tests in `tests/transaction-pairs-service.test.ts` (not in this plan's `files_modified` list) branch their mocked `dbInsertChain` by table identity and returned an empty array for the `reimbursementRefund`/fallback branch — `insertedRefund[0].id` read `undefined`, throwing `Cannot read properties of undefined (reading 'id')`. Also: the mocked schema had no `reimbursementRefundSnapshot` export at all, throwing on `tx.insert(reimbursementRefundSnapshot)`.
- **Fix:** Added `reimbursementRefundSnapshot` (+ `expense.descriptionHash`/`expense.status`) to the mocked schema; updated the 3 affected tests' `dbInsertChain.mockImplementation` to give the `reimbursementRefund` insert branch a `.returning()` id.
- **Files modified:** `tests/transaction-pairs-service.test.ts`
- **Verification:** `yarn vitest run tests/transaction-pairs-service.test.ts` → 33/33 green.
- **Committed in:** `da73186` (Task 1 commit)

**2. [Rule 3 - Blocking] restoreRefundBaseline's new SELECT/UPDATE calls shift tests/transaction-pairs-service.test.ts's mocked select-call numbering and require a db.update mock**
- **Found during:** Task 2, after wiring `restoreRefundBaseline` into `deletePairByTransactionId`'s refund-side branch
- **Issue:** The refund-side unlink tests mock `dbSelectChain` by fixed call-count position (ownership → refund-role → remaining-refunds). Inserting the new snapshot-lookup SELECT as call 3 shifted the pre-existing "remaining refunds" assertion data one position later, and one test's catch-all fallback response (`[{ id: 100 }]`, meant only for "a sibling refund still exists") was now ALSO returned for the new snapshot-lookup call one position earlier — misinterpreted as a snapshot row by `restoreRefundBaseline`. Separately, the mocked `db` object had no `update` method at all, so any test that actually exercised the restore branch would throw `tx.update is not a function`.
- **Fix:** Updated the 3 affected tests' mock sequences to explicitly return an empty snapshot at call 3; added `dbUpdateChain`/`makeUpdateChain`/`db.update` mock support; added one new test (`restores the refund expense to its pre-link snapshot BEFORE deleting the link row`) asserting the restore `UPDATE` fires with the snapshot's values before the link row is deleted.
- **Files modified:** `tests/transaction-pairs-service.test.ts`
- **Verification:** `yarn vitest run tests/transaction-pairs-service.test.ts` → 34/34 green.
- **Committed in:** `298846f` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking issues directly caused by this plan's own mandated snapshot/restore write-path changes)
**Impact on plan:** Both fixes were required to keep the pre-existing mocked unit-test file green (not itself in `files_modified`, but directly broken by this plan's own API additions to `createPairTx`/`deletePairByTransactionId`). No scope creep — both scoped strictly to call sites and mock shapes broken by this plan's own changes, matching the Rule 3 precedent already established in 75-01/75-02.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None — no external service configuration required. `yarn db:migrate` was already run locally against the dev Postgres container (migration 0032 applied); the operator must still run it against staging/production before those environments see the new `reimbursement_refund_snapshot` table (standard project deploy flow, no new step beyond the existing `yarn db:sync` chain).

## Next Phase Readiness

- Plan 75-04 (linking-ui) has every backend piece its multi-select picker and management panel need: `createPairTx` (composable inside one `db.transaction`, Plan 75-02), the pre-link snapshot (this plan, invisible to the UI — it just works), and the two D-09 lifecycle actions (`removeRefundAction`/`deleteReimbursementAction`) ready to wire directly into "remove refund" / "delete reimbursement" buttons.
- No blockers. The existing D-07 quick-action flow (`createTransactionPairAction`/`deleteTransactionPairAction`, `counterpart-picker-dialog.tsx`) is completely unchanged — `deleteTransactionPairAction`'s behavior is strictly improved (it now restores baseline where it previously only removed the link) with no external contract change.
- `removeRefundAction`/`deleteReimbursementAction` are not yet called from any UI (D6 coverage entry, `human_judgment: true`) — Plan 75-04 should verify their wiring once the management panel calls them.

---
*Phase: 75-linking-surfaces-and-lifecycle*
*Completed: 2026-07-24*

## Self-Check: PASSED

All 8 declared files verified present on disk; both task commits (`da73186`, `298846f`) verified present in git history.
