# Phase 49: dashboard-and-surfaces - Pattern Map

**Mapped:** 2026-06-12
**Files analyzed:** 13 files to be modified (no new files)
**Analogs found:** 13/13 — every file IS its own analog (refactor phase)

---

## File Classification

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `lib/dal/dashboard.ts` | DAL aggregation | CRUD / batch | itself (current stubs) | self |
| `lib/dal/overview.ts` | DAL aggregation | CRUD / batch | itself (current stubs) | self |
| `lib/dal/categories.ts` | DAL query | CRUD | itself (`getCategoriesForUser`) | self |
| `lib/dal/transactions.ts` | DAL query | CRUD | itself (`getTransactions`) | self |
| `lib/actions/overview.ts` | server action | request-response | itself (`fetchMovers`) | self |
| `lib/utils/cascade-options.ts` | pure utility | transform | itself (`buildTypeNatureMap`) | self |
| `lib/utils/nature-labels.ts` | constants | — | itself | self |
| `components/dashboard/overview/kpi-row.tsx` | component | request-response | itself | self |
| `components/dashboard/overview/kpi-card-reading.tsx` | component | request-response | itself | self |
| `components/dashboard/overview/overview-chart.tsx` | component | event-driven | itself | self |
| `components/dashboard/overview/overview-movers-section.tsx` | component | event-driven | itself | self |
| `components/dashboard/overview/overview-movers-panel.tsx` | component | request-response | itself | self |
| `components/categorization/subcategory-picker.tsx` | component | event-driven | itself | self |
| `app/(app)/transactions/transactions.table.ts` | config | — | itself | self |
| `app/(app)/expenses/expenses.table.ts` | config | — | itself | self |
| `app/globals.css` | config | — | itself | self |

---

## Pattern Assignments

### `lib/dal/dashboard.ts` (DAL aggregation, CRUD/batch)

**This is the primary file to rewrite.** 18+ TODO(Phase 49) markers.

**Preserve — DAL shell pattern** (lines 1–30, lines 396–453):
```typescript
import 'server-only'
import { cache } from 'react'
import { and, countDistinct, desc, eq, gte, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm'
import { verifySession } from '@/lib/dal/auth'
import { db } from '@/lib/db'
import { category, expense, subCategory, transaction as transactionTable, userSubcategoryOverride } from '@/lib/db/schema'
import { toDecimal } from '@/lib/utils/decimal'
```

Every exported DAL function follows this exact shell:
```typescript
export const getSomething = cache(async (filters: X): Promise<Y> => {
  const { userId } = await verifySession()
  // ... setup ...
  try {
    const rows = await db.select({ ... }).from(transactionTable). ...
    return transformRows(rows)
  } catch {
    return zeroFilledDefault  // always return zero/empty, never throw
  }
})
```

**Replace — `notTransferCategory()` helper** (lines 383–390):
```typescript
// CURRENT (broken compile proxy):
function notTransferCategory() {
  return sql<boolean>`(${subCategory.natureId} IS NULL OR NOT EXISTS (
    SELECT 1 FROM nature _n WHERE _n.id = ${subCategory.natureId} AND _n.code = 'transfer'
  ))`
}

// REPLACE WITH (after direction join):
// ne(direction.code, 'transfer')
// — requires direction table to be joined via: subCategory → nature → direction
```

**Replace — `notExcludedFromTotals()` helper** (lines 392–394):
```typescript
// CURRENT:
export function notExcludedFromTotals() {
  return or(isNull(subCategory.excludeFromTotals), eq(subCategory.excludeFromTotals, false))
}

// REPLACE WITH (after direction join, BEFORE dropping column):
// eq(direction.includedInTotals, true)
// Then DELETE this function and all call sites.
```

