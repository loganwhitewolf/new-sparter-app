---
phase: 83-categories-list
verified: 2026-07-31T23:59:59Z
status: gaps_found
score: 6/7 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "On the allocation direction, a net-divestment month (negative amount) renders visually distinct from a zero month with an explicit marker — the UI-SPEC locked requirement stating 'the bar renders inverted or with a distinct visual marker' is defeated at the DAL layer"
    status: failed
    reason: "lib/dal/dashboard.ts line 1347 applies abs(sum(...)) which destroys the sign before the data reaches the component. The component category-sparkline.tsx has the feature built (line 117 checks 'rawAmount < 0' to apply a border marker), and the unit test passes with synthetic negative values, but real data from getCategoryYearRanking can never be negative for the allocation direction. This directly contradicts the locked UI-SPEC backstop requirement ('On the allocation direction a net-divestment month renders visually distinct from a zero month — the existing parseAmount Math.max(parsed, 0) clamp must not survive') and the D-09 design decision requiring allocation direction to 'admit net-divestment months (negative amounts)'"
    artifacts:
      - path: lib/dal/dashboard.ts
        issue: "Line 1347 uses abs(sum(...)) for all directions, including allocation. The query should either (a) remove abs() entirely and apply .abs() only to output columns that require non-negative values (total, percentage), or (b) branch on directionCode to keep signed values for allocation direction"
      - path: components/dashboard/category-sparkline.tsx
        issue: "Lines 24-26 document D-09 negative-domain support. Lines 114-123 implement the feature (isNegative check, borderTop marker). But the feature is unreachable with real data because the DAL destroys the sign at the source"
      - path: tests/category-sparkline.test.tsx
        issue: "Line 76-88 test the negative-domain marker by feeding a synthetic '-45.50' prop directly to the component, bypassing the DAL. This test passes but does not prove the feature works end-to-end with real data"
    missing:
      - "Fix getCategoryYearRanking to preserve sign for allocation direction — either remove abs() from the query or apply signed values only for allocation"
      - "Add a real-Postgres regression test seeding an allocation category with a net-negative month and asserting the sparkline point's amount is negative (mirroring tests/categories-ranking-dal.test.ts style)"
      - "Verify component receives negative values and renders the visual marker"
  - truth: "When a category's projection is null (< 2 pace-eligible Covered Months), estimated (future) months in the sparkline render at a visible height with a striped pattern — never a flat 0% bar that reads as 'no data'"
    status: failed
    reason: "components/dashboard/category-sparkline.tsx line 102 sets 'reference' to 'Number(estimatedHeightHint ?? '0')' for estimated months. When pace is null (insufficient coverage), estimatedHeightHint is null, so reference becomes 0. If all covered/current months are also zero (no spending yet), max referenceMagnitude is 0, causing every estimated bar's heightPercent to be 0% (line 112). The function's own doc comment (lines 61-64) states 'estimated ... never render a flat/zero-height bar: estimated is normalized like any other bar' — but this is violated when pace is null. This affects the allocation direction specifically when <= 1 pace-eligible Covered Months"
    artifacts:
      - path: components/dashboard/category-sparkline.tsx
        issue: "Lines 99-112: when estimatedHeightHint is null, reference becomes 0, collapsing estimated bars to 0% height"
    missing:
      - "Fall back to a non-zero reference when estimatedHeightHint is unavailable — e.g., the series' observed max magnitude or a fixed proportional value"
      - "Add a test case: seed a category with 1 Covered Month (pace null) and future months with zero amount, assert estimated bars render at non-zero height"
deferred: []
---

# Phase 83: categories-list Verification Report

**Phase Goal:** Deliver the Categories list on the year axis — every category ranked for a selected year and direction, with share, 12-month sparkline and year-end projection — across all three directions including the previously-unreachable Accantonamenti.

**Verified:** 2026-07-31T23:59:59Z
**Status:** gaps_found
**Requirement Coverage:** 6/7 core requirements verified (CLIST-01, CLIST-02, CLIST-03, CLIST-05, CLIST-06, CLIST-07); CLIST-04 partially satisfied with critical defect

