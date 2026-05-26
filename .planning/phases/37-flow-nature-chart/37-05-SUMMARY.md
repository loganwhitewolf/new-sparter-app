---
plan: 37-05
phase: 37-flow-nature-chart
status: complete
commits:
  - dabd7bb
  - 08246f9
requirements_satisfied:
  - R-FN-07
  - R-FN-09
---

# Plan 37-05 Summary — Settings UI: Nature Creation + Inline Override

## What shipped

**Task 1 — Validation, action, and DAL layer:**

- `lib/validations/category.ts`: added `NatureSchema` (z.enum over 6 values matching `flow_nature` pgEnum), `SetSubcategoryNatureSchema` (subCategoryId + nullable nature), extended `CreateSubcategorySchema` to require `nature` as a non-optional field. `SetSubcategoryNatureInput` type exported.
- `lib/dal/categories.ts`: `createUserSubcategory` now accepts and writes `nature: FlowNature`. New `upsertSubcategoryNatureOverride` helper does INSERT…onConflictDoUpdate on `(userId, subCategoryId)` updating only the `nature` column.
- `lib/actions/categories.ts`: `createSubcategoryAction` extended to parse `nature` from FormData. New `setSubcategoryNatureAction` (typed input, not FormData): validates via `SetSubcategoryNatureSchema`, calls `upsertSubcategoryNatureOverride`, calls `revalidateCategorizationSurfaces()`, returns `{ ok: true } | { ok: false; error: string }`.

**Task 2 — UI components and wire-up:**

- `components/categories/subcategory-nature-select.tsx` (new): `'use client'` Select bound to `setSubcategoryNatureAction` via `useTransition`. Includes `'unclassified'` sentinel → stored as `null`, falling back to seed default via DAL COALESCE (D-09).
- `components/categories/category-mutation-dialogs.tsx`: `CreateSubcategoryDialog` gains a required Natura Select with `defaultValue="discretionary"` and 6 options (no `unclassified` — nature is required on creation per CONTEXT D-07).
- `components/categories/category-settings-panel.tsx`: `SubcategoryNatureSelect` rendered per subcategory row bound to `sub.effectiveNature`.

**Tests updated:**

- `tests/category-actions.test.ts`: mocks wired for `upsertSubcategoryNatureOverride` + `setSubcategoryNatureAction`, `createSubcategoryAction` test updated to include `nature: 'essential'`. Also fixed pre-existing drift: `/import` added to `EXPECTED_CATEGORY_REVALIDATION_ROUTES` (commit `4a722f2` had added it to production but not the test constant). New `describe('setSubcategoryNatureAction')` block with 4 tests (ok:true with nature, ok:true with null, validation failure, auth failure).
- `tests/category-settings-ui.test.tsx`: `setSubcategoryNatureAction` mock added, `effectiveNature` added to fixture subcategories, 2 new tests (SubcategoryNatureSelect present, Natura label in CreateSubcategoryDialog).

## Key decisions

- **Default nature on creation: `discretionary`** — rationale: most new user-created subcategories are lifestyle/optional spend. Setting `essential` as default would front-load false budget constraints. `discretionary` is the correct defensive default per CONTEXT.md D-07.
- **`unclassified` sentinel vs. `null` in Select** — the Select uses `'unclassified'` as the display value but stores `null` on the override row; DAL COALESCE then falls through to the seed default. This keeps the DB semantics clean (null = "no explicit override") while giving the UI a concrete option to select.
- **Row layout** — `SubcategoryNatureSelect` is placed before `RenameSubcategoryDialog` in the subcategory row. No layout constants were needed; the select is `w-[160px] h-8 text-xs` to stay inline with existing icon buttons.
- **`setSubcategoryNatureAction` revalidation** — calls the same `revalidateCategorizationSurfaces()` as all other category mutations (`/expenses`, `/transactions`, `/dashboard`, `/settings/categories`, `/import` layout). This ensures the chart in overview updates without a hard reload after a nature change.

## Test suite state at completion

53 test files PASS. 2 pre-existing failures unrelated to Phase 37:
- `tests/categorization-revalidation-actions.test.ts` — pre-existing import resolution issue
- `tests/pattern-actions.test.ts` — pre-existing mock drift

`yarn check:language` PASS.
