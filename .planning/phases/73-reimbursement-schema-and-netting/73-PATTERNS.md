# Phase 73: reimbursement-schema-and-netting - Pattern Map

**Mapped:** 2026-07-23
**Files analyzed:** 12 (schema, migrations, DAL, services, actions, validations, tests)
**Analogs found:** 11 / 12

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `lib/db/schema.ts` (add reimbursement + reimbursement_refund) | config/schema | CRUD | `lib/db/schema.ts` (transaction_pair + transaction_tag pattern) | exact |
| `drizzle/migrations/00XX_reimbursement_1n.sql` | migration | batch/transform | `drizzle/migrations/0022_wonderful_eternals.sql` | exact |
| `lib/dal/transaction-pairs-sql.ts` (refactor effectiveAmount/isNotSecondary) | utility | CRUD/transform | `lib/dal/transaction-pairs-sql.ts` (lines 19–53) | exact |
| `lib/dal/transactions.ts` (refactor paired-* fields) | DAL | CRUD | `lib/dal/transactions.ts` (lines 108–162, correlated subqueries) | exact |
| `lib/services/transaction-edit.ts` (refactor pair guard) | service | CRUD | `lib/services/transaction-edit.ts` (lines 71–106, pair validation) | exact |
| `lib/dal/dashboard.ts` (update effectiveAmount/isNotSecondary calls) | DAL | CRUD | `lib/dal/dashboard.ts` (aggregation queries using sql fragments) | exact |
| `lib/dal/overview.ts` (update calls) | DAL | CRUD | `lib/dal/overview.ts` (sql + isNotSecondary usage) | exact |
| `lib/dal/tags.ts` (update calls) | DAL | CRUD | `lib/dal/tags.ts` (getTotalByTag + getTagDetail) | exact |
| `lib/services/transaction-pairs.ts` (or reimbursement-pairs.ts) | service | CRUD+transaction | `lib/services/transaction-pairs.ts` (createPair + deletePairByTransactionId) | exact |
| `lib/actions/transaction-pairs.ts` (or reimbursement-pairs.ts) | action | request-response | `lib/actions/transaction-pairs.ts` (createTransactionPairAction pattern) | exact |
| `lib/validations/transaction-pairs.ts` (or reimbursement-pairs.ts) | utility | validation | `lib/validations/transaction-pairs.ts` (Zod schemas) | exact |
| `tests/reimbursement-invariant.test.ts` (NEW) | test | testing | `tests/dashboard-dal.test.ts` (Vitest mocking + describe/it structure) | role-match |
| `tests/reimbursement-regression.test.ts` (NEW) | test | testing | `tests/dashboard-dal.test.ts` (Vitest mocking + hoisted mocks) | role-match |

---

## Pattern Assignments

### `lib/db/schema.ts` — Schema Definition (config, CRUD)

**Analog:** `lib/db/schema.ts` itself — transaction_pair pattern (lines 450–472) and transaction_tag join-table pattern (lines 558–575)

**Transaction_pair table structure** (lines 450–472):
```typescript
export const transactionPair = pgTable(
  "transaction_pair",
  {
    id: serial("id").primaryKey(),
    transactionAId: text("transaction_a_id")
      .notNull()
      .references(() => transaction.id, { onDelete: "cascade" }),
    transactionBId: text("transaction_b_id")
      .notNull()
      .references(() => transaction.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("transaction_pair_a_unique").on(table.transactionAId),
    unique("transaction_pair_b_unique").on(table.transactionBId),
    index("transaction_pair_a_idx").on(table.transactionAId),
    index("transaction_pair_b_idx").on(table.transactionBId),
  ],
);
```

**Transaction_tag join-table pattern** (lines 558–575) — model for N:M FK cardinality:
```typescript
export const transactionTag = pgTable(
  "transaction_tag",
  {
    id: serial("id").primaryKey(),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transaction.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("transaction_tag_tagId_transactionId_unique").on(table.tagId, table.transactionId),
    index("transaction_tag_tagId_idx").on(table.tagId),
    index("transaction_tag_transactionId_idx").on(table.transactionId),
  ],
);
```

