---
phase: "24"
plan: "01"
---

# T01: Added bounded runtime Postgres pool configuration for serverless deployments.

**Added bounded runtime Postgres pool configuration for serverless deployments.**

## What Happened

Extracted runtime Postgres pool configuration into `lib/db/config.ts` so pool parsing can be tested without constructing a real `pg.Pool`. The helper now defaults `DATABASE_POOL_MAX` to 2, clamps it at a conservative upper bound of 5, falls back safely for malformed, empty, zero, or negative values, and preserves the existing `DATABASE_SSL=true` strict TLS behavior. Updated `lib/db/index.ts` to construct the runtime pool from the helper instead of hard-coding `max: 10`. Added `.env.example` documentation for the optional pool knob, and added `tests/db-config.test.ts` to cover default, valid, malformed, zero/negative, too-large, SSL toggle, and secret-field behavior. Health endpoint code was intentionally left unchanged; existing health tests verify sanitized database failure codes remain the public readiness surface.

## Verification

`yarn vitest tests/db-config.test.ts` passed with 7 tests covering bounded env parsing and SSL behavior. `yarn vitest tests/health.test.ts` passed with 13 tests confirming `/api/health` still returns sanitized DB/R2 status without raw secrets. `yarn lint` exited 0; it reported 3 existing unused-variable warnings in unrelated tests. `yarn check:language` passed after adding English env documentation.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest tests/db-config.test.ts` | 0 | ✅ pass (7 tests) | 651ms |
| 2 | `yarn vitest tests/health.test.ts` | 0 | ✅ pass (13 tests) | 1530ms |
| 3 | `yarn lint` | 0 | ✅ pass (3 unrelated warnings) | 3538ms |
| 4 | `yarn check:language` | 0 | ✅ pass | 994ms |

## Deviations

Added `.env.example` documentation for `DATABASE_POOL_MAX` because the task called for a documented env knob, even though the expected-output list only named code and test files.

## Known Issues

`yarn lint` still reports 3 pre-existing unused-variable warnings in unrelated test files (`tests/import-format-wizard-actions.test.ts` and `tests/pattern-actions.test.ts`), but exits 0.

## Files Created/Modified

- `lib/db/config.ts`
- `lib/db/index.ts`
- `tests/db-config.test.ts`
- `.env.example`
