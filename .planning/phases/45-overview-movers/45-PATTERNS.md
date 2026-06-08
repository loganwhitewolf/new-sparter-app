# Phase 45: overview-movers - Pattern Map

**Mapped:** 2026-06-08
**Files analyzed:** 4 (2 new, 2 modified)
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `components/dashboard/overview/overview-movers-panel.tsx` (new) | component | request-response (Server Action + useTransition) | `components/expenses/expense-transactions-dialog.tsx` | role-match |
| `lib/actions/overview.ts` (new) | action | request-response | `lib/actions/expenses.ts` (`fetchExpenseTransactions`) | exact |
| `app/(app)/dashboard/overview/page.tsx` (modify) | server component/page | CRUD + data derivation | self — `OverviewDataSection` in the same file | self-extension |
| `components/dashboard/overview/overview-chart.tsx` (modify) | component | event-driven | self — D-03 scaffold already present | self-extension |

---

## Pattern Assignments

### `lib/actions/overview.ts` (new action, request-response)

**Analog:** `lib/actions/expenses.ts` — `fetchExpenseTransactions` (lines 320–333)

**`"use server"` directive + imports pattern** (lines 1–2, 320–322 of analog):
```typescript
'use server'
import { verifySession } from '@/lib/dal/auth'
import { getMonthOverMonthCategoryChanges, type MonthOverMonthChange } from '@/lib/dal/overview'
```

**Core action pattern** — thin wrapper returning `{ data, error }` (lines 320–333 of analog):
```typescript
export async function fetchMovers(
  year: number,
  monthIndex: number,
): Promise<{ movers: MonthOverMonthChange[]; error: string | null }> {
  try {
    const { userId } = await verifySession()
    // verifySession() scopes the call to the authenticated user — DAL handles userId internally
    void userId
    const movers = await getMonthOverMonthCategoryChanges(year, monthIndex)
    return { movers, error: null }
  } catch {
    return {
      movers: [],
      error: 'Non è stato possibile caricare i dati. Riprova.',
    }
  }
}
```

**Error handling pattern** (analog lines 327–332):
```typescript
} catch {
  return {
    transactions: [],
    error: 'Non è stato possibile caricare le transazioni. Riprova.',
  }
}
```
No re-throw; returns structured `{ data, error }` tuple. Italian error copy.

---

### `components/dashboard/overview/overview-movers-panel.tsx` (new client component, request-response)

**Analog:** `components/expenses/expense-transactions-dialog.tsx` (lines 1–45)

**`'use client'` + imports pattern** (analog lines 1–22):
```typescript
'use client'
import { useState, useTransition } from 'react'
import { fetchMovers } from '@/lib/actions/overview'
import type { MonthOverMonthChange } from '@/lib/dal/overview'
import { formatEur } from './format'
```

**useTransition + Server Action call pattern** (analog lines 32–45):
```typescript
const [movers, setMovers] = useState<MonthOverMonthChange[]>(initialMovers)
const [isPending, startTransition] = useTransition()

// Called from parent when selectedMonth changes
function loadMovers(newMonthIndex: number) {
  startTransition(async () => {
    const result = await fetchMovers(year, newMonthIndex)
    if (!result.error) {
      setMovers(result.movers)
    }
  })
}
```

**Loading state pattern** (analog lines 79–82):
```typescript
{isPending ? (
  <div className="flex items-center justify-center py-8">
    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
  </div>
) : (
  /* panel content */
)}
```

**Panel/section structure pattern** — inline card below chart, modelled on `overview-nudge.tsx` structural conventions:
```tsx
// Render nothing when no movers and not loading — empty state instead
// Two subsections: increases (red, --total-out) and savings (green, --total-in)
// Hidden when subsection array is empty (MOVE-02 / D-02)
<section aria-labelledby="movers-heading" className="space-y-3">
  <h2 id="movers-heading" className="text-sm font-medium text-muted-foreground">
    {monthName} {year} vs {prevMonthName} {prevYear}
  </h2>
  {/* increases */}
  {increases.length > 0 && (
    <div>
      <p className="text-xs font-semibold text-[var(--total-out)] mb-1">Dove hai speso di più</p>
      <ul>{/* items */}</ul>
    </div>
  )}
  {/* savings */}
  {savings.length > 0 && (
    <div>
      <p className="text-xs font-semibold text-[var(--total-in)] mb-1">Dove hai risparmiato</p>
      <ul>{/* items */}</ul>
    </div>
  )}
  {/* D-07 empty state */}
  {movers.length === 0 && !isPending && (
    <p className="text-sm text-muted-foreground">
      Nessuna variazione significativa — mese di partenza o nessuna spesa sopra €15.
    </p>
  )}
</section>
```

**Humanized format (D-08)** — uses `formatEur` from `components/dashboard/overview/format.ts`:
```typescript
// delta is a signed Decimal string: positive = spent more, negative = saved
function formatMoverLine(m: MonthOverMonthChange): string {
  if (m.isNew) return `${m.name} · spesa nuova`
  const abs = formatEur(Math.abs(Number(m.delta)))
  return Number(m.delta) > 0
    ? `${m.name} · ${abs} in più`
    : `${m.name} · ${abs} in meno`
}
```
Note: `Math.abs(Number(m.delta))` is only for display (passed to `formatEur`), not monetary arithmetic — no Decimal.js required here since no financial calculation occurs.

---

### `app/(app)/dashboard/overview/page.tsx` — `OverviewDataSection` (modify)

**Self-extension of existing pattern** (current file lines 23–45).

