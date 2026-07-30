# Roadmap

## Milestones

- 🚧 **v3.0: Categories Year View** — Phases 82–84 (roadmap created 2026-07-30) · design locked [ADR 0020](../docs/adr/0020-categories-year-view-retires-deviation.md)
- ✅ **v2.9: Amortization** — Phases 77–81 (shipped 2026-07-29) · model locked ADR 0019 · [archive](milestones/v2.9-ROADMAP.md)
- ✅ **v2.8: Reimbursements 1:N** — Phases 73–76 (shipped 2026-07-27) · [archive](milestones/v2.8-ROADMAP.md)
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
- ✅ **v2.7: Tag Dedicated View** — Phases 69–72 (shipped 2026-07-22, tag v2.7) · [archive](milestones/v2.7-ROADMAP.md)

## Phases

### 🚧 v3.0: Categories Year View (In Progress)

**Milestone Goal:** Rewrite the Categories dashboard section on a coherent yearly axis — monthly
pace and year-end projection replacing the rolling-preset model — and retire the Deviation,
Baseline, Noise Threshold and Preset vocabulary (code + glossary) along with it. Locked in
**[ADR 0020](../docs/adr/0020-categories-year-view-retires-deviation.md)** (amends LENS-01 of ADR
0019 — the cassa/competenza lens is no longer dashboard-global, confined to Overview) and
`.planning/dashboard-categories-DECISIONS.md` (19 decisions, D1–D19). Prototypes in
`.scratch/dashboard-categories/` — the 12-month table (variant A) is locked over a chart, which
cannot render a month-over-month delta as a word inside a 60px bar.

Sequencing mirrors the v2.8 netting gate / v2.9 LENS-03 pattern: the number engine and the
`direction.hidden` predicate change touch the same shared dashboard aggregation sites Overview and
Tags read, so Phase 82 builds the engine and proves Overview/Tags totals byte-identical
(RETIRE-05) **before** any Categories list or detail UI ships.

- [x] **Phase 82: number-engine-and-regression-gate** (PACE-01…06, RETIRE-03, RETIRE-04, RETIRE-05) — Mese Coperto/Parziale, Ritmo, Proiezione and the current−previous sign convention built and proven; lens confined to Overview, dead `tag` param dropped; Overview/Tags totals byte-identical before any Categories UI changes (completed 2026-07-30)
- [ ] **Phase 83: categories-list** (CLIST-01…07) — Categories list rewritten on year + direction (Uscite/Entrate/Accantonamenti) with total, share, sparkline, projection, sort toggle and first-import state
- [ ] **Phase 84: category-detail-and-cleanup** (CDET-01…07, RETIRE-01, RETIRE-02) — Category detail rewritten as a 12-month table (deltas, previous-year row, window, subcategory contributions, coverage states); Deviation/Preset machinery fully retired, no dead references

#### Phase 82: number-engine-and-regression-gate

**Goal**: The shared number engine — month coverage, pace, year-end projection, and the
current-minus-previous sign convention — exists and is proven not to disturb Overview or Tags,
before any Categories list or detail UI is touched.

**Depends on**: Nothing new (first phase of v3.0; builds on the existing dashboard aggregation
infrastructure from v2.0/v2.8/v2.9)

**Requirements**: PACE-01, PACE-02, PACE-03, PACE-04, PACE-05, PACE-06, RETIRE-03, RETIRE-04, RETIRE-05

**Success Criteria** (what must be TRUE):

  1. A month with zero transactions is excluded from every average (not counted as a zero), while
     a Covered Month in which a category has no movement counts as €0 and pulls its average down;
     the current calendar month is excluded from every average as a Partial Month (PACE-01, PACE-02).

  2. No pace or projection is produced anywhere for a year with fewer than 2 Covered Months; once
     produced, the current month is valued at `max(spent so far, pace)` so a projection never
     reads below an already-observed amount (PACE-03, PACE-04).

  3. The displayed period total is always exactly the sum of the underlying monthly series — no
     independently computed projection figure exists anywhere in the engine (PACE-05).

  4. Every comparison is computed and stored as `current − previous`, with the sign-to-colour
     judgement resolved by one shared, per-direction function rather than duplicated per widget
     (PACE-06).

  5. A regression test suite proves Overview's and Tags' totals are byte-identical before and
     after the engine change; the cassa/competenza lens switch renders only on Overview (removed
     from Categories and Tags), and dashboard tab navigation no longer carries the dead `tag`
     parameter (RETIRE-05, RETIRE-03, RETIRE-04).

**Plans**: 3 plans

Plans:
**Wave 1**