**Replace — `getOverviewAmountTotals` sign-split** (lines 436–453):
```typescript
// CURRENT (broken sign-split):
{
  totalIn: sql<string>`coalesce(sum(case when ${transactionTable.amount} > 0 then ${transactionTable.amount} else 0 end), 0)::text`,
  totalOut: sql<string>`coalesce(abs(sum(case when ${transactionTable.amount} < 0 then ${transactionTable.amount} else 0 end)), 0)::text`,
}

// REPLACE WITH (direction join required; add totalAllocation; add direction table import):
{
  totalIn: sql<string>`coalesce(sum(case when ${direction.code} = 'in' then ${transactionTable.amount} else 0 end), 0)::text`,
  totalOut: sql<string>`coalesce(abs(sum(case when ${direction.code} = 'out' then ${transactionTable.amount} else 0 end)), 0)::text`,
  totalAllocation: sql<string>`coalesce(sum(case when ${direction.code} = 'allocation' then ${transactionTable.amount} else 0 end), 0)::text`,
}
// Join chain to add: .innerJoin(nature, eq(subCategory.natureId, nature.id))
//                   .innerJoin(direction, eq(nature.directionId, direction.id))
// (use COALESCE for override nature — see correlated subquery pattern in getOverviewChart)
```

**Preserve — Decimal.js accumulation pattern** (lines 461–487, `buildOverviewData`):
```typescript
const totalIn = normalizeAmount(input.current.totalIn)   // normalizeAmount calls toDecimal internally
const totalOut = normalizeAmount(input.current.totalOut)
const balance = balanceFrom(totalIn, totalOut)           // uses toDecimal().minus()
const savingsRate = computeSavingsRate(totalIn, totalOut)
```
`savingsRate` MUST receive spending-only `totalOut` (direction.included_in_totals = true). When `totalAllocation` is added, it must NOT enter `computeSavingsRate`.

**Replace — `getCategoriesBreakdown`, `getCategoryRanking`, `getCategoryDeviations`, `getCategoryDetail`** (lines 875–1059):
```typescript
// CURRENT stubs to replace in all four functions:
const typeFilter = filters.type === 'all' ? undefined : sql<boolean>`true` // TODO(Phase 49)
categoryType: sql<'in' | 'out' | 'system' | 'transfer' | null>`null`,     // TODO(Phase 49)

// REPLACE WITH:
const typeFilter = filters.type === 'all' ? undefined : eq(direction.code, filters.type)
categoryType: direction.code,   // restored from direction join
// Also: replace notExcludedFromTotals() with eq(direction.includedInTotals, true)
```

---

### `lib/dal/overview.ts` (DAL aggregation, CRUD/batch)

**Preserve — DAL shell** (lines 1–24): same `import 'server-only'` / `cache` / `verifySession()` / try-catch-zero pattern as `dashboard.ts`.

**Preserve — `getOverview` structure** (lines 125–166): parallel `Promise.all` calls to aggregation helpers + `buildOverviewData`. After Phase 49, `buildOverviewData` receives a 3-field object with `totalAllocation`. The `getOverview` orchestration shape is preserved.

**Preserve — `getMonthOverMonthCategoryChanges` algorithm** (lines 180–305): the Decimal.js Δ computation loop, noise floor, `isNew` logic, and `prevMap` lookup pattern are ALL preserved. Only two things change: (1) add `direction` param with default `'out'`; (2) replace `isNull(subCategory.natureId)` placeholder with `eq(direction.code, directionParam)` in both curr and prev queries. For `direction = 'allocation'`, swap GROUP BY from `category.id, category.name` to `nature.id, nature.code`.

```typescript
// CURRENT signature:
async (year: number, monthIndex = 0, limit = 10): Promise<MonthOverMonthChange[]>

// REPLACE WITH:
async (year: number, monthIndex = 0, direction: 'in' | 'out' | 'allocation' = 'out', limit = 10)
```

**Preserve — `getOverviewChart` query structure** (lines 317–412): the month bucketing loop, `monthsBetween` zero-fill, and `toDecimal().plus().toFixed(2)` accumulation pattern are preserved. What changes: remove `OUT_NATURES` array, replace `natureSql` correlated subquery routing with direction-aware routing, add `allocation` bucket to the shape.

**Replace — `OUT_NATURES` and `OverviewChartPoint`** (lines 37–56):
```typescript
// CURRENT (wrong — includes savings/investment/transfer):
type OutNature = 'essential' | 'discretionary' | 'debt' | 'savings' | 'investment' | 'transfer'
const OUT_NATURES: OutNature[] = ['essential', 'discretionary', 'debt', 'savings', 'investment', 'transfer']
export type OverviewChartPoint = {
  month: string; label: string
  income: { recurring: string; extraordinary: string }
  out: Record<OutNature, string>
}

// REPLACE WITH:
export type OverviewChartPoint = {
  month: string; label: string
  income: { recurring: string; extraordinary: string }
  out: { essential: string; discretionary: string; debt: string }
  allocation: { savings: string; investment: string }
}
// DELETE emptyOutSegments() and replace with two helpers:
// emptyOutSegments() → { essential, discretionary, debt } only
// emptyAllocationSegments() → { savings, investment }
```

