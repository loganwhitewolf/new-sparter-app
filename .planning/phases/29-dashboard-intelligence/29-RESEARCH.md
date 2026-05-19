# Phase 29: Dashboard Intelligence - Research

**Researched:** 2026-05-19
**Domain:** Dashboard analytics — deviation view, date range bug fix, Recharts chart refactor
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Bug fix (blocking)**
- D-01: Fix `last-month` preset in `lib/utils/date.ts` — it currently returns the current month (from `now.getMonth()`) instead of the previous calendar month. Must return `{ from: new Date(year, month - 1, 1), to: endOfMonth(year, month - 1) }`.

**Deviation view — data model**
- D-02: Reference Period = last completed calendar month (the fixed `last-month` preset after D-01 is applied).
- D-03: Baseline = average monthly spend per category/subcategory computed over the 3 calendar months preceding the Reference Period. If fewer than 3 months of data exist, use however many are available.
- D-04: Deviation = `(referenceAmount - baseline) / baseline * 100`, expressed as a signed percentage. Positive = spent more than average, negative = spent less.
- D-05: Noise threshold = subcategories with absolute spend < €15 in the Reference Period are excluded from the deviation view to avoid misleading percentages from micro-spends.

**Deviation view — UI (existing pages only, no new tabs)**
- D-06: `/dashboard/categories` page gains a Deviation column showing the signed percentage with color coding: red = overspent vs baseline (for `out` categories), green = underspent. Polarity is reversed for `in` categories (green = more income than baseline).
- D-07: Sort order on `/dashboard/categories` is switchable. Default sort = absolute deviation descending (biggest surprises first). Secondary sort = amount (existing behavior).
- D-08: `/dashboard/categories/[id]` detail page gains the same deviation column on each subcategory row, using the same Reference Period / Baseline / Noise threshold logic.
- D-09: Deviation display = percentage only (e.g. `+45%`, `-12%`). No euro delta in the list view.

**Monthly trend chart refactor**
- D-10: The existing `MonthlyTrendChart` `ComposedChart` (bars + line) is split into two separate charts stacked vertically.
- D-11: Chart A = bar chart with Entrate + Uscite series only. "Non categorizzato" and "Ignorato" series are removed from the chart.
- D-12: Chart B = per-month colored bar chart for Bilancio. Green bar = positive balance month, red bar = negative balance month. Replaces the balance line overlay that broke when balance went below zero.

### Claude's Discretion
None specified — all decisions locked.

### Deferred Ideas (OUT OF SCOPE)
- User-defined spending goals per category (budget targets)
- Gamification / badges / streaks
- Real-time bank sync
</user_constraints>

---

## Summary

Phase 29 makes the dashboard actionable by adding a deviation view (category vs 3-month rolling baseline) and splitting the existing ComposedChart into two cleaner charts.

**Bug D-01 is confirmed and critical.** In `lib/utils/date.ts`, the `last-month` case in `dashboardPresetToDateRange` uses `now.getMonth()` to compute `from`, which produces the current month, not the previous one. The fix is minimal: change `month` to `month - 1` for both `from` and the `endOfMonth` call. The existing test in `tests/dashboard-dal.test.ts` (line 74-82) documents the buggy behavior and must be updated to assert the correct April dates.

**The deviation query is a net-new DAL function** — no existing function returns per-category rolling baseline data. It requires a single Drizzle query with `GROUP BY category_id, to_char(occurred_at, 'YYYY-MM')` over the 3 months preceding the Reference Period, then a server-side average computation using Decimal.js.

**The chart split is surgical.** The existing `MonthlyTrendChart` component has `hidden` toggle state tied to all 5 series. Splitting into two separate components (Chart A: Entrate/Uscite bars, Chart B: Bilancio bars with Cell per-bar coloring) eliminates shared state — each chart is independent and simpler. `Cell` from Recharts is already used in `category-breakdown-chart.tsx` and works correctly in Recharts 3.8.1.

