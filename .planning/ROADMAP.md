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
- ✅ **v2.1: Regex Discovery & Transaction Unification** — Phases 51–55 (shipped 2026-06-22)
- ✅ **v2.2: PDF Import** — Phases 56–57 (shipped 2026-06-26) · [archive](milestones/v2.2-ROADMAP.md)
- ✅ **v2.3: Platform Identity & Format Ownership** — Phases 58–60 (shipped 2026-06-30, tag v2.3)
- ✅ **v2.4: Standalone Expense** — Phase 61 (shipped 2026-07-01) · [archive](milestones/v2.4-ROADMAP.md)
- ✅ **v2.5: Detail Pages** — Phases 62–64 (shipped 2026-07-07, tag v2.5) · [archive](milestones/v2.5-ROADMAP.md)
- ✅ **v2.6: Expenses & Transactions Refinement** — Phases 65–68 (shipped 2026-07-22, tag v2.6) · [archive](milestones/v2.6-ROADMAP.md)
- 🚧 **v2.7: Tag Dedicated View** — Phases 69–70 (in progress) — dedicated all-time per-tag page + `?tag=` dashboard-filter removal

## Phases

### v2.7: Tag Dedicated View (Phases 69–70) — IN PROGRESS

Make a dedicated per-tag page the canonical, all-time view of a tag (event-shaped),
replacing the period-scoped `?tag=` dashboard filter so a tag shows one reconciled set of
numbers everywhere. Tags are event-shaped: the canonical per-tag view is all-time (every
transaction carrying the tag, regardless of calendar) — `dateRange` is a descriptive label,
not a filter. Single numeric source `getTagDetail` / `getTagTotals` already exists in the
branch base (quick task 260722-ked absorbed); only the per-category breakdown query is new.
Layout: Variant A "report verticale" (prototype `proto/tag-view`).

- [x] **Phase 69: tag-dedicated-page** - Dedicated per-tag mini-dashboard (Variant A) with edit/archive in place and entry points from /tags and /dashboard/tags (TAG-06, TAG-07, TAG-08, TAG-09, TAG-10, TAG-11, TAG-12)
- [ ] **Phase 70: dashboard-tag-filter-removal** - Remove the period-scoped `?tag=` filter and its wiring from /dashboard/overview and /dashboard/categories (TAG-13)
- [ ] **Phase 71: transactions-tag-filter-control** - Add a tag filter control to the transactions toolbar, integrated into the unified filter/sort system (TAG-14)

### Phase 69: tag-dedicated-page

**Goal**: A dedicated per-tag page is the canonical, all-time view of a tag — a "report verticale" mini-dashboard reachable from both /tags and /dashboard/tags, showing reconciled totals, a per-category breakdown, a compact transaction list, and in-place edit/archive.
**Depends on**: Nothing (numeric foundation `getTagDetail`/`getTagTotals` already in the branch base)
**Requirements**: TAG-06, TAG-07, TAG-08, TAG-09, TAG-10, TAG-11, TAG-12
**Success Criteria** (what must be TRUE):

  1. User can open a dedicated page for a single tag from both /tags and /dashboard/tags, showing an all-time overview of every transaction carrying that tag regardless of calendar period.
  2. The page shows three totals — Entrate, Uscite, Valore finale (signed net) — that reconcile with /dashboard/tags (same netting/exclusions via `getTagDetail`/`getTagTotals`).
  3. The page shows the included-transaction count and a per-category breakdown of the tag's transactions with signed amounts (CSS bars, no charting dependency).
  4. The page shows a compact list of the included transactions (date · subcategory · signed amount) sorted by date descending.
  5. User can edit and archive the tag directly from the page.

**Plans**: 3 plans

- [x] 69-01-PLAN.md — Tracer: /tags/[id] RSC page rendering real getTagDetail (header + KPI + count + tx list) [wave 1]
- [x] 69-02-PLAN.md — Per-category breakdown: extend getTagDetail/buildTagDetailData + CSS-bar card [wave 2]
- [x] 69-03-PLAN.md — Entry points + cleanup: /tags index links, /dashboard/tags re-point, remove orphaned action, human-verify [wave 2]

**UI hint**: yes

### Phase 70: dashboard-tag-filter-removal

**Goal**: Per-tag analysis lives only in the dedicated all-time page; the period-scoped `?tag=` dashboard filter and its entire wiring are gone, and the dashboard behaves exactly as it did before the filter existed.
**Depends on**: Phase 69 (the dedicated page must exist before the dashboard filter is removed)
**Requirements**: TAG-13
**Success Criteria** (what must be TRUE):

  1. Neither /dashboard/overview nor /dashboard/categories shows a tag-filter control anymore (`TagFilterSelect` removed).
  2. A dashboard URL carrying a legacy `?tag=<id>` renders the normal all-transactions dashboard — the param is ignored, with no `no-data-for-tag` empty state and no error.
  3. Dashboard totals and category breakdowns match the pre-existing unfiltered numbers, with the filter wiring (`tagId` threading through the overview/category DAL, `parseTagIdParam`, and the `no-data-for-tag` empty state) fully removed.

