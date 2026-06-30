---
status: complete
quick_id: 260630-mkf
---

# Quick Task 260630-mkf — Summary

## What changed

Refactored `ImportFormatWizard` step 1 platform picker from a flat radio list to a responsive card grid with search.

### `components/import/import-format-wizard.tsx`

- Added `platformSearch` state and client-side filter by name/slug
- Search input with icon (`Cerca piattaforma...`)
- Responsive grid: 1 col (list rows) on mobile → up to 5 cols on `xl`
- Card tiles from `sm` breakpoint (`sm:min-h-24`, vertical layout, radio visually hidden)
- "Crea una nuova platform" moved below grid with `border-t pt-4` separation and Plus icon
- Empty state when search has no matches

### `tests/import-format-wizard-ui.test.tsx`

- Extended step 1 test for search field, grid classes, and separated create-new section

## Verification

- `yarn vitest run tests/import-format-wizard-ui.test.tsx` — 8/8 passed

## Commits

- Code: platform picker card grid UI + tests
