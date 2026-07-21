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
- 🚧 **v2.6: Expenses & Transactions Refinement** — Phases 65–68 (in progress)

## Phases

### 🚧 v2.6: Expenses & Transactions Refinement (Phases 65–68) — IN PROGRESS

Expense Group same-merchant unification (grouping entity above intact Expenses, no
physical merge, model LOCKED in `docs/adr/0017-expense-group-over-physical-merge.md`),
Transaction Tags (curated second axis, orthogonal to categories, design LOCKED in
`.planning/REQUIREMENTS.md` from Obsidian note "sparter-tag-transazioni"), and a
dashboard month → filtered-transactions navigation link. Cross-cutting invariant
across both features: neither grouping nor tagging may change dashboard totals or
category breakdowns — structural for Expense Group (pure regrouping, read-time
totals never persisted), and via the "tag = filter, never breakdown" rule for tags.

- [ ] **Phase 65: expense-group-merge-and-view** - User can bulk-merge same-subcategory expenses into a titled Expense Group and see it rendered as one row everywhere (expenses list, dashboard drill-downs, transaction rows, member detail pages), with a group detail page as the single place to view composition and rename. (GRP-01, GRP-02, GRP-03, GRP-04, GRP-08)
- [x] **Phase 66: expense-group-lifecycle** - User can recategorize a group as one unit, add a later expense to an existing group, remove a member or dissolve the group entirely — with dashboard totals and category breakdowns provably unchanged by any of it. (GRP-05, GRP-06, GRP-07, GRP-09) (completed 2026-07-20)
- [ ] **Phase 67: tags-foundation-and-assignment** - User can maintain a curated tag list (create/edit/archive, never delete), bulk-assign tags to transactions from the transactions page, get a pre-checked date-range suggestion on tag creation and each subsequent import, and trust that Viaggi/Vacanze categorization only captures intrinsically-travel spend. (TAG-01, TAG-02, TAG-03, TAG-06)
- [ ] **Phase 68: tags-dashboard-and-navigation** - User can filter the entire dashboard by tag, review a dedicated Tag section with independent per-tag totals, and jump from a dashboard savings/deviations row straight into the matching filtered transaction list. (TAG-04, TAG-05, NAV-01)

### Phase 65: expense-group-merge-and-view

**Goal:** A user with the same real-world merchant scattered across several Expenses (different bank descriptions per card/platform) can unify them into one titled Expense Group, and that group is what they see everywhere Expenses and their transactions are rendered — without any of the underlying transactions, hashes, or categorization history being touched.

**Depends on:** Nothing (first phase of v2.6)

**Requirements:** GRP-01, GRP-02, GRP-03, GRP-04, GRP-08

**Success Criteria**:

1. From the expenses table bulk-selection bar, user can select multiple expenses that share the same subcategory and merge them into an Expense Group with a custom title via "Unisci".
2. If the selection includes uncategorized expenses, the merge dialog first offers to assign them a subcategory (an explicit, Tier-2-visible categorization act) before the merge proceeds; the merge action itself never assigns a category.
3. In the expenses list and in dashboard drill-downs, a merged group appears as a single row with read-time computed totals (amount sum, transaction count, min/max dates) and an "unita" badge; the original member rows no longer appear individually.
4. Opening a group navigates to a group detail page showing the shared subcategory, each member expense with its own original title/total, and the full combined transaction list; rename lives on this page.
5. Transaction rows belonging to a grouped member display the group's title, and a grouped member's own expense detail page declares that it belongs to a group.

**Plans:** 6 plans

Plans:
**Wave 1**

- [x] 65-01-PLAN.md — expenseGroup/expenseGroupMembership schema + migration + merge/rename Zod schemas

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 65-02-PLAN.md — createExpenseGroup/renameExpenseGroup service + mergeExpenses/renameExpenseGroupAction actions + categorizeExpense group guard
- [x] 65-03-PLAN.md — read-time group composition in getExpenses, getExpenseGroupForDetail, transaction group-title precedence (DAL)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 65-04-PLAN.md — Unisci bulk button + merge dialog + expense-table grouped-row rendering
- [x] 65-05-PLAN.md — /expenses/groups/[groupId] detail page + rename control
- [x] 65-06-PLAN.md — transaction row/detail + expense detail "Parte di" cross-refs

**UI hint:** yes

### Phase 66: expense-group-lifecycle

**Goal:** A user can keep an Expense Group current over time — recategorizing it as a single unit, folding in a later same-merchant expense, removing a member or dissolving the group — with an airtight guarantee that none of these operations ever move a transaction or a subcategory assignment, and therefore never move a dashboard total.

**Depends on:** Phase 65

**Requirements:** GRP-05, GRP-06, GRP-07, GRP-09

**Success Criteria**:

1. Recategorizing a group's subcategory propagates to every member expense in one action; while grouped, individual members are not offered their own recategorization control (detach from the group first).
2. User can add a later-arriving expense to an existing group by selecting the group and the expense and choosing "Unisci", gated on the same shared-subcategory rule as initial merge.
3. User can remove a single member from a group or dissolve the whole group via "Scomponi"; a group left with exactly one member auto-dissolves, and dissolution restores the exact pre-merge state (same standalone expense rows, same totals, same hashes).
4. A before/after comparison of dashboard totals and category breakdowns across a merge-then-recategorize-then-dissolve cycle is provably identical — no transaction row or subcategory assignment was altered by any grouping operation.

