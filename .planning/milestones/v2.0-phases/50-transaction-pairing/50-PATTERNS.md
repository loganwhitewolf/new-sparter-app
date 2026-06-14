# Phase 50: transaction-pairing - Pattern Map

**Mapped:** 2026-06-13
**Files analyzed:** 14 (9 new, 5 modified)
**Analogs found:** 14 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `lib/db/schema.ts` (add `transactionPair`) | schema | CRUD | `lib/db/schema.ts` — `session`, `userSubcategoryOverride` table definitions | exact (same file) |
| `drizzle/migrations/0020_*.sql` | migration | batch | `drizzle/migrations/0019_*.sql` | exact |
| `lib/dal/transaction-pairs-sql.ts` | utility/SQL helper | transform | `lib/dal/dashboard.ts` — `sql` fragment helpers (`dateScopedTransactions`, `expenseStatusIncludedInDashboardTotals`) | role-match |
| `lib/dal/transaction-pairs.ts` | DAL query | request-response | `lib/dal/transactions.ts` — `getTransactions`, `cache` pattern | exact |
| `lib/services/transaction-pairs.ts` | service | CRUD | `lib/services/transaction-deletion.ts` — `deleteTransactionsAndReconcileExpenses` | role-match |
| `lib/actions/transaction-pairs.ts` | action | request-response | `lib/actions/transactions.ts` — `deleteTransaction`, `createTransaction` | exact |
| `lib/validations/transaction-pairs.ts` | validation | transform | `lib/validations/transactions.ts` — `DeleteTransactionSchema`, `CreateTransactionSchema` | exact |
| `components/transactions/counterpart-picker-dialog.tsx` | component/dialog | request-response | `components/transactions/transaction-form-dialog.tsx` | exact |
| `components/transactions/transaction-pair-popover.tsx` | component | event-driven | `components/transactions/transaction-form-dialog.tsx` — Dialog + state pattern | role-match |
| `lib/dal/transactions.ts` (extend select + type) | DAL query | request-response | same file — `transactionListSelect`, `TransactionListRow` | exact (same file) |
| `lib/dal/dashboard.ts` (netting in 6 queries) | DAL query | CRUD | same file — existing `sql` fragments + `cache` wrapped aggregations | exact (same file) |
| `lib/dal/overview.ts` (netting in 2 queries) | DAL query | CRUD | `lib/dal/dashboard.ts` — aggregation + cache pattern | exact |
| `components/transactions/transaction-table.tsx` (row actions) | component | event-driven | same file — existing `DropdownMenuItem` actions | exact (same file) |
| `app/(app)/transactions/page.tsx` (dialog wiring) | page (RSC) | request-response | same file — `categorizeTarget` state + dialog orchestration pattern | exact (same file) |

---

## Pattern Assignments

### `lib/db/schema.ts` — add `transactionPair` table + relations

**Analog:** Same file — `session` table (FK + index pattern), `userSubcategoryOverride` table (unique constraint on columns pattern), `transactionRelations` (relations with `one`).

**pgTable idiom with FK + cascade** (`lib/db/schema.ts`, lines 73–92 and 191–218):
```typescript
// FK with onDelete: 'cascade' — from session table (line 87-89):
userId: text("user_id")
  .notNull()
  .references(() => user.id, { onDelete: "cascade" }),

// Index array in table factory — from session table (line 91):
(table) => [index("session_userId_idx").on(table.userId)],

// unique() on single column — from userSubcategoryOverride (line 213-216):
unique("user_subcategory_override_user_subcategory_unique").on(
  table.userId,
  table.subCategoryId,
),
```

**`serial` PK + `timestamp` with timezone** (`lib/db/schema.ts`, lines 191–218 for userSubcategoryOverride):
```typescript
id: serial("id").primaryKey(),
createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
```

**Relations with `one` and `relationName`** — use the same `relations(table, ({ one }) => ({ ... }))` signature as `sessionRelations` (lines 513–518). The two-sided relation needs `relationName` to disambiguate — there is no existing example with two FKs to the same table in this file; the research document provides the full pattern.

**`transactionRelations`** (lines 634+) must be extended with `pairAsA` and `pairAsB` many-references. Current shape to extend (lines 634+):
```typescript
export const transactionRelations = relations(transaction, ({ one }) => ({
  // existing entries here ...
}));
```

