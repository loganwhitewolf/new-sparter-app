# Roadmap

## Milestones

- ✅ **M001–M006** — Foundation → Dashboard Insight Suite (Phases 1–23, shipped ~2026-05)
- ✅ **M007: Zero-cost Production Deploy** — Phases 24–28 (shipped 2026-05-19)
- ✅ **v1.8 / M008: Dashboard Intelligence** — Phase 29 (shipped 2026-05-20)
- ✅ **v1.9: Social Auth** — Phases 30–32 (shipped 2026-05-22)
- ✅ **v1.10: Pattern Suggestions** — Phases 33–36 (shipped 2026-05-25)
- ✅ **v1.12: First-import Onboarding** — Phase 38 (shipped 2026-05-28)
- ✅ **v1.13: Unified Categorization Picker** — Phase 39 (shipped 2026-06-02)
- ✅ **v1.14: Unified Table Filter & Sort** — Phase 40 (shipped 2026-06-04)
- ✅ **v1.15: Collapsible Sidebar** — Phase 41 (shipped 2026-06-07)
- 🚧 **v1.16: Dashboard Overview Redesign** — Phases 42–45 (in progress)

## Phases

<details>
<summary>✅ M001–M006 (Phases 1–23) — SHIPPED</summary>

- [x] Phase 01: design-system
- [x] Phase 02: authentication
- [x] Phase 03: expense-management
- [x] Phase 04: dashboard-kpi
- [x] Phase 05–07: M001 remaining slices
- [x] Phase 08–10: M002 Observability
- [x] Phase 11–16: M004 Import Management
- [x] Phase 17–20: M005 Category Management & UX Polish
- [x] Phase 21–23: M006 Dashboard Insight Suite

</details>

<details>
<summary>✅ M007: Zero-cost Production Deploy (Phases 24–28) — SHIPPED 2026-05-19</summary>

- [x] Phase 24: s01 — env contract + DB pool config
- [x] Phase 25: s02 — production migration CLI
- [x] Phase 26: s03 — R2 upload + CORS
- [x] Phase 27: s04 — registration guardrail
- [x] Phase 28: s05 — runbook + smoke suite

</details>

<details>
<summary>✅ v1.8 / M008: Dashboard Intelligence (Phase 29) — SHIPPED 2026-05-20</summary>

- [x] Phase 29: dashboard-intelligence — Deviation view + chart clarity *(complete 2026-05-20)*
  - [x] 29-01: D-01 fix, deviation utilities, test scaffolds
  - [x] 29-02: getCategoryDeviations DAL + DeviationBadge
  - [x] 29-03: EntrateUsciteChart + BilancioBarsChart (MonthlyTrendChart deleted)
  - [x] 29-04: Wire deviation into category pages + sort toggle

</details>

<details>
<summary>✅ v1.9: Social Auth (Phases 30–32) — SHIPPED 2026-05-22</summary>

- [x] Phase 30: oauth-config — OAuth provider setup, env wiring, registration guardrail removal *(complete 2026-05-21)*
- [x] Phase 31: oauth-ui — Social login/register buttons on auth pages *(complete 2026-05-21)*
- [x] Phase 32: account-linking — Link/unlink providers from settings *(complete 2026-05-22)*

Full details: `.planning/milestones/v1.9-ROADMAP.md`

</details>

<details>
<summary>✅ v1.10: Pattern Suggestions (Phases 33–36) — SHIPPED 2026-05-25</summary>

- [x] **Phase 33: pattern-suggestion-detector** — Pure `detectPatternSuggestions` utility; deterministic token-prefix algorithm *(complete 2026-05-22)*
- [x] **Phase 34: import-analysis-suggestions** — `analyzeFile` returns `patternSuggestions`; isolated try/catch, cap-5 sort *(complete 2026-05-23)*
- [x] **Phase 35: import-review-promotion** — Suggestions UI + `promoteSuggestionAction`; 577 tests GREEN *(complete 2026-05-23)*
- [x] **Phase 36: post-import-reanalysis** — `/import/[fileId]/suggestions` page; "Rivedi suggerimenti" dropdown *(complete 2026-05-23)*

Full details: `.planning/milestones/v1.10-ROADMAP.md`

</details>

<details>
<summary>✅ v1.11: FlowNature & Segmented Chart (Phase 37) — SHIPPED 2026-05-26</summary>

