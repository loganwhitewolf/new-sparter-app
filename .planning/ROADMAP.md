# Roadmap

## Milestones

- ✅ **M001–M006** — Foundation → Dashboard Insight Suite (Phases 1–23, shipped ~2026-05)
- ✅ **M007: Zero-cost Production Deploy** — Phases 24–28 (shipped 2026-05-19)
- ✅ **v1.8 / M008: Dashboard Intelligence** — Phase 29 (shipped 2026-05-20)
- ✅ **v1.9: Social Auth** — Phases 30–32 (shipped 2026-05-22)
- ✅ **v1.10: Pattern Suggestions** — Phases 33–36 (shipped 2026-05-25)
- ✅ **v1.12: First-import Onboarding** — Phase 38 (shipped 2026-05-28)
- 🔜 **v1.13: Unified Categorization Picker** — Phase 39 (planned)

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
| 39 | v1.13 | –/– | Pending | – |

**Total: 38 phases shipped · 137 plans complete**

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

---

## ✅ v1.12: First-import Onboarding (Phase 38) — SHIPPED 2026-05-28

### Phase 38: first-import-onboarding

**Goal:** New users with zero transactions see a dedicated 5-step onboarding flow instead of an empty dashboard. The flow guides them through upload → overview → categorization education → manual categorization wizard → outro. A hard routing gate (per D-11, implemented in the `app/(app)` RSC layout — NOT in `proxy.ts` because Drizzle cannot run in the Edge runtime) redirects all authenticated routes to `/onboarding` while `count(transaction) === 0`.
**Status:** Complete
**Depends on:** Phase 11–16 (Import), Phase 37 (FlowNature — nature badge in categorization)

**Requirements:**

- R-OB-01 ✓: Routing gate redirects any authenticated route with 0 transactions to `/onboarding` (except `/onboarding` itself and `/settings`); implemented in `app/(app)/layout.tsx` RSC per D-11, proxy.ts stays session-only
- R-OB-02 ✓: `getTransactionCount(userId)` DAL function used by the layout guard
- R-OB-03 ✓: `/onboarding` route group with step state (URL-driven: `?step=1..5`)
- R-OB-04 ✓: Step 1 — Upload: single-file drop-zone, platform auto-detected; if not detected, `import-format-wizard` creates private platform
- R-OB-05 ✓: Step 2 — Overview: N transactions, income total, expenses total, months covered (derived label), % auto-categorized
- R-OB-06 ✓: Step 3 — Categorization education: contextual tip about transfers/giroconto excluded from totals
- R-OB-07 ✓: Step 4 — Manual categorization wizard: top 15 uncategorized expenses by `|totalAmount| DESC`, shadcn Combobox with FlowNature badge per subcategory, "Categorize the rest later" global skip CTA
- R-OB-08 ✓: Step 5 — Outro: "Vai alla dashboard" CTA → `/dashboard`, "Personalizza categorie" CTA → `/settings/categories`
- R-OB-09 ✓: Full-screen hero design (Variant B) — dark bg Steps 1–3+5, light bg Step 4; progress dots + step label in header
- R-OB-10 ✓: Month label derived on-the-fly from transaction dates (no stored field); date-range filter on `/import` uses `referenceStartedAt`/`referenceEndedAt`
- R-OB-11 ✓: Prototype files deleted after first merge (`app/(app)/prototype/onboarding/`)

**Plans:** 3/3 plans complete

**Wave 1**

- [x] 38-01-PLAN.md — DAL foundation + RSC layout guard: `getTransactionCount`, `getTopUncategorizedExpenses`, `getFileCoveredMonths`, `formatMonthRange`, `APP_ROUTES.onboarding`, async `app/(app)/layout.tsx` redirect guard, `proxy.ts` forwards `x-pathname` (R-OB-01, R-OB-02, R-OB-10)

**Wave 2**

- [x] 38-02-PLAN.md — Onboarding route group + Steps 1–3: `/onboarding` page with Zod step parser, `OnboardingShell` + `ProgressDots`, Step 1 upload (reuses R2 presigned PUT + analyze/confirm actions), Step 2 overview RSC (real data + `formatMonthRange`), Step 3 education with giroconto tip, design-system tokens only (R-OB-03, R-OB-04, R-OB-05, R-OB-06, R-OB-09, R-OB-10)

**Wave 3**

- [x] 38-03-PLAN.md — Step 4 categorization wizard (shadcn Combobox + FlowNature badges) + `onboardingCategorizeExpense` action + Step 5 outro + prototype deletion + `yarn build` E2E gate (R-OB-07, R-OB-08, R-OB-09, R-OB-11)

---

## 🔜 v1.13: Unified Categorization Picker (Phase 39) — PLANNED

