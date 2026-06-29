# Phase 58: platform-identity-and-access - Research

**Researched:** 2026-06-29
**Domain:** Drizzle ORM column rename/drop migration (Postgres) + relaxing a DAL visibility WHERE-clause without regression
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (PLAT-01):** Platform is never user-owned. Drop `platform.visibility`. Rename `platform.ownerUserId` → `platform.proposedByUserId` (provenance, not ownership).
- **D-02 (PLAT-01):** Schema change via `drizzle-kit generate` → migration `0023`, applied through `scripts/migrate.ts`. **Never `drizzle-kit push` in production.** Existing rows migrated without data loss: the value formerly in `ownerUserId` is preserved as `proposedByUserId`. Any row-level backfill on already-seeded rows is an idempotent step appended to `scripts/seed-extras.ts` STEPS — never edit `seed-data.ts` shapes.
- **D-03 (PLAT-02):** Platform visibility keys on `platform.reviewStatus` (already present): `pending` → visible only to its `proposedByUserId`; `approved` → visible to all. Seeded platforms remain `approved`. Operator approve→share UI is deferred.
- **D-04 (PLAT-03):** Relax `lib/dal/import-formats.ts accessibleWhere()`: a user-owned `importFormatVersion` (`ownerUserId = user`) is visible to its owner even when attached to a global/approved platform. Remove the platform-owner OR-branch (branch 3); private-format visibility keys off `importFormatVersion.ownerUserId`, not on the platform's visibility. Keep the global-approved path intact.
- **D-05 (PLAT-03 / SC4):** No regression on the hot `platform` join used by expenses/transactions/imports for filter/display/sort by `platform.slug` / `platform.name`. Existing global formats resolve and import exactly as before. Guard with tests over the existing global formats.
- **D-06 (scope-boundary glue):** Adapt only what is required to keep the app compiling and existing imports working — behavior-preserving glue, not feature work. `createPrivateRows()` adapts to new schema (no `visibility` write; new platform born `reviewStatus='pending'`). Validators and seed references adapted so reseed and access checks still run.

### Claude's Discretion
- **`importFormatVersion.visibility` handling.** ADR 0015 silent. Locked criteria only mandate dropping `platform.visibility` and keying access off `importFormatVersion.ownerUserId`. Decide keep-but-stop-relying-on vs retire; prefer smallest change satisfying D-04 + D-05. → **Recommendation below: KEEP the column, STOP referencing it in `accessibleWhere`/validators.**
- Exact shape of the no-regression test guard (unit over WHERE-clause vs integration over six existing formats) — planner's call. → **Recommendation below: unit, via the existing Proxy-mock pattern.**
- Whether the `proposedByUserId` backfill belongs in migration SQL or a `seed-extras` STEP. → **Recommendation below: neither — a true `RENAME COLUMN` carries the data; no backfill needed.**

### Deferred Ideas (OUT OF SCOPE)
- **Wizard attach-format UX** → Phase 59 (PLAT-04).
- **Seed slug-linkage + Trade Republic id-8 collision fix** → Phase 60 (PLAT-05).
- **DescriptionStripPattern glossary/comment correction** → Phase 60 (PLAT-06).
- **Operator approval UI ("approve → share")** → deferred by ADR 0015.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAT-01 | Platform never user-owned: drop `platform.visibility`, rename `ownerUserId`→`proposedByUserId`; existing rows migrated additively/idempotently via `drizzle-kit generate` + `scripts/migrate.ts`. | "Drizzle Column Rename Recipe" + "Dropping platform.visibility" sections — confirms a true `ALTER TABLE … RENAME COLUMN` preserves rows (no backfill) and lists the index/relation cleanup. |
| PLAT-02 | Platform visibility follows `reviewStatus` lifecycle: `pending`→proposer-only, `approved`→all; seeded stay `approved`. | "reviewStatus Lifecycle Wiring" section — where the guard belongs (DAL helper) and why seeded rows stay approved (column default unchanged). |
| PLAT-03 | Private Import Format decoupled from private Platform; `accessibleWhere` keys off `importFormatVersion.ownerUserId`; no regression on global formats. | "accessibleWhere Relaxation" + "Hot Platform Join" sections — concrete safe WHERE shape, the two-layer filter gotcha, and proof the hot join touches only identity columns. |
</phase_requirements>

## Summary

