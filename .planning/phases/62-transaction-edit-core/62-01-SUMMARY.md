---
phase: 62-transaction-edit-core
plan: 01
subsystem: api
tags: [drizzle, decimal.js, zod, server-actions, transaction-pairing]

requires: []
provides:
  - "updateTransaction service — atomic amount/occurredAt/customTitle edit with hash/description immutability, expense reconciliation, and pair-guard"
  - "UpdateTransactionSchema Zod validation"
  - "updateTransactionAction thin server action"
affects: [63-detail-pages-tx-expense]

tech-stack:
  added: []
  patterns:
    - "Pair-guard pre-check before any write: load transactionPair row, resolve counterpart, compare Decimal signs, throw before UPDATE runs"
    - "Reconciliation-in-same-tx: pass tx (never db) to loadAggregatesForExpenses/loadManualOrOverrideExpenseIds/buildReconcilePlan/applyExpenseReconciliation"
    - "Allowlist .set() payload construction — hashes/description structurally absent from the update object, not merely unset"

key-files:
  created:
    - lib/services/transaction-edit.ts
    - lib/validations/transaction-edit.ts
    - lib/actions/transaction-edit.ts
    - tests/transaction-edit.test.ts
  modified: []

key-decisions:
  - "transaction table has no updatedAt column (schema.ts) — removed the updatedAt: new Date() field from the plan's described .set() payload; not a schema gap, just this table's actual shape"
  - "Select-chain test mock made thenable (adds a .then()) so awaited .where() calls without a following .limit()/.groupBy() resolve correctly — matches how loadManualOrOverrideExpenseIds and loadAggregatesForExpenses actually call the query builder"

requirements-completed: [DET-01, DET-02, DET-03]

coverage:
  - id: D1
    description: "updateTransaction edits amount/occurredAt/customTitle inside db.transaction; transactionHash/descriptionHash/description are never part of the .set() payload under any code path"
    requirement: DET-01
    verification:
      - kind: unit
        ref: "tests/transaction-edit.test.ts#DET-01 — amount, date, title edits"
        status: pass
    human_judgment: false
  - id: D2
    description: "Linked expense aggregates (totalAmount, transactionCount, first/lastTransactionAt) reconcile atomically in the same db.transaction after an amount/date edit; unaffected when no expense is linked"
    requirement: DET-02
    verification:
      - kind: unit
        ref: "tests/transaction-edit.test.ts#DET-02 — expense reconciliation"
        status: pass
    human_judgment: false
  - id: D3
    description: "Amount edit that would break a paired transaction's opposite-sign/nonzero invariant is rejected with 'Scollega prima il rimborso' before any write; coherent edits and unpaired transactions are unaffected"
    requirement: DET-03
    verification:
      - kind: unit
        ref: "tests/transaction-edit.test.ts#DET-03 — pair guard"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-07-05
status: complete
---

# Phase 62 Plan 01: transaction-edit-core Summary

**`updateTransaction` service — atomic amount/date/title edit with frozen hashes, same-transaction expense reconciliation, and a pre-write pair-invariant guard (Italian "Scollega prima il rimborso")**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-05T14:37:02Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 4 (3 new source files, 1 test file)

## Accomplishments

- `updateTransaction` edits `amount`, `occurredAt`, and `customTitle` inside a single `db.transaction`, with `transactionHash`, `descriptionHash`, and `description` structurally unreachable as write targets (allowlisted `.set()` payload, not a runtime check).
- Amount/date edits on a transaction linked to an expense atomically reconcile that expense's derived aggregates in the same transaction, reusing `loadAggregatesForExpenses` / `loadManualOrOverrideExpenseIds` / `buildReconcilePlan` / `applyExpenseReconciliation` from `expense-reconciliation.ts` unchanged.
- A pair-guard pre-check loads the `transactionPair` row and the counterpart's amount before any UPDATE runs; an amount edit that would make both legs the same sign (or zero) throws `'Scollega prima il rimborso'` and the transaction UPDATE never executes. Unpaired transactions skip the counterpart lookup entirely.
- `UpdateTransactionSchema` (Zod) requires at least one of `amount`/`occurredAt`/`customTitle`; `updateTransactionAction` is a thin `'use server'` wrapper that surfaces the service's Italian error messages verbatim (ownership, not-found, pair-guard) rather than a generic catch-all.

## Task Commits

