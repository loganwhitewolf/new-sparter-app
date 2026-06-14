# Phase 46: direction-nature-schema - Pattern Map

**Mapped:** 2026-06-10
**Files analyzed:** 2 primary (`lib/db/schema.ts`, `scripts/seed-data.ts`) + ~12 build-survival call sites
**Analogs found:** all in-repo (schema is its own analog source) — no external pattern needed

> Schema-authorship phase. Design is LOCKED (ADR `0012-direction-derived-from-nature-allocation.md`, `46-CONTEXT.md`, `nature-remapping-WORKING.md`). Do **not** re-derive the model. This map only assigns concrete copy-from idioms. No `drizzle-kit generate`, no DB apply (D-06).

## File Classification

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `lib/db/schema.ts` — new `direction` table | model (lookup) | reference data | `category` table `schema.ts:158-180` | role-match (static lookup, no userId) |
| `lib/db/schema.ts` — new `nature` table | model (lookup + FK) | reference data | `subCategory` table `schema.ts:182-207` | exact (lookup with FK to parent lookup) |
| `lib/db/schema.ts` — `subCategory.natureId` / `userSubcategoryOverride.natureId` FK | model (FK column) | request-response | `subCategory.categoryId` FK `schema.ts:187-189` | exact |
| `lib/db/schema.ts` — `directionRelations` / `natureRelations` | model (relations) | n/a | `categoryRelations`/`subCategoryRelations` `schema.ts:516-536` | exact |
| `lib/db/schema.ts` — remove `category.type`+enum+index | model (removal) | n/a | — | removal |
| `lib/db/schema.ts` — remove `categorizationPattern.amountSign`+enum, unique→`(pattern, subCategoryId)` | model (removal) | n/a | unique idiom `schema.ts:446-450` | role-match |
| `scripts/seed-data.ts` — new `directions` / `natures` arrays | config (seed data) | batch insert | `categories` array `seed-data.ts:3+`, `platforms` `seed-data.ts:1141+` | exact |
| `scripts/seed.ts` — insert the two new arrays | config (seed runner) | batch insert | `db.insert(category)...onConflictDoNothing()` `seed.ts:72` | exact |
| `lib/utils/nature-labels.ts` `FlowNature` union (9→…) | utility (type) | n/a | self | build-survival anchor |
| ~12 DAL/action/validation call sites | various | request-response | — | build-survival only (D-05) |

## Pattern Assignments

### `direction` table (new lookup, static 4 rows)

**Analog:** `category` (`lib/db/schema.ts:158-180`) — system lookup, `serial` PK, slug-based, indexed. `direction` is simpler: no `userId` (always global), `code` is the unique key.

Copy the `serial` PK + `varchar` slug/code + `index` idiom. `direction` adds the analytical booleans from CONTEXT.md L11 / specifics L100-101:

```typescript
// model after category (schema.ts:158-180); columns from CONTEXT.md L11
export const direction = pgTable(
  "direction",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 24 }).notNull().unique(),   // in | out | allocation | transfer
    labelIt: varchar("label_it", { length: 100 }).notNull(),
    netWorthEffect: varchar("net_worth_effect", { length: 16 }).notNull(), // increase|decrease|neutral
    includedInTotals: boolean("included_in_totals").default(false).notNull(),
    shownSeparately: boolean("shown_separately").default(false).notNull(),
    hidden: boolean("hidden").default(false).notNull(),
    displayOrder: integer("display_order").default(0).notNull(),
    color: varchar("color", { length: 16 }),
  },
  (table) => [index("direction_code_idx").on(table.code)],
);
```
`net_worth_effect` as `varchar` (not a new enum) is consistent with the contract's "lookup-not-enum" decision (CONTEXT.md L87) — avoids a fresh pgEnum migration. `onDelete` for the parent is N/A (it's the parent). Exact column lengths/types are Claude's discretion (CONTEXT.md L50).

### `nature` table (new lookup + FK to `direction`)

**Analog:** `subCategory` (`lib/db/schema.ts:182-207`) — a lookup that FKs its parent lookup. Copy the FK idiom exactly:

