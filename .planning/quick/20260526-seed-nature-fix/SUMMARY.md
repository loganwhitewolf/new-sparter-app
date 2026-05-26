---
slug: seed-nature-fix
date: 2026-05-26
status: complete
---

# Summary: seed-nature-fix

## What changed

- `scripts/seed-data.ts`: removed `nature` field from all 126 `subCategories` entries (INSERT shape is now compatible with `onConflictDoNothing()`)
- `scripts/seed-nature.ts` (new): dedicated script that UPDATEs `sub_category.nature` by slug — idempotent, grouped by nature value
- `package.json`: added `db:seed-nature`, `db:seed-nature:staging`, `db:seed-nature:production` scripts
- `tests/categories-dal.test.ts`: added missing `nature: 'essential'` to one `createUserSubcategory` call that was hitting the required-field TS error

## Run order

```bash
yarn db:migrate       # apply 0012_flow_nature.sql (if not already done)
yarn db:seed          # insert categories/subcategories (no nature — idempotent)
yarn db:seed-nature   # set nature on all system subcategories via UPDATE
```
