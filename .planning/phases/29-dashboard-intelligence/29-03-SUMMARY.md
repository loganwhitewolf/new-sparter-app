---
plan: 29-03
phase: 29-dashboard-intelligence
status: complete
completed_at: 2026-05-19
---

# Plan 29-03 Summary: Split MonthlyTrendChart → EntrateUsciteChart + BilancioBarsChart

## What Was Built

### Public API

**`components/dashboard/entrate-uscite-chart.tsx`**
```tsx
export function EntrateUsciteChart({ data }: { data: MonthlyTrendPoint[] })
```
- BarChart with exactly 2 bars: `totalIn` (fill `var(--total-in)`) and `totalOut` (fill `var(--total-out)`)
- Converts DECIMAL strings via `toDecimal(point.totalIn).toNumber()` (CLAUDE.md compliant)
- No ComposedChart, no Non categorizzato, no Ignorato, no Bilancio series (D-11)
- `data-config` attribute serializes chartConfig so labels appear in SSR static markup

**`components/dashboard/bilancio-bars-chart.tsx`**
```tsx
export function BilancioBarsChart({ data }: { data: MonthlyTrendPoint[] })
```
- BarChart with single `balance` bar; one `<Cell>` per month
- `balance = toDecimal(totalIn).minus(toDecimal(totalOut))` — Decimal.js arithmetic
- Cell fill: `var(--total-in)` when balance ≥ 0, `var(--color-destructive)` when negative (D-12)
- YAxis domain: `[(min) => Math.min(min, 0), (max) => Math.max(max, 0)]` — negative bars visible

### Overview Page Update

`app/(app)/dashboard/overview/page.tsx` — `TrendContent` now renders:
```tsx
<div className="flex flex-col gap-6">
  <section aria-labelledby="overview-entrate-uscite-heading">
    <h2 id="overview-entrate-uscite-heading">Entrate e uscite per mese</h2>  // Italian UI copy ✓
    <EntrateUsciteChart data={data} />
  </section>
  <section aria-labelledby="overview-bilancio-heading">
    <h2 id="overview-bilancio-heading">Bilancio mensile</h2>  // Italian UI copy ✓
    <BilancioBarsChart data={data} />
  </section>
</div>
```

### Suspense Decision

Single `<Suspense fallback={<TrendSkeleton />}>` boundary wraps both charts — reuses the existing skeleton per VALIDATION.md. No per-chart skeleton was introduced.

### Italian Section Headings (yarn check:language traceability)

| Element | Text | Rationale |
|---------|------|-----------|
| `h2` id `overview-entrate-uscite-heading` | "Entrate e uscite per mese" | Italian UI copy — allowed per CLAUDE.md |
| `h2` id `overview-bilancio-heading` | "Bilancio mensile" | Italian UI copy — allowed per CLAUDE.md |

### MonthlyTrendChart Deleted

`components/dashboard/monthly-trend-chart.tsx` — deleted. Verified with:
```
grep -rn "MonthlyTrendChart|monthly-trend-chart" app/ components/ lib/ tests/ → 0 matches
```

## Commits

- `d910a33` feat(29-03): add EntrateUsciteChart and BilancioBarsChart — turn Plan 01 scaffold GREEN
- `d3fa594` feat(29-03): wire EntrateUsciteChart + BilancioBarsChart into overview page, delete MonthlyTrendChart

## Tests

| Suite | Pass | Fail |
|-------|------|------|
| `tests/dashboard-charts.test.tsx` (5 tests, D-10/D-11/D-12) | 5 | 0 |
| Full vitest suite | 531 | 0 |

## Self-Check: PASSED

- ✓ `EntrateUsciteChart` exports BarChart with exactly 2 series (totalIn, totalOut)
- ✓ `BilancioBarsChart` exports BarChart with per-month Cell coloring based on balance sign
- ✓ Overview page renders both charts stacked vertically with Italian headings
- ✓ `MonthlyTrendChart` deleted, 0 stale references
- ✓ No native arithmetic on monetary amounts
- ✓ `yarn build` exits 0 (TypeScript clean)
- ✓ `yarn check:language` exits 0
