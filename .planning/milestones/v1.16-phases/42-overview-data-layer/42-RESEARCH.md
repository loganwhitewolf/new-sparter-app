# Phase 42: overview-data-layer - Research

**Researched:** 2026-06-07
**Domain:** Postgres enum migrations, Drizzle ORM DAL patterns, TypeScript union blast-radius, seed-extras additive steps
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01** — Extend `flowNature` enum, not a dedicated column. Recurring vs extraordinary income is a `nature` distinction.
- **D-02** — V1 additive enum change: `ALTER TYPE flow_nature ADD VALUE 'income_extraordinary'`. The existing `income` value stays and is re-labeled "Entrate ricorrenti". No destructive recreation, no row remap of `income`.
- **D-03** — Two-bucket model on the `in` side. Every `in` subcategory is either `income` (recurring) or `income_extraordinary` (straordinaria). `financial` is thereafter an OUT/investment nature only.
- **D-04** — Phase 42 ships 1 enum migration + 1 seed-extras STEP. Exact per-slug reclassification requires PO confirmation during execution.
- **D-05** — Movers at category level (not subcategory).
- **D-06** — "Previous month" = previous calendar month, crossing year boundary. `getMonthOverMonthCategoryChanges(2026, 0)` compares against December 2025.
- **D-07** — Noise threshold €15 acts on |Δ€|; sort by |Δ€| desc.
- **D-08** — OUT only; `isNew` flag when prev = 0. Returns `{ categoryId, name, delta, isNew }`.
- **D-09** — New file `lib/dal/overview.ts`, year-scoped. Existing `lib/dal/dashboard.ts` functions stay intact and working.
- **D-10** — `getOverviewChart(year)` IS in scope; returns per month `{ income: { recurring, extraordinary }, out: { <per-nature> } }`.
- **D-11** — YTD bound = last month with data (equal-span comparison).
- **D-12** — Reference Period redefined in CONTEXT.md glossary only; Deviation engine NOT changed this phase.
- **D-13** — `MonthOverMonthChange` is the canonical internal term. "Variazione" stays banned.

### Claude's Discretion
- `getYearsWithData()` (DATA-03): distinct years with ≥1 transaction, DESC; reuse `getMonthsWithData('transactions')` pattern.
- Exact TypeScript return-type shapes and `react cache()` wrapping mirror existing `lib/dal/dashboard.ts` conventions (string DECIMALs, Decimal.js for arithmetic, try/catch → safe empty fallback).
- Reference Period glossary wording (exact Italian phrasing) at writer's discretion, preserving the `_Avoid_` lines.

### Deferred Ideas (OUT OF SCOPE)
- Align the Deviation engine (`getDeviationDateRanges`) to "ultimo mese con dati" — glossary-only update this phase.
- FlowNature friendly display-labels rename (EDU-FUT-01) — "Discrezionale" → "Sfizi/Extra" etc. Cross-cutting, separate quick task.
- None of the above are in Phase 42 scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | `getOverview(year)` returns four KPI totals with YTD-vs-prior-YTD comparison | Verified: reuses `buildOverviewData`, `computeSavingsRate`, `computeDeltaPercent`, `getOverviewAmountTotals` from `dashboard.ts`; only the date-range construction changes |
| DATA-02 | `getMonthOverMonthCategoryChanges(year, monthIndex?, limit?)` returns per-month category movers (OUT only, €15 noise threshold) | Verified: structural mirror of `getCategoryDeviations`; two-window query, category grouping, €15 |Δ€| threshold, `isNew` flag pattern documented |
| DATA-03 | `getYearsWithData()` returns the years that have transactions | Verified: `DISTINCT TO_CHAR(occurred_at, 'YYYY')` mirror of `getMonthsWithData('transactions')` |
| DATA-04 | `Reference Period` redefined + `MonthOverMonthChange` documented in `CONTEXT.md` | Verified: CONTEXT.md structure identified; current definition located; target wording is at writer's discretion per D-12/D-13 |
</phase_requirements>

---

## Summary

Phase 42 is a pure server-side data phase. The four deliverables are: one Postgres enum migration adding `income_extraordinary`, one seed-extras STEP re-bucketing subcategory natures, a new DAL file `lib/dal/overview.ts` with four year-scoped query functions, and a CONTEXT.md glossary update. No UI is touched.

The #1 execution risk is the `ALTER TYPE ... ADD VALUE` migration. Postgres 12+ allows this statement inside a transaction, but the new enum value cannot be used in the same transaction — meaning any migration file that both adds the value and also references it in a `DEFAULT` clause, `UPDATE`, or column insertion will fail at runtime. This project has exact prior art: migration `0013_brief_pride.sql` (`ADD VALUE IF NOT EXISTS 'income' BEFORE 'debt'`) was written as a standalone file with no subsequent statements in the same file. Migration `0016_chunky_pet_avengers.sql` adds two enum values in the same file but does not use them — that also works. The safe pattern is established: generate a dedicated migration file for the `ADD VALUE` alone, then run `yarn db:seed-extras` (a separate process) for the re-bucketing UPDATEs.

The TypeScript blast-radius of adding `income_extraordinary` to `FlowNature` is well-bounded but must be addressed to keep `yarn build` green. The union currently has 8 members + `unclassified`. Every `Record<FlowNature | 'unclassified', ...>` literal in the codebase will produce a TypeScript error until the new key is added. Five sites require edits: `NATURE_LABELS`, `NATURE_COLORS`, `NATURE_ORDER` (in `nature-labels.ts`), `emptySegments()` in `buildMonthlyNatureTrendData` (in `dashboard.ts`), and the matching test fixtures in `nature-labels.test.ts` and `dashboard-charts.test.tsx`. The settings `SubcategoryNatureSelect` dynamically iterates `NATURE_ORDER`, so it auto-gains the new option once `NATURE_ORDER` is updated — no structural change needed there.

