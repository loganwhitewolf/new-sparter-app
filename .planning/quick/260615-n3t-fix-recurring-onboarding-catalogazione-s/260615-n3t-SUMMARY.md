---
phase: 260615-n3t
plan: 01
subsystem: onboarding
tags: [onboarding, categorization, theme, dal, regression-guard]
requires:
  - lib/validations/onboarding.ts
  - lib/dal/transactions.ts
provides:
  - onboardingThemeForStep(step) — documented step→theme source of truth
  - getTopExpensesForOnboarding(userId, limit) — stable top-15 incl. categorized rows
  - SubcategoryCombobox initialCategorized / initialSubcategoryName props
affects:
  - app/(app)/onboarding/page.tsx
  - app/(app)/onboarding/_components/step-4-categorize.tsx
  - app/(app)/onboarding/_components/subcategory-combobox.tsx
tech-stack:
  added: []
  patterns:
    - "Pure exported mapping fn + regression test as executable spec for a recurring bug"
    - "Stable server-fetched list + server-seeded client state to survive revalidatePath + refresh"
key-files:
  created: []
  modified:
    - lib/validations/onboarding.ts
    - tests/onboarding-step-validation.test.ts
    - app/(app)/onboarding/page.tsx
    - lib/dal/transactions.ts
    - tests/transactions-dal.test.ts
    - app/(app)/onboarding/_components/step-4-categorize.tsx
    - app/(app)/onboarding/_components/subcategory-combobox.tsx
    - tests/onboarding-page.test.tsx
    - CONTEXT.md
decisions:
  - "Step 4 is the only light-theme step; mapping lives in onboardingThemeForStep, not inline in page.tsx"
  - "Onboarding categorize list is stable (no IS NULL filter); categorized rows render with a persistent green check"
  - "Done-state derives from remaining===0 in the fetched set, not from an empty list"
metrics:
  duration: ~10m
  completed: 2026-06-15
  tasks: 3
  files: 9
---

# Phase 260615-n3t Plan 01: Fix recurring onboarding step-4 categorization bugs — Summary

Permanently fixed two recurring onboarding step-4 bugs (light-theme regression, vanishing categorized row) by replacing brittle inline logic with a documented pure mapping function and a stable server-fetched list, each guarded by a regression test that serves as the executable spec.

## What was done

### Task 1 — Guard the step→theme mapping (Bug 1) — commit `2b75bde`
- Added exported pure `onboardingThemeForStep(step: 1|2|3|4|5): 'light' | 'dark'` in `lib/validations/onboarding.ts`, returning `'light'` only for step 4. Doc comment states the invariant and why step 4 is light (its card UI is designed against the onboarding-light palette; other steps use the dark hero).
- Added a `describe('onboardingThemeForStep …')` block asserting step 4 → `'light'` and steps 1,2,3,5 → `'dark'` (written RED first, confirmed failing with `is not a function`, then GREEN).
- `app/(app)/onboarding/page.tsx` now imports and calls the function instead of the inline `step === 4 ? "light" : "dark"` ternary; a comment points to the function as the source of truth. `OnboardingShell` wiring unchanged.

### Task 2 — Stable top-15 query incl. categorized rows (Bug 2, data layer) — commit `2b206c0`
- Added `getTopExpensesForOnboarding(userId, limit = 15)` to `lib/dal/transactions.ts`, modeled on `getTopUncategorizedExpenses` (DISTINCT ON description_hash, `total_amount::numeric < 0`, ORDER BY description_hash + ABS DESC, limit hard-capped at 100, JS-side |amount| DESC re-sort, wrapped in react `cache()`) but **without** the `sub_category_id IS NULL` predicate, so the list is stable across categorization.
- LEFT JOINs `sub_category` and selects `sub_category_id` + canonical `name` (`subCategoryName`). `user_subcategory_override` intentionally not joined (documented non-goal).
- Exported `TopOnboardingExpenseRow = TopUncategorizedExpenseRow & { subCategoryId, subCategoryName }`. `getTopUncategorizedExpenses` left untouched (additive).
- Added a `describe('getTopExpensesForOnboarding …')` block (RED → GREEN) including the regression guard asserting the SQL does **not** contain `sub_category_id IS NULL`, plus dedupe/order/limit-default/limit-passthrough/100-cap/JS-sort assertions.

