# S01 Research: Structural Refactor and Extended Overview

## Summary

S01 is a **targeted research** slice — all technology is familiar (Next.js App Router, Recharts, existing DAL), but several concrete constraints and seams must be clear before the planner assigns tasks. The slice delivers: (1) route restructuring into nested sub-routes, (2) a shared dashboard layout with tab nav, (3) migration of the existing monolith `dashboard/page.tsx` to `dashboard/overview/page.tsx`, (4) extended `MonthlyTrendChart` with three series (IN/OUT/balance) where balance months are conditionally colored. No DAL changes are required for S01 — all needed data (`totalIn`, `totalOut`) is already returned by `getAggregatedTransactionsData`.

---

## What Exists Today

### Route: `app/(app)/dashboard/page.tsx`
Single monolithic server component that renders:
- `KpiCards` (via `getOverview(preset)`)
- `CategoryBreakdownChart` + `DashboardFilters` (via `getCategoriesBreakdown(filters)`)
- `MonthlyTrendChart` (via `getAggregatedTransactionsData(preset)`)

All three are wrapped in `Suspense` with dedicated skeleton components. The `DashboardFilters` component **hardcodes `router.replace('/dashboard?' + ...)` on line 57** — this must be updated to work with the new sub-route structure.

### Components: `components/dashboard/`
- `kpi-cards.tsx`, `kpi-card.tsx` — pure display, no routing knowledge, move as-is
- `monthly-trend-chart.tsx` — 'use client', renders `BarChart` with 4 series (totalIn, totalOut, totalNc, totalIgn) using `Bar`. Must be extended to add a `balance` line series. Uses Recharts `BarChart` only. The balance series requires `ComposedChart` (mixing `Bar` and `Line`) or a pure `LineChart` change. See chart design section below.
- `dashboard-filters.tsx` — 'use client', contains hardcoded `/dashboard` path (line 57). Must be made route-aware.
- `overview-skeleton.tsx`, `trend-skeleton.tsx`, `breakdown-skeleton.tsx` — reusable as-is

### DAL: `lib/dal/dashboard.ts`
- `getAggregatedTransactionsData(preset)` — already returns `MonthlyTrendPoint[]` with `totalIn: string` and `totalOut: string` per month. Balance is derivable as `toDecimal(totalIn).minus(toDecimal(totalOut))` — no new query needed.
- `MonthlyTrendPoint` type already has `totalIn` and `totalOut` as strings (Drizzle DECIMAL → string, per project rule).
- S01 does not add any new DAL functions (those belong to S02/S03).

### Validations: `lib/validations/dashboard.ts`
- `parseDashboardFilters` currently defaults `preset` to `'last-month'` unconditionally.
- S01 must support a **per-route default**: overview defaults `last-month`, categories defaults `this-year` (S02). This can be achieved by adding an optional `defaultPreset` parameter to `parseDashboardFilters`.
- `DashboardFiltersSchema`, `DashboardPreset`, `DashboardType` — no changes needed in S01 beyond the default parameter.

### Routes: `lib/routes.ts`
- `APP_ROUTES.dashboard = "/dashboard"` — sidebar and bottom-nav both use this with `pathname.startsWith('/dashboard/')` logic already in place. Since both nav components check `pathname === href || pathname.startsWith(\`${href}/\`)`, the sidebar/bottom-nav "Dashboard" active state will work correctly for sub-routes **without any changes** (already verified in sidebar.tsx:29 and bottom-nav.tsx:isActive pattern).
- Need to add `dashboardOverview: "/dashboard/overview"` and potentially `dashboardCategories: "/dashboard/categories"` to `APP_ROUTES` for the tab nav component to use canonical paths.

### App layout: `app/(app)/layout.tsx`
Single layout file wrapping sidebar + topbar + main + bottom-nav. The new `app/(app)/dashboard/layout.tsx` will nest inside this. No changes needed to the app-level layout.

---

## Key Constraints and Findings

### 1. `DashboardFilters` path hardcoding
`components/dashboard/dashboard-filters.tsx` line 57 calls `router.replace('/dashboard?' + params.toString())`. Once content moves to `/dashboard/overview`, this must update to use `usePathname()` and replace on the current path, not a hardcoded one. The fix: capture `const pathname = usePathname()` and replace with `router.replace(pathname + '?' + params.toString(), { scroll: false })`.