**Key pattern elements for reimbursement + reimbursement_refund:**
- Use `serial("id").primaryKey()` for join-table PK (match transaction_tag pattern)
- Use `.notNull().references(() => ..., { onDelete: "cascade" })` for FKs (match pattern)
- Composite unique on (reimbursementId, transactionId) to prevent duplicate refunds
- Indexes on both reimbursementId and transactionId for JOIN performance
- `createdAt` audit field with `.defaultNow().notNull()` (match pattern)
- XOR constraint on `reimbursement(expenseId, expenseGroupId)` is a CHECK — implement at schema level or note for service-layer enforcement per D-03

**Expense and ExpenseGroup structure** (for anchor FKs):
- Expense (lines 379–414): id (text PK), userId (FK, not null), title (text)
- ExpenseGroup (lines 478–499): id (serial PK), userId (FK, not null), title (text)
- Pattern: `expenseId: text("expense_id").references(() => expense.id, { onDelete: "cascade" })` — reimbursement will use this pattern for both expenseId and expenseGroupId (nullable)

---

### `drizzle/migrations/00XX_reimbursement_1n.sql` — Migration (batch, transform)

**Analog:** `drizzle/migrations/0022_wonderful_eternals.sql` (lines 1–42) — backfill pattern with UPDATE then ALTER SET NOT NULL

**Backfill precedent** (UPDATE from source table):
```sql
UPDATE "import_format_version" ifv
SET
  "delimiter"                = p."delimiter",
  "description_column"       = p."description_column",
  -- ... more columns ...
FROM "platform" p
WHERE ifv."platform_id" = p."id";
```

**Then ALTERs to enforce NOT NULL** (lines 21–30):
```sql
ALTER TABLE "import_format_version" ALTER COLUMN "delimiter" SET NOT NULL;
ALTER TABLE "import_format_version" ALTER COLUMN "description_column" SET NOT NULL;
-- ... etc for each column ...
```

**For Phase 73 migration, expected structure:**
1. CREATE TABLE reimbursement (id, userId inferred from FK, title, expenseId nullable, expenseGroupId nullable, createdAt)
2. CREATE TABLE reimbursement_refund (id, reimbursementId FK, transactionId FK, createdAt)
3. BACKFILL INSERT INTO reimbursement ... SELECT (primary.expenseId, primary.createdAt) FROM transaction_pair tp INNER JOIN transaction t_primary ON t_primary.id = tp.transaction_a_id
4. BACKFILL INSERT INTO reimbursement_refund ... SELECT (r.id, tp.transaction_b_id) FROM reimbursement r INNER JOIN transaction_pair tp ON ...
5. Optional: DROP TABLE transaction_pair or mark it deprecated (decision per Claude's Discretion in CONTEXT.md)

**Pattern rule:** Drizzle migrations use pure SQL; the backfill count is typically logged by `scripts/migrate.ts` — no TypeScript backfill logic inside schema generation.

---

### `lib/dal/transaction-pairs-sql.ts` — SQL Fragments (utility, CRUD/transform)

**Analog:** `lib/dal/transaction-pairs-sql.ts` (full file, lines 1–53)

**Current isNotSecondary implementation** (lines 19–24):
```typescript
export function isNotSecondary() {
  return sql`NOT EXISTS (
    SELECT 1 FROM transaction_pair tp
    WHERE tp.transaction_b_id = ${transactionTable.id}
  )`
}
```

**Refactored for 1:N — exclude all refunds**:
```typescript
export function isNotSecondary() {
  return sql`NOT EXISTS (
    SELECT 1 FROM reimbursement_refund rr
    WHERE rr.transaction_id = ${transactionTable.id}
  )`
}
```

**Current effectiveAmount implementation** (lines 38–53):
```typescript
export function effectiveAmount() {
  return sql`(
    CASE
      WHEN EXISTS (
        SELECT 1 FROM transaction_pair tp WHERE tp.transaction_a_id = ${transactionTable.id}
      )
      THEN ${transactionTable.amount}::numeric + (
        SELECT t2.amount::numeric
        FROM transaction_pair tp2
        INNER JOIN transaction t2 ON t2.id = tp2.transaction_b_id
        WHERE tp2.transaction_a_id = ${transactionTable.id}
      )
      ELSE ${transactionTable.amount}::numeric
    END
  )`
}
```

**Refactored for 1:N — compute net against refund set** (pseudocode; exact implementation per planner):
```typescript
export function effectiveAmount() {
  return sql`(
    CASE
      WHEN EXISTS (
        SELECT 1 FROM reimbursement r
        INNER JOIN transaction t_anchor ON (
          (r.expense_id IS NOT NULL AND t_anchor.expense_id = r.expense_id) OR
          (r.expense_group_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM expense_group_membership egm
            WHERE egm.expense_id = t_anchor.expense_id AND egm.group_id = r.expense_group_id
          ))
        )
        WHERE t_anchor.id = ${transactionTable.id}
      )
      THEN ${transactionTable.amount}::numeric + COALESCE(
        (SELECT SUM(t_refund.amount::numeric)
         FROM reimbursement r
         INNER JOIN reimbursement_refund rr ON rr.reimbursement_id = r.id
         INNER JOIN transaction t_refund ON t_refund.id = rr.transaction_id
         WHERE r.expense_id = (SELECT expense_id FROM transaction WHERE id = ${transactionTable.id})
           OR EXISTS (SELECT 1 FROM expense_group_membership WHERE expense_id = (SELECT expense_id FROM transaction WHERE id = ${transactionTable.id}))
        ),
        0
      )
      ELSE ${transactionTable.amount}::numeric
    END
  )`
}
```

