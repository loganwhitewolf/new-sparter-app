# Phase 43: overview-shell - Context

**Gathered:** 2026-06-08
**Status:** Ready for planning

<domain>
## Phase Boundary

The redesigned `/dashboard/overview` tab **UI shell**, wired to the Phase 42 data layer. Delivers requirements **HEAD-01, HEAD-02, HEAD-03, CHART-01, CHART-02, CHART-03, KPI-01, KPI-02, KPI-03, KPI-04**.

Three pieces ship in this phase:
1. **Header (variant H1)** — page title with an inline year-selector pill on the same row; selecting a year re-scopes the whole tab (KPIs + chart). Years sourced from `getYearsWithData()`.
2. **Hero chart (variant A)** — side-by-side Entrate (green) / Uscite (red) grouped bars per month, always-on compact (k-notation) value labels, exact value in tooltip. No stack-by-nature, no balance series.
3. **4 KPI cards** — Totale entrate, Totale uscite, Bilancio, Tasso risparmio; each with a "vs {anno prec.}" delta badge and a sentiment-colored qualitative reading line.

The design is **LOCKED** in `app/proto/overview/NOTES.md` (grill-me 2026-05-29 + PO review 2026-06-03; verdict: chart variant A + header H1) and already exists as shippable-quality prototype components. Do not re-open locked decisions.

**Explicitly OUT of scope (later phases):**
- Filter chips (income type + expense nature) + ⓘ legend popovers + per-chip tooltips → **Phase 44** (FILT-*, EDU-*)
- Inline amber uncategorized nudge → **Phase 44** (NUDGE-*)
- Per-month movers drill-down (bar click → top movers panel) → **Phase 45** (MOVE-*)

</domain>

<decisions>
## Implementation Decisions

### Component strategy — D-01..D-02
- **D-01 — Port the prototype 1:1 to production.** Promote the PO-approved proto components (`variant-a.tsx` chart, `kpi-row.tsx` + `kpi-card-reading.tsx` ReadingKpiCard, `header-variants.tsx` HeaderH1) into real `components/dashboard/` components, **stripping the P44/P45 bits** (FilterBar, MoversList, click-driven drill-down). This preserves the exact approved look rather than re-deriving it.
- **D-02 — Delete the superseded shipped components in cleanup.** `KpiCards`, `KpiCard`, `EntrateUsciteChart`, `BilancioBarsChart`, `OverviewFilters` (+ their skeletons `OverviewSkeleton`/`TrendSkeleton` as applicable) are consumed **only** by `overview/page.tsx` (verified) — safe to remove once the new shell renders. The Categories pages use different components (`category-breakdown-chart`, `category-detail-trend-chart`) and are untouched. `yarn build` must stay green.

### Chart interactivity boundary — D-03
- **D-03 — Build the internal scaffold, render nothing inert.** The new chart component is built with the structural hooks P44/P45 will need — internal `selectedMonth` state, per-bar `<Cell>` with opacity control, `onClick` wiring, optional props for filter chips / movers panel — **but in Phase 43 it renders nothing non-functional to the user**: no visible filter chips, no visible highlight/clickable affordance until the P45 movers panel exists. P44/P45 activate the features without rewriting the component structure. (Chosen over showing disabled/placeholder UI, which would look broken.)
- **Chart input in P43:** `getOverviewChart(year)` returns the income/out split, but P43 has no filters → sum `income.recurring + income.extraordinary` into one green bar and the 6 OUT natures into one red bar per month. The richer payload is sliced client-side by P44's chips later (no new round-trips).

### Year scope & URL state — D-04..D-05
- **D-04 — Default year = current year if it has data, else most recent year with data.** Without a `?year=` param, default to the current calendar year **when it appears in `getYearsWithData()`**; otherwise fall back to the most recent year with data. This keeps HEAD-03 consistent (the selected year is always present in the selector). An invalid / no-data `?year=` value resolves via the same logic.
- **D-05 — Year selected via `?year=` URL param, `router.replace` (no history spam), `scroll: false`.** Mirrors the proto's `HeaderH1` pattern. The year selector is a client component; the page reads `searchParams.year` server-side and passes the resolved year down so KPIs + chart re-scope together.

