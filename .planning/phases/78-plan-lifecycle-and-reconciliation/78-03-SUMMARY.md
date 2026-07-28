---
phase: 78-plan-lifecycle-and-reconciliation
plan: 03
subsystem: database
tags: [drizzle, transaction-edit, amortization, guard, decimal]

# Dependency graph
requires:
  - phase: 77-amortization-schema-and-activation
    provides: "amortization_plan schema (status/totalAmount), transactionListSelect.amortizationPlanId correlated-subquery convention"
provides:
  - "AMORT-07 write-path invariant: amount/date edits on a transaction with an OPEN amortization plan are hard-blocked before any write"
affects: [79-amortizations-registry, 80-dashboard-accrual-lens]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Correlated-subquery guard column added to an existing ownership-scoped SELECT (zero extra round trips), mirroring lib/dal/transactions.ts's transactionListSelect.amortizationPlanId"

key-files:
  created: []
  modified:
    - lib/services/transaction-edit.ts
    - tests/transaction-edit.test.ts

key-decisions:
  - "amortizationPlanId correlated subquery uses raw SQL identifiers ('amortization_plan ap', 'ap.transaction_id', 'ap.status') exactly like transactionListSelect.amortizationPlanId, not a Drizzle-typed .from(amortizationPlan) query — so no import of the amortizationPlan schema object was added (would have been unused); only ${transaction.id} is a typed reference, for outer-row correlation."
  - "Guard placed BETWEEN the not-found check and the existing amount-only pair-guard block (not nested inside it), so it also covers occurredAt-only edits — a case the pre-existing pair-guard never checked."
  - "Loose `!= null` comparison on row.amortizationPlanId (not `!== null`) so a pre-existing test's row without the field (undefined) is treated identically to an explicit null — zero changes needed to any pre-existing test fixture."

patterns-established:
  - "Amortization-plan guard predicate: (input.amount !== undefined || input.occurredAt !== undefined) && row.amortizationPlanId != null"

requirements-completed: [AMORT-07]

coverage:
  - id: D1
    description: "Amount and/or date edits on a transaction with an OPEN amortization plan are rejected with the exact Italian message before any write, pair-guard check, or expense reconciliation runs"
    requirement: "AMORT-07"
    verification:
      - kind: unit
        ref: "tests/transaction-edit.test.ts#AMORT-07 — amortization edit guard > blocks an amount edit when the transaction has an OPEN amortization plan"
        status: pass
      - kind: unit
        ref: "tests/transaction-edit.test.ts#AMORT-07 — amortization edit guard > blocks a date-only edit (no amount) when the transaction has an OPEN amortization plan"
        status: pass
      - kind: unit
        ref: "tests/transaction-edit.test.ts#AMORT-07 — amortization edit guard > blocks a combined amount + date edit once with the same message when the plan is OPEN"
        status: pass
    human_judgment: false
  - id: D2
    description: "customTitle-only edits and edits on a CLOSED plan or a transaction with no plan at all are unaffected by the new guard"
    requirement: "AMORT-07"
    verification:
      - kind: unit
        ref: "tests/transaction-edit.test.ts#AMORT-07 — amortization edit guard > allows a customTitle-only edit on a transaction with an OPEN amortization plan"
        status: pass
      - kind: unit
        ref: "tests/transaction-edit.test.ts#AMORT-07 — amortization edit guard > allows an amount edit when the amortization plan is CLOSED (guard scoped to status=open only)"
        status: pass
      - kind: unit
        ref: "tests/transaction-edit.test.ts#AMORT-07 — amortization edit guard > allows an amount edit when the transaction has no amortization plan at all"
        status: pass
    human_judgment: false
  - id: D3
    description: "The new guard's thrown error is a plain Error carrying the exact message, reaching lib/actions/transaction-edit.ts's existing catch block verbatim with zero action-layer changes"
    requirement: "AMORT-07"
    verification:
      - kind: unit
        ref: "tests/transaction-edit.test.ts#AMORT-07 — error shape parity with the pair-guard message > throws a plain Error carrying the exact guard string, not a differently-shaped error object"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-07-28
status: complete
---

# Phase 78 Plan 03: AMORT-07 Edit Invariant Summary

