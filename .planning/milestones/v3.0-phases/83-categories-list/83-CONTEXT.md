# Phase 83: categories-list - Context

**Gathered:** 2026-07-30
**Status:** Ready for planning
**Source:** ADR Ingest Express Path (`docs/adr/0020-categories-year-view-retires-deviation.md`, status `accepted`, 10 decisions parsed)

> Ingest note: ADR 0020 is a narrative ADR with a single `## Consequences` section, so the
> parser bucketed all 7 consequence entries as `consequences_positive`. They are in fact
> **accepted costs**, and are recorded under `## Risk Summary` below rather than as Success
> Criteria. Success Criteria are taken from `ROADMAP.md` §Phase 83.
>
> Decision IDs below are Phase-83-local (`D-01…D-15`) and each cites its upstream source. Do
> not confuse them with the `D1…D19` numbering of `.planning/dashboard-categories-DECISIONS.md`
> (cited inline as "DECISIONS D8" etc.), with Phase 82's own `D-01…D-16`, nor with the legacy
> deferred debt `D-12` in the root `CONTEXT.md` — that debt is extinguished by this milestone.

<domain>
## Phase Boundary

The **Categories list page** is rewritten onto the yearly axis: ranked by the selected year's
total, each row carrying its share of that total, a 12-month sparkline and a year-end
projection, filterable across three directions including the previously-unreachable
`Accantonamenti`, and sharing `?year=` with Overview.

This phase consumes the number engine Phase 82 already shipped (`lib/dal/covered-months.ts`,
`lib/services/pace-and-projection.ts`). It does **not** re-derive pace, projection, coverage or
the sign convention — those are settled and unit-tested upstream.

It ships **no detail-page work** (Phase 84: the 12-month table, the window, subcategory
contributions) and **no code deletion** (Phase 84 RETIRE-01/02: the Deviation and Preset
machinery loses its last caller only once the detail page also stops using it). Phase 83's job
is to make the *list* stop consuming Deviation and Preset — not to remove them from the repo.

**Requirements in scope:** CLIST-01, CLIST-02, CLIST-03, CLIST-04, CLIST-05, CLIST-06, CLIST-07.

</domain>

<decisions>
## Implementation Decisions

### The reading: year in, month out

- **D-01:** The year is the container and the list reads the **whole selected year**. The list
  has no month selection and no rolling preset; the month-level reading lives in the Phase 84
  detail page. (DECISIONS D1 · ADR 0020 §1 · CLIST-01)
- **D-02:** The list's controls are **year + direction only**. No window — the window is the
  detail's analysis tool. The coherence test that distinguishes this rewrite from the bug it
  fixes: **clicking a row must not change the numbers**; a full-year list opens a full-year
  detail. (DECISIONS D17 · ADR 0020 §1 · CLIST-07)
- **D-03:** The list carries **no previous-year comparison column**. Comparison lives in the
  detail's summary column (Phase 84). The list's five row fields are exhaustive (D-04).
  (DECISIONS D8, D14 · ADR 0020 §2)

### What a row carries

- **D-04:** A row is exactly: **name · year total · % of total · 12-month sparkline · year-end
  projection**. The Deviation badge is gone from the row. (DECISIONS D8 · ADR 0020 §1 ·
  CLIST-01, CLIST-02)
- **D-05:** The projection is **inline on the row, not detail-only**. "Where do I spend the
  most" is already known — rent and groceries, every year — while "which category is
  accelerating" is the information the user does not have, and burying it one click down 26
  times makes it unreachable. (DECISIONS D8 · CLIST-02)
- **D-06:** Two monetary figures per row is the accepted cost of D-05, **mitigated by visual
  hierarchy, not eliminated**: the projection renders visually subordinate to the total and is
  **explicitly labelled** as a projection, never left to be mistaken for a second total.
  (DECISIONS D8 · ADR 0020 §1 · CLIST-02)
- **D-07:** The period total shown on a row is the **sum of the displayed 12-month series** —
  Phase 82's `buildYearSeries` returns the total it reduce-sums from the same months array it
  returns. The row must not re-derive the total independently; any divergence between the
  sparkline and the number beside it is a visible bug, not a rounding detail.
  (DECISIONS D13 · ADR 0020 §6 · Phase 82 `buildYearSeries`)

### Ranking, sort and direction

- **D-08:** Default ordering is the **period total** — the page opens on a fact. The alternative
  ordering is the **projection**. Two options, exactly as today: the existing `SortToggle`
  component and pattern are reused, with "Deviazione" replaced by the projection option.
  (DECISIONS D17 · CLIST-03)