**Primary recommendation:** Write the `ADD VALUE` migration as a single-statement file. Run `yarn build` after each change to `nature-labels.ts` and `dashboard.ts` before writing `lib/dal/overview.ts`. Append the seed-extras STEP last, after the migration and label changes are confirmed green.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Postgres enum extension | Database/Storage | — | DDL change; must precede any TypeScript that references the new value |
| Subcategory nature re-bucketing | Database/Storage | — | Additive seed script; data migration, not code migration |
| `getYearsWithData()` | API/Backend (DAL) | — | Auth-scoped DB query; reuse of established `getMonthsWithData` pattern |
| `getOverview(year)` KPIs | API/Backend (DAL) | — | Year-scoped aggregate query; reuses existing builders |
| `getMonthOverMonthCategoryChanges(...)` movers | API/Backend (DAL) | — | Two-window category-level query, OUT-only, threshold applied in SQL |
| `getOverviewChart(year)` | API/Backend (DAL) | — | Per-month × nature grouping; coalesce user override; produces client-side sliceable payload |
| `FlowNature` union + labels | Frontend (shared util) | API/Backend | `nature-labels.ts` is consumed by both server DAL type references and client components |
| CONTEXT.md glossary update | Documentation | — | Static file edit; no runtime impact |

---

## Standard Stack

### Core (no new packages — phase uses existing dependencies only)

| Library | Version (in use) | Purpose | Why Standard |
|---------|-----------------|---------|--------------|
| `drizzle-orm` | project-installed | Query builder, ORM | Already in stack; all DAL files use it |
| `drizzle-kit` | project-installed | Migration generation | Established workflow (`yarn drizzle-kit generate`) |
| `Decimal.js` via `@/lib/utils/decimal` | project-installed | Monetary arithmetic | Project-mandated; never native JS arithmetic on amounts |
| `react` (cache) | project-installed | DAL memoization | Pattern: `export const fn = cache(async () => ...)` |
| `server-only` | project-installed | RSC boundary guard | Pattern: first line of every DAL file |

No new packages are required for this phase.

**Installation:** none.

---

## Package Legitimacy Audit

No new packages are introduced in this phase. Audit: N/A.

---

## Architecture Patterns

### System Architecture Diagram

```
yarn db:migrate
  └─► 00NN_income_extraordinary.sql
        └─► ALTER TYPE flow_nature ADD VALUE 'income_extraordinary'
              (standalone file — no subsequent statements)

yarn db:seed-extras
  └─► STEP: rebucket-income-natures
        └─► UPDATE sub_category SET nature = 'income_extraordinary'
              WHERE slug IN ([candidate list])          ← PO confirms slugs
        └─► UPDATE sub_category SET nature = 'income_extraordinary'
              WHERE slug IN ([financial → income_extraordinary slugs])

TypeScript edits (sequential, each followed by yarn build check):
  lib/utils/nature-labels.ts
    ├─► FlowNature union: add 'income_extraordinary'
    ├─► NATURE_LABELS: add income_extraordinary → 'Straordinaria', relabel income → 'Entrate ricorrenti'
    ├─► NATURE_ORDER: insert 'income_extraordinary' after 'income'
    └─► NATURE_COLORS: add income_extraordinary → color

  lib/dal/dashboard.ts
    └─► emptySegments(): add income_extraordinary: ZERO_AMOUNT

  tests/nature-labels.test.ts
    └─► ALL_NATURE_KEYS, EXPECTED_LABELS, length assertions: +1 for income_extraordinary

  tests/dashboard-charts.test.tsx
    └─► segment count assertion: +1

lib/dal/overview.ts (new file)
  ├─► getYearsWithData()
  ├─► getOverview(year)
  ├─► getMonthOverMonthCategoryChanges(year, monthIndex?, limit?)
  └─► getOverviewChart(year)

CONTEXT.md
  ├─► Reference Period: redefine to "ultimo mese con dati"
  └─► MonthOverMonthChange: add canonical term, mark "variazione" as _Avoid_
```

### Recommended Project Structure

```
lib/
├── dal/
│   ├── dashboard.ts        # UNCHANGED — preset-based queries stay intact
│   ├── months-with-data.ts # UNCHANGED — pattern source for getYearsWithData
│   └── overview.ts         # NEW — all four year-scoped functions

lib/utils/
└── nature-labels.ts        # EDIT — add income_extraordinary to union + all 3 Records

lib/db/
└── schema.ts               # EDIT — flowNatureEnum gains 'income_extraordinary'
                             #   (drizzle-kit generate reads this; schema.ts drives migration generation)

drizzle/migrations/
└── 00NN_income_extraordinary.sql   # GENERATED — single ADD VALUE statement

scripts/
└── seed-extras.ts          # EDIT — append STEP 5: rebucket-income-natures

CONTEXT.md                  # EDIT — glossary: Reference Period, MonthOverMonthChange
```

### Pattern 1: ADD VALUE migration isolation

**What:** Postgres `ALTER TYPE ... ADD VALUE` in a dedicated single-statement migration file, never combined with statements that use the new value.

**When to use:** Every time a pgEnum gains a new member.

