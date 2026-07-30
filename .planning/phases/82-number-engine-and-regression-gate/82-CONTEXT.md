# Phase 82: number-engine-and-regression-gate - Context

**Gathered:** 2026-07-30
**Status:** Ready for planning
**Source:** ADR Ingest Express Path (`docs/adr/0020-categories-year-view-retires-deviation.md`, status `accepted`, 10 decisions parsed)

> Ingest note: ADR 0020 is a narrative ADR with a single `## Consequences` section, so the
> parser bucketed all 7 consequence entries as `consequences_positive`. They are in fact
> **accepted costs**, and are recorded under `## Risk Summary` below rather than as Success
> Criteria. Success Criteria are taken from `ROADMAP.md` §Phase 82.
>
> Decision IDs below are Phase-82-local (`D-01…D-16`) and each cites its upstream source. Do
> not confuse them with the `D1…D19` numbering of `.planning/dashboard-categories-DECISIONS.md`
> (cited inline as "DECISIONS D11" etc.), nor with the legacy deferred debt `D-12` recorded in
> the root `CONTEXT.md` — that debt is extinguished by this milestone, not paid.

<domain>
## Phase Boundary

The shared number engine — month coverage, pace (`Ritmo`), year-end projection, and the
`current − previous` sign convention — exists and is proven not to disturb Overview or Tags,
**before any Categories list or detail UI is touched**.

This phase ships computation plus two small UI retirements (lens switch confined to Overview,
dead `tag` parameter dropped) and a regression gate. It ships **no new Categories surface**:
the list is Phase 83, the detail table is Phase 84, and the Deviation/Preset code removal is
Phase 84.

Sequencing rationale (`ROADMAP.md` §v3.0): the engine and the later `direction.hidden`
predicate change touch the same shared dashboard aggregation sites that Overview and Tags
read. Phase 82 therefore builds the engine and proves Overview/Tags totals byte-identical
(RETIRE-05) first, mirroring the v2.8 netting gate and v2.9 LENS-03 pattern.

**Requirements in scope:** PACE-01, PACE-02, PACE-03, PACE-04, PACE-05, PACE-06, RETIRE-03,
RETIRE-04, RETIRE-05.

</domain>

<decisions>
## Implementation Decisions

### Coverage model

- **D-01:** `Mese Coperto` is a month with at least one Transaction for the user in *any*
  category, and it is the denominator of every average. A month with no transactions at all is
  excluded from the denominator entirely — it does not exist, it is **not** a zero. This is the
  load-bearing rule of the design: without it every seasonal category (Salute, Regali) yields a
  projection inflated 3–6×, because its average would only count the months in which it fired.
  (DECISIONS D11 · ADR 0020 §4 · PACE-01)
- **D-02:** Inside a Covered Month, a category with no movement is worth **€0 and counts**,
  pulling its average down. Coverage is a property of the month on the account, never of the
  category. (DECISIONS D11 · ADR 0020 §4 · PACE-01)
- **D-03:** `Mese Parziale` is the current calendar month, excluded from every average. A month
  whose data merely ended is **not** partial: if today is 30 July and data ends on the 28th,
  July is partial; if data stops in May and today is July, May is covered and concluded — the
  user simply stopped importing. No presumption in either direction. (DECISIONS D11 · PACE-02)

### Pace and projection

- **D-04:** `Ritmo` is the average over the Covered Months of the **selected year** — never of a
  window. A window can legitimately contain no Covered Month at all (it is July, the window is
  Oct–Dec), so a window-scoped pace would have nothing to read. Rejected: last-3-months average
  (one annual expense swings it 4×) and calendar-elapsed months (punishes the user for not
  importing). (DECISIONS D4 + D14 corollary · ADR 0020 §3 · PACE-03)
- **D-05:** Below **2 Covered Months** in the selected year, no pace and no projection is
  produced *anywhere* in the engine. The insufficient-coverage outcome must be explicit and
  impossible to read as €0 downstream — no fragile number, no silent null coerced to zero.
  (DECISIONS D4 · PACE-03)
