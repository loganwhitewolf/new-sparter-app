---
phase: 29-dashboard-intelligence
plan: 04
status: complete
---

# Plan 29-04 Summary

## What was built

All four tasks of Plan 29-04 completed end-to-end:

**Task 1** — `sort` query param plumbed through the stack:
- `lib/validations/dashboard.ts`: `DashboardSortSchema = z.enum(['deviation', 'amount'])`, `DashboardSort` type; `parseDashboardFilters` now accepts `sort` input and `options.defaultSort`, falls back gracefully on malformed values
- `lib/routes.ts`: `DashboardCategoryFilters` extended with `sort?` and `defaultSort?`; both builders (`buildDashboardCategoriesHref`, `buildDashboardCategoryDetailHref`) omit `sort` from the URL when it equals `defaultSort`
- `components/dashboard/dashboard-tab-nav.tsx`: `'sort'` added to preserved params whitelist

**Task 2** — `CategoryRankingList` extended with `deviations` and `sort` props, `DeviationBadge` rendered per row. Sort algorithm: bucket 0 (numeric deviation: sorted by `Math.abs(deviation)` desc) → bucket 1 ('new' items) → bucket 2 (null/missing), tiebroken by `toDecimal(b.amount).comparedTo(toDecimal(a.amount))`.

**Task 3** — `CategorySubcategoryBreakdown` extended with `deviations` prop, `DeviationBadge` rendered per subcategory row.

**Task 4** — Both category pages wired:
- `categories/page.tsx`: `CATEGORIES_DEFAULT_SORT = 'deviation'`; `parseCategoryDashboardFilters` passes `defaultSort`; `CategoryRankingContent` fetches `getCategoryDeviations({ type })` in parallel with ranking data; `SortToggle` component renders "Deviazione" / "Importo" links, preserving `preset` and `type`
- `categories/[id]/page.tsx`: `CategoryDetailContent` fetches `getCategoryDeviations({ type, categoryId })` in parallel with `getCategoryDetail`; passes `deviations` to `CategorySubcategoryBreakdown`

## Sort param contract

| Page | Default sort | URL when default | URL when non-default |
|------|-------------|-----------------|---------------------|
| `/dashboard/categories` | `deviation` | omitted | `?sort=amount` |
| `/dashboard/categories/[id]` | `amount` (inherited from `parseDashboardFilters`) | omitted | `?sort=deviation` |
| Other pages / tab nav | `amount` | omitted | `?sort=deviation` |

## Sort algorithm

```
bucket 0: numeric deviation  → sorted by Math.abs(deviation) DESC
bucket 1: isNew === true      → grouped together, no further ordering
bucket 2: deviation === null  → grouped last
tiebreaker (same bucket): toDecimal(b.amount).comparedTo(toDecimal(a.amount))
```

Amount tiebreaker uses `toDecimal().comparedTo()` (strict Decimal.js compliance).

## Italian UI strings

All Italian UI copy (`Deviazione`, `Importo`, `Nuovo`) passed `yarn check:language` — they are product/UI-facing strings allowed under the language convention.

## Verification

- Full vitest suite: 545 tests, 0 failures
- `yarn build`: exit 0, all routes compile
- `yarn check:language`: passed

## Manual checkpoint (Task 5)

Pending user visual verification on a running dev server.
