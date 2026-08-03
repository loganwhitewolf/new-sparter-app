---
phase: 83-categories-list
verified: 2026-08-03T10:45:00Z
status: passed
score: 7/7 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification: true
previous_status: gaps_found
previous_score: 6/7
gaps_closed:
  - "CR-01 (NEW): allocation-direction row now renders a non-interactive <span aria-disabled=\"true\"> instead of a <Link>; no href is computed for that branch, so no ?type=allocation URL that the detail page cannot handle is ever constructed"
gaps_remaining: []
regressions: []
deferred: []
behavior_unverified_items: []
---

# Phase 83: categories-list RE-VERIFICATION Report (Post-Gap-Closure)

**Phase Goal:** The user reads the selected year's categories ranked by spend, each carrying its share of the total, a 12-month sparkline and a year-end projection, filterable across all three directions including the previously-unreachable Accantonamenti.

**Verified:** 2026-08-03T10:45:00Z  
**Status:** PASSED (re-verification after Phase 83-06 gap-closure plan)  
**Previous Status:** gaps_found (6/7 must-haves; 1 gap: CR-01 NEW)  
**Current Status:** passed (7/7 must-haves; CR-01 NEW closed)

## Summary

Phase 83-06 (commits `3edab68f` and `54832fa3`, executed 2026-08-03) successfully closed the single remaining verification gap **CR-01 (NEW)** from the prior verification (2026-07-31). The fix implements exactly the user-locked decision recorded in the previous VERIFICATION.md's "LOCKED DECISION" block:

> Option 1: **guard the row Link for the allocation direction inside Phase 83**. An allocation row renders as a non-interactive element (`<span>`, `aria-disabled`) instead of a `<Link>`, so no `?type=allocation` URL the detail page cannot honour is ever produced. Full allocation support on the detail page stays Phase 84 scope, where that page is rewritten anyway.

**Implementation status:**
- ✓ **CR-01 (NEW) closed:** `components/dashboard/category-ranking-list.tsx` now branches on `direction` — `allocation` renders a non-interactive `<span aria-disabled="true">`, while `out`/`in` render the original `<Link>` unchanged
- ✓ **No ?type=allocation URL ever produced:** The unconditional `href` const was deleted; href computation now lives only inside the non-allocation JSX branch
- ✓ **All 6 previously-verified must-haves remain intact:** No regressions to CLIST-01/02/03/04/05/06
- ✓ **CLIST-07 now satisfied:** "clicking a category opens its detail on the same period, so the total read in the row is the total read on the page" holds for the two directions whose detail page already supports them (`in`/`out`); the third direction (`allocation`) is provably inert rather than silently broken

**Test verification:**
- Phase 83-06 test suite: 9/9 passing in `tests/category-ranking-list.test.tsx`
- Full suite: 2198 passing + 1 todo across 180 files (baseline was 2197; +1 is the new CR-01 guard test)
- Zero failures, zero regressions
- All protected regression gates pass (RETIRE-05, reimbursement v2.8/v2.9 baselines)

## Closed Gap: CR-01 (NEW) — Allocation Rows Link to Broken Detail Page

**Previous Status (2026-07-31):** BLOCKER — violated CLIST-07

**Current Status (2026-08-03):** CLOSED via guard-by-construction

### What Changed

**Before the fix:**
- Allocation rows were fully clickable via `<Link href={buildDashboardCategoryDetailHref(..., { type: 'allocation', ... })}>` 
- This produced a URL like `/dashboard/categories/[id]?year=2026&type=allocation`
- The detail page (app/(app)/dashboard/categories/[id]/page.tsx) coerces `?type=allocation` to `?type=out` (line 67)
- Result: user clicks allocation row with total €500, lands on detail page showing €0 with back link to wrong list
- Violates CLIST-07 (row total ≠ detail page total)

**After the fix:**
- Allocation rows render a non-interactive `<span aria-disabled="true">` instead of a `<Link>`
- The href building function is not called at all for the allocation branch — the URL class that was broken is now closed by construction
- `out` and `in` rows keep their original `<Link>` byte-identical to pre-fix behavior
- Result: allocation rows are visible and readable but provably non-interactive; no broken detail URL is ever produced

### Implementation Details

**File: `components/dashboard/category-ranking-list.tsx`**

Lines 96-116 (the Column 2 name element):

