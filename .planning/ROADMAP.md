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
- 🚧 **v2.0: Nature/Direction Model Realignment** — Phases 46–50 (in progress)

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

### 🚧 v2.0: Nature/Direction Model Realignment (Phases 46–50)

**Milestone Goal:** Replace the dual-axis `category.type` + `nature` classification with a single nature→direction model backed by lookup tables, migrate and recategorize all existing data, and add explicit transaction pairing on top of the implicit netting. Design is LOCKED; contract lives in `docs/adr/0012`, `CONTEXT.md`, and `.planning/nature-remapping-WORKING.md`.

- [x] **Phase 46: direction-nature-schema** — `direction` (4 rows) + `nature` (9 rows) lookup tables; `sub_category.nature_id` FK; remove `category.type`, `flow_nature` enum, `amount_sign`, `exclude_from_totals` — full schema cleanup (completed 2026-06-11)
- [x] **Phase 47: taxonomy-seed-rework** — New 23-category / ~65-subcategory taxonomy in `seed-data.ts`; `seed-extras.ts` additive steps to populate `nature_id` and `direction_id` on existing rows (completed 2026-06-11)
- [ ] **Phase 48: sql-migration-recategorization** — Generated SQL migration (drizzle-kit generate + scripts/migrate.ts); backfill `nature_id` on all subcategories and overrides; recategorize misclassified transactions; convert patterns to sign-agnostic
- [ ] **Phase 49: dashboard-and-surfaces** — 4-direction dashboard view (IN/OUT/ALLOCATION block, TRANSFER hidden); algebraic-sum aggregation replacing sign-split logic everywhere; `cascade-options.ts` and table filters re-pointed to the new model
- [x] **Phase 50: transaction-pairing** — Explicit 1:1 transaction↔opposite linking (order↔refund); paired display in transaction list; unlink flow; implicit netting baseline unchanged *(complete 2026-06-14)*

## Phase Details

### Phase 46: direction-nature-schema

**Goal**: The schema has `direction` and `nature` as FK-backed lookup tables, `sub_category.nature_id` replaces the `flow_nature` enum, and all deprecated columns (`category.type`, `amount_sign`, `exclude_from_totals`) are removed — establishing the single source of truth the rest of the milestone builds on.
**Depends on**: Phase 45
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06
**Success Criteria** (what must be TRUE):

  1. A `direction` table with 4 rows (`in`, `out`, `allocation`, `transfer`) exists with analytical attributes including `included_in_totals`, `net_worth_effect`, `color`, `label_it`
  2. A `nature` table with 9 rows exists, each carrying a `direction_id` FK and the attributes from ADR 0012 (`income`, `income_extraordinary`, `essential`, `discretionary`, `debt`, `transfer`, `savings`, `investment`, plus the 9th row resolved from the planning risk)
  3. `sub_category.nature_id` and `user_subcategory_override.nature_id` are FK columns to `nature`; the `flow_nature` enum column is gone
  4. `category.type` column, `category_type` enum, and `category_type_idx` index are absent from the schema
  5. `categorization_pattern.amount_sign` and the `amount_sign` enum are absent; the unique constraint is `(pattern, subCategoryId)`
  6. `sub_category.exclude_from_totals` is absent from the schema

**Plans**: TBD

_Planning risk: resolve the 8-vs-9 nature row count (ADR 0012 "Consequences" says 8; the data-model section and working-doc summary say 9) before building the `nature` table. Determine whether a 9th row such as an `uncategorized`/null-sentinel nature is intended or the "9" references are stale._

### Phase 47: taxonomy-seed-rework