This phase is a tightly-scoped schema + access-control change with a deceptively dangerous core: a Drizzle column **rename** that must not become a drop+add. `drizzle-kit generate` detects renames *interactively* — it prints `Is owner_user_id column in platform table created or renamed from another column?` and waits for a keypress. If that prompt is answered "created" (or run non-interactively where it defaults to drop+add), every existing `ownerUserId` value is destroyed. The prod-safe recipe is: run `yarn db:generate` interactively, **answer "renamed"** for `owner_user_id → proposed_by_user_id`, then **read the generated SQL and confirm it contains `ALTER TABLE "platform" RENAME COLUMN "owner_user_id" TO "proposed_by_user_id";`** and NOT a `DROP COLUMN "owner_user_id"` + `ADD COLUMN "proposed_by_user_id"` pair. A true RENAME carries the data with the column, so **no backfill (migration SQL or seed-extras STEP) is required** — the D-02 seed-extras fallback only applies if a drop+add is unavoidable, which it is not here.

The access relaxation (D-04) has a subtle trap discovered in the code: `loadImportFormatsForDetection` filters in **two layers** — a SQL `accessScope` WHERE-clause *and* an in-memory `isAccessibleImportFormat()` re-check. Both layers reference the dropped/renamed columns (`platform.visibility`, `platform.ownerUserId`, `importFormatVersion.visibility`). Both must be updated together or the build breaks / access silently changes. The good news for D-05: the hot platform join (imports/expenses/transactions) reads **only** `platform.id`, `platform.name`, `platform.slug` — never the changed columns — so no-regression is structurally guaranteed; the only failure mode is the migration accidentally breaking the join, which a smoke test over the six seeded formats catches.

