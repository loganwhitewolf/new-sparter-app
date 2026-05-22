---
phase: 31-oauth-ui
plan: "03"
subsystem: auth-ui
tags: [oauth, ui, server-component, next-app-router, better-auth, vitest, tdd]

dependency_graph:
  requires:
    - phase: 31-01
      provides: "tests/oauth-ui.test.tsx (Wave 0 RED gate spec — 9 Vitest unit tests)"
    - phase: 31-02
      provides: "components/auth/social-provider-buttons.tsx (SocialProviderButtons + getOAuthErrorMessage)"
  provides:
    - "components/auth/login-form.tsx — 'use client' LoginForm with SocialProviderButtons, Oppure divider, oauthError Alert"
    - "components/auth/register-form.tsx — 'use client' RegisterForm mirror with per-page error URL"
    - "app/(auth)/login/page.tsx — async server component reading process.env, forwarding activeProviders + oauthError"
    - "app/(auth)/register/page.tsx — async server component mirror for register"
  affects:
    - "Phase 32 (account linking UI) — auth pages now server components, pattern established"

tech-stack:
  added: []
  patterns:
    - "Server component page wrapper reading process.env, passing config down to 'use client' form (D-05)"
    - "searchParams as Promise<{ error?: string }> awaited in async server component (Next.js 15+ pattern)"
    - "Per-page OAuth error URL: /login?error=OAuthCallbackError vs /register?error=OAuthCallbackError (D-07)"
    - "getOAuthErrorMessage lookup table guards all user-controlled ?error= input before render (T-31-03-01)"

key-files:
  created:
    - components/auth/login-form.tsx
    - components/auth/register-form.tsx
  modified:
    - app/(auth)/login/page.tsx
    - app/(auth)/register/page.tsx
    - app/api/auth/[...all]/route.ts

key-decisions:
  - "Per-page errorCallbackURL: RegisterForm passes /register?error=OAuthCallbackError so OAuth errors from the register page land back on register (D-07 per-page URL approach)"
  - "Rule 3 fix applied: app/api/auth/[...all]/route.ts had stale import from lib/auth/registration (deleted in Phase 30 Plan 01 from auth.ts but route.ts was missed); fix mirrors the pending unstaged change in develop"

metrics:
  duration: "~6 min"
  started: "2026-05-21T14:20:53Z"
  completed: "2026-05-21"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 3
---

# Phase 31 Plan 03: Auth Page Refactor Summary

**Async server component wrappers for /login and /register with env-conditional SocialProviderButtons, Oppure divider, and per-page OAuth error Alert; email/password form logic preserved byte-identical in extracted 'use client' LoginForm/RegisterForm.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-21T14:20:53Z
- **Completed:** 2026-05-21
- **Tasks:** 2 / 2
- **Files created:** 2
- **Files modified:** 3

## Accomplishments

### Task 1 — LoginForm + login page server component (commit e62f8bf)

- Created `components/auth/login-form.tsx` as `'use client'` component
  - Accepts `activeProviders: Provider[]` and `oauthError?: string` props
  - Preserves all pre-existing email/password JSX: heading "Accedi", subtitle, useActionState(signInAction), email/password Inputs, submit Button with Loader2, footer link to /register
  - Adds SocialProviderButtons + "Oppure" divider above the form, gated on `hasSocial` (D-01, D-02, D-06)
  - Renders oauthError through getOAuthErrorMessage into Alert variant="destructive" (D-07, D-08)
  - Uses `errorCallbackURL="/login?error=OAuthCallbackError"` (per-page error URL)
- Rewrote `app/(auth)/login/page.tsx` to 14-line async server component
  - No 'use client' directive
  - Awaits `searchParams: Promise<{ error?: string }>`
  - Reads `process.env.GOOGLE_CLIENT_ID` and `process.env.GITHUB_CLIENT_ID`
  - Pushes 'google' before 'github' (D-03 Google-first ordering)
  - Renders only `<LoginForm activeProviders={...} oauthError={error} />`

### Task 2 — RegisterForm + register page server component (commit 21d8f48)

- Created `components/auth/register-form.tsx` as `'use client'` component
  - Mirror of LoginForm with signUpAction, heading "Crea account", button "Registrati", autoComplete="new-password", footer link to /login
  - Uses `errorCallbackURL="/register?error=OAuthCallbackError"` so OAuth errors from register land back on /register (D-07 per-page URL, resolves research open question A2)
- Rewrote `app/(auth)/register/page.tsx` to 14-line async server component (same pattern as login)

### Rule 3 Fix — route handler stale import (commit 7804afa)