**Example (from migration 0013_brief_pride.sql — VERIFIED in codebase):**
```sql
-- Source: drizzle/migrations/0013_brief_pride.sql
ALTER TYPE "public"."flow_nature" ADD VALUE IF NOT EXISTS 'income' BEFORE 'debt';
```

The `IF NOT EXISTS` guard makes re-runs safe (idempotent). The `BEFORE` clause controls sort order in `pg_enum`. For `income_extraordinary`, position it `AFTER 'income'` so the enum sort order groups the two income variants together.

**New migration (to generate via drizzle-kit then hand-verify):**
```sql
ALTER TYPE "public"."flow_nature" ADD VALUE IF NOT EXISTS 'income_extraordinary' AFTER 'income';
```

**Why isolated:** Drizzle-kit's `migrate` command runs each `.sql` file through `drizzle-kit`'s own migration runner (invoked as `yarn drizzle-kit migrate` via `execSync` in `scripts/migrate.ts`). Drizzle wraps migrations in transactions. Since PG 12 permits `ADD VALUE` inside a transaction but the new value cannot be seen by subsequent statements within the same transaction, any `.sql` file that mixes the `ADD VALUE` with a `DEFAULT 'income_extraordinary'` column or an `INSERT` using the value will error at runtime.

**Migration runner behavior (VERIFIED from scripts/migrate.ts):**
`scripts/migrate.ts` calls `execSync('yarn drizzle-kit migrate 2>&1', { env, encoding: 'utf8' })`. This delegates entirely to Drizzle-Kit's migration runner, which processes each `.sql` file as a unit. A single-statement file containing only `ADD VALUE` is safe regardless of transaction wrapping, because no subsequent statement in the same transaction will reference the new value.

### Pattern 2: DAL file conventions

**What:** Standard structure for every function in `lib/dal/overview.ts`.

**When to use:** Every exported query function in this file.

**Example (mirroring lib/dal/months-with-data.ts):**
```typescript
// Source: lib/dal/months-with-data.ts and lib/dal/dashboard.ts
import 'server-only'
import { cache } from 'react'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/dal/auth'

export const getYearsWithData = cache(async (): Promise<string[]> => {
  const { userId } = await verifySession()
  const result = await db.execute(sql`
    SELECT DISTINCT TO_CHAR(occurred_at, 'YYYY') AS yr
    FROM transaction
    WHERE user_id = ${userId}
    ORDER BY yr DESC
  `)
  const rows = result.rows as { yr: string }[]
  return rows.map((row) => row.yr)
})
```

Key invariants (VERIFIED from dashboard.ts and months-with-data.ts):
- `import 'server-only'` as first line
- `export const fn = cache(async (...) => { ... })`
- `const { userId } = await verifySession()` at the top of every function
- DECIMAL columns returned as `string` (never coerced to `number`)
- Monetary arithmetic via `toDecimal(...)` from `@/lib/utils/decimal`
- `try/catch → empty fallback` wraps every DB query block

### Pattern 3: getOverview(year) — date range construction

**What:** Year-scoped YTD ranges replacing the preset-based ranges in `dashboard.ts`.

**When to use:** `getOverview(year)`, `getOverviewChart(year)`, `getMonthOverMonthCategoryChanges(year, ...)`.

**Logic (derived from D-11 + CONTEXT.md + mock-data.ts):**
```typescript
// For the current/in-progress year: Jan 1 → end of last month with data
// For a completed past year: Jan 1 → Dec 31
// YTD comparison: Jan 1 of prior year → same end month of prior year

// lastMonthWithData is derived from getMonthsWithData('transactions') filtered to the year,
// or passed in as a pre-fetched value to avoid redundant DB round-trips.

function ytdRange(year: number, lastMonthIndex: number): { from: Date; to: Date } {
  return {
    from: new Date(year, 0, 1),
    to: new Date(year, lastMonthIndex + 1, 0, 23, 59, 59, 999), // last day of lastMonth
  }
}
// prior year comparison: same span Jan → lastMonthIndex in year-1
```

`getOverview(year)` calls `getOverviewAmountTotals` (imported or inlined from `dashboard.ts`) twice — current YTD and prior-year YTD — then feeds both into `buildOverviewData`. Also calls `getUncategorizedCount` twice (same spans). The `buildOverviewData`, `computeSavingsRate`, `computeDeltaPercent` functions are **exported** from `dashboard.ts` and reusable directly.

### Pattern 4: getMonthOverMonthCategoryChanges

**What:** Two-window category-level aggregate query. Returns OUT-only movers with €15 |Δ€| threshold.

**When to use:** DATA-02 / movers drill-down in Phase 45.

**Structure (derived from getCategoryDeviations pattern in dashboard.ts):**
```typescript
// Window A: target month  (e.g. 2026-04)
// Window B: previous calendar month (e.g. 2026-03; crosses year if monthIndex=0 → Dec previous year)

// prevYear = monthIndex === 0 ? year - 1 : year
// prevMonthIndex = monthIndex === 0 ? 11 : monthIndex - 1

// Two parallel queries (Promise.all):
// 1. SUM(abs(amount)) per category for window A, where category.type = 'out'
// 2. SUM(abs(amount)) per category for window B, same filter

// Post-query in TypeScript:
// delta = currAmount - prevAmount (Decimal.js)
// isNew = prevAmount === 0 && currAmount > 0
// filter: abs(delta) >= 15.00
// sort: abs(delta) DESC
// slice: 0..limit

// Return shape:
export type MonthOverMonthChange = {
  categoryId: number
  name: string
  delta: string   // signed Decimal string, negative = saved money
  isNew: boolean
}
```

