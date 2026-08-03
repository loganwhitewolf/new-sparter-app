---
phase: 83-categories-list
plan: 03
subsystem: ui
tags: [react, tailwind, sparkline, i18n-copy, dashboard]

# Dependency graph
requires:
  - phase: 83-categories-list (plan 01)
    provides: "CategoryYearSparklinePoint (state: covered/current/estimated/uncovered) and CategoryYearRankingItem — the shapes Plan 83-04 maps into CategorySparkline's points/pointStates props"
provides:
  - "CategorySparkline: additive 'allocation' colour, negative-domain support, opt-in pointStates 4-state bar rendering — byte-identical output preserved for every caller that omits the new props"
  - "CategoryYearRankingSkeleton — new 5-column skeleton reserving the Proiezione column unconditionally"
  - "CategoryCoverageNudge + shouldShowCoverageNudge — D-14's single-Covered-Month explanatory panel and its pure visibility rule"
  - "resolveCategoryDirectionCopy — D-11's single centrally-resolved per-direction Italian copy set"
affects: [83-04-categories-list-page]

# Actuals (#2632)
actuals:
  tokens: 6314
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive component props (pointStates/estimatedHeightHint) with a Path A/Path B render split, so an existing SVG-based component gains new behavior with zero risk to callers that don't opt in"
    - "Persistent (non-dismissible) informational nudge variant of the OverviewNudge localStorage read pattern — restores from storage but has no user-triggered write path"
    - "Exhaustive switch over a closed direction union for centrally-resolved copy (mirrors Phase 82's resolveComparisonJudgement one-site rule)"

key-files:
  created:
    - components/dashboard/category-year-ranking-skeleton.tsx
    - components/dashboard/category-coverage-nudge.tsx
    - lib/services/category-direction-copy.ts
    - tests/category-sparkline.test.tsx
    - tests/categories-nudge.test.tsx
    - tests/category-direction-copy.test.ts
  modified:
    - components/dashboard/category-sparkline.tsx

key-decisions:
  - "CategorySparkline's Path A (no pointStates, or a single point) is provably byte-identical to the pre-Phase-83 SVG render; Path B (12-point bar row) only activates when pointStates is explicitly provided and matches points 1:1 — no existing caller can regress."
  - "The negative-domain marker (borderTop on the bar's track container, always opacity 1) is independent of the bar's own state opacity (0.45 covered / 1 current), so a divestment month is visually distinct at any fill height."
  - "CategoryCoverageNudge renders as a persistent info panel, not a dismissible pill like OverviewNudge — no dismiss control, but the SSR-safe localStorage read path is kept for pattern parity and to leave a dismiss affordance addable later without touching this read path."
  - "resolveCategoryDirectionCopy has no default/fallback switch case — TypeScript enforces all 3 direction branches are filled, so a future 4th direction cannot ship with partial copy."

patterns-established:
  - "Additive/opt-in props on a shared presentational component (CategorySparkline) as the mechanism for landing new visual states in the same wave as unrelated DAL/URL-contract plans, with zero cross-plan coupling risk."

requirements-completed: [CLIST-04, CLIST-06]

