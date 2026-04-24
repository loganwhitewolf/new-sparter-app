---
phase: 01-design-system
plan: 03
subsystem: ui
tags: [shadcn, tailwind, geist, design-tokens]
requires:
  - phase: 01-02
    provides: Next.js 16 App Router and Tailwind v4 scaffold
provides:
  - shadcn/ui registry configuration
  - Geist and Geist Mono font module
  - Slate and emerald Tailwind v4 CSS variable system
affects: [components, layout, dashboard]
tech-stack:
  added:
    - shadcn
    - class-variance-authority
    - clsx
    - lucide-react
    - radix-ui
    - tailwind-merge
    - tw-animate-css
  patterns:
    - Design tokens live in app/globals.css via Tailwind v4 @theme inline
    - Fonts are exported from app/fonts.ts and applied on the root html/body
key-files:
  created:
    - components.json
    - app/fonts.ts
  modified:
    - app/globals.css
    - app/layout.tsx
    - package.json
    - package-lock.json
key-decisions:
  - "Used shadcn v4's current preset initializer, then manually set the config to the planned New York/zinc contract."
  - "Kept shadcn/tailwind.css imported because v4 components depend on it."
patterns-established:
  - "Project semantic colors use --total-in, --total-out, and --balance roots mapped to Tailwind color tokens."
requirements-completed: [DS-01]
duration: 18 min
completed: 2026-04-24
---

# Phase 1 Plan 03: Design Foundation Summary

**shadcn registry config, Geist font wiring, and slate/emerald Tailwind v4 token system**

## Performance

- **Duration:** 18 min
- **Started:** 2026-04-24T13:55:56Z
- **Completed:** 2026-04-24T14:13:42Z
- **Tasks:** 2 completed
- **Files modified:** 6

## Accomplishments

- Initialized shadcn/ui for the Next.js 16 and Tailwind v4 project.
- Added `app/fonts.ts` exporting Geist and Geist Mono via `next/font/google`.
- Replaced the generated neutral token set with the planned slate surfaces, emerald primary, red destructive, and financial KPI semantic tokens.
- Updated the root layout to apply `lang="it"` and Geist CSS variables.

## Task Commits

1. **Task 1: Run shadcn/ui init and create app/fonts.ts** - `56a84c0` (feat)
2. **Task 2: Override globals.css and update app/layout.tsx** - `7c288b0` (feat)

## Files Created/Modified

- `components.json` - shadcn registry config with New York style and zinc base.
- `app/fonts.ts` - Geist and Geist Mono exports.
- `app/globals.css` - Tailwind v4 token source for shadcn and Sparter semantic colors.
- `app/layout.tsx` - Italian root document and font variable application.
- `package.json` and `package-lock.json` - shadcn runtime styling dependencies.

## Decisions Made

- shadcn v4.4 no longer accepts the older `--style new-york --base-color zinc` flags, so initialization used a current preset and the config was manually aligned to the plan contract.
- `@import "shadcn/tailwind.css"` was retained in `globals.css` because the v4 generated components rely on shadcn's Tailwind utility layer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shadcn CLI flags changed**
- **Found during:** Task 1
- **Issue:** `npx shadcn@latest init --style new-york --base-color zinc` failed because v4.4 removed those flags.
- **Fix:** Used `--template next --preset nova --css-variables --yes`, then manually forced `components.json` to the New York/zinc contract and rewrote tokens.
- **Files modified:** `components.json`, `app/globals.css`, `package.json`, `package-lock.json`
- **Verification:** `components.json` contains `"style": "new-york"` and `"baseColor": "zinc"`; `npm run build` exits 0.
- **Committed in:** `56a84c0`, `7c288b0`

**2. [Rule 2 - Missing Critical] shadcn init created Plan 04-owned files early**
- **Found during:** Task 1
- **Issue:** The v4 initializer created `components/ui/button.tsx` and `lib/utils.ts` immediately.
- **Fix:** Left those files uncommitted for Plan 04, where component installation and `lib/utils.ts` are owned.
- **Files modified:** None committed in this plan.
- **Verification:** Plan 03 commits include only config, font, token, and package changes.
- **Committed in:** Not applicable

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** The design foundation is aligned to the intended visual contract and builds successfully.

## Issues Encountered

- Direct shadcn v4 CLI flags differed from the plan's older syntax.
- shadcn v4 generated an initial Button and `lib/utils.ts`; these are carried forward to Plan 04.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 04 can install or reconcile the remaining shadcn components against the established token system and `components.json`.

## Self-Check: PASSED

- `components.json` contains `"style": "new-york"` and `"cssVariables": true`.
- `app/fonts.ts` contains `Geist_Mono` and exports `geistSans` / `geistMono`.
- `app/globals.css` contains emerald primary, emerald ring, red destructive, slate border, radius `0.5rem`, and font/KPI theme tokens.
- `app/layout.tsx` imports `geistSans` and `geistMono`, applies their variables, and sets `lang="it"`.
- `npm run build` passed.

---
*Phase: 01-design-system*
*Completed: 2026-04-24*
