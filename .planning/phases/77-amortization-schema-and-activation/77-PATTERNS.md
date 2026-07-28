# Phase 77: amortization-schema-and-activation - Pattern Map

**Mapped:** 2026-07-28
**Files analyzed:** 11 new/modified files
**Analogs found:** 8 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/db/schema.ts` (amortization tables) | schema | CRUD | `lib/db/schema.ts` (expense, transaction tables) | exact |
| `lib/services/amortization-math.ts` | service | transform | `lib/utils/decimal.ts` | role-match |
| `lib/services/transaction-detach.ts` (reverse path) | service | CRUD | `lib/services/transaction-detach.ts` (existing) | exact |
| `lib/dal/ledger-entry.ts` | DAL | request-response | `lib/dal/transaction-pairs-sql.ts` | role-match |
| `lib/actions/amortization.ts` | action | CRUD | `lib/actions/transactions.ts` | role-match |
| `lib/actions/transactions.ts` (modify createTransaction D-10) | action | CRUD | `lib/actions/transactions.ts` (existing) | exact |
| `app/(app)/transactions/` (activation dialog + UI) | component | request-response | `app/(app)/transactions/` (existing dialogs) | role-match |
| `tests/amortization-math.test.ts` | test | unit | `tests/reimbursement-regression.test.ts` | role-match |
| `tests/amortization-activation.test.ts` | test | integration | `tests/reimbursement-regression.test.ts` | role-match |
| `tests/reimbursement-regression.test.ts` (extend LENS-03) | test | regression | `tests/reimbursement-regression.test.ts` (existing) | exact |
| `drizzle/migrations/NNNN_amortization_schema.sql` | migration | schema | `drizzle/migrations/` (existing patterns) | role-match |

---

## Pattern Assignments

### `lib/db/schema.ts` — amortization_plan + amortization_instalment Tables

**Analog:** `lib/db/schema.ts` (expense table lines 380–415, transaction table lines 417–445)

**Table definition pattern** (expense, lines 380–415):
```typescript
export const expense = pgTable(
  "expense",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    subCategoryId: integer("sub_category_id").references(() => subCategory.id, {
      onDelete: "set null",
    }),
    descriptionHash: varchar("description_hash", { length: 64 }).notNull(),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
    transactionCount: integer("transaction_count"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("expense_userId_idx").on(table.userId),
    index("expense_userId_status_idx").on(table.userId, table.status),
    unique("expense_userId_descriptionHash_unique").on(table.userId, table.descriptionHash),
  ],
);
```

**Apply this pattern to amortization_plan:**
- Text PK with `crypto.randomUUID()`
- User FK with `onDelete: "cascade"`
- Transaction FK with `onDelete: "cascade"` (for D-05 uniqueness)
- Timestamp columns (createdAt, updatedAt) with `.defaultNow()` and `.$onUpdate()`
- NUMERIC(12,2) for totalAmount (stored as string)
- Index on (userId) for all queries
- Index on (userId, status) for open/closed plan queries
- UNIQUE(transactionId) constraint for D-05 (one plan per transaction)

**FK conventions** (from transaction table, lines 417–445):
```typescript
export const transaction = pgTable(
  "transaction",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expenseId: text("expense_id").references(() => expense.id, { onDelete: "set null" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("transaction_userId_idx").on(table.userId),
    index("transaction_userId_occurredAt_idx").on(table.userId, table.occurredAt),
    unique("transaction_userId_transactionHash_unique").on(table.userId, table.transactionHash),
  ],
);
```

**Apply to amortization_instalment:**
- Text PK with `crypto.randomUUID()`
- User FK (for aggregation filtering)
- Plan FK (on deletion: cascade to clean up all instalments when plan is deleted)
- Expense FK (points to the standalone Expense created by detach)
- NUMERIC(12,2) for amount
- Timestamp for occurred_at (instalment date)
- Index on (userId) for user scoping
- Index on (plan_id) for plan lookups
- Index on (expense_id) for ledger_entry seam joins
- Index on (userId, occurred_at) for date-scoped aggregations
- UNIQUE(plan_id, instalment_number) to prevent duplicates within a plan

---

### `lib/utils/decimal.ts` — Instalment Materialisation Math

**Analog:** `lib/utils/decimal.ts` (Decimal.js helpers)

**Existing pattern** (lines 1–18):
```typescript
import Decimal from 'decimal.js'

/**
 * Parse a DB DECIMAL string or JS number to a Decimal instance.
 * Use this whenever reading an amount from the database (Drizzle returns DECIMAL as string).
 */
export function toDecimal(value: string | number): Decimal {
  return new Decimal(value)
}

/**
 * Convert a Decimal to a string suitable for DB insertion into a DECIMAL(10,2) column.
 * Never insert raw JS numbers — always use toDbDecimal() before writing amounts.
 */
export function toDbDecimal(value: Decimal): string {
  return value.toFixed(2)
}
```

**Create** `lib/services/amortization-math.ts` **with the following pattern:**
- Import `Decimal` and `toDecimal`, `toDbDecimal` from `@/lib/utils/decimal`
- All division uses `.dividedBy().toDecimalPlaces(2, Decimal.ROUND_DOWN)` (never native `/`)
- Remainder calculation via `.minus()` and `.times()`
- Day-clamp logic: compute target date, check if day exceeds last day of month, clamp via `setDate()`
- Export `validateMonthsForAmount(amount, months)` for D-07 validation
- Export `materializeInstalments(amount, date, months)` returning array of `{ date: Date; amount: string }`
- All returned amounts use `toDbDecimal()` for DB insertion

---

### `lib/services/transaction-detach.ts` — Reverse-Detach Path (D-09)

**Analog:** `lib/services/transaction-detach.ts` (applyDetachCleanupTx, lines 52–153)

**Existing pattern** (lines 52–80):
```typescript
export async function applyDetachCleanupTx(
  tx: DbOrTx,
  input: DetachCleanupInput,
): Promise<DetachTransactionResult> {
  const trimmedTitle = input.title.trim()
  if (!trimmedTitle) {
    throw new DetachTransactionError('TRANSACTION_NOT_FOUND', 'Titolo spesa obbligatorio.')
  }

  const rows = await tx
    .select({
      transactionId: transactionTable.id,
      transactionUserId: transactionTable.userId,
      transactionAmount: transactionTable.amount,
      transactionOccurredAt: transactionTable.occurredAt,
      expenseId: transactionTable.expenseId,
      expenseUserId: expense.userId,
      expenseTransactionCount: expense.transactionCount,
    })
    .from(transactionTable)
    .innerJoin(expense, eq(transactionTable.expenseId, expense.id))
    .where(
      and(
        eq(transactionTable.id, input.transactionId),
        eq(transactionTable.userId, input.userId),
        eq(expense.userId, input.userId),
      ),
    )
    .limit(1)
  // ... error checks and multi-write logic
}
```

**Add reverse-detach function using this pattern:**
- `tx: DbOrTx` parameter (tx-aware, composable in larger transaction)
- Fetch transaction via `transactionTable` query with ownership checks
- Use `computeDescriptionHash(transaction.description)` to recompute original hash
- Query for existing Expense by (userId, originalDescriptionHash)
- If not found, create new shared Expense row with:
  - Synthetic ID via `crypto.randomUUID()`
  - transaction.description as title
  - originalDescriptionHash
  - status '1' (uncategorized)
  - transactionCount: 1
  - firstTransactionAt / lastTransactionAt from transaction
  - totalAmount from transaction
- Update transaction.expenseId to re-attach
- Call `reconcileExpensesAfterTransactionRemoval()` to clean up the standalone Expense
- Wrap in `db.transaction()` at call site (see actions pattern below)

**Import pattern:**
```typescript
import { createHash } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { expense, transaction as transactionTable } from '@/lib/db/schema'
import { computeDescriptionHash } from '@/lib/utils/import'
import { toDbDecimal, toDecimal } from '@/lib/utils/decimal'
```

---

### `lib/dal/transaction-pairs-sql.ts` — Fragment Pair (Baseline for Ledger Seam)

**Analog:** `lib/dal/transaction-pairs-sql.ts` (effectiveAmount, isNotSecondary)

**Existing fragment pattern** (lines 22–27, 86–174):
```typescript
export function isNotSecondary() {
  return sql`NOT EXISTS (
    SELECT 1 FROM reimbursement_refund rr
    WHERE rr.transaction_id = ${transactionTable.id}
  )`
}

export function effectiveAmount() {
  return sql`(
    ${transactionTable.amount}::numeric + COALESCE((
      WITH anchor AS (
        SELECT r.id AS reimbursement_id, r.expense_id, r.expense_group_id
        FROM reimbursement r
        WHERE r.expense_id = ${transactionTable.expenseId}
           OR r.expense_group_id = (
             SELECT egm.group_id FROM expense_group_membership egm
             WHERE egm.expense_id = ${transactionTable.expenseId}
           )
        LIMIT 1
      ),
      -- ... CTEs for member resolution and share calculation
    ), 0)
  )`
}
```

**These fragments MUST be used together** (per RESEARCH.md Pitfalls 1 & 2):
- Never call `effectiveAmount()` without `isNotSecondary()` in the WHERE clause
- Never call `isNotSecondary()` without `effectiveAmount()` in SELECT

**The D-11 seam work collapses this pair** into a single `ledger_entry` row source so aggregations no longer need to apply both fragments separately.

---

### `lib/dal/ledger-entry.ts` — New Seam (D-11)

**Analog:** `lib/dal/transaction-pairs-sql.ts` (fragment structure and composition pattern)

**Create a new file** `lib/dal/ledger-entry.ts` **with:**

**Import pattern:**
```typescript
import 'server-only'
import { sql } from 'drizzle-orm'
import { transaction as transactionTable } from '@/lib/db/schema'
import { amortizationInstalment } from '@/lib/db/schema'  // NEW table
```

**Core seam shape** (conceptual SQL):
```sql
-- Cash lens: raw transactions (excludes amortization instalments)
SELECT
  t.id,
  t.user_id,
  t.occurred_at,
  t.expense_id,
  ${effectiveAmount()} AS amount,
  'transaction' AS source_type
FROM transaction t
WHERE NOT EXISTS (
  SELECT 1 FROM reimbursement_refund rr
  WHERE rr.transaction_id = t.id
)

-- (Future accrual lens adds UNION ALL with instalment rows)
```

**Design decision (deferred to plan-phase, RESEARCH.md §569–576):**
- **For Phase 77:** Plain Postgres VIEW (simpler, fresh reads, no refresh logic)
- **For Phase 80+:** Consider materialized VIEW if query planning shows performance issues

**Call sites affected (~16 total, per RESEARCH.md §543–556):**
- `lib/dal/dashboard.ts`: `getOverviewAmountTotals` (lines 458–499), `getUncategorizedCount`, category breakdown
- `lib/dal/overview.ts`: chart-point queries, movers/deviations
- Every call site currently uses `effectiveAmount()` + `isNotSecondary()` pair
- Rewrite to: `SELECT SUM(ledger.amount) FROM ledger_entry ledger WHERE ledger.user_id = $1 AND ledger.occurred_at BETWEEN $2 AND $3`

**Duplicate extraction (RESEARCH.md §578–583):**
Both `dashboard.ts` and `overview.ts` define private functions:
- `dateScopedTransactions(userId, from, to)` — date range WHERE clause
- `expenseStatusIncludedInDashboardTotals()` — status filter

Extract these to a shared module (e.g., `lib/dal/dashboard-filters.ts`) and import in both.

---

### `lib/dal/dashboard.ts` — Aggregation Call Sites (Sample)

**Analog:** `lib/dal/dashboard.ts` (getOverviewAmountTotals, lines 458–510)

**Current usage pattern** (lines 462–496):
```typescript
export async function getOverviewAmountTotals(userId: string, from: Date, to: Date): Promise<OverviewAggregateRow> {
  try {
    const rows = await db
      .select({
        totalIn: sql<string>`coalesce(sum(case when ${direction.code} = 'in' then ${effectiveAmount()} else 0 end), 0)::text`,
        totalOut: sql<string>`coalesce(abs(sum(case when ${direction.code} = 'out' then ${effectiveAmount()} else 0 end)), 0)::text`,
        // ... more aggregations using effectiveAmount()
      })
      .from(transactionTable)
      .innerJoin(expense, eq(transactionTable.expenseId, expense.id))
      .leftJoin(...)
      .where(
        and(
          dateScopedTransactions(userId, from, to),
          expenseStatusIncludedInDashboardTotals(),
          ne(direction.code, 'transfer'),
          isNotSecondary()  // <-- Fragment pair usage
        )
      )
    return rows[0] ?? { totalIn: ZERO_AMOUNT, ... }
  } catch {
    return { totalIn: ZERO_AMOUNT, ... }
  }
}
```

**Replace with ledger_entry pattern** (once seam lands):
- Join `ledger_entry` instead of `transaction`
- Read `ledger.amount` instead of `effectiveAmount()`
- Remove `isNotSecondary()` from WHERE (seam handles it)
- Keep date scoping, status filtering, direction/nature logic

---

### `lib/actions/amortization.ts` — Plan Activation Action (NEW)

**Analog:** `lib/actions/transactions.ts` (createTransaction, lines 41–77)

**Server Action pattern** (from transactions.ts):
```typescript
'use server'
import Decimal from 'decimal.js'
import { verifySession } from '@/lib/dal/auth'
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
    occurredAt: formData.get('occurredAt'),
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
      occurredAt,
    })
  } catch {
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }
  revalidateCategorizationSurfaces()
  return { error: null }
}
```

**Create `lib/actions/amortization.ts` **with**:**
- `'use server'` directive
- `verifySession()` call to get userId
- Zod schema for input validation (months: number, transactionId: string)
- **Atomic `db.transaction()`** wrapping:
  1. Load transaction (ownership check)
  2. Run eligibility guards (D-04 through D-08)
  3. Call `applyDetachCleanupTx()` for detach
  4. Insert plan row
  5. Materialize instalments (via `lib/services/amortization-math.ts`)
  6. Batch insert instalment rows
- Return `{ error: null, planId: string, instalments: [...] }` or `{ error: string }`
- Call `revalidateCategorizationSurfaces()` on success
- Error handling via try/catch with user-facing Italian messages

**Remove-amortization action (D-09):**
- Similar pattern: `verifySession()` → `db.transaction()` → load plan → reverse-detach → delete instalments + plan → `revalidateCategorizationSurfaces()`

---

### `lib/actions/transactions.ts` — Extend createTransaction for D-10

**Analog:** `lib/actions/transactions.ts` (createTransaction, lines 41–77)

**Current signature:**
```typescript
export async function createTransaction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState>
```

**Extend to support inline amortization (D-10):**
- Add form fields: `amortizationEnabled` (checkbox), `amortizationMonths` (number)
- Parse both into the schema validation
- After `insertManualTransaction()` succeeds, check if `amortizationEnabled === true`
- If yes: call the same activation flow atomically (detach + plan + instalments) inside a **new** `db.transaction()` wrapper
- Return preview of materialised instalments in response (or empty array if not amortizing)
- Error handling mirrors existing pattern

**All three entry points (row action / detail page / manual entry) reuse the same preview computation** (materializeInstalments function).

---

### `app/(app)/transactions/` — UI Components (Dialogs & Actions)

**Analog:** Existing transaction row actions and detail page dialogs (TransactionsToolbar.tsx, [id]/page.tsx)

**Row action pattern:**
- Button in `TransactionsToolbar.tsx` that opens a dialog
- Dialog calls a Server Action on confirm
- Checks eligibility guards before enabling/showing the button (D-08)

**Detail page pattern:**
- Action button in transaction detail layout
- Opens same dialog as row action
- Reuses preview computation (same instalment math)

**Dialog component:**
- Preview shows table: instalment #, date, amount
- Input for months (with validation D-02: min 2, max = amount in cents)
- Confirm button submits to Server Action
- Cancel button closes without side effects

**Remove-amortization action:**
- Row action + detail page button labeled "Rimuovi ammortamento"
- Confirmation dialog (are you sure?)
- Calls reverse-detach Server Action on confirm
- Revalidates dashboard on success

---

### `tests/reimbursement-regression.test.ts` — Extend LENS-03 Gate

**Analog:** `tests/reimbursement-regression.test.ts` (structure, lines 1–200+)

**Existing seeding pattern** (lines 91–148):
```typescript
describeIfReachable('reimbursement N=1 regression (Phase 73, ADR 0018 D-07)', () => {
  let snapshot: AggregationSnapshot
  let essentialCategoryId: number

  beforeAll(async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    vi.mocked(verifySession).mockResolvedValue({ userId } as never)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    essentialCategoryId = taxonomy.essentialCategoryId

    // Seed transaction + reimbursement
    const { expenseId, transactionId } = await seedExpenseWithTransaction(db, { ... })
    await seedReimbursement(db, { ... })

    // Capture baseline snapshot
    snapshot = await captureAggregationSnapshot({ harnessDb: db, userId, ... })
  })

  it('getOverviewAmountTotals: totalOut nets the refund', () => {
    const totals = snapshot.getOverviewAmountTotals as { totalOut: string }
    expect(toDecimal(totals.totalOut).equals(toDecimal('50.00'))).toBe(true)
  })
  // ... more assertions
})
```

**Extend this suite for LENS-03 (Phase 77 amortization):**
- **Add new describe block** after existing reimbursement tests
- Seed: user → taxonomy → outflow transaction → amortization plan + instalments
- Seed: corresponding Expenses for each instalment (already created by detach)
- Capture **two snapshots:**
  1. **Cash lens:** Query aggregations as-is (ledger_entry with source_type='transaction')
  2. **Accrual lens:** Query aggregations including instalments (ledger_entry with no source_type filter)
- **Assertion: cash lens byte-identical to baseline** (no amortization data changes cash totals)
- **Assertion: accrual lens includes instalments** (future work, Phase 80, can be placeholder)

**Test seeding helpers needed:**
- `seedAmortizationPlan(db, { userId, transactionId, months, ...}): Promise<{ planId: string; instalments: [...] }>`
- Use existing `seedExpenseWithTransaction()` to create the outflow
- Call `materializeInstalments()` directly to compute dates/amounts
- Insert plan row + instalment rows

**Regression gate enforcement (D-12):**
- This test suite gates Phase 77 merge (per CONTEXT.md D-12, RESEARCH.md §794)
- Run with: `vitest run tests/reimbursement-regression.test.ts`
- **All existing assertions must remain green** (byte-identical baseline)
- **New assertions must verify instalments appear in accrual lens only**

---

### `drizzle/migrations/NNNN_amortization_schema.sql` — Schema Migration

**Analog:** Existing migrations in `drizzle/migrations/` (created via `drizzle-kit generate`)

**Generation workflow:**
```bash
# 1. Define tables in lib/db/schema.ts (amortization_plan, amortization_instalment)
# 2. Run drizzle-kit to generate migration
drizzle-kit generate

