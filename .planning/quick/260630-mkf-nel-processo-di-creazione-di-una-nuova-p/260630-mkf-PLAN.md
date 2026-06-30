---
quick_id: 260630-mkf
status: locked
---

# Quick Task: Platform picker card grid in import wizard step 1

## Goal

Replace the flat radio list in `ImportFormatWizard` step 1 with:
- Responsive card grid (1 col mobile list → up to 5 cols on xl)
- Search field to filter platforms by name/slug
- "Crea nuova platform" separated at the bottom

## Tasks

### Task 1: Refactor step 1 platform selection UI

**files:** `components/import/import-format-wizard.tsx`

**action:**
- Add `platformSearch` state + `useMemo` filter on `attachablePlatforms`
- Search input with Search icon (match subcategory-picker pattern)
- Grid: `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`
- Mobile: horizontal list row; sm+: vertical card tiles
- Move "Crea nuova platform" below grid with `border-t pt-4` separation
- Empty-state message when search has no matches

**verify:** `yarn vitest run tests/import-format-wizard-ui.test.tsx`

**done:** Step 1 shows search, grid classes, separated create-new section; existing flow unchanged

### Task 2: Update UI tests

**files:** `tests/import-format-wizard-ui.test.tsx`

**action:** Assert search field, grid layout classes, and separated create-new section in step 1 render

**verify:** `yarn vitest run tests/import-format-wizard-ui.test.tsx`

**done:** Tests pass