**Column naming convention:** camelCase TS property, snake_case DB column string (e.g., `transactionAId: text("transaction_a_id")`). Observed throughout the file.

---

### `drizzle/migrations/0020_*.sql`

**Analog:** Previous generated migrations (e.g., `drizzle/migrations/0019_*.sql`).

**Generation command:** `yarn db:generate` (runs `drizzle-kit generate`). Never hand-write; never use `drizzle-kit push`. The migration is purely additive (CREATE TABLE + CREATE UNIQUE INDEX + CREATE INDEX). No backfill needed.

---

### `lib/dal/transaction-pairs-sql.ts` (NEW — SQL helper fragments)

**Analog:** `lib/dal/dashboard.ts` — the file already uses named helper functions that return Drizzle `sql` tagged template expressions, e.g., `dateScopedTransactions` and `expenseStatusIncludedInDashboardTotals` (see dashboard.ts lines 1–50 for imports and early helper pattern).

**Imports pattern** (mirror `lib/dal/dashboard.ts` lines 1–26):
```typescript
import 'server-only'
import { sql } from 'drizzle-orm'
import { transaction as transactionTable } from '@/lib/db/schema'
```

**SQL fragment helper pattern** (from `lib/dal/dashboard.ts` helper style):
```typescript
// Returns a Drizzle SQL expression — no arguments needed; uses imported table alias.
// The table alias `transactionTable` is consistent across dashboard.ts and overview.ts
// (both import as `transaction as transactionTable` from '@/lib/db/schema').

export function isNotSecondary() {
  return sql`NOT EXISTS (
    SELECT 1 FROM transaction_pair tp
    WHERE tp.transaction_b_id = ${transactionTable.id}
  )`
}

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

**Usage in aggregation queries (apply both together — never one without the other):**
```typescript
// In WHERE (alongside existing conditions):
and(
  dateScopedTransactions(userId, from, to),
  expenseStatusIncludedInDashboardTotals(),
  ne(direction.code, 'transfer'),
  isNotSecondary(),   // ADD THIS
)

