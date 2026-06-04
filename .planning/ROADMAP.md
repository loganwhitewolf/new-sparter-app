# Roadmap

## Milestones

- ✅ **M001–M006** — Foundation → Dashboard Insight Suite (Phases 1–23, shipped ~2026-05)
- ✅ **M007: Zero-cost Production Deploy** — Phases 24–28 (shipped 2026-05-19)
- ✅ **v1.8 / M008: Dashboard Intelligence** — Phase 29 (shipped 2026-05-20)
- ✅ **v1.9: Social Auth** — Phases 30–32 (shipped 2026-05-22)
- ✅ **v1.10: Pattern Suggestions** — Phases 33–36 (shipped 2026-05-25)
- ✅ **v1.12: First-import Onboarding** — Phase 38 (shipped 2026-05-28)
- ✅ **v1.13: Unified Categorization Picker** — Phase 39 (shipped 2026-06-02)
- 🚧 **v1.14: Unified Table Filter & Sort** — Phase 40 (in progress)

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
| 39 | v1.13 | 6/6 | Complete    | 2026-06-02 |

| 40 | v1.14 | 1/5 | Executing | — |

**Total: 38 phases shipped · 144 plans complete**

<details>
<summary>🚧 v1.14: Unified Table Filter & Sort (Phase 40) — IN PROGRESS</summary>

- [ ] **Phase 40: table-filter-sort** — Unified filtering + sorting across Transactions, Expenses, Files tables; shared `DataTableToolbar`; month-multi picker; `id` sort tiebreaker; per-table declarative config (ADR 0009, ADR 0010)
  - Goal: Replace the three divergent table controls with one coherent system — same behaviour, same UI shape, only the declared fields differ per table.
  - Depends on: Phase 39
  - Constraints: No filter engine (ADR 0010); URL = single source of truth; server-side filtering; offset+infinite-scroll pagination unchanged; `id` tiebreaker on all DAL sorts; Expenses have NO temporal filter (ADR 0009).
  - Plans: 5 plans (5 waves)

Plans:
- [x] 40-01-PLAN.md — Foundation: shared TableConfig types + URL param parsers + id tiebreaker on transactions/imports DAL *(complete 2026-06-04)*
- [ ] 40-02-PLAN.md — Shared UI: DataTableToolbar + HeaderSortButton + ChipsRow + URL-mutation hook (mock config)
- [ ] 40-03-PLAN.md — New controls: getMonthsWithData DAL + MonthMultiPicker + AmountRangePicker, wired into toolbar
- [ ] 40-04-PLAN.md — Wire per-table configs + DAL filters for Transactions, Expenses, Files
- [ ] 40-05-PLAN.md — Polish: empty states, a11y pass, URL migration, prototype deletion, yarn build green

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
