---
quick_id: 260531-fko
slug: riorganizza-sottocategorie-spesa-categor
description: Riorganizza sottocategorie Spesa (categoryId 8)
date: 2026-05-31
status: complete
commits:
  - aff40ad
  - f979ae1
---

# Quick Task 260531-fko: Riorganizza sottocategorie Spesa

## What was done

Reorganized the Spesa (categoryId 8) subcategory taxonomy to align entries with store type rather than product type.

### scripts/seed-data.ts
- Added 4 new active system subcategory rows under categoryId 8: `discount`, `negozio-di-quartiere`, `mercato-rionale`, `drogheria-e-casalinghi`
- Updated the macelleria/pescheria categorization pattern slug from `prodotti-freschi` → `negozio-di-quartiere` (fresh installs get the correct target)

### scripts/seed-extras.ts
- Extended imports: added `and`, `isNull`, `sql` from drizzle-orm; added `categorizationPattern`, `expense` from schema
- Added step 3 `reorganize-spesa-subcategories` with migrate-before-deactivate ordering:
  1. Rename spesa-bio → bio-e-naturale (name + slug)
  2. Set `nature='essential'` on 4 new slugs
  3. Resolve system subcategory IDs for source/target rows
  4. Migrate `expense.subCategoryId`: prodotti-freschi → negozio-di-quartiere
  5. Migrate `expense.subCategoryId`: prodotti-non-alimentari → drogheria-e-casalinghi
  6. Migrate `categorizationPattern.subCategoryId`: prodotti-freschi → negozio-di-quartiere
  7. `SET isActive=false` on prodotti-freschi and prodotti-non-alimentari (AFTER all migrations)

## Final taxonomy (categoryId 8)

| Slug | Status |
|---|---|
| supermercato | unchanged |
| discount | new |
| negozio-di-quartiere | new |
| mercato-rionale | new |
| drogheria-e-casalinghi | new |
| bio-e-naturale | renamed from spesa-bio |
| spesa-online | unchanged |
| prodotti-freschi | isActive=false (after migration) |
| prodotti-non-alimentari | isActive=false (after migration) |

## Operator run order

```bash
yarn db:seed          # inserts 4 new rows (onConflictDoNothing)
yarn db:seed-extras   # renames, sets nature, migrates, deactivates
```

The seed-extras step is idempotent — safe to re-run.
