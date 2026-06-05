---
phase: 40-table-filter-sort
reviewed: 2026-06-04T00:00:00Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - app/(app)/expenses/expenses.table.ts
  - app/(app)/expenses/page.tsx
  - app/(app)/import/files.table.ts
  - app/(app)/import/page.tsx
  - app/(app)/transactions/page.tsx
  - app/(app)/transactions/transactions.table.ts
  - components/data-table/AmountRangePicker.tsx
  - components/data-table/ChipsRow.tsx
  - components/data-table/DataTableToolbar.tsx
  - components/data-table/EmptyState.tsx
  - components/data-table/HeaderSortButton.tsx
  - components/data-table/MonthMultiPicker.tsx
  - components/data-table/use-table-url.ts
  - components/import/import-table.tsx
  - lib/dal/expenses.ts
  - lib/dal/imports.ts
  - lib/dal/months-with-data.ts
  - lib/dal/transactions.ts
  - lib/validations/__tests__/transactions.test.ts
  - lib/validations/expense.ts
  - lib/validations/import.ts
  - lib/validations/transactions.ts
  - tests/data-table-toolbar.test.tsx
  - tests/expenses-dal.test.ts
  - tests/imports-dal.test.ts
  - tests/months-with-data-dal.test.ts
  - tests/transactions-dal.test.ts
findings:
  critical: 3
  warning: 5
  info: 4
  total: 12
status: issues_found
---

# Phase 40: Code Review Report

**Reviewed:** 2026-06-04
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

This phase implements a unified filter+sort toolbar system across three tables (Transactions, Expenses, Files/Imports). The architecture is clean: URL-driven state, server-side filter parsing with strict allowlists, DAL functions guarded by `verifySession`, and a declarative `TableConfig` type. The test suite is comprehensive for DAL layer and validation logic.

Three critical bugs were found: (1) an unescaped LIKE pattern in `expenses.ts` that allows users to manipulate query patterns (though not SQL injection, it degrades correctness); (2) a falsy-zero bug in `updateParam`/`updateParams` in `use-table-url.ts` that permanently prevents clearing a filter to the value `"0"`; and (3) a missing `q`-field check in the expenses DAL that makes the `q` filter dead code unless the caller also populates `name`. Additionally, the `amountMin`/`amountMax` truthy check silently drops `"0"` inputs across all three tables, and the `or()` spread in `getImportRows`/`getTransactions` will throw at runtime on Drizzle if the months array is unexpectedly empty (already guarded, but one guard is missing for the imports case).

---

## Critical Issues

### CR-01: Missing LIKE pattern escape in `getExpenses` — arbitrary wildcard injection by user

**File:** `lib/dal/expenses.ts:108`

**Issue:** `transactions.ts` defines and uses `escapeLikePattern()` to sanitize `\`, `%`, and `_` before interpolating into an `ilike` pattern. `expenses.ts` and `imports.ts` do not call any equivalent escaping. A user who enters a title like `%a%` in the search box will match all expenses (not just those containing the literal string `%a%`). A user entering `_` gets a wildcard character match instead of a literal underscore. This is not SQL injection (Drizzle parameterizes the pattern value), but it defeats the semantic correctness of the search and lets a user enumerate more results than intended.

`imports.ts` has the same problem at line 109 for the `q` filter against `file.displayName` and `file.originalName`.

**Fix:**
```ts
// lib/dal/expenses.ts — add the helper (copy from transactions.ts)
function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, '\\$&')
}

// Then line 108:
if (filters.name) {
  const pattern = `%${escapeLikePattern(filters.name)}%`
  conditions.push(ilike(expense.title, pattern))
}

