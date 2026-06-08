# Phase 45: overview-movers - Context

**Gathered:** 2026-06-08
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase activates the per-month movers drill-down on the redesigned `/dashboard/overview` tab delivered in Phases 43–44.

It delivers requirements **MOVE-01, MOVE-02, MOVE-03, MOVE-04, MOVE-05**:

1. **Bar click → highlight + movers panel** — clicking any month's bar highlights that month's bars (dim unselected to `fillOpacity 0.4`, D-03 scaffold) and updates the inline movers panel below the chart.
2. **Two-section movers panel** — "Dove hai speso di più" (increases, red) and "Dove hai risparmiato" (decreases, green), each hidden when empty.
3. **Humanized sentence format** — `{categoria} · {importo} in più / in meno`; "spesa nuova" when `isNew: true`; no percentages.
4. **Default to last month with data** — panel is visible from initial page load, pre-fetched server-side for the last non-zero month in the year.
5. **Empty state for no movers** — when `getMonthOverMonthCategoryChanges` returns an empty array (first historical month or all spends below the €15 noise floor), show a short contextual message.

**Explicitly OUT of scope:**
- FlowNature chart filter chips → Phase 44 (already shipped).
- Any new DAL changes or schema migrations → DAL function `getMonthOverMonthCategoryChanges` is complete from Phase 42.

</domain>

<decisions>
## Implementation Decisions

### Panel Placement — D-01..D-02
- **D-01 — Movers panel is inline below the chart.** It renders as a card/section immediately after the chart `<section>`. No drawer, no overlay, no aside column. Layout remains linear: header → KPIs → chart → movers panel.
- **D-02 — Panel heading format:** `{Mese} {Anno} vs {Mese Precedente} {Anno Precedente}` as a heading, followed by "Dove hai speso di più" (red) and "Dove hai risparmiato" (green) as subsection labels. Empty sections are hidden (MOVE-02).

### Data Fetching Architecture — D-03..D-05
- **D-03 — Panel is visible from initial page load.** `OverviewDataSection` (server component) pre-fetches the movers for the default month and passes `initialMovers: MonthOverMonthChange[]` and `defaultMonthIndex: number` as props to the client component that owns the panel.
- **D-04 — "Last month with data" is determined server-side.** In `OverviewDataSection`, after fetching `getOverviewChart(year)`, find the highest index `i` where `income.recurring + income.extraordinary + sum(out values) > 0` using Decimal helpers. Pass `defaultMonthIndex` down to the client. Do NOT use `data.length - 1` (always index 11/December).
- **D-05 — On click, movers refresh via Server Action.** A thin `"use server"` action wraps `getMonthOverMonthCategoryChanges(year, monthIndex)`. The client calls it with `useTransition` on bar click; movers state lives in `useState`. The `?year=` URL param is not affected by month selection.

### Bar Highlight — D-06
- **D-06 — Selected month bars at full opacity, unselected at 0.4.** The D-03 scaffold already specifies this: `fillOpacity: i === selectedMonth ? 1 : 0.4`, `cursor: "pointer"`. Applied to both Entrate and Uscite Cell arrays.

### Empty State (MOVE-05) — D-07
- **D-07 — Empty state triggers when the movers array is empty.** If `getMonthOverMonthCategoryChanges` returns `[]` (e.g., first historical month, no prior-month data, or all deltas below €15 noise floor), render a short contextual message in the panel body. Items with `isNew: true` (spesa nuova) are NOT suppressed — they count as movers and appear in the "Dove hai speso di più" section normally.

### Copy and Format — D-08 (Claude's Discretion for exact strings)
- **D-08 — Human sentence format per MOVE-03:** `{nome categoria} · {importo} in più` for increases, `{nome categoria} · {importo} in meno` for decreases, `{nome categoria} · spesa nuova` when `isNew: true`. `{importo}` formatted with the existing `formatEur` helper (not compact notation). No percentages, no prev→curr arrows.
- Exact Italian wording of the empty state message, heading format, and section labels is planner discretion within this context (see **D-08 specifics** below).

