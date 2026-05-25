---
phase: "05"
plan: "06"
---

# T06: Rewired dashboard KPI, breakdown, and trend data to transaction amounts with Decimal-safe tests and safe empty fallbacks.

**Rewired dashboard KPI, breakdown, and trend data to transaction amounts with Decimal-safe tests and safe empty fallbacks.**

## What Happened

Updated `lib/dal/dashboard.ts` so overview totals, category breakdowns, and monthly trend buckets aggregate from imported `transaction.amount` rows through expense/category joins with user and date scoping. Preserved dashboard DTO shapes and string monetary outputs, excluded the `ignore` category from monetary totals/breakdowns, retained uncategorized/ignored counts, and added safe zero/empty fallbacks when DB aggregate queries fail so the dashboard route does not crash in unavailable-db smoke environments. Updated `lib/utils/dashboard.ts` so breakdown percentages are amount-weighted rather than count-weighted. Added `tests/dashboard-dal.test.ts` to pin Decimal string formatting, zero-state behavior, amount-weighted breakdown percentages, ignore/system exclusion, and zero-filled monthly buckets. Local reality differed from the plan: there is no `tests/import-service.test.ts` or `tests/import.spec.ts`; the import verification was adapted to the existing tracked import unit suites (`tests/import-api.test.ts`, `tests/import-detector.test.ts`, `tests/import-utils.test.ts`).

## Verification

Fresh verification after the last code change: `npx vitest run tests/dashboard-dal.test.ts --reporter=verbose && npm run build` passed with 4 dashboard DAL tests and a successful Next.js production build. Earlier full scoped Vitest for dashboard plus existing import suites passed 39 tests. `npx playwright test tests/dashboard.spec.ts --reporter=list` was attempted twice; the first run exposed ECONNREFUSED DB crashes and drove the safe-fallback fix, while the final run hit the 240s command timeout without pass output, so it is recorded as unresolved. `tests/import.spec.ts` is absent locally, so the planned import Playwright check could not be run.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx vitest run tests/dashboard-dal.test.ts tests/import-api.test.ts tests/import-detector.test.ts tests/import-utils.test.ts --reporter=verbose` | 0 | ✅ pass | 1830ms |
| 2 | `npx vitest run tests/dashboard-dal.test.ts --reporter=verbose && npm run build` | 0 | ✅ pass | 73100ms |
| 3 | `test -e tests/import.spec.ts` | 1 | ❌ fail | 10ms |
| 4 | `npx playwright test tests/dashboard.spec.ts --reporter=list` | 124 | ❌ fail | 240000ms |

## Deviations

Adapted stale verification paths: `tests/import-service.test.ts` and `tests/import.spec.ts` do not exist locally, so existing import Vitest suites were used. Added pure exported dashboard row-mapping helpers to test amount behavior without a live DB seam. Added safe DB aggregate fallbacks required by the task's Failure Modes section after Playwright exposed route crashes when the DB was unavailable.

## Known Issues

Dashboard Playwright did not produce a passing result within the command timeout after the final fix; it should be rerun with the local web server/database test environment stabilized. No tracked `tests/import.spec.ts` exists, so import UI smoke coverage remains absent from this checkout.

## Files Created/Modified

- `lib/dal/dashboard.ts`
- `lib/utils/dashboard.ts`
- `tests/dashboard-dal.test.ts`
