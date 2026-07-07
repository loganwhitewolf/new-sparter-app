# Phase 64: file-detail-and-navigation - Pattern Map

**Mapped:** 2026-07-06
**Files analyzed:** 6 new/modified files
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/(app)/import/[fileId]/page.tsx` | route/RSC | request-response | `app/(app)/transactions/[id]/page.tsx` | exact |
| `components/import/file-detail-client.tsx` | component/client | request-response | `components/transactions/transaction-detail-client.tsx` | exact |
| `lib/routes.ts` | utility/config | configuration | `lib/routes.ts` (self) | exact |
| `components/import/import-table.tsx` | component/client | CRUD | `components/import/import-table.tsx` (self) | exact |
| `components/transactions/transaction-table.tsx` | component/client | CRUD | `components/transactions/transaction-table.tsx` (self) | exact |
| `components/expenses/expense-table.tsx` | component/client | CRUD | `components/expenses/expense-table.tsx` (self) | exact |

## Pattern Assignments

### `app/(app)/import/[fileId]/page.tsx` (route/RSC, request-response)

**Analog:** `app/(app)/transactions/[id]/page.tsx`

**Imports pattern** (lines 1-6):
```typescript
import { notFound } from 'next/navigation'
import { TransactionDetailClient } from '@/components/transactions/transaction-detail-client'
import { verifySession } from '@/lib/dal/auth'
import { getCategories } from '@/lib/dal/categories'
import { getMostUsedSubcategories } from '@/lib/dal/subcategory-usage'
import { getTransactionForDetail } from '@/lib/dal/transactions'
```

**RSC ownership check + redirect pattern** (lines 8-27):
```typescript
export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { userId } = await verifySession()

  const [tx, categories, mostUsed] = await Promise.all([
    getTransactionForDetail({ userId, id }),
    getCategories(),
    getMostUsedSubcategories(['in', 'out', 'transfer', 'allocation']),
  ])

  if (!tx) {
    notFound()
  }

  return <TransactionDetailClient transaction={tx} categories={categories} mostUsed={mostUsed} />
}
```

**For file detail page, adapt to D-09 redirect for non-imported states:**
- Import `getFileForUser`, `getPlatformIdForUserFile` from `@/lib/dal/files`
- Check file existence, then check `fileRow.status !== 'imported'`
- Redirect non-imported states to their wizard step (e.g., `/import/[fileId]/analyze` for `uploaded`/`analyzing`/`analyzed`/`importing`); `notFound()` for `failed`
- Reference: `/import/[fileId]/suggestions/page.tsx` (lines 9-25) shows the exact redirect map pattern

---

### `components/import/file-detail-client.tsx` (component/client, request-response)

**Analog:** `components/transactions/transaction-detail-client.tsx`

**Client component signature & imports** (lines 1-41):
```typescript
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ExternalLink, MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DetailPageShell } from '@/components/detail-pages/detail-page-shell'
import { ExpenseTitleEdit } from '@/components/expenses/expense-title-edit'
import { categorizeExpense, deleteExpense } from '@/lib/actions/expenses'
import type { ExpenseDetailRow } from '@/lib/dal/expenses'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import type { MostUsedSubcategory } from '@/lib/dal/subcategory-usage'
import { APP_ROUTES, transactionDetailHref } from '@/lib/routes'
import { toDecimal } from '@/lib/utils/decimal'
import { cn } from '@/lib/utils'