**`defaultMonthIndex` derivation** — uses `toDecimal` from `@/lib/utils/decimal` (consistent with `isYearWithNoData` helper at lines 18–20):
```typescript
import { toDecimal } from '@/lib/utils/decimal'

// After: const [overview, chart] = await Promise.all([...])
// Find highest index where total activity > 0 (D-04: never use data.length - 1)
function deriveDefaultMonthIndex(chart: OverviewChartPoint[]): number {
  for (let i = chart.length - 1; i >= 0; i--) {
    const p = chart[i]
    const total = toDecimal(p.income.recurring)
      .plus(toDecimal(p.income.extraordinary))
      .plus(p.out.reduce((acc, v) => acc.plus(toDecimal(v)), toDecimal(0)))
    if (!total.isZero()) return i
  }
  return 0
}
```

**Initial movers pre-fetch** — added to `Promise.all` or sequential after chart, then passed as props:
```typescript
const [overview, chart] = await Promise.all([getOverview(year), getOverviewChart(year)])
const defaultMonthIndex = deriveDefaultMonthIndex(chart)
const initialMovers = await getMonthOverMonthCategoryChanges(year, defaultMonthIndex)

// ...then in JSX:
<OverviewMoversPanel
  year={year}
  defaultMonthIndex={defaultMonthIndex}
  initialMovers={initialMovers}
/>
```

**DAL import addition** (lines 2–3 of current page.tsx):
```typescript
import { getOverview, getOverviewChart, getYearsWithData, getMonthOverMonthCategoryChanges } from '@/lib/dal/overview'
```

---

### `components/dashboard/overview/overview-chart.tsx` — activate D-03 scaffold (modify)

**Self-extension.** The scaffold is already in place at lines 33, 39, 119–120, 139–140, 151–162.

**Props shape change** — `onMonthSelect` becomes required / wired; `defaultMonthIndex` added for controlled sync:
```typescript
type OverviewChartProps = {
  data: OverviewChartPoint[]
  defaultMonthIndex: number           // new: replaces data.length - 1 default
  onMonthSelect: (monthIndex: number) => void  // new: was optional, now active
}

// useState initializer change (line 39):
const [selectedMonth, setSelectedMonth] = useState(() => defaultMonthIndex)
```

**Cell fillOpacity activation** (current lines 154–162, scaffold comment says "P45 will switch"):
```tsx
{rows.map((_, i) => (
  <Cell
    key={i}
    fill="var(--color-uscite)"
    fillOpacity={i === selectedMonth ? 1 : 0.4}  // was: 1
    cursor="pointer"                               // was: "default"
  />
))}
```

**Entrate Bar Cell** — same pattern must be added (currently no Cell array for entrate bar, only for uscite). Add parallel Cell array inside the entrate Bar:
```tsx
{rows.map((_, i) => (
  <Cell
    key={i}
    fill="var(--color-entrate)"
    fillOpacity={i === selectedMonth ? 1 : 0.4}
    cursor="pointer"
  />
))}
```

**onClick wiring on both Bars** (current lines 120, 140 — comments say "P45 will switch"):
```tsx
onClick={(_, index) => {
  setSelectedMonth(index)
  onMonthSelect(index)
}}
// cursor prop on Bar itself can stay "default" — Cell cursor overrides it per-bar
```

---

## Shared Patterns

### `verifySession()` in Server Actions
**Source:** `lib/actions/expenses.ts` — every exported action, e.g. lines 93, 115, 199
**Apply to:** `lib/actions/overview.ts`
```typescript
const { userId } = await verifySession()
```
Call at the top of every `'use server'` function before any DAL access.

### `{ data, error }` return shape for data-fetching actions
**Source:** `lib/actions/expenses.ts` lines 320–333 (`fetchExpenseTransactions`)
**Apply to:** `fetchMovers` in `lib/actions/overview.ts`
```typescript
return { movers: [], error: 'Non è stato possibile caricare i dati. Riprova.' }
// vs success path:
return { movers, error: null }
```

### `useTransition` for Server Action calls in client components
**Source:** `components/expenses/expense-transactions-dialog.tsx` lines 32–45
**Apply to:** `OverviewMoversPanel`
```typescript
const [isPending, startTransition] = useTransition()
startTransition(async () => {
  const result = await serverAction(...)
  if (!result.error) setState(result.data)
})
```

### Decimal.js for monetary derivations
**Source:** `app/(app)/dashboard/overview/page.tsx` lines 10, 18–20; `lib/utils/decimal`
**Apply to:** `defaultMonthIndex` derivation in `OverviewDataSection`
```typescript
import { toDecimal } from '@/lib/utils/decimal'
// DAL DECIMAL strings → Decimal instances for comparison/addition; never Number() for math
```

### `formatEur` for money display
**Source:** `components/dashboard/overview/format.ts` lines 15–18
**Apply to:** mover amount display in `OverviewMoversPanel`
```typescript
import { formatEur } from './format'
// formatEur accepts string | number — DAL delta is a string, pass abs value for display
```

### Italian copy for user-facing strings, English for identifiers
**Source:** `CLAUDE.md` language convention; all existing overview components
**Apply to:** all new strings in `OverviewMoversPanel` (headings, empty state, item labels)

---

## No Analog Found

No files in this phase lack a codebase analog. All four files map to existing patterns.

---

## Metadata

**Analog search scope:** `lib/actions/`, `components/dashboard/overview/`, `components/expenses/`, `app/(app)/dashboard/overview/`
**Files scanned:** 12
**Pattern extraction date:** 2026-06-08