**Plans**: TBD

### Phase 71: transactions-tag-filter-control

**Goal**: Users can filter the transactions table by tag from the toolbar. A tag control is integrated into the transactions' existing unified filter/sort system (persisted, chip, clear-all) and writes `?tag=`. The `?tag=` URL param, IDOR guard, and `getTransactions` `tagId` support already exist — this phase adds the missing UI control only.
**Depends on**: Nothing (independent of Phase 70 — 70 removes the dashboard tag filter, 71 adds the transactions tag filter; different surfaces, different components)
**Requirements**: TAG-14
**Success Criteria** (what must be TRUE):

  1. The transactions toolbar shows a tag filter control listing the user's tags (with a "Tutti i tag" / clear option), sitting alongside the existing filters.
  2. Selecting a tag filters the table to that tag's transactions (writes `?tag=<id>`, reusing the existing param + `getTransactions` tagId path); clearing it removes the filter.
  3. The tag filter participates in the unified filter system like the others — active-state visible (chip/label), persisted across bare navigation (sessionStorage restore layer), and reset by clear-all.
  4. Does NOT reuse the dashboard `TagFilterSelect` (removed in Phase 70) — the control lives in the transactions filter component.

**Plans**: TBD

<details>
<summary>✅ v2.6: Expenses & Transactions Refinement (Phases 65–68) — SHIPPED 2026-07-22 (tag v2.6)</summary>

Expense Group same-merchant unification (grouping entity above intact Expenses, no physical
merge — ADR 0017) + Transaction Tags (curated second axis, orthogonal to categories) +
dashboard global tag filter and month→filtered-transactions navigation. Cross-cutting invariant:
neither grouping nor tagging changes dashboard totals or category breakdowns. Audit passed 16/16.

- [x] **Phase 65: expense-group-merge-and-view** (GRP-01, GRP-02, GRP-03, GRP-04, GRP-08)
- [x] **Phase 66: expense-group-lifecycle** (GRP-05, GRP-06, GRP-07, GRP-09) — completed 2026-07-20
- [x] **Phase 67: tags-foundation-and-assignment** (TAG-01, TAG-02, TAG-03, TAG-06)
- [x] **Phase 68: tags-dashboard-and-navigation** (TAG-04, TAG-05, NAV-01)

Post-milestone bugfixes: transactions free-text search matches Expense Group title; expenses
"Data" column → detail "Periodo" row; dashboard Categorie tag-filter alignment; GRP-08 dashboard
top-transactions group title; merge-dialog confirm spacing; workspace format-on-save disabled.

Full details: `.planning/milestones/v2.6-ROADMAP.md`

</details>

<details>
<summary>✅ v2.5: Detail Pages (Phases 62–64) — SHIPPED 2026-07-07 (tag v2.5)</summary>

Uniform detail pages for transaction / expense / import file: the single place to
view and edit everything editable, with cross-references. Hashes and `description`
are immutable (dedup/grouping keys); derived expense aggregates reconcile
automatically. Decisions locked (grill 2026-07-05).

- [x] **Phase 62: transaction-edit-core** — `updateTransaction` (amount/date/customTitle, Decimal.js, ownership, hashes frozen), atomic expense reconciliation after amount/date edits, pair-coherence guard (block with message), `updateExpense` extended. Backend + tests, no UI. (DET-01..04) (completed 2026-07-05)
- [x] **Phase 63: detail-pages-tx-expense** — `/transactions/[id]` + `/expenses/[id]` pages with pencil-inline editing, SubcategoryPicker, cerca su internet, cross-refs; expense "dettagli"+"modifica" dialogs collapse into the page. (DET-05..07) (completed 2026-07-05)
- [x] **Phase 64: file-detail-and-navigation** — `/import/[fileId]` page (displayName editable, stats readonly, transactions list) + row-click/menu navigation wiring across all three tables. (DET-08..09) (completed 2026-07-06)

Full details: `.planning/milestones/v2.5-ROADMAP.md`

</details>

<details>
<summary>✅ v2.4: Standalone Expense (Phase 61) — SHIPPED 2026-07-01</summary>

Decision contract LOCKED in `docs/adr/0016-shared-costs-net-by-subcategory-inflows-isolated-per-transaction.md` + `CONTEXT.md` (Standalone Expense entry). Pure implementation — no discovery to redo.

- [x] **Phase 61: standalone-expense** - Add an inline "standalone expense / do not aggregate" action in the categorization flow (title + subcategory → synthetic `descriptionHash`), lift the `SINGLE_TRANSACTION_EXPENSE` guard via in-place re-hash (no orphan), and keep isolation per-transaction (excluded from `descriptionHash` aggregation and Tier 2 history) *(complete 2026-07-01, 2/2 plans)*

Full details: `.planning/milestones/v2.4-ROADMAP.md`

</details>

<details>
<summary>✅ v2.3: Platform Identity & Format Ownership (Phases 58–60) — SHIPPED 2026-06-30 (tag v2.3)</summary>

