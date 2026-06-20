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
- 🚧 **v2.1: Regex Discovery & Transaction Unification** — Phases 51–55 (in planning)

## Phases

### v2.1 — Regex Discovery & Transaction Unification

- [x] **Phase 51: discovery-pipeline-reorder** — Move regex discovery downstream of auto-categorization into a standalone service operating on the uncategorized set only *(complete 2026-06-16, 3/3 plans)*
- [x] **Phase 52: regex-validity-and-dedup** — Correct regex vs single-categorization distinction; skip candidates already covered by existing patterns or manual categories (completed 2026-06-16)
- [x] **Phase 53: retroactive-application** — Apply a created regex to existing uncategorized data; resolve and implement the current-file-vs-platform-history scope *(complete 2026-06-16, 3/3 plans)*
- [ ] **Phase 54: reusable-trigger** — Same discovery service invoked automatically post-import and on-demand from the Files table
- [ ] **Phase 55: import-summary-ux** — Capped example list and visual separation of proposed regex vs single-categorization suggestions, with the new-step messaging

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

</details>

<details>
<summary>✅ v1.12: First-import Onboarding (Phase 38) — SHIPPED 2026-05-28</summary>

- [x] Phase 38: first-import-onboarding — 5-step guided flow; RSC layout routing gate; categorization wizard with nature badges *(complete 2026-05-28)*

</details>

<details>
<summary>✅ v1.13: Unified Categorization Picker (Phase 39) — SHIPPED 2026-06-02</summary>

- [x] Phase 39: unified-subcategory-picker — Single `SubcategoryPicker` (vaul bottom sheet) across all 7 surfaces; pattern form rework; `amountSign` derived server-side per ADR 0008 *(complete 2026-06-02)*

Full details: `.planning/milestones/v1.13-ROADMAP.md`

</details>

<details>
<summary>✅ v1.14: Unified Table Filter & Sort (Phase 40) — SHIPPED 2026-06-04</summary>

- [x] **Phase 40: table-filter-sort** — Unified filtering + sorting across Transactions, Expenses, Files tables; shared `DataTableToolbar`; month-multi picker; `id` sort tiebreaker; per-table declarative config (ADR 0009, ADR 0010) *(complete 2026-06-04)*

Full details: `.planning/milestones/v1.14-ROADMAP.md`

</details>

<details>
<summary>✅ v1.15: Collapsible Sidebar (Phase 41) — SHIPPED 2026-06-07</summary>

- [x] **Phase 41: collapsible-sidebar** — Collapsible icon-rail sidebar; topbar removed; app name + user controls in sidebar; BottomNav Impostazioni entry; theme toggle in /settings (ADR 0011) *(complete 2026-06-07)*

Full details: `.planning/milestones/v1.15-ROADMAP.md`

</details>

<details>
<summary>✅ v1.16: Dashboard Overview Redesign (Phases 42–45) — SHIPPED 2026-06-09</summary>

- [x] **Phase 42: overview-data-layer** — DAL foundation: getOverview, getMonthOverMonthCategoryChanges, getYearsWithData, income-split resolution (completed 2026-06-08)
- [x] **Phase 43: overview-shell** — Redesigned overview tab: header + year selector, hero chart variant A, 4 KPI cards with reading lines (completed 2026-06-08)
- [x] **Phase 44: overview-interactions** — Uncategorized nudge, chart filter chips, FlowNature ⓘ education popovers (completed 2026-06-08)
- [x] **Phase 45: overview-movers** — Per-month movers drill-down: bar click → top movers panel, humanized copy, default last month with data (completed 2026-06-09)

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

## Phase Details

### Phase 51: discovery-pipeline-reorder