```tsx
{/* CR-01 (NEW), 83-VERIFICATION.md LOCKED DECISION: the allocation direction has
    no detail page yet (Phase 84 scope) — its branch computes no href at all, so
    no ?type=allocation URL the detail page can't honour is ever constructed. */}
{direction === 'allocation' ? (
  <span
    className="block truncate text-base font-semibold text-foreground"
    aria-disabled="true"
    title={category.name}
  >
    {category.name}
  </span>
) : (
  <Link
    href={buildDashboardCategoryDetailHref(category.id, { year, type: direction, lens })}
    className="block truncate text-base font-semibold text-foreground underline-offset-4 outline-none hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
    aria-label={`${category.name}: apri dettaglio categoria`}
    title={category.name}
  >
    {category.name}
  </Link>
)}
```

**Key observations:**
- The unconditional `const href = buildDashboardCategoryDetailHref(...)` that existed before this fix has been deleted entirely
- The `buildDashboardCategoryDetailHref` function is now called only inside the non-allocation JSX branch (the `else` clause)
- The allocation branch (the `if` clause) contains zero references to the route builder function
- No href is ever computed for the allocation direction — the guard exists by construction, not by conditionally omitting a render

**File: `tests/category-ranking-list.test.tsx`**

Two changes:

1. **Repointed the existing href test** (lines 68-75):
   - Changed from `direction="allocation"` to `direction="in"`
   - Updated the expected href assertion to match `in`-direction query string (`type=in` parameter present)
   - Test continues to prove the year+type+lens href contract for a direction the detail page actually supports

2. **Added new CR-01 (NEW) guard test** (lines 77-117):
   - Renders three separate single-row lists: `direction="out"`, `direction="in"`, `direction="allocation"`
   - For `out` (lines 78-88): asserts `<a` is present and href is `/dashboard/categories/{id}?year=2026` (no type= parameter, since 'out' is the default)
   - For `in` (lines 90-100): asserts `<a` is present and href is `/dashboard/categories/{id}?year=2026&amp;type=in`
   - For `allocation` (lines 102-117): asserts NO `<a` element, but all five D-04 fields are still present (name, Totale, share, sparkline aria-label, projection when non-null), carries `aria-disabled="true"`, and contains no `type=allocation` substring anywhere

This matches exactly what 83-VERIFICATION.md's locked decision required: "an allocation row must emit no `<a>` element, while `out` and `in` rows keep their existing links."

### Verification of Guard-by-Construction

**Grep verification:**
```bash
$ grep -n "buildDashboardCategoryDetailHref" components/dashboard/category-ranking-list.tsx
109:    href={buildDashboardCategoryDetailHref(category.id, { year, type: direction, lens })}
```

Only one occurrence in the entire file (line 109), and it sits inside the non-allocation JSX branch only. The allocation branch (lines 99-106) contains no reference to this function.

**Test verification:**
The new CR-01 (NEW) guard test explicitly asserts:
- `expect(allocationHtml).not.toContain('<a')` — no anchor element
- `expect(allocationHtml).not.toContain('type=allocation')` — no ?type=allocation URL parameter anywhere in the output

Both assertions pass.

**Full suite verification:**
- `node_modules/.bin/vitest run tests/category-ranking-list.test.tsx` — 9/9 passing
- `node_modules/.bin/vitest run` (full suite) — 2198 passed + 1 todo across 180 files; zero failures
- No regressions to any other Categories test or protected regression gates

## Goal Achievement: Observable Truths Verification

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | For a selected year and direction, every category appears ranked by total, each row showing its % share of the total and a 12-month sparkline (CLIST-01) | ✓ VERIFIED | `getCategoryYearRanking` DAL query returns correctly-grouped category+month combinations; `CategoryRankingList` renders all five D-04 columns; real-Postgres tests in `tests/categories-ranking-dal.test.ts` prove the aggregation; component tests prove rendering; no regression since previous verification |
| 2 | Each row also shows the year-end projection, visually subordinate to and explicitly labelled apart from the total (CLIST-02); user can re-order by projection via existing sort control (CLIST-03) | ✓ VERIFIED | Projection rendered as "A questo passo" with visual weight hierarchy (500 vs 600 for total); entire pair absent when null per D-15; `compareByProjection` function sorts correctly with null fallback; both sort UI options available and functional; no regression since previous verification |
| 3 | The direction switch offers Uscite, Entrate and Accantonamenti — the last reachable here for the first time (CLIST-04) | ✓ VERIFIED | D-09 predicate flip correctly implemented in `getCategoryYearRanking`. Allocation direction is reachable and visible via `DirectionFilter` on the Categories list. Allocation rows render fully readable with all five D-04 fields (name, Totale, share, sparkline, projection). **Change since previous verification:** rows are now provably non-interactive instead of silently broken, which satisfies the requirement even more reliably. |
| 4 | Moving between Overview and Categories preserves the selected year via the shared `?year=` parameter (CLIST-05) | ✓ VERIFIED | `buildDashboardTabHref` propagates year between tabs; Categories list page calls `resolveYear(params.year, years)`; test in `tests/category-detail-link.test.ts` proves the round trip; no change since previous verification |
| 5 | Clicking a category opens its detail on the same year, so the row's total and the detail page's total agree (CLIST-07) | ✓ VERIFIED | **For `in` and `out` directions:** href built with matching year via `buildDashboardCategoryDetailHref`, detail page receives same year, totals agree. Proven by `"row href carries the SAME year..."` test (repointed to `direction="in"` in 83-06). **For `allocation` direction:** row is now non-interactive; no detail link is produced. This satisfies CLIST-07 by ensuring the row total and the (non-existent) detail page total never diverge. The broken path that previously violated this requirement is now closed by construction. |
| 6 | With a single Covered Month, the list shows the certain figures (total, share, one-point series) plus an explicit statement of what's missing and how to get it (CLIST-06) | ✓ VERIFIED | CategoryCoverageNudge rendered when `coveredMonthCount === 1`. No change since previous verification |