### Empty / cold-start states — D-06
- **D-06 — Curate explicit empty states.** Although the onboarding RSC gate redirects zero-transaction users to `/onboarding`, the shell still handles: (a) selected year with no data, (b) account with no years at all (edge beyond the gate), (c) zero-value months inside the chart. KPIs show `0` / neutral values with the delta badge hidden when the delta is `null` (prior-year span absent). No "raw zeros with no copy" — provide a short placeholder message where a whole section would otherwise be blank.

### Claude's Discretion
- **Currency / number formatting** — the proto's `eur` / `eurCompact` live in throwaway `mock-data.ts`. Production needs a real helper (e.g. `Intl.NumberFormat('it-IT', { currency: 'EUR' })` for KPI/tooltip values and a compact k-notation formatter for bar labels). Place and shape at the planner's discretion; KPI DECIMAL values arrive as strings from the DAL.
- **Suspense / streaming boundaries** — whether KPIs and the chart stream under one or separate Suspense boundaries, and the skeleton shapes, are planner discretion. The header (needs `getYearsWithData()`) can render eagerly.
- **Reading-line thresholds** are already defined in the proto (`savingsReading` 50/30/20, `balanceReading` sign, `trendReading` vs prior year) — port them verbatim unless the data shape forces a change.
- Exact component file names / co-location under `components/dashboard/` at planner discretion.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design source (LOCKED — read first)
- `app/proto/overview/NOTES.md` — full locked redesign rationale: chart variant A, header H1, 4-KPI + qualitative readings, the year-scope model (YTD vs prior-YTD), and the bar-label / no-stack decisions. The deferred items (movers drill-down, nudge, filters, education) are scoped to P44/P45 and must NOT be built here.
- `app/proto/overview/variant-a.tsx` — reference implementation of the hero chart (recharts grouped bars, `LabelList` compact labels, `Cell` opacity hook). **Strip `FilterBar` and `MoversList`** when porting.
- `app/proto/overview/kpi-row.tsx` + `app/proto/overview/kpi-card-reading.tsx` — reference for the 4 KPI cards + `ReadingKpiCard` with sentiment reading lines and `savingsReading` / `balanceReading` / `trendReading` helpers.
- `app/proto/overview/header-variants.tsx` §`HeaderH1` — reference for the title + inline year-pill (Select) and the `?year=` `router.replace` wiring. Other header variants (H2–H5) are not used.
- `app/proto/overview/mock-data.ts` — intended data shapes only; `eur`/`eurCompact` are throwaway → replace with a production formatter.

### Data layer (Phase 42 — already shipped)
- `lib/dal/overview.ts` — `getOverview(year): OverviewData`, `getYearsWithData(): string[]` (DESC), `getOverviewChart(year): OverviewChartPoint[]`. P43 consumes these. (`getMonthOverMonthCategoryChanges` is for P45, not P43.)
- `lib/dal/dashboard.ts` §`OverviewData` type — KPI shape: `{ totalIn, totalOut, balance: string; savingsRate: number; uncategorizedCount; deltas: {...} }`. DECIMALs are strings; `deltas.*` are `number | null`.

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — v1.16 contract; HEAD-01..03, CHART-01..03, KPI-01..04 map to this phase. NUDGE/FILT/EDU/MOVE are explicitly later phases.
- `.planning/ROADMAP.md` §"Phase 43: overview-shell" — goal + 4 success criteria.
- `.planning/phases/42-overview-data-layer/42-CONTEXT.md` — the data-layer decisions (income split D-01..04, YTD bound D-11, query surface D-09..10) that this shell sits on top of.