## Summary

Phase 83 successfully makes the allocation direction (Accantonamenti) reachable via the direction filter for the first time, implements the year-scoped category ranking with 12-month sparklines, inline projections, and single-Covered-Month nudges. **However, a critical defect in the DAL data layer defeats a locked UI design requirement:** the `abs(sum(...))` in `getCategoryYearRanking` destroys sign information at the SQL level, making it impossible for the allocation direction to render net-divestment months (negative amounts) with the visual marker explicitly required by the UI-SPEC. An additional defect causes estimated-month bars to collapse to 0% height when pace is insufficient. These are not cosmetic issues — they defeat specific, locked design decisions and directly contradict documented Phase 83 requirements.

## Goal Achievement

### Observable Truths Verification

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | For a selected year and direction, every category appears ranked by total, each row showing its % share of the total and a 12-month sparkline (CLIST-01) | ✓ VERIFIED | `lib/dal/dashboard.ts` implements `getCategoryYearRanking(year, directionCode)` which queries and groups by category+month, returning 12-entry sparklines zero-filled per category. `app/(app)/dashboard/categories/page.tsx` calls it and passes data to `CategoryRankingList`. Component renders exactly 5 columns (rank, name/metadata, sparkline, total, projection) per D-04. Tests in `tests/categories-ranking-dal.test.ts` prove the DAL works end-to-end; component tests prove the rendering. |
| 2 | Each row also shows the year-end projection, visually subordinate to and explicitly labelled apart from the total (CLIST-02); the user can re-order the list by projection instead of total via the existing sort control (CLIST-03) | ✓ VERIFIED | Projection rendered as "A questo passo" label with subordinate weight (500) and muted-fg colour, separate from total's 600 weight and foreground colour. `category-ranking-list.tsx` line 150-157 shows the entire projection pair is absent when null (no em-dash, per D-15). Sorting implemented via `compareByProjection` function (lines 27-31) which falls back to amount for null projections, never crashes. Both Totale and Proiezione sort options available in UI |
| 3 | The direction switch offers Uscite, Entrate and Accantonamenti — the last reachable here for the first time (CLIST-04) | ⚠️ PARTIAL VERIFIED / BLOCKED | **Reachability:** D-09 predicate flip (`eq(direction.hidden, false)`) is correctly implemented in `getCategoryYearRanking` line 1374, replacing the old `includedInTotals=true` check. Allocation direction is now reachable — ✓ verified. **But:** A locked UI-SPEC design requirement for the allocation direction is defeated: the specification explicitly requires "On the allocation direction a net-divestment month renders visually distinct from a zero month... the bar renders inverted or with a distinct visual marker" (UI-SPEC E2 negative-domain backstop). The component code implements this feature (category-sparkline.tsx lines 114-123: `isNegative` check with `borderTop` marker), but the DAL data source destroys sign information via `abs(sum(...))` at line 1347, so the feature can never fire with real data. Unit test passes because it feeds synthetic negative values directly to the component, bypassing the DAL. This is a gap blocker for full CLIST-04 compliance. |
| 4 | Moving between Overview and Categories preserves the selected year via the shared `?year=` parameter (CLIST-05) | ✓ VERIFIED | `lib/routes.ts` `buildDashboardTabHref` correctly propagates `year` parameter between tabs. `app/(app)/dashboard/categories/page.tsx` calls `resolveYear(params.year, years)` to resolve it. Round-trip test would be integration-level; year parameter carrier is present and used. |
| 5 | With a single Covered Month, the list shows the certain figures (total, share, one-point series) plus an explicit statement of what's missing and how to get it; clicking a category opens its detail on the same year, so the row's total and the detail page's total agree (CLIST-06, CLIST-07) | ✓ VERIFIED | **Single-Covered-Month nudge:** `app/(app)/dashboard/categories/page.tsx` lines 80-81 calculate `coveredMonthCount` and pass it to `CategoryRankingContent`, which renders `CategoryCoverageNudge` when `coveredMonthCount === 1` (line 65). Component exists and has appropriate copy. **Detail link coherence:** `category-ranking-list.tsx` line 83 constructs href via `buildDashboardCategoryDetailHref(category.id, { year, type: direction, lens })`, carrying the same year (D-13/CLIST-07 coherence test). Component renders category name as a link to this href (line 100). |

