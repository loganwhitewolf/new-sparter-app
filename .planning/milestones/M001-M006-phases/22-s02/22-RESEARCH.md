# S02 Research: Categories Dashboard

## Summary

S02 is **targeted-to-deep research**: the route/layout pattern is already established by S01, but the data shape for a ranked categories view with per-row sparklines is new. The main implementation risk is not routing; it is getting a category-level monthly aggregate that preserves existing dashboard exclusion rules and works with the current `preset` query-param contract.

Recommended approach: add a dedicated category-ranking DAL shape in `lib/dal/dashboard.ts`, render a new `/dashboard/categories` server page with Suspense, and create a focused client list/sparkline UI instead of reusing the old accordion-style `CategoryBreakdownChart`.

## Requirements Owned / Supported

- **R031**: primary owner. `/dashboard/categories` must show ranked OUT categories for the default yearly period, each with total, count, and sparkline.
- **R035**: primary owner. Categories view needs an IN/OUT toggle, default OUT. Existing `DashboardTypeSchema` includes `all`, but S02 UI should expose only OUT/IN unless the requirement is explicitly changed.
- **R034**: supports. S01 made parsing route-aware, but S02 is the first route that can prove period persistence across dashboard tabs. Watch out: code currently uses `preset` as the search param, while milestone prose often says `period`.
- **R030**: advances. Adds the second dashboard route under the shared layout; full route suite waits for S03.
- **R032**: only establishes URL handoff. S02 should link category rows to `/dashboard/categories/[id]`; S03 will implement the destination content.

## Skill Discovery

Installed relevant skills from the prompt:

- `react-best-practices` — relevant for Next/React client/server component boundaries and chart components.
- `frontend-design` / `make-interfaces-feel-better` — potentially useful if the executor is asked to polish the category ranking UI.
- `accessibility` — relevant for tabs/toggle/list link semantics, but not required for research.

External skill search (`npx skills find`) found promising optional skills; do **not** install automatically:

- Next.js App Router: `npx skills add wshobson/agents@nextjs-app-router-patterns` (17.3K installs), `npx skills add wsimmonds/claude-nextjs-skills@nextjs-app-router-fundamentals` (2K installs).
- Drizzle: `npx skills add bobmatnyc/claude-mpm-skills@drizzle-orm` (4.3K installs), `npx skills add giuseppe-trisciuoglio/developer-kit@drizzle-orm-patterns` (851 installs).
- Recharts: `npx skills add ansanabria/skills@recharts` (520 installs), `npx skills add yonatangross/orchestkit@recharts-patterns` (82 installs).
- Decimal.js: no skills found.

## Next.js 16 Constraints Confirmed

Read local docs under `node_modules/next/dist/docs/` per project rules:

- `01-app/03-api-reference/03-file-conventions/page.md`: App Router page props `params` and `searchParams` are Promises in this Next version. New `app/(app)/dashboard/categories/page.tsx` should type `searchParams` as a Promise and await it, matching S01.
- `01-app/03-api-reference/03-file-conventions/layout.md`: layouts do not re-render on navigation and cannot safely read search params/pathname directly. S01 correctly keeps pathname handling in `DashboardTabNav` client component.
- `01-app/03-api-reference/04-functions/use-search-params.md`: client components using `useSearchParams()` should be under Suspense in static routes; current dashboard pages are dynamic due to awaited `searchParams` + authenticated DAL, but keep client filter/nav components small and page-level data in server components.

## Implementation Landscape

### Existing S01 route/layout files

- `app/(app)/dashboard/layout.tsx` renders `DashboardTabNav` above all children. S02 should create only `app/(app)/dashboard/categories/page.tsx`; it will inherit the layout automatically.
- `app/(app)/dashboard/overview/page.tsx` shows the current server page pattern: await `searchParams`, parse filters, render filter client component, then wrap async data sections in `<Suspense>` with skeletons.
- `app/(app)/dashboard/page.tsx` already redirects to `/dashboard/overview`.
- `components/dashboard/dashboard-tab-nav.tsx` currently links to bare `/dashboard/overview` and `/dashboard/categories`. **Important gap:** it does not preserve the current `preset` query param, so R034 cross-tab period persistence is not yet actually implemented.
- `lib/routes.ts` has `APP_ROUTES.dashboardCategories = '/dashboard/categories'`. It has no helper for `/dashboard/categories/[id]`; S02 should add one or construct links carefully in the component.

