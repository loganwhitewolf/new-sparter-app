---
phase: 73-reimbursement-schema-and-netting
plan: 03
subsystem: database
tags: [drizzle, postgres, decimal.js, vitest, netting, reimbursement]

# Dependency graph
requires:
  - phase: 73-01
    provides: "reimbursement + reimbursement_refund schema, generalized effectiveAmount()/isNotSecondary() anchor tie-break shape"
  - phase: 73-02
    provides: "D-02 invariant module (not consumed here — reserved for Plan 73-04's createPair), expanded regression matrix precedent"
provides:
  - "lib/dal/transactions.ts's 5 paired-* fields (pairedWithId/pairedNetAmount/pairedAmount/pairedDescription/pairedOccurredAt) reading reimbursement/reimbursement_refund instead of transaction_pair"
  - "lib/services/transaction-edit.ts's amount-edit pair guard repointed to reimbursement/reimbursement_refund, generalized from a single-counterpart lookup to a Decimal.js SUM over any N linked refunds"
  - "Closes gate surfaces #4 (stale LIMIT-1 popover) and #5 (guard going silently dead) from 73-VALIDATION.md"
affects: [73-04-reimbursement-schema-and-netting]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Correlated-subquery role resolution (pairedCounterpartIdExpr()/pairedReimbursementIdExpr() in transactions.ts) reusing the exact anchor tie-break SQL shape from effectiveAmount() rather than inventing a second tie-break rule"
    - "Single combined SELECT with two correlated subquery columns (asRefundReimbursementId/asAnchorReimbursementId) to resolve a transaction's reimbursement role in one round trip instead of two"

key-files:
  created: []
  modified:
    - lib/dal/transactions.ts
    - tests/transactions-dal.test.ts
    - lib/services/transaction-edit.ts
    - tests/transaction-edit.test.ts

key-decisions:
  - "pairedWithId/pairedAmount/pairedDescription/pairedOccurredAt reuse one shared pairedCounterpartIdExpr() helper (called once per field) rather than duplicating the role-resolution CASE 4 times independently — reduces duplication while keeping each field as its own correlated subquery (no LEFT JOIN, preserving buildTransactionOrderBy per the plan's constraint)."
  - "The amount-edit guard's role detection (refund vs anchor) is resolved in ONE combined SELECT with two correlated subquery columns, not two sequential queries — kept the round-trip count for the unpaired case at 2 (row load + role lookup), matching the old 1:1 guard's call-count shape."
  - "The 'zero linked refunds' exemption is implemented by checking SUM(...) IS NULL (SQL SUM over an empty set), not a separate COUNT query — avoids a third round trip for the anchor-edit branch."

requirements-completed: [RMB-04, RMB-05]

coverage:
  - id: D1
    description: "transactions.ts's 5 paired-* correlated subqueries (pairedWithId, pairedNetAmount, pairedAmount, pairedDescription, pairedOccurredAt) read reimbursement/reimbursement_refund, not transaction_pair — anchor, refund, and unpaired cases all correct, TransactionListRow shape unchanged"
    requirement: "RMB-04"
    verification:
      - kind: unit
        ref: "tests/transactions-dal.test.ts > transaction pairing select-shape contract (Phase 50 — PAIR-02) — 6 existing fragment-presence tests + 1 new Phase 73 test asserting reimbursement/reimbursement_refund text and absence of transaction_pair"
        status: pass
    human_judgment: false
  - id: D2
    description: "pairedWithId/pairedAmount/pairedDescription/pairedOccurredAt resolve the counterpart deterministically for anchor-viewing-refund and refund-viewing-anchor roles, via the earliest-transaction-of-expense (Q3) and earliest-linked-refund tie-breaks; pairedNetAmount sums the FULL reimbursement (anchor + every linked refund) identically regardless of which participant row is viewed"
    requirement: "RMB-04"
    verification:
      - kind: unit
        ref: "tests/transactions-dal.test.ts fragment-presence + SQL-text assertions (pairedAmount contains t2.amount / no '+'; pairedNetAmount contains ::numeric)"
        status: pass
    human_judgment: true
    rationale: "The SQL fragments are verified structurally (shape, referenced tables, absence of transaction_pair) via mocked sql`` fragment inspection, not by executing the query against a real seeded reimbursement with N>1 refunds. Numeric correctness of the CASE/tie-break logic against a live anchor/refund/unpaired dataset was not re-proven with a new integration test in this plan — it reuses the exact tie-break shape already regression-proven for effectiveAmount() in Plans 73-01/73-02, but that proof covers the netting aggregates, not this display-query's own SQL text."
  - id: D3
    description: "lib/services/transaction-edit.ts's amount-edit pair guard (DET-03) fires against reimbursement/reimbursement_refund instead of transaction_pair — blocks a same-sign edit, allows an opposite-sign edit, is a no-op on unpaired transactions, and generalizes correctly to N>1 refunds via a Decimal.js SUM excluding the edited refund"
    requirement: "RMB-05"
    verification:
      - kind: unit
        ref: "tests/transaction-edit.test.ts > DET-03 — pair guard (5 tests: same-sign block, opposite-sign allow, unpaired no-op, refund-side N>1 SUM block, zero-refunds no-guard)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A reimbursement with zero linked refunds imposes no guard on an anchor amount edit (SUM over an empty refund set is NULL, explicitly checked and bypassed rather than defaulting to a false opposite-sign comparison)"
    requirement: "RMB-05"
    verification:
      - kind: unit
        ref: "tests/transaction-edit.test.ts > DET-03 — pair guard > 'imposes no guard on an anchor edit when the reimbursement has zero linked refunds'"
        status: pass
    human_judgment: false

