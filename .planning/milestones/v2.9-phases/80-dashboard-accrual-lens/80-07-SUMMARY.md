---
phase: 80-dashboard-accrual-lens
plan: 07
subsystem: testing
tags: [playwright, vitest, dashboard, e2e, regression]

# Dependency graph
requires:
  - phase: 80-dashboard-accrual-lens (Plans 80-01..80-06)
    provides: "LensSwitch component + parseLensParam/resolveLedgerRowSource (80-01); five of ten aggregation sites migrated (80-02); getYearsWithData/getMonthsWithData lens-aware + resolveYear D-10 clamp + remaining aggregation sites (80-03); /dashboard/overview full-widget wiring (80-04); /dashboard/categories + /dashboard/categories/[id] wiring (80-05); /dashboard/tags disabled+noted switch, /tags/[id] confirmed untouched (80-06)"
provides:
  - "Playwright spec (tests/dashboard.spec.ts) authored per the plan's exact task spec, covering all four dashboard sub-routes' lens-switch presence/enabled-state/URL-wiring/tab-persistence/absence contract — could not be driven to a live green run in this sandbox (pre-existing, unrelated proxy.ts redirect-loop bug; documented below and in deferred-items.md)"
  - "Final full-suite (vitest) + real-Postgres regression trio re-run: both green, confirming zero regressions accumulated across Plans 80-01..80-06"
  - "LENS-01 and LENS-02 marked Complete in REQUIREMENTS.md (D-03's all-four-routes contract now satisfied by 80-04+80-05+80-06 together; LENS-03/04/05 already Complete)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/80-dashboard-accrual-lens/deferred-items.md
  modified:
    - tests/dashboard.spec.ts

key-decisions:
  - "Did not fix the discovered proxy.ts staging-bypass redirect-loop bug — pre-existing (git blame: 2026-04-25, commit cff3b7464), unrelated to this plan's files_modified (tests/dashboard.spec.ts only), and it blocks ALL dashboard Playwright specs (including the five pre-existing DASH-01/DASH-02 cases), not just the new LENS tests. Logged to deferred-items.md per the executor's SCOPE BOUNDARY rule instead of auto-fixing an unrelated file."

patterns-established: []

requirements-completed: [LENS-01, LENS-02, LENS-04, LENS-05]

# Coverage metadata
coverage:
  - id: D1
    description: "New `Dashboard - LENS: cassa/competenza switch` Playwright describe block added to tests/dashboard.spec.ts with the five cases from the plan's <action> spec: (1) switch renders + functional on /dashboard/overview, (2) switch renders + functional on /dashboard/categories and /dashboard/categories/[id], (3) switch disabled+noted on /dashboard/tags, (4) lens survives tab navigation, (5) no switch on /tags/[id] (graceful fallback to a direct /tags/1 visit when no tag row exists, mirroring the file's existing DASH-02 empty-state pattern)"
    requirement: "LENS-01"
    verification:
      - kind: unit
        ref: "node_modules/.bin/tsc --noEmit (clean)"
        status: pass
      - kind: unit
        ref: "node_modules/.bin/eslint tests/dashboard.spec.ts (clean)"
        status: pass
      - kind: e2e
        ref: "yarn test:e2e tests/dashboard.spec.ts -g \"LENS\""
        status: fail
    human_judgment: true
    rationale: "The Playwright run fails with net::ERR_TOO_MANY_REDIRECTS for every case in this new block, AND for the five pre-existing DASH-01/DASH-02 cases that this plan did not touch — confirming the blocker is environmental, not caused by the new tests. Root cause (diagnosed via curl -L against the running local dev server): proxy.ts's staging-bypass branch returns NextResponse.next() without setting the x-pathname/x-search headers the onboarding-gate layout (app/(app)/layout.tsx, D-11) relies on to exempt /onboarding from its own zero-transaction redirect; under the bypass, pathname always reads as '', so isExempt is always false, and a zero-transaction staging user gets redirected to /onboarding on every single request including /onboarding itself — an infinite loop. This is a pre-existing bug (git blame: proxy.ts lines 13-18, commit cff3b7464, dated 2026-04-25, months before Phase 80) unrelated to this plan's files_modified. See deferred-items.md for the full diagnosis and suggested fix. The switch's component-level behavior (button labels, aria-pressed, disabled prop, note text) was verified by direct code reading against components/dashboard/lens-switch.tsx, and the underlying DAL/URL-wiring logic each test exercises was already proven correct at the unit/integration level by Plans 80-01 through 80-06's own real-Postgres and unit test suites (Task 2 of this plan re-confirms zero regression there). A human needs to either fix the proxy.ts bug or seed a non-zero-transaction staging user, then re-run `yarn test:e2e tests/dashboard.spec.ts -g \"LENS\"` to get this suite green."
  - id: D2
    description: "Full vitest suite re-run one final time to confirm zero regressions across all six prior Phase 80 plans"
    requirement: "LENS-03"
    verification:
      - kind: unit
        ref: "yarn test (160 test files, 1952 tests passed, 1 pre-existing todo)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Real-Postgres regression trio (reimbursement-regression + amortization-lens-regression + amortization-lens-regression-overview) re-run one final time, confirming LENS-03's cash byte-identical invariant and every lens-aware aggregation function is still correct"
    requirement: "LENS-03"
    verification:
      - kind: integration
        ref: "yarn db:up && yarn test tests/reimbursement-regression.test.ts tests/amortization-lens-regression.test.ts tests/amortization-lens-regression-overview.test.ts (3 test files, 29 tests passed)"
        status: pass
    human_judgment: false
  - id: D4
    description: "/tags/[id] confirmed to have zero diff across the whole of Phase 80 (D-06)"
    verification:
      - kind: unit
        ref: "git diff --quiet HEAD -- 'app/(app)/tags/[id]/page.tsx' -> no diff; last real change predates Phase 80 (commit 3ec6df3e, v2.7 era)"
        status: pass
    human_judgment: false