**FK idiom** (`schema.ts:187-189`):
```typescript
categoryId: integer("category_id")
  .notNull()
  .references(() => category.id, { onDelete: "cascade" }),
```

Apply as `direction_id` NOT NULL FK (CONTEXT.md L12, D-02 — NOT NULL is load-bearing: it forbids a directionless nature, which is why uncategorized = `nature_id NULL`, not a nature row):
```typescript
export const nature = pgTable(
  "nature",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 32 }).notNull().unique(),
    directionId: integer("direction_id")
      .notNull()
      .references(() => direction.id, { onDelete: "restrict" }), // restrict: lookup parents must not vanish
    labelIt: varchar("label_it", { length: 100 }).notNull(),
    color: varchar("color", { length: 16 }),
    displayOrder: integer("display_order").default(0).notNull(),
  },
  (table) => [index("nature_directionId_idx").on(table.directionId)],
);
```
8 rows, not 9 (D-01): `income`, `income_extraordinary`, `essential`, `discretionary`, `debt`, `transfer`, `savings`, `investment`. `onDelete` is Claude's discretion (CONTEXT.md L50) — `restrict` recommended for static lookups.

### `subCategory.natureId` / `userSubcategoryOverride.natureId` (replace `flow_nature` enum col)

Current enum columns: `subCategory.nature` (`schema.ts:195`), `userSubcategoryOverride.nature` (`schema.ts:220`), both `flowNatureEnum("nature")` and **nullable** (no `.notNull()`). Preserve nullability — null = uncategorized (D-02).

Replace with a nullable FK, same `references()` shape as `schema.ts:187-189` but `onDelete: "set null"` (matches `expenseClassificationHistory.fromSubCategoryId` precedent `schema.ts:464-466`):
```typescript
natureId: integer("nature_id").references(() => nature.id, { onDelete: "set null" }),
```
Add a `sub_category_natureId_idx` mirroring `sub_category_categoryId_idx` (`schema.ts:199`).

### `relations()` wiring

**Analog:** `categoryRelations` / `subCategoryRelations` (`schema.ts:516-536`). Add:
```typescript
export const directionRelations = relations(direction, ({ many }) => ({
  natures: many(nature),
}));

export const natureRelations = relations(nature, ({ one, many }) => ({
  direction: one(direction, {
    fields: [nature.directionId],
    references: [direction.id],
  }),
  subCategories: many(subCategory),
  overrides: many(userSubcategoryOverride),
}));
```
Then add `nature: one(nature, { fields: [subCategory.natureId], references: [nature.id] })` to `subCategoryRelations` (`schema.ts:524-536`) and the same to `userSubcategoryOverrideRelations` (`schema.ts:538-550`), following the existing `category: one(category, …)` shape at `schema.ts:529-532`.

### Removals

| Object | Location | Action |
|--------|----------|--------|
| `categoryTypeEnum` | `schema.ts:26` | delete |
| `category.type` | `schema.ts:165` | delete |
| `category_type_idx` | `schema.ts:172` | delete |
| `flowNatureEnum` | `schema.ts:52-62` | delete (replaced by `nature` table) |
| `amountSignEnum` | `schema.ts:42` | delete |
| `categorizationPattern.amountSign` | `schema.ts:431` | delete |
| unique `(pattern, subCategoryId, amountSign)` | `schema.ts:446-450` | shrink to `(pattern, subCategoryId)` |

**KEEP (D-10 deviation):** `subCategory.excludeFromTotals` (`schema.ts:194`) stays in Phase 46 — removed in Phase 49. Do **not** touch it. This contradicts the roadmap SC#6 / DATA-06, now reassigned to Phase 49.

**Unique shrink** — copy the `unique(...).on(...)` idiom from `schema.ts:446-450`, dropping the third column:
```typescript
unique("categorization_pattern_unique").on(table.pattern, table.subCategoryId),
```
Pattern becomes sign-agnostic (ADR 0008 superseded by 0012; working-doc L182, L192).

