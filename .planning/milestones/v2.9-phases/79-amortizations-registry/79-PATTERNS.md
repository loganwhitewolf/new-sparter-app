# Phase 79: amortizations-registry - Pattern Map

**Mapped:** 2026-07-28
**Files analyzed:** 9 (5 new, 2 modify, 2 reuse)
**Analogs found:** 4 / 5 new files

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/dal/amortization.ts` | service (DAL) | CRUD (read-only list) | `lib/dal/reimbursement.ts` (getReimbursementList) | exact |
| `app/(app)/amortizations/page.tsx` | page (RSC) | request-response | `app/(app)/reimbursements/page.tsx` | exact |
| `components/amortizations/amortization-table.tsx` | component | request-response (client) | `components/reimbursements/reimbursement-table.tsx` | exact |
| `components/amortizations/amortization-summary-header.tsx` | component | request-response (client) | `components/dashboard/overview-card.tsx` or reimbursement residual pattern | partial |
| `lib/utils/amortizations-table-config.ts` | config | config-static | `lib/utils/reimbursements-table-config.ts` | exact |
| `lib/routes.ts` | config (modify) | config-static | existing pattern in same file | exact |
| `components/layout/sidebar.tsx` | component (modify) | request-response | existing pattern in same file | exact |
| `components/transactions/close-amortization-dialog.tsx` | component (reuse) | request-response | N/A (already exists Phase 78) | exact |
| `lib/actions/amortization-lifecycle.ts` | action (reuse) | request-response | N/A (already exists Phase 78, closePlanAction) | exact |

---

## Pattern Assignments

### `lib/dal/amortization.ts` (DAL service, CRUD read-only list)

**Analog:** `lib/dal/reimbursement.ts` (lines 493–551: getReimbursementList)

**Imports pattern** (lines 1–12 from analog):
```typescript
import 'server-only'

import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
// Import schema tables, e.g.:
import { amortizationPlan, amortizationInstalment, transaction } from '@/lib/db/schema'
// No services/utils imports unless needed for type transforms (toDecimal, etc. at call site)
```

**Type export** (lines 453–465 from analog, adapted to amortizations):
```typescript
/**
 * One row of the `/amortizations` list (Phase 79 REG-01/REG-02).
 * All monetary amounts are DECIMAL-as-string (Drizzle convention);
 * callers must use toDecimal() before arithmetic.
 */
export type AmortizationPlanListRow = {
  id: string                    // plan UUID
  planId: string                // redundant with id, or omit if not needed
  transactionId: string         // FK to anchor transaction (for row navigation)
  description: string           // from transaction.description
  transactionDate: Date         // from transaction.occurredAt
  initialAmount: string         // DECIMAL-as-string (= plan.totalAmount)
  consumedAmount: string        // DECIMAL-as-string (sum of past instalments)
  netValue: string              // DECIMAL-as-string (initial - consumed)
  remainingMonths: number       // count of future instalments
  totalMonths: number           // plan.months
  status: 'open' | 'closed'     // from plan.status
}
```

**Core DAL pattern** (lines 493–520 from analog, adapted to amortization schema):
```typescript
/**
 * Lists every amortization plan for `userId`, Expense-anchored only.
 * Ordered by remaining months ascending (D-C2), then plan.id ASC for determinism.
 *
 * Written as raw SQL with explicit table aliases (`p.`, `ai.`, `t.`) to avoid
 * ambiguous bare-column-name bugs (both amortizationPlan and amortizationInstalment
 * tables have `id` and `user_id` columns). Same pattern as getReimbursementList.
 *
 * IDOR-safe by construction: WHERE p.user_id = ${userId} scoped server-side
 * from verifySession(), never from client-supplied filter.
 */
