---
phase: 47-taxonomy-seed-rework
reviewed: 2026-06-11T12:42:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - scripts/seed-data.ts
  - scripts/seed.ts
  - scripts/seed-extras.ts
  - tests/seed-taxonomy.test.ts
  - tests/fixtures/v2-taxonomy-manifest.ts
  - tests/seed-extras-steps.test.ts
  - tests/category-settings-seed.ts
  - vitest.config.ts
findings:
  critical: 2
  warning: 5
  info: 2
  total: 9
status: issues_found
---

# Phase 47: Code Review Report

**Reviewed:** 2026-06-11T12:42:00Z  
**Depth:** standard  
**Files Reviewed:** 8  
**Status:** issues_found

## Summary

Phase 47 delivers a coherent v2 baseline in `seed-data.ts` (23 categories, 87 subcategories with `natureId`, sign-agnostic patterns) and static Vitest contracts that pass. The adversarial review focused on **deployed-DB path** (`seed-extras.ts` steps 4 + 6–12), which is where Phase 48 will apply transforms.

Two **blockers** affect post-`db:seed-extras` taxonomy integrity: historical step 4 still inserts/retains subcategories outside the v2 manifest, and `v2-backfill-nature-id` uses a Drizzle `ANY(${array})` pattern with a known parameter-expansion failure mode. Additional warnings cover operator exit codes, incomplete static contract coverage, and idempotent-insert edge cases.

Fresh-install-only path (`yarn db:seed` without extras) is aligned with the manifest; issues surface when the full extras pipeline runs.

## Critical Issues

### CR-01: Step 4 leaves v2-incompatible subcategories active without `nature_id`

**File:** `scripts/seed-extras.ts:447-464`, `scripts/seed-extras.ts:398-417`, `tests/fixtures/v2-taxonomy-manifest.ts:53-164`, `tests/fixtures/v2-taxonomy-manifest.ts:179-215`

**Issue:** Historical `reorganizeTransferRimborsiCategories` (step 4) still runs before v2 steps and:

1. **Inserts** `rimborso-da-persona` (lines 447–464). The locked working doc (line 155) says reimbursements from another person **net under the original expense**, not a dedicated subcategory. The slug is absent from `V2_SUBCATEGORY_MANIFEST` and `DROPPED_SUBCATEGORY_SLUGS`.

2. **Creates/retains** `rimborso-abbonamento-e-canoni` via rename from `sconto-abbonamento` (lines 398–417). v2 **Entrate straordinarie** has only four subs (`cashback`, `bonus-promozionale`, `vendita-beni-usati`, `eredita-e-donazioni`). This slug is not in the manifest or dropped list.

Step 10 (`v2-deactivate-pruned`) and step 11 (`v2-backfill-nature-id`) only touch manifest/dropped slugs, so these rows **stay active with `nature_id` NULL** after a full extras run — violating TAX-02/TAX-03 on deployed DBs and breaking direction derivation for any expenses still pointing at them.

**Fix:** Deactivate and migrate expenses/patterns for both slugs in a v2 step (add to `DROPPED_SUBCATEGORY_SLUGS` or explicit merge targets), and remove the step-4 insert of `rimborso-da-persona`. Example guard in step 4:

```typescript
// Remove rimborso-da-persona insert block (lines 447–464).
// After v2 merges, deactivate orphan historical slugs:
await database
  .update(subCategory)
  .set({ isActive: false })
  .where(
    and(
      inArray(subCategory.slug, ['rimborso-da-persona', 'rimborso-abbonamento-e-canoni']),
      isNull(subCategory.userId),
    ),
  )
```

Run expense/pattern migration first if live data references these slugs.

### CR-02: `v2BackfillNatureId` uses Drizzle `ANY(${slugs})` — known invalid SQL

**File:** `scripts/seed-extras.ts:875-881`

