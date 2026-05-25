---
phase: "25"
plan: "03"
---

# T03: Documented the local-only Supabase production migration environment and operator runbook for the guarded Drizzle CLI flow.

**Documented the local-only Supabase production migration environment and operator runbook for the guarded Drizzle CLI flow.**

## What Happened

Added migration-only environment names to `.env.example` without credential-shaped values, corrected the Drizzle config production migration comment to point at `yarn db:migrate:production`, and replaced the deferred S02 migration notes in `docs/deploy/vercel-supabase-r2.md` with an operator runbook. The runbook now covers prerequisites, local-only env names, the exact confirmation value, the command, expected sanitized JSON status output, failure cases, runtime-versus-migration URL differences, Vercel redeploy behavior, `/api/health` as the no-secret readiness surface, and Supabase Free constraints including low pool usage and no parallel production migrations.

## Verification

Ran the required grep checks for `PRODUCTION_DATABASE_URL` in `.env.example`, `db:migrate:production` in the deployment runbook and `drizzle.config.ts`, verified `PRODUCTION_MIGRATION_CONFIRM` is documented, checked the docs do not instruct a `drizzle-kit push` command as the production flow, and ran `yarn check:language`. The first composite verifier failed only due to unsupported shell millisecond timing syntax after the checks had run; the portable rerun passed.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `grep -q "PRODUCTION_DATABASE_URL" .env.example && grep -q "db:migrate:production" docs/deploy/vercel-supabase-r2.md && grep -q "db:migrate:production" drizzle.config.ts && grep -q "PRODUCTION_MIGRATION_CONFIRM" docs/deploy/vercel-supabase-r2.md && ! grep -E "^\s*(yarn|npm|pnpm|npx)\s+.*drizzle-kit\s+push" docs/deploy/vercel-supabase-r2.md && yarn check:language` | 0 | ✅ pass | 531ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `.env.example`
- `drizzle.config.ts`
- `docs/deploy/vercel-supabase-r2.md`
