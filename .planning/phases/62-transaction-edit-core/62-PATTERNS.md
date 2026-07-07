# Phase 62: transaction-edit-core — Pattern Map

**Mapped:** 2026-07-05  
**Files analyzed:** 7 new/modified files  
**Analogs found:** 7 / 7 (100%)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/services/transaction-edit.ts` | service | CRUD + atomic-reconciliation | `lib/services/transaction-deletion.ts` | exact |
| `lib/services/expense-edit.ts` | service | CRUD | `lib/services/expense-deletion.ts` | role-match |
| `lib/dal/transaction-edit.ts` | DAL | request-response | `lib/dal/transactions.ts` | role-match |
| `lib/dal/expense-edit.ts` | DAL | request-response | `lib/dal/expenses.ts` | role-match |
| `lib/validations/transaction-edit.ts` | validation | transform | `lib/validations/transactions.ts` | role-match |
| `lib/validations/expense-edit.ts` | validation | transform | `lib/validations/expense.ts` | role-match |
| `lib/actions/transaction-edit.ts` | action (use server) | request-response | `lib/actions/transactions.ts` | exact |

## Pattern Assignments

### `lib/services/transaction-edit.ts` (service, CRUD + atomic-reconciliation)

**Analog:** `lib/services/transaction-deletion.ts`

**Imports pattern** (lines 1-7):
```typescript
import 'server-only'

import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { expense, transaction as transactionTable } from '@/lib/db/schema'
import { reconcileExpensesAfterTransactionRemoval } from '@/lib/services/expense-reconciliation'
```

**Ownership-gated service pattern with DbOrTx** (transaction-pairs.ts lines 48-105):
```typescript
export async function createPair(input: {
  userId: string
  transactionId: string
  counterpartId: string
}): Promise<CreatePairResult> {
  return db.transaction(async (tx): Promise<CreatePairResult> => {
    // 1. Load transaction rows with ownership columns
    const [rowsA, rowsB] = await Promise.all([
      tx
        .select({
          id: transaction.id,
          userId: transaction.userId,
          amount: transaction.amount,
          occurredAt: transaction.occurredAt,
          expenseId: transaction.expenseId,
        })
        .from(transaction)
        .where(eq(transaction.id, input.transactionId))
        .limit(1),
    ])

    // 2. Ownership check — IDOR block
    if (t1.userId !== input.userId) {
      throw new Error('Non sei autorizzato...')
    }
    // 3. Invariant check
    // 4. Mutation
  })
}
```

**Atomic db.transaction pattern with reconciliation** (transaction-deletion.ts lines 27-97):
```typescript
return db.transaction(async (tx) => {
  // Load targets with ownership check
  const targets = await tx
    .select({
      id: transactionTable.id,
      expenseId: transactionTable.expenseId,
    })
    .from(transactionTable)
    .where(
      and(eq(transactionTable.userId, input.userId), inArray(transactionTable.id, uniqueIds)),
    )

  // Delete transactions
  await tx
    .delete(transactionTable)
    .where(
      and(eq(transactionTable.userId, input.userId), inArray(transactionTable.id, idsToDelete)),
    )

  // Reconcile affected expenses in same transaction
  if (affectedExpenseIds.length > 0) {
    await reconcileExpensesAfterTransactionRemoval(tx, {
      userId: input.userId,
      affectedExpenseIds: expenseIdsToReconcile,
    })
  }

  return { deletedTransactionIds: idsToDelete }
})
```

**Pair invariant check pattern** (transaction-pairs.ts lines 108-116):
```typescript
const d1 = toDecimal(t1.amount)
const d2 = toDecimal(t2.amount)
const oppositeSign = (d1.gt(0) && d2.lt(0)) || (d1.lt(0) && d2.gt(0))
if (!oppositeSign) {
  throw new Error('Le transazioni da collegare devono avere segno opposto.')
}
```

**Error handling with Decimal.js** (transaction-deletion.ts + transaction-pairs.ts):
- Wrap entire `db.transaction` callback in try/catch at action layer (lines 58-75 of lib/actions/transactions.ts)
- Throw meaningful Italian error messages for business logic violations (ownership, invariant, not-found)
- Decimal.js comparisons (`gt`, `lt`) never native JS arithmetic

### `lib/services/expense-edit.ts` (service, CRUD)

**Analog:** `lib/services/expense-deletion.ts`

**Core service structure** (expense-deletion.ts pattern):
- Input type defines userId + expenseId + fields to update
- Load expense with ownership check inside `db.transaction(async (tx) => { ... })`
- Verify `userId` matches before any mutation
- Return success indicator + message on error

**No reconciliation on expense edit** — expense aggregates (totalAmount, transactionCount, firstTransactionAt, lastTransactionAt) are never directly writable (DET-04 from REQUIREMENTS.md). They update only via `applyExpenseReconciliation` triggered after transaction amount/date edits.

### `lib/dal/transaction-edit.ts` (DAL, request-response)

**Analog:** `lib/dal/transactions.ts` + `lib/dal/transaction-pairs.ts`

**Update-by-id pattern** (replicating existing query structure in transactions DAL):
- Typed result object for UPDATE...RETURNING query
- Use `and(eq(table.id, id), eq(table.userId, userId))` for ownership gate
- Never return results without ownership validation

**Single transaction read pattern** (transaction-pairs.ts lines 69-91):
```typescript
const [rowsA] = await Promise.all([
  tx
    .select({
      id: transaction.id,
      amount: transaction.amount,
      occurredAt: transaction.occurredAt,
      userId: transaction.userId,
      expenseId: transaction.expenseId,
    })
    .from(transaction)
    .where(eq(transaction.id, input.transactionId))
    .limit(1),
])
const t1 = rowsA[0]
if (!t1) {
  throw new Error('Transazione non trovata.')
}
```

### `lib/dal/expense-edit.ts` (DAL, request-response)

**Analog:** `lib/dal/expenses.ts` — read only, no custom DAL needed

Expense updates can be done directly via Drizzle `.update(expense)` inside the service; there is no separate DAL layer needed. DAL is reserved for complex reads (multiple JOINs, aggregation logic). Single UPDATE statements belong in the service.

### `lib/validations/transaction-edit.ts` (validation, transform)

**Analog:** `lib/validations/transactions.ts`

**Update schema pattern** (transactions.ts lines 26-32):
```typescript
export const UpdateTransactionCustomTitleSchema = z.object({
  id: z.string().uuid(),
  customTitle: z
    .string()
    .max(255)
    .nullable()
    .transform((v) => (v === "" ? null : v ?? null)),
})

