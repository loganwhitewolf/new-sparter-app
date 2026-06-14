# Phase 47: taxonomy-seed-rework - Pattern Map

**Mapped:** 2026-06-11
**Files analyzed:** 7 (3 seed scripts + 2–3 test files)
**Analogs found:** 6 / 7 (optional `seed-extras-steps.test.ts` has partial analog only)

> Seed-authorship phase only. Design is LOCKED in `.planning/nature-remapping-WORKING.md` and `47-CONTEXT.md` (D-01–D-13). Do **not** re-derive taxonomy. No `drizzle-kit generate`, no DB apply (D-05). Do **not** modify `directions` / `natures` lookup blocks (D-04).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `scripts/seed-data.ts` — `categories` + `subCategories` wholesale v2 | config (seed data) | batch insert | `categories`/`subCategories` arrays + `natures` `directionId` idiom `seed-data.ts:3+`, `1579+` | exact |
| `scripts/seed-data.ts` — `categorizationPatterns` retarget + drop `amountSign` | config (seed data) | batch insert | `categorizationPatterns` `seed-data.ts:1271+` + insert strip `seed.ts:142-150` | exact |
| `scripts/seed.ts` — `natureId` pass-through + `excludeFromTotals` slugs | config (seed runner) | batch insert | `seed.ts:79-97` (Phase 46 directions/natures/subCategory wiring) | exact |
| `scripts/seed-extras.ts` — step 1 no-op (build-survival) | config (additive step) | batch transform | `setSubcategoryNature` shell `seed-extras.ts:206-223` | exact |
| `scripts/seed-extras.ts` — STEPS 6+ v2 remap/backfill | config (additive step) | batch transform | `reorganizeSpesaSubcategories` `seed-extras.ts:239-346` + `reorganizeTransferRimborsiCategories` `352-509` | exact |
| `tests/seed-taxonomy.test.ts` — TAX-01/02/03 static contract | test | static validation | `tests/import-detector.test.ts:6` + `tests/nature-labels.test.ts:1-42` | role-match |
| `tests/category-settings-seed.ts` — enable R-FN-03 todos | test | static (+ optional DB) | same file `238-254` scaffold | exact |
| `tests/seed-extras-steps.test.ts` (optional) | test | static validation | no STEPS-registry test exists | no analog |

**Out of scope (do not touch in Phase 47):** `lib/db/schema.ts`, `directions`/`natures` arrays in `seed-data.ts`, DAL/dashboard rewrites, `scripts/migrate.ts`.

## Pattern Assignments

### `scripts/seed-data.ts` — v2 `categories` + `subCategories` (wholesale replace)

**Analog:** existing `categories` (`seed-data.ts:3-220`) + Phase 46 `natures` with explicit FK ids (`seed-data.ts:1579-1646`).

**Category literal shape** (keep explicit `id`, Italian `name`/`slug`, legacy `type` for human reference — stripped at insert in `seed.ts:86`):

```typescript
// scripts/seed-data.ts:3-11
export const categories = [
  {
    id: 1,
    name: "risparmio",
    slug: "risparmio",
    type: "out",
    displayOrder: 0,
    isActive: true,
  },
```

v2: 23 active system categories per working doc; reuse explicit IDs where row survives; `isActive: false` for dissolved wrapper cats if kept in array for deployed-DB reference, or omit from fresh baseline (planner choice — fresh install uses active set only).

**Subcategory literal shape — add `natureId`** (mirror `natures[].directionId` idiom at `seed-data.ts:1581-1583`):

```typescript
// Current shape (no natureId) — seed-data.ts:222-229
export const subCategories = [
  {
    categoryId: 1,
    name: "conto risparmio",
    slug: "conto-risparmio",
    displayOrder: 0,
    isActive: true,
  },

// Target shape (D-11) — copy natures explicit-id pattern
{
  categoryId: 7,
  name: "carburante e ricarica",
  slug: "carburante-e-ricarica",
  natureId: 3, // essential — IDs 1-8 match natures array (seed-data.ts:1579-1646)
  displayOrder: 0,
  isActive: true,
}
```

