---
phase: "22"
plan: "05"
---

# T05: Added route-level Playwright coverage for `/dashboard/categories` and completed S02 closeout verification.

**Added route-level Playwright coverage for `/dashboard/categories` and completed S02 closeout verification.**

## What Happened

Updated `tests/dashboard.spec.ts` so S02 browser checks navigate directly to `/dashboard/categories` instead of depending on the dashboard overview path. The new coverage verifies the categories route renders, the Categories navigation link is visible, OUT/IN filter tabs are exposed while `Tutti` is absent, malformed query params fail closed to the OUT view, selecting `Ultimi 3 mesi` writes `preset=last-3-months`, switching to `Entrate` writes `type=in`, and dashboard tab navigation preserves the canonical filter params. The row drill-down test is data-resilient: it accepts the empty state when no seeded ranking rows exist, otherwise it verifies the first category link points under `/dashboard/categories/`, preserves `preset`/`type`, and clicking it changes the URL. While running Playwright, two shared overview assertions proved stale rather than S02 regressions, so I tightened them to stable KPI test IDs and current trend-series controls.

## Verification

Ran focused Vitest for dashboard filters/DAL, TypeScript, production build, language convention check, and Playwright dashboard spec. Initial Playwright surfaced stale shared overview assertions; after fixing those test assertions, the dashboard spec passed and the full closeout command passed end-to-end.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest run tests/dashboard-filters.test.ts tests/dashboard-dal.test.ts` | 0 | ✅ pass | 797ms |
| 2 | `yarn tsc --noEmit` | 0 | ✅ pass | 1845ms |
| 3 | `yarn build` | 0 | ✅ pass | 15405ms |
| 4 | `yarn check:language` | 0 | ✅ pass | 507ms |
| 5 | `yarn playwright test tests/dashboard.spec.ts` | 1 | ❌ initial fail: stale shared overview assertions | 10707ms |
| 6 | `yarn playwright test tests/dashboard.spec.ts` | 0 | ✅ pass | 5530ms |
| 7 | `yarn vitest run tests/dashboard-filters.test.ts tests/dashboard-dal.test.ts && yarn tsc --noEmit && yarn build && yarn check:language && yarn playwright test tests/dashboard.spec.ts` | 0 | ✅ pass | 23942ms |

## Deviations

The task expected only S02 route-contract assertions, but shared overview Playwright assertions were updated because they failed during closeout: `Bilancio` was ambiguous and the old `Trend mensile` text no longer exists.

## Known Issues

One existing dashboard Playwright test remains intentionally skipped: `DASH-03 legend click toggles a series` is marked `test.fixme` for manual SVG visibility verification.

## Files Created/Modified

- `tests/dashboard.spec.ts`
