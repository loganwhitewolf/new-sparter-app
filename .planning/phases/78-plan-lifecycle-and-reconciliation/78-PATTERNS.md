# Phase 78: plan-lifecycle-and-reconciliation - Pattern Map

**Mapped:** 2026-07-28
**Files analyzed:** 7 files to create/modify
**Analogs found:** 7/7 with high-confidence matches

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `lib/services/amortization-lifecycle.ts` | service | CRUD (multi-write) | `lib/services/amortization-activation.ts` | exact |
| `lib/services/transaction-edit.ts` | service | CRUD (guard+write) | itself (extend) | exact |
| `lib/actions/amortization-lifecycle.ts` | action | request-response | `lib/actions/amortization.ts` | exact |
| `lib/actions/transaction-edit.ts` | action | request-response | itself (extend) | exact |
| `lib/db/schema.ts` | model | configuration | Phase 77 amortization schema | exact |
| `tests/amortization-lifecycle.test.ts` | test | batch/testing | `tests/reimbursement-regression.test.ts` | role-match |
| `tests/transaction-edit.test.ts` | test | batch/testing | itself (extend) | exact |

## Pattern Assignments

### `lib/services/amortization-lifecycle.ts` (service, CRUD multi-write)

**Analogs:** 
- `lib/services/amortization-activation.ts` (Phase 77, multi-write pattern + DbOrTx)
- `lib/services/reimbursement.ts` (residual calculation)
- `lib/services/transaction-pairs.ts` (netting mechanism)

**Imports pattern** (from `lib/services/amortization-activation.ts` lines 1-17):
```typescript
import 'server-only'

import { randomUUID } from 'node:crypto'
import { and, eq, gte, lt } from 'drizzle-orm'
import type { DbOrTx } from '@/lib/db'
import {
  amortizationInstalment,
  amortizationPlan,
  expense,
  transaction as transactionTable,
} from '@/lib/db/schema'
import { materializeInstalments } from '@/lib/services/amortization-math'
import { toDbDecimal, toDecimal } from '@/lib/utils/decimal'
```

**DbOrTx pattern (acceptance of tx parameter, from `lib/services/amortization-activation.ts` lines 54-57):
```typescript
export async function activatePlanTx(
  tx: DbOrTx,
  input: ActivatePlanInput,
): Promise<ActivatePlanResult> {
```

**Error class pattern (from `lib/services/amortization-activation.ts` lines 19-29):
```typescript
export type ActivatePlanErrorCode = 'TRANSACTION_NOT_FOUND' | 'INVALID_MONTHS' | 'INELIGIBLE'

export class ActivatePlanError extends Error {
  readonly code: ActivatePlanErrorCode

  constructor(code: ActivatePlanErrorCode, message: string) {
    super(message)
    this.name = 'ActivatePlanError'
    this.code = code
  }
}
```

**Ownership check + SELECT pattern (from `lib/services/amortization-activation.ts` lines 66-85):
```typescript
const rows = await tx
  .select({
    // Select only needed columns
    transactionId: transactionTable.id,
    amount: transactionTable.amount,
    occurredAt: transactionTable.occurredAt,
  })
  .from(transactionTable)
  .where(
    and(
      eq(transactionTable.id, input.transactionId),
      eq(transactionTable.userId, input.userId), // ownership check
    ),
  )
  .limit(1)

const row = rows[0]
if (!row) {
  throw new Error('Risorsa non trovata.')
}
```

**Decimal.js pattern (from `lib/services/amortization-activation.ts` lines 116, and `lib/services/amortization-math.ts` lines 97-115):
```typescript
// Snapshot: store as toDbDecimal() (string)
await tx.insert(amortizationPlan).values({
  id: planId,
  userId: input.userId,
  totalAmount: toDbDecimal(toDecimal(row.amount)),
})

// Remaining sum calculation: toDecimal() for arithmetic, toDbDecimal() for write
const remainingSum = futureInstalments.reduce(
  (acc, inst) => acc.plus(toDecimal(inst.amount)),
  toDecimal('0'),
)
```

