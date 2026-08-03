---
phase: 84-category-detail-and-cleanup
plan: 4
subsystem: dashboard-categories
tags: [retirement, cleanup, dead-code-removal, glossary, playwright]

requires:
  - phase: 84-category-detail-and-cleanup
    provides: "Plan 84-03's re-signed shared aggregation DAL ({from,to,type} instead of a
      DashboardFilters/preset object) — the last thing keeping the Deviation/Preset symbols
      caller-adjacent before this plan's removals-only diff"
provides:
  - "components/dashboard/dashboard-filters.tsx, deviation-badge.tsx, category-detail-summary.tsx,
    category-detail-trend-chart.tsx and their 3 dedicated test files deleted; zero remaining
    callers verified by grep before each deletion"
  - "lib/utils/dashboard.ts stripped of computeDeviation/buildDeviationMap/DeviationResult/
    DeviationReferenceRow/DeviationBaselineRow; roundedPercent/computeSavingsRate/
    computeDeltaPercent/computeBreakdownPercentages (live DAL + overview-kpi-derive consumers)
    unchanged"
  - "lib/utils/date.ts / lib/validations/dashboard.ts / lib/routes.ts stripped of
    DASHBOARD_PRESETS/DashboardPreset/dashboardPresetToDateRange and the preset-mode href
    branch + preset/defaultPreset/defaultSort fields; year-mode is now the sole contract"
  - "CONTEXT.md's Confronto glossary entry added (D-13); the last Flagged-ambiguities open item
    (the annual-comparison naming question) closed"
  - "D-19 identifier-scoped exit grep verified clean (with a documented allowlist correction);
    full suite green, typecheck clean, check:language clean, RETIRE-05 canary untouched"
affects: []

actuals:
  tokens: 17400
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Year-mode-only href contract in lib/routes.ts — the preset-mode branch and its three
      filter fields (preset/defaultPreset/defaultSort) are gone; the omitted-year fallback
      returns the bare route, byte-identical to the old empty-filters degenerate case."

key-files:
  created: []
  modified:
    - components/dashboard/dashboard-filters.tsx (deleted)
    - components/dashboard/deviation-badge.tsx (deleted)
    - components/dashboard/category-detail-summary.tsx (deleted)
    - components/dashboard/category-detail-trend-chart.tsx (deleted)
    - tests/dashboard-filters.test.ts (deleted)
    - tests/deviation-badge.test.tsx (deleted)
    - tests/dashboard-utils.test.ts (deleted)
    - tests/category-detail-components.test.tsx
    - lib/utils/dashboard.ts
    - lib/utils/date.ts
    - lib/validations/dashboard.ts
    - lib/routes.ts
    - tests/dashboard-year-contract.test.ts
    - tests/dashboard-dal.test.ts
    - tests/amortization-lens-regression.test.ts
    - tests/reimbursement-regression.test.ts
    - tests/helpers/reimbursement-test-db.ts
    - tests/dashboard.spec.ts
    - CONTEXT.md
    - components/transactions/transaction-table.tsx
    - components/dashboard/category-breakdown-chart.tsx

key-decisions:
  - "buildDashboardCategoriesHref/buildDashboardCategoryDetailHref's omitted-year fallback
    returns the bare APP_ROUTES.dashboardCategories route (no params) instead of leaving the
    function partial — matches the OLD behavior for a preset-mode call with no non-default
    filters byte-for-byte, and avoids an implicit-undefined return path since `year` stays
    optional in the type (every live caller always sets it)."
  - "MonthOverMonthChange's deleted 'Distinto dalla Deviation' sentence gets NO replacement
    clause, per the plan's explicit instruction — the two measures operate at different scopes
    and a new cross-reference (even against Confronto) would reintroduce the same conflation
    risk the deleted sentence existed to guard against."

patterns-established: []

requirements-completed: [RETIRE-01, RETIRE-02]