# Metrics
duration: ~25min
completed: 2026-07-23
status: complete
---

# Phase 73 Plan 03: Repoint Transaction-List Popover and Amount-Edit Guard Summary

**Repointed `lib/dal/transactions.ts`'s 5 paired-* correlated subqueries and `lib/services/transaction-edit.ts`'s amount-edit pair guard from the deprecated 1:1 `transaction_pair` table onto `reimbursement`/`reimbursement_refund`, closing gate surfaces #4 and #5 from 73-VALIDATION.md.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-23
- **Tasks:** 2 (both `type="auto" tdd="true"`)
- **Files modified:** 4 (2 source, 2 test)

## Accomplishments

- `transactionListSelect`'s 5 paired-* fields (pairedWithId, pairedNetAmount, pairedAmount, pairedDescription, pairedOccurredAt) — feeding the live transaction-list pair popover — now read `reimbursement`/`reimbursement_refund` instead of the dormant `transaction_pair` table. Role resolution (is this transaction a refund? the anchor?) reuses the exact earliest-transaction-of-expense tie-break Plan 73-01 built into `effectiveAmount()`, via two shared helper functions (`pairedCounterpartIdExpr()`, `pairedReimbursementIdExpr()`) rather than duplicating the CASE logic per field.
- When a reimbursement has N>1 linked refunds, the anchor's displayed counterpart is the earliest-LINKED refund (`reimbursement_refund.created_at ASC, transaction_id ASC`) — a documented, accepted single-counterpart display limitation (T-73-11; full multi-refund popover is Phase 75/76 scope). `pairedNetAmount` is NOT limited this way: it always sums the anchor's amount plus every linked refund, so the displayed net total stays correct even though only one counterpart is named.
- `updateTransaction`'s DET-03 amount-edit guard now resolves a transaction's reimbursement role (refund vs anchor) via a single combined SELECT with two correlated subquery columns, then generalizes the old single-counterpart opposite-sign check to a Decimal.js SUM: anchor + every OTHER linked refund (when editing a refund) or every linked refund (when editing the anchor). A reimbursement with zero linked refunds imposes no guard.
- Added a new fragment-presence test in `tests/transactions-dal.test.ts` that recursively flattens nested `sql\`\`` fragments (accounting for the mocked `sql` tag's `{op, strings, values}` shape, where nested fragments live in `values`, not spliced into the outer `strings`) to prove all 5 paired-* fields' full SQL text references `reimbursement`/`reimbursement_refund` and never `transaction_pair` (T-73-09 regression coverage).
- Added 2 new DET-03 tests in `tests/transaction-edit.test.ts` beyond the 3 pre-existing ones: a refund-side N>1 SUM-generalization case and a zero-linked-refunds no-guard case.

## Task Commits

Each task was committed atomically:

1. **Task 1: Repoint transactions.ts paired-* correlated subqueries** — `f2fe1c7` (feat)
2. **Task 2: Repoint the amount-edit pair guard to reimbursement/reimbursement_refund** — `e9601f7` (feat)

**Plan metadata:** committed alongside this SUMMARY (see final commit)

## Files Created/Modified

- `lib/dal/transactions.ts` — Added `pairedCounterpartIdExpr()`/`pairedReimbursementIdExpr()` helpers; rewrote the 5 paired-* fields in `transactionListSelect` to use them; `TransactionListRow`/`TransactionDetailRow` types unchanged
- `tests/transactions-dal.test.ts` — Added a new fragment-text assertion proving all 5 paired-* fields reference `reimbursement`/`reimbursement_refund` and never `transaction_pair`
- `lib/services/transaction-edit.ts` — Replaced the `transactionPair`-keyed lookup in `updateTransaction`'s guard with a role-resolution SELECT + SUM-based opposite-sign check against `reimbursement`/`reimbursement_refund`
- `tests/transaction-edit.test.ts` — Updated schema mock (`reimbursement` replaces `transactionPair`), updated DET-01/DET-02 mocks' second-call shape (role-lookup row instead of an empty pair-lookup array), rewrote the 3 existing DET-03 tests to the new fixtures, added 2 new DET-03 tests (N>1 SUM generalization, zero-refunds no-guard)

## Decisions Made

- **Shared role-resolution helpers instead of per-field duplication (Claude's discretion).** `pairedCounterpartIdExpr()` and `pairedReimbursementIdExpr()` are each defined once and interpolated into multiple field expressions via drizzle's nested `sql` composition, rather than writing the same CASE/tie-break logic five times. Functionally equivalent to five independent correlated subqueries (drizzle inlines the nested SQL text with parameters merged), but keeps the file maintainable.
- **Guard role detection as a single combined SELECT (Claude's discretion, mirrors the plan's read_first pattern).** Rather than one query for "is this a refund" and a second for "is this the anchor," both checks run as two correlated subquery columns in one SELECT — keeping the guard's round-trip count for the unpaired case at 2 (row load + role lookup), matching the shape of the old 1:1 guard's call pattern.
- **Zero-refunds exemption via `SUM(...) IS NULL`, not a COUNT query (Claude's discretion).** SQL's `SUM()` over zero matching rows returns `NULL`, not `0` — checked directly (`refundsSumRaw != null`) rather than adding a third round trip to count linked refunds first.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' `<behavior>` and `<action>` sections were implemented as specified; the two additional DET-03 tests (N>1 refund-side generalization, zero-refunds exemption) are within the plan's own `<behavior>` spec for Task 2, added as direct regression coverage for behavior the plan explicitly called out but the plan's `<read_first>` only named 3 pre-existing tests to keep green — not new scope, just closing the coverage the plan's own behavior spec already required.

## Issues Encountered

- Initial versions of two new/modified DET-03 tests (`allows a coherent amount edit...` and `imposes no guard on an anchor edit when the reimbursement has zero linked refunds`) set `expenseId: 'exp-1'` on the mock transaction row, which unintentionally triggered `updateTransaction`'s existing linked-expense reconciliation path (`loadAggregatesForExpenses`/`applyExpenseReconciliation`) beyond the 3 select calls each test's mock provided, causing a `database.delete is not a function` error from the reconciliation helper. Fixed by reverting `expenseId` to `null` in these tests — the mocked role/sum-lookup responses are fully deterministic regardless of the real `expenseId` value passed into the (mocked) SQL parameters, so `null` is sufficient and matches the original tests' design intent of isolating the guard from reconciliation.

## User Setup Required

None — no external service configuration required, no schema/migration changes in this plan (schema and migrations were already delivered by Plan 73-01).

## Next Phase Readiness

- Gate surfaces #4 (transaction-list paired-* fields) and #5 (amount-edit guard) from 73-VALIDATION.md are both closed by real code changes reading the new tables — `transaction_pair` is no longer referenced by any code path touched in this plan.
- Per 73-01-SUMMARY.md's locked decision (`option-b`), `transaction_pair` still exists in the schema, untouched in row content. Plan 73-04 must still repoint the remaining consumers (`lib/services/transaction-pairs.ts`'s `createPair`/`deletePairByTransactionId`, `lib/dal/transaction-pairs.ts`'s `getEligibleCounterparts` — the live pair-creation WRITE path, explicitly out of scope for this plan) before Plan 73-04 Task 3's `DROP TABLE` migration can run safely.
- No UI component's props/types changed — `TransactionListRow`/`TransactionDetailRow` are byte-identical in shape; `components/transactions/transaction-table.tsx`, `transaction-detail-client.tsx`, and `counterpart-picker-dialog.tsx` require zero changes.

---
*Phase: 73-reimbursement-schema-and-netting*
*Completed: 2026-07-23*

## Self-Check: PASSED

All modified files (`lib/dal/transactions.ts`, `tests/transactions-dal.test.ts`, `lib/services/transaction-edit.ts`, `tests/transaction-edit.test.ts`) and both task commit hashes (`f2fe1c7`, `e9601f7`) verified present.