**Key pattern rule:** Both functions are tightly coupled — any aggregation query using one MUST use the other. Add a code comment at the call site: `// Always use isNotSecondary() alongside effectiveAmount()` (per RESEARCH.md Pitfall 1–2).

---

### `lib/dal/transactions.ts` — Paired-* Correlated Subqueries (DAL, CRUD)

**Analog:** `lib/dal/transactions.ts` (lines 108–162) — 5 correlated subqueries with `LIMIT 1`

**Current pairedWithId** (lines 108–117):
```typescript
pairedWithId: sql<string | null>`(
  SELECT CASE
    WHEN tp.transaction_a_id = ${transaction.id} THEN tp.transaction_b_id
    ELSE tp.transaction_a_id
  END
  FROM transaction_pair tp
  WHERE tp.transaction_a_id = ${transaction.id}
     OR tp.transaction_b_id = ${transaction.id}
  LIMIT 1
)`,
```

**Current pairedNetAmount** (lines 118–128):
```typescript
pairedNetAmount: sql<string | null>`(
  SELECT (${transaction.amount}::numeric + t2.amount::numeric)::text
  FROM transaction_pair tp
  JOIN transaction t2 ON t2.id = CASE
    WHEN tp.transaction_a_id = ${transaction.id} THEN tp.transaction_b_id
    ELSE tp.transaction_a_id
  END
  WHERE tp.transaction_a_id = ${transaction.id}
     OR tp.transaction_b_id = ${transaction.id}
  LIMIT 1
)`,
```

**Current pairedAmount, pairedDescription, pairedOccurredAt** (lines 130–162):
```typescript
pairedAmount: sql<string | null>`(
  SELECT t2.amount::text
  FROM transaction_pair tp
  JOIN transaction t2 ON t2.id = CASE
    WHEN tp.transaction_a_id = ${transaction.id} THEN tp.transaction_b_id
    ELSE tp.transaction_a_id
  END
  WHERE tp.transaction_a_id = ${transaction.id}
     OR tp.transaction_b_id = ${transaction.id}
  LIMIT 1
)`,
// ... pairedDescription, pairedOccurredAt follow same pattern
```

