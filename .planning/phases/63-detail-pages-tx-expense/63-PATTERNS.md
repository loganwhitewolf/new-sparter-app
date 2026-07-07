# Phase 63: detail-pages-tx-expense - Pattern Map

**Mapped:** 2026-07-05
**Files analyzed:** 10 (new + modified)
**Analogs found:** 8 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/(app)/transactions/[id]/page.tsx` | page | request-response | `app/(app)/import/[fileId]/suggestions/page.tsx` | exact |
| `app/(app)/expenses/[id]/page.tsx` | page | request-response | `app/(app)/import/[fileId]/suggestions/page.tsx` | exact |
| `components/detail-pages/detail-page-shell.tsx` | component | request-response | `components/layout/app-shell.tsx` | layout-match |
| `lib/dal/transactions.ts` (extend) | DAL query | request-response | `lib/dal/expenses.ts::getExpenseById` | exact |
| `lib/dal/expenses.ts` (extend) | DAL query | request-response | `lib/dal/expenses.ts::getExpenseById` | self-match |
| `lib/routes.ts` (add constants) | config | — | `lib/routes.ts` (existing) | self-match |
| `components/transactions/transaction-table.tsx` (menu) | component | request-response | Same file (existing menu pattern) | self-match |
| `components/expenses/expense-table.tsx` (menu) | component | request-response | Same file (existing menu pattern) | self-match |
| `components/expenses/expense-form-dialog.tsx` (keep create) | component | request-response | Same file (existing create mode) | self-match |
| `components/expenses/expense-transactions-dialog.tsx` (delete) | component | — | Deferred (Phase 64) | —  |

## Pattern Assignments

### `app/(app)/transactions/[id]/page.tsx` (RSC page, request-response)

**Analog:** `app/(app)/import/[fileId]/suggestions/page.tsx`

**Pattern:** RSC detail page with ownership gate. Fetch entity scoped by userId, return notFound() if not found or not owner.

**Imports pattern** (lines 1-7):
```typescript
import { notFound } from 'next/navigation'
import { verifySession } from '@/lib/dal/auth'
import { getTransactionForDetail } from '@/lib/dal/transactions' // NEW
// Client component for rendering
import { TransactionDetailClient } from './client'
```

**Page structure** (lines 9-26):
```typescript
export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { userId } = await verifySession()

  const tx = await getTransactionForDetail({ userId, id })
  if (!tx) {
    notFound()
  }

  return <TransactionDetailClient transaction={tx} />
}
```

**Ownership gate pattern** — line 18 (`await params`), lines 19–20 (`verifySession()` + `getTransactionForDetail`), line 21 (`notFound()` on null).

---

### `app/(app)/expenses/[id]/page.tsx` (RSC page, request-response)

**Analog:** `app/(app)/import/[fileId]/suggestions/page.tsx`

**Pattern:** Identical to transactions page; fetch expense with linked transactions, ownership-scoped.

**Imports pattern**:
```typescript
import { notFound } from 'next/navigation'
import { verifySession } from '@/lib/dal/auth'
import { getExpenseForDetail } from '@/lib/dal/expenses' // NEW
import { ExpenseDetailClient } from './client'
```

**Page structure**:
```typescript
export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { userId } = await verifySession()

  const expense = await getExpenseForDetail({ userId, id })
  if (!expense) {
    notFound()
  }

  return <ExpenseDetailClient expense={expense} />
}
```

---

### `components/detail-pages/detail-page-shell.tsx` (client component, request-response)

**Analog:** `components/layout/app-shell.tsx` (layout wrapper), `components/transactions/transaction-title-edit.tsx` (component structure)

**Pattern:** Client wrapper component accepting header content (title, amount, actions) and card slot children. Renders stacked layout with mobile-first responsive design.

**Structure** (conceptual from RESEARCH.md Pattern 3):
```typescript
'use client'
import { ReactNode } from 'react'