### Phase 39: unified-subcategory-picker

**Goal:** Replace the three divergent subcategory-selection implementations (searchable `CategoryCombobox`, the onboarding `SubcategoryCombobox`, and the cascading `Select` pairs) with ONE reusable picker — winning prototype variant E: a fixed-height bottom sheet (via `vaul`) with type chips (Entrate/Uscite/Trasferimenti, preselected from the row's amount sign) and a two-column master-detail (left: "Più usate" + categories of the active type; right: subcategories as tiles). Adopt it across all 7 selection surfaces, add the "most used" DAL query, and rework the pattern-creation form to regex + description + a "Categorizza" button (deriving `amountSign` from the chosen subcategory's category type, confidence hardcoded to 1, per ADR 0008). Delete the prototype route on merge.

**Status:** Pending
**Depends on:** Phase 37 (FlowNature — `effectiveNature` on `CategoryWithSubCategories`), Phase 35 (pattern promotion UI), Phase 38 (onboarding categorization)
**Design contract:** `app/(app)/prototype/subcategory-picker/NOTES.md` (10 locked decisions + variant E verdict), ADR `docs/adr/0008-pattern-amount-sign-derived-from-subcategory.md`, `CONTEXT.md` (Categorization)

**Requirements:**

- R-UP-01: One shared subcategory picker component (variant E) — fixed-height bottom sheet on all viewports via `vaul`; output is always a single `subCategoryId`; subcategory selection mandatory.
- R-UP-02: Type chips (Entrate/Uscite/Trasferimenti) as the sole coarse filter, preselected from the row's amount sign, overridable; `system` excluded from chips (searchable under "Tutte").
- R-UP-03: Two-column master-detail — left rail = "Più usate" (always available) + categories of active type; right pane = subcategories as tiles; free-text search collapses to a flat list; mobile drills left→right with back.
- R-UP-04: "Most used" DAL query — top ~6 subcategories by per-user categorization count, scoped to allowed category types, hidden when empty (cold-start / onboarding), global per user.
- R-UP-05: Adopt the picker in all 7 surfaces — categorize expense, categorize transaction, onboarding, bulk categorize, create/edit expense form, create/edit transaction form, create pattern.
- R-UP-06: Interaction contract — tap = select + close + return value; single/transaction/onboarding/bulk commit immediately; form surfaces fill the field; bulk applies to all selected on one tap.
- R-UP-07: Pattern-creation form reduced to regex + description + "Categorizza" button; `confidence` hardcoded to 1 (removed from form); `amountSign` derived from the chosen subcategory's category type (`out→negative`, `in→positive`, `transfer`/`system→any`) — same for suggestion promotion. Per ADR 0008.
- R-UP-08: `vaul` added; bottom sheet has stable height (no resize on type switch / filter) — only inner lists scroll.
- R-UP-09: Old pickers removed (`CategoryCombobox`, onboarding `SubcategoryCombobox`, cascading `Select` pairs) once all surfaces migrated; no duplicate selection UX remains.
- R-UP-10: Prototype route deleted on merge (`app/(app)/prototype/subcategory-picker/`); `yarn build` + `yarn check:language` green.

**Plans:** 6 plans

**Wave 1**

- [ ] 39-01-PLAN.md — Foundation: `vaul` + shadcn `Drawer` primitive, `getMostUsedSubcategories` DAL query, extract `buildCategoryOptions`/`filterCategoryOptions` to `lib/categorization/subcategory-options.ts` (R-UP-04, R-UP-08)

**Wave 2**

- [ ] 39-02-PLAN.md — Build the shared `SubcategoryPicker` (variant E over `vaul`): fixed-height bottom sheet, type chips, two-column master-detail, search-collapse, single-`subCategoryId` output (R-UP-01, R-UP-02, R-UP-03, R-UP-08)

**Wave 3**

- [ ] 39-03-PLAN.md — Adopt picker in the 4 commit-on-tap surfaces (single expense, transaction-table, bulk, onboarding); thread `mostUsed` through their pages (R-UP-05, R-UP-06)
- [ ] 39-05-PLAN.md — Pattern form rework: regex + description + Categorizza-via-picker; derive `amountSign` server-side from category type, hardcode `confidence=1` (R-UP-07)

**Wave 4**

- [ ] 39-04-PLAN.md — Adopt picker in the 2 fill-field forms (create/edit expense, create transaction); remove cascading Selects (R-UP-05, R-UP-06)

**Wave 5**

- [ ] 39-06-PLAN.md — Cleanup: delete `CategoryCombobox` + old combobox/Select code + prototype route; final `yarn build` + `yarn check:language` gate (R-UP-09, R-UP-10)