Follows `getCategoryDeviations` join chain: `transaction → expense → subCategory → category`, using `DASHBOARD_TOTAL_EXPENSE_STATUSES`, `ne(category.type, 'transfer')`, `notExcludedFromTotals()`, `dateScopedTransactions(userId, from, to)`.

The delta threshold and sort happen in TypeScript after the DB aggregation (not in SQL), mirroring the `buildDeviationDataset` approach.

### Pattern 5: getOverviewChart(year)

**What:** Per-month × nature/income-type aggregation. Splits `in` into `income` (recurring) and `income_extraordinary` (straordinaria); splits `out` into the 6 OUT natures.

**When to use:** DATA-01 via `getOverviewChart(year)`. Phase 44 slices this payload client-side for filter chips.

**Structure (mirrors getMonthlyTrendByNature from dashboard.ts):**
```typescript
// natureSql: coalesce(userSubcategoryOverride.nature, subCategory.nature)
// group by: to_char(occurredAt, 'YYYY-MM'), natureSql
// filter: year-scoped, DASHBOARD_TOTAL_EXPENSE_STATUSES, notTransferCategory(), notExcludedFromTotals()
// amount: coalesce(sum(transaction.amount), 0)::text  (signed; positive = in, negative = out)

// Return shape per month:
export type OverviewChartPoint = {
  month: string    // 'YYYY-MM'
  label: string    // 'Gen', 'Feb', ...
  income: {
    recurring: string       // nature = 'income', sum of positive amounts
    extraordinary: string   // nature = 'income_extraordinary', sum of positive amounts
  }
  out: Record<OutNature, string>  // essential | discretionary | operational | financial | debt | extraordinary
}

type OutNature = 'essential' | 'discretionary' | 'operational' | 'financial' | 'debt' | 'extraordinary'
```

The builder initializes all 12 months of the year as zero-filled buckets (like `buildMonthlyNatureTrendData`), then fills from query rows. For YTD years, months beyond `lastMonthWithData` remain zero and are filtered out by the caller or left as zero — no special handling needed since they have no data.

### Pattern 6: seed-extras STEP pattern

**What:** Idempotent UPDATE step appended to `scripts/seed-extras.ts`.

**When to use:** Any new column value on existing rows, or re-bucketing of existing values.

**Example (mirroring setSubcategoryNature in seed-extras.ts):**
```typescript
// Step 5 (phase 42: income split): re-bucket income-related subcategories
// PO confirms exact slug membership during execution. This is the structural template.
async function rebucketIncomeNatures(database: Db): Promise<void> {
  const INCOME_EXTRAORDINARY_SLUGS: string[] = [
    // From current income → income_extraordinary (bonus, freelance, etc.):
    'bonus', 'freelance', 'consulenze', 'progetti-occasionali', 'commissioni',
    // From financial → income_extraordinary (per D-03):
    'vendita-di-beni-usati', 'commercio-online', 'immobili-vendita', 'vendita-investimenti',
    'rimborso-spese-lavorative', 'rimborso-spese-sanitarie', 'rimborso-spese-viaggi',
    'rimborso-ordine-online', 'cashback-carta-di-credito', 'cashback-acquisti-online',
    'cashback-programmi-fedelta', 'rimborso-abbonamento-e-canoni', 'bonus-promozionale',
    'bonifico-in-entrata', 'ricariche-conti', 'rimborsi', 'rimborso-da-persona',
    // [PO to confirm complete list]
  ]

  const result = await database
    .update(subCategory)
    .set({ nature: 'income_extraordinary' as FlowNature })
    .where(and(inArray(subCategory.slug, INCOME_EXTRAORDINARY_SLUGS), isNull(subCategory.userId)))

  const count = (result as unknown as { rowCount?: number }).rowCount ?? 0
  console.log(`    income_extraordinary rebucket: ${count} rows updated`)
}

// Append to STEPS:
// { name: 'rebucket-income-natures', run: rebucketIncomeNatures },
```

The `isNull(subCategory.userId)` guard is critical — it ensures only system subcategories are updated, not user-created ones.

### Anti-Patterns to Avoid

- **Combining ADD VALUE with consuming statements in the same migration file:** Any `.sql` file that does `ALTER TYPE ... ADD VALUE 'income_extraordinary'` AND then `INSERT INTO sub_category (nature) VALUES ('income_extraordinary')` in the same file will fail. The seed-extras STEP handles the data update separately via `yarn db:seed-extras`.
- **Using `drizzle-kit push` in production:** Forbidden per CLAUDE.md. Always `drizzle-kit generate` + `scripts/migrate.ts`.
- **Native JS arithmetic on DECIMAL columns:** Drizzle returns `DECIMAL(10,2)` columns as `string`. Always pass through `toDecimal(stringValue)`.
- **Calling `getOverview(preset)` from the new year-scoped surface:** The old preset-based function stays in `dashboard.ts` for the existing `overview/page.tsx`. The new `getOverview(year)` lives in `lib/dal/overview.ts`. Do not confuse the two.
- **Editing `seed-data.ts` for new nature values:** Nature values on existing subcategory rows are handled by `seed-extras.ts` STEPS, not by modifying the baseline seed shapes.
- **Assuming `income_extraordinary` is visible to queries immediately after `ADD VALUE`:** The value exists in the enum once the migration commits. The seed-extras run afterward — this ordering is already safe because they are separate processes.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Monetary aggregation | Custom sum loop in TypeScript | `coalesce(sum(amount), 0)::text` in SQL + `toDecimal()` in TypeScript | Precision; DECIMAL columns are strings |
| YTD date bounds | Custom calendar arithmetic | `new Date(year, month + 1, 0, 23, 59, 59, 999)` pattern from existing `dashboard.ts` | Handles month-end correctly (day 0 = last day of prev month) |
| Per-month bucket initialization | Manual iteration | `monthsBetween(from, to)` from `@/lib/utils/date` | Already handles year-spanning ranges |
| Auth scoping | Re-implementing user filter | `verifySession()` from `@/lib/dal/auth` | Project-wide pattern; throws on unauthenticated |
| Delta percent calculation | Custom division with divide-by-zero guard | `computeDeltaPercent(current, previous)` from `@/lib/utils/dashboard` | Returns `null` when previous is zero (not infinity) |
| Savings rate | Manual division | `computeSavingsRate(totalIn, totalOut)` from `@/lib/utils/dashboard` | Handles `totalIn = 0` case |

