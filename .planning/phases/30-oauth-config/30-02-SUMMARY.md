---
phase: 30-oauth-config
plan: "02"
subsystem: auth
tags: [better-auth, oauth, google, github, env-config]

# Dependency graph
requires: []
provides:
  - "auth.ts socialProviders block with env-conditional Google + GitHub OAuth providers"
  - "Operators can activate a provider by setting *_CLIENT_ID + *_CLIENT_SECRET env vars — no code change"
affects:
  - 30-oauth-config
  - any phase that extends auth.ts or adds OAuth flows

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conditional spread pattern: ...(process.env.KEY ? { provider: { clientId, clientSecret! } } : {}) for opt-in providers"
    - "Guard only on CLIENT_ID (not CLIENT_SECRET); clientSecret uses ! non-null assertion for loud failure on misconfiguration"

key-files:
  created: []
  modified:
    - auth.ts

key-decisions:
  - "Guard on CLIENT_ID only (not CLIENT_SECRET) so presence of the ID is the activation signal; SECRET absence crashes loudly at first OAuth attempt"
  - "socialProviders is a top-level key in betterAuth({}) — not inside plugins, database, user, or emailAndPassword"
  - "yarn tsc --noEmit errors attributed to lib/auth/registration (Plan 30-01, parallel wave) and pre-existing test fixtures — not caused by this plan"

patterns-established:
  - "Conditional spread for optional Better Auth social providers: ...(process.env.X ? { providerId: { clientId: X, clientSecret: Y! } } : {})"

requirements-completed: [ENV-01, ENV-02]

# Metrics
duration: 5min
completed: 2026-05-21
---

# Phase 30 Plan 02: OAuth Config Summary

**Env-conditional Google and GitHub social providers added to Better Auth via conditional spread guards on CLIENT_ID env vars**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-21T08:16:00Z
- **Completed:** 2026-05-21T08:21:42Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Inserted `socialProviders` as a top-level key in `betterAuth({})` in `auth.ts`, between `emailAndPassword` and `database`
- Google provider activated iff `process.env.GOOGLE_CLIENT_ID` is truthy (independently optional)
- GitHub provider activated iff `process.env.GITHUB_CLIENT_ID` is truthy (independently optional)
- All structural invariants verified via grep; TypeScript errors limited to parallel-plan dependencies (Plan 30-01)

## Task Commits

1. **Task 1 + Task 2: Insert socialProviders block + verify structural invariants** - `ad0585e` (feat)

**Plan metadata:** (docs commit follows)

## Final shape of socialProviders block (auth.ts lines 14-31)

```typescript
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          },
        }
      : {}),
    ...(process.env.GITHUB_CLIENT_ID
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
          },
        }
      : {}),
  },
```

## Grep Invariants Verified

| Check | Expected | Result |
|-------|----------|--------|
| `rg --fixed-strings "  socialProviders: {" auth.ts \| wc -l` | 1 | 1 |
| Order: emailAndPassword (L9) → socialProviders (L14) → database (L32) | correct order | confirmed |
| `process.env.GOOGLE_CLIENT_ID` occurrences | 2 | 2 |
| `process.env.GOOGLE_CLIENT_SECRET` occurrences | 1 | 1 |
| `process.env.GITHUB_CLIENT_ID` occurrences | 2 | 2 |
| `process.env.GITHUB_CLIENT_SECRET` occurrences | 1 | 1 |
| `google: {` occurrences | 1 | 1 |
| `github: {` occurrences | 1 | 1 |
| `emailAndPassword: {` preserved | 1 | 1 |
| `drizzleAdapter(db` preserved | 1 | 1 |
| `plugins: [nextCookies()]` preserved | 1 | 1 |
| `clientSecret: process.env.GOOGLE_CLIENT_SECRET!` | 1 | 1 |
| `clientSecret: process.env.GITHUB_CLIENT_SECRET!` | 1 | 1 |

## Files Created/Modified

- `auth.ts` — Added `socialProviders` top-level key with conditional spread for Google and GitHub (18 lines inserted)

## Decisions Made

- Guard only on `CLIENT_ID` (not `CLIENT_SECRET`): presence of the ID is the activation signal; missing SECRET produces a loud runtime crash at first OAuth attempt, not silent degradation (per D-03/D-04)
- `clientSecret` uses `!` non-null assertion — intentional per plan invariants; operator runbook (Plan 03) documents pairing requirement
- `socialProviders` positioned between `emailAndPassword` and `database` per Better Auth config conventions

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

`yarn tsc --noEmit` exited with errors referencing:
- `lib/auth/registration` (TS2307) — module created by Plan 30-01, running in parallel in Wave 1, not yet complete at time of this verification
- Pre-existing test fixture errors in `tests/production-smoke.test.ts` and `tests/set-r2-cors.test.ts` (unrelated `ProcessEnv` shape issues)

Per plan instructions, these failures were documented and not treated as blockers for this plan. The `socialProviders` block itself introduced no TypeScript errors. The canonical TS gate runs after all Wave 1 plans complete.

## User Setup Required

None — env var documentation is owned by Plan 30-03.

## Next Phase Readiness

- `auth.ts` is ready for Plan 30-03 (`.env.example` documentation) and Plan 30-01 (route handler / registration module)
- After Wave 1 completes, `yarn tsc --noEmit` should pass cleanly once `lib/auth/registration` is in place

---
*Phase: 30-oauth-config*
*Completed: 2026-05-21*
