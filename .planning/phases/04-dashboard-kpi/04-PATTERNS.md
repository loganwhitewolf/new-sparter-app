# Phase 4: Dashboard KPI - Pattern Map

**Mapped:** 2026-04-28
**Scope:** Dashboard KPI planning

## Summary

Phase 4 should reuse the Phase 3 split between Server Component pages, server-only DAL modules, URL-driven Client Component filters, and focused Playwright smoke coverage. The main new pattern is Recharts through shadcn `chart`, which must stay behind Client Component boundaries.

## Files To Create Or Modify

| Target | Role | Closest Existing Analog | Pattern To Reuse |
|--------|------|-------------------------|------------------|
| `tests/dashboard.spec.ts` | Playwright phase tests | `tests/expenses.spec.ts` | `test.fixme(true, "...")` for seeded DB-dependent assertions, staging key header for protected pages |
| `components/ui/chart.tsx` | shadcn chart primitive | `components/ui/card.tsx` | Generated shadcn component in `components/ui/` |
| `components/ui/tabs.tsx` | shadcn tabs primitive | `components/ui/select.tsx` | Generated shadcn component in `components/ui/` |
| `lib/utils/date.ts` | Shared preset-to-date range utility | `lib/dal/expenses.ts` | Move `periodToDateRange` out of DAL; keep deterministic date math |
| `lib/utils/dashboard.ts` | Pure Decimal helpers | `lib/utils/decimal.ts` | `Decimal.js` only; no native arithmetic for amounts |
| `lib/validations/dashboard.ts` | URL param validation | `lib/validations/expense.ts` | Zod v4 syntax with enum defaults and exported types |
| `lib/dal/dashboard.ts` | KPI aggregation DAL | `lib/dal/expenses.ts`, `lib/dal/categories.ts` | `import 'server-only'`, `cache(async ...)`, `verifySession()` first, Drizzle joins scoped to userId |
| `components/dashboard/dashboard-filters.tsx` | URL filter controls | `components/expenses/expense-filters.tsx` | `useSearchParams`, `useRouter`, `useTransition`, `router.replace('/dashboard?' + params.toString(), { scroll: false })` |
| `components/dashboard/kpi-card.tsx` | KPI card primitive | `components/expenses/expense-table.tsx` badge styling | shadcn `Card`, `Badge`, mono numeric values, semantic color classes |
| `components/dashboard/kpi-cards.tsx` | KPI card grid | `app/(app)/spese/page.tsx` page composition | Server Component receiving typed props; no browser hooks |
| `components/dashboard/category-breakdown-chart.tsx` | Drill-down bar chart | Phase 4 UI-SPEC + Recharts client boundary | `'use client'`, local `useState`, `BarChart layout="vertical"` |
| `components/dashboard/monthly-trend-chart.tsx` | Grouped trend chart | Phase 4 UI-SPEC + Recharts client boundary | `'use client'`, hidden-series state, Recharts `Legend` click |
| `components/dashboard/*-skeleton.tsx` | Suspense fallbacks | `app/(app)/spese/page.tsx` fallback | Static skeletons using `bg-muted animate-pulse` |
| `app/(app)/dashboard/page.tsx` | Final dashboard route | `app/(app)/spese/page.tsx` | Next.js 16 async `searchParams`, Server Component data fetch, Suspense around client-filter subtree |

## Concrete Code Patterns

### Next.js 16 Page Props

Use the local Next.js 16 docs under `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`.

Pattern:

```typescript
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; type?: string }>
}) {
  const params = await searchParams
}
```

`searchParams` is a promise. Plans must not use the older synchronous object pattern.

### URL-Driven Filters

Source: `components/expenses/expense-filters.tsx`.

Pattern:

```typescript
const searchParams = useSearchParams()
const router = useRouter()
const [isPending, startTransition] = useTransition()

function updateFilter(key: string, value: string | null) {
  const params = new URLSearchParams(searchParams.toString())
  if (value) params.set(key, value)
  else params.delete(key)
  startTransition(() => {
    router.replace('/dashboard?' + params.toString(), { scroll: false })
  })
}
```

Wrap this component in `Suspense` because `useSearchParams` requires a Suspense boundary for production builds.

### DAL Security

Source: `lib/dal/expenses.ts`.

Required pattern:

```typescript
import 'server-only'
import { cache } from 'react'
import { verifySession } from '@/lib/dal/auth'

export const getOverview = cache(async (...) => {
  const { userId } = await verifySession()
  // every query includes eq(expense.userId, userId)
})
```

All dashboard reads must scope by `expense.userId`. No client component may import `lib/dal/dashboard.ts` at runtime.

### Decimal Helpers

Source: `lib/utils/decimal.ts`.

All amount math must use `Decimal.js`:

```typescript
import Decimal from 'decimal.js'

const balance = toDecimal(totalIn).minus(toDecimal(totalOut))
```

Do not use JS native `+`, `-`, `*`, or `/` on monetary values.

### Phase 4 Amount Gap

`lib/db/schema.ts` currently has no `transaction` table and `expense` has no `amount` column. Phase 4 must therefore:

- Return `totalIn`, `totalOut`, and `balance` as `"0.00"` strings.
- Return `savingsRate` as `0`.
- Compute real `uncategorizedCount` from `expense.status = '1'`.
- Use expense counts for category breakdown percentages until Phase 5 adds transaction amounts.
- Zero-fill monthly `totalIn` and `totalOut`, while returning count-based `totalNc` and `totalIgn`.

This is accepted by `04-RESEARCH.md` and `04-CONTEXT.md`.

## Verification Patterns

- Build check: `npm run build`
- Dashboard E2E check: `npx playwright test tests/dashboard.spec.ts --reporter=list`
- Full E2E check before verification: `npx playwright test`
- Static grep checks should verify:
  - `app/(app)/dashboard/page.tsx` awaits `searchParams`
  - `components/dashboard/*chart*.tsx` begins with `'use client'`
  - `lib/dal/dashboard.ts` contains `verifySession`
  - `lib/dal/dashboard.ts` contains `eq(expense.userId, userId)`
  - `tests/dashboard.spec.ts` contains `DASH-01`, `DASH-02`, and `DASH-03`

