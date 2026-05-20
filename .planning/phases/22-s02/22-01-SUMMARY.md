---
phase: "22"
plan: "01"
---

# T01: Locked the dashboard filter URL contract around canonical `preset`, safe parser fallbacks, and tab-link preservation for `preset`/`type`.

**Locked the dashboard filter URL contract around canonical `preset`, safe parser fallbacks, and tab-link preservation for `preset`/`type`.**

## What Happened

Added focused Vitest coverage for the dashboard filter parser and tab href builder before changing implementation. Updated `parseDashboardFilters` to accept `period` as a non-returned alias when `preset` is absent, keep `preset` as canonical, honor caller-provided default presets such as categories' `this-year`, and fail closed to deterministic defaults for malformed preset/type/array values. Updated `DashboardTabNav` to read current search params in the client component and build tab links that carry only `preset` and `type`, dropping unrelated params. Extended `DashboardFilters` with caller-configurable `defaultPreset` and type option lists so the future categories route can default to `this-year` and restrict choices to OUT/IN while overview remains preset-only and defaults to `last-month`. Adjusted the Playwright dashboard URL-contract check to assert preserved tab hrefs from a URL containing `preset=last-3-months&type=in` without relying on overview exposing type tabs.

## Verification

Verified parser and tab href behavior with `yarn vitest run tests/dashboard-filters.test.ts` as part of the required combined command; verified TypeScript with `yarn tsc --noEmit`; verified the project language convention with `yarn check:language`; and exercised the real dashboard browser flow with Playwright by asserting Overview/Categorie tab links preserve only `preset` and `type` while dropping an unrelated `page` param. An initial Playwright attempt against the old DASH-02 test failed because overview no longer renders type tabs, which confirmed the test needed to target tab-link preservation rather than a nonexistent overview type selector.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest run tests/dashboard-filters.test.ts && yarn tsc --noEmit && yarn check:language` | 0 | ✅ pass | 2938ms |
| 2 | `yarn playwright test tests/dashboard.spec.ts -g "DASH-02 tab links preserve"` | 0 | ✅ pass | 1373ms |

## Deviations

Updated the existing Playwright DASH-02 URL-contract test to assert tab-link preservation from URL state instead of clicking a type tab on overview, because overview intentionally remains preset-only.

## Known Issues

None.

## Files Created/Modified

- `lib/validations/dashboard.ts`
- `components/dashboard/dashboard-tab-nav.tsx`
- `components/dashboard/dashboard-filters.tsx`
- `tests/dashboard-filters.test.ts`
- `tests/dashboard.spec.ts`
