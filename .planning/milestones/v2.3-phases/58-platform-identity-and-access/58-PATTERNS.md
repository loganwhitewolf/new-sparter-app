# Phase 58: platform-identity-and-access - Pattern Map

**Mapped:** 2026-06-29
**Files analyzed:** 7 (3 modified source, 1 generated migration, 1 optional seed-extras step, 2 tests)
**Analogs found:** 7 / 7 (all analogs are the same files being modified — this is an in-place schema/DAL edit with strong existing precedent)

> This phase is a behavior-preserving schema rename/drop + an access-WHERE relaxation. Every "analog" is the file itself in its current form (the pattern to preserve while editing) plus one cross-file precedent each: migration `0022` for the migration, and `seed-extras.ts` STEPS for any backfill. Excerpts below are the exact current shapes the planner must transform.

## File Classification

| File | New/Mod | Role | Data Flow | Closest Analog | Match Quality |
|------|---------|------|-----------|----------------|---------------|
| `lib/db/schema.ts` (platform table 254-276, relations) | modified | model (schema) | n/a (DDL source) | self + `importFormatVersion` def 278-323 | exact |
| `drizzle/migrations/0023_*.sql` | new (generated) | migration | DDL/transform | `drizzle/migrations/0022_wonderful_eternals.sql` | exact (same drop+rename family) |
| `lib/dal/import-formats.ts` (10-95, 124-199) | modified | DAL (access query) | request-response (read, access-control) | self (current `accessibleWhere`) | exact |
| `lib/services/import-format-wizard.ts` `createPrivateRows` 211-289 | modified | service (write glue) | CRUD (insert) | self | exact |
| `scripts/seed-extras.ts` STEP (optional) | maybe-new | migration (data) | batch/transform | existing STEPS array (e.g. 163-243) | exact — only if drop+add forced |
| `tests/import-private-formats-dal.test.ts` | modified | test | n/a | self (Proxy-mock pattern) | exact |
| `tests/import-format-wizard-actions.test.ts` | modified | test | n/a | self (insert assertions) | exact |

## Pattern Assignments

### `lib/db/schema.ts` — `platform` table (model)

**Analog:** the table itself, `lib/db/schema.ts:254-276`. Current shape (transform target):
```typescript
export const platform = pgTable("platform", {
  id: serial("id").primaryKey(),
  ownerUserId: text("owner_user_id").references(() => user.id, { onDelete: "cascade" }),   // RENAME → proposedByUserId / "proposed_by_user_id"
  visibility: varchar("visibility", { length: 24 }).default("global").notNull(),           // DROP
  reviewStatus: varchar("review_status", { length: 24 }).default("approved").notNull(),     // keep (drives lifecycle)
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  country: varchar("country", { length: 2 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  // timestamps …
}, (table) => [
  index("platform_slug_idx").on(table.slug),
  index("platform_ownerUserId_idx").on(table.ownerUserId),                       // RENAME index → platform_proposedByUserId_idx
  index("platform_visibility_reviewStatus_idx").on(table.visibility, table.reviewStatus), // DROP (drop visibility) → replace with platform_reviewStatus_idx
]);
```

**Sibling pattern to mirror for the FK + index conventions** — `importFormatVersion` def at `lib/db/schema.ts:278-323` (same `text("owner_user_id").references(() => user.id, { onDelete: "cascade" })` idiom, same per-column `index(...)` array style). Keep `proposedByUserId` nullable (no `.notNull()`), matching the current `ownerUserId`.

**Relation pattern** — `platformRelations` (CONTEXT names ~617-622): change only the `fields:` ref to `platform.proposedByUserId`; keep the relation key `owner` (D-06 minimal-diff; per RESEARCH Open Question 2).

### `drizzle/migrations/0023_*.sql` (migration)

**Analog:** `drizzle/migrations/0022_wonderful_eternals.sql` — the precedent for dropping `platform` columns. Verbatim drop idiom this phase mirrors:
```sql
ALTER TABLE "platform" DROP COLUMN "delimiter";--> statement-breakpoint
-- … 11 more identity-vs-contract drops, each its own statement-breakpoint
ALTER TABLE "platform" DROP COLUMN "description_strip_pattern";
```
Note `0022` is pure `DROP COLUMN` (and a backfill `UPDATE … FROM` before NOT-NULL tightening at lines 1-30). `0023` adds the novel piece — a RENAME — which `0022` does not exercise.

