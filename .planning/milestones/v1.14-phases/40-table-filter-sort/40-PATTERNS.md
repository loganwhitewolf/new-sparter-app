# Phase 40: table-filter-sort — Pattern Map

**Mapped:** 2026-06-04
**Files analyzed:** 16
**Analogs found:** 16 / 16

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/utils/table-config.ts` | utility | transform | `lib/validations/transactions.ts` (type shapes) | role-match |
| `lib/utils/search-params.ts` | utility | request-response | `lib/validations/transactions.ts` (`parseTransactionFilters`) | exact |
| `components/data-table/DataTableToolbar.tsx` | component | request-response | `components/transactions/transaction-filters.tsx` + `app/proto/table-toolbar/variant-a.tsx` | exact |
| `components/data-table/MonthMultiPicker.tsx` | component | request-response | `app/proto/table-toolbar/shared.tsx` (`MonthPicker`) | exact |
| `components/data-table/AmountRangePicker.tsx` | component | request-response | `app/proto/table-toolbar/shared.tsx` (`AmountRange`) | exact |
| `components/data-table/HeaderSortButton.tsx` | component | request-response | `app/proto/table-toolbar/shared.tsx` (`SortableHead`) | exact |
| `lib/dal/months-with-data.ts` | dal | CRUD | `lib/dal/transactions.ts` (`cache` + `verifySession` pattern) | role-match |
| `app/(app)/transactions/transactions.table.ts` | config | transform | `app/proto/table-toolbar/shared.tsx` (State shape) | role-match |
| `app/(app)/expenses/expenses.table.ts` | config | transform | `app/proto/table-toolbar/shared.tsx` (State shape) | role-match |
| `app/(app)/import/files.table.ts` | config | transform | `app/proto/table-toolbar/shared.tsx` (State shape) | role-match |
| `lib/dal/transactions.ts` (modify) | dal | CRUD | itself | exact |
| `lib/dal/expenses.ts` (modify) | dal | CRUD | itself | exact |
| `lib/dal/imports.ts` (modify) | dal | CRUD | itself | exact |
| `app/(app)/transactions/page.tsx` (modify) | page | request-response | itself | exact |
| `app/(app)/expenses/page.tsx` (modify) | page | request-response | itself | exact |
| `app/(app)/import/page.tsx` (modify) | page | request-response | itself | exact |

---

## Pattern Assignments

### `lib/utils/search-params.ts` (utility, request-response)

**Analog:** `lib/validations/transactions.ts` lines 56–175

**Imports pattern** (lines 1–3):
```ts
import { z } from 'zod'
```

**`firstTrimmed` helper** (lines 84–89):
```ts
function firstTrimmed(value: string | string[] | undefined): string | undefined {
  const rawValue = Array.isArray(value) ? value[0] : value
  const trimmed = rawValue?.trim()
  return trimmed ? trimmed : undefined
}
```

**Core parse function signature** (lines 141–143):
```ts
export function parseTransactionFilters(
  input: TransactionSearchParams,  // Record<string, string | string[] | undefined>
): ParsedTransactionFilters {
```

**Slug / UUID allowlist guards** (lines 165–169):
```ts
...(platform && PLATFORM_SLUG_RE.test(platform) ? { platform } : {}),
...(importId ? { importId } : {}),
...(name ? { name } : {}),
...(categorySlug ? { categorySlug } : {}),
```

**New `months` param** must parse `"2026-04,2026-05"` → `string[]`. Pattern:
```ts
const YEAR_MONTH_RE = /^\d{4}-(?:0[1-9]|1[0-2])$/
function parseMonths(value: string | string[] | undefined): string[] {
  const raw = firstTrimmed(value)
  if (!raw) return []
  return raw.split(',').filter((m) => YEAR_MONTH_RE.test(m.trim())).map((m) => m.trim())
}
```

**Amount range params** — parse `amountMin`/`amountMax` as non-negative numerics:
```ts
const rawAmountMin = firstTrimmed(input.amountMin)
const amountMin = rawAmountMin && /^\d+(\.\d+)?$/.test(rawAmountMin) ? rawAmountMin : undefined
```

---

### `lib/utils/table-config.ts` (utility, transform)

**Analog:** `lib/validations/transactions.ts` type section + `app/proto/table-toolbar/shared.tsx` State/SortKey types

**Types to declare** (from CONTEXT.md D-66, confirmed by prototype State shape):
```ts
export type FilterFieldType =
  | 'text'
  | 'select'
  | 'multi-select'
  | 'month-multi'
  | 'amount-range'
  | 'status'

export type FilterField = {
  key: string
  label: string
  type: FilterFieldType
  options?: { value: string; label: string }[]
  /** Converts raw URL value to display chip label */
  toChip: (v: string) => string
}

export type SortColumn = {
  key: string
  label: string
}

export type TableConfig = {
  id: 'transactions' | 'expenses' | 'files'
  search: { key: 'q'; placeholder: string } | null
  filters: FilterField[]
  sortable: SortColumn[]
  defaultSort: { key: string; dir: 'asc' | 'desc' }
}
```

---

### `components/data-table/DataTableToolbar.tsx` (component, request-response)

**Analog:** `components/transactions/transaction-filters.tsx` (URL mutation) + `app/proto/table-toolbar/variant-a.tsx` (Variant A layout)

**`'use client'` + imports pattern** (`transaction-filters.tsx` lines 1–19):
```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useRef, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SlidersHorizontal } from 'lucide-react'
```

**URL mutation pattern** (`transaction-filters.tsx` lines 40–59):
```tsx
function replaceWith(params: URLSearchParams) {
  const query = params.toString()
  startTransition(() => {
    router.replace(query ? `${APP_ROUTES.transactions}?${query}` : APP_ROUTES.transactions, {
      scroll: false,
    })
  })
}