**Nature ID map** (fixed — do not re-derive):

| `natureId` | `natures[].code` | `directionId` |
|------------|------------------|---------------|
| 1 | `income` | 1 (in) |
| 2 | `income_extraordinary` | 1 |
| 3 | `essential` | 2 (out) |
| 4 | `discretionary` | 2 |
| 5 | `debt` | 2 |
| 6 | `transfer` | 4 (transfer) |
| 7 | `savings` | 3 (allocation) |
| 8 | `investment` | 3 |

Every v2 system subcategory gets `natureId` 1–8 (D-11, D-13). Transfer subs (`trasferimento-tra-conti`, `addebito-carta-di-credito`, `contante`) → `natureId: 6`. `excludeFromTotals` is **not** in seed-data literals — set post-insert in `seed.ts` (see below).

**Do not modify:** `export const directions` / `export const natures` blocks (`seed-data.ts:1528-1646`) — Phase 46 shipped (D-04).

---

### `scripts/seed-data.ts` — `categorizationPatterns` retarget (sign-agnostic)

**Analog:** `categorizationPatterns` array (`seed-data.ts:1271-1280`) + `seed.ts` insert that already strips `amountSign` (`seed.ts:142-150`).

**Current pattern literal** (remove `amountSign` field and `AmountSign` type export `seed-data.ts:1269` per D-10):

```typescript
// scripts/seed-data.ts:1271-1280
export const categorizationPatterns = [
  {
    pattern: "(?:\\bcoop\\b|...)",
    subCategorySlug: "supermercato",
    amountSign: "negative" as AmountSign,
    confidence: 0.95,
    priority: 10,
    description: "Supermarkets and grocery stores",
  },
```

**Target pattern literal** (sign-agnostic — only fields consumed by `seed.ts`):

```typescript
{
  pattern: "(?:\\bcoop\\b|...)",
  subCategorySlug: "spesa-quotidiana", // retarget per RESEARCH.md pattern map
  confidence: 0.95,
  priority: 10,
  description: "Supermarkets and grocery stores",
}
```

**Insert consumer** (unchanged — confirms `amountSign` must not be in literal):

```typescript
// scripts/seed.ts:142-150
seedCategorizationPatterns.map((patternSeed) => ({
  userId: null,
  pattern: patternSeed.pattern,
  subCategoryId: subCategoryIdBySlug.get(patternSeed.subCategorySlug)!,
  // Phase 46: patterns are sign-agnostic (amount_sign column removed, ADR 0012)
  confidence: patternSeed.confidence.toFixed(2),
  priority: patternSeed.priority,
  description: patternSeed.description,
  isActive: true,
})),
```

**Bonifico dedupe:** after merging `bonifico-in-uscita` + `bonifico-in-entrata` → `trasferimento-tra-conti`, seed-data must have **one** pattern row per `(pattern, subCategorySlug)` — unique `(pattern, subCategoryId)` at DB level.

---

### `scripts/seed.ts` — `natureId` pass-through + `excludeFromTotals` slug update

**Analog:** self — Phase 46 insert wiring (`seed.ts:74-97`).

**FK insert order** (unchanged — directions/natures before categories/subs):

```typescript
// scripts/seed.ts:74-91
console.log('Seeding directions...')
await db.insert(direction).values(directions as Array<typeof direction.$inferInsert>).onConflictDoNothing()
// ...
console.log('Seeding subcategories...')
await db.insert(subCategory).values(subCategories as Array<typeof subCategory.$inferInsert>).onConflictDoNothing()
```

Once `subCategories` literals include `natureId`, the cast `as Array<typeof subCategory.$inferInsert>` passes it through automatically — **no map needed** unless stripping extra literal fields. Schema column: `subCategory.natureId` nullable FK (`lib/db/schema.ts:177`).