**Replace — `notTransferCategory()` in overview.ts** (lines 61–64):
```typescript
// CURRENT:
function notTransferCategory() {
  return or(isNull(natureTable.code), ne(natureTable.code, 'transfer'))
}
// REPLACE WITH: ne(direction.code, 'transfer')  (after direction join)
```

---

### `lib/dal/categories.ts` (DAL query, CRUD)

**Preserve — `getCategoriesForUser` query structure** (lines 67–151): the `db.select` + multi-join chain, the `effectiveNatureCode` correlated subquery, and the `Map<number, CategoryWithSubCategories>` accumulation loop are all preserved.

**Restore — `category.type` field** (line 73, lines 122–132):
```typescript
// CURRENT stub:
// TODO(Phase 49): restore category type via direction join once direction semantics land
type: null,

// REPLACE WITH:
// Add to SELECT:
categoryType: sql<string | null>`(
  SELECT d.code FROM direction d
  INNER JOIN nature n ON n.direction_id = d.id
  WHERE n.id = COALESCE(${userSubcategoryOverride.natureId}, ${subCategory.natureId})
  LIMIT 1
)`,
// Then in map accumulation:
type: row.categoryType,  // restored direction code
```

**Update `CategoryWithSubCategories.type`** (line 14):
```typescript
// CURRENT:
type: string | null

// REPLACE WITH:
type: 'in' | 'out' | 'allocation' | 'transfer' | null
```

---

### `lib/dal/transactions.ts` (DAL query, CRUD)

**Preserve — filter accumulation pattern** (lines 160–239): the `conditions` array push pattern, `and(...conditions)` in `.where()`, each filter as a guard-then-push block. Shape is preserved.

**Replace — `transactionListSelect.categoryType`** (line 89):
```typescript
// CURRENT:
categoryType: category.id, // category.type removed (Phase 46); direction semantics deferred

// REPLACE WITH (after direction join):
categoryType: direction.code,

// Required: add direction join to the query chain
// TransactionListRow.categoryType: string | null  (was: number | null)
```

**Replace — type/direction filter block** (lines 231–238):
```typescript
// CURRENT:
if (filters.type === 'unclassified') {
  conditions.push(isNull(subCategory.natureId))
} else if (filters.type) {
  conditions.push(eq(nature.code, filters.type))
}

// REPLACE WITH:
if (filters.direction === 'unclassified') {
  conditions.push(isNull(subCategory.natureId))
} else if (filters.direction) {
  conditions.push(eq(direction.code, filters.direction))
}
// Rename TransactionFilters.type → TransactionFilters.direction
```

---

### `lib/actions/overview.ts` (server action, request-response)

**Preserve — full shape** (lines 1–43): `'use server'` directive, `verifySession()` call first (void result), integer bounds validation pattern before DAL call, try/catch returning `{ movers: [], error: string }`.

**Extend — add `direction` param with same bounds-check pattern**:
```typescript
// CURRENT signature (lines 14–17):
export async function fetchMovers(
  year: number,
  monthIndex: number,
): Promise<{ movers: MonthOverMonthChange[]; error: string | null }>

// NEW signature:
export async function fetchMovers(
  year: number,
  monthIndex: number,
  direction: 'in' | 'out' | 'allocation' = 'out',
): Promise<{ movers: MonthOverMonthChange[]; error: string | null }>

// Add to bounds-check block (lines 24–33) same pattern:
const VALID_DIRECTIONS = ['in', 'out', 'allocation'] as const
if (!VALID_DIRECTIONS.includes(direction as typeof VALID_DIRECTIONS[number])) {
  return { movers: [], error: 'Parametri non validi.' }
}
```

---

### `lib/utils/cascade-options.ts` (pure utility, transform)

**Preserve — output shape contract**: `Record<string, FilterOption[]>` keyed by type code + `''` all-bucket. `buildOptions()` inner function using `NATURE_ORDER` filter + map. `allOptions` union bucket.

