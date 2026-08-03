---
phase: 83-categories-list
plan: 06
subsystem: ui
tags: [react, category-ranking-list, dashboard, gap-closure]

requires:
  - phase: 83-categories-list (83-01..83-05)
    provides: "Categories list rewritten on the year axis, direction filter widened to allocation, DAL sign preservation, sparkline fallback, preset-mode route builders"
provides:
  - "CategoryRankingList renders a non-interactive aria-disabled span for allocation-direction rows instead of a Link — no ?type=allocation URL is ever constructed"
  - "out/in rows keep their existing Link to buildDashboardCategoryDetailHref, byte-identical to pre-fix behavior"
affects: [phase-84-category-detail-and-cleanup]

actuals:
  tokens: 1310
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Guard-by-construction: the unconditional href const was deleted entirely; the allocation branch has zero reference to the route builder, so the broken URL class is closed structurally, not by a render-time omission of an already-built value."

key-files:
  created: []
  modified:
    - components/dashboard/category-ranking-list.tsx
    - tests/category-ranking-list.test.tsx

key-decisions:
  - "Implemented exactly the user-locked fix from 83-VERIFICATION.md (2026-08-03): guard the row Link for allocation, do not widen the detail page's schema (Phase 84 scope, rejected as medium-risk churn on a schema shared with Overview)."

patterns-established:
  - "Direction-conditional interactive element: branch on `direction` before computing any href, so an unsupported destination can never be constructed even transiently."

requirements-completed: [CLIST-04, CLIST-07]

coverage:
  - id: D1
    description: "An allocation-direction Categories row renders a non-interactive <span aria-disabled=\"true\"> instead of a <Link>; no href is computed for that branch"
    requirement: "CLIST-07"
    verification:
      - kind: unit
        ref: "tests/category-ranking-list.test.tsx#an allocation-direction row renders no anchor element while out/in rows keep their existing link (CR-01 NEW guard)"
        status: pass
    human_judgment: false
  - id: D2
    description: "out and in direction rows keep their existing <Link> to buildDashboardCategoryDetailHref, byte-identical to pre-fix behavior (type omitted for out, present for in)"
    requirement: "CLIST-07"
    verification:
      - kind: unit
        ref: "tests/category-ranking-list.test.tsx#row href carries the SAME year via buildDashboardCategoryDetailHref(id, { year, type, lens })"
        status: pass
      - kind: unit
        ref: "tests/category-ranking-list.test.tsx#an allocation-direction row renders no anchor element while out/in rows keep their existing link (CR-01 NEW guard)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Categories direction filter still reaches Uscite/Entrate/Accantonamenti (CLIST-04); allocation is reachable in the list but its row is now provably inert rather than silently broken"
    requirement: "CLIST-04"
    verification:
      - kind: unit
        ref: "tests/category-ranking-list.test.tsx#resolves the percentage bar colour per direction (allocation uses --total-allocation)"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-08-03
status: complete
---

# Phase 83 Plan 06: Guard allocation-direction rows against broken detail link (CR-01 NEW) Summary

**`CategoryRankingList`'s allocation-direction rows now render `<span aria-disabled="true">` instead of `<Link>`, with no href ever computed for that branch — closing CR-01 (NEW) from 83-VERIFICATION.md by construction.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-03T07:31:00Z
- **Completed:** 2026-08-03T07:43:00Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- `components/dashboard/category-ranking-list.tsx`'s Column 2 name element now branches on `direction`: `allocation` renders a non-interactive `<span aria-disabled="true">`, `out`/`in` keep the original `<Link>` unchanged in every other respect. The previously-unconditional `href` const was deleted; the href is now computed inline only inside the non-allocation branch — the allocation branch contains zero reference to `buildDashboardCategoryDetailHref`.
- Repointed the existing "row href carries the SAME year..." test off `direction="allocation"` onto `direction="in"`, so it continues to prove the year+type+lens href contract for a direction the detail page actually supports.
- Added a new test ("CR-01 NEW guard") asserting, in one place, across all three directions: `out` and `in` still render exactly one `<a href=...>` with the correct query string (no `type=` for `out`, `type=in` for `in`); `allocation` renders zero `<a` occurrences, keeps all five D-04 fields (name, Totale, share, sparkline `aria-label`), carries `aria-disabled="true"`, and contains no `type=allocation` substring anywhere in the rendered output.

## Task Commits

Each task was committed atomically:

1. **Task 1: Guard allocation-direction rows against a broken detail-page link (CR-01 NEW)** - `3edab68f` (fix)

**Plan metadata:** (this commit)

## Files Created/Modified
- `components/dashboard/category-ranking-list.tsx` - Column 2 name element conditional on `direction`; unconditional `href` const removed; href now computed inline inside the `out`/`in` `<Link>` branch only
- `tests/category-ranking-list.test.tsx` - repointed the href-contract test to `direction="in"`; added the CR-01 (NEW) guard test covering all three directions

## Decisions Made
None beyond the user-locked decision already recorded in `83-VERIFICATION.md` — implemented exactly as specified (guard the row Link for allocation; do not widen the detail page's schema; do not defer to Phase 84).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

CR-01 (NEW) is closed: the Categories list can no longer produce a `?type=allocation` URL, so CLIST-07 now holds for the two directions the detail page supports (`out`/`in`) and the third (`allocation`) is provably inert rather than silently broken. Full allocation support on the category detail page remains explicit Phase 84 scope — that page's `DashboardTypeSchema`/`getCategoryDetail` were intentionally untouched here, per the locked decision. No blockers for Phase 84.

**Full-suite verification (this plan):**
- `node_modules/.bin/vitest run tests/category-ranking-list.test.tsx` — 9/9 passing (including the repointed href test and the new CR-01 NEW guard test).
- `node_modules/.bin/vitest run` (full suite) — 180 files / 2198 passed + 1 todo (one more than the 2197 baseline, from the new test added here; no regressions).
- `yarn build` — succeeded.
- `yarn check:language` — passed, no new Italian in developer-facing code/comments/tests.

Phase 83 is now complete: all 7 CLIST requirements verified, the single remaining gap (CR-01 NEW) closed.

---
*Phase: 83-categories-list*
*Completed: 2026-08-03*

## Self-Check: PASSED
- FOUND: .planning/phases/83-categories-list/83-06-SUMMARY.md
- FOUND: 3edab68f
