# Phase 46: direction-nature-schema - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-10
**Phase:** 46-direction-nature-schema
**Areas discussed:** Nature row count (8 vs 9), Phase 46↔48 boundary, Where lookup rows live, exclude_from_totals timing

---

## A — Nature row count (8 vs 9)

| Option | Description | Selected |
|--------|-------------|----------|
| 8 rows, NULL = uncategorized | 8 real nature rows; sub_category.nature_id NULL = uncategorized. Coherent with direction_id NOT NULL and CONTEXT.md. | ✓ |
| 9 rows with uncategorized sentinel | Adds a 9th `uncategorized` nature; would need a sentinel direction or nullable direction_id — breaks the locked model. | |

**User's choice:** 8 rows, NULL = uncategorized.
**Notes:** Resolves the carried 8-vs-9 planning risk. The "9" references in CONTEXT.md / working-doc / DATA-02 are stale → correct to 8 (doc-cleanup follow-up).

---

## B — Phase 46 ↔ Phase 48 boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Only schema.ts + green build | New tables, nature_id FK, remove deprecated, relations/types + minimal call-site edits for typecheck. No generate, no DB apply. | ✓ |
| schema.ts + also generate migration | Emit SQL via drizzle-kit generate in 46. Pre-empts Phase 48; risks regeneration when 47 reshapes taxonomy. | |

**User's choice:** Only schema.ts + green build.
**Notes:** SQL migration + backfill = Phase 48; dashboard/aggregation correctness = Phase 49. "Done" for 46 = target schema.ts + typecheck/build green.

---

## C — Where the static direction(4) + nature(8) rows live

| Option | Description | Selected |
|--------|-------------|----------|
| New baseline blocks in seed-data.ts | Foundational reference data → idempotent baseline blocks. New tables, not shipped shapes → additive rule respected. | ✓ |
| Step in seed-extras.ts | seed-extras is for filling new columns on existing rows; static rows of new tables are semantically out of place. | |
| INSERT inside the SQL migration | Couples reference data to the migration, against the seed-as-source-of-truth pattern. | |

**User's choice:** New baseline blocks in seed-data.ts.
**Notes:** seed-extras stays for nature_id backfill on existing rows (Phase 47). Rows materialize when Phase 48 runs migrate + seed.

---

## D — exclude_from_totals timing

| Option | Description | Selected |
|--------|-------------|----------|
| Remove in 46 with the other deprecated columns | Coherent with DATA-06 / SC#6. Single source of truth = direction.included_in_totals. | |
| Keep until Phase 49 rewires totals | Keep column as fallback during transition. Contradicts SC#6/DATA-06 but avoids two truths mid-transition. | ✓ |

**User's choice:** Keep until Phase 49 rewires totals.
**Notes:** ⚠ DEVIATION from Phase 46 Success Criterion #6 / DATA-06. Effect: DATA-06 / SC#6 reassigned to Phase 49. Phase 46 removes only `category.type` (+enum+index) and `amount_sign` (+enum), NOT `exclude_from_totals`. REQUIREMENTS.md traceability to update.

---

## Claude's Discretion

- FK `onDelete` behavior, exact column types/lengths, `relations()` wiring, and the mechanical shape of build-survival call-site edits — left to research/planning; they don't change the locked model.

## Deferred Ideas

- exclude_from_totals removal → Phase 49.
- Doc cleanup of stale "9 nature" references → quick task.
- REQUIREMENTS.md traceability update (DATA-06: Phase 46 → Phase 49).
- Dashboard / KPI / aggregation rewrite + cascade-options + table filters → Phase 49.
- Explicit transaction pairing → Phase 50.
