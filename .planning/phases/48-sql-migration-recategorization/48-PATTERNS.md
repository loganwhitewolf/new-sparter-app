# Phase 48: sql-migration-recategorization - Pattern Map

**Mapped:** 2026-06-11
**Files analyzed:** 4 new/modified files
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `drizzle/migrations/0018_*.sql` (generated) | migration | batch / transform | `drizzle/migrations/0012_flow_nature.sql`, `0016_chunky_pet_avengers.sql`, `0017_tearful_the_stranger.sql` | role-match (same ALTER/DROP SQL pattern) |
| `scripts/seed-extras.ts` (modify: step 5 guard + NATURE_SLUGS) | utility | batch / transform | existing `seed-extras.ts` step 5 `rebucketIncomeNatures`, step 11 `v2BackfillNatureId` | exact |
| `tests/seed-extras-steps.test.ts` (modify: new assertions) | test | request-response | `tests/seed-extras-steps.test.ts` (current file) | exact |
| `scripts/verify-migration.ts` (new, optional) | utility | batch / transform | `scripts/migrate.ts` (operator script shape) | role-match |

---

## Pattern Assignments

### `drizzle/migrations/0018_*.sql` (migration, batch/transform)

**Analog:** `drizzle/migrations/0012_flow_nature.sql` (ADD columns + TYPE), `drizzle/migrations/0016_chunky_pet_avengers.sql` (ALTER TYPE ADD VALUE), `drizzle/migrations/0017_tearful_the_stranger.sql` (ALTER TYPE ADD VALUE IF NOT EXISTS)

**Key structural pattern from `0012_flow_nature.sql` (lines 1-4):**
```sql
CREATE TYPE "public"."flow_nature" AS ENUM('essential', 'discretionary', 'operational', 'financial', 'debt', 'extraordinary');--> statement-breakpoint
ALTER TABLE "user_subcategory_override" ALTER COLUMN "custom_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sub_category" ADD COLUMN "nature" "flow_nature";--> statement-breakpoint
ALTER TABLE "user_subcategory_override" ADD COLUMN "nature" "flow_nature";
```

**Key structural pattern from `0016_chunky_pet_avengers.sql` (lines 1-2):**
```sql
ALTER TYPE "public"."category_type" ADD VALUE 'transfer';--> statement-breakpoint
ALTER TYPE "public"."flow_nature" ADD VALUE 'transfer';
```

**Notes for Phase 48 migration:**
- Drizzle separates statements with `--> statement-breakpoint`. Manually patched migrations must keep this separator.
- Phase 48 migration must CREATE the `direction` and `nature` lookup tables, ADD `nature_id` FK columns on `sub_category` and `user_subcategory_override`, DROP deprecated columns (`sub_category.nature`, `user_subcategory_override.nature`, `categorization_pattern.amount_sign`), and DROP deprecated enum types (`flow_nature`, and `category_type` if removed). DROP of an enum used by existing columns must follow column ALTERs — order matters and may require manual patching of the generated file (D-07).
- Never `drizzle-kit push` in prod. Always `yarn db:generate` → review/patch → `yarn db:migrate`.

---

### `scripts/seed-extras.ts` — step 5 `rebucketIncomeNatures` + `NATURE_SLUGS.income_extraordinary` (modify)

**Analog:** existing `scripts/seed-extras.ts` step 5 and step 11 (same file, lines 460-471 and 871-886)

**Current stale guard in step 5 (lines 462-471) — remove the skip guard, update body:**
```typescript
// Step 5 (phase 42: income split): re-bucket income_extraordinary subcategories
// Guard: isNull(subCategory.userId) ensures only system subcategories are updated.
async function rebucketIncomeNatures(database: Db): Promise<void> {
  const slugs = NATURE_SLUGS['income_extraordinary']
  if (slugs.length === 0) {
    console.log('    income_extraordinary rebucket: slug list empty, skipping (PO confirmation pending)')
    return
  }

  // Nature assignment deferred to v2-backfill-nature-id (D-12; nature column removed Phase 46)
  console.log(`    income_extraordinary rebucket: skipped ${slugs.length} slugs (deferred to v2-backfill-nature-id)`)
}
```

**D-16 requirement:** The "PO confirmation pending" skip guard must be removed. The `NATURE_SLUGS.income_extraordinary` list is confirmed final. The function body should delegate to `v2BackfillNatureId` (step 11) or emit a clear no-op comment noting the work is done by step 11. The stale skip guard string `'(PO confirmation pending)'` must not appear in the final file.