type Props = {
  title: ReactNode
  amount?: ReactNode
  actions?: {
    primary?: ReactNode
    overflow?: ReactNode
  }
  datiCard?: ReactNode
  categoriaCard?: ReactNode
  collegamentiCard?: ReactNode
  riepilogoCard?: ReactNode // expense only
  transactionsCard?: ReactNode // expense only
}

export function DetailPageShell({
  title,
  amount,
  actions,
  datiCard,
  categoriaCard,
  collegamentiCard,
  riepilogoCard,
  transactionsCard,
}: Props) {
  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Header: title + amount + actions buttons */}
      <header className="border-b pb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{title}</h1>
            {amount && <div className="mt-2 text-lg font-semibold">{amount}</div>}
          </div>
          <div className="flex gap-2">
            {actions?.primary}
            {/* overflow menu with more button */}
          </div>
        </div>
      </header>

      {/* Cards grid */}
      <div className="grid gap-6">
        {datiCard && <div className="card">{datiCard}</div>}
        {categoriaCard && <div className="card">{categoriaCard}</div>}
        {collegamentiCard && <div className="card">{collegamentiCard}</div>}
        {riepilogoCard && <div className="card">{riepilogoCard}</div>}
        {transactionsCard && <div className="card">{transactionsCard}</div>}
      </div>
    </div>
  )
}
```

**Design:** Single-column, mobile-first. No sidebar. Card borders and shadows follow existing shadcn/ui patterns.

---

### `lib/dal/transactions.ts` (extend with getTransactionForDetail)

**Analog:** `lib/dal/expenses.ts::getExpenseById` (lines 260–294)

**Pattern:** Cached DAL function returning typed row with ownership scope (userId + id). Include all fields needed for detail page display: transaction basics, linked expense, category info, pair state.

**Structure**:
```typescript
export const getTransactionForDetail = cache(async (
  { userId, id }: { userId: string; id: string }
): Promise<TransactionDetailRow | undefined> => {
  const rows = await db
    .select({
      id: transaction.id,
      description: transaction.description,
      transactionHash: transaction.transactionHash,
      descriptionHash: transaction.descriptionHash,
      customTitle: transaction.customTitle,
      amount: transaction.amount,
      currency: transaction.currency,
      occurredAt: transaction.occurredAt,
      rowIndex: transaction.rowIndex,
      // Linked expense
      expenseId: expense.id,
      expenseTitle: expense.title,
      expenseStatus: expense.status,
      expenseNotes: expense.notes,
      expenseSubCategoryId: expense.subCategoryId,
      subCategoryName: sql<string | null>`coalesce(${userSubcategoryOverride.customName}, ${subCategory.name})`,
      categoryName: category.name,
      // File/platform context
      fileId: importFile.id,
      fileName: sql<string | null>`coalesce(nullif(trim(coalesce(${importFile.displayName}, '')), ''), ${importFile.originalName})`,
      platformName: platform.name,
      // Pair state
      pairedWithId: sql<string | null>`(SELECT ...subquery...)`,
      pairedAmount: sql<string | null>`(SELECT ...subquery...)`,
    })
    .from(transaction)
    .leftJoin(expense, eq(transaction.expenseId, expense.id))
    .leftJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
    .leftJoin(category, eq(subCategory.categoryId, category.id))
    .leftJoin(
      userSubcategoryOverride,
      and(
        eq(userSubcategoryOverride.subCategoryId, subCategory.id),
        eq(userSubcategoryOverride.userId, userId),
      ),
    )
    .leftJoin(importFile, eq(transaction.fileId, importFile.id))
    .leftJoin(importFormatVersion, eq(importFile.importFormatVersionId, importFormatVersion.id))
    .leftJoin(platform, eq(importFormatVersion.platformId, platform.id))
    .where(and(eq(transaction.id, id), eq(transaction.userId, userId)))
    .limit(1)

  return rows[0]
})