coverage:
  - id: D1
    description: "The 4 dead component files and 3 dead test files no longer exist in the
      repository; lib/utils/dashboard.ts keeps only its live-consumer exports"
    requirement: "RETIRE-01"
    verification:
      - kind: unit
        ref: "test -f on all 4 deleted component files (No such file, Task 1)"
        status: pass
      - kind: unit
        ref: "grep -n computeDeviation/buildDeviationMap/Deviation* lib/utils/dashboard.ts (zero
          matches); grep -n computeSavingsRate/computeDeltaPercent/computeBreakdownPercentages
          (3 matches, unchanged), Task 1"
        status: pass
      - kind: unit
        ref: "yarn test tests/category-detail-components.test.tsx --run (4/4 pass, Task 1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "lib/utils/date.ts, lib/validations/dashboard.ts and lib/routes.ts carry no
      preset-mode code; every live app/component caller (already year-mode-only) unaffected"
    requirement: "RETIRE-02"
    verification:
      - kind: unit
        ref: "grep -n DASHBOARD_PRESETS/DashboardPreset lib/utils/date.ts lib/routes.ts (zero
          matches); periodToDateRange/ExpensePeriod untouched (matches present), Task 2"
        status: pass
      - kind: unit
        ref: "grep -n DashboardPresetSchema/DashboardFiltersSchema/DashboardSortSchema/
          parseDashboardFilters lib/validations/dashboard.ts (zero matches);
          parseCategoryYearDirection/parseCategoryYearSort untouched (matches present), Task 2"
        status: pass
      - kind: unit
        ref: "yarn test tests/dashboard-year-contract.test.ts --run (13/13 pass, Task 2)"
        status: pass
      - kind: integration
        ref: "yarn typecheck (0 errors across the whole repo, Task 2 + Task 3)"
        status: pass
    human_judgment: false
  - id: D3
    description: "CONTEXT.md's last open item (the annual-comparison naming question) is closed
      with the term Confronto; the D-19 identifier-scoped exit grep is clean (documented
      allowlist correction); full suite green, typecheck clean, check:language clean, RETIRE-05
      canary untouched and passing"
    requirement: "RETIRE-01"
    verification:
      - kind: unit
        ref: "grep -c Confronto CONTEXT.md (2, up from 0); grep -n 'non ha ancora un nome'
          CONTEXT.md (zero matches); grep -n 'Distinto dalla Deviation' CONTEXT.md (zero
          matches) while getMonthOverMonthCategoryChanges still matches, Task 3"
        status: pass
      - kind: integration
        ref: "yarn typecheck && yarn test --run (182 files, 2184 passed + 1 pre-existing todo)
          && node scripts/check-code-language.mjs — all exit 0, Task 3"
        status: pass
      - kind: unit
        ref: "tests/pace-engine-lens-regression.test.ts --run (5/5 pass, zero diff across the
          whole phase, Task 3)"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-08-03
status: complete
---

# Phase 84 Plan 4: Retire Deviation/Preset Files, Close CONTEXT.md's Naming Gap, Run the Exit Gate Summary

**Removals-only diff: 4 dead components + 3 dead test files deleted, `lib/utils/dashboard.ts`/`lib/utils/date.ts`/`lib/validations/dashboard.ts`/`lib/routes.ts` stripped of every Deviation/Baseline/Preset symbol, `CONTEXT.md` gains the Confronto glossary entry closing the milestone's last open naming question, and the phase's D-19 identifier-scoped exit grep runs clean.**

## Performance

- **Duration:** ~15 min across three tasks, no checkpoints (fully autonomous)
- **Completed:** 2026-08-03T15:19:26+02:00
- **Tasks:** 3 (all `type="auto"`)
- **Files modified:** 21 (7 deleted, 14 modified)

## Accomplishments

- Deleted `components/dashboard/dashboard-filters.tsx`, `deviation-badge.tsx`,
  `category-detail-summary.tsx`, `category-detail-trend-chart.tsx` and their dedicated test
  files (`tests/dashboard-filters.test.ts`, `tests/deviation-badge.test.tsx`,
  `tests/dashboard-utils.test.ts`) — each preceded by a repo-wide grep proving zero remaining
  callers outside the file itself and `tests/category-detail-components.test.tsx` (rewritten,
  not deleted: `CategoryDetailEmptyState`/`CategoryDetailSkeleton`/`CategoryTopTransactions`
  coverage kept unchanged, the two dead-component describe blocks dropped).
