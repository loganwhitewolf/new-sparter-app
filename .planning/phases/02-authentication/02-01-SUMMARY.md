---
phase: 02-authentication
plan: "01"
subsystem: auth
tags: [better-auth, drizzle, pg, server-only, nextcookies]

# Dependency graph
requires:
  - phase: 02-00
    provides: auth.spec.ts stubs and layout test staging bypass
provides:
  - lib/db/index.ts real pg connection pool with DbOrTx union type
  - auth.ts: Better Auth instance configured with emailAndPassword, Drizzle PostgreSQL adapter, subscriptionPlan/role custom fields, nextCookies() plugin
  - lib/auth-client.ts: createAuthClient for client-side useSession()
  - app/api/auth/[...all]/route.ts: GET/POST catch-all for Better Auth HTTP endpoints
affects: [02-02, 02-03, 02-04, 03-dal, all phases using auth session]

# Tech tracking
tech-stack:
  added: [better-auth/adapters/drizzle, better-auth/next-js, pg Pool connection]
  patterns: [nextCookies() as last plugin, server-only import guard, DbOrTx union type for transactions, toNextJsHandler() route delegation]

key-files:
  created:
    - auth.ts
    - lib/auth-client.ts
    - app/api/auth/[...all]/route.ts
  modified:
    - lib/db/index.ts
    - lib/db/schema.ts

key-decisions:
  - "nextCookies() must be last plugin in plugins array — cookie propagation in Server Actions depends on plugin order"
  - "input: false on subscriptionPlan and role additionalFields — prevents users self-assigning elevated subscription or admin role at signup (T-2-01-01, D-09)"
  - "autoSignIn: true implements D-02 — automatic session after registration redirects to /dashboard"
  - "lib/db/schema.ts placeholder needs export {} to satisfy TypeScript module resolution for import * as schema"

patterns-established:
  - "Pattern: auth.ts at project root — single Better Auth instance imported everywhere auth is needed"
  - "Pattern: toNextJsHandler(auth) delegates all /api/auth/* endpoints to Better Auth"
  - "Pattern: createAuthClient with NEXT_PUBLIC_ env var for client-side session access"
  - "Pattern: DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0] — full union type for transaction support"

requirements-completed: [AUTH-02]

# Metrics
duration: 15min
completed: 2026-04-25
---

# Phase 2 Plan 01: DB Client + Better Auth Core Summary

**pg Pool connection + Better Auth betterAuth() config with Drizzle PostgreSQL adapter, custom user fields (subscriptionPlan/role), and nextCookies() plugin**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-25T00:00:00Z
- **Completed:** 2026-04-25T00:15:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Replaced lib/db/index.ts null stub with real pg Pool, proper DbOrTx union type including transaction parameter type
- Created auth.ts at project root with full Better Auth configuration: emailAndPassword (autoSignIn, 8-char minimum), drizzleAdapter PostgreSQL, subscriptionPlan/role additionalFields with input:false, nextCookies() as last plugin
- Created lib/auth-client.ts with createAuthClient using NEXT_PUBLIC_BETTER_AUTH_URL
- Created app/api/auth/[...all]/route.ts delegating all Better Auth HTTP endpoints via toNextJsHandler(auth)
- Fixed schema.ts placeholder to export {} enabling TypeScript module resolution

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace lib/db/index.ts stub with real pg pool** - `0767638` (feat)
2. **Task 2: Create auth.ts, lib/auth-client.ts, and auth route handler** - `b810bd9` (feat)

**Deviation fix:** `32a6aff` (fix: schema.ts empty export for TS module resolution)

## Files Created/Modified
- `lib/db/index.ts` - Real pg Pool, drizzle() with schema, DbOrTx union type, import 'server-only'
- `lib/db/schema.ts` - Added `export {}` to make it a valid TypeScript module (was comment-only)
- `auth.ts` - Better Auth config: emailAndPassword, drizzleAdapter PostgreSQL, subscriptionPlan/role custom fields, nextCookies() plugin
- `lib/auth-client.ts` - createAuthClient with NEXT_PUBLIC_BETTER_AUTH_URL fallback
- `app/api/auth/[...all]/route.ts` - Catch-all route handler: GET and POST via toNextJsHandler(auth)

## Decisions Made
- Used `drizzle(pool, { schema })` with `drizzle-orm/node-postgres`
- `DATABASE_SSL=true` enables strict TLS when the hosting provider requires it
- `plugins: [nextCookies()]` as only and last plugin — ordering is critical per research (Pitfall 2)
- `input: false` on both additionalFields implements threat model mitigation T-2-01-01 (privilege escalation at signup)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] schema.ts placeholder causes TypeScript "not a module" error**
- **Found during:** Task 1 (Replace lib/db/index.ts stub) — post-commit TS verification
- **Issue:** `lib/db/schema.ts` contained only a comment with no exports. TypeScript reports "File is not a module" when `import * as schema from './schema'` is evaluated
- **Fix:** Added `export {}` to schema.ts — makes it a proper TypeScript module without changing runtime behavior
- **Files modified:** `lib/db/schema.ts`
- **Verification:** `npx tsc --noEmit` reports "No errors found" after fix
- **Committed in:** `32a6aff`

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Schema placeholder fix required for TypeScript compilation. No scope creep — schema content unchanged (still a placeholder for Plan 02).

## Issues Encountered
None beyond the schema.ts auto-fix documented above.

## User Setup Required
None - no external service configuration in this plan. Database credentials (DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL) are required at runtime but are documented in existing .env.example.

## Next Phase Readiness
- Plan 02-02 (schema generation) can now proceed — auth.ts config is complete and drizzle adapter is configured
- All downstream phases can import `auth` from `@/auth` and `authClient` from `@/lib/auth-client`
- Better Auth CLI can run `npx @better-auth/cli generate` against auth.ts to generate schema tables
- TypeScript compilation is clean (0 errors)

## Known Stubs
- `lib/db/schema.ts` — exports only `{}`, no actual table definitions. This is intentional: Plan 02-02 will run `@better-auth/cli generate` to populate this file with Better Auth tables.

## Threat Flags
No new threat surface introduced beyond what was specified in the plan's threat model.

---
*Phase: 02-authentication*
*Completed: 2026-04-25*

## Self-Check: PASSED

Verified:
- `lib/db/index.ts` exists and contains real pg pool
- `auth.ts` exists at project root with betterAuth() config
- `lib/auth-client.ts` exists with createAuthClient
- `app/api/auth/[...all]/route.ts` exists with GET/POST exports
- Commits `0767638`, `b810bd9`, `32a6aff` all present in git log
- `npx tsc --noEmit` returns "No errors found"