**Issue:** Passing a JavaScript array inside `` sql`... ANY(${slugs})` `` is a documented Drizzle failure mode: the array expands to multiple bind parameters (`ANY(($1,$2,...))`) instead of a single `text[]`, producing invalid PostgreSQL at runtime (drizzle-orm issues #1589, #1947). Phase 47 deferred DB apply (D-05), so this was not exercised; Phase 48 `db:seed-extras` will hit it on step 11.

**Fix:** Replace raw `ANY` with Drizzle `inArray` and a scalar subquery for `nature_id`:

```typescript
import { inArray } from 'drizzle-orm'
import { nature } from '../lib/db/schema'

for (const [natureCode, slugs] of Object.entries(NATURE_SLUG_MAP)) {
  if (slugs.length === 0) continue
  const result = await database
    .update(subCategory)
    .set({
      natureId: sql`(SELECT id FROM ${nature} WHERE ${nature.code} = ${natureCode})`,
    })
    .where(and(inArray(subCategory.slug, slugs), isNull(subCategory.userId)))
  // log rowCount from result
}
```

Alternatively use `new Param(slugs)` with an explicit `::text[]` cast per Drizzle docs if staying on raw SQL.

## Warnings

### WR-01: `seed.ts` can exit 0 after seed failure

**File:** `scripts/seed.ts:168-192`

**Issue:** The top-level `seed().catch()` logs errors but never calls `process.exit(1)` except via implicit success. Operators/CI scripts that rely on exit code will treat a failed seed as success. Contrast `seed-extras.ts:976-978`, which exits 1 on failure.

**Fix:**

```typescript
seed()
  .catch((error: unknown) => {
    // ... existing structured logging ...
    process.exit(1)
  })
  .finally(() => pool.end())
```

### WR-02: Static contract does not assert subcategory cardinality

**File:** `tests/seed-taxonomy.test.ts:43-50`

**Issue:** Tests verify every manifest slug exists in `seed-data` but never assert `activeSubcategories().length === V2_SUBCATEGORY_MANIFEST.length` (87). Extra active subs (e.g. orphans from extras on a copied fixture) would not fail the Wave 0 gate.

**Fix:** Add:

```typescript
it('has exactly 87 active system subcategories', () => {
  expect(activeSubcategories()).toHaveLength(V2_SUBCATEGORY_MANIFEST.length)
})
```

### WR-03: Step 4 regresses fresh v2 category 26 by hardcoded id

**File:** `scripts/seed-extras.ts:392-396`

**Issue:** Step 4 updates `category.id = 26` to `rimborsi-cashback-e-bonus` regardless of current slug. After v2 `db:seed`, id 26 is already `entrate-straordinarie`. Running extras temporarily regresses the category until step 9 renames it back. A crash between steps 4 and 9 leaves the wrong slug/name in production.

**Fix:** Guard on current slug or skip when id 26 is already `entrate-straordinarie`:

```typescript
const [cat26] = await database
  .select({ slug: category.slug })
  .from(category)
  .where(eq(category.id, 26))
  .limit(1)
if (cat26?.slug === 'entrate-straordinarie') {
  console.log('    cat26 rename: skipped (already v2 entrate-straordinarie)')
} else {
  // existing update
}
```

### WR-04: `v2InsertCategoriesSubcategories` can PK-fail on id reuse

**File:** `scripts/seed-extras.ts:616-631`

**Issue:** Inserts use explicit `id: cat.id` after checking slug absence only. On a v1 DB where id 6 (or other reused ids) is occupied by a different slug, insert throws on PK conflict instead of idempotent skip/remap.

**Fix:** Before insert, check `eq(category.id, cat.id)` or use `onConflictDoNothing()` on id/slug and log conflicts; align with research A3 id-reuse assumptions.

### WR-05: `\bbar\b` system pattern is overly broad

**File:** `scripts/seed-data.ts:1056-1058`

**Issue:** The bar/coffee regex includes standalone `\bbar\b`. In Italian bank descriptions, short token `bar` matches many non-coffee merchants (tabacchi, wine bars in compound strings, abbreviations). This misroutes transactions to `bar-caffe-e-snack` — a categorization correctness risk on real imports.

**Fix:** Tighten to coffee-specific tokens only (e.g. drop bare `\bbar\b` or require proximity to `caff`/`caffè`/`espresso`), and add fixture tests with representative Intesa/Revolut description samples.

## Info

### IN-01: `NATURE_SLUGS` block is stale documentation with duplicate entries

**File:** `scripts/seed-extras.ts:40-186`

**Issue:** ~150 lines of slug lists duplicate slugs across `investment` and `income_extraordinary` keys. Step 1 is a no-op; step 5 only logs. Maintainers may re-enable broken logic. Not a runtime bug today.

**Fix:** Move to a comment referencing `V2_SUBCATEGORY_MANIFEST` or delete after Phase 49 rewrite (TODO line 39).

### IN-02: Vitest suite co-located with Playwright seed helpers

**File:** `tests/category-settings-seed.ts:238-288`, `vitest.config.ts:19`

**Issue:** R-FN-03 tests live in a helper module imported by Playwright. Works via vitest include, but couples test imports to operational seed code.

**Fix:** Extract R-FN-03 assertions to `tests/seed-nature-assignment.test.ts` (optional hygiene).

---

_Reviewed: 2026-06-11T12:42:00Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_
