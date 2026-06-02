---
plan: 37-03
phase: 37-flow-nature-chart
status: complete
completed: 2026-05-26
self_check: PASSED
key-files:
  modified:
    - lib/dal/dashboard.ts
    - lib/dal/categories.ts
    - tests/dashboard-dal.test.ts
    - tests/categories-dal.test.ts
    - tests/category-combobox.test.tsx
    - tests/import-preview-ui.test.tsx
    - tests/suggestion-card.test.tsx
    - tests/suggestion-promote-form.test.tsx
---

## Summary

Plan 37-03 implemented the DAL layer for the nature-segmented chart and exposed effective nature on subcategories.

## Final query shape (getMonthlyTrendByNature)

```typescript
const monthSql = sql<string>`to_char(${transactionTable.occurredAt}, 'YYYY-MM')`
const natureSql = sql<FlowNature | null>`coalesce(${userSubcategoryOverride.nature}, ${subCategory.nature})`

await db
  .select({
    month: monthSql,
    nature: natureSql,
    amount: sql<string>`coalesce(sum(${transactionTable.amount}), 0)::text`,
    totalNc: sql<number>`count(distinct case when ${expense.status} = '1' and ${expense.subCategoryId} is null then ${expense.id} end)`,
    totalIgn: sql<number>`count(distinct case when ${category.slug} = 'ignore' then ${expense.id} end)`,
  })
  .from(transactionTable)
  .leftJoin(expense, ...)
  .leftJoin(subCategory, ...)
  .leftJoin(category, ...)
  .leftJoin(userSubcategoryOverride, and(
    eq(userSubcategoryOverride.subCategoryId, subCategory.id),
    eq(userSubcategoryOverride.userId, userId),
  ))
  .where(and(
    dateScopedTransactions(userId, from, to),
    expenseStatusIncludedInDashboardTotals(),
    notExcludedFromTotals(),
  ))
  .groupBy(monthSql, natureSql)
```

- Algebraic `SUM(amount)` — no ABS(), no sign filter (ADR-0004)
- `COALESCE(override.nature, sub.nature)` — user override wins (D-09)
- `notExcludedFromTotals()` in WHERE excludes trasferimenti/ricariche subcategories (R-FN-09)
- groupBy both month and nature SQL expressions

## buildMonthlyNatureTrendData exported: YES

Plan 37-04 can import both `MonthlyNatureTrendPoint` and `buildMonthlyNatureTrendData` from `@/lib/dal/dashboard`.

## effectiveNature in getCategoriesForUser

Added via `sql<FlowNature | null>\`coalesce(${userSubcategoryOverride.nature}, ${subCategory.nature})\`` in the select shape. Mapper assigns `row.effectiveNature` directly. The LEFT JOIN on `userSubcategoryOverride` already existed for `customName`, no new join needed.

## Tweaks needed

None — `monthsBetween` and `monthLabel` worked unchanged. `normalizeCount` reused from existing helpers.

## Test results

- `tests/dashboard-dal.test.ts`: 28/28 GREEN (was 17; +11 from new tests + 1 RED turned GREEN)
- `tests/categories-dal.test.ts`: 17/17 GREEN (was 13; +4 effectiveNature tests)
- Fixture files updated: category-combobox, import-preview-ui, suggestion-card, suggestion-promote-form

## Downstream

- Plan 37-04 imports `MonthlyNatureTrendPoint`, `getMonthlyTrendByNature` from `@/lib/dal/dashboard`
- Plan 37-05 uses `effectiveNature` from `CategoryWithSubCategories` in settings UI