function updateParam(key: string, value: string | null) {
  const params = new URLSearchParams(searchParams.toString())
  if (value) {
    params.set(key, value)
  } else {
    params.delete(key)
  }
  replaceWith(params)
}
```

**Debounced search input** (`transaction-filters.tsx` lines 83–88):
```tsx
const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

function handleNameChange(value: string) {
  if (debounceRef.current) clearTimeout(debounceRef.current)
  debounceRef.current = setTimeout(() => {
    updateParam('q', value.trim() || null)
  }, 300)
}
```

**Filtri button + count badge** (`variant-a.tsx` lines 50–55):
```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline">
      <SlidersHorizontal className="h-4 w-4" />
      Filtri{n ? ` (${n})` : ''}
    </Button>
  </PopoverTrigger>
  <PopoverContent align="end" className="w-80 space-y-3">
    {/* filter fields rendered from config.filters */}
  </PopoverContent>
</Popover>
```

**Chips row pattern** (`shared.tsx` lines 362–383):
```tsx
export function ChipsRow({ chips, onClear }: { chips: Chip[]; onClear: () => void }) {
  if (chips.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button key={c.key} onClick={c.onRemove}
          className="inline-flex items-center gap-1 rounded-full border bg-secondary px-3 py-1 text-sm hover:bg-secondary/70"
        >
          {c.label}
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      ))}
      <Button variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground">
        Cancella tutto
      </Button>
    </div>
  )
}
```

**Mobile bottom sheet** — use `Sheet` + `SheetContent side="bottom"` from `components/categorization/subcategory-picker.tsx` lines 14–25:
```tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
// trigger: Button with useMediaQuery or CSS hidden/visible
<Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
  <SheetContent side="bottom">
    <SheetHeader><SheetTitle>Filtri</SheetTitle></SheetHeader>
    {/* same filter fields as popover */}
  </SheetContent>
</Sheet>
```

---

### `components/data-table/MonthMultiPicker.tsx` (component, request-response)

**Analog:** `app/proto/table-toolbar/shared.tsx` lines 176–256 (`MonthPicker`)

**Full widget pattern** (lines 176–256 of `shared.tsx`) — extract verbatim and convert:
- Replace `ALL_MONTHS` mock with `monthsWithData: string[]` prop
- Replace internal `useState` for `viewYear` — keep as-is
- Replace `value/onChange` with URL-based: `value: string[]` prop + `onChange: (months: string[]) => void` prop
- Keep `MONTH_ABBR`, `monthLabel`, presets logic, year-grid, "Tutto l'anno" toggle

**Key month label formatter** (lines 38–42):
```ts
export function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  const label = new Intl.DateTimeFormat('it-IT', { month: 'short', year: 'numeric' })
    .format(new Date(y, m - 1, 1))
  return label.charAt(0).toUpperCase() + label.slice(1)
}
```

**Cell disabled/selected pattern** (lines 226–243):
```tsx
<button
  key={ym}
  disabled={!hasData}
  onClick={() => toggle(ym)}
  className={cn(
    'rounded-md border px-2 py-2 text-sm',
    !hasData && 'cursor-not-allowed border-dashed text-muted-foreground/30',
    hasData && !selected && 'hover:bg-muted',
    selected && 'border-primary bg-primary text-primary-foreground',
  )}
>
  {abbr}