**Backfill nature_id pattern to copy (step 11, lines 871-886) — primary pattern:**
```typescript
// Step 11: backfill nature_id via nature.code lookup (D-12)
async function v2BackfillNatureId(database: Db): Promise<void> {
  let totalUpdated = 0
  for (const [natureCode, slugs] of Object.entries(NATURE_SLUG_MAP)) {
    if (slugs.length === 0) continue
    const result = await database
      .update(subCategory)
      .set({
        natureId: sql`(SELECT id FROM ${nature} WHERE ${nature.code} = ${natureCode})`,
      })
      .where(and(inArray(subCategory.slug, slugs), isNull(subCategory.userId)))
    const count = (result as unknown as { rowCount?: number }).rowCount ?? 0
    console.log(`    nature_id backfill code=${natureCode}: ${count} rows`)
    totalUpdated += count
  }
  console.log(`    nature_id backfill total: ${totalUpdated} rows`)
}
```

**Override backfill pattern (step 12, lines 888-902) — for `user_subcategory_override.nature_id`:**
```typescript
async function v2BackfillOverrideNatureId(database: Db): Promise<void> {
  const result = await database.execute(sql`
    UPDATE user_subcategory_override uso
    SET nature_id = sc.nature_id
    FROM sub_category sc
    WHERE uso.sub_category_id = sc.id
      AND sc.user_id IS NULL
      AND uso.nature_id IS NULL
      AND sc.nature_id IS NOT NULL
  `)
  console.log(
    `    override nature_id backfill: ${(result as unknown as { rowCount?: number }).rowCount ?? 0} rows`,
  )
}
```

**STEPS registry pattern (lines 908-921):**
```typescript
const STEPS: Array<{ name: string; run: (database: Db) => Promise<void> }> = [
  { name: 'set-subcategory-nature', run: setSubcategoryNature },
  // ... existing steps ...
  { name: 'v2-backfill-nature-id', run: v2BackfillNatureId },
  { name: 'v2-backfill-override-nature-id', run: v2BackfillOverrideNatureId },
]

export const STEP_NAMES = STEPS.map((step) => step.name)
```

**Guard pattern (idempotent slug-absent check) — from `migrateSubcategoryMerge` lines 500-503:**
```typescript
if (sourceId == null || targetId == null) {
  console.log(`    skip merge ${sourceSlug} → ${targetSlug}: source or target absent`)
  return
}
```

**Pattern for resolving IDs by slug (lines 479-489):**
```typescript
async function resolveSystemSubIds(
  database: Db,
  slugs: string[],
): Promise<Record<string, number | undefined>> {
  if (slugs.length === 0) return {}
  const rows = await database
    .select({ id: subCategory.id, slug: subCategory.slug })
    .from(subCategory)
    .where(and(inArray(subCategory.slug, slugs), isNull(subCategory.userId)))
  return Object.fromEntries(rows.map((row) => [row.slug, row.id]))
}
```

---

### `tests/seed-extras-steps.test.ts` (modify: add Phase 48 assertions)

**Analog:** `tests/seed-extras-steps.test.ts` (current file — exact match)

**Existing test structure to copy (lines 1-28):**
```typescript
import { describe, expect, it } from 'vitest'
import { DROPPED_SUBCATEGORY_SLUGS } from './fixtures/v2-taxonomy-manifest'
import { STEP_NAMES } from '../scripts/seed-extras'

describe('seed-extras STEPS registry', () => {
  it('includes v2 deployed-DB transform and backfill steps', () => {
    expect(STEP_NAMES).toContain('set-subcategory-nature')
    expect(STEP_NAMES).toContain('v2-backfill-nature-id')
    expect(STEP_NAMES).toContain('v2-backfill-override-nature-id')
    // ...
  })

  it('runs deactivate before nature_id backfill', () => {
    const deactivateIndex = STEP_NAMES.indexOf('v2-deactivate-pruned')
    const backfillIndex = STEP_NAMES.indexOf('v2-backfill-nature-id')
    expect(deactivateIndex).toBeGreaterThan(-1)
    expect(backfillIndex).toBeGreaterThan(deactivateIndex)
  })
})
```

**New Phase 48 assertions to add (same pattern — ordering and membership):**
- Assert that any new Phase 48 step name (e.g. a verification/runbook step if added to STEPS) is present in `STEP_NAMES`.
- Assert that the `rebucket-income-natures` step body no longer has the stale skip guard (indirectly: verify the step is still present and NATURE_SLUGS income_extraordinary is non-empty — the "PO confirmation pending" logic was the skip path when the list was empty, so a length check on the exported slug set would suffice).
- Assert ordering: if a new Phase 48 step is appended, assert its index is greater than `v2-backfill-nature-id` (steps always append).