export type UpdateTransactionCustomTitleInput = z.infer<typeof UpdateTransactionCustomTitleSchema>
```

**New UpdateTransactionSchema needed:**
- `id`: uuid
- `amount`: string (parsed to Decimal by action, NOT by Zod schema; validated as numeric string)
- `occurredAt`: ISO string (parsed to Date by action; validate format in Zod as string)
- `customTitle`: string | null (nullable, max 255)
- All fields optional (at least one must be present)

**Decimal amount validation pattern** (transactions.ts lines 9-18):
```typescript
amount: z
  .string()
  .min(1, { error: "Importo obbligatorio." })
  .refine(
    (v) => {
      const normalized = v.replace(",", ".")
      return !Number.isNaN(Number(normalized)) && Number.isFinite(Number(normalized))
    },
    { message: "Importo non valido." },
  ),
```

### `lib/validations/expense-edit.ts` (validation, transform)

**Analog:** `lib/validations/expense.ts`

**Update schema pattern** (expense.ts lines 13-15):
```typescript
export const UpdateExpenseSchema = CreateExpenseSchema.extend({
  id: z.string().min(1, { error: 'ID spesa mancante.' }),
})
```

**UpdateExpenseSchema for edit** should cover:
- `id`: required
- `title`: string, 2–500 chars
- `notes`: optional string, max 500 chars
- `subCategoryId`: optional positive integer

All fields optional except `id` (at least one of title/notes/subCategoryId must be present).

### `lib/actions/transaction-edit.ts` (action, use server + request-response)

**Analog:** `lib/actions/transactions.ts`

**Thin action wrapper pattern** (transactions.ts lines 41-77):
```typescript
'use server'
import Decimal from 'decimal.js'
import { verifySession } from '@/lib/dal/auth'
import {
  CreateTransactionSchema,
} from '@/lib/validations/transactions'
import {
  insertManualTransaction,
} from '@/lib/dal/transactions'
import { db } from '@/lib/db'
import { toDbDecimal } from '@/lib/utils/decimal'
import type { ActionState } from '@/lib/validations/expense'
import { revalidateCategorizationSurfaces } from '@/lib/actions/revalidation'