**Goal**: Regex discovery runs as a distinct step downstream of auto-categorization, looking only at what categorization could not handle, and lives in a service that does not depend on an in-progress import.
**Depends on**: Nothing new (builds on shipped v1.10 pipeline + v2.0 model)
**Requirements**: PIPE-01, PIPE-02, PIPE-03
**Success Criteria** (what must be TRUE):

  1. After an import is analyzed/committed, transactions that auto-categorization already classified (Set A) never appear as discovery input — only the still-uncategorized residual (Set B) is examined.
  2. Discovery can be invoked as a standalone service against a user's persisted uncategorized transactions without an import being in progress (no longer wired inside `analyzeFile`'s pre-categorization path).
  3. Platform-specific normalization (e.g. Fineco `descriptionStripPattern`) is applied to descriptions before discovery runs, and the service can report what normalization already collapsed versus what residual-variable text remains for the regex step to handle.
  4. The Fineco DoD input ("Bonifico Andrea Bernardini causale stipendio …") reaches the discovery step as normalized, uncategorized text — i.e. it survives categorization as Set B and is fed to discovery, not silently dropped.**Plans**: 3 plans (2 waves)

**Wave 1**

- [x] 51-01-PLAN.md — Extend pattern-suggestions util with detectPatternSuggestionsWithMeta + D-05 metadata (PIPE-03) *(complete 2026-06-16, commits 11d1f9f + af5f078)*
- [x] 51-02-PLAN.md — New DAL query getUncategorizedExpensesForDiscovery: Set B by user + platform (PIPE-01) *(complete 2026-06-16, commits 953d15a + 6dc63da)*

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 51-03-PLAN.md — Standalone discoverRegexCandidates service (strip → normalize → cluster) + Fineco DoD anchor; legacy analyzeFile call annotated (PIPE-01/02/03, SC-4) *(complete 2026-06-16, commits 676a37c + 60b5479 + d169fa8)*

### Phase 52: regex-validity-and-dedup

**Goal**: The discovery service proposes a regex only for genuine prefix+variable families, surfaces identical-after-normalization groups as single categorizations instead, and never re-proposes something already covered.
**Depends on**: Phase 51
**Requirements**: RDISC-01, RDISC-02, RDISC-03, RDISC-04
**Success Criteria** (what must be TRUE):

  1. Fineco "Bonifico Andrea Bernardini causale stipendio marzo/maggio/giugno" (≥2 transactions sharing a prefix but differing in a residual variable part) produces exactly one proposed regex. *(DoD test case 1)*
  2. Repeated identical "Macellaio" transactions (identical after normalization) are surfaced as a single-categorization suggestion, with no regex proposed for them. *(DoD test case 2)*
  3. A candidate whose generated regex would already be matched/covered by an existing pattern in the regex table is skipped and not shown (Check 1).
  4. A candidate is skipped when that transaction type is already covered by an existing manual categorization for the same `descriptionHash` (Check 2).

**Plans**: 3 plans (2 waves)

**Wave 1**

- [x] 52-01-PLAN.md — Pure util: `descriptionHashes` passthrough + `candidateCoveredByExistingPattern` (Check 1 helper, RDISC-03)
- [x] 52-02-PLAN.md — DAL: `getManuallyCategorizedHashes` manual-history query (Check 2 data source, RDISC-04)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 52-03-PLAN.md — Service: residual split + Check 1/Check 2 wiring + two-list `DiscoveryResult` (RDISC-01/02/03/04, both DoD cases)

### Phase 53: retroactive-application