**Design decision (from Inventory Correction in RESEARCH.md):** Phase 73 planner must decide:
1. **Reshape for 1:N:** Rewrite to aggregate over the refund set (`SUM(t_refund.amount)` instead of single `t2.amount`, return JSON array of paired IDs instead of `LIMIT 1`)
2. **Drop from this phase:** Leave these fields reading stale `transaction_pair` until Phase 75/76 rebuild the popover

Either choice is explicit; either way the regression gate must cover the transaction-list read path.

---

### `lib/services/transaction-edit.ts` — Pair Guard (service, CRUD)

**Analog:** `lib/services/transaction-edit.ts` (lines 71–106) — existing pair guard

**Current pair guard implementation** (lines 71–106):
```typescript
if (input.amount !== undefined) {
  const pairRows = await tx
    .select({
      transactionAId: transactionPair.transactionAId,
      transactionBId: transactionPair.transactionBId,
    })
    .from(transactionPair)
    .where(
      or(
        eq(transactionPair.transactionAId, input.transactionId),
        eq(transactionPair.transactionBId, input.transactionId),
      ),
    )
    .limit(1)

  const pair = pairRows[0]
  if (pair) {
    const counterId =
      pair.transactionAId === input.transactionId ? pair.transactionBId : pair.transactionAId

    const counterRows = await tx
      .select({ amount: transaction.amount })
      .from(transaction)
      .where(eq(transaction.id, counterId))
      .limit(1)

    const newAmount = toDecimal(input.amount)
    const counterAmount = toDecimal(counterRows[0]?.amount ?? '0')
    const oppositeSign =
      (newAmount.gt(0) && counterAmount.lt(0)) || (newAmount.lt(0) && counterAmount.gt(0))
    // ... error thrown if !oppositeSign
  }
}
```

**Phase 73 decision boundary:** This guard reads `transaction_pair` to validate the invariant. After migration, the guard must either:
1. **Repoint to reimbursement tables** (if Phase 73 owns the N=1 case guard)
2. **Keep reading transaction_pair** and explicitly document it as reading a dormant table until Phase 74 (if Phase 73 defers the guard generalization)

The key point: **Do not silently break the guard by reading a table that no longer receives updates.** The guard is currently the sole enforcement of "pair-edit that breaks invariant is rejected." When the data moves, the guard must move with it or be explicitly deferred.

**Pattern rule:** Use `Decimal.js` for amount comparison (`toDecimal()`, `.gt()`, `.lt()`), never native `+`/`-` on DECIMAL strings (CLAUDE.md hard rule).

---

### `lib/dal/dashboard.ts`, `lib/dal/overview.ts`, `lib/dal/tags.ts` — Aggregation Sites

**Analog:** Existing files themselves; 8 call sites verified in RESEARCH.md (lines 305–352)

**Call sites requiring updates:**
1. `dashboard.ts : getOverviewAmountTotals()` (line ~458) — SUM(effectiveAmount()) grouped by direction + nature
2. `dashboard.ts : getCategoriesBreakdown()` (line ~973) — SUM(effectiveAmount()) grouped by category
3. `dashboard.ts : getCategoryRanking()` (line ~1034) — SUM(effectiveAmount()) grouped by category + month
4. `dashboard.ts : getCategoryDeviations()` (line ~1094) — SUM(effectiveAmount()) grouped by category
5. `dashboard.ts : getCategoryDetail()` (line ~1202) — SUM(effectiveAmount()) grouped by subcategory
6. `overview.ts` (line ~1 onwards) — SUM(effectiveAmount()) grouped by nature
7. `tags.ts : getTotalByTag()` (line ~200s) — SUM(effectiveAmount()) grouped by tag
8. `tags.ts : getTagDetail()` (line ~300s) — individual transaction rows with effectiveAmount()

**Pattern rule:** Every site uses `effectiveAmount()` in a SUM(CASE ...) expression and `isNotSecondary()` in the WHERE clause, applied as an atomic pair. The refactored `effectiveAmount()` function will transparently update all call sites — **no changes to query shape needed** at these call sites once the function is generalized.

