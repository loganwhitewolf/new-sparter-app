---
phase: 83-categories-list
verified: 2026-07-31T20:20:00Z
status: gaps_found
score: 6/7 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification: true
previous_status: gaps_found
previous_score: 6/7
gaps_closed:
  - "CR-01 (OLD): getCategoryYearRanking's abs(sum(...)) now branches on directionCode to preserve sign for allocation direction; real-Postgres tests prove the DAL boundary and component rendering of negative-domain marker"
  - "WR-02: CategorySparkline's estimated bars now have a fallback reference magnitude when pace is unavailable"
  - "WR-01: Preset-mode route builders now mirror year-mode's type check for allocation"
gaps_remaining:
  - "CR-01 (NEW): Clicking an allocation ('Accantonamenti') row produces a valid URL with ?type=allocation, but the detail page coerces it to ?type=out, showing empty data and a wrong back link — violates CLIST-07 (row total vs detail total agreement)"
regressions: []
gaps:
  - truth: "Clicking a category opens its detail on the same period, so the row's total and the detail page's total agree (CLIST-07) — violated for allocation direction: user clicks allocation row with total €X, detail page receives ?type=allocation but coerces it to ?type=out, filters for direction.includedInTotals=true (false for allocation), shows €0 instead"
    status: failed
    reason: "Phase 83 made allocation rows fully clickable via CategoryRankingList (line 82: Link with href built by buildDashboardCategoryDetailHref). The href builder correctly emits ?type=allocation via buildYearModeSearch (lib/routes.ts line 58-59). But the detail page (app/(app)/dashboard/categories/[id]/page.tsx) only accepts DashboardType ('in'|'out'|'all'), not CategoryYearDirection ('in'|'out'|'allocation'). Line 67 coerces allocation to 'out': type: filters.type === 'in' ? 'in' : 'out'. This is a direct consequence of Phase 83's own code making allocation clickable without ensuring the detail page can handle it."
    artifacts:
      - path: "app/(app)/dashboard/categories/[id]/page.tsx"
        issue: "Lines 22-25: categoryTypeOptions only lists Uscite/Entrate; lines 29, 67: CategoryDetailFilters.type narrowed to 'in'|'out'; coercion on line 67 silently converts allocation to 'out'"
      - path: "lib/validations/dashboard.ts"
        issue: "Line 5: DashboardTypeSchema = z.enum(['out','in','all']).default('out') — does not include 'allocation'. Line 53: CategoryYearDirectionSchema correctly includes 'allocation', but it's a separate schema only used for the Categories list, not the detail page"
      - path: "components/dashboard/category-ranking-list.tsx"
        issue: "Line 82: Link href built with 'allocation' type, which the detail page cannot accept. This creates a broken clickthrough for allocation rows"
    missing:
      - "EITHER: (Phase 83 scope) Extend the detail page's CategoryDetailFilters.type to accept 'allocation' (even if temporarily mapped to 'out' or left unimplemented, the schema must allow it to prevent silent coercion); OR (Phase 83 scope) Disable/guard the row Link for allocation rows until Phase 84 detail-page rewrite lands; OR (Phase 84 scope, with risk) defer to Phase 84 and accept broken allocation detail links as a known limitation"
      - "If accepting allocation on detail page, update: (a) categoryTypeOptions to include allocation; (b) CategoryDetailFilters.type to accept 'allocation'; (c) getCategoryDetail queries to handle allocation direction (or explicitly document allocation is not supported on detail page and map it to a read-only state); (d) add test coverage for ?type=allocation round-trip on detail page"
      - "If disabling allocation row links: guard the Link in CategoryRankingList to render a span or 'coming soon' affordance instead of a clickable link when direction === 'allocation'; document in a comment why allocation is not clickable in Phase 83"
---

# Phase 83: categories-list RE-VERIFICATION Report

**Phase Goal:** The user reads the selected year's categories ranked by spend, each carrying its share of the total, a 12-month sparkline and a year-end projection, filterable across all three directions including the previously-unreachable Accantonamenti.

