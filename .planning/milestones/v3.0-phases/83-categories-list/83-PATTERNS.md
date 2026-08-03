# Phase 83: categories-list - Pattern Map

**Mapped:** 2026-07-31
**Files analyzed:** 16 files
**Analogs found:** 14 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `lib/dal/dashboard.ts` (getCategoryRanking) | data access layer | CRUD aggregation | `lib/dal/dashboard.ts` (getCategoryRanking) | exact |
| `app/(app)/dashboard/categories/page.tsx` | page | request-response | `app/(app)/dashboard/categories/page.tsx` | exact |
| `components/dashboard/category-ranking-list.tsx` | component | render | `components/dashboard/category-ranking-list.tsx` | exact |
| `components/dashboard/category-sparkline.tsx` | component | render | `components/dashboard/category-sparkline.tsx` | exact |
| `components/dashboard/dashboard-tab-nav.tsx` | component | request-response | `components/dashboard/dashboard-tab-nav.tsx` | exact |
| `lib/routes.ts` (buildDashboardCategoriesHref) | utility | CRUD | `lib/routes.ts` (buildDashboardCategoriesHref) | exact |
| `lib/validations/dashboard.ts` | validation | CRUD | `lib/validations/dashboard.ts` | exact |
| `lib/utils/dashboard.ts` (direction copy) | utility | transform | `lib/services/pace-and-projection.ts` (resolveComparisonJudgement) | role-match |
| `tests/categories-ranking-dal.test.ts` | test | CRUD | `tests/pace-engine-lens-regression.test.ts` | role-match |
| `tests/dashboard-year-contract.test.ts` | test | request-response | `tests/dashboard-dal.test.ts` | role-match |

## Pattern Assignments

### `lib/dal/dashboard.ts` - getCategoryRanking (modify existing function)

**Analog:** `lib/dal/dashboard.ts` lines 1040-1102

**Imports pattern** (lines 1-43):
```typescript
import 'server-only'
import { cache } from 'react'
import {
  and,
  countDistinct,
  desc,
  eq,
  isNull,
  ne,
  or,
  sql,
} from 'drizzle-orm'
import { verifySession } from '@/lib/dal/auth'
import { db } from '@/lib/db'
import {
  category,
  direction,
  expense,
  expenseGroup,
  expenseGroupMembership,
  ledgerEntryCash,
  nature,
  subCategory,
  transaction as transactionTable,
  userSubcategoryOverride,
} from '@/lib/db/schema'
import type { DashboardFilters, DashboardPreset } from '@/lib/validations/dashboard'
import type { DateRange } from '@/lib/utils/date'
import { dashboardPresetToDateRange, monthLabel, monthsBetween } from '@/lib/utils/date'
import { toDecimal } from '@/lib/utils/decimal'
```

**Cache + Session verification pattern** (lines 1040-1045):
```typescript
export const getCategoryRanking = cache(
  async (
    filters: DashboardFilters,
    ledgerRowSource: LedgerRowSource = ledgerEntryCash,
  ): Promise<CategoryRankingItem[]> => {
    const { userId } = await verifySession()
```

**Date range + predicate setup** (lines 1046-1049):
```typescript
    const { from, to } = dashboardPresetToDateRange(filters.preset)
    const monthSql = sql<string>`to_char(${ledgerRowSource.occurredAt}, 'YYYY-MM')`
    const typeFilter = filters.type === 'all' ? undefined : eq(direction.code, filters.type)
```

**Current predicate to be CHANGED (line 1090):**
```typescript
    eq(direction.includedInTotals, true),  // CURRENT - D-09 will change this to:
    // eq(direction.hidden, false)
```

