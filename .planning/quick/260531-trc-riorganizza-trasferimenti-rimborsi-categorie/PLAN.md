---
slug: 260531-trc
status: complete
date: 2026-05-31
---

# Riorganizza categorie Trasferimenti e Rimborsi

Implement domain decisions from CONTEXT.md grilling session: introduce `transfer` enum value,
rename cat 32 "ignore" → "Trasferimenti", deactivate cat 28, update cat 26 rename + subcategory changes,
and replace all slug-based ignore/system filters in dashboard DAL with type-based transfer filter.

## Tasks

1. Add `transfer` to `categoryTypeEnum` and `flowNatureEnum` in schema.ts
2. Add `transfer` to `FlowNature` type in nature-labels.ts (with label, order, color)
3. Run `yarn drizzle-kit generate` for migration SQL
4. Add seed-extras step `reorganize-transfer-rimborsi-categories`
5. Replace all `ignore`/`system` filter logic in dashboard.ts with `transfer` type checks
6. Update type annotations in categories.ts
7. Fix downstream TS errors (category-settings-panel, test files)
