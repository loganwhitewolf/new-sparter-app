---
phase: 84-category-detail-and-cleanup
plan: 2
subsystem: ui
tags: [nextjs, drizzle, decimal.js, category-detail, difference-chart, sticky-table]

requires:
  - phase: 84-category-detail-and-cleanup
    provides: "Plan 84-01's ?year=&months=&from= URL contract, getCategoryDetailYearWindow's
      current-window series/pace/projection, CategoryDetailTable row 1, the sticky-column table
      mechanic — this plan fills in the three typed placeholders (previousYear/subcategories/
      topTransactions) it left behind"
  - phase: 82-number-engine-and-regression-gate
    provides: canShowPreviousYearTotalDifference, PREVIOUS_YEAR_TOTAL_DIFFERENCE_MIN_COVERED_MONTHS,
      computeComparison, resolveComparisonJudgement, getCoveredMonthsInYear, getCategoryMonthlyAmounts
provides:
  - "CategoryDetailYearWindowData.previousYear (real D-11/D-12 comparison, replacing Plan 84-01's
    null placeholder): status-gated homologous-window series, totalDifference gated by
    canShowPreviousYearTotalDifference, averageDifference always present"
  - "CategoryDetailYearWindowData.subcategories (real D-16 contribution array, replacing Plan
    84-01's [] placeholder): union of current/previous subcategory ids, contribution =
    computeComparison(current, previous), exact-sum by construction"
  - "CategoryDetailYearWindowData.topTransactions (real D-05 window-scoped list, replacing Plan
    84-01's [] placeholder): reuses lib/dal/dashboard.ts's CategoryDetailTopTransaction shape and
    query pattern verbatim, parameterized on the window's {from,to}"
  - "CategoryDetailTable rows 2 (previous-year homologous window) and 3 (Differenza), gated per
    D-11/D-12/CDET-07"
  - "CategorySubcategoryBreakdown rewritten onto contributions/year props (D-16), Totale row
    proves the exact-sum property on screen"
  - "CategoryDetailDifferenceChart: zero-centered bar chart of month-over-month vs-previous-year
    deltas, consuming the SAME series the table renders (D-08), no sign glyphs (D-09)"
  - "CategoryDetailSkeleton reshaped for the chart+table+subcategory-table layout (D-07's KPI
    header removal)"
affects: [84-03-retire-deviation-baseline, 84-04-context-glossary-rewrite]

actuals:
  tokens: 6600
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Shape-based DB-mock routing (inspect the `.select({...})` columns object's own keys,
      e.g. 'subCategoryId' vs 'occurredAt' vs 'type') instead of call-order-based rowsQueue
      shifting — necessary because getCategoryDetailMeta has its own internal
      `await verifySession()` before its db.select() call, which reorders db.select()
      invocations relative to the plan's other synchronous query helpers inside the same
      Promise.all. First use of this pattern in this test file; documented inline for the next
      DAL test that combines a cached sibling function with raw new queries in one Promise.all."
    - "Exact-sum-by-construction subcategory contributions (D-16): summing ALREADY-ROUNDED
      (2-decimal) computeComparison() results telescopes exactly to
      computeComparison(sum(current), sum(previous)) with zero drift, since money strings never
      carry more than 2 decimal places — no post-hoc reconciliation/rounding-correction code
      needed, unlike a naive 'round then hope it matches' approach."
    - "Zero-centered bar chart (CategoryDetailDifferenceChart): position (above/below baseline)
      encodes sign, fill color encodes resolveComparisonJudgement per direction, magnitude is bar
      height — the D-09 pattern for representing a signed comparison with no sign glyph anywhere,
      reusable for any future month-over-month delta visualization."

key-files:
  created:
    - components/dashboard/category-detail-difference-chart.tsx
    - tests/category-subcategory-breakdown.test.tsx
    - tests/category-detail-difference-chart.test.tsx
  modified:
    - lib/dal/category-detail-year-window.ts
    - components/dashboard/category-detail-table.tsx
    - components/dashboard/category-subcategory-breakdown.tsx
    - components/dashboard/category-detail-skeleton.tsx
    - app/(app)/dashboard/categories/[id]/page.tsx
    - tests/category-detail-year-window-dal.test.ts
    - tests/category-detail-table.test.tsx
    - tests/category-detail-components.test.tsx

