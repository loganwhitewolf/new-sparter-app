---
phase: 260730-g3b
plan: 01
subsystem: ui
tags: [dashboard, dropdown-menu, radix, recharts, decimal.js]

requires:
  - phase: 80-dashboard-accrual-lens
    provides: "?lens= URL param, lens-persistence.ts sessionStorage restore, resolveLedgerRowSource() seam"
provides:
  - "hasAmortizationPlans(userId) IDOR-safe existence probe gating the lens control"
  - "Title-integrated LensSwitch (DropdownMenu-based, two menuitemradio items with description copy)"
  - "Dashed cash-lens Uscite overlay on the overview monthly chart, competenza-only"
affects: [dashboard-overview, dashboard-categories, dashboard-tags]

tech-stack:
  added: []
  patterns:
    - "DropdownMenuRadioGroup/DropdownMenuRadioItem as a title-embedded control (native menuitemradio role, no custom aria-pressed)"
    - "Conditional Promise.all ternary entry for a lens-gated second DAL query (zero extra queries on the default branch)"

key-files:
  created:
    - tests/overview-chart-utils.test.ts
  modified:
    - lib/dal/amortization.ts
    - components/dashboard/lens-switch.tsx
    - components/dashboard/overview/overview-header.tsx
    - app/(app)/dashboard/overview/page.tsx
    - app/(app)/dashboard/categories/page.tsx
    - app/(app)/dashboard/categories/[id]/page.tsx
    - app/(app)/dashboard/tags/page.tsx
    - components/dashboard/overview/overview-chart-utils.ts
    - components/dashboard/overview/overview-chart.tsx
    - components/dashboard/overview/overview-movers-section.tsx
    - components/dashboard/overview/overview-dashboard-section.tsx
    - tests/amortization-registry-dal.test.ts

key-decisions:
  - "LensSwitch's dotted-underline trigger renders its own leading '· ' separator inline so nesting it directly after the heading text produces the exact 'Title · per lens ▾' shape from LSD-01, without a second conditional separator at each of the three call sites."
  - "OverviewChart merges the cash-overlay values into the SAME per-point row object the accrual bars use (adds a usciteCassa key) rather than a parallel array, keeping Recharts' single data prop the source of truth for both the bars and the new Line."

patterns-established:
  - "Lens-gated second DAL fetch as a ternary entry inside an existing Promise.all array (not a separate if-branch) — LSD-03's 'cassa pays nothing extra' contract."

requirements-completed: [LENS-DROPDOWN-REDESIGN]

coverage:
  - id: D1
    description: "hasAmortizationPlans(userId) IDOR-safe existence probe (zero/open/closed/cross-user)"
    requirement: "LENS-DROPDOWN-REDESIGN"
    verification:
      - kind: unit
        ref: "tests/amortization-registry-dal.test.ts#hasAmortizationPlans — existence probe for the lens-selector redesign (LSD-04)"
        status: pass
    human_judgment: false
  - id: D2
    description: "LensSwitch rewritten as DropdownMenu title trigger with two menuitemradio items (LSD-01/LSD-02), disabled/note props removed (LSD-05)"
    requirement: "LENS-DROPDOWN-REDESIGN"
    verification: []
    human_judgment: true
    rationale: "Visual shape (trigger typography, dotted underline, menu item copy rendering) requires a human to view the rendered UI — no DOM/render harness exists in this repo for Radix dropdown content."
  - id: D3
    description: "Lens control gated on hasAmortizationPlans at overview/categories/categories-detail; no control on /dashboard/tags"
    requirement: "LENS-DROPDOWN-REDESIGN"
    verification:
      - kind: unit
        ref: "node_modules/.bin/tsc --noEmit (full project, all four page files type-check with the new prop)"
        status: pass
      - kind: integration
        ref: "yarn build (production build compiles all four gated mount points together)"
        status: pass
    human_judgment: true
    rationale: "Whether the control actually disappears/appears correctly for a real plan-having vs plan-less user is a live-browser check; no seeded-browser E2E harness covers this page in this repo (proxy.ts staging-bypass bug blocks dashboard Playwright specs, per STATE.md deferred-items)."
  - id: D4
    description: "deriveCashOverlayValues sums only included out keys, Decimal-precise, index-aligned, never NaN"
    requirement: "LENS-DROPDOWN-REDESIGN"
    verification:
      - kind: unit
        ref: "tests/overview-chart-utils.test.ts#deriveCashOverlayValues (4 tests, all behavior bullets)"
        status: pass
    human_judgment: false
  - id: D5
    description: "OverviewChart renders dashed Uscite overlay + legend only when cashOverlayData is supplied; competenza-only fetch, cassa triggers zero extra queries"
    requirement: "LENS-DROPDOWN-REDESIGN"
    verification:
      - kind: unit
        ref: "node_modules/.bin/tsc --noEmit (ComposedChart/Line composition + cashOverlayData threading type-check)"
        status: pass
      - kind: integration
        ref: "yarn build (production build)"
        status: pass
    human_judgment: true
    rationale: "Visual confirmation that the dashed line/legend renders correctly on top of the bars, and disappears cleanly under cassa, requires viewing the live chart — no chart-rendering test harness in this repo."

