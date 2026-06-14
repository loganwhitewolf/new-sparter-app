---
id: 260530-bib
slug: description-strip-pattern
status: complete
date: 2026-05-30
---

# Quick Task 260530-bib: DescriptionStripPattern on Platform — SHIPPED

Nullable `descriptionStripPattern` column on `platform` to strip bank boilerplate
from imported descriptions (e.g. Fineco). Shipped: migration 0015, schema column,
strip applied in `lib/services/import.ts`, and the Fineco pattern seeded via a
`seed-extras.ts` STEP. Closed retroactively at v2.0 milestone — the PLAN was left
at `in_progress` but the work is in production.