### Task 3 — Persistent green check + done-state rework (Bug 2, view layer + docs) — commit `1434308`
- `subcategory-combobox.tsx`: added optional `initialCategorized?` / `initialSubcategoryName?` props; `isCategorized` now initializes from `initialCategorized ?? false` so an already-categorized expense shows the green check on the first server render. Optimistic client flow (`submittedRef` + `useEffect`) retained. Invariant comment added at the green-check branch; the canonical subcategory name renders as a subtle sub-label when present.
- `step-4-categorize.tsx`: swapped `getTopUncategorizedExpenses` → `getTopExpensesForOnboarding`; passes `initialCategorized={expense.subCategoryId !== null}` and `initialSubcategoryName`. Derives `remaining = expenses.filter(e => e.subCategoryId === null).length`; subtitle shows `{remaining} da completare`; the "Tutto categorizzato!" done-card now appears when `remaining === 0` (or genuinely empty list), not when `expenses.length === 0`.
- `CONTEXT.md`: appended a step-4 invariants sub-note (theme, stable list + persistent check, done-state semantics) under the Onboarding entry as the human-readable companion to the test spec.
- `lib/actions/onboarding.ts` left untouched — `revalidatePath('/onboarding')` is now safe because the list is stable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated onboarding-page test mock to the new DAL export**
- **Found during:** Task 3 (full suite run)
- **Issue:** `tests/onboarding-page.test.tsx` mocks `@/lib/dal/transactions` with only `getTopUncategorizedExpenses`. After Step4 switched to `getTopExpensesForOnboarding`, three tests failed with "No export is defined on the mock".
- **Fix:** Replaced the hoisted mock fn, the `vi.mock` export, the resolved fixture (added `subCategoryId: null`, `subCategoryName: null`), and the call assertion to reference `getTopExpensesForOnboarding`.
- **Files modified:** tests/onboarding-page.test.tsx
- **Commit:** 1434308

**2. [Note] SQL columns left unqualified where unambiguous**
- The plan suggested aliasing the expense table (`FROM expense e …`). The Task-2 behavior assertions, however, check for unqualified `DISTINCT ON (description_hash)` / `ORDER BY description_hash, ABS(total_amount::numeric) DESC`. Final SQL leaves those columns unqualified (they exist only on `expense`) and qualifies only `expense.id` to disambiguate from `sub_category.id`. Behavior is identical; the locked decision (stable list, no IS NULL, subcategory name joined) is fully honored.

## Out-of-scope (pre-existing, not introduced by this task)

These existed before this task and were left untouched:
- **tsc:** 6 errors in `tests/cascade-options.test.ts` (TS18050 ×4) and `tests/category-combobox.test.tsx` (TS2322 ×2). No diff in these files since base commit `38fb12f`; none of the task-touched files produce tsc errors.
- **`yarn check:language`:** 8 flags in `components/dashboard/overview/overview-movers-panel.tsx`, `tests/fixtures/v2-taxonomy-manifest.ts`, `tests/subcategory-picker.test.tsx`, `tests/suggestion-promote-form.test.tsx`. None are in task-touched files; this task introduced zero new flags.

## Verification

- `yarn test` — 85 files, 1043 passed, 1 todo (full suite green), including the new theme block and the new DAL block.
- `npx tsc --noEmit` — no errors in any task-touched file (6 pre-existing errors in two untouched test files, documented above).
- `yarn check:language` — no new flags from this task's changes (8 pre-existing flags in untouched files, documented above).

## Self-Check: PASSED

- FOUND: lib/validations/onboarding.ts (onboardingThemeForStep)
- FOUND: lib/dal/transactions.ts (getTopExpensesForOnboarding, TopOnboardingExpenseRow)
- FOUND commit 2b75bde (Task 1)
- FOUND commit 2b206c0 (Task 2)
- FOUND commit 1434308 (Task 3)

## Correction (2026-06-15, post-execution)

The theme requirement above was **inverted**. The light theme on step 4 was the *recurring bug*, not the desired state — every onboarding step (including step 4) must be **dark**. Superseding the "light" statements above:

- `onboardingThemeForStep` now returns `'dark'` for ALL steps (no step-4 special case); the regression test asserts step 4 → `'dark'` (commit `bfde492`).
- The subcategory picker (a Radix Sheet that portals to `<body>`, so it followed the app/system theme and appeared light) now takes an opt-in `dataTheme` prop; the onboarding combobox passes `"onboarding-dark"` (commit `f2cabb5`). Other 6 picker call sites unchanged.
- Also fixed a runtime bug in `getTopExpensesForOnboarding`: `user_id`/`sub_category_id` were ambiguous after the `LEFT JOIN sub_category` (sub_category also has `user_id`) — qualified with `expense.` (commit `0a97adf`). The DAL unit test mocks the result, so it didn't catch the real-Postgres ambiguity.