duration: 55min
completed: 2026-07-30
status: complete
---

# Phase 260730-g3b: Lens Selector Redesign (Title-Integrated) Summary

**Replaced Phase 80's bordered pill LensSwitch with a title-integrated DropdownMenu trigger, gated on amortization-plan existence, plus a competenza-only dashed cash overlay on the overview monthly chart.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 2 (Task 1 tracer, Task 2 TDD)
- **Files modified:** 12 (1 new test file, 11 modified)

## Accomplishments

- `hasAmortizationPlans(userId)` — new IDOR-safe `SELECT EXISTS` probe in `lib/dal/amortization.ts`, gating the lens control's visibility (LSD-04). Covers zero/open/closed/cross-user cases.
- `LensSwitch` rewritten from a bordered pill segmented control into a `DropdownMenu`-based title trigger: heading typography, dotted-underline affordance, small chevron, rendered inline right after the page title. `disabled`/`note` props dropped entirely (LSD-05). Two `DropdownMenuRadioItem`s render the exact LSD-02 label + muted description copy, using Radix's native `menuitemradio` role.
- All three gated surfaces (`/dashboard/overview`, `/dashboard/categories`, `/dashboard/categories/[id]`) now nest `LensSwitch` inside their `<h1>`, rendered only `{hasAmortizationPlans && <LensSwitch .../>}`.
- `/dashboard/tags` no longer imports or renders `LensSwitch` at all, and its dead `parseLensParam`/`lens` wiring is removed (LSD-05) — the page reads no `?lens=` param whatsoever now.
- `deriveCashOverlayValues(cashData, includedOut)` — new pure helper in `overview-chart-utils.ts`, built TDD (RED commit `fe52a69a` → GREEN commit `83fa130b`), sums only the `out` keys present in `includedOut` via the existing `sumSelected` helper.
- `OverviewChart` swapped `BarChart` → `ComposedChart`, added a conditional dashed `Line` (`usciteCassa`) painted on top of the three bars plus a small dedicated legend fragment ("Uscite (cassa)"), both rendered only when `cashOverlayData` is supplied.
- `cashOverlayData` threaded through `OverviewMoversSection` → `OverviewDashboardSection` → the overview page, which fetches the cash-lens chart via a ternary entry inside the existing `Promise.all` array — `lens === 'competenza'` triggers the second `getOverviewChart(year, resolveLedgerRowSource('cassa'))` call, `cassa` resolves to `Promise.resolve(undefined)` with zero extra queries.

## Task Commits

