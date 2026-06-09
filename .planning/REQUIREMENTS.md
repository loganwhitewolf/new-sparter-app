# Requirements: Sparter — v1.16 Dashboard Overview Redesign

**Defined:** 2026-06-07
**Core Value:** The user can safely import real bank transactions, see where their money goes categorized by month, and instantly spot deviations from their baseline spending — all on a zero-cost personal deploy.

**Design source:** `app/proto/overview/NOTES.md` (LOCKED — grill-me 2026-05-29 + PO review 2026-06-03). PO verdict: chart **variant A** + header **H1**. Do not re-open locked decisions during planning.

## v1.16 Requirements

Each requirement maps to exactly one roadmap phase. IDs continue the project's category-prefixed convention.

### Hero Chart (variant A)

- [ ] **CHART-01**: User sees one bar group per month for the selected year, with side-by-side Entrate (green) and Uscite (red) bars.
- [ ] **CHART-02**: Each bar shows its value as an always-on compact label (k-notation, e.g. "2,5k"); the exact value remains in the tooltip.
- [ ] **CHART-03**: The chart never stacks bars by nature and never plots the balance series (balance lives in the KPIs).

### Header & Year Scope (variant H1)

- [ ] **HEAD-01**: User sees the page title with an inline year-selector pill on the same row.
- [ ] **HEAD-02**: Selecting a year re-scopes the entire tab — KPIs, chart, and movers — to that year (YTD if the year is in progress, full year if past).
- [ ] **HEAD-03**: The year selector lists only years that have transaction data.

### KPIs

- [ ] **KPI-01**: User sees four KPI cards — Totale entrate, Totale uscite, Bilancio, Tasso risparmio — computed over the selected year's span.
- [ ] **KPI-02**: Each KPI shows a delta versus the same year-to-date span of the prior year, labeled "vs {anno prec.}".
- [ ] **KPI-03**: Each KPI shows a sentiment-colored qualitative reading line (good / warn / bad / neutral) appropriate to that metric: savings benchmark (50/30/20 heuristic), balance sign, and income/expense trend vs prior year.
- [ ] **KPI-04**: KPI totals always reflect real totals and ignore the chart's filter chips.

### Uncategorized Nudge

- [ ] **NUDGE-01**: When the selected year has uncategorized OUT expenses, the user sees an inline amber nudge on the title row inviting them to categorize (invitational tone, no count in the copy).
- [ ] **NUDGE-02**: The nudge offers a "Categorizza ora" link to the uncategorized transactions and an X to dismiss it.
- [ ] **NUDGE-03**: Dismissal persists in localStorage only (never on DB); the nudge reappears when new uncategorized expenses arrive, using a `lastSeenCount` comparison.
- [ ] **NUDGE-04**: The nudge is hidden when the selected year has zero uncategorized OUT expenses.

### Movers Drill-down

- [x] **MOVE-01**: User can click a month's bar to see that month's top spending movers versus the previous month.
- [x] **MOVE-02**: Movers are split into "Dove hai speso di più" (increases, red) and "Dove hai risparmiato" (decreases, green); an empty section is hidden.
- [x] **MOVE-03**: Each mover reads as a human sentence — "{categoria} · {importo} in più / in meno" — with "spesa nuova" when the previous month was zero; no percentages, no prev→curr notation.
- [x] **MOVE-04**: The drill-down defaults to the last month that has transactions, and the selected month's bars are visually highlighted.
- [x] **MOVE-05**: Selecting the first month (no prior month to compare) shows an empty state.

### Chart Filters

- [ ] **FILT-01**: User can filter the chart's income bars by type — recurring vs extraordinary — via chips. *(Open question: maps onto existing `nature` on the `in` side or needs a dedicated field — resolve in planning; may affect schema/DAL.)*
- [ ] **FILT-02**: User can filter the chart's expense bars by nature (essential, discretionary, operational, financial, debt, extraordinary) via chips.
- [ ] **FILT-03**: Chart filters affect only the chart's bars, not the KPIs.

### In-context FlowNature Education

- [ ] **EDU-01**: User can open an ⓘ legend popover next to the Entrate and Uscite filter groups, explaining each type in one line.
- [ ] **EDU-02**: Each filter chip shows a hover tooltip with its one-line definition.

### Data Layer & Glossary

- [x] **DATA-01**: `getOverview(year)` returns the four KPI totals with YTD-vs-prior-YTD comparison.
- [x] **DATA-02**: `getMonthOverMonthCategoryChanges(year, monthIndex?, limit?)` returns per-month category movers (OUT only, €15 noise threshold).
- [x] **DATA-03**: `getYearsWithData()` returns the years that have transactions, powering the year selector.
- [x] **DATA-04**: `Reference Period` is redefined to "last month with data" and the canonical term `MonthOverMonthChange` is documented in `CONTEXT.md` (deprecated "variazione" stays banned).

## Future Requirements (deferred)

- **EDU-FUT-01**: Friendlier display labels for the `FlowNature` taxonomy (e.g. "Discrezionale" → "Sfizi/Extra"), keeping the canonical economic terms as internal values. Cross-cutting (CONTEXT.md, seed, settings selector, charts, user overrides) → separate quick task.

## Out of Scope (v1.16)

- **Stack-by-nature on the hero bars** — explicitly rejected by PO; reintroduces the 8-segment confusion the redesign eliminated. Nature composition is served by filter chips + ⓘ legend and the per-month movers drill-down.
- **5th "Da categorizzare" KPI card** — replaced by the inline nudge.
- **DB persistence of nudge dismissal** — localStorage only (user decision).
- **REVAL-01 / R029** — parked backlog, not this milestone.
- **Categories tab / drill-down rework** — those routes already shipped in M006; v1.16 touches only the overview tab.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 42 | Complete |
| DATA-02 | Phase 42 | Complete |
| DATA-03 | Phase 42 | Complete |
| DATA-04 | Phase 42 | Complete |
| HEAD-01 | Phase 43 | Pending |
| HEAD-02 | Phase 43 | Pending |
| HEAD-03 | Phase 43 | Pending |
| CHART-01 | Phase 43 | Pending |
| CHART-02 | Phase 43 | Pending |
| CHART-03 | Phase 43 | Pending |
| KPI-01 | Phase 43 | Pending |
| KPI-02 | Phase 43 | Pending |
| KPI-03 | Phase 43 | Pending |
| KPI-04 | Phase 43 | Pending |
| NUDGE-01 | Phase 44 | Pending |
| NUDGE-02 | Phase 44 | Pending |
| NUDGE-03 | Phase 44 | Pending |
| NUDGE-04 | Phase 44 | Pending |
| FILT-01 | Phase 44 | Pending |
| FILT-02 | Phase 44 | Pending |
| FILT-03 | Phase 44 | Pending |
| EDU-01 | Phase 44 | Pending |
| EDU-02 | Phase 44 | Pending |
| MOVE-01 | Phase 45 | Complete |
| MOVE-02 | Phase 45 | Complete |
| MOVE-03 | Phase 45 | Complete |
| MOVE-04 | Phase 45 | Complete |
| MOVE-05 | Phase 45 | Complete |