**Primary recommendation:** Fix D-01 first (blocking for D-02 Reference Period), then add the deviation DAL function, then wire the UI. Chart split is independent and can proceed in parallel.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| last-month date range bug fix | Server (utility) | — | Pure date computation, no I/O |
| Deviation baseline query | API / Backend (DAL) | — | DB aggregation, belongs in `lib/dal/dashboard.ts` |
| Deviation computation (%) | Server (utility) | — | Decimal.js arithmetic, new function in `lib/utils/dashboard.ts` |
| Category deviation display | Frontend (RSC) | — | Rendered by Server Components on categories pages |
| Deviation sort toggle | Frontend (RSC + URL state) | — | Sort param read from searchParams, passed to DAL |
| Chart A: Entrate/Uscite bars | Browser / Client | — | Recharts client component |
| Chart B: Bilancio colored bars | Browser / Client | — | Recharts `Cell` per-bar coloring, client component |

---

## Standard Stack

### Core (already in project, no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Recharts | 3.8.1 | Chart A and Chart B rendering | Already used; `Cell` for per-bar color confirmed [VERIFIED: codebase] |
| Decimal.js | ^10.6.0 | Deviation % computation, baseline average | Project non-negotiable for monetary arithmetic [VERIFIED: CLAUDE.md] |
| Drizzle ORM | ^0.45.2 | Baseline aggregation query (GROUP BY month) | Existing pattern in `lib/dal/dashboard.ts` [VERIFIED: codebase] |
| shadcn/ui + Tailwind | installed | Deviation badge styling, sort toggle button | Existing pattern in component library [VERIFIED: codebase] |

### No new dependencies required
All capabilities needed for this phase are satisfied by the existing stack. [VERIFIED: package.json]

---

## Architecture Patterns

### System Architecture Diagram

```
User opens /dashboard/categories
        |
        v
[categories/page.tsx (RSC)]
   reads searchParams: { preset, type, sort }
        |
        +---> getCategoryRanking(filters) -- existing, returns CategoryRankingItem[]
        |
        +---> getCategoryDeviation(userId, referenceRange, baselineRange)  ← NEW
                    |
                    v
             [lib/dal/dashboard.ts]
             Single Drizzle query:
               GROUP BY category_id, month
               over baselineRange (3 months)
             Returns: BaselineRow[]
                    |
                    v
             buildDeviationData(referenceRows, baselineRows)
               - sum referenceAmount per category
               - avg baselineAmount per category over N months
               - compute (ref - baseline) / baseline * 100  [Decimal.js]
               - apply noise threshold (< €15 excluded)
             Returns: CategoryDeviationMap  (categoryId -> deviation%)
                    |
                    v
             merged with CategoryRankingItem[] in page
                    |
                    v
        [CategoryRankingList (Client Component)]
        displays deviation column, handles sort toggle

User opens /dashboard/categories/[id]
        |
        v
[categories/[id]/page.tsx (RSC)]
        |
        +---> getCategoryDetail(categoryId, filters) -- existing
        |
        +---> getSubcategoryDeviation(userId, categoryId, referenceRange, baselineRange) ← NEW
                    |
                    v
             Similar to above but GROUP BY subcategory_id
             Applies noise threshold per subcategory
                    |
                    v
        [CategorySubcategoryBreakdown (Client or Server)]
        displays deviation column per subcategory row

/dashboard/overview (MonthlyTrendChart split)
        |
        v
[overview/page.tsx (RSC)]
        getAggregatedTransactionsData(preset) -- existing, no change
                    |
                    v
        data: MonthlyTrendPoint[] (totalIn, totalOut, totalNc, totalIgn)
                    |
            +-------+-------+
            |               |
        [EntrateUsciteChart]  [BilancioChart]
        Bar: totalIn/Out     Bar + Cell per sign
        (Chart A)            (Chart B)
```

### Recommended Project Structure (delta)

```
lib/
├── dal/
│   └── dashboard.ts         # + getCategoryDeviation(), getSubcategoryDeviation()
├── utils/
│   └── dashboard.ts         # + computeDeviation(), buildDeviationMap()
components/
└── dashboard/
    ├── monthly-trend-chart.tsx         # REMOVED (replaced by two below)
    ├── entrate-uscite-chart.tsx        # NEW — Chart A (Entrate/Uscite bars)
    ├── bilancio-chart.tsx              # NEW — Chart B (colored Bilancio bars)
    └── category-ranking-list.tsx       # EXTENDED — deviation column + sort toggle
    └── category-subcategory-breakdown.tsx  # EXTENDED — deviation column
tests/
└── dashboard-dal.test.ts    # UPDATED — fix last-month assertion, add deviation tests
```

### Pattern 1: Deviation Query (single GROUP BY)

