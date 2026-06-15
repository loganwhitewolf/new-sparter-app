# Phase 46: direction-nature-schema - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Bring `lib/db/schema.ts` to the single-source-of-truth `nature → direction` model:

- `direction` lookup table (4 static rows: `in`, `out`, `allocation`, `transfer`) with analytical attributes (`net_worth_effect`, `included_in_totals`, `shown_separately`, `hidden`, `display_order`, `color`, `label_it`).
- `nature` lookup table with a `direction_id` NOT NULL FK, `code`, `label_it`, `color`, `display_order`.
- `sub_category.nature_id` and `user_subcategory_override.nature_id` FK columns to `nature`, replacing the `flow_nature` enum column.
- Remove `category.type` (`category_type` enum) + `category_type_idx`; remove `amount_sign` enum from `categorization_pattern` (unique constraint → `(pattern, subCategoryId)`).
- Define the static `direction` + `nature` rows in `seed-data.ts`.

**This phase is schema authorship only.** No SQL migration is generated here, no DB apply. Design is LOCKED (ADR 0012, CONTEXT.md, `nature-remapping-WORKING.md`) — discussion only resolved HOW/WHERE and one carried planning risk.

**Out of scope (other phases):**
- `drizzle-kit generate` + `scripts/migrate.ts` + data backfill/recategorization → Phase 48
- Taxonomy seed (23 cat / ~65 subcat) + `seed-extras.ts` nature_id population on existing rows → Phase 47
- Dashboard / KPI / aggregation rewrite, `cascade-options.ts`, table filters semantics → Phase 49
- Explicit transaction pairing → Phase 50

</domain>

<decisions>
## Implementation Decisions

### A — Nature row count (resolves the 8-vs-9 planning risk)
- **D-01:** `nature` has **8 rows**, not 9: `income`, `income_extraordinary` (IN); `essential`, `discretionary`, `debt` (OUT); `transfer` (TRANSFER); `savings`, `investment` (ALLOCATION).
- **D-02:** Uncategorized is modeled as **`sub_category.nature_id = NULL`**, not as a nature row. Rationale: `nature.direction_id` is a NOT NULL FK and the 4 directions are fixed/locked — a sentinel `uncategorized` nature would have no valid direction and would break the model. Confirmed by CONTEXT.md ("una transazione non categorizzata non ha nature → non ha direzione").
- **D-03:** The recurring `"9"` references (CONTEXT.md "Valori canonici (9)", working-doc summary, DATA-02 note) are **stale** and should be corrected to 8. Flag as a doc-cleanup follow-up (quick task), not a blocker.

### B — Phase 46 ↔ Phase 48 boundary
- **D-04:** Phase 46 modifies **only `lib/db/schema.ts`** — new `direction`/`nature` tables, `nature_id` FK columns, removal of deprecated columns/enums/index, plus updated Drizzle `relations()` and derived types.
- **D-05:** Phase 46 also makes the **minimal call-site edits required to keep `yarn build` / typecheck green** when `category.type` and `amount_sign` disappear. Full semantic correctness of dashboard/aggregation is explicitly Phase 49's job — Phase 46 only needs the build to compile.
- **D-06:** **No `drizzle-kit generate`, no DB apply** in Phase 46. "Done" = target `schema.ts` + green typecheck/build. The SQL migration that physically creates tables / drops columns is Phase 48.

### C — Where the static lookup rows live
- **D-07:** The 4 `direction` rows and 8 `nature` rows are defined as **new baseline blocks in `scripts/seed-data.ts`** (idempotent via `onConflictDoNothing`). They are foundational reference data present in every environment, not a backfill of existing rows.
- **D-08:** Adding insert blocks for the **new** `direction`/`nature` tables does **not** violate the additive-seed rule ("never edit shipped `seed-data.ts` shapes") — the rule protects already-shipped shapes; these are brand-new tables.
- **D-09:** `seed-extras.ts` is **not** used for the lookup rows. It remains reserved for populating `nature_id` on existing `sub_category` / `user_subcategory_override` rows — that is Phase 47's work. Rows physically materialize when Phase 48 runs migrate + seed.

### D — exclude_from_totals (DEVIATION from roadmap)
- **D-10:** `sub_category.exclude_from_totals` is **kept in Phase 46**, removed later in Phase 49 once aggregation is rewired to read `direction.included_in_totals`. User decision (architect override) to avoid two sources of truth during the transition window.
- **⚠ DEVIATION:** This **contradicts Phase 46 Success Criterion #6 and DATA-06**, which state the column is absent after Phase 46. Effect: DATA-06 / SC#6 are **reassigned to Phase 49**. Planner must scope Phase 46 to remove only `category.type` (+enum+index) and `amount_sign` (+enum), **not** `exclude_from_totals`. REQUIREMENTS.md traceability (DATA-06 → Phase 46) should be updated to Phase 49.