# 3. Review generated SQL in drizzle/migrations/NNNN_amortization_schema.sql
# 4. Run migration on dev
yarn db:migrate

# 5. Run seed (if needed — amortization has no baseline seed)
yarn db:seed

# 6. Run regression gate
yarn vitest run tests/reimbursement-regression.test.ts
```

**Migration structure** (never hand-edited, drizzle-kit generates):
- CREATE TABLE amortization_plan (...)
- CREATE TABLE amortization_instalment (...)
- CREATE INDEXes as defined in schema.ts
- CREATE UNIQUEness constraints

**No post-migration backfill needed** (new tables, no data transformation).

---

## Shared Patterns

### Decimal.js Usage (All Monetary Operations)

**Source:** `lib/utils/decimal.ts`

**Apply to:** All services, actions, tests that compute or compare money

```typescript
import Decimal from 'decimal.js'
import { toDecimal, toDbDecimal } from '@/lib/utils/decimal'

// Read from DB: always parse as Decimal
const amount = toDecimal(row.amount)  // row.amount is string (DECIMAL from Drizzle)

// Compute: use Decimal methods, never native arithmetic
const baseInstalment = total.dividedBy(months).toDecimalPlaces(2, Decimal.ROUND_DOWN)
const remainder = total.minus(baseInstalment.times(months))