**Primary recommendation:** Generate `0023` interactively answering "renamed", verify the SQL is a true `RENAME COLUMN` + `DROP COLUMN visibility` (+ its index), keep `importFormatVersion.visibility` but stop referencing it, rewrite `accessibleWhere` to a two-branch OR (global-approved + format-owner) plus a `reviewStatus` visibility guard, and adapt the three caller sites (wizard `createPrivateRows`, the validators, and `loadImportFormatsForDetection`'s select + in-memory filter) to the new column set. Guard with a unit test over the in-memory filter (existing Proxy-mock pattern) covering the owner/non-owner/cross-user matrix and the six global formats.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Platform column rename/drop | Database / Migration (`drizzle/migrations/0023`, `scripts/migrate.ts`) | Schema (`lib/db/schema.ts`) | Schema is the source of truth drizzle-kit diffs against; migration is the irreversible prod artifact. |
| Platform visibility lifecycle (`reviewStatus`) | DAL (`lib/dal/import-formats.ts`) | — | Access decisions are data-access concerns; ADR keeps `platform` pure identity, no service-layer policy needed. |
| Format access decoupling (`accessibleWhere`) | DAL (`lib/dal/import-formats.ts`) | — | Single query owns both the SQL filter and the in-memory fail-closed re-check. |
| Wizard write-path glue | Service (`lib/services/import-format-wizard.ts`) | Test (`tests/import-format-wizard-actions.test.ts`) | `createPrivateRows` writes the changed columns; behavior-preserving adaptation only. |
| Schema relation | Schema (`lib/db/schema.ts` `platformRelations`) | — | `platformRelations.owner` references `platform.ownerUserId` — must follow the rename. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.45.2 (installed) | Schema definition, query builder | Project ORM (CLAUDE.md). [VERIFIED: node_modules] |
| drizzle-kit | ^0.31.10 (installed) | Migration generation (`generate`) | Project migration tool; `generate` has full rename support, `push` forbidden in prod. [VERIFIED: node_modules] |
| vitest | ^4.1.5 (installed) | Test runner | Project test framework (`yarn test` → `vitest run`). [VERIFIED: package.json] |

No new packages. This phase installs nothing — schema/DAL/test edits only.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Interactive `yarn db:generate` answering "renamed" | `drizzle-kit generate --custom` then hand-write `RENAME COLUMN` | `--custom` produces an empty file you fill by hand — safest if you distrust the interactive prompt, but loses the auto-generated index/snapshot diff. Use only if the interactive rename detection misfires. [CITED: drizzle-team/drizzle-orm-docs kit-custom-migrations] |

**Installation:** none.

## Package Legitimacy Audit

No external packages added in this phase. Section not applicable.

## Architecture Patterns

### System Architecture Diagram

```
                 yarn db:generate (INTERACTIVE)
schema.ts ─────────────────────────────────────────▶ drizzle-kit diff
(drop visibility,                                          │
 rename ownerUserId,                          prompt: "owner_user_id renamed?"
 add proposedByUserId)                                     │ answer: RENAMED
                                                           ▼
                                          drizzle/migrations/0023_*.sql
                                          ┌──────────────────────────────────┐
                                          │ DROP INDEX visibility_reviewStatus│
                                          │ ALTER … RENAME COLUMN owner_user_ │
                                          │   id TO proposed_by_user_id       │
                                          │ DROP COLUMN visibility            │
                                          └──────────────────────────────────┘
                                                           │ REVIEW SQL by hand
                                                           ▼
                              yarn db:migrate ─▶ scripts/migrate.ts ─▶ drizzle-kit migrate
                                                           │
                                                           ▼  data carried by RENAME (no backfill)
                                                     Postgres

ACCESS PATH (runtime):
  upload ─▶ loadImportFormatsForDetection(userId)
              │
              ├─ SQL layer: accessibleWhere()  ── innerJoin platform ──▶ rows
              │     (global-approved OR format-owner)  + reviewStatus guard
              │
              └─ in-memory layer: isAccessibleImportFormat(row, userId)  ◀── FAIL-CLOSED re-check
                    (must agree with SQL layer or rows silently drop)

HOT JOIN (no-regression, D-05):
  imports/expenses/transactions ── leftJoin platform ──▶ reads ONLY id, name, slug
                                                          (never visibility / ownerUserId)
```

File-to-implementation mapping is in the Component Responsibilities table below; the diagram shows data flow only.

### Component Responsibilities
| File / line | Responsibility | Change |
|-------------|----------------|--------|
| `lib/db/schema.ts:254-276` | `platform` table def | Drop `visibility` col + `platform_visibility_reviewStatus_idx`; rename `ownerUserId`→`proposedByUserId` (keep `text("proposed_by_user_id")`, FK to `user.id`, the `platform_ownerUserId_idx` index renamed accordingly). |
| `lib/db/schema.ts:617-622` | `platformRelations` | `owner: one(user, { fields: [platform.proposedByUserId], … })` — rename field ref. Optionally rename relation `owner`→`proposer` (cosmetic; ripples to callers — keep `owner` to minimize diff per D-06). |
| `drizzle/migrations/0023_*.sql` | generated migration | Verify true RENAME (see recipe). |
| `lib/dal/import-formats.ts:124-154` | `accessibleWhere` SQL filter | Relax to two-branch OR + reviewStatus guard (see WHERE shape). |
| `lib/dal/import-formats.ts:74-95` | validators (in-memory re-check) | Remove `platform.visibility`/`platformOwnerUserId` references; key `isOwnedBy` off `importFormatVersion.ownerUserId` only. |
| `lib/dal/import-formats.ts:10-37,156-199` | `ImportFormatRow` type + select | Drop `platformVisibility`/`platformOwnerUserId` from type, `hasExpectedRowShape`, and the `.select({…})`. |
| `lib/services/import-format-wizard.ts:211-289` | `createPrivateRows` write | Remove `visibility` write on platform; set platform `reviewStatus='pending'` (was `'draft'`). Keep format-version `ownerUserId`/`visibility` writes as-is (column kept). |
| `tests/import-format-wizard-actions.test.ts:204-225` | wizard insert assertions | Update: platform insert no `visibility`, `reviewStatus:'pending'`; no `ownerUserId` rename impact (insert key is still `ownerUserId`? NO — see pitfall). |
| `tests/import-private-formats-dal.test.ts` | access matrix unit test | Update `makeRow` shape (drop `platformVisibility`/`platformOwnerUserId`) + add the cross-platform owner case. |

### Pattern 1: Drizzle Column Rename Recipe (no data loss)
**What:** Make the generated `0023` a true `ALTER TABLE … RENAME COLUMN`, not a drop+add.
**When to use:** Any column rename where existing rows must survive (PLAT-01 mandates "no data lost").
**Steps:**
1. Edit `lib/db/schema.ts`: rename the field and its SQL name in one go — `proposedByUserId: text("proposed_by_user_id").references(…)`. Drop the `visibility` column and `platform_visibility_reviewStatus_idx`. Update `platformRelations`.
2. Run `yarn db:generate` **interactively** (it requires a TTY for rename detection).
3. drizzle-kit prints: `Is owner_user_id column in 'platform' table created or renamed from another column?` → select **`~ owner_user_id › proposed_by_user_id (renamed)`**.
4. **Read `drizzle/migrations/0023_*.sql` before it ships.** It MUST contain:
   ```sql
   ALTER TABLE "platform" RENAME COLUMN "owner_user_id" TO "proposed_by_user_id";
   ```
   and MUST NOT contain `DROP COLUMN "owner_user_id"` paired with `ADD COLUMN "proposed_by_user_id"`. A rename carries the data; a drop+add silently nulls it. [VERIFIED: drizzle-orm v0.11.0 release notes — "capable of handling renames and deletes, prompting the user to resolve these changes"; CITED: drizzle-team/drizzle-orm-docs]
5. If the prompt was answered wrong (drop+add SQL appears), delete `0023` and the matching snapshot in `drizzle/migrations/meta/`, then re-run.
**Fallback:** `drizzle-kit generate --custom --name rename_platform_owner` produces an empty migration; hand-write the three statements (drop index, rename column, drop visibility column). [CITED: drizzle-team/drizzle-orm-docs kit-custom-migrations]

### Pattern 2: Two-layer access filter (SQL + in-memory fail-closed)
**What:** `loadImportFormatsForDetection` applies `accessibleWhere()` in SQL AND re-checks every row with `isAccessibleImportFormat()` in memory (lines 196-197). The in-memory layer is a defense-in-depth fail-closed guard — `hasExpectedRowShape` drops any row missing an expected key.
**When to use:** When relaxing `accessibleWhere`, you MUST update both layers in lockstep. The unit test (Proxy-mock) only exercises the in-memory layer, so an SQL-only change passes tests but ships a broken/over-exposing query.
**Example (recommended relaxed WHERE):**
```typescript
// Source: derived from lib/dal/import-formats.ts:124-154 + D-04
function accessibleWhere(userId: string, selectedFormatVersionId?: number) {
  const accessScope = or(
    // Branch 1 — global, approved formats on global, approved platforms (unchanged path)
    and(
      isNull(importFormatVersion.ownerUserId),
      eq(importFormatVersion.reviewStatus, APPROVED_REVIEW_STATUS),
      eq(platform.reviewStatus, APPROVED_REVIEW_STATUS),
    ),
    // Branch 2 — format owned by this user, on ANY platform the user may see
    // (D-04: decoupled from platform visibility). Platform-owner branch removed.
    and(
      eq(importFormatVersion.ownerUserId, userId),
      // platform must itself be visible to the user (PLAT-02 lifecycle):
      or(
        eq(platform.reviewStatus, APPROVED_REVIEW_STATUS),
        eq(platform.proposedByUserId, userId), // pending platform proposed by this user
      ),
    ),
  )
  const base = and(
    eq(importFormatVersion.isActive, true),
    eq(platform.isActive, true),
    accessScope,
  )
  if (selectedFormatVersionId === undefined) return base
  return and(base, eq(importFormatVersion.id, selectedFormatVersionId))
}
```
Note: branch 1 no longer checks `platform.visibility`/`importFormatVersion.visibility` (column gone / no longer authoritative). The `reviewStatus` pair replaces the old `visibility==='global'` pair as the "shared identity" signal.

### Pattern 3: reviewStatus visibility guard (PLAT-02)
**What:** A `pending` platform is visible only to its `proposedByUserId`; `approved` to all. The cleanest home is a reusable predicate in `lib/dal/import-formats.ts` (the only place that needs it this phase), expressed inline in `accessibleWhere` branch 2's `or(...)` above. No separate service-layer policy — keeps `platform` pure identity.
**When to use:** Anywhere a query lists platforms a user may act on. This phase only the import-format detection path needs it; do not over-build.

### Anti-Patterns to Avoid
- **Answering the rename prompt "created":** destroys `ownerUserId` data. The single most dangerous action in this phase.
- **Updating only the SQL `accessibleWhere` and not the in-memory `isOwnedBy`/`isGlobalApproved`:** unit tests stay green (they only hit the in-memory layer) while production queries over-expose or under-expose. Update both.
- **Adding a `seed-extras` backfill STEP for `proposedByUserId`:** unnecessary with a true RENAME; adding a no-op step is harmless but misleading. Only add a STEP if a drop+add was genuinely unavoidable.
- **Renaming `platform.visibility` writes in the wizard to something else instead of removing them:** the column is gone — any write to it is a runtime error.
- **Changing the runtime FK or the relation name broadly:** out of scope (Phase 60 owns slug-linkage); keep relation key `owner` to minimize ripple (D-06).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Column rename SQL | Hand-written ALTER in a code path | `drizzle-kit generate` (interactive, answer "renamed") | drizzle-kit emits the correct snapshot + meta journal; hand SQL desyncs the snapshot and breaks future diffs. |
| Idempotent row backfill | Custom UPDATE script | (nothing — a true RENAME needs no backfill) | The rename carries data; backfill is a non-problem here. |
| Access matrix testing | Real-DB integration harness | Existing Proxy-mock unit pattern (`tests/import-private-formats-dal.test.ts`) | The in-memory filter is the security boundary; feeding rows + asserting the filtered output proves the matrix with zero DB. |

**Key insight:** The repo already has the exact migration precedent (`0022` dropped many `platform` columns after a backfill) and the exact test precedent (Proxy-mock over `loadImportFormatsForDetection`). This phase reuses both patterns; the only novelty is the *rename* (vs drop), which is purely an interactive-prompt-discipline problem.

## Runtime State Inventory

This is a schema rename/drop phase, so runtime state matters.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `platform.owner_user_id` column (production rows). For single-user dev/prod, likely all NULL except any wizard-created private platforms. Value must survive as `proposed_by_user_id`. | Code: true RENAME COLUMN (data carries automatically — no migration). Verified: `0019` added the column; only the wizard `createPrivateRows` ever writes it. |
| Live service config | None — no external service stores `platform.visibility`/`ownerUserId`. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None — `DATABASE_URL` only; no env references the renamed column. | None. |
| Build artifacts | `drizzle/migrations/meta/_journal.json` + `meta/0023_snapshot.json` (generated by `db:generate`). Stale `.next` build cache could surface old types. | Generated by the tool; commit them. `rm -rf .next` if type errors persist after the schema edit (per project MEMORY.md proxy/cache note). |

**The canonical question — after every file is updated, what runtime systems still have the old string?** Only the Postgres column itself, and a true RENAME handles it atomically. No n8n/Datadog/Task-Scheduler/SOPS surface references this column.

## Common Pitfalls

### Pitfall 1: Interactive rename prompt destroys data
**What goes wrong:** `drizzle-kit generate` emits `DROP COLUMN owner_user_id` + `ADD COLUMN proposed_by_user_id` instead of a RENAME, nulling all rows.
**Why it happens:** The rename is only detected if you answer the interactive prompt "renamed"; non-TTY/CI runs or a wrong keypress default to treating it as a new column.
**How to avoid:** Run `yarn db:generate` in an interactive terminal, select the `(renamed)` option, then grep the generated SQL for `RENAME COLUMN`. Reject any `DROP COLUMN "owner_user_id"`.
**Warning signs:** Generated SQL contains both `DROP COLUMN "owner_user_id"` and `ADD COLUMN "proposed_by_user_id"`; or `db:verify` shows row count/data divergence.

### Pitfall 2: Dropping `visibility` without dropping its index
**What goes wrong:** `ALTER TABLE platform DROP COLUMN visibility` fails or leaves a dangling index if `platform_visibility_reviewStatus_idx` (a composite index on `visibility, review_status`) isn't dropped first.
**Why it happens:** Postgres auto-drops the index when the column is dropped (CASCADE behavior on column drop), but drizzle-kit should emit an explicit `DROP INDEX` first; if you hand-edit, order matters: drop index → drop column.
**How to avoid:** Confirm `0023` drops `platform_visibility_reviewStatus_idx` before/with the column drop. drizzle-kit normally emits this automatically because the index disappears from the schema.
**Warning signs:** Migration errors mentioning the index, or the index lingering in `\d platform`.

### Pitfall 3: The in-memory filter (`isAccessibleImportFormat`) silently drops all rows
**What goes wrong:** After dropping `platform.visibility`, the `.select({…})` no longer returns `platformVisibility`. `hasExpectedRowShape` (line 65) checks `typeof row.platformVisibility === 'string'` → every row now fails the shape check → `loadImportFormatsForDetection` returns `[]` → imports stop matching any format. Build compiles; behavior breaks at runtime.
**Why it happens:** The fail-closed guard treats a missing expected column as a malformed row.
**How to avoid:** Update `ImportFormatRow`, `hasExpectedRowShape`, the `.select({…})`, `isGlobalApproved`, and `isOwnedBy` together — remove every `platformVisibility`/`platformOwnerUserId` reference.
**Warning signs:** `import-detector.test.ts` / `import-private-formats-dal.test.ts` returning empty arrays; uploads reporting "no supported import format matched".

### Pitfall 4: reviewStatus value drift (`draft` vs `pending`)
**What goes wrong:** Wizard writes `reviewStatus='draft'` (line 226/245) but the lifecycle is `pending`/`approved`. A `draft` platform won't match a `reviewStatus = pending OR approved` visibility guard → invisible even to its proposer.
**Why it happens:** The wizard predates the lifecycle decision.
**How to avoid:** Change the platform write to `reviewStatus='pending'` (D-06). Decide the format-version `reviewStatus` too: keep `draft` only if no query filters on it, else align to `pending`. The recommended `accessibleWhere` branch 2 does NOT filter format-version `reviewStatus`, so a `draft` format-version still works — but align to `pending` for consistency and update the wizard test.
**Warning signs:** A freshly-created private format invisible to its creator on re-upload.

### Pitfall 5: `createPrivateRows` insert key vs column rename
**What goes wrong:** The wizard inserts `platform` with `{ ownerUserId: input.userId, … }` (line 224). After renaming the schema field to `proposedByUserId`, that object key must become `proposedByUserId` or it's a TypeScript error (and the test asserts the old key at line 205).
**Why it happens:** The insert uses the Drizzle field name, which changed.
**How to avoid:** Rename the insert key to `proposedByUserId`, drop the `visibility` key, set `reviewStatus: 'pending'`. Update `tests/import-format-wizard-actions.test.ts:204-225` assertions to match.
**Warning signs:** `tsc`/build error "Object literal may only specify known properties"; wizard test failing on `insertedPlatforms[0]` shape.

## Code Examples

### Recommended schema edit (platform table)
```typescript
// Source: lib/db/schema.ts:254-276 (after change)
export const platform = pgTable(
  "platform",
  {
    id: serial("id").primaryKey(),
    proposedByUserId: text("proposed_by_user_id").references(() => user.id, { onDelete: "cascade" }),
    reviewStatus: varchar("review_status", { length: 24 }).default("approved").notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    country: varchar("country", { length: 2 }).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index("platform_slug_idx").on(table.slug),
    index("platform_proposedByUserId_idx").on(table.proposedByUserId), // renamed from platform_ownerUserId_idx
    index("platform_reviewStatus_idx").on(table.reviewStatus),         // replaces visibility+reviewStatus composite
  ],
);
```
[ASSUMED] index rename specifics — drizzle-kit will propose the index rename in the same prompt; verify the generated SQL.

### Expected migration SQL (verify, do not hand-write unless using --custom)
```sql
-- drizzle/migrations/0023_*.sql (EXPECTED — confirm by reading)
DROP INDEX "platform_visibility_reviewStatus_idx";--> statement-breakpoint
ALTER TABLE "platform" RENAME COLUMN "owner_user_id" TO "proposed_by_user_id";--> statement-breakpoint
ALTER INDEX "platform_ownerUserId_idx" RENAME TO "platform_proposedByUserId_idx";--> statement-breakpoint
ALTER TABLE "platform" DROP COLUMN "visibility";--> statement-breakpoint
CREATE INDEX "platform_reviewStatus_idx" ON "platform" USING btree ("review_status");
```
[ASSUMED] exact statement set/order — drizzle-kit generates this; the load-bearing line that MUST be present is `ALTER TABLE "platform" RENAME COLUMN "owner_user_id" TO "proposed_by_user_id";` and there MUST be no `ADD COLUMN "proposed_by_user_id"`.

### Existing migration precedent (drop columns after the parent is settled)
```sql
-- Source: drizzle/migrations/0022_wonderful_eternals.sql (verbatim, the drop pattern this phase mirrors)
ALTER TABLE "platform" DROP COLUMN "delimiter";--> statement-breakpoint
-- ... (11 more identity-vs-contract drops)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `visibility` ('global'/'private') gates access | `reviewStatus` ('pending'/'approved') gates platform visibility; format ownership gates format access | ADR 0015 / this phase | Platform is identity-only; `visibility` retired from `platform`. |
| Parsing contract on `platform` | Parsing contract on `importFormatVersion` | ADR 0013 / Phase 56-57 (migration 0022) | `platform` already pure identity before this phase. |

**Deprecated/outdated:**
- `platform.visibility`: dropped this phase. Any reference is dead.
- `DRAFT_REVIEW_STATUS = 'draft'` in the wizard: superseded by `'pending'` lifecycle value.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | drizzle-kit `0.31.10` prompts interactively `created or renamed from another column?` and a "renamed" answer emits `RENAME COLUMN`. | Pattern 1 / Pitfall 1 | Low — confirmed in drizzle docs/release notes; mitigated by the mandatory SQL read step which catches any deviation. |
| A2 | Exact `0023` SQL statement set and index rename syntax. | Code Examples | Low — generated by tool; the recipe says to verify, not hand-write. Only the RENAME line is load-bearing. |
| A3 | Keeping `importFormatVersion.visibility` (not dropping it) is the smallest D-04-satisfying change. | Discretion / WHERE shape | Low — dropping it would add a second risky column drop + more caller edits for no PLAT requirement; keeping it is strictly smaller. |
| A4 | Aligning format-version `reviewStatus` to `'pending'` (not just platform) is safe because no query filters format-version reviewStatus in the recommended WHERE. | Pitfall 4 | Low — verified the recommended branch 2 omits a format reviewStatus check; planner should confirm `listPdfImportPlatformNames` (line 224 filters `importFormatVersion.reviewStatus = approved`) does not need private formats (it lists PDF *platform names* for approved/global only — private formats correctly excluded). |

## Open Questions

1. **Should the format-version `reviewStatus` write in the wizard become `'pending'` too, or stay `'draft'`?**
   - What we know: only `platform.reviewStatus` drives the PLAT-02 lifecycle; `listPdfImportPlatformNames` filters format `reviewStatus = approved` (so private/draft formats are excluded there by design).
   - What's unclear: whether any future query treats format `draft` differently from `pending`.
   - Recommendation: align both writes to `'pending'` for consistency; it does not change behavior given the current queries, and removes the only remaining `'draft'` literal.

2. **Rename the schema relation `owner` → `proposer`?**
   - What we know: `platformRelations.owner` references the renamed column.
   - What's unclear: whether any caller uses the relation by name (`.owner`).
   - Recommendation: keep the relation key `owner` (only the `fields:` ref changes to `proposedByUserId`) to honor D-06's minimal-diff mandate; rename is cosmetic and out of scope.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL (local) | `yarn db:migrate`, integration verify | Assumed (docker compose `db:up`) | — | `yarn db:up` (docker compose up postgres) |
| drizzle-kit | `yarn db:generate` | ✓ | 0.31.10 | — |
| vitest | `yarn test` | ✓ | 4.1.5 | — |
| Interactive TTY | rename detection in `db:generate` | ✓ (local dev) | — | `drizzle-kit generate --custom` (hand-write RENAME) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** local Postgres — start via `yarn db:up` before generate/migrate/verify.

## Validation Architecture

> nyquist_validation not explicitly false in config (key absent) → enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.5 |
| Config file | `vitest.config.ts` (includes `lib/**/*.test.ts`, `tests/**/*.test.ts`; mocks `server-only`) |
| Quick run command | `yarn test run tests/import-private-formats-dal.test.ts tests/import-detector.test.ts` |
| Full suite command | `yarn test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAT-01 | Migration is a RENAME (data preserved), not drop+add | manual review + smoke | grep `0023_*.sql` for `RENAME COLUMN` and absence of `ADD COLUMN "proposed_by_user_id"`; optional `yarn db:migrate` + `yarn db:verify` on a seeded local DB | ❌ Wave 0 (review step in PLAN; optional `tests/migration-0023-rename.test.ts` if DB harness desired) |
| PLAT-01 | Schema/build compiles after rename | unit/build | `yarn build` (or `tsc --noEmit`) + `yarn check:language` | ✅ existing toolchain |
| PLAT-02 | `pending` platform visible only to proposer; `approved` to all; seeded stay approved | unit | extend `tests/import-private-formats-dal.test.ts` with rows: pending+proposer (visible), pending+other (hidden), approved (visible to all) | ✅ extend existing |
| PLAT-03 | Owner-format on approved platform visible to owner; non-owner cannot see it; cross-user isolation | unit | extend `tests/import-private-formats-dal.test.ts`: `ownerUserId=user-a` format on an approved global platform → visible to user-a, hidden from user-b | ✅ extend existing |
| PLAT-03 / SC4 | Six existing global formats still resolve (no regression) | unit (existing) | `yarn test run tests/import-detector.test.ts` (builds candidates from `seed-data` and matches all seven fixtures) | ✅ existing — must stay green |
| D-06 | Wizard creates platform with `reviewStatus='pending'`, no `visibility`, `proposedByUserId` set | unit | `tests/import-format-wizard-actions.test.ts` updated assertions | ✅ update existing |

### Sampling Rate
- **Per task commit:** `yarn test run tests/import-private-formats-dal.test.ts tests/import-detector.test.ts tests/import-format-wizard-actions.test.ts`
- **Per wave merge:** `yarn test` + `yarn build` + `yarn check:language`
- **Phase gate:** full suite green + `0023_*.sql` reviewed (RENAME confirmed) + `yarn db:migrate` succeeds on a seeded local DB with `yarn db:verify` before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] Extend `tests/import-private-formats-dal.test.ts` `makeRow` to the new column set (drop `platformVisibility`, `platformOwnerUserId`) and add the cross-platform owner + reviewStatus-lifecycle cases — covers PLAT-02, PLAT-03.
- [ ] Update `tests/import-format-wizard-actions.test.ts` platform-insert assertions (no `visibility`, `reviewStatus:'pending'`, key `proposedByUserId`) — covers D-06.
- [ ] (Optional) `tests/migration-0023-rename.test.ts` — only if the team wants an automated rename-preserves-data integration test against local PG; otherwise the manual SQL-review gate suffices.
- Framework install: none — vitest present.