// In SUM CASE expressions (replace transactionTable.amount with effectiveAmount()):
// Before: sql`coalesce(sum(case when ${direction.code} = 'in' then ${transactionTable.amount} else 0 end), 0)::text`
// After:
sql`coalesce(sum(case when ${direction.code} = 'in' then ${effectiveAmount()} else 0 end), 0)::text`
```

---

### `lib/dal/transaction-pairs.ts` (NEW)

**Analog:** `lib/dal/transactions.ts` — `cache` wrapping, `verifySession`, `db.select` + filter chain.

**Imports pattern** (`lib/dal/transactions.ts` lines 1–18):
```typescript
import 'server-only'
import { cache } from 'react'
import { and, eq, gte, lte, ne, not, exists, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/dal/auth'
import { transaction, transactionPair } from '@/lib/db/schema'
```

**`cache` + `verifySession` pattern** (`lib/dal/transactions.ts` lines 153–159):
```typescript
export const getEligibleCounterparts = cache(
  async (input: {
    referenceId: string
    referenceAmount: string
    dateFrom: Date
    dateTo: Date
  }): Promise<CounterpartRow[]> => {
    const { userId } = await verifySession()
    // ... db.select().from(transaction).where(and(...))
  }
)
```

**NOT EXISTS filter** (mirror the `isNotSecondary` pattern but as a Drizzle expression):
```typescript
// Exclude already-paired transactions from picker:
sql`NOT EXISTS (
  SELECT 1 FROM transaction_pair tp
  WHERE tp.transaction_a_id = ${transaction.id}
     OR tp.transaction_b_id = ${transaction.id}
)`
```

---

### `lib/services/transaction-pairs.ts` (NEW)

**Analog:** `lib/services/transaction-deletion.ts` — `import 'server-only'`, `db.select` ownership checks before writes, `DbOrTx` type, Decimal.js.

**Imports pattern** (`lib/services/transaction-deletion.ts` lines 1–11):
```typescript
import 'server-only'
import { and, eq, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { transaction, transactionPair } from '@/lib/db/schema'
import { toDecimal } from '@/lib/utils/decimal'
```

**Ownership validation before write** (`lib/services/transaction-deletion.ts` pattern):
```typescript
// Load transaction, check userId before any mutation:
const rows = await db
  .select({ id: transaction.id, amount: transaction.amount, occurredAt: transaction.occurredAt, userId: transaction.userId })
  .from(transaction)
  .where(eq(transaction.id, input.transactionId))
  .limit(1)
if (!rows[0] || rows[0].userId !== input.userId)
  throw new Error('Non sei autorizzato...')
```

**Decimal.js for amount comparison** (project hard rule — `@/lib/utils/decimal`):
```typescript
import { toDecimal } from '@/lib/utils/decimal'

const abs1 = toDecimal(t1.amount).abs()
const abs2 = toDecimal(t2.amount).abs()
// NEVER: Math.abs(Number(t1.amount))
```

**db.insert pattern** (from any service insert; `lib/db/schema.ts` confirms table shape):
```typescript
await db.insert(transactionPair).values({
  transactionAId: primaryId,
  transactionBId: secondaryId,
})
```

**db.delete with OR** (from `lib/services/transaction-deletion.ts`):
```typescript
await db.delete(transactionPair).where(
  or(
    eq(transactionPair.transactionAId, input.transactionId),
    eq(transactionPair.transactionBId, input.transactionId),
  )
)
```

---

### `lib/actions/transaction-pairs.ts` (NEW)

**Analog:** `lib/actions/transactions.ts` — exact thin-action pattern.

**Full action pattern** (`lib/actions/transactions.ts` lines 134–158):
```typescript
'use server'
import { verifySession } from '@/lib/dal/auth'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/lib/validations/expense'

export async function deleteTransaction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = DeleteTransactionSchema.safeParse({
    id: formData.get('id'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Transazione non valida.' }
  }
  const { userId } = await verifySession()   // ← always AFTER parse, before service
  try {
    // ... service call
  } catch {
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }
  revalidateCategorizationSurfaces()   // ← pair actions use revalidatePath directly
  return { error: null }
}
```

**`ActionState` type** — import from `@/lib/validations/expense` (line 21 of `lib/actions/transactions.ts`):
```typescript
import type { ActionState } from '@/lib/validations/expense'
// ActionState = { error: string | null }
```

**revalidatePath calls for pair actions** (pair actions must invalidate both transactions and dashboard):
```typescript
revalidatePath('/transactions')
revalidatePath('/overview')
```

---

### `lib/validations/transaction-pairs.ts` (NEW)

**Analog:** `lib/validations/transactions.ts` — Zod schema style.

**Schema pattern** (`lib/validations/transactions.ts` lines 35–37):
```typescript
import { z } from 'zod'

export const DeleteTransactionSchema = z.object({
  id: z.string().uuid({ error: 'Transazione non valida.' }),
})
```

**New schemas to define:**
```typescript
export const CreatePairSchema = z.object({
  transactionId: z.string().min(1, { error: 'Transazione non valida.' }),
  counterpartId: z.string().min(1, { error: 'Contropartita non valida.' }),
})

export const DeletePairSchema = z.object({
  transactionId: z.string().min(1, { error: 'Transazione non valida.' }),
})

export type CreatePairInput = z.infer<typeof CreatePairSchema>
export type DeletePairInput = z.infer<typeof DeletePairSchema>
```

Note: transaction IDs in this project are `text` (UUID strings), not `serial`. Use `z.string().min(1)` not `z.number()`.

---

### `components/transactions/counterpart-picker-dialog.tsx` (NEW)

**Analog:** `components/transactions/transaction-form-dialog.tsx` — exact dialog shell.

**Imports pattern** (`components/transactions/transaction-form-dialog.tsx` lines 1–22):
```typescript
'use client'
import { useActionState, useEffect, useRef, useState } from 'react'
import { Link2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { createTransactionPairAction } from '@/lib/actions/transaction-pairs'
```

**Dialog controlled by `open`/`onOpenChange` props** (`transaction-form-dialog.tsx` lines 29–44):
```typescript
// CounterpartPickerDialog receives open state from parent (TransactionTable):
type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  transactionId: string
  transactionAmount: string
  transactionOccurredAt: Date
}

export function CounterpartPickerDialog({ open, onOpenChange, ...props }: Props) {
  const [state, formAction, isPending] = useActionState(createTransactionPairAction, { error: null })
  const submittedRef = useRef(false)

  useEffect(() => {
    if (submittedRef.current && state.error === null) {
      onOpenChange(false)
      toast.success('Transazione collegata.')
      submittedRef.current = false
    }
  }, [state, onOpenChange])
  // ...
}
```

**Form submit with submittedRef** (`transaction-form-dialog.tsx` lines 86–90):
```typescript
<form
  action={(fd) => {
    submittedRef.current = true
    formAction(fd)
  }}
>
```

**Error display** (`transaction-form-dialog.tsx` lines 150–155):
```typescript
{state.error && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertDescription>{state.error}</AlertDescription>
  </Alert>
)}
```

**Dialog content structure** (mirror `transaction-form-dialog.tsx` lines 71–80):
```typescript
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent className="max-w-lg">
    <DialogHeader>
      <DialogTitle>Collega rimborso</DialogTitle>
      <DialogDescription className="sr-only">
        Seleziona la transazione contropartita da collegare.
      </DialogDescription>
    </DialogHeader>
    {/* search input + scrollable list + hidden fields */}
    <DialogFooter>
      {/* Cancel + Confirm buttons */}
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

### `components/transactions/transaction-pair-popover.tsx` (NEW)

**Analog:** No exact popover-badge analog. Use shadcn/ui `Popover` (already in project). The `Badge` component is already used in `transaction-table.tsx` for status chips — reuse same import.

**Imports pattern:**
```typescript
'use client'
import { Link2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toDecimal } from '@/lib/utils/decimal'
```

**Decimal.js for net amount display** (project hard rule):
```typescript
// Format net amount for badge display — NEVER use native arithmetic:
import { toDecimal } from '@/lib/utils/decimal'

function formatNet(pairedNetAmount: string, currency: string) {
  const net = toDecimal(pairedNetAmount)
  // ... format as signed currency string
}
```

**Type for component props:**
```typescript
type Props = {
  pairedWithId: string
  netAmount: string         // string from DB (Drizzle DECIMAL → string)
  currency: string
  pairedDescription: string
  pairedAmount: string
  pairedOccurredAt: Date
}
```

---

### `lib/dal/transactions.ts` — extend `transactionListSelect` and `TransactionListRow`

**Analog:** Same file — `transactionListSelect` object (lines 70–92), `TransactionListRow` type (lines 100–121).

**Current `transactionListSelect` shape** (lines 70–92):
```typescript
export const transactionListSelect = {
  id: transaction.id,
  // ... existing fields ...
  categoryType: direction.code,
}
```

**Extension — add correlated subqueries** (no LEFT JOIN needed — avoids fan-out):
```typescript
// Append to transactionListSelect:
pairedWithId: sql<string | null>`(
  SELECT CASE
    WHEN tp.transaction_a_id = ${transaction.id} THEN tp.transaction_b_id
    WHEN tp.transaction_b_id = ${transaction.id} THEN tp.transaction_a_id
  END
  FROM transaction_pair tp
  WHERE tp.transaction_a_id = ${transaction.id}
     OR tp.transaction_b_id = ${transaction.id}
  LIMIT 1
)`,
pairedNetAmount: sql<string | null>`(
  SELECT CASE
    WHEN tp.transaction_a_id = ${transaction.id}
      THEN (${transaction.amount}::numeric + (
        SELECT t2.amount::numeric FROM transaction t2
        WHERE t2.id = tp.transaction_b_id
      ))::text
    WHEN tp.transaction_b_id = ${transaction.id}
      THEN (${transaction.amount}::numeric + (
        SELECT t2.amount::numeric FROM transaction t2
        WHERE t2.id = tp.transaction_a_id
      ))::text
    ELSE NULL
  END
  FROM transaction_pair tp
  WHERE tp.transaction_a_id = ${transaction.id}
     OR tp.transaction_b_id = ${transaction.id}
  LIMIT 1
)`,
// For popover (Option 1 — extend rather than lazy-load):
pairedDescription: sql<string | null>`(
  SELECT t2.description FROM transaction_pair tp
  INNER JOIN transaction t2 ON t2.id = CASE
    WHEN tp.transaction_a_id = ${transaction.id} THEN tp.transaction_b_id
    ELSE tp.transaction_a_id END
  WHERE tp.transaction_a_id = ${transaction.id}
     OR tp.transaction_b_id = ${transaction.id}
  LIMIT 1
)`,
pairedOccurredAt: sql<Date | null>`(
  SELECT t2.occurred_at FROM transaction_pair tp
  INNER JOIN transaction t2 ON t2.id = CASE
    WHEN tp.transaction_a_id = ${transaction.id} THEN tp.transaction_b_id
    ELSE tp.transaction_a_id END
  WHERE tp.transaction_a_id = ${transaction.id}
     OR tp.transaction_b_id = ${transaction.id}
  LIMIT 1
)`,
```

**Extend `TransactionListRow` type** (lines 100–121) — add after `categoryType`:
```typescript
pairedWithId: string | null
pairedNetAmount: string | null
pairedDescription: string | null
pairedOccurredAt: Date | null
```

---

### `lib/dal/dashboard.ts` — netting in 6 aggregation queries

**Analog:** Same file — all 6 aggregation functions use identical join chain and `cache` wrapper.

**File-level imports** (lines 1–38) — add after existing imports:
```typescript
import { isNotSecondary, effectiveAmount } from '@/lib/dal/transaction-pairs-sql'
```

**`cache` wrapping pattern** (consistent across all dashboard functions):
```typescript
export const getOverviewAmountTotals = cache(
  async (userId: string, from: Date, to: Date): Promise<...> => {
    // db.select().from(transactionTable).innerJoin(...).where(and(...))
  }
)
```

**WHERE clause extension** — add `isNotSecondary()` to the existing `and(...)` in each query:
```typescript
.where(and(
  dateScopedTransactions(userId, from, to),
  expenseStatusIncludedInDashboardTotals(),
  ne(direction.code, 'transfer'),
  isNotSecondary(),   // ← add here
))
```

**Amount expression replacement** — in every SUM CASE expression, replace `${transactionTable.amount}` with `${effectiveAmount()}`:
```typescript
// Before (existing pattern from RESEARCH.md §1.1):
sql`coalesce(sum(case when ${direction.code} = 'in' then ${transactionTable.amount} else 0 end), 0)::text`

// After:
sql`coalesce(sum(case when ${direction.code} = 'in' then ${effectiveAmount()} else 0 end), 0)::text`
```

**Sites to modify in `lib/dal/dashboard.ts`:**
1. `getOverviewAmountTotals` (line ~432)
2. `getCategoriesBreakdown` (line ~899)
3. `getCategoryRanking` (line ~959)
4. `getCategoryDeviations` — both reference and baseline sub-queries (line ~1018)
5. `getCategoryDetail` — trend, subcategories, topTransactions sub-queries (line ~1124)
6. `getMonthlyTrendByNature` (line ~1340)

---

### `lib/dal/overview.ts` — netting in 2 queries

**Analog:** `lib/dal/dashboard.ts` — same `cache` + `verifySession` + `sql` pattern.

**File-level imports** — same addition:
```typescript
import { isNotSecondary, effectiveAmount } from '@/lib/dal/transaction-pairs-sql'
```

**Sites to modify in `lib/dal/overview.ts`:**
1. `getOverviewChart` (line ~423) — uses correlated subselects for nature/direction instead of explicit JOIN chain; `isNotSecondary()` still works identically since it references `${transactionTable.id}` which resolves to the same alias used in this file
2. `getMonthOverMonthCategoryChanges` — both current-month and previous-month sub-queries (line ~170)

**`getOverview` (line ~112)** — delegates to `getOverviewAmountTotals`; no additional change needed here.

---

### `components/transactions/transaction-table.tsx` — row actions extension

**Analog:** Same file — existing `DropdownMenuItem` structure (lines ~437–495 per RESEARCH.md §5.1).

**Props extension** (add to `TransactionTable` props type):
```typescript
onLinkRefund: (transactionId: string, amount: string) => void
onUnpair: (transactionId: string) => void
```

**Dropdown extension** — add before existing `<DropdownMenuSeparator />`:
```tsx
{transaction.pairedWithId ? (
  <DropdownMenuItem onSelect={() => onUnpair(transaction.id)}>
    Scollega
  </DropdownMenuItem>
) : (
  <DropdownMenuItem onSelect={() => onLinkRefund(transaction.id, transaction.amount)}>
    Collega rimborso
  </DropdownMenuItem>
)}
```

**Pair badge in row** — add after existing description/title cell content (new `TransactionPairBadge` component, see `transaction-pair-popover.tsx`):
```tsx
{transaction.pairedWithId && transaction.pairedNetAmount && (
  <TransactionPairPopover
    pairedWithId={transaction.pairedWithId}
    netAmount={transaction.pairedNetAmount}
    currency={transaction.currency}
    pairedDescription={transaction.pairedDescription ?? ''}
    pairedAmount={transaction.pairedNetAmount}
    pairedOccurredAt={transaction.pairedOccurredAt ?? new Date()}
  />
)}
```

---

### `app/(app)/transactions/page.tsx` — dialog wiring

**Analog:** Same file — existing `categorizeTarget` state drives `ExpenseCategorizeDialog`.

**Client state extension pattern** (mirror `categorizeTarget`):
```typescript
// Inside TransactionTable (which is 'use client'):
const [pairTarget, setPairTarget] = useState<{ id: string; amount: string; occurredAt: Date } | null>(null)

// Wire to props:
<TransactionTable
  ...
  onLinkRefund={(id, amount) => setPairTarget({ id, amount, occurredAt: ... })}
  onUnpair={async (id) => { /* call deleteTransactionPairAction directly or via form */ }}
/>
<CounterpartPickerDialog
  open={pairTarget !== null}
  onOpenChange={(open) => { if (!open) setPairTarget(null) }}
  transactionId={pairTarget?.id ?? ''}
  transactionAmount={pairTarget?.amount ?? ''}
  transactionOccurredAt={pairTarget?.occurredAt ?? new Date()}
/>
```

The page itself is a Server Component (RSC); dialog state is managed in the client-side `TransactionTable` component (already `'use client'`) following the existing `categorizeTarget` pattern.

---

## Shared Patterns

### `verifySession` — mandatory first in every action
**Source:** `lib/dal/auth.ts` — `verifySession()` is `react.cache`'d and returns `{ userId }`.
**Apply to:** `lib/actions/transaction-pairs.ts` — both action functions.
```typescript
import { verifySession } from '@/lib/dal/auth'
// In action body, AFTER Zod parse and BEFORE service call:
const { userId } = await verifySession()
```

### Decimal.js — all monetary arithmetic
**Source:** `lib/utils/decimal.ts` — `toDecimal`, `toDbDecimal`.
**Apply to:** `lib/services/transaction-pairs.ts` (amount comparison for primary determination), `components/transactions/transaction-pair-popover.tsx` (net amount display).
```typescript
import { toDecimal } from '@/lib/utils/decimal'
// NEVER: Number(amount), parseFloat(amount), or native + - * /
const net = toDecimal(primary.amount).plus(toDecimal(secondary.amount))
```

### `ActionState` type
**Source:** `lib/validations/expense.ts` line 54 — `export type ActionState = { error: string | null }`.
**Apply to:** `lib/actions/transaction-pairs.ts` — both action return types.
```typescript
import type { ActionState } from '@/lib/validations/expense'
```

### `import 'server-only'`
**Source:** `lib/dal/transactions.ts` line 1, `lib/services/transaction-deletion.ts` line 1.
**Apply to:** `lib/dal/transaction-pairs.ts`, `lib/dal/transaction-pairs-sql.ts`, `lib/services/transaction-pairs.ts`.

### `react.cache` wrapping for DAL
**Source:** `lib/dal/transactions.ts` lines 153–158, `lib/dal/dashboard.ts` pattern.
**Apply to:** `lib/dal/transaction-pairs.ts` — wrap `getEligibleCounterparts` in `cache()`.
```typescript
import { cache } from 'react'
export const getEligibleCounterparts = cache(async (...) => { ... })
```

### Error response in actions
**Source:** `lib/actions/transactions.ts` lines 49, 66–68, 154–157.
```typescript
// Parse failure:
if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Fallback message.' }
// Service/DB failure:
catch { return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' } }
// Success:
return { error: null }
```

---

## No Analog Found

All files have close analogs in the codebase. No fallback to RESEARCH.md patterns required.

---

## Metadata

**Analog search scope:** `lib/db/`, `lib/dal/`, `lib/services/`, `lib/actions/`, `lib/validations/`, `components/transactions/`, `app/(app)/transactions/`
**Files read:** 10 source files
**Pattern extraction date:** 2026-06-13