// Write to DB: always convert back to string
await db.insert(...).values({ amount: toDbDecimal(result) })
```

### Atomic Multi-Write Transactions

**Source:** `lib/services/transaction-detach.ts` (applyDetachCleanupTx pattern) + `lib/actions/transactions.ts`

**Apply to:** All write operations spanning multiple tables (D-03, D-09, D-10)

```typescript
// In action (lib/actions/amortization.ts):
export async function activateAmortization(input) {
  const { userId } = await verifySession()
  try {
    return await db.transaction(async (tx) => {
      // 1. Load & validate
      const txRow = await tx.select(...).from(transactionTable).where(...)
      if (!txRow[0]) throw new Error('Transaction not found')

      // 2. Check guards
      const reimbursementInvolved = await isInvolvedInReimbursement(tx, input)
      if (reimbursementInvolved) throw new Error('Cannot amortize reimbursed transaction')

      // 3. Detach (uses tx, composable)
      await applyDetachCleanupTx(tx, { userId, transactionId: input.transactionId, ... })

      // 4. Create plan
      const planId = crypto.randomUUID()
      await tx.insert(amortizationPlan).values({ id: planId, userId, ... })

      // 5. Materialize + insert instalments
      const instalments = materializeInstalments(...)
      await tx.insert(amortizationInstalment).values(instalments.map(inst => ({ ... })))

      return { planId }
    })
  } catch (err) {
    return { error: err.message }
  }
}
```

### Server Action Error Handling

**Source:** `lib/actions/transactions.ts` (createTransaction, lines 41–77)

**Apply to:** All actions (activation, removal, D-10 inline)

```typescript
'use server'
import { verifySession } from '@/lib/dal/auth'
import type { ActionState } from '@/lib/validations/expense'