**Key insight:** The new `lib/dal/overview.ts` is primarily wiring — calling helpers that already exist in `lib/utils/dashboard.ts` and `lib/dal/dashboard.ts` with year-scoped date ranges instead of preset ranges.

---

## Common Pitfalls

### Pitfall 1: ADD VALUE consumed in the same migration transaction

**What goes wrong:** Migration fails at runtime with `ERROR: unsafe use of new value "income_extraordinary" of enum type flow_nature` (Postgres < 12) or `ERROR: column "nature" is of type flow_nature but expression is of type text` followed by a confused error (Postgres 12+) if a statement in the same migration tries to insert the new value.

**Why it happens:** Postgres 12+ allows `ADD VALUE` inside a transaction, but the catalog change is not visible to subsequent statements within the same transaction. The new value only becomes available after `COMMIT`.

**How to avoid:** One statement per migration file for `ADD VALUE`. Drizzle-kit `generate` sometimes emits `ADD VALUE` alongside other statements in the same file (e.g. 0016 has two `ADD VALUE` statements, which is fine because neither is consumed). Verify the generated file manually before running. Hand-edit if necessary to split.

**Warning signs:** Migration file contains `ADD VALUE` and any `INSERT`, `UPDATE`, `DEFAULT`, or `CHECK` referencing the new enum value in the same file.

**Precedent in codebase (VERIFIED):** Migration `0013_brief_pride.sql` is a single `ADD VALUE IF NOT EXISTS` statement. Migration `0016_chunky_pet_avengers.sql` has two `ADD VALUE` statements but no consumers in the same file — both passed in production.

---

### Pitfall 2: TypeScript union exhaustiveness failures after FlowNature extension

**What goes wrong:** `yarn build` (tsc) fails with `Property 'income_extraordinary' is missing in type ... but required in type 'Record<FlowNature | "unclassified", string>'`.

**Why it happens:** TypeScript `Record<FlowNature | 'unclassified', V>` requires all union members to appear as keys. Adding `income_extraordinary` to the union without updating every Record literal causes type errors.

**How to avoid:** Update all five sites before writing `lib/dal/overview.ts`. Run `yarn build` after each site to catch errors early. Sites (VERIFIED by grep):

| File | Line reference | Change required |
|------|---------------|-----------------|
| `lib/utils/nature-labels.ts` | `FlowNature` union | Add `\| 'income_extraordinary'` |
| `lib/utils/nature-labels.ts` | `NATURE_LABELS` Record literal | Add `income_extraordinary: 'Straordinaria'`, relabel `income: 'Entrate ricorrenti'` |
| `lib/utils/nature-labels.ts` | `NATURE_ORDER` array | Insert `'income_extraordinary'` after `'income'` |
| `lib/utils/nature-labels.ts` | `NATURE_COLORS` Record literal | Add `income_extraordinary: '<color>'` |
| `lib/dal/dashboard.ts` | `emptySegments()` at line ~664 | Add `income_extraordinary: ZERO_AMOUNT` |
| `tests/nature-labels.test.ts` | `ALL_NATURE_KEYS`, `EXPECTED_LABELS`, length assertions | +1 member, update count from 9 to 10 |
| `tests/dashboard-charts.test.tsx` | `NATURE_ORDER.filter` assertion | Update expected count from 8 to 9 non-null natures |
| `tests/dashboard-dal.test.ts` | `buildMonthlyNatureTrendData` segment key set test | Add `income_extraordinary` to sorted expected keys |
| `scripts/seed-extras.ts` | `NATURE_SLUGS: Record<FlowNature, string[]>` | Add `income_extraordinary: [...]` key |

**Warning signs:** `yarn build` exits non-zero after touching `nature-labels.ts`.

---

### Pitfall 3: Year-crossing "previous month" in getMonthOverMonthCategoryChanges

**What goes wrong:** `getMonthOverMonthCategoryChanges(2026, 0)` (January 2026 movers) silently returns empty `prevRows` because the previous-month window is constructed within year 2026 instead of crossing to December 2025.

**Why it happens:** Naive construction `new Date(year, monthIndex - 1, 1)` when `monthIndex === 0` produces `new Date(2026, -1, 1)` which JavaScript resolves to `2025-12-01` — so JavaScript handles it correctly. However, if the year-scoping WHERE clause uses `gte(transaction.occurredAt, new Date(year, 0, 1))` it will exclude December 2025. The previous-month window must NOT be bounded by the year scope.