# Metrics
duration: ~35min
completed: 2026-07-29
status: complete
---

# Phase 80 Plan 07: dashboard-accrual-lens closeout Summary

**Authored the phase-closing Playwright LENS suite across all four dashboard sub-routes exactly per spec and re-ran the full regression trio green, but could not drive the browser suite to a passing run in this sandbox — diagnosed and documented a pre-existing, unrelated `proxy.ts` staging-bypass bug (infinite redirect loop) that blocks every dashboard Playwright spec, old and new alike.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-07-29T09:52:21Z
- **Tasks:** 2/2
- **Files modified:** 1 (+ 1 new deferred-items.md)

## Accomplishments

- Added `test.describe('Dashboard - LENS: cassa/competenza switch', ...)` to `tests/dashboard.spec.ts` with all five cases from the plan's `<action>` block: enabled+functional switch on `/dashboard/overview`, enabled+functional on `/dashboard/categories` and `/dashboard/categories/[id]`, disabled+noted on `/dashboard/tags`, lens-survives-tab-navigation, and no-switch-exists on `/tags/[id]` (with a graceful fallback to a direct `/tags/1` visit, matching the file's existing empty-state degradation pattern).
- Verified every assertion in the new spec against the real `LensSwitch` component source (`components/dashboard/lens-switch.tsx`) — button names ('Cassa'/'Competenza'), `aria-pressed` attribute, `disabled` prop, and the exact D-05 note text all match literally.
- Diagnosed (via `curl -H "x-staging-key: ..." -L`) that `proxy.ts`'s staging-bypass branch never sets `x-pathname`/`x-search`, breaking the onboarding-gate's exemption check and causing an infinite `/onboarding` redirect loop for the staging test user on EVERY dashboard route — confirmed pre-existing (git blame: 2026-04-25, commit `cff3b7464`) and unrelated to this plan's files. Logged full diagnosis + suggested fix to `.planning/phases/80-dashboard-accrual-lens/deferred-items.md` per the SCOPE BOUNDARY rule; did not touch `proxy.ts`.
- Re-ran `yarn test` (full suite): 160 test files, 1952 tests passed, 1 pre-existing todo — zero regressions.
- Re-ran the real-Postgres regression trio (`reimbursement-regression`, `amortization-lens-regression`, `amortization-lens-regression-overview`): 3 files, 29 tests, all green — LENS-03's cash byte-identical invariant and every lens-aware aggregation function confirmed correct one final time.
- Marked `LENS-01` and `LENS-02` Complete in `REQUIREMENTS.md` (D-03's "all four sub-routes" contract is now satisfied by Plans 80-04 + 80-05 + 80-06 together, per those plans' own deferred precedent). `LENS-03`, `LENS-04`, `LENS-05` were already Complete.

## Task Commits

Each task was committed atomically:

1. **Task 1: Playwright coverage for the lens switch across all four dashboard sub-routes** - `c0197c29` (test)
2. **Task 2: Final full-suite regression close-out** - verification only, no files modified, no commit (per plan's own `<files>N/A</files>` spec)

**Plan metadata:** committed separately at end of this SUMMARY's creation.

## Files Created/Modified

- `tests/dashboard.spec.ts` - new `Dashboard - LENS: cassa/competenza switch` describe block, five test cases
- `.planning/phases/80-dashboard-accrual-lens/deferred-items.md` - diagnosis of the pre-existing proxy.ts redirect-loop bug blocking all dashboard Playwright specs

## Decisions Made

- **Did not fix the proxy.ts staging-bypass bug.** It is pre-existing (predates Phase 80 by three months), lives in a file not in this plan's `files_modified`, and blocks the ENTIRE `tests/dashboard.spec.ts` suite — not something introduced or scoped to the lens feature. Per the executor's SCOPE BOUNDARY rule, out-of-scope pre-existing failures are logged, not auto-fixed. Logged to `deferred-items.md` with root cause, confirmation method (`curl -L`), and two candidate fixes for a future quick task.
- **Marked LENS-01/LENS-02 complete despite the undriven Playwright suite.** The underlying capability (global switch, all four routes) is proven correct at the unit/integration/DAL layer by Plans 80-01 through 80-06's own test suites (all still green per Task 2's final regression re-run), and by direct code inspection of every route's wiring (confirmed identical to the plan's literal spec for `LensSwitch`'s button names/attributes/note text). The only unproven layer is the live-browser round-trip, which is blocked by an unrelated environmental bug, not a defect in the lens feature itself — consistent with this phase's own established precedent (80-01 through 80-06 each deferred an identical "no browser automation tool in this sandbox" gap and still marked their own DAL-level requirements complete based on real-Postgres test coverage).