export async function myAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = MySchema.safeParse({ /* from formData */ })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }
  const { userId } = await verifySession()
  try {
    // do work
    await db.transaction(async (tx) => { ... })
  } catch {
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }
  revalidateCategorizationSurfaces()
  return { error: null }
}
```

### Eligibility Guards (D-04 through D-08)

**Source:** RESEARCH.md §380–496 (guard predicates)

**Apply to:** All entry points (row action, detail page, manual entry) before showing dialog or action button

```typescript
// In DAL or services (lib/dal/amortization-guards.ts or lib/services/amortization-guards.ts):

async function isInvolvedInReimbursement(tx: DbOrTx, userId: string, transactionId: string): Promise<boolean> {
  // Check if transaction is a refund secondary
  const asRefund = await tx.select({ id: reimbursementRefund.id })
    .from(reimbursementRefund)
    .innerJoin(reimbursement, eq(reimbursementRefund.reimbursementId, reimbursement.id))
    .where(and(eq(reimbursement.userId, userId), eq(reimbursementRefund.transactionId, transactionId)))
    .limit(1)
  if (asRefund[0]) return true

  // Check if transaction's Expense is an anchor
  const txExpense = await tx.select({ expenseId: transactionTable.expenseId })
    .from(transactionTable).where(eq(transactionTable.id, transactionId)).limit(1)
  if (!txExpense[0]?.expenseId) return false

  const asAnchor = await tx.select({ id: reimbursement.id })
    .from(reimbursement)
    .where(and(eq(reimbursement.userId, userId), eq(reimbursement.expenseId, txExpense[0].expenseId)))
    .limit(1)
  return !!asAnchor[0]
}