**Extended `updateTransaction`'s pair-guard model with an amortization-plan branch: amount/date edits on a transaction with an OPEN amortization plan are hard-blocked (including date-only edits, a gap the pre-existing pair-guard never covered), while subcategory/title edits and edits on closed/unamortized transactions stay unaffected — zero action-layer changes needed.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-28
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `updateTransaction`'s initial ownership-scoped row load now carries a correlated-subquery `amortizationPlanId` (status-filtered to `'open'`), zero extra round trips, mirroring `lib/dal/transactions.ts`'s `transactionListSelect.amortizationPlanId` convention.
- A new guard runs immediately after the not-found check and BEFORE the existing amount-only pair-guard block, rejecting `amount` and/or `occurredAt` edits on an amortized transaction with the exact Italian message `"Rimuovi ammortamento per modificare l'importo o la data della transazione."` — no write, pair-guard check, or expense reconciliation runs first.
- Verified the guard's thrown error is a plain `Error` (same shape as the pre-existing pair-guard throw), reaching `lib/actions/transaction-edit.ts`'s existing catch block (`{ error: (error as Error).message }`) verbatim — confirmed via `git diff --stat` showing zero lines changed in that file.
- Full suite green (154 files, 1882 tests + 1 pre-existing todo) and `yarn check:language` clean after the change.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend updateTransaction with the AMORT-07 amount/date guard** - `cb7d880` (feat)

**Task 2 (Full-suite regression + language check):** no additional file changes — the required "thrown error reaches the caller identically" test was included in Task 1's commit (avoids a redundant second touch of the same test file); Task 2 consisted entirely of verification (`yarn vitest run`, `yarn check:language`, `yarn tsc --noEmit`, `git diff --stat` against `lib/actions/transaction-edit.ts`), all of which passed with no findings requiring a commit.

**Plan metadata:** (this commit)

## Files Created/Modified
- `lib/services/transaction-edit.ts` - Added `amortizationPlanId` correlated subquery to the initial row load + the new amount/date guard branch (AMORT-07, D-04)
- `tests/transaction-edit.test.ts` - Added 6 behavior tests (block amount, block date-only, block combined, allow title-only, allow closed-plan, allow no-plan) + 1 error-shape parity test

## Decisions Made
- The correlated subquery mirrors `transactionListSelect.amortizationPlanId`'s raw-SQL-identifier style exactly (`amortization_plan ap`, `ap.transaction_id`, `ap.status` as literal SQL text), so no import of the `amortizationPlan` Drizzle schema object was added — it would have been unused (only `${transaction.id}` needs a typed reference, for outer-row correlation). This diverges slightly from the plan's literal "Import amortizationPlan... if not already imported" instruction; kept the file lint-clean and consistent with the analog it was told to mirror.
- Guard uses `row.amortizationPlanId != null` (loose) rather than `!== null` (strict) so a pre-existing test's row (no `amortizationPlanId` key at all, i.e. `undefined`) is treated identically to an explicit `null` — required zero changes to any pre-existing test fixture, satisfying the plan's acceptance criterion verbatim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Cleanup] Skipped importing the unused `amortizationPlan` schema object**
- **Found during:** Task 1
- **Issue:** The plan's `<action>` block said "Import amortizationPlan from '@/lib/db/schema' if not already imported in this file," but the actual correlated-subquery implementation (mirroring `transactionListSelect.amortizationPlanId`) uses raw SQL table/column identifiers, never referencing the Drizzle schema object directly — importing it would have been dead code.
- **Fix:** Omitted the import; verified via `tsc --noEmit` (clean) that no other code path in the file needed it.
- **Files modified:** lib/services/transaction-edit.ts
- **Verification:** `yarn tsc --noEmit` clean; full suite green.
- **Committed in:** cb7d880 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 cleanup, Rule 1)
**Impact on plan:** No scope creep — the fix keeps the file's import list minimal and consistent with the exact analog the plan instructed to mirror.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- AMORT-04/05/06/07 (Phase 78's full requirement set) are now all delivered — this plan closed the last open item (AMORT-07).
- The edit invariant is a pure guard predicate (reversible) with no schema or migration footprint; Phase 79 (registry) and Phase 80 (dashboard lens) can proceed without further backend lifecycle work.
- `amortization_plan.totalAmount`, captured at activation, remains the authoritative base for any future drift-detection defense-in-depth (per 78-CONTEXT.md's snapshot note) — not built in this plan, since the primary invariant is now the hard block.

## Self-Check: PASSED

- FOUND: lib/services/transaction-edit.ts
- FOUND: tests/transaction-edit.test.ts
- FOUND: .planning/phases/78-plan-lifecycle-and-reconciliation/78-03-SUMMARY.md
- FOUND: cb7d880 (Task 1 commit)

---
*Phase: 78-plan-lifecycle-and-reconciliation*
*Completed: 2026-07-28*