coverage:
  - id: D1
    description: "CategorySparkline supports the 'allocation' direction, resolving its stroke/fill colour from var(--total-allocation) instead of falling through to the 'out' branch"
    requirement: CLIST-04
    verification:
      - kind: unit
        ref: "tests/category-sparkline.test.tsx#allocation type resolves the stroke colour from var(--total-allocation), not the out fallback"
        status: pass
    human_judgment: false
  - id: D2
    description: "parseAmount's Math.max(parsed, 0) clamp is removed — negative allocation amounts (net divestment months) are accepted, never silently flattened to zero"
    requirement: CLIST-04
    verification:
      - kind: unit
        ref: "tests/category-sparkline.test.tsx#a negative-amount covered/current bar is never flattened to zero and carries a border marker"
        status: pass
    human_judgment: false
  - id: D3
    description: "When pointStates is provided (12 points), CategorySparkline renders 12 individually-styled bars per UI-SPEC's covered/current/estimated/uncovered visual state table; when omitted, the existing single-polyline/single-circle SVG output is byte-identical"
    requirement: CLIST-04
    verification:
      - kind: unit
        ref: "tests/category-sparkline.test.tsx (Path A and Path B describe blocks — 10 tests total)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The single-point case (points.length === 1) always renders one centered circle regardless of pointStates presence — CLIST-06's one-Covered-Month series never falls through to the 12-bar layout"
    requirement: CLIST-06
    verification:
      - kind: unit
        ref: "tests/category-sparkline.test.tsx#single point renders the centered circle even when pointStates is provided (CLIST-06)"
        status: pass
    human_judgment: false
  - id: D5
    description: "CategoryYearRankingSkeleton reserves a 5th grid column matching the row's projection slot unconditionally, so the skeleton-to-real-row transition never shifts layout; the existing shared CategoryRankingSkeleton (used by tag-ranking-list.tsx) is left completely untouched"
    requirement: CLIST-06
    verification:
      - kind: manual_procedural
        ref: "components/dashboard/category-year-ranking-skeleton.tsx (5th grid-column placeholder rendered unconditionally, no prop gates it); git diff confirms category-ranking-skeleton.tsx has zero changes"
        status: pass
    human_judgment: true
    rationale: "Layout-stability (no visual shift on skeleton-to-real-row transition) is a UI-SPEC backstop the plan explicitly flags as needing human/visual confirmation, not something a unit test can assert without a rendered DOM/visual diff."
  - id: D6
    description: "CategoryCoverageNudge's visibility rule (shouldShowCoverageNudge) is a directly-testable pure function firing only at exactly 1 Covered Month, following OverviewNudge's dismissal pattern, never introducing a server action or DB write"
    requirement: CLIST-06
    verification:
      - kind: unit
        ref: "tests/categories-nudge.test.tsx (6 tests: first-time show, 0-count exclusion, 2+-count exclusion, dismissed-at-count exclusion, re-show on count mismatch, no-show above 1)"
        status: pass
    human_judgment: false
  - id: D7
    description: "resolveCategoryDirectionCopy is the single centrally-resolved source of every direction-scoped string used by the Categories list (page subheading, share label, empty-state heading/body, direction label) — every branch exercised, no retired vocabulary present"
    requirement: CLIST-04
    verification:
      - kind: unit
        ref: "tests/category-direction-copy.test.ts (5 tests: out/in/allocation exact strings, distinctness across directions, retired-vocabulary guard)"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-07-31
status: complete
---

# Phase 83 Plan 03: Sparkline, Skeleton, Nudge, Direction Copy Summary

**CategorySparkline gains an additive allocation colour, negative-domain support, and an opt-in
4-state bar rendering; three new self-contained artifacts (skeleton, coverage nudge, direction
copy resolver) land byte-safe alongside them, with zero regression to any existing caller.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-31T15:27:00Z (approx.)
- **Completed:** 2026-07-31T15:33:56Z
- **Tasks:** 2/2
- **Files modified:** 7 (1 modified, 6 created)

## Accomplishments

- `CategorySparkline` widened `type` to `'in' | 'out' | 'allocation'`, resolving
  `var(--total-allocation)` for the new direction; `parseAmount`'s `Math.max(parsed, 0)` clamp is
  gone, so allocation divestment months (negative amounts) render instead of being silently
  flattened to zero.
- New optional `pointStates`/`estimatedHeightHint` props opt a caller into 12 individually-styled
  bars (covered 45% opacity / current 100% opacity / estimated striped, normalized against the
  hint / uncovered 100%-height muted diagonal). Every existing caller that omits `pointStates`
  keeps the prior single-polyline/single-circle SVG output unchanged — proven by a dedicated Path
  A test suite.
- Negative covered/current bars carry a full-opacity `border-top` marker on the bar's track
  container, independent of the bar's own state opacity, so a divestment month never reads
  identically to a same-height positive month.
- `CategoryYearRankingSkeleton` — a new sibling to (not a modification of) the shared
  `category-ranking-skeleton.tsx` — reserves the 5th (Proiezione) grid column unconditionally,
  matching the locked 5-column desktop row shape.
- `CategoryCoverageNudge` + `shouldShowCoverageNudge` — D-14's exactly-1-Covered-Month panel,
  rendered as a persistent info panel (no dismiss control) with a directly-testable pure
  visibility rule.
- `resolveCategoryDirectionCopy` — the single, centrally-resolved source of every
  direction-scoped Italian string the list needs (page subheading, share label, empty-state
  heading/body, direction label), mirroring Phase 82's `resolveComparisonJudgement` pattern.

## Task Commits

Each task was committed atomically:

1. **Task 1: Sparkline — allocation colour, negative domain, 4-state bar rendering
   (additive, backward-compatible)** — `ff31a106` (feat)
