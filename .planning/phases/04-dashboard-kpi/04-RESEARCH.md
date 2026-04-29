# Phase 4: Dashboard KPI - Research

**Researched:** 2026-04-28
**Domain:** Data visualization dashboard — Recharts + shadcn chart, Drizzle GROUP BY aggregations, Next.js Server Component streaming
**Confidence:** HIGH (stack verified, patterns confirmed from official docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Recharts installato come dipendenza, usato tramite il componente shadcn `chart` (`components/ui/chart.tsx`). Segue già la palette Tailwind/CSS variables senza configurazione aggiuntiva.
- **D-02:** Visualizzazione breakdown: bar orizzontali con drill-down. Lista di categorie come barre orizzontali (Recharts HorizontalBar). Click su una categoria espande le subcategorie sotto, ciascuna con la propria barra, importo e percentuale.
- **D-03:** Filtro tipo: 3 tab sopra il breakdown — Uscite (default) | Entrate | Tutti. I tab selezionano il tipo da visualizzare; il preset date è un Select separato nella stessa toolbar.
- **D-04:** Desktop: 5 card in fila orizzontale (1 riga, 5 colonne). Ogni card: label, importo in Geist Mono, delta badge +/-% rispetto al mese precedente con colore emerald (positivo) / red (negativo).
- **D-05:** Mobile (< 768px): le 5 card si dispongono su 2 colonne, 3 righe (2+2+1 centrata). Nessun scroll orizzontale.
- **D-06:** Colori KPI: entrate = `emerald-600`, uscite = `red-500`, balance/neutro = `slate-700`, savingsRate = emerald se positivo / red se negativo.
- **D-07:** Visualizzazione trend: bar grouped (Recharts BarChart con 4 Bar per mese). Una barra per serie: entrate, uscite, non categorizzato, ignorato.
- **D-08:** Toggle serie via legenda: click sulla legenda Recharts mostra/nasconde ogni serie. Default: tutte e 4 le serie visibili.

### Claude's Discretion
- Struttura esatta dei componenti React per la dashboard (suddivisione in sotto-componenti)
- Gestione loading state e skeleton mentre i dati vengono fetchati
- Exact delta badge design (icona freccia vs +/- text)
- Paginazione o limite sul numero di categorie nel breakdown
- Comportamento del drill-down (accordion animato vs espansione statica)
- Empty state della dashboard (zeri attesi fino a Fase 5 — comportamento accettato, gestione a discrezione)

### Deferred Ideas (OUT OF SCOPE)
- Sparkline mini-chart nelle KPI card
- Hero card balance grande in cima
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | L'utente vede l'overview del mese corrente: totalIn, totalOut, balance, savingsRate, uncategorizedCount con delta rispetto al mese precedente (esclude categoria `ignore`) | getOverview DAL query — Drizzle `sql` template with COUNT on expense table; monetary fields will be zero until Phase 5 adds Transaction amounts |
| DASH-02 | L'utente vede il breakdown delle spese per categoria e subcategoria con percentuale sul totale, filtrabile per preset di date | getCategoriesBreakdown DAL — GROUP BY category+subcategory, URL searchParams for filter, HorizontalBar + drill-down in Client Component |
| DASH-03 | L'utente vede il trend mensile: totalIn, totalOut, non categorizzato, ignorato per ogni mese nel periodo selezionato | getAggregatedTransactionsData DAL — GROUP BY TO_CHAR(month), 4-series grouped BarChart with legend toggle |
</phase_requirements>

---

## Summary

Phase 4 delivers the financial dashboard. The architecture is straightforward: three async Server Components stream independently under Suspense boundaries, each calling its own DAL function in `lib/dal/dashboard.ts`. Chart components (`OverviewKPIs`, `CategoryBreakdown`, `MonthlyTrend`) are Client Components because Recharts requires browser APIs. Filter state lives in URL search params, following the pattern established in Phase 3.

**Critical constraint discovered:** The current `expense` table has NO `amount` column (Phase 3 decision D-01 — amounts live on `transaction` table, arriving in Phase 5). `getOverview` must return `totalIn=0`, `totalOut=0`, `balance=0`, `savingsRate=0` for users with only manual expenses. Only `uncategorizedCount` and its delta will show real data. This is accepted behavior documented in CONTEXT.md. The DAL must handle this gracefully with zero defaults.

The shadcn `chart` component (wrapping Recharts 3.8.1) is not yet installed. It must be added via `npx shadcn@latest add chart`. Chart components require `'use client'` — they cannot be Server Components. The horizontal bar (D-02) uses `layout="vertical"` in Recharts `BarChart`. Legend toggle for the trend chart (D-08) requires local `useState` to track which series are hidden, passed as `hide` prop to each `<Bar>`.

**Primary recommendation:** Install shadcn chart first (Wave 0), build the three DAL functions with realistic zero-safe Decimal.js arithmetic, then build chart Client Components that receive pre-aggregated data as props from async Server Component wrappers.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| KPI data aggregation (getOverview) | API / Backend (DAL) | — | Requires DB access, GROUP BY with CASE WHEN; must stay server-only |
| Category breakdown aggregation | API / Backend (DAL) | — | Multi-level GROUP BY; percentage calc done in JS with Decimal.js server-side |
| Monthly trend aggregation | API / Backend (DAL) | — | GROUP BY TO_CHAR(month); 4 series computation server-side |
| KPI cards display | Frontend Server (SSR) | Browser/Client (for interactivity) | Initial render is Server Component; cards are static display, no interactivity |
| Category breakdown chart | Browser/Client | — | Recharts requires DOM; drill-down state = useState |
| Monthly trend chart | Browser/Client | — | Recharts requires DOM; legend toggle state = useState |
| Filter bar (type tabs + date preset) | Browser/Client | — | URL search param mutations require router.push in Client Component |
| Loading skeletons | Frontend Server (SSR) | — | Suspense fallback rendered server-side as static HTML |
| URL-based filter routing | Browser/Client | Frontend Server (read) | Client writes params; Server Component reads searchParams prop |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 3.8.1 [VERIFIED: npm registry] | BarChart, Legend, XAxis, YAxis, Tooltip | Locked by D-01; shadcn chart wraps it |
| shadcn/ui chart | via `shadcn add chart` [VERIFIED: ui.shadcn.com/docs/components/chart] | ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent | Provides CSS variable color mapping + composition helpers |
| drizzle-orm `sql` template | 0.45.x [VERIFIED: project STACK.md] | Complex GROUP BY aggregations with CASE WHEN, TO_CHAR date grouping | Native Drizzle escape hatch for aggregation queries beyond query builder |
| Decimal.js | 10.6.0 [VERIFIED: project STACK.md] | Server-side percentage calc (savingsRate, breakdown %) | CLAUDE.md absolute rule — never JS native arithmetic on amounts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React.cache | Built into React 19 | Memoize DAL function calls per render pass | Wrap all `lib/dal/dashboard.ts` exports |
| Suspense | Built into React 19 | Stream three chart sections independently | Wrap OverviewKPIs, CategoryBreakdown, MonthlyTrend sections |
| useSearchParams / useRouter | Built into Next.js | Read/write URL filter params in Client Components | DashboardFilters component |

### Installation
```bash
# shadcn chart component (adds components/ui/chart.tsx + recharts dependency)
npx shadcn@latest add chart

# recharts is installed as part of the above; verify:
npm view recharts version  # → 3.8.1
```

**Note:** `chart.tsx` does NOT exist yet in `components/ui/` — it must be added in Wave 0.

---

## Architecture Patterns

### System Architecture Diagram

```
Browser URL: /dashboard?preset=last-3-months&type=out
         │
         ▼
app/(app)/dashboard/page.tsx   [Server Component — reads searchParams]
         │
         ├── <DashboardFilters preset type />     ['use client' — writes URL params]
         │
         ├── <Suspense fallback={<OverviewSkeleton />}>
         │       └── <OverviewSection />          [async Server Component]
         │                 │  calls lib/dal/dashboard.ts → getOverview(userId, currentMonth, prevMonth)
         │                 │  PostgreSQL: COUNT on expense WHERE status=1
         │                 └── <KpiCards data={overview} />    [Server Component — static]
         │
         ├── <Suspense fallback={<BreakdownSkeleton />}>
         │       └── <BreakdownSection preset type />   [async Server Component]
         │                 │  calls lib/dal/dashboard.ts → getCategoriesBreakdown(userId, from, to, type)
         │                 │  PostgreSQL: GROUP BY category_id, sub_category_id
         │                 └── <CategoryBreakdownChart data={breakdown} />  ['use client' — Recharts]
         │
         └── <Suspense fallback={<TrendSkeleton />}>
                 └── <TrendSection preset />             [async Server Component]
                           │  calls lib/dal/dashboard.ts → getAggregatedTransactionsData(userId, from, to)
                           │  PostgreSQL: GROUP BY TO_CHAR(created_at, 'YYYY-MM')
                           └── <MonthlyTrendChart data={trend} />           ['use client' — Recharts]

lib/dal/dashboard.ts
  ├── getOverview(userId, from, to) → OverviewData
  ├── getCategoriesBreakdown(userId, from, to, type) → BreakdownData[]
  └── getAggregatedTransactionsData(userId, from, to) → TrendData[]
         │
         ▼
PostgreSQL via Drizzle ORM (sql`` template literals for GROUP BY aggregations)
```

### Recommended Project Structure
```
app/(app)/dashboard/
├── page.tsx                   # Server Component — reads searchParams, renders Suspense tree
└── loading.tsx                # Optional page-level fallback

components/dashboard/
├── dashboard-filters.tsx      # 'use client' — tabs (type) + Select (preset) — URL params
├── kpi-cards.tsx              # Server Component — 5 card grid, receives OverviewData props
├── kpi-card.tsx               # Server Component — single card with delta badge
├── category-breakdown-chart.tsx  # 'use client' — Recharts HorizontalBar + drill-down state
├── monthly-trend-chart.tsx    # 'use client' — Recharts grouped BarChart + legend toggle state
├── overview-skeleton.tsx      # Skeleton for KPI cards (5 gray boxes)
├── breakdown-skeleton.tsx     # Skeleton for horizontal bar chart
└── trend-skeleton.tsx         # Skeleton for grouped bar chart

lib/dal/dashboard.ts           # All three aggregation queries (new file)
lib/validations/dashboard.ts   # Zod schema for searchParams (preset, type)
```

### Pattern 1: shadcn ChartContainer with ChartConfig (D-01)

The `chart` component wraps Recharts in a CSS variable system. Colors reference `--color-KEY` which shadcn maps from chartConfig.

```typescript
// Source: ui.shadcn.com/docs/components/chart [VERIFIED]
'use client'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Legend } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart'

// D-06: color tokens mapped to project palette
const trendChartConfig = {
  totalIn:   { label: 'Entrate',           color: 'var(--color-emerald-600)' },
  totalOut:  { label: 'Uscite',            color: 'var(--color-red-500)'    },
  totalNc:   { label: 'Non categorizzato', color: 'var(--color-slate-400)'  },
  totalIgn:  { label: 'Ignorato',          color: 'var(--color-slate-200)'  },
} satisfies ChartConfig

// IMPORTANT for Recharts v3: use var(--chart-1) NOT hsl(var(--chart-1))
// shadcn chart adds CSS vars; use Tailwind color tokens directly or custom CSS vars
```

**SSR gotcha:** All Recharts components require `'use client'`. Do NOT render `<BarChart>` in Server Components — it will throw hydration errors. The Server Component async wrapper fetches data and passes it as props to the Client Component chart. [VERIFIED: shadcn docs, multiple community sources]

### Pattern 2: Horizontal Bar Chart with drill-down (D-02)

Recharts `layout="vertical"` makes bars horizontal. Drill-down is NOT built into Recharts — it is implemented via React state toggling which categories are expanded, then rendering subcategory bars below each parent category inline in the chart data array.

```typescript
// Source: [VERIFIED: recharts.org layout="vertical" documentation, shadcn.io patterns]
'use client'
import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Cell } from 'recharts'
import { ChartContainer } from '@/components/ui/chart'

type BreakdownItem = {
  slug: string
  name: string
  amount: number   // always 0 in Phase 4 — real amounts arrive Phase 5
  pct: number      // percentage of total
  type: 'category' | 'subcategory'
  parentSlug?: string
}

export function CategoryBreakdownChart({ data }: { data: BreakdownItem[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Build flat display list: category rows + subcategory rows when expanded
  const displayData = data.flatMap(item => {
    if (item.type !== 'category') return []
    const rows: BreakdownItem[] = [item]
    if (expanded.has(item.slug)) {
      const subs = data.filter(d => d.parentSlug === item.slug)
      rows.push(...subs)
    }
    return rows
  })

  return (
    <ChartContainer config={breakdownConfig} className="min-h-[300px] w-full">
      <BarChart data={displayData} layout="vertical" margin={{ left: 120 }}>
        <XAxis type="number" domain={[0, 100]} unit="%" hide />
        <YAxis
          dataKey="name"
          type="category"
          width={110}
          tick={{ fontSize: 12 }}
          onClick={(_, index) => {
            const item = displayData[index]
            if (item?.type === 'category') {
              setExpanded(prev => {
                const next = new Set(prev)
                next.has(item.slug) ? next.delete(item.slug) : next.add(item.slug)
                return next
              })
            }
          }}
        />
        <Bar dataKey="pct" fill="var(--color-out)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
```

**Drill-down approach:** Static expansion (no animation) is recommended for Phase 4 discretion. The parent category row in YAxis acts as the toggle trigger. Subcategory rows are injected into the data array below their parent — Recharts renders them as additional horizontal bars. [ASSUMED: animation complexity vs. shadcn Accordion — expand-in-place pattern avoids Radix dependency]

### Pattern 3: Grouped Bar Chart with Legend Toggle (D-07, D-08)

```typescript
// Source: Recharts official docs + GitHub discussion #3940 [VERIFIED: pattern confirmed]
'use client'
import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Legend } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart'

type SeriesKey = 'totalIn' | 'totalOut' | 'totalNc' | 'totalIgn'

export function MonthlyTrendChart({ data }: { data: TrendMonth[] }) {
  const [hidden, setHidden] = useState<Set<SeriesKey>>(new Set())

  function toggleSeries(key: SeriesKey) {
    setHidden(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  return (
    <ChartContainer config={trendChartConfig} className="min-h-[300px] w-full">
      <BarChart data={data} barGap={2} barCategoryGap="20%">
        <XAxis dataKey="month" />
        <YAxis />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend
          content={<ChartLegendContent />}
          onClick={(payload) => toggleSeries(payload.dataKey as SeriesKey)}
        />
        <Bar dataKey="totalIn"  fill="var(--color-totalIn)"  hide={hidden.has('totalIn')}  />
        <Bar dataKey="totalOut" fill="var(--color-totalOut)" hide={hidden.has('totalOut')} />
        <Bar dataKey="totalNc"  fill="var(--color-totalNc)"  hide={hidden.has('totalNc')}  />
        <Bar dataKey="totalIgn" fill="var(--color-totalIgn)" hide={hidden.has('totalIgn')} />
      </BarChart>
    </ChartContainer>
  )
}
```

**Legend toggle mechanism:** Recharts `<Bar>` has a `hide` prop. Managing `hidden` as a `Set<string>` in local state and passing `hide={hidden.has(key)}` to each `<Bar>` is the standard pattern. The `ChartLegend` `onClick` receives `{ dataKey, value, color, payload }`. [VERIFIED: recharts GitHub issue #590, discussions #3940 — confirmed `hide` prop approach]

### Pattern 4: Drizzle GROUP BY with date_trunc (DASH-03)

```typescript
// Source: Drizzle ORM docs sql`` operator + GitHub discussion #2893 [VERIFIED]
import 'server-only'
import { cache } from 'react'
import { sql, count } from 'drizzle-orm'
import { db } from '@/lib/db'
import { expense, subCategory, category } from '@/lib/db/schema'

const monthExpr = sql`TO_CHAR(${expense.createdAt}, 'YYYY-MM')`

export const getAggregatedTransactionsData = cache(async (
  userId: string,
  from: Date,
  to: Date,
) => {
  const rows = await db
    .select({
      month:    monthExpr.mapWith(String),
      totalNc:  sql<number>`cast(count(case when ${expense.status} = '1' then 1 end) as int)`.mapWith(Number),
      // totalIn/totalOut/totalIgn are always 0 in Phase 4 (no amount column)
      // Placeholder shape maintained for chart API compatibility with Phase 5
      totalIn:  sql<number>`0`.mapWith(Number),
      totalOut: sql<number>`0`.mapWith(Number),
      totalIgn: sql<number>`0`.mapWith(Number),
    })
    .from(expense)
    .leftJoin(subCategory, sql`${expense.subCategoryId} = ${subCategory.id}`)
    .leftJoin(category, sql`${subCategory.categoryId} = ${category.id}`)
    .where(sql`${expense.userId} = ${userId}
              AND ${expense.createdAt} >= ${from}
              AND ${expense.createdAt} <= ${to}`)
    .groupBy(monthExpr)
    .orderBy(monthExpr)

  return rows
})
```

**Key Drizzle rule:** The same `monthExpr` SQL expression variable MUST appear in both `.select()` and `.groupBy()`. Passing different `sql` instances with the same text causes "column must appear in GROUP BY" errors in PostgreSQL. [VERIFIED: drizzle-orm GitHub discussion #2893]

### Pattern 5: getOverview with zero-safe Decimal.js (DASH-01)

```typescript
// Source: ARCHITECTURE.md + CLAUDE.md [VERIFIED from codebase]
import 'server-only'
import { cache } from 'react'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import Decimal from 'decimal.js'
import { verifySession } from '@/lib/dal/auth'
import { expense, subCategory, category } from '@/lib/db/schema'

export const getOverview = cache(async (from: Date, to: Date) => {
  const { userId } = await verifySession()

  // Phase 4: expense table has no amount column — monetary KPIs are always 0
  // uncategorizedCount + delta are the only real data points
  const [current, previous] = await Promise.all([
    db.select({
      uncategorizedCount: sql<number>`cast(count(case when ${expense.status} = '1' then 1 end) as int)`.mapWith(Number),
    })
    .from(expense)
    .where(sql`${expense.userId} = ${userId}
              AND ${expense.createdAt} >= ${from}
              AND ${expense.createdAt} <= ${to}`),
    // ... previous month range for delta
  ])

  const currentCount = current[0]?.uncategorizedCount ?? 0
  const prevCount    = previous[0]?.uncategorizedCount ?? 0

  // savingsRate: always 0 in Phase 4 (no amounts)
  // delta for uncategorizedCount: absolute difference, not %
  return {
    totalIn:            0,
    totalOut:           0,
    balance:            0,
    savingsRate:        0,
    uncategorizedCount: currentCount,
    delta: {
      totalIn:            null,  // null signals "no data" — UI shows — instead of 0%
      totalOut:           null,
      balance:            null,
      savingsRate:        null,
      uncategorizedCount: currentCount - prevCount,
    },
  }
})
```

**savingsRate formula (for Phase 5+):**
```typescript
// totalIn and totalOut are Decimal instances from db row strings
const rate = totalIn.gt(0)
  ? totalIn.minus(totalOut).div(totalIn).times(100)
  : new Decimal(0)
// Edge case totalIn=0: rate returns 0 (no division by zero)
```

**Delta for percentages:** When previous value is 0, delta percentage is undefined. Return `null` and let the UI render `—` (em dash) instead of `∞%`. [ASSUMED: null sentinel approach vs. Infinity handling]

### Pattern 6: URL search params filter (established in Phase 3)

```typescript
// Source: components/expenses/expense-filters.tsx [VERIFIED from codebase]
'use client'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTransition } from 'react'

// Phase 4 dashboard filter extends the same pattern:
function updateFilter(key: string, value: string | null) {
  const params = new URLSearchParams(searchParams.toString())
  if (value) params.set(key, value)
  else params.delete(key)
  startTransition(() => {
    router.replace('/dashboard?' + params.toString(), { scroll: false })
  })
}
```

Dashboard searchParams:
- `preset`: `last-month` | `last-3-months` | `last-6-months` | `this-year` | `last-year`
- `type`: `out` (default) | `in` | `all` (only affects breakdown section)

The Server Component `page.tsx` reads `searchParams.preset` and `searchParams.type` to pass to the async data-fetching sub-components. The `periodToDateRange` function already exists in `lib/dal/expenses.ts` and should be moved to a shared `lib/utils/date.ts` utility to avoid importing from the expenses DAL.

### Pattern 7: Parallel Suspense streaming (Next.js 16)

```typescript
// Source: nextjs.org/docs/app/getting-started/fetching-data [VERIFIED 2026-04-10]
import { Suspense } from 'react'

export default function DashboardPage({ searchParams }) {
  const preset = searchParams?.preset ?? 'last-month'
  const type   = searchParams?.type   ?? 'out'

  return (
    <div className="flex flex-col gap-6">
      <DashboardFilters preset={preset} type={type} />

      <Suspense fallback={<OverviewSkeleton />}>
        <OverviewSection />   {/* async Server Component — getOverview() */}
      </Suspense>

      <Suspense fallback={<BreakdownSkeleton />}>
        <BreakdownSection preset={preset} type={type} />  {/* getCategories... */}
      </Suspense>

      <Suspense fallback={<TrendSkeleton />}>
        <TrendSection preset={preset} />   {/* getAggregated... */}
      </Suspense>
    </div>
  )
}
```

Three independent Suspense boundaries = three parallel DB queries, each streaming independently. The shell renders immediately. [VERIFIED: Next.js 16 official docs]

**Caveat:** `searchParams` in Next.js 16 App Router is a Promise — use `await searchParams` or `React.use(searchParams)` if the page is async. Alternatively read searchParams as a plain prop if the page is not async itself (passing down to child async components). [ASSUMED: Next.js 16 searchParams API — verify exact prop type at build time]

### Anti-Patterns to Avoid

- **Recharts in Server Component:** Recharts uses `window`, `document` and other browser APIs. Any component importing from `recharts` MUST have `'use client'`. Forgetting this causes "ReferenceError: window is not defined" at build time.
- **Native JS arithmetic on Decimal results:** Even when amounts are 0, keep Decimal.js in the code path so Phase 5 addition is surgical. Never `totalIn + totalOut` — always `toDecimal(row.total_in ?? '0')`.
- **Different sql`` instances in select and groupBy:** Must reuse the same variable: `const monthExpr = sql\`TO_CHAR(...)\``; then `.select({ month: monthExpr })` AND `.groupBy(monthExpr)`. Two separate `sql\`TO_CHAR(...)\`` calls look identical but are different objects — PostgreSQL will reject them.
- **Importing from lib/dal/expenses.ts in dashboard DAL:** `periodToDateRange` is currently in `lib/dal/expenses.ts`. Do NOT import across DAL modules. Move the utility to `lib/utils/date.ts`.
- **Fetching breakdown and trend from the same query:** Three separate DAL functions with three separate `React.cache` wrappers enable independent streaming. Merging them into one query would serialize the stream.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart color theming | Custom CSS color props | `ChartContainer` + `chartConfig` CSS vars | shadcn chart handles CSS variable mapping, dark mode, accessible colors |
| Tooltip formatting | Custom tooltip components | `ChartTooltipContent` from shadcn | Already handles number formatting, label, color indicator |
| Legend rendering | Custom legend HTML | `ChartLegendContent` from shadcn | Handles click events, color indicators, label formatting |
| Date range calculation | Custom date math | Extend `periodToDateRange` (already in `lib/dal/expenses.ts`) | Already covers all 5 presets; move to `lib/utils/date.ts` |
| Percentage calculation | SQL division | JS Decimal.js post-query | SQL division on DECIMAL is safe but loses Decimal.js safety boundary; JS side is cleaner and consistent |
| Loading skeletons | External library | Tailwind `animate-pulse` + Card | Shadcn doesn't ship chart skeletons; pulse divs with matching proportions are sufficient |

**Key insight:** Recharts has significant complexity around legend toggle and horizontal layout. The `hide` prop on `<Bar>` is the only reliable toggle mechanism — do not try to filter the data array or unmount Bar components to toggle visibility, as this causes chart relayout flicker.

---

## Common Pitfalls

### Pitfall 1: Recharts SSR / Window is not defined
**What goes wrong:** Build fails with `ReferenceError: window is not defined` when Recharts is imported in a Server Component.
**Why it happens:** Recharts 3.x uses browser-only APIs at import time. Any file that imports `recharts` must be a Client Component.
**How to avoid:** Put `'use client'` at the top of every file that imports from `recharts` or `@/components/ui/chart`. Never pass a chart component as a child from a Server Component without a Client Component wrapper.
**Warning signs:** TypeScript build succeeds but `next build` or `next dev` throws window errors.

### Pitfall 2: GroupBy expression mismatch in Drizzle
**What goes wrong:** PostgreSQL throws `ERROR: column must appear in the GROUP BY clause` at runtime.
**Why it happens:** Two separate `sql\`TO_CHAR(...)\`` template calls produce different Drizzle expression objects even if the text is identical. Drizzle passes them as separate parameters.
**How to avoid:** Always define `const expr = sql\`...\`` once and reference the same variable in both `.select({ col: expr })` and `.groupBy(expr)`.
**Warning signs:** Error appears at runtime, not TypeScript compile time. Happens specifically with custom SQL expressions in groupBy.

### Pitfall 3: Zero totalIn produces NaN or Infinity in savingsRate
**What goes wrong:** `savingsRate = (totalIn - totalOut) / totalIn * 100` crashes or returns `Infinity` when `totalIn = 0`.
**Why it happens:** Phase 4 has no amounts — totalIn is always `new Decimal('0')`. Division by zero in Decimal.js throws `Decimal Error [Division by zero]`.
**How to avoid:** Guard with `totalIn.gt(0)` before computing rate. Return `0` or `null` when totalIn = 0. The UI renders `—` for null rate delta.
**Warning signs:** `Decimal Error [Division by zero]` server-side exception on first dashboard load.

### Pitfall 4: searchParams type in Next.js 16
**What goes wrong:** `searchParams.preset` is undefined or throws because `searchParams` is a Promise in Next.js 16 App Router.
**Why it happens:** Next.js 16 made `searchParams` async in certain contexts.
**How to avoid:** In an async Server Component: `const { preset } = await searchParams`. Or validate with Zod and provide defaults. Always coerce to expected preset values before passing to DAL.
**Warning signs:** `preset` reads as undefined even when URL has `?preset=last-month`.

### Pitfall 5: Stale Suspense data after filter change
**What goes wrong:** Changing the date preset filter does not refresh the chart data — the Suspense boundary shows stale content.
**Why it happens:** Server Component children of Suspense are only re-fetched when their props change AND Next.js considers them uncached. If the page is cached, the new searchParams won't trigger a re-render.
**How to avoid:** Dashboard data should NOT use `use cache` directive — these are per-user, per-request queries. Ensure no accidental caching. `React.cache` is per-request only (not persistent). The URL param change triggers a navigation → new request → fresh Suspense resolution.
**Warning signs:** URL changes but chart doesn't update.

### Pitfall 6: chart.tsx not installed
**What goes wrong:** Import of `@/components/ui/chart` fails.
**Why it happens:** The shadcn `chart` component is not in the project yet (`components/ui/chart.tsx` does not exist as confirmed by file audit).
**How to avoid:** Wave 0 must install chart before any chart implementation: `npx shadcn@latest add chart`.
**Warning signs:** Module not found error on `@/components/ui/chart`.

---

## Runtime State Inventory

Phase 4 is greenfield UI on top of existing schema — no renames, no refactors.

**Nothing found in any category** — no runtime state migration needed.

---

## Code Examples

### getCategoriesBreakdown — full pattern

```typescript
// lib/dal/dashboard.ts — Source: ARCHITECTURE.md + drizzle-orm docs [VERIFIED]
import 'server-only'
import { cache } from 'react'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import Decimal from 'decimal.js'
import { expense, subCategory, category } from '@/lib/db/schema'
import { verifySession } from '@/lib/dal/auth'

export type BreakdownRow = {
  categoryId: number
  categoryName: string
  categorySlug: string
  subCategoryId: number | null
  subCategoryName: string | null
  count: number
  pct: number    // 0-100, computed with Decimal.js
}

export const getCategoriesBreakdown = cache(async (
  from: Date,
  to: Date,
  type: 'in' | 'out' | 'all' = 'out'
) => {
  const { userId } = await verifySession()

  // Phase 4: no amount column → count expenses as proxy for "activity"
  // percentage = count of this category / total count * 100
  const rows = await db
    .select({
      categoryId:      category.id,
      categoryName:    category.name,
      categorySlug:    category.slug,
      categoryType:    category.type,
      subCategoryId:   subCategory.id,
      subCategoryName: subCategory.name,
      count: sql<number>`cast(count(${expense.id}) as int)`.mapWith(Number),
    })
    .from(expense)
    .leftJoin(subCategory, sql`${expense.subCategoryId} = ${subCategory.id}`)
    .leftJoin(category, sql`${subCategory.categoryId} = ${category.id}`)
    .where(sql`
      ${expense.userId} = ${userId}
      AND ${expense.createdAt} >= ${from}
      AND ${expense.createdAt} <= ${to}
      AND (${category.slug} IS NULL OR ${category.slug} != 'ignore')
      ${type !== 'all' ? sql`AND ${category.type} = ${type}` : sql``}
    `)
    .groupBy(category.id, category.name, category.slug, category.type, subCategory.id, subCategory.name)
    .orderBy(sql`count(${expense.id}) desc`)

  // Compute percentages with Decimal.js
  const total = rows.reduce((sum, r) => sum + r.count, 0)
  const totalDec = new Decimal(total || 1)  // prevent division by zero

  return rows.map(r => ({
    ...r,
    pct: parseFloat(new Decimal(r.count).div(totalDec).times(100).toFixed(1)),
  }))
})
```

### KPI Card with delta badge (D-04, D-06)

```typescript
// components/dashboard/kpi-card.tsx
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Props = {
  label: string
  value: string          // pre-formatted: "€1.234,56" or "42"
  delta: number | null   // null = no data, positive = up, negative = down
  deltaIsGoodWhenPositive: boolean  // true for income, false for expenses
  colorClass?: string    // e.g. 'text-emerald-600'
}

export function KpiCard({ label, value, delta, deltaIsGoodWhenPositive, colorClass }: Props) {
  const deltaColor =
    delta === null ? 'text-muted-foreground' :
    (delta > 0) === deltaIsGoodWhenPositive ? 'text-emerald-600' : 'text-red-500'

  const deltaText =
    delta === null ? '—' :
    delta === 0    ? '0%' :
    `${delta > 0 ? '+' : ''}${delta}%`

  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn('font-mono text-2xl font-semibold', colorClass)}>{value}</p>
        <Badge variant="outline" className={cn('w-fit text-xs', deltaColor)}>
          {deltaText}
        </Badge>
      </CardContent>
    </Card>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `hsl(var(--chart-1))` CSS var syntax | `var(--chart-1)` (oklch) | Recharts v3 + shadcn update 2024 | Use `var(--color-KEY)` syntax, not `hsl(var(...))` |
| Recharts `HorizontalBar` component | `<BarChart layout="vertical">` | Recharts 2.x+ | `HorizontalBar` was removed; use `layout="vertical"` on `BarChart` |
| Custom Legend with onClick on div | `<Legend onClick={handler}>` + `<Bar hide={...}>` | Recharts 2.x+ | `hide` prop is the idiomatic toggle; filtering data array causes flicker |
| Sequential `await` in page | `Promise.all` + Suspense boundaries | Next.js 13+ | Parallel streaming is idiomatic; sequential blocks the whole page |

**Deprecated/outdated:**
- `HorizontalBar` component: removed from Recharts 2.x. Use `<BarChart layout="vertical">` instead.
- `hsl(var(--chart-N))` syntax: Recharts v3 + shadcn New York theme uses `oklch`. Use bare `var(--chart-N)` or `var(--color-KEY)`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `searchParams` in Next.js 16 async Server Components is a Promise requiring `await` | Pattern 7 (Parallel Suspense) | If synchronous, `await` is a no-op — low risk. If async and not awaited, `preset` is undefined. Verify at Wave 0. |
| A2 | Drill-down as static inline data injection (no Accordion animation) is sufficient per Claude's Discretion | Pattern 2 | If animation is desired, needs Radix Collapsible or CSS transition; adds complexity |
| A3 | `null` delta sentinel approach for zero-income months renders `—` in UI | Pattern 5 (getOverview) | Low risk — UI must handle null consistently across all 5 KPI cards |
| A4 | `TO_CHAR(created_at, 'YYYY-MM')` groups by expense.createdAt for trend (no timestamp column yet) | Pattern 4 (getAggregated) | Correct for Phase 4. Phase 5 will group by transaction.timestamp instead — DAL will need update |

---

## Open Questions

1. **periodToDateRange location**
   - What we know: the function exists in `lib/dal/expenses.ts` and covers all 5 presets.
   - What's unclear: should Phase 4 import it from `lib/dal/expenses.ts` (cross-DAL import, messy) or move it to `lib/utils/date.ts`?
   - Recommendation: Move to `lib/utils/date.ts` in Wave 0 plan. Update `lib/dal/expenses.ts` import. Both DALs import from utils.

2. **uncategorizedCount badge in sidebar**
   - What we know: CONTEXT.md mentions "Badge uncategorizedCount nella sidebar (voce 'Categorie') — dato già previsto in Phase 1, da collegare al conteggio reale."
   - What's unclear: Does the sidebar need a separate DAL call or can it share the `getOverview` React.cache result?
   - Recommendation: Add `getUncategorizedCount` as a separate cached DAL function called from the `(app)/layout.tsx` Server Component. `React.cache` ensures deduplication if `getOverview` is also called.

3. **Tabs vs Tailwind tab pattern for type filter (D-03)**
   - What we know: D-03 specifies "3 tab" — Uscite | Entrate | Tutti.
   - What's unclear: shadcn `Tabs` component is not installed yet (not in components/ui/).
   - Recommendation: Install `npx shadcn@latest add tabs` in Wave 0, or implement with Button-group pattern using Tailwind (simpler, no new dependency).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build + dev server | ✓ | (system) | — |
| PostgreSQL | All DAL queries | ✓ (assumed via existing Phase 3 setup) | — | — |
| recharts | Charts | ✗ (not in package.json yet) | — | Install via `npx shadcn@latest add chart` |
| `components/ui/chart.tsx` | All chart components | ✗ (not installed yet) | — | Install via `npx shadcn@latest add chart` |
| `components/ui/tabs.tsx` | Type filter tabs | ✗ (not installed yet) | — | Button-group alternative with Tailwind |
| Playwright | E2E tests | ✓ (playwright.config.ts exists) | configured | — |

**Missing dependencies with no fallback:**
- None that block execution

**Missing dependencies with fallback:**
- `recharts` + `chart.tsx`: must install in Wave 0 — `npx shadcn@latest add chart`
- `tabs.tsx`: install in Wave 0 OR use Button-group (planner discretion)

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright (configured in playwright.config.ts) |
| Config file | `playwright.config.ts` (root) |
| Quick run command | `npx playwright test tests/dashboard.spec.ts` |
| Full suite command | `npx playwright test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | Dashboard page renders 5 KPI cards with correct labels | E2E smoke | `npx playwright test tests/dashboard.spec.ts -g "DASH-01"` | ❌ Wave 0 |
| DASH-01 | uncategorizedCount shows real count from DB | E2E (fixme — needs seeded DB) | `npx playwright test tests/dashboard.spec.ts -g "uncategorized"` | ❌ Wave 0 |
| DASH-01 | Delta badge shows `—` when no previous-month data | E2E smoke | `npx playwright test tests/dashboard.spec.ts -g "delta"` | ❌ Wave 0 |
| DASH-02 | Breakdown filter tabs change URL param `?type=` | E2E | `npx playwright test tests/dashboard.spec.ts -g "DASH-02"` | ❌ Wave 0 |
| DASH-02 | Date preset Select changes URL param `?preset=` | E2E | same file | ❌ Wave 0 |
| DASH-02 | Horizontal bar chart section is visible on page | E2E smoke | same file | ❌ Wave 0 |
| DASH-03 | Monthly trend chart section renders | E2E smoke | `npx playwright test tests/dashboard.spec.ts -g "DASH-03"` | ❌ Wave 0 |
| DASH-03 | Legend click toggles series (bar disappears) | E2E (fixme — DOM introspection) | manual or fixme | ❌ Wave 0 |
| getOverview | savingsRate=0 when totalIn=0 | unit | `npx vitest run lib/dal/dashboard.test.ts` (if added) | ❌ |
| getCategoriesBreakdown | percentages sum to ~100 | unit | same | ❌ |

**Unit test note:** The DAL functions use DB access — they cannot be unit tested without a real DB connection. The percentage computation and Decimal.js arithmetic can be extracted to pure functions and unit tested independently. The planner should consider extracting `computeBreakdownPercentages(rows)` and `computeSavingsRate(totalIn, totalOut)` as pure utility functions in `lib/utils/dashboard.ts`.

### Sampling Rate
- **Per task commit:** `npx playwright test tests/dashboard.spec.ts --reporter=list`
- **Per wave merge:** `npx playwright test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/dashboard.spec.ts` — covers DASH-01, DASH-02, DASH-03 with fixme gates for DB-dependent assertions
- [ ] `npx shadcn@latest add chart` — adds `components/ui/chart.tsx`
- [ ] `npx shadcn@latest add tabs` — adds `components/ui/tabs.tsx` (or decide on Button-group alternative)
- [ ] Move `periodToDateRange` from `lib/dal/expenses.ts` → `lib/utils/date.ts`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `verifySession()` called at top of every DAL function (established pattern) |
| V3 Session Management | yes | Better Auth session — handled by Phase 2 infrastructure |
| V4 Access Control | yes | Every DB query scoped to `userId` from verified session — no user can see another user's data |
| V5 Input Validation | yes | Zod schema for `preset` and `type` searchParams before passing to DAL |
| V6 Cryptography | no | No cryptographic operations in this phase |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Horizontal data access (user A views user B's KPIs) | Information Disclosure | Every DAL query has `WHERE expense.user_id = ${session.userId}` — never trust URL params for userId |
| SQL injection via searchParams | Tampering | Drizzle `sql` template literals parameterize all values; Zod validates preset/type enum before use |
| Uncached aggregation DoS | Denial of Service | `React.cache` deduplicates per request; dashboard data is per-user and not cacheable across users — accept as low risk for v1 |

---

## Sources

### Primary (HIGH confidence)
- Next.js 16 official docs — `nextjs.org/docs/app/getting-started/fetching-data` (verified 2026-04-28, version 16.2.4 noted in doc metadata) — parallel fetching, Suspense streaming
- shadcn/ui chart docs — `ui.shadcn.com/docs/components/chart` — installation, CSS variables, ChartContainer, SSR requirement
- Drizzle ORM `sql` template docs — `orm.drizzle.team/docs/sql` — GROUP BY, mapWith, CASE WHEN patterns
- Drizzle ORM GitHub discussion #2893 — TO_CHAR + GROUP BY pattern (same variable in select and groupBy)
- Project codebase `lib/dal/expenses.ts` — `periodToDateRange` implementation, URL params pattern
- Project codebase `components/expenses/expense-filters.tsx` — URL search params pattern (useSearchParams + useRouter)
- Project codebase `lib/db/schema.ts` — confirmed no `amount` column on `expense` table (Phase 4 monetary zeros are by design)
- Project ARCHITECTURE.md — `lib/dal/dashboard.ts` query patterns, Suspense streaming structure

### Secondary (MEDIUM confidence)
- npm registry: recharts@3.8.1 is current latest (verified: `npm view recharts dist-tags`)
- shadcn.io horizontal bar chart pattern — `shadcn.io/patterns/chart-bar-horizontal` — layout="vertical" confirmation
- Recharts GitHub issue #590 and discussion #3940 — `hide` prop on `<Bar>` for legend toggle (multiple community confirmations)
- Phase 3 CONTEXT.md D-01 — no amount column on expense (authoritative project decision)

### Tertiary (LOW confidence)
- Next.js 16 searchParams type (Promise vs sync) — requires verification at Wave 0 build time

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — recharts version npm-verified, shadcn docs fetched directly
- Architecture: HIGH — confirmed from project's own ARCHITECTURE.md + Next.js 16 official docs
- Pitfalls: HIGH — layout="vertical" / HorizontalBar deprecation confirmed; groupBy expression reuse confirmed from Drizzle GitHub
- Drizzle aggregation patterns: HIGH — official docs + confirmed community patterns
- Legend toggle: MEDIUM — `hide` prop pattern confirmed from multiple sources; shadcn ChartLegend onClick payload shape ASSUMED

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (recharts and shadcn are moderately fast-moving; verify chart component API if > 30 days)
