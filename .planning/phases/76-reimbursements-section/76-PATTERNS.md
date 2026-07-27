# Phase 76: reimbursements-section - Pattern Map

**Mapped:** 2026-07-27  
**Files analyzed:** 11 new/modified files  
**Analogs found:** 10/11 (1 file with new patterns)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app/(app)/reimbursements/page.tsx` | RSC page | CRUD (list read) | `app/(app)/tags/page.tsx` | exact |
| `app/(app)/reimbursements/[id]/page.tsx` | RSC page | CRUD (detail read + IDOR guard) | `app/(app)/tags/[id]/page.tsx` | exact |
| `lib/dal/reimbursement.ts` (getReimbursementList fn) | DAL | CRUD (list query) | `getReimbursementAggregates` in same file | role-match |
| `lib/actions/transaction-pairs.ts` (updateReimbursementTitle action) | server action | request-response | `updateTransactionCustomTitle` in `lib/actions/transactions.ts` | role-match |
| Table status filter config | config | metadata | `DataTableToolbar` + `lib/utils/table-config.ts` | role-match |
| `components/transactions/reimbursement-panel.tsx` (split) | client component | state mgmt | existing `ReimbursementPanel` | self-refactor |
| `components/transactions/reimbursement-row-indicator.tsx` | client component | link/nav | existing `ReimbursementRowIndicator` | self-refactor |
| `components/layout/sidebar.tsx` (add nav item) | client component | nav | existing nav items array | self-refactor |
| `lib/routes.ts` (add routes) | config | routes | existing `tagDetail()` + `APP_ROUTES` | self-refactor |
| `components/tags/tag-detail-report.tsx` | reference layout | presentation | (reference only) | reference |
| `components/transactions/transaction-title-edit.tsx` | reference pattern | client state | (reference only) | reference |

---

## Pattern Assignments

### `app/(app)/reimbursements/page.tsx` (RSC page, CRUD list read)

**Analog:** `app/(app)/tags/page.tsx` (lines 1-23)

**Pattern: RSC list page with verifySession + DAL fetch**

Copy this structure:

```typescript
import { verifySession } from '@/lib/dal/auth'
import { getReimbursementList } from '@/lib/dal/reimbursement'

export const metadata = { title: 'Rimborsi' }

export default async function ReimbursementsPage() {
  const { userId } = await verifySession()
  const reimbursements = await getReimbursementList(userId)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Rimborsi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          [Italian copy here]
        </p>
      </div>

      {/* Reimbursement list component here (data table wrapper) */}
    </div>
  )
}
```

**Key pattern:**
- `verifySession()` establishes userId (no auth check needed after)
- DAL fetch is IDOR-scoped by userId in query
- Minimal RSC, delegates rendering to client component(s)

---

### `app/(app)/reimbursements/[id]/page.tsx` (RSC page, detail with IDOR)

**Analog:** `app/(app)/tags/[id]/page.tsx` (lines 1-55)

**Pattern: IDOR guard → notFound() + detail fetch**

Copy this pattern verbatim:

```typescript
import { notFound } from 'next/navigation'
import { verifySession } from '@/lib/dal/auth'
import { getReimbursement } from '@/lib/dal/reimbursement'
import { getReimbursementPanelData } from '@/lib/dal/reimbursement'
import { parsePositiveIntParam } from '@/lib/utils/search-params'

export const metadata = { title: 'Rimborso' }

type Props = {
  params: Promise<{ id: string }>
}

