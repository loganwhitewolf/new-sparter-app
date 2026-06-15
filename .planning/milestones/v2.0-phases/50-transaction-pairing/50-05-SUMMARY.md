---
phase: 50-transaction-pairing
plan: "05"
subsystem: ui
tags: [transaction-pairing, react, dialog, popover, shadcn, next.js, server-actions]

# Dependency graph
requires:
  - phase: 50-03
    provides: createTransactionPairAction / deleteTransactionPairAction / getEligibleCounterparts
  - phase: 50-04
    provides: pairedWithId / pairedNetAmount / pairedDescription / pairedAmount / pairedOccurredAt on transactionListSelect

provides:
  - CounterpartPickerDialog — searchable opposite-sign picker, ±90-day date window, useActionState wiring
  - TransactionPairPopover — link badge (signed net via Decimal.js) + counterpart-detail popover + "Vai alla transazione"
  - Collega rimborso / Scollega row actions toggling by pair state
  - key-based remount of TransactionTable and CounterpartPickerDialog on pair create/remove

affects:
  - future plans consuming transaction-pairing surface
  - any plan that adds new columns to TransactionListRow (must account for pairedAmount correlated subquery)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - key-based remount pattern for client tables whose row data flows via props (avoids stale local-state after server action)
    - per-instance Dialog key anchors internal state (date range, selected counterpart) to the triggering transaction

key-files:
  created:
    - components/transactions/counterpart-picker-dialog.tsx
    - components/transactions/transaction-pair-popover.tsx
  modified:
    - components/transactions/transaction-table.tsx
    - app/(app)/transactions/page.tsx
    - lib/dal/transactions.ts

key-decisions:
  - "TransactionTable uses key={buildTransactionTableKey(transactions)} where the key includes pairedWithId + pairedNetAmount so a pair create/remove forces a remount and picks up the updated row data (table copies transactions into local state, making prop-only updates invisible)"
  - "CounterpartPickerDialog mounted with key={pairTarget.id} — re-anchors the ±90-day date window to the reference transaction's occurredAt on every open, preventing stale date range from a reused dialog instance"
  - "Popover Importo uses pairedAmount (= t2.amount correlated subquery, the counterpart's original signed amount), NOT pairedNetAmount — ensures Importo and Netto show distinct values for non-zero-net pairs"
  - "pairedAmount added as a correlated subquery to transactionListSelect in lib/dal/transactions.ts (Plan 04 field set extended)"

patterns-established:
  - "key-based remount: when a client component copies props into local state (useState initializer), force remount via a key that changes when the relevant prop changes — never rely on useEffect prop-sync for correctness"
  - "per-dialog key for form dialogs: key={targetEntity.id} ensures form state (date range, selection) resets on every new open target"

requirements-completed: [PAIR-01, PAIR-02, PAIR-03]

# Metrics
duration: ~90min (including operator checkpoint + 5 post-checkpoint fixes)
completed: 2026-06-14
---

# Phase 50 Plan 05: Transaction-Pairing UI Summary

**Full pairing UX shipped: "Collega rimborso"/"Scollega" row actions, searchable counterpart picker dialog, inline signed-net badge, and counterpart-detail popover — operator-verified end-to-end including dashboard netting and unlink baseline restoration**

## Performance

- **Duration:** ~90 min (Tasks 1–2 implementation + operator verification + 5 post-checkpoint fixes)
- **Started:** 2026-06-14
- **Completed:** 2026-06-14
- **Tasks:** 2 implementation tasks + 1 operator checkpoint (passed)
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- Delivered `CounterpartPickerDialog`: searchable, date-range-adjustable picker showing only opposite-sign, in-range, not-already-paired counterparts; wired via `useActionState(createTransactionPairAction)` mirroring the existing `TransactionFormDialog` pattern
- Delivered `TransactionPairPopover`: link badge showing signed net via Decimal.js; popover with counterpart description, original amount (Importo), signed net (Netto), date, and working "Vai alla transazione" link
- Integrated "Collega rimborso"/"Scollega" row actions into `TransactionTable` toggling by pair state; inline badge renders in natural row position (no re-sort/group)
- All PAIR-01 / PAIR-02 / PAIR-03 requirements operator-confirmed: pairing, badge/popover display, dashboard netting, and unlink baseline restoration
- Test suite GREEN (1005 passed, 1 todo, 82 files); `yarn lint` clean (0 errors)