2. **Task 2: Categories-list skeleton, single-Covered-Month nudge, and centrally-resolved
   direction copy (new files)** — `49eadb8e` (feat)

**Plan metadata:** committed separately, see State Updates below.

## Files Created/Modified

- `components/dashboard/category-sparkline.tsx` — modified: widened `type` union, removed
  negative-amount clamp, added `pointStates`/`estimatedHeightHint` props with the Path A/Path B
  render split.
- `components/dashboard/category-year-ranking-skeleton.tsx` — new.
- `components/dashboard/category-coverage-nudge.tsx` — new.
- `lib/services/category-direction-copy.ts` — new.
- `tests/category-sparkline.test.tsx` — new (10 tests).
- `tests/categories-nudge.test.tsx` — new (6 tests).
- `tests/category-direction-copy.test.ts` — new (5 tests).

## Decisions Made

- Followed the plan's `<action>` blocks exactly: no architectural deviation from the locked
  design in either task.
- Chose to keep `CategoryCoverageNudge`'s SSR-safe `localStorage` read path (mirroring
  `OverviewNudge`'s `buildStorageKey`/`readStored` pattern) even though this nudge has no dismiss
  control and therefore never writes to storage itself — this keeps the pattern parity the plan's
  `must_haves.truths` calls for while satisfying the plan's explicit "no dismiss button" guidance,
  and leaves a clean seam for a future dismiss affordance without touching the read path.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' `<behavior>` cases were verified by their
respective test suites on first run; no auto-fixes, no blocking issues, no architectural
questions arose.

## Known Stubs

None. All artifacts are fully wired to their specified behavior; nothing renders hardcoded
empty/placeholder data. `CategoryCoverageNudge`'s dormant localStorage-write path (no dismiss UI)
is a deliberate, documented design choice (see Decisions Made), not a stub — the component is
fully functional as a persistent info panel per its `<action>` spec.

## Threat Flags

None. `T-83-05` (localStorage tampering, `CategoryCoverageNudge`) was already declared and
accepted in the plan's own threat model; no new security-relevant surface was introduced beyond
it.

## Verification

- `node_modules/.bin/vitest run tests/category-sparkline.test.tsx tests/categories-nudge.test.tsx tests/category-direction-copy.test.ts` — 21/21 tests pass.
- `yarn build` — succeeds, no type errors (existing `category-ranking-list.tsx` call site still
  passes only `'in' | 'out'`, a valid subset of the widened union).
- `yarn check:language` — clean.
- `grep -c "Math.max(parsed, 0)" components/dashboard/category-sparkline.tsx` → 0 matches.
- `grep -c "var(--total-allocation)" components/dashboard/category-sparkline.tsx` → 1 match.
- `grep -c "export function resolveCategoryDirectionCopy" lib/services/category-direction-copy.ts` → 1 match.
- `grep -c "export function shouldShowCoverageNudge" components/dashboard/category-coverage-nudge.tsx` → 1 match.
- `grep -c "Deviazione\|Baseline\|Preset" lib/services/category-direction-copy.ts` → 0 matches.
- `git diff --stat components/dashboard/category-ranking-skeleton.tsx` → empty (untouched, confirming the plan's prohibition).

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 83-04 (Categories list page) can now import `CategorySparkline` with
  `points`/`pointStates`/`estimatedHeightHint` mapped 1:1 from Plan 83-01's
  `CategoryYearRankingItem.sparkline` (`CategoryYearSparklinePoint[]`, whose `state` field is
  exactly the `pointStates` union this plan implements).
- `resolveCategoryDirectionCopy('allocation' | 'in' | 'out')` is ready for the page's subheading,
  row share label, and empty-state copy.
- `CategoryCoverageNudge`'s `shouldShowCoverageNudge` pure helper is ready to be wired against
  `getCoveredMonthsInYear(year).length === 1` in Plan 83-04.
- No blockers for the next plan in this phase.

---
*Phase: 83-categories-list*
*Completed: 2026-07-31*

## Self-Check: PASSED

- FOUND: components/dashboard/category-sparkline.tsx
- FOUND: components/dashboard/category-year-ranking-skeleton.tsx
- FOUND: components/dashboard/category-coverage-nudge.tsx
- FOUND: lib/services/category-direction-copy.ts
- FOUND: tests/category-sparkline.test.tsx
- FOUND: tests/categories-nudge.test.tsx
- FOUND: tests/category-direction-copy.test.ts
- FOUND: commit ff31a106
- FOUND: commit 49eadb8e