---

### `scripts/verify-migration.ts` (new, optional — verification assertions script)

**Analog:** `scripts/migrate.ts` (operator script shape — lines 1-99)

**Imports and env-setup pattern from `scripts/migrate.ts` (lines 1-16):**
```typescript
import { execSync } from 'node:child_process'
import {
  connectionStringWithSsl,
  getOperatorDatabaseConfig,
  loadOperatorEnv,
  resolveOperatorDatabaseTarget,
  sanitizeMigrationError,
  type OperatorDatabaseDiagnostics,
  type SafeMigrationError,
} from './db-config'

loadOperatorEnv()

const migrationTarget = resolveOperatorDatabaseTarget()
```

**DB connection setup pattern (from `seed-extras.ts` runner section, lines 945-980):**
```typescript
loadOperatorEnv()

const seedTarget = resolveOperatorDatabaseTarget()
const seedConfigResult = getOperatorDatabaseConfig({ target: seedTarget })

if (!seedConfigResult.ok) {
  console.error(JSON.stringify({ event: 'seed_extras_failed', target: seedTarget, error: seedConfigResult.error }))
  process.exit(1)
}

const { config: seedConfig, diagnostics: seedDiagnostics } = seedConfigResult

const pool = new Pool(pgPoolConfigFromOperatorConfig(seedConfig))
const db = drizzle(pool)
```

**Structured log pattern (from `migrate.ts` lines 30-51):**
```typescript
console.log(JSON.stringify({ event: 'migration_started', ...safeStatusFields(diagnostics) }))
// ...
console.error(JSON.stringify({
  event: 'migration_failed',
  ...safeStatusFields(diagnostics),
  error: { code: error.code, className: error.className, message: error.message },
}))
```

**Verification script must run these SQL assertions (D-04):**
1. No active system subcategory (`user_id IS NULL AND is_active = true`) without `nature_id` — expect count = 0.
2. Count of `user_subcategory_override` rows with `nature_id` inherited (non-null) — log for visibility.
3. Count of user-owned subcategories (`user_id IS NOT NULL`) with `nature_id IS NULL` — allowed; log only.

---

## Shared Patterns

### Operator env loading and DB connection
**Source:** `scripts/seed-extras.ts` (lines 929-974) and `scripts/migrate.ts` (lines 1-16)
**Apply to:** `scripts/verify-migration.ts`
```typescript
loadOperatorEnv()
const target = resolveOperatorDatabaseTarget()
const configResult = getOperatorDatabaseConfig({ target })
if (!configResult.ok) { console.error(...); process.exit(1) }
const pool = new Pool(pgPoolConfigFromOperatorConfig(configResult.config))
const db = drizzle(pool)
```

### System-only guard (isNull userId)
**Source:** `scripts/seed-extras.ts` throughout (e.g. lines 219-222, 487-488)
**Apply to:** all UPDATE/SELECT queries in Phase 48 steps and verification
```typescript
.where(and(inArray(subCategory.slug, slugs), isNull(subCategory.userId)))
```

### Idempotent slug-absent guard
**Source:** `scripts/seed-extras.ts` `migrateSubcategoryMerge` lines 500-503
**Apply to:** any new step function that resolves IDs before acting
```typescript
if (sourceId == null || targetId == null) {
  console.log(`    skip ...: source or target absent`)
  return
}
```

### rowCount extraction pattern
**Source:** `scripts/seed-extras.ts` throughout (e.g. line 207)
**Apply to:** all UPDATE/DELETE result logging
```typescript
const count = (result as unknown as { rowCount?: number }).rowCount ?? 0
console.log(`    <step description>: ${count} rows`)
```

### STEPS registry — append-only
**Source:** `scripts/seed-extras.ts` lines 908-921
**Apply to:** any new step added for Phase 48
New steps are appended at the bottom of the `STEPS` array. Export `STEP_NAMES` is derived from the array automatically. Never reorder or delete existing steps.

---

## No Analog Found

None — all Phase 48 files have close analogs in the codebase.

---

## Metadata

**Analog search scope:** `drizzle/migrations/`, `scripts/`, `tests/`
**Files scanned:** `scripts/seed-extras.ts`, `scripts/migrate.ts`, `tests/seed-extras-steps.test.ts`, last 3 migrations (0015–0017), `tests/fixtures/v2-taxonomy-manifest.ts`
**Pattern extraction date:** 2026-06-11
