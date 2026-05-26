---
phase: 37-flow-nature-chart
reviewed: 2026-05-26T00:00:00Z
depth: deep
files_reviewed: 9
files_reviewed_list:
  - lib/utils/nature-labels.ts
  - lib/validations/category.ts
  - lib/dal/categories.ts
  - lib/actions/categories.ts
  - lib/dal/dashboard.ts
  - components/dashboard/entrate-uscite-chart.tsx
  - components/categories/subcategory-nature-select.tsx
  - components/categories/category-mutation-dialogs.tsx
  - components/categories/category-settings-panel.tsx
findings:
  critical: 2
  warning: 3
  info: 2
  total: 7
status: issues_found
---

# Phase 37: Code Review Report

**Reviewed:** 2026-05-26  
**Depth:** deep  
**Files Reviewed:** 9  
**Status:** issues_found

## Summary

Phase 37 adds FlowNature support: a `nature` enum on subcategories, a `userSubcategoryOverride.nature` column for per-user overrides, a nature-segmented stacked bar chart, and settings UI. Auth gating via `verifySession()` is consistently present across all Server Actions. Zod validation is applied before every mutation. The Decimal.js rule is respected for monetary aggregation in the new DAL function.

Two critical issues were found: the nature-override action allows any authenticated user to set a nature on any subcategory in the database (IDOR), and the `getMonthlyTrendByNature` chart query does not filter out `ignored` transactions, causing ignored amounts to inflate the stacked bars. Three warnings cover real behavioral bugs (totalNc/totalIgn double-counting, URL param accepting arbitrary values as SegmentKey, and the `hidden` param not being validated against the known key set). Two info items cover dead code and a missing dialog-close-on-success guard.

---

## Critical Issues

### CR-01: IDOR — setSubcategoryNatureAction writes override for any subCategoryId

**File:** `lib/actions/categories.ts:142-158`

**Issue:** `setSubcategoryNatureAction` calls `upsertSubcategoryNatureOverride` after only schema-validating that `subCategoryId` is a positive integer. It never checks whether the subcategory is visible to the calling user. Any authenticated user can therefore create or overwrite a `userSubcategoryOverride` row for a subcategory belonging to another user's private category (or for any system subcategory) by supplying an arbitrary `subCategoryId`. The DAL function `isSubCategoryVisibleToUser` is defined in `lib/dal/categories.ts:336` but is never called from this action.

The existing rename-subcategory flow avoids this because `renameUserSubcategory` scopes its UPDATE to `subCategory.userId = userId`, so the write silently no-ops if the subcategory does not belong to the caller. The upsert flow has no such natural scope — it writes an override row unconditionally once validation passes.

**Fix:**
```ts
export async function setSubcategoryNatureAction(input: {
  subCategoryId: number
  nature: FlowNature | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId } = await verifySession()
  const parsed = SetSubcategoryNatureSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dati non validi.' }
  }

  // Guard: confirm subcategory is visible to this user before writing override
  const visible = await isSubCategoryVisibleToUser(parsed.data.subCategoryId, userId)
  if (!visible) {
    return { ok: false, error: NOT_FOUND_ERROR }
  }

  try {
    await upsertSubcategoryNatureOverride({
      userId,
      subCategoryId: parsed.data.subCategoryId,
      nature: parsed.data.nature,
    })
  } catch {
    return { ok: false, error: GENERIC_ERROR }
  }
  revalidateCategorizationSurfaces()
  return { ok: true }
}
```

---

### CR-02: getMonthlyTrendByNature includes ignored-category transactions in chart segments

**File:** `lib/dal/dashboard.ts:1285-1291`

**Issue:** The WHERE clause in `getMonthlyTrendByNature` applies `expenseStatusIncludedInDashboardTotals()` and `notExcludedFromTotals()` but does not exclude the `ignore` category (slug `'ignore'`). All other dashboard aggregation functions — `getAggregatedTransactionsData`, `getCategoriesBreakdown`, `getCategoryRanking` — explicitly exclude `category.slug = 'ignore'` via `ne(category.slug, 'ignore')` or `notIgnoredCategory()`.

As a result, any transaction assigned to the ignored category is counted in the nature chart's bars under whichever nature (or `unclassified`) that subcategory carries. The totalIgn counter inside the same query captures the ignored expense count but does not prevent those amounts from inflating the segments. This makes the stacked chart inconsistent with the KPI cards and the bilancio chart.

**Fix:**
```ts
.where(
  and(
    dateScopedTransactions(userId, from, to),
    expenseStatusIncludedInDashboardTotals(),
    notExcludedFromTotals(),
    or(isNull(category.slug), ne(category.slug, 'ignore')),  // add this
  )
)
```

---

## Warnings

### WR-01: totalNc and totalIgn are over-counted per nature group in buildMonthlyNatureTrendData

**File:** `lib/dal/dashboard.ts:694-697`

**Issue:** The SQL query in `getMonthlyTrendByNature` groups by `(month, nature)`, so for a given month it returns one row per nature value. Both `totalNc` and `totalIgn` are computed at the month level — they count the same uncategorized and ignored expenses regardless of which nature bucket a row belongs to. In `buildMonthlyNatureTrendData`, these counts are accumulated across every nature row for the same month:

```ts
bucket.totalNc += normalizeCount(row.totalNc)  // line 696
bucket.totalIgn += normalizeCount(row.totalIgn) // line 697
```

If a month has 6 nature groups, `totalNc` is multiplied by up to 6. Compare `buildMonthlyTrendData` (lines 651-653), which assigns (not adds) because each month has exactly one row from the query.

**Fix:** Either compute `totalNc` / `totalIgn` in a separate single-row-per-month query and merge, or take only one row's counts per month bucket (e.g., assign only on first encounter):

