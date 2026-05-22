# S03 Research — Category Drill-Down

## Summary

S03 is a targeted implementation slice: the dashboard route/nav/filter foundations and the categories list handoff already exist from S01/S02. The missing work is the dynamic route `app/(app)/dashboard/categories/[id]/page.tsx`, single-category DAL aggregation, and focused presentational components for trend, top transactions, subcategory breakdown, summary stats, back link, loading, and empty states.

Main constraint: preserve the S02 URL contract exactly: `/dashboard/categories/[id]?preset=X&type=Y`, with canonical `preset`, `period` only as a parser alias, default `preset=this-year`, and categories-only type clamp to `out | in` (never `all`). Next.js 16 dynamic page props are promise-based (`params: Promise<{ id: string }>` and `searchParams: Promise<...>`), per local docs.

## Active Requirements / Contracts

- R030 support: add the deep-linkable `/dashboard/categories/[id]` route under the existing dashboard layout/tab suite.
- R032 owned: establish and consume the category detail handoff contract from S02 list rows.
- R034 support: detail route must keep canonical `preset` and `type` query params through back/tab navigation.
- R035 support: detail view should be OUT/IN scoped by `type`; malformed type must fall back safely to `out`, with no `all` UI.

## Existing Implementation Landscape

### Routing and filters

- `app/(app)/dashboard/layout.tsx` already wraps all dashboard children with `DashboardTabNav` in `Suspense` for Next 16 `useSearchParams` compatibility.
- `app/(app)/dashboard/categories/page.tsx` defines the correct pattern for this slice:
  - `CATEGORIES_DEFAULT_PRESET = 'this-year'`
  - parse `searchParams` with `parseDashboardFilters(params, { defaultPreset: 'this-year' })`
  - clamp `filters.type === 'in' ? 'in' : 'out'`
  - render `DashboardFilters` with only `Uscite` and `Entrate` options.
- `lib/validations/dashboard.ts` already accepts `preset` canonically and `period` as alias only when `preset` is absent.
- `components/dashboard/dashboard-tab-nav.tsx` preserves only `preset` and `type` across dashboard tab links.
- `lib/routes.ts` already has:
  - `dashboardCategoryDetail(id)`
  - `buildDashboardCategoryDetailHref(id, { preset, type, defaultPreset })`, which omits default `this-year` and default `out`, but preserves non-default preset and `type=in`.

### DAL and data rules

- `lib/dal/dashboard.ts` is the correct place for all new query functions (`server-only`, cached async DAL, `verifySession`, Drizzle, Decimal normalization).
- Existing dashboard aggregation helpers to reuse:
  - `dashboardPresetToDateRange`, `monthsBetween`, `monthLabel`
  - `DASHBOARD_TOTAL_EXPENSE_STATUSES = ['1', '2', '3']`; status `4` must stay excluded.
  - `dateScopedTransactions(userId, from, to)` pattern, currently private.
  - `expenseStatusIncludedInDashboardTotals()` pattern, currently private.
  - `notExcludedFromTotals()` exported helper for `subCategory.excludeFromTotals` null/false rule.
  - category exclusion rules: skip `category.slug === 'ignore'` and `category.type === 'system'`.
- Existing S02 builder `buildCategoryRankingData()` shows the expected pure-builder style: normalize Decimal amounts, skip malformed/system/ignored rows, zero-fill month buckets, sort deterministically, and catch DAL errors to return empty arrays.

### Schema facts for S03 queries

- `category`: `id`, `name`, `slug`, `type`, `userId`, `isActive`.
- `sub_category`: `id`, `name`, `slug`, `categoryId`, `excludeFromTotals`, `userId`, `isActive`.
- `expense`: `id`, `title`, `subCategoryId`, `status`, `userId`, aggregate metadata.
- `transaction`: `id`, `description`, `customTitle`, `amount`, `currency`, `occurredAt`, `expenseId`, `userId`.
- Top transaction display should prefer `transaction.customTitle ?? transaction.description`, date = `occurredAt`, amount = `abs(transaction.amount)` for display/ranking while retaining `currency` if useful.

### UI patterns already present