**Bulk insert pattern (from `lib/services/amortization-activation.ts` lines 119-129):
```typescript
await tx.insert(amortizationInstalment).values(
  instalments.map((instalment, index) => ({
    id: randomUUID(),
    userId: input.userId,
    planId,
    instalmentNumber: index + 1,
    expenseId: detachResult.newExpenseId,
    amount: instalment.amount, // already toDbDecimal'd from math
    occurredAt: instalment.date,
  })),
)
```

**Residual calculation pattern (from `lib/services/reimbursement.ts` lines 24-33):
```typescript
export function deriveResidualFromAggregates(aggregates: ReimbursementAggregates): ReimbursementResidual {
  const residual = toDecimal(aggregates.outflowSum).plus(toDecimal(aggregates.refundSum))
  const state: ReimbursementResidualState = residual.lt(0)
    ? 'owed'
    : residual.eq(0)
      ? 'settled'
      : 'surplus'

  return { residual: toDbDecimal(residual), state }
}
```

**Month clamping pattern (from `lib/services/amortization-math.ts` lines 31-46):
```typescript
function addMonthsClamped(date: Date, monthsToAdd: number): Date {
  const targetYear = date.getFullYear()
  const targetMonthIndex = date.getMonth() + monthsToAdd
  const lastDayOfTargetMonth = new Date(targetYear, targetMonthIndex + 1, 0).getDate()
  const clampedDay = Math.min(date.getDate(), lastDayOfTargetMonth)

  return new Date(
    targetYear,
    targetMonthIndex,
    clampedDay,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  )
}
```

---

### `lib/services/transaction-edit.ts` (service, extend with D-04 guard)

**Analog:** itself — extend `updateTransaction()` function

**Existing pair-guard pattern to extend (lines 102-250):**
```typescript
if (input.amount !== undefined) {
  // Phase 73/74: existing reimbursement pair-guard code
  const roleRows = await tx
    .select({
      asRefundReimbursementId: sql<number | null>`...`,
      asAnchorReimbursementId: sql<number | null>`...`,
    })
    .from(transaction)
    .where(eq(transaction.id, input.transactionId))
    .limit(1)

  const reimbursementId = roleRow?.asRefundReimbursementId ?? roleRow?.asAnchorReimbursementId ?? null
  
  if (reimbursementId != null) {
    // existing guard logic for reimbursement...
  }
  
  // PHASE 78 D-04: INSERT NEW AMORTIZATION GUARD HERE (after reimbursement check)
}
```

**New D-04 amortization guard to insert (after existing pair-guard, RESEARCH.md lines 449-477):**
```typescript
// Phase 78 D-04: check for amortization plan (amount/date block)
const amortizationRows = await tx
  .select({ id: amortizationPlan.id })
  .from(amortizationPlan)
  .where(
    and(
      eq(amortizationPlan.transactionId, input.transactionId),
      eq(amortizationPlan.status, 'open'),
    ),
  )
  .limit(1)

if (amortizationRows.length > 0) {
  throw new Error(
    'Rimuovi ammortamento per modificare l\'importo o la data della transazione.',
  )
}
```

**Import to add (amortizationPlan schema + status column reference):**
```typescript
import { amortizationPlan } from '@/lib/db/schema'
```

---

### `lib/actions/amortization-lifecycle.ts` (action, request-response)

**Analog:** `lib/actions/amortization.ts` (lines 1-64, 79-116)

**File structure pattern** (from `lib/actions/amortization.ts` lines 1-34):
```typescript
'use server'

import { and, eq } from 'drizzle-orm'
import { verifySession } from '@/lib/dal/auth'
import { db } from '@/lib/db'
import { amortizationPlan } from '@/lib/db/schema'
import { revalidateCategorizationSurfaces } from '@/lib/actions/revalidation'

export type CreateAmortizationPlanResult = {
  planId: string
  expenseId: string
  instalments: Array<{ date: Date; amount: string }>
  error: string | null
}

export async function createAmortizationPlan(input: {
  transactionId: string
  months: number
}): Promise<CreateAmortizationPlanResult> {
  // Parse input
  // Verify session
  // Call db.transaction with service function
  // Error handling
  // Revalidate
}
```