**Error handling pattern** (lines 1051-1102):
```typescript
    let rows: CategoryRankingAggregateRow[] = []

    try {
      rows = await db
        .select({ ... })
        .from(ledgerRowSource)
        // ... joins and grouping
        .where(
          and(
            dateScopedTransactions(ledgerRowSource, userId, from, to),
            expenseStatusIncludedInDashboardTotals(),
            eq(direction.includedInTotals, true),  // ← D-09 FLIP TARGET
            typeFilter
          )
        )
        .groupBy(category.id, monthSql, direction.code)
        .orderBy(desc(sql`coalesce(...)`), category.id, monthSql)
    } catch {
      rows = []
    }

    return buildCategoryRankingData({ from, to, rows })
  }
)
```

**Key change (D-09):** Replace `eq(direction.includedInTotals, true)` with `eq(direction.hidden, false)`. This predicate flip includes the `allocation` direction (`out`/`in`/`allocation` have `hidden: false`; `transfer` has `hidden: true`).

---

### `app/(app)/dashboard/categories/page.tsx` - Rewrite for year-based interface

**Analog:** `app/(app)/dashboard/categories/page.tsx` lines 1-120 (current implementation)

**Imports pattern** (lines 1-14):
```typescript
import Link from 'next/link'
import { Suspense } from 'react'
import { CategoryRankingList } from '@/components/dashboard/category-ranking-list'
import { CategoryRankingSkeleton } from '@/components/dashboard/category-ranking-skeleton'
import { DashboardFilters } from '@/components/dashboard/dashboard-filters'
import { getCategoryDeviations, getCategoryRanking } from '@/lib/dal/dashboard'
import { verifySession } from '@/lib/dal/auth'
import { buildDashboardCategoriesHref } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { extractLensPassthrough, type LensPassthrough } from '@/lib/utils/search-params'
import {
  parseDashboardFilters,
  type DashboardFilters as ParsedDashboardFilters,
  type DashboardSort,
} from '@/lib/validations/dashboard'
```

**Current constants (lines 15-20) - TO BE REPLACED:**
```typescript
const CATEGORIES_DEFAULT_PRESET = 'last-3-months' as const
const CATEGORIES_DEFAULT_SORT: DashboardSort = 'deviation'
const categoryTypeOptions = [
  { value: 'out' as const, label: 'Uscite' },
  { value: 'in' as const, label: 'Entrate' },
]
```

**Phase 83 replaces with:**
```typescript
// D-01: year is container, no month selection
// D-08: sort toggles between 'amount' (Totale) and 'projection' (Proiezione)
// D-09: three directions now available
const categoryDirectionOptions = [
  { value: 'out' as const, label: 'Uscite' },
  { value: 'in' as const, label: 'Entrate' },
  { value: 'allocation' as const, label: 'Accantonamenti' },
]
```

**SearchParams type (current, lines 36-46) - TO BE REPLACED:**
```typescript
type Props = {
  searchParams: Promise<{
    preset?: string | string[]
    period?: string | string[]
    type?: string | string[]
    sort?: string | string[]
    lens?: string | string[]
  }>
}
```

**Phase 83 replaces with:**
```typescript
type Props = {
  searchParams: Promise<{
    year?: string | string[]  // D-12: year replaces preset
    type?: string | string[]  // Now: 'out' | 'in' | 'allocation'
    sort?: string | string[]  // Options: 'amount' | 'projection' (D-08)
    lens?: string | string[]  // Phase 82 D-13 passthrough
    // D-12: preset is NO LONGER READ OR PARSED
  }>
}
```

**SortToggle component pattern (current, lines 75-102) - TO BE UPDATED:**
```typescript
function SortToggle({
  filters,
  lens,
}: {
  filters: CategoryDashboardFilters
  lens?: LensPassthrough
}) {
  const options: Array<{ value: DashboardSort; label: string }> = [
    { value: 'deviation', label: 'Deviazione' },  // ← REMOVED in Phase 83
    { value: 'amount', label: 'Importo' },        // ← RENAMED to 'Totale'
  ]
  // ... rest of component
}
```