**Regression gate scope:** These 8 queries are the regression gate's surface (D-07). Each query result (totalIn, totalOut, per-category amounts, etc.) must be identical before and after migration.

---

### `lib/services/transaction-pairs.ts` or `lib/services/reimbursement-pairs.ts` (service, CRUD+transaction)

**Analog:** `lib/services/transaction-pairs.ts` (lines 40–231) — createPair and deletePairByTransactionId

**Ownership pattern** (lines 48–66, 101–105):
```typescript
export async function createPair(input: {
  userId: string
  transactionId: string
  counterpartId: string
}): Promise<CreatePairResult> {
  // Full read-then-write must be atomic (project hard rule: ownership-validating
  // writes run inside db.transaction). transaction_pair has no userId column, so the
  // delete/insert relies on the ownership read — that read and the write must not be
  // separated by a window in which another request mutates the rows (CR-02).
  return db.transaction(async (tx): Promise<CreatePairResult> => {
    // 1. Load both transaction rows
    const [rowsA, rowsB] = await Promise.all([
      tx.select({ ... }).from(transaction).where(eq(transaction.id, input.transactionId)).limit(1),
      tx.select({ ... }).from(transaction).where(eq(transaction.id, input.counterpartId)).limit(1),
    ])

    // 2. Ownership check — IDOR block (T-50-01).
    if (t1.userId !== input.userId || t2.userId !== input.userId) {
      throw new Error('Non sei autorizzato a collegare queste transazioni.')
    }
    // ... rest of validation
  })
}
```

**Invariant enforcement pattern** (opposite-sign check, lines 107–116):
```typescript
const d1 = toDecimal(t1.amount)
const d2 = toDecimal(t2.amount)
const oppositeSign = (d1.gt(0) && d2.lt(0)) || (d1.lt(0) && d2.gt(0))
if (!oppositeSign) {
  throw new Error('Le transazioni da collegare devono avere segno opposto.')
}
```

**Error handling pattern** (unique constraint violation → user message, lines 150–160):
```typescript
try {
  await tx.insert(transactionPair).values({
    transactionAId: primaryId,
    transactionBId: secondaryId,
  })
} catch (e) {
  if (errorCauseCode(e) === '23505') {
    throw new Error('Una delle transazioni è già collegata a un'altra.')
  }
  throw e
}
```

**Key patterns:**
- All ownership-validating writes (insert/update/delete) run inside `db.transaction(async (tx) => { ... })`
- Ownership check is the sole gate (no userId column on the join table)
- Invariant validation uses `Decimal.js` (D-02 anchor/refund direction check for Phase 73)
- Error handling extracts Postgres SQLSTATE code to surface localized Italian message
- `revalidatePath()` called on success to refresh affected routes

---

### `lib/actions/transaction-pairs.ts` or `lib/actions/reimbursement-pairs.ts` (action, request-response)

**Analog:** `lib/actions/transaction-pairs.ts` (lines 31–133) — createTransactionPairAction, deleteTransactionPairAction, loadEligibleCounterpartsAction

**Create action pattern** (lines 31–65):
```typescript
'use server'

export async function createTransactionPairAction(
  _prev: CreatePairActionState,
  formData: FormData,
): Promise<CreatePairActionState> {
  const parsed = CreatePairSchema.safeParse({
    transactionId: formData.get('transactionId'),
    counterpartId: formData.get('counterpartId'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dati non validi.' }
  }

  const { userId } = await verifySession()

  let result: Awaited<ReturnType<typeof createPair>>
  try {
    result = await createPair({
      userId,
      transactionId: parsed.data.transactionId,
      counterpartId: parsed.data.counterpartId,
    })
  } catch (err) {
    if (err instanceof Error) return { error: err.message }
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }

  revalidatePath('/transactions')
  revalidatePath('/overview')

  return {
    error: null,
    pairedSecondaryId: result.secondaryTransactionId,
    pairedSubCategoryId: result.inheritedSubCategoryId,
  }
}
```

