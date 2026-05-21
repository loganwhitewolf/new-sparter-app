---
phase: 31-oauth-ui
plan: "02"
subsystem: auth-ui
tags: [oauth, components, better-auth, lucide-react, vitest, tdd]

dependency_graph:
  requires:
    - phase: 31-01
      provides: "tests/oauth-ui.test.tsx (Wave 0 RED gate spec)"
  provides:
    - "components/auth/social-provider-buttons.tsx — SocialProviderButtons client component + getOAuthErrorMessage mapping function"
  affects:
    - "Plan 03 (login/register form wrappers import SocialProviderButtons and getOAuthErrorMessage)"

tech-stack:
  added: []
  patterns:
    - "'use client' component with useState<Provider | null> for pending/loading state (async onClick pattern)"
    - "Inline SVG components for brand icons when Lucide equivalents are absent"
    - "Record<string, string> error-code-to-Italian-string lookup with typed fallback constant"

key-files:
  created:
    - components/auth/social-provider-buttons.tsx
  modified: []

key-decisions:
  - "Rule 1 bug fix: lucide-react@1.14.0 does not export Github icon despite RESEARCH.md claiming it does; replaced with inline SVG GithubIcon component"
  - "errorCallbackURL is an overridable prop (default /login?error=OAuthCallbackError) so the register page can pass its own route (D-07)"
  - "Google JSX block appears before GitHub JSX block in source order to satisfy D-03 ordering (verified by awk and tests)"

patterns-established:
  - "Shared OAuth button component: receives providers[] prop, returns null when empty (D-06), orders Google first (D-03)"
  - "getOAuthErrorMessage: Record lookup with fallback constant; returns null for falsy input"

requirements-completed: [OAUTH-01, OAUTH-03, OAUTH-05]

duration: ~2min
completed: 2026-05-21
---

# Phase 31 Plan 02: SocialProviderButtons Component Summary

**Shared 'use client' OAuth button component with Google/GitHub inline SVGs, OAUTH_ERROR_MESSAGES Italian lookup map, and D-03/D-04/D-06/D-07/D-08 contract fully satisfied.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-21T14:15:45Z
- **Completed:** 2026-05-21T14:18:00Z
- **Tasks:** 1
- **Files created:** 1

## Accomplishments

- Created `components/auth/social-provider-buttons.tsx` with all four required exports (`Provider`, `SocialProviderButtonsProps`, `SocialProviderButtons`, `getOAuthErrorMessage`)
- All 9 Wave 0 unit tests (tests/oauth-ui.test.tsx) pass GREEN
- Component satisfies D-03 Google-before-GitHub ordering, D-04 Italian copy, D-06 empty-array null guard, D-07 configurable errorCallbackURL, D-08 error-code mapping, D-09 shared extraction

## Task Commits

1. **Task 1: Create SocialProviderButtons + getOAuthErrorMessage** - `09bcea9` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified

- `components/auth/social-provider-buttons.tsx` — Shared OAuth button component; exports `Provider` type, `SocialProviderButtonsProps` interface, `SocialProviderButtons` client component, `getOAuthErrorMessage` helper

## Decisions Made

- Used inline `GithubIcon` SVG component instead of `Github` from lucide-react (see Deviations)
- `errorCallbackURL` defaults to `/login?error=OAuthCallbackError` but is overridable via prop so the register page can pass `/register?error=OAuthCallbackError` (D-07)
- Both Google and GitHub use the same pending/disabled behavior: any pending click disables both buttons; clicked button swaps icon for Loader2 spinner

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced missing Github Lucide icon with inline SVG**
- **Found during:** Task 1 (running yarn test after initial write)
- **Issue:** RESEARCH.md and PATTERNS.md stated `lucide-react@1.14.0` exports `Github`, but `node -e "require('lucide-react')"` confirms no such export exists. Using `<Github />` rendered `undefined` as a JSX element, causing React to throw "Element type is invalid" for the GitHub button tests.
- **Fix:** Removed `import { Github, Loader2 } from 'lucide-react'`, kept `Loader2` import only, and added an inline `GithubIcon` function component using the official GitHub invertocat SVG path (same approach as `GoogleIcon`).
- **Files modified:** `components/auth/social-provider-buttons.tsx`
- **Verification:** `yarn test tests/oauth-ui.test.tsx` — 9/9 tests pass green
- **Committed in:** `09bcea9` (part of task commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug caused by incorrect research note about Lucide icon availability)
**Impact on plan:** Fix is minimal and correct. Component behavior is identical to plan spec; only the GitHub icon implementation source changed (inline SVG instead of Lucide import). No scope creep.

## Issues Encountered

None beyond the Lucide icon deviation documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `components/auth/social-provider-buttons.tsx` is ready for Plan 03 to import
- Exports match the exact interface contract specified in Plan 02 `<interfaces>` block
- `getOAuthErrorMessage` is co-located and ready for login/register page error display
- No new dependencies installed; no environment variables needed

## Known Stubs

None — component is fully wired. `authClient.signIn.social()` is called directly on click; no mock or placeholder data flows to UI.

## Threat Flags

None — threat mitigations T-31-02-01 through T-31-02-05 all satisfied as designed:
- `callbackURL` is the hardcoded constant `SUCCESS_CALLBACK_URL = '/dashboard'` (T-31-02-01)
- `getOAuthErrorMessage` uses untrusted code only as a Record key; only pre-defined Italian strings are returned (T-31-02-02)
- PKCE + signed state cookie handled by Better Auth (T-31-02-03)
- No `process.env.*` imports in this file (T-31-02-04)
- `errorCallbackURL` prop is hardcoded by forms to same-origin paths (T-31-02-05)

## Self-Check: PASSED

- `components/auth/social-provider-buttons.tsx` exists: CONFIRMED
- Commit `09bcea9` exists: CONFIRMED
- `yarn test tests/oauth-ui.test.tsx` exits 0 (9/9 green): CONFIRMED
- No STATE.md or ROADMAP.md modifications: CONFIRMED

---
*Phase: 31-oauth-ui*
*Completed: 2026-05-21*