export async function createTransaction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = CreateTransactionSchema.safeParse({
    description: formData.get('description'),
    amount: formData.get('amount'),
    currency: formData.get('currency') || 'EUR',
    occurredAt: formData.get('occurredAt'),
    subCategoryId: formData.get('subCategoryId')
      ? Number(formData.get('subCategoryId'))
      : undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { userId } = await verifySession()
  try {
    const normalizedAmount = toDbDecimal(new Decimal(parsed.data.amount.replace(',', '.')))
    const occurredAt = new Date(parsed.data.occurredAt)
    if (Number.isNaN(occurredAt.getTime())) {
      return { error: 'Data non valida.' }
    }
    await insertManualTransaction({
      userId,
      description: parsed.data.description,
      amount: normalizedAmount,
      currency: parsed.data.currency,
      occurredAt,
      subCategoryId: parsed.data.subCategoryId,
    })
  } catch {
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }
  revalidateCategorizationSurfaces()
  return { error: null }
}
```

**Key steps for updateTransaction action:**
1. Parse FormData with UpdateTransactionSchema
2. Verify session (extract userId)
3. Inside try/catch: call `updateTransactionService` with userId + parsed fields
4. If service throws, return error state (business logic errors from service already have Italian messages)
5. On success, revalidate categorization surfaces (same as delete/create)
6. Return success state

**Decimal.js conversion in action** (not schema):
```typescript
const normalizedAmount = toDbDecimal(new Decimal(parsed.data.amount.replace(',', '.')))
```

---

## Shared Patterns

### Ownership Gate (All Services)
**Source:** `lib/services/transaction-pairs.ts` (lines 101-104)  
**Apply to:** All service functions that mutate

```typescript
if (t1.userId !== input.userId || t2.userId !== input.userId) {
  throw new Error('Non sei autorizzato a collegare queste transazioni.')
}
```

**Guarantee:** Every load-then-mutate operation includes `.where(and(eq(table.userId, input.userId), ...))` in the SELECT. Never trust userId from parsed input after the load.

### Pair Invariant Pre-Check
**Source:** `lib/services/transaction-pairs.ts` (lines 108–116)  
**Apply to:** Transaction edit service before allowing amount mutation

```typescript
const d1 = toDecimal(t1.amount)
const d2 = toDecimal(t2.amount)
const oppositeSign = (d1.gt(0) && d2.lt(0)) || (d1.lt(0) && d2.gt(0))
if (!oppositeSign) {
  throw new Error('Scollega prima il rimborso')
}
```

### Atomic Reconciliation
**Source:** `lib/services/transaction-deletion.ts` (lines 92–96) + `lib/services/expense-reconciliation.ts` (lines 48–190)  
**Apply to:** Transaction amount/date edits

```typescript
// Inside db.transaction(async (tx) => { ... })
const aggregates = await loadAggregatesForExpenses(tx, {
  userId: input.userId,
  expenseIds: [txRow.expenseId],
})
const manualIds = await loadManualOrOverrideExpenseIds(tx, {
  userId: input.userId,
  affectedExpenseIds: [txRow.expenseId],
})
const plan = buildReconcilePlan([txRow.expenseId], aggregates, manualIds)
await applyExpenseReconciliation(tx, plan, input.userId)
```

**Critical:** All three steps (load, plan, apply) must run inside the same `db.transaction` callback. Pass `tx` (not `db`) to reconciliation functions.

### Decimal.js Amount Handling
**Source:** `lib/actions/transactions.ts` (line 59) + `lib/services/transaction-pairs.ts` (lines 111–113)  
**Apply to:** All code paths that read/write monetary amounts

**Reading from DB (string → Decimal):**
```typescript
import { toDecimal } from '@/lib/utils/decimal'
const d1 = toDecimal(t1.amount)
```

**Converting to DB (Decimal → string):**
```typescript
import { toDbDecimal } from '@/lib/utils/decimal'
const newAmount = toDbDecimal(decimalValue)
await db.update(transaction).set({ amount: newAmount })
```

**Never use:** `+`, `-`, `*`, `/` on amount strings or DB values.

### Error Handling in Actions
**Source:** `lib/actions/transactions.ts` (lines 58–76)  
**Apply to:** All action functions

```typescript
export async function updateTransaction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = UpdateTransactionSchema.safeParse({ ... })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { userId } = await verifySession()
  try {
    // Call service
    const result = await updateTransactionService({ ... })
    if (!result.success) {
      return { error: result.message || 'Modifica non riuscita.' }
    }
  } catch {
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }
  revalidateCategorizationSurfaces()
  return { error: null }
}
```

### Revalidation Pattern
**Source:** `lib/actions/transactions.ts` (line 75) + `lib/actions/expenses.ts` (line 100)  
**Apply to:** All edit/delete/create actions

```typescript
import { revalidateCategorizationSurfaces } from '@/lib/actions/revalidation'