export type TransactionDetailRow = {
  id: string
  description: string
  transactionHash: string
  descriptionHash: string
  customTitle: string | null
  amount: string
  currency: string
  occurredAt: Date
  rowIndex: number
  expenseId: string | null
  expenseTitle: string | null
  expenseStatus: ('1' | '2' | '3' | '4') | null
  expenseNotes: string | null
  expenseSubCategoryId: number | null
  subCategoryName: string | null
  categoryName: string | null
  fileId: string | null
  fileName: string | null
  platformName: string | null
  pairedWithId: string | null
  pairedAmount: string | null
}
```

**Ownership gate:** line with `and(eq(transaction.id, id), eq(transaction.userId, userId))` ensures row is owned.

---

### `lib/dal/expenses.ts` (extend with getExpenseForDetail)

**Analog:** `lib/dal/expenses.ts::getExpenseById` (lines 260–294)

**Pattern:** Fetch expense with all fields + linked transactions table data.

**Type definition**:
```typescript
export type ExpenseDetailRow = ExpenseRow & {
  // Additional for detail view
  transactionsInExpense?: Array<{
    id: string
    description: string
    amount: string
    occurredAt: Date
  }>
}
```

**Query structure** — similar to `getExpenseById` but also select linked transactions:
```typescript
export const getExpenseForDetail = cache(async (
  { userId, id }: { userId: string; id: string }
): Promise<ExpenseDetailRow | undefined> => {
  // First: fetch expense row (same as getExpenseById)
  const expenseRows = await db.select({...}).from(expense)...where(and(...))
  const exp = expenseRows[0]
  if (!exp) return undefined

  // Second: fetch linked transactions
  const txs = await db.select({
    id: transaction.id,
    description: transaction.description,
    amount: transaction.amount,
    occurredAt: transaction.occurredAt,
  }).from(transaction).where(eq(transaction.expenseId, id)).orderBy(asc(transaction.occurredAt))

  return {
    ...exp,
    transactionsInExpense: txs,
  }
})
```

---

### `lib/routes.ts` (add constants)

**Analog:** `lib/routes.ts` (lines 3–15, existing APP_ROUTES object)

**Pattern:** Add route builder functions for detail pages.

**New entries**:
```typescript
export const APP_ROUTES = {
  // ... existing routes ...
  transactionDetail: (id: string) => `/transactions/${encodeURIComponent(id)}` as const,
  expenseDetail: (id: string) => `/expenses/${encodeURIComponent(id)}` as const,
  // File cross-ref (D-16): route through a constant so Phase 64 repoint is one-line
  importFiltered: (fileId: string) => `/import?file=${encodeURIComponent(fileId)}` as const,
} as const
```

Usage in table menu:
```typescript
<Link href={APP_ROUTES.transactionDetail(transaction.id)}>
  Dettagli
</Link>
```

---

### `components/transactions/transaction-table.tsx` (add menu entry)

**Analog:** `components/expenses/expense-table.tsx` (lines 345–352, existing "Dettagli" entry)

**Pattern:** Add a "Dettagli" menu entry to the DropdownMenuContent that navigates to the transaction detail page.

**Current menu location:** lines 545–656 (DropdownMenuContent for each transaction row).

**Change:** After line 545 (<DropdownMenuContent align="end">), add:
```typescript
<DropdownMenuItem asChild>
  <Link href={APP_ROUTES.transactionDetail(transaction.id)}>
    Dettagli
  </Link>