### Claude's Discretion
- Exact component name for the movers panel (e.g., `OverviewMoversPanel`).
- Whether the Server Action lives in `lib/actions/overview.ts` or a new file.
- Loading state treatment during Server Action call (e.g., skeleton rows, opacity, spinner inside the panel — not a full page loader).
- Number of movers shown (the DAL `limit` param defaults to 10; planner can adjust or expose as config).
- Test coverage: at minimum, verify that the humanized formatter handles `isNew: true`, negative delta, and zero prev amount correctly.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/REQUIREMENTS.md` — Phase 45 owns MOVE-01..MOVE-05. Full requirement text with exact copy requirements.
- `.planning/ROADMAP.md` §"Phase 45: overview-movers" — phase goal, 5 success criteria, dependency on Phase 44, and UI hint.
- `.planning/PROJECT.md` §"Current Milestone: v1.16 Dashboard Overview Redesign" — milestone-level locked design summary.

### Prior phase decisions
- `.planning/phases/42-overview-data-layer/42-CONTEXT.md` — `MonthOverMonthChange` type, `getMonthOverMonthCategoryChanges` signature, €15 noise floor, year-crossing guard for January, `isNew` semantics.
- `.planning/phases/44-overview-interactions/44-CONTEXT.md` §"D-03" — `onMonthSelect` seam and `selectedMonth` scaffold details; bar highlight approach (`fillOpacity 0.4`) locked here.
- `.planning/phases/43-overview-shell/43-CONTEXT.md` — OverviewChart shape, server component data flow for `?year=`.

### Current implementation
- `lib/dal/overview.ts` — `MonthOverMonthChange`, `getMonthOverMonthCategoryChanges(year, monthIndex, limit)`, `getOverviewChart(year)`, `OverviewChartPoint`. Read these before planning any DAL or action layer.
- `components/dashboard/overview/overview-chart.tsx` — current client component with `selectedMonth` state, `onMonthSelect` prop seam, D-03 Cell scaffold (fillOpacity / cursor comments). The planner activates the scaffold, does not rewrite from scratch.
- `app/(app)/dashboard/overview/page.tsx` — server page; `OverviewDataSection` async component is where `defaultMonthIndex` computation and initial movers fetch should be added.
- `components/dashboard/overview/format.ts` — `formatEur` helper for movers amount display.
- `lib/actions/` — existing Server Actions pattern; new movers action should follow the same structure.

### Domain
- `CONTEXT.md` §"Dashboard e analisi" — `MonthOverMonthChange` and `Reference Period` glossary; avoid deprecated "variazione".

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`getMonthOverMonthCategoryChanges(year, monthIndex, limit)`** (`lib/dal/overview.ts`) — complete Phase 42 implementation. Returns `MonthOverMonthChange[]` sorted by `|Δ€|` descending. Handles year-crossing for January.
- **`MonthOverMonthChange`** — `{ categoryId, name, delta: string, isNew: boolean }`. `delta` is a signed Decimal string; negative = saved, positive = spent more.
- **`OverviewChart`** (`components/dashboard/overview/overview-chart.tsx`) — already has `selectedMonth` state (default `data.length - 1`), `onMonthSelect?: (monthIndex: number) => void` prop, and D-03 Cell scaffold with `onClick={(_, index) => setSelectedMonth(index)}`.
- **`formatEur`** (`components/dashboard/overview/format.ts`) — existing formatter; use for mover amounts.
- **`useTransition`** (React) — already used in other client components in the project for Server Action calls.

### Established Patterns
- Monetary arithmetic via `Decimal.js` helpers until Recharts number boundary — applies to computing `defaultMonthIndex` from chart data.
- Server Actions in `lib/actions/` follow `"use server"` + thin wrapper pattern.
- Italian copy for user-facing strings; English for identifiers, filenames, comments.
- Dashboard overview remains year-scoped by `?year=`; month selection is ephemeral client state, not URL.
- `OverviewDataSection` is the server async component that fetches and passes data — new movers pre-fetch goes here.

### Integration Points
- `OverviewDataSection` in `page.tsx`: add `defaultMonthIndex` derivation from `chart` data + `getMonthOverMonthCategoryChanges(year, defaultMonthIndex)` call; pass both to the new `OverviewMoversPanel` client component.
- `OverviewChart`: promote `onMonthSelect` from unused prop to active callback; activate D-03 Cell scaffold (fillOpacity + cursor); pass `defaultMonthIndex` in as controlled prop (so chart and panel stay in sync).
- New `OverviewMoversPanel` client component: receives `initialMovers`, `year`, `defaultMonthIndex`; owns `selectedMonth` state (or lifts to a shared parent); calls Server Action on bar click change.
- Server Action: `getMoversAction(year, monthIndex)` in `lib/actions/overview.ts`; wraps `getMonthOverMonthCategoryChanges`.

</code_context>

<specifics>
## Specific Ideas

- Panel heading example: `Maggio 2025 vs Aprile 2025` — computed from `selectedMonth` index and year.
- "Dove hai speso di più" section: red accent color (consistent with `var(--total-out)`); list items as `{nome categoria} · €{importo} in più` or `{nome categoria} · spesa nuova`.
- "Dove hai risparmiato" section: green accent (consistent with `var(--total-in)`); list items as `{nome categoria} · €{importo} in meno`.
- Empty state message (planner discretion, example): `Nessuna variazione significativa — mese di partenza o nessuna spesa sopra €15.`
- Loading state during Server Action (planner discretion): subtle opacity on the panel or skeleton rows, not a full spinner.

</specifics>

<deferred>
## Deferred Ideas

- Chart filter chips (FILT-01..FILT-03) — shipped in Phase 44; not this phase.
- FlowNature display-label rename (EDU-FUT-01) — future quick task.
- Limit parameter exposed as user config — planner can default to 10; future enhancement if needed.
- "Limit to top N" selector in the movers panel — out of scope for this phase.

</deferred>

---

*Phase: 45-overview-movers*
*Context gathered: 2026-06-08*