### `scripts/seed-data.ts` — new `directions` / `natures` arrays (D-07, D-08)

**Analog:** `categories` array (`seed-data.ts:3+`) and `platforms` (`seed-data.ts:1141+`) — plain exported arrays of literal row objects with explicit `id`. Add two new exported arrays at top of file in the same shape. Use `as const`/cast idiom like `amountType: "single" as AmountType` (`seed-data.ts`) for the `netWorthEffect` literal if a narrow type is introduced.

```typescript
export const directions = [
  { id: 1, code: "in",         labelIt: "Entrate",          netWorthEffect: "increase", includedInTotals: true,  shownSeparately: false, hidden: false, displayOrder: 0, color: "..." },
  { id: 2, code: "out",        labelIt: "Uscite",           netWorthEffect: "decrease", includedInTotals: true,  shownSeparately: false, hidden: false, displayOrder: 1, color: "..." },
  { id: 3, code: "allocation", labelIt: "Accantonamenti",   netWorthEffect: "neutral",  includedInTotals: false, shownSeparately: true,  hidden: false, displayOrder: 2, color: "..." },
  { id: 4, code: "transfer",   labelIt: "Trasferimenti",    netWorthEffect: "neutral",  includedInTotals: false, shownSeparately: false, hidden: true,  displayOrder: 3, color: "..." },
];

export const natures = [
  // direction_id maps to directions above; 8 rows (D-01). label_it/color cross-check lib/utils/nature-labels.ts NATURE_LABELS/NATURE_COLORS.
  // income, income_extraordinary → 1 (in); essential, discretionary, debt → 2 (out); savings, investment → 3 (allocation); transfer → 4 (transfer)
];
```
Direction attribute semantics are fixed by CONTEXT.md L100-101 (in/out included; transfer hidden+excluded; allocation excluded+shownSeparately). `label_it`/`color` values cross-checked against `lib/utils/nature-labels.ts` `NATURE_LABELS` (`nature-labels.ts:12`) and `NATURE_COLORS` (`nature-labels.ts:38`) per CONTEXT.md L84 — note those maps still carry the OLD 9-member vocabulary (`operational`/`financial`/`extraordinary`); the new natures use `savings`/`investment` (renames per working-doc L9).

### `scripts/seed.ts` — consume the new arrays

**Analog:** `seed.ts:72` exactly:
```typescript
await db.insert(category).values(categories as Array<typeof category.$inferInsert>).onConflictDoNothing()
```
Add imports of `direction`/`nature` (schema) and `directions`/`natures` (seed-data) to the import blocks at `seed.ts:9` and `seed.ts:18-23`. Insert `directions` **before** `natures` (FK order), both with `.onConflictDoNothing()`. Optionally `setval` the sequences like `platform_id_seq` (`seed.ts:90`). Idempotent baseline insert — D-07/D-08 confirm this does not violate the additive-seed rule (new tables, not shipped shapes).

## Shared Patterns

### Drizzle column/index idiom
**Source:** every `pgTable` in `lib/db/schema.ts`. `serial("id").primaryKey()`, `varchar(col, { length })`, `boolean(col).default(x).notNull()`, `integer(col)`, `index("tbl_col_idx").on(table.col)`, `.references(() => parent.id, { onDelete })`. New tables must match this exactly.

### FK onDelete precedents
**Source:** `schema.ts:189` (`cascade`), `schema.ts:464-466` (`set null`), `schema.ts:311-314` (`set null`). Lookup parents → `restrict`; nullable child refs → `set null`.

### Seed array → insert
**Source:** `seed-data.ts` exports plain arrays; `seed.ts:72-140` inserts each via `.values(... as Array<typeof X.$inferInsert>).onConflictDoNothing()`. Apply identically.

## Build-Survival Call Sites (D-05 — compile only, NOT semantic correctness)

Full semantic rewrite of these is **Phase 49**. Phase 46 only needs `yarn build`/typecheck green after `category.type`, `flowNatureEnum`, and `amountSign` disappear. Concentration by file (per-file ref counts):