- Fixed `app/api/auth/[...all]/route.ts` which imported from `@/lib/auth/registration` (deleted in Phase 30 Plan 01 from auth.ts but the route handler was not updated)
- The fix was already present as an unstaged change in the develop branch; applied here to make `yarn build` succeed

## Task Commits

1. **Task 1: Extract LoginForm, convert login/page.tsx** — `e62f8bf` (feat)
2. **Task 2: Extract RegisterForm, convert register/page.tsx** — `21d8f48` (feat)
3. **Rule 3 Fix: Remove stale lib/auth/registration import** — `7804afa` (fix)

## Files Created/Modified

- `components/auth/login-form.tsx` — 'use client' LoginForm with social section, Oppure divider, dual Alert blocks
- `components/auth/register-form.tsx` — 'use client' RegisterForm mirror with /register error URL
- `app/(auth)/login/page.tsx` — Async server component reading process.env, 14 lines
- `app/(auth)/register/page.tsx` — Async server component reading process.env, 14 lines
- `app/api/auth/[...all]/route.ts` — Simplified to 4 lines (removed stale registration guard import)

## Decisions Made

- `errorCallbackURL` in RegisterForm points to `/register?error=OAuthCallbackError` (not `/login?error=...`). Research open question A2 resolved: per-page error URLs ensure OAuth errors initiated from the register page display on the register page, not the login page (consistent with D-07's intent).
- env vars are read at request time (not module load) in the server component, so toggling CLIENT_ID vars takes effect immediately without a redeploy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed stale import in app/api/auth/[...all]/route.ts**
- **Found during:** Task 2 verification (yarn build step)
- **Issue:** `app/api/auth/[...all]/route.ts` still imported `isRegistrationEnabled` and `REGISTRATION_DISABLED_MESSAGE` from `@/lib/auth/registration`. That module was effectively removed when Phase 30 Plan 01 purged the registration guard from `lib/actions/auth.ts`, but the route handler was not updated. The module path never existed as a file (the registration guard was removed from auth.ts, not extracted to a separate module), so webpack threw a "Module not found" error.
- **Fix:** Simplified route.ts to `export const { GET, POST } = toNextJsHandler(auth)` — the exact fix already present as an unstaged change in the develop worktree.
- **Files modified:** `app/api/auth/[...all]/route.ts`
- **Commit:** `7804afa`

---

**Total deviations:** 1 auto-fixed (Rule 3 — pre-existing blocking build error from Phase 30)
**Impact on plan:** Minimal. The fix is a 4-line simplification already staged in develop. No scope creep; no new behavior added.

## Issues Encountered

None beyond the Rule 3 deviation documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Phase 31 is complete. All 5 OAUTH requirements are now reachable end-to-end:
- OAUTH-01/03: Clicking "Continua con Google/GitHub" on /login initiates OAuth and lands at /dashboard
- OAUTH-02/04: First-time OAuth user gets account auto-created (Better Auth handles, Phase 30)
- OAUTH-05: Buttons are hidden when CLIENT_ID env vars are unset; shown when set

Phase 32 (account linking UI in settings) can proceed. Auth pages are now server components — the established pattern applies there as well.

## Known Stubs

None — all social button behavior is fully wired. activeProviders reads real process.env values; authClient.signIn.social() is called directly on click; getOAuthErrorMessage returns real Italian strings from the lookup table.

## Threat Flags

None — all T-31-03-01 through T-31-03-05 mitigations satisfied:
- T-31-03-01 (XSS via ?error=): oauthError always passes through getOAuthErrorMessage before render; only pre-defined strings reach JSX
- T-31-03-02 (env var disclosure): only string literals 'google'/'github' cross to client; CLIENT_ID values stay server-side
- T-31-03-03 (open redirect): errorCallbackURL is a hardcoded string literal in each form; no user input flows in
- T-31-03-04 (CSRF): PKCE + signed state cookie handled by Better Auth (Phase 30, unchanged)
- T-31-03-05 (repudiation): accepted — single-user personal finance app

## Self-Check: PASSED

- `components/auth/login-form.tsx` exists: CONFIRMED
- `components/auth/register-form.tsx` exists: CONFIRMED
- `app/(auth)/login/page.tsx` is async server component (no 'use client'): CONFIRMED
- `app/(auth)/register/page.tsx` is async server component (no 'use client'): CONFIRMED
- Commit `e62f8bf` exists: CONFIRMED
- Commit `21d8f48` exists: CONFIRMED
- Commit `7804afa` exists: CONFIRMED
- `yarn test --run` exits 0 (536/536): CONFIRMED
- `yarn build` succeeds with /login and /register as Dynamic routes: CONFIRMED
- No STATE.md or ROADMAP.md modifications: CONFIRMED

---
*Phase: 31-oauth-ui*
*Completed: 2026-05-21*
