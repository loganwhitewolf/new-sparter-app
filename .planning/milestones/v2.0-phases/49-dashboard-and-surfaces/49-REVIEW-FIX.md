---
phase: 49
fixed_at: 2026-06-13T00:00:00.000Z
review_path: .planning/phases/49-dashboard-and-surfaces/49-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 49: Code Review Fix Report

**Fixed at:** 2026-06-13  
**Source review:** `.planning/phases/49-dashboard-and-surfaces/49-REVIEW.md`  
**Iteration:** 1

**Summary:**
- Findings in scope: 7
- Fixed: 7
- Skipped: 0

## Fixed Issues

### WR-01: `getMonthlyTrendByNature` — NULL direction rows now included in totalNc

**Files modified:** `lib/dal/dashboard.ts`  
**Commit:** 9bfb6bb  
**Applied fix:** Replaced `ne(direction.code, 'transfer')` with `or(isNull(direction.code), ne(direction.code, 'transfer'))` in the WHERE clause so uncategorized rows (NULL direction) are not dropped before the GROUP BY, allowing `totalNc` to count them correctly.

---

### WR-02: Native `parseFloat` sort replaced with Decimal.js in `getTopUncategorizedExpenses`

**Files modified:** `lib/dal/transactions.ts`  
**Commit:** 0f75455  
**Applied fix:** Added `import { toDecimal } from '@/lib/utils/decimal'` and replaced `Math.abs(parseFloat(b.totalAmount)) - Math.abs(parseFloat(a.totalAmount))` with `toDecimal(b.totalAmount).abs().comparedTo(toDecimal(a.totalAmount).abs())`, conforming to the project's Decimal.js non-negotiable rule.

---

### WR-03: Stale `type` field removed from `CreateCategorySchema` and create-category form

**Files modified:** `lib/validations/category.ts`, `lib/actions/categories.ts`, `components/categories/category-mutation-dialogs.tsx`  
**Commit:** 3d3ee28  
**Applied fix:** Removed `type: z.enum(['in', 'out'])` from `CreateCategorySchema`, removed `type: formData.get('type')` from the action's `safeParse` call, and removed the hidden input, `<Select>` type picker, `[type, setType]` state, and `CategoryType` type alias from `CreateCategoryDialog`. Direction semantics are now fully derived from subcategory natures, consistent with Phase 49's data model.

---

### WR-04: `allocation` guard added in `buildBreakdownData` and `buildCategoryRankingData`

**Files modified:** `lib/dal/dashboard.ts`  
**Commit:** 1921167  
**Applied fix:** Added `row.categoryType === 'allocation'` to the `continue` guard in both `buildBreakdownData` (line 523) and `buildCategoryRankingData` (line 600). This prevents `allocation` direction rows from reaching the `as 'in' | 'out'` cast and breaking downstream type consumers if the `allocation` direction row ever has `includedInTotals = true`.

---

### WR-05: `getCategoryDetail` direction subquery now honours `userSubcategoryOverride`

**Files modified:** `lib/dal/dashboard.ts`  
**Commit:** 7c5d601  
**Applied fix:** Rewrote the correlated subquery to include a `LEFT JOIN user_subcategory_override uso ON uso.sub_category_id = sc.id AND uso.user_id = ${userId}` and changed the WHERE condition to `WHERE n.id = COALESCE(uso.nature_id, sc.nature_id)`. This matches the COALESCE pattern used consistently in the main data queries (lines 1192, 1232, 1275) and ensures that users who have overridden subcategory natures get a correct `categoryData.type`.

Note: this fix uses logic-level changes — **requires human verification** to confirm the SQL produces the correct direction code when an override is present.

---

### WR-06: Unused `ne` and `or` imports removed from `lib/dal/overview.ts`

**Files modified:** `lib/dal/overview.ts`  
**Commit:** 611e2b5  
**Applied fix:** Removed `ne` and `or` from the `drizzle-orm` import line. Both were confirmed unused via grep (only comment references remain).

---

### WR-07: `getOverviewChart` LEFT JOINs replaced with INNER JOINs to match KPI scoping

**Files modified:** `lib/dal/overview.ts`  
**Commit:** f1169d8  
**Applied fix:** Changed `leftJoin(expense, ...)`, `leftJoin(subCategory, ...)`, and `leftJoin(category, ...)` to `innerJoin(...)` in the `getOverviewChart` query. The `userSubcategoryOverride` join remains a LEFT JOIN (it is optional per user). This makes the chart exclude uncategorized transactions consistently with `getOverviewAmountTotals`, resolving the KPI/chart divergence. The `expenseStatusIncludedInDashboardTotals()` filter is retained (it now effectively only matches categorized expenses due to the INNER JOIN chain).

Note: this changes observable chart behavior for users with uncategorized expenses — **requires human verification** that chart totals now matching KPI figures is the desired product outcome.

---

_Fixed: 2026-06-13_  
_Fixer: Claude (gsd-code-fixer)_  
_Iteration: 1_