type Props = {
  expense: ExpenseDetailRow
  categories: CategoryWithSubCategories[]
  mostUsed: MostUsedSubcategory[]
}
```

**DetailPageShell usage pattern** (from `expense-detail-client.tsx` lines 81-160):
```typescript
export function ExpenseDetailClient({ expense, categories, mostUsed }: Props) {
  const router = useRouter()
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  // ... other state

  const datiCard = (
    <div className="flex flex-col gap-4">
      {/* Core fields: title, notes, etc. */}
    </div>
  )

  const categoriaCard = (
    <div>{/* Category picker card */}</div>
  )

  return (
    <DetailPageShell
      backHref={APP_ROUTES.expenses}
      title={expense.title}
      amount={formatSignedAmount(expense.totalAmount, 'EUR')}
      primaryAction={/* optional button */}
      overflowMenu={/* MoreHorizontal dropdown */}
      datiCard={datiCard}
      categoriaCard={categoriaCard}
      collegamentiCard={collegamentiCard}
    />
  )
}
```

**For file detail page, key differences:**
- No category picker (file has no categorization)
- `displayName` is editable via `ImportDisplayNameEdit` (not a separate edit state machine) — reuse from Phase 64 quick task 260630-gbv
- Actions card: R2 download, suggestions button, delete — lift from `ImportRowActions` (lines 29-100+)
- Transaction preview card: link to `/transactions` filtered by file
- Use `ImportDeleteDialog` on delete (existing, battle-tested)
- Stats card: display readonly fields from `FileRow` (platform, format, import date, row counts, period covered)

---

### `lib/routes.ts` (utility/config, configuration)

**Analog:** `lib/routes.ts` (self)

**Existing route helper pattern** (lines 54-60):
```typescript
export function transactionDetailHref(id: string) {
  return `${APP_ROUTES.transactions}/${encodeURIComponent(id)}`
}

export function expenseDetailHref(id: string) {
  return `${APP_ROUTES.expenses}/${encodeURIComponent(id)}`
}
```

**Add to routes.ts (new helper):**
```typescript
export function importFileDetailHref(fileId: string) {
  return `${APP_ROUTES.import}/${encodeURIComponent(fileId)}`
}
```

**Repoint file cross-ref constant:**
- Currently in `transaction-detail-client.tsx` (line 234): `href={`${APP_ROUTES.import}?fileId=${encodeURIComponent(transaction.fileId)}`}`
- Change to: `href={importFileDetailHref(transaction.fileId)}`
- Same for `expense-detail-client.tsx` if it has a file cross-ref

---

### `components/import/import-table.tsx` (component/client, CRUD)

**Analog:** `components/import/import-table.tsx` (self, extension of existing table)

**Context from lines 1-100:**
- Component already renders import rows with status, platform, amounts, etc.
- `ImportDisplayNameEdit` (line 9) and `ImportRowActions` (line 10) are already imported
- Rows are built in a Table structure with cells and actions

**Title-link wiring (D-04):** In the table cell rendering, make displayName conditional on status:
```typescript
// OLD (current):
<span>{getImportDisplayName(row)}</span>

// NEW (D-04 — title only for imported files):
{row.status === 'imported' ? (
  <Link href={importFileDetailHref(row.id)}>
    {getImportDisplayName(row)}
  </Link>
) : (
  <span>{getImportDisplayName(row)}</span>
)}
```

**"Dettagli" menu entry (D-06):** In the `ImportRowActions` dropdown menu (passed `row` prop), add after the existing menu items:
```typescript
{row.status === 'imported' && (
  <DropdownMenuItem asChild>
    <Link href={importFileDetailHref(row.id)}>
      <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
      Dettagli
    </Link>
  </DropdownMenuItem>
)}
```

Import `importFileDetailHref` from `@/lib/routes` at the top of the file.

---

### `components/transactions/transaction-table.tsx` (component/client, CRUD)

**Analog:** `components/transactions/transaction-table.tsx` (self, extension of existing table)

**File cross-ref repoint (D-05):**
- Search for all uses of `fileId` in the table rendering
- Old pattern: `${APP_ROUTES.import}?fileId=…`
- New pattern: Call `importFileDetailHref(fileId)` from `@/lib/routes`

Import `importFileDetailHref` at the top:
```typescript
import { importFileDetailHref } from '@/lib/routes'
```

Then update any file link in the table to use the new helper.

---

### `components/expenses/expense-table.tsx` (component/client, CRUD)

**Analog:** `components/expenses/expense-table.tsx` (self, extension of existing table)

**File cross-ref repoint (D-05):**
- Same as transaction-table: search for `fileId` references and old `/import?fileId=…` pattern
- Replace with `importFileDetailHref(fileId)`

Import `importFileDetailHref` at the top:
```typescript
import { importFileDetailHref } from '@/lib/routes'
```

---

## Shared Patterns

### DetailPageShell (Header + Card Slots)
**Source:** `components/detail-pages/detail-page-shell.tsx` (lines 1-95)

**Apply to:** `file-detail-client.tsx`

All three detail pages (transaction, expense, file) use the same shell:
```typescript
<DetailPageShell
  backHref={fallbackTableRoute}
  title={displayTitle}
  amount={optional amount display}
  primaryAction={optional primary button}
  overflowMenu={MoreHorizontal dropdown with actions}
  datiCard={core fields}
  categoriaCard={category picker if applicable}
  collegamentiCard={cross-references}
  riepilogoCard={summary stats if applicable}
  transactionsCard={linked items if applicable}
