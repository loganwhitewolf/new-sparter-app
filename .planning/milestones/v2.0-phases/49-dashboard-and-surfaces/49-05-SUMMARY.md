---
phase: 49-dashboard-and-surfaces
plan: "05"
subsystem: categorization
tags: [direction-model, cascade-options, subcategory-picker, table-filters, nature-write-path, adr-0012, cat-01, cat-02, d-07, d-08, d-09]
dependency_graph:
  requires:
    - 49-03 (getCategoriesForUser restored category.type as real direction code, unblocking cascade-options)
  provides:
    - buildDirectionNatureMap keyed by direction code (in/out/allocation/transfer)
    - SubcategoryPicker exposes all 4 direction chips including Accantonamenti
    - transactions.table.ts + expenses.table.ts filter by direction (4 options) with nature cascade dependsOn direction
    - category-settings-panel groups by direction including allocation
    - setSubcategoryNatureAction resolves real natureId via NATURE_ID_BY_CODE (not null)
    - pattern-suggestions.ts sign-agnostic (detectedAmountSign removed per ADR 0012)
  affects:
    - lib/dal/categories.ts
    - lib/utils/cascade-options.ts
    - lib/utils/nature-labels.ts
    - components/categorization/subcategory-picker.tsx
    - app/(app)/transactions/transactions.table.ts
    - app/(app)/expenses/expenses.table.ts
    - components/categories/category-settings-panel.tsx
    - components/transactions/transaction-table.tsx
    - lib/utils/pattern-suggestions.ts
    - lib/validations/category.ts
    - lib/actions/categories.ts
tech_stack:
  added: []
  patterns:
    - "NATURE_ID_BY_CODE in nature-labels.ts: stable lookup map from FlowNature code to seed DB id (ids 1-8)"
    - "buildDirectionNatureMap: pure utility deriving per-direction nature options; skip null-type only (system removed from union in Plan 03)"
    - "Direction filter pattern: TableConfig key=direction, 4 options, nature dependsOn=direction"
key_files:
  created: []
  modified:
    - lib/utils/cascade-options.ts
    - lib/utils/nature-labels.ts
    - components/categorization/subcategory-picker.tsx
    - app/(app)/transactions/transactions.table.ts
    - app/(app)/expenses/expenses.table.ts
    - app/(app)/transactions/page.tsx
    - app/(app)/expenses/page.tsx
    - components/categories/category-settings-panel.tsx
    - components/transactions/transaction-table.tsx
    - lib/utils/pattern-suggestions.ts
    - lib/validations/category.ts
    - lib/actions/categories.ts
    - lib/dal/categories.ts
    - tests/cascade-options.test.ts
    - tests/category-actions.test.ts
    - tests/pattern-suggestion-detector.test.ts
    - tests/import-preview-ui.test.tsx
    - tests/import-service.test.ts
    - tests/import-suggestions-page.test.tsx
    - tests/suggestion-card.test.tsx
    - tests/suggestion-promote-form.test.tsx
key-decisions:
  - "buildTypeNatureMap kept as @deprecated export for test backward-compat; new buildDirectionNatureMap is the canonical function"
  - "NATURE_ID_BY_CODE added to nature-labels.ts (not a test-only fixture) as stable seed-based lookup for write path"
  - "detectedAmountSign removed from PatternSuggestion (ADR 0012) and ANL-04 test removed"
  - "cascade-options skip condition: type===null only (system not in type union since Plan 03)"
requirements-completed: [CAT-01, CAT-02]
duration: 15min
completed: "2026-06-12"
---

# Phase 49 Plan 05: Categorization Surfaces Direction Realignment Summary

**Rewired all categorization surfaces to the nature→direction model: buildDirectionNatureMap with allocation bucket, 4-direction SubcategoryPicker chips, table filters keyed by direction, settings panel grouping by direction, and nature write-path fixed to pass real natureId via NATURE_ID_BY_CODE.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-12T16:00:00Z
- **Completed:** 2026-06-12T16:10:32Z
- **Tasks:** 3
- **Files modified:** 20

## Accomplishments

- `buildDirectionNatureMap` exported from `cascade-options.ts` keyed by direction code with allocation bucket — Plan 01 CAT-01 RED test now GREEN (969 tests pass)
- SubcategoryPicker `TYPE_FILTERS` extended to 4 direction chips (Entrate/Uscite/Accantonamenti/Trasferimenti); both table configs swapped type→direction filter with nature cascade re-pointed
- Nature write-path fixed: `setSubcategoryNatureAction` resolves nature code → real `natureId` via `NATURE_ID_BY_CODE`; `detectedAmountSign` removed from `PatternSuggestion` per ADR 0012

## Task Commits

1. **Task 1: Rewrite cascade-options to buildDirectionNatureMap (CAT-01)** - `de0621a` (feat)
2. **Task 2: 4th direction chip + table filter direction swap (D-07, D-08, D-09)** - `90cd2ac` (feat)
3. **Task 3: Settings-panel direction grouping + nature write-path + remaining stubs** - `051e93a` (feat)