export default async function ReimbursementDetailPage({ params }: Props) {
  const { userId } = await verifySession()
  const { id } = await params

  const reimbursementId = parsePositiveIntParam(id)
  if (reimbursementId === null) {
    notFound()
  }

  // IDOR boundary: getReimbursement scoped by userId returns null if foreign-owned
  const reimbursement = await getReimbursement(userId, reimbursementId)
  if (reimbursement === null) {
    notFound()
  }

  // Additional detail fetch (panel data, etc.)
  const panelData = await getReimbursementPanelData({
    userId,
    anchor: { transactionId: reimbursement.anchorTransactionId },
  })

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {/* Header: title + status badges + anchor summary */}
        {/* ReimbursementPanel below: full management variant */}
      </div>
    </div>
  )
}
```

**Critical pattern:**
- `parsePositiveIntParam(id)` validates ID is a positive integer
- `getReimbursement(userId, id)` — userId FIRST, id second (IDOR boundary)
- If null, call `notFound()` — never throw or 500
- Only after IDOR guard passes do detail queries run

---

### `lib/dal/reimbursement.ts` → new `getReimbursementList()` function

**Analog:** Existing `getReimbursementAggregates()` (lines 41-84) + structure of `getReimbursementPanelData()` (lines 130-203)

**Pattern: Scoped DAL query with Decimal-safe string returns**

The new function should:

1. Accept `userId: string` (IDOR boundary)
2. Return array of list-row objects with:
   - `id: number` — reimbursementId
   - `title: string` — the explicit reimbursement.title or fall back to anchor description
   - `anchorDescription: string` — the transaction/Expense description (for fallback + anchor column)
   - `anchorDate: Date` — the transaction/Expense occurredAt (for sort-by-date)
   - `outflowSum: string` — raw DECIMAL-as-string (caller will wrap in toDecimal)
   - `refundSum: string` — raw DECIMAL-as-string
   - `residual?: string` — optional, or computed client-side via `computeReimbursementResidual`
   - `state?: ReimbursementResidualState` — optional, or computed client-side

3. Use raw SQL similar to `getReimbursementAggregates()` for performance (one query, not N+1)

4. `WHERE r.user_id = ${userId}` only (IDOR-safe by construction)

5. Order by `anchorDate DESC` (default sort per D-02)

6. Filter to Expense-anchor only (`r.expense_id IS NOT NULL`)

**Reference excerpt from getReimbursementAggregates (lines 52-84):**

```typescript
export async function getReimbursementList(userId: string) {
  const result = await db.execute(sql`
    SELECT
      r.id,
      r.title,
      t.description as anchor_description,
      t.occurred_at as anchor_date,
      (
        CASE
          WHEN r.expense_id IS NOT NULL THEN (
            SELECT e.total_amount::text FROM expense e WHERE e.id = r.expense_id
          )
          ELSE ...
        END
      ) AS outflow_sum,
      (
        SELECT COALESCE(SUM(rt.amount::numeric), 0)::text
        FROM reimbursement_refund rr
        INNER JOIN transaction rt ON rt.id = rr.transaction_id
        WHERE rr.reimbursement_id = r.id
      ) AS refund_sum
    FROM reimbursement r
    INNER JOIN expense e ON e.id = r.expense_id
    INNER JOIN transaction t ON t.id = e.transaction_id
    WHERE r.user_id = ${userId} AND r.expense_id IS NOT NULL
    ORDER BY t.occurred_at DESC
  `)

  return result.rows.map(row => ({
    id: row.id,
    title: row.title,
    anchorDescription: row.anchor_description,
    anchorDate: new Date(row.anchor_date),
    outflowSum: row.outflow_sum,
    refundSum: row.refund_sum,
  }))
}
```

---

### `lib/actions/transaction-pairs.ts` → new `updateReimbursementTitleAction` server action

**Analog:** `updateTransactionCustomTitle()` in `lib/actions/transactions.ts` (lines 117-141)

**Pattern: Server action for single-field update**

```typescript
// At the top of lib/actions/transaction-pairs.ts, add:
import { UpdateReimbursementTitleSchema } from '@/lib/validations/transaction-pairs'
import { updateReimbursementTitle as updateReimbursementTitleDAL } from '@/lib/dal/reimbursement'