**Phase 83 replaces with (D-08):**
```typescript
function SortToggle({
  filters,
  lens,
  coveredMonthCount,  // ← NEW: to control projection option state
}: {
  filters: CategoryDashboardFilters
  lens?: LensPassthrough
  coveredMonthCount: number  // ← NEW
}) {
  const options: Array<{ value: DashboardSort; label: string; disabled?: boolean; title?: string }> = [
    { value: 'amount', label: 'Totale' },  // D-08: default sort
    { 
      value: 'projection', 
      label: 'Proiezione',  // D-08: secondary sort
      disabled: coveredMonthCount < 2,  // D-15: disabled when < 2 Covered Months
      title: 'Serve un secondo mese importato per calcolare la proiezione.'  // D-15: disabled reason
    },
  ]
  // ... rest of component
}
```

---

### `components/dashboard/category-ranking-list.tsx` - Update row rendering

**Analog:** `components/dashboard/category-ranking-list.tsx` lines 1-200 (current implementation)

**Current Props type (lines 12-23):**
```typescript
type Props = {
  data: CategoryRankingItem[]
  preset: DashboardPreset
  type: 'in' | 'out'
  defaultPreset?: DashboardPreset
  sort?: DashboardSort
  deviations?: Map<number, DeviationData>
  lens?: LensPassthrough
}
```

**Phase 83 replaces with:**
```typescript
type Props = {
  data: CategoryRankingItem[]
  year: number  // D-12: year replaces preset
  type: 'in' | 'out' | 'allocation'  // D-09: three directions
  sort?: DashboardSort  // Now: 'amount' | 'projection' (D-08, no 'deviation')
  lens?: LensPassthrough  // Phase 82 D-13 passthrough
  coveredMonthCount?: number  // D-15: to render nudge for < 2 months
  // deviations: REMOVED (no longer passed; Deviation retired)
}
```

**Current sort key logic (lines 25-50) - REMOVED IN PHASE 83:**
```typescript
function deviationSortKey(item: CategoryRankingItem, deviations?: Map<number, DeviationData>): number {
  if (!deviations) return 3
  const entry = deviations.get(item.id)
  if (entry === undefined || entry.deviation === null) return entry?.isNew ? 1 : 2
  return 0
}

function compareItems(
  a: CategoryRankingItem,
  b: CategoryRankingItem,
  sort: DashboardSort,
  deviations?: Map<number, DeviationData>
): number {
  if (sort !== 'deviation' || !deviations) return 0
  const ka = deviationSortKey(a, deviations)
  const kb = deviationSortKey(b, deviations)
  if (ka !== kb) return ka - kb
  if (ka === 0) {
    const da = Math.abs(deviations.get(a.id)!.deviation as number)
    const db = Math.abs(deviations.get(b.id)!.deviation as number)
    if (da !== db) return db - da
  }
  return toDecimal(b.amount).comparedTo(toDecimal(a.amount))
}

function getDeviationValue(id: number, deviations?: Map<number, DeviationData>): DeviationResult {
  if (!deviations) return null
  const entry = deviations.get(id)
  if (!entry) return null
  if (entry.isNew) return 'new'
  return entry.deviation
}
```

**Phase 83 replaces with (D-04, D-07, D-08):**
```typescript
// New comparator for projection sort (D-08)
function compareByProjection(
  a: CategoryRankingItem,
  b: CategoryRankingItem
): number {
  // Only sort by projection if both have one (coveredMonthCount >= 2)
  // Fall back to amount when projection is absent
  const aAmount = toDecimal(a.projection ?? a.amount)
  const bAmount = toDecimal(b.projection ?? b.amount)
  return bAmount.comparedTo(aAmount)
}

// Main sort logic:
function getSortedData(
  data: CategoryRankingItem[],
  sort: DashboardSort
): CategoryRankingItem[] {
  if (sort === 'projection') {
    return [...data].sort(compareByProjection)
  }
  // Default 'amount' sort: data is already ordered by amount from query
  return data
}
```