**Replace — `buildTypeNatureMap` skip condition** (lines 37–39):
```typescript
// CURRENT (skips ALL categories because cat.type is null in Phase 46):
if (cat.type === null || cat.type === 'system') continue

// REPLACE WITH (once getCategoriesForUser restores type):
if (cat.type === 'system') continue
// key change: skip only system; null-check removed because type is now a direction code

// Rename function: buildTypeNatureMap → buildDirectionNatureMap
// Rename result keys: was 'in'/'out'/'transfer', now 'in'/'out'/'allocation'/'transfer'
```

**Replace — `buildCategorySubcategoryMap` skip condition** (line 102):
```typescript
// CURRENT:
if (cat.type === null || cat.type === 'system') continue
// REPLACE WITH:
if (cat.type === 'system') continue
```

**Preserve — `buildOptions()` helper** (lines 59–69): unchanged; `NATURE_ORDER` / `NATURE_LABELS` lookup stays. Only the iteration skip logic changes.

---

### `lib/utils/nature-labels.ts` (constants)

No change required. `FlowNature` type codes (`essential`, `discretionary`, `income`, `income_extraordinary`, `debt`, `transfer`, `savings`, `investment`) already match `nature.code` values in the DB. `NATURE_LABELS`, `NATURE_ORDER`, `NATURE_COLORS` are preserved as-is.

---

### `components/dashboard/overview/kpi-row.tsx` (component, request-response)

**Preserve — grid + `ReadingKpiCard` usage pattern** (lines 49–96):
```typescript
// CURRENT 4-card grid:
<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
  <ReadingKpiCard label="Totale entrate" ... tone="in" ... />
  <ReadingKpiCard label="Totale uscite"  ... tone="out" ... />
  <ReadingKpiCard label="Bilancio"       ... tone="balance" ... />
  <ReadingKpiCard label="Tasso risparmio" ... tone="savings" ... />
</div>

// EXTEND TO 5-card grid:
<div className="grid grid-cols-2 gap-3 md:grid-cols-5">
  ... existing 4 cards unchanged ...
  <ReadingKpiCard label="Accantonato" ... tone="allocation" ... />
</div>
```

**Add — `allocationReading` function** matching the shape of existing `savingsReading`, `balanceReading`:
```typescript
function allocationReading(delta: number | null): Reading {
  if (delta === null) return { text: `Nessun confronto con l'anno scorso`, sentiment: 'neutral' }
  if (delta > 0) return { text: 'Più accantonato rispetto all\'anno scorso', sentiment: 'good' }
  if (delta < 0) return { text: 'Meno accantonato rispetto all\'anno scorso', sentiment: 'warn' }
  return { text: 'In linea con l\'anno scorso', sentiment: 'neutral' }
}
```

**`OverviewData` type in `dashboard.ts`** must gain `totalAllocation: string` and `deltas.totalAllocation: number | null`. `KpiRow` receives `data: OverviewData` and reads `data.totalAllocation`.

---

### `components/dashboard/overview/kpi-card-reading.tsx` (component, request-response)

**Extend — `Tone` union** (line 14):
```typescript
// CURRENT:
type Tone = 'in' | 'out' | 'balance' | 'savings' | 'neutral'

// EXTEND:
type Tone = 'in' | 'out' | 'balance' | 'savings' | 'allocation' | 'neutral'
```

**Extend — `valueColor` switch** (lines 22–28) — add `allocation` case with its CSS token:
```typescript
if (tone === 'allocation') return 'text-[var(--total-allocation)]'
```

The `--total-allocation` CSS custom property is declared in `app/globals.css` (new token).

---

### `components/dashboard/overview/overview-chart.tsx` (component, event-driven)

**Preserve — Recharts `Bar` + `ChartContainer` pattern** (lines 1–26):
```typescript
'use client'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
```

**Extend — `chartConfig`** (lines 23–26):
```typescript
// CURRENT:
const chartConfig = {
  entrate: { label: 'Entrate', color: 'var(--total-in)' },
  uscite:  { label: 'Uscite',  color: 'var(--total-out)' },
} satisfies ChartConfig