export async function getAmortizationPlanList(userId: string): Promise<AmortizationPlanListRow[]> {
  const result = await db.execute(sql`
    SELECT
      p.id,
      p.id AS plan_id,
      t.id AS transaction_id,
      t.description,
      t.occurred_at AS transaction_date,
      p.total_amount AS initial_amount,
      COALESCE(
        (
          SELECT SUM(ai2.amount::numeric)::text
          FROM amortization_instalment ai2
          WHERE ai2.plan_id = p.id AND ai2.occurred_at < CURRENT_DATE
        ),
        '0.00'
      ) AS consumed_amount,
      (
        p.total_amount::numeric -
        COALESCE(
          (
            SELECT SUM(ai3.amount::numeric)
            FROM amortization_instalment ai3
            WHERE ai3.plan_id = p.id AND ai3.occurred_at < CURRENT_DATE
          ),
          0
        )
      )::text AS net_value,
      (
        SELECT COUNT(*)
        FROM amortization_instalment ai4
        WHERE ai4.plan_id = p.id AND ai4.occurred_at >= CURRENT_DATE
      ) AS remaining_months,
      p.months AS total_months,
      p.status
    FROM amortization_plan p
    INNER JOIN transaction t ON t.id = p.transaction_id
    WHERE p.user_id = ${userId}
    ORDER BY
      (SELECT COUNT(*) FROM amortization_instalment ai5 WHERE ai5.plan_id = p.id AND ai5.occurred_at >= CURRENT_DATE) ASC,
      p.id ASC
  `)

  const rows = result.rows as {
    id: string
    plan_id: string
    transaction_id: string
    description: string
    transaction_date: string
    initial_amount: string
    consumed_amount: string
    net_value: string
    remaining_months: number
    total_months: number
    status: string
  }[]

  return rows.map((row) => ({
    id: row.id,
    planId: row.plan_id,
    transactionId: row.transaction_id,
    description: row.description,
    transactionDate: new Date(row.transaction_date),
    initialAmount: row.initial_amount,
    consumedAmount: row.consumed_amount,
    netValue: row.net_value,
    remainingMonths: row.remaining_months,
    totalMonths: row.total_months,
    status: row.status as 'open' | 'closed',
  }))
}
```

**Key decision notes:**
- All amounts are returned as `string` (DECIMAL convention in Drizzle); callers use `toDecimal()` for arithmetic.
- `consumed_amount` is explicitly `SUM WHERE occurredAt < CURRENT_DATE`, not derived as `initial - net`. This matches Phase 78's closure semantics (Pitfall 3 in research).
- CURRENT_DATE is the canonical definition of "today" for consistency with the database netting logic.

---

### `app/(app)/amortizations/page.tsx` (RSC page, request-response)

**Analog:** `app/(app)/reimbursements/page.tsx` (lines 1–40)

**Page structure** (exact pattern from analog, adapted to amortizations):
```typescript
import { verifySession } from '@/lib/dal/auth'
import { getAmortizationPlanList } from '@/lib/dal/amortization'
import { EmptyState } from '@/components/data-table/EmptyState'
import { AmortizationTable } from '@/components/amortizations/amortization-table'
import { AmortizationSummaryHeader } from '@/components/amortizations/amortization-summary-header'
import { APP_ROUTES } from '@/lib/routes'

export const metadata = { title: 'Ammortamenti' }

/**
 * RSC list page (Phase 79, REG-01): DB -> DAL -> real page.
 * Zero-amortization accounts render the account-level EmptyState('no-data') here;
 * a non-empty fetch mounts the summary header + full interactive AmortizationTable
 * (search/status filter/sort), which owns its own filtered-to-zero EmptyState('no-result') internally.
 */
export default async function AmortizationsPage() {
  const { userId } = await verifySession()
  const plans = await getAmortizationPlanList(userId)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ammortamenti</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tutte le rate dei tuoi ammortamenti.
        </p>
      </div>

      {plans.length === 0 ? (
        <EmptyState
          variant="no-data"
          message="Nessun ammortamento"
          hint="Non hai ancora nessun ammortamento attivo. Quando ammortizzerai una spesa, vedrai qui tutte le tue rate."
        />
      ) : (
        <>
          <AmortizationSummaryHeader plans={plans} />
          <AmortizationTable plans={plans} route={APP_ROUTES.amortizations} />
        </>
      )}
    </div>
  )
}
```

**Key decisions:**
- Page title in metadata: `'Ammortamenti'` (Italian product surface).
- Summary header mounts ONLY when `plans.length > 0` (not in the empty state).
- Both RSC and table use `APP_ROUTES.amortizations` (to be added to `lib/routes.ts`).

---

### `components/amortizations/amortization-table.tsx` (component, request-response client)

**Analog:** `components/reimbursements/reimbursement-table.tsx` (lines 1–155)

**Imports pattern** (lines 1–15 from analog, adapted):
```typescript
'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { toDecimal } from '@/lib/utils/decimal'
import { amountToneClass } from '@/lib/utils/amount-tone'
import { DataTableToolbar, useToolbarSort } from '@/components/data-table/DataTableToolbar'
import { EmptyState } from '@/components/data-table/EmptyState'
import { HeaderSortButton } from '@/components/data-table/HeaderSortButton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AMORTIZATIONS_TABLE_CONFIG } from '@/lib/utils/amortizations-table-config'
import { transactionDetailHref } from '@/lib/routes'
import type { AmortizationPlanListRow } from '@/lib/dal/amortization'
import { CloseAmortizationDialog } from '@/components/transactions/close-amortization-dialog'
```

**Props and core pattern** (lines 17–64 from analog, adapted):
```typescript
type Props = {
  plans: AmortizationPlanListRow[]
  route: string
}