**Error handling and result pattern (from `lib/actions/amortization.ts` lines 36-64):
```typescript
try {
  const result = await db.transaction((tx) =>
    activatePlanTx(tx, {
      userId,
      transactionId: parsed.data.transactionId,
      months: parsed.data.months,
    }),
  )
  revalidateCategorizationSurfaces()
  return {
    planId: result.planId,
    expenseId: result.expenseId,
    instalments: result.instalments,
    error: null,
  }
} catch (error) {
  if (error instanceof ActivatePlanError) {
    return { planId: '', expenseId: '', instalments: [], error: error.message }
  }
  return {
    planId: '',
    expenseId: '',
    instalments: [],
    error: 'Si è verificato un errore. Riprova tra qualche secondo.',
  }
}
```

**Validation pattern (from `lib/actions/transaction-edit.ts` lines 13-20):
```typescript
const parsed = UpdateTransactionSchema.safeParse({
  id: formData.get('id'),
  amount: formData.get('amount') || undefined,
  occurredAt: formData.get('occurredAt') || undefined,
  customTitle: formData.has('customTitle') ? formData.get('customTitle') : undefined,
})
if (!parsed.success) {
  return { error: parsed.error.issues[0].message }
}
```

**Session verification pattern (from `lib/actions/amortization.ts` line 36):
```typescript
const { userId } = await verifySession()
```

---

### `lib/actions/transaction-edit.ts` (action, extend)

**Analog:** itself (lines 1-54) — no new file, just error passthrough remains unchanged

**Error passthrough pattern (lines 44-48, essential for D-04 amortization message):
```typescript
} catch (error) {
  // The service's Italian pair-guard/not-found/ownership messages must
  // reach the caller verbatim (DET-03) — this differs from createTransaction's
  // generic catch-all.
  return { error: (error as Error).message }
}
```

No changes needed to action wrapper itself; service-layer error message (from D-04 guard) bubbles verbatim to UI.

---

## Shared Patterns

### Decimal.js Monetary Arithmetic
**Source:** `lib/services/amortization-activation.ts` line 116, `lib/services/amortization-math.ts` lines 97-115
**Apply to:** `closePlanTx`, `realizePlanTx`, `reimbursePlanTx`, all residual calculations

Pattern: Never use native `+`, `-`, `*`, `/` on monetary strings. Always:
```typescript
const amount = toDecimal(stringValue)    // Convert string to Decimal
const result = amount.plus(other)        // Arithmetic
const dbValue = toDbDecimal(result)      // Convert back to DB string
```

### DbOrTx Atomicity Pattern
**Source:** `lib/services/amortization-activation.ts` lines 54-57, entire function
**Apply to:** All lifecycle services (`closePlanTx`, `realizePlanTx`, `reimbursePlanTx`)

Pattern: Every helper that writes must accept `DbOrTx` and never call `db` directly:
```typescript
export async function myHelper(
  tx: DbOrTx,
  input: MyInput,
): Promise<MyResult> {
  // Use tx for all queries, never db
  await tx.select(...).from(...)
}

// Call from action:
await db.transaction((tx) =>
  myHelper(tx, input),
)
```

### Ownership Check Pattern
**Source:** `lib/services/amortization-activation.ts` lines 66-85
**Apply to:** Load plan, load transaction, load consumed instalments

Pattern:
```typescript
const rows = await tx
  .select({...})
  .from(amortizationPlan)
  .where(
    and(
      eq(amortizationPlan.id, input.planId),
      eq(amortizationPlan.userId, input.userId), // ALWAYS scope by userId
    ),
  )
  .limit(1)

const row = rows[0]
if (!row) {
  throw new Error('Pianificazione non trovata.')
}
```

### Italian Error Messages
**Source:** `lib/services/amortization-activation.ts` lines 89, 96
**Apply to:** All service-layer exceptions

Pattern: Italian-language messages thrown from service layer, bubbled verbatim to UI:
```typescript
throw new Error('Pianificazione non trovata.')
throw new Error('Rimuovi ammortamento per modificare l\'importo o la data della transazione.')
throw new Error('Rimborso di €100.00 supera il residuo €90.00 — usa \'chiudi per vendita\'.')
```

### Bulk Insert Pattern
**Source:** `lib/services/amortization-activation.ts` lines 119-129
**Apply to:** Instalment materialization (D-01 closure, D-03 re-spread)

