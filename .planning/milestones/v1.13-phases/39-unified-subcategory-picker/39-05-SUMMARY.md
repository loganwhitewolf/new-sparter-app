---
phase: 39-unified-subcategory-picker
plan: "05"
subsystem: patterns
tags: [patterns, subcategory-picker, server-actions, tdd, security]
dependency_graph:
  requires: ["39-02"]
  provides: ["R-UP-07", "ADR-0008"]
  affects: [patterns, import/suggestions]
tech_stack:
  added: []
  patterns:
    - Server-side amountSign derivation from category type (ADR 0008)
    - SubcategoryPicker integrated in form-based surfaces (bottom sheet)
    - TDD RED/GREEN cycle for DAL helper + pure derivation function
key_files:
  created:
    - tests/patterns-amount-sign.test.ts
  modified:
    - lib/dal/patterns.ts
    - lib/validations/pattern.ts
    - lib/actions/patterns.ts
    - components/patterns/create-pattern-dialog.tsx
    - components/patterns/pattern-actions.tsx
    - components/import/suggestion-promote-form.tsx
decisions:
  - "getCategoryTypeForSubCategory joins subCategory->category with user-scoping (null-or-user for both), matching isSubCategoryVisibleToUser pattern from categories DAL"
  - "UpdatePatternSchema.safeParse receives only pattern/subCategoryId/description (no amountSign/confidence from FormData); Zod schema fields kept for A1 non-breaking"
  - "confidence=1 hardcoded for all three actions; old 0.85 for promoteSuggestion removed"
metrics:
  duration: "~25 min"
  completed: "2026-06-02"
  tasks_completed: 2
  files_changed: 6
---

# Phase 39 Plan 05: Pattern Forms — Picker Integration + Server-Side amountSign Summary

Server-side amountSign derivation from category type for all three pattern actions (create/promote/update) plus replacement of cascading Select pairs with the unified SubcategoryPicker in all three pattern-authoring surfaces.

## What Was Built

**Task 1 (TDD):** Added `getCategoryTypeForSubCategory(subCategoryId, userId)` to `lib/dal/patterns.ts` — joins `subCategory` to `category`, scopes to user-visible rows (null-or-user for both tables), returns the category type or null. Added `deriveAmountSign(categoryType)` exported from `lib/validations/pattern.ts` implementing the ADR 0008 table: `out->negative`, `in->positive`, `transfer|system->any`. Updated `createPatternAction`, `promoteSuggestionAction`, and `updatePatternAction` to stop reading `amountSign`/`confidence` from FormData; each now calls `getCategoryTypeForSubCategory` and `deriveAmountSign`, hardcodes `confidence=1`. `CreatePatternSchema` retains its `amountSign`/`confidence` Zod fields (A1: non-breaking). `amountSignMatches` in `lib/services/categorization.ts` is untouched.

**Task 2:** Rewrote all three pattern-authoring surfaces:
- `create-pattern-dialog.tsx`: regex Input + description Input + Categorizza button opening SubcategoryPicker; cascading Categoria/Sottocategoria Select pair, Segno importo Select, Confidenza Input, hidden `amountSign`/`confidence` all removed.
- `pattern-actions.tsx` (edit dialog): same reduction; current subcategory pre-selected in picker via label resolution; delete dialog untouched.
- `suggestion-promote-form.tsx`: cascading Selects and hidden `amountSign` removed; SubcategoryPicker via Categorizza button; hidden `pattern` + `subCategoryId` retained.

## Verification Results

- `yarn vitest run tests/patterns-amount-sign.test.ts` — 10/10 tests passed
- `yarn build` — compiled successfully, 0 TypeScript errors
- `grep SubcategoryPicker` matches in all three pattern files
- `grep SelectContent` matches nothing in the three pattern files
- `grep name="amountSign"` / `grep name="confidence"` match nothing in create-pattern-dialog.tsx and pattern-actions.tsx
- `git diff lib/services/categorization.ts` — empty (amountSignMatches untouched)
- `lib/validations/pattern.ts` still exports `CreatePatternSchema` with `amountSign` + `confidence` fields

## TDD Gate Compliance

RED: `865cfba` — `test(39-05): add failing tests for deriveAmountSign and getCategoryTypeForSubCategory`
GREEN: `775d6e5` — `feat(39-05): derive amountSign server-side from category type, confidence=1`
REFACTOR: not needed (code was clean from GREEN)

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 865cfba | test | RED — failing tests for deriveAmountSign and getCategoryTypeForSubCategory |
| 775d6e5 | feat | GREEN — derive amountSign server-side, confidence=1, getCategoryTypeForSubCategory DAL helper |
| ecc5f98 | feat | Reduce all three pattern forms to regex + description + Categorizza picker |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all forms wire to real SubcategoryPicker with real categories data.

## Threat Surface Scan

No new network endpoints or auth paths introduced. The threat register threats T-39-09 (Tampering: client-supplied amountSign/confidence) and T-39-10 (Elevation of privilege: unowned subCategoryId) are both mitigated as designed:
- T-39-09: amountSign/confidence no longer read from FormData in any of the three actions
- T-39-10: getCategoryTypeForSubCategory returns null for subcategories not visible to the user; all three actions return an error on null

## Self-Check: PASSED

All 8 key files confirmed present. All 3 task commits confirmed in git log.
