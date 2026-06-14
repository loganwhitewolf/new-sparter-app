---
phase: 50-transaction-pairing
plan: "03"
subsystem: transaction-pairing-backend
tags: [transaction-pairing, service, action, dal, validation, security, tdd]
dependency_graph:
  requires: [50-01, 50-02]
  provides: [createPair, deletePairByTransactionId, getEligibleCounterparts, createTransactionPairAction, deleteTransactionPairAction, CreatePairSchema, DeletePairSchema]
  affects: [lib/services, lib/actions, lib/dal, lib/validations]
tech_stack:
  added: []
  patterns:
    - "service-layer ownership gate: load both tx rows, check both userId === sessionUserId before insert (D-01/T-50-01)"
    - "Decimal.js abs() for primary resolution — no Math.abs / native arithmetic on DECIMAL strings"
    - "or(eq(transactionAId, id), eq(transactionBId, id)) delete covers both FK sides (PAIR-03)"
    - "cache + verifySession on DAL picker — session-scoped query prevents cross-user enumeration"
    - "NOT EXISTS transaction_pair in picker WHERE — already-paired exclusion (D-14)"
key_files:
  created:
    - lib/validations/transaction-pairs.ts
    - lib/services/transaction-pairs.ts
    - lib/dal/transaction-pairs.ts
    - lib/actions/transaction-pairs.ts
  modified: []
decisions:
  - "D-01 enforcement: no userId on transaction_pair; service is the only ownership gate (loads both tx rows, checks both userId)"
  - "Primary resolution order: larger |abs| wins; equal |abs| -> earlier occurredAt wins (D-10)"
  - "Sign filter in picker uses Decimal.js .isNegative() not native < 0 comparison on DECIMAL string"
  - "getEligibleCounterparts signature is an object param { referenceId, referenceAmount, dateFrom, dateTo } — matches Plan 01 RED tests"
  - "Actions surface service error messages directly to caller (ownership, double-link); generic fallback for unexpected errors"
metrics:
  duration: "~10min"
  completed: "2026-06-14"
  tasks: 2
  files: 4
---

# Phase 50 Plan 03: Pairing Service + DAL + Actions Summary

**One-liner:** Ownership-validating pairing service with Decimal.js primary resolution, counterpart-picker DAL (verifySession-scoped + NOT EXISTS), and thin server actions — 23/23 Plan 01 RED tests now GREEN.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Validations + ownership-validating pairing service | 1ba278e | lib/validations/transaction-pairs.ts, lib/services/transaction-pairs.ts |
| 2 | Counterpart-picker DAL + thin server actions | 4addfb7 | lib/dal/transaction-pairs.ts, lib/actions/transaction-pairs.ts |

## What Was Built

### `lib/validations/transaction-pairs.ts`

- `CreatePairSchema`: `z.object({ transactionId: z.string().min(1), counterpartId: z.string().min(1) })` — Italian user-facing error strings, IDs as strings not numbers.
- `DeletePairSchema`: `z.object({ transactionId: z.string().min(1) })`.
- Exported types: `CreatePairInput`, `DeletePairInput` via `z.infer`.

### `lib/services/transaction-pairs.ts`

Security-critical implementation (D-01 / T-50-01):

- `createPair({ userId, transactionId, counterpartId })`:
  1. Loads both transaction rows with `Promise.all` (id, amount, occurredAt, userId).
  2. Throws `'Transazione non trovata.'` if either row is missing.
  3. **IDOR gate**: throws `'Non sei autorizzato a collegare queste transazioni.'` if EITHER `tx.userId !== input.userId`. No user IDs leaked in the error message.
  4. Primary resolution via `toDecimal(amount).abs()`: larger wins; equal → earlier `occurredAt` wins (D-10 silent swap).
  5. `db.insert(transactionPair).values({ transactionAId: primaryId, transactionBId: secondaryId })`. Unique constraints enforce D-02; they surface as a thrown error for T-50-02.
  6. Does NOT touch expense/categorization data (D-04).

- `deletePairByTransactionId({ userId, transactionId })`:
  1. Checks `transaction.userId` before delete.
  2. Deletes via `or(eq(transactionPair.transactionAId, id), eq(transactionPair.transactionBId, id))` — works on either FK side (PAIR-03).

### `lib/dal/transaction-pairs.ts`

- `CounterpartRow` type exported.
- `getEligibleCounterparts = cache(async ({ referenceId, referenceAmount, dateFrom, dateTo }) => { ... })`:
  - `verifySession()` scopes the query to the session user.
  - WHERE: `and(eq(transaction.userId, userId), ne(transaction.id, referenceId), signFilter, gte(occurredAt, dateFrom), lte(occurredAt, dateTo), notAlreadyPaired)`.
  - Sign filter: `refDecimal.isNegative() ? gt(amount, '0') : lt(amount, '0')` — Decimal.js, never native comparison on DECIMAL string.
  - `notAlreadyPaired`: `sql\`NOT EXISTS (SELECT 1 FROM transaction_pair tp WHERE tp.transaction_a_id = ${transaction.id} OR tp.transaction_b_id = ${transaction.id})\`` (D-14).

### `lib/actions/transaction-pairs.ts`

- `createTransactionPairAction(_prev, formData)`: parse → `verifySession()` → `createPair` in try/catch → `revalidatePath('/transactions')` + `revalidatePath('/overview')` → `{ error: null }`.
- `deleteTransactionPairAction(_prev, formData)`: symmetric with `DeletePairSchema` + `deletePairByTransactionId`.
- `verifySession()` is called **after** Zod parse (T-50-04 order correct).
- Ownership/double-link service errors surfaced directly to caller; unexpected errors return generic Italian message.

## Test Results

| Suite | Result | Tests |
|-------|--------|-------|
| tests/transaction-pairs-service.test.ts | GREEN | 14/14 |
| tests/transaction-pairs-dal.test.ts | GREEN | 9/9 |
| **Total** | **GREEN** | **23/23** |

## Deviations from Plan

None — plan executed exactly as written.

The Plan 01 RED tests drove the implementation. All acceptance criteria verified:
- Source assertions: `import 'server-only'`, `transaction.userId`, `toDecimal(` (no `Math.abs`/`Number(`), `or(eq(...transactionAId...)`, `eq(...transactionBId...))` — all confirmed.
- Validation: `z.string().min(1)` (not `z.number()`) — confirmed.
- DAL: `import 'server-only'`, `cache(`, `verifySession`, `eq(transaction.userId`, `ne(transaction.id`, `NOT EXISTS`/`transaction_pair` — all confirmed.
- Actions: `'use server'`, `verifySession()` after parse, `revalidatePath('/transactions')` + `revalidatePath('/overview')` in both actions — all confirmed.

## Known Stubs

None.

## Threat Flags

None — all new surfaces (two server actions, one DAL function) are fully covered by the plan's threat model (T-50-01 through T-50-04). No unplanned network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- `lib/validations/transaction-pairs.ts` — file exists, exports CreatePairSchema/DeletePairSchema.
- `lib/services/transaction-pairs.ts` — file exists, exports createPair/deletePairByTransactionId.
- `lib/dal/transaction-pairs.ts` — file exists, exports getEligibleCounterparts.
- `lib/actions/transaction-pairs.ts` — file exists, exports createTransactionPairAction/deleteTransactionPairAction.
- Task 1 commit: 1ba278e (confirmed in git log).
- Task 2 commit: 4addfb7 (confirmed in git log).
- 23/23 tests GREEN (both suites).
