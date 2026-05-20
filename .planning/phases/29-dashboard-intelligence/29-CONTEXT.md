# Phase 29: Dashboard Intelligence - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning
**Source:** grill-with-docs session

<domain>
## Phase Boundary

This phase makes the dashboard actionable at a glance. When the user opens the dashboard they should immediately see which categories deviated from their normal spending pattern last month, and a cleaner trend chart. No user-defined goals or gamification — automatic comparison only.

</domain>

<decisions>
## Implementation Decisions

### Bug fix (blocking)

- D-01: Fix `last-month` preset in `lib/utils/date.ts` — it currently returns the current month (from `now.getMonth()`) instead of the previous calendar month. Must return `{ from: new Date(year, month - 1, 1), to: endOfMonth(year, month - 1) }`.

### Deviation view — data model

- D-02: **Reference Period** = last completed calendar month (the fixed `last-month` preset after D-01 is applied).
- D-03: **Baseline** = average monthly spend per category/subcategory computed over the 3 calendar months preceding the Reference Period. If fewer than 3 months of data exist, use however many are available.
- D-04: **Deviation** = `(referenceAmount - baseline) / baseline * 100`, expressed as a signed percentage. Positive = spent more than average, negative = spent less.
- D-05: **Noise threshold** = subcategories with absolute spend < €15 in the Reference Period are excluded from the deviation view to avoid misleading percentages from micro-spends.

### Deviation view — UI (existing pages only, no new tabs)

- D-06: `/dashboard/categories` page gains a Deviation column showing the signed percentage with color coding: red = overspent vs baseline (for `out` categories), green = underspent. Polarity is reversed for `in` categories (green = more income than baseline).
- D-07: Sort order on `/dashboard/categories` is switchable. Default sort = **absolute deviation descending** (biggest surprises first). Secondary sort = amount (existing behavior).
- D-08: `/dashboard/categories/[id]` detail page gains the same deviation column on each subcategory row, using the same Reference Period / Baseline / Noise threshold logic.
- D-09: Deviation display = **percentage only** (e.g. `+45%`, `-12%`). No euro delta in the list view.

### Monthly trend chart refactor

- D-10: The existing `MonthlyTrendChart` `ComposedChart` (bars + line) is **split into two separate charts** stacked vertically.
- D-11: **Chart A** = bar chart with Entrate + Uscite series only. "Non categorizzato" and "Ignorato" series are removed from the chart — "Da categorizzare" already appears in the KPI card.
- D-12: **Chart B** = per-month colored bar chart for Bilancio. Green bar = positive balance month, red bar = negative balance month. Replaces the balance line overlay that broke when balance went below zero.

### Out of scope for this phase

- D-13: User-defined spending goals (budget targets per category) — planned as a future milestone.
- D-14: Gamification / badges for hitting goals — depends on D-13, future milestone.
- D-15: Real-time / daily sync of transaction data — not part of this app's import model.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Dashboard pages and components
- `app/(app)/dashboard/overview/page.tsx` — overview page with KPI cards and trend chart
- `app/(app)/dashboard/categories/page.tsx` — category ranking page to extend with deviation
- `app/(app)/dashboard/categories/[id]/page.tsx` — category detail page to extend with deviation
- `components/dashboard/monthly-trend-chart.tsx` — chart to split into two (D-10, D-11, D-12)
- `components/dashboard/category-ranking-list.tsx` — ranking list to extend with deviation column
- `components/dashboard/category-subcategory-breakdown.tsx` — subcategory list for deviation

### Data layer
- `lib/dal/dashboard.ts` — all dashboard DAL functions; deviation query must be added here
- `lib/validations/dashboard.ts` — preset parsing; `last-month` default used throughout
- `lib/utils/date.ts` — `dashboardPresetToDateRange` contains the `last-month` bug (D-01)
- `lib/utils/dashboard.ts` — utility functions (computeBreakdownPercentages, computeDeltaPercent)

### Domain glossary
- `CONTEXT.md` (repo root) — canonical term definitions for Deviation, Baseline, Reference Period, Noise Threshold, Preset

### Project rules (MUST follow)
- `CLAUDE.md` — monetary arithmetic must use Decimal.js helpers; Drizzle returns DECIMAL as string

</canonical_refs>

<specifics>
## Specific Implementation Notes

- Deviation percentage calculation: `(referenceAmount - baseline) / baseline * 100`. If `baseline === 0` and `referenceAmount > 0`, show as `new` (no percentage). If both are 0, exclude from view.
- The existing `delta` concept on KPI cards uses period-over-period comparison. Deviation is a different concept (vs rolling average) — do not reuse the same field name in the DAL.
- For Chart B (Bilancio bars): use a single `Bar` dataKey with a custom `Cell` per bar (green/red based on sign), or a fill function. The existing `BalanceDot` pattern can be adapted.
- The deviation sort toggle should preserve the existing `type` query param (out/in filter).

</specifics>

<deferred>
## Deferred Ideas

- User-defined goals per category (spending targets) — future milestone
- Gamification / badges / streaks — future milestone, depends on goals
- Real-time bank sync — outside app model

</deferred>

---

*Phase: 29-dashboard-intelligence*
*Context gathered: 2026-05-19 via grill-with-docs session*
