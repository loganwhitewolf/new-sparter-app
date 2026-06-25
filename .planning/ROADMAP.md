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
- 🔄 **v2.2: PDF Import** — Phases 56–57 (in progress)

## Phases

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

### v2.2: PDF Import (Phases 56–57)

- [ ] **Phase 56: import-format-refactor** — Sposta il contratto di parsing da `platform` a `import_format_version`; `platform` diventa pura identità; sblocca il versioning reale dei formati per Platform
- [ ] **Phase 57: pdf-import-trade-republic** — Import estratti PDF Trade Republic tramite template per-banca normalizzato a `ParsedImportFile`; segno importi via coordinate X (`unpdf`); solo sezione "TRANSAZIONI SUL CONTO"

## Phase Details

### Phase 56: import-format-refactor

**Goal**: Il contratto di parsing (`delimiter`, `*Column`, `dateFormat`, `dateReplace`, `decimalReplace`, `multiplyBy`, `descriptionStripPattern`, `amountType`) vive su `import_format_version`; `platform` è pura identità del fornitore; il versioning reale dei tracciati per Platform è esprimibile e funzionante
**Depends on**: Phase 55 (nothing new to depend on — first phase of v2.2)
**Requirements**: IFMT-01, IFMT-02, IFMT-03, IFMT-04, IFMT-05
**Success Criteria** (what must be TRUE):

  1. Reimportando un file CSV/XLSX di fixture esistente dopo il refactor, i valori `transactionHash` prodotti sono byte-identici a quelli generati prima — verificato da un test di regressione sulle 6 Platform attive
  2. Il detector (`scoreCandidate`), `normalizeTransactionRow`/`ImportPlatformConfig`, il DAL di detection, i seed script e il wizard dei formati operano sul nuovo contratto senza regressioni comportamentali
  3. Le righe già in produzione su `platform` e `import_format_version` sono migrate da uno step `seed-extras` additivo e idempotente (generato con `drizzle-kit generate` + `scripts/migrate.ts`, mai `drizzle-kit push`)
  4. È possibile aggiungere una seconda `import_format_version` (v2) a una Platform esistente e selezionarla al momento dell'import — il constraint `unique(platformId, version)` è funzionante
  5. La tabella `platform` non contiene più campi del contratto di parsing; i campi rimasti sono solo identità (`name`, `slug`, `country`, `visibility`, `ownerUserId`)

**Plans**: 1/4 plans executed

- [x] 56-01-PLAN.md — Regression baseline: pin transactionHash for all CSV fixtures against current code (IFMT-02)
- [ ] 56-02-PLAN.md — Schema: add the parsing contract (nullable) to import_format_version + generated ADD migration (IFMT-01)
- [ ] 56-03-PLAN.md — seed-extras data copy + seed-data/seed.ts rework + drop platform contract columns (IFMT-03, IFMT-05)
- [ ] 56-04-PLAN.md — Re-point detector/DAL/type/wizard to the version-owned contract; regression GREEN (IFMT-04, IFMT-05)

### Phase 57: pdf-import-trade-republic

**Goal**: L'utente può caricare un estratto PDF Trade Republic e importare le transazioni della sezione "TRANSAZIONI SUL CONTO" con segni corretti, passando per il pipeline esistente (detector, normalize, dedup, preview) invariato
**Depends on**: Phase 56
**Requirements**: PDF-01, PDF-02, PDF-03, PDF-04, PDF-05
**Success Criteria** (what must be TRUE):

  1. Caricando un PDF Trade Republic di esempio, il sistema importa solo le righe della sezione "TRANSAZIONI SUL CONTO" — riepiloghi, posizioni e sezioni-specchio ("PANORAMICA TRANSAZIONI") vengono scartati
  2. Il segno di ciascun importo è determinato dalla posizione X (`unpdf`, serverless) e verificato contro la catena dei saldi progressivi; un disallineamento produce un errore esplicito e non importa nessun dato
  3. Un file PDF con estensione `.pdf` / tipo `application/pdf` superiore a 5 MB (o oltre il ceiling di pagine) viene rifiutato con un messaggio d'errore esplicito prima dell'upload R2
  4. Le righe estratte dal PDF passano invariate per detector, `normalizeTransactionRow`, dedup per hash e preview — le stesse schermate e azioni disponibili per CSV/XLSX funzionano anche per il PDF Trade Republic
  5. Le descrizioni con parte seriale variabile (es. `quantity: <num>` nei savings plan) aggregano nella stessa Expense dopo il `descriptionStripPattern` minimale configurato per Trade Republic

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
| 52. regex-validity-and-dedup | v2.1 | 3/3 | Complete | 2026-06-16 |
| 53. retroactive-application | v2.1 | 3/3 | Complete | 2026-06-16 |
| 54. reusable-trigger | v2.1 | 3/3 | Complete | 2026-06-21 |
| 55. import-summary-ux | v2.1 | 3/3 | Complete | 2026-06-22 |
| 56. import-format-refactor | v2.2 | 1/4 | In Progress|  |
| 57. pdf-import-trade-republic | v2.2 | 0/TBD | Not started | — |

**Total shipped: 55 phases · 204 plans complete**
**Active milestone: v2.2 — 2 phases planned, 0 complete**