| File | Refs | What breaks | Minimal survival edit |
|------|------|-------------|-----------------------|
| `lib/dal/dashboard.ts` | ~42 | `category.type`, `subCategory.nature`, `FlowNature`, sign-split SQL | heaviest; map `category.type` reads to a `nature→direction` join or temporary derived expr; keep returns typed |
| `lib/actions/patterns.ts` | 9 | `amountSign` in pattern create/update | drop `amountSign` field |
| `lib/dal/transactions.ts` | 7 | `category.type` filter `:230-235`, `subCategory.nature` filter `:221-227`, `CategoryTypeValue`/`NatureValue` local types `:226,:234` | rewire to join `nature`/`direction` |
| `lib/dal/expenses.ts` | 5 | `isNull(category.type)` `:149`, `eq(category.type,…)` `:152`, `subCategory.nature` `:141-144`, local types `:143,:151` | same |
| `lib/dal/categories.ts` | 4 | `category.type` select `:72`, `nature` create/update `:211,:238,:247`, `effectiveNature` `:79` | rewire to `natureId` |
| `lib/utils/cascade-options.ts` | 4 | type→nature cascade derived from `category.type` | adjust source; full rewrite deferred to Phase 49 |
| `app/(app)/dashboard/categories/page.tsx` | 4 | `category.type` display | derive from direction |
| `app/(app)/dashboard/categories/[id]/page.tsx` | 4 | same | same |
| `lib/validations/pattern.ts` | 3 | `amountSign` Zod field | remove field |
| `lib/dal/overview.ts` | 3 | `category.type` transfer filters `:57,:209,:229`, `nature` agg `:313-374` | rewire to direction join |
| `lib/categorization/subcategory-options.ts` | 2 | `category.type` | adjust |
| `lib/dal/subcategory-usage.ts` | 1 | `inArray(category.type,…)` `:40` | rewire |
| `lib/dal/patterns.ts` | 1 | `select({ type: category.type })` `:34` | rewire |
| `app/(app)/transactions/page.tsx` | 1 | type filter prop | adjust |
| `app/(app)/expenses/page.tsx` | 1 | same | adjust |
| `app/(app)/onboarding/_components/step-1-upload.tsx` | 1 | `category.type` | adjust |
| `lib/services/categorization.ts` | n | `amountSign` matching logic `:64-72`, select `:42` | drop sign matching (sign-agnostic patterns) |
| `lib/services/pattern-application.ts` | n | `amountSign` | drop |

**Type anchor:** `lib/utils/nature-labels.ts` defines the hand-maintained `FlowNature` union (`nature-labels.ts:1-10`, 9 members incl. dead `operational`/`financial`/`extraordinary`) plus `NATURE_LABELS`/`NATURE_ORDER`/`NATURE_COLORS` maps consumed across DAL/validations. When `flowNatureEnum` is removed, `NatureValue = (typeof subCategory.$inferSelect)['nature']` derivations (`expenses.ts:143`, `transactions.ts:226`) break — they now resolve to `number | null` (the FK). The planner must decide whether `FlowNature` becomes a derived/code-string type sourced from the `nature` table; this is the widest typecheck blast radius after `dashboard.ts`.

**Test:** `lib/validations/__tests__/expense.test.ts` asserts nature values (`:72`, `:77`) — will need the new nature vocabulary or sentinel handling to stay green.

## No Analog Found

None. Every new object maps to an existing in-repo idiom. RESEARCH.md was not present in the phase directory; pattern source is `lib/db/schema.ts` + `scripts/seed*.ts` themselves.

## Metadata

**Analog search scope:** `lib/db/schema.ts`, `scripts/seed-data.ts`, `scripts/seed.ts`, `lib/`, `app/`
**Files scanned:** ~30
**Pattern extraction date:** 2026-06-10
**Note:** ADR path is `docs/adr/0012-direction-derived-from-nature-allocation.md` (CONTEXT.md cites `0012-direction-derived-from-flownature.md` — stale filename, doc-cleanup follow-up).