**What:** One Drizzle query for the 3-month baseline window, returning `categoryId + month + amount`. Server-side averaging with Decimal.js.

**When to use:** Whenever baseline computation is needed. Do NOT run 3 separate queries.

```typescript
// Source: existing getCategoryRanking pattern in lib/dal/dashboard.ts
const baselineRows = await db
  .select({
    categoryId: category.id,
    month: sql<string>`to_char(${transactionTable.occurredAt}, 'YYYY-MM')`,
    amount: sql<string>`coalesce(abs(sum(${transactionTable.amount})), 0)::text`,
  })
  .from(transactionTable)
  .innerJoin(expense, eq(transactionTable.expenseId, expense.id))
  .innerJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
  .innerJoin(category, eq(subCategory.categoryId, category.id))
  .where(
    and(
      dateScopedTransactions(userId, baselineFrom, baselineTo),
      expenseStatusIncludedInDashboardTotals(),
      ne(category.slug, 'ignore'),
      ne(category.type, 'system'),
      notExcludedFromTotals(),
      typeFilter
    )
  )
  .groupBy(category.id, sql`to_char(${transactionTable.occurredAt}, 'YYYY-MM')`)
```

### Pattern 2: Deviation Computation (Decimal.js)

```typescript
// Source: lib/utils/dashboard.ts existing computeDeltaPercent pattern
export function computeDeviation(
  referenceAmount: string,
  baseline: string
): number | null | 'new' {
  const ref = toDecimal(referenceAmount)
  const base = toDecimal(baseline)

  if (base.isZero() && ref.isZero()) return null        // exclude
  if (base.isZero() && !ref.isZero()) return 'new'      // first appearance
  return roundedPercent(ref.minus(base).div(base.abs()).times(100))
}
```

### Pattern 3: Per-bar Color with Cell (Recharts)

**What:** `Cell` from Recharts renders individual bar color based on data value. Already used in `category-breakdown-chart.tsx`. [VERIFIED: codebase]

```tsx
// Source: components/dashboard/category-breakdown-chart.tsx (existing pattern)
import { Bar, BarChart, Cell } from 'recharts'

<Bar dataKey="balance">
  {chartData.map((point) => (
    <Cell
      key={point.month}
      fill={point.balance >= 0 ? 'var(--total-in)' : 'var(--color-destructive)'}
    />
  ))}
</Bar>
```

### Pattern 4: Sort Toggle via URL searchParams

**What:** Sort order for the deviation column is a URL param (`sort=deviation` vs `sort=amount`). The page reads it from `searchParams`, passes it to the DAL builder function as a sort key. No client-side state — sort is a server-side param like `preset` and `type`.

```typescript
// In categories/page.tsx
type SortKey = 'deviation' | 'amount'

function parseSortKey(input: unknown): SortKey {
  return input === 'deviation' ? 'deviation' : 'amount'
}

// In buildCategoryRankingData or a new merge helper:
items.sort((a, b) => {
  if (sortKey === 'deviation') {
    // sort by abs(deviation) desc, nulls last
  } else {
    // existing amount sort
  }
})
```

### Anti-Patterns to Avoid

- **Native JS arithmetic on monetary amounts:** `referenceAmount - baseline` is forbidden. Use `toDecimal(ref).minus(toDecimal(base))`. [CLAUDE.md non-negotiable]
- **Converting Drizzle DECIMAL strings to number before Decimal.js:** `Number('900.00')` loses precision on edge cases. Pass the string directly to `toDecimal()`.
- **Three separate queries for baseline months:** One GROUP BY query is simpler and faster. No need to query Jan, Feb, Mar separately.
- **Storing deviation sort in React state:** Sort belongs in the URL (like `preset`, `type`) for SSR cacheability and link-ability.
- **Reusing the `delta` field name:** The existing `deltas` on `OverviewData` is period-over-period. Deviation is vs rolling average — keep them as separate named fields to avoid confusion.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-bar chart colors | Custom SVG bar renderer | Recharts `Cell` | Already in codebase, Recharts 3.8.1 supports it natively [VERIFIED: codebase] |
| Decimal percentage computation | Native JS `/ * 100` | `toDecimal().div().times(100)` with `.toDecimalPlaces(1)` | Floating point errors on edge values |
| Date range for "3 months before last month" | Custom calendar logic | `new Date(year, month - 4, 1)` to `new Date(year, month - 1, 0)` | Simple once D-01 fix is in place |
| Noise threshold filtering | Complex predicate in SQL | Server-side filter after query result | Query already groups by category; threshold is a simple `toDecimal(ref).abs().gte(15)` check |