- **D-09:** The direction filter offers **Uscite / Entrate / Accantonamenti**. The predicate
  becomes `eq(direction.hidden, false)` — true for `in`/`out`/`allocation`, false for
  `transfer` — replacing `eq(direction.includedInTotals, true)`, which silently excluded
  `allocation` (seeded `includedInTotals: false` in `scripts/seed-data.ts`). Savings and
  investments are the one flow whose target the user actually decides, which makes them the
  highest-value place for a projection. (DECISIONS D9 · ADR 0020 §9 · CLIST-04)
- **D-10:** This predicate flip touches a shared aggregation site. Phase 82's **RETIRE-05
  byte-identical Overview/Tags baseline must still pass unchanged** after the flip — it was
  built explicitly to be re-runnable across this change. (ROADMAP §v3.0 sequencing · Phase 82
  82-01-SUMMARY `provides`)
- **D-11:** **One copy set per direction.** "Where I spend the most", "% of total spent" and an
  outflow-coloured bar are the wrong words on `Risparmio`. Copy and the sign→judgement colour
  mapping are resolved **per direction, centrally, in one place** — no widget carries a local
  copy. Phase 82 shipped `resolveComparisonJudgement(delta, direction)` as that single mapping
  for comparisons; the list's per-direction copy follows the same one-site rule.
  (DECISIONS D9, D13 · ADR 0020 §10 · CLIST-04)

### URL contract

- **D-12:** **Only `year` is shared across tabs.** `month` never enters the URL. The list stops
  reading `?preset=` entirely (pin-by-construction, as Phase 82 did for `?lens=`: no parse, no
  fallback), and `buildDashboardTabHref` must propagate `year` — today it propagates `preset`,
  `type`, `sort` and `lens` but **not** `year`. `?lens=` keeps being carried invisibly so
  Overview-competenza → Categories → back does not land in cassa. (DECISIONS D7 · ADR 0020 §1 ·
  CLIST-05)
- **D-13:** A row's link to the category detail carries the **same year**, so the total read in
  the row is the total read on the detail page. This is the observable form of D-02's coherence
  test. (DECISIONS D17 · CLIST-07)

### Degenerate coverage

- **D-14:** One Covered Month is **not an edge case — it is what every new user sees first**.
  Show what is certain (total, share, a one-point series) **and state explicitly what is missing
  and how to get it**: "with a second imported month you will see the monthly pace and the
  year-end projection". Rejected: silent suppression (the user does not read "I am missing a
  month", they read "this page does nothing") and an empty state (throws away real data over a
  threshold rule). Follow the existing `OverviewNudge` pattern
  (`components/dashboard/overview/overview-nudge.tsx`). (DECISIONS D18 · ADR 0020 §7 · CLIST-06)
- **D-15:** Below 2 Covered Months the engine produces **no estimate at all** — Phase 82's
  `computePaceAndProjection` returns a discriminated-union branch with **no numeric field** on
  the insufficient-coverage outcome, so the UI cannot render a fragile number even by accident.
  Consume that branch; do not coerce it to zero. (DECISIONS D4 · Phase 82 82-01-SUMMARY ·
  CLIST-06)

### Claude's Discretion

- Exact Italian copy strings for each direction (D-11) and for the single-Covered-Month nudge
  (D-14), following the product's existing register.
- Visual treatment of the projection's subordination on the row (D-06) — size, weight, colour,
  label placement — provided it is unmistakably subordinate and explicitly labelled.
- Sparkline rendering details: reuse or adapt `components/dashboard/category-sparkline.tsx`.
- Whether the year+direction ranking is a new DAL function or a reshaped `getCategoryRanking`,
  and whether the 12 monthly points per category come from one grouped query or from
  `getCategoryMonthlyAmounts` per row — subject to not regressing list render cost.
- Loading/skeleton shape, and whether `category-ranking-skeleton.tsx` needs reshaping.
- Test placement and fixture strategy, consistent with `tests/` conventions.

</decisions>

<specifics>
## Specific Ideas

- `.scratch/dashboard-categories/list-row.html` is the **validated** prototype of the row (D19,
  chosen 2026-07-30) — read it before designing the row. It shows the row consuming exactly the
  five D-04 fields with the projection attenuated below the total.
- The existing `SortToggle` in `app/(app)/dashboard/categories/page.tsx` is a local function
  component, not a shared one — reusing "the same component and pattern" (D-08) means keeping
  its shape and swapping the option set, not extracting a new abstraction.