// ADD third bar:
accantonato: { label: 'Accantonato', color: 'var(--total-allocation)' },
```

**Extend — `NatureTooltip`**: add `allocation` section mirroring the existing `income` and `out` sections in `NatureTooltipProps` and render block.

**Direction-aware click**: `onMonthSelect` currently receives `monthIndex: number`. Extend to `(monthIndex: number, direction: 'in' | 'out' | 'allocation')`. Bar `onClick` handlers identify which bar was clicked by their `dataKey` and pass the mapped direction up.

---

### `components/dashboard/overview/overview-movers-section.tsx` (component, event-driven)

**Preserve — shared-state architecture** (lines 1–59): `useState(defaultMonthIndex)`, `useState(initialMovers)`, `useTransition()`, `handleMonthSelect` + `startTransition(async () => { fetchMovers(...) })`. This pattern is unchanged.

**Extend — direction state**:
```typescript
// ADD after existing useState:
const [selectedDirection, setSelectedDirection] = useState<'in' | 'out' | 'allocation'>('out')

// UPDATE handleMonthSelect to accept direction param:
function handleMonthSelect(monthIndex: number, direction: 'in' | 'out' | 'allocation') {
  setSelectedMonth(monthIndex)
  setSelectedDirection(direction)
  startTransition(async () => {
    const result = await fetchMovers(year, monthIndex, direction)
    // ... same error/success handling as today
  })
}
```

Pass `selectedDirection` down to `OverviewMoversPanel`.

---

### `components/dashboard/overview/overview-movers-panel.tsx` (component, request-response)

**Preserve — presentation shape** (lines 1–128): the two-column grid, loading spinner, empty state, `splitMovers(takeTopMovers(movers))` pattern, and list item layout are all preserved.

**Extend — direction-aware heading** (lines 38–53):
```typescript
// CURRENT heading copies "Spese di {month} rispetto a {prevMonth}"
// ADD direction prop and conditional heading:
type Props = {
  year: number; selectedMonth: number; movers: MonthOverMonthChange[]
  isPending: boolean
  direction: 'in' | 'out' | 'allocation'  // NEW
}

// Conditional heading per direction:
// 'in': "Entrate di {month} rispetto a {prevMonth}"
// 'out': "Spese di {month} rispetto a {prevMonth}"  (existing copy)
// 'allocation': "Accantonamenti di {month} rispetto a {prevMonth}"
```

**Extend — allocation empty state** (line 59 block): add direction-conditional empty state:
```typescript
// Existing empty state:
'Nessuna variazione significativa — mese di partenza o nessuna spesa sopra €15.'
// ADD for direction === 'allocation':
'Nessun accantonamento in questo mese.'
```

**Allocation movers grain**: per D-03, allocation movers are per-nature (max 2 rows: Risparmio, Investimento). `MonthOverMonthChange` gains optional `natureCode?: string | null` field (populated for allocation grain, null for in/out). The panel renders `m.name` (which for allocation = nature label) — no template change needed in the list items.

---

### `components/categorization/subcategory-picker.tsx` (component, event-driven)

**Preserve — `TYPE_FILTERS` array shape** (lines 72–77):
```typescript
// CURRENT (3 direction chips):
const TYPE_FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: null,       label: 'Tutte' },
  { key: 'in',       label: 'Entrate' },
  { key: 'out',      label: 'Uscite' },
  { key: 'transfer', label: 'Trasferimenti' },
]

// EXTEND to 4 direction chips (label from direction.label_it = 'Accantonato' — verify seed):
const TYPE_FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: null,         label: 'Tutte' },
  { key: 'in',         label: 'Entrate' },
  { key: 'out',        label: 'Uscite' },
  { key: 'allocation', label: 'Accantonato' },
  { key: 'transfer',   label: 'Trasferimenti' },
]
```

**Extend — `TypeKey` type** (line 38): once `CategoryWithSubCategories.type` is `'in' | 'out' | 'allocation' | 'transfer' | null`, `TypeKey` automatically extends. No manual change needed if the type alias `type TypeKey = CategoryWithSubCategories['type']` is kept.

**Extend — `defaultType` prop** (line 58):
```typescript
// CURRENT: defaultType: 'in' | 'out' | 'transfer' | null
// EXTEND: defaultType: 'in' | 'out' | 'allocation' | 'transfer' | null
```

The `PickerBody` filter `c.type === type` works once category types are restored — no logic change.

---

### `app/(app)/transactions/transactions.table.ts` (config)

**Mechanical config swap** — preserve entire `TableConfig` declarative shape (lines 27–96). Only three mutations:

1. Filter key `'type'` → `'direction'`; label `'Tipo'` → `'Direzione'`
2. Options: add `allocation` entry alongside existing `in`, `out`, `transfer`
3. `dependsOn: 'type'` on nature filter → `dependsOn: 'direction'`

```typescript
// CURRENT TYPE_LABELS (line 4–9):
const TYPE_LABELS = { in: 'Entrate', out: 'Uscite', transfer: 'Trasferimenti', unclassified: 'Non classificato' }

