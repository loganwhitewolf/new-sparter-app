# S02 Research: Schema migration & merged category DAL

**Milestone:** M005 Category Management & UX Polish  
**Slice:** S02 Schema migration & merged category DAL  
**Researched:** 2026-05-12  
**Lane:** research

## Summary

S02 is the database/DAL unblocker for user-managed categories. The current schema has global `category` and `sub_category` rows only; `lib/dal/categories.ts` returns an unscoped active category tree with no ownership metadata and no override layer. The implementation should add nullable ownership to both category tables, add a per-user system-subcategory override table, and update `getCategories()` to return the merged system + owned tree for the verified user while preserving the existing `id/name/slug/type/subCategories` shape for current consumers.

The highest-risk finding is uniqueness: `category.slug` is currently globally unique and `sub_category` is unique on `(category_id, slug)`. If those constraints stay unchanged, two users cannot create the same category slug, a user cannot create a category whose slug matches a system category, and two users cannot create the same custom subcategory under the same system category. The migration likely needs to replace these with scoped/partial unique indexes before real CRUD can work.

## Active Requirements

- **R024 — User-owned categories and subcategories:** primary S02 schema requirement. Needs nullable owner columns and DAL filtering `(user_id is null or user_id = session user)`.
- **R025 — Subcategory system override rename:** primary S02 schema/DAL requirement. Needs `user_subcategory_override` and read-time merge into subcategory names.
- **R023 — Category/subcategory management page:** supported by S02 through ownership metadata in returned rows (`isOwned`, `ownerUserId`, override/original-name fields).
- **R027 — Subcategory deletion blocked when expenses linked:** supported by S02 because later delete guards need to distinguish user-owned vs system rows and count linked user expenses.
- **R028/R026:** supported indirectly; combobox and pattern settings need the merged tree and a user-owned indicator for the “Personale” badge.

## Existing Implementation Landscape

### Schema: `lib/db/schema.ts`

Current tables:

- `category`
  - `id serial primary key`
  - `name varchar(100) not null`
  - `slug varchar(100) not null().unique()`
  - `type category_type not null` (`in`/`out`/`system`)
  - `displayOrder`, `isActive`
  - indexes: `category_slug_idx`, `category_type_idx`
  - **No owner column.**

- `subCategory`
  - `id serial primary key`
  - `categoryId` FK to `category.id` with `onDelete: cascade`
  - `name`, `slug`, `displayOrder`, `isActive`, `excludeFromTotals`
  - index: `sub_category_categoryId_idx`
  - unique: `sub_category_category_slug_unique` on `(categoryId, slug)`
  - **No owner column.**

- `categorizationPattern` already has the useful precedent:
  - `userId text("user_id").references(() => user.id, { onDelete: "cascade" })`
  - indexes by user/subcategory.

- `expense.subCategoryId` references `subCategory.id` with `onDelete: "set null"`, so deletion can be guarded in actions first and is DB-safe if allowed.

Recommended additions:

- `category.userId text("user_id").references(() => user.id, { onDelete: "cascade" })` nullable.
- `subCategory.userId text("user_id").references(() => user.id, { onDelete: "cascade" })` nullable.
- New `userSubcategoryOverride` table (table name `user_subcategory_override`):
  - `id serial primary key` or composite PK; existing style favors serial IDs, but a composite unique index is sufficient.
  - `userId text("user_id").notNull().references(() => user.id, { onDelete: "cascade" })`
  - `subCategoryId integer("sub_category_id").notNull().references(() => subCategory.id, { onDelete: "cascade" })`
  - `customName varchar("custom_name", { length: 100 }).notNull()`
  - timestamps optional but useful for settings UX; match project style if added.
  - unique index/constraint on `(userId, subCategoryId)`.
  - index on `userId`, index on `subCategoryId`.

Also add relations:

- `categoryRelations`: likely `owner: one(user)` if `userId` is added, plus existing `subCategories`.
- `subCategoryRelations`: `owner: one(user)`, existing category/expenses/patterns.
- `userSubcategoryOverrideRelations`: user + subCategory.