key-decisions:
  - "The chart's delta is null (a flat marker) whenever EITHER side's month lacks a real amount —
    not just when the whole previousYear row is unavailable — correcting the plan's own literal
    `?? '0.00'` pseudocode, which would have fabricated a zero comparison against an uncovered
    previous-year month (contradicts D-10's 'never zero-fill an uncovered month' precedent
    already established in Plan 84-01)."
  - "CategorySubcategoryBreakdown gained an explicit `year` prop beyond the plan's declared
    {contributions, type} shape — the 'Totale {year}'/'nuova nel {year}'/'solo nel {year-1}'
    copy needs the WINDOW's year, and falling back to `new Date().getFullYear()` would mislabel
    every past year the user can reach via `?year=`."
  - "The DAL test's previous-year fixture uses a flat 350.00/month series rather than reproducing
    the locked prototype's own row values verbatim — the prototype's printed Totale (4.284,00)
    does not equal the sum of its own 12 printed cells (4.274,00), a static-mockup inconsistency
    documented in 84-RESEARCH.md's 'two examples contained real defects' note. A clean,
    self-consistent fixture keeps the test's expected values independently hand-verifiable."
  - "getSubcategoryWindowAmounts/getWindowTopTransactions wrap their DB calls in try/catch
    returning [] on error, matching the resilience convention already used by
    getCategoryDetailMeta/getCategoryMonthlyAmounts/getCoveredMonthsInYear — an unhandled
    rejection from either new query would otherwise break the whole detail page."

patterns-established:
  - "Shape-based db.select() mock routing for tests combining a cached sibling DAL function
    (with its own internal await) alongside synchronous raw-query helpers in one Promise.all."

requirements-completed: [CDET-01, CDET-02, CDET-04, CDET-05, CDET-07]