**Update `excludeFromTotals` slugs** for v2 TRANSFER subs (D-13, RESEARCH.md):

```typescript
// scripts/seed.ts:93-97 — replace slug list
await db
  .update(subCategory)
  .set({ excludeFromTotals: true })
  .where(inArray(subCategory.slug, [
    'trasferimento-tra-conti',
    'addebito-carta-di-credito',
    'contante', // was prelievo-contante in step 4
  ]))
```

**Missing-slug guard** (keep — patterns must resolve after v2 retarget):

```typescript
// scripts/seed.ts:125-137
if (missingSlugs.length > 0) {
  throw new Error(
    `Missing subcategory slugs for system categorization patterns: ${missingSlugs.join(', ')}`,
  )
}
```

**Category `type` strip** (unchanged):

```typescript
// scripts/seed.ts:85-86
await db.insert(category).values(categories.map(({ type: _type, ...rest }) => rest) as Array<typeof category.$inferInsert>).onConflictDoNothing()
```

---

### `scripts/seed-extras.ts` — step 1 no-op (D-06, D-09)

**Analog:** `setSubcategoryNature` function shell (`seed-extras.ts:206-223`) — replace body only; keep `NATURE_SLUGS` as documentation.

**Current broken body** (fails post-Phase 46 — `sub_category.nature` column gone):

```typescript
// scripts/seed-extras.ts:206-223
async function setSubcategoryNature(database: Db): Promise<void> {
  // ...
  const result = await database.execute(
    sql`UPDATE sub_category SET nature = ${nature} WHERE slug = ANY(${slugs}) AND user_id IS NULL`
  )
```

**Target no-op** (minimal build-survival — log and return):

```typescript
async function setSubcategoryNature(_database: Db): Promise<void> {
  console.log('    set-subcategory-nature: no-op (Phase 47 — superseded by v2-backfill-nature-id step)')
}
```

Keep STEPS registry entry name `'set-subcategory-nature'` unchanged (`seed-extras.ts:535`) for operator log continuity.

---

### `scripts/seed-extras.ts` — STEPS 6+ v2 remap/backfill

**Analog:** `reorganizeSpesaSubcategories` (`seed-extras.ts:239-346`) for merge migrations; `reorganizeTransferRimborsiCategories` (`352-509`) for rename guards + idempotent INSERT.

#### A — STEPS registry append pattern

```typescript
// scripts/seed-extras.ts:534-540
const STEPS: Array<{ name: string; run: (database: Db) => Promise<void> }> = [
  { name: 'set-subcategory-nature', run: setSubcategoryNature },
  { name: 'set-fineco-description-strip-pattern', run: setFinecoDescriptionStripPattern },
  { name: 'reorganize-spesa-subcategories', run: reorganizeSpesaSubcategories },
  { name: 'reorganize-transfer-rimborsi-categories', run: reorganizeTransferRimborsiCategories },
  { name: 'rebucket-income-natures', run: rebucketIncomeNatures },
  // APPEND v2 steps here (D-09) — do not edit steps 2-5 bodies unless compile failure
]
```

Recommended append names (from RESEARCH.md): `v2-insert-categories-subcategories`, `v2-migrate-merges-out`, `v2-migrate-merges-in-allocation-transfer`, `v2-rename-categories-subcategories`, `v2-deactivate-pruned`, `v2-backfill-nature-id`, `v2-backfill-override-nature-id`.

#### B — Merge migration core (copy from step 3)

**Ordering comment** (non-negotiable):

```typescript
// scripts/seed-extras.ts:235-238
// Ordering is critical: migrate expenses + patterns BEFORE deactivating deprecated rows.
// isActive=false hides subcategories from dashboard/expense queries, so any expense not
// remapped first would be silently dropped from listings.
```