**Current row rendering (lines ~130-180) - REMOVE DEVIATION BADGE, ADD PROJECTION:**
```typescript
// CURRENT (lines ~160-170, DELETE THIS):
{deviations ? (
  <DeviationBadge
    deviation={getDeviationValue(category.id, deviations)}
    categoryType={type}
  />
) : null}
<CategorySparkline
  points={category.sparkline}
  type={type}
  label={`Andamento mensile ${category.name}`}
/>
```

**Phase 83 adds projection column (D-04, D-05, D-06):**
```typescript
{/* Sparkline — always rendered (D-04, D-07) */}
<CategorySparkline
  points={category.sparkline}
  type={type}  // Now supports 'allocation' (D-09)
  label={`Andamento mensile ${category.name}`}
/>

{/* Projection column — rendered only when >= 2 Covered Months (D-15) */}
{category.projection ? (
  <div className="text-right">
    <p className="font-mono text-sm font-medium tabular-nums text-muted-foreground">
      <span className="text-xs font-normal">A questo passo</span>
      <br />
      <strong className="text-sm font-semibold text-foreground">
        {formatAmount(category.projection)}
      </strong>
    </p>
  </div>
) : null}
```

**href builder update (D-13):**
```typescript
// CURRENT:
const href = buildDashboardCategoryDetailHref(category.id, {
  preset,
  type,
  defaultPreset,
  lens,
})

// PHASE 83:
const href = buildDashboardCategoryDetailHref(category.id, {
  year,  // D-13: pass year to detail, so row's total = detail's total
  type,
  lens,
})
```

---

### `components/dashboard/category-sparkline.tsx` - Update for four visual states and allocation

**Analog:** `components/dashboard/category-sparkline.tsx` lines 1-89

**Current type signature (lines 5-9):**
```typescript
type Props = {
  points: CategorySparklinePoint[]
  type: 'in' | 'out'
  label?: string
}
```

**Phase 83 replaces with (D-09, D-06):**
```typescript
type Props = {
  points: CategorySparklinePoint[]
  type: 'in' | 'out' | 'allocation'  // D-09: support allocation
  label?: string
  // Phase 83 may need state field on CategorySparklinePoint for visual distinction
  // (D-06: uncovered/current/estimated/covered month states)
}
```

**Current parseAmount (line 20-23) - PROBLEM FOR ALLOCATION:**
```typescript
function parseAmount(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0  // ← Math.max CLAMPS NEGATIVES
}
```

**D-09 blocker:** On `allocation` direction, a divestment month is negative and legitimate. The `Math.max(parsed, 0)` clamp hides negative values, breaking allocation sparklines. Phase 83 must:
1. Accept negative domain (remove Math.max clamp)
2. Render negative amounts visually distinct (inverted/marked, exact treatment deferred to executor)
3. Verify this change does not break in/out sparklines (they are always non-negative)

**Current color mapping (line 49):**
```typescript
const color = type === 'in' ? 'var(--total-in)' : 'var(--total-out)'
```

**Phase 83 adds allocation color (D-09, D-06):**
```typescript
const color = 
  type === 'in' ? 'var(--total-in)' 
  : type === 'allocation' ? 'var(--total-allocation)' 
  : 'var(--total-out)'
```