// EXTEND:
const DIRECTION_LABELS = {
  in: 'Entrate', out: 'Uscite', allocation: 'Accantonato',
  transfer: 'Trasferimenti', unclassified: 'Non classificato'
}

// CURRENT filter (lines 51–56):
{ key: 'type', label: 'Tipo', type: 'select', options: [], toChip: (v) => `Tipo: ${TYPE_LABELS[v] ?? v}` }
// REPLACE WITH:
{ key: 'direction', label: 'Direzione', type: 'select', options: [], toChip: (v) => `Direzione: ${DIRECTION_LABELS[v] ?? v}` }

// CURRENT nature filter (lines 58–64):
{ key: 'nature', ..., dependsOn: 'type', ... }
// REPLACE WITH:
{ key: 'nature', ..., dependsOn: 'direction', ... }
```

---

### `app/(app)/expenses/expenses.table.ts` (config)

Identical changes to `transactions.table.ts`: key `'type'` → `'direction'`, add `allocation` option, `dependsOn: 'type'` → `dependsOn: 'direction'` on the nature filter.

---

### `app/globals.css` (config)

**Add CSS custom properties** alongside existing `--total-in`, `--total-out`, `--balance` tokens. Pattern: look up existing token declarations and mirror their `:root` / `.dark` block structure.

```css
/* New tokens to add — color values from direction.color seed or NATURE_COLORS */
--total-allocation: /* seeded direction.color for 'allocation', e.g. #fbbf24 */;
--total-transfer:   /* seeded direction.color for 'transfer', e.g. #94a3b8 */;
```

---

## Shared Patterns

### `react.cache` + `verifySession()` DAL shell
**Source:** `lib/dal/overview.ts` lines 98–113, `lib/dal/dashboard.ts` lines 436–453
**Apply to:** All DAL functions in `dashboard.ts` and `overview.ts`
```typescript
export const getFunctionName = cache(async (param: X): Promise<Y> => {
  const { userId } = await verifySession()
  try {
    const rows = await db.select({ ... }).from(transactionTable). ...
    return transform(rows)
  } catch {
    return zeroFilledDefault   // never propagate DB errors to the client
  }
})
```

### Direction join chain (new — to be authored)
**Apply to:** All DAL functions that need direction-scoped aggregation
**Source:** Derived from `effectiveNature` correlated subquery at `lib/dal/categories.ts` line 85 and `lib/dal/overview.ts` lines 327–332.
```typescript
// When effective nature must be per-row (chart grouping):
const effectiveNatureSql = sql<string | null>`(
  SELECT n.code FROM nature n
  WHERE n.id = COALESCE(${userSubcategoryOverride.natureId}, ${subCategory.natureId})
  LIMIT 1
)`
const directionSql = sql<string | null>`(
  SELECT d.code FROM direction d
  INNER JOIN nature n ON n.direction_id = d.id
  WHERE n.id = COALESCE(${userSubcategoryOverride.natureId}, ${subCategory.natureId})
  LIMIT 1
)`

// When static join suffices (filtering/aggregation without override):
.innerJoin(nature, eq(subCategory.natureId, nature.id))
.innerJoin(direction, eq(nature.directionId, direction.id))
```

### Decimal.js monetary accumulation
**Source:** `lib/dal/overview.ts` lines 397–408, `lib/dal/overview.ts` lines 259–300
**Apply to:** All in-app aggregation loops (not SQL-side sums)
```typescript
import { toDecimal } from '@/lib/utils/decimal'

// Accumulating into a bucket:
bucket.income.recurring = toDecimal(bucket.income.recurring)
  .plus(toDecimal(rawAmount))
  .toFixed(2)