---

## D-01 Bug: Precise Description

**File:** `lib/utils/date.ts`, function `dashboardPresetToDateRange`, case `'last-month'`/`default`

**Current (buggy) code:**
```typescript
case 'last-month':
default:
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1),  // BUG: now.getMonth() = current month
    to,  // endOfMonth(now.getFullYear(), now.getMonth()) = end of current month
  }
```

**Fixed code:**
```typescript
case 'last-month':
default:
  return {
    from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    to: endOfMonth(now.getFullYear(), now.getMonth() - 1),
  }
```

**Example (today = 2026-05-19):**
- Buggy: from = 2026-05-01, to = 2026-05-31 (current month, not last)
- Fixed: from = 2026-04-01, to = 2026-04-30 (correct previous month)

**Cascading impact on `to` variable:** The `to` constant at the top of `dashboardPresetToDateRange` is `endOfMonth(now.getFullYear(), now.getMonth())` = end of current month. After the fix the `last-month` case must compute its own `to` (end of previous month) and NOT reuse the outer `to`. The outer `to` is still correctly used by `last-3-months`, `last-6-months`, `this-year` (they all end at the end of the current month). [VERIFIED: reading the code]

**Test that must be updated:** `tests/dashboard-dal.test.ts`, test "uses the selected dashboard preset for KPI ranges..." (line 71-93). The `last-month` assertion currently expects `current: { from: new Date(2026, 4, 1), to: new Date(2026, 4, 31, ...) }` which is May = current month. After fix, it must expect April: `from: new Date(2026, 3, 1), to: new Date(2026, 3, 30, ...)`.

**`previousDashboardPresetDateRange` for `last-month`:** Already correct — it returns the month before the Reference Period (i.e. 2 months ago). After D-01 fix, "current" = April, "previous" = March. No change needed in `previousDashboardPresetDateRange`.

---

## Deviation Query Architecture

### Baseline Date Range

Given Reference Period = last completed calendar month (April when today is May 2026):

```
referenceFrom = new Date(year, month - 1, 1)  // April 1
referenceTo   = endOfMonth(year, month - 1)   // April 30

baselineFrom  = new Date(year, month - 4, 1)  // Jan 1 (3 months before April)
baselineTo    = new Date(year, month - 1, 0, 23, 59, 59, 999) // March 31
```

The baseline query spans 3 months and returns rows per (categoryId, month). The server then averages across however many distinct months returned (1, 2, or 3 — per D-03).

### New DAL Types

```typescript
export type CategoryDeviationItem = {
  categoryId: number
  deviation: number | null | 'new'  // null = both zero; 'new' = no baseline
}

export type SubcategoryDeviationItem = {
  subCategoryId: number
  deviation: number | null | 'new'
  belowNoiseThreshold: boolean  // true if referenceAmount < 15
}
```

### New DAL Functions

1. `getCategoryDeviation(preset: DashboardPreset, type: 'in' | 'out'): Promise<CategoryDeviationItem[]>`
   - Computes reference range (fixed `last-month` after D-01)
   - Computes baseline range (3 months prior)
   - Runs two queries: one for reference totals, one for baseline per month
   - Applies noise threshold at category level (sum of all subcategories)
   - Returns signed deviation % per category

2. `getSubcategoryDeviation(categoryId: number, preset: DashboardPreset, type: 'in' | 'out'): Promise<SubcategoryDeviationItem[]>`
   - Same logic but scoped to one category's subcategories
   - Applies noise threshold per subcategory (D-05)

### New Utility Functions in `lib/utils/dashboard.ts`

```typescript
export function computeDeviation(
  referenceAmount: string,
  baseline: string
): number | null | 'new'

export function buildDeviationMap(
  referenceRows: Array<{ id: number; amount: string }>,
  baselineRows: Array<{ id: number; month: string; amount: string }>,
  noiseThreshold: string  // '15.00'
): Map<number, number | null | 'new'>
```

---

## MonthlyTrendChart Split — Key Findings

### Current component state