- `components/dashboard/monthly-trend-chart.tsx` uses Recharts via `ChartContainer`, `ChartTooltip`, etc. It is broader than S03 needs but provides the local chart pattern.
- `components/dashboard/category-breakdown-chart.tsx` provides percentage bar/list patterns but is category-wide and interactive accordion-focused; S03 likely wants a simpler subcategory-only breakdown list/bar.
- `components/dashboard/category-ranking-list.tsx` has the empty-state and accessible link style to match.
- Existing skeletons: `TrendSkeleton`, `BreakdownSkeleton`, `CategoryRankingSkeleton`, `OverviewSkeleton`; S03 may reuse `TrendSkeleton` and add a compact detail skeleton if needed.

## Recommendation

Implement S03 as a small set of new pure DAL builders plus a server page shell:

1. Add typed DAL functions in `lib/dal/dashboard.ts`:
   - `getCategoryDetail(categoryId: number, filters: DashboardFilters)` returning one composed object, or separate cached functions if easier.
   - Suggested output shape:
     ```ts
     type CategoryDetailData = {
       category: { id: number; name: string; slug: string; type: 'in' | 'out' } | null
       summary: { total: string; count: number; average: string }
       trend: Array<{ month: string; label: string; amount: string }>
       topTransactions: Array<{ id: string; title: string; date: Date; amount: string; currency: string }>
       subcategories: Array<{ id: number; name: string; slug: string; count: number; amount: string; percentage: number }>
     }
     ```
   - Keep pure builder(s) exported for Vitest, mirroring S02.
2. Create `app/(app)/dashboard/categories/[id]/page.tsx`:
   - parse `params.id` with `Number`/integer guard; invalid IDs should render empty state rather than throw or 404.
   - parse filters with S02 defaults and clamp type to `in | out`.
   - include title, description, `DashboardFilters`, back link to `/dashboard/categories` preserving non-default `preset` and `type=in`, and Suspense-wrapped detail content.
3. Add presentational components under `components/dashboard/`, likely:
   - `category-detail-summary.tsx`
   - `category-detail-trend-chart.tsx`
   - `category-top-transactions.tsx`
   - `category-subcategory-breakdown.tsx`
   - optionally `category-detail-skeleton.tsx` and `category-detail-empty-state.tsx`.
4. Keep UI copy Italian (user-facing), but all filenames/types/tests/comments in English per project convention.

## Query / Builder Notes

- One composed DAL can run three queries in parallel after session + date range:
  1. Category metadata/summary + trend grouped by month for `category.id = categoryId` and `category.type = filters.type`.
  2. Subcategory grouped totals for the same category and date range.
  3. Top transactions ordered by `abs(transaction.amount)` desc, limited to 5.
- Add user-safety around category metadata: do not fetch arbitrary category names by `category.id` alone. Either derive category metadata only through rows scoped by `transaction.userId = userId`, or constrain metadata to `category.isActive = true` and `(category.userId IS NULL OR category.userId = userId)`. This avoids leaking another user-owned category name for an invalid/foreign ID.
- For the drill-down, use `innerJoin` through transaction → expense → subCategory → category, as in S02. Include:
  - `dateScopedTransactions(userId, from, to)`
  - `expenseStatusIncludedInDashboardTotals()`
  - `ne(category.slug, 'ignore')`
  - `ne(category.type, 'system')`
  - `notExcludedFromTotals()`
  - `eq(category.id, categoryId)`
  - `eq(category.type, filters.type)` to make type-mismatched URLs empty/fail-closed.
- Trend should zero-fill `monthsBetween(from, to)`. For `this-year`, this yields current year to current month (not necessarily 12 unless now is December); this matches existing dashboard preset semantics. The milestone wording says 12-point monthly trend, but S02/S01 preset semantics and R034 are stronger; planner should not invent a new fixed-12 range unless explicitly replanning.
- Top transactions should sort by `abs(amount)` and apply `.limit(5)`. Use `abs(${transactionTable.amount})` in SQL and normalize in TS.
- Average = `total / count`, Decimal-based, `0.00` when count is 0.
- Catch query errors and return empty/zero detail data, consistent with existing dashboard DAL.

## Natural Seams for Planning

1. **DAL builders and unit tests first**
   - Files: `lib/dal/dashboard.ts`, `tests/dashboard-dal.test.ts`.
   - Add pure builders for trend zero-fill, subcategory percentages, summary average, top transaction normalization/sorting if sorting is not fully SQL-owned.
   - This is the highest-risk data contract and can be proved without Next/browser.
2. **Route and URL contract**
   - Files: `app/(app)/dashboard/categories/[id]/page.tsx`, `lib/routes.ts`, `tests/dashboard-filters.test.ts`.
   - Add a back-link helper if needed, e.g. `buildDashboardCategoriesHref({ preset, type, defaultPreset })` using the same omission rules as detail links.