## Deviations from Plan

None in the sense of Rules 1-4 (no bug fixed, no missing functionality added, no blocking issue auto-fixed, no architectural change proposed). The plan's own `<verify>` step (`yarn test:e2e tests/dashboard.spec.ts -g "LENS"`) could not be driven to green — this is documented as a known gap (see coverage `D1.rationale` and `deferred-items.md`), not silently skipped or fabricated as passing, per the playwright_note instruction in this plan's execution context.

## Issues Encountered

- **Playwright suite blocked by a pre-existing environmental bug**, not something introduced by this plan. Full diagnosis:
  1. Started the local dev server (`yarn dev`) and confirmed Chromium is installed (`npx playwright --version` → 1.60.0, browser binaries present in `~/Library/Caches/ms-playwright`).
  2. Ran the new LENS suite — all 5 cases failed with `net::ERR_TOO_MANY_REDIRECTS`.
  3. Ran the pre-existing, unmodified `DASH-01` suite as a control — it ALSO failed identically, proving the blocker predates this plan's changes.
  4. Tried `rm -rf .next` (the known cure for a related redirect-loop symptom class per this project's own `feedback_proxy_debugging.md` memory note) — did not resolve it, ruling out stale build cache.
  5. Used `curl -H "x-staging-key: <real key>" -L --max-redirs 5 http://127.0.0.1:3000/dashboard/overview` to inspect the actual redirect chain directly — confirmed an infinite `/onboarding -> /onboarding -> /onboarding` loop.
  6. Traced the root cause to `proxy.ts`'s staging-bypass branch (returns early without setting `x-pathname`/`x-search`) combined with `app/(app)/layout.tsx`'s onboarding-exemption check (reads `x-pathname`, defaults to `""` when absent, so the exemption for `/onboarding` itself never matches) — for a staging user with zero transactions and no `onboardingCompletedAt`, this is an unconditional infinite loop.
  7. Confirmed via `git blame` that this code is unchanged since commit `cff3b7464` (2026-04-25), three months before Phase 80 started — genuinely pre-existing.
  8. Logged full detail to `deferred-items.md`; did not modify `proxy.ts` or `app/(app)/layout.tsx` (out of this plan's scope).
- `yarn test` and the real-Postgres regression trio both ran and passed cleanly on the first attempt — no issues there.

## User Setup Required

None - no external service configuration required for this plan's own deliverables. A future quick task should address the `proxy.ts` staging-bypass bug (see `deferred-items.md` for the two candidate fixes) before any dashboard Playwright spec — old or new — can run green again in this or any similar sandbox.

## Next Phase Readiness

- Phase 80 (dashboard-accrual-lens) is functionally complete: all eight DAL aggregation functions are lens-selectable, all four dashboard sub-routes render/wire the global `LensSwitch` per D-03/D-04/D-05/D-06, and the full vitest + real-Postgres regression suites are green with zero accumulated regressions across the phase's seven plans.
- **Outstanding gap:** the live-browser proof of the lens switch's end-to-end behavior (this plan's own primary deliverable) is blocked by a pre-existing, unrelated `proxy.ts` bug. Recommend filing a quick task to fix the staging-bypass header gap (or seed the staging user past the zero-transaction onboarding gate) and then re-running `yarn test:e2e tests/dashboard.spec.ts -g "LENS"` before considering Phase 80's UI fully signed off end-to-end. This gap does not block milestone progression — the DAL/URL-wiring layer is independently proven by six prior plans' real-Postgres and unit test suites, and the new spec is authored and ready to run the moment the environmental blocker is cleared.
- `.planning/phases/80-dashboard-accrual-lens/deferred-items.md` carries the full diagnosis forward for whoever picks up that quick task.

## Self-Check: PASSED

- FOUND: tests/dashboard.spec.ts
- FOUND: .planning/phases/80-dashboard-accrual-lens/deferred-items.md
- FOUND commit: c0197c29

---
*Phase: 80-dashboard-accrual-lens*
*Completed: 2026-07-29*