1. **Task 1: RED — write failing tests for updateTransaction** - `bf270b3` (test)
2. **Task 2: GREEN — implement updateTransaction service, Zod schema, and thin action** - `80b415e` (feat)

**Plan metadata:** (this commit, docs)

## Files Created/Modified

- `lib/services/transaction-edit.ts` - `updateTransaction(input): Promise<{ success: true }>` — ownership-gated load, pair-guard, allowlisted update, conditional reconciliation, all inside one `db.transaction`.
- `lib/validations/transaction-edit.ts` - `UpdateTransactionSchema` — numeric-string amount check mirrors `CreateTransactionSchema`; `.refine` enforces at least one editable field present.
- `lib/actions/transaction-edit.ts` - `updateTransactionAction(_prev, formData)` — parses FormData, verifies session, normalizes amount/date, calls the service, returns the service's error message on throw.
- `tests/transaction-edit.test.ts` - 9 cases covering DET-01/02/03; hoisted mocks mirror `tests/transaction-pairs-service.test.ts` mocking style with a thenable select-chain mock.

## Decisions Made

- **No `updatedAt` on `transaction` writes.** The plan's task description and the RESEARCH.md skeleton both included `updatedAt: new Date()` in the update payload, but `lib/db/schema.ts`'s `transaction` table has no `updatedAt` column (only `createdAt`). Including it would have been a TypeScript/Drizzle type error at the `.set()` call site. Removed from the allowlist; documented inline with a comment pointing at the schema fact. This is a Rule 1 auto-fix (bug: plan/research described a field that doesn't exist on this table) — no scope change, no new column added.
- Test mock fixes (call-order dispatchers for the pair lookup preceding reconciliation loads; thenable select chain) were necessary corrections to my own Task 1 test authoring to match the service's actual query sequence — tracked here for transparency, not a deviation from the plan's behavior contract.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed non-existent `updatedAt` field from transaction `.set()` payload**
- **Found during:** Task 2 (GREEN implementation)
- **Issue:** Plan Task 2 action step and 62-RESEARCH.md's code skeleton both specify `updateSet.updatedAt = new Date()` (or equivalent) on the transaction UPDATE. `lib/db/schema.ts`'s `transaction` table (lines 416-444) has no `updatedAt` column — only `createdAt`, which is `defaultNow()` and never updated after insert.
- **Fix:** Omitted `updatedAt` from the allowlisted update payload entirely; added an inline comment citing the schema fact so a future reader doesn't reintroduce it.
- **Files modified:** `lib/services/transaction-edit.ts`
- **Verification:** `yarn tsc --noEmit` clean for the new file; all 9 tests pass without asserting on `updatedAt`.
- **Committed in:** `80b415e` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix, no scope creep)
**Impact on plan:** Correctness fix only — the edited allowlist still satisfies DET-01's immutability contract (hashes/description absent) and doesn't add or remove any editable field the plan intended.

## Issues Encountered

- Task 1's own test setups initially mismatched the service's real query-call sequence: three tests configured a single static select-chain response when the service under test (once written in Task 2) issues 2-4 sequential `tx.select()` calls (transaction row → pair lookup → reconciliation loads). Fixed by adding call-counter dispatchers matching the documented call order in the plan's `<behavior>` block (test 5's dispatcher pattern), applied retroactively to tests 1, 5, and 6.
- The select-chain mock's `.where()` returned a non-promise chain object when no `.limit()`/`.groupBy()` followed, but `loadManualOrOverrideExpenseIds` and `loadAggregatesForExpenses` both `await` the `.where()` result directly in some call shapes. Fixed by adding a `.then()` to the mock chain so it resolves like Drizzle's real thenable query builder.
- Both fixes are corrections to the test file authored in Task 1 (not yet committed at the time — folded into the Task 1 test as part of achieving Task 2's GREEN state, consistent with the TDD RED→GREEN flow where RED-authored tests are refined once the real implementation reveals the exact call shape).

## Next Phase Readiness

- `updateTransaction`, `UpdateTransactionSchema`, and `updateTransactionAction` are ready for Phase 63's detail pages to call for pencil-inline editing on `/transactions/[id]`.
- No UI was built in this plan (backend-only, per the plan's objective).
- Plan 02 of Phase 62 (expense-edit, DET-04) is unblocked — it does not depend on this plan's artifacts.

---
*Phase: 62-transaction-edit-core*
*Completed: 2026-07-05*

## Self-Check: PASSED

All created files verified on disk; both task commits (`bf270b3`, `80b415e`) verified in git log.