/>
```

Card slots render only when provided, in stacking order: dati, categoria, collegamenti, riepilogo, transactions.

### Inline Pencil Edit Pattern
**Source:** `components/import/import-display-name-edit.tsx` (lines 1-130)

**Apply to:** `file-detail-client.tsx` for `displayName` edit

Reuse `ImportDisplayNameEdit` component as-is:
```typescript
<ImportDisplayNameEdit
  fileId={file.id}
  displayName={file.displayName}
  originalName={file.originalName}
  onSuccess={() => router.refresh()}
/>
```

The component handles:
- Toggling between display and edit mode on pencil click
- Form submission via `updateImportDisplayNameAction`
- Error toast and inline error display
- Callback on successful save

### Row Actions (Download, Delete, Suggestions)
**Source:** `components/import/import-row-actions.tsx` (lines 1-100+)

**Apply to:** `file-detail-client.tsx` header actions

Lift the relevant actions from `ImportRowActions` into the file detail page:
- **Download (Scarica file):** `handleDownload()` calls `/api/files/{fileId}/download` and opens presigned URL
- **Delete (Elimina):** Open `ImportDeleteDialog` with callback to redirect to `/import` on success
- **Suggestions (Suggerimenti):** Link or button to `/import/{fileId}/suggestions` (conditional: only shown if `discoveryResult` has candidates)

### Delete Dialog (with Impact Summary)
**Source:** `components/import/import-delete-dialog.tsx` (lines 1-229)

**Apply to:** `file-detail-client.tsx`

Reuse `ImportDeleteDialog` component:
```typescript
const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

<ImportDeleteDialog
  importRow={fileRow} // FileRow cast to ImportListRow shape, or adapt
  open={deleteDialogOpen}
  onOpenChange={setDeleteDialogOpen}
  onDeleted={(fileId) => {
    toast.success('Importazione eliminata.')
    router.push(APP_ROUTES.import) // Redirect to import list with toast
  }}
/>
```

The dialog handles:
- Confirmation UI with impact preview
- `previewImportDeletionAction` to fetch linked transaction count
- `deleteImportAction` to perform the delete
- Error handling and toast notifications

### Authentication & Ownership Check
**Source:** `app/(app)/transactions/[id]/page.tsx` (lines 1-14) + `lib/dal/files.ts` (lines 56-67)

**Apply to:** `app/(app)/import/[fileId]/page.tsx`

RSC pattern:
1. Await `verifySession()` to get `userId`
2. Call `getFileForUser({ userId, fileId })` — DAL handles ownership check via `where(eq(file.userId, userId))`
3. If null, call `notFound()` (404)
4. If status !== 'imported', redirect via `redirect(stepRoute)` or `notFound()`
5. Pass file row to client component

---

## No Analog Found

All six files have close analogs within the existing codebase (Phase 63 detail pages, existing import table/actions, routes.ts helpers). No files require RESEARCH.md patterns as a fallback.

---

## Metadata

**Analog search scope:**
- `app/(app)/transactions/[id]/` and `app/(app)/expenses/[id]/` (RSC + client component pattern)
- `components/detail-pages/` (shared shell component)
- `components/import/` (inline edit, row actions, delete dialogs)
- `components/transactions/` and `components/expenses/` (table components)
- `lib/routes.ts` (route helpers)
- `lib/dal/files.ts` (ownership query pattern)

**Files scanned:** 12 primary analogs + 5 supporting references

**Pattern extraction date:** 2026-07-06

---

*Phase: 64-file-detail-and-navigation*
*Context locked: 2026-07-05*
*Patterns mapped: 2026-07-06*