// lib/dal/imports.ts — same helper, then line 109:
if (filters.q) {
  const pattern = `%${escapeLikePattern(filters.q)}%`
  conditions.push(or(ilike(file.displayName, pattern), ilike(file.originalName, pattern)))
}
```

---

### CR-02: `updateParam` / `updateParams` treat value `"0"` as falsy — filter cannot be set to zero

**File:** `components/data-table/use-table-url.ts:31-49`

**Issue:** Both `updateParam` and `updateParams` use `if (value)` (a JS truthy check) to decide whether to call `params.set` or `params.delete`. The string `"0"` is falsy in JavaScript, so calling `updateParam('amountMin', '0')` or `updateParams({ amountMin: '0' })` will silently call `params.delete('amountMin')` instead of setting it to `"0"`. This is directly observable: a user who types `0` in the AmountRangePicker sees their filter get deleted immediately when the value is committed as `"0"`. The fix must distinguish between `null` (explicit clear) and `"0"` (valid numeric value).

The same falsy-string bug exists in `DataTableToolbar.tsx:289` where `updateParam('q', value.trim() || null)` correctly falls back to null, but the underlying hook has the issue for numeric params.

**Fix:**
```ts
// use-table-url.ts
function updateParam(key: string, value: string | null) {
  const params = new URLSearchParams(searchParams.toString())
  if (value !== null) {   // strict null check, not falsy
    params.set(key, value)
  } else {
    params.delete(key)
  }
  replaceWith(params)
}