- [x] 82-01-PLAN.md — Covered Months query + pace existence check + real-Postgres tracer, RETIRE-05 byte-identical baseline
- [x] 82-02-PLAN.md — Lens confinement to Overview (D-12) + drop the dead `?tag=` tab-nav param (D-14)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 82-03-PLAN.md — Partial Month + hybrid current month + total-sum invariant + comparison/judgement + previous-year threshold

**UI hint**: yes

#### Phase 83: categories-list

**Goal**: The user reads the selected year's categories ranked by spend, each carrying its share
of the total, a 12-month sparkline and a year-end projection, filterable across all three
directions including the previously-unreachable Accantonamenti.

**Depends on**: Phase 82

**Requirements**: CLIST-01, CLIST-02, CLIST-03, CLIST-04, CLIST-05, CLIST-06, CLIST-07

**Success Criteria** (what must be TRUE):

  1. For a selected year and direction, every category appears ranked by total, each row showing
     its % share of the total and a 12-month sparkline (CLIST-01).

  2. Each row also shows the year-end projection, visually subordinate to and explicitly labelled
     apart from the total (CLIST-02); the user can re-order the list by projection instead of
     total via the existing sort control (CLIST-03).

  3. The direction switch offers Uscite, Entrate and Accantonamenti — the last reachable here for
     the first time (CLIST-04).

  4. Moving between Overview and Categories preserves the selected year via the shared `?year=`
     parameter (CLIST-05).

  5. With a single Covered Month, the list shows the certain figures (total, share, one-point
     series) plus an explicit statement of what's missing and how to get it; clicking a category
     opens its detail on the same year, so the row's total and the detail page's total agree
     (CLIST-06, CLIST-07).

**Plans**: TBD
**UI hint**: yes

#### Phase 84: category-detail-and-cleanup

**Goal**: The user reads a category's story as a 12-month table with month-over-month deltas, a
previous-year comparison and a narrowable window, with subcategory contributions that provably sum
to the parent's difference — and the retired Deviation/Baseline/Noise-Threshold/Preset vocabulary
leaves no trace in the codebase, having lost its last caller.

**Depends on**: Phase 82 (engine); sequenced after Phase 83 since CLIST-07 is the detail page's
entry point, though the detail computation itself only requires Phase 82

**Requirements**: CDET-01, CDET-02, CDET-03, CDET-04, CDET-05, CDET-06, CDET-07, RETIRE-01, RETIRE-02

**Success Criteria** (what must be TRUE):

  1. The category detail page renders a 12-month table with the month-over-month delta inside
     each cell, plus a previous-year row for direct month-by-month comparison (CDET-01, CDET-02).

  2. The user can narrow the table to a 9/6/3-month window from a chosen start month; every figure
     on the page, including the summary column's total/average/comparison, refers only to that
     window (CDET-03, CDET-04).

  3. Subcategories are listed by weight, each carrying a contribution to the difference that sums
     exactly to the parent category's total difference, including subcategories present in only
     one of the two compared periods (CDET-05).

  4. Covered, current (hybrid) and estimated months are each visually distinct from one another
     and from explicitly-marked uncovered months; when the previous year lacks sufficient
     coverage, the total difference is replaced by a stated reason while the average comparison
     still renders (CDET-06, CDET-07).

  5. No trace of Deviation, Baseline, Noise Threshold or the Preset filter remains in the
     interface or the codebase — a repository grep and the full regression suite confirm zero
     dead references and no regression on any surface that used their shared helpers (RETIRE-01,
     RETIRE-02).

**Plans**: TBD
**UI hint**: yes

<details>
<summary>✅ v2.9: Amortization (Phases 77–81) — SHIPPED 2026-07-29 (model locked ADR 0019)</summary>

Spread a one-off outflow transaction over N uniform monthly instalments (detach into Standalone
Expense, ADR 0016 reused), read through a second "competenza" dashboard lens via one swappable
`ledger_entry` row source per lens — not a `lens` parameter threaded through the ten aggregation
functions — which structurally prevents the reimbursement double-netting trap. Realization (selling
or scrapping an amortized asset) reuses the v2.8 reimbursement mechanism. Cash lens regression-gated
byte-identical (LENS-03) across all 10 aggregation sites before any lifecycle/lens work. Audit
**passed 15/15**; full suite green (1953 passed + 1 todo).

