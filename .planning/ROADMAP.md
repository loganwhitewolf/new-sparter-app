# Roadmap

## Milestones

- ✅ **M001–M006** — Foundation → Dashboard Insight Suite (Phases 1–23, shipped ~2026-05)
- ✅ **M007: Zero-cost Production Deploy** — Phases 24–28 (shipped 2026-05-19)
- ✅ **v1.8 / M008: Dashboard Intelligence** — Phase 29 (shipped 2026-05-20)
- ✅ **v1.9: Social Auth** — Phases 30–32 (shipped 2026-05-22)
- ✅ **v1.10: Pattern Suggestions** — Phases 33–36 (shipped 2026-05-25)

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

**Total: 37 phases shipped · 134 plans complete**

---

## ✅ v1.11: FlowNature & Segmented Chart (Phase 37) — SHIPPED 2026-05-26

### Phase 37: flow-nature-chart

**Goal:** Add `nature` enum column to `sub_category`; evolve `EntrateUsciteChart` into a stacked nature-segmented chart with URL-persisted toggles; seed system subcategories with default natures; expose nature override in `/settings/categories`.
**Status:** Complete
**Depends on:** Phase 29 (EntrateUsciteChart), Phase 35 (subcategory UI patterns)
**Requirements:** R-FN-01 ✓, R-FN-02 ✓, R-FN-03 ✓, R-FN-04 ✓, R-FN-05 ✓, R-FN-06 ✓, R-FN-07 ✓, R-FN-08 ✓, R-FN-09 ✓

- [x] **Phase 37: flow-nature-chart** — Add `nature` enum column to `sub_category`; evolve `EntrateUsciteChart` into a stacked nature-segmented chart with URL-persisted toggles; seed system subcategories with default natures; expose nature override in `/settings/categories`.

**Requirements:**

- R-FN-01 ✓: `nature` column on `sub_category` (nullable enum: `essential | discretionary | operational | financial | debt | extraordinary`)
- R-FN-02 ✓: Drizzle migration for `nature` column
- R-FN-03 ✓: System subcategories seeded with default natures in `seed-data.ts`
- R-FN-04 ✓: `EntrateUsciteChart` replaced by stacked bar chart grouped by nature (algebraic sum per nature, not sign-split)
- R-FN-05 ✓: Nature toggle via URL param `?hidden=` (comma-separated nature values); persisted across navigation
- R-FN-06 ✓: Null nature renders as "non classificato" segment in chart
- R-FN-07 ✓: Nature field exposed and editable in `/settings/categories` subcategory UI (required on creation, with preselected default)
- R-FN-08 ✓: `MonthlyTrendPoint` / DAL query updated to group by nature algebraically
- R-FN-09 ✓: `Transfer` flows (`ignore → trasferimenti`) continue to be excluded via existing `excludeFromTotals` — no new nature type needed

**Plans:** 5/5
**Wave 1**

- [x] 37-01-PLAN.md — Wave 0 test scaffolding + `lib/utils/nature-labels.ts` shared label utility (R-FN-06, R-FN-07)
- [x] 37-02-PLAN.md — Schema migration: `flowNatureEnum`, nature columns on `sub_category` + `user_subcategory_override`, drop `custom_name` NOT NULL, seed nature assignment (R-FN-01, R-FN-02, R-FN-03)

**Wave 2**

- [x] 37-03-PLAN.md — DAL: `getMonthlyTrendByNature` + `MonthlyNatureTrendPoint` + `effectiveNature` on `CategoryWithSubCategories` (R-FN-04, R-FN-05, R-FN-08, R-FN-09)

**Wave 3**

- [x] 37-04-PLAN.md — Chart rewrite: stacked nature `EntrateUsciteChart` with URL-persisted legend toggle + overview page wiring (R-FN-04, R-FN-05, R-FN-06)
- [x] 37-05-PLAN.md — Settings: nature required on creation + inline `SubcategoryNatureSelect` + `setSubcategoryNatureAction` (R-FN-07)