**Goal**: A regex created during discovery immediately categorizes existing uncategorized transactions, with the retroactive scope resolved and enforced.
**Depends on**: Phase 52
**Requirements**: APPLY-01, APPLY-02
**Success Criteria** (what must be TRUE):

  1. When the user promotes a discovered candidate into a regex, the uncategorized transactions of the current file that match it become categorized without a re-import.
  2. Retroactive application honors the resolved scope decision (current file only vs the platform's entire uncategorized history); whichever scope is chosen, the user can observe exactly which existing transactions were (and were not) re-categorized.
  3. Applying a regex never re-touches already-categorized transactions (Set A) and never crosses into another platform's history when the resolved scope is platform-bounded.

**Plans**: 3 plans
Plans:
**Wave 1**

- [x] 53-01-PLAN.md — Platform-scoped DAL + applyNewPatternToPlatformExpenses with structured counts (APPLY-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 53-02-PLAN.md — promoteSuggestionAction integration: fileId → platform resolve, ActionState.applyResult (APPLY-01/02)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 53-03-PLAN.md — Suggestions UI: fileId threading, inline card apply counts (ROADMAP SC-2)

### Phase 54: reusable-trigger

**Goal**: One discovery service is reachable from two entry points — automatically after every import and on demand from the Files table.
**Depends on**: Phase 53
**Requirements**: TRIG-01, TRIG-02
**Success Criteria** (what must be TRUE):

  1. After an import completes, discovery runs automatically as the step following auto-categorization, producing the same kind of results as a manual re-run.
  2. From the Files table the user can trigger a "ricontrolla regex" re-check that invokes the same underlying discovery service (no parallel/divergent implementation), via whichever UX (per-row or bulk) is resolved in discuss/plan.
  3. An on-demand re-check produces results consistent with the automatic post-import run for the same uncategorized set (same service → same candidates, modulo data changed since import).

**Plans**: 3 plans
**Wave 1**

- [ ] 54-01-PLAN.md — Migrate the suggestions page to the unified discoverRegexCandidates service (D-04, foundation; fixes EUR-deposit anchor) [Wave 1]

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 54-02-PLAN.md — Post-commit auto-run in importFile + discoveryCount field + import-result CTA (TRIG-01) [Wave 2]
- [ ] 54-03-PLAN.md — Per-row "ricontrolla regex" action + thin server action over the unified service (TRIG-02) [Wave 2]

**UI hint**: yes

### Phase 55: import-summary-ux

**Goal**: The post-import summary is legible — a bounded set of example transactions, clearly separated proposed regex versus single-categorization suggestions, and a cue that discovery is now its own step.
**Depends on**: Phase 54
**Requirements**: SUMUI-01, SUMUI-02, SUMUI-03
**Success Criteria** (what must be TRUE):

  1. The import summary shows at most 10 example transactions (raising the prior cap of 5).
  2. Proposed regex suggestions and single-categorization suggestions are presented as visually distinct groups, so the user can tell at a glance which is which.
  3. The summary communicates that regex discovery now happens as a separate step after import (exact copy/placement resolved in discuss/plan), without misrepresenting the new flow.

**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1–23 | M001–M006 | 87/87 | Complete | 2026-05 |
| 24–28 | M007 | 20/20 | Complete | 2026-05-19 |
| 29 | v1.8/M008 | 4/4 | Complete | 2026-05-20 |
| 30–32 | v1.9 | 9/9 | Complete | 2026-05-22 |
| 33–36 | v1.10 | 9/9 | Complete | 2026-05-25 |
| 37 | v1.11 | 5/5 | Complete | 2026-05-26 |
| 38 | v1.12 | 3/3 | Complete | 2026-05-28 |
| 39 | v1.13 | 6/6 | Complete | 2026-06-02 |
| 40 | v1.14 | 5/5 | Complete | 2026-06-04 |
| 41 | v1.15 | 3/3 | Complete | 2026-06-07 |
| 42–45 | v1.16 | 13/13 | Complete | 2026-06-09 |
| 46–50 | v2.0 | 22/22 | Complete | 2026-06-14 |
| 51. discovery-pipeline-reorder | v2.1 | 3/3 | Complete | 2026-06-16 |
| 52. regex-validity-and-dedup | v2.1 | 3/3 | Complete    | 2026-06-16 |
| 53. retroactive-application | v2.1 | 2/3 | In Progress|  |
| 54. reusable-trigger | v2.1 | 0/? | Not started | - |
| 55. import-summary-ux | v2.1 | 0/? | Not started | - |

**Total shipped: 51 phases · 189 plans complete**