### Critical Defects

#### BLOCKER: CR-01 — Allocation Direction's `abs()` Destroys Sign, Defeating Locked UI Requirement

**Files:** `lib/dal/dashboard.ts:1347`, `components/dashboard/category-sparkline.tsx:24-26, 114-123`, `tests/category-sparkline.test.tsx:76-88`

**Issue:**

The UI-SPEC explicitly requires: "On the allocation direction a net-divestment month renders visually distinct from a zero month" (E2 negative-domain backstop, locked). The component was built to support this:

```ts
// category-sparkline.tsx line 114-123
const isNegative = (state === 'covered' || state === 'current') && rawAmount < 0
return (
  <div ... style={isNegative ? { borderTop: `2px solid ${color}`, opacity: 1 } : undefined}>
    <div ... style={fillStyle} />
  </div>
)
```

But the DAL query destroys the sign at the SQL layer:

```ts
// lib/dal/dashboard.ts line 1347
amount: sql<string>`coalesce(abs(sum(${ledgerRowSource.amount})), 0)::text`,
```

`abs()` is applied **after** `sum()`, so any month whose transactions sum to a negative value (net withdrawal > deposits) has its sign destroyed before the value ever leaves Postgres. When `buildCategoryYearRankingData` assigns this to `sparkline[i].amount`, it's already non-negative. When the component parses it, `rawAmount < 0` can never be true.

**Proof:**
- The unit test `category-sparkline.test.tsx` line 76-88 ("a negative-amount covered/current bar...") passes because it feeds a synthetic `'-45.50'` prop directly to the component, bypassing `getCategoryYearRanking`.
- There is no real-Postgres test seeding an allocation category with a net-negative month and asserting the component receives a negative value.
- With real data, any allocation category with net divestment in a month renders identically to a positive month — the visual marker never appears.

**Impact on Phase Goal:**
- CLIST-04 requires "The user can switch the list between Uscite, Entrate and Accantonamenti." Allocation is now reachable ✓, but one of the fundamental design properties of the allocation direction — distinguishing divestment months visually — is silently broken.
- The phase goal claims to deliver "Accantonamenti" across "all three directions," but the direction is incompletely specified at the data layer.

**Fix Required:**
Either:
1. Remove `abs()` from the query and apply signed values only for the allocation direction; apply `.abs()` explicitly in the DAL's output logic only for columns that require non-negative values (total, percentage), not for the per-month sparkline points; OR
2. Branch the SQL on `directionCode === 'allocation'` to select raw signed `sum(...)` instead.

Then add a real-Postgres regression test asserting that a net-negative month in an allocation category produces a negative sparkline point value.

#### WARNING: WR-02 — Estimated Bars Collapse to 0% When Pace Is Null

**File:** `components/dashboard/category-sparkline.tsx:99-112`

**Issue:**

