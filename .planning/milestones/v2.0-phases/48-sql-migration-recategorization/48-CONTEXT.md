# Phase 48: sql-migration-recategorization - Context

**Gathered:** 2026-06-11
**Updated:** 2026-06-11 (added migration safety/rollback protocol; clarified MIG-02 as nature-level only)
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 48 physically moves the database from the old dual-axis model to the
locked v2.0 `nature -> direction` model:

- Generate and review the Drizzle SQL migration that creates the `direction`
  and `nature` lookup tables, adds `nature_id` FKs, removes deprecated
  columns/enums/constraints, and leaves no references to removed schema objects.
- Apply the migration through the guarded operator flow (`yarn db:migrate*`),
  never `drizzle-kit push`.
- Run `yarn db:seed*` and `yarn db:seed-extras*` after migration so lookup rows,
  v2 taxonomy remaps, `nature_id` backfills, and pattern target moves apply to
  deployed-style data.
- Verify the migrated database with targeted SQL assertions.

This phase does not implement the Phase 49 dashboard, KPI, cascade/filter, or
UI rewrite. It also does not add transaction pairing; that remains Phase 50.

</domain>

<decisions>
## Implementation Decisions

### A - User-owned/custom category handling
- **D-01:** The non-null `nature_id` gate applies to active **system**
  subcategories. User-created/custom subcategories may remain
  `nature_id = NULL` until the UI can ask for a reliable nature choice.
- **D-02:** `user_subcategory_override.nature_id` should inherit from the linked
  system `sub_category.nature_id` when the override value is NULL and the linked
  system subcategory has a nature.
- **D-03:** User-owned subcategories that cannot inherit a clear nature remain
  unclassified (`nature_id = NULL`). Do not invent a fallback from category name,
  amount sign, or description text, and do not block migration on these rows.
- **D-04:** Verification must use targeted DB assertions: no active system
  subcategory without `nature_id`; override backfill happened where possible;
  user-owned NULL `nature_id` rows are allowed.

### B - Migration vs seed-extras boundary
- **D-05:** The generated SQL migration owns **schema shape**. Data transforms
  for existing rows live in `yarn db:seed` and `yarn db:seed-extras`, following
  the Phase 47 additive seed model.
- **D-06:** Canonical operator order is:
  1. `yarn db:generate`
  2. review and, if needed, manually patch the generated migration
  3. `pg_dump` snapshot of the target DB (mandatory pre-migrate — see D-13)
  4. `yarn db:migrate`
  5. `yarn db:seed`
  6. `yarn db:seed-extras`
  7. targeted verification queries
  Run the full sequence on **staging first** and only proceed to production after
  staging verification passes (see D-14).
- **D-07:** The migration file can be manually patched after `drizzle-kit
  generate` if Drizzle emits unsafe ordering, incomplete enum/constraint drops,
  or SQL that needs review-hardening. The base is generated; correctness wins
  over treating the generated file as untouchable.
- **D-08:** `seed` and `seed-extras` must remain idempotent where reasonable and
  tolerate reruns. The migration itself may assume the normal Drizzle
  pre-migration state; it does not need to repair arbitrary failed prior
  attempts.

### C - Recategorization target
- **D-09:** In this app, imported `transaction` rows do not own
  `sub_category_id`; categorization lives on aggregated `expense.sub_category_id`.
  Therefore Phase 48 "transaction recategorization" means updating
  `expense.sub_category_id` and `categorization_pattern.sub_category_id`.
  Raw transaction rows stay intact.
- **D-10:** Semantic recategorization uses explicit slug source->target maps
  from the v2 manifest / `seed-extras` transforms. Do not infer new
  classifications from bank descriptions, regex guesses, amount signs, or
  merchant names during migration.
- **D-11:** When a source subcategory merges into a target, pattern handling
  follows the existing `migrateSubcategoryMerge` approach: delete source
  patterns that would duplicate an existing target pattern, then move remaining
  source patterns to the target.
- **D-12:** Do not create `expense_classification_history` rows for these moves.
  This is a technical model migration, not a manual user decision or runtime
  categorization event.
- **D-15:** MIG-02 misclassification fixes are **nature-level only**. Misclassified
  rows are corrected by assigning the right `nature_id` to their *subcategory*
  via `v2-backfill-nature-id` + the `NATURE_SLUGS` maps. Expenses are NOT
  rebucketed between subcategories. Examples: `vendita-investimenti` → nature
  `investment` (positive amount = divestment under the `allocation` direction by
  the algebraic rule); one-off income slugs → nature `income_extraordinary`. No
  `migrateSubcategoryMerge` move is introduced for MIG-02 beyond the existing v2
  taxonomy merges already in `seed-extras`.
- **D-16:** The `income_extraordinary` slug list in `NATURE_SLUGS` is **PO-confirmed
  and final** for Phase 48 (no longer "pending"). The planner must ensure
  `v2-backfill-nature-id` assigns the `income_extraordinary` nature to that
  confirmed slug set, and must remove/update the stale "PO confirmation pending"
  skip guard in the `income_extraordinary rebucket` step
  (`scripts/seed-extras.ts`). This is still nature assignment, not expense moving
  (consistent with D-15).

### D - Migration safety & operator protocol
- **D-13:** A `pg_dump` snapshot is **mandatory** immediately before
  `yarn db:migrate` on both staging and production. Rollback strategy = restore
  from that dump. Do NOT hand-write down-migrations: Drizzle column/enum drops are
  destructive and a reverse SQL cannot recover dropped data, so reversibility
  comes from the dump, not from a down script. The runbook must state the dump
  command and the restore path explicitly.
