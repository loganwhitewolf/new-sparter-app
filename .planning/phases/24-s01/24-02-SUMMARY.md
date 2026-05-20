---
phase: "24"
plan: "02"
---

# T02: Documented the Vercel/Supabase/R2 production environment contract and restored the build baseline for the serverless DB config.

**Documented the Vercel/Supabase/R2 production environment contract and restored the build baseline for the serverless DB config.**

## What Happened

Updated `.env.example` into production-aware groups for database, auth, Cloudflare R2, categorization gates, logging, and planned registration control. Added explicit documentation for `DATABASE_POOL_MAX` default/cap behavior and the planned `REGISTRATION_ENABLED` guardrail without implementing signup blocking. Created `docs/deploy/vercel-supabase-r2.md` with Vercel runtime variables, public vs secret boundaries, S02-reserved production migration variables, free-tier constraints, redeploy-after-env-change guidance, and no-secret verification through `/api/health`. During the local build baseline, Next.js type checking surfaced a T01 DB config typing issue where the narrow env type did not accept `process.env`; fixed the helper type/default boundary without changing runtime behavior so the build baseline passes.

## Verification

Verified the deployment doc exists and contains the required contract markers, `.env.example` includes `DATABASE_POOL_MAX` and `REGISTRATION_ENABLED`, developer-facing language checks pass, the DB config test suite still passes after the type fix, and `yarn build` completes successfully. `/api/health` remains documented as the no-secret readiness surface with sanitized database failure codes and missing R2 env names only.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `test -f docs/deploy/vercel-supabase-r2.md && grep -q "DATABASE_POOL_MAX" .env.example && grep -q "REGISTRATION_ENABLED" .env.example && grep -q "Vercel runtime" docs/deploy/vercel-supabase-r2.md` | 0 | ✅ pass | 23ms |
| 2 | `yarn vitest run tests/db-config.test.ts` | 0 | ✅ pass | 657ms |
| 3 | `yarn check:language` | 0 | ✅ pass | 710ms |
| 4 | `yarn build` | 0 | ✅ pass | 15932ms |

## Deviations

Fixed a build-blocking TypeScript issue in `lib/db/config.ts` discovered while running the required build baseline; this was outside the two planned documentation files but necessary to satisfy slice verification.

## Known Issues

Production migrations remain intentionally deferred to S02; the runbook reserves the migration-only env contract but does not implement the migration command.

## Files Created/Modified

- `.env.example`
- `docs/deploy/vercel-supabase-r2.md`
- `lib/db/config.ts`