**Resolve IDs by slug:**

```typescript
// scripts/seed-extras.ts:277-287
const sourceRows = await database
  .select({ id: subCategory.id, slug: subCategory.slug })
  .from(subCategory)
  .where(and(inArray(subCategory.slug, ['prodotti-freschi', 'prodotti-non-alimentari', ...]), isNull(subCategory.userId)))
const idBySlug = Object.fromEntries(sourceRows.map((r) => [r.slug, r.id]))
```

**Migrate expenses** (null-guard if source/target absent — idempotent re-run):

```typescript
// scripts/seed-extras.ts:289-298
if (prodottiFreschiId == null || negozioDiQuartiereId == null) {
  console.log(`    skip expense migration (...): source or target already absent`)
} else {
  const expMigrate1 = await database
    .update(expense)
    .set({ subCategoryId: negozioDiQuartiereId })
    .where(eq(expense.subCategoryId, prodottiFreschiId))
```

**Pattern dedupe before migrate** (unique `(pattern, subCategoryId)`):

```typescript
// scripts/seed-extras.ts:320-336
const patConflictDelete = await database
  .delete(categorizationPattern)
  .where(
    and(
      eq(categorizationPattern.subCategoryId, prodottiFreschiId),
      sql`${categorizationPattern.pattern} IN (SELECT pattern FROM categorization_pattern WHERE sub_category_id = ${negozioDiQuartiereId})`
    )
  )
const patMigrate = await database
  .update(categorizationPattern)
  .set({ subCategoryId: negozioDiQuartiereId })
  .where(eq(categorizationPattern.subCategoryId, prodottiFreschiId))
```

**Deactivate last:**

```typescript
// scripts/seed-extras.ts:339-345
const deactivateResult = await database
  .update(subCategory)
  .set({ isActive: false })
  .where(and(inArray(subCategory.slug, ['prodotti-freschi', 'prodotti-non-alimentari']), isNull(subCategory.userId)))
```

Apply same 4-step loop (resolve → expense → pattern dedupe+migrate → deactivate) for each working-doc merge slug pair.

#### C — Idempotent rename guard

```typescript
// scripts/seed-extras.ts:363-383
const existingTrasferimentoTraConti = await database
  .select({ id: subCategory.id })
  .from(subCategory)
  .where(and(eq(subCategory.slug, 'trasferimento-tra-conti'), isNull(subCategory.userId)))
  .limit(1)

if (existingTrasferimentoTraConti.length > 0) {
  const deactivateTrasferimento = await database
    .update(subCategory)
    .set({ isActive: false })
    .where(and(eq(subCategory.slug, 'trasferimento'), isNull(subCategory.userId)))
} else {
  const sub32RenameResult = await database
    .update(subCategory)
    .set({ name: 'Trasferimento tra conti', slug: 'trasferimento-tra-conti' })
    .where(and(eq(subCategory.slug, 'trasferimento'), isNull(subCategory.userId)))
}
```

Respects `sub_category_system_category_slug_unique` (`lib/db/schema.ts:183-185`).

#### D — Idempotent INSERT net-new rows

```typescript
// scripts/seed-extras.ts:397-420
const existingPrelievo = await database
  .select({ id: subCategory.id })
  .from(subCategory)
  .where(and(eq(subCategory.slug, 'prelievo-contante'), isNull(subCategory.userId)))
  .limit(1)
if (existingPrelievo.length === 0) {
  await database.insert(subCategory).values({
    categoryId: 32,
    name: 'Prelievo contante',
    slug: 'prelievo-contante',
    displayOrder: 0,
    isActive: true,
    excludeFromTotals: true,
  })
```

v2 INSERT steps: slug-exists check first; set `natureId` via backfill step (not inline hardcoded integers — D-12).

#### E — Backfill `nature_id` by `nature.code` (D-12)

