---
phase: quick-260531-fko
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/seed-data.ts
  - scripts/seed-extras.ts
autonomous: true
requirements: [QUICK-260531-FKO]
must_haves:
  truths:
    - "Spesa (categoryId 8) has 7 active system subcategories: supermercato, discount, negozio-di-quartiere, mercato-rionale, drogheria-e-casalinghi, bio-e-naturale, spesa-online"
    - "spesa-bio is renamed to bio-e-naturale (name and slug) on the system row"
    - "Existing expenses pointing to prodotti-freschi now point to negozio-di-quartiere"
    - "Existing expenses pointing to prodotti-non-alimentari now point to drogheria-e-casalinghi"
    - "The macelleria/pescheria categorization pattern points to negozio-di-quartiere"
    - "prodotti-freschi and prodotti-non-alimentari system rows are isActive=false (data migrated first)"
    - "All 4 new subcategories have nature='essential'"
  artifacts:
    - path: "scripts/seed-data.ts"
      provides: "4 new active subcategory rows under categoryId 8"
      contains: "negozio-di-quartiere"
    - path: "scripts/seed-extras.ts"
      provides: "reorganize-spesa-subcategories step (rename, nature, migrate, deactivate)"
      contains: "reorganize-spesa-subcategories"
  key_links:
    - from: "scripts/seed-extras.ts"
      to: "sub_category / expense / categorization_pattern tables"
      via: "Drizzle UPDATE with slug subqueries inside reorganizeSpesaSubcategories"
      pattern: "reorganize-spesa-subcategories"
---

<objective>
Reorganize the Spesa (categoryId 8) subcategory taxonomy: add 4 new subcategories, rename spesa-bio to bio-e-naturale, migrate existing expense + categorization-pattern references off the two deprecated subcategories, then deactivate the deprecated rows.

Purpose: deliver the locked Spesa taxonomy without orphaning historical expense data. Because `isActive=false` hides subcategories from dashboard queries and expense listings (lib/dal/dashboard.ts:1107, lib/dal/categories.ts:86,276,298,348,380), data MUST be migrated before deactivation — this is enforced by step ordering inside a single seed-extras step.

Output: edits to scripts/seed-data.ts (new rows) and scripts/seed-extras.ts (new additive step). Applied via `yarn db:seed` then `yarn db:seed-extras`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@scripts/seed-data.ts
@scripts/seed-extras.ts
@lib/db/schema.ts

Key schema facts (confirmed):
- sub_category: id (serial), userId (null for system rows), categoryId, name, slug, displayOrder, isActive, nature. Unique index on (categoryId, slug) WHERE userId IS NULL.
- expense.subCategoryId → sub_category.id (FK, onDelete set null). Expenses belong to users but reference system subcategory IDs.
- categorization_pattern.subCategoryId → sub_category.id (FK).
- The deprecated subcategories prodotti-freschi (seed-data.ts:496-502) and prodotti-non-alimentari (504-509) are system rows (userId IS NULL).
- One categorization pattern (seed-data.ts:1253-1261, priority 15, macelleria|pescheria|...) points to subCategorySlug prodotti-freschi.
- NATURE_SLUGS.essential in seed-extras.ts still lists prodotti-freschi, prodotti-non-alimentari, spesa-bio — do NOT modify step 1 (set-subcategory-nature). It is idempotent and harmless against renamed/inactive rows.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add 4 new Spesa subcategory rows to seed-data.ts</name>
  <files>scripts/seed-data.ts</files>
  <action>
After the spesa-bio entry (line 516, the closing `},` of that object) and before the categoryId: 9 block (line 517), insert 4 new subcategory objects: discount/discount, negozio di quartiere/negozio-di-quartiere, mercato rionale/mercato-rionale, drogheria e casalinghi/drogheria-e-casalinghi. Each with categoryId: 8, displayOrder: 0, isActive: true, matching the exact shape of surrounding rows (no nature field — nature is set in seed-extras, matching how existing Spesa rows work). Do NOT touch the spesa-bio row here (its rename happens in seed-extras). Do NOT add a nature field to seed-data shapes (additive-seed rule).
  </action>
  <verify>
    <automated>grep -c -E "negozio-di-quartiere|mercato-rionale|drogheria-e-casalinghi|\"discount\"" scripts/seed-data.ts</automated>
  </verify>
  <done>seed-data.ts contains 4 new active rows under categoryId 8 with the locked names/slugs; file still parses (tsc/seed import unaffected). Verify command reports 4.</done>
</task>

<task type="auto">
  <name>Task 2: Update categorization pattern slug + append reorganize-spesa-subcategories seed-extras step</name>
  <files>scripts/seed-data.ts, scripts/seed-extras.ts</files>
  <action>