- **D-06:** The current month is valued at `max(spent so far, pace)`, making it a **hybrid** —
  neither fact nor pure estimate. A projection must never display less than an already-observed
  amount. Rejected: plain pace (would show €300 while €480 is already spent) and
  `spent + pace × remaining-days` (assumes uniform daily spend, false precisely for rent,
  instalments and utilities concentrated at month start, so it overstates systematically).
  (DECISIONS D12 · ADR 0020 §5 · PACE-04)
- **D-07:** The period total is **the sum of the displayed monthly series**. No independently
  computed projection figure exists anywhere in the engine — the large number is the sum of the
  numbers above it, so any divergence is a visible bug rather than a silent one.
  (DECISIONS D13 · ADR 0020 §6 · PACE-05)

### Comparison and sign convention

- **D-08:** Every comparison is computed and stored as `current − previous` (negative = spent
  less), reusing the app's single existing convention already documented in `lib/dal/overview.ts`.
  (DECISIONS D13 · ADR 0020 §10 · PACE-06)
- **D-09:** The sign-to-judgement mapping is resolved by **one shared per-direction function**,
  not duplicated per widget: on `out` more is worse, on `allocation` more is better. The engine
  exposes magnitude plus direction so a caller can render a word without a sign ("€180 in meno")
  and derive colour from that single function. (DECISIONS D13 · ADR 0020 §10 · PACE-06)
- **D-10:** Average-vs-average is robust to coverage gaps; total-vs-total is not. The
  previous-year coverage threshold therefore gates **only the total difference** — the average
  comparison always renders. (DECISIONS D13 · PACE-06)

### Monetary arithmetic

- **D-11:** All engine arithmetic on amounts uses `Decimal.js` via `@/lib/utils/decimal`; values
  read from Drizzle `DECIMAL` columns arrive as strings and are passed straight into the decimal
  helpers. No native JS `+ - * /` on monetary values anywhere in the engine, including averages
  and projections. (`CLAUDE.md` hard rule)

### Lens confinement and tab navigation

- **D-12:** The cassa/competenza switch renders **only on Overview**. It is removed from
  Categories and from Tags (Tags no longer shows a disabled switch). Categories always reads
  cassa. This amends LENS-01 of ADR 0019 ("one switch flips every widget across all four
  dashboard sub-routes"). Rationale: amortization is a property of a single Transaction, not a
  way of reading a category's spending, and pace is by construction a cash reading. This also
  dissolves the instalment/pace double-counting problem instead of engineering around it, so no
  `source` discriminator column is added to the lens views. (DECISIONS D6 · ADR 0020 §7 ·
  RETIRE-03)
  **Verified site inventory (2026-07-30) — DECISIONS D6 predates the v2.9 LSD-05 work, so its
  "removed from Tags" clause is already satisfied:**
  - `app/(app)/dashboard/tags/page.tsx` — **already compliant.** It renders no lens control and
    reads no `?lens=` searchParam (explicit `LSD-05` comment in the file). Verify only; there is
    no disabled switch left to remove. Do not plan a change here.
  - `app/(app)/dashboard/categories/page.tsx:146` — `{hasPlans && <LensSwitch lens={lens} />}`
    must go, **and** the page's `parseLensParam(params.lens)` /
    `resolveLedgerRowSource(lens)` binding (lines 136–137) must be fixed to cassa. Removing the
    control alone would leave Categories still reading whichever lens the URL carried — which is
    exactly what D-12 forbids, since `?lens=` keeps flowing through the tab nav under D-13.
  - `app/(app)/dashboard/categories/[id]/page.tsx:170` — same removal, same cassa-fixing of the
    `parseLensParam` / `resolveLedgerRowSource` binding (lines 149–150).
  - `components/dashboard/category-ranking-list.tsx` — carries an optional `lens?: Lens` prop
    threaded from the Categories page; it loses its caller and must be cleaned up with it.
  - `components/dashboard/lens-switch.tsx` and `components/dashboard/lens-persistence.ts` —
    **kept**, still used by Overview. Not deleted.
  This closes RESEARCH.md open question 3: on Categories, removing the control is *not*
  sufficient — the aggregation binding must be pinned to cassa so a `?lens=competenza` URL
  cannot change what Categories computes.
- **D-13:** The dashboard tab navigation **keeps propagating `?lens=` invisibly**, so
  Overview-in-competenza → Categories → back lands in competenza rather than silently resetting
  to cassa. This closes the item DECISIONS D7 left open, adopting its own recommendation.
  (DECISIONS D7 · RETIRE-04)
- **D-14:** `buildDashboardTabHref` carries only parameters that are actually read: the `tag`
  parameter, dead since v2.7, is dropped. `preset` removal belongs to Phase 84 (with the Preset
  machinery) and `year` propagation to Phase 83 (CLIST-05) — this phase touches `tag` only.
  (DECISIONS D7 · RETIRE-04)

### Regression gate

- **D-15:** A regression suite proves Overview's and Tags' totals are **byte-identical** before
  and after the engine change, and it is written and green **before** any Categories UI phase
  starts. This is the gate the whole phase exists to pass. (ADR 0020 · DECISIONS D6 · RETIRE-05)
- **D-16:** The regression harness must be re-runnable unchanged by Phase 83, when the ranking
  predicate flips from `eq(direction.includedInTotals, true)` to `eq(direction.hidden, false)`.
  That predicate change is the second half of the same shared-aggregation risk and lands in
  Phase 83, not here — but the harness that protects against it is built here.
  (`ROADMAP.md` §v3.0 sequencing · DECISIONS D9)

### Claude's Discretion

- Exact module and file layout of the engine inside the project's layering (`lib/dal/` for
  queries, `lib/services/` for computation) — the layering rule is fixed, the decomposition is not.