### Claude's Discretion
- FK `onDelete` behavior for `nature_id` / `direction_id`, exact column types/lengths, `relations()` wiring, and the mechanical shape of the build-survival call-site edits are left to research/planning — they don't change the locked model.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked design contract (read first — do NOT re-derive the model)
- `docs/adr/0012-direction-derived-from-flownature.md` — direction derived from nature; 4th direction `allocation`; the deprecation set (`category.type`, `flow_nature` enum, `amount_sign`/ADR 0008, sign-split aggregation, `exclude_from_totals`); NATURE-TABLE-01 data model (lookup tables, FK chain).
- `CONTEXT.md` §FlowNature / §Direction / §Disinvestimento / §Rimborso — canonical nature/direction vocabulary, the 8 nature codes and their direction mapping, null = uncategorized, algebraic-sum netting rules.
- `.planning/nature-remapping-WORKING.md` — final 23-cat / ~65-subcat remap, the "Data model & deprecations (NATURE-TABLE-01)" section, and the **DB certification (2026-06-09)** listing the exact schema objects to add/remove and the certified KEEP set.

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — DATA-01…DATA-06 (capability contract for this phase) + the "Nature row-count (8 vs 9)" planning risk note (now resolved → 8).
- `.planning/ROADMAP.md` §"Phase 46: direction-nature-schema" — goal + 6 success criteria (note SC#6 reassigned to Phase 49 per D-10).

### Superseded (context for removals)
- `docs/adr/0008-*` (amountSign derive-from-category) — **superseded by ADR 0012**; the derived-sign logic is removed in this phase.
- `docs/adr/0003`, `docs/adr/0004` — nature-on-subcategory (still valid) + algebraic-sum (now governs allocation netting).

### Current schema (the thing being changed)
- `lib/db/schema.ts` — `categoryTypeEnum` (L26), `amountSignEnum` (L42), `flowNatureEnum` (L52), `category.type` (L165) + `category_type_idx` (L172), `sub_category.excludeFromTotals` (L194) + `sub_category.nature` (L195), `user_subcategory_override.nature` (L220), `categorization_pattern.amountSign` (L431) + unique (L449).
- `scripts/seed-data.ts` — baseline insert blocks (categories L3, subCategories L222, platforms L1141, patterns L1271); add new `direction` + `nature` blocks here.
- `scripts/seed-extras.ts` — additive STEPS array (existing nature/category steps); reserved for Phase 47 nature_id backfill, not the lookup rows.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/seed-data.ts` exports plain arrays consumed by `scripts/seed.ts` with `onConflictDoNothing()` — add `direction`/`nature` arrays the same way (idempotent baseline insert).
- `lib/utils/nature-labels.ts` already maps nature codes to IT labels — cross-check against new `nature.label_it` rows for consistency.

### Established Patterns
- Lookup-table-vs-enum decision is already made in the contract (NATURE-TABLE-01): Postgres enum migrations are painful and natures are being renamed, so lookup tables with FK chain are the chosen pattern.
- Additive seed model: new tables get new baseline blocks; existing-row column fills go to `seed-extras.ts`.

### Integration Points
- `flowNatureEnum` (schema.ts L52) currently has 9 enum values including the to-be-dissolved `operational`, `financial`, `extraordinary` — the new `nature` table has 8 rows with renames (`financial`→`investment`, `extraordinary`→`savings`); the enum is deleted entirely.
- ~18 call sites branch on `category.type` (per ADR 0012) — Phase 46 only needs them to compile against the new model; correct behavior lands in Phase 49.

</code_context>

<specifics>
## Specific Ideas

- The 8 nature codes are exactly: `income`, `income_extraordinary`, `essential`, `discretionary`, `debt`, `transfer`, `savings`, `investment` (CONTEXT.md L82–97). No OUT "extraordinary" nature exists.
- `direction` attribute semantics: `in`/`out` → `included_in_totals=true`; `transfer` → excluded + hidden; `allocation` → excluded from spending totals but `shown_separately=true` ("Accantonato / Investito").

</specifics>

<deferred>
## Deferred Ideas

- **`exclude_from_totals` removal** → Phase 49 (per D-10), when aggregation reads `direction.included_in_totals`.
- **Doc cleanup of stale "9 nature" references** → quick task (CONTEXT.md, working-doc, DATA-02 note → "8").
- **REQUIREMENTS.md traceability update** (DATA-06: Phase 46 → Phase 49) → roadmap/requirements edit, follow-up.
- **Full dashboard / KPI / aggregation rewrite + cascade-options + table filters** → Phase 49.
- **Explicit transaction pairing** → Phase 50.

None of these are scope creep — they are downstream-phase work already on the roadmap.

</deferred>

---

*Phase: 46-direction-nature-schema*
*Context gathered: 2026-06-10*