</button>
```

---

### `components/data-table/AmountRangePicker.tsx` (component, request-response)

**Analog:** `app/proto/table-toolbar/shared.tsx` lines 259–277 (`AmountRange`)

**Core pattern** (verbatim from prototype):
```tsx
export function AmountRangePicker({ min, max, onMin, onMax }: {
  min: string; max: string; onMin: (v: string) => void; onMax: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Input type="number" inputMode="decimal" placeholder="min €" value={min}
        onChange={(e) => onMin(e.currentTarget.value)} className="w-24" />
      <span className="text-muted-foreground">–</span>
      <Input type="number" inputMode="decimal" placeholder="max €" value={max}
        onChange={(e) => onMax(e.currentTarget.value)} className="w-24" />
    </div>
  )
}
```

Props wire to URL: `onMin`/`onMax` call `updateParam('amountMin', v || null)`.

---

### `components/data-table/HeaderSortButton.tsx` (component, request-response)

**Analog:** `app/proto/table-toolbar/shared.tsx` lines 386–416 (`SortableHead`)

**Core pattern** (lines 402–415):
```tsx
<TableHead className={className} aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
  <button
    onClick={onClick}
    className={cn(
      'inline-flex items-center gap-1 hover:text-foreground',
      align === 'right' && 'w-full justify-end',
      active && 'font-semibold text-foreground',
    )}
  >
    {label}
    {active
      ? dir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
      : <span className="text-muted-foreground/40">↕</span>}
  </button>
</TableHead>
```

ASC → DESC → off cycle (Variant A decision D-13):
```tsx
function onHeaderSort(s: SortKey) {
  if (t.state.sort === s) t.set('dir', t.state.dir === 'asc' ? 'desc' : 'asc')
  else t.setState((p) => ({ ...p, sort: s, dir: 'desc' }))
}
```
For URL-based version: clicking an active column toggles `dir`; clicking inactive column sets `sort=key&dir=desc`; clicking active DESC → delete both params (off = default).

---

### `lib/dal/months-with-data.ts` (dal, CRUD)

**Analog:** `lib/dal/transactions.ts` lines 135–208 (cache + verifySession + scoped query)

**File header pattern** (lines 1–5 of `transactions.ts`):
```ts
import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/dal/auth'
```

**Query shape** — distinct year-months for transactions:
```ts
export const getMonthsWithData = cache(
  async (table: 'transactions' | 'files'): Promise<string[]> => {
    const { userId } = await verifySession()
    // For transactions: DISTINCT TO_CHAR(occurred_at, 'YYYY-MM')
    // For files: DISTINCT TO_CHAR(reference_started_at, 'YYYY-MM')
    // ORDER BY DESC; return string[]
  }
)
```

Use `sql` template from drizzle-orm; pattern from `transactions.ts` line 474:
```ts
const result = await db.execute(sql`
  SELECT DISTINCT TO_CHAR(occurred_at, 'YYYY-MM') AS ym
  FROM transaction
  WHERE user_id = ${userId}
  ORDER BY ym DESC
`)
```

---

### `app/(app)/transactions/transactions.table.ts` (config, transform)

**Analog:** `app/proto/table-toolbar/shared.tsx` COLUMNS + State shape

**Pattern** — plain TS object (no `'use client'` / `'use server'`):
```ts
import type { TableConfig } from '@/lib/utils/table-config'

export const transactionsTableConfig: TableConfig = {
  id: 'transactions',
  search: { key: 'q', placeholder: 'Nome o descrizione…' },
  filters: [
    { key: 'months', label: 'Mesi', type: 'month-multi', toChip: (v) => `Mesi: ${v}` },
    { key: 'amountMin', label: 'Importo (€)', type: 'amount-range', toChip: (v) => `Importo ≥ ${v} €` },
    { key: 'platform', label: 'Piattaforma', type: 'select', options: [], toChip: (v) => `Piattaforma: ${v}` },
    { key: 'category', label: 'Categoria', type: 'select', options: [], toChip: (v) => `Categoria: ${v}` },
    { key: 'status', label: 'Categorizzazione', type: 'status', toChip: (v) => v === 'categorized' ? 'Solo categorizzate' : 'Solo da categorizzare' },
  ],
  sortable: [
    { key: 'occurredAt', label: 'Data' },
    { key: 'amount', label: 'Importo' },
    { key: 'description', label: 'Descrizione' },
    { key: 'category', label: 'Categoria' },
    { key: 'platform', label: 'Piattaforma' },
  ],
  defaultSort: { key: 'occurredAt', dir: 'desc' },
}
```

Same pattern for `expenses.table.ts` (no months, no platform join needed — has platform via file join), `files.table.ts` (status = 3 processing buckets, months = coverage months).

---

### `lib/dal/transactions.ts` — modifications

**Current `buildTransactionOrderBy`** (lines 126–133) — add `id` tiebreaker:
```ts
export function buildTransactionOrderBy({
  sort = 'occurredAt',
  dir = 'desc',
}: Pick<TransactionFilters, 'sort' | 'dir'> = {}) {
  const column = getTransactionSortColumn(sort)
  // CHANGE: return array, append id tiebreaker
  return dir === 'asc'
    ? [asc(column), asc(transaction.id)]
    : [desc(column), desc(transaction.id)]
}
```

Call site `.orderBy(buildTransactionOrderBy(filters))` → `.orderBy(...buildTransactionOrderBy(filters))`.

**New filter conditions to add** after existing conditions block (lines 150–180):
```ts
// months: occurredAt in any of the given YYYY-MM months
if (filters.months && filters.months.length > 0) {
  conditions.push(
    or(...filters.months.map((ym) => sql`TO_CHAR(${transaction.occurredAt}, 'YYYY-MM') = ${ym}`))
  )
}

