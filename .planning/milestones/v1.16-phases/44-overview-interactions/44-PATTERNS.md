# Phase 44: overview-interactions - Pattern Map

**Mapped:** 2026-06-08
**Files analyzed:** 6 new/modified files
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `components/dashboard/overview/overview-chart.tsx` | component | transform (client-side reduction) | self (existing file, modify in place) | exact |
| `components/dashboard/overview/overview-nudge.tsx` | component | request-response + browser localStorage | `components/layout/sidebar-provider.tsx` | role-match |
| `components/dashboard/overview/overview-chart-filters.tsx` | component | event-driven (toggle state) | `components/dashboard/overview/overview-header.tsx` | role-match |
| `components/dashboard/overview/overview-chart-utils.ts` | utility | transform | `components/dashboard/overview/format.ts` | role-match |
| `app/(app)/dashboard/overview/page.tsx` | route/page | request-response (RSC) | self (existing file, modify in place) | exact |
| `tests/overview-interactions.test.tsx` | test | — | `tests/deviation-badge.test.tsx` | exact |

---

## Pattern Assignments

### `components/dashboard/overview/overview-chart.tsx` (modify in place)

**Analog:** self — `components/dashboard/overview/overview-chart.tsx`

**Current imports pattern** (lines 1–16):
```typescript
'use client'

import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { OverviewChartPoint } from '@/lib/dal/overview'
import { toDecimal } from '@/lib/utils/decimal'
import { formatEur, formatEurCompact } from './format'
```

**Existing `deriveBarRow` — the core reduction pattern to make filter-aware** (lines 27–49):
```typescript
// NEVER use native + on DECIMAL strings; always use toDecimal().plus().
function deriveBarRow(point: OverviewChartPoint) {
  const entrate = toDecimal(point.income.recurring)
    .plus(toDecimal(point.income.extraordinary))

  const outNatures = [
    point.out.essential,
    point.out.discretionary,
    point.out.operational,
    point.out.financial,
    point.out.debt,
    point.out.extraordinary,
  ]
  const uscite = outNatures
    .slice(1)
    .reduce((acc, v) => acc.plus(toDecimal(v)), toDecimal(outNatures[0]))

  return {
    label: point.label,
    // Convert to number only at the recharts boundary (recharts requires numbers).
    entrate: Number(entrate),
    uscite: Number(uscite),
  }
}
```

**Existing props seam for P44 filters already typed** (lines 54–62):
```typescript
type OverviewChartProps = {
  data: OverviewChartPoint[]
  onMonthSelect?: (monthIndex: number) => void
  // D-03 / P44: hidden income types — used by P44 filter chips to slice entrate bar
  hiddenIncome?: Set<string>
  // D-03 / P44: hidden out natures — used by P44 filter chips to slice uscite bar
  hiddenOut?: Set<string>
}
```

**P44 action:** Replace the fixed `deriveBarRow` call with a filter-aware version that sums only keys NOT in `hiddenIncome` / `hiddenOut`. Wire chip state from `overview-chart-filters.tsx` (or own it internally — planner discretion). Keep `Number()` conversion only at the Recharts data row boundary.

---

### `components/dashboard/overview/overview-nudge.tsx` (new file)

**Analog:** `components/layout/sidebar-provider.tsx`

**SSR-safe localStorage pattern** (lines 16–41):
```typescript
'use client'

import { createContext, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'sparter-sidebar-collapsed'  // use 'sparter-overview-nudge-{year}' pattern

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  // Default SSR state is false (expanded) — never read localStorage in useState initializer
  // This avoids hydration mismatch: server renders expanded, client restores from storage
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    // Read localStorage only after mount to prevent SSR/hydration mismatch
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      setCollapsed(stored === 'true')
    }
  }, [])

  // Wrapper setter: syncs React state and persists to localStorage
  const handleSetCollapsed = (v: boolean) => {
    setCollapsed(v)
    localStorage.setItem(STORAGE_KEY, String(v))
  }
  // ...
}
```

**Dismiss write pattern to adapt:** `localStorage.setItem(key, String(v))` after user action (not in `useState` initializer). For nudge, store `{ lastSeenCount: number }` (JSON) instead of a boolean. Key must be year-scoped, e.g. `sparter-overview-nudge-2026`.

**Visibility logic (pure helper, suitable for Vitest):**
```typescript
type StoredDismissal = { lastSeenCount: number }

export function shouldShowNudge(count: number, stored: StoredDismissal | null): boolean {
  if (count <= 0) return false
  return !stored || count > stored.lastSeenCount
}
```

