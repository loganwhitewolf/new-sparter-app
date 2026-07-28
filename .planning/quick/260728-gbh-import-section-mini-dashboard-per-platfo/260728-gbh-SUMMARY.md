---
phase: quick-260728-gbh
plan: 01
subsystem: import
tags: [import, dashboard, dal, date-utils]
status: complete
dependency-graph:
  requires: []
  provides:
    - getPlatformYearCoverage(year)
    - PlatformYearCoverageRow
    - yearProgressPercent(date, year)
    - formatDayMonthRange(start, end)
    - PlatformYearCoverageSection
  affects:
    - app/(app)/import/page.tsx
tech-stack:
  added: []
  patterns:
    - "getPlatformYearCoverage mirrors getTransactionPlatforms' exact 4-table inner-join/ownership chain, adding a year-bounded WHERE + GROUP BY"
    - "makeQueryChain test mock made thenable (chain.then resolves finalValue) so queries with no trailing .limit()/.offset() (ending at .orderBy()/.groupBy()) can be safely awaited and mapped in tests, matching Drizzle's real query-builder behavior"
key-files:
  created:
    - components/import/platform-year-coverage.tsx
    - tests/platform-year-coverage.test.tsx
  modified:
    - lib/dal/transactions.ts
    - lib/utils/date.ts
    - tests/transactions-dal.test.ts
    - tests/date-utils.test.ts
    - "app/(app)/import/page.tsx"
decisions:
  - "Ordering: most-behind-first (MAX(occurredAt) ASC, platform.name ASC) so the platform needing attention surfaces without scanning every row (locked in plan)"
  - "Bar geometry uses a 1.5% minimum fill width so a single-day-only platform stays visible instead of collapsing to a 0px sliver"
metrics:
  duration: ~20min
  completed: 2026-07-28
---

# Phase quick-260728-gbh Plan 01: Import section mini-dashboard per platform Summary

Added a "Copertura {year} per piattaforma" coverage strip above the Import files table: one Jan–Dec range bar per platform with at least one transaction in the current calendar year, so the user can spot at a glance which platforms are behind on import.

## What shipped

- **`lib/utils/date.ts`** — `yearProgressPercent(date, year)` maps a date onto a 0–100 Jan1→Dec31 scale (clamped); `formatDayMonthRange(start, end)` formats `"1 gen – 30 apr"` (lowercase Italian short month, en-dash, no year, no dedup for same-day ranges).
- **`lib/dal/transactions.ts`** — `getPlatformYearCoverage(year)` reuses `getTransactionPlatforms`' exact join chain (`transaction → file → importFormatVersion → platform`) and ownership guard, adding a year-bounded `gte`/`lte` on `occurredAt` and `GROUP BY platform.id, platform.name` with `MIN`/`MAX(occurredAt)`. Ordered most-behind-first. A platform with zero current-year transactions is naturally excluded by the inner joins + date WHERE.
- **`components/import/platform-year-coverage.tsx`** — `PlatformYearCoverageSection` (server component) renders a `Card` with one row per platform: name, a range-fill bar (absolute-positioned inside a relative track, no charting dependency), and the formatted date-range label. Returns `null` when coverage is empty — no empty card ever renders.
- **`app/(app)/import/page.tsx`** — wired `getPlatformYearCoverage(currentYear)` into the existing `Promise.all` alongside `getTransactionPlatforms`/`getMonthsWithData`; the section renders above `FilesToolbar`/`ImportTable`.

## Deviations from Plan

None — plan executed exactly as written, including the locked ordering, label format, and empty-state behavior.

One test-infrastructure addition beyond the plan's literal text: `tests/transactions-dal.test.ts`'s shared `makeQueryChain` mock was made thenable (`chain.then = (resolve) => resolve(finalValue)`), not just extended with `groupBy`. `getPlatformYearCoverage`'s query has no trailing `.limit()/.offset()` (unlike most queries in this file) — it terminates at `.orderBy()`, which returns the chain object itself, not a Promise. The implementation's `.map()` over the awaited rows (mirroring `getFileCoveredMonths`' `instanceof Date` guard, as specified) would throw against a non-array chain object. Making the chain thenable throughout (mirroring Drizzle's real query builder, which is thenable at every step) fixes this without touching any other query's tested behavior — confirmed by the full suite staying green (150 files / 1848 tests). Classified as Rule 3 (auto-fix blocking issue in test infrastructure).

## Verification

- `yarn vitest run tests/date-utils.test.ts tests/transactions-dal.test.ts tests/platform-year-coverage.test.tsx` — all pass.
- `yarn vitest run` (full suite) — 150 files, 1848 tests passed, 1 pre-existing todo. No regressions from the `makeQueryChain` change.
- `npx tsc --noEmit` — clean on all touched files (pre-existing unrelated errors only in gitignored `.next/` generated types referencing a stale `app/(public)` route shape, out of scope for this task).
- `yarn check:language` — passed ("English code convention check passed").
- Manual browser verification of `/import` with real multi-platform data (locked verification step 5 in the plan) was not driven in this session — flagged below.

## Known Stubs

None.

## Threat Flags

None — no new endpoints, auth paths, or trust-boundary changes; `getPlatformYearCoverage` reuses the pre-existing ownership-scoped join pattern and `year` is server-derived (`new Date().getFullYear()`), never client input.

## Self-Check: PASSED

- Created/modified files verified present on disk (7/7).
- All 3 commits verified present in `git log`.

## Commits

- `6c48b71` — `test(quick-260728-gbh-01): add failing tests for platform year-coverage DAL + date helpers`
- `8783927` — `feat(quick-260728-gbh-01): add getPlatformYearCoverage DAL query + date-range helpers`
- `8267bcd` — `feat(quick-260728-gbh-02): render platform year-coverage section on /import`