/**
 * Pure sort helper (unit-testable without jsdom).
 * Numeric keys use Decimal.comparedTo() for precision; string keys use localeCompare.
 * Ties preserve input order (stable sort).
 */
export function sortAmortizationRows(
  rows: AmortizationPlanListRow[],
  sort: string,
  dir: 'asc' | 'desc',
): AmortizationPlanListRow[] {
  const factor = dir === 'asc' ? 1 : -1

  return [...rows].sort((a, b) => {
    if (sort === 'description') {
      return factor * a.description.localeCompare(b.description)
    }
    if (sort === 'initialAmount') {
      return factor * toDecimal(a.initialAmount).comparedTo(toDecimal(b.initialAmount))
    }
    if (sort === 'consumedAmount') {
      return factor * toDecimal(a.consumedAmount).comparedTo(toDecimal(b.consumedAmount))
    }
    if (sort === 'netValue') {
      return factor * toDecimal(a.netValue).comparedTo(toDecimal(b.netValue))
    }
    if (sort === 'remainingMonths') {
      return factor * (a.remainingMonths - b.remainingMonths)
    }
    // 'transactionDate' (default)
    return factor * (a.transactionDate.getTime() - b.transactionDate.getTime())
  })
}

export function AmortizationTable({ plans, route }: Props) {
  const searchParams = useSearchParams()
  const { activeSort, activeDir, onSort } = useToolbarSort(route)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)

  const q = searchParams.get('q')?.trim().toLowerCase() ?? ''
  const status = searchParams.get('status')  // 'open' | 'closed' | undefined

  // Client-side filter: by status (if specified) and search query (description match)
  const filtered = plans.filter((row) => {
    if (status && row.status !== status) return false
    if (q && !row.description.toLowerCase().includes(q)) return false
    return true
  })

  // Client-side sort
  const sortKey = activeSort ?? AMORTIZATIONS_TABLE_CONFIG.defaultSort.key
  const sortDir = activeSort ? activeDir : AMORTIZATIONS_TABLE_CONFIG.defaultSort.dir
  const sorted = sortAmortizationRows(filtered, sortKey, sortDir)

  function handleOpenDialog(planId: string) {
    setSelectedPlanId(planId)
    setDialogOpen(true)
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <DataTableToolbar config={AMORTIZATIONS_TABLE_CONFIG} route={route} />

        {sorted.length === 0 ? (
          <EmptyState variant="no-result" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <HeaderSortButton
                  column={{ key: 'description', label: 'Descrizione' }}
                  activeSort={activeSort}
                  activeDir={activeDir}
                  onSort={onSort}
                />
                <HeaderSortButton
                  column={{ key: 'transactionDate', label: 'Data' }}
                  activeSort={activeSort}
                  activeDir={activeDir}
                  onSort={onSort}
                />
                <HeaderSortButton
                  column={{ key: 'initialAmount', label: 'Importo iniziale' }}
                  activeSort={activeSort}
                  activeDir={activeDir}
                  align="right"
                  onSort={onSort}
                />
                <HeaderSortButton
                  column={{ key: 'consumedAmount', label: 'Consumato' }}
                  activeSort={activeSort}
                  activeDir={activeDir}
                  align="right"
                  onSort={onSort}
                />
                <HeaderSortButton
                  column={{ key: 'netValue', label: 'Netto' }}
                  activeSort={activeSort}
                  activeDir={activeDir}
                  align="right"
                  onSort={onSort}
                />
                <HeaderSortButton
                  column={{ key: 'remainingMonths', label: 'Rate rimanenti' }}
                  activeSort={activeSort}
                  activeDir={activeDir}
                  onSort={onSort}
                />
                <TableHead>Stato</TableHead>
                <TableHead>Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-0 w-full">
                    <Link
                      href={transactionDetailHref(row.transactionId)}
                      className="block truncate text-sm font-medium hover:underline"
                      title={row.description}
                    >
                      {row.description}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {row.transactionDate.toLocaleDateString('it-IT')}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right font-mono tabular-nums text-sm">
                    {formatCurrency(row.initialAmount)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right font-mono tabular-nums text-sm">
                    {formatCurrency(row.consumedAmount)}
                  </TableCell>
                  <TableCell
                    className={`whitespace-nowrap text-right font-mono tabular-nums text-sm ${amountToneClass(row.netValue)}`}
                  >
                    {formatCurrency(row.netValue)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-center text-sm">
                    <div className="flex flex-col gap-1">
                      <span>{row.remainingMonths}/{row.totalMonths}</span>
                      <ProgressBar consumed={row.totalMonths - row.remainingMonths} total={row.totalMonths} />
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant={row.status === 'open' ? 'default' : 'secondary'}>
                      {row.status === 'open' ? 'Aperto' : 'Chiuso'}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right text-sm">
                    {row.status === 'open' && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenDialog(row.id)}
                        >
                          Chiudi
                        </Button>
                        <Link href={transactionDetailHref(row.transactionId)}>
                          <Button size="sm" variant="outline">
                            Realizza con vendita
                          </Button>
                        </Link>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedPlanId && (
        <CloseAmortizationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          planId={selectedPlanId}
          onSuccess={() => {
            setDialogOpen(false)
            // Revalidate/refresh list via route revalidation or SWR hook
          }}
        />
      )}
    </>
  )
}

// Helper: format currency with it-IT locale
const amountFormatter = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
function formatCurrency(value: string): string {
  const amount = Number(value)
  if (!Number.isFinite(amount)) {
    return `${value} EUR`
  }
  return amountFormatter.format(amount)
}

// Helper: render a light progress bar for months consumed
function ProgressBar({ consumed, total }: { consumed: number; total: number }) {
  const percentage = (consumed / total) * 100
  return (
    <div className="h-1.5 w-full bg-muted rounded overflow-hidden">
      <div className="h-full bg-primary" style={{ width: `${percentage}%` }} />
    </div>
  )
}
```

**Key decisions:**
- Dialog state is managed locally (open/close + selectedPlanId) to avoid full page refetch.
- On `onSuccess()` callback, the planner must wire route revalidation or SWR refetch.
- `max-w-0 w-full` + inner `truncate` pattern on description cell prevents horizontal scroll.
- Actions appear ONLY for open plans (`row.status === 'open'`).
- Progress bar is a simple visual indicator (custom ProgressBar helper component).

---

### `components/amortizations/amortization-summary-header.tsx` (component, request-response client)

**Analog:** KPI summary card pattern (derived from dashboard overview and reimbursement table pattern)

**Component structure**:
```typescript
'use client'

import { toDecimal } from '@/lib/utils/decimal'
import type { AmortizationPlanListRow } from '@/lib/dal/amortization'

const amountFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
})