`MonthlyTrendChart` is a client component with:
- `hidden: Set<SeriesKey>` state for toggling series visibility
- 5 series: `totalIn`, `totalOut`, `totalNc`, `totalIgn`, `balance`
- Custom `BalanceDot` that colors line dots green/red based on sign
- Manual toggle buttons (not the ChartLegend default)

### Split strategy

**Chart A (`EntrateUsciteChart`):**
- Props: `data: MonthlyTrendPoint[]`
- Only `totalIn` and `totalOut` bars — no toggle needed (2 series, always visible)
- Drop `totalNc`, `totalIgn`, `balance`, `BalanceDot`, `hidden` state
- Use existing `ChartContainer` + `ChartTooltip` + `ChartLegend`

**Chart B (`BilancioChart`):**
- Props: `data: MonthlyTrendPoint[]`
- Single `Bar` with `Cell` per entry (green if balance >= 0, red otherwise)
- Balance = `toDecimal(totalIn).minus(toDecimal(totalOut))` computed from existing `MonthlyTrendPoint` fields
- No `balance` field needed in `MonthlyTrendPoint` (compute at render time in `useMemo`)
- Drop `BalanceDot` (replaced by `Cell`)
- Simple `BarChart` (not `ComposedChart`)
- YAxis needs `domain` starting from minimum negative value for correct scaling

**`MonthlyTrendPoint` type:** No change needed. `totalIn` and `totalOut` are already strings. [VERIFIED: lib/dal/dashboard.ts line 123-130]

**`getAggregatedTransactionsData`:** No change needed. The query already returns `totalIn`, `totalOut`, `totalNc`, `totalIgn`. [VERIFIED: lib/dal/dashboard.ts line 1028-1057]

**Overview page:** Replace single `<MonthlyTrendChart data={data} />` with two components stacked vertically. The `TrendSkeleton` may need to be split or made taller.

---

## Common Pitfalls

### Pitfall 1: D-01 `to` variable reuse
**What goes wrong:** After fixing `from` to `month - 1`, a developer might leave `to` as the outer `to` constant (end of current month), producing a range from April 1 to May 31 instead of April 30.
**Why it happens:** The outer `to` variable is defined before the switch and shared across cases.
**How to avoid:** The `last-month` case must compute its own `to: endOfMonth(year, month - 1)`. The outer `to` is correct for all other cases.

### Pitfall 2: Test not updated after D-01 fix
**What goes wrong:** `dashboard-dal.test.ts` line 74-82 asserts `current.from = new Date(2026, 4, 1)` (May). After the fix this will FAIL.
**How to avoid:** Update the test in the same task as the D-01 fix. New assertion: `current.from = new Date(2026, 3, 1)` (April 1), `current.to = new Date(2026, 3, 30, 23, 59, 59, 999)`.

### Pitfall 3: Baseline window off-by-one
**What goes wrong:** Baseline = "3 months BEFORE the Reference Period". If Reference = April, baseline = Jan+Feb+Mar. Computing `baselineFrom = new Date(year, month - 4, 1)` from `now` when `month = 4` (May) gives `month - 4 = 0` = January — correct. Edge case: if today = January (month = 0), `month - 4 = -4` → JavaScript Date handles negative months correctly (rolls back to prior year). This works natively.
**How to avoid:** Verify with a test using `now = new Date(2026, 0, 15)` (January).

### Pitfall 4: Deviation = 'new' display
**What goes wrong:** Rendering `deviation='new'` as a percentage badge without handling the special case crashes or shows "NaN%".
**How to avoid:** The deviation badge component must handle three states: `null` (show nothing), `'new'` (show "Nuovo" badge), `number` (show `+X%` or `-X%`).

### Pitfall 5: Noise threshold applied before or after averaging
**What goes wrong:** D-05 says subcategories with absolute spend < €15 in the Reference Period are excluded. The threshold must be applied to the REFERENCE amount, not to the baseline. Applying it to the baseline may incorrectly exclude subcategories that are new this month.
**How to avoid:** Filter on `referenceAmount` only.

### Pitfall 6: Sort toggle drops `type` filter
**What goes wrong:** Adding `sort=deviation` to the URL without preserving the existing `type` param causes the page to reset the type filter to default.
**How to avoid:** The sort toggle button must build the URL preserving `preset`, `type`, and toggling only `sort`. Per D-CONTEXT specifics: "The deviation sort toggle should preserve the existing `type` query param."