Pattern:
```typescript
await tx.insert(amortizationInstalment).values(
  instalments.map((instalment, index) => ({
    id: randomUUID(),
    userId: input.userId,
    planId: input.planId,
    instalmentNumber: index + 1,
    expenseId: expenseId, // from Standalone Expense
    amount: instalment.amount, // already toDbDecimal from math
    occurredAt: instalment.date,
  })),
)
```

---

## No Analog Found

No files in this phase lack analogs. All new services follow established patterns from Phase 77 (amortization-activation, amortization-math) and v2.8 (reimbursement, transaction-pairs).

---

## Integration Seams

### Schema (lib/db/schema.ts)
**Status:** Additive only — Phase 77 already shipped `amortizationPlan` and `amortizationInstalment` tables with `status` ('open'/'closed') and `totalAmount` columns. Phase 78 may add optional closure columns (closure timestamp, realization link) but does NOT modify existing columns.

**Pattern:** Use `drizzle-kit generate` for any schema delta; never `drizzle-kit push` in production.

### DAL (lib/dal/)
**Status:** No new DAL files. Use direct Drizzle queries inside service layer (amortization-lifecycle.ts):
- `tx.select(...).from(amortizationPlan)`
- `tx.select(...).from(amortizationInstalment)`
- `tx.delete(...).from(amortizationInstalment)` (for collapse/re-spread)
- `tx.update(amortizationPlan).set({...})`

### Reused v2.8 Services
- `createPairTx()` from `lib/services/transaction-pairs.ts` (D-02 sale netting)
- `deriveResidualFromAggregates()` from `lib/services/reimbursement.ts` (D-03 guard)
- `materializeInstalments()` from `lib/services/amortization-math.ts` (D-01 collapse, D-03 re-spread)

### Revalidation
**Pattern (from `lib/actions/amortization.ts` line 46):**
```typescript
revalidateCategorizationSurfaces()
```

Call after every lifecycle write (close, realize, reimburse) so dashboard/filters refresh.

---

## Test Patterns

### Unit Test (Decimal.js Math)
**Source:** `tests/amortization-math.test.ts` lines 1-75

Pattern:
```typescript
import { describe, expect, it } from 'vitest'
import { materializeInstalments } from '@/lib/services/amortization-math'

describe('functionName', () => {
  it('case description', () => {
    const result = materializeInstalments('1000.00', new Date(2026, 7, 14), 3)
    expect(result).toHaveLength(3)
    expect(result[0].amount).toBe('333.34')
  })
})
```

### Regression Test (Real-Postgres, Ledger Entry)
**Source:** `tests/reimbursement-regression.test.ts` lines 1-150

Pattern (real-Postgres setup + aggregation snapshot):
```typescript
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { connectReimbursementTestDb, resetReimbursementFixtures } from './helpers/reimbursement-test-db'
import { seedUser, seedMinimalTaxonomy, seedExpenseWithTransaction } from './fixtures/reimbursement-seed'

const harness = await connectReimbursementTestDb()
const describeIfReachable = harness.ok ? describe : describe.skip

describeIfReachable('lifecycle operations (Phase 78, AMORT-04/05/06)', () => {
  let snapshot: AggregationSnapshot

  beforeAll(async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)
    // Seed users, taxonomy, transactions
    snapshot = await captureAggregationSnapshot({...})
  })

  it('close collapses remaining onto closure month', async () => {
    // Invoke closePlanTx
    // Assert cash lens byte-identical before/after
  })
})
```

---

## Metadata

**Analog search scope:** `lib/services/`, `lib/actions/`, `tests/`
**Files scanned:** 7 primary analogs + 4 secondary (schema, DAL, revalidation)
**Pattern extraction date:** 2026-07-28

**High-confidence matches:**
- amortization-lifecycle.ts → amortization-activation.ts (same multi-write + DbOrTx)
- transaction-edit.ts → itself (extend pair-guard)
- amortization-lifecycle.ts → reimbursement.ts (residual calc)
- amortization-lifecycle.ts → transaction-pairs.ts (netting)
- amortization-lifecycle test → reimbursement-regression.test.ts (real-Postgres pattern)

**Ready for Planning:** All analogs mapped; patterns extracted with concrete line numbers and code excerpts.
