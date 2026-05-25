---
phase: "22"
plan: "04"
---

# T04: Added the `/dashboard/categories` server route with current-year OUT defaults, OUT/IN-only filters, Suspense loading states, and category ranking links.

**Added the `/dashboard/categories` server route with current-year OUT defaults, OUT/IN-only filters, Suspense loading states, and category ranking links.**

## What Happened

Created the `/dashboard/categories` page using Next.js 16 promise-based `searchParams`, parsed filters with `parseDashboardFilters(params, { defaultPreset: 'this-year' })`, and clamped the route-specific type to `out` unless the parsed value is `in` so the route never renders or queries the unsupported `all` mode. The page renders an Italian title/description, an OUT/IN-only `DashboardFilters` row with the categories default preset, and an async ranking section that fetches `getCategoryRanking(filters)` before rendering `CategoryRankingList` with the current `preset`, `type`, and `defaultPreset` for S03 detail links. Added a dedicated `CategoryRankingSkeleton` that matches the list shape without misleading chart labels. While verifying the production build, Next.js 16 reported that client components using `useSearchParams` must be within Suspense when the page shell can be prerendered, so the categories filter row and inherited dashboard tab nav are now wrapped in Suspense fallbacks. The existing tab nav prefix matching already keeps the Categories tab active for nested `/dashboard/categories/[id]` paths. Added a focused Playwright smoke test covering `/dashboard/categories?period=last-3-months&type=bogus`, visible OUT/IN controls, hidden `Tutti`, and fallback-to-OUT behavior.

## Verification

Verified with `yarn tsc --noEmit`, `yarn build`, focused Vitest dashboard filter tests, `yarn check:language`, a focused Playwright browser smoke for the categories route, and scoped ESLint for all touched files. A full-project `yarn lint` was also run and failed only on unrelated pre-existing files outside this task; scoped lint for the modified files passed.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn tsc --noEmit` | 0 | ✅ pass | 1494ms |
| 2 | `yarn build` | 0 | ✅ pass | 14384ms |
| 3 | `yarn vitest run tests/dashboard-filters.test.ts` | 0 | ✅ pass | 698ms |
| 4 | `yarn check:language` | 0 | ✅ pass | 666ms |
| 5 | `yarn playwright test tests/dashboard.spec.ts -g "categories route exposes"` | 0 | ✅ pass | 2552ms |
| 6 | `yarn eslint 'app/(app)/dashboard/categories/page.tsx' 'app/(app)/dashboard/layout.tsx' components/dashboard/category-ranking-skeleton.tsx tests/dashboard.spec.ts` | 0 | ✅ pass | 885ms |
| 7 | `yarn lint` | 1 | ⚠️ unrelated pre-existing lint findings outside touched files | 4165ms |

## Deviations

Wrapped `DashboardTabNav` in Suspense in the inherited dashboard layout because the new categories route made Next.js 16 prerender the shell and fail production build on `useSearchParams` without a Suspense boundary.

## Known Issues

Full-project `yarn lint` still fails on unrelated existing issues: `components/expenses/expense-transactions-dialog.tsx` has a `react-hooks/set-state-in-effect` error, and there are unused-variable warnings in `components/categories/category-settings-panel.tsx`, `components/import/import-table.tsx`, and `tests/pattern-actions.test.ts`.

## Files Created/Modified

- `app/(app)/dashboard/categories/page.tsx`
- `components/dashboard/category-ranking-skeleton.tsx`
- `app/(app)/dashboard/layout.tsx`
- `tests/dashboard.spec.ts`