</DropdownMenuItem>
```

Position this entry **first** in the menu (before categorize/pair actions), matching UX of expense table.

**Note:** No other changes to this file; all existing menu items (Ricategorizza, Cerca su Google, Categorizza spesa, Collega/Scollega, Spesa a sé, Elimina) remain unchanged.

---

### `components/expenses/expense-table.tsx` (update menu)

**Analog:** Same file (lines 345–371, current "Dettagli" and "Modifica" entries)

**Current behavior** (lines 345–371):
- "Dettagli" → opens `expense-transactions-dialog` (opens dialog)
- "Modifica" → opens `expense-form-dialog` in edit mode (opens dialog)

**Change** (per CONTEXT.md D-13 and D-14):
- "Dettagli" → **navigate to** `/expenses/[id]` page (replace dialog logic)
- **Delete "Modifica" entry** (edit moves to detail page)

**Implementation**:
```typescript
<DropdownMenuContent align="end">
  {/* NEW: Navigate to detail page */}
  <DropdownMenuItem asChild>
    <Link href={APP_ROUTES.expenseDetail(exp.id)}>
      Dettagli
    </Link>
  </DropdownMenuItem>
  {/* DELETED: Modifica entry removed here */}
  {/* Keep all other entries: Ignora, Elimina */}
  <IgnoreExpenseMenuItem ... />
  <DeleteExpenseMenuItem ... />
</DropdownMenuContent>
```

**Import required:** `Link` from `next/link`, `APP_ROUTES` from `@/lib/routes`.

**Note:** Keep `expense-form-dialog` for "Nuova spesa" (create mode) in the main page. Only the edit mode (mode="edit") entry is removed from the menu.

---

### `components/expenses/expense-form-dialog.tsx` (no change to this phase)

**Analog:** Same file (existing)

**Pattern:** Keep the create mode (mode="create") unchanged. The edit mode (mode="edit") is no longer invoked from the expense table menu; it moves to the detail page.

**Status in Phase 63:** No changes needed. Remains as-is, called from the main expenses page for "Nuova spesa" creation.

**Note:** Phase 64 may use this dialog differently; for Phase 63, it's read-only in scope.

---

### `components/expenses/expense-transactions-dialog.tsx` (delete in Phase 64)

**Analog:** This component itself — source of the linked-transactions table structure

**Status:** Not modified in Phase 63. The logic (linked transactions table, date/description/amount columns, row-link behavior) will be **extracted and lifted** into the `/expenses/[id]` page card in Phase 63.

**Deletion:** Deferred to Phase 64 (after the file detail page reuses the linked-transactions table pattern).

---

## Shared Patterns

### Inline Pencil-Edit (Per-Field Save)

**Source:** `components/transactions/transaction-title-edit.tsx` (lines 1–117), `components/expenses/expense-title-edit.tsx` (lines 1–105)

**Apply to:** All detail page inline field edits (amount, date, title, notes)

**Pattern structure**:
```typescript
'use client'
import { useActionState, useEffect, useRef, useState } from 'react'
import { Pencil } from 'lucide-react'

export function AmountEdit({ id, amount, onSuccess }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(amount)
  const [state, formAction, isPending] = useActionState(updateTransactionAmount, {
    error: null,
  })
  const submittedRef = useRef(false)
  const pendingValueRef = useRef('')

  useEffect(() => {
    if (submittedRef.current && state.error === null) {
      submittedRef.current = false
      setIsEditing(false)
      onSuccess?.(pendingValueRef.current)
    }
  }, [state, onSuccess])

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(amount)
          setIsEditing(true)
        }}
      >
        <span>{formatAmount(amount)}</span>
        <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>
    )
  }

  return (
    <form
      action={(fd) => {
        submittedRef.current = true
        pendingValueRef.current = value
        formAction(fd)
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input
        name="amount"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full rounded border border-input bg-background px-2 py-1 text-sm font-medium"
        autoFocus
        disabled={isPending}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setIsEditing(false)
        }}
      />
      {state.error ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}
      <div className="flex gap-1.5">
        <button type="submit" disabled={isPending}>
          {isPending ? 'Salvo…' : 'Salva'}
        </button>
        <button type="button" onClick={() => setIsEditing(false)}>
          Annulla
        </button>
      </div>
    </form>
  )
}
```

**Key behaviors:**
- `useActionState` for form submission tracking
- `submittedRef` + `pendingValueRef` to capture value at submission
- `useEffect` watches `state.error` — if null, close edit mode and call `onSuccess()`
- Error message renders inline under input
- Enter saves (form submit), Esc/Annulla cancels
- `onSuccess` callback triggers `router.refresh()` at the detail page level (not in component)

---

### Amount Edit with Pair-Guard Error

**Source:** `lib/actions/transaction-edit.ts` (lines 1–53)

**Apply to:** Transaction amount edit specifically (expense amount edit not writable per CONTEXT.md)

**Pattern in action**:
```typescript
'use server'
import { verifySession } from '@/lib/dal/auth'
import { updateTransaction } from '@/lib/services/transaction-edit'
import { UpdateTransactionSchema } from '@/lib/validations/transaction-edit'