**Score:** 7/7 must-haves verified (all originally-stated requirements + CR-01 NEW closed)

## Code Quality Notes from Code Review (2026-08-03)

The code review (83-REVIEW.md, re-review post-83-06) found **no Critical issues**. Two non-blocking quality observations are worth recording:

### WR-01: `aria-disabled="true"` on a role-less `<span>` has limited value for assistive technology

**Severity:** Warning (quality, not functional)

**Issue:** The allocation row's name element is a bare `<span>` with implicit ARIA role `generic`. The `aria-disabled="true"` attribute is semantically defined for interactive widget roles (button, link, menuitem, etc.), where it meaningfully signals that the element *would otherwise* be operable. On a `generic` role, it communicates nothing to screen readers — NVDA/VoiceOver/JAWS commonly render it as plain text with no signal of prior interactivity or future availability.

Additionally, the previous `aria-label` (`"{name}: apri dettaglio categoria"`) that used to explain the row's clickability is now lost. A sighted keyboard user tabbing through the list has no way to learn *why* this row behaves differently from Uscite/Entrate rows — only that it silently doesn't respond.

**Assessment:** This is exactly the tension flagged in the review brief — `aria-disabled` is defined for elements that *can* be disabled, and a plain `<span>` without a role isn't one of them. The tradeoff is intentional: the allocation row is now provably non-interactive and fully readable (name, Totale, share, sparkline, projection all render), so the accessibility goal of "no surprising behavior" is met, albeit without optimal explanation.

**Recommendation (Phase 84 scope, not a blocker for Phase 83):** Either (a) give the span `role="link"` so `aria-disabled` sits on a role that supports it; or (b) add a visually-hidden explanation, e.g.:
```tsx
<span className="sr-only"> — dettaglio non disponibile per Accantonamenti</span>
```

### WR-02: The D-13/CLIST-07 rationale comment was deleted instead of relocated

**Severity:** Info (documentation)

**Issue:** The pre-fix code carried this comment directly above the unconditional `href` const:
```
// D-13/CLIST-07: the row's link carries the SAME year the row's own total was computed
// from — the coherence test "clicking a row must not change the numbers" holds by
// construction.
```

This documented *why* `year` (and not some other value) must be threaded into `buildDashboardCategoryDetailHref`'s call — a locked design decision (D-13) whose rationale is not otherwise obvious from the call site alone. The 83-06 diff replaced it entirely with a comment about the CR-01 (NEW) guard. The D-13 rationale is now undocumented in this file.

A future edit during Phase 84 (when the detail page is rewritten) might revisit this component and accidentally drop the `year` parameter, losing the CLIST-07 coherence guarantee, with no in-file explanation of why it must match.

**Assessment:** The CR-01 guard explanation is essential and correct. The D-13 rationale is valuable institutional knowledge that should have been preserved alongside it, not replaced.

**Recommendation (Phase 84 scope, not a blocker for Phase 83):** Restore the D-13/CLIST-07 comment above the `Link`'s inline `href=` expression in the non-allocation branch, in addition to the new CR-01 comment.

## LOCKED DECISION (User, 2026-08-03) — How CR-01 (NEW) Was Closed

**Decision:** Option 1 — guard the row Link for the allocation direction inside Phase 83.

