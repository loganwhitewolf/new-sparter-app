---
slug: seed-nature-fix
date: 2026-05-26
status: in_progress
---

# Quick Task: seed-nature-fix

## Goal

Fix the seed flow for FlowNature values on system subcategories.

The previous implementation added `nature` inline to every `subCategories` entry in `seed-data.ts`,
but `seed.ts` uses `onConflictDoNothing()` for the insert — so existing rows are skipped and nature
is never written.

## Tasks

1. Remove `nature` field from all entries in `scripts/seed-data.ts` (revert to original shape)
2. Create `scripts/seed-nature.ts` — a dedicated, idempotent script that UPDATEs `sub_category.nature`
   by slug using the same DB connection infrastructure as `seed.ts`
3. Add `db:seed-nature` script to `package.json`
4. Commit

## Constraints

- `seed-data.ts` shape must be compatible with the existing `seed.ts` insert (no `nature` column)
- `seed-nature.ts` must be idempotent (re-running is safe)
- null-nature slugs (trasferimento, addebito-carta-di-credito) are already null — no UPDATE needed
- Use same DB config infrastructure as `seed.ts` (loadOperatorEnv, resolveOperatorDatabaseTarget, etc.)