export async function updateReimbursementTitleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = UpdateReimbursementTitleSchema.safeParse({
    reimbursementId: formData.get('reimbursementId'),
    title: formData.get('title'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dati non validi.' }
  }

  const { userId } = await verifySession()

  try {
    await updateReimbursementTitleDAL({
      userId,
      reimbursementId: parsed.data.reimbursementId,
      title: parsed.data.title,
    })
  } catch (err) {
    if (err instanceof Error) return { error: err.message }
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }

  revalidatePath('/reimbursements')

  return { error: null }
}
```

**Validation schema** (new, in `lib/validations/transaction-pairs.ts`):

```typescript
export const UpdateReimbursementTitleSchema = z.object({
  reimbursementId: z.coerce.number().int().positive('ID rimborso non valido.'),
  title: z.string().max(255, 'Titolo troppo lungo.'),
})
```

**DAL function** (new, in `lib/dal/reimbursement.ts`):

```typescript
export async function updateReimbursementTitle(input: {
  userId: string
  reimbursementId: number
  title: string
}): Promise<void> {
  const result = await db
    .update(reimbursement)
    .set({ title: input.title })
    .where(and(eq(reimbursement.id, input.reimbursementId), eq(reimbursement.userId, input.userId)))

  if (result.rowCount === 0) {
    throw new Error('Rimborso non trovato.')
  }
}
```

---

### Status filter in unified data table

**Analog:** `DataTableToolbar.tsx` (lines 1-50) + `lib/utils/table-config.ts` (lines 1-50)

**Pattern: Add filter field to table config**

In the reimbursements list config (new file, e.g., `lib/utils/reimbursements-table-config.ts`):

```typescript
import type { TableConfig } from '@/lib/utils/table-config'

export const REIMBURSEMENTS_TABLE_CONFIG: TableConfig = {
  id: 'reimbursements',
  search: { key: 'q', placeholder: 'Cerca per titolo o ancora...' },
  filters: [
    {
      key: 'status',
      label: 'Stato',
      type: 'status',
      options: [
        { value: 'owed', label: 'Da saldare' },
        { value: 'settled', label: 'Saldato' },
        { value: 'surplus', label: 'Surplus' },
      ],
      toChip: (v) => {
        const labels: Record<string, string> = {
          owed: 'Da saldare',
          settled: 'Saldato',
          surplus: 'Surplus',
        }
        return labels[v] ?? v
      },
    },
  ],
  sortable: [
    { key: 'anchorDate', label: 'Data' },
    { key: 'title', label: 'Titolo' },
  ],
  defaultSort: { key: 'anchorDate', dir: 'desc' },
}
```

**In the list page:**

```typescript
import { DataTableToolbar } from '@/components/data-table/DataTableToolbar'
import { REIMBURSEMENTS_TABLE_CONFIG } from '@/lib/utils/reimbursements-table-config'

export default async function ReimbursementsPage() {
  const { userId } = await verifySession()
  const reimbursements = await getReimbursementList(userId)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Rimborsi</h1>
      </div>

      <DataTableToolbar
        config={REIMBURSEMENTS_TABLE_CONFIG}
        route="/reimbursements"
      />

      {/* Render reimbursements list filtered by URL params */}
    </div>
  )
}
```

**Filter logic:** The client component (data table or wrapper) reads URL params (`?status=owed`) and filters the in-memory `reimbursements` array, or the RSC re-fetches with filter params. See `components/transactions/transaction-table.tsx` for the pattern.

---

### `components/transactions/reimbursement-panel.tsx` (split into variants)

**Analog:** Existing `ReimbursementPanel` (lines 80-213) to split

**Pattern: Summary variant (read-only) + full-management variant**

The current `ReimbursementPanel` is full-management (add/remove/delete). Split into:

**1. Summary variant** (for `/transactions/[id]`):

```typescript
type ReimbursementPanelSummaryProps = {
  data: ReimbursementPanelData | undefined
  reimbursementId?: number
}

export function ReimbursementPanelSummary({ data, reimbursementId }: ReimbursementPanelSummaryProps) {
  if (!data) {
    return null // or a CTA "Gestisci rimborsi" link to /reimbursements
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{formatResidualLabel(data.residual, data.state)}</span>
        <Badge variant="outline">{stateBadgeLabel(data.state)}</Badge>
      </div>

      <ul className="flex flex-col gap-2">
        {data.refunds.map((refund) => (
          <li key={refund.id} className="flex items-center justify-between gap-2 text-sm">
            <Link href={transactionDetailHref(refund.id)}>
              {refund.customTitle?.trim() || refund.description}
            </Link>
            <span>{formatAbsoluteAmount(refund.amount)}</span>
          </li>
        ))}
      </ul>

      {/* Call-to-action link to /reimbursements/[id] */}
      <Link href={`/reimbursements/${data.reimbursementId}`}>
        <Button variant="outline" size="sm">Gestisci rimborso</Button>
      </Link>
    </div>
  )
}
```

**2. Full-management variant** (for `/reimbursements/[id]`):

Keep existing `ReimbursementPanel` as-is, rename to `ReimbursementPanelManagement`, or add a `variant` prop to the existing component:

```typescript
type ReimbursementPanelProps = {
  anchor: { transactionId: string } | { groupId: number }
  data: ReimbursementPanelData | undefined
  onAddRefund: () => void
  variant?: 'summary' | 'management' // Add this
}