- `getCategoryRanking` already groups by `to_char(occurredAt, 'YYYY-MM')` and returns per-month
  rows, so a 12-point series per category is close to what the current query shape already
  yields — the gap is the preset-derived date range and the direction predicate, not the
  grouping.
- Phase 82 pinned both Categories pages to cash **by construction** — no `ledgerRowSource`
  argument reaches the aggregation calls. Any new DAL function this phase adds must keep that
  property; do not reintroduce a lens parameter on a Categories path.

</specifics>

<canonical_refs>
## Canonical References

### The locked model

- `docs/adr/0020-categories-year-view-retires-deviation.md` — the accepted ADR (10 decisions).
- `.planning/dashboard-categories-DECISIONS.md` — the fuller 19-decision record (D1–D19); D1,
  D7, D8, D9, D13, D17, D18, D19 are the ones this phase implements.
- `docs/adr/0019-amortization-accrual-lens.md` — LENS-01 is **amended** by ADR 0020; the lens is
  no longer dashboard-global.

### Requirements and sequencing

- `.planning/REQUIREMENTS.md` — CLIST-01…07.
- `.planning/ROADMAP.md` §v3.0 and §Phase 83 — success criteria and the regression-gate ordering.
- `.planning/phases/82-number-engine-and-regression-gate/82-0{1,2,3}-SUMMARY.md` — what the
  engine actually exposes, its types, and the RETIRE-05 baseline contract.

### Domain language and project rules

- `CONTEXT.md` (repo root) — canonical domain vocabulary. Deviation, Baseline, Noise Threshold
  and Preset are **retired**; use `Mese Coperto`, `Mese Parziale`, `Ritmo`, `Proiezione`.
- `CLAUDE.md` — Decimal.js for all monetary arithmetic, `dal`/`services`/`actions` layering,
  English code with Italian product surfaces, `yarn check:language` after touching routes,
  comments, tests or developer strings.

### Locked prototypes

- `.scratch/dashboard-categories/list-row.html` — **validated**, the row this phase builds.
- `.scratch/dashboard-categories/detail-table.html` — chosen, Phase 84.
- `.scratch/dashboard-categories/detail-chart.html` — rejected, kept as the record of why.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets (Phase 82, already shipped and tested)

- `lib/dal/covered-months.ts` — `getCoveredMonthsInYear(year)` (user-scoped, lens-independent),
  `getCategoryMonthlyAmounts` (zero-filled monthly series for one category).
- `lib/services/pace-and-projection.ts` — `computePaceAndProjection` (discriminated union with
  an unreadable insufficient-coverage branch), `buildCoveredMonthSeries`, `isPartialMonth`,
  `computeCurrentMonthHybrid`, `buildYearSeries` (total is the reduce-sum of its own months),
  `computeComparison`, `resolveComparisonJudgement`,
  `PREVIOUS_YEAR_TOTAL_DIFFERENCE_MIN_COVERED_MONTHS`, `canShowPreviousYearTotalDifference`.
- `components/dashboard/category-sparkline.tsx` — existing sparkline.
- `components/dashboard/overview/overview-nudge.tsx` — the D-14 nudge pattern.
- `components/dashboard/overview/resolve-year.ts` — how Overview resolves the selected year.
- `tests/pace-engine-lens-regression.test.ts` — the RETIRE-05 baseline (D-10).

### Integration points to change

- `app/(app)/dashboard/categories/page.tsx` — currently `CATEGORIES_DEFAULT_PRESET =
  'last-3-months'`, `CATEGORIES_DEFAULT_SORT = 'deviation'`, `categoryTypeOptions` = Uscite +
  Entrate only, calls `getCategoryRanking(filters)` and `getCategoryDeviations({ type })`, and
  hosts the local `SortToggle`.
- `components/dashboard/category-ranking-list.tsx` — renders `DeviationBadge` at line ~157.
- `lib/dal/dashboard.ts` `getCategoryRanking` (line ~1040) — reads
  `dashboardPresetToDateRange(filters.preset)` and filters
  `eq(direction.includedInTotals, true)`; both change under D-09/D-12.
- `lib/validations/dashboard.ts` `parseDashboardFilters` — the preset/sort parser the list must
  stop depending on.
- `components/dashboard/dashboard-tab-nav.tsx` / `buildDashboardTabHref` — must propagate
  `year` (D-12).
- `lib/routes.ts` `buildDashboardCategoriesHref` / `buildDashboardCategoryDetailHref` — the href
  builders whose filter shape changes with the year contract.