- [x] Phase 37: flow-nature-chart — `nature` enum on `sub_category`; stacked nature-segmented `EntrateUsciteChart`; URL-persisted legend toggles; nature editable in settings *(complete 2026-05-26)*
  - [x] 37-01: Wave 0 scaffolding + `lib/utils/nature-labels.ts`
  - [x] 37-02: Schema migration — `flowNatureEnum`, nature columns, seed 126 subcategories
  - [x] 37-03: DAL `getMonthlyTrendByNature` + `effectiveNature` on `CategoryWithSubCategories`
  - [x] 37-04: Stacked nature chart rewrite + URL-persisted legend toggle
  - [x] 37-05: Settings — nature required on creation + `SubcategoryNatureSelect` + `setSubcategoryNatureAction`

Full details: `.planning/milestones/v1.13-ROADMAP.md`

</details>

<details>
<summary>✅ v1.12: First-import Onboarding (Phase 38) — SHIPPED 2026-05-28</summary>

- [x] Phase 38: first-import-onboarding — 5-step guided flow; RSC layout routing gate; categorization wizard with nature badges *(complete 2026-05-28)*
  - [x] 38-01: DAL foundation + RSC layout guard
  - [x] 38-02: Onboarding route group + Steps 1–3
  - [x] 38-03: Step 4 categorization wizard + Step 5 outro + prototype deletion

Full details: `.planning/milestones/v1.13-ROADMAP.md`

</details>

<details>
<summary>✅ v1.13: Unified Categorization Picker (Phase 39) — SHIPPED 2026-06-02</summary>

- [x] Phase 39: unified-subcategory-picker — Single `SubcategoryPicker` (vaul bottom sheet) across all 7 surfaces; pattern form rework; `amountSign` derived server-side per ADR 0008 *(complete 2026-06-02)*
  - [x] 39-01: vaul + `getMostUsedSubcategories` DAL + `subcategory-options.ts` extraction
  - [x] 39-02: `SubcategoryPicker` component (variant E) — bottom sheet, type chips, master-detail, search-collapse
  - [x] 39-03: Adopt in 4 commit-on-tap surfaces (expense, transaction, bulk, onboarding)
  - [x] 39-05: Pattern forms rework — `amountSign` server-side, `confidence=1`
  - [x] 39-04: Adopt in 2 fill-field forms (expense form, transaction form)
  - [x] 39-06: Cleanup — delete legacy pickers + prototype route; `yarn build` green

Full details: `.planning/milestones/v1.13-ROADMAP.md`

</details>

<details>
<summary>✅ v1.14: Unified Table Filter & Sort (Phase 40) — SHIPPED 2026-06-04</summary>

- [x] **Phase 40: table-filter-sort** — Unified filtering + sorting across Transactions, Expenses, Files tables; shared `DataTableToolbar`; month-multi picker; `id` sort tiebreaker; per-table declarative config (ADR 0009, ADR 0010) *(complete 2026-06-04)*
  - Goal: Replace the three divergent table controls with one coherent system — same behaviour, same UI shape, only the declared fields differ per table.
  - Depends on: Phase 39
  - Constraints: No filter engine (ADR 0010); URL = single source of truth; server-side filtering; offset+infinite-scroll pagination unchanged; `id` tiebreaker on all DAL sorts; Expenses have NO temporal filter (ADR 0009).
  - Plans: 5 plans (5 waves)

Plans:

- [x] 40-01-PLAN.md — Foundation: shared TableConfig types + URL param parsers + id tiebreaker on transactions/imports DAL *(complete 2026-06-04)*
- [x] 40-02-PLAN.md — Shared UI: DataTableToolbar + HeaderSortButton + ChipsRow + URL-mutation hook (mock config) *(complete 2026-06-04)*
- [x] 40-03-PLAN.md — New controls: getMonthsWithData DAL + MonthMultiPicker + AmountRangePicker, wired into toolbar *(complete 2026-06-04)*
- [x] 40-04-PLAN.md — Wire per-table configs + DAL filters for Transactions, Expenses, Files *(complete 2026-06-04)*
- [x] 40-05-PLAN.md — Polish: empty states, a11y pass, URL migration, prototype deletion, yarn build green *(complete 2026-06-04)*

</details>

<details>
<summary>✅ v1.15: Collapsible Sidebar (Phase 41) — SHIPPED 2026-06-07</summary>

- [x] **Phase 41: collapsible-sidebar** — Collapsible icon-rail sidebar; topbar removed on all breakpoints; app name + user controls (avatar, profile, logout) in sidebar; BottomNav gains Impostazioni entry; theme toggle moved to /settings page (ADR 0011) *(complete 2026-06-07)*
  - [x] 41-01-PLAN.md — SidebarProvider context + localStorage hook + Tooltip wrapper (foundation)
  - [x] 41-02-PLAN.md — AppShell + rewritten collapsible Sidebar (toggle, tooltips, bottom user controls); layout drops Topbar
  - [x] 41-03-PLAN.md — BottomNav Impostazioni + SettingsHub Aspetto; delete topbar.tsx; update tests + build/a11y gate

