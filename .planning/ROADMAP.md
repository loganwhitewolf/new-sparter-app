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
- 🚧 **v2.5: Detail Pages** — Phases 62–64 (in progress)

## Phases

### 🚧 v2.5: Detail Pages (Phases 62–64) — IN PROGRESS

Uniform detail pages for transaction / expense / import file: the single place to
view and edit everything editable, with cross-references. Hashes and `description`
are immutable (dedup/grouping keys); derived expense aggregates reconcile
automatically. Decisions locked in `.planning/REQUIREMENTS.md` (grill 2026-07-05).

- [ ] **Phase 62: transaction-edit-core** — `updateTransaction` (amount/date/customTitle, Decimal.js, ownership, hashes frozen), atomic expense reconciliation after amount/date edits, pair-coherence guard (block with message), `updateExpense` extended. Backend + tests, no UI. (DET-01..04)
- [ ] **Phase 63: detail-pages-tx-expense** — `/transactions/[id]` + `/expenses/[id]` pages with pencil-inline editing, SubcategoryPicker, cerca su internet, cross-refs; expense "dettagli"+"modifica" dialogs collapse into the page. (DET-05..07)
- [ ] **Phase 64: file-detail-and-navigation** — `/import/[fileId]` page (displayName editable, stats readonly, transactions list) + row-click/menu navigation wiring across all three tables. (DET-08..09)

### Phase 62: transaction-edit-core

**Goal:** A transaction's `amount`, `occurredAt`, and `customTitle` can be edited safely from the service layer — hashes and `description` stay frozen, the linked expense's derived aggregates reconcile atomically in the same `db.transaction`, and pair-breaking edits are blocked with a clear Italian message. Backend + tests only, no UI.

**Requirements:** DET-01, DET-02, DET-03, DET-04

**Success Criteria**:

1. `updateTransaction` service + thin `"use server"` action edit `amount` (Decimal.js, signed), `occurredAt`, `customTitle` inside `db.transaction`, Zod-validated and ownership-gated; `transactionHash`, `descriptionHash`, and `description` are never modified by any edit path.
2. After an amount/date edit, the linked expense's `totalAmount`, `transactionCount`, `firstTransactionAt`, `lastTransactionAt` are recomputed atomically in the same transaction (reuse/generalize the existing expense-reconciliation service).
3. Editing a paired transaction's amount so the pair would break the opposite-sign/nonzero invariant is rejected with an Italian message ("Scollega prima il rimborso"); edits to unpaired transactions are unaffected.
4. `updateExpense` covers `title`, `notes`, `subCategoryId` with status transitions consistent with the categorize flow; derived expense fields are never writable through it.
5. Tests cover edit, reconciliation, and pair guard paths.

**Plans:** 2 plans

Plans:

- [x] 62-01-PLAN.md — updateTransaction service + action: amount/date/customTitle edit, atomic expense reconciliation, pair guard (DET-01, DET-02, DET-03)
- [x] 62-02-PLAN.md — updateExpense DAL made atomic + history-aware: title/notes/subCategoryId edit, categorize-flow-consistent status transitions (DET-04)

### Phase 63: detail-pages-tx-expense

**Goal:** `/transactions/[id]` and `/expenses/[id]` become the single place to view and edit everything editable about a transaction/expense, with cross-references between entities; the expense "dettagli" and "modifica" dialogs collapse into the page.

**Depends on:** Phase 62

**Requirements:** DET-05, DET-06, DET-07

**Success Criteria**:

1. `/transactions/[id]` shows all fields; pencil-inline edit for amount/date/title; category assign/change via `SubcategoryPicker`; immutable fields visibly readonly (description, hashes never editable); actions: cerca su internet, collega/scollega rimborso, spesa a sé, elimina; cross-refs: linked expense (link), source file (link) or "Manuale".
2. `/expenses/[id]` merges today's "dettagli" + "modifica" dialogs: pencil-inline edit for title/notes/category, readonly derived totals; actions: cerca su internet, categorizza, elimina; cross-refs: linked transactions list (each linking to its page), source file, platform.
3. The old expense edit/details dialogs are removed or redirected; no dead menu entries; tables link to the new pages.

**Plans:** TBD

### Phase 64: file-detail-and-navigation

**Goal:** `/import/[fileId]` detail page (editable `displayName`, readonly platform/format/stats, file transactions listed) plus consistent row-click/menu navigation wiring across all three tables.

**Depends on:** Phase 63

**Requirements:** DET-08, DET-09

**Success Criteria**:

1. `/import/[fileId]` shows `displayName` editable inline; platform/format/stats readonly; the file's transactions are listed, each linking to its detail page; existing actions preserved (R2 download, suggestions, delete).
2. Row-title click navigates to the detail page on Transactions, Expenses, and Files tables; menu "Dettagli" entries exist; breadcrumb/back behavior is consistent.

**Plans:** TBD

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

| 62. transaction-edit-core | v2.5 | 2/2 | Complete   | 2026-07-05 |
| 63. detail-pages-tx-expense | v2.5 | 0/? | Not started | - |
| 64. file-detail-and-navigation | v2.5 | 0/? | Not started | - |

**Total shipped: 61 phases · 222 plans complete**
**Current milestone: v2.5 Detail Pages — Phases 62–64 planned**
