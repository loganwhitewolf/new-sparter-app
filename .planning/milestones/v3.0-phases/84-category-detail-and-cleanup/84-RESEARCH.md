# Phase 84: category-detail-and-cleanup - Research

**Researched:** 2026-08-03
**Domain:** Dashboard category detail page rewrite + retirement of Deviation/Baseline/Noise/Preset machinery
**Confidence:** HIGH

## Summary

Phase 84 rewrites the category detail page as a 12-month table with month-over-month deltas, previous-year comparison rows, a 9/6/3-month window control, and subcategory contributions that sum exactly to the parent category's difference — then removes the Deviation, Baseline, Noise Threshold and Preset filter machinery entirely from the codebase (the detail page was its last caller).

The phase is bounded by two locked decisions that drive all implementation: **D-17** (build the feature first, delete the retired symbols in a separate plan) and **D-15** (the DAL signature change from preset-shaped to explicit date-range parameters). This research provides the concrete inventories the planner needs to decompose both plans without reopening any of the 19 locked decisions.

**Primary recommendation:** The planner should decompose this phase into **two sequential plans**, following D-17:
1. **Build Plan** (new detail page with year+window contract, consuming Phase 82/83 engines)
2. **Delete Plan** (removal-only diff, all retired symbols deleted, full suite green at exit)

This decomposition makes the retirement exit criterion verifiable and leaves a single clean commit per plan.

### Corrections applied 2026-08-03 (orchestrator verification pass)

The first draft of this document was verified against the codebase and corrected. Six findings the
planner **must** carry into the plans:

1. **`getMonthlyTrendByNature` was missing from the D-15 inventory** — it takes a bare `preset`, has
   live regression call sites, and needs its own re-signing task. (§D-15 Blast Radius)
2. **`getOverview` in `lib/dal/dashboard.ts` is dead code** — the live one is `lib/dal/overview.ts:130`.
   Three symbols move from "signature change" to plain deletion: materially cheaper. (§D-15)
3. **D-16 is trivial, but has a blocking prerequisite** — the regression helper already receives the
   identical `dateRange`; however `dashboardPresetToDateRange` has ~20 live test call sites and needs a
   byte-identical local replacement before it can be deleted. (§D-15, Example 3)
4. **Deleting `getCategoryDeviations` changes the regression snapshot shape** (10 → 9 keys) while D-16
   requires surviving values to stay byte-identical. Array/object alignment is the trap. (§D-15)
5. **D-19's literal grep can never return zero** — `MonthMultiPicker` uses "preset" in an unrelated
   sense, and five guard references *assert* the retirement. A falsifiable identifier-scoped command is
   given in §D-19 Exit Criterion (corrected); the file inventory is in §RETIRE-01 File Inventory.
6. **Two code examples contained real defects** — Example 2 was off by a full year on the default
   whole-year window; Example 4 used native JS arithmetic on money inside the exact-summation function.
   Both corrected in place with the reasoning retained.

## User Constraints (from CONTEXT.md)

### Locked Decisions
All 19 phase-local decisions (D-01…D-19) in CONTEXT.md are locked. No alternatives are being researched. Key constraints for planning:

- **D-01/D-02/D-03:** URL contract is `?year=&months=&from=` (months ∈ {12,9,6,3}, from = YYYY-MM). Window defaults to whole year; when reduced, it ends on current month, clamped to fit inside the year boundary.
- **D-04:** Year selection preserves the window, re-anchored to the new year; back-link to list never carries window params (CLIST-07).
- **D-05:** topTransactions block stays, becomes window-scoped; answer is "what was that anomalous month?" per cell.
- **D-06:** Direction filter disappears; copy comes from `resolveCategoryDirectionCopy()` (Phase 83); `?type=` is no longer parsed here.
- **D-07:** CategoryDetailSummary component is removed; sticky summary column subsumes it.
- **D-08/D-09:** Chart plots only month-by-month difference against previous year, colours per direction via `resolveComparisonJudgement`, no sign glyphs.
- **D-10/D-11:** Uncovered months carry explicit "non importato" text; previous-year row shows when previous year has ≥1 Covered Month in homologous window; when insufficient (< 6 months), shows a line stating why instead of silent disappearance.
- **D-12/D-13:** Comparison label is period-explicit "Rispetto al {anno-1}"; code term is `Confronto`, not delta or deviation.
- **D-14:** Hard deletion (no `@deprecated` step) of files and symbols listed below — history lives in git.
- **D-15:** DAL signature change: `getKpis({ preset, type })` → `getKpis({ from, to, type })`.
- **D-16:** Regression tests pass the same date range `last-month` used to produce, expected values untouched; differences are regressions.
- **D-17:** Build first, delete second, separate plans, removals-only diff on deletion.
- **D-18:** `CONTEXT.md` rewritten; Deviation/Baseline/Noise/Preset/Reference Period (in its "Deviation's anchor" sense) removed; debt D-12 marked extinguished.
- **D-19:** Exit: `grep -ri 'deviation|deviazione|preset'` over `app`, `lib`, `components`, `tests` returns zero; `yarn typecheck`, full suite, `yarn check:language` green; Phase 82 RETIRE-05 byte-identical baseline still passes.
  **⚠ As literally written this criterion cannot pass — see §D-19 Exit Criterion (corrected) below.
  The intent is achievable; the naive grep is not.**

### Claude's Discretion
- Exact Italian copy strings (D-10, D-11, D-09, uncovered cell text, insufficient-previous-year reason).
- Visual treatment of three month states and uncovered months (per locked prototype reference).
- How "non importato" is rendered without breaking column alignment (carried-over open item from prototype).
- Mobile table behaviour (sticky columns, horizontal scroll below ~1040px).
- Component composition (whether 12-month table is new or a reshape of `category-detail-trend-chart.tsx`).
- DAL shape (one grouped query or two for window + previous year).
- Test placement and fixture strategy.
- Plan decomposition inside D-17 build-then-delete ordering.