export async function updateTransactionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = UpdateTransactionSchema.safeParse({
    id: formData.get('id'),
    amount: formData.get('amount') || undefined,
    occurredAt: formData.get('occurredAt') || undefined,
    customTitle: formData.get('customTitle') || undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { userId } = await verifySession()

  try {
    await updateTransaction({
      userId,
      transactionId: parsed.data.id,
      amount: parsed.data.amount !== undefined 
        ? toDbDecimal(toDecimal(parsed.data.amount.replace(',', '.')))
        : undefined,
      occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : undefined,
      customTitle: parsed.data.customTitle,
    })
  } catch (error) {
    // Service error message (pair-guard, ownership) passed verbatim to caller (D-07)
    return { error: (error as Error).message }
  }

  revalidateCategorizationSurfaces()
  return { error: null }
}
```

**Error handling:** Service throws Italian message (e.g., "Scollega prima il rimborso"). Action catches and returns as-is. Component displays under field, field stays in edit mode.

**Decimal handling:** `replace(',', '.')` for Italian input format, then `toDbDecimal(toDecimal(...))`.

---

### Immutable Field Display (Lock Icon + Tooltip)

**Source:** CONTEXT.md D-03, RESEARCH.md (lines 585–599)

**Apply to:** Description field on transaction detail page (never editable)

**Pattern**:
```typescript
import { Lock } from 'lucide-react'
import { Tooltip } from '@/components/ui/tooltip' // or custom tooltip

export function DescriptionField({ description }: { description: string }) {
  return (
    <div className="flex items-center gap-2 rounded bg-muted p-3">
      <span className="flex-1 text-sm text-muted-foreground">{description}</span>
      <Tooltip content="chiave di riconciliazione bancaria — non modificabile">
        <Lock className="h-4 w-4 text-muted-foreground" />
      </Tooltip>
    </div>
  )
}
```

**Note:** `transactionHash` and `descriptionHash` do NOT appear in the UI at all (immutable by design).

---

### Dialog Invocation from Detail Page

**Source:** `components/transactions/transaction-table.tsx` (lines 531–654, menu dropdown logic), `components/expenses/expense-categorize-dialog.tsx` (lines 1–50, dialog state management)

**Apply to:** Collega/Scollega rimborso, Categorizza, Spesa a sé, Elimina actions on detail pages

**Pattern** — client component wrapping dialogs:
```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CounterpartPickerDialog } from '@/components/transactions/counterpart-picker-dialog'
import { DetachExpenseDialog } from '@/components/transactions/detach-expense-dialog'
import { ExpenseCategorizeDialog } from '@/components/expenses/expense-categorize-dialog'
import { DeleteTransactionDialog } from '@/components/transactions/delete-transaction-dialog'

