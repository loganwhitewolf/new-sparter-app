---
phase: 01-design-system
plan: 01
subsystem: testing
tags: [playwright, e2e, validation, nyquist]
requires: []
provides:
  - Playwright chromium test harness
  - RED smoke tests for design tokens, shadcn button rendering, and route layout shell
affects: [design-system, layout, validation]
tech-stack:
  added:
    - "@playwright/test"
  patterns:
    - E2E tests use data attributes for layout shell selectors
key-files:
  created:
    - playwright.config.ts
    - tests/design-system.spec.ts
    - tests/layout.spec.ts
  modified:
    - package.json
    - package-lock.json
key-decisions:
  - "Playwright test stubs were created after the Next scaffold because create-next-app cannot run in a workspace with a pre-existing package.json."
patterns-established:
  - "Layout tests depend on stable data-sidebar and data-bottom-nav attributes."
requirements-completed: [DS-01, DS-02, DS-03]
duration: 3 min
completed: 2026-04-24
---

# Phase 1 Plan 01: Validation Setup Summary

**Playwright chromium smoke suite with RED tests for design tokens, shadcn rendering, and layout shell contracts**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-24T13:53:12Z
- **Completed:** 2026-04-24T13:55:56Z
- **Tasks:** 2 completed
- **Files modified:** 5

## Accomplishments

- Installed `@playwright/test` and confirmed Chromium had already been downloaded successfully.
- Added `playwright.config.ts` with localhost `baseURL`, `npm run dev` web server, and a single chromium project.
- Added RED tests for CSS variables, Geist font application, Button rendering, auth layout, app layout, sidebar, and mobile bottom navigation.

## Task Commits

1. **Task 1: Install Playwright and create playwright.config.ts** - `5abd412` (test)
2. **Task 2: Create test stubs** - `91e0d6c` (test)

## Files Created/Modified

- `playwright.config.ts` - Playwright config using `npm run dev` and chromium.
- `tests/design-system.spec.ts` - DS-01 and DS-02 smoke tests.
- `tests/layout.spec.ts` - DS-03 route group and responsive navigation smoke tests.
- `package.json` and `package-lock.json` - Added `@playwright/test`.

## Decisions Made

- Kept `data-sidebar` and `data-bottom-nav` as stable implementation contracts for later plans.
- Executed this plan after the scaffold prerequisite to avoid a `create-next-app` package file conflict.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Playwright install required a package scaffold**
- **Found during:** Phase execution ordering
- **Issue:** Installing Playwright before bootstrapping Next would create a partial `package.json` and block `create-next-app`.
- **Fix:** Bootstrapped Next first, then installed Playwright and created the RED specs before feature implementation.
- **Files modified:** `package.json`, `package-lock.json`, `playwright.config.ts`, `tests/design-system.spec.ts`, `tests/layout.spec.ts`
- **Verification:** Playwright config import passed; test selector greps passed.
- **Committed in:** `5abd412`, `91e0d6c`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Validation stubs still exist before design token, component, and layout implementation plans, preserving the RED-to-GREEN intent.

## Issues Encountered

- `npx tsx` needed permission to open a temporary IPC pipe for config verification; verification passed after escalation.
- The tests are intentionally RED until Plans 03-05 complete.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 03 can implement design tokens against `tests/design-system.spec.ts`. Plan 05 must add `data-sidebar` and `data-bottom-nav` exactly as referenced by `tests/layout.spec.ts`.

## Self-Check: PASSED

- `playwright.config.ts` exists with `baseURL: 'http://localhost:3000'`.
- `playwright.config.ts` contains `command: 'npm run dev'`.
- `package.json` contains `@playwright/test`.
- `tests/design-system.spec.ts` contains `--primary` and `Geist` checks.
- `tests/layout.spec.ts` contains `data-sidebar`, `data-bottom-nav`, `375`, and `1280` viewport checks.

---
*Phase: 01-design-system*
*Completed: 2026-04-24*