Part A (seed-data.ts): change the categorization pattern at line 1256, `subCategorySlug: "prodotti-freschi"`, to `subCategorySlug: "negozio-di-quartiere"`. This keeps the seed source authoritative for fresh installs; existing DBs are handled by the seed-extras migration (patterns are seeded onConflictDoNothing so source edits do not retroactively update existing rows).

Part B (seed-extras.ts): add a new async function reorganizeSpesaSubcategories(database: Db) and register it in STEPS after set-fineco-description-strip-pattern as `{ name: 'reorganize-spesa-subcategories', run: reorganizeSpesaSubcategories }`. Use the existing Drizzle import style (eq, inArray, and add sql + and from 'drizzle-orm'; import categorizationPattern, expense from '../lib/db/schema' alongside the existing subCategory/platform imports). The step must run these operations in this exact order (migrate-before-deactivate is the critical invariant):

  1. Rename: UPDATE sub_category SET name='bio e naturale', slug='bio-e-naturale' WHERE slug='spesa-bio' AND userId IS NULL. Idempotent: a re-run finds 0 rows because slug already changed — acceptable.
  2. Set nature='essential' on the 4 new slugs (discount, negozio-di-quartiere, mercato-rionale, drogheria-e-casalinghi) via inArray on subCategory.slug + WHERE userId IS NULL.
  3. Resolve system subcategory IDs by slug (userId IS NULL) for: prodotti-freschi, prodotti-non-alimentari, negozio-di-quartiere, drogheria-e-casalinghi. Guard each lookup — if a source row is already absent/migrated, log and skip remaining remap steps for that pair (re-run safety).
  4. Migrate expenses: UPDATE expense SET subCategoryId = <negozio-di-quartiere id> WHERE subCategoryId = <prodotti-freschi id>. Then UPDATE expense SET subCategoryId = <drogheria-e-casalinghi id> WHERE subCategoryId = <prodotti-non-alimentari id>.
  5. Migrate patterns: UPDATE categorization_pattern SET subCategoryId = <negozio-di-quartiere id> WHERE subCategoryId = <prodotti-freschi id>.
  6. Deactivate: UPDATE sub_category SET isActive=false WHERE slug IN ('prodotti-freschi','prodotti-non-alimentari') AND userId IS NULL.

Log rowCount for each UPDATE using the existing `(result as unknown as { rowCount?: number }).rowCount ?? 0` pattern. Do NOT modify the existing NATURE_SLUGS array or setSubcategoryNature (step 1) — it is idempotent against renamed/inactive rows. Migrate-before-deactivate ordering is mandatory: isActive=false hides rows from dashboard/expense queries, so any expense not remapped first would be silently dropped from listings.
  </action>
  <verify>
    <automated>grep -q "reorganize-spesa-subcategories" scripts/seed-extras.ts && grep -q "bio-e-naturale" scripts/seed-extras.ts && grep -q "isActive: false" scripts/seed-extras.ts && grep -q "negozio-di-quartiere" scripts/seed-data.ts && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "seed-(extras|data)" | grep -v "^#" | head -5; test $? -ne 0</automated>
  </verify>
  <done>seed-extras.ts has reorganizeSpesaSubcategories registered in STEPS with rename → nature → id-resolve → expense migrate → pattern migrate → deactivate ordering. seed-data.ts pattern at line 1256 points to negozio-di-quartiere. Both files typecheck (no new tsc errors in seed files). The step is idempotent on re-run.</done>
</task>

</tasks>

<verification>
- `yarn check:language` passes (slugs/names are intentional Italian domain taxonomy; developer comments English).
- `npx tsc --noEmit` introduces no new errors in scripts/seed-data.ts or scripts/seed-extras.ts.
- Manual operator run sequence (developer executes against dev DB): `yarn db:seed` (inserts 4 new rows, onConflictDoNothing) then `yarn db:seed-extras` (renames, sets nature, migrates expense + pattern refs, deactivates the two old rows). Re-running seed-extras is a no-op for the migration.
</verification>

<success_criteria>
- categoryId 8 exposes exactly 7 active system subcategories matching the locked taxonomy.
- spesa-bio renamed to bio-e-naturale (system row).
- No expense or categorization_pattern references prodotti-freschi or prodotti-non-alimentari after seed-extras runs; both old rows are isActive=false.
- All 4 new subcategories have nature='essential'.
- seed-extras step is idempotent and additive (no edits to step 1 or NATURE_SLUGS).
</success_criteria>

<output>
Create `.planning/quick/260531-fko-riorganizza-sottocategorie-spesa-categor/260531-fko-SUMMARY.md` when done.
</output>