### 2. Three-series chart: `ComposedChart` required
The existing `MonthlyTrendChart` uses `BarChart` with `Bar` components for all 4 series. Adding a `Line` for the balance requires switching to `ComposedChart` (from recharts) which supports mixed `Bar` + `Line` rendering. This is confirmed available in recharts 3.8.1 (`ComposedChart`, `Line` are exported). The balance line must use **conditional coloring per data point** — recharts `Line` does not natively support per-point stroke color on a continuous line. The correct approach is to compute balance in the chart component (client-side, via `useMemo`) and either:
  - Use `ReferenceLine` for the zero axis + a single neutral line + colored dots (`dot` prop with a custom shape), or
  - Split the line into segments by coloring dots red/green and using a neutral line stroke.
  - **Recommended**: Use a line with a neutral stroke (e.g. `var(--foreground)`) and apply per-point colored `dot` (custom `Dot` component that checks `balance >= 0 ? green : red`). This is simple to implement with recharts `dot` render prop and avoids complex segment splitting.

### 3. Sidebar/BottomNav active state — no change needed
Both `sidebar.tsx` and `bottom-nav.tsx` use `pathname === href || pathname.startsWith(\`${href}/\`)` where `href = APP_ROUTES.dashboard = '/dashboard'`. Since all new sub-routes are under `/dashboard/`, the active state will highlight correctly. Confirmed: no changes required to either nav component.

### 4. Tab nav component: route-based, not Tabs primitive
The tab navigation for overview/categories must be **route-based**, not the shadcn/ui `<Tabs>` component (which uses React state and `TabsContent`). The existing `<Tabs>` is for in-page content switching. For route tabs, use `Link` components styled to look like tabs, with active state from `usePathname().startsWith('/dashboard/overview')` etc. This matches the sidebar/bottom-nav active link pattern already in the codebase.

