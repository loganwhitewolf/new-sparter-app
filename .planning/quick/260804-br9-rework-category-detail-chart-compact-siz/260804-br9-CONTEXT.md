# Quick Task 260804-br9: Rework category detail chart — compact size, YTD default / projection opt-in - Context

**Gathered:** 2026-08-04
**Status:** Ready for planning

<domain>
## Task Boundary

The v3.0 category detail page (`app/(app)/dashboard/categories/[id]/page.tsx`) has three problems reported from real use:

1. The top chart is visually too large. The mini-chart in the categories list (`components/dashboard/category-sparkline.tsx`, 112×36) reads well; the detail chart (`components/dashboard/category-detail-difference-chart.tsx`, 640×220 with `min-h-[220px] w-full min-w-[520px]`) is oversized.
2. The chart shows wrong-looking data: elapsed months appear empty, future months are all identical. Root cause established during scouting — the chart plots the **delta vs previous year**, so with an empty previous year every elapsed month is a null/flat delta, and every future month is `pace − 0`, hence constant.
3. Showing a projected average for future months is not useful by default. Projection makes sense for some categories (daily groceries) and not others (holidays, taxes) — it must be the user's explicit choice.

Scope of this task: the category detail page's chart, its view controls, and the totals/table that must stay coherent with the chosen view. Out of scope: the categories list page and its sparkline, the Overview lens, and any DB schema change.

</domain>

<decisions>
## Implementation Decisions

### Chart semantics (LOCKED)
- The top chart becomes a **monthly-amounts** chart — bars are the category's spend for each month, the same semantics as the list sparkline the user likes.
- The delta / previous-year comparison stays **only in the table below**. It is removed from the chart.
- This is what makes "correct data up to the current month" true even when the previous year has no history.

### Two views, replacing the current window filter (LOCKED)
- Exactly two view options, replacing the `12 / 9 / 6 / 3` pill group and the start-month select:
  - **YTD (default)** — January through the current month. No projection anywhere: no `pace`-filled future months, and the current month shows the **raw actual spent so far** (no `computeCurrentMonthHybrid`). The total is computed from actual data only.
  - **Year-end projection (opt-in)** — the current behaviour: all 12 months, future months filled with `pace`, current month hybridized via `computeCurrentMonthHybrid`, total = year-end figure.
- The projection view is a deliberate opt-in the user will enable only for some categories.

### View scope (LOCKED)
- The chosen view governs **the whole page**, not just the chart: monthly table rows, subcategory breakdown, and every total/average shown must follow it.
- YTD → table stops at the current month, totals from actual data. Projection → 12 months, year-end totals.

### Old window controls (LOCKED)
- `?months=12|9|6|3` and `?from=YYYY-MM` are **removed entirely** — controls, URL parsing, and validation helper. Existing deep links carrying them degrade silently to the default view.
- `?year=` (`CategoryYearSelect`) stays. `?lens=` stays as the back-link passthrough.

### Claude's Discretion
- Name and shape of the new view param (a single two-value param such as `?view=ytd|projection`, with `ytd` as the absent/default state, is the natural fit for the existing URL-as-state pattern in this page).
- Whether the toggle is a two-pill button group (mirroring the removed window pills) or a segmented control — keep it visually consistent with the rest of the dashboard.
- Concrete compact geometry for the chart. It must be clearly smaller than 640×220; both the module-level `width`/`height` constants and the Tailwind `min-h-[220px] w-full min-w-[520px]` on the `<svg>` have to change together, since `baselineY` and `maxAmplitude` derive from `height`.
- Behaviour when a **past** year is selected: the year is complete, so the two views coincide. Hiding or disabling the toggle outside the current year is acceptable and preferred over showing a meaningless choice.
- Reuse vs fork: the amounts-chart rendering may reuse the sparkline's bar/state logic (`classifyMonthStates`, `resolveBarFillStyle`) rather than reimplementing it.
- Whether `category-detail-difference-chart.tsx` is rewritten in place or replaced by a new component (with its test file updated accordingly).

</decisions>

<specifics>
## Specific Ideas

- Pace/projection engine to reuse, do not rewrite: `lib/services/pace-and-projection.ts` — `classifyMonthStates` (4 states: covered/current/estimated/uncovered), `computeCurrentMonthHybrid`, `computePaceAndProjection`, `MIN_COVERED_MONTHS_FOR_PACE`.
- Series producer to change: `getCategoryDetailYearWindow` in `lib/dal/category-detail-year-window.ts` (the past-vs-future switch lives at roughly L483-505; window slicing and total/average at L509-529).
- Window parsing to delete: `parseCategoryDetailWindow` and `CATEGORY_DETAIL_WINDOW_LENGTHS` in `lib/validations/category-year-window.ts`.
- Controls to replace: `components/dashboard/category-detail-window-controls.tsx`.
- `'uncovered'` months must keep returning `amount = null` — never a fabricated `'0.00'` (existing decision D-10).
- `rawCurrentTotal` exists specifically to keep the subcategory telescoping identity honest; keep that identity intact under both views.
- Tests that must be updated or extended, not deleted: `tests/category-detail-year-window-dal.test.ts`, `tests/category-detail-difference-chart.test.tsx`, `tests/category-detail-window.test.ts`, `tests/category-detail-table.test.tsx`, `tests/category-detail-components.test.tsx`, `tests/category-subcategory-breakdown.test.tsx`.
- A follow-up idea was raised and is explicitly **deferred**, not part of this task: a third rolling view of the last 12 months ending at the current month (crossing into the previous year, month-vs-same-month-last-year). It will only be considered after this rework is validated in use.

</specifics>

<canonical_refs>
## Canonical References

- `docs/adr/0020-categories-year-view-retires-deviation.md` — the ADR behind the current detail semantics.
- `.planning/milestones/v3.0-ROADMAP.md`, `v3.0-REQUIREMENTS.md` — the `D-xx` / `CDET-xx` / `CLIST-xx` codes referenced in the code resolve here. Requirement codes touched by this rework should be re-read before changing behaviour they pin.
- `CONTEXT.md` (repo root) — domain vocabulary; use Reference Period / Covered Months / ritmo / proiezione consistently.

</canonical_refs>