### Glossary
- `CONTEXT.md` §"Dashboard e analisi" — canonical domain terms (Reference Period = "last month with data", `MonthOverMonthChange`, Deviation, "variazione" banned). User-facing copy must follow it.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Proto components** (`app/proto/overview/*.tsx`) are shippable-quality and PO-approved — the primary source to port (D-01).
- **`components/ui/chart.tsx`** — `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartConfig` (shadcn/recharts wrappers); the proto already uses these.
- **`components/ui/select.tsx`**, **`components/ui/card.tsx`**, **`components/ui/badge.tsx`** — used by HeaderH1 and the KPI cards.
- **Color tokens** — `var(--total-in)` (green), `var(--total-out)` (red), `var(--balance)`, `text-total-in/out` utility classes already exist and are used by the proto.

### Established Patterns
- DAL is consumed by RSC server pages; the page is an `async` Server Component reading `searchParams`. Year selector is a `'use client'` component doing `router.replace`.
- Existing `overview/page.tsx` uses `<Suspense>` with skeletons — pattern to mirror (planner picks boundary granularity).
- Italian for all user-facing copy; English for identifiers/comments/tests. Run `yarn check:language` after touching routes/strings.
- Monetary values: DAL returns DECIMAL strings; never native JS arithmetic on amounts — use `@/lib/utils/decimal` if any client-side math is needed (formatting only here).

### Integration Points
- `app/(app)/dashboard/overview/page.tsx` is the single integration point — rewritten to call the Phase 42 DAL and render the new shell.
- `app/(app)/dashboard/page.tsx` redirects to `/dashboard/overview` (unchanged).
- Cleanup removes the old `KpiCards` / `EntrateUsciteChart` / `BilancioBarsChart` / `OverviewFilters` (+ skeletons) — all confirmed used only by the overview page.

</code_context>

<specifics>
## Specific Ideas

- **Bar labels:** always-on compact k-notation (e.g. "2,5k") above each bar via recharts `LabelList`; exact value stays in the tooltip (CHART-02). Source: proto `variant-a.tsx`.
- **KPI reading lines (port verbatim from proto):**
  - Tasso risparmio (50/30/20 heuristic): ≥20% "Ottimo, sopra il 20% consigliato" (good) · 10–20% "Buono, puoi puntare al 20%" (good) · 0–10% "Migliorabile" (warn) · <0 "Attenzione: spendi più di quanto guadagni" (bad).
  - Bilancio (sign): >0 "Spendi meno di quanto guadagni" (good) · <0 "Spendi più di quanto guadagni" (bad) · =0 "Sei in pareggio" (neutral).
  - Entrate / Uscite (trend vs prior year): e.g. "Più entrate del {anno}", "Spendi meno del {anno}", "In linea con il {anno}".
  - Tone is gentle/observational — guidance, NOT financial advice (per NOTES.md caveat).
- **Delta badge:** relabeled "vs {anno prec.}" (consistent with KPI = YTD-vs-YTD), hidden when delta is `null`.

</specifics>

<deferred>
## Deferred Ideas

- **Filter chips + ⓘ legend + per-chip tooltips** (FILT-01/02/03, EDU-01/02) → **Phase 44**. The chart component exposes optional props/hooks (D-03) so P44 wires them without a rewrite.
- **Inline amber uncategorized nudge** (NUDGE-01..04, localStorage `lastSeenCount`) → **Phase 44**.
- **Per-month movers drill-down** (MOVE-01..05, bar click → top movers panel, default last month with data, highlighted bar) → **Phase 45**. The chart's internal `selectedMonth` / `<Cell>` opacity hook (D-03) is the seam P45 builds on.
- **FlowNature friendly display-labels rename** (EDU-FUT-01) → separate future quick task, not this milestone.
- **Align Deviation engine to "last month with data"** → tracked follow-up (doc-vs-code drift from Phase 42 D-12), out of scope here.

</deferred>

---

*Phase: 43-overview-shell*
*Context gathered: 2026-06-08*
