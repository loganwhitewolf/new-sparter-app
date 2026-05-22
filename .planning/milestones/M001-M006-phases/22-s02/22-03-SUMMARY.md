---
phase: "22"
plan: "03"
---

# T03: Added typed category ranking rows, robust SVG sparklines, and canonical category detail link helpers for `/dashboard/categories`.

**Added typed category ranking rows, robust SVG sparklines, and canonical category detail link helpers for `/dashboard/categories`.**

## What Happened

Created `CategorySparkline` as a client-side SVG primitive that accepts DAL sparkline points, colors itself by active dashboard type, and gracefully renders a baseline for empty/all-zero data. Created `CategoryRankingList` as a client component that renders ranked category rows with accessible detail links, formatted totals, movement counts, ranking percentage bars, truncation/title support for long category names, and an explicit empty state. Added route helpers in `lib/routes.ts` for `/dashboard/categories/[id]` and canonical detail href construction, then covered the detail href contract and component edge states with Vitest tests.

## Verification

Ran focused Vitest coverage for dashboard filters/routes and the new category ranking list, then ran the required task verification `yarn tsc --noEmit && yarn check:language`; both passed. Also ran the full Vitest suite: the new tests passed, but the suite still failed in unrelated existing profile, pattern, expense action, and import table tests; those failures do not touch the dashboard category ranking files added here.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest run tests/dashboard-filters.test.ts tests/category-ranking-list.test.tsx` | 0 | ✅ pass | 612ms |
| 2 | `yarn tsc --noEmit && yarn check:language` | 0 | ✅ pass | 3016ms |
| 3 | `yarn vitest run` | 1 | ⚠️ fail: unrelated existing suite failures; T03 tests passed | 1969ms |

## Deviations

No functional deviations. Added focused component/unit tests beyond the minimal task verification so the href and edge-state contracts are executable.

## Known Issues

Full `yarn vitest run` currently fails outside this task in `tests/profile-actions.test.ts`, `tests/pattern-actions.test.ts`, `tests/import-table-actions.test.tsx`, and `tests/expense-actions.test.ts`; dashboard DAL/filter/ranking tests pass.

## Files Created/Modified

- `components/dashboard/category-sparkline.tsx`
- `components/dashboard/category-ranking-list.tsx`
- `lib/routes.ts`
- `tests/category-ranking-list.test.tsx`
- `tests/dashboard-filters.test.ts`