- The shape of the insufficient-coverage outcome (discriminated union, explicit sentinel type,
  thrown error) — any shape satisfying D-05's "cannot be silently read as €0" is acceptable.
- Test mechanics of the golden-fixture regression suite: fixture capture strategy, whether
  totals are snapshotted or asserted inline, and how the isolated `sparter_test` database is
  seeded. `tests/amortization-lens-regression*.test.ts` is the established analog.
- The previous-year coverage threshold value that gates the total difference (D-10). The
  DECISIONS doc leaves it open with a proposal of **≥6 Covered Months**; it is an engine
  parameter here and is consumed by Phases 83/84.
- Naming of exported engine types and functions (English identifiers; Italian only on product
  surfaces, per the language convention).

</decisions>

<specifics>
## Specific Ideas

- The verifiability principle is the design's spine and applies to the engine, not only the UI:
  every figure the engine produces must be checkable against another figure it produces. D-07
  (total = sum of series) is the concrete instance. The retired Deviation failed exactly this
  test — it compared against a three-month average drawn nowhere on screen, so the user could
  only trust it.
- "No fragile number" (D-05) is preferred over a degraded number. A new user with one Covered
  Month sees the degenerate state — total and one-point series, no pace, no projection, no
  comparison — treated as a prompt to import the next month, following the existing
  `OverviewNudge` pattern. The UI copy for that state is Phase 83's job; the engine's job is to
  make the state distinguishable.
- The v2.9 LENS-03 gate is the pattern being reproduced: an engine change that touches shared
  aggregation sites is proven inert on the surfaces it must not move, before anything visible
  ships on top of it.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The locked model
- `docs/adr/0020-categories-year-view-retires-deviation.md` — the accepted ADR; §3, §4, §5, §6,
  §7, §10 are this phase's decisions. Also records why the `source` discriminator column on the
  lens views is deliberately *not* added.
- `.planning/dashboard-categories-DECISIONS.md` — the 19 locked decisions in full, with rejected
  alternatives and accepted costs. **D4, D6, D7, D11, D12, D13** are this phase's; the "What
  gets retired" and "Deliberately left open" sections scope Phases 83/84.