**Delete action pattern** (lines 106–133):
```typescript
export async function deleteTransactionPairAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = DeletePairSchema.safeParse({
    transactionId: formData.get('transactionId'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dati non validi.' }
  }

  const { userId } = await verifySession()

  try {
    await deletePairByTransactionId({
      userId,
      transactionId: parsed.data.transactionId,
    })
  } catch (err) {
    if (err instanceof Error) return { error: err.message }
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }

  revalidatePath('/transactions')
  revalidatePath('/overview')

  return { error: null }
}
```

**Key patterns:**
- Server action receives FormData (never raw object from client)
- Zod parse validates input **before** any auth or DB access
- `verifySession()` establishes caller identity
- Service function call wraps exceptions in try/catch, returns localized Italian error message
- `revalidatePath()` on success to invalidate affected route caches
- Return type is ActionState-compatible (error: null | string, plus optional result fields)

---

### `lib/validations/transaction-pairs.ts` or `lib/validations/reimbursement-pairs.ts` (utility, validation)

**Analog:** `lib/validations/transaction-pairs.ts` (full file, lines 1–38)

**Schema pattern** (lines 3–10):
```typescript
import { z } from 'zod'

export const CreatePairSchema = z.object({
  transactionId: z.string().min(1, { error: 'Transazione non valida.' }),
  counterpartId: z.string().min(1, { error: 'Contropartita non valida.' }),
})

export const DeletePairSchema = z.object({
  transactionId: z.string().min(1, { error: 'Transazione non valida.' }),
})
```

**Monetary amount validation** (lines 21–33):
```typescript
export const LoadCounterpartsSchema = z
  .object({
    referenceId: z.string().min(1, { error: 'Transazione di riferimento non valida.' }),
    referenceAmount: z
      .string()
      .regex(/^-?\d+(\.\d+)?$/, { error: 'Importo di riferimento non valido.' }),
    dateFrom: z.date({ error: 'Data iniziale non valida.' }),
    dateTo: z.date({ error: 'Data finale non valida.' }),
  })
  .refine((v) => v.dateFrom <= v.dateTo, {
    error: 'La data iniziale deve precedere la data finale.',
    path: ['dateFrom'],
  })

export type CreatePairInput = z.infer<typeof CreatePairSchema>
export type DeletePairInput = z.infer<typeof DeletePairSchema>
```

**Key patterns:**
- DECIMAL amounts are **strings, never coerced to JS numbers** (monetary hard rule)
- Validation regex accepts optional sign and fractional part: `/^-?\d+(\.\d+)?$/`
- `.refine()` for cross-field validation (e.g., dateFrom <= dateTo)
- Type exports via `z.infer<typeof Schema>` for action-level input types
- All error messages are Italian (user-facing strings)

---

### `tests/reimbursement-invariant.test.ts` (NEW) — Invariant Tests (test, testing)

**Analog:** `tests/dashboard-dal.test.ts` (lines 1–130) — Vitest structure, mocking, describe/it blocks

**Test framework pattern** (lines 1–11):
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Hoisted so the mock factory can close over shared mutable state
const dalMocks = vi.hoisted(() => ({
  rowsQueue: [] as unknown[][],
}))

vi.mock('server-only', () => ({}))
vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))
vi.mock('@/lib/dal/auth', () => ({ verifySession: vi.fn() }))
```

**Describe/it block pattern** (lines 131–150):
```typescript
beforeEach(() => {
  dalMocks.rowsQueue = []
  vi.mocked(verifySession).mockResolvedValue({ userId: 'user-1' } as never)
})