### Pitfall 7: BilancioChart YAxis domain with negative values
**What goes wrong:** Recharts Bar charts with default YAxis `domain={['auto', 'auto']}` may not correctly extend below zero when all visible months are positive, hiding the negative-colored bars.
**How to avoid:** Set `YAxis domain={['auto', 'auto']}` explicitly, or compute `Math.min(...data.map(d => d.balance), 0)` as the lower bound.

---

## Code Examples

### D-01 Fix

```typescript
// lib/utils/date.ts — dashboardPresetToDateRange
case 'last-month':
default:
  return {
    from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    to: endOfMonth(now.getFullYear(), now.getMonth() - 1),
  }
```

### Deviation computation utility

```typescript
// lib/utils/dashboard.ts
export function computeDeviation(
  referenceAmount: string,
  baseline: string
): number | null | 'new' {
  const ref = toDecimal(referenceAmount)
  const base = toDecimal(baseline)
  if (base.isZero() && ref.isZero()) return null
  if (base.isZero()) return 'new'
  return roundedPercent(ref.minus(base).div(base.abs()).times(100))
}
```

### Chart B (BilancioChart) Cell pattern

```tsx
// components/dashboard/bilancio-chart.tsx
// Source: existing Cell pattern from components/dashboard/category-breakdown-chart.tsx
import { Bar, BarChart, Cell, XAxis, YAxis } from 'recharts'

<Bar dataKey="balance">
  {chartData.map((point) => (
    <Cell
      key={point.month}
      fill={point.balance >= 0 ? 'var(--total-in)' : 'var(--color-destructive)'}
    />
  ))}
</Bar>
```

### Deviation badge component

```tsx
// components/dashboard/deviation-badge.tsx
type Props = { deviation: number | null | 'new'; type: 'in' | 'out' }

export function DeviationBadge({ deviation, type }: Props) {
  if (deviation === null) return null
  if (deviation === 'new') return <span className="text-xs text-muted-foreground">Nuovo</span>

  const isPositive = deviation > 0
  // For 'out': positive = overspent = red; negative = underspent = green
  // For 'in': positive = more income = green; negative = less income = red
  const isGood = type === 'out' ? !isPositive : isPositive
  const color = isGood ? 'text-total-in' : 'text-destructive'
  const sign = deviation > 0 ? '+' : ''

  return (
    <span className={cn('font-mono text-xs tabular-nums', color)}>
      {sign}{deviation}%
    </span>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ComposedChart` with 5 series + toggle | Two focused BarCharts (D-10/D-11/D-12) | Phase 29 | Cleaner, no broken line below zero |
| `BalanceDot` (colored line dots) | `Cell` per bar (Chart B) | Phase 29 | Visual fix for negative balance months |
| Amount-first sort on categories page | Deviation-first sort (switchable) | Phase 29 | Biggest surprises first by default |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | JavaScript `new Date(year, negativeMonth, 1)` correctly rolls back to the prior year | D-01 fix / baseline range | Low — this is well-specified JS Date behavior, but should be tested |
| A2 | The outer `to` variable in `dashboardPresetToDateRange` is NOT used by the `last-month` case after the fix | D-01 Bug section | Medium — if reused, range becomes April 1 – May 31 (wrong) |

---

## Open Questions

1. **Should `getCategoryDeviation` be always called with the fixed `last-month` preset, or accept a preset param?**
   - What we know: D-02 says Reference Period = last completed calendar month, always. It is not the user-selected `preset`.
   - What's unclear: Should the deviation view be visible when the user selects a different preset (e.g. `this-year`)?
   - Recommendation: Always use the fixed `last-month` reference for deviation, regardless of the preset filter. Show deviation column in all views. The preset filter controls which period the main ranking amounts show, but deviation is always vs. the fixed reference.

2. **How should the categories page handle a category present in ranking but absent from the deviation result?**
   - What we know: If a category had zero spend in both reference and baseline, `computeDeviation` returns `null` and the item is excluded from deviation data.
   - What's unclear: Should the deviation column show "—" or be hidden for that category?
   - Recommendation: Show "—" (not an error). The category still appears in the ranking list because it may have spend in the user-selected period even if it has no deviation data.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely code changes with no new external dependencies. All required tools (Drizzle, Recharts, Decimal.js, Vitest) are already installed and verified.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.5 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/dashboard-dal.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| D-01 | `last-month` returns previous calendar month | unit | `npx vitest run tests/dashboard-dal.test.ts` | ✅ (needs update) |
