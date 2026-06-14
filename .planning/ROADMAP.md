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
- ✅ **v1.16: Dashboard Overview Redesign** — Phases 42–45 (shipped 2026-06-09)
- ✅ **v2.0: Nature/Direction Model Realignment** — Phases 46–50 (shipped 2026-06-14)

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

Full details: `.planning/milestones/v1.14-ROADMAP.md`

</details>

<details>
<summary>✅ v1.15: Collapsible Sidebar (Phase 41) — SHIPPED 2026-06-07</summary>

- [x] **Phase 41: collapsible-sidebar** — Collapsible icon-rail sidebar; topbar removed on all breakpoints; app name + user controls (avatar, profile, logout) in sidebar; BottomNav gains Impostazioni entry; theme toggle moved to /settings page (ADR 0011) *(complete 2026-06-07)*

Full details: `.planning/milestones/v1.15-ROADMAP.md`

</details>

<details>
<summary>✅ v1.16: Dashboard Overview Redesign (Phases 42–45) — SHIPPED 2026-06-09</summary>

- [x] **Phase 42: overview-data-layer** — DAL foundation: getOverview, getMonthOverMonthCategoryChanges, getYearsWithData, income-split resolution, CONTEXT.md glossary update (completed 2026-06-08)
- [x] **Phase 43: overview-shell** — Redesigned overview tab: header H1 + year selector, hero chart variant A (grouped bars, always-on labels), 4 KPI cards with qualitative reading lines (completed 2026-06-08)
- [x] **Phase 44: overview-interactions** — Uncategorized nudge (inline amber, localStorage dismiss), chart filter chips (income type + expense nature), FlowNature ⓘ education popovers (completed 2026-06-08)
- [x] **Phase 45: overview-movers** — Per-month movers drill-down: recharts bar click → top movers panel, humanized copy, highlighted bar, default to last month with data (3 plans, 3 waves) (completed 2026-06-09)

Full details: `.planning/milestones/v1.16-ROADMAP.md`

</details>

<details>
<summary>✅ v2.0: Nature/Direction Model Realignment (Phases 46–50) — SHIPPED 2026-06-14</summary>

- [x] Phase 46: direction-nature-schema — direction/nature lookup tables; removed category.type, flow_nature, amount_sign (completed 2026-06-11)
- [x] Phase 47: taxonomy-seed-rework — 23-category / 87-subcategory taxonomy on the nature model (completed 2026-06-11)
- [x] Phase 48: sql-migration-recategorization — migration 0018 applied + data recategorization + verify assertions (completed 2026-06-12)
- [x] Phase 49: dashboard-and-surfaces — 4-direction dashboard, algebraic-sum aggregation, cascade/filters re-pointed (completed 2026-06-13)
- [x] Phase 50: transaction-pairing — explicit 1:1 order↔refund linking + netting + picker/badge/popover UI (completed 2026-06-14)

Full detail archived in milestones/v2.0-ROADMAP.md.

</details>

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
| 42 | v1.16 | 3/3 | Complete | 2026-06-08 |
| 43 | v1.16 | 4/4 | Complete | 2026-06-08 |
| 44 | v1.16 | 3/3 | Complete | 2026-06-08 |
| 45 | v1.16 | 3/3 | Complete | 2026-06-09 |
| 46–50 | v2.0 | 22/22 | Complete | 2026-06-14 |

**Total shipped: 50 phases · 186 plans complete**