### 5. Shared layout file: where to put period filter
The `?period=` searchParam is shared across sub-routes. The layout file (`app/(app)/dashboard/layout.tsx`) renders below the page content slot — it cannot read `searchParams` because layouts in Next.js 16 App Router do **not** receive `searchParams` (only `page.tsx` files do). The period `<Select>` filter should live **in each page** (or a client component that reads `useSearchParams()`), not in the layout. The layout only needs to render the tab nav (which doesn't need the period value).

### 6. Redirect: `app/(app)/dashboard/page.tsx` → redirect
After migration, `dashboard/page.tsx` becomes `redirect('/dashboard/overview')`. Next.js App Router colocates `page.tsx` and `layout.tsx` at the same directory level — the page redirect and the layout coexist fine at `app/(app)/dashboard/`.

### 7. CategoryBreakdownChart scope
The existing `CategoryBreakdownChart` and its `DashboardFilters` (type switcher + preset) currently live in the monolith page. In S01, the overview page does **not** include the category breakdown section — that moves to S02. The overview page shows only: KPI cards + extended trend chart + a period preset selector. The type (in/out/all) selector is only relevant for the breakdown, not the overview trend.

---

## Implementation Landscape

### Files to Create
| File | Purpose |
|---|---|
| `app/(app)/dashboard/layout.tsx` | Shared dashboard layout: renders tab nav, passes `{children}` |
| `app/(app)/dashboard/overview/page.tsx` | New overview page: KPI cards + extended trend chart + period filter |
| `components/dashboard/dashboard-tab-nav.tsx` | Route-based tab nav (Overview / Categories) with `usePathname` active state |

### Files to Modify
| File | Change |
|---|---|
| `app/(app)/dashboard/page.tsx` | Replace content with `redirect('/dashboard/overview')` |
| `components/dashboard/monthly-trend-chart.tsx` | Add balance series using `ComposedChart` + `Line` with colored dots |
| `components/dashboard/dashboard-filters.tsx` | Replace hardcoded `/dashboard` with `usePathname()` |
| `lib/routes.ts` | Add `dashboardOverview`, `dashboardCategories` constants |
| `lib/validations/dashboard.ts` | Add optional `defaultPreset` param to `parseDashboardFilters` |

### Files Moved/Reused (no changes)
| File | Status |
|---|---|
| `components/dashboard/kpi-cards.tsx` | Reused as-is in overview page |
| `components/dashboard/overview-skeleton.tsx` | Reused in overview page |
| `components/dashboard/trend-skeleton.tsx` | Reused in overview page |
| `components/layout/sidebar.tsx` | No change (active state already works) |
| `components/layout/bottom-nav.tsx` | No change (active state already works) |
| `lib/dal/dashboard.ts` | No S01 DAL changes |

### Files to Remove / Scope Out of S01
- `CategoryBreakdownChart` and its section in overview page — stays in `components/dashboard/` unchanged, but does **not** appear in `overview/page.tsx`. It will be reused by S02.
- `breakdown-skeleton.tsx` — unchanged, used in S02.

---

## Extended MonthlyTrendChart: Design Detail

```tsx
// ComposedChart with Bar (totalIn, totalOut) + Line (balance)
// Balance computed client-side in useMemo:
const chartData = useMemo(() =>
  data.map(point => ({
    ...point,
    totalIn: Number(point.totalIn),
    totalOut: Number(point.totalOut),
    balance: toDecimal(point.totalIn).minus(toDecimal(point.totalOut)).toNumber()
  })),
  [data]
)

// Custom dot component for balance line:
function BalanceDot(props) {
  const { cx, cy, value } = props
  return <circle cx={cx} cy={cy} r={4} fill={value >= 0 ? 'var(--total-in)' : 'var(--color-destructive)'} />
}
```

**Important**: `toDecimal` from `@/lib/utils/decimal` must be used for balance computation (project non-negotiable rule — no native JS arithmetic on monetary values). The computed `balance` number is only used for chart display (not persisted), so converting to `number` for Recharts rendering is acceptable after using Decimal.js for the computation.

---

## Verification Commands

```bash
# Type check
yarn tsc --noEmit

# Build
yarn build

# Language check (routes, comments, dev strings)
yarn check:language
```

Manual browser checks:
1. `GET /dashboard` → redirects to `/dashboard/overview` (HTTP 307 or 308)
2. `/dashboard/overview` shows KPI cards + trend chart with 3 series
3. Tab nav shows "Overview" active; clicking "Categorie" (placeholder link) navigates
4. Sidebar "Dashboard" remains highlighted on all `/dashboard/*` routes
5. Period preset selector on overview changes data and updates URL `?preset=`
6. Balance line: positive months show green dots, negative months show red dots

---

## Natural Seams (Planner Task Boundaries)

1. **Route scaffolding** — Create layout + redirect page + routes constants. Pure structure, zero logic. Unblocks everything.
2. **Overview page migration** — Copy KPI + trend sections from monolith to `overview/page.tsx`; remove category breakdown section; wire `parseDashboardFilters` with `defaultPreset: 'last-month'`.
3. **Tab nav component** — `DashboardTabNav` client component using `usePathname`; render in layout. Standalone, testable by navigating the two routes.
4. **Extended trend chart** — Switch `MonthlyTrendChart` to `ComposedChart`, add balance `Line` with colored dots. Isolated component change with no page-level effects beyond dropping in.
5. **`DashboardFilters` path fix** — Replace hardcoded `/dashboard` with `usePathname()`. Small isolated change.
6. **`parseDashboardFilters` default param** — Add `defaultPreset` option. Requires a Vitest unit test update.

Tasks 1–3 are sequential (layout before page, page before tab nav renders inside layout). Tasks 4–6 are independent of each other and of task 3 once the route exists.

---

## First Proof (Highest Risk)

The three-series `ComposedChart` with conditionally-colored balance `Line` dots is the only novel Recharts pattern in S01. All other work is established local patterns (redirect, layout, route-based links). The executor should implement the chart extension first or in parallel to validate the Recharts API before the rest of the page depends on it.

---

## Requirements Coverage

- R030 — Three distinct navigable dashboard routes: S01 creates the route structure (overview + layout); S02/S03 complete it.
- R033 — Monthly trend with IN/OUT/balance and highlighted months: fully owned by S01.
- R034 — Coherent period filter across dashboard: S01 sets up the `parseDashboardFilters` default param and the overview period selector; the cross-tab persistence is verified end-to-end in S02.