**How to avoid:** The current YTD window is year-scoped. The previous-month window must be computed independently:
```typescript
const prevYear = monthIndex === 0 ? year - 1 : year
const prevMonthIndex = monthIndex === 0 ? 11 : monthIndex - 1
const prevFrom = new Date(prevYear, prevMonthIndex, 1)
const prevTo = new Date(prevYear, prevMonthIndex + 1, 0, 23, 59, 59, 999)
```
Each window is passed to its own `dateScopedTransactions(userId, from, to)` call — no shared year guard.

**Warning signs:** Movers for January always return all categories as `isNew: true` even when prior-year December had spending.

---

### Pitfall 4: getYearsWithData returns months, not years

**What goes wrong:** `getYearsWithData()` is copy-pasted from `getMonthsWithData` without changing the `TO_CHAR` format — returns `'2026-05'` instead of `'2026'`.

**How to avoid:** Use `TO_CHAR(occurred_at, 'YYYY')` (not `'YYYY-MM'`). The alias must also differ from the months query (`yr` vs `ym`).

---

### Pitfall 5: YTD "last month with data" requires a sub-query or pre-fetch

**What goes wrong:** `getOverview(year)` needs to know the last month with data to compute the YTD date range, but this requires a separate query — it cannot be derived from the aggregate query itself.

**How to avoid:** Fetch the last month with data first (a lightweight query equivalent to `getMonthsWithData('transactions')` filtered to the year, `LIMIT 1`), then use the result to compute both the current and prior-year date ranges. Or call `getYearsWithData()` / derive from a per-year query. This adds one lightweight DB round-trip at the top of `getOverview(year)`.

An alternative: pass the pre-known `lastMonthWithData` as a parameter from the page that has already called `getYearsWithData()` + a month lookup — but this couples DAL and presentation layer. Prefer the self-contained approach (internal pre-fetch inside `getOverview(year)`).

---

## Code Examples

### getYearsWithData (DATA-03)
```typescript
// Mirrors: lib/dal/months-with-data.ts (VERIFIED)
export const getYearsWithData = cache(async (): Promise<string[]> => {
  const { userId } = await verifySession()
  try {
    const result = await db.execute(sql`
      SELECT DISTINCT TO_CHAR(occurred_at, 'YYYY') AS yr
      FROM transaction
      WHERE user_id = ${userId}
      ORDER BY yr DESC
    `)
    const rows = result.rows as { yr: string }[]
    return rows.map((row) => row.yr)
  } catch {
    return []
  }
})
```

### getOverview(year) — date range skeleton
```typescript
// Mirrors: getOverviewAmountTotals + buildOverviewData pattern in lib/dal/dashboard.ts (VERIFIED)
// getOverviewAmountTotals, getUncategorizedCount, buildOverviewData are exported from dashboard.ts

export const getOverview = cache(async (year: number): Promise<OverviewData> => {
  const { userId } = await verifySession()

  // 1. Find last month with data in this year to determine YTD bound
  const lastMonthResult = await db.execute(sql`
    SELECT MAX(TO_CHAR(occurred_at, 'YYYY-MM')) AS last_ym
    FROM transaction
    WHERE user_id = ${userId}
      AND TO_CHAR(occurred_at, 'YYYY') = ${String(year)}
  `)
  const lastYm = (lastMonthResult.rows[0] as { last_ym: string | null })?.last_ym
  const lastMonthIdx = lastYm ? Number(lastYm.slice(5, 7)) - 1 : 11

  const currentFrom = new Date(year, 0, 1)
  const currentTo = new Date(year, lastMonthIdx + 1, 0, 23, 59, 59, 999)
  const previousFrom = new Date(year - 1, 0, 1)
  const previousTo = new Date(year - 1, lastMonthIdx + 1, 0, 23, 59, 59, 999)

  // 2. Re-use existing helpers (imported from dashboard.ts)
  const [currentTotals, previousTotals, currentUncat, previousUncat] = await Promise.all([
    getOverviewAmountTotals(userId, currentFrom, currentTo),
    getOverviewAmountTotals(userId, previousFrom, previousTo),
    getUncategorizedCount(userId, currentFrom, currentTo),
    getUncategorizedCount(userId, previousFrom, previousTo),
  ])

  return buildOverviewData({
    current: currentTotals,
    previous: previousTotals,
    currentUncategorizedCount: currentUncat,
    previousUncategorizedCount: previousUncat,
  })
})
```

Note: `getOverviewAmountTotals` and `getUncategorizedCount` are currently private (not exported) in `dashboard.ts`. They must be exported or inlined in `overview.ts`. Exporting is cleaner.