</details>

---

### 🚧 v1.16: Dashboard Overview Redesign (Phases 42–45)

**Milestone Goal:** Replace the `/dashboard/overview` tab with the PO-approved redesign (variant A + header H1) — a year-scoped overview that clearly answers "where did my money go and what changed".

- [x] **Phase 42: overview-data-layer** — DAL foundation: getOverview, getMonthOverMonthCategoryChanges, getYearsWithData, income-split resolution, CONTEXT.md glossary update (completed 2026-06-08)
- [x] **Phase 43: overview-shell** — Redesigned overview tab: header H1 + year selector, hero chart variant A (grouped bars, always-on labels), 4 KPI cards with qualitative reading lines (completed 2026-06-08)
- [x] **Phase 44: overview-interactions** — Uncategorized nudge (inline amber, localStorage dismiss), chart filter chips (income type + expense nature), FlowNature ⓘ education popovers (completed 2026-06-08)
- [x] **Phase 45: overview-movers** — Per-month movers drill-down: recharts bar click → top movers panel, humanized copy, highlighted bar, default to last month with data (3 plans, 3 waves) (completed 2026-06-09)

## Phase Details

### Phase 42: overview-data-layer

**Goal**: All server-side data contracts for the redesigned overview are in place and the project glossary reflects the new terms
**Depends on**: Phase 41
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04
**Success Criteria** (what must be TRUE):

  1. `getOverview(year)` returns four KPI totals plus YTD-vs-prior-YTD deltas for any year with data
  2. `getMonthOverMonthCategoryChanges(year, monthIndex?, limit?)` returns per-month OUT category movers above the €15 noise threshold
  3. `getYearsWithData()` returns only years that have at least one transaction
  4. CONTEXT.md documents `MonthOverMonthChange` as canonical term and redefines `Reference Period` as "last month with data"

**Plans**: 3 plans (3 waves)
Plans:
**Wave 1**

- [x] 42-01-PLAN.md — Wave 0 tests + flowNatureEnum extension + FlowNature blast-radius + dashboard exports + enum migration (build green)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 42-02-PLAN.md — [BLOCKING] apply migration + additive seed-extras STEP re-bucketing income_extraordinary slugs (PO-confirmed)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 42-03-PLAN.md — lib/dal/overview.ts (getOverview, getYearsWithData, getMonthOverMonthCategoryChanges, getOverviewChart) + CONTEXT.md glossary

### Phase 43: overview-shell

**Goal**: Users can view the redesigned overview tab with the year-scoped header, grouped bar chart, and 4 KPI cards
**Depends on**: Phase 42
**Requirements**: HEAD-01, HEAD-02, HEAD-03, CHART-01, CHART-02, CHART-03, KPI-01, KPI-02, KPI-03, KPI-04
**Success Criteria** (what must be TRUE):

  1. User sees the page title and a year-selector pill on the same row; only years with transaction data appear in the selector
  2. Selecting a year updates the KPIs and chart to reflect that year's data (YTD if current, full-year if past)
  3. User sees side-by-side green (Entrate) and red (Uscite) bars per month with always-on compact value labels; no stacking by nature, no balance series in the chart
  4. User sees four KPI cards (Totale entrate, Totale uscite, Bilancio, Tasso risparmio) with a "vs anno prec." delta badge and a sentiment-colored qualitative reading line

**Plans**: 4 plans (3 waves)
Plans:
**Wave 1** *(parallel — no file overlap)*

- [x] 43-01-PLAN.md — Port KPI row + ReadingKpiCard + HeaderH1 + production formatters into components/dashboard/overview/ (HEAD-01..03, KPI-01..04)
- [x] 43-02-PLAN.md — Port hero chart variant A (grouped bars, always-on labels), strip P44/P45, keep D-03 inert scaffold (CHART-01..03)

**Wave 2** *(blocked on Wave 1)*

- [x] 43-03-PLAN.md — Rewrite overview/page.tsx: searchParams.year + resolveYear (D-04) + Suspense + empty states (D-06), wiring header/KPIs/chart (HEAD-02/03, CHART-01, KPI-01)

**Wave 3** *(blocked on Wave 2)*

- [x] 43-04-PLAN.md — Cleanup: delete superseded KpiCards/EntrateUsciteChart/BilancioBarsChart/OverviewFilters + skeletons + proto/overview route; yarn build green (D-02)

**UI hint**: yes

### Phase 44: overview-interactions

