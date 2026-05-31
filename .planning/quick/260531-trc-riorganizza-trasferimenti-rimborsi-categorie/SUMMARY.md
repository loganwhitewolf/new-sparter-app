---
slug: 260531-trc
status: complete
date: 2026-05-31
---

# Summary: Riorganizza categorie Trasferimenti e Rimborsi

All domain decisions from the grilling session implemented and type-checked cleanly.

## Changes delivered

- `lib/db/schema.ts`: `categoryTypeEnum` + `flowNatureEnum` extended with `transfer`
- `lib/utils/nature-labels.ts`: `FlowNature` type, `NATURE_LABELS`, `NATURE_ORDER`, `NATURE_COLORS` include `transfer`
- `drizzle/migrations/0016_chunky_pet_avengers.sql`: `ALTER TYPE ... ADD VALUE 'transfer'` for both enums
- `scripts/seed-extras.ts`: step `reorganize-transfer-rimborsi-categories` — cat 32 renamed to Trasferimenti (type transfer), cat 28 deactivated, cat 26 renamed with subcategory updates, new subcategories inserted
- `lib/dal/dashboard.ts`: all `ne(category.slug, 'ignore')` + `ne(category.type, 'system')` replaced with `ne(category.type, 'transfer')`; `notIgnoredCategory` → `notTransferCategory`; inline SQL updated; type annotations extended
- `lib/dal/categories.ts`: `CategoryWithSubCategories.type` extended with `'transfer'`
- `components/categories/category-settings-panel.tsx`: `TYPE_LABELS` + `TYPE_ORDER` include `transfer`
- `tests/dashboard-dal.test.ts` + `tests/nature-labels.test.ts`: updated for new enum values

## Verification

- `yarn tsc --noEmit`: 0 errors
- `yarn test --run`: nature-labels and dashboard-dal tests all pass; 5 pre-existing onboarding failures unrelated to this task