- **D-14:** Staging-first is a **blocking gate**. The full sequence
  (`db:migrate` → `db:seed` → `db:seed-extras` → verification assertions) must run
  clean on staging before production is touched. Production apply is allowed only
  after staging verification passes. This extends the existing
  `apply-to-production` confirm gate — it does not replace it.

### the agent's Discretion
- Exact plan slicing, SQL assertion filenames/scripts, and whether verification
  assertions are implemented as a standalone script or documented SQL snippets
  are left to the planner.
- The planner may decide whether to add focused tests around migration SQL text,
  seed-extras idempotency, or both, as long as the DB-level gates in D-04 and
  D-06 are covered.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked design contract
- `docs/adr/0012-direction-derived-from-nature-allocation.md` — accepted model:
  direction derives from nature, allocation is a fourth direction, deprecated
  schema objects, algebraic netting rules.
- `CONTEXT.md` — domain vocabulary for Direction, FlowNature, refunds,
  divestment, allocation, transfer, and the categorization rule.
- `.planning/nature-remapping-WORKING.md` — final v2 taxonomy/remap, slug
  merges, category dissolutions, and source/target semantics.

### Requirements and roadmap
- `.planning/REQUIREMENTS.md` — MIG-01, MIG-02, MIG-03 plus traceability showing
  Phase 49 owns dashboard/filter semantics.
- `.planning/ROADMAP.md` — Phase 48 goal and success criteria.
- `.planning/STATE.md` — latest milestone decisions and Phase 46/47 carryover
  notes.

### Prior phase context
- `.planning/phases/46-direction-nature-schema/46-CONTEXT.md` — 8-nature
  decision, schema-vs-migration boundary, `exclude_from_totals` Phase 49
  deferral.
- `.planning/phases/47-taxonomy-seed-rework/47-CONTEXT.md` — v2 taxonomy,
  additive seed model, `seed-extras` deployed DB transform boundary.

### Code and verification anchors
- `lib/db/schema.ts` — current target schema and relations.
- `drizzle.config.ts` — migration generation config and output path.
- `scripts/migrate.ts` — guarded migrate command and sanitized diagnostics.
- `scripts/db-config.ts` — target env handling, production confirmation, pool
  max, SSL handling.
- `scripts/seed.ts` — post-migration baseline lookup/taxonomy/pattern seed.
- `scripts/seed-extras.ts` — idempotent deployed DB transform registry and
  merge/backfill helpers.
- `tests/fixtures/v2-taxonomy-manifest.ts` — authoritative v2 slug/nature
  manifest for verification.
- `tests/seed-taxonomy.test.ts` — fresh baseline taxonomy contract tests.
- `tests/seed-extras-steps.test.ts` — deployed DB transform registry/order
  contract tests.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/seed-extras.ts` already has `migrateSubcategoryMerge`,
  guarded rename helpers, v2 merge arrays, `v2-backfill-nature-id`, and
  `v2-backfill-override-nature-id`. These are the primary deployed-data
  transform assets for Phase 48.
- `tests/fixtures/v2-taxonomy-manifest.ts` gives a compact oracle for final
  category slugs, subcategory slugs, and nature codes.
- `scripts/migrate.ts` / `scripts/db-config.ts` already provide the safe
  operator path for local/staging/production migration execution.

### Established Patterns
- Production migrations are explicit operator actions with reviewed migration
  files; `drizzle-kit push` is not allowed.
- Seed scripts are operator commands too and read `.env`, not `.env.local`.
- `seed-extras` steps are appended and idempotent; existing steps are expected
  to tolerate reruns.
- Pattern merge logic deletes conflicts before moving source pattern rows to
  target subcategory IDs.

### Integration Points
- Last migration snapshot still contains `category_type`, `flow_nature`,
  `amount_sign`, `sub_category.nature`, `user_subcategory_override.nature`, and
  `categorization_pattern.amount_sign`. Phase 48 must bridge that snapshot to
  the current `schema.ts`.
- `expense.sub_category_id` is the categorization target for imported data.
  `transaction` rows carry raw import facts and link to `expense`, but do not
  store a category directly.
- `exclude_from_totals` intentionally remains in schema until Phase 49, even
  though ADR 0012 marks it as a candidate deprecation.

</code_context>

<specifics>
## Specific Ideas

- Verification should distinguish active system subcategories from user-owned
  custom subcategories. User-owned rows with NULL `nature_id` are allowed.
- The operator runbook for this phase should make the post-migration seed order
  explicit because lookup rows and taxonomy transforms are not embedded in the
  generated SQL migration.
- Semantic data movement is slug-map driven. Do not run freeform description
  matching as part of migration.
- Migration safety: a `pg_dump` snapshot precedes every `db:migrate` and is the
  sole rollback path (no down-migrations). The whole sequence is rehearsed on
  staging before production — staging-first is a hard gate, not advice.
- MIG-02 is corrected at the subcategory `nature_id` level only; the `+` refund /
  divestment cases net correctly because direction derives from nature (ADR
  0012), without moving the underlying expense rows.

</specifics>

<deferred>
## Deferred Ideas

- Dashboard/KPI/category aggregation rewrite, direction filters, and
  `cascade-options.ts` semantics remain Phase 49.
- Removing `sub_category.exclude_from_totals` remains Phase 49.
- Explicit transaction pairing remains Phase 50.

</deferred>

---

*Phase: 48-sql-migration-recategorization*
*Context gathered: 2026-06-11*
