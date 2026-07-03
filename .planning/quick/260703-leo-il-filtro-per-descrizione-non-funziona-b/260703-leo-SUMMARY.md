---
status: complete
quick_id: 260703-leo
---

# Summary: Fix description search filter

## What changed

- **DataTableToolbar**: controlled search draft, 500ms debounce, no `key`-based remount, search input stays enabled during URL transitions — fixes focus loss when typing multi-word queries.
- **transactions DAL**: name/q filter now also matches `expense.title` (third leg of the displayed label: customTitle → expense title → bank description).

## Why substring felt prefix-only

Backend already used `%term%` ILIKE. The perceived prefix-only behavior came from focus loss after the first debounced commit: users could not finish typing a middle substring or a second word.

## Verification

- `yarn vitest run tests/transactions-dal.test.ts tests/data-table-toolbar.test.tsx` — 66 passed