## Task Commits

1. **Task 1: CounterpartPickerDialog + TransactionPairPopover** — `247c58b` (feat)
2. **Task 2: Row actions + badge in TransactionTable + page wiring** — `6de428f` (feat)
3. **[CHECKPOINT] Operator visual verification** — PASSED (no commit — verification only)

Post-checkpoint fix commits (all on develop, documented as deviations below):

- `e253535` fix(50-05): truncate long counterpart descriptions inside picker dialog
- `fa3f45e` fix(50-05): constrain picker dialog inputs to dialog width
- `bc052f6` fix(50-05): remount transaction table when a pair is created/removed
- `9940cfd` fix(50-05): remount picker per transaction via key
- `75d1f3a` fix(50-05): show counterpart's original amount in pair popover Importo

## Files Created/Modified

- `components/transactions/counterpart-picker-dialog.tsx` — new; opposite-sign counterpart picker dialog with date range, search filter, useActionState wiring
- `components/transactions/transaction-pair-popover.tsx` — new; link badge (signed net, Decimal.js) + popover (Importo, Netto, date, "Vai alla transazione")
- `components/transactions/transaction-table.tsx` — added pairTarget state, Collega/Scollega row actions, TransactionPairPopover badge, CounterpartPickerDialog mount, key-based remount
- `app/(app)/transactions/page.tsx` — threaded pairedAmount + pairedNetAmount into table key for remount; page stays RSC
- `lib/dal/transactions.ts` — added pairedAmount correlated subquery (t2.amount) to transactionListSelect; extended select shape test assertion

## Decisions Made