**Nudge component outline:**
```tsx
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

// Props come from server page via OverviewHeader or as a sibling component.
type Props = { uncategorizedCount: number; year: number }

export function OverviewNudge({ uncategorizedCount, year }: Props) {
  const [visible, setVisible] = useState(false)  // SSR-safe: default hidden

  useEffect(() => {
    const key = `sparter-overview-nudge-${year}`
    const raw = localStorage.getItem(key)
    const stored = raw ? (JSON.parse(raw) as { lastSeenCount: number }) : null
    setVisible(shouldShowNudge(uncategorizedCount, stored))
  }, [uncategorizedCount, year])

  function dismiss() {
    const key = `sparter-overview-nudge-${year}`
    localStorage.setItem(key, JSON.stringify({ lastSeenCount: uncategorizedCount }))
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div role="status" className="... amber ...">
      {/* Italian copy — exact text is planner discretion */}
      <span>Hai movimenti da categorizzare</span>
      <Link href={`/transactions?status=uncategorized&months=...`}>Categorizza ora</Link>
      <button type="button" aria-label="Chiudi avviso" onClick={dismiss}>
        <X size={14} />
      </button>
    </div>
  )
}
```

---

### `components/dashboard/overview/overview-chart-filters.tsx` (new file)

**Analog:** `components/dashboard/overview/overview-header.tsx` (client component with URL interaction)

**Client component shell pattern** (lines 1–32):
```typescript
'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function OverviewHeader({ year, years }: { year: number; years: string[] }) {
  // Client state / event handlers
  // No server data fetch — props come from RSC parent
  // ...
}
```

**Tooltip + Popover primitives pattern** (from `components/ui/tooltip.tsx` and `components/ui/popover.tsx`):
```tsx
// Tooltip wrapper — must have TooltipProvider in ancestor
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <button type="button" aria-pressed={enabled}>Essenziale</button>
    </TooltipTrigger>
    <TooltipContent>Spese necessarie e ricorrenti.</TooltipContent>
  </Tooltip>
</TooltipProvider>

// Popover wrapper — for group-level info trigger
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Info } from 'lucide-react'

<Popover>
  <PopoverTrigger asChild>
    <button type="button" aria-label="Informazioni sul gruppo Uscite">
      <Info size={14} />
    </button>
  </PopoverTrigger>
  <PopoverContent>
    <p className="text-sm">Descrizione del gruppo di spese.</p>
  </PopoverContent>
</Popover>
```

**Nature labels source** (`lib/utils/nature-labels.ts` lines 12–23):
```typescript
export const NATURE_LABELS: Record<FlowNature | 'unclassified', string> = {
  essential: 'Essenziale',
  discretionary: 'Discrezionale',
  operational: 'Operativo',
  financial: 'Finanziario',
  income: 'Entrate ricorrenti',
  income_extraordinary: 'Straordinaria',
  debt: 'Debiti',
  extraordinary: 'Straordinario',
  // ...
}
```

Income chip labels: `income` → "Ricorrenti", `income_extraordinary` → "Straordinarie" (planner discretion to adjust from `NATURE_LABELS` for conciseness in chip context).

---

### `components/dashboard/overview/overview-chart-utils.ts` (new file)

**Analog:** `components/dashboard/overview/format.ts` (pure utility co-located in overview folder)

**Co-location and pure function pattern** (lines 1–34 of `format.ts`):
```typescript
// Production number formatters for the overview dashboard.
// DAL returns DECIMAL columns as strings — accept string | number for convenience.

export function formatEur(value: string | number): string { ... }
export function formatEurCompact(value: string | number): string { ... }
```

**Filter reduction pattern to extract here** (adapted from `overview-chart.tsx` `deriveBarRow`):
```typescript
import { toDecimal } from '@/lib/utils/decimal'
import type { OverviewChartPoint } from '@/lib/dal/overview'

export const OUT_KEYS = ['essential', 'discretionary', 'operational', 'financial', 'debt', 'extraordinary'] as const
export const INCOME_KEYS = ['recurring', 'extraordinary'] as const

export type OutKey = typeof OUT_KEYS[number]
export type IncomeKey = typeof INCOME_KEYS[number]

// Sum only the included bucket keys using Decimal arithmetic.
// Never use native + on DECIMAL strings.
export function sumSelected(
  values: Record<string, string>,
  includedKeys: readonly string[]
): import('decimal.js').Decimal {
  return includedKeys.reduce(
    (acc, key) => acc.plus(toDecimal(values[key] ?? '0.00')),
    toDecimal('0.00')
  )
}

// Convert to Recharts number boundary — call only when building final chart row.
export function deriveFilteredBarRow(
  point: OverviewChartPoint,
  includedIncome: readonly IncomeKey[],
  includedOut: readonly OutKey[]
) {
  const entrate = sumSelected(
    { recurring: point.income.recurring, extraordinary: point.income.extraordinary },
    includedIncome
  )
  const uscite = sumSelected(point.out as unknown as Record<string, string>, includedOut)
  return {
    label: point.label,
    entrate: Number(entrate),  // Recharts boundary
    uscite: Number(uscite),    // Recharts boundary
  }
}
```

---

### `app/(app)/dashboard/overview/page.tsx` (modify in place)

**Analog:** self — existing file

