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
- 🚧 **v2.3: Platform Identity & Format Ownership** — Phases 58–60 (in progress)

## Phases

### v2.3: Platform Identity & Format Ownership (Phases 58–60) — IN PROGRESS

Decision contract LOCKED in `docs/adr/0015-platform-global-moderated-format-private.md` + `CONTEXT.md`. Pure implementation — no discovery to redo.

- [ ] **Phase 58: platform-identity-and-access** - Make Platform a never-owned, review-gated identity (drop `visibility`, rename `ownerUserId`→`proposedByUserId`, `reviewStatus` lifecycle) with backfill, and decouple `accessibleWhere` so a private format is visible on a global platform — no regression on the hot platform join
- [ ] **Phase 59: import-wizard-attach-format** - When detection fails, attach a new private Import Format to an existing Platform; mint a brand-new Platform (born `pending`) only when none fits — no more silently duplicated platforms
- [ ] **Phase 60: seed-slug-linkage-and-docs** - Seeded formats reference Platform by slug (seeded platforms carry no explicit `id`, runtime FK stays `platformId`), eliminating the Trade Republic id-8 collision; correct the stale DescriptionStripPattern reference in CONTEXT.md and code comments

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

## Phase Details

### Phase 58: platform-identity-and-access

**Goal**: Platform becomes a never-owned, review-gated identity, and a private Import Format is decoupled from a private Platform — so a user's private format can live on a global/approved platform without the system needing to duplicate the platform.
**Depends on**: Phase 57 (v2.2 — `import_format_version` already owns the parsing contract; `platform` is pure identity)
**Requirements**: PLAT-01, PLAT-02, PLAT-03
**Success Criteria** (what must be TRUE):

  1. A platform has no `visibility` column; its former `ownerUserId` is now `proposedByUserId` (provenance), and existing rows are migrated by an additive, idempotent step — no data lost, applied via `drizzle-kit generate` + `scripts/migrate.ts` (never `drizzle-kit push` in production).
  2. A platform proposed by a user (`reviewStatus = pending`) is visible only to its `proposedByUserId`; an `approved` platform (including all seeded platforms) is visible to every user.
  3. A user-owned `import_format_version` is visible to its owner even when its platform is global/approved — `accessibleWhere` no longer requires the platform itself to be private.
  4. Existing global formats still resolve and import exactly as before: the hot `platform` join used by expenses/transactions/imports for filter/display/sort by `platform.slug`/`platform.name` shows no behavioral regression (guarded by tests over the existing formats).

**Plans**: 1/3 plans executed
**Wave 1**

- [x] 58-01-PLAN.md — Platform schema rename/drop + migration 0023 (true RENAME, applied via scripts/migrate.ts) [PLAT-01]

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 58-02-PLAN.md — Relax accessibleWhere + reviewStatus visibility lifecycle (DAL access boundary, lockstep) [PLAT-02, PLAT-03]
- [ ] 58-03-PLAN.md — Wizard write-path glue: createPrivateRows → proposedByUserId, no visibility, reviewStatus 'pending' [PLAT-01]

### Phase 59: import-wizard-attach-format

**Goal**: When format detection fails on upload, the user attaches a new private Import Format to an existing Platform; a brand-new Platform is created only when none fits, and it is born `pending` — eliminating silently minted duplicate platforms for known banks.
**Depends on**: Phase 58 (review-gated visibility + decoupled `accessibleWhere` must exist before the wizard can offer an existing platform and create private formats against it)
**Requirements**: PLAT-04
**Success Criteria** (what must be TRUE):

  1. On a failed detection, the wizard offers the user existing Platforms to attach a new private Import Format to, instead of always creating a new Platform.
  2. Attaching a private Import Format to a known bank's existing (approved) Platform reuses that Platform — no duplicate "Fineco"-style row is created.
  3. A brand-new Platform is created only when no existing one fits, and it is persisted with `reviewStatus = pending` (visible only to its proposer).
  4. The newly attached private Import Format is immediately usable by its owner for the import that triggered creation.

**Plans**: TBD
**UI hint**: yes

### Phase 60: seed-slug-linkage-and-docs

**Goal**: Seeded import formats link to their Platform by slug (not by hardcoded id), removing the Trade Republic id-8 collision that made `onConflictDoNothing` silently skip the TR seed; and the stale DescriptionStripPattern documentation/comments are corrected to reflect ADR 0013.
**Depends on**: Phase 58 (seeded platforms drop their explicit `id:` only after the identity-model schema is in place; the runtime FK stays `platformId`)
**Requirements**: PLAT-05, PLAT-06
**Success Criteria** (what must be TRUE):

  1. Seeded platforms carry no explicit `id:`; the serial assigns it, and conflict resolution is keyed on the unique `slug`.
  2. Seeded import formats reference their Platform by slug; `seed.ts` resolves slug→id at runtime, and the runtime FK column remains `import_format_version.platformId` (unchanged).
  3. A clean reseed inserts the Trade Republic format even when a user platform already holds serial id 8 — the id-8 collision no longer skips the TR seed; running `db:migrate → db:seed → db:seed-extras → db:seed-patterns` produces a correctly linked TR format.
  4. The CONTEXT.md glossary entry and any stale code comments state that DescriptionStripPattern lives on `import_format_version` (ADR 0013), not on `platform`.

**Plans**: TBD

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
| 58. platform-identity-and-access | v2.3 | 1/3 | In Progress|  |
| 59. import-wizard-attach-format | v2.3 | 0/? | Not started | - |
| 60. seed-slug-linkage-and-docs | v2.3 | 0/? | Not started | - |

**Total shipped: 57 phases · 214 plans complete**
**Current milestone: v2.3 — Platform Identity & Format Ownership (Phases 58–60)**
