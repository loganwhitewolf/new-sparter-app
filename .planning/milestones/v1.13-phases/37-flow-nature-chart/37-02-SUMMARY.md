---
plan: 37-02
phase: 37-flow-nature-chart
status: complete
completed: 2026-05-25
self_check: PASSED
key-files:
  created:
    - drizzle/migrations/0012_flow_nature.sql
  modified:
    - lib/db/schema.ts
    - drizzle/migrations/meta/_journal.json
    - drizzle/migrations/meta/0012_snapshot.json
    - scripts/seed-data.ts
    - lib/dal/categories.ts
    - scripts/seed.ts
---

## Summary

Plan 37-02 landed the DB schema change for FlowNature and seeded all 126 system subcategories with default natures.

## Actual migration filename

Drizzle generated `0012_flippant_siren.sql` — renamed to `0012_flow_nature.sql` per artifact contract. Journal updated accordingly. A spurious `ALTER TABLE "platform" ALTER COLUMN "id" SET DATA TYPE serial` statement (pre-existing platform.id integer/serial snapshot drift) was removed from the migration SQL before applying.

## Nature distribution per bucket

| Nature | Count |
|--------|-------|
| essential | 30 |
| discretionary | 30 |
| financial | 26 |
| operational | 13 |
| extraordinary | 7 |
| debt | 3 |
| null (ignore) | 2 |
| **Total** | **126** |

## Edge cases requiring judgement

- **Category 3 (assicurazioni)**: assigned `operational` — insurance is a recurring obligation, not discretionary spending
- **Category 12 (investimenti OUT)**: assigned `financial` — outgoing investment purchases are financial flows
- **Category 18 (famiglia)**: assigned `essential` — includes babysitter/childcare which is essential
- **Category 34 (bonifici e rimborsi OUT)**: assigned `financial` — internal transfers/outgoing reimbursements
- **IN-type subs (cat 24-28)**: all assigned `financial` per RESEARCH Assumption A3
- **Category 28 (movimenti di liquidità)**: `financial` — liquidity movements between accounts