- [x] **Phase 77: amortization-schema-and-activation** (AMORT-01, AMORT-02, AMORT-03, LENS-03) — materialised plan+instalment schema, the `ledger_entry` seam (cash = transactions, accrual = instalments), and the three activation entry points that detach into a Standalone Expense (completed 2026-07-28)
- [x] **Phase 78: plan-lifecycle-and-reconciliation** (AMORT-04, AMORT-05, AMORT-06, AMORT-07) — close+collapse, realize-via-sale/scrap, reduce+re-spread on a linked reimbursement, and the amount/date edit guard (completed 2026-07-28)
- [x] **Phase 79: amortizations-registry** (REG-01, REG-02, REG-03) — dedicated `/amortizations` page with per-plan values and remaining months, close-from-registry, open/closed distinction (completed 2026-07-28)
- [x] **Phase 80: dashboard-accrual-lens** (LENS-01, LENS-02, LENS-04, LENS-05) — global cassa/competenza switch across every widget, whole-year accrual view with future-instalment spillover, lens-aware year/month selectors (completed 2026-07-29)
- [x] **Phase 81: inline-net-display-for-paired-transactions** (Phase 78 UAT closure) — transactions table shows net-primary + struck-through gross on a paired anchor and a "riduzione di …" badge on the counterpart; purely presentational, netting unchanged (completed 2026-07-29)

Full details: `.planning/milestones/v2.9-ROADMAP.md`

</details>

<details>
<summary>✅ v2.8: Reimbursements 1:N (Phases 73–76) — SHIPPED 2026-07-27</summary>

Replaced the 1:1 `transaction_pair` with an explicit **one outflow → N inflows** reimbursement (the
old pair migrated and subsumed as the N=1 case). The anchor is always an outflow Expense (the Expense
**Group** anchor was descoped in UAT — backend dormant, no UI); linked refunds net into the cost's
month (Mondo Netto); residual ("still owed €25") is first-class. Model locked in **ADR 0018**
(supersedes ADR 0016 §1). Dashboard totals regression-gated across all 10 aggregation sites before
any UI. Audit **passed 11/11**; full suite green (149 files, 1834 tests).

- [x] **Phase 73: reimbursement-schema-and-netting** (RMB-01, RMB-03, RMB-04, RMB-05) — completed 2026-07-24
- [x] **Phase 74: group-anchor-and-reconciliation** (RMB-02, RMB-06, RMB-09) — completed 2026-07-24
- [x] **Phase 75: linking-surfaces-and-lifecycle** (RMB-07, RMB-08) — completed 2026-07-27
- [x] **Phase 76: reimbursements-section** (RMB-10, RMB-11) — completed 2026-07-27

Full details: `.planning/milestones/v2.8-ROADMAP.md`

</details>

### Phase 81: Inline net display for paired transactions

> **v2.9 closure phase.** Closes the non-blocking UAT gap flagged in the v2.9 milestone audit
> (`.planning/v2.9-MILESTONE-AUDIT.md`, Phase 78 item): "chiudi per vendita" (and, by the same
> mechanism, every v2.8 reimbursement) nets correctly on the detail page and dashboard, but the
> transactions **table row** still shows only the gross `transaction.amount`, and the
> sale/refund counterpart reads as a plain positive inflow with nothing marking it as a
> reduction of another transaction. Design decisions LOCKED 2026-07-29 (memory
> `project_paired_tx_inline_net_display`).

**Goal:** In the transactions table, a paired anchor (amortization-sale or v2.8 reimbursement)
shows its **net** amount prominently with the gross initial amount struck-through/dimmed beneath
it, and the paired counterpart row carries a "riduzione di …" badge linking to its anchor with an
attenuated amount — so a user reading the table alone understands the real net without opening the
detail page. Purely presentational: `effectiveAmount()`, netting, and all totals stay unchanged.
**Requirements**: closes the Phase 78 UAT item (AMORT-05 realization readability); no new REQ-ID.
**Depends on:** Phase 80

**Success Criteria** (what must be TRUE):

  1. A paired outflow anchor (amortization closed-for-sale OR v2.8 reimbursement) renders in the
     transactions table with the net amount as the primary figure and the gross initial amount
     struck-through/opaque beneath it — for **all** pairing types, not just amortization.

  2. The counterpart row (the sale/refund positive) shows a "riduzione di …" badge that links to
     its anchor transaction and renders its amount attenuated, so it no longer reads as a plain
     asset/inflow.

  3. No change to any total, `effectiveAmount()` result, netting math, or dashboard/lens figure —
     the full test suite (incl. LENS-03 byte-identical regression) stays green.

**Scope note:** single surface — the row render in `transaction-table.tsx`, extending/replacing
`ReimbursementRowIndicator`. `lib/dal/transactions.ts` is unmodified: net + anchor link are already
exposed (`pairedNetAmount`/`pairedWithId`/`pairedDescription`), and anchor-vs-counterpart role is
resolved client-side from the sign of `amount` (safe because `assertOutflowAnchorAmount`/
`assertInflowRefundAmount` already enforce that invariant at write time) — zero DAL change. The
table is cash-only (not lens-aware): the net shown is the cash net (initial − sale/refund).

