# Phase 42: overview-data-layer - Pattern Map

**Mapped:** 2026-06-07
**Files analyzed:** 10 (3 new, 7 modified/updated)
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `lib/dal/overview.ts` | dal | request-response (CRUD, batch) | `lib/dal/dashboard.ts` + `lib/dal/months-with-data.ts` | exact |
| `drizzle/migrations/00XX_income_extraordinary.sql` | migration | — | `drizzle/migrations/0013_brief_pride.sql` | exact |
| `tests/overview-dal.test.ts` | test | — | `tests/dashboard-dal.test.ts` | exact |
| `lib/utils/nature-labels.ts` | utility | transform | itself (additive edit) | exact |
| `lib/db/schema.ts` | model/config | — | itself — `flowNatureEnum` block at line 52 | exact |
| `lib/dal/dashboard.ts` | dal | request-response | itself — export 2 private helpers + extend `emptySegments` | exact |
| `scripts/seed-extras.ts` | script/seed | batch | itself — STEPS registry pattern (lines 424–429) | exact |
| `CONTEXT.md` | documentation | — | existing `§ Dashboard e analisi` section | exact |
| `tests/nature-labels.test.ts` | test | — | itself (additive edit) | exact |
| `tests/dashboard-dal.test.ts` | test | — | itself (additive edit) | exact |

---

## Pattern Assignments

### `lib/dal/overview.ts` (dal, request-response) — NEW FILE

**Primary analog:** `lib/dal/months-with-data.ts` (file header + `getYearsWithData`)
**Secondary analog:** `lib/dal/dashboard.ts` (all four query bodies)

---

**Imports pattern** — copy from `lib/dal/months-with-data.ts` lines 1–5:
```typescript
import 'server-only'
import { cache } from 'react'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/dal/auth'
```

Additional imports needed for the richer queries (mirror `lib/dal/dashboard.ts` line 18):
```typescript
import { and, eq, gte, lte, ne, inArray, isNull, or, desc } from 'drizzle-orm'
import { category, expense, subCategory, transaction as transactionTable, userSubcategoryOverride } from '@/lib/db/schema'
import { toDecimal, toDbDecimal } from '@/lib/utils/decimal'
import {
  buildOverviewData,
  notExcludedFromTotals,
  DASHBOARD_TOTAL_EXPENSE_STATUSES,
} from '@/lib/dal/dashboard'
```

---

**Auth / session scoping pattern** — every exported function, from `lib/dal/months-with-data.ts` lines 14–16:
```typescript
export const getYearsWithData = cache(async (): Promise<string[]> => {
  const { userId } = await verifySession()
  // ...
})
```
Rule: `verifySession()` is ALWAYS the first await inside `cache(async ...)`. Never pass userId in from outside.

---