async function hasActivePlan(tx: DbOrTx, transactionId: string): Promise<boolean> {
  const plan = await tx.select({ id: amortizationPlan.id })
    .from(amortizationPlan)
    .where(eq(amortizationPlan.transactionId, transactionId))
    .limit(1)
  return !!plan[0]
}
```

### Validation (Zod Schemas)

**Source:** `lib/actions/transactions.ts` (CreateTransactionSchema in lib/validations/transactions.ts)

**Apply to:** All inputs (createAmortization, removeAmortization, D-10 extension)

```typescript
import { z } from 'zod'

export const CreateAmortizationSchema = z.object({
  transactionId: z.string().min(1, 'Transaction ID required'),
  months: z.number().int().min(2, 'Minimum 2 months').max(99999, 'Too many months'),
})

export const RemoveAmortizationSchema = z.object({
  planId: z.string().min(1, 'Plan ID required'),
})
```

### Date Handling (Day Clamp)

**Source:** `lib/services/amortization-math.ts` (instalment date computation)

**Apply to:** Instalment materialisation — never let dates drift into wrong month

```typescript
function clampDateToMonthEnd(date: Date): Date {
  const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  if (date.getDate() > lastDayOfMonth.getDate()) {
    date.setDate(lastDayOfMonth.getDate())
  }
  return date
}

