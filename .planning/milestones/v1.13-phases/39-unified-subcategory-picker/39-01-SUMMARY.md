---
plan: 39-01
phase: 39-unified-subcategory-picker
status: complete
completed: 2026-06-02
---

## What was built

Foundation for the unified subcategory picker: pure option helpers and the most-used DAL query. No new dependencies added.

### Files created

- **`lib/categorization/subcategory-options.ts`** — `CategoryOption` type (now includes `categoryType`), `buildCategoryOptions`, `filterCategoryOptions`. Ported from `category-combobox.tsx`; the original file is untouched (deleted in 39-05).
- **`lib/dal/subcategory-usage.ts`** — `getMostUsedSubcategories(allowedTypes)`: joins `expense→subCategory→category`, groups by `subCategory.id`, returns top 6 per user scoped to `allowedTypes`; returns `[]` for empty `allowedTypes` and for cold-start users with no categorized expenses.
- **`tests/subcategory-options.test.ts`** — 10 tests for pure helpers.
- **`tests/subcategory-usage-dal.test.ts`** — 5 tests: auth scoping, type filtering, empty-result passthrough, row mapping, join count.

### Deviations

- **vaul dependency dropped**: `vaul` was evaluated as the bottom-sheet library and excluded — the upstream repo is declared unmaintained. The project's existing `Sheet` primitive (`components/ui/sheet.tsx`, Radix UI `side="bottom"`) covers the use case without a new dependency. Plans 39-01 and 39-02 updated accordingly.
- **Checkpoint gate removed**: plan 39-01 originally had a `blocking-human` checkpoint to verify vaul legitimacy; no longer needed.

## Self-Check

- [x] `yarn vitest run tests/subcategory-options.test.ts tests/subcategory-usage-dal.test.ts` → 19/19 passed
- [x] `yarn tsc --noEmit` → 0 errors
- [x] `category-combobox.tsx` unchanged
- [x] SUMMARY.md committed

## Key files

- `lib/categorization/subcategory-options.ts`
- `lib/dal/subcategory-usage.ts`