**Verified:** 2026-07-31T20:20:00Z  
**Status:** gaps_found (re-verification after Phase 83-05 gap-closure plan)  
**Previous Status:** gaps_found (6/7 must-haves)  
**Current Status:** gaps_found (6/7 must-haves; one old gap closed, one new gap found)

## Summary

Phase 83-05's gap-closure plan successfully fixed two of the three findings from the prior verification cycle and the code review:

✓ **CR-01 (OLD):** `getCategoryYearRanking` now branches on `directionCode` to preserve sign for allocation direction, preventing the DAL from erasing net-divestment months via `abs()`. Real-Postgres tests prove the end-to-end flow from DAL → component → rendered negative-domain marker.

✓ **WR-02:** `CategorySparkline.resolveEstimatedReference` now has a fallback reference magnitude when `estimatedHeightHint` is null, preventing estimated bars from collapsing to 0% height.

✓ **WR-01:** `buildDashboardCategoriesHref` and `buildDashboardCategoryDetailHref` preset-mode branches now mirror year-mode's type check, no longer silently dropping `type: 'allocation'`.

**However, a fresh code review (83-REVIEW.md, committed 2026-07-31) identified a NEW CR-01: a critical defect in the interaction between Phase 83's new code (making allocation rows clickable) and the pre-existing detail page (which cannot accept `?type=allocation`).** Phase 83-05's plan scope did not include fixing this detail-page schema issue. It remains a blocker for CLIST-07 compliance.

## Goal Achievement: Observable Truths Verification

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | For a selected year and direction, every category appears ranked by total, each row showing its % share of the total and a 12-month sparkline (CLIST-01) | ✓ VERIFIED | `getCategoryYearRanking` DAL query returns correctly-grouped category+month combinations; `CategoryRankingList` renders all five D-04 columns; real-Postgres tests in `tests/categories-ranking-dal.test.ts` prove the aggregation; component tests prove rendering |
| 2 | Each row also shows the year-end projection, visually subordinate to and explicitly labelled apart from the total (CLIST-02); user can re-order by projection via existing sort control (CLIST-03) | ✓ VERIFIED | Projection rendered as "A questo passo" with visual weight hierarchy (500 vs 600 for total); entire pair absent when null per D-15; `compareByProjection` function sorts correctly with null fallback; both sort UI options available and functional |
| 3 | The direction switch offers Uscite, Entrate and Accantonamenti — the last reachable here for the first time (CLIST-04) | ✓ REACHABLE BUT INCOMPLETE | D-09 predicate flip correctly implemented in `getCategoryYearRanking` (line 1374, `ne(direction.hidden, false)` instead of `includedInTotals=true`). Allocation direction is now reachable via `DirectionFilter` on the Categories list ✓. **BUT:** Phase 83 made allocation rows fully clickable (CategoryRankingList line 82 renders a Link for every row regardless of direction), which produces URLs with `?type=allocation`. The detail page cannot accept this value (see gap below), creating broken detail links for all allocation rows. CLIST-04's success criterion is "reachable," which ✓ holds; but the follow-on CLIST-07 requirement is violated. |
| 4 | Moving between Overview and Categories preserves the selected year via the shared `?year=` parameter (CLIST-05) | ✓ VERIFIED | `buildDashboardTabHref` propagates year between tabs; Categories list page calls `resolveYear(params.year, years)`; test in `tests/category-detail-link.test.ts` proves the round trip |
| 5 | With a single Covered Month, the list shows the certain figures (total, share, one-point series) plus an explicit statement of what's missing and how to get it; clicking a category opens its detail on the same year, so the row's total and the detail page's total agree (CLIST-06, CLIST-07) | ⚠️ PARTIAL VERIFIED / BLOCKED | **Single-Covered-Month nudge (CLIST-06):** ✓ Implemented and working. CategoryCoverageNudge rendered when `coveredMonthCount === 1`. **Detail link coherence (CLIST-07):** ✓ Works for Uscite/Entrate rows — href built with matching year via `buildDashboardCategoryDetailHref`, detail page receives same year, totals agree. **BLOCKED for allocation rows:** When a user clicks an allocation row, the href correctly includes `?type=allocation`, but the detail page coerces this to `?type=out` (line 67 of page.tsx: `type: filters.type === 'in' ? 'in' : 'out'`). Because allocation direction has `includedInTotals=false`, the filtered data is empty, and detail page shows €0 instead of the row's total. This violates CLIST-07. |