// amount range — absolute value
if (filters.amountMin) {
  conditions.push(sql`ABS(${transaction.amount}::numeric) >= ${filters.amountMin}::numeric`)
}
if (filters.amountMax) {
  conditions.push(sql`ABS(${transaction.amount}::numeric) <= ${filters.amountMax}::numeric`)
}

// status: categorization
if (filters.status === 'uncategorized') {
  conditions.push(isNull(expense.subCategoryId))
}
if (filters.status === 'categorized') {
  conditions.push(isNotNull(expense.subCategoryId))
}
```

Also update `TransactionFilters` type to add: `months?: string[]`, `amountMin?: string`, `amountMax?: string`, `status?: 'uncategorized' | 'categorized'`.

---

### `lib/dal/expenses.ts` — modifications

**Current `buildExpenseOrderBy`** (lines 53–62) already has tiebreaker — no change needed.

**Remove `this-month` default** (line 69 — decision D-05):
```ts
// BEFORE:
const { from, to } = periodToDateRange(filters.period ?? 'this-month')
const conditions: any[] = [
  eq(expense.userId, userId),
  gte(expense.createdAt, from),
  lte(expense.createdAt, to),
]

// AFTER: remove period-based date range from base conditions entirely
const conditions: any[] = [
  eq(expense.userId, userId),
]
// period filter (if passed) applied conditionally:
if (filters.period) {
  const { from, to } = periodToDateRange(filters.period)
  conditions.push(gte(expense.createdAt, from), lte(expense.createdAt, to))
}
```

**New filter conditions** (amount range, status — same pattern as transactions above but on `expense.totalAmount` and `expense.status`):
```ts
if (filters.amountMin) {
  conditions.push(sql`ABS(${expense.totalAmount}::numeric) >= ${filters.amountMin}::numeric`)
}
// status already handled at lines 81–86 — keep, extend type if needed
```

---

### `lib/dal/imports.ts` — modifications

**Current `orderBy`** (line 137): `desc(importListOrderTimestamp), desc(file.createdAt)` — add `desc(file.id)` as final tiebreaker.

**New filter conditions** (after existing q/date conditions, lines 107–126):
```ts
if (filters.platform) {
  conditions.push(eq(platform.slug, filters.platform))
}

// processing status buckets (D-22)
if (filters.statusBucket === 'imported') {
  conditions.push(eq(file.status, 'imported'))
} else if (filters.statusBucket === 'pending') {
  conditions.push(inArray(file.status, ['uploaded', 'analyzed', 'importing', 'analyzing']))
} else if (filters.statusBucket === 'failed') {
  conditions.push(eq(file.status, 'failed'))
}

// coverage months: referenceStartedAt/referenceEndedAt overlaps given months
if (filters.months && filters.months.length > 0) {
  conditions.push(
    or(...filters.months.map((ym) => sql`TO_CHAR(${file.referenceStartedAt}, 'YYYY-MM') = ${ym}`))
  )
}