- `lib/utils/dashboard.ts`: deleted `computeDeviation`/`buildDeviationMap` and the
  `DeviationResult`/`DeviationReferenceRow`/`DeviationBaselineRow` types; kept
  `roundedPercent`/`computeSavingsRate`/`computeDeltaPercent`/`computeBreakdownPercentages`
  (live consumers: `lib/dal/dashboard.ts`, `components/dashboard/overview/overview-kpi-derive.ts`).
- `lib/utils/date.ts`: deleted `dashboardPresetToDateRange`/`DASHBOARD_PRESETS`/`DashboardPreset`;
  `periodToDateRange`/`ExpensePeriod` (an unrelated preset-shaped concept used by
  `lib/dal/expenses.ts`) untouched. `lib/validations/dashboard.ts`: deleted
  `DashboardPresetSchema`/`DashboardTypeSchema`/`DashboardSortSchema`/`DashboardFiltersSchema`/
  `parseDashboardFilters` and their inferred types; `CategoryYearDirectionSchema`/
  `CategoryYearSortSchema`/`parseCategoryYearDirection`/`parseCategoryYearSort` untouched.
  `lib/routes.ts`: deleted the preset-mode body of both href builders and the
  `preset`/`defaultPreset`/`defaultSort` fields — every live app/component caller already always
  passes `year`, so this changes no observed behavior.
- `tests/dashboard-year-contract.test.ts`: deleted the one surviving preset-mode href test.
- `CONTEXT.md`: added the **Confronto** glossary entry (D-13) — `corrente − precedente`,
  magnitude+word, "Rispetto al {anno-1}", identical on the summary column and subcategory
  contributions, distinguished from *delta* and the retired *Deviation*; closed the Flagged
  Ambiguities open item; dropped `MonthOverMonthChange`'s stale "Distinto dalla Deviation"
  contrast sentence with no replacement clause (per the plan's explicit instruction — the two
  measures operate at different scopes).
- `tests/dashboard.spec.ts`: removed the entire stale `Dashboard - DASH-02: Category breakdown`
  Playwright describe block (5 tests spanning `?preset=`-based dashboard/categories assertions,
  a "Periodo dashboard" combobox, and tab-link `?preset=` propagation) — its premise has been
  false since Phase 82's `buildDashboardTabHref` rewrite and doubly so after this plan's
  `lib/routes.ts` deletion; dropped the now-orphaned `collectPageErrors` helper alongside it.