## Files Created/Modified

- `lib/utils/cascade-options.ts` — added `buildDirectionNatureMap`; skip condition null-only; `buildTypeNatureMap` retained @deprecated
- `lib/utils/nature-labels.ts` — added `NATURE_ID_BY_CODE` stable lookup map
- `components/categorization/subcategory-picker.tsx` — 4th direction chip 'Accantonamenti'; defaultType extended
- `app/(app)/transactions/transactions.table.ts` — TYPE_LABELS→DIRECTION_LABELS, key 'type'→'direction', dependsOn 'type'→'direction'
- `app/(app)/expenses/expenses.table.ts` — same as transactions.table.ts
- `app/(app)/transactions/page.tsx` — typeOptions→directionOptions with 4 values
- `app/(app)/expenses/page.tsx` — typeOptions→directionOptions with 4 values
- `components/categories/category-settings-panel.tsx` — allocation in TYPE_LABELS/TYPE_ORDER; remove TODO
- `components/transactions/transaction-table.tsx` — isTransfer from categoryType==='transfer'; direction-aware amountColorClass
- `lib/utils/pattern-suggestions.ts` — remove detectedAmountSign, inferAmountSign, Decimal import
- `lib/validations/category.ts` — re-add natureId (nullable number) to CreateSubcategorySchema
- `lib/actions/categories.ts` — setSubcategoryNatureAction resolves real natureId; createSubcategoryAction passes natureId
- `lib/dal/categories.ts` — remove TODO comment from upsertSubcategoryNatureOverride
- 7 test files updated to remove detectedAmountSign from fixtures/expectations

## Decisions Made

- **buildTypeNatureMap retained as @deprecated**: the legacy tests in `tests/cascade-options.test.ts` still test `buildTypeNatureMap` (valid for backward compatibility); the function is kept but deprecated. No consumers in lib/app/components.
- **NATURE_ID_BY_CODE in nature-labels.ts**: the lookup map belongs in a lib/ utility (not tests/) since production actions need it. The values are stable seed-data.
- **cascade-options.ts type==='system' removed**: `CategoryWithSubCategories.type` is `'in'|'out'|'allocation'|'transfer'|null` since Plan 03 — `'system'` is not in the union. The skip condition is null-only. Test fixture updated accordingly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript error: `type === 'system'` comparison unreachable**
- **Found during:** Task 2 (build verification)
- **Issue:** `CategoryWithSubCategories.type` is narrowed to `'in'|'out'|'allocation'|'transfer'|null` (Plan 03). The new `buildDirectionNatureMap` initially had `if (cat.type === 'system' || cat.type === null)` — TS reports "types have no overlap" on the `'system'` check.
- **Fix:** Changed skip condition to `=== null` only; updated `buildCategorySubcategoryMap` and JSDoc to match; updated test fixture from `type: 'system'` to `type: null`
- **Files modified:** lib/utils/cascade-options.ts, tests/cascade-options.test.ts
- **Verification:** yarn build exits 0; 969 tests pass
- **Committed in:** 90cd2ac (Task 2 commit)

**2. [Rule 1 - Bug] category-actions.test.ts expected natureId: null (stale after write-path fix)**
- **Found during:** Task 3 (test run after nature write-path fix)
- **Issue:** Test was written with Phase 46 comment "natureId resolution deferred to Phase 49 — action passes natureId: null for compile". After fix, action passes real natureId (5 for 'debt').
- **Fix:** Updated test assertion to expect `natureId: 5` for 'debt'; updated description string
- **Files modified:** tests/category-actions.test.ts
- **Verification:** 969 tests pass
- **Committed in:** 051e93a (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs)
**Impact on plan:** Both fixes required for TypeScript correctness and test accuracy. No scope change.

## Known Stubs

None — all `TODO(Phase 49)` markers cleared from the 5 plan-owned files.

## Threat Flags

No new threat surface introduced.

- T-49-05-01 (Tampering — natureId from nature code): mitigated. `NATURE_ID_BY_CODE` is a closed lookup; unknown codes return `undefined ?? null`, rejecting the write. Zod validation + visibility check preserved.
- T-49-05-02 (EoP — subcategory override write): mitigated. `verifySession()` + `isSubCategoryVisibleToUser` unchanged.

## Self-Check

- `lib/utils/cascade-options.ts` exports `buildDirectionNatureMap`: confirmed
- Plan 01 CAT-01 test GREEN: 969 tests pass (confirmed)
- No `key: 'type'` filter in transactions.table.ts or expenses.table.ts: confirmed
- `setSubcategoryNatureAction` passes real `natureId` (not null): confirmed
- `grep -c 'TODO(Phase 49)'` = 0 for all 5 plan files: confirmed
- Commits de0621a, 90cd2ac, 051e93a exist: confirmed

## Self-Check: PASSED

---
*Phase: 49-dashboard-and-surfaces*
*Completed: 2026-06-12*