- **Key-based remount for TransactionTable**: the table copies `transactions` into local state via `useState` initializer; prop updates after a server action revalidation are invisible without a remount. Added `pairedWithId` + `pairedNetAmount` to `buildTransactionTableKey` so any pair change forces remount.
- **Per-dialog key `key={pairTarget.id}`**: the `CounterpartPickerDialog` instance was being reused across different `pairTarget` values (React's component reconciliation preserved the internal date-range state). Keying by `pairTarget.id` re-anchors the ±90-day window to the new reference transaction on every open.
- **Importo = pairedAmount (t2.amount), Netto = pairedNetAmount**: the original plan used `pairedNetAmount` for both fields. For a net-zero pair (e.g. -100/+100) this displayed "+€0,00" for both. Added a separate `pairedAmount` correlated subquery returning the counterpart's original amount for the Importo field.

## Deviations from Plan

### Post-Checkpoint Fixes (operator-surfaced during human verification)

All 5 issues were discovered by the operator during the Task 3 visual-verification checkpoint and fixed before the plan was closed. They are documented here as deviations rather than as planned work.

---

**1. [Rule 1 - Bug] Truncate long counterpart descriptions inside picker dialog**
- **Found during:** Task 3 (operator checkpoint)
- **Issue:** Long counterpart descriptions overflowed the picker list items; text broke outside the dialog boundary
- **Fix:** Added `flex min-w-0` to the label container so long descriptions truncate with ellipsis
- **Files modified:** `components/transactions/counterpart-picker-dialog.tsx`
- **Verification:** Operator confirmed truncation in re-test
- **Committed in:** `e253535`

---

**2. [Rule 1 - Bug] Constrain picker dialog form inputs to dialog width**
- **Found during:** Task 3 (operator checkpoint)
- **Issue:** The date-range `Input` columns inside `DialogContent` (which uses `max-w-lg`) were overflowing their container; the grid items were not constrained
- **Fix:** Added `min-w-0` to the form container and date column wrappers so inputs respect the dialog width
- **Files modified:** `components/transactions/counterpart-picker-dialog.tsx`
- **Verification:** Operator confirmed inputs stay within dialog bounds
- **Committed in:** `fa3f45e`

---

**3. [Rule 1 - Bug] Remount TransactionTable when a pair is created/removed**
- **Found during:** Task 3 (operator checkpoint)
- **Issue:** After "Collega rimborso" or "Scollega" completed, the `🔗` badge did not appear/disappear without a manual page reload. Root cause: `TransactionTable` initializes its local rows via `useState(props.transactions)` — a React pattern where prop updates post-revalidation are invisible without a remount.
- **Fix:** Added `pairedWithId` and `pairedNetAmount` to the `buildTransactionTableKey` helper in `page.tsx` so any pairing change forces a full remount of the table component, landing the updated row data
- **Files modified:** `app/(app)/transactions/page.tsx`
- **Verification:** Operator confirmed badge appears/disappears immediately after pair/unlink without manual reload
- **Committed in:** `bc052f6`

---

**4. [Rule 1 - Bug] Remount picker per transaction via key={pairTarget.id}**
- **Found during:** Task 3 (operator checkpoint)
- **Issue:** Flaky "counterpart only appears on 2nd open" behaviour. The dialog instance was reused across different `pairTarget` values; React reconciliation preserved the internal date-range state (initialized from the previous transaction's `occurredAt`). On first open for a new transaction the ±90-day window was anchored to the previous transaction's date, so the new transaction's eligible counterparts fell outside the range and were not fetched.
- **Fix:** Added `key={pairTarget.id}` to the `CounterpartPickerDialog` mount so a new dialog instance is created for each target transaction, re-anchoring the date window
- **Files modified:** `components/transactions/transaction-table.tsx`
- **Verification:** Operator confirmed counterpart list loads correctly on first open for any transaction
- **Committed in:** `9940cfd`

---

**5. [Rule 1 - Bug] Show counterpart's original amount in pair popover Importo field**
- **Found during:** Task 3 (operator checkpoint)
- **Issue:** The popover displayed `pairedNetAmount` for both "Importo" and "Netto" fields. For a pair where the net is non-trivial (e.g. -€100 / +€50 → net -€50) this was misleading; for a zero-net pair (+€100 / -€100) both fields showed €0,00.
- **Fix:** Added a `pairedAmount` correlated subquery (`t2.amount`) to `transactionListSelect` in `lib/dal/transactions.ts` returning the counterpart's original amount. The popover now receives `pairedAmount` (Importo) and `pairedNetAmount` (Netto) as distinct values. Added a select-shape test assertion for the new field.
- **Files modified:** `lib/dal/transactions.ts`, `components/transactions/transaction-pair-popover.tsx`
- **Verification:** Operator confirmed Importo and Netto show correct distinct values; test suite 1005 passed
- **Committed in:** `75d1f3a`

---

**Total deviations:** 5 auto-fixed (all Rule 1 — bugs surfaced during operator checkpoint)
**Impact on plan:** All fixes required for correctness of the user-facing pairing UX. No scope creep. Implementation tasks 1–2 were sound; the bugs emerged from real-world interaction patterns not caught by lint/build/type checks.

## Issues Encountered

None beyond the 5 bugs documented above. Test suite was GREEN throughout; `yarn lint` had 0 errors (1 pre-existing `getAmountFormatter` warning, not introduced by this plan).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Phase 50 (transaction-pairing) is fully complete: all 5 plans shipped, PAIR-01/PAIR-02/PAIR-03 operator-confirmed. The remaining open items in v2.0 are:

- **48-03-PLAN.md** — MIGRATION-RUNBOOK.md + staging→production apply checkpoints (operator-pending)
- **49-06-PLAN.md** — [BLOCKING] drop `sub_category.exclude_from_totals` migration

The `transaction_pair` table and the pairing UI are live in local dev; a production deploy requires the standard Vercel preview-to-production flow.

---
*Phase: 50-transaction-pairing*
*Completed: 2026-06-14*