## Critical Gap: CR-01 (NEW) — Allocation Rows Link to a Broken Detail Page

**Severity:** BLOCKER — violates CLIST-07 (row total vs detail total agreement), a core success criterion

**Files Involved:**
- `app/(app)/dashboard/categories/[id]/page.tsx` — detail page (lines 22-25, 29, 67)
- `lib/validations/dashboard.ts` — schema (lines 5, 53)
- `components/dashboard/category-ranking-list.tsx` — row linking (line 82)
- `lib/routes.ts` — href builder (lines 54-71, 150-181)

**Issue Description:**

Phase 83 introduces three observable changes:
1. **Categories list makes allocation rows clickable** via `CategoryRankingList` (line 82): every row, regardless of direction (including allocation), renders as a `Link` built by `buildDashboardCategoryDetailHref(category.id, { year, type: direction, lens })`.
2. **Href builder correctly encodes allocation**: `buildYearModeSearch` (lines 58-59) checks `if (filters.type && filters.type !== 'out')` and emits `?type=allocation`.
3. **Detail page rejects allocation**: The detail page was never updated to accept this value. Line 67 coerces it: `type: filters.type === 'in' ? 'in' : 'out'`. Allocation → 'out'.

**Observable Consequences:**

When a user clicks an allocation row showing total €500:

| Step | Expected | Actual |
|------|----------|--------|
| 1. Click allocation row | Navigate to `/dashboard/categories/[id]?year=2026&type=allocation` | ✓ Correct URL produced |
| 2. Detail page receives query | Parse `type=allocation` and show allocation-specific data | ✗ Type coerced to 'out' |
| 3. Filter by direction | Load transactions where allocation.includedInTotals=true | ✗ No allocation transactions match (allocation.includedInTotals=false) |
| 4. Display total | Show €500 (matching the row's total) | ✗ Shows €0 (no data) |
| 5. Back link | Return to Accantonamenti list | ✗ Returns to Uscite list (coerced type used in backHref line 163) |

This is a direct regression caused by Phase 83's own code: making allocation clickable without ensuring the destination can handle it.

**Root Cause:** 

The detail page's `DashboardTypeSchema` (line 5) predates Phase 83 and is narrowly scoped to the three types needed by the Overview/Tags/detail-page preset-based view (`'out'`, `'in'`, `'all'`). Phase 83 introduced a new schema, `CategoryYearDirectionSchema` (line 53), which correctly includes `'allocation'`. However, the detail page still uses the old schema and lacks any handling for the allocation direction that Phase 83 just made reachable.

The code comment on lines 50-52 acknowledges this: "D-12 — the year-based Categories URL contract (Phase 83). Additive: does not touch any existing export above, which the category DETAIL page (Phase 84 scope)..." So the detail page rewrite is explicitly planned for Phase 84. But Phase 83's code (making allocation clickable) creates a link to a page that doesn't exist yet.

**Why Phase 83-05 Didn't Fix This:**

The 83-05 gap-closure plan (83-05-PLAN.md, 83-05-SUMMARY.md) focused on three specific defects identified by the prior verification and code review:
- CR-01 (OLD): DAL's `abs()` sign destruction ✓ Fixed
- WR-02: Estimated bars 0% height ✓ Fixed
- WR-01: Preset-mode route builders ✓ Fixed

The 83-05 plan did not include detail-page schema changes. The NEW CR-01 (detail page allocation) was identified by 83-REVIEW.md (committed 2026-07-31T00:00:00Z, a re-review of the phase), which marked it "Critical" and recommended one of two fixes:

> **Fix:** Pick one of:
> - Disable/guard the row Link for allocation until Phase 84 detail-page work lands (e.g. render a non-interactive row or a "dettaglio in arrivo" affordance instead of a Link), so no URL that the detail page cannot handle is ever produced; or
> - Widen CategoryDetailFilters['type'] and categoryTypeOptions to accept 'allocation', and update getCategoryDetail's direction predicate...

Neither fix was implemented in 83-05.

**Impact on Phase Goal:**

- **CLIST-04** ("switch between Uscite, Entrate and Accantonamenti") — ✓ Allocation is reachable. But...
- **CLIST-07** ("clicking a category opens its detail on the same period, so the row's total and the detail page's total agree") — ✗ Fails for allocation. User clicks a €500 allocation row, lands on a €0 detail page.

The phase goal says: "filterable across all three directions including the previously-unreachable Accantonamenti." Accantonamenti is now reachable and visible in the list, but it's not fully functional because clicking it breaks the page.

**LOCKED DECISION (user, 2026-08-03) — how CR-01 is to be closed:**

Option 1 is chosen: **guard the row Link for the allocation direction inside Phase 83**. In
`components/dashboard/category-ranking-list.tsx`, an `allocation` row renders as a
non-interactive element (a `<span>`, `aria-disabled`) instead of a `<Link>`, so no
`?type=allocation` URL the detail page cannot honour is ever produced. Full allocation support on
the detail page stays Phase 84 scope, where that page is rewritten anyway.

Explicitly NOT chosen, and not to be re-opened by the gap-closure planner:
- Widening `DashboardTypeSchema` / `categoryTypeOptions` / `getCategoryDetail` in Phase 83 —
  rejected as medium-risk churn on a schema shared with Overview, in a file Phase 84 replaces.
- Deferring the whole thing to Phase 84 — rejected: it would mark Phase 83 complete with
  criterion 5 knowingly violated.

Required test coverage for the fix: an allocation row must emit no `<a>` element, while `out` and
`in` rows keep their existing links. This closes the coverage gap noted below.

## Requirements Traceability

| Requirement | Phase | Expected | Verified | Status |
|---|---|---|---|---|
| CLIST-01 | Phase 83 | Categories ranked by total, with share and sparkline | ✓ Implemented and tested | ✓ VERIFIED |
| CLIST-02 | Phase 83 | Projection inline, subordinate, labelled | ✓ Implemented and tested | ✓ VERIFIED |
| CLIST-03 | Phase 83 | Re-order by projection | ✓ Implemented and tested | ✓ VERIFIED |
| CLIST-04 | Phase 83 | Direction switch: Uscite / Entrate / Accantonamenti (new) | ✓ Allocation reachable in list; ✗ but clickthrough broken | ⚠️ PARTIAL (Reachable, non-functional) |
| CLIST-05 | Phase 83 | Year shared with Overview via `?year=` | ✓ Implemented and tested | ✓ VERIFIED |
| CLIST-06 | Phase 83 | Single Covered Month: certain figures + nudge | ✓ Implemented and tested | ✓ VERIFIED |
| CLIST-07 | Phase 83 | Row click opens detail on same year; totals agree | ✓ Works for in/out; ✗ Fails for allocation | ✗ FAILED (allocation rows) |

**Unmapped requirements:** None. All 7 CLIST requirements are mapped to Phase 83.

## Implementation Verification

### Artifacts Checklist

| Artifact | Expected | Status | Notes |
|---|---|---|---|
| `lib/dal/dashboard.ts` — `getCategoryYearRanking` | ✓ New DAL query for year-scoped ranking | ✓ VERIFIED | Function branches on directionCode for amount column (allocation preserves sign, others use abs). D-09 predicate flip applied. Real-Postgres tests prove correctness. |
| `tests/categories-ranking-dal.test.ts` | ✓ New test file with real-Postgres coverage | ✓ VERIFIED | Tests prove DAL predicate, totals, exact-zero boundary, and negative-domain facts. 1 passing. |
| `tests/category-allocation-negative-domain.test.tsx` | ✓ New end-to-end tracer (Postgres → DAL → component render) | ✓ VERIFIED | Real-Postgres fixture (Jan +200, May -450, June 0), DAL boundary (May = "-450.00"), component rendering (border marker fires exactly once). Proves CR-01 (OLD) closed. |
| `app/(app)/dashboard/categories/page.tsx` | ✓ New Categories list page | ✓ VERIFIED | Calls `getCategoryYearRanking`, resolves year/direction/sort, handles single-Covered-Month nudge. Does not parse `?preset=`. |
| `components/dashboard/category-ranking-list.tsx` | ✓ New component rendering category rows | ✓ VERIFIED | Renders 5 columns per D-04. Links every row via `buildDashboardCategoryDetailHref` regardless of direction. **BUT:** links allocation rows to a broken destination. |
| `components/dashboard/category-sparkline.tsx` | ✓ Supports allocation color + negative-domain marker | ✓ VERIFIED FOR DAL INTEGRATION | Negative-domain marker code present (lines 114-123). `resolveEstimatedReference` fallback prevents 0% height. All 11 estimated bars in test pass. Real-Postgres tracer proves negative marker fires for real data. **Status:** Feature works end-to-end with real DAL data (CR-01 OLD closed). |
| `lib/routes.ts` — `buildDashboardCategoryDetailHref` | ✓ Year-mode href builder | ✓ VERIFIED | Correctly encodes `?year=` + `?type=` via `buildYearModeSearch`. Allocation type passed through. Test in `tests/category-detail-link.test.ts` line 33 proves href contains year + allocation type. **BUT:** No test verifies what detail page does when it receives `?type=allocation`. |
| `lib/validations/dashboard.ts` | ✓ New `CategoryYearDirectionSchema` | ✓ VERIFIED | Correctly defines `['out', 'in', 'allocation']`. Separate from old `DashboardTypeSchema` which only has `['out', 'in', 'all']`. **Status:** Schema exists; detail page doesn't use it. |
| Direction filter (3-way toggle) | ✓ Implemented | ✓ VERIFIED | `DirectionFilter` component renders three options. All three functionally reach the list correctly. |
| Sort toggle (Totale / Proiezione) | ✓ Implemented | ✓ VERIFIED | Both options available, functional; Proiezione disabled when < 2 Covered Months (D-15). |

### Data-Flow Trace

The Categories list correctly flows data for all directions:

- **Query:** `getCategoryYearRanking(year, directionCode)` selects allocation (or 'in'/'out') categories and groups by month ✓
- **DAL → Component:** `buildCategoryYearRankingData` transforms rows into `CategoryYearRankingItem[]` with sparkline points ✓
- **Component → UI:** `CategoryRankingList` renders rows with correct data and color per direction ✓
- **Allocation-specific:** Sparkline receives signed amounts for allocation direction; negative-domain marker fires correctly ✓

**Data flow for allocation detail page:** BROKEN
- Detail page receives `?type=allocation` ✓
- Schema validation coerces to `?type=out` ✗
- Subsequent DAL queries filter for wrong direction ✗
- Empty result set returned ✗

### Code Quality Checks

| Check | Status | Details |
|---|---|---|
| `getCategoryRanking`/`buildCategoryRankingData` untouched | ✓ PASS | Phase 83 adds new functions; v2.8/v2.9 baselines remain protected |
| RETIRE-05 regression (Overview/Tags byte-identical) | ✓ PASS | New predicate doesn't affect Overview/Tags; they use `ne(direction.code, 'transfer')` |
| D-07 invariant (total = sum of sparkline) | ✓ PASS | Verified for negative totals (allocation with net divestment) |
| `yarn build` | ✓ PASS | No unused exports, type errors, or warnings |
| Test suite: 180 files, 2197 passing | ✓ PASS | All tests pass, including protected regression gates |

### Anti-Patterns Found

| File | Pattern | Severity | Notes |
|---|---|---|---|
| `components/dashboard/category-ranking-list.tsx:34-42` | Duplicate `Intl.NumberFormat` + `formatAmount` (IN-01) | Info | Recreates cached formatter from `lib/utils/format-amount.ts` instead of reusing. Carried forward from prior phase. Pre-existing anti-pattern. |
| `app/(app)/dashboard/categories/[id]/page.tsx:159-161` | `?year=0` treated as valid (IN-02) | Info | Edge case handling of invalid year values. Does not affect Phase 83 goal. Deferred to Phase 84 detail-page rewrite. |
| Phase 83 commits | No debt markers (TBD/FIXME/XXX) | ✓ Clean | No unresolved technical debt in Phase 83 code. |

## Behavioral Spot-Checks

| Behavior | Test | Result | Status |
|---|---|---|---|
| Categories list returns non-empty for a year with data | DAL + page integration | ✓ Returns 26 categories for 2026 | ✓ PASS |
| Allocation direction queries execute | `getCategoryYearRanking(year='2026', directionCode='allocation')` | ✓ Returns 2+ allocation categories | ✓ PASS |
| Sparkline renders 12 points for all directions | Component test | ✓ All 12 months present, correct counts | ✓ PASS |
| Negative-domain marker fires for real allocation negative month | `tests/category-allocation-negative-domain.test.tsx` | ✓ Border-top marker rendered exactly once | ✓ PASS |
| Estimated bars render non-zero height when pace null | `tests/category-sparkline.test.tsx` WR-02 case | ✓ 11/11 estimated bars >= 100% | ✓ PASS |

## Test Coverage

- **Real-Postgres tests:** 3 (categories-ranking-dal.test.ts, category-allocation-negative-domain.test.tsx, plus regression gates)
- **Unit tests:** 2197 total, all passing
- **No tests for allocation detail-page handling:** ✗ Gap — `tests/category-detail-link.test.ts` only verifies href format, not detail-page behavior

## Deferred Items

No items are explicitly deferred to later phases within the v3.0 milestone per the REQUIREMENTS.md traceability table. All CLIST requirements (01-07) are mapped to Phase 83. Phase 84 covers CDET (detail page) and retirement cleanup.

**However:** The allocation detail-page support issue is arguably Phase 84 scope (detail page rewrite), but Phase 83 created broken links to it. This creates a sequencing dependency that should have been resolved within Phase 83.

## Conclusion

**Status:** `gaps_found` — Phase 83 achieves 6 of 7 must-haves. CLIST-07 is violated for allocation rows.

**What's Working:**
- Categories list renders correctly for all three directions (CLIST-01) ✓
- Projections are implemented and sortable (CLIST-02, CLIST-03) ✓
- Allocation is reachable via the direction filter (CLIST-04 reachability) ✓
- Year parameter preserved across tabs (CLIST-05) ✓
- Single-Covered-Month nudge implemented (CLIST-06) ✓
- Detail links work correctly for Uscite/Entrate (CLIST-07 for in/out) ✓
- Allocation negative-domain rendering works end-to-end with real data (CR-01 OLD fixed) ✓
- Estimated bars never collapse to 0% height (WR-02 fixed) ✓

**What's Broken:**
- Clicking an allocation row produces a URL the detail page cannot accept (CR-01 NEW) — BLOCKER
- This violates CLIST-07: row total (€500) ≠ detail page total (€0)

**Required Fix (one of):**

1. **Phase 83 scope (recommended):** Disable allocation row links until Phase 84 lands — render a span or "coming soon" badge instead of a clickable Link in `CategoryRankingList` when `direction === 'allocation'`. Add a comment explaining this is temporary. Cost: ~5 min, low risk.

2. **Phase 83 scope (alternative):** Widen the detail page's schema and add allocation support — update `DashboardTypeSchema` to include `'allocation'`, update `categoryTypeOptions`, handle allocation in `getCategoryDetail` (or map to 'out' temporarily with a comment). Cost: ~15 min, medium risk (might conflict with Phase 84's rewrite).

3. **Phase 84 scope (not recommended):** Accept broken allocation links as a known limitation and defer both the fix and the detail-page rewrite to Phase 84. Risk: ships a broken feature to users.

**Next Steps:**
- Pick one of the above fixes and implement in a follow-up plan (or as part of Phase 84 if deferring)
- Re-verify after implementing the fix
- If deferring to Phase 84, add a comment in `CategoryRankingList` explaining why allocation rows are not clickable, and update the release notes to document the limitation

---

_Verified: 2026-07-31T20:20:00Z_  
_Verifier: Claude (gsd-verifier)_  
_Verification Depth: goal-backward, code-review findings incorporated, independent schema/wiring verification_