**No in-repo analog for `nature_id` backfill** — adapt step 1 raw SQL idiom (`seed-extras.ts:215-217`) from `SET nature` → `SET nature_id`:

```typescript
// New step pattern — parameterized slug list + code lookup (never hardcode nature_id integers)
await database.execute(sql`
  UPDATE sub_category
  SET nature_id = (SELECT id FROM nature WHERE code = ${natureCode})
  WHERE slug = ANY(${slugs}) AND user_id IS NULL
`)
```

Define `Record<string, string[]>` map: `natureCode → slugs[]` sourced from working doc. Run **after** all renames/merges complete.

#### F — Backfill `user_subcategory_override.nature_id`

**Schema:** `userSubcategoryOverride.natureId` FK (`lib/db/schema.ts:203`). Join from linked system sub:

```typescript
await database.execute(sql`
  UPDATE user_subcategory_override uso
  SET nature_id = sc.nature_id
  FROM sub_category sc
  WHERE uso.sub_category_id = sc.id
    AND sc.user_id IS NULL
    AND uso.nature_id IS NULL
    AND sc.nature_id IS NOT NULL
`)
```

#### G — Historical steps 3–5 survivability (A2 open question)

Steps 3–5 still contain `SET nature =` raw SQL (`seed-extras.ts:271, 393, 523`). D-09: do not edit bodies unless compile/runtime failure. If Phase 48 fresh-chain fails, apply **build-survival** swap: `SET nature_id = (SELECT id FROM nature WHERE code = …)` or no-op — planner Wave 3 task.

**Do not duplicate** step 4 transfer work — v2 step extends/idempotently completes (`prelievo-contante` → `contante`, bonifici merge).

---

### `tests/seed-taxonomy.test.ts` (NEW — TAX-01/02/03)

**Analog:** `tests/import-detector.test.ts:6` (import from `seed-data`) + `tests/nature-labels.test.ts:34-41` (`it.each` static assertions).

**Import pattern:**

```typescript
// tests/import-detector.test.ts:1-6
import { describe, expect, it } from 'vitest'
import { platforms as seedPlatforms } from '../scripts/seed-data'
```

**Target test scaffold** (Wave 0 RED → GREEN after seed-data v2):

```typescript
import { describe, expect, it } from 'vitest'
import { categories, subCategories, natures } from '../scripts/seed-data'

const NATURE_BY_ID = Object.fromEntries(natures.map((n) => [n.id, n.code]))

describe('seed taxonomy contract (TAX-01/02/03)', () => {
  it('has 23 active system categories', () => {
    expect(categories.filter((c) => c.isActive !== false)).toHaveLength(23)
  })

  it('every system subcategory has natureId 1-8', () => {
    for (const sub of subCategories) {
      expect(sub.natureId, sub.slug).toBeGreaterThanOrEqual(1)
      expect(sub.natureId, sub.slug).toBeLessThanOrEqual(8)
      expect(NATURE_BY_ID[sub.natureId!]).toBeTruthy()
    }
  })

  // TAX-02: assert dissolved wrapper slugs absent from active set
  // TAX-03: optional slug manifest from working-doc bullets (derived count, not "~65" alone)
})
```

Gate: `yarn test tests/seed-taxonomy.test.ts` per wave; full `yarn test` + `yarn build` at phase gate.

---

### `tests/category-settings-seed.ts` — enable R-FN-03 todos (Wave 4)

**Analog:** existing scaffold (`category-settings-seed.ts:238-254`).

**Current todos** (enable after `subCategories` gains `natureId`):

```typescript
// tests/category-settings-seed.ts:242-254
describe('seed nature assignment (R-FN-03)', () => {
  it('FlowNature import from @/lib/utils/nature-labels succeeds (regression guard)', () => { ... })

  it.todo('at least 1 system subcategory has nature: essential (R-FN-03) — enable after Plan 37-02 adds nature to subCategories seed')
  it.todo('at least 1 system subcategory has nature: discretionary (R-FN-03) — enable after Plan 37-02')
  it.todo('ignore-category subcategories have nature null (R-FN-03) — enable after Plan 37-02')
})
```