**`getYearsWithData()` — core pattern** (mirror `lib/dal/months-with-data.ts` lines 14–40, change `YYYY-MM` → `YYYY` and alias `ym` → `yr`):
```typescript
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

---

**`getOverview(year)` — date range + helpers pattern** (derived from `lib/dal/dashboard.ts` lines 848–866, adapting for year scope per D-11):
```typescript
export const getOverview = cache(async (year: number): Promise<OverviewData> => {
  const { userId } = await verifySession()

  // Determine YTD upper bound: last month with data in this year
  const lastMonthResult = await db.execute(sql`
    SELECT MAX(TO_CHAR(occurred_at, 'YYYY-MM')) AS last_ym
    FROM transaction
    WHERE user_id = ${userId}
      AND TO_CHAR(occurred_at, 'YYYY') = ${String(year)}
  `)
  const lastYm = (lastMonthResult.rows[0] as { last_ym: string | null })?.last_ym
  const lastMonthIdx = lastYm ? Number(lastYm.slice(5, 7)) - 1 : 11

  const currentFrom = new Date(year, 0, 1)
  const currentTo   = new Date(year, lastMonthIdx + 1, 0, 23, 59, 59, 999)
  const previousFrom = new Date(year - 1, 0, 1)
  const previousTo   = new Date(year - 1, lastMonthIdx + 1, 0, 23, 59, 59, 999)

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
`getOverviewAmountTotals` and `getUncategorizedCount` must be **exported** from `lib/dal/dashboard.ts` (currently private — see `lib/dal/dashboard.ts` lines 407 and 431). Add `export` keyword as part of this phase.

---

**`getOverviewAmountTotals` SQL core** (copy from `lib/dal/dashboard.ts` lines 431–448 — the canonical totals pattern):
```typescript
// positive → totalIn; abs(negative) → totalOut; excludes transfers + excludeFromTotals
const rows = await db
  .select({
    totalIn:  sql<string>`coalesce(sum(case when ${transactionTable.amount} > 0 then ${transactionTable.amount} else 0 end), 0)::text`,
    totalOut: sql<string>`coalesce(abs(sum(case when ${transactionTable.amount} < 0 then ${transactionTable.amount} else 0 end)), 0)::text`,
  })
  .from(transactionTable)
  .leftJoin(expense, eq(transactionTable.expenseId, expense.id))
  .leftJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
  .leftJoin(category, eq(subCategory.categoryId, category.id))
  .where(and(
    dateScopedTransactions(userId, from, to),
    expenseStatusIncludedInDashboardTotals(),
    notTransferCategory(),
    notExcludedFromTotals()
  ))
```

---

**`getMonthOverMonthCategoryChanges` — two-window query pattern** (mirror `getCategoryDeviations` at `lib/dal/dashboard.ts` lines 969–1044; swap Baseline window for "previous calendar month"):
```typescript
// Year-crossing guard (D-06, Pitfall 3):
const prevYear       = monthIndex === 0 ? year - 1 : year
const prevMonthIndex = monthIndex === 0 ? 11 : monthIndex - 1
const currFrom = new Date(year, monthIndex, 1)
const currTo   = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999)
const prevFrom = new Date(prevYear, prevMonthIndex, 1)
const prevTo   = new Date(prevYear, prevMonthIndex + 1, 0, 23, 59, 59, 999)

// Two parallel queries via Promise.all — each uses its own dateScopedTransactions(userId, from, to)
// Filter: ne(category.type, 'transfer'), notExcludedFromTotals(), expenseStatusIncludedInDashboardTotals()
// Group by: category.id, category.name
// Amount: coalesce(abs(sum(transaction.amount)), 0)::text

// Post-query TypeScript (mirror buildDeviationDataset approach):
// delta = Decimal(curr).minus(Decimal(prev))
// isNew  = prev === '0.00' && curr > 0
// filter: toDecimal(delta).abs() >= 15
// sort:   toDecimal(delta).abs() DESC
// slice:  [0, limit]

export type MonthOverMonthChange = {
  categoryId: number
  name: string
  delta: string    // signed Decimal string; negative = saved money
  isNew: boolean
}
```

---

**`getOverviewChart(year)` — per-month × nature aggregation pattern** (mirror `getMonthlyTrendByNature` at `lib/dal/dashboard.ts` lines 1253–1295):
```typescript
const monthSql  = sql<string>`to_char(${transactionTable.occurredAt}, 'YYYY-MM')`
const natureSql = sql<FlowNature | null>`coalesce(${userSubcategoryOverride.nature}, ${subCategory.nature})`

// group by monthSql, natureSql
// join chain: transaction → expense → subCategory → category → leftJoin userSubcategoryOverride
// where: dateScopedTransactions, expenseStatusIncludedInDashboardTotals, notExcludedFromTotals, notTransferCategory

// Builder initializes 12 zero-filled buckets (one per month) via monthsBetween(from, to)
// from @/lib/utils/date — same pattern as buildMonthlyNatureTrendData lines 676–687

// Return shape (per D-10):
export type OverviewChartPoint = {
  month: string
  label: string
  income: { recurring: string; extraordinary: string }
  out: Record<OutNature, string>
}
type OutNature = 'essential' | 'discretionary' | 'operational' | 'financial' | 'debt' | 'extraordinary'
```

---

**Error handling pattern** — consistent across all four functions (from `lib/dal/months-with-data.ts` line 22 and `lib/dal/dashboard.ts` lines 407–428):
```typescript
try {
  // DB query
} catch {
  return []      // or typed empty fallback matching the function's return type
}
```
Never `catch (err)` unless you log it. Bare `catch {}` → empty fallback is the established project pattern.

---

### `drizzle/migrations/00XX_income_extraordinary.sql` — NEW FILE

**Analog:** `drizzle/migrations/0013_brief_pride.sql` (line 1) — the single-statement `ADD VALUE` precedent.

**Full file content** (one statement only — no other statements in same file, per Pitfall 1):
```sql
ALTER TYPE "public"."flow_nature" ADD VALUE IF NOT EXISTS 'income_extraordinary' AFTER 'income';
```

`IF NOT EXISTS` makes re-runs safe. `AFTER 'income'` groups both income variants together in `pg_enum` sort order. The file is **generated** via `yarn drizzle-kit generate` after updating `lib/db/schema.ts`, then hand-verified to confirm it contains only this single statement before running.

---

### `tests/overview-dal.test.ts` — NEW FILE

**Analog:** `tests/dashboard-dal.test.ts` (lines 651–743 for `buildMonthlyNatureTrendData` tests) and `tests/nature-labels.test.ts` (overall test structure).

**Test file header pattern** (all DAL tests use `vi.mock` for server-only modules):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('react', () => ({ cache: (fn: unknown) => fn }))
vi.mock('@/lib/db', () => ({ db: { execute: vi.fn(), select: vi.fn() } }))
vi.mock('@/lib/dal/auth', () => ({ verifySession: vi.fn().mockResolvedValue({ userId: 'test-user' }) }))
```

**Test structure** — one `describe` block per exported function, covering the behaviors listed in RESEARCH.md Validation Architecture (§ Phase Requirements → Test Map). Key cases per function:
- `getYearsWithData`: distinct years DESC, empty array on no data
- `getOverview`: correct KPI strings, YTD bound = last month with data, equal-span prior-year comparison
- `getMonthOverMonthCategoryChanges`: OUT-only, €15 threshold, `isNew` flag, year-crossing Jan→Dec, sort by |Δ€| DESC
- `getOverviewChart`: per-nature/income-type split, zero-fill for missing months

---

### `lib/utils/nature-labels.ts` — MODIFY (additive)

**Analog:** itself (current content read above, lines 1–45).

**Change set** — three targeted additions, one relabel:

```typescript
// 1. FlowNature union: add after 'income' (line 6)
  | 'income_extraordinary'

// 2. NATURE_LABELS: relabel income + add new key
  income: 'Entrate ricorrenti',          // was: 'Entrate'
  income_extraordinary: 'Straordinaria', // new key after income

// 3. NATURE_ORDER: insert after 'income' (line 28)
  'income_extraordinary',

// 4. NATURE_COLORS: add after income entry (line 40)
  income_extraordinary: '#a7f3d0',       // lighter green — from mock-data.ts INCOME_COLORS.extraordinary
```

After this edit `FlowNature` has 9 members and `NATURE_LABELS` / `NATURE_COLORS` each have 10 keys (9 natures + `unclassified`). `NATURE_ORDER` grows from 9 to 10 elements (9 non-null + `null`).

---

### `lib/db/schema.ts` — MODIFY (one line, `flowNatureEnum`)

**Analog:** existing `flowNatureEnum` definition (line ~52). Add `'income_extraordinary'` to the values array. `drizzle-kit generate` reads this to produce the migration SQL.

```typescript
// Before (line ~52–61 approximate):
export const flowNatureEnum = pgEnum('flow_nature', [
  'essential', 'discretionary', 'operational', 'financial',
  'income', 'debt', 'extraordinary', 'transfer',
])

// After:
export const flowNatureEnum = pgEnum('flow_nature', [
  'essential', 'discretionary', 'operational', 'financial',
  'income', 'income_extraordinary', 'debt', 'extraordinary', 'transfer',
])
```

Run `yarn drizzle-kit generate` after this change to produce the migration file. Verify the output file contains only the single `ADD VALUE` statement before running `yarn db:migrate`.

---

### `lib/dal/dashboard.ts` — MODIFY (3 changes)

**Analog:** itself.

**Change 1:** Export `getUncategorizedCount` (line 407) — add `export`:
```typescript
// Before:
async function getUncategorizedCount(userId: string, from: Date, to: Date): Promise<number> {

// After:
export async function getUncategorizedCount(userId: string, from: Date, to: Date): Promise<number> {
```

**Change 2:** Export `getOverviewAmountTotals` (line 431) — add `export`:
```typescript
// Before:
async function getOverviewAmountTotals(userId: string, from: Date, to: Date): Promise<OverviewAggregateRow> {

// After:
export async function getOverviewAmountTotals(userId: string, from: Date, to: Date): Promise<OverviewAggregateRow> {
```

**Change 3:** `emptySegments()` inside `buildMonthlyNatureTrendData` (lines 664–674) — add one key:
```typescript
// Before:
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

// After (add income_extraordinary after income):
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

### `scripts/seed-extras.ts` — MODIFY (2 changes)

**Analog:** itself — `NATURE_SLUGS` at line 55, `setSubcategoryNature` at line 197, STEPS registry at lines 424–429.

**Change 1:** Add `income_extraordinary` key to `NATURE_SLUGS` Record (currently exhaustive over `FlowNature` — TypeScript will require it once the union is extended). Append after the `transfer: []` line:
```typescript
  income_extraordinary: [
    // From current income → income_extraordinary (PO to confirm exact membership):
    'bonus', 'freelance', 'consulenze', 'progetti-occasionali', 'commissioni',
    // From financial → income_extraordinary (D-03):
    'vendita-di-beni-usati', 'commercio-online', 'immobili-vendita', 'vendita-investimenti',
    'rimborso-spese-lavorative', 'rimborso-spese-sanitarie', 'rimborso-spese-viaggi',
    'rimborso-ordine-online', 'cashback-carta-di-credito', 'cashback-acquisti-online',
    'cashback-programmi-fedelta', 'rimborso-abbonamento-e-canoni', 'bonus-promozionale',
    'bonifico-in-entrata', 'ricariche-conti', 'rimborsi', 'rimborso-da-persona',
    // [PO confirms complete list during execution — see CONTEXT.md Specific Ideas]
  ],
```

**Change 2:** New step function + STEPS registration (mirror `setSubcategoryNature` pattern at line 197, plus `isNull(subCategory.userId)` guard from `reorganizeSpesaSubcategories` at line 228):
```typescript
// Step 5 (phase 42: income split): re-bucket income_extraordinary subcategories
async function rebucketIncomeNatures(database: Db): Promise<void> {
  const slugs = NATURE_SLUGS['income_extraordinary']
  if (slugs.length === 0) return

  const result = await database
    .update(subCategory)
    .set({ nature: 'income_extraordinary' as FlowNature })
    .where(and(inArray(subCategory.slug, slugs), isNull(subCategory.userId)))

  const count = (result as unknown as { rowCount?: number }).rowCount ?? 0
  console.log(`    income_extraordinary rebucket: ${count} rows updated`)
}
```

Append to STEPS (line 428):
```typescript
  { name: 'rebucket-income-natures', run: rebucketIncomeNatures },
```

**Critical guard:** `isNull(subCategory.userId)` ensures only system subcategories are updated — never user-created overrides. See `reorganizeSpesaSubcategories` at line 228 for the established guard precedent.

---

### `tests/nature-labels.test.ts` — MODIFY (4 count/key updates)

**Analog:** itself (full file read above, lines 1–71).

Update map (each change is 1–2 lines):

| Line | Before | After |
|------|--------|-------|
| `ALL_NATURE_KEYS` array (line 9) | 9 entries ending `'unclassified'` | add `'income_extraordinary'` after `'income'` |
| `EXPECTED_LABELS` (line 21) | `income: 'Entrate'` | `income: 'Entrate ricorrenti'` + `income_extraordinary: 'Straordinaria'` |
| `'has all 9 expected keys'` (line 34) | `toHaveLength(9)` | `toHaveLength(10)` |
| `'has length 9'` NATURE_ORDER (line 44) | `toHaveLength(9)` | `toHaveLength(10)` |
| `'has 8 non-null nature values'` (line 52) | `toHaveLength(8)` | `toHaveLength(9)` |
| `'has all 9 keys'` NATURE_COLORS (line 59) | `toHaveLength(9)` | `toHaveLength(10)` |

---

### `tests/dashboard-dal.test.ts` — MODIFY (1 segment key assertion)

**Analog:** itself (lines 651–679 for the relevant test).

Update the sorted expected segment keys in `'pre-populates all 8 nature keys at 0.00'` (line 652, 661–673):
```typescript
// Before:
expect(Object.keys(point.segments).sort()).toEqual(
  ['debt','discretionary','essential','extraordinary','financial','income','operational','transfer','unclassified'].sort()
)

// After:
expect(Object.keys(point.segments).sort()).toEqual(
  ['debt','discretionary','essential','extraordinary','financial','income','income_extraordinary','operational','transfer','unclassified'].sort()
)
```
Test description: change `'pre-populates all 8 nature keys'` → `'pre-populates all 9 nature keys'`.

---

### `tests/dashboard-charts.test.tsx` — MODIFY (1 count assertion)

Locate the `renders one segment per nature in NATURE_ORDER` test (referenced in RESEARCH.md line 423). Change expected non-null count from `8` to `9`.

---

### `CONTEXT.md` — MODIFY (§ Dashboard e analisi)

**Analog:** existing `§ Dashboard e analisi` section — current definitions of Reference Period, Baseline, Deviation, Noise Threshold.

**Change 1 — Redefine Reference Period** (D-12): Replace current definition with:
> **Reference Period** — l'ultimo mese per cui esistono transazioni importate per l'utente. Viene determinato dalla query, non dal calendario. _Nota_: il motore Deviation (`getDeviationDateRanges`) usa ancora "ultimo mese di calendario completo" — deriva documentale in attesa di migrazione (deferred).

**Change 2 — Add MonthOverMonthChange** (D-13): Add after Deviation definition:
> **MonthOverMonthChange** — variazione categoria rispetto al mese di calendario precedente. Query: `getMonthOverMonthCategoryChanges`. Copy UI: "Rispetto al mese scorso" / "Dove hai speso di più" / "Dove hai risparmiato". _Avoid_: "variazione" (riservato-deprecato).

---

## Shared Patterns

### `server-only` + `cache` + `verifySession` header
**Source:** `lib/dal/months-with-data.ts` lines 1–5 and 16
**Apply to:** `lib/dal/overview.ts` (all four exported functions)
```typescript
import 'server-only'
import { cache } from 'react'
// ...
export const fn = cache(async (...) => {
  const { userId } = await verifySession()
  // ...
})
```

### `DASHBOARD_TOTAL_EXPENSE_STATUSES` filter
**Source:** `lib/dal/dashboard.ts` line 239, used at lines 404, 442, 997, 1017, 1283
**Apply to:** all three query functions in `lib/dal/overview.ts` that touch `expense.status`
```typescript
export const DASHBOARD_TOTAL_EXPENSE_STATUSES = ['1', '2', '3'] as const
// Usage:
inArray(expense.status, [...DASHBOARD_TOTAL_EXPENSE_STATUSES])
```

### `notTransferCategory` + `notExcludedFromTotals` + `dateScopedTransactions`
**Source:** `lib/dal/dashboard.ts` lines 383–397
**Apply to:** all aggregate queries in `lib/dal/overview.ts`
```typescript
function notTransferCategory() {
  return or(isNull(category.type), ne(category.type, 'transfer'))
}
export function notExcludedFromTotals() {
  return or(isNull(subCategory.excludeFromTotals), eq(subCategory.excludeFromTotals, false))
}
function dateScopedTransactions(userId: string, from: Date, to: Date) {
  return and(
    eq(transactionTable.userId, userId),
    gte(transactionTable.occurredAt, from),
    lte(transactionTable.occurredAt, to)
  )
}
```
These are private helpers in `dashboard.ts`. `overview.ts` must either import `notExcludedFromTotals` (exported) or inline the private ones. Inlining is acceptable given `overview.ts` is a separate concern file.

### DECIMAL = string → Decimal.js arithmetic rule
**Source:** `CLAUDE.md` + `lib/dal/dashboard.ts` throughout
**Apply to:** all computed amounts in `lib/dal/overview.ts`
- Drizzle returns `DECIMAL(10,2)` columns as `string`
- Use `toDecimal(stringValue)` from `@/lib/utils/decimal` for arithmetic
- Return monetary values as `string` (`.toString()` or `toDbDecimal()`)
- Never native JS `+`, `-`, `*`, `/` on amounts

### `isNull(subCategory.userId)` guard
**Source:** `scripts/seed-extras.ts` line 228 (`reorganizeSpesaSubcategories`)
**Apply to:** `rebucketIncomeNatures` step in `scripts/seed-extras.ts`
Ensures only system subcategories (not user-created ones) are modified by seed operations.

### `try/catch → empty fallback`
**Source:** `lib/dal/dashboard.ts` lines 407–429 (`getUncategorizedCount`), `lib/dal/months-with-data.ts` (implicit — no try/catch because the function is thin; dashboard.ts is the pattern for heavier queries)
**Apply to:** all DB query blocks in `lib/dal/overview.ts`
```typescript
try {
  // ... db query ...
} catch {
  return [] // or typed empty object / 0
}
```

---

## No Analog Found

All files in this phase have close analogs in the codebase. No entries.

---

## Execution Order Constraint

The following order is enforced by TypeScript exhaustiveness and migration safety:

1. `lib/db/schema.ts` — extend `flowNatureEnum` (enables `drizzle-kit generate`)
2. `drizzle/migrations/00XX_income_extraordinary.sql` — generate + hand-verify single statement
3. `lib/utils/nature-labels.ts` — add `income_extraordinary` to union + all 3 Records + relabel `income`
4. `lib/dal/dashboard.ts` — export 2 helpers + extend `emptySegments()` → run `yarn build`
5. `scripts/seed-extras.ts` — add `income_extraordinary` key to `NATURE_SLUGS` + new STEP → `yarn build`
6. `tests/nature-labels.test.ts` — update counts/keys → `yarn test`
7. `tests/dashboard-dal.test.ts` — update segment keys → `yarn test`
8. `tests/dashboard-charts.test.tsx` — update count assertion → `yarn test`
9. `lib/dal/overview.ts` — write four functions (all blast-radius fixes are green at this point)
10. `tests/overview-dal.test.ts` — write new test file → `yarn test && yarn build`
11. `CONTEXT.md` — glossary edits (no build impact)
12. `yarn db:migrate` + `yarn db:seed-extras` — apply migration + rebucket (dev environment)

---

## Metadata

**Analog search scope:** `lib/dal/`, `lib/utils/`, `lib/db/`, `scripts/`, `tests/`, `drizzle/migrations/`
**Files read:** 11
**Pattern extraction date:** 2026-06-07