export function TransactionDetailClient({ transaction }: { transaction: TransactionDetailRow }) {
  const router = useRouter()
  const [isPairOpen, setIsPairOpen] = useState(false)
  const [isDetachOpen, setIsDetachOpen] = useState(false)
  const [isCategorizeOpen, setIsCategorizeOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  async function handlePairSuccess() {
    setIsPairOpen(false)
    router.refresh()
  }

  async function handleCategorizeSuccess() {
    setIsCategorizeOpen(false)
    router.refresh()
  }

  return (
    <>
      <DetailPageShell
        title={...}
        amount={...}
        actions={{
          primary: <button onClick={() => setIsCategorizeOpen(true)}>Cerca su Google</button>,
          overflow: (
            <button onClick={() => setIsPairOpen(true)}>
              {transaction.pairedWithId ? 'Scollega rimborso' : 'Collega rimborso'}
            </button>
          ),
        }}
      />
      
      <CounterpartPickerDialog
        open={isPairOpen}
        onOpenChange={setIsPairOpen}
        transactionId={transaction.id}
        transactionAmount={transaction.amount}
        transactionOccurredAt={transaction.occurredAt}
        onPaired={() => handlePairSuccess()}
      />
      
      {/* Other dialogs follow same pattern */}
    </>
  )
}
```

**Key pattern:**
- State for each dialog (`isOpen`, `setIsOpen`)
- Dialog component rendered at page level (not hidden)
- Button calls `setIsOpen(true)`
- Dialog's `onSuccess` / `onPaired` callback calls `setIsOpen(false)` + `router.refresh()`
- `router.refresh()` is silent (D-08) — no toast, no loading state visible

---

### Ownership Check Pattern (DAL + notFound)

**Source:** `app/(app)/import/[fileId]/suggestions/page.tsx` (lines 1–26), `lib/dal/expenses.ts::getExpenseById` (lines 260–294)

**Apply to:** Both `/transactions/[id]` and `/expenses/[id]` RSC pages

**Pattern**:
```typescript
// app/(app)/transactions/[id]/page.tsx
import { notFound } from 'next/navigation'
import { verifySession } from '@/lib/dal/auth'
import { getTransactionForDetail } from '@/lib/dal/transactions'

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { userId } = await verifySession()

  const tx = await getTransactionForDetail({ userId, id })
  if (!tx) {
    notFound() // Returns 404; no error message leaked
  }

  return <TransactionDetailClient transaction={tx} />
}
```

**DAL side** (in `getTransactionForDetail`):
```typescript
.where(and(eq(transaction.id, id), eq(transaction.userId, userId)))
```

**Key behaviors:**
- Session check via `verifySession()`
- DAL query includes `userId` in WHERE clause
- Query returns `undefined` if not found OR not owned
- Page calls `notFound()` on undefined
- No custom error message (prevents enumeration)

---

## No Analog Found

No files required new patterns that don't exist in the codebase:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| — | — | — | All patterns exist; phase reuses and combines existing components. |

---

## Metadata

**Analog search scope:** 
- `app/(app)/` — dynamic routes with RSC pattern
- `components/` — transactions, expenses, dialogs, edit components
- `lib/dal/` — query patterns with ownership scoping
- `lib/routes.ts` — route constant pattern

**Files scanned:** 8 primary analogs + 2 self-references
**Pattern extraction date:** 2026-07-05

**Coverage Summary:**
- **RSC pages with ownership gate:** 2/2 ✓ (exact match: `/import/[fileId]/suggestions`)
- **Inline pencil-edit components:** 2/2 ✓ (exact matches: `transaction-title-edit`, `expense-title-edit`)
- **Inline error display:** 2/2 ✓ (pattern: useActionState → state.error)
- **Dialog invocation from page:** All existing dialogs reusable ✓
- **DAL ownership-scoped queries:** 2/2 ✓ (exact match: `getExpenseById`)
- **Route constants:** 1/1 ✓ (pattern: `APP_ROUTES.functionName(id)`)
- **Table menu entries:** 2/2 ✓ (pattern: `Link` + `APP_ROUTES.detail(id)`)
- **Amount formatting & Decimal.js:** ✓ (existing in `lib/utils/decimal.ts`)
- **Shared layout shell:** 1/1 (match: `components/layout/app-shell.tsx`)

---