```ts
// Option A — assign only when bucket is fresh (totalNc still 0 means not yet set)
if (bucket.totalNc === 0) {
  bucket.totalNc = normalizeCount(row.totalNc)
  bucket.totalIgn = normalizeCount(row.totalIgn)
}
```

Option A is a quick fix but brittle if a month genuinely has zero uncategorized expenses. The correct fix is a separate query scoped per month (mirroring `getUncategorizedCount`) and merging the result into the buckets after the main loop.

---

### WR-02: URL `hidden` param is parsed without validation — arbitrary strings accepted as SegmentKey

**File:** `components/dashboard/entrate-uscite-chart.tsx:62-66`

**Issue:** The `hidden` Set is derived by splitting the raw `hidden` URL search param and casting directly to `SegmentKey[]`:

```ts
return new Set(raw.split(',') as SegmentKey[])
```

There is no validation that each token is actually one of the known seven segment keys. Invalid values (e.g., `?hidden=constructor` or an extra-long string) are passed into `hidden.has(key)` calls and `Array.from(current).join(',')` and then written back to the URL. While this does not constitute a security vulnerability (there is no server-side processing of this param), it means corrupted URL state can persist and never self-heals. If `Bar hide={hidden.has(key)}` is used, a stale invalid key in the set has no visible effect but the URL permanently carries junk.

**Fix:**
```ts
const VALID_SEGMENT_SET = new Set<string>(SEGMENT_KEYS)

const hidden = useMemo<Set<SegmentKey>>(() => {
  const raw = searchParams.get('hidden')
  if (!raw) return new Set()
  return new Set(
    raw.split(',').filter((k): k is SegmentKey => VALID_SEGMENT_SET.has(k))
  )
}, [searchParams])
```

---

### WR-03: CreateSubcategoryDialog does not reset the nature Select after successful submission

**File:** `components/categories/category-mutation-dialogs.tsx:141-192`

**Issue:** `CreateSubcategoryDialog` uses a `<Select name="nature" defaultValue="discretionary">` (uncontrolled). The dialog closes and the form element is destroyed when submission succeeds (via `setOpen(false)` in `useDialogAction`), so the state does resets on re-open. However, the `useDialogAction` hook closes the dialog only when `state.error === null` **after** `submittedRef.current` is true. If a user submits, gets a server error, the dialog stays open showing the error. If the user then fixes the name and resubmits (same form), the `<Select>` value was already set by the user's previous interaction and is not reset — this is the expected behavior.

The real bug is different: the `Select` for `nature` is rendered with `required` but without `name` bound to a controlled state and no `value` prop. For the shadcn `Select`, the `name` prop causes a hidden `<input>` to be injected, but `required` on a controlled-less Select is not enforced by the browser's native form validation because shadcn Select renders a button, not a native `<select>`. If the user finds a way to submit an empty `nature` (e.g., via keyboard manipulation before the default value renders), the server correctly rejects it via Zod, but the UI offers no visible feedback that `nature` is required — there is no error boundary for it specifically, and `ActionError` shows the first Zod issue which will be an opaque enum message.

**Fix:** Add a controlled `useState` for nature in `CreateSubcategoryDialog` and pass `value` + `onValueChange` to the Select, mirroring the pattern used in `CreateCategoryDialog` for `type`. This makes the required field explicit and ensures the Select always holds a valid value before submission.

---

## Info

### IN-01: isSubCategoryVisibleToUser is dead code — never called

**File:** `lib/dal/categories.ts:336-357`

**Issue:** `isSubCategoryVisibleToUser` is exported but never imported anywhere in the codebase. It was presumably added in preparation for the nature-override flow (see CR-01), but the call was never wired up. After CR-01 is fixed it will be used; however, in the current state it is dead code and can cause confusion about what protection is in place.

**Fix:** Wire it into `setSubcategoryNatureAction` as described in CR-01. If no other callers exist, it does not need to remain exported.

---

### IN-02: EntrateUsciteChart title says "Entrate e uscite per mese" but chart shows only outflows by nature

**File:** `app/(app)/dashboard/overview/page.tsx:32-34` / `lib/dal/dashboard.ts:1270`

**Issue:** The heading rendered above the chart is "Entrate e uscite per mese" (line 32 of the page). However, the `getMonthlyTrendByNature` query uses `coalesce(sum(${transactionTable.amount}), 0)` without sign filtering, so it sums both positive (income) and negative (expense) amounts per nature group. For most nature keys (essential, discretionary, etc.) which are pure outflows, `sum(amount)` will be negative, causing `parseFloat(point.segments[k] ?? '0')` in the chart to produce negative bar heights, which Recharts renders as bars going below the axis.

Income transactions may also carry a nature, and those would produce positive bars for that nature key. The chart therefore mixes signs in the same segment axis — this is neither clearly income-only nor clearly expense-only.

The existing `getAggregatedTransactionsData` avoids this by splitting into separate `totalIn` / `totalOut` CASE aggregations. `getMonthlyTrendByNature` does not, making the resulting chart data semantically ambiguous and visually incorrect (negative bar values) for outflow-dominated natures.

**Fix:** Decide on intended semantics. If the chart is expense-by-nature, apply `abs()` or filter `where amount < 0`:
```sql
coalesce(abs(sum(case when ${transactionTable.amount} < 0 then ${transactionTable.amount} else 0 end)), 0)::text
```
If the chart is meant to show both income and expense stacked by nature, split into two separate segment groups and update the chart component accordingly. Also update the heading to match.

---

_Reviewed: 2026-05-26_  
_Reviewer: Claude (adversarial review)_  
_Depth: deep_
