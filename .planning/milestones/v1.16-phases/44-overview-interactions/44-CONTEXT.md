# Phase 44: overview-interactions - Context

**Gathered:** 2026-06-08
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase activates the interaction layer on the redesigned `/dashboard/overview` tab delivered in Phase 43.

It delivers requirements **NUDGE-01, NUDGE-02, NUDGE-03, NUDGE-04, FILT-01, FILT-02, FILT-03, EDU-01, EDU-02**:

1. **Uncategorized nudge** — an inline amber nudge on the overview title row when the selected year has uncategorized OUT expenses, with a `Categorizza ora` link and dismiss button.
2. **Chart filter chips** — income chips for recurring vs extraordinary income, and expense chips for the six OUT FlowNature buckets. Filters affect only the chart bars, never KPI totals.
3. **FlowNature education** — contextual info popovers next to the Entrate/Uscite filter groups plus one-line tooltips on each chip.

No new user decisions are needed for this phase. The user explicitly confirmed: **"nessuna nuova decisione utente; seguire il modello e le decisioni già locked"**. Downstream agents must follow the existing model, requirements, and Phase 42/43 decisions rather than re-opening these choices.

**Explicitly OUT of scope:**
- Per-month movers drill-down, bar click highlighting, and selected-month movers panel -> Phase 45.
- FlowNature friendly display-label rename -> future quick task (`EDU-FUT-01`), not this milestone.
- DB persistence for nudge dismissal -> explicitly rejected; localStorage only.
- Any schema or DAL redesign for income type -> Phase 42 already locked the `nature`-based model.

</domain>

<decisions>
## Implementation Decisions

### Locked Model — D-01..D-05
- **D-01 — No additional user-facing decisions.** Planning should proceed from the existing model. Any residual details, such as component names, exact query-param names, chip component extraction, and minor layout mechanics, are planner discretion within this context.
- **D-02 — Nudge source and persistence are locked.** Use the selected-year `overview.uncategorizedCount` / Phase 42 count semantics for OUT-only uncategorized expenses. Render no nudge when the count is zero. Dismissal is stored in localStorage only with `lastSeenCount` semantics; it must reappear when the selected year's uncategorized count increases. Do not write dismissal state to the database.
- **D-03 — Nudge placement and tone are locked.** The nudge is inline on the title row, amber, invitational, and must not show the count in copy. It offers `Categorizza ora` and an X/icon dismiss action.
- **D-04 — Chart filters are client-side slicing of `getOverviewChart(year)`.** No extra round-trip is needed. Income chips map to `income.recurring` (`nature = 'income'`) and `income.extraordinary` (`nature = 'income_extraordinary'`). Expense chips map to `essential`, `discretionary`, `operational`, `financial`, `debt`, and `extraordinary`. KPI cards ignore chip state unconditionally.
- **D-05 — FlowNature education stays contextual.** Use a small info trigger near each filter group plus per-chip tooltips. Do not add a glossary screen or long educational block. Do not rename taxonomy labels in this phase.

### Chart Filter Behavior — D-06..D-08
- **D-06 — Default state shows everything.** On initial load all income types and all expense natures are included, preserving Phase 43's unfiltered grouped bars.
- **D-07 — Filters are inclusive toggles.** Toggling a chip includes/excludes that bucket from the corresponding bar total. The chart remains two bars per month: one green Entrate bar and one red Uscite bar. Do not reintroduce nature stacking or a balance series.
- **D-08 — Empty filtered bars are acceptable, empty chart state is not.** If the user disables all chips in a group, that side's bar total can be zero while the chart still renders. Planner may either prevent all-off per group or provide a lightweight reset affordance, but must not create a separate empty-state panel that competes with the chart.

### URL / State — D-09
- **D-09 — Filter state persistence is planner discretion, but year remains canonical in `?year=`.** The locked requirement does not require shareable filter state. Prefer a simple client-state implementation unless planner sees a strong reason to encode chip state in the URL. Do not use localStorage for chart filters unless a future requirement asks for sticky filters; localStorage is reserved here for nudge dismissal.

### Navigation Target — D-10
- **D-10 — `Categorizza ora` lands on uncategorized transactions.** Reuse the existing `/transactions` filtering contract (`status=uncategorized`). Preserve selected-year scope where practical via the canonical transactions month filter (for example all `YYYY-MM` months for the selected year), but exact URL construction is planner discretion.