**Goal**: The seeded taxonomy reflects the final remap from `.planning/nature-remapping-WORKING.md` — 23 categories, ~65 subcategories across all 4 directions — and the additive seed machinery is in place so existing deployed rows can be brought up to date without overwriting shipped seed shapes.
**Depends on**: Phase 46
**Requirements**: TAX-01, TAX-02, TAX-03
**Success Criteria** (what must be TRUE):

  1. `scripts/seed-data.ts` contains 23 categories and ~65 subcategories matching the working-doc remap (4 IN, 16 OUT, 2 ALLOCATION, 1 TRANSFER)
  2. Dissolved categories (`operational` nature, `Famiglia`, `Assicurazioni`, `Abbonamenti` wrappers) are gone from the seed; `financial`→`investment` and `extraordinary`→`savings` renames are applied
  3. `scripts/seed-extras.ts` gains an additive step (or steps) that populates `nature_id` on all existing `sub_category` and `user_subcategory_override` rows using slug-based lookups — no edits to previously shipped seed shapes
  4. Running `yarn db:seed` followed by `yarn db:seed-extras` on a fresh schema produces a fully populated taxonomy with every subcategory assigned a `nature_id`

**Plans**: 5 plans
Plans:
**Wave 1**

- [x] 47-01-PLAN.md — Wave 0: RED Vitest taxonomy contract + v2 slug manifest fixture
- [x] 47-02-PLAN.md — Wave 1: wholesale replace categories/subCategories with natureId (seed-data v2)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 47-03-PLAN.md — Wave 2: sign-agnostic categorizationPatterns retarget + seed.ts wiring

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 47-04-PLAN.md — Wave 3: seed-extras step 1 no-op + STEPS 6+ remap/backfill

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 47-05-PLAN.md — Wave 4: enable R-FN-03 tests + full test/build gate

### Phase 48: sql-migration-recategorization

**Goal**: A generated SQL migration safely transforms the live database — creating the new tables, backfilling all FKs, recategorizing misclassified transactions to their correct nature, and removing deprecated columns — leaving no orphaned data and no references to the removed schema objects.
**Depends on**: Phase 47
**Requirements**: MIG-01, MIG-02, MIG-03
**Success Criteria** (what must be TRUE):

  1. `yarn db:migrate` runs to completion with no errors; the migration was generated by `drizzle-kit generate` (never `drizzle-kit push`)
  2. Every existing `sub_category` row has a non-null `nature_id` FK after the migration; no subcategory is left pointing at the removed `flow_nature` enum column
  3. Transactions previously misclassified (e.g. `vendita-investimenti` incorrectly under `in`) now carry a subcategory whose nature maps to the correct direction (`allocation`)
  4. All `categorization_pattern` rows are sign-agnostic after migration: no row has a non-null `amount_sign`; the unique constraint is `(pattern, subCategoryId)`; existing patterns still target the correct subcategory

**Plans**: 3 plans
Plans:
**Wave 1**

- [x] 48-01-PLAN.md — Generate + review/patch 0018 v2 schema migration (lookup tables, nature_id FKs, drop deprecated objects, sign-agnostic pattern constraint); remove D-16 stale guard
- [x] 48-02-PLAN.md — verify-migration.ts D-04 + MIG-03 assertion harness + db:verify scripts

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 48-03-PLAN.md — MIGRATION-RUNBOOK.md (pg_dump, staging-first gate, rollback) + guarded staging→production apply checkpoints

### Phase 49: dashboard-and-surfaces

**Goal**: Every consumer of the old type/nature model — dashboard, KPI cards, aggregation queries, cascade options, and table filters — has been rewritten to derive direction from the `nature → direction` FK chain and to use algebraic-sum aggregation, making the 4-direction view fully functional for the user.
**Depends on**: Phase 48
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, CAT-01, CAT-02
**Success Criteria** (what must be TRUE):

  1. The dashboard shows IN and OUT totals alongside a visible ALLOCATION block ("Accantonato / Investito"); TRANSFER is excluded and hidden
  2. KPI cards reflect the 4-direction model: spending totals exclude allocation and transfer; an allocation measure ("quanto ho accantonato/investito") is surfaced
  3. A transaction with a `+` amount under an OUT subcategory (e.g. a refund/reso) appears with its real positive amount in the transaction list and nets correctly within the OUT segment in the chart and KPIs
  4. `cascade-options.ts` and the subcategory picker derive their type chip options from the `nature → direction` FK; no reference to `category.type` remains
  5. Direction and nature filters in the Transactions and Expenses tables remain functional, now operating on the lookup-table-backed values