**Plans:** 5/5 plans complete

Plans:
**Wave 1**

- [x] 66-01-PLAN.md — validation schemas + expense-group service additions (add/remove/dissolve)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 66-02-PLAN.md — categorizeExpenseGroup / addExpensesToGroupAction / removeExpenseFromGroupAction / dissolveExpenseGroupAction server actions

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 66-03-PLAN.md — GRP-09 invariance test (merge/recategorize/dissolve dashboard-aggregate proof)
- [x] 66-04-PLAN.md — merge dialog add-to-group mode + expenses-table selection/eligibility + group-row recategorize
- [x] 66-05-PLAN.md — group detail page: editable subcategory, remove member, dissolve group

**UI hint:** yes

### Phase 67: tags-foundation-and-assignment

**Goal:** A user can define a small curated vocabulary of tags (trips, events, projects), apply them in bulk to transactions from the transactions page, get proactive help finding which transactions belong to a newly-dated tag, and trust that the Viaggi/Vacanze category is clean enough to be a meaningful tagging target rather than a catch-all.

**Depends on:** Nothing (independent — no dependency on Expense Group phases)

**Requirements:** TAG-01, TAG-02, TAG-03, TAG-06

**Success Criteria**:

1. User can create, edit, and archive tags (name + optional date range) in a curated tag list; tags are never deleted, and an archived tag remains selectable and queryable in filters.
2. From the (filtered) transactions page, user can select multiple transactions and bulk-assign one or more tags to them in a single action; a transaction can hold more than one tag at once.
3. When a tag is created with a date range, and again on each subsequent import, the app proposes the transactions falling inside that range as a pre-checked, user-confirmable list to add to the tag.
4. Vacanze/Viaggi subcategories match only intrinsically-travel spend (flight, hotel, rental, insurance); regex and AI categorizer rules are updated so non-travel spend previously miscategorized there no longer lands in Vacanze.

**Plans:** 9 plans

Plans:
**Wave 1**

- [x] 67-01-PLAN.md — tag/transactionTag schema + migration + Zod validation schemas
- [x] 67-02-PLAN.md — Vacanze subcategory audit (seed-extras deactivate step + travel-only trasporto regex)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 67-03-PLAN.md — tag DAL/service/actions (create/edit/archive, D-02 uniqueness guard)
- [x] 67-04-PLAN.md — transaction_tag DAL/service/actions (bulk assign/remove, D-06/D-07)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 67-05-PLAN.md — tag suggestion DAL/service/actions (shared date-range matcher, D-09/D-10)
- [x] 67-06-PLAN.md — transactions-page bulk-assign dialog + row tag chips
- [x] 67-07-PLAN.md — transaction detail page tag section (single add/remove)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 67-08-PLAN.md — /settings/tags CRUD UI + create-time suggestion modal
- [x] 67-09-PLAN.md — post-import "Suggerimenti tag" summary block

**UI hint:** yes

### Phase 68: tags-dashboard-and-navigation

**Goal:** A user can see the whole dashboard narrowed to a single tag's context, review a dedicated section listing every tag's own independent total, and jump directly from a dashboard savings/deviations row into the correspondingly filtered transaction list — closing the loop between "look at the numbers" and "see the transactions behind them."

**Depends on:** Phase 67

**Requirements:** TAG-04, TAG-05, NAV-01

**Success Criteria**:

1. User can apply a tag filter globally on the dashboard alongside month/year; every existing widget narrows to tagged transactions only, and totals still reconcile.
2. User can open a Tag section listing every tag with its own independent per-tag total (no expectation that totals sum to a whole) and an archive action; archived tags remain visible and interrogable there.
3. With a month selected on the dashboard's savings/deviations view, clicking a row navigates to the transactions section pre-filtered to that month and the row's category context.

**Plans:** 8 plans

Plans:
**Wave 1**

- [x] 68-01-PLAN.md — tagScopedTransactions predicate, transactions `tag` filter contract, IDOR defense-in-depth foundation (resolveOwnedTagId)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 68-02-PLAN.md — thread tagId through dashboard.ts (getUncategorizedCount, getOverviewAmountTotals, getCategoryRanking, getCategoryDeviations, getCategoryDetail)
- [ ] 68-04-PLAN.md — getTagTotals (all-time, dashboard-exclusion-aware) + archiveTagAction second revalidatePath
- [ ] 68-05-PLAN.md — TagFilterSelect control + 3rd "Tag" tab in DashboardTabNav

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 68-03-PLAN.md — thread tagId through overview.ts + category.slug fix (NAV-01) + fetchMovers tagId
- [ ] 68-08-PLAN.md — /dashboard/tags page + TagRankingList (TAG-05 Tag section)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 68-06-PLAN.md — wire `?tag=` into Overview/Categorie/category-detail pages + href carry-through
- [ ] 68-07-PLAN.md — NAV-01 movers-panel row click-through (Link wrap via categorySlug)

**UI hint:** yes

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
| 65. expense-group-merge-and-view | v2.6 | 0/6 | In Progress|  |
| 66. expense-group-lifecycle | v2.6 | 0/5 | Complete    | 2026-07-20 |
| 67. tags-foundation-and-assignment | v2.6 | 0/9 | In Progress|  |
| 68. tags-dashboard-and-navigation | v2.6 | 0/8 | In Progress|  |

**Total shipped: 64 phases · 235 plans complete**
**Current milestone: v2.6 Expenses & Transactions Refinement — Phases 65–68 planned**