describe('dashboard DAL amount mapping', () => {
  it('uses the selected dashboard preset for KPI ranges and compares against the preceding range', () => {
    const now = new Date(2026, 4, 15)
    expect(getOverviewComparisonRanges('last-month', now)).toEqual({
      current: { from: new Date(...), to: new Date(...) },
      previous: { from: new Date(...), to: new Date(...) },
    })
  })
})
```

**For Phase 73 invariant tests, expected structure:**
1. Test: `createReimbursement({ expenseId, refundTransactionIds })` with anchor.direction='out', all refunds.direction='in' → succeeds
2. Test: `createReimbursement({ expenseId, refundTransactionIds })` with anchor.direction='in' → throws "anchor must be outflow"
3. Test: `createReimbursement({ expenseId, refundTransactionIds })` with a refund.direction='out' → throws "refunds must be inflows"
4. Fixtures: seeded transactions with explicit direction assignments

**Key pattern:** Use hoisted `vi.hoisted(() => ({ ... }))` for shared mutable state that tests need to manipulate (e.g., mock result queues), and `vi.mock()` for dependencies.

---

### `tests/reimbursement-regression.test.ts` (NEW) — Regression Harness (test, testing)

**Analog:** `tests/dashboard-dal.test.ts` (mocking, fixtures, multi-step describe blocks)

**Expected structure (from RESEARCH.md):**
1. **Phase 1: Query old schema** — seed test data into `transaction_pair`, run 8 aggregation queries (getOverviewAmountTotals, getCategoriesBreakdown, getCategoryRanking, getCategoryDeviations, getCategoryDetail, overview totals, getTotalByTag, getTagDetail), capture results with `Decimal.js`
2. **Phase 2: Migrate** — run backfill SQL migration
3. **Phase 3: Query new schema** — run same 8 queries with updated `effectiveAmount()`/`isNotSecondary()` implementations
4. **Phase 4: Compare** — assert all totals are equal using `Decimal.js` equality (never `===` on strings)

**Test framework pattern:**
```typescript
describe('reimbursement regression gate', () => {
  beforeEach(() => {
    // Seed fixtures: create test transactions (outflows + inflows) with known pairing
  })

  it('getOverviewAmountTotals returns identical totals before and after migration', async () => {
    // 1. Query old schema using current effectiveAmount()
    const resultsBefore = await getOverviewAmountTotals(...)
    
    // 2. Run backfill migration
    await runMigration()
    
    // 3. Query new schema with updated functions
    const resultsAfter = await getOverviewAmountTotals(...)
    
    // 4. Compare using Decimal.js
    const beforeIn = toDecimal(resultsBefore.totalIn)
    const afterIn = toDecimal(resultsAfter.totalIn)
    expect(beforeIn.equals(afterIn)).toBe(true)
  })

  it('all 8 aggregation queries return identical results', async () => {
    // ... same pattern for each query
  })
})
```

**Checkpoints (from RESEARCH.md):**
- Overall dashboard KPIs (totalIn, totalOut, per-nature spending)
- Per-category amounts (entry, exit, essential, discretionary, debt)
- Monthly trends (trend point totals, sparkline values)
- Per-tag totals
- Transaction-list read path (paired-* fields)
- Amount-edit guard firing behaviour

---

## Shared Patterns

### Decimal.js for All Monetary Arithmetic
**Source:** `lib/utils/decimal` (project hard rule in CLAUDE.md)
**Apply to:** All service, action, and migration files that touch amounts

**Pattern:**
```typescript
import { toDecimal, toDbDecimal } from '@/lib/utils/decimal'