- Ran the D-19 identifier-scoped exit grep from 84-RESEARCH.md; full suite green (182 files,
  2184 passed + 1 pre-existing todo, down from the 185-file/2241-total baseline captured at
  Plan 84-03's HEAD); `yarn typecheck` clean; `yarn check:language` clean;
  `tests/pace-engine-lens-regression.test.ts` (RETIRE-05 canary) has zero diff across the whole
  phase and still passes 5/5.

## Task Commits

1. **Task 1: Delete dead component files and their tests; surgically trim lib/utils/dashboard.ts** - `613e8f01` (feat)
2. **Task 2: Delete dashboardPresetToDateRange/DASHBOARD_PRESETS, the preset validations, and the preset href branch in lib/routes.ts** - `c666ca3c` (feat)
3. **Task 3: CONTEXT.md Confronto glossary entry, Playwright hygiene, D-19 exit gate** - `b8312ff7` (docs)

**Plan metadata:** commit pending (this SUMMARY + STATE.md + ROADMAP.md)

## Files Created/Modified

- `components/dashboard/dashboard-filters.tsx` — deleted (zero remaining callers)
- `components/dashboard/deviation-badge.tsx` — deleted (zero remaining callers)
- `components/dashboard/category-detail-summary.tsx` — deleted (subsumed by the sticky summary column, D-07)
- `components/dashboard/category-detail-trend-chart.tsx` — deleted (replaced by the difference chart, D-08)
- `tests/dashboard-filters.test.ts` — deleted (tested the deleted component)
- `tests/deviation-badge.test.tsx` — deleted (tested the deleted component)
- `tests/dashboard-utils.test.ts` — deleted (tested only computeDeviation/buildDeviationMap)
- `tests/category-detail-components.test.tsx` — rewritten: dropped CategoryDetailSummary/CategoryDetailTrendChart imports and describe blocks; CategoryDetailEmptyState/CategoryDetailSkeleton/CategoryTopTransactions coverage unchanged
- `lib/utils/dashboard.ts` — computeDeviation/buildDeviationMap/Deviation* types deleted; live-consumer exports unchanged
- `lib/utils/date.ts` — dashboardPresetToDateRange/DASHBOARD_PRESETS/DashboardPreset deleted; periodToDateRange/ExpensePeriod untouched
- `lib/validations/dashboard.ts` — DashboardPresetSchema/DashboardTypeSchema/DashboardSortSchema/DashboardFiltersSchema/parseDashboardFilters deleted; CategoryYear* schemas untouched
- `lib/routes.ts` — preset-mode branch + preset/defaultPreset/defaultSort fields deleted; year-mode is the sole contract
- `tests/dashboard-year-contract.test.ts` — deleted the one preset-mode href test
- `tests/dashboard-dal.test.ts` — deleted the direct unit test of dashboardPresetToDateRange's January-boundary edge case (Rule 1 — tested the retired function itself)
- `tests/amortization-lens-regression.test.ts` — rewired dashboardPresetToDateRange('last-month') calls onto the existing lastMonthRange() test helper (Rule 1/3 — unanticipated live caller)
- `tests/reimbursement-regression.test.ts` — same rewiring, 18 call sites (Rule 1/3 — unanticipated live caller)
- `tests/helpers/reimbursement-test-db.ts` — fixed a stale doc comment naming the just-deleted dashboardPresetToDateRange (Rule 1)
- `tests/dashboard.spec.ts` — removed the stale DASH-02 describe block + the now-orphaned collectPageErrors helper
- `CONTEXT.md` — added the Confronto glossary entry (D-13); closed the Flagged Ambiguities naming item; dropped MonthOverMonthChange's stale Deviation contrast sentence
- `components/transactions/transaction-table.tsx` — fixed a stale doc comment referencing the deleted category-detail-summary.tsx (Rule 1)
- `components/dashboard/category-breakdown-chart.tsx` — dead/orphaned component (zero importers anywhere) type-imported the retired DashboardType; replaced with an inline literal union (Rule 3 — blocking-issue fix, no behavior change, no resurrection of retired vocabulary)

## Decisions Made

- `buildDashboardCategoriesHref`/`buildDashboardCategoryDetailHref`'s omitted-year fallback
  returns the bare route (no params) rather than being left partial — this is byte-identical to
  the OLD preset-mode behavior for a call with no non-default filters, and keeps the function
  total instead of implicitly returning `undefined` when `year` is omitted (a case no live
  caller exercises, but a real degenerate-input correctness gap the plan's literal "delete
  everything after the early return" instruction would otherwise have left behind).
- `MonthOverMonthChange`'s deleted "Distinto dalla Deviation" sentence gets NO replacement
  clause, including no new cross-reference against Confronto — the two measures operate at
  different scopes (month-over-previous-calendar-month vs. window-over-homologous-previous-
  year-window) and a new contrast would reintroduce the same conflation risk the deleted
  sentence existed to guard against, per the plan's explicit instruction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/3 - Unanticipated live callers] `dashboardPresetToDateRange` had 3 more callers than the plan's inventory**
- **Found during:** Task 2 (`yarn typecheck` after deleting `dashboardPresetToDateRange`)
- **Issue:** The plan's `<read_first>` grep inventory for Task 2 only listed
  `tests/dashboard-year-contract.test.ts` as a test-side caller. Three more files directly
  imported and called `dashboardPresetToDateRange` (not just through
  `captureAggregationSnapshot`, which Plan 84-03 already rewired):
  `tests/amortization-lens-regression.test.ts` (2 call sites),
  `tests/reimbursement-regression.test.ts` (18 call sites), and
  `tests/dashboard-dal.test.ts` (1 direct unit test of the function's January-boundary
  wraparound behavior).
- **Fix:** The 2+18 call sites in the regression suites were rewired onto
  `lastMonthRange()` — the byte-identical test-local helper Plan 84-03 already added to
  `tests/helpers/reimbursement-test-db.ts` for exactly this purpose — preserving every
  expected value (D-16's gate). The direct unit test in `tests/dashboard-dal.test.ts` was
  deleted outright (it tested the retired function itself, not a surviving caller of it —
  there is nothing left to rewire it onto).
- **Files modified:** `tests/amortization-lens-regression.test.ts`,
  `tests/reimbursement-regression.test.ts`, `tests/dashboard-dal.test.ts`
- **Verification:** `yarn typecheck` clean; both regression suites ran against the real
  Postgres harness in this environment and passed (27/27); `tests/dashboard-dal.test.ts`
  passed (33/33, one fewer than its prior 34).
- **Committed in:** `c666ca3c` (Task 2 commit)

**2. [Rule 3 - Blocking issue] `components/dashboard/category-breakdown-chart.tsx` type-imported the retired `DashboardType`**
- **Found during:** Task 2 (`yarn typecheck`)
- **Issue:** This component has zero importers anywhere in the repo (confirmed by
  `grep -rln "category-breakdown-chart"` — no hits outside its own file) and no test
  coverage; it predates the nature/direction model (added Phase 4, `426843a1`). It
  type-imported `DashboardType` from `lib/validations/dashboard.ts`, which this task deletes.
- **Fix:** Replaced the import with an inline literal union (`'out' | 'in' | 'all'`) — no
  behavior change, and it does not resurrect the retired type under a new name (`DashboardType`
  is not part of the D-19 grep's identifier list, so this choice has no bearing on the exit
  gate either way).
- **Files modified:** `components/dashboard/category-breakdown-chart.tsx`
- **Verification:** `yarn typecheck` clean.
- **Committed in:** `c666ca3c` (Task 2 commit)

**3. [Rule 1 - Stale doc comments] Two comments referenced files/functions this plan deletes**
- **Found during:** Task 1 (`components/transactions/transaction-table.tsx`) and Task 3
  (`tests/helpers/reimbursement-test-db.ts`, surfaced by the D-19 exit grep)
- **Issue:** `transaction-table.tsx` had a doc comment "Mirrors the movementLabel pattern in
  components/dashboard/category-detail-summary.tsx" — a file this task deletes.
  `tests/helpers/reimbursement-test-db.ts`'s `lastMonthRange()` doc comment named
  `dashboardPresetToDateRange('last-month')` by identifier, which the D-19 exit grep correctly
  flagged as a surviving reference to a retired symbol (in a comment, not code).
- **Fix:** Rewrote both comments to describe their intent without naming the deleted
  file/function.
- **Files modified:** `components/transactions/transaction-table.tsx`,
  `tests/helpers/reimbursement-test-db.ts`
- **Verification:** D-19 exit grep re-run clean after the second fix; `yarn typecheck`/eslint clean for both.
- **Committed in:** `613e8f01` (transaction-table.tsx, Task 1), `b8312ff7` (reimbursement-test-db.ts, Task 3)

---

**Total deviations:** 4 auto-fixed (2 unanticipated-live-caller rewires/deletions, 1 blocking-issue type fix, 2 stale-comment fixes grouped as one item).
**Impact on plan:** All auto-fixes were necessary to keep `yarn typecheck`/the D-19 exit grep genuinely green rather than superficially so. No scope creep — every fix was directly caused by this plan's own deletions.

## Issues Encountered

**D-19 exit grep allowlist gap (documentation issue, not a code issue).** The plan's Task 3
`<verify>` command hardcodes a two-file allowlist
(`tests/dashboard-year-contract.test.ts`, `tests/category-direction-copy.test.ts`) for guard-test
literals that assert the retirement rather than exercise it. Running that literal command
surfaces 6 non-empty lines, all from `tests/category-detail-link.test.ts` — three pre-existing
Phase-83 guard tests (`expect(source).not.toContain('getCategoryDeviations')`) checking that
`app/(app)/dashboard/categories/page.tsx`, `category-ranking-list.tsx`, and
`category-list-controls.tsx` never re-introduce a dependency on the retired machinery. These are
structurally identical to the two files the plan's own allowlist already carves out — the plan
simply omitted this third file from its allowlist regex. Confirmed via an extended allowlist
(adding `tests/category-detail-link\.test\.ts` to the exclusion) that the grep is clean:
zero non-guard references to any retired identifier remain anywhere in `app`, `lib`,
`components`, `tests`.

**Literal command output (for the record):**
```
tests/category-detail-link.test.ts:45:  test('the Categories list page contains no DeviationBadge/getCategoryDeviations/?preset= literal', () => {
tests/category-detail-link.test.ts:49:    expect(source).not.toContain('getCategoryDeviations')
tests/category-detail-link.test.ts:53:  test('the category ranking row list contains no DeviationBadge/getCategoryDeviations/?preset= literal', () => {
tests/category-detail-link.test.ts:57:    expect(source).not.toContain('getCategoryDeviations')
tests/category-detail-link.test.ts:61:  test('the extracted list controls module contains no DeviationBadge/getCategoryDeviations/?preset= literal', () => {
tests/category-detail-link.test.ts:65:    expect(source).not.toContain('getCategoryDeviations')
```

**Extended-allowlist result (the actual exit criterion):** zero output lines.

## Test-count delta (deletion, not regression)

Baseline confirmed by checking out Plan 84-03's HEAD (`f48d97e2`) into a scratch worktree and
running the full suite there: **185 files / 2240 passed + 1 todo (2241 total)**. After this
plan: **182 files / 2184 passed + 1 todo (2185 total)** — a drop of 3 files and 56 tests,
entirely accounted for by this plan's own deletions:

| File | Tests removed | Reason |
|---|---|---|
| `tests/dashboard-filters.test.ts` | 36 | whole file deleted (tested the deleted `DashboardFilters` component) |
| `tests/deviation-badge.test.tsx` | 5 | whole file deleted (tested the deleted `DeviationBadge` component) |
| `tests/dashboard-utils.test.ts` | 9 | whole file deleted (tested only `computeDeviation`/`buildDeviationMap`) |
| `tests/category-detail-components.test.tsx` | 4 | 2 `CategoryDetailSummary` tests + 2 `CategoryDetailTrendChart` tests removed; file kept, other 4 tests unchanged |
| `tests/dashboard-year-contract.test.ts` | 1 | the one surviving preset-mode href test removed |
| `tests/dashboard-dal.test.ts` | 1 | direct unit test of `dashboardPresetToDateRange`'s January-boundary case removed |
| **Total** | **56** | |

No test was removed for any reason other than testing code this plan (or Plan 84-03/84-02)
retired. Every surviving test in every touched file still passes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- RETIRE-01/RETIRE-02 both satisfied: zero dead references to the retired Deviation/Baseline/
  Noise-Threshold/Preset vocabulary remain in `app`/`lib`/`components`/`tests` outside the
  documented guard/allowlist literals; the four aggregation functions Plan 84-03 re-signed keep
  working on the explicit `{from,to,type}` contract with no preset translation layer left
  anywhere in the codebase.
- `CONTEXT.md`'s glossary is fully rewritten for v3.0 (D-18 complete across Plans 82-84): no
  open naming questions remain in Flagged Ambiguities.
- This is the last plan of Phase 84 and of the v3.0 milestone (Categories Year View). All three
  phases (82, 83, 84) are now complete. No blockers for `/gsd-complete-milestone v3.0` other
  than the pre-existing, milestone-independent items already tracked in PROJECT.md (operator
  deploy R038/R039/R041, the pre-existing Playwright `net::ERR_TOO_MANY_REDIRECTS` auth/proxy
  redirect loop unrelated to this work).

---
*Phase: 84-category-detail-and-cleanup*
*Completed: 2026-08-03*

## Self-Check: PASSED

All 4 deleted component files and 3 deleted test files confirmed absent (`test -f` reports
"No such file" for each). All 15 modified files confirmed present on disk. All 3 task commit
hashes (`613e8f01`, `c666ca3c`, `b8312ff7`) confirmed in `git log`.