export function ReimbursementPanel({ data, onAddRefund, variant = 'management' }: ReimbursementPanelProps) {
  if (variant === 'summary') {
    return <ReimbursementPanelSummary data={data} reimbursementId={data?.reimbursementId} />
  }

  // Existing full-management code here
  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      {/* Full management UI with add/remove/delete buttons */}
    </div>
  )
}
```

---

### `components/transactions/reimbursement-row-indicator.tsx` (make it a link)

**Analog:** Existing `ReimbursementRowIndicator` (lines 14-25)

**Pattern: Convert Badge to Link + Badge**

The component currently takes no props. Update it to accept an optional `reimbursementId` and become a link:

```typescript
import Link from 'next/link'
import { Link2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { reimbursementHref } from '@/lib/routes'

type Props = {
  reimbursementId: number
}

export function ReimbursementRowIndicator({ reimbursementId }: Props) {
  return (
    <Link href={reimbursementHref(reimbursementId)}>
      <Badge
        variant="outline"
        className="shrink-0 px-1.5 cursor-pointer hover:bg-muted"
        aria-label="Rimborso collegato"
        title="Clicca per gestire il rimborso"
      >
        <Link2 className="size-3" aria-hidden="true" />
      </Badge>
    </Link>
  )
}
```

**Where called:** In transaction-table rows where `getRefundMembership` is truthy, pass `reimbursementId={membership.reimbursementId}`.

---

### `components/layout/sidebar.tsx` (add "Rimborsi" nav item)

**Analog:** Existing `topNavItems` array (lines 43-51)

**Pattern: Add to nav items array**

```typescript
const topNavItems = [
  { href: APP_ROUTES.dashboard, label: 'Dashboard', icon: LayoutDashboard },
  { href: APP_ROUTES.transactions, label: 'Transazioni', icon: List },
  { href: APP_ROUTES.expenses, label: 'Spese', icon: Receipt },
  // ADD THIS:
  { href: APP_ROUTES.reimbursements, label: 'Rimborsi', icon: Link2 },
  { href: APP_ROUTES.import, label: 'Importazioni', icon: Upload },
  { href: APP_ROUTES.categorySettings, label: 'Categorie', icon: FolderTree },
  { href: APP_ROUTES.tags, label: 'Tag', icon: Tags },
  { href: APP_ROUTES.patterns, label: 'Pattern', icon: Regex },
]
```

Import `Link2` from lucide-react (it's already there for other uses).

Position: after "Spese" (before "Importazioni"), as per D-05 discretion.

---

### `lib/routes.ts` (add reimbursements routes)

**Analog:** Existing `tagDetail()` + `APP_ROUTES` (lines 3-59)

**Pattern: Route constant + href helper**

```typescript
// In APP_ROUTES object, add:
export const APP_ROUTES = {
  dashboard: '/dashboard',
  dashboardOverview: '/dashboard/overview',
  dashboardCategories: '/dashboard/categories',
  expenses: '/expenses',
  import: '/import',
  onboarding: '/onboarding',
  transactions: '/transactions',
  settings: '/settings',
  categorySettings: '/settings/categories',
  tags: '/tags',
  reimbursements: '/reimbursements',  // ADD THIS
  patterns: '/patterns',
  dashboardTags: '/dashboard/tags',
  profile: '/profile',
  profileSettings: '/settings/profile',
} as const

// Below tagDetail(), add:
export function reimbursementHref(id: number | string) {
  return `${APP_ROUTES.reimbursements}/${encodeURIComponent(String(id))}`
}
```

---

## Shared Patterns

### IDOR Guard (apply to all RSC pages)

**Source:** `app/(app)/tags/[id]/page.tsx` lines 16-30

All RSC detail pages must follow this pattern:

```typescript
const { userId } = await verifySession()
const { id } = await params

const resourceId = parsePositiveIntParam(id)
if (resourceId === null) {
  notFound()
}

// Ownership-scoped fetch — userId first parameter
const resource = await getSomething(userId, resourceId)
if (resource === null) {
  notFound()
}
```

### Decimal-safe DAL strings

**Source:** `lib/dal/reimbursement.ts` lines 12-17, 52-84

All DAL queries returning monetary amounts must:
- Use `::text` cast in SQL: `total_amount::text`
- Return type with `string` fields, not `number`
- Comment: "Raw DECIMAL-as-string (Drizzle convention) — callers must go through toDecimal()"
- Let `lib/services` or client-side code wrap in `toDecimal()` before arithmetic

### Server Action pattern

**Source:** `lib/actions/transaction-pairs.ts` lines 52-86 + `lib/actions/transactions.ts` lines 117-141

All server actions:

```typescript
'use server'

export async function myAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // 1. Zod parse
  const parsed = MySchema.safeParse({ ... })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dati non validi.' }
  }

  // 2. verifySession
  const { userId } = await verifySession()

  // 3. Try/catch with DB call
  try {
    await myDALFunction({ userId, ...parsed.data })
  } catch (err) {
    if (err instanceof Error) return { error: err.message }
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }

  // 4. Revalidate paths
  revalidatePath('/path')

  return { error: null }
}
```

---

## No Analog Found

None. All Phase 76 files map to existing analogs or self-refactoring of Phase 75 components.

---

## Metadata

**Analog search scope:**
- `/app/(app)/**/*.tsx` — RSC pages
- `/lib/dal/**/*.ts` — data access layer
- `/lib/actions/**/*.ts` — server actions
- `/lib/routes.ts` — route constants
- `/components/**/*.tsx` — React components
- `/lib/utils/table-config.ts` — table config types
- `/components/data-table/**/*.tsx` — unified table components

**Files scanned:** 12  
**Pattern extraction date:** 2026-07-27

---

*Phase: 76-reimbursements-section*
*This phase RENDERS and MANAGES the already-shipped (Phase 73–75) 1:N reimbursement model. No schema or netting changes. All patterns reuse or split existing, proven Phase 75 code.*