### Seed data: `drizzle/seed.ts`

Seeded categories use explicit IDs and no owner. Seeded subcategories are inserted without explicit IDs. Seed uses `.onConflictDoNothing()` and later reads seeded subcategories by slug for patterns.

There are 27 seeded categories (including system `ignore`) and 120+ seeded subcategories. Adding nullable columns is non-destructive. System rows should remain `user_id = null`.

### Current category DAL: `lib/dal/categories.ts`

Current export:

```ts
export type CategoryWithSubCategories = {
  id: number
  name: string
  slug: string
  type: 'in' | 'out' | 'system'
  subCategories: Array<{ id: number; name: string; slug: string }>
}

export const getCategories = cache(async (): Promise<CategoryWithSubCategories[]> => { ... })
```

Current query:

- selects category + subcategory fields;
- left joins `subCategory` by category ID;
- filters only `category.isActive = true`;
- orders by `category.displayOrder`, `subCategory.displayOrder`;
- does not filter inactive subcategories;
- has no user scoping or overrides.

Current call sites:

- `app/(app)/expenses/page.tsx`
- `app/(app)/transactions/page.tsx`
- `app/(app)/settings/patterns/page.tsx`
- later: `app/(app)/settings/categories/page.tsx`

Current component imports of `CategoryWithSubCategories` expect existing fields; expansion must be additive.

### Revalidation status

S01 already added `lib/actions/revalidation.ts` with `revalidateCategorizationSurfaces()` covering `/expenses`, `/transactions`, `/dashboard`, `/settings/patterns`, and `/settings/categories`. Memory notes say category-affecting server actions should call this helper only after successful mutations. This matters later, but S02 should not duplicate route lists.

## Recommended DAL Shape

Preserve backward compatibility and add metadata:

```ts
export type CategoryWithSubCategories = {
  id: number
  name: string
  slug: string
  type: 'in' | 'out' | 'system'
  userId: string | null
  isOwned: boolean
  subCategories: Array<{
    id: number
    name: string          // override-applied display name
    originalName: string  // raw system/user-owned name
    slug: string
    userId: string | null
    isOwned: boolean
    hasOverride: boolean
    customName: string | null
  }>
}
```

`name` should remain the display name used by existing UIs. For system subcategories with a user override, `name = override.customName`; `originalName = subCategory.name`; `hasOverride = true`. For user-owned rows and non-overridden system rows, `name = originalName`.

Recommended structure to avoid zero-argument React cache ambiguity:

```ts
const getCategoriesForUser = cache(async (userId: string) => { ... })

export async function getCategories() {
  const session = await verifySession()
  return getCategoriesForUser(session.userId)
}
```

This follows existing DAL convention (`getExpenses`, `getTransactions`) where DAL verifies the session internally, while still making the cache key user-specific.

Query strategy:

- `from(category)`
- left join `subCategory` with join condition, not `where`, so empty categories are retained:
  - `subCategory.categoryId = category.id`
  - `subCategory.isActive = true`
  - `(subCategory.userId is null OR subCategory.userId = userId)`
- left join `userSubcategoryOverride` with:
  - `override.subCategoryId = subCategory.id`
  - `override.userId = userId`
- category `where`:
  - `category.isActive = true`
  - `(category.userId is null OR category.userId = userId)`
- order by:
  - `category.displayOrder`, `category.id`, `subCategory.displayOrder`, `subCategory.id`
  - Add `id` tie-breakers because seed displayOrder is currently `0` almost everywhere.

Required Drizzle imports in `lib/dal/categories.ts`: `and`, `asc`, `eq`, `isNull`, `or`.

## Migration / Uniqueness Recommendation

Do not only add columns/table. Fix uniqueness now or later CRUD will fail for normal multi-user cases.

Current constraints to revisit:

- `category.slug` global unique generated by `.unique()`.
- `category_slug_idx` separate non-unique index on the same column.
- `sub_category_category_slug_unique` on `(category_id, slug)`.

Recommended database uniqueness model:

- System categories: unique slug where `user_id IS NULL`.
- User categories: unique `(user_id, slug)` where `user_id IS NOT NULL`.
- System subcategories within a category: unique `(category_id, slug)` where `user_id IS NULL`.
- User subcategories within a category: unique `(user_id, category_id, slug)` where `user_id IS NOT NULL`.

Reason: PostgreSQL treats `NULL` values as distinct in a normal composite unique index, so `unique(category_id, slug, user_id)` alone would not protect system duplicates where `user_id` is null. Use partial unique indexes.

Drizzle schema likely needs `uniqueIndex` and `sql` partial indexes, e.g. conceptually:

```ts
uniqueIndex("category_system_slug_unique")
  .on(table.slug)
  .where(sql`${table.userId} is null`)

uniqueIndex("category_user_slug_unique")
  .on(table.userId, table.slug)
  .where(sql`${table.userId} is not null`)
```

If `drizzle-kit generate` does not express the partial index or drop existing constraints cleanly, use a generated migration plus manual SQL edits. The project config explicitly says use `drizzle-kit generate`; it does not forbid editing generated migration SQL for correctness.

Expected migration SQL shape:

- `ALTER TABLE "category" ADD COLUMN "user_id" text;`
- `ALTER TABLE "sub_category" ADD COLUMN "user_id" text;`
- create `user_subcategory_override` table.
- add FKs to `user(id)` and `sub_category(id)`.
- drop old global/category unique constraints as needed:
  - category global unique constraint name may be generated from `category_slug_unique` (confirm in generated SQL or database).
  - `sub_category_category_slug_unique` exists from schema.
- create partial unique indexes listed above.
- create normal indexes for owner lookup.

Watch-out: the migration journal includes entries through `0009_file_content_hash`, but only snapshots through `0006_snapshot.json` are present under `drizzle/migrations/meta`. If `drizzle-kit generate` complains or generates a wrong diff, this missing snapshot state is likely why. Do not confuse snapshot JSON `version: "7"` with migration sequence; memory MEM044 confirms the sequence is journal `idx`.

## Testing Strategy for `tests/categories-dal.test.ts`

There is no existing `tests/categories-dal.test.ts`. Follow the project’s DAL test pattern:

- mock `server-only` to `{}`;
- mock `react.cache` to identity function;
- mock `@/lib/dal/auth.verifySession` to return `{ userId: 'user-1' }`;
- mock `@/lib/db` with a chain returned from `db.select(shape)`;
- mock `drizzle-orm` operators to return inspectable objects.

Existing examples:

- `tests/expenses-dal.test.ts` has a compact query-chain mock and `verifySession` pattern.
- `tests/imports-dal.test.ts` captures `leftJoinArgs`, `whereArgs`, `orderByArgs` for query assertions.
- `tests/categorization-revalidation-actions.test.ts` verifies route helper behavior and uses `@/` import mocks; memory MEM006 says use `@/` aliases in tests when the module mock uses `@/`.

Recommended test cases for S02 acceptance:

1. **system-only user sees system rows**
   - mocked DB rows include category with `categoryUserId: null`, subcategory with `subCategoryUserId: null`, no override.
   - result preserves category and subcategory names; `isOwned: false`, `hasOverride: false`.

2. **user with owned categories sees merged tree**
   - mocked rows include one system category and one `categoryUserId: 'user-1'` category, plus owned subcategory.
   - assert both are present and owned flags are correct.

3. **user override customizes system subcategory name**
   - mocked row has system subcategory raw name and `overrideCustomName: 'Custom label'`.
   - assert returned subcategory `name` is custom label, `originalName` is raw, `hasOverride: true`.

4. **query is scoped to verified user**
   - assert `verifySession` called.
   - assert selected shape includes owner/override fields.
   - assert `where` includes category ownership `or(isNull(category.userId), eq(category.userId, 'user-1'))`.
   - assert subcategory join includes owner filter and active filter.