### emptySegments update (blast-radius fix in dashboard.ts)
```typescript
// BEFORE (lib/dal/dashboard.ts line ~664 — VERIFIED):
const emptySegments = (): Record<FlowNature | 'unclassified', string> => ({
  essential: ZERO_AMOUNT,
  discretionary: ZERO_AMOUNT,
  operational: ZERO_AMOUNT,
  financial: ZERO_AMOUNT,
  income: ZERO_AMOUNT,
  debt: ZERO_AMOUNT,
  extraordinary: ZERO_AMOUNT,
  transfer: ZERO_AMOUNT,
  unclassified: ZERO_AMOUNT,
})

// AFTER (add income_extraordinary):
const emptySegments = (): Record<FlowNature | 'unclassified', string> => ({
  essential: ZERO_AMOUNT,
  discretionary: ZERO_AMOUNT,
  operational: ZERO_AMOUNT,
  financial: ZERO_AMOUNT,
  income: ZERO_AMOUNT,
  income_extraordinary: ZERO_AMOUNT,  // ← new
  debt: ZERO_AMOUNT,
  extraordinary: ZERO_AMOUNT,
  transfer: ZERO_AMOUNT,
  unclassified: ZERO_AMOUNT,
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `income` covers all IN income | `income` = recurring, `income_extraordinary` = one-off | Phase 42 | Existing rows untouched; only new seed-extras step reassigns slugs |
| Reference Period = last completed calendar month | Reference Period = last month with data | Phase 42 (glossary) | Code-vs-doc drift until Deviation engine migration (deferred) |
| No canonical term for month-vs-month movers | `MonthOverMonthChange` canonical, "variazione" banned | Phase 42 (CONTEXT.md) | New DAL function naming codifies the term |

**Deprecated/outdated after this phase:**
- `income` label "Entrate" → becomes "Entrate ricorrenti" in NATURE_LABELS. The enum *value* `income` does NOT change.
- `financial` nature covering IN-side income items (vendite, cashback, rimborsi, bonifico-in-entrata) → those slugs move to `income_extraordinary`. Financial remains valid for OUT-side investment rows.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `getOverviewAmountTotals` and `getUncategorizedCount` need to be exported from `dashboard.ts` (they are currently unexported) | Code Examples | If left private, `overview.ts` must inline them — adds maintenance burden but no correctness risk |
| A2 | `income_extraordinary` color in NATURE_COLORS should be a lighter green variant distinguishing it from `income` (#34d399) — e.g. `#a7f3d0` (matching mock-data.ts INCOME_COLORS.extraordinary) | Standard Stack / Labels | Wrong color is cosmetic only; correctable in Phase 43 |
| A3 | `NATURE_SLUGS` Record in `seed-extras.ts` imports `FlowNature` from `nature-labels.ts` — once `income_extraordinary` is added to the union, TypeScript will require a key for it in `NATURE_SLUGS` | Common Pitfalls — blast radius | If not addressed, `yarn build` breaks on seed-extras.ts |

---

## Open Questions

1. **Should `getOverviewAmountTotals` and `getUncategorizedCount` be exported from `dashboard.ts`?**
   - What we know: they are currently private helpers; `overview.ts` needs them.
   - What's unclear: export vs inline copy.
   - Recommendation: Export both from `dashboard.ts`. Avoids duplication. Low-risk change that is additive.

2. **Exact PO-confirmed slug list for the re-bucketing STEP.**
   - What we know: Candidate list is in CONTEXT.md Specific Ideas.
   - What's unclear: Which dividend slugs stay as `income` vs move to `income_extraordinary`.
   - Recommendation: Plan task marks this as a PO confirmation checkpoint before running `yarn db:seed-extras` in production.

3. **`income_extraordinary` color value.**
   - What we know: `mock-data.ts` uses `#a7f3d0` (lighter green). `income` is `#34d399`.
   - Recommendation: Use `#a7f3d0` to match mock-data intent. Noted as ASSUMED (A2).

---

## Environment Availability

Step 2.6: This phase is purely code + migration changes. External dependencies are Postgres (local dev) and the existing project toolchain.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Postgres | Enum migration, seed-extras | ✓ (assumed local dev running) | ≥12 | — |
| `yarn drizzle-kit generate` | Migration generation | ✓ (project toolchain) | installed | — |
| `yarn db:migrate` | Migration execution | ✓ (scripts/migrate.ts) | installed | — |
| `yarn db:seed-extras` | Re-bucketing step | ✓ (scripts/seed-extras.ts) | installed | — |
| `yarn build` | TypeScript validation | ✓ | installed | `yarn tsc --noEmit` |
| `yarn test` | Vitest unit tests | ✓ | vitest ^4.1.5 | — |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `yarn test` |
| Full suite command | `yarn test` (runs all `tests/**/*.test.ts` + `tests/**/*.test.tsx` + `lib/**/*.test.ts`; excludes `*.spec.ts`) |

Note: `*.spec.ts` files are Playwright e2e tests, excluded from Vitest. DAL unit tests use `vi.mock` for `db`, `server-only`, `react`, and `verifySession`.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | `getOverview(year)` returns correct KPI strings from aggregate rows | unit | `yarn test tests/overview-dal.test.ts` | ❌ Wave 0 |
| DATA-01 | YTD bound = last month with data (not partial current month) | unit | `yarn test tests/overview-dal.test.ts` | ❌ Wave 0 |
| DATA-01 | Prior-year comparison uses same month span | unit | `yarn test tests/overview-dal.test.ts` | ❌ Wave 0 |
| DATA-02 | Movers returned only for OUT transactions | unit | `yarn test tests/overview-dal.test.ts` | ❌ Wave 0 |
| DATA-02 | €15 |Δ€| threshold filters noise correctly | unit | `yarn test tests/overview-dal.test.ts` | ❌ Wave 0 |
| DATA-02 | `isNew = true` when prevAmount = 0 | unit | `yarn test tests/overview-dal.test.ts` | ❌ Wave 0 |
| DATA-02 | Year-crossing: Jan 2026 compares against Dec 2025 | unit | `yarn test tests/overview-dal.test.ts` | ❌ Wave 0 |
| DATA-02 | Sort by |Δ€| descending | unit | `yarn test tests/overview-dal.test.ts` | ❌ Wave 0 |
| DATA-03 | `getYearsWithData()` returns distinct years DESC | unit | `yarn test tests/overview-dal.test.ts` | ❌ Wave 0 |
| DATA-03 | Empty array when no transactions | unit | `yarn test tests/overview-dal.test.ts` | ❌ Wave 0 |
| DATA-04 | FlowNature union has 10 members after adding `income_extraordinary` | unit | `yarn test tests/nature-labels.test.ts` | ✅ needs update |
| DATA-04 | NATURE_LABELS has correct Italian label for `income_extraordinary` | unit | `yarn test tests/nature-labels.test.ts` | ✅ needs update |
| DATA-04 | NATURE_LABELS for `income` relabeled to 'Entrate ricorrenti' | unit | `yarn test tests/nature-labels.test.ts` | ✅ needs update |
| — | `buildMonthlyNatureTrendData` emptySegments includes `income_extraordinary` | unit | `yarn test tests/dashboard-dal.test.ts` | ✅ needs update |
| — | `yarn build` exits 0 after all changes | build-check | `yarn build` | — |