| D-03/D-04 | Deviation % computed correctly from baseline average | unit | `npx vitest run tests/dashboard-dal.test.ts` | ❌ Wave 0 |
| D-05 | Subcategories < €15 excluded from deviation | unit | `npx vitest run tests/dashboard-dal.test.ts` | ❌ Wave 0 |
| D-07 | Deviation sort produces absolute-desc order | unit | `npx vitest run tests/dashboard-dal.test.ts` | ❌ Wave 0 |
| D-09 | Deviation badge renders `+X%`, `-X%`, `Nuovo`, `null` | unit (component) | `npx vitest run tests/deviation-badge.test.tsx` | ❌ Wave 0 |
| D-11/D-12 | EntrateUsciteChart and BilancioChart render without ComposedChart | unit (component) | `npx vitest run tests/trend-charts.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/dashboard-dal.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green (currently 504 passing, 0 failing) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] Add `buildDeviationMap` and `computeDeviation` tests to `tests/dashboard-dal.test.ts`
- [ ] `tests/deviation-badge.test.tsx` — covers D-09 (badge rendering for all 4 states)
- [ ] `tests/trend-charts.test.tsx` — covers D-11/D-12 (chart split rendering)
- [ ] Update existing D-01 test assertion to reflect fixed behavior (April, not May)

---

## Project Constraints (from CLAUDE.md)

All of the following apply to this phase:

- **Monetary arithmetic:** All deviation computations use `toDecimal()` / `toDbDecimal()` from `@/lib/utils/decimal`. No native `+`, `-`, `*`, `/` on amounts.
- **Drizzle DECIMAL as string:** Amounts from DB are strings. Pass directly to `toDecimal(stringValue)` — do not use `Number()` intermediary.
- **Language:** Code identifiers, comments, component names, test names in English. UI copy (badge labels, column headers) in Italian.
- **No drizzle-kit push:** No schema changes in this phase, so this rule is not triggered.
- **Better Auth:** No auth changes in this phase.
- **`yarn check:language`:** Run after any changes touching routes, comments, or developer-facing strings.

---

## Security Domain

This phase adds read-only analytical queries and UI changes. No new authentication, session management, or input validation surface.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | `verifySession()` already called in all DAL functions; new functions must follow same pattern |
| V5 Input Validation | yes | `sort` query param parsed with allowlist (`'deviation' | 'amount'`); `categoryId` already validated with `parseCategoryId` |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Insecure direct object reference on categoryId | Elevation of Privilege | `getCategoryDetail` already scopes by `userId`; new deviation query must do the same |
| Sort param injection | Tampering | Parse with explicit allowlist, default to `'amount'` |

---

## Sources

### Primary (HIGH confidence)
- `lib/dal/dashboard.ts` — all existing DAL functions, query patterns, type definitions [VERIFIED: codebase read]
- `lib/utils/date.ts` — confirmed D-01 bug with local time verification script [VERIFIED: codebase + node script]
- `lib/utils/dashboard.ts` — `computeDeltaPercent`, `computeBreakdownPercentages` patterns [VERIFIED: codebase]
- `components/dashboard/monthly-trend-chart.tsx` — `hidden` state, 5 series, `BalanceDot` [VERIFIED: codebase]
- `components/dashboard/category-breakdown-chart.tsx` — `Cell` per-bar coloring pattern [VERIFIED: codebase]
- `tests/dashboard-dal.test.ts` — existing test coverage, test that documents buggy D-01 behavior [VERIFIED: codebase]
- `package.json` — recharts@3.8.1, decimal.js@^10.6.0, drizzle-orm@^0.45.2 [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- None required — all findings based directly on codebase inspection

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- D-01 bug analysis: HIGH — confirmed with code reading and node script execution
- Deviation query pattern: HIGH — directly derived from existing `getCategoryRanking` pattern
- Recharts `Cell` compatibility: HIGH — already used in `category-breakdown-chart.tsx` with recharts 3.8.1
- Chart split strategy: HIGH — based on complete reading of existing component
- Sort toggle via URL: HIGH — follows existing `preset`/`type` URL pattern in the codebase

**Research date:** 2026-05-19
**Valid until:** 2026-06-18 (stable stack)