Decision contract LOCKED in `docs/adr/0015-platform-global-moderated-format-private.md` + `CONTEXT.md`. Pure implementation — no discovery.

- [x] **Phase 58: platform-identity-and-access** - Make Platform a never-owned, review-gated identity (drop `visibility`, rename `ownerUserId`→`proposedByUserId`, `reviewStatus` lifecycle) with backfill, and decouple `accessibleWhere` so a private format is visible on a global platform — no regression on the hot platform join *(complete 2026-06-29, 3/3 plans)*
- [x] **Phase 59: import-wizard-attach-format** - When detection fails, attach a new private Import Format to an existing Platform; mint a brand-new Platform (born `pending`) only when none fits — no more silently duplicated platforms *(complete 2026-06-30, 4/4 plans)*
- [x] **Phase 60: seed-slug-linkage-and-docs** - Seeded formats reference Platform by slug (seeded platforms carry no explicit `id`, runtime FK stays `platformId`), eliminating the Trade Republic id-8 collision; correct the stale DescriptionStripPattern reference in CONTEXT.md and code comments *(complete 2026-06-30, 2/2 plans)*

</details>

<details>
<summary>✅ v2.1: Regex Discovery & Transaction Unification (Phases 51–55) — SHIPPED 2026-06-22</summary>

- [x] **Phase 51: discovery-pipeline-reorder** — Move regex discovery downstream of auto-categorization into a standalone service operating on the uncategorized set only *(complete 2026-06-16, 3/3 plans)*
- [x] **Phase 52: regex-validity-and-dedup** — Correct regex vs single-categorization distinction; skip candidates already covered by existing patterns or manual categories *(complete 2026-06-16, 3/3 plans)*
- [x] **Phase 53: retroactive-application** — Apply a created regex to existing uncategorized data; resolve and implement the current-file-vs-platform-history scope *(complete 2026-06-16, 3/3 plans)*
- [x] **Phase 54: reusable-trigger** — Same discovery service invoked automatically post-import and on-demand from the Files table *(complete 2026-06-21, 3/3 plans)*
- [x] **Phase 55: import-summary-ux** — Capped example list and visual separation of proposed regex vs single-categorization suggestions, with the new-step messaging *(complete 2026-06-22, 3/3 plans)*

Full details: `.planning/milestones/v2.1-ROADMAP.md`

</details>

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

<details>
<summary>✅ v2.2: PDF Import (Phases 56–57) — SHIPPED 2026-06-26</summary>

- [x] **Phase 56: import-format-refactor** — Parsing contract moved from `platform` to `import_format_version`; behavior-preserving; regression-gated on 7 CSV fixtures (completed 2026-06-25, 5/5 plans)
- [x] **Phase 57: pdf-import-trade-republic** — Trade Republic PDF import via `unpdf` positional X-coordinate sign detection; balance chain validation; "TRANSAZIONI SUL CONTO" section only (completed 2026-06-26, 5/5 plans)

Full details: `.planning/milestones/v2.2-ROADMAP.md`

</details>

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
| 51–55 | v2.1 | 15/15 | Complete | 2026-06-22 |
| 56–57 | v2.2 | 10/10 | Complete | 2026-06-26 |
| 58. platform-identity-and-access | v2.3 | 3/3 | Complete   | 2026-06-29 |
| 59. import-wizard-attach-format | v2.3 | 4/4 | Complete   | 2026-06-30 |
| 60. seed-slug-linkage-and-docs | v2.3 | 2/2 | Complete   | 2026-06-30 |
| 61. standalone-expense | v2.4 | 2/2 | Complete    | 2026-07-01 |
| 62. transaction-edit-core | v2.5 | 2/2 | Complete    | 2026-07-05 |
| 63. detail-pages-tx-expense | v2.5 | 4/4 | Complete    | 2026-07-05 |
| 64. file-detail-and-navigation | v2.5 | 7/7 | Complete    | 2026-07-06 |
| 65. expense-group-merge-and-view | v2.6 | 6/6 | Complete    | 2026-07-19 |
| 66. expense-group-lifecycle | v2.6 | 5/5 | Complete    | 2026-07-20 |
| 67. tags-foundation-and-assignment | v2.6 | 9/9 | Complete    | 2026-07-20 |
| 68. tags-dashboard-and-navigation | v2.6 | 8/8 | Complete    | 2026-07-22 |
| 69. tag-dedicated-page | v2.7 | 3/3 | Complete | 2026-07-22 |
| 70. dashboard-tag-filter-removal | v2.7 | — | Not started | - |
| 71. transactions-tag-filter-control | v2.7 | — | Not started | - |

**Total shipped: 68 phases · 263 plans complete**
**Latest shipped: v2.6 Expenses & Transactions Refinement — Phases 65–68 (2026-07-22, tag v2.6). Active: v2.7 Tag Dedicated View — Phases 69–70 (roadmap drafted 2026-07-22; next: `/gsd-plan-phase 69`).**