**Goal**: Users can filter the chart by income type and expense nature, see inline FlowNature education, and dismiss the uncategorized nudge
**Depends on**: Phase 43
**Requirements**: NUDGE-01, NUDGE-02, NUDGE-03, NUDGE-04, FILT-01, FILT-02, FILT-03, EDU-01, EDU-02
**Success Criteria** (what must be TRUE):

  1. When the selected year has uncategorized OUT expenses, an inline amber nudge appears on the title row with a "Categorizza ora" link and an X to dismiss; it is absent when there are no uncategorized expenses
  2. Dismissing the nudge persists in localStorage; it reappears when new uncategorized expenses arrive (lastSeenCount comparison), never written to the database
  3. User can filter chart bars by income type (recurring / extraordinary) and expense nature (essential, discretionary, operational, financial, debt, extraordinary) via chips; KPI totals remain unchanged regardless of chip state
  4. User can open a ⓘ legend popover next to the Entrate and Uscite filter groups, and see a one-line tooltip on each filter chip

**Plans**: 3 plans (3 waves)
Plans:
**Wave 1**

- [x] 44-01-PLAN.md — Wave 0 test scaffold + pure filter-aware chart reduction helpers (overview-chart-utils.ts) — FILT-01..03 unit coverage

**Wave 2** *(blocked on Wave 1)*

- [x] 44-02-PLAN.md — OverviewNudge inline amber title-row nudge + localStorage lastSeenCount dismissal + page wiring — NUDGE-01..04

**Wave 3** *(blocked on Wave 2)*

- [x] 44-03-PLAN.md — OverviewChartFilters chips + ⓘ popovers + per-chip tooltips; filter-aware OverviewChart — FILT-01..03, EDU-01..02

**UI hint**: yes

### Phase 45: overview-movers

**Goal**: Users can click any month's bar to see that month's top spending movers versus the previous month
**Depends on**: Phase 44
**Requirements**: MOVE-01, MOVE-02, MOVE-03, MOVE-04, MOVE-05
**Success Criteria** (what must be TRUE):

  1. Clicking a month's bar highlights those bars visually and opens the movers panel for that month
  2. The movers panel shows "Dove hai speso di più" (increases, red) and "Dove hai risparmiato" (decreases, green) as separate sections; an empty section is hidden
  3. Each mover reads as a human sentence — "{categoria} · {importo} in più / in meno" — with "spesa nuova" when the previous month had no spend in that category; no percentages shown
  4. The panel defaults to the last month that has transactions on initial load
  5. Selecting the first available month shows an empty state (no prior month to compare)

**Plans**: 3 plans (3 waves)
Plans:
**Wave 1**

- [x] 45-01-PLAN.md — fetchMovers server action (verifySession + bounded inputs) + pure formatMoverLine/splitMovers humanizers with Vitest coverage (MOVE-03)

**Wave 2** *(blocked on Wave 1)*

- [x] 45-02-PLAN.md — Controlled OverviewChart (D-06 highlight both bars) + OverviewMoversSection shared-state parent + OverviewMoversPanel + page deriveDefaultMonthIndex/prefetch (MOVE-01, MOVE-02, MOVE-04, MOVE-05)

**Wave 3** *(blocked on Wave 2)*

- [x] 45-03-PLAN.md — Build/test/language gate + human-verify drill-down end-to-end (MOVE-01..MOVE-05)

**UI hint**: yes

---

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1–23 | M001–M006 | 87/87 | Complete | 2026-05 |
| 24–28 | M007 | 20/20 | Complete | 2026-05-19 |
| 29 | v1.8/M008 | 4/4 | Complete | 2026-05-20 |
| 30 | v1.9 | 3/3 | Complete | 2026-05-21 |
| 31 | v1.9 | 3/3 | Complete | 2026-05-21 |
| 32 | v1.9 | 3/3 | Complete | 2026-05-22 |
| 33 | v1.10 | 1/1 | Complete | 2026-05-22 |
| 34 | v1.10 | 2/2 | Complete | 2026-05-23 |
| 35 | v1.10 | 4/4 | Complete | 2026-05-23 |
| 36 | v1.10 | 2/2 | Complete | 2026-05-23 |
| 37 | v1.11 | 5/5 | Complete | 2026-05-26 |
| 38 | v1.12 | 3/3 | Complete | 2026-05-28 |
| 39 | v1.13 | 6/6 | Complete | 2026-06-02 |
| 40 | v1.14 | 5/5 | Complete | 2026-06-04 |
| 41 | v1.15 | 3/3 | Complete | 2026-06-07 |
| 42 | v1.16 | 3/3 | Complete    | 2026-06-08 |
| 43 | v1.16 | 4/4 | Complete   | 2026-06-08 |
| 44 | v1.16 | 3/3 | Complete   | 2026-06-08 |
| 45 | v1.16 | 3/3 | Complete    | 2026-06-09 |

**Total shipped: 38 phases · 146 plans complete**