**Plans:** 1/1 plans complete

Plans:

- [x] 81-01-PLAN.md — Anchor net-primary + struck-through gross, counterpart reduction badge + attenuated amount (D-N1..D-N4)

---

<details>
<summary>✅ v2.7: Tag Dedicated View (Phases 69–72) — SHIPPED 2026-07-22 (tag v2.7)</summary>

Dedicated per-tag page as the canonical all-time view of a tag (event-shaped), replacing the
period-scoped `?tag=` dashboard filter so a tag shows one reconciled set of numbers everywhere.
Variant A "report verticale" layout (prototype `proto/tag-view`); single numeric source
`getTagDetail`/`getTagTotals`.

- [x] **Phase 69: tag-dedicated-page** (TAG-06…TAG-12) — Variant A mini-dashboard, edit/archive in place, entry from /tags + /dashboard/tags
- [x] **Phase 70: dashboard-tag-filter-removal** (TAG-13) — removed the period-scoped `?tag=` filter and all its wiring
- [x] **Phase 71: transactions-tag-filter-control** (TAG-14) — tag filter control in the transactions toolbar, integrated into the unified filter/sort system
- [x] **Phase 72: transactions-tag-indicator** (TAG-15) — inline tag chip on the transaction title line with hover/tap popover

Full details: `.planning/milestones/v2.7-ROADMAP.md`

</details>

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
| 70. dashboard-tag-filter-removal | v2.7 | 2/2 | Complete | 2026-07-22 |
| 71. transactions-tag-filter-control | v2.7 | 1/1 | Complete | 2026-07-22 |
| 72. transactions-tag-indicator | v2.7 | direct | Complete | 2026-07-22 |
| 73. reimbursement-schema-and-netting | v2.8 | 4/4 | Complete | 2026-07-24 |
| 74. group-anchor-and-reconciliation | v2.8 | 4/4 | Complete | 2026-07-24 |
| 75. linking-surfaces-and-lifecycle | v2.8 | 4/4 | Complete | 2026-07-27 |
| 76. reimbursements-section | v2.8 | 6/6 | Complete | 2026-07-27 |
| 77. amortization-schema-and-activation | v2.9 | 6/6 | Complete    | 2026-07-28 |
| 78. plan-lifecycle-and-reconciliation | v2.9 | 3/3 | Complete    | 2026-07-28 |
| 79. amortizations-registry | v2.9 | 2/2 | Complete    | 2026-07-28 |
| 80. dashboard-accrual-lens | v2.9 | 7/7 | Complete    | 2026-07-29 |
| 81. inline-net-display-for-paired-transactions | v2.9 | 1/1 | Complete    | 2026-07-29 |
| 82. number-engine-and-regression-gate | v3.0 | 0/3 | Complete    | 2026-07-30 |
| 83. categories-list | v3.0 | 0/TBD | Not started | - |
| 84. category-detail-and-cleanup | v3.0 | 0/TBD | Not started | - |

**Total shipped: 81 phases · 305 plans complete**
**Latest shipped: v2.9 Amortization — Phases 77–81 (2026-07-29, model locked ADR 0019). All AMORT-01…07, REG-01…03, LENS-01…05 delivered: materialised amortization_plan/amortization_instalment schema + dual ledger_entry (cash/accrual) VIEW seam, three activation entry points detaching into a Standalone Expense, plan lifecycle (close/collapse, realize-via-sale reusing v2.8 pairing, reduce+re-spread on reimbursement, edit guard), /amortizations registry, and the global cassa/competenza dashboard lens. Phase 81 closed the Phase 78 UAT gap with inline net display in the transactions table. Audit passed 15/15; full suite 1953 passed + 1 todo.**

**Next: v3.0 (Categories Year View) roadmap created 2026-07-30 — 3 phases (82-84), 25/25 requirements mapped, no discovery needed (design locked in ADR 0020 + dashboard-categories-DECISIONS.md). Start with `/gsd-discuss-phase 82` or `/gsd-plan-phase 82`. Carried tech debt: operator deploy (v2.8 R038/R039/R041 + live migrations 0028-0032, plus v2.9 migration 0033 + seed run order); P78 browser UAT + P80 Playwright LENS suite (blocked by pre-existing proxy.ts redirect loop) — see .planning/milestones/v2.9-MILESTONE-AUDIT.md.**