*(No new test infra needed beyond extending two existing files.)*

## Security Domain

> `security_enforcement` not explicitly false → included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface changed (Better Auth untouched). |
| V3 Session Management | no | — |
| V4 Access Control | yes | `accessibleWhere` IS the access-control boundary for import formats. The relaxation must not over-expose a private format to non-owners or hide global ones. Enforced at DAL (SQL + in-memory fail-closed). |
| V5 Input Validation | no | No new external input; `userId` comes from session. |
| V6 Cryptography | no | — |

### Known Threat Patterns for Drizzle DAL access control
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Over-broad WHERE leaks another user's private format | Information Disclosure | Branch 2 keys strictly on `eq(importFormatVersion.ownerUserId, userId)`; test cross-user isolation explicitly. |
| Under-broad WHERE hides global formats (DoS of feature) | Denial of Service | Keep branch 1 (global-approved) intact; `import-detector.test.ts` over six formats guards it. |
| In-memory filter desync from SQL filter | Tampering / Disclosure | Update `isGlobalApproved`/`isOwnedBy` in lockstep with the SQL change; fail-closed `hasExpectedRowShape` re-check remains. |

## Sources

### Primary (HIGH confidence)
- `lib/dal/import-formats.ts`, `lib/services/import-format-wizard.ts`, `lib/db/schema.ts`, `lib/dal/imports.ts`, `scripts/migrate.ts`, `scripts/seed-extras.ts`, `drizzle/migrations/0022_wonderful_eternals.sql`, `0019_lame_layla_miller.sql`, `0008_private_import_formats.sql` — read in this session [VERIFIED: codebase].
- `tests/import-private-formats-dal.test.ts`, `tests/import-detector.test.ts`, `tests/import-format-wizard-actions.test.ts` — existing test patterns [VERIFIED: codebase].

### Secondary (MEDIUM confidence)
- Context7 `/drizzle-team/drizzle-orm-docs` — kit-custom-migrations, v0.11.0 release notes (rename detection/prompting) [CITED].

### Tertiary (LOW confidence)
- Exact `0023` SQL statement order/index-rename syntax [ASSUMED — verify generated output].

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; versions read from installed `node_modules`/`package.json`.
- Architecture / caller sweep: HIGH — every reader/writer of the changed columns grepped and read; only `import-formats.ts`, `import-format-wizard.ts`, `schema.ts` (table + relation) touch them.
- Rename recipe: HIGH on the danger and the safe procedure; MEDIUM on exact generated SQL (tool-dependent, mitigated by mandatory review step).
- No-regression: HIGH — hot join provably reads only `id`/`name`/`slug`.

**Research date:** 2026-06-29
**Valid until:** 2026-07-29 (stable schema/tooling; re-check if drizzle-kit major bumps).
