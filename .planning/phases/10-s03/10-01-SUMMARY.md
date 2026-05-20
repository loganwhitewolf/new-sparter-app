---
phase: "10"
plan: "01"
---

# T01: Added GET /api/health endpoint with bounded DB probe and R2 config diagnostics, emitting a redacted health_check_completed Pino event

**Added GET /api/health endpoint with bounded DB probe and R2 config diagnostics, emitting a redacted health_check_completed Pino event**

## What Happened

Created `lib/services/health.ts` to hold the probe logic (`probeDb`, `probeR2`, types) separately from the route file so Next.js route export constraints are satisfied. `probeDb` checks `DATABASE_URL` presence before executing `db.execute(sql\`SELECT 1\`)`, races it against a configurable timeout (default 2500ms), and returns typed component results without leaking the connection string. `probeR2` calls `getMissingR2EnvVars()` from the refactored `lib/services/r2.ts` — no S3Client instantiation or Cloudflare network call.

Refactored `lib/services/r2.ts` to export `REQUIRED_R2_ENV_VARS` (const tuple) and `getMissingR2EnvVars(env = process.env)` as a pure helper, then wired `getR2Config` to consume it so upload behavior and health share a single source of truth for required env vars.

`app/api/health/route.ts` exports only `runtime`, `dynamic`, and `GET` — no extra exports that would fail Next.js type checking. The `GET` handler runs `probeDb` and `probeR2` in parallel, builds the `{ status, timestamp, components }` response, and emits one `health_check_completed` Pino info event containing only safe fields (status codes, variable names, latency) — never DATABASE_URL, R2 values, tokens, or signed URLs.

`tests/health.test.ts` mocks `@/lib/services/health`, `@/lib/logger`, and `server-only`, covering: ok path, missing R2 vars, DATABASE_URL absent (skips DB execution), DB rejection, DB timeout code, redaction assertions, ISO timestamp shape, and latencyMs presence. `tests/r2.test.ts` extended with 5 new tests covering `REQUIRED_R2_ENV_VARS`, `getMissingR2EnvVars` happy path, partial missing, blank/whitespace values, and value-vs-name redaction invariant. `.env.example` updated with all four R2 variable names and actionable comments linking to the health endpoint degraded response.

## Verification

Ran `yarn vitest run tests/health.test.ts tests/r2.test.ts --reporter=verbose` — 22/22 tests passed across both files. Ran `yarn lint` — 0 errors, 3 pre-existing warnings (unchanged). Ran `yarn build` — compiled successfully, /api/health listed as dynamic route ƒ in the route table, no TypeScript errors.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest run tests/health.test.ts tests/r2.test.ts --reporter=verbose` | 0 | ✅ pass — 22 tests passed (0 failed) | 347ms |
| 2 | `yarn lint` | 0 | ✅ pass — 0 errors, 3 pre-existing warnings | 4200ms |
| 3 | `yarn build` | 0 | ✅ pass — compiled successfully, /api/health listed as dynamic route | 12000ms |

## Deviations

probeDb is exported from lib/services/health.ts (not from the route file as the plan originally suggested) because Next.js 16 enforces that route files may only export recognized HTTP method handlers and config constants. The injectable timeout is accessed by importing probeDb directly from the service in tests rather than passing it through GET's second argument. Functional contract is identical; the module boundary differs from the plan's initial suggestion.

## Known Issues

none

## Files Created/Modified

- `app/api/health/route.ts`
- `lib/services/health.ts`
- `lib/services/r2.ts`
- `tests/health.test.ts`
- `tests/r2.test.ts`
- `.env.example`