**Plans**: 6 plans
Plans:
**Wave 0** *(test-first)*

- [x] 49-01-PLAN.md — RED money-correctness tests (algebraic-sum netting, allocation bucket, transfer exclusion, savings rate) + cascade-options direction-keying contract *(complete 2026-06-12)*

**Wave 1** *(DAL foundation — parallel, disjoint files)*

- [x] 49-02-PLAN.md — Direction-grouped algebraic-sum rewrite in dashboard.ts/overview.ts; totalAllocation; OverviewChartPoint reshape; direction-aware movers + fetchMovers
- [x] 49-03-PLAN.md — Restore category type from direction join (categories.ts); transactions/expenses filters type→direction; subcategory-usage/patterns stubs

**Wave 2** *(UI surfaces — parallel, disjoint files; blocked on Wave 1)*

- [x] 49-04-PLAN.md — 3rd Accantonato bar + 5th KPI card + 3-column movers panel + allocation CSS tokens (depends 49-02)
- [x] 49-05-PLAN.md — cascade-options buildDirectionNatureMap; 4th direction chip; table direction filters; settings grouping; nature write-path fix (depends 49-03)

**Wave 3** *(schema migration — blocked on Waves 1+2)*

- [ ] 49-06-PLAN.md — [BLOCKING] drop sub_category.exclude_from_totals; generated migration + operator-guarded apply (depends 49-02, 49-03)

**UI hint**: yes

### Phase 50: transaction-pairing

**Goal**: A user can explicitly link two transactions that cancel each other (order↔refund, expense↔reimbursement), see the pairing and its netting effect in the transaction list, and unlink them — without changing the implicit algebraic-sum baseline behaviour for unpaired transactions.
**Depends on**: Phase 49
**Requirements**: PAIR-01, PAIR-02, PAIR-03
**Success Criteria** (what must be TRUE):

  1. A user can open a transaction and link it to another transaction as its explicit opposite; the link is persisted as a 1:1 (or 1:N) relationship
  2. Paired transactions have a dedicated visual indicator in the transaction list that shows both the link and the net amount effect
  3. A user can remove an explicit pairing; after unlinking, both transactions behave identically to never-paired transactions (algebraic-sum netting only)

**Plans**: 5 plans
Plans:
**Wave 0** *(test-first)*

- [x] 50-01-PLAN.md — RED test scaffolds: service ownership/primary/double-link, picker filter, dashboard netting, list select-shape (Nyquist Dimension 8)

**Wave 1** *(data foundation)*

- [x] 50-02-PLAN.md — [BLOCKING] transaction_pair table + relations + generated/applied 0020 migration + shared isNotSecondary()/effectiveAmount() helpers

**Wave 2** *(backend + DAL — parallel, disjoint files; blocked on Wave 1)*

- [x] 50-03-PLAN.md — Validations + ownership-validating service + thin actions + verifySession-scoped counterpart-picker DAL
- [x] 50-04-PLAN.md — Netting across 8 aggregation sites (dashboard.ts ×6, overview.ts ×2) + pairedWith/pairedNet fields on transactionListSelect

**Wave 3** *(UI; blocked on Wave 2)*

- [x] 50-05-PLAN.md — CounterpartPickerDialog + pair badge/popover + Collega/Scollega row actions + page wiring (operator checkpoint) *(complete 2026-06-14)*

**UI hint**: yes

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
| 46 | v2.0 | 3/3 | Complete   | 2026-06-11 |
| 47 | v2.0 | 5/5 | Complete    | 2026-06-11 |
| 48 | v2.0 | 2/3 | In Progress|  |
| 49 | v2.0 | 2/6 | In Progress|  |
| 50 | v2.0 | 5/5 | Complete   | 2026-06-14 |

**Total shipped: 46 phases · 164 plans complete**
