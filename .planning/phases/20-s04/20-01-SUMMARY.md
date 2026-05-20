---
phase: "20"
plan: "01"
---

# T01: Added reusable CategoryCombobox with buildCategoryOptions/filterCategoryOptions helpers, command/popover primitives, and 18 passing Vitest tests covering search, filtering, and Personale badge metadata

**Added reusable CategoryCombobox with buildCategoryOptions/filterCategoryOptions helpers, command/popover primitives, and 18 passing Vitest tests covering search, filtering, and Personale badge metadata**

## What Happened

Installed `cmdk` (not previously in dependencies). Created `components/ui/command.tsx` using the cmdk primitive following the project's radix-ui import style. Created `components/ui/popover.tsx` using the `Popover` export from the existing `radix-ui` unified package (already installed — no new dependency needed). Created `components/expenses/category-combobox.tsx` as a controlled client component exporting: (1) `CategoryOption` type, (2) `buildCategoryOptions()` pure helper that flattens CategoryWithSubCategories trees into selectable options with optional type filtering (supports `allowedCategoryTypes=['out','system']` for expense-only pickers), (3) `filterCategoryOptions()` pure helper that matches across display name, originalName, categoryName, and slug with case-insensitive partial matching, (4) `CategoryCombobox` React component with popover+command rendering, grouped options by category, Personale badge for isOwned subcategories, Italian empty state text, and a custom `filter` prop passed to the Command primitive to match all four search targets. Created `tests/category-combobox.test.tsx` with 18 tests covering option-building, type filtering, multi-field search, slug matching, case insensitivity, override name matching, and Personale badge metadata. Fixed two inline comments from Italian to English to pass `yarn check:language`.

## Verification

Ran `yarn vitest run tests/category-combobox.test.tsx --reporter=verbose` — 18/18 tests passed. Ran `yarn lint` on all 4 output files — exit 0. Ran `yarn check:language` — passed after fixing two developer-facing Italian comments.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest run tests/category-combobox.test.tsx --reporter=verbose` | 0 | 18/18 tests passed | 345ms |
| 2 | `yarn lint -- components/expenses/category-combobox.tsx components/ui/command.tsx components/ui/popover.tsx tests/category-combobox.test.tsx` | 0 | No lint errors | 3000ms |
| 3 | `yarn check:language` | 0 | English code convention check passed | 2000ms |

## Deviations

none

## Known Issues

none

## Files Created/Modified

- `components/ui/command.tsx`
- `components/ui/popover.tsx`
- `components/expenses/category-combobox.tsx`
- `tests/category-combobox.test.tsx`