### Deferred Ideas (OUT OF SCOPE)
- Acceleration ordering (projection ÷ total) on the list.
- Per-month drill-down (clicking a table cell for that month's transactions).
- Slow-drift detection (CDET-F01 — deliberately given up by Deviation retirement).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Year+window URL contract parsing | Frontend Server (SSR) | — | Page-level URL read, state captured in params |
| Month-by-month table rendering | Browser / Client | — | DOM composition, column alignment, sticky headers |
| Comparison computation (current - previous) | API / Backend (DAL) | — | Date-range scoped query, Decimal.js arithmetic |
| Pace/projection lookup | API / Backend (DAL) | — | Phase 82 engine, read-only from `pace-and-projection.ts` |
| Covered-month awareness | API / Backend (DAL) | — | Phase 82 engine, `getCoveredMonthsInYear()` determines visual month states |
| Subcategory contribution summing | API / Backend (DAL) | — | Monthly series per subcategory, aggregated differences |
| Direction-aware copy/colour | API / Backend (Services) | Frontend Server | `resolveCategoryDirectionCopy()` and `resolveComparisonJudgement()` (Phase 83 + Phase 82) |
| Retired symbol cleanup | Codebase (all tiers) | — | Hard deletion spanning DAL, services, components, validations, utils |

## Standard Stack

### Core (consumed from prior phases)
| Library / Module | Version/Location | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `lib/services/pace-and-projection.ts` | Phase 82 | Pace, projection, comparison computation, judgment resolution | Single source of truth for monetary arithmetic, Decimal.js hardened |
| `lib/dal/covered-months.ts` | Phase 82 | getCoveredMonthsInYear(), getCategoryMonthlyAmounts() | Scoped coverage per year, zero-filled monthly series |
| `lib/services/category-direction-copy.ts` | Phase 83 | resolveCategoryDirectionCopy() | Unified per-direction Italian copy (direction-specific detail text) |
| `components/dashboard/category-year-select.tsx` | Phase 83 | Year selector, consistent visual style | Already Phase 83 verified |
| `components/dashboard/category-coverage-nudge.tsx` | Phase 83 | Visual cues for insufficient coverage | Already Phase 83 verified |

### Supporting (to be built)
| Component / Function | Purpose | When to Use |
|---------|---------|-------------|
| `components/dashboard/category-detail-window-controls.tsx` | Segmented control (Anno intero / 9 / 6 / 3 mesi) + start-month select | D-01/D-02/D-03 implementation |
| `components/dashboard/category-detail-table.tsx` | 12-month table with delta cells, previous-year row, sticky columns | CDET-01/CDET-02/CDET-06/CDET-07 implementation |
| `components/dashboard/category-detail-difference-chart.tsx` | Month-by-month delta chart (current - previous year) | D-08/D-09 implementation |
| `lib/dal/category-detail-year-window.ts` | DAL query for window+previous-year series, contribution arithmetic | CDET-03/CDET-04/CDET-05 implementation |
| `lib/validations/category-year-window.ts` | Month/from parser, clamp logic (D-03) | D-01/D-03 implementation |

### Will Be Deleted (D-14)

> **Corrected 2026-08-03 by orchestrator verification pass.** The first draft of this table and of
> the D-15 inventory below understated both. Every row here was re-confirmed by direct
> grep/read. See **§D-15 Blast Radius (verified)** and **§RETIRE-01 File Inventory (verified)**
> for the authoritative lists; this table is the file/symbol summary.

| File / Symbol | Current Purpose | Delete Justification |
|---------|---------|-------------|
| `components/dashboard/dashboard-filters.tsx` | Preset + direction filter UI | Detail page no longer reads presets or direction |
| `components/dashboard/deviation-badge.tsx` | "Deviation is new / on target / off threshold" glyph | Deviation machinery entirely removed |
| `components/dashboard/category-detail-summary.tsx` | KPI header (total, count, average) | Subsumed by sticky summary column (D-07) |
| `lib/validations/dashboard.ts` (DashboardFilters, DashboardPreset, DashboardSort schemas + parseDashboardFilters) | URL → preset + sort mapping | No more presets on Categories; Overview/Tags are unaffected |
| `lib/utils/date.ts` (`dashboardPresetToDateRange`, DEVIATION_*, PRESET_* constants) | Preset → [from, to] translation | Presets deleted. **⚠ `dashboardPresetToDateRange` has ~20 live call sites in the regression tests — see the D-16 mechanic below before deleting it.** |
| `lib/utils/dashboard.ts` (buildDeviationMap, computeDeviation, DEVIATION_NOISE_THRESHOLD, buildDeviationDataset) | Deviation computation, dataset building | Deviation machinery deleted entirely |
| `lib/dal/dashboard.ts` (`getCategoryDeviations`, `getDeviationDateRanges`, `buildDeviationDataset`) | Deviation query, date-range lookup, dataset builder | No caller remains after detail page rewrite. **⚠ `getCategoryDeviations` removal changes the regression snapshot shape — see the D-16 tension below.** |
| `lib/dal/dashboard.ts` (`getOverview`, `getOverviewComparisonRanges`, `previousDashboardPresetDateRange`) | Preset-shaped overview totals | **Dead / test-only — verified below. Plain deletion, NOT a D-15 signature change.** |
| `lib/routes.ts` (preset-specific href builders, buildDashboardCategoryDetailHref preset branch) | Preset-scoped link generation | Replaced by year+window contract |

---

### D-15 Blast Radius (verified)

**Functions in `lib/dal/dashboard.ts` whose filter shape actually changes** (preset-shaped → explicit
range). The first draft named only the first three:

| Function | Line | Current signature | Live call sites |
|---|---|---|---|
| `getCategoriesBreakdown` | 1181 | `(filters: DashboardFilters, ledgerRowSource?)` | `tests/amortization-lens-regression.test.ts:176,202` · `tests/helpers/reimbursement-test-db.ts:310` |
| `getCategoryRanking` | 1246 | `(filters: DashboardFilters, ledgerRowSource?)` | `tests/amortization-lens-regression.test.ts:177,203` · `tests/helpers/reimbursement-test-db.ts:311` |
| `getCategoryDetail` | 1510 | `(categoryId, filters: DashboardFilters, ledgerRowSource?)` | `app/(app)/dashboard/categories/[id]/page.tsx:85` · `tests/amortization-lens-regression.test.ts:179,205` · `tests/helpers/reimbursement-test-db.ts:313` |
| **`getMonthlyTrendByNature`** | **1756** | **`(preset: DashboardPreset, ledgerRowSource?)`** | **`tests/amortization-lens-regression.test.ts:180,206` · `tests/helpers/reimbursement-test-db.ts:314`** |

`getMonthlyTrendByNature` was **missing from the first draft entirely**. It takes a bare `preset`
(not a filters object), so its D-15 rewrite is `(range: { from, to }, ledgerRowSource?)` — a different
shape change from the other three. The planner must treat it as its own task.

**Unaffected — already explicit-range, do NOT touch:** `getOverviewAmountTotals(userId, from, to, ledgerRowSource)`
(line 498), `getUncategorizedCount(userId, from, to)` (line 476), `buildOverviewData`, `buildBreakdownData`,
`buildCategoryRankingData`, `buildCategoryYearRankingData`, `buildMonthlyTrendData`,
`buildMonthlyNatureTrendData`, `buildCategoryDetailData`, `getCategoryYearRanking` (Phase 83, year-shaped).
These carry the RETIRE-05 byte-identical baseline; leaving them alone is what keeps it passing.

#### `getOverview` in `dashboard.ts` is dead code — cheaper path

The live Overview DAL is **`lib/dal/overview.ts:130`**, `getOverview(year, ledgerRowSource)` — that is
what `app/(app)/dashboard/overview/page.tsx:84` imports (`from '@/lib/dal/overview'`) and what
`tests/overview-dal.test.ts` and `tests/amortization-lens-regression-overview.test.ts` exercise.

Verified: **no module imports `getOverview` from `@/lib/dal/dashboard`.** The preset-shaped
`getOverview` at `lib/dal/dashboard.ts:1161` has zero importers. Its only dependency chain is:

```
getOverview (dead, line 1161)
  └── getOverviewComparisonRanges (line 359, exported)
        └── previousDashboardPresetDateRange (line 326, module-private)
```

`getOverviewComparisonRanges` has exactly one importer: **`tests/dashboard-dal.test.ts:121`**
(assertions at lines 135 and 145). It is therefore *test-only-live*.

**Consequence for the planner:** these three symbols are **plain deletions in the RETIRE plan, not
D-15 signature changes** — materially cheaper than the first draft implied. Deleting them also
requires removing the `getOverviewComparisonRanges` cases in `tests/dashboard-dal.test.ts:119–145`.
Note `overview.ts` still imports `buildOverviewData` and `getOverviewAmountTotals` from `dashboard.ts`
(lines 21–25) — those stay.

#### `getCategoryDeviations` deletion collides with D-16

Call sites: `app/(app)/dashboard/categories/[id]/page.tsx:86`,
`tests/amortization-lens-regression.test.ts:178,204`, `tests/helpers/reimbursement-test-db.ts:312`.

The helper's `captureAggregationSnapshot` returns an object with a **`getCategoryDeviations` key**
(`tests/helpers/reimbursement-test-db.ts:326`). Deleting the function removes a key from the snapshot
shape, while D-16 requires every *surviving* key's expected value to stay byte-identical. These are
compatible but must be done deliberately:

- Remove the `getCategoryDeviations` entry from the `Promise.all` array **and** from the returned
  object literal — the snapshot goes from 10 aggregation functions to 9.
- Remove the two `getCategoryDeviations` assertions in `tests/amortization-lens-regression.test.ts`
  (lines 178 and 204, cash and accrual arms).
- **Do not renumber, reorder or re-baseline any other key.** The destructuring array and the returned
  object must stay positionally aligned after the removal — an off-by-one here silently reassigns
  every subsequent snapshot value and would look like a mass regression.

#### D-16 is mechanically trivial — the range is already identical by construction

The first draft framed D-16 as "compute the same range". Verified: **the regression tests already do
exactly that.** Both suites compute

```typescript
const dateRange = dashboardPresetToDateRange('last-month')
```

(`tests/reimbursement-regression.test.ts:108,191,214,243,308…` · `tests/amortization-lens-regression.test.ts:66,131`
· `tests/pace-engine-lens-regression.test.ts:297`) and pass `dateRange` into
`captureAggregationSnapshot`, which **already** forwards it explicitly to
`getOverviewAmountTotals(userId, dateRange.from, dateRange.to, …)` (line 309) while separately
building `filters = { preset: 'last-month', … }` (line 294) for the four preset-shaped functions.

So inside `captureAggregationSnapshot` the fix is to **pass the `dateRange` already in scope** to the
four functions instead of `filters`, and delete the `filters` local. The period is provably identical,
therefore expected values cannot change — which is exactly the property D-16 protects.

**⚠ But `dashboardPresetToDateRange` is itself slated for deletion (D-14), and the tests call it at
~20 sites** to derive both `dateRange` and `occurredAt`. The RETIRE plan must replace it with a
byte-identical local helper, since D-16 forbids any change in the covered period. The `last-month`
branch (`lib/utils/date.ts:60–66`) is:

```typescript
{ from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
  to:   endOfMonth(now.getFullYear(), now.getMonth() - 1) }
```

Recommended: a test-local `lastMonthRange()` in `tests/helpers/` reproducing precisely that, so the
production symbol can be deleted without touching a single expected value. Any drift here is a
silent, repo-wide regression that D-16 exists to catch.

**Installation (Phase 82/83 surfaces already in use):**
No new external packages needed. Phase 84 composes existing Phase 82 and Phase 83 functions.

## Package Legitimacy Audit

Not applicable — this phase introduces no new external packages. It composes existing libraries and services.

## Architecture Patterns

### System Architecture Diagram

```
URL (?year=2026&months=6&from=2026-02)
  ↓
Page component [year, months, from] params
  ↓
Parse + clamp logic (D-03)
  ↓
getCategoryMonthlyAmounts(categoryId, year) ──→ [12 months, zero-filled]
  ↓                                           ↙
+  getCoveredMonthsInYear(year) ────→ [covered months in year]
  ↓
Compose: filtered by window, state per month (covered/current/estimated/uncovered)
  ↓
getCategoryMonthlyAmounts(categoryId, year-1) ──→ [previous year 12 months]
  ↓                                            ↙
+  getCoveredMonthsInYear(year-1) ────→ [covered months in prev year]
  ↓
Compose: filtered by homologous window
  ↓
buildYearSeries() for each period ──→ [months[], total]
  ↓
computeComparison() per month ──→ [delta]
  ↓
Table render: 2 data rows + 1 synthetic difference row + 1 previous-year row
  ↓
resolveComparisonJudgement(delta, direction) ──→ colour (better/worse/neutral)
  ↓
getCategoryMonthlyAmounts() per subcategory ──→ [weight, contribution]
  ↓
Subtotal row: contributions sum exactly to parent difference (CDET-05)
  ↓
topTransactions query (window-scoped) ──→ [top 5 by magnitude, window filtered]
```

### Recommended Project Structure
```
app/(app)/dashboard/categories/[id]/
├── page.tsx                              # Page entry, params parsing, back-link logic
└── (no new subdirectories — detail rewrite stays at current level)

components/dashboard/
├── category-detail-window-controls.tsx   # Segmented + start-month select (D-01/02/03)
├── category-detail-table.tsx             # 12-month table render (CDET-01/06/07)
├── category-detail-difference-chart.tsx  # Month-by-month delta bars (D-08/09)
└── [existing components kept: category-year-select, category-coverage-nudge]

lib/
├── dal/
│   ├── dashboard.ts                      # D-15: getCategoryDetail signature change
│   └── category-detail-year-window.ts    # NEW: window+prev-year query, subcategory contrib
├── services/
│   ├── pace-and-projection.ts            # [no changes — already Phase 82]
│   └── category-direction-copy.ts        # [no changes — already Phase 83]
└── validations/
    ├── dashboard.ts                      # D-14: delete DashboardFilters/DashboardPreset/parseDashboardFilters
    └── category-year-window.ts           # NEW: months/from parser, clamp logic
```

### Pattern 1: Date Range as DAL Parameter (D-15 Signature Change)
**What:** Replace preset-based filter object with explicit `{ from: Date, to: Date }` in DAL function signatures.
**When to use:** All aggregation functions (`getCategoryDetail`, `getCategoriesBreakdown`, `getCategoryRanking`).
**Current signature:**
```typescript
getCategoryDetail(categoryId: number, filters: DashboardFilters): Promise<CategoryDetailData>
// DashboardFilters = { preset: DashboardPreset, type, sort? }
// Inside: dashboardPresetToDateRange(filters.preset) → { from, to }
```
**New signature:**
```typescript
getCategoryDetail(
  categoryId: number,
  { from, to, type }: { from: Date; to: Date; type: 'in' | 'out' }
): Promise<CategoryDetailData>
```
**Rationale:** Year+window contract passes explicit date boundaries, decoupling aggregation from preset vocabulary. Phase 82 already uses this pattern; Phase 84 generalizes it across Categories DAL.

### Pattern 2: Window Clamping (D-03 Reversibility)
**What:** One place, normalize out-of-range `{ months, from }` to the nearest valid start month inside the year.
**When to use:** URL param parsing, year change, dynamic window adjustment.
**Example:**
```typescript
function clampWindowToYear(year: number, months: number, from: string): string {
  // from = 'YYYY-MM', e.g. '2026-02'
  const [yearFromUrl, monthFromUrl] = from.split('-').map(Number)
  const maxStartMonth = 13 - months  // e.g., months=6 → max start is month 7 (July)
  const startMonth = Math.min(monthFromUrl, maxStartMonth)
  return `${year}-${String(startMonth).padStart(2, '0')}`
}
```
**Rationale:** Reversible single-point-of-change; keeps D-03 logic isolated.

### Pattern 3: Month-State Classification
**What:** Per-month visual state determined by coverage, current month, and partial-month rules (Phase 82 D-02/D-03).
**When to use:** Table rendering, cell styling, legend.
**States:**
- `'covered'` — Covered Month in Phase 82 sense, with transaction data.
- `'current'` — Current calendar month (always partial, always shown as hybrid).
- `'estimated'` — Within Covered Months range but after current month (projection).
- `'uncovered'` — Zero transactions in the month, even within Covered Months range.

**Source:**
```typescript
function classifyMonthState(
  yearMonth: string,
  coveredMonths: Set<string>,
  isCurrentMonth: boolean
): 'covered' | 'current' | 'estimated' | 'uncovered' {
  if (isCurrentMonth) return 'current'
  if (!coveredMonths.has(yearMonth)) return 'uncovered'
  if (yearMonth > currentYearMonth()) return 'estimated'
  return 'covered'
}
```

### Pattern 4: Contribution Arithmetic (CDET-05, D-16)
**What:** Per-subcategory contribution to the parent category's total difference, including disappeared subcategories.
**Key invariant:** All contributions sum exactly to the parent's total difference (verifiable on-screen per the prototype).
**Decimal.js requirement:** [VERIFIED: CLAUDE.md hard rule] Never native JS arithmetic on monetary amounts.
**Query shape:** Two parallel queries (current year vs. previous year) by subcategory, difference computed once per subcategory, then aggregated to parent total.
**Disappeared subcategory case:** A subcategory present only in the previous year carries a negative contribution (e.g., "−230,00 in meno") but zero current-year amount.

### Anti-Patterns to Avoid
- **Computing the difference on the client side:** Phase 82 already computed `computeComparison()` as the canonical function; replicating it anywhere else violates the "single source" principle and invites rounding errors. Always call `computeComparison(current, previous)` from `pace-and-projection.ts`.
- **Averaging-on-the-window separately:** The window denominator must match the monthly series length; separately computing an average or totalling the series without the window context is the exact error D-10 prevents.
- **Caching a "Deviation status" per subcategory:** Deviation is retired; any similar cached metadata is out of scope.
- **Bypassing the Covered Month filter:** Drizzle queries must use the exact same `dateScopedTransactions()` filter the regression tests verify; deviating silently breaks the gate (RETIRE-02).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Preset → date-range translation | A custom parser for each preset | `dashboardPresetToDateRange()` exists (use for regression tests D-16 only) | Already tested, Decimal.js-aware |
| Pace / projection computation | Averaging and dividing by hand | `computePaceAndProjection()` from Phase 82 | Handles MIN_COVERED_MONTHS_FOR_PACE threshold, rounding, insufficient-data discriminator union |
| Month-over-month comparison | Subtracting on the client | `computeComparison()` from Phase 82 | Single source, Decimal.js, sign convention documented |
| Judgement colour (better/worse) | Conditional per-direction sign flip | `resolveComparisonJudgement()` from Phase 82 | D-13, one place per direction |
| Covered-month filter in DAL | Reimplementing `WHERE occurred_at ...` | `dateScopedTransactions()` and `getCoveredMonthsInYear()` from Phase 82 | Already verified by regression gate |
| Subcategory weight calculation | Dividing amount by total | `computeBreakdownPercentages()` already exists | Handles zero total gracefully, Decimal.js |
| Per-direction Italian copy | Hardcoding "Rispetto a", "Andamento" in components | `resolveCategoryDirectionCopy()` from Phase 83 | Single canonical glossary, avoids duplication across 5+ detail surfaces |

**Key insight:** Phase 82 and Phase 83 were designed as libraries of reusable functions specifically to prevent this phase from re-deriving pace, comparison, coverage or copy. The regression gate (RETIRE-02) locks these functions in place — any deviation from using the Phase 82 surfaces will cause the baseline tests to fail.

## Runtime State Inventory

**Trigger:** This is a rewrite phase; the detail page exists. Checking for stale state in caches or registrations.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Session cache keys: if preset filters were persisted (sessionStorage), they must be cleared. | Check for `localStorage.getItem('dashboardPreset')` or similar; add cleanup to detail page load. |
| Live service config | Dashboard filters on Categories list (phase 83): unaffected — that page doesn't read direction. | None — CLIST-07 handles its own URL navigation. |
| OS-registered state | None — Categories is browser-only, no OS tasks or registrations. | None. |
| Secrets/env vars | None — Preset is URL-scoped, not secret. | None. |
| Build artifacts | None — DAL is server-only, no client-side build output to clear. | None. |

**Explicit "nothing found" confirmations:**
- No browser sessionStorage/localStorage keys need migration (verified by grep).
- No HTTP caches set `Cache-Control` headers per-preset (Categories uses standard SSR cache).
- No Vercel KV or Redis keys embed preset names.
- No npm `build` step rewrites preset names into bundles.

## Common Pitfalls

### Pitfall 1: Window Clamping Applied After URL Parsing Instead of Inside
**What goes wrong:** Parsing ignores the clamp rule, displaying mismatched numbers (e.g., URL says `?months=6&from=2026-09` but on a 12-month year starting Jan it should clamp to July). User sees unexpected month labels.
**Why it happens:** Temptation to parse first (simpler state machine) and clamp later (seems like a display concern). But D-03 says the clamp is canonical — the URL itself should reflect it after a page reload.
**How to avoid:** Clamp inside `parseCategoryYearWindowParams()` (alongside parsing), before passing to the page component. Make the parser's return value the source of truth for window state.
**Warning signs:** URL params don't round-trip (`?from=` changes on navigation); table re-renders with different month labels than shown in the select.

### Pitfall 2: Using `getCategoryDetail()` Without Updating the Signature
**What goes wrong:** Calling the function with the old preset-based `filters` object, but the function expects `{ from, to, type }`. TypeScript will catch this at compile time, but the error message is misleading if not done carefully.
**Why it happens:** D-15 requires changing 3 call sites (`[id]/page.tsx`, `reimbursement-test-db.ts`, and any overview/tags regression suite that touched Categories).
**How to avoid:** Do a full-codebase find-and-replace for `getCategoryDetail(` and `getCategoryRanking(` and `getCategoriesBreakdown(` to identify all call sites before the rewrite. Update signatures first, then call sites.
**Warning signs:** `yarn typecheck` fails at the detail page or test files; the error points to missing `preset` or `DashboardFilters`.

### Pitfall 3: Subcategory Contributions Don't Sum to Parent Total
**What goes wrong:** The prototype demands "Contributo alla differenza" column whose values sum exactly to the parent category's total difference. A miscalculation (e.g., rounding per-subcategory instead of at the sum) causes the total row to show a different number than the sum of the rows above it.
**Why it happens:** Temptation to compute each subcategory's delta independently and round separately (feels safer), then sum — but Decimal.js rounding-once-at-return is the rule (CLAUDE.md, D-11). Summing after rounding changes the total.
**How to avoid:** Compute each subcategory's delta as a Decimal instance (unrounded), accumulate the sum, round only the final sum via `toDbDecimal()`. The summing-to-total property is then guaranteed structurally.
**Warning signs:** The total row's "256,30 in più" doesn't match the visual sum of the rows (e.g., 256,29 or 256,31); or the prototype's "Totale" row shows different contribution arithmetic than the header summary.

### Pitfall 4: Confusing the Year's Pace With the Window's Pace
**What goes wrong:** Using the window's denominator (e.g., 6 months) to compute pace, which changes the pace value based on the selected window. But ADR 0020 §3 and D-02 say pace is always anchored to the full year's Covered Months, never the window.
**Why it happens:** Intuitive confusion: "If I'm looking at a 6-month window, shouldn't the pace be per-6-months?" But no — pace is structural (year-level), and the window is just a viewport on it.
**How to avoid:** Call `getCoveredMonthsInYear(year)` once at the page level (not per-window state). Pass the pace (computed from full-year coverage) separately from the displayed window. The table shows the window, but the legend says "ritmo di X al mese" computed on the full year's months.
**Warning signs:** Pace changes when switching from "Anno intero" to "6 mesi"; the legend shows "ritmo 400 al mese" in one window and "ritmo 600 al mese" in another (incorrect).

### Pitfall 5: Previous-Year Row Shown When It Shouldn't (or Vice Versa)
**What goes wrong:** D-11 gates the previous-year data row on "the previous year has at least one Covered Month in the homologous window." Showing it unconditionally (or not showing it when it should) violates the rule and confuses the user.
**Why it happens:** Not reading the CoveredMonthsInYear gate carefully; or using a loose "year is not empty" check instead of "homologous window is covered."
**How to avoid:** Call `getCoveredMonthsInYear(year - 1)` at page load, filter to the homologous window (same month indices), and check `count > 0`. This becomes a boolean flag that gates the row render.
**Warning signs:** Previous-year row is empty when viewed, or data appears for a year with zero transactions; or the "Dati insufficienti per il confronto" message never shows.

### Pitfall 6: Mixing Preset-Based and Year+Window Logic in the URL
**What goes wrong:** Some links still generate `?preset=last-3-months` while others generate `?year=2026&months=6&from=2026-02`. Navigating between them breaks consistency.
**Why it happens:** Partial refactor of `buildDashboardCategoryDetailHref()` or back-link generation; missed some branches.
**How to avoid:** Delete `buildDashboardCategoryDetailHref` entirely (D-14). Create ONE new function `buildCategoryDetailHref({ year, months, from, type, lens })` that always emits the new contract. Search for the old function name to catch any remaining callers.
**Warning signs:** `grep buildDashboardCategoryDetailHref` finds hits in `routes.ts` or `page.tsx` after the refactor; or the detail page's back-link carries `?preset=` in the URL.

### Pitfall 7: Forgetting to Pass the Window to topTransactions Query
**What goes wrong:** D-05 says topTransactions becomes window-scoped. If the query still uses `from`/`to` from the old preset, it will show the wrong transactions.
**Why it happens:** getCategoryDetail rewrite missed updating the topTransactionRows query's WHERE clause.
**How to avoid:** The DAL function receives `{ from, to, type }` as parameters; the topTransactions subquery must use those same `from` and `to` — never recompute from a preset. Make the page component pass `window.from` and `window.to` explicitly.
**Warning signs:** Clicking a table cell (if implemented as future drill-down) shows transactions outside the visible window; or the top 5 transactions list includes entries from months outside the selected window.

## Code Examples

### Example 1: Window Parser with Clamping (D-01, D-03)
**Source:** To be implemented in `lib/validations/category-year-window.ts`.
```typescript
// Input: URL params
// Output: { year, months, from } with clamping applied
export function parseCategoryYearWindow(
  params: {
    year?: string | string[]
    months?: string | string[]
    from?: string | string[]
  }
): { year: number; months: number; from: string } {
  // Parse year as integer; default to current year
  const yearStr = Array.isArray(params.year) ? params.year[0] : params.year
  const year = yearStr && /^\d{4}$/.test(yearStr) ? Number(yearStr) : new Date().getFullYear()

  // Parse months; must be one of {12, 9, 6, 3}
  const monthsStr = Array.isArray(params.months) ? params.months[0] : params.months
  const months = monthsStr === '9' || monthsStr === '6' || monthsStr === '3' ? Number(monthsStr) : 12

  // Parse from (YYYY-MM); default to January
  const fromStr = Array.isArray(params.from) ? params.from[0] : params.from
  const fromMatch = fromStr?.match(/^(\d{4})-(\d{2})$/)
  let startMonth = fromMatch ? Number(fromMatch[2]) : 1
  const fromYear = fromMatch ? Number(fromMatch[1]) : year

  // Clamp: start month must fit the window inside the year
  const maxStartMonth = 13 - months
  startMonth = Math.min(Math.max(1, startMonth), maxStartMonth)

  // Verify from year matches the selected year; if not, reset to selected year
  const clampedFromYear = fromYear === year ? year : year

  return {
    year,
    months,
    from: `${clampedFromYear}-${String(startMonth).padStart(2, '0')}`,
  }
}
```

### Example 2: Calling getCategoryDetail with New Signature (D-15)
**Source:** `app/(app)/dashboard/categories/[id]/page.tsx`.
```typescript
async function CategoryDetailContent({
  categoryId,
  year,
  window: { months, from },
  type,
}: {
  categoryId: number
  year: number
  window: { months: number; from: string }
  type: 'in' | 'out'
}) {
  // Compute the window's date boundaries from the parsed params.
  // D-03 guarantees the window NEVER crosses the year boundary, so no modulo/carry
  // arithmetic is needed — and attempting it is where the off-by-one lives (see note).
  const [fromYear, fromMonth] = from.split('-').map(Number)
  const startMonthIndex = fromMonth - 1              // Date months are 0-indexed
  const endMonthIndex = startMonthIndex + months - 1 // stays ≤ 11 by D-03

  const windowStart = new Date(fromYear, startMonthIndex, 1)
  // Day 0 of the NEXT month = last day of endMonthIndex.
  const windowEnd = new Date(fromYear, endMonthIndex + 1, 0, 23, 59, 59, 999)

  // New signature: explicit date range, no preset
  const data = await getCategoryDetail(categoryId, {
    from: windowStart,
    to: windowEnd,
    type,
  })

  return <DetailTable data={data} />
}
```

> **⚠ Corrected 2026-08-03.** The first draft computed the end boundary with
> `(fromMonth + months - 1) % 12 || 12` plus a year carry, then
> `new Date(windowEndYear, windowEndMonth % 12, 0, …)`. That is **off by a full year on the
> default whole-year case**: for `from=2026-01, months=12` it yields `new Date(2026, 0, 0)` =
> **31 Dec 2025**, so the page would query the previous year. The `|| 12` guard and the
> `% 12` are both dead weight under D-03 — since the window cannot cross the year, the end
> month index is simply `start + months - 1`. The planner should treat "no modulo arithmetic
> on window boundaries" as the acceptance criterion, and cover
> `months=12` / `from=YYYY-01` explicitly in `tests/category-detail-window.test.ts`.

### Example 3: Regression Test Filter Update (D-16) — corrected

**Source:** `tests/helpers/reimbursement-test-db.ts:294–330`. The first draft of this example
re-derived `dateRange` inside the helper. That is unnecessary and misleading: **`dateRange` is already
a parameter of `captureAggregationSnapshot`** (`CaptureAggregationSnapshotInput.dateRange`, line 257)
and is already forwarded explicitly to `getOverviewAmountTotals` at line 309. Every caller already
computes it as `dashboardPresetToDateRange('last-month')`, so the range is **identical by
construction** — which is precisely why expected values cannot move.

```typescript
// CURRENT (line 294) — a second, redundant expression of the same period:
const filters = { preset: 'last-month' as const, type: 'all' as const, sort: 'amount' as const }

const [/* … */] = await Promise.all([
  dashboardModule.getOverviewAmountTotals(userId, dateRange.from, dateRange.to, ledgerRowSource),
  dashboardModule.getCategoriesBreakdown(filters),
  dashboardModule.getCategoryRanking(filters),
  dashboardModule.getCategoryDeviations({ type: 'all' }),   // ← key removed entirely
  dashboardModule.getCategoryDetail(categoryId, filters),
  dashboardModule.getMonthlyTrendByNature(filters.preset),
  // …
])

// AFTER — delete the `filters` local; reuse the dateRange already in scope:
const range = { from: dateRange.from, to: dateRange.to, type: 'all' as const }

const [/* … */] = await Promise.all([
  dashboardModule.getOverviewAmountTotals(userId, dateRange.from, dateRange.to, ledgerRowSource),
  dashboardModule.getCategoriesBreakdown(range),
  dashboardModule.getCategoryRanking(range),
  //  getCategoryDeviations: removed from BOTH the array and the returned object literal.
  //  The snapshot goes 10 → 9 keys. Keep array/object positionally aligned.
  dashboardModule.getCategoryDetail(categoryId, range),
  dashboardModule.getMonthlyTrendByNature({ from: dateRange.from, to: dateRange.to }),
  // …
])
// Expected values: untouched — the period is byte-identical, only the call shape changes.
// If ANY snapshot value moves, that is the regression RETIRE-02 exists to catch.
```

Note `getMonthlyTrendByNature` takes a bare range, not a `type` — it groups by nature, not direction.

**Blocking prerequisite:** the callers' `dashboardPresetToDateRange('last-month')` (~20 sites) must be
replaced by a byte-identical test-local helper before that production symbol can be deleted. See the
D-16 mechanic under §D-15 Blast Radius.

### Example 4: Subcategory Contribution Summing (CDET-05, D-16)
**Source:** `lib/dal/category-detail-year-window.ts` or `components/dashboard/category-detail-table.tsx`.
```typescript
// Compute contributions per subcategory
function computeSubcategoryContributions(
  currentYearData: SubcategoryData[],
  previousYearData: SubcategoryData[]
): SubcategoryWithContribution[] {
  const bySubcategoryId = new Map<number, SubcategoryWithContribution>()

  // Add current year subcategories
  for (const sub of currentYearData) {
    bySubcategoryId.set(sub.id, {
      id: sub.id,
      name: sub.name,
      slug: sub.slug,
      currentAmount: toDecimal(sub.amount),
      previousAmount: toDecimal('0.00'),
    })
  }

  // Add or overlay previous year subcategories
  for (const sub of previousYearData) {
    const existing = bySubcategoryId.get(sub.id)
    if (existing) {
      existing.previousAmount = toDecimal(sub.amount)
    } else {
      bySubcategoryId.set(sub.id, {
        id: sub.id,
        name: sub.name,
        slug: sub.slug,
        currentAmount: toDecimal('0.00'),
        previousAmount: toDecimal(sub.amount),
      })
    }
  }

  // Compute contribution: difference per subcategory
  const contributions: SubcategoryWithContribution[] = Array.from(bySubcategoryId.values()).map(
    (sub) => ({
      ...sub,
      contribution: toDbDecimal(sub.currentAmount.minus(sub.previousAmount)),
    })
  )

  // Verify: sum of contributions = sum(currentAmount) - sum(previousAmount)
  const totalContribution = contributions.reduce(
    (sum, sub) => sum.plus(toDecimal(sub.contribution)),
    toDecimal('0.00')
  )
  // Decimal.js on BOTH sides — never Number()/native +/- on money (CLAUDE.md hard rule).
  const currentTotal = currentYearData.reduce(
    (sum, sub) => sum.plus(toDecimal(sub.amount)),
    toDecimal('0.00')
  )
  const previousTotal = previousYearData.reduce(
    (sum, sub) => sum.plus(toDecimal(sub.amount)),
    toDecimal('0.00')
  )
  const expectedTotal = currentTotal.minus(previousTotal)

  // CDET-05 is an EXACT-equality property, not "within rounding":
  //   totalContribution.equals(expectedTotal)
  // Round once at the presentation boundary, never inside the sum — rounding each
  // contribution before summing is what breaks the sum-to-parent invariant.

  return contributions
}
```

> **⚠ Corrected 2026-08-03.** The first draft of this example used
> `sum + Number(sub.amount)` in the verification — a direct violation of the project's
> hard rule against native JS arithmetic on monetary amounts, inside the very function
> whose contract is exact summation. It also described the invariant as holding "within
> rounding"; CDET-05 requires the contributions to sum **exactly** to the parent's
> difference, which is the on-screen property the subcategory total row proves (D16).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Preset-based DAL signatures | Explicit date-range parameters | Phase 84 | Decouples dashboard UI from backend aggregation; enables window control |
| Deviation badge on subcategories | Contribution column (weight + delta) | Phase 84 | Focused metric (sums exactly to parent); retired vocabulary removed |
| KPI header (CategoryDetailSummary) | Sticky summary column | Phase 84 | Single source of truth; prevents divergence (D-07, D-13) |
| Trend chart (all amounts) | Difference chart (month-by-month delta) | Phase 84 | Clearer month-over-month story; table renders absolute values |
| Direction filter in detail | Direction fixed by category | Phase 84 | Simplifies URL, prevents incoherent state (D-06) |

**Deprecated/outdated:**
- **Deviation machinery:** Replaced by contribution arithmetic; "deviation is new/on-threshold/off-threshold" replaced by "contribution to difference" with exact-summing verification.
- **Baseline period:** Replaced by "previous year, homologous window" (explicit and year-scoped).
- **Reference Period in Deviation sense:** Replaced by "selected year" (container concept, ADR 0020 §1).
- **Preset filters on Categories:** Replaced by year+window contract (explicit, reversible, D-03).

## Assumptions Log

All findings in this research were verified against the codebase, CONTEXT.md, and locked decisions. No assumptions tagged `[ASSUMED]` remain.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| (none) | All research findings verified via code read or CONTEXT.md decision | — | — |

**If this table is empty:** ✓ All claims are verified or cited — no user confirmation needed before planning.

## Open Questions

1. **Mobile scrolling behaviour on the table**
   - What we know: Prototype shows sticky first column (left), sticky summary column (right), horizontal scroll below ~1040px.
   - What's unclear: Whether the summary column stays visible on narrow viewports (<600px); whether "non importato" text truncates or wraps.
   - Recommendation: Implement per prototype as reference, with mobile testing in verification phase.

2. **Whether the detail chart reuses `CategoryDetailTrendChart` component**
   - What we know: D-08 says chart must consume the same series object the table renders (no separate query).
   - What's unclear: Whether to reshape the existing component or build a new `category-detail-difference-chart.tsx`.
   - Recommendation: Start with new component; if they converge later, refactor. Separation avoids re-coupling data flow.

3. **DAL shape: one grouped query or two**
   - What we know: Window + previous-year series needed; parallel queries are simpler to test.
   - What's unclear: Whether a single grouped query (current year + prev year in one SELECT) is faster or harder to reason about.
   - Recommendation: Implement as two parallel queries (mirror Phase 82 style); performance can be optimized post-verification if needed.

4. **Exact copy for D-11's "insufficient previous-year coverage" message**
   - What we know: D-11 says a line stating why (not a silent disappearance).
   - What's unclear: The exact Italian wording; Phase 83 CONTEXT.md has no example.
   - Recommendation: Claude's Discretion; suggest wording in plan, get user approval in discuss-phase before committing.

## Environment Availability

Skip (no external dependencies). Phase 84 is a codebase-only rewrite; it requires only:
- Node.js (already verified to run tests)
- PostgreSQL (test database already running for Phase 82/83 regression tests)
- TypeScript compiler (no new versions needed)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + real Postgres (reimbursement-test-db.ts harness) |
| Config file | `vitest.config.ts` (existing) |
| Quick run command | `yarn test tests/reimbursement-regression.test.ts --run` |
| Full suite command | `yarn test --run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CDET-01 | 12-month table renders with month-over-month delta in cells | unit | `yarn test tests/category-detail-table.test.ts -x` | ❌ Wave 0 |
| CDET-02 | Previous-year row renders with homologous month data | unit | `yarn test tests/category-detail-table.test.ts::previous-year -x` | ❌ Wave 0 |
| CDET-03 | Window control changes URL params and re-filters data | integration | `yarn test tests/category-detail-window.test.ts -x` | ❌ Wave 0 |
| CDET-04 | Summary column updates totals/averages per window | unit | `yarn test tests/category-detail-summary.test.ts -x` | ❌ Wave 0 |
| CDET-05 | Subcategory contributions sum exactly to parent difference | unit | `yarn test tests/category-subcategory-contrib.test.ts -x` | ❌ Wave 0 |
| CDET-06 | Covered/current/estimated/uncovered month states render correctly | unit | `yarn test tests/category-detail-month-states.test.ts -x` | ❌ Wave 0 |
| CDET-07 | Previous-year row absent when insufficient coverage; reason shown | unit | `yarn test tests/category-detail-prev-year-gate.test.ts -x` | ❌ Wave 0 |
| RETIRE-01 | Zero grep hits for deviation/deviazione/preset/baseline/noise | smoke | `grep -ri 'deviation\|deviazione\|preset' app lib components tests` | ✅ Manual |
| RETIRE-02 | Regression suites (amortization, reimbursement) pass with new DAL signatures | regression | `yarn test tests/{amortization,reimbursement}-regression.test.ts --run` | ✅ Existing |

### Sampling Rate
- **Per task commit:** `yarn test tests/category-detail-*.test.ts --run` (new unit tests for this phase)
- **Per wave merge:** `yarn test --run` (full suite, including RETIRE-02 regression gate)
- **Phase gate:** Full suite green + `grep -ri 'deviation|deviazione|preset'` returns zero + `yarn check:language` green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/category-detail-table.test.ts` — CDET-01/02/06/07 fixtures, snapshot tests for table HTML structure, month-state classification
- [ ] `tests/category-detail-window.test.ts` — D-01/D-03 parser, clamp logic, URL round-trip, year change preservation
- [ ] `tests/category-detail-summary.test.ts` — CDET-04 summary column updates (total, average, comparison)
- [ ] `tests/category-subcategory-contrib.test.ts` — CDET-05 contribution arithmetic, disappeared-subcategory handling, sum-to-total verification
- [ ] `tests/category-detail-month-states.test.ts` — CDET-06 visual state per month (covered/current/estimated/uncovered)
- [ ] `tests/category-detail-prev-year-gate.test.ts` — CDET-07 previous-year row visibility gate, coverage threshold, insufficient-data message
- [ ] `tests/helpers/category-detail-test-db.ts` — Mirror of reimbursement-test-db.ts; factory for building test categories, subcategories, and transactions across multiple years/windows
- [ ] Framework install: No new test packages needed (Vitest + Postgres already in use; Decimal.js already imported)

*(If no gaps: "None — existing test infrastructure covers all phase requirements")*

**Gaps rationale:** Wave 0 test files are placeholder names; they bundle the new detail page tests (CDET-01…07) and the retirement exit criteria (RETIRE-01/02). The regression-test update (RETIRE-02) reuses existing amortization/reimbursement suites; only the call-site updates are needed, not new test files.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better Auth session check (`verifySession()`) — unchanged from detail page |
| V3 Session Management | yes | Session persistence via Better Auth — unchanged |
| V4 Access Control | yes | User-scoped queries (userId in WHERE clauses) — unchanged |
| V5 Input Validation | yes | Zod parser for year/months/from; clamp logic prevents out-of-range months |
| V6 Cryptography | no | No new cryptographic operations |
| V7 Error Handling | yes | Database errors caught in try/catch; fallback to empty state or cached empty detail |
| V8 Data Protection | yes | Decimal.js for monetary arithmetic — no precision loss, no injection vectors |
| V9 Communications | no | Same HTTPS/TLS as rest of app |
| V10 Malicious Code | no | No eval() or dynamic code generation |
| V11 Business Logic | yes | Window clamping (D-03) prevents math errors in date boundaries; contribution summing verified structurally |
| V12 File Upload | no | Not applicable to detail page |
| V13 API | yes | DAL functions parameterized (Drizzle `sql` templates, never string-concatenation) — unchanged from Phase 82 |
| V14 Configuration | yes | No new config; preset vocabulary retirement removes a config attack surface |

### Known Threat Patterns for Dashboard Categories

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via user input (year/months) | Tampering | Zod parsing (only 4-digit year, 1-2 digit month); Drizzle parameterization (sql templates, never concatenation) |
| Date-range boundary confusion (off-by-one) | Information Disclosure | Window clamping logic (D-03) prevents displaying wrong month; Covered Month filter exact (T-82-01) |
| Floating-point rounding errors on money | Tampering / Information Disclosure | Decimal.js throughout (CLAUDE.md hard rule); rounding once at return boundary (D-11) |
| User seeing another user's data | Information Disclosure | `verifySession()` checks user ID; all queries scoped to `userId` via parameterized Drizzle; no regression (Phase 82 D-05 verified) |
| Category/subcategory not owned by user | Access Control | Category / subcategory queries inner-join to user's own categories; soft-delete check (`isActive`) prevents accessing deleted categories |

**No new threat surface introduced by Phase 84:** The rewrite consolidates scattered preset-scoped logic into explicit date-range parameters, reducing the configuration attack surface. Retiring Deviation/Baseline/Noise removes vocabulary that could be abused in future (no vocabulary = no injection vector).

## D-19 Exit Criterion (corrected)

> Added 2026-08-03 by orchestrator verification pass. **D-19 as literally written cannot pass**, and a
> planner that writes it verbatim into `must_haves` produces a phase that can never be verified green.
> The *intent* — no live retired machinery — is fully achievable. The naive grep is not, for two
> distinct reasons.

**Reason 1 — an unrelated sense of the word "preset".** `components/data-table/MonthMultiPicker.tsx`
has 7 hits with no connection to `DashboardPreset`: a `PresetBtn` component (line 25) and the
"relative presets" feature (lines 53, 86, 100–109 — *Ultimi 3 mesi* / *Quest'anno* / *Anno scorso*),
which is a Phase-83-era D-10 capability. Deleting or renaming these would remove shipped, unrelated
functionality.

**Reason 2 — guard references that assert the retirement itself.** Deleting these would destroy the
proof that the retirement happened:

| File | Lines | What it asserts |
|---|---|---|
| `tests/dashboard-year-contract.test.ts` | 32–33 | `parseCategoryYearSort('deviation')` falls back to `'amount'` — the retired sort value is handled, not honoured |
| `tests/category-direction-copy.test.ts` | 4, 57–61 | No copy string returned by the service contains `Deviazione\|Baseline\|Preset` |
| `components/dashboard/dashboard-tab-nav.tsx` | 19 | Comment recording that preset is retired from the tab nav — never read, never propagated |
| `app/(app)/dashboard/categories/page.tsx` | 27 | Comment recording the pin-by-construction property (no `preset`/`period` key in the type) |
| `app/(app)/dashboard/tags/page.tsx` | 10 | Comment recording that no preset/year/tag searchParam is read |

**One genuine exception that must NOT be treated as a guard:**
`tests/dashboard-year-contract.test.ts:74–76` asserts the *current, live* preset-based behaviour of
`buildDashboardCategoriesHref({ preset: 'last-3-months', type: 'in' })` →
`'/dashboard/categories?preset=last-3-months&type=in'`. That test dies with the preset branch it
covers — rewrite or remove it, unlike the guards above.

### Recommended mechanically-runnable exit command

Grep the retired **identifiers**, not the English words, with an explicit allowlist:

```bash
grep -rIn -E \
  'DashboardPreset|DashboardFilters|DashboardSort|parseDashboardFilters|dashboardPresetToDateRange|getCategoryDeviations|getDeviationDateRanges|buildDeviationDataset|buildDeviationMap|computeDeviation|DEVIATION_NOISE_THRESHOLD|DeviationData|DeviationDateRanges|getOverviewComparisonRanges' \
  app lib components tests \
  | grep -vE '^(tests/dashboard-year-contract\.test\.ts|tests/category-direction-copy\.test\.ts):' \
  || echo "RETIRE-01 clean"
```

This is falsifiable, has no false positives from `MonthMultiPicker`, and does not require deleting the
guard tests. The planner should put **this** command in `must_haves`, and record that it is a
faithful-intent substitution for D-19's literal wording — not a weakening of it. The rest of D-19
(`yarn typecheck`, full suite, `yarn check:language`, and Phase 82's RETIRE-05 baseline via
`tests/pace-engine-lens-regression.test.ts`) stands unchanged.

---

## RETIRE-01 File Inventory (verified)

Complete file-level inventory, re-derived by grep. The first draft listed 13 files; the real count is
higher. Classification: **(a)** delete outright · **(b)** call site to rewrite · **(c)** test to
update · **(d)** doc/glossary text · **(e)** guard reference — **keep**.

| File | Hits | Class | Note |
|---|---|---|---|
| `components/dashboard/dashboard-filters.tsx` | 13 | (a) | Whole file |
| `components/dashboard/deviation-badge.tsx` | 11 | (a) | Whole file |
| `components/dashboard/category-detail-summary.tsx` | — | (a) | D-07; imports `CategoryDetailData` |
| `tests/deviation-badge.test.tsx` | 13 | (a) | Dies with its component |
| `tests/dashboard-filters.test.ts` | 60 | (a) | Dies with its component — largest single hit count |
| `lib/dal/dashboard.ts` | 34 | (a)+(b) | Deviation fns + dead `getOverview` chain deleted; 4 fns re-signed (D-15) |
| `lib/validations/dashboard.ts` | 14 | (a) | Preset/sort schemas + `parseDashboardFilters` |
| `lib/utils/dashboard.ts` | 11 | (a) | Deviation computation + `DEVIATION_NOISE_THRESHOLD` |
| `lib/utils/date.ts` | 5 | (a) | `dashboardPresetToDateRange` — **see the D-16 replacement note first** |
| `lib/routes.ts` | 11 | (a)+(b) | Preset branch out; detail href gains window params |
| `app/(app)/dashboard/categories/[id]/page.tsx` | 12 | (b) | Rewritten wholesale by the build plan |
| `components/dashboard/category-subcategory-breakdown.tsx` | 12 | (b) | Rewritten on weight+contribution; drops the `DeviationData` import (line 3) |
| `tests/helpers/reimbursement-test-db.ts` | 5 | (c) | `filters` → `dateRange`; drop the `getCategoryDeviations` key |
| `tests/amortization-lens-regression.test.ts` | 18 | (c) | 4 call sites × 2 lens arms; drop 2 deviation assertions |
| `tests/reimbursement-regression.test.ts` | 42 | (c) | Mostly `dashboardPresetToDateRange('last-month')` derivations — expected values untouched |
| `tests/dashboard-dal.test.ts` | 21 | (c) | Includes the `getOverviewComparisonRanges` cases (119–145) that die with the symbol |
| `tests/dashboard-utils.test.ts` | 18 | (c) | Deviation util tests die with the utils |
| `tests/dashboard.spec.ts` | 21 | (c) | **Missing from the first draft** — classify per assertion |
| `tests/category-detail-link.test.ts` | 16 | (c) | **Missing from the first draft** — href contract changes with D-01 |
| `tests/category-detail-components.test.tsx` | 7 | (c) | Imports from `@/lib/dal/dashboard` (line 7) |
| `tests/pace-engine-lens-regression.test.ts` | — | (c) | Only the `dateRange` derivation (line 297); **the RETIRE-05 baseline itself must not change** |
| `tests/dashboard-year-contract.test.ts` | 5 | **(e)** + one (c) | Guards at 32–33 **keep**; the href assertion at 74–76 dies with the preset branch |
| `tests/category-direction-copy.test.ts` | 3 | **(e)** | Retirement guard — keep |
| `components/dashboard/dashboard-tab-nav.tsx` | 1 | **(e)** | Comment recording the retirement — keep |
| `app/(app)/dashboard/categories/page.tsx` | 1 | **(e)** | Pin-by-construction comment — keep |
| `app/(app)/dashboard/tags/page.tsx` | 1 | **(e)** | Comment recording no searchParam read — keep |
| `components/data-table/MonthMultiPicker.tsx` | 7 | **(e)** | Unrelated sense of "preset" — **keep, do not rename** |
| `CONTEXT.md` (repo root) | — | (d) | **Rewritten by D-18** — the only doc this phase edits |
| `docs/adr/0001-deviation-baseline-window.md` | — | (d) | **Historical record — do NOT edit** |
| `docs/adr/0006`, `0016`, `0019`, `0020` | — | (d) | **Historical record — do NOT edit.** ADR 0020 *is* the decision to retire; editing it would erase the rationale |

**ADR rule:** ADRs are an append-only decision log. D-18 scopes the glossary rewrite to repo-root
`CONTEXT.md` alone. A plan task that edits any `docs/adr/*.md` file is out of scope.

## Verification Protocol Checklist

- [x] **Runtime State Inventory:** Completed for rewrite phase — no stale state found (verified above)
- [x] **Security domain included:** ASVS categories mapped; known threat patterns for dashboard reviewed
- [x] **Phase 82 regression gate (RETIRE-05):** Identified as the gate for D-16 test updates; byte-identical baseline required

## Phase Requirements Traceability

| Requirement ID | Description | Research Support |
|--------|-------------|------------------|
| CDET-01 | 12-month table with month-over-month delta in each cell | Locked prototype (detail-table.html) shows structure; CONTEXT.md D-01 specifies URL contract; Phase 82 `buildYearSeries()` provides series composition |
| CDET-02 | Previous-year row for month-by-month comparison | D-11 gates on ≥1 Covered Month in homologous window; Phase 82 `getCoveredMonthsInYear()` provides gate data |
| CDET-03 | Window narrowing (9/6/3-month) from chosen start month | D-01/D-02/D-03 specify URL contract, defaults, clamping logic; prototype shows control placement |
| CDET-04 | Summary column (total, average, comparison) updated per window | D-07 subsumes KPI header into sticky column; Phase 82 `buildYearSeries()`, `computeComparison()`, `computePaceAndProjection()` provide calculations |
| CDET-05 | Subcategory contributions sum exactly to parent difference | D-16 specifies summing property; prototype shows total row; `computeComparison()` provides per-subcategory delta |
| CDET-06 | Covered/current/estimated/uncovered month states visually distinct | D-10/D-11 specify text and styling; Phase 82 `isPartialMonth()`, `computeCurrentMonthHybrid()` provide state logic |
| CDET-07 | Previous-year insufficient coverage message shown, average still renders | D-11 specifies message substitution; Phase 82 `canShowPreviousYearTotalDifference()`, `PREVIOUS_YEAR_TOTAL_DIFFERENCE_MIN_COVERED_MONTHS` provide gate |
| RETIRE-01 | Deviation/Baseline/Noise/Preset deleted from interface and codebase | Deletion inventory (Research Priority 2) lists all 25 files/symbols; D-14 specifies hard deletion; D-19 specifies exit criterion |
| RETIRE-02 | Preset machinery removed, no regression on Overview/Tags/regression suites | D-15 specifies signature change; D-16 specifies regression test update (same date range, expected values untouched); Phase 82 RETIRE-05 baseline is the gate |

## Locked Prototypes Reference

### detail-table.html (Chosen, D-19)
**Structural facts for the planner:**

1. **Table layout:** 13-column layout (12 months + sticky "Anno" summary column)
   - First column sticky left (row headers: "2026", "2025 (stessa finestra)", "Differenza")
   - Each month column: month label (3-char, e.g., "gen"), amount, delta as secondary text (11px, smaller font, 2px margin-top)
   - Summary column sticky right: two stacked lines ("Totale" / amount, "Media/mese" / amount), able to carry qualification text below

2. **Month cell composition:**
   - Primary: formatted amount (right-aligned, tabular-nums, monospace)
   - Secondary: delta text (11px, smaller, "107,90 in più" or "24,30 in meno"), colour-coded per direction+comparison
   - State styling: current month has peach background (#fff7ed), estimated month has italic+grey, uncovered month has diagonal hatching + "non importato" text

3. **Visual states (CSS classes, convertible to Tailwind or CSS modules):**
   - `.st-now` (current month): background `#fff7ed`, thick bottom border
   - `.st-est` (estimated): italic, muted foreground colour
   - `.st-gap` (uncovered): diagonal hatching (CSS `repeating-linear-gradient(45deg, transparent 0 5px, rgba(113,113,122,.10) 5px 10px)`)
   - `.word.up-bad` / `.word.down-good` (delta colour): direction-aware; on "Uscite" (out), up = red, down = green

4. **Subcategory table:**
   - Columns: name, weight bar, amount (2026), contribution
   - Total row: thick top border, bold font
   - Disappeared subcategory row (`.gone`): muted colour, bar empty, contribution is negative amount

5. **Uncovered-month representation (open item from prototype):**
   - Text "non importato" (literally "not imported") sits in the cell where an amount would be
   - Challenge: text is wider than a number, shifts column alignment; prototype flags this as an open question

6. **Mobile behaviour (not shown, left to Claude's Discretion):**
   - Below ~1040px: horizontal scroll enabled, first and last columns sticky
   - Below ~620px: table may stack or switch to card layout (unspecified)

**Open items the prototype carries:**
- Does "non importato" text break alignment? (D-10's "va detto in chiaro" — yes, so styling must accommodate it)
- Do you keep the 2025 row on a 3-month window (nearly empty) or show it only on wider windows? (D-11 specifies always when covered, so always shown)
- Does the reduced denominator note (e.g., "su 11 mesi coperti") fit inline with the totals? (D-10 specifies it goes underneath)

### detail-chart.html (Rejected, Kept as Rationale Record)
**Why this variant was rejected (D-08/D-09 rationale):**

The chart variant attempts to show bars (current-year spending) with a 2025 reference line overlaid. Drawback: month-over-month delta must be rendered as a glyph (▼ 24,30) to fit above the bars. This violates D-13 ("magnitude plus a word, never a sign glyph"). Per D-08, the table is chosen because it can show the delta as text inside each cell without space pressure.

**How the difference chart should be designed instead (D-08 implementation):**
- Bars represent month-by-month difference (`current − previous`), NOT absolute spending
- Bars sit above/below a zero line; colour is mapped by direction (on "out", above = worse; on "in", above = better) via `resolveComparisonJudgement()`
- Axis labels: absolute amounts (e.g., "€107,90"), never signs
- Tooltip says it in words: "107,90 in più di lug 2025"
- Short legend states "cosa significa una barra sopra/sotto lo zero"
- Chart consumes the exact same series object as the table (D-08 compatibility)

## Sources

### Primary (HIGH confidence — code verified in this session)
- [VERIFIED: app/(app)/dashboard/categories/[id]/page.tsx:27-30] Current detail page signature and preset usage
- [VERIFIED: lib/dal/dashboard.ts:1510-1743] `getCategoryDetail()` current signature with preset-based `dashboardPresetToDateRange()` call
- [VERIFIED: lib/services/pace-and-projection.ts:1-157] Phase 82 exported functions (`computeComparison`, `resolveComparisonJudgement`, `buildYearSeries`, `isPartialMonth`, `computeCurrentMonthHybrid`, `PREVIOUS_YEAR_TOTAL_DIFFERENCE_MIN_COVERED_MONTHS`, `canShowPreviousYearTotalDifference`)
- [VERIFIED: lib/dal/covered-months.ts:34-100] Phase 82 exported functions (`getCoveredMonthsInYear`, `getCategoryMonthlyAmounts`)
- [VERIFIED: components/dashboard/category-subcategory-breakdown.tsx:1-97] Current subcategory component, Deviation-dependent
- [VERIFIED: components/dashboard/dashboard-filters.tsx:1-111] Current filter UI with preset select
- [VERIFIED: .scratch/dashboard-categories/detail-table.html:1-207] Locked prototype, chosen shape (D-19)
- [VERIFIED: .scratch/dashboard-categories/detail-chart.html:1-174] Locked prototype, rejected (D-08/D-09 rationale)
- [VERIFIED: .planning/phases/84-category-detail-and-cleanup/84-CONTEXT.md:1-338] All 19 locked decisions (D-01…D-19)
- [VERIFIED: .planning/REQUIREMENTS.md:1-109] Phase 84 requirements (CDET-01…07, RETIRE-01…02)

### Secondary (MEDIUM confidence — Phase 82/83 documentation + CONTEXT references)
- [CITED: docs/adr/0020-categories-year-view-retires-deviation.md] ADR governing the architectural model (year as container, window viewport, pace anchored to full year, no lens on Categories)
- [CITED: .planning/dashboard-categories-DECISIONS.md] 19-decision record underlying REQUIREMENTS.md (D1-D19 in the original numbering)
- [CITED: .planning/phases/82-number-engine-and-regression-gate/82-*-SUMMARY.md] Phase 82 deliverables and RETIRE-05 baseline signature

### Codebase Inventory (verified via grep this session)
- **13 files containing retired vocabulary:** app/(app)/dashboard/categories/[id]/page.tsx, app/(app)/dashboard/categories/page.tsx, app/(app)/dashboard/tags/page.tsx, components/dashboard/category-subcategory-breakdown.tsx, components/dashboard/dashboard-filters.tsx, components/dashboard/dashboard-tab-nav.tsx, components/dashboard/deviation-badge.tsx, components/data-table/MonthMultiPicker.tsx, lib/dal/dashboard.ts, lib/routes.ts, lib/utils/dashboard.ts, lib/utils/date.ts, lib/validations/dashboard.ts
- **Call sites for DAL functions needing signature update:** app/(app)/dashboard/categories/[id]/page.tsx (getCategoryDetail, getCategoryDeviations), tests/helpers/reimbursement-test-db.ts (getCategoriesBreakdown, getCategoryRanking, getCategoryDeviations, getCategoryDetail)

## Metadata

**Confidence breakdown:**
- Standard stack (Phase 82/83 surfaces): HIGH — code verified, locked CONTEXT decisions
- Architecture patterns (window clamping, contribution summing, month-state classification): HIGH — prototype and CONTEXT D-01…D-19 explicit
- Pitfalls (D-15 signature change, Deviation removal, month-state confusion): HIGH — codebase inventory complete, call sites identified
- Test scaffolding (Vitest + Postgres, regression gate RETIRE-02): HIGH — existing test harness (reimbursement-test-db.ts) examined
- Locked prototypes (detail-table.html as chosen, detail-chart.html as rejected record): HIGH — files read, structural facts documented

**Research date:** 2026-08-03
**Valid until:** 2026-08-20 (stable codebase, locked decisions, no framework changes expected)
**Refresh trigger:** If any Phase 82/83 signatures change, or if CONTEXT.md decisions are reopened (unlikely given ADR 0020 closure)

---

**Phase:** 84-category-detail-and-cleanup
**Research completed:** 2026-08-03
**Status:** Ready for planning (no assumptions, all claims verified or cited)
