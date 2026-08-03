# Phase 84: category-detail-and-cleanup - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning

> Decision IDs below are Phase-84-local (`D-01…D-19`). Do not confuse them with the `D1…D19`
> numbering of `.planning/dashboard-categories-DECISIONS.md` (cited inline as "DECISIONS D14"),
> with Phase 82's or Phase 83's own `D-nn`, nor with the legacy deferred debt `D-12` in the root
> `CONTEXT.md` — that debt is extinguished by this phase.

<domain>
## Phase Boundary

The **category detail page** is rewritten as a 12-month table: months as columns, the
month-over-month difference inside each cell, a previous-year row on the homologous window, a
9/6/3-month window with a chosen start month, a sticky summary column (total, monthly average,
comparison), and subcategories ordered by weight whose contributions sum exactly to the parent's
difference — including subcategories present in only one of the two compared periods.

Then the **Deviation / Baseline / Noise Threshold / Preset machinery is deleted**: this page was
its last caller (Phase 83 removed the list's dependency), so the phase closes with a repo grep at
zero and the full suite green.

This phase consumes the Phase 82 engine (`lib/dal/covered-months.ts`,
`lib/services/pace-and-projection.ts`) and the Phase 83 surfaces
(`lib/services/category-direction-copy.ts`, `components/dashboard/category-year-select.tsx`,
`components/dashboard/category-coverage-nudge.tsx`). It does **not** re-derive coverage, pace,
projection or the sign convention.

**Requirements in scope:** CDET-01, CDET-02, CDET-03, CDET-04, CDET-05, CDET-06, CDET-07,
RETIRE-01, RETIRE-02.

</domain>

<decisions>
## Implementation Decisions

### The window: URL contract and defaults

- **D-01:** The window is encoded as **two additive params, `?months=` and `?from=`**, mirroring
  the two controls of the locked prototype. `months ∈ {12, 9, 6, 3}`; absent means whole year.
  `from = YYYY-MM`; absent means January of the selected year. The full URL contract of the detail
  page becomes `?year=&months=&from=` — `?type=` stops being read (D-06). Rejected: `?from=&to=`
  (admits 7-month windows the UI cannot represent, so every read needs normalising) and a compact
  `?window=2026-04:6` (custom format, hand-parsed, harder to debug).
  (DECISIONS §"Deliberately left open" · CDET-03)

- **D-02:** Switching from whole-year to a reduced window preselects the window that **ends on the
  current month** (`6 mesi` → feb–lug when today is July). On a closed past year it ends on
  December. The user can then move the start month by hand. Rejected: always January (on July it
  excludes precisely the recent months, so the user must correct it almost every time) and
  "last N covered months" (moves the window unpredictably and reintroduces a query-derived anchor
  of the kind D-12 has just extinguished). (CDET-03)

- **D-03:** The window **never crosses the year boundary**. The start-month select offers only
  months for which the window fits inside the year (`months=6` → gen…lug; `months=3` → gen…ott;
  `months=9` → gen…apr). An out-of-range URL is **clamped to the nearest valid start month**, never
  rejected and never rendered as an error. Rationale: the year is the container of what is seen
  (ADR 0020 §1); crossing it would leave the pace anchored to one year while the table shows months
  of another, and would make "the homologous window of the previous year" straddle two years.
  Rejected also: shortening the window to fit (the control would say "6 mesi" while showing 2, and
  the denominator of average and comparison would change without the control saying so).
  — **Reversibility:** reversible — a parse/clamp rule in one place.

- **D-04:** Changing year from the detail **preserves the window, re-anchored to the new year**
  (same length, same start month, clamped by D-03 if invalid there). Comparing the same window
  across two years is the gesture the window exists for. The **back-link to the list never carries
  `months`/`from`** — the list has no window (DECISIONS D17), and D-02 of Phase 83's coherence test
  ("clicking a row must not change the numbers") is preserved by the fact that arriving from the
  list means no window params, i.e. whole year. (CLIST-07 · CDET-03)

### Page anatomy

- **D-05:** The **`topTransactions` block stays**, below the subcategories, and becomes
  **window-scoped** like every other figure on the page (CDET-03: every figure refers to the
  selected window). It is the only place on the page that descends to the single transaction and
  answers the question that follows an anomalous month: "what was it?". Its query moves from the
  preset contract to the year+window contract. (Closes DECISIONS §"Fate of the detail page's
  current `topTransactions` block")

- **D-06:** The **direction filter disappears from the detail page**. A category already carries
  its direction in the database, so the control could only put the page into an incoherent state.
  Copy and colour come from `resolveCategoryDirectionCopy(<direction of the category>)` (shipped in
  Phase 83); the back-link to the list uses that same direction, so the user always returns to the
  right list. `?type=` is no longer parsed by this page. (DECISIONS D9 · ADR 0020 §10)

- **D-07:** `CategoryDetailSummary` is **subsumed by the sticky summary column** (total, monthly
  average, comparison). No separate KPI header — two sources for the same number is the defect D13
  removes.

- **D-08:** A **chart stays above the table**, and it plots **only the month-by-month difference**
  against the previous year (not the two absolute series). It must consume **the same series
  object the table renders** — never its own query — or the divergence D13 closes reopens.

- **D-09:** The difference chart carries **no sign and no ▲/▼ glyph**. Bars sit above or below the
  zero line and the colour is mapped per direction by `resolveComparisonJudgement` (on `out`, above
  = worse; on `allocation`, above = better). The axis shows absolute amounts; the tooltip says it in
  words ("107,90 in più di lug 2025"); a short legend states what above and below mean, because
  without signs a bar alone is ambiguous. This is what keeps D-08 compatible with D13 / ADR 0020 §10
  ("in the UI, never a sign: magnitude plus a word"). — **Reversibility:** reversible — presentation
  only, no data shape involved.

### The table: month states and words

- **D-10:** When a month inside the window is uncovered, the reduced denominator is **stated in the
  summary column**: the average carries "su {N} mesi coperti" and the total carries a short note
  naming the uncovered month(s). The hatching alone says "this month is different", not "the number
  twelve columns away is computed on one month less" — and this is exactly the accepted cost of D11
  (two figures on the same row resting on different bases). (CDET-06 · DECISIONS D11)

- **D-11:** The **previous-year row renders only when the previous year has at least one Covered
  Month inside the homologous window**. When it has none, a line **stating why** takes its place —
  never a silent disappearance (D18: "not an absent number, a line saying why"). (CDET-02, CDET-07 ·
  DECISIONS D18)

- **D-12:** The comparison's **UI label is period-explicit: "Rispetto al {anno-1}"** — used
  identically on the table's summary column and on the subcategories column. Values stay
  magnitude-plus-word ("180,00 in più" / "19,20 in meno") and still sum to the parent total, which is
  the verifiability property of D16. Rejected: "Differenza" and "Confronto" as the visible label.

- **D-13:** The **canonical glossary and code term is `Confronto`** — already the name in use since
  Phase 82 (`computeComparison`, `resolveComparisonJudgement`), so no new vocabulary is introduced.
  It cannot be called *delta* (reserved for KPI period-over-period) nor *deviation* (retired).
  (Closes DECISIONS §"Deliberately left open" — the naming item)

### Retirement mechanics (RETIRE-01, RETIRE-02)

- **D-14:** **Hard deletion, files removed** — no `@deprecated` intermediate step. Files
  (`components/dashboard/deviation-badge.tsx`, `components/dashboard/dashboard-filters.tsx`) and
  symbols (`getCategoryDeviations`, `getDeviationDateRanges`, `buildDeviationDataset`,
  `buildDeviationMap`, `computeDeviation`, `DEVIATION_NOISE_THRESHOLD`, `DashboardPreset`,
  `DashboardPresetSchema`, `DashboardSortSchema`, `parseDashboardFilters`,
  `dashboardPresetToDateRange` and the preset helpers in `lib/routes.ts` and `lib/utils/date.ts`)
  go. The ROADMAP success criterion is literally "a repository grep confirms zero dead references";
  a deprecation would fail it. History lives in git. — **Reversibility:** costly — undoing means
  restoring symbols across `lib/dal/dashboard.ts`, `lib/validations/dashboard.ts`, `lib/routes.ts`,
  `lib/utils/date.ts`, `lib/utils/dashboard.ts` and their tests; git revert of an isolated
  deletion commit (D-17) is the intended escape hatch.

- **D-15:** The shared aggregation DAL moves from a preset-shaped filter to an **explicit date
  range**: only the preset→range translation disappears, the aggregation functions keep taking a
  period. `getKpis({ preset: 'last-month', type: 'all' })` becomes `getKpis({ from, to, type })`.
  — **Reversibility:** costly — the signature change touches every aggregation call site and both
  regression suites.

- **D-16:** The regression suites that call those DAL functions
  (`tests/amortization-lens-regression.test.ts`, `tests/reimbursement-regression.test.ts`,
  `tests/helpers/reimbursement-test-db.ts`) pass **the same date range `last-month` used to
  produce, and their expected values are not touched**. If a number changes, that is a regression —
  which is precisely the gate RETIRE-02 asks for. Rejected: rewriting them onto the year/window
  contract (changes the period covered and therefore the expected values, losing the property those
  baselines exist for) and a fresh before/after snapshot (a redundant artefact on top of suites that
  already cover those surfaces).

- **D-17:** **Build first, delete second**, in separate plans. The new detail page ships while the
  old symbols are still present but caller-less; the deletion is its own plan with a
  **removals-only diff**, so the grep-at-zero criterion is verifiable and the commit is revertable
  without touching the feature. This is the sequence ROADMAP describes ("loses its last caller").
  Rejected: one combined plan (a broken suite would not say which half broke it — the very risk
  RETIRE-02 isolates).

- **D-18:** **`CONTEXT.md` (repo root) is rewritten in this phase.** Remove Deviation, Baseline,
  Noise Threshold, Preset and Reference Period *in its sense of "the Deviation's anchor"*; add
  Mese Coperto, Mese Parziale, Ritmo, Proiezione, Finestra, Confronto; rewrite the *Example
  dialogue* (built entirely on Deviation and Baseline); mark debt **D-12 as extinguished**.
  RETIRE-01 says the vocabulary disappears "from the interface and from the codebase" — leaving it
  in the canonical glossary would keep alive exactly what the phase retires, and downstream agents
  read that glossary for domain language.

- **D-19:** Exit criteria for the phase: `grep -ri 'deviation\|deviazione\|preset'` over `app`,
  `lib`, `components`, `tests` returns **zero hits**; `yarn typecheck`, the full test suite and
  `yarn check:language` are green; Phase 82's RETIRE-05 byte-identical Overview/Tags baseline still
  passes. (RETIRE-01, RETIRE-02)

### Claude's Discretion

- Exact Italian copy strings: the reduced-denominator notes (D-10), the "why there is no
  previous-year row" line (D-11), the uncovered-month cell text, the difference-chart legend (D-09)
  and the insufficient-previous-year-coverage reason (CDET-07) — following the product's existing
  register and the per-direction copy already centralised in
  `lib/services/category-direction-copy.ts`.
- Visual treatment of the three month states (covered fact / current hybrid / estimate) and of
  uncovered months, taking the locked prototype as the reference: background for the current month,
  grey + italic for estimates, diagonal hatching plus explicit "non importato" text for uncovered.
- How "non importato" is rendered inside a cell without breaking column alignment (an open item
  carried over from the prototype).
- Mobile behaviour of the table (horizontal scroll below ~1040px with the first column sticky left
  and the summary column sticky right, per the prototype) — including whether the sticky summary
  column survives on narrow viewports.
- Whether the 12-month table is a new component or a reshaping of
  `category-detail-trend-chart.tsx`, and whether the difference chart (D-08) reuses that component's
  chart library setup.
- DAL shape: whether the window+previous-year series come from one grouped query or two, and
  whether `getCategoryDetail` is reshaped or replaced — subject to D-08 (one series, consumed by
  both table and chart).
- Test placement and fixture strategy, consistent with `tests/` conventions.
- Plan decomposition inside the D-17 build-then-delete ordering.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The locked model

- `docs/adr/0020-categories-year-view-retires-deviation.md` — the accepted ADR. §1 (year as
  container, window on the detail), §2 (every figure refers to the window), §3 (pace is the year's
  Covered Months, not the window's), §6 (total = sum of the displayed series), §8 (retirement),
  §10 (no signs in the UI, colour per direction).
- `.planning/dashboard-categories-DECISIONS.md` — the fuller 19-decision record. **D11** (coverage
  two-level rule), **D12** (current month = `max(spent, pace)`), **D13** (totals and signs, and the
  average-vs-average robustness that gates only the total difference), **D14** (the window
  redefines every number, and its corollary on the pace), **D15** (the Deviation retirement and its
  accepted loss), **D16** (subcategory weight + contribution, and the arithmetic trap of
  disappeared subcategories), **D18** (first import / stated reason), **D19** (the table is the
  chosen shape, and the three open items it carries into this phase).
- `docs/adr/0019-amortization-accrual-lens.md` — LENS-01 is amended by ADR 0020; the lens is not
  dashboard-global and must not reappear on any Categories path.

### Requirements and sequencing

- `.planning/REQUIREMENTS.md` — CDET-01…07, RETIRE-01, RETIRE-02, and the accepted-loss item
  **CDET-F01** (slow-drift detection is deliberately given up).
- `.planning/ROADMAP.md` §Phase 84 — the five success criteria this phase is verified against.
- `.planning/phases/82-number-engine-and-regression-gate/82-0{1,2,3}-SUMMARY.md` — what the engine
  exposes, its types, and the RETIRE-05 baseline contract.
- `.planning/phases/83-categories-list/83-CONTEXT.md` — the list's decisions; D-12/D-13 there define
  the URL contract this page extends, and its `## Risk Summary` lists the accepted costs that carry
  over unchanged.

### Domain language and project rules

- `CONTEXT.md` (repo root) — canonical domain vocabulary, **rewritten by this phase** (D-18).
- `CLAUDE.md` — Decimal.js for all monetary arithmetic, `dal`/`services`/`actions` layering,
  English code with Italian product surfaces, `yarn check:language` after touching routes,
  comments, tests or developer strings.

### Locked prototypes

- `.scratch/dashboard-categories/detail-table.html` — **the chosen shape (D19)**. Read it before
  designing the table: sticky first column, sticky summary column, delta as a second text line
  inside the cell, three month states, subcategory table with the summing total row. Its
  `## Domande che restano aperte` block is answered by D-10, D-11 and Claude's Discretion above.
- `.scratch/dashboard-categories/detail-chart.html` — **rejected**, kept as the record of why a
  chart cannot honour D13. Read it before designing the D-08 difference chart, to avoid rebuilding
  what was rejected.
- `.scratch/dashboard-categories/list-row.html` — the validated list row (Phase 83), for visual
  consistency between list and detail.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets (shipped, tested)

- `lib/services/pace-and-projection.ts` — `computePaceAndProjection` (discriminated union with an
  unreadable insufficient-coverage branch), `buildCoveredMonthSeries`, `isPartialMonth`,
  `computeCurrentMonthHybrid`, `buildYearSeries`, `computeComparison`, `resolveComparisonJudgement`,
  `PREVIOUS_YEAR_TOTAL_DIFFERENCE_MIN_COVERED_MONTHS` (= 6) and
  `canShowPreviousYearTotalDifference` — the last two gate CDET-07's stated reason.
- `lib/dal/covered-months.ts` — `getCoveredMonthsInYear(year)`, `getCategoryMonthlyAmounts`
  (zero-filled monthly series for one category).
- `lib/services/category-direction-copy.ts` — the single per-direction copy site (Phase 83 D-11);
  the detail's copy goes here, not into components.
- `components/dashboard/category-year-select.tsx`, `category-coverage-nudge.tsx`,
  `category-year-ranking-skeleton.tsx` — Phase 83 surfaces to match visually and reuse.
- `components/dashboard/overview/resolve-year.ts` — how the year is resolved from the URL.
- `tests/pace-engine-lens-regression.test.ts` — the RETIRE-05 baseline that must still pass (D-19).

### Integration points to change

- `app/(app)/dashboard/categories/[id]/page.tsx` — today: `CATEGORY_DETAIL_DEFAULT_PRESET =
  'last-3-months'`, `parseCategoryDetailFilters`, `getCategoryDetail(categoryId, filters)` +
  `getCategoryDeviations`, renders `DashboardFilters`, `CategoryDetailSummary`,
  `CategoryDetailTrendChart`, `CategoryTopTransactions`, `CategorySubcategoryBreakdown`. `year` and
  `lens` are currently raw passthroughs used only for the back-link — `year` becomes a first-class
  read here (D-01), `lens` stays a passthrough.
- `components/dashboard/category-subcategory-breakdown.tsx` — rewritten on weight + contribution
  (D16), must keep disappeared subcategories in the list with their negative contribution.
- `components/dashboard/category-detail-summary.tsx` — removed (D-07).
- `components/dashboard/category-detail-trend-chart.tsx` — becomes the difference chart (D-08/D-09)
  or is replaced by it.
- `lib/dal/dashboard.ts` — `getCategoryDetail` (window+previous-year series), `getCategoryRanking`
  and the other aggregation functions whose filter shape changes under D-15.
- `lib/validations/dashboard.ts` — `parseDashboardFilters` and the preset/sort schemas deleted;
  a `months`/`from` parser added next to the Phase 83 `parseCategoryYear*` helpers.
- `lib/routes.ts` — `buildDashboardCategoryDetailHref` gains the window params; the preset branch
  of `buildDashboardCategoriesHref` goes with the preset machinery.
- `components/dashboard/category-detail-skeleton.tsx` — reshaped for the table layout.

### Must not regress

- `components/dashboard/overview/*` and the Tags surfaces — Phase 82's RETIRE-05 byte-identical
  baseline must still pass after the D-15 signature change.
- No lens parameter on any Categories code path (Phase 82 D-12/D-13, ADR 0020 §7). `?lens=` stays a
  raw back-link passthrough, never resolved to a `ledgerRowSource` here.

</code_context>

<specifics>
## Specific Ideas

- The window controls follow the prototype's shape exactly: a segmented control
  `[Anno intero][9 mesi][6 mesi][3 mesi]`, the year select, and a start-month select that is
  **disabled on "Anno intero"** and whose options are constrained by D-03.
- The summary column of the prototype is the model for D-10: `Totale` and `Media/mese` stacked, each
  able to carry a second line of qualification underneath.
- The subcategory table's **Totale row is not decoration** — it is the on-screen proof that the
  contributions sum to the parent's difference (D16), including the "nuova nel {anno}" and "solo nel
  {anno-1}" cases. Keep it.
- Phase 83 pinned both Categories pages to cash **by construction** — no `ledgerRowSource` argument
  reaches the aggregation calls. Any new DAL function must preserve that property.

</specifics>

<deferred>
## Deferred Ideas

- **Acceleration ordering** (projection ÷ total) as a third sort option on the list — open since
  Phase 83, still a follow-up.
- **Per-month drill-down** (clicking a table cell to see that month's transactions) — raised while
  deciding the fate of `topTransactions` (D-05); a new capability with its own interaction and
  state, larger than this phase's boundary.
- **Slow-drift detection** (CDET-F01) — the capability the Deviation retirement deliberately gives
  up. Recorded as an accepted loss in REQUIREMENTS.md, not as work.
- **Amending D13 to allow explicit signs on charts** — considered and rejected in favour of D-09;
  if a future widget needs it, it is an ADR amendment, not a local choice.

</deferred>

---

*Phase: 84-category-detail-and-cleanup*
*Context gathered: 2026-08-03*
