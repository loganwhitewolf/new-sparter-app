---
phase: 01-design-system
plan: 05
subsystem: ui
tags: [layout, route-groups, navigation, playwright]
requires:
  - phase: 01-04
    provides: shadcn components and layout dependencies
provides:
  - Auth route group layout and login page stub
  - App route group layout with sidebar, topbar, and bottom nav
  - Dashboard page stub with Italian empty state
affects: [auth, dashboard, expense-management, file-import]
tech-stack:
  added: []
  patterns:
    - Public pages live under app/(auth)
    - Authenticated shell pages live under app/(app)
    - Responsive app navigation switches at md breakpoint
key-files:
  created:
    - app/(auth)/layout.tsx
    - app/(auth)/login/page.tsx
    - app/(app)/layout.tsx
    - app/(app)/dashboard/page.tsx
    - components/layout/sidebar.tsx
    - components/layout/topbar.tsx
    - components/layout/bottom-nav.tsx
  modified: []
key-decisions:
  - "Kept Phase 1 page stubs minimal and Italian-only per UI-SPEC."
patterns-established:
  - "App shell data-sidebar and data-bottom-nav attributes are stable Playwright contracts."
requirements-completed: [DS-03]
duration: 3 min
completed: 2026-04-24
---

# Phase 1 Plan 05: Layout Shell Summary

**Responsive auth and app route-group shell with Sparter navigation and green Playwright coverage**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-24T14:15:48Z
- **Completed:** 2026-04-24T14:19:05Z
- **Tasks:** 2 completed
- **Files modified:** 7

## Accomplishments

- Added desktop Sidebar, Topbar, and mobile BottomNav layout components.
- Added `(auth)` layout and `/login` stub with Italian CTA and shadcn Button/Input usage.
- Added `(app)` layout and `/dashboard` stub with sidebar/topbar/bottom-nav shell.
- Turned the Phase 1 Playwright layout and design-system specs green.

## Task Commits

1. **Task 1: Create layout components** - `9807114` (feat)
2. **Task 2: Create route group layouts and page stubs** - `c3d1234` (feat)

## Files Created/Modified

- `components/layout/sidebar.tsx` - Desktop sidebar with Dashboard, Spese, Import, Categorie, and separated Impostazioni.
- `components/layout/topbar.tsx` - Sparter wordmark and avatar dropdown with Profilo/Logout.
- `components/layout/bottom-nav.tsx` - Mobile bottom nav with four main items and `data-bottom-nav`.
- `app/(auth)/layout.tsx` - Centered public layout without sidebar/topbar.
- `app/(auth)/login/page.tsx` - Login stub with Button/Input and `Accedi`.
- `app/(app)/layout.tsx` - Authenticated shell with `data-sidebar` and responsive bottom nav.
- `app/(app)/dashboard/page.tsx` - Dashboard empty state stub.

## Decisions Made

- Kept `/expenses`, `/import`, `/categories`, and `/settings` as navigation targets without creating stubs; later phases own those pages.
- Used `md` as the shell breakpoint, matching the UI contract and Playwright tests.

## Deviations from Plan

None - plan executed exactly as written.

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** No scope change.

## Issues Encountered

- Playwright needed permission to start the local dev server on port 3000; after escalation, all 10 tests passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 2 can attach Better Auth behavior to the existing `/login`, `/dashboard`, topbar dropdown, and proxy placeholder.

## Self-Check: PASSED

- `npm run build` passed.
- `npx playwright test --project=chromium` passed: 10/10 tests green.
- `app/(app)/layout.tsx` contains `data-sidebar`, Sidebar, Topbar, and BottomNav with `md:hidden`.
- `components/layout/bottom-nav.tsx` contains `data-bottom-nav`, 4 items, and `min-h-[44px]`.
- `app/(auth)/login/page.tsx` contains Button/Input and `Accedi`.
- `app/(app)/dashboard/page.tsx` contains `Nessuna spesa ancora`.

---
*Phase: 01-design-system*
*Completed: 2026-04-24*