**Current RSC data flow pattern** (lines 22–39):
```typescript
async function OverviewDataSection({ year }: { year: number }) {
  const [overview, chart] = await Promise.all([getOverview(year), getOverviewChart(year)])

  if (isYearWithNoData(overview.totalIn, overview.totalOut)) {
    return <OverviewEmptyState variant="no-data-for-year" year={year} />
  }

  return (
    <div className="flex flex-col gap-6">
      <KpiRow data={overview} year={year} />
      <section className="space-y-3" aria-labelledby="overview-chart-heading">
        <h2 id="overview-chart-heading" className="text-lg font-semibold">
          Entrate e uscite per mese
        </h2>
        <OverviewChart data={chart} />
      </section>
    </div>
  )
}
```

**P44 action:** Pass `overview.uncategorizedCount` and `year` to `OverviewNudge` (or to `OverviewHeader` if nudge is composed there). `KpiRow data={overview}` must remain unchanged — chip state must NOT reach it. `OverviewChart` receives `chart` data only; chip state is owned client-side.

**`OverviewData` shape available from `getOverview(year)`** — `uncategorizedCount` is already in the returned object. No DAL changes needed.

---

### `tests/overview-interactions.test.tsx` (new file)

**Analog:** `tests/deviation-badge.test.tsx`

**Vitest + renderToStaticMarkup pattern** (full file):
```typescript
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { DeviationBadge } = await import('@/components/dashboard/deviation-badge')

describe('DeviationBadge (D-06, D-09)', () => {
  it('renders nothing when deviation is null', () => {
    const html = renderToStaticMarkup(<DeviationBadge deviation={null} categoryType="out" />)
    expect(html).toBe('')
  })

  it('renders positive deviation in red for out categories (overspend)', () => {
    const html = renderToStaticMarkup(<DeviationBadge deviation={45} categoryType="out" />)
    expect(html).toContain('+45%')
    expect(html).toContain('text-destructive')
  })
  // ...
})
```

**Key adaptation for Phase 44:**
- Use `renderToStaticMarkup` for static render assertions on `OverviewNudge` (NUDGE-01, NUDGE-04) and chip triggers (EDU-01, EDU-02).
- Use plain `describe`/`it`/`expect` for pure unit tests on `shouldShowNudge` and `deriveFilteredBarRow`.
- **Portal caveat (Pitfall 4):** `TooltipContent` and `PopoverContent` render via Radix portals and will NOT appear in `renderToStaticMarkup` output. Assert only trigger elements and `aria-label`s in static markup tests; leave actual popover/tooltip content to Playwright if needed.

---

## Shared Patterns

### Decimal Arithmetic at Chart Boundary
**Source:** `components/dashboard/overview/overview-chart.tsx` lines 27–49 and `lib/utils/decimal.ts`  
**Apply to:** `overview-chart-utils.ts`, `overview-chart.tsx` (modified reduction)
```typescript
import { toDecimal } from '@/lib/utils/decimal'
// Use toDecimal().plus() for every accumulation step.
// Convert to Number() only in the final Recharts data row object.
// Never use native + or - on DECIMAL strings.
```

### SSR-Safe localStorage (Read After Mount)
**Source:** `components/layout/sidebar-provider.tsx` lines 18–27  
**Apply to:** `overview-nudge.tsx`
```typescript
const [state, setState] = useState(defaultValue)  // never read localStorage here
useEffect(() => {
  const stored = localStorage.getItem(KEY)
  if (stored !== null) setState(parse(stored))
}, [])
```

### Radix Popover Usage
**Source:** `components/ui/popover.tsx`  
**Apply to:** `overview-chart-filters.tsx` (group info trigger, EDU-01)
```typescript
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
// PopoverContent renders via Portal — always use the local wrapper, not Radix directly.
// Default align="center", sideOffset=4 (from wrapper defaults).
```

### Radix Tooltip Usage
**Source:** `components/ui/tooltip.tsx`  
**Apply to:** `overview-chart-filters.tsx` (per-chip tooltip, EDU-02)
```typescript
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
// TooltipProvider must wrap the subtree. TooltipContent renders via Portal.
const TooltipProvider = TooltipPrimitive.Provider  // re-exported; always wrap chip row
```

### FlowNature Labels
**Source:** `lib/utils/nature-labels.ts` lines 12–23  
**Apply to:** `overview-chart-filters.tsx` for chip display labels  
Use `NATURE_LABELS[key]` as the starting point; planner may shorten for chip context (e.g. `income` → "Ricorrenti" instead of "Entrate ricorrenti").

### RSC → Client Prop Passing
**Source:** `app/(app)/dashboard/overview/page.tsx` lines 22–39  
**Apply to:** page.tsx modification (nudge count prop threading)  
Pass serializable primitives only (`uncategorizedCount: number`, `year: number`). Do not pass `Set` or class instances from server to client.

---

## No Analog Found

No files in this phase lack a codebase analog. All new components have strong matches within the `components/dashboard/overview/` subtree and existing test patterns.

---

## Metadata

**Analog search scope:** `components/dashboard/overview/`, `components/layout/`, `components/ui/`, `tests/`, `lib/utils/`, `lib/dal/`, `app/(app)/dashboard/overview/`  
**Files scanned:** 10  
**Pattern extraction date:** 2026-06-08