// For 31/1 → Feb:
const instDate = new Date(2026, 1, 31)  // JS months 0-indexed, this becomes 3/3/2026
const lastDay = new Date(2026, 2, 0)    // Last day of Feb 2026 = 28th
if (instDate.getDate() > lastDay.getDate()) {
  instDate.setDate(lastDay.getDate())   // Clamp to 28
}
```

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/dal/ledger-entry.ts` (seam itself) | DAL | request-response | Seam is new abstraction; relies on transaction-pairs-sql.ts fragment pair structure but has no direct analog |
| `app/(app)/transactions/` amortization dialog | component | request-response | Dialog is new UI; pattern exists in other dialogs but amortization-specific preview logic is novel |
| `tests/amortization-math.test.ts` | test | unit | Math tests are new; regressio-regression.test.ts is integration-level, not unit-level instalment math |

---

## Metadata

**Analog search scope:** `lib/db/`, `lib/utils/`, `lib/services/`, `lib/dal/`, `lib/actions/`, `app/(app)/transactions/`, `tests/`, `drizzle/migrations/`

**Files scanned:** 11 source analogs + 1 test harness

**Pattern extraction date:** 2026-07-28

**Key findings:**
1. Decimal.js is the mandatory money library (project hard rule) — all amortization math must use it
2. Transaction detach is fully reusable pattern from v2.8; reverse path must recompute original descriptionHash from transaction.description
3. Fragment pair (effectiveAmount + isNotSecondary) must stay coupled; D-11 seam work will collapse them into one row source
4. Regression gate (LENS-03) is the acceptance criterion — all aggregations must read from ledger_entry seam and preserve byte-identical cash-lens totals
5. Atomicity is non-negotiable — all multi-write flows (D-03, D-09, D-10) must run inside `db.transaction()`