3. **Presentation components**
   - Files: new `components/dashboard/category-detail-*.tsx`, possibly reuse `TrendSkeleton`.
   - Components can be tested with `renderToStaticMarkup` like `tests/category-ranking-list.test.tsx`.
4. **Browser smoke**
   - File: `tests/dashboard.spec.ts`.
   - Extend existing DASH-02 click-through test or add DASH-04 detail route test for heading/filters/back link/empty state.

## First Proof

Start with `tests/dashboard-dal.test.ts` additions for the new builders. Prove:

- malformed/null/system/ignored/category-mismatched rows are skipped.
- monthly trend is zero-filled and Decimal-normalized.
- subcategory percentages are based on amount, not count.
- summary total/count/average is correct for non-empty and empty rows.
- top transactions normalize amount to absolute, prefer `customTitle` over `description`, and preserve date/currency.

This proof blocks the rest because UI correctness depends on the DAL shape; it also protects against the subtle category exclusion/status/excludeFromTotals rules captured in MEM074.

## Risks / Watch-outs

- **Potential privacy leak:** fetching category header by ID without user/global constraint can reveal another user's category name. Constrain by ownership/global visibility or derive from user-scoped transaction rows.
- **`type=all` parser behavior:** `parseDashboardFilters` still accepts `all`; detail route must clamp to `out` unless raw type is exactly `in`, same as S02 categories page.
- **Canonical param drift:** do not switch generated URLs to `period`; `preset` is canonical per D025/S02. `period` remains an accepted inbound alias only.
- **Suspense/client hook issue:** any component using `useSearchParams` must be under Suspense; reusing `DashboardFilters` under Suspense follows S02.
- **Decimal math:** do not use JS number arithmetic for monetary totals/averages except final chart rendering; use Decimal helpers in DAL/builders.
- **Language check:** developer-facing files/tests/comments must be English; user-facing UI copy can remain Italian.

## Verification Plan

Run targeted then full closeout:

```bash
yarn vitest run tests/dashboard-dal.test.ts tests/dashboard-filters.test.ts tests/category-ranking-list.test.tsx
yarn tsc --noEmit
yarn build
yarn check:language
yarn playwright test tests/dashboard.spec.ts
```

Recommended Playwright assertions:

- `/dashboard/categories/[id]?preset=last-3-months&type=in` renders dashboard tab nav and detail shell or empty state without uncaught errors.
- Back link returns to `/dashboard/categories?preset=last-3-months&type=in`.
- malformed `/dashboard/categories/not-a-number?preset=bad&type=all` falls back safely and shows empty state/no crash.
- Click-through from the categories list still lands on detail URL preserving non-default query params (existing S02 test already clicks; extend to assert detail content/empty state).

## Skill Discovery

Installed relevant skills from the prompt:

- `react-best-practices` — relevant for Next/React component implementation and avoiding client/server boundary mistakes.
- `test` / `tdd` — relevant for the DAL-first proof and Playwright smoke additions.
- `accessibility` — relevant if polishing chart/list semantics, but not required for initial implementation.

External skills discovered (do not install automatically):

- Recharts: `npx skills add ansanabria/skills@recharts` (520 installs) — promising if the executor needs deeper Recharts guidance for the category detail trend chart.
- Drizzle ORM: `npx skills add bobmatnyc/claude-mpm-skills@drizzle-orm` (4.3K installs) — promising for query-shaping help, though current local DAL patterns are sufficient.

## Sources Read

- `.gsd/milestones/M006/M006-ROADMAP.md` and `M006-CONTEXT.md` (preloaded)
- `.gsd/milestones/M006/slices/S02/S02-SUMMARY.md` (preloaded)
- `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`
- `app/(app)/dashboard/layout.tsx`
- `app/(app)/dashboard/categories/page.tsx`
- `app/(app)/dashboard/overview/page.tsx`
- `lib/dal/dashboard.ts`
- `lib/validations/dashboard.ts`
- `lib/routes.ts`
- `lib/utils/date.ts`
- `lib/db/schema.ts`
- `lib/dal/categories.ts`
- `components/dashboard/category-ranking-list.tsx`
- `components/dashboard/monthly-trend-chart.tsx`
- `components/dashboard/category-breakdown-chart.tsx`
- `tests/dashboard-dal.test.ts`
- `tests/category-ranking-list.test.tsx`
- `tests/dashboard.spec.ts`
- `package.json`