### the agent's Discretion
- Exact component split, prop names, and whether filter chips live inside `OverviewChart` or a sibling `OverviewChartFilters` component.
- Exact one-line Italian definitions for chip tooltips and popovers, provided they are concise, contextual, and derived from current `NATURE_LABELS` plus Phase 42's income split.
- Exact localStorage key name, as long as it is overview/year scoped enough to support `lastSeenCount` without cross-year false dismissals.
- Whether to add small focused tests at component level, DAL/utility level, or both. Test coverage should prove: chip slicing does not affect KPIs, nudge hide/show/dismiss/reappear logic, and education triggers render accessible labels/tooltips.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/REQUIREMENTS.md` — v1.16 requirements. Phase 44 owns NUDGE-01..04, FILT-01..03, and EDU-01..02. Also records that KPI totals ignore chart filters and DB persistence of nudge dismissal is out of scope.
- `.planning/ROADMAP.md` §"Phase 44: overview-interactions" — phase goal, success criteria, dependency on Phase 43, and UI hint.
- `.planning/PROJECT.md` §"Current Milestone: v1.16 Dashboard Overview Redesign" — milestone-level locked design summary and out-of-scope items.

### Prior phase decisions
- `.planning/phases/42-overview-data-layer/42-CONTEXT.md` — locked income split model: extend `flowNature`, `income` = recurring, `income_extraordinary` = extraordinary, `getOverviewChart(year)` returns the rich payload used by this phase.
- `.planning/phases/43-overview-shell/43-CONTEXT.md` — locked shell/chart decisions: Phase 43 stripped visible P44/P45 affordances but left the structural chart seam; Phase 44 activates filter chips and nudge without rewriting the shell.
- `.planning/phases/43-overview-shell/43-02-SUMMARY.md` — current `OverviewChart` shape and Phase 43 chart implementation notes.

### Domain and ADRs
- `CONTEXT.md` §"Dashboard e analisi" — Reference Period and `MonthOverMonthChange` glossary. Use this for domain terminology; avoid deprecated "variazione" except where explicitly quoted by the glossary.
- `docs/adr/0003-flownature-at-subcategory-level.md` — FlowNature lives on Subcategory, not Category; chart/filter logic must work from effective subcategory nature.
- `docs/adr/0005-first-import-onboarding-gate.md` §"FlowNature: in-flow education only" — FlowNature education should be contextual and in-flow, not a dedicated glossary screen.

### Current implementation
- `app/(app)/dashboard/overview/page.tsx` — server page integration. Fetches `getOverview(year)` and `getOverviewChart(year)`, renders `OverviewHeader`, `KpiRow`, and `OverviewChart`.
- `components/dashboard/overview/overview-header.tsx` — title row and `?year=` selector. The nudge attaches here or immediately adjacent to this row.
- `components/dashboard/overview/overview-chart.tsx` — current grouped-bar chart. Phase 44 should replace the current all-bucket reduction with filter-aware reduction while keeping two bars per month.
- `lib/dal/overview.ts` — `OverviewChartPoint`, `getOverview(year)`, `getOverviewChart(year)`, and year-scoped data contract.
- `lib/utils/nature-labels.ts` — current FlowNature labels/colors/order, including `income_extraordinary`.
- `components/ui/popover.tsx` and `components/ui/tooltip.tsx` — existing Radix/shadcn primitives for education affordances.
- `components/ui/button.tsx` and `components/ui/badge.tsx` — existing compact controls/chip-like styling foundations.
- `lib/validations/transactions.ts` and `lib/dal/transactions.ts` — existing `/transactions` filter contract, including `status=uncategorized` and `months=YYYY-MM,...`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`OverviewChartPoint`** (`lib/dal/overview.ts`) already exposes exactly the buckets needed by the chips: `{ income: { recurring, extraordinary }, out: { essential, discretionary, operational, financial, debt, extraordinary } }`.
- **`OverviewData.uncategorizedCount`** (`lib/dal/dashboard.ts` via `getOverview(year)`) already carries the selected-year uncategorized count used by the nudge.
- **`OverviewHeader`** is already a client component with title-row layout and year URL handling; it is the natural attachment point for the inline nudge if prop threading remains clean.
- **`OverviewChart`** is a client component and already uses Decimal-safe derivation before crossing into Recharts numbers.
- **`Popover` / `Tooltip` primitives** already exist and are used elsewhere; wrap chip tooltips in `TooltipProvider` when needed.
- **Lucide icons** are available for info and dismiss actions; use a proper icon button rather than visible "X" text.

### Established Patterns
- User-facing UI copy is Italian; identifiers, filenames, tests, comments, and planning docs are English.
- Monetary values and chart bucket reductions must use Decimal helpers until the final Recharts number boundary.
- Dashboard overview remains year-scoped by `?year=`. Do not regress the Phase 43 server-component data flow.
- The app favors small client controls on top of server-fetched data. This phase should keep filters client-side because the rich chart payload is already present.
- Avoid landing-page or explanatory-panel treatment. This is an operational dashboard; controls should be compact and scannable.

### Integration Points
- `app/(app)/dashboard/overview/page.tsx` must pass the nudge count and any needed selected-year metadata to the client component that owns localStorage dismissal.
- `components/dashboard/overview/overview-chart.tsx` must accept or own chip state and derive filtered bar rows from the existing chart data.
- `/transactions?status=uncategorized` is the base target for the nudge CTA; selected-year scoping can be represented with the existing `months` query param.

</code_context>

<specifics>
## Specific Ideas

- Nudge copy should stay invitational and count-free, for example: `Hai movimenti da categorizzare` plus `Completarli rende la panoramica più precisa.` The exact text is planner discretion.
- Income filter labels should align with Phase 42 labels: `Ricorrenti` / `Straordinarie`, with `income` represented as recurring and `income_extraordinary` represented as extraordinary.
- Expense filter labels should use current product labels from `NATURE_LABELS`; do not introduce friendlier replacements like "Sfizi/Extra" in this phase.
- Education should explain each chip in one concise line. Popovers can summarize the group; tooltips can describe the individual chip.
- Treat the existing unstaged modification in `components/dashboard/overview/overview-chart.tsx` as pre-existing worktree state. Do not revert it while planning or executing Phase 44.

</specifics>

<deferred>
## Deferred Ideas

- **Per-month movers drill-down** (`MOVE-01`..`MOVE-05`) -> Phase 45.
- **FlowNature friendly display-label rename** (`EDU-FUT-01`) -> future quick task; not part of Phase 44.
- **DB-backed nudge dismissal** -> explicitly out of scope for v1.16.
- **Deviation engine migration to "last month with data"** -> previously deferred from Phase 42.

</deferred>

---

*Phase: 44-overview-interactions*
*Context gathered: 2026-06-08*