When `estimatedHeightHint` (the category's `pace` field) is `null` (insufficient coverage, < 2 pace-eligible Covered Months), estimated bars collapse to 0% height:

```ts
const reference = state === 'estimated' ? Number(estimatedHeightHint ?? '0') : parseAmount(point.amount)
// estimatedHeightHint is null → reference becomes 0
// If all covered/current months are also zero → max referenceMagnitude is 0 → heightPercent is 0%
```

The function's own comment states: "estimated... never render a flat/zero-height bar: estimated is normalized like any other bar..." But this contract is violated when pace is null.

**Impact:**
For an allocation category with 1 Covered Month (pace null) and no spending yet (all covered amounts are zero), future months render as flat 0% bars instead of the muted striped placeholder. A future month with insufficient data reads as "no information" instead of "data pending."

**Fix Required:**
Fall back to a non-zero reference magnitude when `estimatedHeightHint` is unavailable.

#### INFO: WR-01 — Route Builder Drops `type: 'allocation'` in Preset Mode (Latent)

**File:** `lib/routes.ts:87-89, 167-169`

**Status:** Latent (not reachable today). The phase widened `DashboardCategoryFilters.type` to include `'allocation'`, but the preset-mode branch only special-cases `'in'`:

```ts
if (filters.type === 'in') {
  params.set('type', filters.type)
}
```

All Phase 83 call sites pass `year` (taking the year-mode path), so this never fires. But if future code calls `buildDashboardCategoriesHref({ type: 'allocation' })` without `year`, the allocation type silently drops, producing an href that resolves back to `'out'`.

**Fix Required:** Mirror the year-mode check for consistency:

```ts
if (filters.type && filters.type !== 'out') {
  params.set('type', filters.type)
}
```

### Requirements Traceability

| Requirement | Phase | Expected | Verified | Status | Evidence |
|---|---|---|---|---|---|
| CLIST-01 | Phase 83 | Categories ranked by total, with share and sparkline | ✓ Implemented | ✓ VERIFIED | `getCategoryYearRanking` DAL, `CategoryRankingList` rendering, real-Postgres tests |
| CLIST-02 | Phase 83 | Projection inline, subordinate, labelled | ✓ Implemented | ✓ VERIFIED | Row renders "A questo passo" label with weight hierarchy; entire pair absent when null (D-15) |
| CLIST-03 | Phase 83 | Re-order by projection | ✓ Implemented | ✓ VERIFIED | `compareByProjection` function with null fallback; both sort options available |
| CLIST-04 | Phase 83 | Direction switch: Uscite / Entrate / Accantonamenti (new) | ✓ Reachable | ⚠️ PARTIAL | Allocation direction is now reachable via D-09 predicate flip ✓; but negative-domain rendering (locked UI requirement) is defeated by DAL's `abs()` |
| CLIST-05 | Phase 83 | Year shared with Overview via `?year=` | ✓ Implemented | ✓ VERIFIED | `buildDashboardTabHref` propagates year; page resolves it |
| CLIST-06 | Phase 83 | Single Covered Month: certain figures + nudge | ✓ Implemented | ✓ VERIFIED | `CategoryCoverageNudge` rendered when `coveredMonthCount === 1` |
| CLIST-07 | Phase 83 | Row click opens detail on same year | ✓ Implemented | ✓ VERIFIED | href built with year parameter via `buildDashboardCategoryDetailHref` |

### Implementation Verification

#### Artifacts Checklist

| Artifact | Expected | Status | Notes |
|---|---|---|---|
| `lib/dal/dashboard.ts` (additive: `getCategoryYearRanking`, `CategoryYearRankingItem`, `CategoryYearSparklinePoint`, `buildCategoryYearRankingData`) | ✓ Exists | ✓ PRESENT | Function is NEW (additive alongside `getCategoryRanking`, not a reshape). D-09 predicate flip correctly applied. **But:** `abs()` destroys sign for allocation (CR-01). |
| `tests/categories-ranking-dal.test.ts` | ✓ New file | ✓ PRESENT | Real-Postgres tests prove predicate flip, D-07 total invariant, D-15 projection null handling. No test seeds an allocation category with negative month. |
| `app/(app)/dashboard/categories/page.tsx` | ✓ Rewritten | ✓ PRESENT | Calls `getCategoryYearRanking`, resolves year/direction/sort, handles single-Covered-Month nudge. Does not parse `?preset=` (pin-by-construction). |
| `components/dashboard/category-ranking-list.tsx` | ✓ Rewritten | ✓ PRESENT | Renders 5 columns per D-04. Handles projection null (absent pair, no em-dash). Sorts by projection with fallback. |
| `components/dashboard/category-sparkline.tsx` (supports allocation type, negative-domain marker) | ✓ Exists | ✓ PRESENT but INCOMPLETE | Color token for allocation correct (`var(--total-allocation)`). Negative-domain marker code present (lines 114-123). **But:** marker can never fire with real allocation data due to DAL's `abs()`. |
| `components/dashboard/category-year-select.tsx` | ✓ New | ✓ PRESENT | Year selector component mirrors `OverviewHeader` pattern. |
| `components/dashboard/category-coverage-nudge.tsx` | ✓ Referenced | ✓ PRESENT | Nudge for single-Covered-Month state, following `OverviewNudge` pattern. |
| Direction filter (3-way toggle: Uscite/Entrate/Accantonamenti) | ✓ Implemented | ✓ PRESENT | `DirectionFilter` component renders three options. Copy set per direction via `resolveCategoryDirectionCopy`. |
| Sort toggle (Totale / Proiezione, with D-15 disablement) | ✓ Implemented | ✓ PRESENT | `SortToggle` shows both options. Proiezione disabled when < 2 pace-eligible Covered Months. |

#### Code Quality Checks

| Check | Status | Details |
|---|---|---|
| `getCategoryRanking`/`buildCategoryRankingData` untouched | ✓ PASS | Phase 83 adds new functions, does not reshape old ones. Protected v2.8/v2.9 regression baselines intact. |
| RETIRE-05 regression (Overview/Tags byte-identical) | ✓ PASS | New predicate doesn't affect Overview/Tags; they use `ne(direction.code, 'transfer')` not `includedInTotals`. |
| D-07 invariant (total = sum of sparkline) | ✓ PASS | Amount always set from `buildYearSeries(displayed sparkline).total` (recomputed after current-month hybrid, per Task 2). |
| `yarn build` succeeds | ✓ PASS | No unused exports or type errors reported. |
| Test suite: 179 files, 2192 passing | ✓ PASS | All existing tests plus Phase 83 new tests pass. 1 todo, 0 failures. |

### Deferred Items

No deferred items identified; no later phase explicitly addresses these gaps per ROADMAP.

### Anti-Patterns Found

| File | Pattern | Severity | Notes |
|---|---|---|---|
| `components/dashboard/category-ranking-list.tsx:34-42` | Duplicate `Intl.NumberFormat` + `formatAmount` (IN-01 from REVIEW) | Info | Recreates cached formatter from `lib/utils/format-amount.ts` instead of reusing. Pre-existing pattern, not introduced by Phase 83, but propagated. Not a blocker. |
| `app/(app)/dashboard/categories/[id]/page.tsx:159-161` | `?year=0` treated as valid (IN-02 from REVIEW) | Info | Edge case where `Number("0")` passes `Number.isFinite` but `0` is not a valid year. Falls back silently. Not a blocker for phase goal. |
| Phase 83 commits | No debt markers (TBD/FIXME/XXX) | ✓ Clean | No unresolved tech debt found in Phase 83's own code. |

## Conclusion

**Status:** `gaps_found` — Phase 83 achieves most of its goal (categories list rewritten onto year axis, allocation direction now reachable, 12-month sparklines and projections working, single-Covered-Month nudge in place). **However, two defects prevent full goal achievement:**

1. **BLOCKER (CR-01):** The allocation direction's negative-domain rendering — explicitly required by locked UI-SPEC — is defeated by the DAL's `abs(sum(...))`. The feature was implemented in the component and unit-tested with synthetic data, but real data from the DAL can never be negative. This directly contradicts the design and silently misrepresents allocation categories with net divestment.

2. **WARNING (WR-02):** Estimated bars collapse to 0% height when pace is null (< 2 pace-eligible Covered Months), violating the component's own stated contract.

Both defects must be fixed before the phase can be considered complete. CLIST-04 requires the allocation direction to be fully functional, not just reachable.

**Next Steps:**
- Fix CR-01: Remove or conditionally apply `abs()` in `getCategoryYearRanking` for allocation direction; add real-Postgres regression test
- Fix WR-02: Implement fallback reference magnitude for estimated bars when pace is null
- Re-verify after fixes

---

_Verified: 2026-07-31T23:59:59Z_
_Verifier: Claude (gsd-verifier)_
_Verification Depth: goal-backward, code-reviewed findings incorporated_