const result = toDecimal(expense.totalAmount).plus(toDecimal(other.totalAmount))
await db.insert(...).values({ totalAmount: toDbDecimal(result) })
```

Never use native `+`, `-`, `*`, `/` on DECIMAL strings returned by Drizzle.

### Ownership Validation (IDOR Block)
**Source:** `lib/services/transaction-pairs.ts` (lines 101–105)
**Apply to:** All service functions that write to reimbursement / reimbursement_refund

**Pattern:**
```typescript
return db.transaction(async (tx): Promise<Result> => {
  // Load rows with userId
  const rows = await tx.select({ userId: ... }).from(...).where(eq(..., input.userId))
  
  // Ownership check BEFORE any insert/update/delete
  if (row.userId !== input.userId) {
    throw new Error('Non sei autorizzato...')
  }
  
  // Write inside same transaction
  await tx.insert(...).values(...)
})
```

### Error Handling for Unique Constraint Violations
**Source:** `lib/services/transaction-pairs.ts` (lines 150–160)
**Apply to:** Any reimbursement service that inserts into tables with unique constraints

**Pattern:**
```typescript
try {
  await tx.insert(table).values(...)
} catch (e) {
  if (errorCauseCode(e) === '23505') {
    throw new Error('Una delle transazioni è già collegata a un'altra.')
  }
  throw e
}
```

Helper function (extract Postgres SQLSTATE):
```typescript
function errorCauseCode(error: unknown): string {
  const cause =
    typeof error === 'object' && error !== null && 'cause' in error
      ? (error as { cause?: unknown }).cause
      : undefined

  if (typeof cause !== 'object' || cause === null || !('code' in cause)) {
    return ''
  }

  const code = (cause as { code?: unknown }).code
  return typeof code === 'string' ? code : ''
}
```

### Server Action Pattern (Zod → Service → Response)
**Source:** `lib/actions/transaction-pairs.ts` (lines 31–65)
**Apply to:** Any new action that modifies reimbursements

**Pattern:**
```typescript
'use server'

export async function actionName(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // 1. Validate input
  const parsed = Schema.safeParse({ ... })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Default message' }
  }

  // 2. Verify session
  const { userId } = await verifySession()

  // 3. Call service
  try {
    await serviceFunction({ userId, ...parsed.data })
  } catch (err) {
    if (err instanceof Error) return { error: err.message }
    return { error: 'Generic fallback error message' }
  }

  // 4. Revalidate routes
  revalidatePath('/route1')
  revalidatePath('/route2')

  return { error: null, ...result }
}
```

---

## No Analog Found

No files in this phase have no close analog in the codebase.

All patterns are derived from existing transaction-pair infrastructure (schema, service, action, validation, SQL) or from established testing patterns (dashboard-dal.test.ts).

---

## Metadata

**Analog search scope:** 
- `lib/db/schema.ts` (lines 1–900) — table definitions
- `lib/dal/transaction-pairs-sql.ts` (full file)
- `lib/dal/transactions.ts` (lines 100–170)
- `lib/dal/transaction-pairs.ts` (lines 36–85)
- `lib/dal/dashboard.ts` — aggregation queries (8 call sites)
- `lib/dal/overview.ts` — aggregation queries (1 call site)
- `lib/dal/tags.ts` — aggregation queries (2 call sites)
- `lib/services/transaction-pairs.ts` (full file)
- `lib/services/transaction-edit.ts` (lines 47–106)
- `lib/actions/transaction-pairs.ts` (full file)
- `lib/validations/transaction-pairs.ts` (full file)
- `drizzle/migrations/0022_wonderful_eternals.sql` (full file)
- `tests/dashboard-dal.test.ts` (lines 1–150)

**Files scanned:** 12 core files + 3 migration precedents
**Pattern extraction date:** 2026-07-23

---

## Critical Design Notes

### D-02 Anchor/Refund Invariant
**Enforce at:** Service-level validation + optional DB CHECK constraint
**Pattern:** Direction check in service before insert (anchor.direction='out', all refunds.direction='in')
**Why:** DB constraints alone incomplete; direct SQL can bypass. Defense-in-depth: constraints + service guards.

### D-07 Regression Gate Surface
**Must cover:** 8 aggregation queries + transaction-list paired-* fields + amount-edit guard
**Why:** Dashboard totals passing masks silent breakage in other paths (RESEARCH.md Pitfall 3).
**Concrete:** Diff before/after results using Decimal.js equality; fail if any total differs.

### Atomic Ownership Checks
**Rule:** All writes to reimbursement / reimbursement_refund run inside `db.transaction(async (tx) => { ... })`
**Why:** No userId column on join tables; ownership read and write must not be separated by a window allowing mutation.
**Pattern:** Read both transaction rows with userId, check ownership, then write inside same transaction.

---

## Ready for Planning

Pattern mapping complete. Planner can now reference analog patterns in plan actions.

All 12 files classified, 11 analogs with concrete line-number excerpts, shared patterns identified, and critical design notes highlighted.