### Not to be touched here

- `components/dashboard/deviation-badge.tsx`, `getCategoryDeviations`, `getDeviationDateRanges`,
  `buildDeviationDataset`, `DEVIATION_NOISE_THRESHOLD`, and the Preset machinery
  (`dashboardPresetToDateRange`, `DashboardPreset`, `dashboard-filters.tsx`) — **still called by
  the detail page** (`app/(app)/dashboard/categories/[id]/page.tsx`,
  `category-subcategory-breakdown.tsx`). Deletion is Phase 84 (RETIRE-01/02), once the last
  caller is gone.
- `components/dashboard/overview/*` and the Tags surfaces — must stay byte-identical (D-10).

</code_context>

<deferred>
## Deferred Ideas

- **Acceleration ordering** (projection ÷ total) as a third sort option — left open in
  `.planning/dashboard-categories-DECISIONS.md` §"Deliberately left open". D-08 locks two
  options for this phase; a third is a follow-up, not a Phase 83 task.
- **The 12-month detail table, the 9/6/3 window, subcategory contributions** — Phase 84
  (CDET-01…07).
- **Deleting the Deviation / Baseline / Noise Threshold / Preset code and glossary entries** —
  Phase 84 (RETIRE-01, RETIRE-02).
- **Naming the "annual estimate vs closed year" comparison** — it cannot be called *delta*
  (reserved for KPI period-over-period) nor *deviation* (retired). It does not appear on the
  list (D-03), so the naming decision belongs to Phase 84.
- **Fate of the detail page's `topTransactions` block** — Phase 84.
- **Previous-year coverage threshold behaviour** — Phase 82 shipped the ≥6 constant and its
  predicate; it gates a figure that only the detail page renders.

</deferred>

<scope_fence>
## Scope Fence

**In scope:** the Categories list page and its ranking data path — year+direction ranking,
share of total, 12-month sparkline, inline projection, three-way direction switch, sort toggle
(total | projection), `?year=` propagation across tabs, the single-Covered-Month state, and the
row→detail link preserving the year.

**Out of scope, and a plan that touches them has drifted:**
- Any change to the category **detail** page beyond receiving the year in its URL.
- Deleting Deviation/Preset symbols or their glossary entries (Phase 84).
- Any change to Overview or Tags output — RETIRE-05 must stay byte-identical (D-10).
- Reintroducing a lens parameter on any Categories code path (Phase 82 D-12/D-13).
- Adding a `source` discriminator column to the `ledger_entry_*` views (explicitly rejected by
  ADR 0020 §7 / DECISIONS D5).
- Month selection, rolling presets, or a window on the list (D-01, D-02).

</scope_fence>

## Success Criteria

Taken from `ROADMAP.md` §Phase 83:

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

## Risk Summary

Accepted costs, from ADR 0020 `## Consequences` (see the ingest note above) and from the
DECISIONS record — recorded so a future reader does not "fix" them:

- **Two figures on a row can rest on different bases.** With an uncovered month inside the year,
  the **total** is incomplete while the average and the projection are correct. Uncovered months
  therefore need an explicit visual signal on the sparkline — a silent gap reads as a month of
  zero spending. (D-14's sibling case: the list must not present an incomplete total as a
  complete one.)
- **The current month is a third visual state** — neither a fact like past months nor an
  estimate like future ones, and the only month whose value can change while it is being looked
  at (`computeCurrentMonthHybrid` = `max(spent so far, pace)`).
- **A category containing an amortization reads differently in two tabs of the same dashboard**:
  €2.400 in August under Categories (always cash), €100/month under Overview-competenza. This is
  the deliberate price of confining the lens to Overview.
- **The pace is more fragile on `allocation`**: deposits and divestments net under the same
  subcategory, so selling an ETF drags a month negative. Accepted when widening to three
  directions (D-09).
- **Slow drift loses its dedicated detector.** A category climbing 12% a month for three months
  produces three small month-over-month deltas where the cumulative deviation from baseline
  would have been 40%. The 12-month sparkline makes the climb visible, but this is a mitigation,
  not an equivalence — it is the capability the Deviation's retirement gives up.
- **New users see the page in its degenerate state** (one Covered Month, no pace, no
  projection). Treated as a prompt to import the next month, not as a missing feature (D-14).
- **The `direction.hidden` predicate flip touches a shared aggregation site** — the single
  highest-risk change in this phase, which is why RETIRE-05 exists and must be re-run (D-10).
