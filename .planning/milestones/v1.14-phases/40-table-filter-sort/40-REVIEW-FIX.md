---
phase: 40-table-filter-sort
fixed_at: 2026-06-04T00:00:00Z
review_path: .planning/phases/40-table-filter-sort/40-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 40: Code Review Fix Report

**Fixed at:** 2026-06-04
**Source review:** .planning/phases/40-table-filter-sort/40-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (CR-01, CR-02, CR-03, WR-01, WR-02, WR-03, WR-04, WR-05)
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: Missing LIKE pattern escape in `getExpenses` and `getImportRows`

**Files modified:** `lib/dal/expenses.ts`, `lib/dal/imports.ts`
**Commit:** c473cb1
**Applied fix:** Added `escapeLikePattern()` helper to both files (identical to the one already in `transactions.ts`). Applied the helper to the `ilike` pattern in `getExpenses` (for `searchTerm`) and in `getImportRows` (for `filters.q`). Users can no longer inject `%` or `_` wildcard characters through the search input to broaden their result set.

---

### CR-02: `updateParam` / `updateParams` treat value `"0"` as falsy

**Files modified:** `components/data-table/use-table-url.ts`
**Commit:** 18be572
**Applied fix:** Changed `if (value)` guard to `if (value !== null)` in both `updateParam` and `updateParams`. The string `"0"` is now correctly passed to `params.set()` rather than silently routing to `params.delete()`. This is the root fix that enables WR-01 to work end-to-end from the UI layer through to the DAL.

---

### CR-03: `getExpenses` DAL ignores `filters.q` — expenses search silently a no-op when only `q` is provided

**Files modified:** `lib/dal/expenses.ts`
**Commit:** c473cb1
**Applied fix:** Replaced the `if (filters.name)` check with `const searchTerm = filters.q ?? filters.name` followed by `if (searchTerm)`. The canonical `q` field now takes precedence and the `name` field remains as a fallback for back-compat. The `q` field in `ExpenseFilters` is no longer dead code.

---

### WR-01: `amountMin`/`amountMax` truthy check silently drops `"0"` as a valid filter value

**Files modified:** `lib/dal/expenses.ts`, `lib/dal/imports.ts`, `lib/dal/transactions.ts`
**Commits:** c473cb1 (expenses + imports), 5cad32f (transactions)
**Applied fix:** Changed all three `if (filters.amountMin)` and `if (filters.amountMax)` guards to `if (filters.amountMin !== undefined)` and `if (filters.amountMax !== undefined)`. The value `"0"` is now treated as a valid filter bound in all three DAL functions.

---

### WR-02: `or()` spread over months in `getImportRows` is not guarded with a comment

**Files modified:** `lib/dal/imports.ts`
**Commit:** b4ac4d5
**Applied fix:** Added a comment directly above the `if (filters.months && filters.months.length > 0)` block in `getImportRows` explaining that the guard is mandatory because Drizzle's `or()` with zero arguments throws at runtime. The same pattern in `transactions.ts` already had a comment; this brings imports.ts into alignment.

---

### WR-03: `getTransactionPlatforms` relies on implicit null exclusion for ownership enforcement

**Files modified:** `lib/dal/transactions.ts`
**Commit:** dddd5ee
**Applied fix:** Changed `leftJoin(importFile, ...)` to `innerJoin(importFile, and(eq(transaction.fileId, importFile.id), eq(importFile.userId, userId)))`. The `userId` ownership check is now explicit in the join predicate, and the `where` clause is simplified to only `eq(transaction.userId, userId)`. This makes the ownership enforcement self-documenting and removes the implicit dependency on the downstream `innerJoin(platform)` to filter out null-file rows.
**Note:** This changes the semantics slightly — transactions with a `fileId` pointing to a file owned by another user will now be excluded from the join entirely (no row returned) rather than appearing as a null file row that was then filtered by the WHERE clause. The outcome for correctly-owned data is identical. Marked as: fixed: requires human verification.

---

### WR-04: `amountMax` chip not rendered when only `amountMax` is set (no `amountMin`)

**Files modified:** `components/data-table/DataTableToolbar.tsx`
**Commit:** 01aecd6
**Applied fix:** Changed the outer `.filter()` on the chips array to include a special case for `amount-range` fields: `if (field.type === 'amount-range') { return searchParams.has('amountMin') || searchParams.has('amountMax') }`. Previously the filter checked `searchParams.get(field.key)` where `field.key = 'amountMin'`, so a URL with only `amountMax` set would exclude the field and skip chip rendering entirely.

---

### WR-05: Search input not reset on external URL change; `clearAllFilters` does not clear `q`

**Files modified:** `components/data-table/DataTableToolbar.tsx`
**Commit:** 01aecd6
**Applied fix (WR-05a):** Added `key={searchParams.get('q') ?? ''}` to the search `<Input>`. React will remount the uncontrolled input element when the `q` URL param changes externally (e.g., user clicks a breadcrumb or "Cancella tutto"), so the DOM value stays in sync with the URL.
**Applied fix (WR-05b):** Added `if (config.search) { entries[config.search.key] = null }` at the top of `clearAllFilters()`. The "Cancella tutto" button now clears the `q` parameter alongside all filter params.

---

## Skipped Issues

None — all 8 in-scope findings were fixed.

---

_Fixed: 2026-06-04_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