/**
 * D-B1 summary header: single aggregate metric — total open net residual.
 * Computed client-side from filtered (open) plans using Decimal.js.
 *
 * Fallback on non-finite/failed arithmetic: display raw value suffixed with EUR
 * (mirrors formatAbsoluteAmount convention — surfaces bugs visibly).
 */
export function AmortizationSummaryHeader({ plans }: { plans: AmortizationPlanListRow[] }) {
  // Sum of netValue across all OPEN plans only
  const totalOpenResidual = plans
    .filter((p) => p.status === 'open')
    .reduce((sum, p) => sum.plus(toDecimal(p.netValue)), toDecimal('0'))

  const formattedAmount = (() => {
    const amount = Number(totalOpenResidual.toFixed(2))
    if (!Number.isFinite(amount)) {
      return `${totalOpenResidual.toString()} EUR`
    }
    return amountFormatter.format(amount)
  })()

  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">Netto residuo aperto</p>
      <p className="text-2xl font-semibold tracking-tight">{formattedAmount}</p>
    </div>
  )
}
```

**Key decisions:**
- Computed client-side (not server-side) from the already-fetched `plans` array.
- Filters to `status === 'open'` only; closed plans do not contribute to the residual.
- Uses `Decimal.js` (`toDecimal()` + `.plus()`) for precision.
- Fallback formatting (`${value} EUR`) surfaces upstream bugs visibly.

---

### `lib/utils/amortizations-table-config.ts` (config, static)

**Analog:** `lib/utils/reimbursements-table-config.ts` (lines 1–44)

**Full file content**:
```typescript
import type { TableConfig } from '@/lib/utils/table-config'

