---
phase: "20"
plan: "03"
---

# T03: Replaced double-select category pickers in single and bulk expense dialogs with the reusable searchable CategoryCombobox, filtering to out/system categories and preserving hidden subCategoryId submission

**Replaced double-select category pickers in single and bulk expense dialogs with the reusable searchable CategoryCombobox, filtering to out/system categories and preserving hidden subCategoryId submission**

## What Happened

Both `expense-categorize-dialog.tsx` and `bulk-categorize-dialog.tsx` had a two-step chained Select pattern: first pick a parent category, then pick a subcategory. This was replaced with a single `CategoryCombobox` instance in each dialog.

Changes per dialog:
- Removed the `categoryId` state, the `handleCategoryChange` helper, and both `<Select>` blocks.
- Kept `subCategoryId` state as the sole controlled value; the hidden `<input name="subCategoryId">` still carries it to the server action unchanged.
- `CategoryCombobox` is mounted with `allowedCategoryTypes={['out', 'system']}` to exclude income-only categories, `value={subCategoryId}`, `onChange={setSubCategoryId}`, and a descriptive Italian placeholder ("Cerca sottocategoria…").
- Success `useEffect` resets only `subCategoryId` (no longer needs to reset `categoryId`).
- The submit button's `disabled={isPending || !subCategoryId}` guard is unchanged — empty selection keeps the button disabled.
- Server-action error alert and pending spinner remain untouched.
- The test file (`tests/category-combobox.test.tsx`) required no changes — the 18 existing pure-helper tests fully cover option building, filtering, type filtering, and Personale badge metadata; no new dialog-wiring tests were needed.

## Verification

Ran `yarn vitest run tests/category-combobox.test.tsx tests/expense-actions.test.ts --reporter=verbose`: 25/25 tests passed (18 combobox + 7 expense-actions). Ran `yarn lint` over all three component files: clean exit, no warnings.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest run tests/category-combobox.test.tsx tests/expense-actions.test.ts --reporter=verbose` | 0 | 25/25 tests passed | 392ms |
| 2 | `yarn lint -- components/expenses/expense-categorize-dialog.tsx components/expenses/bulk-categorize-dialog.tsx components/expenses/category-combobox.tsx` | 0 | No lint errors | 3000ms |

## Deviations

none

## Known Issues

none

## Files Created/Modified

- `components/expenses/expense-categorize-dialog.tsx`
- `components/expenses/bulk-categorize-dialog.tsx`