coverage:
  - id: D1
    description: "getCategoryDetailYearWindow's previousYear field: D-11 gate (zero Covered
      Months in the homologous window -> unavailable), D-12 totalDifference (gated by
      canShowPreviousYearTotalDifference) and averageDifference (always present regardless of
      that gate)"
    requirement: "CDET-02"
    verification:
      - kind: unit
        ref: "tests/category-detail-year-window-dal.test.ts#previousYear (D-11/D-12) (Task 1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "getCategoryDetailYearWindow's subcategories field: union of current/previous
      subcategory ids, contribution via computeComparison, exact-sum property (a previous-only
      and a current-only subcategory both included, 0% weight for previous-only)"
    requirement: "CDET-05"
    verification:
      - kind: unit
        ref: "tests/category-detail-year-window-dal.test.ts#subcategories (D-16) (Task 1)"
        status: pass
    human_judgment: false
  - id: D3
    description: "getCategoryDetailYearWindow's topTransactions field: window-scoped (never the
      full year), title fallback chain, reuses CategoryDetailTopTransaction from
      lib/dal/dashboard verbatim"
    requirement: "CDET-05"
    verification:
      - kind: unit
        ref: "tests/category-detail-year-window-dal.test.ts#topTransactions (D-05) (Task 1)"
        status: pass
    human_judgment: false
  - id: D4
    description: "CategoryDetailTable rows 2 (previous-year, stated-reason line when
      unavailable) and 3 (Differenza, Totale gated / Media always shown, labelled 'Rispetto al
      {anno-1}')"
    requirement: "CDET-02"
    verification:
      - kind: unit
        ref: "tests/category-detail-table.test.tsx#previous-year row and Differenza row (Task 2)"
        status: pass
    human_judgment: false
  - id: D5
    description: "CategorySubcategoryBreakdown rewritten onto contributions/year props: zero
      Deviazione/DeviationBadge references, Totale row proves the exact-sum property on screen,
      current-only/previous-only presence suffixes"
    requirement: "CDET-04"
    verification:
      - kind: unit
        ref: "tests/category-subcategory-breakdown.test.tsx (Task 2)"
        status: pass
    human_judgment: false
  - id: D6
    description: "CategoryDetailDifferenceChart: zero sign glyphs adjacent to a formatted amount,
      flat marker for a null delta, tooltip magnitude+word, legend stating above/below meaning"
    requirement: "CDET-07"
    verification:
      - kind: unit
        ref: "tests/category-detail-difference-chart.test.tsx (Task 3)"
        status: pass
    human_judgment: true
    rationale: "SVG bar-height proportionality and color-per-direction are visually verified by
      unit assertions on markup content only; the actual rendered proportions/colors against
      real category data are not confirmed by a human in this autonomous run — see Manual
      Verification Not Performed below."
  - id: D7
    description: "Page wiring: CategoryDetailDifferenceChart above the table, CategoryTopTransactions
      below the subcategory breakdown sourced from data.topTransactions, zero remaining imports of
      CategoryDetailSummary/CategoryDetailTrendChart in this file"
    requirement: "CDET-05"
    verification:
      - kind: unit
        ref: "grep -n \"CategoryDetailSummary\\|CategoryDetailTrendChart\" \"app/(app)/dashboard/categories/[id]/page.tsx\" (zero matches, Task 3)"
        status: pass
    human_judgment: false

duration: ~30min
completed: 2026-08-03
status: complete
---

# Phase 84 Plan 2: Category Detail — Previous-Year Comparison, Subcategory Contributions, Difference Chart Summary

**The category detail page's build half completes: a previous-year comparison row with the D-11/D-12 stated-reason gates, a subcategory contribution table that provably sums to the parent's total difference, a zero-centered no-sign-glyph difference chart sharing the table's own series, and window-scoped top transactions — all three of Plan 84-01's typed placeholders now real data.**

## Performance

- **Duration:** ~30 min across three tasks, no checkpoints (fully autonomous)
- **Completed:** 2026-08-03T12:50:00Z
- **Tasks:** 3 (all `type="auto" tdd="true"`)
- **Files modified:** 11 (3 created, 8 modified)

## Accomplishments

- `getCategoryDetailYearWindow`'s `previousYear`/`subcategories`/`topTransactions` fields are now real, tested data: the previous-year homologous window (D-11 gate: zero Covered Months -> `unavailable`, else a plain-amount series with D-12's gated `totalDifference`/always-present `averageDifference`), the subcategory contribution array (D-16: union of current/previous subcategory ids, `contribution = current − previous`, exact-sum-by-construction), and the window-scoped top-5 transactions (D-05, reusing `lib/dal/dashboard.ts`'s `CategoryDetailTopTransaction` type and query pattern verbatim).
- `CategoryDetailTable` gains two more rows: previous-year (muted plain amounts, or a single stated-reason row when unavailable — never a silent gap) and Differenza (Totale gated by `canShowPreviousYearTotalDifference`, Media always shown, both labelled "Rispetto al {anno-1}" per D-12).
- `CategorySubcategoryBreakdown` fully rewritten: drops `deviations`/`DeviationBadge` entirely, renders a real `<table>` with weight bar / "Totale {year}" / "Contributo alla differenza" columns, and a Totale row that visibly proves the D-16 exact-sum property.
- New `CategoryDetailDifferenceChart`: a zero-centered SVG bar chart deriving its series entirely from `data.current.months`/`data.previousYear` (D-08, no second query) — bar position (above/below baseline) encodes sign, fill color encodes `resolveComparisonJudgement` per direction, no `▲`/`▼`/`+`/`-` glyph anywhere (D-09), with a per-bar tooltip and a legend line.
- `CategoryDetailSkeleton` reshaped to a chart placeholder + 12-month table placeholder (3 rows) + subcategory-table placeholder; the old 3-KPI-card section removed (D-07: the sticky summary column already subsumes it).
- Page wired end to end: chart above the table, subcategory breakdown below it, top transactions below that; confirmed zero remaining imports of `CategoryDetailSummary`/`CategoryDetailTrendChart` in `page.tsx`.
- Scope boundary held: `DashboardFilters`, `getCategoryDeviations`, `getCategoryDetail`, `dashboard-filters.tsx`, `deviation-badge.tsx`, `dashboardPresetToDateRange` remain untouched everywhere (grep-verified after every task).

## Task Commits

1. **Task 1: DAL — previous-year comparison, subcategory contributions, window-scoped top transactions** - `8be73e4c` (feat)
2. **Task 2: Table — previous-year row, Differenza row; subcategory breakdown rewrite** - `6e90fac8` (feat)
3. **Task 3: Difference chart, skeleton reshape, page wiring** - `d4a411d9` (feat)

**Plan metadata:** commit pending (this SUMMARY + STATE.md + ROADMAP.md)

## Files Created/Modified

- `lib/dal/category-detail-year-window.ts` - `getCategoryDetailYearWindow` fills in `previousYear`/`subcategories`/`topTransactions`; new private helpers `getSubcategoryWindowAmounts`/`getWindowTopTransactions`; new exported types `CategoryDetailPreviousYearComparison`, `CategoryDetailPreviousYearSeries`, `CategoryDetailPreviousYearTotalDifference`, `CategoryDetailSubcategoryContribution`, `CategoryDetailSubcategoryPresence`
- `components/dashboard/category-detail-table.tsx` - rows 2 (previous-year) and 3 (Differenza) added
- `components/dashboard/category-subcategory-breakdown.tsx` - rewritten onto `contributions`/`year`/`type` props, table layout with summing Totale row
- `components/dashboard/category-detail-difference-chart.tsx` - new `CategoryDetailDifferenceChart`
- `components/dashboard/category-detail-skeleton.tsx` - reshaped for chart+table+subcategory-table layout
- `app/(app)/dashboard/categories/[id]/page.tsx` - wires chart, table, subcategory breakdown, top transactions
- `tests/category-detail-year-window-dal.test.ts` - previousYear/subcategories/topTransactions test coverage, shape-based db mock routing
- `tests/category-detail-table.test.tsx` - previous-year row and Differenza row coverage
- `tests/category-subcategory-breakdown.test.tsx` - new, full coverage of the rewritten component
- `tests/category-detail-difference-chart.test.tsx` - new, chart coverage
- `tests/category-detail-components.test.tsx` - stale `CategorySubcategoryBreakdown` coverage (old `subcategories`/`deviations` shape) removed; other components' coverage untouched

## Decisions Made

- Chart delta is `null` whenever either side's month lacks a real amount (current uncovered OR previous-year month uncovered OR the whole previousYear row unavailable) — not just the whole-row-unavailable case the plan's literal pseudocode covered, avoiding a fabricated zero comparison against an uncovered month.
- `CategorySubcategoryBreakdown` gained an explicit `year` prop beyond the plan's declared `{contributions, type}` shape, sourced from the page's own resolved `year` variable — required for the "Totale {year}" header and presence-suffix copy to stay correct on past-year views.
- The DAL test's previous-year fixture uses a flat, self-consistent 350.00/month series instead of the locked prototype's own row values, which do not actually sum to the prototype's own printed Totale (a documented prototype defect, not a new one introduced here).
- Both new DAL query helpers wrap their `db.select()` calls in try/catch returning `[]` on error, matching this file's and this codebase's existing resilience convention for optional/degradable DAL reads.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Chart delta guards against a null previous-year-month amount, not just a null whole-row status**
- **Found during:** Task 3, implementing `CategoryDetailDifferenceChart`
- **Issue:** The plan's action block computes `delta = data.previousYear.status === 'available' ? computeComparison(data.current.months[i].amount ?? '0.00', data.previousYear.series.months[i].amount) : null` — this passes `data.previousYear.series.months[i].amount` (which can itself be `null` for an uncovered previous-year month) directly into `computeComparison`, which expects two strings. It would also silently fabricate a `'0.00'` comparison for an uncovered CURRENT month, contradicting D-10's "never zero-fill an uncovered month" principle already established in Plan 84-01.
- **Fix:** `buildBars()` returns `delta: null` whenever `month.amount === null`, or the homologous previous-year month is missing/uncovered (`previousMonth.amount === null`), in addition to the whole-row `unavailable` case.
- **Files modified:** `components/dashboard/category-detail-difference-chart.tsx`
- **Verification:** `tests/category-detail-difference-chart.test.tsx` — "a previousYear: unavailable fixture renders a flat marker for every month, never a thrown error or an omitted column" (3/3 `<rect>` elements render, including the uncovered 'mar' month)
- **Committed in:** `d4a411d9` (Task 3 commit)

**2. [Rule 2 - Missing Critical] `CategorySubcategoryBreakdown` gained an explicit `year` prop**
- **Found during:** Task 2, rewriting `CategorySubcategoryBreakdown`
- **Issue:** The plan's declared props are `{ contributions: CategoryDetailSubcategoryContribution[]; type: 'in'|'out' }`, but the required copy ("Totale {year}", "nuova nel {year}", "solo nel {year-1}") needs an actual year value. Defaulting to `new Date().getFullYear()` would mislabel every past-year view the user can reach via `?year=` on this very page.
- **Fix:** Added `year: number` as a required prop, passed from `page.tsx`'s already-resolved `year` variable (the same one driving the URL contract).
- **Files modified:** `components/dashboard/category-subcategory-breakdown.tsx`, `app/(app)/dashboard/categories/[id]/page.tsx`, `tests/category-subcategory-breakdown.test.tsx`
- **Verification:** `tests/category-subcategory-breakdown.test.tsx` — all copy assertions pass with an explicit `year={2026}` fixture
- **Committed in:** `6e90fac8` (Task 2 commit)

**3. [Rule 1 - Bug] Pre-existing `tests/category-detail-components.test.tsx` broken by `CategorySubcategoryBreakdown`'s prop rewrite**
- **Found during:** Task 2, running `tsc --noEmit` after the rewrite
- **Issue:** This file (not in the plan's `files_modified` list) had its own coverage of the OLD `CategorySubcategoryBreakdown` shape (`subcategories`/`deviations`/`DeviationBadge`), which no longer type-checks or applies once the component's props changed — a direct, unavoidable consequence of this plan's own Task 2 instruction, not a pre-existing unrelated failure.
- **Fix:** Removed the three `CategorySubcategoryBreakdown`-specific tests and the shared subcategory-empty-state half of a combined test; coverage of that component moved to the new dedicated `tests/category-subcategory-breakdown.test.tsx`. All other components' tests in this file (`CategoryDetailSummary`, `CategoryDetailTrendChart`, `CategoryTopTransactions`, `CategoryDetailEmptyState`, `CategoryDetailSkeleton`) left untouched.
- **Files modified:** `tests/category-detail-components.test.tsx`
- **Verification:** `tsc --noEmit` clean; full `vitest run` green (185 files, 2249 tests, 1 pre-existing todo)
- **Committed in:** `6e90fac8` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 bug — chart null-guard, 1 missing-critical — year prop, 1 bug — stale test fixup)
**Impact on plan:** All three were necessary to make the plan's own acceptance criteria pass as stated (never fabricate a comparison against a missing amount; render correct year-specific copy; keep the full suite green). No scope creep — every touched file is either in the plan's declared `files_modified` or a direct, unavoidable consequence of a declared file's own change.

## Issues Encountered

None beyond the three deviations above.

## Manual Verification Not Performed

The plan's overall `<verification>` block lists a manual step: "load a category detail with a previous year having partial coverage and confirm the Differenza row's Totale shows a stated reason while Media shows a real number; confirm the chart's legend and tooltip wording read as intended." This plan carried no `checkpoint:human-verify` task (Pattern A, fully autonomous), and a meaningful browser check requires an authenticated session against real seeded data that this autonomous run did not attempt to provision. The equivalent behavior IS unit-tested directly (`tests/category-detail-table.test.tsx`'s insufficient/shown fixtures, `tests/category-detail-difference-chart.test.tsx`'s legend/tooltip assertions) and is coverage item D6 above with `human_judgment: true`. Recommend a quick manual pass on `/dashboard/categories/[id]?year=<a year with partial previous-year coverage>` before shipping the milestone.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The category detail page's full CDET-01…07 reading experience is complete: 3-row table, difference chart, subcategory contribution table, window-scoped top transactions.
- No retired symbol (`DashboardFilters`, `getCategoryDeviations`, `getCategoryDetail`, `dashboard-filters.tsx`, `deviation-badge.tsx`, `dashboardPresetToDateRange`) was touched — grep-verified after every task. They remain fully intact and callerless from this page, exactly as Plan 84-03/84-04 (D-17) expects for the removals-only retirement diff.
- `CategoryDetailSummary`/`CategoryDetailTrendChart` component FILES are still present but have zero callers from this page (not this plan's job to delete — D-17, Plan 84-04).
- No blockers for Plan 84-03 (retire Deviation/Baseline machinery).

---
*Phase: 84-category-detail-and-cleanup*
*Completed: 2026-08-03*

## Self-Check: PASSED

All 12 files listed in Files Created/Modified confirmed present on disk; all 3 task commit hashes (`8be73e4c`, `6e90fac8`, `d4a411d9`) confirmed in `git log`.