const STATUS_LABELS: Record<string, string> = {
  open: 'Aperto',
  closed: 'Chiuso',
}

/**
 * Declarative table config for the Amortizations list (Phase 79, REG-01).
 * Consumed by DataTableToolbar — defines search, the status filter, sortable columns, and
 * defaultSort. Filtering/sorting here narrows the already-fetched `plans` row set
 * client-side (AmortizationTable), never a fresh server round-trip.
 *
 * Field inventory:
 *   - search: q (displayed description substring)
 *   - status: select (open/closed, D-C1 — allows viewing closed plans, though default is open-only)
 *   - sortable: description, transactionDate, initialAmount, consumedAmount, netValue, remainingMonths
 *   - defaultSort: remainingMonths ASC (D-C2 — plans closest to completion on top)
 */
export const AMORTIZATIONS_TABLE_CONFIG: TableConfig = {
  id: 'amortizations',
  search: { key: 'q', placeholder: 'Cerca per descrizione…' },
  filters: [
    {
      key: 'status',
      label: 'Stato',
      type: 'status',
      options: [
        { value: 'open', label: 'Aperto' },
        { value: 'closed', label: 'Chiuso' },
      ],
      toChip: (v) => STATUS_LABELS[v] ?? v,
    },
  ],
  sortable: [
    { key: 'remainingMonths', label: 'Rate rimanenti' },
    { key: 'description', label: 'Descrizione' },
    { key: 'transactionDate', label: 'Data' },
    { key: 'initialAmount', label: 'Importo iniziale' },
    { key: 'consumedAmount', label: 'Consumato' },
    { key: 'netValue', label: 'Netto' },
  ],
  defaultSort: { key: 'remainingMonths', dir: 'asc' },
}
```

**Key decisions:**
- `defaultSort: { key: 'remainingMonths', dir: 'asc' }` — D-C2 requirement (plans closest to completion first).
- Status filter offers both options (`open` / `closed`) but note that the page/table should **default to open-only** via a client-side filter in `AmortizationTable` (see table component notes).
- All sortable keys match column names in the DAL and table component.

---

## Route Constants & Navigation Patterns

### `lib/routes.ts` — Add these constants and helper

**Location in file:** After the existing `APP_ROUTES` object and alongside `reimbursementHref`:

```typescript
// Add to APP_ROUTES:
export const APP_ROUTES = {
  // ... existing routes ...
  amortizations: '/amortizations',
  // ... rest ...
} as const