**Generation pattern (RESEARCH Pattern 1, load-bearing):** generate interactively via `yarn db:generate`, answer the prompt `Is owner_user_id … created or renamed` with **renamed**, then READ the SQL. It MUST contain:
```sql
ALTER TABLE "platform" RENAME COLUMN "owner_user_id" TO "proposed_by_user_id";
```
and MUST NOT contain `ADD COLUMN "proposed_by_user_id"` paired with `DROP COLUMN "owner_user_id"`. A true RENAME carries data → no backfill.

**Apply pattern** — runner is `scripts/migrate.ts` (`yarn db:migrate`); it shells `yarn drizzle-kit migrate` with a scoped `DATABASE_URL`. No code change to the runner; it already handles any generated migration. Never `drizzle-kit push`.

### `lib/dal/import-formats.ts` (DAL, access-control read) — TWO LAYERS, edit in lockstep

**Analog:** the file itself. This is the security boundary (ASVS V4). Current code has FOUR coupled surfaces that all reference the dropped/renamed columns — all four must change together or the in-memory fail-closed guard silently drops every row (RESEARCH Pitfall 3).

**Imports (lines 1-6):** standard DAL header — `import 'server-only'`, drizzle operators `{ and, eq, inArray, isNull, or }`, `db`, schema tables. Unchanged.

**1 — Row type + shape guard (10-72):** current type carries `visibility`, `platformVisibility`, `platformOwnerUserId`. Drop `platformVisibility` and `platformOwnerUserId` from `ImportFormatRow` (10-37) AND from `hasExpectedRowShape` (43-72). Decide per Discretion whether to keep format-level `visibility`.

**2 — Validators (74-95):** current shape to relax:
```typescript
function isGlobalApproved(row: ImportFormatRow) {
  return (
    row.ownerUserId === null &&
    row.platformOwnerUserId === null &&                 // remove
    row.visibility === GLOBAL_VISIBILITY &&             // stop relying on (column kept but not authoritative)
    row.platformVisibility === GLOBAL_VISIBILITY &&     // remove (column gone)
    row.reviewStatus === APPROVED_REVIEW_STATUS &&
    row.platformReviewStatus === APPROVED_REVIEW_STATUS
  )
}
function isOwnedBy(row: ImportFormatRow, userId: string) {
  return (
    (row.ownerUserId === userId || row.platformOwnerUserId === userId) &&  // → key ONLY off importFormatVersion.ownerUserId
    row.visibility === PRIVATE_VISIBILITY &&
    row.platformVisibility === PRIVATE_VISIBILITY        // remove
  )
}
function isAccessibleImportFormat(row, userId) {
  return row.isActive && row.platformIsActive && (isGlobalApproved(row) || isOwnedBy(row, userId))
}
```
Relax: `isGlobalApproved` keys on `platformReviewStatus === 'approved'` (the new "shared identity" signal, replacing `platformVisibility === 'global'`); `isOwnedBy` keys on `row.ownerUserId === userId` plus a `reviewStatus` visibility guard (platform approved OR proposed-by-this-user).

**3 — SQL `accessibleWhere` (124-154):** current 3-branch OR (global / format-owner-on-private-platform / platform-owner). Remove branch 3 (platform-owner) and the `platform.visibility` predicates per D-04. Target shape is given verbatim in RESEARCH Pattern 2 (two-branch OR + reviewStatus guard).

**4 — `.select({…})` (162-190):** drop `platformOwnerUserId: platform.ownerUserId` and `platformVisibility: platform.visibility`. Keep `platformReviewStatus`, `platformName`, `platformSlug`, `platformCountry`. The `innerJoin(platform, eq(importFormatVersion.platformId, platform.id))` and the post-query `.filter(hasExpectedRowShape).filter(isAccessibleImportFormat).map(toCandidate)` chain (196-198) stay structurally identical.

### `lib/services/import-format-wizard.ts` — `createPrivateRows` (service, insert glue)

**Analog:** the function itself, `lib/services/import-format-wizard.ts:211-289`. Imports (1-15) follow the service convention: `import 'server-only'`, `DbOrTx` from `@/lib/db`, schema tables, validation schemas from `@/lib/validations/import`. Local constants at 57-58:
```typescript
const PRIVATE_VISIBILITY = 'private'
const DRAFT_REVIEW_STATUS = 'draft'   // superseded by 'pending'
```