// At end of action (before returning success)
revalidateCategorizationSurfaces()
return { error: null }
```

---

## Test Patterns

### Test Framework & Structure
**Source:** `tests/expense-deletion-service.test.ts` (lines 1–63)  
**Apply to:** `tests/transaction-edit.test.ts` and `tests/expense-edit.test.ts`

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  select: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db', () => ({
  db: {
    transaction: mocks.transaction,
  },
}))
vi.mock('@/lib/db/schema', () => ({
  expense: { id: 'expense.id', userId: 'expense.userId' },
  transaction: { id: 'transaction.id', userId: 'transaction.userId' },
}))
vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args) => ({ kind: 'and', args })),
  eq: vi.fn((a, b) => ({ kind: 'eq', a, b })),
}))

describe('updateTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transaction.mockImplementation(async (callback) =>
      callback({ select: mocks.select, delete: mocks.delete })
    )
  })

  it('returns success on valid amount edit', async () => {
    // arrange mocks
    // act
    // assert
  })
})
```

### Mocking db.transaction
**Pattern:** Stub the callback to synchronously return a mock tx object with chained select/update/delete methods.

```typescript
mocks.transaction.mockImplementation(async (callback) =>
  callback({
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([/* rows */]),
  }),
)
```

---

## No Analog Found

No files require fallback to RESEARCH.md patterns. All analogs exist:

| File | Role | Reason |
|------|------|--------|
| — | — | 100% match coverage; all services/actions/validations have close analogs |

---

## Metadata

**Analog search scope:** `/lib/services/`, `/lib/dal/`, `/lib/actions/`, `/lib/validations/`, `/tests/`  
**Files scanned:** 45 source + test files  
**Pattern extraction date:** 2026-07-05  
**Confidence:** HIGH — all analogs are actively used, well-tested code within the same project

## Key Implementation Notes

1. **Pair guard must run BEFORE amount mutation** — Load the pair, check invariant, THEN write the UPDATE. If invariant fails, throw before touching the DB.

2. **Reconciliation must be in the same db.transaction** — No network boundaries between "edit transaction" and "reconcile expense". Pass `tx` (not `db`) to reconciliation functions to ensure atomicity.

3. **Expense edits do NOT trigger reconciliation** — Expense aggregates are read-only from the edit path. They update only via transaction amount/date edits.

4. **Decimal.js is mandatory** — Use `toDecimal()` on read, `toDbDecimal()` on write. Never hand-roll arithmetic.

5. **Italian error messages from services** — Ownership, invariant, and not-found errors should have user-facing Italian text. These propagate through the action's try/catch and return to the form.