- `docs/adr/0019-amortization-accrual-lens.md` — LENS-01 (amended by ADR 0020) and the
  one-row-source-per-lens seam. This phase must not re-thread a `lens` parameter through the
  aggregation sites.

### Requirements and sequencing
- `.planning/REQUIREMENTS.md` — exact wording of PACE-01…06 and RETIRE-03/04/05, with their
  D-number provenance.
- `.planning/ROADMAP.md` §Phase 82 — the five success criteria; §v3.0 preamble — why this phase
  precedes any Categories UI.

### Domain language and project rules
- `CONTEXT.md` — canonical domain vocabulary. Note that its *Reference Period*, *Deviation* and
  *Baseline* entries and its *Example dialogue* are slated for rewrite in Phase 84; this phase
  introduces `Mese Coperto`, `Mese Parziale` and `Ritmo` as the replacement vocabulary.
- `CLAUDE.md` — Decimal.js hard rule, `dal`/`services`/`actions` layering, language convention,
  and `yarn check:language`.

### Locked prototypes (shape of what will consume the engine)
- `.scratch/dashboard-categories/detail-table.html` — chosen (D19). Shows which engine outputs
  the detail page actually reads: per-month value, month-over-month delta, previous-year row,
  and a summary column of total / monthly average / comparison.
- `.scratch/dashboard-categories/list-row.html` — validated. Shows the list row's consumption:
  total, share, 12-month series, projection.
- `.scratch/dashboard-categories/detail-chart.html` — rejected, kept as the record of why
  (a 60px bar cannot carry "24,30 in meno" as a word, so it would reintroduce the ▲/▼ sign
  convention D-08/D-09 removes).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/dal/overview.ts` — already documents and applies the `current − previous` convention
  ("negative = spent less (saved money)"). D-08 extends this convention rather than inventing one.
- `lib/dal/months-with-data.ts` — existing notion of which months hold data; the closest analog
  to the Covered Month denominator of D-01.
- `tests/amortization-lens-regression.test.ts` and
  `tests/amortization-lens-regression-overview.test.ts` — the v2.9 byte-identical regression
  pattern RETIRE-05 reproduces.
- `tests/dashboard-filters.test.ts` — already exercises `buildDashboardTabHref` parameter
  propagation, including a `tag=5` case that D-14 removes.
- `components/dashboard/overview/resolve-year.ts` — existing `?year=` resolution, the parameter
  Categories will share.
- `OverviewNudge` (`app/(app)/dashboard/overview/page.tsx`) — the established "state what is
  missing and how to get it" pattern the degenerate-coverage state follows.

### Established Patterns
- Queries in `lib/dal/`, business logic in `lib/services/`, thin `"use server"` wrappers in
  `lib/actions/`. New shared computation does not live in page components.
- Money is `Decimal.js` only; Drizzle `DECIMAL(10,2)` returns strings (D-11).
- One row source per lens (ADR 0019) — `ledger_entry` / `ledger_entry_accrual`, no `lens`
  parameter threaded through aggregation, no `source` discriminator column.

### Integration Points
- `lib/dal/dashboard.ts` — hosts `getCategoryRanking`, `getCategoryDeviations`,
  `getDeviationDateRanges`, `DEVIATION_NOISE_THRESHOLD`. The engine lands alongside these; the
  Deviation helpers are **not** removed here (Phase 84, RETIRE-01).
- `components/dashboard/dashboard-tab-nav.tsx` — `buildDashboardTabHref`, the single site for
  D-13 and D-14.
- `components/dashboard/lens-switch.tsx`, `components/dashboard/lens-persistence.ts`, and the
  lens usage in `app/(app)/dashboard/tags/page.tsx`, `app/(app)/dashboard/categories/page.tsx`
  and `app/(app)/dashboard/categories/[id]/page.tsx` — the render sites D-12 confines to Overview.
- `lib/dal/dashboard-filters.ts` and `lib/validations/dashboard.ts` — where `parseDashboardFilters`
  and the Preset vocabulary live. Untouched here beyond what D-12/D-14 require; full retirement
  is Phase 84 (RETIRE-02).

</code_context>

<deferred>
## Deferred Ideas

Belongs to Phase 83 (categories-list):
- The list surface itself — row content, % share, 12-month sparkline, inline projection,
  sort toggle (total ↔ projection), first-import state copy. (DECISIONS D1, D8, D17, D18 ·
  CLIST-01…07)
- Widening direction coverage to three (Uscite / Entrate / Accantonamenti) by replacing
  `eq(direction.includedInTotals, true)` with `eq(direction.hidden, false)`. (DECISIONS D9 ·
  CLIST-04) — **the harness of D-16 must be ready for it.**
- Adding `year` propagation to `buildDashboardTabHref`. (CLIST-05)

Belongs to Phase 84 (category-detail-and-cleanup):
- The 12-month detail table, the 9/6/3-month window with chosen start month, the previous-year
  row, subcategory contributions summing exactly to the parent difference including disappeared
  subcategories. (DECISIONS D14, D16, D19 · CDET-01…07)
- Removing the Deviation / Baseline / Noise Threshold code and the whole Preset machinery, and
  rewriting the retired vocabulary in `CONTEXT.md`. (DECISIONS D15 + "What gets retired" ·
  RETIRE-01, RETIRE-02)

Open UI-phase items from "Deliberately left open" (not this phase):
- Copy set and colour mapping per direction, `allocation` included.
- The name of the "annual estimate vs closed year" comparison (cannot be *delta*, reserved for
  KPI period-over-period, nor *deviation*, retired).
- Visual treatment of the three month states (fact / current hybrid / estimate) and of uncovered
  months — an explicit signal, never a gap.
- URL shape of the detail window (start month + length).
- Fate of the detail page's current `topTransactions` block.
- Whether the list offers an **acceleration** ordering (projection ÷ total) alongside total and
  projection — the second prototype finding.
- Whether the denominator of a gap-affected total/average is stated in words or carried by
  hatching alone; whether the previous-year row shows on short windows; the column-alignment
  problem of "non importato" inside a cell.

</deferred>

## Success Criteria

From `ROADMAP.md` §Phase 82 — what must be TRUE:

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

## Risk Summary

Accepted costs, from ADR 0020 `## Consequences` (recorded here, not as benefits):