**Platform insert (220-232) — current, to adapt:**
```typescript
.insert(platform).values({
  ownerUserId: input.userId,          // → proposedByUserId (key follows the renamed schema field — RESEARCH Pitfall 5)
  visibility: PRIVATE_VISIBILITY,     // REMOVE (column gone — any write is a runtime error)
  reviewStatus: DRAFT_REVIEW_STATUS,  // → 'pending'
  name: input.platformName, slug, country: 'IT', isActive: true,
})
```
The `importFormatVersion` insert (239-264) keeps `ownerUserId`/`visibility` (format-level columns kept per Discretion A3); align its `reviewStatus` to `'pending'` for consistency (RESEARCH Pitfall 4, Open Question 1). The transactional `DbOrTx` param, the `.returning(...)` + null-guard-throw `ImportFormatWizardError` pattern, and the trailing `fileTable` update are unchanged.

### `scripts/seed-extras.ts` STEP (optional, only if drop+add is forced)

**Analog:** existing idempotent STEPS (e.g. the slug/name UPDATE at 163-243) — each step is a named async fn taking `Db`, doing an idempotent `UPDATE … WHERE` on existing rows by slug/id. **Do NOT add a STEP if the migration is a true RENAME** (data carries automatically — RESEARCH Anti-Pattern + Don't-Hand-Roll). Append only as the D-02 fallback if a drop+add was unavoidable. Run via `yarn db:seed-extras`.

### Test files (`tests/import-private-formats-dal.test.ts`, `tests/import-format-wizard-actions.test.ts`)

**Analog:** `tests/import-private-formats-dal.test.ts` (read in full). The Proxy-mock pattern is the exact harness to reuse — it exercises ONLY the in-memory filter layer (RESEARCH Pattern 2 caveat):
```typescript
vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ rows: [] as unknown[] }))
function makeQueryChain() { /* Proxy where any method → self, then → resolve(mocks.rows) */ }
vi.mock('@/lib/db', () => ({ db: { select: vi.fn(() => makeQueryChain()) } }))
const { loadImportFormatsForDetection } = await import('../lib/dal/import-formats')
```
`makeRow` (29-57) currently includes `platformVisibility`, `platformOwnerUserId`, `visibility` — drop the gone keys, add the cross-platform owner case (owner-format on an `approved` platform → visible to owner, hidden from `user-b`) and the `pending`-platform-proposer matrix (PLAT-02/PLAT-03). Keep the existing fail-closed test (104-110) but key it on a still-present column. `import-detector.test.ts` (six seeded formats) must stay green untouched (D-05 guard).

## Shared Patterns

### Schema FK + index convention
**Source:** `lib/db/schema.ts:258, 271-275, 282-322`
**Apply to:** the `proposedByUserId` rename.
```typescript
text("owner_user_id").references(() => user.id, { onDelete: "cascade" })   // → text("proposed_by_user_id")…
// index array: index("<table>_<field>_idx").on(table.<field>)
```

### Two-layer fail-closed access filter
**Source:** `lib/dal/import-formats.ts:124-154` (SQL) + `74-95` (in-memory)
**Apply to:** every column change in this DAL. SQL WHERE and in-memory `isGlobalApproved`/`isOwnedBy`/`hasExpectedRowShape` MUST change in lockstep — the unit test only proves the in-memory layer, so an SQL-only edit ships a broken/over-exposing query (RESEARCH Anti-Pattern, Security V4).

### Drizzle DECIMAL / monetary
Not applicable — no monetary columns touched this phase.

### Migration apply path
**Source:** `scripts/migrate.ts` (+ `yarn db:migrate`)
**Apply to:** `0023`. Generate via `drizzle-kit generate`, apply via the runner; never `drizzle-kit push` (CLAUDE.md hard rule).

## No Analog Found

None. Every file in scope has an exact in-repo precedent.

## Metadata

**Analog search scope:** `lib/db/schema.ts`, `lib/dal/`, `lib/services/`, `drizzle/migrations/`, `scripts/`, `tests/`
**Files scanned/read:** schema.ts (254-323), import-formats.ts (1-199), import-format-wizard.ts (1-45, 205-294), migrate.ts, 0022_wonderful_eternals.sql, import-private-formats-dal.test.ts, imports.ts (join confirmation), seed-extras.ts (STEP shape)
**Pattern extraction date:** 2026-06-29