### Existing filters and query-param contract

- `lib/validations/dashboard.ts` exposes `parseDashboardFilters(input, { defaultPreset })`.
- The code’s current canonical query param is **`preset`**, not `period`:
  - `OverviewFilters` writes `preset=...`.
  - `DashboardFilters` writes `preset=...` and `type=...`.
  - `tests/dashboard.spec.ts` expects `preset=last-3-months`.
- Milestone prose says shared `?period=`, but S01 implementation chose `preset`. S02 should not silently introduce a second contract unless the task explicitly includes alias/migration work. If reconciling this, safest low-risk path is to make parsing accept `period` as an alias while keeping existing UI/tests on `preset`.
- `components/dashboard/dashboard-filters.tsx` is close but has two S02 blockers:
  1. It exposes `all`, but R035 asks for an IN/OUT toggle only.
  2. It deletes the `preset` param when selecting `last-month`. That is correct for overview’s default, but wrong on categories if default is `this-year`: selecting `last-month` would remove the param and the server would parse back to `this-year`. Fix by either creating a `CategoryFilters` component or making `DashboardFilters` accept `defaultPreset` and `typeOptions` props.

### Existing DAL patterns

- `lib/dal/dashboard.ts` is `server-only`, uses `cache()`, verifies auth via `verifySession()`, catches DB errors, and returns empty/zero data. New S02 DAL should follow that pattern.
- Existing helper predicates must be preserved:
  - `dateScopedTransactions(userId, from, to)` for user/date filter.
  - `expenseStatusIncludedInDashboardTotals()` includes statuses `['1', '2', '3']` and excludes ignored status `4`.
  - `notExcludedFromTotals()` filters `subCategory.excludeFromTotals`.
  - `ne(category.slug, 'ignore')` / `notIgnoredCategory()` excludes the system ignore category.
- Existing `getCategoriesBreakdown(filters)` aggregates totals by category/subcategory and already returns sorted percentages via `buildBreakdownData`, but it does **not** produce monthly sparkline buckets and it is designed for an expandable breakdown chart that S02 explicitly should not use.
- Existing `buildMonthlyTrendData` provides a useful zero-fill pattern with `monthsBetween(from, to)` and `monthLabel(month)`.
- Use Decimal.js utilities (`toDecimal`, `normalizeAmount`) for monetary normalization. Avoid JS floating point when summing or deriving display amounts in builders.

### Schema facts relevant to S02

From `lib/db/schema.ts`:

- `category`: `id`, nullable `userId`, `type` enum `in|out|system`, `name`, `slug`.
- `subCategory`: `id`, `categoryId`, `name`, `slug`, `excludeFromTotals`.
- `expense`: `id`, `userId`, `subCategoryId`, `status`, `totalAmount`, transaction counters/dates.
- `transaction`: `id`, `userId`, `expenseId`, `description`, `amount` numeric, `currency`, `occurredAt`.
- Indexed support exists for `transaction(userId, occurredAt)`, `transaction(expenseId)`, `expense(status)`, `expense(subCategoryId)`, and `subCategory(categoryId)`.

### Existing UI components

- `components/dashboard/category-breakdown-chart.tsx` is **not a good fit** for S02. It renders expandable category chips and a vertical percentage chart; D023 rejected inline accordions for the categories list. Use it only as reference for colors/empty copy.
- `components/dashboard/monthly-trend-chart.tsx` shows how the project wraps Recharts with `ChartContainer` and CSS variables (`--total-in`, `--total-out`).
- `components/ui/chart.tsx` supports `initialDimension` on `ChartContainer`, useful for small sparklines to avoid hydration/ResponsiveContainer size issues.
- `components/dashboard/breakdown-skeleton.tsx` can be reused or replaced with a more list-shaped skeleton.

## Recommended Data Design

Add a new S02-specific type and builder rather than overloading `BreakdownCategory`:

```ts
export type CategoryRankingSparklinePoint = {
  month: string
  label: string
  amount: string
}

export type CategoryRankingItem = {
  id: number
  name: string
  slug: string
  type: 'in' | 'out'
  count: number
  amount: string
  percentage: number
  sparkline: CategoryRankingSparklinePoint[]
}
```

Suggested DAL shape:

- `buildCategoryRankingData({ from, to, rows })` exported for Vitest coverage.
- `getCategoryRankingData(filters)` cached async DAL function.
- Query should group by `category.id` and month (`to_char(transaction.occurredAt, 'YYYY-MM')`) and filter `category.type` to `filters.type` (`in` or `out`). If `filters.type === 'all'` survives validation, either treat it as no filter internally or normalize categories page to never send it.
- Amount expression can use `coalesce(abs(sum(transaction.amount)), 0)::text` because filters split IN vs OUT at category type; this matches existing dashboard behavior. If there is any chance a category has mixed signs, `abs(sum(...))` can hide reversals; `sum(abs(transaction.amount))` would rank cash volume instead. Existing `getCategoriesBreakdown` uses `abs(sum(amount))`, so keep consistency unless changing deliberately.
- Builder should zero-fill each category’s sparkline over `monthsBetween(from, to)`, total count across months, normalized amount, and category percentage using `computeBreakdownPercentages`.
- Sort ranking by amount descending using Decimal comparison. Current `buildBreakdownData` does not explicitly sort; S02 must, because ranking is the core behavior.

## Recommended UI Design

New files:

- `app/(app)/dashboard/categories/page.tsx`
  - Await `searchParams`.
  - `parseDashboardFilters(params, { defaultPreset: 'this-year' })`.
  - Render title/subtitle, category filter component, and a Suspense-wrapped async content component.
- `components/dashboard/category-ranking-list.tsx`
  - Client or server component depending on sparkline choice. If using Recharts for each row, make it client.
  - Render accessible list of category rows, sorted already by DAL.
  - Row content: category link/name, count, formatted total, horizontal relative bar (percentage), sparkline.
  - Link target: `/dashboard/categories/${category.id}` and preserve `preset` + `type` params for S03 handoff.
- `components/dashboard/category-sparkline.tsx`
  - Client component using Recharts `LineChart`, `Line`, maybe `Tooltip` optional, small fixed dimensions via `ChartContainer initialDimension` or simple SVG.
  - Simpler alternative: hand-rolled SVG path from normalized values; avoids many Recharts instances if the category list grows. But milestone notes Recharts is acceptable because dependency already exists.
- `components/dashboard/category-filters.tsx` or update `dashboard-filters.tsx`
  - Prefer a new `CategoryFilters` or configurable `DashboardFilters` to avoid breaking overview behavior.
  - It should expose only `out`/`in` and know `defaultPreset='this-year'` so URL deletion logic is correct.
- Optional `components/dashboard/category-ranking-skeleton.tsx` if `BreakdownSkeleton` feels too generic.

Existing files to modify:

- `components/dashboard/dashboard-tab-nav.tsx`
  - Use `useSearchParams()` and preserve `preset` when building tab hrefs. Do not necessarily preserve `type` when going to overview; `type` is meaningless there. Preserve `type` when staying under categories if useful, but not required for cross-tab period acceptance.
- `lib/routes.ts`
  - Add a helper or constant convention for category detail links. Since `APP_ROUTES` is an object of constants, one option is `dashboardCategory: (id: string | number) => `${APP_ROUTES.dashboardCategories}/${id}``; verify TypeScript/language checks accept a function property.
- `lib/dal/dashboard.ts`
  - Add ranking types, builder, and `getCategoryRankingData`.
- `tests/dashboard-dal.test.ts`
  - Add builder tests for zero-filled monthly sparkline, sorted ranking, Decimal rounding, ignored/system rows skipped, and empty rows.
- `tests/dashboard.spec.ts`
  - Existing tests still open `/dashboard`; after S01 redirect they exercise overview. Add category-route tests only if seeded/staging data supports them, otherwise keep robust assertions around filters and empty state.

## Natural Seams for Planning

1. **Routing/filter seam**
   - Create `/dashboard/categories/page.tsx` with static empty/skeleton structure.
   - Add/fix category-aware filters and tab `preset` preservation.
   - This can be verified with TypeScript and Playwright URL assertions before DAL complexity.

2. **DAL seam**
   - Add exported `buildCategoryRankingData` and tests first.
   - Then add `getCategoryRankingData` query using existing predicates.
   - This is the highest correctness risk and should be test-first if possible.