function updateParams(entries: Record<string, string | null>) {
  const params = new URLSearchParams(searchParams.toString())
  for (const [key, value] of Object.entries(entries)) {
    if (value !== null) {   // strict null check, not falsy
      params.set(key, value)
    } else {
      params.delete(key)
    }
  }
  replaceWith(params)
}
```

---

### CR-03: `getExpenses` DAL ignores `filters.q` — expenses search is silently a no-op when only `q` is provided

**File:** `lib/dal/expenses.ts:107`

**Issue:** The `ExpenseFilters` type declares both `q` and `name` fields (line 26-27). The DAL only checks `filters.name` on line 107. The `ExpensesPage` maps `parsed.q` to both `q: parsed.q` and `name: parsed.q` (page.tsx lines 57-58), which masks the bug for the page-level caller. However, any other caller that passes only `{ q: 'amazon' }` gets no search filter applied — the `q` field is silently ignored. This is a correctness hole and a maintenance trap: the `q` field in `ExpenseFilters` is dead code, creating the false impression that it works.

**Fix:**
```ts
// lib/dal/expenses.ts — check q first, then name for back-compat
const searchTerm = filters.q ?? filters.name
if (searchTerm) {
  const pattern = `%${escapeLikePattern(searchTerm)}%`
  conditions.push(ilike(expense.title, pattern))
}
```

---

## Warnings

### WR-01: `amountMin`/`amountMax` truthy check silently drops `"0"` as a valid filter value

**File:** `lib/dal/transactions.ts:200-205`, `lib/dal/expenses.ts:112-117`, `lib/dal/imports.ts:153-158`

**Issue:** All three DAL functions guard the amount conditions with `if (filters.amountMin)` and `if (filters.amountMax)`. The string `"0"` is falsy, so `amountMin: "0"` (e.g. "show all transactions, including zero-amount ones, down to 0") is silently ignored. `parseAmount` in `search-params.ts` correctly returns `"0"` for the input `"0"`. The bug is in the DAL guard, not in parsing. For an absolute-value amount filter this may rarely matter in practice (transactions with amount 0 are uncommon), but it is semantically incorrect and inconsistent with how other filters are guarded.

**Fix (all three DAL files):**
```ts
// Use explicit undefined check instead of truthy
if (filters.amountMin !== undefined) {
  conditions.push(sql`ABS(...)::numeric >= ${filters.amountMin}::numeric`)
}
if (filters.amountMax !== undefined) {
  conditions.push(sql`ABS(...)::numeric <= ${filters.amountMax}::numeric`)
}
```

---

### WR-02: `or()` spread over months in `getImportRows` is not guarded — Drizzle throws on empty `or()`

**File:** `lib/dal/imports.ts:147-149`

**Issue:** The months OR spread is gated with `if (filters.months && filters.months.length > 0)` — the existing guard is correct for the import rows. However, this is inconsistently applied: the same `or(...months.map(...))` pattern in `getTransactions` (`transactions.ts:194-196`) has the same guard and is correct. The risk is that the guard is easy to accidentally remove during a future refactor, and Drizzle's `or()` with zero arguments produces an invalid SQL fragment. The current code is safe but brittle. A defensive alternative is to use `sql` directly for the OR rather than relying on the guard staying in place.

This is not currently broken but is a latent fragility worth documenting.

**Fix:** Add an assertion comment or extract the guarded block into a helper, e.g.:
```ts
// Guard comment must stay: or() with zero args throws in Drizzle
// months filter is only applied when months.length > 0 (already checked above)
```
Or use a conditional in the array:
```ts
const monthConditions = (filters.months ?? []).map((ym) => sql`TO_CHAR(...) = ${ym}`)
if (monthConditions.length > 0) {
  conditions.push(or(...monthConditions))
}
```

---

### WR-03: `getTransactionPlatforms` inner join excludes `null` file rows — manual transactions are never listed as platform options

**File:** `lib/dal/transactions.ts:248-257`

**Issue:** `getTransactionPlatforms` uses `innerJoin(platform, ...)` at line 253, which means transactions without a `fileId` (manual transactions) are excluded — correct, since those have no platform. However, the `where` clause at line 254 adds `eq(importFile.userId, userId)` as a hard condition. Because the query uses `leftJoin(importFile, ...)` at line 249 and then `innerJoin(platform, ...)` at line 252, a transaction where `fileId IS NOT NULL` but the file belongs to another user will cause the platform to be silently excluded rather than returning an error. This was presumably the intent (security), but the condition on `importFile.userId` on a left-joined table means rows with `fileId=null` also pass when the where applies — except the `innerJoin(platform)` already filters those out. The logic is correct but the combination of `leftJoin(importFile)` then `eq(importFile.userId)` in the where clause is fragile: it works only because `innerJoin(platform)` excludes the null-file rows. A cleaner formulation would use `innerJoin(importFile, ...)` with the userId condition in the join predicate.

**Fix:**
```ts
// More explicit ownership join — avoids relying on implicit null exclusion
.innerJoin(importFile, and(eq(transaction.fileId, importFile.id), eq(importFile.userId, userId)))
.innerJoin(importFormatVersion, eq(importFile.importFormatVersionId, importFormatVersion.id))
.innerJoin(platform, eq(importFormatVersion.platformId, platform.id))
.where(eq(transaction.userId, userId))
```

---

### WR-04: Chips for `amount-range` are built inside the `amount-range` branch that only triggers when `field.key` has a URL value — `amountMin`/`amountMax` chips skip when `field.key='amountMin'` has no URL value but `amountMax` does

**File:** `components/data-table/DataTableToolbar.tsx:239-268`

**Issue:** The chip-building loop (lines 239-268) filters to `config.filters` entries where `searchParams.get(field.key)` is non-null. For `amount-range` fields, `field.key` is `'amountMin'` (as declared in all three `*.table.ts` files). When only `amountMax` is set (and `amountMin` is not), `searchParams.get('amountMin')` is `null`, so the `amount-range` field is filtered out of `config.filters` before the flatMap runs. The `amountMax` chip is therefore never rendered when only a maximum is set without a minimum.

Trace: filters array includes `{ key: 'amountMin', type: 'amount-range' }`. The outer filter on line 240 checks `searchParams.get('amountMin') !== null`. If only `amountMax=500` is in the URL, this returns `null` and the field is excluded, so the `amountMax` chip at line 264 is never reached.

**Fix:** Change the outer filter condition for `amount-range` fields to include them if either `amountMin` or `amountMax` is set:
```ts
.filter((field) => {
  if (field.type === 'amount-range') {
    return searchParams.has('amountMin') || searchParams.has('amountMax')
  }
  const v = searchParams.get(field.key)
  return v !== null && v !== ''
})
```

---

### WR-05: `DataTableToolbar` search input uses `defaultValue` — input not reset when URL changes externally

**File:** `components/data-table/DataTableToolbar.tsx:316`

**Issue:** The search `<Input>` is rendered as an uncontrolled input via `defaultValue={searchParams.get('q') ?? ''}`. If the URL changes externally (e.g., user clicks a breadcrumb that clears all filters, or the `Cancella tutto` button clears `q`), the input DOM element retains its previous value because React does not re-render uncontrolled inputs' `defaultValue` on prop change. The user sees stale text in the search box but the actual URL has `q` cleared.

`Cancella tutto` calls `clearAllFilters()` which calls `updateParams({ ..., q: null, ... })` — but `q` is not in the `config.filters` list (only in `config.search`), so `clearAllFilters()` does NOT clear `q`. This is a separate but related issue: the search input is never cleared by "Cancella tutto" either at the URL level or the DOM level.

**Fix for reset on external URL change:** Either make the input controlled (tracking local state that synchronizes with `searchParams.get('q')`), or use a `key` prop tied to the search param to force remount:
```tsx
<Input
  key={searchParams.get('q') ?? ''}
  type="search"
  ...
  defaultValue={searchParams.get('q') ?? ''}
  ...
