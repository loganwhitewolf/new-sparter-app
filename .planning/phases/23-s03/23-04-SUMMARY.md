---
phase: "23"
plan: "04"
---

# T04: Added Playwright smoke coverage for category drill-down navigation, malformed detail parameters, canonical query preservation, and no-crash rendering.

**Added Playwright smoke coverage for category drill-down navigation, malformed detail parameters, canonical query preservation, and no-crash rendering.**

## What Happened

Extended `tests/dashboard.spec.ts` with reusable dashboard navigation/page-error helpers, a category detail smoke test that starts from the categories list and clicks the first available category when seeded data exists (falling back to a deterministic detail URL when the list is empty), and a malformed detail-route smoke test. The new coverage verifies dashboard tab presence, active nested category navigation, canonical `preset`/`type` preservation in dashboard tab and back links, IN/OUT-only filter behavior, explicit empty/detail rendering, and absence of uncaught page errors. One initial targeted run exposed an ambiguous `Categorie` locator on the detail route because the back link also contains that accessible name; the test was tightened with `exact: true` for the dashboard tab link and then passed.

## Verification

Targeted Playwright coverage passed after the locator fix (`yarn playwright test tests/dashboard.spec.ts`: 8 passed, 1 existing skipped). Full closeout passed with DAL/filter/component tests, TypeScript, production build, language check, and dashboard Playwright smoke coverage via `yarn vitest run tests/dashboard-dal.test.ts tests/dashboard-filters.test.ts tests/category-detail-components.test.tsx && yarn tsc --noEmit && yarn build && yarn check:language && yarn playwright test tests/dashboard.spec.ts`.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn playwright test tests/dashboard.spec.ts` | 1 | ❌ fail — new detail assertions exposed an ambiguous `Categorie` locator on nested route | 7733ms |
| 2 | `yarn playwright test tests/dashboard.spec.ts` | 0 | ✅ pass — 8 passed, 1 existing skipped | 5327ms |
| 3 | `yarn vitest run tests/dashboard-dal.test.ts tests/dashboard-filters.test.ts tests/category-detail-components.test.tsx && yarn tsc --noEmit && yarn build && yarn check:language && yarn playwright test tests/dashboard.spec.ts` | 0 | ✅ pass — full S03 closeout command set passed | 26567ms |

## Deviations

None.

## Known Issues

Existing DASH-03 legend-toggle Playwright test remains marked `fixme` as pre-existing manual visual verification.

## Files Created/Modified

- `tests/dashboard.spec.ts`