3. **Presentation seam**
   - Build `CategoryRankingList` and `CategorySparkline` against typed fixture data.
   - Wire the page to DAL.
   - Empty state should be rendered by the list component when `data.length === 0`.

4. **Navigation handoff seam**
   - Row link preserves `preset` and `type` for S03: `/dashboard/categories/[id]?preset=X&type=Y`.
   - Since S03 route does not exist yet, S02 can only prove the URL changes or the link has the correct href; full content waits for S03.

## First Proof

The first proof should be the filter/routing contract because it can expose S01 assumptions quickly:

1. Add a minimal `/dashboard/categories/page.tsx` that parses with `{ defaultPreset: 'this-year' }` and renders current `preset`/`type` in temporary or final UI.
2. Fix category filter default handling so selecting `last-month` on categories writes `preset=last-month` instead of deleting it.
3. Fix `DashboardTabNav` so moving from `/dashboard/overview?preset=last-3-months` to Categories lands on `/dashboard/categories?preset=last-3-months`.
4. Run `yarn tsc --noEmit` and targeted Playwright/browser check if available.

After that, implement DAL and UI knowing the route state is stable.

## Risks and Watch-outs

- **`preset` vs `period` mismatch:** milestone prose says `period`; code/tests say `preset`. Do not mix both accidentally. If adding alias support, add tests.
- **Default deletion bug:** current filter components delete `preset` for `last-month`; categories default is `this-year`, so this logic must be route-aware.
- **`all` type leakage:** `DashboardTypeSchema` allows `all`; categories acceptance asks only IN/OUT. UI should not expose `all` for S02.
- **Ranking sort:** existing breakdown builder does not guarantee amount-desc sorting. S02 must sort explicitly.
- **Sparkline performance:** one Recharts chart per row is easy but can be heavy. If data can include many categories, consider simple SVG sparklines or cap chart rendering to visible rows. No new dependency allowed.
- **Ignored/excluded rules:** preserve status/category/subcategory exclusion logic from dashboard DAL and memory MEM074. Do not count `category.slug='ignore'`, expense status `4`, or `excludeFromTotals` subcategories.
- **Suspense with client hooks:** `useSearchParams`/`usePathname` remain in client components. Page data fetching should stay server-side from `searchParams` props.
- **Language check:** route segments, identifiers, filenames, comments, and test names must be English. Italian is allowed for user-facing UI copy such as `Categorie`, `Uscite`, `Entrate`, empty-state text.

## Verification Plan

Targeted unit tests:

- `yarn vitest tests/dashboard-dal.test.ts` (or project’s Vitest invocation) after adding builder tests.
- Tests to add:
  - `parseDashboardFilters` default-preset behavior if filter parsing is touched.
  - category ranking builder zero-fills all months from `from` to `to`.
  - ranks categories by Decimal amount descending.
  - computes percentages from absolute amounts.
  - skips null/system/ignore rows.

Repository checks before completing S02:

- `yarn tsc --noEmit`
- `yarn build`
- `yarn check:language`

Manual/browser verification:

- Visit `/dashboard/categories` and confirm default UI corresponds to `this-year` + OUT.
- Change period to `last-3-months`; URL should include `preset=last-3-months`, and list should update.
- Switch OUT/IN; URL should set/delete `type` consistently (`out` can be omitted, `in` must be present).
- From overview with a non-default preset, click the Categorie tab and confirm the preset survives.
- Click a category row and confirm href/URL becomes `/dashboard/categories/[id]` with current `preset` and `type`.
- Empty data should render a friendly empty state without throwing.

## Sources / Research Artifacts

- Memory query: MEM074 (dashboard exclusion predicates), MEM156 (shared preset search param/defaults), MEM157 (bar chart + sparkline decision), MEM154 (route structure).
- Code scans saved in `.gsd/exec/aeebe307-32e9-460d-ac12-0918e7bc2fc1.stdout`, `.gsd/exec/b84034fe-2de6-4251-a22f-4d5f3e00791c.stdout`, `.gsd/exec/91a253f4-dd79-4544-a7d4-1db98ca47f79.stdout`, `.gsd/exec/c54215fa-d0bf-4903-9831-ac6a78b5403c.stdout`.
- Skill discovery saved in `.gsd/exec/0f5b38c3-22f5-46cb-b598-1edd922bf9e3.stdout`.
- Local Next docs read: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`, `layout.md`, `04-functions/use-search-params.md`.
