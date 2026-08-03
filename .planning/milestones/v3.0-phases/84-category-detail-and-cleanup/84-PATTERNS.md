# Phase 84: category-detail-and-cleanup - Pattern Map

**Mapped:** 2026-08-03
**Files analyzed:** 14 new/modified files
**Analogs found:** 13/13 with strong matches

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/(app)/dashboard/categories/[id]/page.tsx` | page (SSR) | request-response | `app/(app)/dashboard/categories/page.tsx` (Phase 83) | exact |
| `components/dashboard/category-detail-window-controls.tsx` | client component | request-response | `components/dashboard/category-year-select.tsx` | role-match |
| `components/dashboard/category-detail-table.tsx` | client component | CRUD (render-only) | `components/transactions/transaction-table.tsx` (sticky cols section) | partial |
| `components/dashboard/category-detail-difference-chart.tsx` | client component | CRUD (render-only) | `components/dashboard/category-detail-trend-chart.tsx` | role-match |
| `components/dashboard/category-subcategory-breakdown.tsx` | client component (reshape) | CRUD (render-only) | `components/dashboard/category-detail-skeleton.tsx` / existing breakdown | role-match |
| `components/dashboard/category-detail-skeleton.tsx` | client component (reshape) | CRUD (render-only) | `components/dashboard/category-year-ranking-skeleton.tsx` | role-match |
| `lib/dal/dashboard.ts` | DAL (signature change D-15) | CRUD | `lib/dal/covered-months.ts` (getCategoryMonthlyAmounts) | role-match |
| `lib/dal/category-detail-year-window.ts` | DAL (new) | CRUD | `lib/dal/covered-months.ts` + `lib/dal/dashboard.ts:getCategoryDetail` | role-match |
| `lib/validations/dashboard.ts` (add window parser) | validation | request-response | `lib/validations/dashboard.ts:parseCategoryYearDirection` (Phase 83) | role-match |
| `lib/validations/category-year-window.ts` | validation (new) | request-response | `lib/validations/dashboard.ts:parseCategoryYearSort` (Phase 83) | role-match |
| `lib/routes.ts` (buildDashboardCategoryDetailHref update) | utility | request-response | `lib/routes.ts:buildDashboardCategoryDetailHref` (current preset branch) | role-match |
| `tests/category-detail-window.test.ts` | test | CRUD | `tests/dashboard-dal.test.ts` (existing DAL test pattern) | role-match |
| `tests/category-detail-table.test.ts` | test | CRUD | `tests/reimbursement-regression.test.ts` (regression fixture pattern) | role-match |

---

## Pattern Assignments

### `app/(app)/dashboard/categories/[id]/page.tsx` (page, request-response)

**Analog:** `app/(app)/dashboard/categories/page.tsx` (Phase 83 list page)

**Pattern: Server component with async data fetching + URL parsing**

Lines 70–124 (list page structure):
```typescript
export default async function DashboardCategoriesPage({ searchParams }: Props) {
  await verifySession()
  const params = await searchParams
  const lens = extractLensPassthrough(params.lens)
  const years = await getYearsWithData('cassa')
  // Parse year with fallback: resolveYear() handles invalid/absent input
  const year = resolveYear(Array.isArray(params.year) ? params.year[0] : params.year, years)
  
  if (year === null) {
    return <NoYearsEmptyState />
  }
  
  // Fetch data with parsed params
  const coveredMonths = await getCoveredMonthsInYear(year)
  
  return (
    <div className="flex flex-col gap-6">
      {/* Layout structure — can be reused */}
      <Suspense fallback={<CategoryYearRankingSkeleton />}>
        <CategoryRankingContent year={year} direction={direction} sort={sort} lens={lens} />
      </Suspense>
    </div>
  )
}
```

**Apply to detail page:**
- Parse `year`, `months`, `from` from searchParams (like the list parses `year`, `type`, `sort`)
- Clamp window params inside the parser (D-03)
- Fetch data once at page level, pass to content component
- Use `Suspense` + skeleton fallback (pattern matches)
- Back-link uses `buildDashboardCategoryDetailHref()` with year+window params

---

### `components/dashboard/category-year-select.tsx` (client component, request-response)

**Analog:** Existing `components/dashboard/category-year-select.tsx` (Phase 83)

**Pattern: Controlled select using useRouter.replace**

Lines 18–46:
```typescript
export function CategoryYearSelect({ year, years }: CategoryYearSelectProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  function update(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('year', next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <Select value={String(year)} onValueChange={update}>
      <SelectTrigger aria-label="Anno" className="h-auto w-auto gap-1 rounded-full border px-3 py-1 text-sm font-medium">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {years.map((y) => (
          <SelectItem key={y} value={y}>{y}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

**Apply to window controls:**
- Window control (segmented control + start-month select) should follow identical pattern:
  - `useRouter`, `usePathname`, `useSearchParams`
  - Preserve all existing URL params except the ones being changed
  - `router.replace` with full URL (including year, type, lens)
- Segmented control logic: set `months=12` removes from URL; set `months=9|6|3` triggers clamp on start-month

---

### `components/dashboard/category-detail-table.tsx` (client component, CRUD render-only)

**Analog: NONE for the sticky-column mechanic — this is a first in the codebase.**

> **⚠ Corrected 2026-08-03 by orchestrator verification.** This entry originally named
> `components/transactions/transaction-table.tsx` (lines 1–150) as the sticky-column analog.
> **That file contains neither `sticky` nor `overflow-x`** — verified by grep. More broadly,
> `grep -rn "sticky left-0|sticky right-0"` over `components/` and `app/` returns **nothing**:
> there is **no horizontal sticky-column precedent anywhere in this project**. The only `sticky`
> usages are `sticky top-0` on `<thead>` (`activate-amortization-dialog.tsx:168`,
> `transaction-form-dialog.tsx:308`) and `sticky bottom-0` CTA bars — a *vertical* header
> mechanic, structurally different from sticky columns (which need `position: sticky` + an
> opaque background + z-index on **every cell** of the column, inside an `overflow-x` container).
>
> The planner must treat the sticky columns as **net-new work with the prototype as its only
> reference**, not as "follow the existing table pattern". Do not point the executor at
> `transaction-table.tsx`.

**Closest real primitive:** `components/ui/table.tsx` — the shadcn `Table` wrapper already renders
`<div data-slot="table-container" className="relative w-full overflow-x-auto">` around the `<table>`,
which is exactly the scroll container the sticky columns need. Reuse it rather than hand-rolling a
scroller. Note it does **not** set `border-collapse: separate`, which the prototype requires for
sticky cells to keep their borders — that has to be added on the `<table>`.

**Structural source of truth — prototype CSS** from `.scratch/dashboard-categories/detail-table.html`:

Lines 9–29 (sticky column mechanics):
```html
<style>
  .scroller { overflow-x: auto; border: 1px solid var(--border); }
  table.months { border-collapse: separate; border-spacing: 0; width: 100%; min-width: 1040px; }
  table.months th.rowhead, table.months td.rowhead {
    text-align: left; position: sticky; left: 0; background: var(--card); z-index: 2;
    border-right: 1px solid var(--border); font-weight: 500; min-width: 148px;
  }
  /* Summary column — sticky right */
  th.sum, td.sum {
    border-left: 2px solid var(--fg); background: var(--muted); position: sticky; right: 0;
    min-width: 168px; text-align: right;
  }
  /* Month states */
  th.st-now, td.st-now { background: #fff7ed; }  /* current month */
  th.st-est, td.st-est { color: var(--muted-fg); } /* estimated */
  th.st-gap, td.st-gap { background: repeating-linear-gradient(45deg, transparent 0 5px, rgba(113,113,122,.10) 5px 10px); } /* uncovered */
</style>
```

Translate to Tailwind:
- First column: `sticky left-0 z-20 bg-card` + explicit `min-w-[148px]` — on **every** `th`/`td` of that column, not just the header
- Summary column: `sticky right-0 z-20 bg-muted` + explicit `min-w-[168px]` — likewise on every cell
- Table container: the `overflow-x-auto` already provided by `components/ui/table.tsx`, with `min-w-[1040px]` on the `<table>`
- `border-separate border-spacing-0` on the `<table>` — required for borders to survive on sticky cells
- An **opaque** background on every sticky cell is load-bearing, not cosmetic: without it the scrolling
  columns show through underneath
- Month state classes mapped to Tailwind bg/text colors (Claude's Discretion per CONTEXT.md)

---

### `components/dashboard/category-detail-difference-chart.tsx` (client component, CRUD render-only)

**Analog:** `components/dashboard/category-detail-trend-chart.tsx` (lines 1–110)

**Chart library setup — reuse existing SVG infrastructure:**

Lines 19–45 (chart dimensions + data transform):
```typescript
const width = 640
const height = 220
const paddingX = 28
const paddingY = 20

function parseAmount(value: string): number {
  const amount = Number(value)
  return Number.isFinite(amount) ? Math.abs(amount) : 0
}

function buildChartPoints(data: CategoryDetailTrendPoint[]): Array<ChartPoint & { x: number; y: number }> {
  const points = data.map((point) => ({ ...point, value: parseAmount(point.amount) }))
  const max = Math.max(...points.map((point) => point.value), 0)
  const innerWidth = width - paddingX * 2
  const innerHeight = height - paddingY * 2
  const step = points.length > 1 ? innerWidth / (points.length - 1) : 0

  return points.map((point, index) => ({
    ...point,
    x: points.length === 1 ? width / 2 : paddingX + step * index,
    y: max === 0 ? height - paddingY - innerHeight / 2 : height - paddingY - (point.value / max) * innerHeight,
  }))
}
```

**Difference chart divergence (D-08/D-09):**
- Input type: not `CategoryDetailTrendPoint[]` (absolute amounts) but a new type holding `{ month, label, delta, direction }`
- Chart type: bar chart (not line chart) centered on zero baseline
- Bars above/below zero per sign of delta
- Colour from `resolveComparisonJudgement(delta, direction)` → CSS var (`--better-fg`, `--worse-fg`, `--neutral-fg`)
- Legend explains "above = more spending (worse for out)" per direction (D-09)
- Table and chart consume the same series object (D-08 — same window+prev-year query result)

---

### `components/dashboard/category-subcategory-breakdown.tsx` (client component reshape, CRUD render-only)

**Analog:** Current `components/dashboard/category-subcategory-breakdown.tsx` (lines 30–97)

**Current pattern to adapt (lines 46–97):**
```typescript
export function CategorySubcategoryBreakdown({ subcategories, type = 'out', deviations }: Props) {
  const barColor = type === 'in' ? 'bg-[var(--total-in)]' : 'bg-[var(--total-out)]'

  return (
    <ul className="grid gap-3" aria-label="Ripartizione sottocategorie">
      {subcategories.map((subcategory) => {
        const percentage = safePercentage(subcategory.percentage)
        return (
          <li key={subcategory.id} className="overflow-hidden rounded-xl border bg-card p-4 shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{subcategory.name}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {movementLabel(count)} · {percentage}% del totale categoria
                  </p>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className={cn('h-full rounded-full', barColor)} style={{ width: `${percentage}%` }} />
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
```

**Reshape for D-16 (weight + contribution):**
- Component signature changes: remove `deviations` param, add `comparison` (the confronto data per subcategory)
- Row structure: Subcategory name | Weight (% bar) | Totale 2026 | Contributo alla differenza (with colour/word per direction)
- Add synthetic "Totale" row showing sum of contributions = parent difference (the verification row)
- Render disappeared subcategories with lighter styling (`text-muted-foreground`) and 0% bar, negative contribution visible
- Remove DeviationBadge entirely (D-14)

---

### `components/dashboard/category-detail-skeleton.tsx` (client component reshape, CRUD render-only)

**Analog:** `components/dashboard/category-year-ranking-skeleton.tsx` (lines 13–52)

**Skeleton pattern — reserve layout space before data arrives:**

Lines 13–26 (grid structure):
```typescript
export function CategoryYearRankingSkeleton() {
  return (
    <div className="grid gap-3" aria-label="Caricamento classifica categorie">
      {Array.from({ length: SKELETON_ROW_COUNT }).map((_, index) => (
        <div key={index} className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-[30px_minmax(0,1fr)_150px_150px_150px] sm:items-center">
            {/* Columns mapped to actual grid layout above */}
          </div>
        </div>
      ))}
    </div>
  )
}
```

**Apply to detail page skeleton (replace current single-section skeleton):**
1. Table skeleton: 13 rows (header + 2 data rows + 1 comparison row + up to 9 subcategories) × 13 columns
   - Each cell: pulse placeholder for text width matching eventual data
   - Summary column wider (dual lines: Totale + Media)
2. Chart skeleton: SVG-sized placeholder (640×220 matching chart dimensions)
3. Subcategories table skeleton: 6 rows × 4 columns (name, weight bar, total, contribution)
4. Note: Skeleton should NOT reserve space for the difference row if previous-year data is empty (that row shows only text, not data)

---

### `lib/dal/dashboard.ts` (DAL signature change D-15)

**Analog:** `lib/dal/covered-months.ts:getCategoryMonthlyAmounts` (lines 72–112)

**Current function to update — lines 1510–1575:**
```typescript
export const getCategoryDetail = cache(
  async (
    categoryId: number,
    filters: DashboardFilters,  // ← CHANGE THIS
    ledgerRowSource: LedgerRowSource = ledgerEntryCash,
  ): Promise<CategoryDetailData> => {
    const { userId } = await verifySession()
    const { from, to } = dashboardPresetToDateRange(filters.preset)  // ← REMOVE THIS
    // ... rest of function uses `from` and `to`
  }
)
```

**New signature (D-15 change):**
```typescript
export const getCategoryDetail = cache(
  async (
    categoryId: number,
    { from, to, type }: { from: Date; to: Date; type: 'in' | 'out' },  // ← NEW
    ledgerRowSource: LedgerRowSource = ledgerEntryCash,
  ): Promise<CategoryDetailData> => {
    const { userId } = await verifySession()
    // NO dashboardPresetToDateRange call — parameters are explicit
    // Rest of function unchanged (already uses from/to internally)
  }
)
```

**Other four functions needing D-15 updates (verified from research.md D-15 Blast Radius):**
1. `getCategoriesBreakdown` (line 1181) — same signature shape: `{ from, to, type }`
2. `getCategoryRanking` (line 1246) — same signature shape: `{ from, to, type }`
3. `getMonthlyTrendByNature` (line 1756) — different shape: `{ from, to }` (no type, groups by nature)
4. Tests in `tests/helpers/reimbursement-test-db.ts` must pass identical `dateRange` explicitly

**Related: the regression snapshot call site (D-16 mechanic)**

File `tests/helpers/reimbursement-test-db.ts` lines 294–330:
```typescript
// CURRENT — uses filters object
const filters = { preset: 'last-month' as const, type: 'all' as const, sort: 'amount' as const }
const [total, breakdown, ranking, deviations, detail, monthly] = await Promise.all([
  dashboardModule.getOverviewAmountTotals(userId, dateRange.from, dateRange.to, ledgerRowSource),
  dashboardModule.getCategoriesBreakdown(filters),  // ← CHANGE TO dateRange
  dashboardModule.getCategoryRanking(filters),      // ← CHANGE TO dateRange
  dashboardModule.getCategoryDeviations({...}),     // ← REMOVE ENTIRELY (deletion plan)
  dashboardModule.getCategoryDetail(categoryId, filters),  // ← CHANGE TO dateRange
  dashboardModule.getMonthlyTrendByNature(filters.preset),  // ← CHANGE TO dateRange
])

// AFTER — delete filters, pass dateRange
const range = { from: dateRange.from, to: dateRange.to, type: 'all' as const }
const [total, breakdown, ranking, detail, monthly] = await Promise.all([
  dashboardModule.getOverviewAmountTotals(userId, dateRange.from, dateRange.to, ledgerRowSource),
  dashboardModule.getCategoriesBreakdown(range),  // ← UPDATED
  dashboardModule.getCategoryRanking(range),      // ← UPDATED
  // getCategoryDeviations removed from Promise.all AND from returned object
  dashboardModule.getCategoryDetail(categoryId, range),  // ← UPDATED
  dashboardModule.getMonthlyTrendByNature({ from: dateRange.from, to: dateRange.to }),  // ← UPDATED
])
```

**D-16 blocking prerequisite: dashboardPresetToDateRange replacement**

Before deleting `lib/utils/date.ts:dashboardPresetToDateRange`, create a test-local equivalent in `tests/helpers/reimbursement-test-db.ts`:

```typescript
// Byte-identical to dashboardPresetToDateRange('last-month') — used only in regression tests
function lastMonthRange(): { from: Date; to: Date } {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
  return { from, to }
}
```

Then update all ~20 test call sites from `dashboardPresetToDateRange('last-month')` to `lastMonthRange()` before deleting the production symbol (D-14).

---

### `lib/dal/category-detail-year-window.ts` (DAL new)

**Analog:** `lib/dal/covered-months.ts` (lines 72–112, `getCategoryMonthlyAmounts` pattern)

**New file pattern — zero-filled monthly series + window filtering:**

```typescript
import 'server-only'
import { cache } from 'react'
import { toDecimal, toDbDecimal } from '@/lib/utils/decimal'
import type { MonthlyValue } from '@/lib/services/pace-and-projection'
import { getCategoryMonthlyAmounts } from '@/lib/dal/covered-months'
import { getCoveredMonthsInYear } from '@/lib/dal/covered-months'

/**
 * D-08: Returns the window's filtered series for the current year AND the homologous window
 * for the previous year, along with subcategory contributions and comparison data.
 * 
 * Consumes getCategoryMonthlyAmounts (already zero-filled for 12 months) and filters to the
 * window. Returns contribution per subcategory (current − previous, exact-summing verification).
 */
export const getCategoryDetailYearWindow = cache(
  async (
    categoryId: number,
    year: number,
    window: { months: number; from: string }, // from = 'YYYY-MM'
    ledgerRowSource: LedgerRowSource = ledgerEntryCash,
  ): Promise<CategoryDetailWindowData> => {
    // 1. Fetch 12-month series for year and year-1
    const currentYearData = await getCategoryMonthlyAmounts(categoryId, year, ledgerRowSource)
    const previousYearData = await getCategoryMonthlyAmounts(categoryId, year - 1, ledgerRowSource)

    // 2. Clamp window (D-03) — ensure from month + months fits inside year
    const [fromYear, fromMonth] = window.from.split('-').map(Number)
    const maxStartMonth = 13 - window.months
    const clampedFromMonth = Math.min(Math.max(1, fromMonth), maxStartMonth)
    const startIndex = clampedFromMonth - 1  // 0-indexed
    const endIndex = startIndex + window.months - 1

    // 3. Filter series to window
    const currentWindowSeries = currentYearData.slice(startIndex, endIndex + 1)
    const previousWindowSeries = previousYearData.slice(startIndex, endIndex + 1)

    // 4. Compute comparisons per month (uses computeComparison from pace-and-projection.ts)
    const monthlyDeltas = currentWindowSeries.map((curr, idx) =>
      computeComparison(curr.amount, previousWindowSeries[idx]?.amount ?? '0.00')
    )

    // 5. Subcategory contributions (one parallel query per subcategory, sum to total)
    const subcategoryContributions = await getSubcategoryContributions(
      categoryId,
      { from: windowStart, to: windowEnd },
      { from: prevWindowStart, to: prevWindowEnd },
      ledgerRowSource
    )

    // 6. Top transactions (window-scoped, D-05)
    const topTransactions = await getTopTransactionsInWindow(
      categoryId,
      { from: windowStart, to: windowEnd },
      ledgerRowSource
    )

    return {
      currentYear: { months: currentWindowSeries, total: sum(...) },
      previousYear: { months: previousWindowSeries, total: sum(...) } | null,
      monthlyDeltas,  // for difference chart
      subcategoryContributions,  // for contribution table
      topTransactions,
      coveredMonthsInfo: { current: getCoveredMonthsInYear(year), previous: getCoveredMonthsInYear(year - 1) }
    }
  }
)
```

**Key points:**
- Uses `getCategoryMonthlyAmounts` (already Phase 82, zero-filled, cached)
- Clamps window inside year (D-03) — no year boundary crossing
- Computes deltas using `computeComparison` from Phase 82 service (single source of truth)
- Subcategory contributions must sum exactly to parent total (CDET-05, use Decimal.js)
- Returns structure that feeds both table and difference chart with one query

---

### `lib/validations/dashboard.ts` + new `lib/validations/category-year-window.ts` (validation)

**Analog:** `lib/validations/dashboard.ts:parseCategoryYearDirection` (Phase 83, lines 63–71)

**Phase 83 pattern (for reference — already present):**
```typescript
export function parseCategoryYearDirection(
  value: string | string[] | undefined
): CategoryYearDirection {
  const raw = Array.isArray(value) ? value[0] : value
  const candidate = raw ?? 'out'
  return CategoryYearDirectionSchema.safeParse(candidate).success
    ? (candidate as CategoryYearDirection)
    : 'out'
}
```

**New function to add (in new file `lib/validations/category-year-window.ts`):**

```typescript
import { z } from 'zod'

export const CategoryYearWindowSchema = z.object({
  year: z.number().int().min(1900).max(2100),
  months: z.enum(['12', '9', '6', '3']).default('12'),
  from: z.string().regex(/^\d{4}-\d{2}$/).default('01'),  // YYYY-MM format
})

export type CategoryYearWindow = z.infer<typeof CategoryYearWindowSchema>

/**
 * D-01/D-03: Parses year, months, from from searchParams. Clamps `from` month
 * to fit the window inside the selected year (never crosses year boundary).
 * 
 * Total function — first-element semantics, never throws, always returns valid values.
 * Missing/invalid inputs fall back to sensible defaults (year = current, months = 12, from = January).
 */
export function parseCategoryYearWindow(
  params: {
    year?: string | string[]
    months?: string | string[]
    from?: string | string[]
  }
): CategoryYearWindow {
  const raw = {
    year: Array.isArray(params.year) ? params.year[0] : params.year,
    months: Array.isArray(params.months) ? params.months[0] : params.months,
    from: Array.isArray(params.from) ? params.from[0] : params.from,
  }

  // Parse year; default to current
  const year = raw.year && /^\d{4}$/.test(raw.year) ? Number(raw.year) : new Date().getFullYear()

  // Parse months; must be one of {12, 9, 6, 3}
  const months =
    raw.months === '9' || raw.months === '6' || raw.months === '3' ? Number(raw.months) : 12

  // Parse from (YYYY-MM); default to January
  const fromMatch = raw.from?.match(/^(\d{4})-(\d{2})$/)
  let startMonth = fromMatch ? Number(fromMatch[2]) : 1
  const fromYear = fromMatch ? Number(fromMatch[1]) : year

  // D-03 Clamp: start month must fit window inside year
  const maxStartMonth = 13 - months
  startMonth = Math.min(Math.max(1, startMonth), maxStartMonth)

  // Ensure from year matches selected year
  const clampedFromYear = fromYear === year ? year : year

  return {
    year,
    months,
    from: `${clampedFromYear}-${String(startMonth).padStart(2, '0')}`,
  }
}
```

---

### `lib/routes.ts` (buildDashboardCategoryDetailHref update)

**Analog:** Current `lib/routes.ts:buildDashboardCategoryDetailHref` (lines 150–179)

**Current implementation (year mode branch already present, lines 154–157):**
```typescript
export function buildDashboardCategoryDetailHref(
  id: number | string,
  filters: DashboardCategoryFilters = {}
) {
  if (filters.year !== undefined) {
    const search = buildYearModeSearch({ ...filters, year: filters.year })
    return dashboardCategoryDetail(id) + (search ? `?${search}` : '')
  }
  // ... preset-mode branch (to be removed D-14)
}
```

**D-04 enhancement: preserve window in year changes**

The existing `buildYearModeSearch` function (lines 54–71) already handles `type` and `lens` preservation:
```typescript
function buildYearModeSearch(filters: DashboardCategoryFilters & { year: number }): string {
  const params = new URLSearchParams()
  params.set('year', String(filters.year))

  if (filters.type && filters.type !== 'out') {
    params.set('type', filters.type)
  }

  if (filters.sort && filters.sort !== 'amount') {
    params.set('sort', filters.sort)
  }

  if (filters.lens) {
    params.set('lens', filters.lens)
  }

  return params.toString()
}
```

**Update to add window preservation (D-04):**

Extend `DashboardCategoryFilters` type and `buildYearModeSearch`:
```typescript
type DashboardCategoryFilters = {
  // ... existing fields ...
  months?: number  // ← NEW (9, 6, 3, or undefined for 12)
  from?: string    // ← NEW (YYYY-MM format or undefined for January)
}

function buildYearModeSearch(filters: DashboardCategoryFilters & { year: number }): string {
  const params = new URLSearchParams()
  params.set('year', String(filters.year))

  if (filters.type && filters.type !== 'out') {
    params.set('type', filters.type)
  }

  if (filters.months && filters.months !== 12) {
    params.set('months', String(filters.months))
  }

  if (filters.from && filters.from !== `${filters.year}-01`) {
    params.set('from', filters.from)
  }

  if (filters.lens) {
    params.set('lens', filters.lens)
  }

  return params.toString()
}
```

**Back-link in detail page (D-04):**

Lines 73–76 of `app/(app)/dashboard/categories/page.tsx` show the pattern:
```typescript
const backHref = buildDashboardCategoriesHref({ year, type: filters.type, lens })
```

Detail page should NOT carry `months`/`from` back to the list (CLIST-07):
```typescript
// Detail page back-link
const backHref = buildDashboardCategoriesHref({ year, type: categoryDirection, lens })
// ← months and from stay on the detail page only, never returned to list
```

---

## Shared Patterns

### Decimal.js Usage in Aggregations

**Source:** `lib/services/pace-and-projection.ts:computeComparison` (lines 115–117)

**Pattern — ALL monetary arithmetic in DAL and services:**
```typescript
import { toDecimal, toDbDecimal } from '@/lib/utils/decimal'

// ✓ CORRECT: Decimal.js all the way
const current = toDecimal(currentAmount)
const previous = toDecimal(previousAmount)
const delta = current.minus(previous)
const result = toDbDecimal(delta)  // Round once at return boundary

// ✗ WRONG: Never native JS arithmetic
const delta = Number(currentAmount) - Number(previousAmount)  // FORBIDDEN
```

**Apply to:** All functions in `lib/dal/category-detail-year-window.ts` and anywhere subcategory contributions are summed.

---

### Month State Classification

**Source:** `components/dashboard/category-year-ranking-skeleton.tsx` (lines 127–132) + `lib/dal/dashboard.ts` (lines 127–145, CategoryYearSparklinePoint type)

**Pattern — visual state enum per month:**
```typescript
type MonthState = 'covered' | 'current' | 'estimated' | 'uncovered'

function classifyMonthState(
  yearMonth: string,
  coveredMonths: Set<string>,
  currentYearMonth: string,
  isProjectedMonth: boolean
): MonthState {
  if (yearMonth === currentYearMonth) return 'current'
  if (!coveredMonths.has(yearMonth)) return 'uncovered'
  if (isProjectedMonth) return 'estimated'
  return 'covered'
}
```

**Apply to:** Table cell styling (background, italic, hatching) + legend explanation (D-10).

---

### Direction-Scoped Copy Resolution

**Source:** `lib/services/category-direction-copy.ts` (lines 29–62, exhaustive switch)

**Pattern — single source of truth per direction:**
```typescript
export function resolveCategoryDirectionCopy(
  direction: 'in' | 'out' | 'allocation'
): CategoryDirectionCopy {
  switch (direction) {
    case 'out':
      return { pageSubheading: '...', ... }
    case 'in':
      return { pageSubheading: '...', ... }
    case 'allocation':
      return { pageSubheading: '...', ... }
  }
}
```

**Apply to:** Detail page copy (page subheading, chart legend, comparison label) — always call `resolveCategoryDirectionCopy(categoryDirection)` instead of hardcoding strings.

---

## Files with No Analog Found

> **Corrected 2026-08-03 by orchestrator verification.** This section originally read "None. All
> patterns have strong analogs." That is not true of the table's central mechanic.

**`components/dashboard/category-detail-table.tsx` — the sticky-column mechanic has no analog.**
Verified: no `sticky left-0` / `sticky right-0` exists anywhere in `components/` or `app/`. The
project has sticky *headers* (`sticky top-0` on `<thead>`) and sticky bottom CTA bars, but never a
sticky *column*. This is net-new work whose only reference is the locked prototype
`.scratch/dashboard-categories/detail-table.html`.

Practical consequences for the planner:
- Budget a real task for it; do not fold it into "render the table".
- The mobile/narrow-viewport behaviour is explicitly Claude's Discretion in CONTEXT.md **and** has no
  in-repo precedent to fall back on — the open prototype question about whether the sticky summary
  column survives on narrow viewports is genuinely open.
- `84-VALIDATION.md` already lists the sticky-column behaviour as a **manual-only** verification;
  that classification is correct and should stay, since no automated test asserts scroll behaviour.

Everything else does have a strong analog: Phase 82 (`pace-and-projection.ts`, `covered-months.ts`)
and Phase 83 (year-mode URL parsing, direction copy, year select, ranking list, skeleton) cover the
data, parsing, copy and layout patterns.

---

## Metadata

**Analog search scope:** 
- `/app/(app)/dashboard/categories/` (page component + list routes)
- `/components/dashboard/` (selectors, charts, tables, skeletons)
- `/lib/dal/` (DAL queries, covered months, dashboard aggregations)
- `/lib/validations/` (URL parsing, Zod schemas)
- `/lib/services/` (pace, projection, comparison, copy)

**Files scanned:** 14 analog files (Phase 82/83 surfaces, dashboard, routing, validation modules)
**Pattern extraction date:** 2026-08-03

---

## Prototype Reference

**Locked design (D-19):** `.scratch/dashboard-categories/detail-table.html`

Key structural insights from prototype:
1. **Sticky columns:** First column left-sticky (z-index 2), summary column right-sticky (z-index 2), centered scrollable content
2. **Cell delta placement:** Second line of text inside cell (11px font), not a separate row
3. **Month states visual:**
   - Covered (fact): normal styling
   - Current: warm background (`#fff7ed`)
   - Estimated: italic + muted foreground
   - Uncovered: diagonal hatching + explicit "non importato" text
4. **Summary column:** Stacked "Totale" + "Media/mese" in a flex column, each with top label + bold value
5. **Subcategory total row:** Font-weight 600, top border (2px), verifies contributions sum exactly
6. **Previous-year row:** Muted foreground, conditional appearance (only when sufficient coverage)

---