**Confirm:** `--total-allocation` (#a78bfa) is already defined in `app/globals.css` (UI-SPEC.md, line 82).

---

### `components/dashboard/dashboard-tab-nav.tsx` - Update buildDashboardTabHref

**Analog:** `components/dashboard/dashboard-tab-nav.tsx` lines 1-67 (current implementation)

**Current buildDashboardTabHref (lines 13-40):**
```typescript
export function buildDashboardTabHref(
  href: string,
  searchParams: Pick<URLSearchParams, 'get'>
) {
  const params = new URLSearchParams()
  const preset = searchParams.get('preset')
  const type = searchParams.get('type')
  const sort = searchParams.get('sort')
  const lens = searchParams.get('lens')

  if (preset) {
    params.set('preset', preset)  // ← D-12: REMOVE THIS
  }

  if (type) {
    params.set('type', type)
  }

  if (sort) {
    params.set('sort', sort)
  }

  if (lens) {
    params.set('lens', lens)
  }

  const search = params.toString()
  return href + (search ? `?${search}` : '')
}
```

**Phase 83 replaces with (D-12):**
```typescript
export function buildDashboardTabHref(
  href: string,
  searchParams: Pick<URLSearchParams, 'get'>
) {
  const params = new URLSearchParams()
  const year = searchParams.get('year')  // ← D-12: NEW
  const type = searchParams.get('type')
  const sort = searchParams.get('sort')
  const lens = searchParams.get('lens')
  // D-12: preset is intentionally dropped — no read, no fallback

  if (year) {
    params.set('year', year)  // ← D-12: NEW
  }

  if (type) {
    params.set('type', type)
  }

  if (sort) {
    params.set('sort', sort)
  }

  if (lens) {
    params.set('lens', lens)
  }

  const search = params.toString()
  return href + (search ? `?${search}` : '')
}
```

**Key decision (D-12):** The builder is shared by Overview (uses year), Categories (will use year), and Tags (ignores both). Dropping `preset` from this builder removes it from the Overview tab link too — verify that Overview has stopped depending on `preset` before deploying.

---

### `lib/routes.ts` - Update buildDashboardCategoriesHref and href builders

**Analog:** `lib/routes.ts` lines 27-67 (current implementation)

**Current type (lines 27-42):**
```typescript
type DashboardCategoryFilters = {
  preset?: DashboardPreset
  type?: 'in' | 'out'
  sort?: DashboardSort
  defaultPreset?: DashboardPreset
  defaultSort?: DashboardSort
  lens?: LensPassthrough
}
```

**Phase 83 replaces with (D-12, D-09):**
```typescript
type DashboardCategoryFilters = {
  year?: number  // D-12: year replaces preset
  type?: 'in' | 'out' | 'allocation'  // D-09: three directions
  sort?: DashboardSort  // Now: 'amount' | 'projection' (D-08)
  lens?: LensPassthrough  // Phase 82 D-13 passthrough
  // D-12: preset, defaultPreset, defaultSort fields removed
}
```

**Current buildDashboardCategoriesHref (lines 44-67):**
```typescript
export function buildDashboardCategoriesHref(filters: DashboardCategoryFilters = {}) {
  const params = new URLSearchParams()
  const defaultPreset = filters.defaultPreset ?? 'this-year'
  const defaultSort: DashboardSort = filters.defaultSort ?? 'amount'

  if (filters.preset && filters.preset !== defaultPreset) {
    params.set('preset', filters.preset)
  }

  if (filters.type === 'in') {
    params.set('type', filters.type)
  }

  if (filters.sort && filters.sort !== defaultSort) {
    params.set('sort', filters.sort)
  }

  if (filters.lens) {
    params.set('lens', filters.lens)
  }

  const search = params.toString()
  return APP_ROUTES.dashboardCategories + (search ? `?${search}` : '')
}
```

**Phase 83 replaces with (D-12, D-08):**
```typescript
export function buildDashboardCategoriesHref(filters: DashboardCategoryFilters = {}) {
  const params = new URLSearchParams()
  const defaultSort: DashboardSort = 'amount'  // D-08: Totale is default

  if (filters.year) {
    params.set('year', String(filters.year))  // D-12: year is always explicit
  }

  if (filters.type && filters.type !== 'out') {  // Default to out if omitted
    params.set('type', filters.type)
  }

  if (filters.sort && filters.sort !== defaultSort) {
    params.set('sort', filters.sort)
  }

  if (filters.lens) {
    params.set('lens', filters.lens)
  }

  const search = params.toString()
  return APP_ROUTES.dashboardCategories + (search ? `?${search}` : '')
}
```

**buildDashboardCategoryDetailHref (lines 69-71) - UPDATE TYPE AND IMPLEMENTATION (D-13):**
```typescript
// CURRENT:
export function buildDashboardCategoryDetailHref(
  id: number | string, 
  filters: DashboardCategoryFilters = {}
) {
  return `${dashboardCategoryDetail(id)}?${buildDashboardCategoriesHref(filters)}`
}

// PHASE 83: Same function, uses updated buildDashboardCategoriesHref
// D-13: Detail link carries year, so row total = detail total
```

---

### `lib/validations/dashboard.ts` - Remove preset parsing, add year

**Analog:** `lib/validations/dashboard.ts` lines 1-49 (current implementation)

**Current schema (lines 1-17):**
```typescript
import { z } from 'zod'
import { DASHBOARD_PRESETS } from '@/lib/utils/date'

export const DashboardPresetSchema = z.enum(DASHBOARD_PRESETS).default('last-month')
export const DashboardTypeSchema = z.enum(['out', 'in', 'all']).default('out')
export const DashboardSortSchema = z.enum(['deviation', 'amount'])
export type DashboardSort = z.infer<typeof DashboardSortSchema>

export const DashboardFiltersSchema = z.object({
  preset: DashboardPresetSchema,
  type: DashboardTypeSchema,
  sort: DashboardSortSchema.default('amount'),
})

export type DashboardPreset = z.infer<typeof DashboardPresetSchema>
export type DashboardType = z.infer<typeof DashboardTypeSchema>
export type DashboardFilters = z.infer<typeof DashboardFiltersSchema>
```

**Phase 83 updates:**
1. Update `DashboardTypeSchema` to include 'allocation' (D-09)
2. Update `DashboardSortSchema` to replace 'deviation' with 'projection' (D-08)
3. Add year parsing for Categories page (D-12)
4. Keep preset parsing for Overview/Tags backward compatibility (they still use it)

**Phase 83 adds (D-12):**
```typescript
export const DashboardTypeSchema = z.enum(['out', 'in', 'allocation', 'all']).default('out')  // D-09
export const DashboardSortSchema = z.enum(['amount', 'projection'])  // D-08: 'deviation' removed
export type DashboardSort = z.infer<typeof DashboardSortSchema>

// Categories page now parses year instead of preset (D-12)
export function parseCategoryDashboardFilters(
  input: {
    year?: string | string[]  // D-12: NEW
    type?: string | string[]
    sort?: string | string[]
    lens?: string | string[]
  },
  options?: { defaultSort?: DashboardSort }  // defaultPreset removed
): CategoryDashboardFilters {
  const rawYear = Array.isArray(input.year) ? input.year[0] : input.year
  const rawType = Array.isArray(input.type) ? input.type[0] : input.type
  const rawSort = Array.isArray(input.sort) ? input.sort[0] : input.sort
  const yearCandidate = rawYear ? Number(rawYear) : null
  const year = !isNaN(yearCandidate ?? NaN) ? yearCandidate : new Date().getFullYear()  // D-12

  return {
    year,
    type: DashboardTypeSchema.safeParse(rawType ?? 'out').success
      ? ((rawType ?? 'out') as DashboardType)
      : 'out',
    sort: DashboardSortSchema.safeParse(rawSort ?? 'amount').success
      ? ((rawSort ?? 'amount') as DashboardSort)
      : 'amount',
  }
}
```

---

### `lib/utils/dashboard.ts` - Direction-scoped copy (D-11)

**Analog:** `lib/services/pace-and-projection.ts` lines 1-50 (resolveComparisonJudgement pattern)

**Recommendation:** Create a per-direction copy set following Phase 82's `resolveComparisonJudgement` pattern (single source of truth, not per-widget).

**New utility (D-11):**
```typescript
// In lib/utils/dashboard.ts or lib/services/dashboard-copy.ts (new file)

export type DirectionCopySet = {
  pageSubheading: string  // "Dove spendi di più..." / "Dove entrano..." / "Dove destini..."
  shareLabel: string      // "% del totale" / "% del totale ricevuto" / "% del totale destinato"
  emptyStateHeading: string  // "Nessuna spesa" / "Nessuna entrata" / "Nessun accantonamento"
}

export function resolveDirectionCopy(direction: 'in' | 'out' | 'allocation'): DirectionCopySet {
  switch (direction) {
    case 'out':
      return {
        pageSubheading: 'Dove spendi di più nel {year}, e dove arrivi a questo ritmo.',
        shareLabel: '% del totale',
        emptyStateHeading: 'Nessuna spesa',
      }
    case 'in':
      return {
        pageSubheading: 'Dove entrano i soldi nel {year}, e dove arrivi a questo ritmo.',
        shareLabel: '% del totale ricevuto',
        emptyStateHeading: 'Nessuna entrata',
      }
    case 'allocation':
      return {
        pageSubheading: 'Dove destini risorse nel {year}, e dove arrivi a questo ritmo.',
        shareLabel: '% del totale destinato',
        emptyStateHeading: 'Nessun accantonamento',
      }
  }
}
```

All text from UI-SPEC.md `## Copywriting Contract`, lines 97-109.

---

### `tests/pace-engine-lens-regression.test.ts` - RETIRE-05 Regression Gate

**Analog:** `tests/pace-engine-lens-regression.test.ts` lines 1-100

**Purpose:** Phase 83 MUST re-run this existing test after the predicate flip (D-09, D-10).

**Pattern to follow (lines 33-42):**
```typescript
vi.mock('@/lib/dal/auth', () => ({ verifySession: vi.fn() }))
vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))

const harness = await connectReimbursementTestDb()

// WR-04: skipping is fine locally, fatal in CI.
assertHarnessReachableInCi(harness, '[pace-engine-regression]')

if (!harness.ok) {
  console.warn(
    '[pace-engine-regression] Local Postgres unreachable — run `yarn db:up`...',
  )
}

const describeIfReachable = harness.ok ? describe : describe.skip
```

**Command to re-run (D-10):**
```bash
yarn test pace-engine-lens-regression.test.ts
```

**Expected outcome:** All assertions pass unchanged. If they fail, the predicate flip is wrong — Overview/Tags must remain byte-identical.

---

### `tests/categories-ranking-dal.test.ts` - NEW (Optional, but recommended)

**Analog:** `tests/pace-engine-lens-regression.test.ts` (harness pattern) + `tests/dashboard-dal.test.ts` (unit test pattern)

**Recommendation:** Create a new test file to verify:
1. `getCategoryRanking` with predicate flip includes `allocation` direction
2. Year-scoped date range works correctly (year 2024 vs 2025 produce different results)
3. `buildCategoryRankingData` reshapes aggregated rows correctly with projection field

**Pattern (from pace-engine-lens-regression.test.ts):**
```typescript
import { afterAll, describe, expect, it, vi } from 'vitest'
import { verifySession } from '@/lib/dal/auth'
import {
  connectReimbursementTestDb,
  resetReimbursementFixtures,
} from './helpers/reimbursement-test-db'
import {
  seedExpenseWithTransaction,
  seedMinimalTaxonomy,
  seedUser,
} from './fixtures/reimbursement-seed'

vi.mock('@/lib/dal/auth', () => ({ verifySession: vi.fn() }))
vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))

const harness = await connectReimbursementTestDb()
const describeIfReachable = harness.ok ? describe : describe.skip

describeIfReachable('getCategoryRanking — predicate flip (D-09, CLIST-04)', () => {
  it('includes allocation direction when querying', async () => {
    // Seed: allocation category in 2024
    // Call: getCategoryRanking(year=2024, direction=allocation)
    // Assert: allocation category appears in results
  })
  // ...
})
```

---

## Shared Patterns

### Decimal.js for Monetary Arithmetic
**Source:** `lib/services/pace-and-projection.ts` lines 1-50
**Apply to:** Any new share/projection computation
```typescript
import { toDecimal, toDbDecimal } from '@/lib/utils/decimal'

// All arithmetic via Decimal.js, never native +-*/:
const percentage = toDecimal(amount)
  .div(total.isZero() ? '1' : total)
  .times('100')
  .toFixed(2)
```

### Cache + verifySession Pattern
**Source:** `lib/dal/dashboard.ts` lines 1040-1045
**Apply to:** All new DAL functions
```typescript
import { cache } from 'react'
import { verifySession } from '@/lib/dal/auth'

export const getCategoryYearRanking = cache(
  async (year: number): Promise<CategoryRankingItem[]> => {
    const { userId } = await verifySession()
    // ...
  }
)
```

### Error Handling (Try/Catch + Empty Default)
**Source:** `lib/dal/covered-months.ts` lines 34-59, `lib/dal/dashboard.ts` lines 1051-1102
**Apply to:** All DAL queries
```typescript
let rows: RowType[] = []
try {
  rows = await db.select(...).from(...).where(...)
} catch {
  rows = []
}
return buildSomething({ rows })
```

### Server Component + Suspense + Skeleton
**Source:** `app/(app)/dashboard/categories/page.tsx` (current implementation)
**Apply to:** Page rendering
```typescript
import { Suspense } from 'react'
import { CategoryRankingSkeleton } from '@/components/dashboard/category-ranking-skeleton'

export default async function CategoriesPage(props: Props) {
  const data = await getCategoryRanking(filters)
  
  return (
    <Suspense fallback={<CategoryRankingSkeleton />}>
      <CategoryRankingList data={data} />
    </Suspense>
  )
}
```

### Component Props: Year + Lens Passthrough
**Source:** `components/dashboard/category-ranking-list.tsx` lines 12-23
**Pattern to follow (Phase 83 update):**
```typescript
type Props = {
  year: number  // D-12: year replaces preset
  type: 'in' | 'out' | 'allocation'  // D-09
  sort?: DashboardSort
  lens?: LensPassthrough  // Phase 82 D-13: always include for tab nav preservation
  // No deviations (D-03: Deviation retired on list)
}
```

### URL Builder Pattern: Omit Defaults
**Source:** `lib/routes.ts` lines 44-67
**Pattern:** Only emit params that differ from defaults, to keep URLs clean
```typescript
const defaultSort = 'amount'

if (filters.sort && filters.sort !== defaultSort) {
  params.set('sort', filters.sort)
}
```

### Direction-Scoped Text: Single Source
**Source:** `lib/services/pace-and-projection.ts` (resolveComparisonJudgement pattern, Phase 82)
**Apply to:** D-11 copy resolution
```typescript
export function resolveDirectionCopy(direction: 'in' | 'out' | 'allocation'): DirectionCopySet {
  // Single map, never duplicated across widgets
}
```

---

## No Analog Found

None. All files have clear existing analogs or are straightforward updates to existing functions.

---

## Metadata

**Analog search scope:** 
- `lib/dal/` (16 files scanned, 8 examined)
- `lib/services/` (5 files scanned, 1 examined)
- `lib/validations/` (2 files scanned, 1 examined)
- `lib/utils/` (25 files scanned, 2 examined)
- `lib/routes.ts` (1 file)
- `components/dashboard/` (20 files scanned, 6 examined)
- `app/(app)/dashboard/` (6 files scanned, 2 examined)
- `tests/` (30+ files scanned, 3 examined)

**Files scanned:** 100+
**Pattern extraction date:** 2026-07-31
**Valid through:** 2026-08-07 (Phase 82 stable, design locked 2026-07-30)

**Key architectural rules verified:**
- ✅ `server-only` + `cache` + `verifySession` in all DAL functions
- ✅ `try/catch → empty array` error handling
- ✅ Decimal.js for all monetary arithmetic (toDecimal/toDbDecimal)
- ✅ URL builders omit default values
- ✅ Components accept `lens?: LensPassthrough` for tab navigation preservation
- ✅ `direction.hidden` vs `direction.includedInTotals` caller inventory verified (only Categories touched by D-09)
- ✅ Phase 82's `resolveComparisonJudgement` sets the pattern for centralized, per-direction copy resolution (D-11)