- A category containing an amortization reads differently in two tabs of the same dashboard:
  €2.400 in August under Categories (always cassa), €100/month under Overview-competenza. This
  is the deliberate price of D-12 — recorded so a future reader does not "fix" it by re-threading
  the lens.
- The lens stops being a dashboard-global control. ADR 0019's LENS-01 wording no longer describes
  the product; Tags was already a de facto exception (all-time totals make the lens a no-op).
- Slow drift loses its dedicated detector. A category climbing 12% a month for three months shows
  three small month-over-month deltas where the cumulative deviation from baseline would have
  been 40%. The 12-month series and the homologous-window comparison are a mitigation, not an
  equivalence — this is the one capability the retirement gives up.
- Two figures on a page can rest on different bases: with an uncovered month inside a window, the
  **total** is incomplete while the average and projection are correct. Uncovered months therefore
  require an explicit visual signal downstream; a silent gap reads as a month of zero spending.
- The current month is a third visual state — neither fact nor estimate — and the only month whose
  value can change while it is being looked at.
- Debt `D-12` (Reference Period drift: "last month with data" vs "last calendar month") is
  extinguished rather than paid — it disappears with the engine that had it.
- New users see the page in its degenerate state (one Covered Month, no pace, no projection, no
  comparison), treated as a prompt to import rather than a missing feature.

Phase-specific execution risk: the engine touches aggregation sites Overview and Tags read, so a
silent total shift is the failure mode. D-15's regression suite is the mitigation and must be
green before any Categories UI phase begins.

---

*Phase: 82-number-engine-and-regression-gate*
*Context gathered: 2026-07-30 via ADR Ingest Express Path*
