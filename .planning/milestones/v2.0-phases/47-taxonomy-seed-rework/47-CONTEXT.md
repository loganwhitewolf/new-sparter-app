# Phase 47: taxonomy-seed-rework - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning
**Source:** Handoff post-Phase 46 — design LOCKED (no discuss-phase needed)

<domain>
## Phase Boundary

Deliver the v2.0 taxonomy in seed scripts:

1. **`scripts/seed-data.ts`** — baseline taxonomy for fresh installs: **23 categories / ~65 subcategories** per `.planning/nature-remapping-WORKING.md`, each subcategory carrying `natureId` FK (8 nature codes).
2. **`scripts/seed-extras.ts`** — additive STEPS to (a) backfill `nature_id` on existing `sub_category` and `user_subcategory_override` rows in deployed DBs, and (b) perform slug-level remap operations (rename/merge/deactivate/insert) that cannot be expressed by baseline insert alone.

**This phase is seed authorship only.** No SQL migration (`drizzle-kit generate`), no DB apply, no transaction recategorization, no dashboard/filter rewrite.

**Out of scope (other phases):**
- `drizzle-kit generate` + `scripts/migrate.ts` + column drops → Phase 48
- Transaction/pattern recategorization on live data → Phase 48
- Dashboard, KPI, cascade-options, table filters → Phase 49

</domain>

<decisions>
## Implementation Decisions

### A — Locked taxonomy (do NOT re-derive)
- **D-01:** Final remap is **certified** in `.planning/nature-remapping-WORKING.md` (2026-06-09): 4 IN + 16 OUT + 2 ALLOCATION + 1 TRANSFER categories; ~65 subcategories; 8 natures (`income`, `income_extraordinary`, `essential`, `discretionary`, `debt`, `transfer`, `savings`, `investment`). Uncategorized = `nature_id NULL`.
- **D-02:** Dissolutions/renames per working doc: `operational` dissolved; `financial`→`investment`, `extraordinary`→`savings`; wrapper cats (Assicurazioni, Abbonamenti, Famiglia) distributed; Risparmio+Investimenti → ALLOCATION; liquidità/bonifici → TRANSFER.
- **D-03:** Pruning principle: minimise categories/subcats; merges listed in working doc are authoritative; dropped slugs (overtime, rimborso-*, store-type splits) must be deactivated or not re-seeded.

### B — Phase 47 ↔ Phase 46 / 48 boundary
- **D-04:** Phase 46 shipped schema (`sub_category.nature_id` FK), lookup rows (`direction` 4 + `nature` 8) in `seed-data.ts`, and build-survival seed repairs. Phase 47 **does not** re-open schema or lookup row definitions.
- **D-05:** **No `drizzle-kit generate` / DB apply** in Phase 47 (same as D-06 in Phase 46). Done = seed scripts + tests/build green. Physical DB transform is Phase 48.
- **D-06:** `seed-extras` step 1 (`setSubcategoryNature`) is **broken** post-Phase 46 (`sub_category.nature` column removed). Phase 47 must replace it with `nature_id` FK backfill — not defer to Phase 49.

### C — Additive seed model (resolve the tension)
- **D-07:** **Fresh-install baseline:** `seed-data.ts` `categories` + `subCategories` arrays are **replaced wholesale** with the v2 taxonomy (new slugs, merges, `natureId` on every subcategory). Rationale: v2.0 milestone; old 26-cat/~120-subcat baseline is obsolete for new environments. Phase 46 already established that **new table blocks** in seed-data are allowed; a milestone-level taxonomy replacement is the same class of change as the working-doc contract — not "adding a column to an already-shipped shape."
- **D-08:** **Deployed DBs:** all transforms on rows that already exist from the v1 baseline insert (`onConflictDoNothing`) go through **new additive STEPS** in `seed-extras.ts`: slug rename map, merge migrations (expense/pattern pointers per step 3 idiom), `isActive=false` for pruned slugs, INSERT for net-new slugs/categories, `nature_id` UPDATE by slug→nature code lookup.
- **D-09:** Do **not** edit historical STEPS 1–5 bodies except where they fail to compile (build-survival). Append new STEPS for v2 remap; obsolete step 1 becomes no-op or is superseded by a new step that sets `nature_id`.
- **D-10:** `categorization_pattern` rows in `seed-data.ts` must remain **sign-agnostic** (no `amountSign`); remap step must update `subCategoryId` when subcategory slugs merge (Phase 48 may also handle — but seed-extras should cover pattern pointer fixes for taxonomy merges).

### D — nature_id wiring
- **D-11:** `natureId` on subcategories in `seed-data.ts` uses explicit integer IDs matching the `natures` array in seed-data (1–8), same idiom as Phase 46 `directionId` on natures.
- **D-12:** `seed-extras` backfill resolves nature by **code** (`essential`, `savings`, etc.) via SELECT from `nature` table — never hardcode stale enum strings.
- **D-13:** System subcategories (`trasferimento`, `addebito-carta-di-credito`) get `nature_id` for `transfer`; `excludeFromTotals` stays until Phase 49 (D-10 from Phase 46).

### Claude's Discretion
- Exact STEP ordering/wave split in seed-extras (rename before merge vs category dissolution order), test fixture updates, and whether to add a taxonomy validation script are left to research/planning.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked design contract
- `.planning/nature-remapping-WORKING.md` — final 23-cat / ~65-subcat remap, slug merges, drops, nature per subcat
- `docs/adr/0012-direction-derived-from-nature-allocation.md` — nature→direction model
- `CONTEXT.md` — nature/direction vocabulary, netting rules

### Requirements
- `.planning/REQUIREMENTS.md` — TAX-01, TAX-02, TAX-03

### Prior phase outputs
- `.planning/phases/46-direction-nature-schema/46-CONTEXT.md` — D-07/D-08/D-09 seed boundaries, 8 nature rows
- `.planning/phases/46-direction-nature-schema/46-03-SUMMARY.md` — directions/natures baseline seed pattern

### Code to modify
- `scripts/seed-data.ts` — categories, subCategories (+ existing directions/natures blocks)
- `scripts/seed-extras.ts` — STEPS array
- `scripts/seed.ts` — insert wiring if shapes change
- Tests/fixtures importing seed-data shapes (grep `seed-data`)

</canonical_refs>

<specifics>
## Specific Ideas

- Follow **step 3 (reorganize-spesa)** idiom: migrate expenses + patterns BEFORE deactivating deprecated rows.
- Category 32 `ignore` → `Trasferimenti` rename already partially done in step 4; v2 step completes transfer taxonomy.
- Income side: cat 28 deprecated; new cats `pensioni-e-sussidi`, merged `entrate-straordinarie`, renamed `rendite`.

</specifics>

<deferred>
## Deferred Ideas

- Transaction recategorization for misclassified rows (vendita-investimenti, etc.) → Phase 48
- Pattern sign-agnostic DB migration → Phase 48 (46-03 repaired seed-extras dedupe only)
- `exclude_from_totals` removal → Phase 49

</deferred>

---

*Phase: 47-taxonomy-seed-rework*
*Context gathered: 2026-06-11 via handoff (design LOCKED)*