/>
```

**Fix for Cancella tutto:** Include `'q'` in `clearAllFilters` when `config.search` is defined:
```ts
function clearAllFilters() {
  const entries: Record<string, null> = {}
  if (config.search) {
    entries[config.search.key] = null  // clear the search input param too
  }
  for (const field of config.filters) { ... }
  updateParams(entries)
}
```

---

## Info

### IN-01: `ExpenseFilters.q` field in DAL type is undocumented dead code

**File:** `lib/dal/expenses.ts:26-28`

**Issue:** The `q` field in `ExpenseFilters` is declared in the type but never read by the `getExpenses` function (only `name` is checked). This creates a misleading API surface. The type comment says `"Canonical search param key (D-19); same semantics as name"` but the implementation never uses it.

**Fix:** Remove the `q` field from `ExpenseFilters` (it is not needed since `name` exists for back-compat) or implement the `q` check in the DAL per CR-03 above.

---

### IN-02: `monthLabel` in `MonthMultiPicker.tsx` uses local time for the chip label — timezone mismatch possible

**File:** `components/data-table/MonthMultiPicker.tsx:15-18`

**Issue:** `monthLabel('2026-05')` constructs `new Date(y, m - 1, 1)` — a local time Date. If the user's browser timezone is UTC-N and it is before midnight UTC on the first of the month, `m - 1` remains correct. But the YYYY-MM strings from the server are derived from `TO_CHAR(occurred_at, 'YYYY-MM')` using the database timezone (typically UTC). A user in UTC+12 viewing `"2025-12"` constructed via `new Date(2025, 11, 1)` gets `"Dic 2025"` which is correct. In practice this is display-only and will rarely manifest, but the inconsistency with UTC-derived server data is worth noting.

**Fix (optional):** Use `new Date(Date.UTC(y, m - 1, 1))` and format it with `timeZone: 'UTC'` to keep display consistent with server data:
```ts
export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const label = new Intl.DateTimeFormat('it-IT', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, 1)))
  return label.charAt(0).toUpperCase() + label.slice(1)
}
```

---

### IN-03: `hasActiveTransactionFilters` in `transactions/page.tsx` checks `'name'` as a legacy key — dead check

**File:** `app/(app)/transactions/page.tsx:22`

**Issue:** `hasActiveTransactionFilters` includes `'name'` in the keys list. Per the Wave 5 comment in `parseTransactionFilters`, `name` is kept as a back-compat alias but the canonical key is `q`. The URL written by the toolbar always uses `q`, never `name`. So checking `params['name']` in this list tests a key that will never be set by the current UI. It does no harm (old URLs with `?name=` will still get the correct empty-state variant), but it is confusing clutter.

**Fix:** Remove `'name'` from the `keys` array in `hasActiveTransactionFilters`.

---

### IN-04: `DataTableToolbar` `countActiveFilters` double-counts when both `amountMin` and `amountMax` are set

**File:** `components/data-table/DataTableToolbar.tsx:59-72`

**Issue:** `countActiveFilters` increments by 1 when `amountMin` OR `amountMax` is present (line 66-67). This is correct when only one is set. But if the `config.filters` array contains two separate entries that both have `type: 'amount-range'` (which is possible if someone adds a second amount-range filter), the count would double. Currently all three table configs declare exactly one `amount-range` field, so this does not trigger. However, the function iterates over all fields and applies the same `amount-range` condition regardless of which field's key is being evaluated — the check `searchParams.has('amountMin') || searchParams.has('amountMax')` is hard-coded rather than derived from the field. This means if a future table config uses different amount param names, the count will be wrong.

**Fix:** The `amount-range` check in `countActiveFilters` should be field-agnostic or rely on a naming convention. A minor improvement:
```ts
if (field.type === 'amount-range') {
  // Convention: amount-range fields map to {field.key} and {field.key.replace('Min','Max')}
  const minKey = field.key  // e.g. 'amountMin'
  const maxKey = minKey.replace('Min', 'Max')  // 'amountMax'
  if (searchParams.has(minKey) || searchParams.has(maxKey)) count++
}
```

---

_Reviewed: 2026-06-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
