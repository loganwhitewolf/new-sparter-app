---
phase: "23"
plan: "03"
---

# T03: Wired the `/dashboard/categories/[id]` App Router detail page with safe ID/filter parsing, canonical back navigation, and category detail components.

**Wired the `/dashboard/categories/[id]` App Router detail page with safe ID/filter parsing, canonical back navigation, and category detail components.**

## What Happened

Added the dynamic category detail route under the existing dashboard layout using Next 16 promise-based `params` and `searchParams`. The page guards malformed/non-positive IDs, parses dashboard filters with the category default preset, clamps `type=all`/malformed types to OUT before calling the user-scoped DAL, renders OUT/IN-only filter controls, links back to the canonical categories list URL, and composes the T02 summary, trend, top transactions, subcategory breakdown, skeleton, and empty-state components. Added `buildDashboardCategoriesHref` to `lib/routes.ts` with the same canonical omission rules as detail hrefs, then extended dashboard filter/route tests for categories-list back href behavior and inbound `period` alias canonicalization.

## Verification

Ran the focused Vitest suites requested by the task, the project language convention check, focused ESLint on the touched files, the existing dashboard Playwright smoke test for tab/filter/category click-through behavior, and a Next production build to verify App Router page typing. A repository-wide `yarn lint` run still fails due an unrelated pre-existing `react-hooks/set-state-in-effect` error in `components/expenses/expense-transactions-dialog.tsx`; the files changed in this task pass focused ESLint.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest run tests/dashboard-filters.test.ts tests/category-detail-components.test.tsx` | 0 | ✅ pass | 699ms |
| 2 | `yarn check:language` | 0 | ✅ pass | 899ms |
| 3 | `yarn eslint 'app/(app)/dashboard/categories/[id]/page.tsx' lib/routes.ts tests/dashboard-filters.test.ts` | 0 | ✅ pass | 1563ms |
| 4 | `yarn playwright test tests/dashboard.spec.ts --project=chromium` | 0 | ✅ pass | 4999ms |
| 5 | `yarn build` | 0 | ✅ pass | 16283ms |
| 6 | `yarn lint` | 1 | ⚠️ unrelated existing failure outside touched files | 4691ms |

## Deviations

None.

## Known Issues

Repository-wide `yarn lint` currently fails outside this task in `components/expenses/expense-transactions-dialog.tsx` (`react-hooks/set-state-in-effect`) and reports unrelated unused-variable warnings in other files; focused lint for this task's files passes.

## Files Created/Modified

- `app/(app)/dashboard/categories/[id]/page.tsx`
- `lib/routes.ts`
- `tests/dashboard-filters.test.ts`