// Add helper function (near reimbursementHref, line ~62):
export function amortizationDetailHref(planId: string) {
  return `${APP_ROUTES.amortizations}/${encodeURIComponent(planId)}`
}
```

**Note:** The `/amortizations/[id]` plan detail page is deferred (D-D1). The `amortizationDetailHref` helper is provided for consistency and future use, but row clicks navigate to the transaction detail page via `transactionDetailHref(transactionId)` instead.

---

### `components/layout/sidebar.tsx` — Add navigation entry

**Location in file:** Near the `/reimbursements` entry in the sidebar nav items array.

**Pattern:**
```typescript
// Add to the main nav items (in the authenticated app section):
{
  href: APP_ROUTES.amortizations,
  label: 'Ammortamenti',
  icon: Wallet2,  // or another Lucide icon (DollarSign, TrendingUp, etc.)
}
```

**Key decision:** Placement near `/reimbursements` makes sense (both are financial planning surfaces). Icon choice left to UI phase.

---

## Reused Components & Actions

### `components/transactions/close-amortization-dialog.tsx` (REUSE)

**Status:** Already exists (Phase 78)  
**Usage in Phase 79:** The `AmortizationTable` component (above) mounts this dialog when the user clicks "Chiudi" on an open plan row.

**Props expected:**
```typescript
type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  planId: string
  onSuccess: () => void  // called after successful close
}
```

**No changes needed.** The dialog calls `closePlanAction({ planId })` internally and emits `onSuccess()` on successful completion.

---

### `lib/actions/amortization-lifecycle.ts` — `closePlanAction` (REUSE)

**Status:** Already exists (Phase 78, lines 25–49)  
**Usage in Phase 79:** The `CloseAmortizationDialog` calls this server action.

**Function signature:**
```typescript
export async function closePlanAction(input: { planId: string }): Promise<ClosePlanActionResult>
// where ClosePlanActionResult = { error: string | null }
```

**No changes needed.** Already IDOR-guarded (verifySession scopes to userId), validates via `ClosePlanSchema`, and revalidates categorization surfaces.

---

## Shared Patterns

### Decimal.js for Monetary Arithmetic

**Apply to:** All monetary amounts in new components and DAL

**Pattern** (from `components/amortizations/amortization-table.tsx` and `components/amortizations/amortization-summary-header.tsx`):
```typescript
import { toDecimal } from '@/lib/utils/decimal'

// In sort helper:
return factor * toDecimal(a.initialAmount).comparedTo(toDecimal(b.initialAmount))

// In summary KPI:
const total = plans
  .filter(...)
  .reduce((sum, p) => sum.plus(toDecimal(p.netValue)), toDecimal('0'))
```

**Why:** DECIMAL columns from Drizzle are strings; `toDecimal()` converts to `Decimal` for safe arithmetic. Never use `Number(string) + Number(string)` for money.

---

### Currency Formatting (it-IT locale)

**Apply to:** All monetary display in table cells and summary KPI

**Pattern:**
```typescript
const formatter = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
const formatted = formatter.format(Number(decimalString))

// Fallback on non-finite:
if (!Number.isFinite(amount)) return `${value} EUR`
```

**Why:** Matches product language (Italian) and existing pattern (see `formatAbsoluteAmount` in `lib/utils/format-amount.ts`).

---

### Session Verification & IDOR Safety

**Apply to:** `lib/dal/amortization.ts`

**Pattern** (from `lib/dal/reimbursement.ts`):
```typescript
// In RSC page:
const { userId } = await verifySession()

// In DAL query:
WHERE p.user_id = ${userId}
```

**Why:** IDOR-safe by construction — the WHERE clause is scoped server-side from the verified session, never from client-supplied filter.

---

### Empty State Variants

**Apply to:** `app/(app)/amortizations/page.tsx` and `components/amortizations/amortization-table.tsx`

**Pattern:**
```typescript
// No plans at all:
<EmptyState
  variant="no-data"
  message="Nessun ammortamento"
  hint="Non hai ancora nessun ammortamento attivo..."
/>

// Filter/search yields no results:
<EmptyState variant="no-result" />
```

**Why:** Mirrors the reimbursements pattern and distinguishes "user has no plans" from "current filter is empty."

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `components/amortizations/amortization-summary-header.tsx` | component | request-response | KPI card is a new surface (D-B1 design); pattern is derived from reimbursement residual + dashboard KPI conventions, not a direct copy. |

---

## Metadata

**Analog search scope:** `lib/dal/`, `app/(app)/`, `components/`, `lib/actions/`, `lib/utils/`  
**Files scanned:** 50+ (reimbursements, actions, schemas, utilities)  
**Pattern extraction date:** 2026-07-28

**Coverage:**
- Files with exact analog: 4/5 new files
- Files with partial analog (pattern derived, not direct copy): 1/5
- Files with reuse: 2/9 total
- Files with modification: 2/9 total

---

*Phase: 79-amortizations-registry*  
*Pattern mapping complete. Ready for `/gsd-plan-phase 79`.*