Unit tests can mock the query output by making `orderBy` return `Promise.resolve(rows)` because the current DAL awaits the chain after `orderBy`. If the implementation uses more joins, include `leftJoin` capture arrays.

Verification command:

```bash
yarn vitest run tests/categories-dal.test.ts
```

Additional schema verification:

```bash
yarn db:generate
# inspect generated migration before commit
DATABASE_URL=... yarn db:migrate
```

If local DB is available, also run seed/migration against a DB containing seeded data to prove 120+ existing subcategories do not violate new nullable owner constraints.

## Natural Work Seams

1. **Schema definitions first**
   - `lib/db/schema.ts`: add owner columns, override table, indexes/relations.
   - Generate/check migration.
   - This is the first proof because uniqueness/migration correctness is the highest risk.

2. **Category DAL merge**
   - `lib/dal/categories.ts`: add `verifySession`, user-scoped query, override merge, expanded type.
   - Keep current consumers compiling by only adding fields.

3. **Focused unit tests**
   - `tests/categories-dal.test.ts`: mock rows and query chain; verify merge behavior and query scoping.

These can be done in one executor task, but schema/migration should be verified before investing in downstream UI.

## Risks and Watch-outs

- **Global slug uniqueness is a blocker for multi-user CRUD.** Replace with scoped partial unique indexes, not a naive composite unique with nullable `user_id`.
- **Do not filter left-joined subcategories in the final `where`.** That would drop categories with no matching subcategories. Put subcategory active/ownership predicates in the join condition.
- **Display order tie-breaking matters.** Seeded display orders are mostly `0`; add `id` as a deterministic tie-breaker.
- **Current `getCategories()` does not filter inactive subcategories.** S02 should add this while changing the join.
- **Existing expense/dashboard DALs still display raw category/subcategory names from direct joins.** S02 acceptance is about `getCategories`; later slices may need override-aware display if user-visible transaction/expense labels must reflect overrides outside combobox/settings.
- **Language convention:** developer-facing names/routes/tests/comments must be English. Italian is OK for seeded taxonomy/user-facing validation only. Run `yarn check:language` if touching comments/tests/docs beyond this slice.
- **No direct DB pushes.** Project constraint says Drizzle migration via `drizzle-kit generate` + migration script, not `push`.
- **Use `revalidateCategorizationSurfaces()` later.** New category actions in later slices should use the helper after successful mutations only (MEM136/MEM137).

## Skill Discovery

Installed skills directly relevant to later implementation quality:

- `react-best-practices` exists, but S02 is mostly DAL/schema, so it is not needed now.
- `test` exists and can help if test generation/debugging expands.

Promising external skills found but not installed:

- Drizzle ORM:
  - `npx skills add bobmatnyc/claude-mpm-skills@drizzle-orm` (4.2K installs) — most relevant for Drizzle schema/migrations.
  - `npx skills add giuseppe-trisciuoglio/developer-kit@drizzle-orm-patterns` (821 installs) — possible secondary option.
- PostgreSQL:
  - `npx skills add wshobson/agents@postgresql-table-design` (16.6K installs) — relevant for partial unique index design.
  - `npx skills add github/awesome-copilot@postgresql-code-review` (9.9K installs) — useful if reviewing the migration SQL.

No installation was performed.

## Sources Inspected

- `lib/db/schema.ts`
- `lib/dal/categories.ts`
- `lib/actions/revalidation.ts`
- `lib/routes.ts`
- `drizzle/seed.ts`
- `drizzle.config.ts`
- `scripts/migrate.ts`
- `drizzle/migrations/*`
- `drizzle/migrations/meta/_journal.json`
- `tests/expenses-dal.test.ts`
- `tests/imports-dal.test.ts`
- `tests/categorization-revalidation-actions.test.ts`
- `package.json`
- Memory query: category schema migration / merged DAL / override / userId