if (filters.amountMin) {
  conditions.push(sql`ABS(${file.negativeTotal}::numeric) >= ${filters.amountMin}::numeric`)
}
```

---

### `app/(app)/transactions/page.tsx` — modifications

**Current `searchParams` type** (line 37) is `Promise<TransactionSearchParams>` (already typed loosely). No type change needed if `parseTransactionFilters` is updated.

**Key pattern** — `buildTransactionTableKey` (lines 16–32): update to include new filter keys (`months`, `amountMin`, `amountMax`, `status`).

**Component swap**: replace `<TransactionFilters>` with `<DataTableToolbar config={transactionsTableConfig} ... />`. Pass `monthsWithData` as a prop (fetched alongside other Promise.all).

**Pattern** (`Promise.all` in page, lines 41–46):
```tsx
const [transactions, platforms, categories, mostUsed, monthsWithData] = await Promise.all([
  getTransactions(filters),
  getTransactionPlatforms(),
  getCategories(),
  getMostUsedSubcategories(['in', 'out', 'transfer', 'system']),
  getMonthsWithData('transactions'),
])
```

---

### `app/(app)/expenses/page.tsx` — modifications

**Remove inline filter parsing** (lines 43–57) — replace with `parseExpenseFilters(params)` following the transactions page pattern.

**Remove `period` preset** from filter building (D-05 decision). The `buildExpenseTableKey` also needs updating to drop `filters.period`.

---

### `app/(app)/import/page.tsx` — modifications

**`getFilterKey`** (lines 16–24) — update to include new keys (`platform`, `statusBucket`, `months`, `amountMin`, `amountMax`).

**Same Promise.all pattern**: add `getMonthsWithData('files')`.

---

## Shared Patterns

### URL as state (request-response pattern)
**Source:** `components/transactions/transaction-filters.tsx` lines 36–59
**Apply to:** `DataTableToolbar`
```tsx
const router = useRouter()
const searchParams = useSearchParams()
const [isPending, startTransition] = useTransition()

function replaceWith(params: URLSearchParams) {
  startTransition(() => {
    router.replace(query ? `${route}?${query}` : route, { scroll: false })
  })
}
function updateParam(key: string, value: string | null) {
  const params = new URLSearchParams(searchParams.toString())
  value ? params.set(key, value) : params.delete(key)
  replaceWith(params)
}
```

### DAL query structure
**Source:** `lib/dal/transactions.ts` lines 135–207
**Apply to:** `lib/dal/months-with-data.ts`, all DAL modifications
```ts
import 'server-only'
import { cache } from 'react'
// verifySession() first, then build conditions[], then db.select().where(and(...conditions)).orderBy(...)
```

### Table page `key` invalidation
**Source:** `app/(app)/import/page.tsx` lines 16–24 (`getFilterKey`)
**Apply to:** all three page modifications
```tsx
// Compute a deterministic string key from all active filter values.
// Pass as key={filterKey} to the table component — causes full remount on filter change.
// This is intentional (D-04): resets infinite-scroll offset to first page.
const filterKey = JSON.stringify({ q: filters.q ?? '', sort: filters.sort, dir: filters.dir, /* ...other filters */ })
```

### Drizzle `id` tiebreaker
**Source:** `lib/dal/expenses.ts` lines 56–62 (`buildExpenseOrderBy`) — already implemented correctly
**Apply to:** `buildTransactionOrderBy` in `transactions.ts`, `orderBy` in `imports.ts`
```ts
return dir === 'asc'
  ? [asc(column), asc(table.id)]
  : [desc(column), desc(table.id)]
// Call site: .orderBy(...buildOrderBy(filters))
```

### `'use client'` component props — read-only filters from RSC
**Source:** `components/transactions/transaction-filters.tsx` lines 28–33
**Apply to:** `DataTableToolbar`, `MonthMultiPicker`, `AmountRangePicker`, `HeaderSortButton`
```tsx
// Props carry server-resolved values (options lists, monthsWithData).
// Component itself owns no server state — reads URL via useSearchParams, writes via router.replace.
type Props = {
  config: TableConfig
  monthsWithData?: string[]
  platformOptions?: { value: string; label: string }[]
  categoryOptions?: { value: string; label: string }[]
  currentFilters: ParsedFilters  // for defaultValue / controlled display
}
```

### Absolute-amount filter SQL
**Source:** decision D-20 / D-05 + existing `ilike` pattern in `transactions.ts`
**Apply to:** all three DAL files
```ts
if (filters.amountMin) {
  conditions.push(sql`ABS(${transaction.amount}::numeric) >= ${filters.amountMin}::numeric`)
}
if (filters.amountMax) {
  conditions.push(sql`ABS(${transaction.amount}::numeric) <= ${filters.amountMax}::numeric`)
}
```

---

## No Analog Found

All files have analogs. No entries in this section.

---

## Metadata

**Analog search scope:** `lib/dal/`, `lib/validations/`, `components/`, `app/(app)/`, `app/proto/table-toolbar/`
**Files scanned:** 12 source files read directly
**Pattern extraction date:** 2026-06-04