**Rationale:** Allocating row can now render as a non-interactive element (a `<span>`, `aria-disabled`) instead of a `<Link>`, so no `?type=allocation` URL — one the category detail page cannot yet honour — is ever produced by this surface. Full allocation support on the detail page stays explicit Phase 84 scope, where that page is rewritten anyway.

**Rejected alternatives:**
- Widening `DashboardTypeSchema` / `categoryTypeOptions` / `getCategoryDetail` in Phase 83 — rejected as medium-risk churn on a schema shared with Overview, in a file Phase 84 replaces entirely.
- Deferring the whole thing to Phase 84 — rejected: it would mark Phase 83 complete with criterion 5 (CLIST-07) knowingly violated.

**Implementation:** Executed by 83-06 (commits `3edab68f`, `54832fa3`). Allocation rows now render a non-interactive, fully-readable `<span aria-disabled="true">` instead of a broken `<Link>`, closing the "row €500 -> detail €0 -> wrong back link" bug by construction. The allocation direction remains reachable and visible in the list (CLIST-04 satisfied), and the allocation row carries all five D-04 fields (CLIST-01/02 satisfied). CLIST-07 is satisfied for the two directions with working detail pages (in/out); the third direction's row is provably inert rather than silently broken.

## Requirements Traceability

| Requirement | Phase | Expected | Verified | Status |
|---|---|---|---|---|
| CLIST-01 | Phase 83 | Categories ranked by total, with share and sparkline | ✓ Implemented and tested | ✓ VERIFIED |
| CLIST-02 | Phase 83 | Projection inline, subordinate, labelled | ✓ Implemented and tested | ✓ VERIFIED |
| CLIST-03 | Phase 83 | Re-order by projection | ✓ Implemented and tested | ✓ VERIFIED |
| CLIST-04 | Phase 83 | Direction switch: Uscite / Entrate / Accantonamenti (new) | ✓ Allocation visible and reachable; rows fully readable with all five D-04 fields | ✓ VERIFIED |
| CLIST-05 | Phase 83 | Year shared with Overview via `?year=` | ✓ Implemented and tested | ✓ VERIFIED |
| CLIST-06 | Phase 83 | Single Covered Month: certain figures + nudge | ✓ Implemented and tested | ✓ VERIFIED |
| CLIST-07 | Phase 83 | Row click opens detail on same year; totals agree | ✓ Works for in/out; allocation rows now provably non-interactive, closing the broken-link class by construction | ✓ VERIFIED |

**Unmapped requirements:** None. All 7 CLIST requirements are mapped to Phase 83 and verified.

## Testing Summary

**Phase 83-06 (gap-closure plan) test results:**
- `tests/category-ranking-list.test.tsx`: 9/9 passing
  - Existing 8 tests: all pass (no regressions)
  - New CR-01 (NEW) guard test: passes, explicitly asserts absence of `<a` for allocation direction

**Full suite verification:**
- Test files: 180 passed
- Tests: 2198 passed | 1 todo
- Duration: 16.15s
- Exit code: 0 (success)
- Zero failures, zero regressions
- All protected regression gates pass: `tests/pace-engine-lens-regression.test.ts` (RETIRE-05), `tests/reimbursement-regression.test.ts` (v2.8/v2.9 baselines)

**Build verification:**
- `yarn build` — succeeded
- `yarn check:language` — passed, no new Italian in developer-facing code/comments/tests

## Conclusion

**Phase 83 goal is ACHIEVED.**

All 7 CLIST requirements are verified:
- ✓ Categories list rewritten on the yearly axis, ranked by spend
- ✓ Each row carries share, sparkline, and year-end projection
- ✓ Projection sorting works as specified
- ✓ Direction filter offers all three directions including allocation for the first time
- ✓ Year parameter shared with Overview
- ✓ Single-Covered-Month nudge implemented
- ✓ Row detail links work correctly for the two supported directions (in/out); allocation rows are provably inert rather than silently broken

The single blocker from the prior verification (**CR-01 NEW**: allocation rows linking to a broken detail page showing €0 instead of the row's total) is **closed by construction**. The allocation row is now non-interactive, all five D-04 fields remain fully readable and visible, and the broken URL class that violated CLIST-07 for that direction is eliminated.

Two non-blocking quality observations from code review (WR-01: aria-disabled on a role-less span; WR-02: D-13 rationale comment not relocated) are recorded for Phase 84 consideration but do not prevent Phase 83 from shipping.

---

_Verified: 2026-08-03T10:45:00Z_  
_Verifier: Claude (gsd-verifier)_  
_Verification Depth: goal-backward, code inspection, test execution, re-verification after gap closure_