### Sampling Rate
- **Per task commit:** `yarn test` (full unit suite — fast, ~30s)
- **Per wave merge:** `yarn test && yarn build`
- **Phase gate:** `yarn test && yarn build` green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/overview-dal.test.ts` — new test file covering all four DAL functions in `lib/dal/overview.ts`. Mirror the mock pattern from `tests/months-with-data-dal.test.ts` (vi.mock for `db`, `server-only`, `react`, `verifySession`).
- [ ] `tests/nature-labels.test.ts` — update existing test: change count from 9 to 10, add `income_extraordinary` to `ALL_NATURE_KEYS` and `EXPECTED_LABELS`, update NATURE_LABELS `income` expected label to `'Entrate ricorrenti'`.
- [ ] `tests/dashboard-dal.test.ts` — update `buildMonthlyNatureTrendData` test: add `income_extraordinary` to the sorted expected segment keys array (currently 9 keys + unclassified).
- [ ] `tests/dashboard-charts.test.tsx` — update `renders one segment per nature in NATURE_ORDER`: expected non-null count changes from 8 to 9.

---

## Security Domain

This phase introduces no new auth surfaces, no new input validation paths, and no new network endpoints. All new DAL functions follow the established pattern of calling `verifySession()` as the first operation — queries are automatically scoped to the authenticated user's `userId`. No ASVS categories are newly implicated.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes (existing) | `verifySession()` gates all DAL queries — maintained pattern |
| V5 Input Validation | no new surfaces | — |
| V6 Cryptography | no | — |

---

## Sources

### Primary (HIGH confidence)
- `lib/dal/dashboard.ts` (VERIFIED in session) — `getOverviewAmountTotals`, `buildOverviewData`, `computeSavingsRate`, `computeDeltaPercent`, `getMonthlyTrendByNature`, `getCategoryDeviations`, `DASHBOARD_TOTAL_EXPENSE_STATUSES`, `notTransferCategory`, `notExcludedFromTotals`, `dateScopedTransactions` patterns
- `lib/dal/months-with-data.ts` (VERIFIED in session) — `getYearsWithData` template, `DISTINCT TO_CHAR` pattern, `verifySession` scoping
- `lib/utils/nature-labels.ts` (VERIFIED in session) — `FlowNature` union (8 members), `NATURE_LABELS`, `NATURE_ORDER`, `NATURE_COLORS`
- `scripts/seed-extras.ts` (VERIFIED in session) — `NATURE_SLUGS` Record, `setSubcategoryNature` pattern, STEPS registry, `isNull(subCategory.userId)` guard
- `lib/db/schema.ts` (VERIFIED in session) — `flowNatureEnum` (line 52–61), `subCategory.nature` and `userSubcategoryOverride.nature` columns
- `drizzle/migrations/0013_brief_pride.sql` (VERIFIED in session) — `ADD VALUE IF NOT EXISTS 'income' BEFORE 'debt'` as standalone file precedent
- `drizzle/migrations/0016_chunky_pet_avengers.sql` (VERIFIED in session) — two `ADD VALUE` statements, no consumers, confirms safe multi-value pattern
- `scripts/migrate.ts` (VERIFIED in session) — `execSync('yarn drizzle-kit migrate')` runner; transaction semantics delegated to Drizzle-Kit
- `tests/nature-labels.test.ts` (VERIFIED in session) — current test assertions (9 keys, exact labels)
- `tests/dashboard-dal.test.ts` (VERIFIED in session) — `buildMonthlyNatureTrendData` segment key assertions
- `tests/dashboard-charts.test.tsx` (VERIFIED in session) — `NATURE_ORDER` iteration test, 8 non-null natures assertion
- `app/proto/overview/mock-data.ts` (VERIFIED in session) — `INCOME_TYPES`, `MonthPoint` shape, `getMovers` logic, noise floor constant
- `vitest.config.ts` (VERIFIED in session) — test include/exclude patterns
- `.planning/phases/42-overview-data-layer/42-CONTEXT.md` (VERIFIED in session) — locked decisions D-01 through D-13

### Secondary (MEDIUM confidence)
- `CONTEXT.md` (VERIFIED in session) — current glossary definitions for Reference Period, Baseline, Deviation, FlowNature; edit targets for DATA-04

---

## Metadata

**Confidence breakdown:**
- Migration mechanics: HIGH — two prior precedents verified in migration files; runner code verified
- DAL patterns: HIGH — all patterns extracted from live codebase, not training data
- TypeScript blast-radius: HIGH — all 8 affected files identified by grep and manual read
- Seed-extras pattern: HIGH — four existing steps read and verified
- Test gaps: HIGH — existing test files read; gaps precisely identified

**Research date:** 2026-06-07
**Valid until:** 2026-07-07 (stable domain; only risk is if `dashboard.ts` is refactored before Phase 42 executes)