// Computing delta:
const delta = toDecimal(curr.amount).minus(toDecimal(prevAmount))
delta.abs().lt(NOISE_FLOOR)   // noise floor check
delta.toFixed(2)               // serialize back to string
```

### Server action input validation pattern
**Source:** `lib/actions/overview.ts` lines 24–33
**Apply to:** `fetchMovers` direction param validation
```typescript
if (
  !Number.isInteger(year) || year < 2000 || year > 2100 ||
  !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11
) {
  return { movers: [], error: 'Parametri non validi.' }
}
// Apply same style for direction:
const VALID_DIRECTIONS = ['in', 'out', 'allocation'] as const
if (!(VALID_DIRECTIONS as readonly string[]).includes(direction)) {
  return { movers: [], error: 'Parametri non validi.' }
}
```

### `useTransition` + `fetchMovers` shared-state pattern
**Source:** `components/dashboard/overview/overview-movers-section.tsx` lines 22–58
**Apply to:** Direction extension of `handleMonthSelect` in same file
```typescript
const [selectedMonth, setSelectedMonth] = useState(defaultMonthIndex)
const [movers, setMovers] = useState<MonthOverMonthChange[]>(initialMovers)
const [isPending, startTransition] = useTransition()

function handleMonthSelect(monthIndex: number) {
  setSelectedMonth(monthIndex)          // instant highlight
  startTransition(async () => {
    const result = await fetchMovers(year, monthIndex)
    if (result.error) setMovers([])     // empty state, not stale data
    else setMovers(result.movers)
  })
}
```

### `ReadingKpiCard` usage pattern
**Source:** `components/dashboard/overview/kpi-row.tsx` lines 55–95
**Apply to:** 5th KPI card (Accantonato) in same file
```typescript
<ReadingKpiCard
  label="..."
  value={formatEur(data.totalXxx)}
  tone="xxx"
  delta={data.deltas.totalXxx}
  goodWhenPositive={true}
  prevYear={prevYear}
  reading={xxxReading(...)}
  className="min-h-0"
/>
```

### Declarative `TableConfig` filter swap
**Source:** `app/(app)/transactions/transactions.table.ts` lines 50–64
**Apply to:** Both `transactions.table.ts` and `expenses.table.ts`
```typescript
// Pattern: filter object shape must not change; only key, label, options, dependsOn
{
  key: 'direction',           // was 'type'
  label: 'Direzione',         // was 'Tipo'
  type: 'select',
  options: [],                // populated at page level, not in config
  toChip: (v) => `Direzione: ${DIRECTION_LABELS[v] ?? v}`,
},
{
  key: 'nature',
  label: 'Natura',
  type: 'select',
  dependsOn: 'direction',     // was 'type'
  options: [],
  toChip: (v) => `Natura: ${NATURE_LABELS[v as keyof typeof NATURE_LABELS] ?? v}`,
},
```

---

## No Analog Found

No files in this phase lack an analog. All files are being modified, and every file serves as its own primary pattern reference.

---

## Critical Sequencing Notes for Planner

These are cross-file ordering constraints, not patterns per se:

1. **Schema import in `dashboard.ts` and `overview.ts`** must import `direction` and `nature` from `@/lib/db/schema` before any direction join can land. Verify both tables exist in schema.ts (they do — Phase 46 deliverable).

2. **Code change before column drop**: `notExcludedFromTotals()` must be fully removed and replaced with `eq(direction.includedInTotals, true)` BEFORE `drizzle-kit generate` removes `excludeFromTotals` from schema.ts and before `yarn db:migrate` applies the DROP COLUMN. A wave that drops the schema field must come after a wave that removes the function.

3. **`getCategoriesForUser` restores `type` before `cascade-options.ts` is rewritten**: `buildDirectionNatureMap` iterates `cat.type`; if `type` is still `null` when that function runs, the output is empty and table nature filters break.

4. **`fetchMovers` direction param before `OverviewMoversSection` passes it**: server action signature change must land with or before the component change.

---

## Metadata

**Analog search scope:** `lib/dal/`, `lib/utils/`, `lib/actions/`, `components/dashboard/overview/`, `components/categorization/`, `app/(app)/transactions/`, `app/(app)/expenses/`
**Files read:** 15 source files
**Pattern extraction date:** 2026-06-12
