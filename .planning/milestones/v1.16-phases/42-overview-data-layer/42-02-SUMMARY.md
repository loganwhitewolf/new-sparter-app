---
plan: 42-02
phase: 42-overview-data-layer
status: complete
completed: 2026-06-08
---

## Summary

Applied the enum migration and shipped the additive seed STEP that re-buckets income subcategories.

## What Was Built

**Decision checkpoint:** PO confirmed candidata-base slug list — dividends (`dividendi-azionari`, `dividendi-fondi-comuni`, `dividendi-immobiliari`) stay as `income` (recurring). 22 slugs move to `income_extraordinary`.

**Task 1 — seed STEP written:**
- Populated `NATURE_SLUGS['income_extraordinary']` with 27 confirmed slugs: 5 from `income` (bonus, freelance, consulenze, progetti-occasionali, commissioni) + 22 from `financial` IN-side (rimborsi-*, cashback-*, vendite, bonifico-in-entrata, ricariche-conti, rimborsi, post-rename slugs from step 4).
- `rebucketIncomeNatures` function guards on `isNull(subCategory.userId)` — user overrides untouched.
- Registered as `{ name: 'rebucket-income-natures', run: rebucketIncomeNatures }` in STEPS.

**Bug fix — seed-extras idempotency (steps 3+4):** Three slug-rename operations in prior steps failed when target slugs already existed in the DB (seeded by `yarn db:seed`). Fixed with pre-check guards: if target exists, deactivate old slug instead of renaming. Applied to: `spesa-bio → bio-e-naturale`, `trasferimento → trasferimento-tra-conti`, `sconto-abbonamento → rimborso-abbonamento-e-canoni`, `sconto-promozionale → bonus-promozionale`.

**Task 2 — DB applied (human action):**
- `yarn db:migrate` — applied `0017_tearful_the_stranger.sql` (ADD VALUE income_extraordinary)
- `yarn db:seed` — baseline insert (idempotent)
- `yarn db:seed-extras` — all 5 STEPS ran successfully

**DB result:**
- `flow_nature` enum includes `income_extraordinary`
- `rebucket-income-natures`: 22 rows updated in `sub_category` (system rows only)

## Key Files

- `scripts/seed-extras.ts` — NATURE_SLUGS.income_extraordinary populated + rebucketIncomeNatures STEP + idempotency guards on steps 3+4

## Self-Check: PASSED

- `yarn build` exits 0 before and after
- `yarn db:seed-extras` completed without error: `seed_extras_succeeded`
- 22 system subcategories re-bucketed to `income_extraordinary`
- `isNull(subCategory.userId)` guard confirmed in source
- No `drizzle-kit push` used