1. **Task 1: Title-integrated lens dropdown, gated on plan existence, removed on /dashboard/tags** — `8d2c06dc` (feat)
2. **Task 2: Dashed cash-lens overlay on the overview monthly chart, competenza-only**
   - RED: `fe52a69a` (test) — 4 failing tests for `deriveCashOverlayValues` (function did not exist)
   - GREEN: `83fa130b` (feat) — implementation + full chart/page wiring, all 4 tests pass

**Plan metadata:** committed separately by the orchestrator (per execution constraints, this executor does not commit docs artifacts).

## Files Created/Modified

- `lib/dal/amortization.ts` — added `hasAmortizationPlans(userId): Promise<boolean>`
- `components/dashboard/lens-switch.tsx` — rewritten as `DropdownMenu`-based title trigger; `LensSwitchProps` is now just `{ lens: Lens }`
- `components/dashboard/overview/overview-header.tsx` — `hasAmortizationPlans` prop, `LensSwitch` moved inside `<h1>`
- `app/(app)/dashboard/overview/page.tsx` — `hasAmortizationPlans(userId)` fetch, `cashOverlayData` conditional fetch + threading
- `app/(app)/dashboard/categories/page.tsx` — `hasAmortizationPlans` fetch, `LensSwitch` moved inside `<h1>Categorie</h1>`
- `app/(app)/dashboard/categories/[id]/page.tsx` — same pattern, `<h1>Dettaglio categoria</h1>`
- `app/(app)/dashboard/tags/page.tsx` — `LensSwitch`/`parseLensParam`/`lens` wiring removed entirely
- `components/dashboard/overview/overview-chart-utils.ts` — added `deriveCashOverlayValues`
- `components/dashboard/overview/overview-chart.tsx` — `ComposedChart` + conditional `Line` + legend fragment
- `components/dashboard/overview/overview-movers-section.tsx` — `cashOverlayData` prop threading
- `components/dashboard/overview/overview-dashboard-section.tsx` — `cashOverlayData` prop threading
- `tests/amortization-registry-dal.test.ts` — new `hasAmortizationPlans` describe block (4 tests)
- `tests/overview-chart-utils.test.ts` — new file, `deriveCashOverlayValues` coverage (4 tests)

## Decisions Made

- LensSwitch's trigger button renders its own leading "· " separator internally, so nesting `{hasAmortizationPlans && <LensSwitch lens={lens} />}` directly after each heading's text produces the LSD-01 "Title · per lens ▾" shape at all three call sites without a separate conditional separator span per page.
- The cash-overlay merge point is per-row (`{ ...row, usciteCassa: value }`) rather than a parallel array passed to `ComposedChart` — Recharts' single `data` prop stays the one source of truth for both the bars and the new `Line`.

## Deviations from Plan

None — plan executed exactly as written. Both tasks (tracer + TDD) followed their `<action>` blocks precisely; no Rule 1-4 auto-fixes were needed.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- LSD-01 through LSD-05 are implemented and pass automated verification (targeted vitest suites, `tsc --noEmit`, `yarn check:language`, `yarn build`, full test suite: 168 files / 2089 tests / 1 todo, all passing).
- Manual browser smoke (viewing the rendered dropdown, confirming the overlay line's visual appearance/disappearance, and confirming the control's visibility toggles for plan-having vs plan-less users) was **not performed** in this execution — no browser tooling is available in this environment, and the repo's dashboard Playwright specs are pre-existing-blocked by the unrelated `proxy.ts` staging-bypass redirect-loop bug (documented in `.planning/phases/80-dashboard-accrual-lens/deferred-items.md`). This is flagged in the `coverage:` block above (D2/D3/D5 all carry `human_judgment: true`) for a human to verify via `yarn dev` before considering this task fully closed.
- `?lens=`, `lens-persistence.ts`, and `resolveLedgerRowSource()` are untouched — confirmed via `git diff` showing zero changes to those files.

## Self-Check: PASSED

All 14 files created/modified verified present on disk; all 3 task commit hashes (`8d2c06dc`, `fe52a69a`, `83fa130b`) verified in `git log`.

---
*Phase: 260730-g3b*
*Completed: 2026-07-30*