**Enable pattern** — import `subCategories` from `../scripts/seed-data`; assert by `natureId` + `NATURE_BY_ID` map (not stale `FlowNature` string on row). Transfer subs: assert `natureId === 6` (not null). Update third todo: transfer subs have `natureId: 6`, not null (D-13 supersedes old "ignore-category null" intent).

---

## Shared Patterns

### Additive seed model (baseline vs extras)

**Source:** `CLAUDE.md` + `47-CONTEXT.md` D-07/D-08/D-09.

| Binario | File | Semantics |
|---------|------|-----------|
| Fresh install | `seed-data.ts` + `seed.ts` | Wholesale v2 literals; `onConflictDoNothing` — **does not update** existing v1 rows |
| Deployed DB | `seed-extras.ts` STEPS 6+ | Rename/merge/deactivate/INSERT/backfill on rows already inserted by v1 baseline |

### Operator script bootstrap

**Source:** `seed-extras.ts:1-45` and `seed.ts:27-57` — identical for both runners.

```typescript
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { getOperatorDatabaseConfig, loadOperatorEnv, resolveOperatorDatabaseTarget, ... } from './db-config'

loadOperatorEnv()
const seedTarget = resolveOperatorDatabaseTarget()
// Pool + drizzle(db) + JSON structured logs
```

New step functions take `database: Db` (`seed-extras.ts:47`) — no module-level DB mutation inside steps.

### Drizzle typed updates vs raw SQL

**Source:** `seed-extras.ts` mix.

- Prefer `database.update(table).set(...).where(and(...))` for single-table ops (`eq`, `inArray`, `isNull(subCategory.userId)`).
- Use `database.execute(sql\`...\`)` when subquery to `nature` table needed (D-12) or column not in current Drizzle schema during transition.
- Always log `rowCount` via cast: `(result as unknown as { rowCount?: number }).rowCount ?? 0` (`seed-extras.ts:218-219`).

### System-row scope guard

**Apply to:** all seed-extras UPDATE/DELETE on taxonomy.

```typescript
and(eq(subCategory.slug, '...'), isNull(subCategory.userId))
// or
isNull(subCategory.userId) // on bulk category/sub updates
```

Never mutate user-owned `sub_category` rows (`userId IS NOT NULL`).

### Idempotency conventions

**Source:** `seed.ts:75-91` (`onConflictDoNothing`), `seed-extras.ts` slug-exists guards.

- Baseline insert: conflict-safe skip.
- Extras: check target exists before rename; skip migration if source/target ID null; INSERT only when `select...limit(1)` empty.
- Re-run safe: log "skipped" / "already absent" instead of throwing.

### Italian product / English developer language

**Source:** `AGENTS.md`. Taxonomy `name`/`slug`/pattern regex in Italian; step comments and console logs in English.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `tests/seed-extras-steps.test.ts` (optional) | test | static validation | No existing test imports `STEPS` registry; planner can add simple `import { STEPS }` if module exports registry, or inline name assertions |
| `scripts/validate-seed-taxonomy.ts` (optional discretion) | utility | static validation | Vitest contract sufficient per RESEARCH.md; no operator validation script in repo |

## Metadata

**Analog search scope:** `scripts/seed-data.ts`, `scripts/seed-extras.ts`, `scripts/seed.ts`, `lib/db/schema.ts` (natureId columns), `tests/`
**Files scanned:** ~15
**Pattern extraction date:** 2026-06-11
**Prior phase pattern reference:** `.planning/phases/46-direction-nature-schema/46-PATTERNS.md` (directions/natures baseline — out of scope for edits)
**Canonical taxonomy source:** `.planning/nature-remapping-WORKING.md`
