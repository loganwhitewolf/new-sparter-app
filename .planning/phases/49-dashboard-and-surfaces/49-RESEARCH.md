# Phase 49: dashboard-and-surfaces - Research

**Researched:** 2026-06-12
**Domain:** Dashboard aggregation rewrite, direction model migration, categorization surfaces
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**A — Allocation in the overview chart + drill-down**
- D-01: Allocation renders as a 3rd grouped bar ("Accantonato") per month, alongside Entrate and Uscite. Always present even at zero.
- D-02: Chart drill-down is direction-aware — clicking a bar selects month AND direction. Each direction shows its movers. `getMonthOverMonthCategoryChanges` gains a `direction` parameter.
- D-03: Allocation movers shown per nature (Risparmio / Investimento) with Δ€. IN and OUT movers stay per category.
- D-04: Zero-height allocation bar is still clickable — shows empty state "Nessun accantonamento in questo mese."

**B — KPI cards + savings rate**
- D-05: Add 5th KPI card "Accantonato" (Risparmio + Investimento for the period). Positive sentiment = more allocated.
- D-06: Savings rate stays `(in − out) / in`, unchanged. `out` = spending only (essential / discretionary / debt). Allocation and transfer excluded from spending totals via `direction.included_in_totals = false`. Bilancio remains `in − out`.

**C — Direction chips: picker + table filters**
- D-07: SubcategoryPicker exposes all 4 direction chips (In / Out / Accantonato / Trasferimento). All 4 directions are categorization-assignable.
- D-08: Table filters: `type` filter becomes `direction` filter (4 values); `nature` filter stays a cascade (`dependsOn: 'direction'`) fed from `nature → direction` mapping.
- D-09: Chip/filter labels come from seeded `direction.label_it`.

**D — Remove `sub_category.exclude_from_totals`**
- D-10: Drop the column via a dedicated generated migration.
- D-11: Aggregation switches to `direction.included_in_totals`; remove `notExcludedFromTotals()` helper and all call sites.
- D-12: Column drop follows Phase 48 operator caution: `pg_dump` snapshot, guarded apply, no hand-written down-migration.

### Claude's Discretion
- Exact plan slicing, SQL/helper naming, whether the direction join is expressed as a reusable Drizzle fragment vs inline.
- Chart colors for the allocation bar/segments may use seeded `direction.color` / `nature.color`; precise visual tuning is a UI concern.

### Deferred Ideas (OUT OF SCOPE)
- Explicit transaction↔opposite pairing (order↔refund) — Phase 50 (TX-PAIRING-01).
- Employer expense reimbursements bundled into the salary credit — known limitation, deferred per ADR 0012.
- A "recurring spend / subscriptions" orthogonal cut/view — ADR 0012 notes this is a flag/view, not a nature; not in this phase.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | Dashboard presents a 4-direction view: IN and OUT as today, a visible-but-separate ALLOCATION block ("Accantonato / Investito"), TRANSFER excluded and hidden | D-01 + D-03 chart + D-05 KPI card; aggregation rewrite sections below |
| DASH-02 | All dashboard/KPI/category aggregations use direction-grouped algebraic sum, replacing sign-split logic everywhere it appears | Aggregation Rewrite section; direction join fragment; ~18 TODO(Phase 49) call sites catalogued |
| DASH-03 | Divestments and refunds net within their own direction/subcategory segment — shown by real amount in list, netted in chart/KPIs | Algebraic sum pattern; `coalesce(sum(amount))` not `abs(sum(amount<0))` |
| DASH-04 | KPI cards and reading lines reflect the new direction model; allocation surfaced as its own measure | 5th KPI card section; `getOverview` needs `totalAllocation` output |
| CAT-01 | `cascade-options.ts` and the type→nature cascade derive from the nature→direction mapping, no reference to removed `category.type` | Cascade-options rewrite section; `buildTypeNatureMap` → `buildDirectionNatureMap` |
| CAT-02 | Transaction/expense table filters operate on direction + nature consistently with the new model | Table filters section; `type` key → `direction` key; DAL WHERE clause changes |
</phase_requirements>

---

## Summary

Phase 49 is a semantic migration: all ~18+ call sites that Phase 46 marked `TODO(Phase 49)` must be rewritten from the sign-split / `category.type` stub model to the direction-grouped algebraic-sum model defined by ADR 0012. The schema already exists (`direction` and `nature` tables with full FK chain), the seed data is correct, and Phase 48's DB migration will have applied before Phase 49 executes. Phase 49 only touches application code and one schema migration (`DROP COLUMN exclude_from_totals`).

The rewrite has four independent tracks that can be sequenced: (1) a shared Drizzle join fragment for resolving direction from a transaction; (2) DAL aggregation rewrites in `lib/dal/dashboard.ts` and `lib/dal/overview.ts` consuming that fragment; (3) UI surface updates (chart 3rd bar, KPI 5th card, movers panel direction-awareness); (4) categorization surface updates (SubcategoryPicker chips, table filter `type→direction` swap, `cascade-options.ts`). The `exclude_from_totals` column drop (D-10/D-11/D-12) is a standalone migration wave.

Data correctness is the critical risk. The algebraic-sum pattern means a `+` refund under an OUT subcategory must produce a lower (not higher) OUT total — this is the inverse of the old sign-split which always added to `totalOut`. Tests must assert this explicitly before any production deploy.

**Primary recommendation:** Build a reusable `withDirectionJoin()` Drizzle fragment first (Wave 0), then replace all TODO(Phase 49) DAL stubs in a single coordinated wave, then wire the UI layer, then ship the schema migration as the final gated step.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Direction-grouped algebraic-sum aggregation | Database / DAL | — | SQL GROUP BY direction; Drizzle join to `direction` table |
| KPI totals (IN/OUT/allocation/balance/savings rate) | DAL (`lib/dal/dashboard.ts`, `lib/dal/overview.ts`) | — | `getOverviewAmountTotals` / `getOverview` own the math |
| Chart data (3-bar grouped bar) | API / DAL → Client component | Frontend Server (page) | `getOverviewChart` returns `OverviewChartPoint[]`; chart renders in client |
| Movers drill-down (direction-aware) | API (`lib/actions/overview.ts`) → Client component | — | `fetchMovers` server action; `OverviewMoversSection` orchestrates |
| Migration: drop `exclude_from_totals` | Database (schema migration) | — | `drizzle-kit generate` + `scripts/migrate.ts` |
| Direction chips (SubcategoryPicker) | Client component | — | Pure UI state; consumes `direction` data fetched at page level |
| Table filters `type→direction` | Client config + DAL WHERE | — | `TableConfig` declarative; DAL translates filter params to SQL |
| Cascade-options direction→nature map | Pure utility (`lib/utils/`) | — | No server-only imports; safe to test in isolation |

---

## Standard Stack

No new packages are introduced in this phase. All work is rewriting existing code.

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| drizzle-orm | existing | Drizzle joins to `direction` / `nature` tables | Already installed |
| Decimal.js (via `@/lib/utils/decimal`) | existing | Algebraic-sum accumulation on monetary strings | REQUIRED — never use JS `+`/`-` on amounts |
| recharts | existing | 3rd grouped bar in `OverviewChart` | Already installed |
| react (cache) | existing | All DAL functions are `react.cache`'d | Pattern preserved |

**No `npm install` step required.** No Package Legitimacy Audit needed.

---

## Architecture Patterns

### System Architecture Diagram

```
transaction.amount (signed string)
        |
        v
expense.subCategoryId
        |
        v
subCategory.natureId  ──→  nature.directionId  ──→  direction.code
                                                         |
                                            ┌────────────┴────────────┐
                                         'in'  'out'  'allocation'  'transfer'
                                            |      |        |            |
                                     totalIn  totalOut  totalAlloc   (excluded)
                                      (+sum)   (sum)    (+sum)
                                            |      |        |
                                     KPI row  KPI row  KPI card 5
                                     bar 1    bar 2    bar 3 (chart)
```

**Effective nature resolution** (existing pattern, confirmed in code):
```sql
COALESCE(user_subcategory_override.nature_id, sub_category.nature_id)
→ nature.id → nature.direction_id → direction.code
```

### Recommended Project Structure

No structural changes. Files affected by this phase:

```
lib/dal/
├── dashboard.ts        # 18+ TODO(Phase 49) stubs → direction join rewrites
├── overview.ts         # OUT_NATURES, OverviewChartPoint, getMonthOverMonthCategoryChanges
└── categories.ts       # CategoryWithSubCategories.type → direction code stub restore

lib/utils/
├── cascade-options.ts  # buildTypeNatureMap → buildDirectionNatureMap
└── nature-labels.ts    # No change (FlowNature codes match nature.code values)

lib/actions/
└── overview.ts         # fetchMovers gains `direction` parameter

components/dashboard/overview/
├── overview-chart.tsx          # 3rd Accantonato bar
├── overview-chart-filters.tsx  # Add Accantonamento filter group
├── overview-movers-section.tsx # Pass direction; update heading copy
├── overview-movers-panel.tsx   # Accept direction; per-nature rows for allocation
├── kpi-row.tsx                 # 5th KPI card; grid-cols-5
└── kpi-card-reading.tsx        # Add 'allocation' to Tone union

components/categorization/
└── subcategory-picker.tsx      # TYPE_FILTERS 3→4 chips; direction-based

app/(app)/transactions/
└── transactions.table.ts       # key 'type' → 'direction'; 4 options

app/(app)/expenses/
└── expenses.table.ts           # key 'type' → 'direction'; 4 options

app/globals.css                 # Add --total-allocation / --total-transfer tokens
```

### Pattern 1: Direction Join Fragment [VERIFIED: codebase grep]

The direction join is NOT yet extracted as a reusable fragment. It exists inline only in `getMonthlyTrendByNature` and `getOverviewChart` as a correlated subquery for `nature.code`. Phase 49 should introduce a reusable inline Drizzle join chain:

```typescript
// Recommended pattern for the direction join (to be authored in Phase 49)
// Source: schema.ts FK chain analysis
import { direction, nature, subCategory, userSubcategoryOverride } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// In a query builder chain, after joining subCategory and userSubcategoryOverride:
// .innerJoin(nature, eq(subCategory.natureId, nature.id))
// .innerJoin(direction, eq(nature.directionId, direction.id))
// Effective nature via COALESCE override.natureId → sub.natureId is currently
// expressed as a correlated subquery; the planner may inline it or introduce
// a Drizzle alias approach.
```

The `effectiveNature` SQL pattern already confirmed in `getCategoriesForUser` and `getOverviewChart`:
```sql
(SELECT n.code FROM nature n
 WHERE n.id = COALESCE(user_subcategory_override.nature_id, sub_category.nature_id)
 LIMIT 1)
```

### Pattern 2: Algebraic Sum Aggregation [VERIFIED: codebase analysis]

**Current (broken) sign-split pattern** — present in `getOverviewAmountTotals`, `getCategoriesBreakdown`, `getCategoryRanking`, `getCategoryDeviations`, `getCategoryDetail`, `getAggregatedTransactionsData`:

```sql
-- WRONG — splits by sign, not by direction
totalIn:  coalesce(sum(case when amount > 0 then amount else 0 end), 0)
totalOut: coalesce(abs(sum(case when amount < 0 then amount else 0 end)), 0)
```

**Correct algebraic sum pattern** — GROUP BY direction.code, take `coalesce(sum(amount), 0)`:

```sql
-- CORRECT — algebraic sum per direction bucket
-- IN: sum(amount) where direction.code = 'in'
-- OUT: abs(sum(amount)) where direction.code = 'out'  [abs for display only]
-- ALLOCATION: sum(amount) where direction.code = 'allocation'  [can be negative = divestment month]
-- direction.included_in_totals = false → TRANSFER and ALLOCATION excluded from spending totals
```

In Drizzle, the SELECT must JOIN to `direction` and the WHERE clause uses `eq(direction.code, 'in')` etc. or a CASE/FILTER approach in a single aggregation pass:

```typescript
// Single-pass aggregation (recommended for KPI totals):
{
  totalIn: sql<string>`coalesce(sum(case when ${direction.code} = 'in' then ${transactionTable.amount} else 0 end), 0)::text`,
  totalOut: sql<string>`coalesce(abs(sum(case when ${direction.code} = 'out' then ${transactionTable.amount} else 0 end)), 0)::text`,
  totalAllocation: sql<string>`coalesce(sum(case when ${direction.code} = 'allocation' then ${transactionTable.amount} else 0 end), 0)::text`,
}
```

### Pattern 3: `notExcludedFromTotals()` Replacement [VERIFIED: codebase analysis]

**Current helper** (lines 392-394 of `lib/dal/dashboard.ts`):
```typescript
export function notExcludedFromTotals() {
  return or(isNull(subCategory.excludeFromTotals), eq(subCategory.excludeFromTotals, false))
}
```

**Replacement** (after direction join and D-10 column drop):
```typescript
// Replace with: eq(direction.includedInTotals, true)
// Once direction is joined in the query chain, this is a simple boolean filter.
// 'spending totals' = direction.included_in_totals = true
// transfer: included_in_totals = false (hidden)
// allocation: included_in_totals = false (shown separately, not in spending totals)
```

### Pattern 4: `notTransferCategory()` Replacement [VERIFIED: codebase analysis]

**Current stub** in `lib/dal/dashboard.ts` (lines 383-390) and `lib/dal/overview.ts` (lines 61-64):

`dashboard.ts` variant uses a correlated NOT EXISTS subquery:
```sql
(subCategory.natureId IS NULL OR NOT EXISTS (
  SELECT 1 FROM nature _n WHERE _n.id = subCategory.natureId AND _n.code = 'transfer'
))
```

`overview.ts` variant uses a simple OR/NE:
```typescript
or(isNull(natureTable.code), ne(natureTable.code, 'transfer'))
// (this requires a leftJoin to nature table already present)
```

**Replacement**: `ne(direction.code, 'transfer')` — once the direction join is in place, both stubs simplify to a single inequality filter on `direction.code`.

### Pattern 5: OverviewChartPoint Shape Rewrite [VERIFIED: codebase analysis]

**Current type** (`lib/dal/overview.ts` lines 50-56):
```typescript
export type OverviewChartPoint = {
  month: string
  label: string
  income: { recurring: string; extraordinary: string }
  out: Record<OutNature, string>  // OutNature includes savings/investment/transfer — WRONG
}
```

**Target type** (Phase 49):
```typescript
export type OverviewChartPoint = {
  month: string
  label: string
  income: { recurring: string; extraordinary: string }  // unchanged structure
  out: { essential: string; discretionary: string; debt: string }  // OUT natures only
  allocation: { savings: string; investment: string }  // NEW
}
```

The chart `deriveFilteredBarRow` / `deriveNatureBreakdown` in `overview-chart-utils.ts` will need updating to consume the new shape. The Recharts `Bar` component gain a 3rd `dataKey="accantonato"`.

### Pattern 6: `getMonthOverMonthCategoryChanges` Direction Extension [VERIFIED: codebase analysis]

Current signature:
```typescript
async (year: number, monthIndex = 0, limit = 10): Promise<MonthOverMonthChange[]>
```

The current WHERE clause uses `isNull(subCategory.natureId)` as a placeholder (include all), and explicitly notes `TODO(Phase 49): replace with direction.code = 'out' filter`.

Phase 49 adds:
```typescript
async (year: number, monthIndex = 0, direction: 'in' | 'out' | 'allocation' = 'out', limit = 10)
```

For `direction = 'allocation'`, the query groups by nature (savings/investment) instead of category — `MonthOverMonthChange` type needs a discriminated variant or a `grain: 'category' | 'nature'` field. The simplest approach: keep `MonthOverMonthChange` with `categoryId | null` and `natureCode | null` and populate whichever applies.

### Pattern 7: `fetchMovers` Server Action [VERIFIED: codebase analysis]

Current signature (`lib/actions/overview.ts`):
```typescript
export async function fetchMovers(year: number, monthIndex: number)
```

Phase 49: adds `direction: 'in' | 'out' | 'allocation'` parameter. Input validation must bound the direction string (same pattern as year/monthIndex bounds-check currently on lines 26-34). Default `'out'` preserves backward compat.

### Anti-Patterns to Avoid

- **`abs(sum(amount<0))` for OUT total** — must become `abs(sum(amount))` where `direction.code = 'out'` (algebraic sum). A `+` refund under an OUT subcategory lowers the total; the old pattern would ignore it.
- **Filtering by `subCategory.excludeFromTotals`** after the migration — that column is dropped. Any residual reference will cause a compile error if schema is updated first.
- **Keeping `OUT_NATURES` array in `lib/dal/overview.ts`** — it currently includes `savings`, `investment`, `transfer` which are NOT OUT. Remove entirely after direction join lands.
- **`categoryType: sql\`null\`` stubs** — multiple queries return `null` as a typed placeholder for `categoryType`. These must be replaced with actual `direction.code` values.
- **Percent calculations using `abs()` on OUT amounts** before algebraic sum** — `computeBreakdownPercentages` and `computeSavingsRate` should receive already-netting-safe amounts.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Monetary accumulation | JS `+` or `Number()` arithmetic | `toDecimal()` / `Decimal.plus()` / `toFixed(2)` | DECIMAL columns are strings; floating point errors on money |
| Schema migration | Hand-written SQL | `drizzle-kit generate` then `scripts/migrate.ts` | Enforced project constraint; `drizzle-kit push` forbidden in prod |
| Direction-from-nature resolution | App-side mapping code | SQL JOIN `subCategory → nature → direction` | Single source of truth; override logic already in DB |
| Algebraic sum netting | Custom reducer loop | SQL `sum(amount)` in the correct direction bucket | Netting is a database aggregate, not application logic |

---

## Current Implementation: Detailed Call-Site Inventory

This section is the primary value for the planner. Every `TODO(Phase 49)` site is catalogued with its current stub and required replacement.

### `lib/dal/dashboard.ts` — 18 TODO(Phase 49) markers [VERIFIED: codebase grep]

| Function | Current Stub | Required Action |
|---|---|---|
| `notTransferCategory()` (line 384) | Correlated NOT EXISTS subquery on `nature._n.code = 'transfer'` | Replace with `ne(direction.code, 'transfer')` after direction join |
| `notExcludedFromTotals()` (line 392) | `excludeFromTotals IS NULL OR = false` | Replace with `eq(direction.includedInTotals, true)`; delete function after D-10 migration |
| `getOverviewAmountTotals` (line 436) | Sign-split: `sum(amount>0)` / `abs(sum(amount<0))` | Algebraic sum per direction bucket; add `totalAllocation` output; join `nature + direction`; filter `direction.code != 'transfer'` |
| `getCategoriesBreakdown` (line 875) | `typeFilter = sql\`true\`` (no-op); `categoryType: sql\`null\`` | Real `typeFilter = eq(direction.code, filters.direction)`; restore `categoryType` from `direction.code`; replace `notExcludedFromTotals()` with `direction.includedInTotals` |
| `getCategoryRanking` (line 929) | Same as above | Same treatment |
| `getCategoryDeviations` (line 981) | Same | Same; note: deviation logic computes on `abs(sum(...))` — after algebraic sum, amounts may already be signed; adjust `buildDeviationDataset` input |
| `getCategoryDetail` (line 1059) | `type: sql\`null\``; hardcoded `selectedType` from filter | Restore `categoryType` from direction join; drop `selectedType` hack |
| `getAggregatedTransactionsData` (line 1238) | Inline sign-split with nature subquery | Full direction join; algebraic sum; `totalIgn` via `direction.code = 'transfer'` |
| `buildMonthlyNatureTrendData` (line 664) | Comment noting segments replaced by direction-grouped sum | Shape the output by direction code instead of nature code |

### `lib/dal/overview.ts` — 9 TODO(Phase 49) markers [VERIFIED: codebase grep]

| Function | Current Stub | Required Action |
|---|---|---|
| `OUT_NATURES` constant (line 39) | Includes `savings`, `investment`, `transfer` — semantically wrong | Remove entirely; direction join makes it unnecessary |
| `OverviewChartPoint` type (line 50) | `out: Record<OutNature, string>` includes allocation/transfer | Reshape: `out: {essential; discretionary; debt}`, `allocation: {savings; investment}` |
| `notTransferCategory()` (line 61) | `or(isNull(nature.code), ne(nature.code, 'transfer'))` | Replace with `ne(direction.code, 'transfer')` |
| `emptyOutSegments()` (line 78) | Returns 6 slots including savings/investment/transfer | Remove; restructure to separate `emptyOutSegments()` and `emptyAllocationSegments()` |
| `getMonthOverMonthCategoryChanges` (line 180) | `isNull(subCategory.natureId)` placeholder — includes ALL transactions | Replace with `eq(direction.code, directionParam)`; for 'out' = OUT categories per-category; for 'in' = IN categories per-category; for 'allocation' = allocation per-nature |
| `getOverviewChart` (line 317) | Groups by `natureSql`; stores all natures in `out.*`; includes transfer | Direction-aware grouping; separate `allocation` bucket; filter `direction.code != 'transfer'` |

### `lib/dal/categories.ts` — 3 TODO(Phase 49) markers [VERIFIED: codebase grep]

| Location | Stub | Required Action |
|---|---|---|
| `getCategoriesForUser` (line 73) | `type: null` placeholder | Add direction join to category query; expose `direction.code` as `type` |
| `CategoryWithSubCategories.type` (line 12) | `string | null` | Change to `'in' | 'out' | 'allocation' | 'transfer' | null` |

### `lib/dal/transactions.ts` — 5 TODO(Phase 49) markers [VERIFIED: codebase grep]

| Location | Stub | Required Action |
|---|---|---|
| `transactionListSelect.categoryType` (line 88) | `category.id` placeholder (wrong column!) | Replace with `direction.code` via join |
| `TransactionListRow.categoryType` (line 117) | `number | null` | Change to `string | null` (direction code) |
| `filters.type` handling (line 232) | `eq(nature.code, filters.type)` — maps type to nature.code (wrong) | Replace with `eq(direction.code, filters.direction)` via direction join; rename filter key from `type` to `direction` |

### `lib/utils/cascade-options.ts` — full rewrite [VERIFIED: codebase analysis]

`buildTypeNatureMap` currently iterates `cat.type` (now `null` for all categories). The loop `if (cat.type === null || cat.type === 'system') continue` will SKIP every category, returning `{}`.

Required: `buildDirectionNatureMap(categories)` — iterate subcategory `effectiveNature`, resolve its direction via a direction lookup map (passed in or derived from the nature→direction FK data available in `CategoryWithSubCategories`). The output shape: `Record<'in'|'out'|'allocation'|'transfer'|'', FilterOption[]>` keyed by direction code.

The direction lookup data is available because `getCategoriesForUser` will be updated to expose `direction.code` as `type`. The cascade then groups natures by direction.

`buildCategorySubcategoryMap` currently also skips `cat.type === null` categories. Same fix needed: skip `cat.type === 'system'` only (once `type` is a proper direction code, not null).

### `components/categorization/subcategory-picker.tsx` [VERIFIED: codebase analysis]

Current `TYPE_FILTERS` (lines 72-77):
```typescript
const TYPE_FILTERS = [
  { key: null, label: 'Tutte' },
  { key: 'in', label: 'Entrate' },
  { key: 'out', label: 'Uscite' },
  { key: 'transfer', label: 'Trasferimenti' },
]
```

Missing: `{ key: 'allocation', label: 'Accantonamenti' }` (label from `direction.label_it` seed).

The `allowedCategoryTypes` and `defaultType` props reference `TypeKey = CategoryWithSubCategories['type']`. Once `type` is a proper direction code (not `null`), this type naturally extends to include `'allocation'`. The `PickerBody` filter logic `c.type === type` will work without change once category types are restored.

The `rail` filter `allowedCategoryTypes.includes(c.type)` similarly works once `type` is restored.

### Table filters `transactions.table.ts` / `expenses.table.ts` [VERIFIED: codebase analysis]

Changes are mechanical config-level swaps:
1. Filter key `'type'` → `'direction'`; label `'Tipo'` → `'Direzione'`
2. Options: was 3 (in/out/transfer); becomes 4 (in/out/allocation/transfer) — labels from `direction.label_it`
3. Filter key `'nature'`; `dependsOn: 'type'` → `dependsOn: 'direction'`
4. DAL `TransactionFilters.type` → `TransactionFilters.direction` rename; similarly `ExpenseFilters.type` → `.direction`

---

## `exclude_from_totals` Column Drop: Verification Data

**Semantic equivalence confirmed via `tests/fixtures/v2-taxonomy-manifest.ts`** [VERIFIED: codebase analysis]:

The 3 subcategory slugs that currently carry `exclude_from_totals = true` (set in Phase 47 `seed-extras.ts`):
- `trasferimento-tra-conti` → `natureCode: 'transfer'` → `direction.code: 'transfer'` → `included_in_totals: false`
- `addebito-carta-di-credito` → `natureCode: 'transfer'` → same
- `contante` → `natureCode: 'transfer'` → same

All allocation natures (`savings`, `investment`) → `direction.code: 'allocation'` → `included_in_totals: false`.

**No semantic gap**: `direction.included_in_totals = false` covers exactly the same set of transactions as `exclude_from_totals = true`. Dropping the column after the aggregation switches to `direction.included_in_totals` is safe.

**Migration flow** (D-12 / Phase 48 operator protocol):
```bash
# Before migration apply:
pg_dump $DATABASE_URL > backup-pre-phase49-$(date +%Y%m%d).dump

# Generate migration (drizzle-kit generate from schema change — remove excludeFromTotals from schema.ts first):
yarn db:generate

# Apply:
yarn db:migrate

# Verify (no down-migration — restore from dump is the rollback):
yarn db:verify
```

---

## Common Pitfalls

### Pitfall 1: Aggregation order — join before filter
**What goes wrong:** Adding the direction join as a `leftJoin` but filtering on `direction.code` in WHERE — rows with `subCategoryId IS NULL` (uncategorized transactions) have no direction join result; `direction.code` is NULL; a WHERE `eq(direction.code, 'out')` silently drops uncategorized rows.
**Why it happens:** `leftJoin` returns NULL for unmatched rows; equality filter on NULL = no match.
**How to avoid:** Uncategorized-count queries use a separate query (`getUncategorizedCount`) that is already direction-agnostic. Aggregation queries should only include expenses with a subcategory (`innerJoin` on `subCategory`). Use `innerJoin` to `nature` and `direction` when the query is computing direction-scoped totals.
**Warning signs:** `getUncategorizedCount` returning 0 after the rewrite.

### Pitfall 2: Allocation total sign
**What goes wrong:** A divestment month (sell ETF) has `amount > 0` but nature `investment` → direction `allocation`. The chart should show a positive allocation total (money came back into liquid). Using `abs(sum(...))` incorrectly makes both investment (+800 deposit) and divestment (+300 withdrawal) show as positive — net should be +500 allocation, not +800+300.
**Why it happens:** Algebraic sum means `sum(-100 + 200) = +100`; the sign encodes direction within the segment.
**How to avoid:** For the allocation chart bar: `sum(amount)` where `direction.code = 'allocation'` (no abs). The result can be negative in months with net divestment — render as zero-height bar with click for detail.
**Warning signs:** Allocation KPI card showing inflated values in months with both deposits and withdrawals.

### Pitfall 3: `computeSavingsRate` receives wrong `totalOut`
**What goes wrong:** `computeSavingsRate(totalIn, totalOut)` currently uses the sign-split OUT total which includes allocation and transfer. After the rewrite, if `totalOut` still includes allocation, savings rate = `(in − in − allocation) / in` = negative for heavy savers.
**Why it happens:** `getOverviewAmountTotals` currently returns a 2-field object. After Phase 49 it returns 3 fields (`totalIn`, `totalOut`, `totalAllocation`). `buildOverviewData` must use only `totalOut` (spending) for savings rate.
**How to avoid:** Ensure `getOverviewAmountTotals` or its replacement filters `direction.included_in_totals = true` for the OUT total; allocation handled separately.
**Warning signs:** `savingsRate` going negative or exceeding 100% for active savers.

### Pitfall 4: `OUT_NATURES` left in place in `overview.ts`
**What goes wrong:** `OUT_NATURES` array includes `savings`, `investment`, `transfer`. If left in place while the aggregation query now returns separate direction-bucketed rows, savings/investment amounts land in the `out.*` segments of `OverviewChartPoint` and double-count (once in allocation, once in out).
**Why it happens:** The current `getOverviewChart` loops rows and routes by `nature` code to `bucket.out[outKey]`. If `nature === 'savings'` and `savings` is still in `OUT_NATURES`, it goes to `bucket.out.savings`.
**How to avoid:** Remove `OUT_NATURES` entirely. Route by `direction.code` first; within OUT direction group by nature for the tooltip breakdown.
**Warning signs:** Uscite bar showing higher values than expected; allocation total showing 0 despite investment data.

### Pitfall 5: `cascade-options.ts` skipping all categories
**What goes wrong:** `buildTypeNatureMap` skips any category where `cat.type === null`. After Phase 46, ALL categories have `type: null`. The function currently returns `{}` — all nature filter options disappear from tables.
**Why it happens:** Phase 46 set `type: null` as a compile stub. Phase 49 must restore `type` from direction join — but until that lands, cascade-options is already broken in production.
**How to avoid:** Fix `getCategoriesForUser` (restore `type` from direction join) before deploying any cascade-options changes. Or write the new `buildDirectionNatureMap` to accept direction-code keys instead.
**Warning signs:** Nature filter dropdown showing empty options list in transactions/expenses table.

### Pitfall 6: Test mocks using old schema field names
**What goes wrong:** `tests/dashboard-dal.test.ts` mocks `subCategory.excludeFromTotals` and `subCategory.nature` (old enum column). After D-10 column drop and column rename, the mock mismatches schema.
**Why it happens:** Test mocks use hardcoded field names from the schema at test-write time.
**How to avoid:** Update test mocks to include `subCategory.natureId` and `direction.includedInTotals`; remove mock for `subCategory.excludeFromTotals` and `subCategory.nature`.
**Warning signs:** Tests passing despite column being dropped (mock shields the test from DB reality — this is a false green).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.5 |
| Config file | `vitest.config.ts` (or inferred from `package.json`) |
| Quick run command | `yarn test` (= `vitest run`) |
| Full suite command | `yarn test` |
| E2E command | `yarn test:e2e` (Playwright — not required for this phase) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-02 | `+` refund under OUT subcategory nets correctly (totalOut lower, not higher) | unit | `yarn test -- dashboard-dal` | ❌ Wave 0: extend `tests/dashboard-dal.test.ts` |
| DASH-02 | Algebraic sum for allocation: net divestment month shows lower total | unit | `yarn test -- dashboard-dal` | ❌ Wave 0: new test case |
| DASH-03 | Sign of direction: `+` amount under `out` direction reduces OUT total via algebraic sum | unit | `yarn test -- dashboard-dal` | ❌ Wave 0 |
| DASH-04 | Savings rate unchanged = `(in − out) / in` where `out` excludes allocation and transfer | unit | `yarn test -- dashboard-dal` | ❌ Wave 0 |
| DASH-01 | Transfer excluded from totals: `direction.included_in_totals = false` for transfer rows | unit | `yarn test -- dashboard-dal` | ❌ Wave 0 |
| CAT-01 | `buildDirectionNatureMap` produces non-empty options once `cat.type` is a direction code | unit | `yarn test -- cascade-options` (new file) | ❌ Wave 0 |
| CAT-02 | `direction` filter in transaction DAL produces correct WHERE clause | unit | `yarn test -- transactions-dal` (new or extend) | ❌ Wave 0 |
| DASH-02 | `getOverviewChart` allocates savings/investment to `allocation` bucket, not `out` | unit | `yarn test -- overview-dal` | Extend existing `tests/overview-dal.test.ts` ✅ |
| DASH-01 | 5th KPI card renders with `totalAllocation` value | unit | `yarn test -- kpi-row` (new) | ❌ Wave 0 |

### Key Correctness Assertions (must be explicit in tests)

```typescript
// DASH-02 algebraic sum: refund netting
// +€30 refund under an OUT subcategory (e.g. 'shopping') should net:
// totalOut before = 100, totalOut after = 70 (not 130)
expect(result.totalOut).toBe('70.00')  // NOT '100.00' or '130.00'

// DASH-03 savings/investment in allocation, not out
// A savings deposit of -€500 (cash leaving account) should appear in allocation, not spending
expect(result.totalOut).toBe('0.00')   // no OUT transactions in this test
expect(result.totalAllocation).toBe('500.00')

// DASH-04 savings rate
// totalIn=3000, totalOut=2000 (no allocation, no transfer) → rate = (3000-2000)/3000 = 33.3%
expect(result.savingsRate).toBe(33)    // existing computeSavingsRate rounds

// DASH-01 transfer excluded
// A 'transfer' direction transaction contributes 0 to totalIn, totalOut, totalAllocation
expect(result.totalIn).toBe('0.00')
expect(result.totalOut).toBe('0.00')
```

### Sampling Rate
- **Per task commit:** `yarn test`
- **Per wave merge:** `yarn test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/dashboard-dal.test.ts` — add: algebraic sum refund netting, allocation bucket, transfer exclusion, savings rate correctness
- [ ] `tests/cascade-options.test.ts` — new: `buildDirectionNatureMap` with direction-code categories
- [ ] Update `tests/dashboard-dal.test.ts` mock schema: replace `subCategory.excludeFromTotals` / `subCategory.nature` stubs with `subCategory.natureId` / `direction.includedInTotals`
- [ ] Update `tests/overview-dal.test.ts`: add `getOverviewChart` test asserting allocation bucket populated, OUT bucket excludes savings/investment

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | `verifySession()` at every DAL function entry (existing pattern; all phase functions preserve it) |
| V5 Input Validation | yes | `fetchMovers` gains `direction` parameter — must validate as `'in' | 'out' | 'allocation'` string enum (same pattern as year/monthIndex bounds check) |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Direction parameter injection | Tampering | Validate `direction` param in `fetchMovers` as a closed enum before hitting DAL; existing bounds-check pattern on lines 26-34 of `lib/actions/overview.ts` |
| userId scope escape | Information Disclosure | `verifySession()` already enforced on every cached DAL function; no change to that pattern |

---

## Runtime State Inventory

> Greenfield-phase guard: Phase 49 renames no user-facing identifiers and drops no user-readable data. No stored state carries the deprecated string names — the column `exclude_from_totals` is DB-internal (never exposed in API responses or user settings). Standard runtime state audit below for completeness.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `sub_category.exclude_from_totals` column, 3 rows with `true` value | Schema migration DROP COLUMN (D-10); aggregation must switch to `direction.included_in_totals` BEFORE migration |
| Live service config | None — no Vercel env vars, n8n workflows, or service names reference `exclude_from_totals` or `category.type` | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | `.next/` cache — stale after schema change | `rm -rf .next` after migration; Vercel preview deploy rebuilds automatically |

**Critical sequencing constraint:** The aggregation code MUST switch from `notExcludedFromTotals()` (reads `exclude_from_totals`) to `direction.includedInTotals` BEFORE the column is dropped. If the migration runs first, the old code throws a DB error. The planner must put the code change in an earlier wave than the migration apply.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | All DAL functions | ✓ | (project-managed) | — |
| drizzle-kit | `db:generate` for D-10 migration | ✓ | existing | — |
| Node.js / yarn | Test runner, build | ✓ | existing | — |

No missing dependencies.

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| `sum(amount>0)` / `abs(sum(amount<0))` sign-split | Direction-grouped `sum(amount)` algebraic sum | ADR 0012; Phase 49 migration |
| `category.type` for direction | `sub_category.nature_id → nature → direction` FK chain | ADR 0012; `category.type` column removed in Phase 46 |
| `sub_category.exclude_from_totals` boolean | `direction.included_in_totals` on direction lookup | D-10; same semantic, single source of truth |
| `flow_nature` pgEnum | `nature` lookup table with `nature.code` varchar | Phase 46 migration |
| 2-direction dashboard (IN/OUT) | 4-direction view: IN, OUT, ALLOCATION, TRANSFER-hidden | DASH-01 |
| `OUT_NATURES` array including savings/investment/transfer | Per-direction grouping; no OUT_NATURES array needed | Phase 49 |

---

## Open Questions

1. **`getAggregatedTransactionsData` — is it still used?**
   - What we know: the function computes `MonthlyTrendPoint[]` with sign-split aggregation; its consumer is not obvious from the function name.
   - What's unclear: does any dashboard page route or component still call this vs `getOverviewChart`?
   - Recommendation: grep for call sites before rewriting; may be a dead code candidate.

2. **`CategoryWithSubCategories.type` and `buildCategoryOptions` in subcategory-picker**
   - What we know: `buildCategoryOptions` in `lib/categorization/subcategory-options.ts` filters by `categoryType`; once `type` is restored as a direction code, allocation categories will appear.
   - What's unclear: does the picker currently show allocation and transfer categories at all, or are they hidden because `type: null`?
   - Recommendation: planner should check `lib/categorization/subcategory-options.ts` for any `type === 'system'` filtering that might also block `type === 'allocation'`.

3. **`getMonthOverMonthCategoryChanges` return type for allocation grain**
   - What we know: allocation movers should be per-nature (2 rows max), not per-category. The current `MonthOverMonthChange` type uses `categoryId: number`.
   - What's unclear: should the type be extended with `natureCode?: string | null` and `categoryId?: number | null`, or is a separate `AllocationMoverChange` type cleaner?
   - Recommendation: introduce `NatureMoverChange` type for allocation; the `fetchMovers` action can return a discriminated union based on direction.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phase 48's DB migration (adding `nature_id` FK, removing deprecated enums) has been applied before Phase 49 executes | Throughout | Direction join would fail at runtime if `nature` / `direction` tables don't exist in DB |
| A2 | `direction` table has 4 rows with codes `in`, `out`, `allocation`, `transfer` and boolean `included_in_totals` correctly set | Aggregation patterns | Totals computed incorrectly if rows are missing or flags are wrong |
| A3 | `nature` table `direction_id` FK is correct for all 8 natures | Direction join fragment | Investment / savings would land in wrong direction bucket |

All three assumptions are grounded in Phase 46 and 47 deliverables and the contract tests in `tests/fixtures/v2-taxonomy-manifest.ts` — but they depend on DB apply (Phase 48 Plan 03) having completed.

---

## Sources

### Primary (HIGH confidence)
- Codebase direct analysis — `lib/dal/dashboard.ts` (1322 lines), `lib/dal/overview.ts` (413 lines), `lib/db/schema.ts`, `lib/utils/cascade-options.ts`, `components/dashboard/overview/*`, `components/categorization/subcategory-picker.tsx`, `app/(app)/transactions/transactions.table.ts`, `app/(app)/expenses/expenses.table.ts`, `lib/actions/overview.ts`, `tests/fixtures/v2-taxonomy-manifest.ts`, `tests/overview-dal.test.ts`, `tests/dashboard-dal.test.ts`
- `.planning/phases/49-dashboard-and-surfaces/49-CONTEXT.md` — locked decisions
- `.planning/phases/49-dashboard-and-surfaces/49-UI-SPEC.md` — visual/interaction contract
- `docs/adr/0012-direction-derived-from-nature-allocation.md` — locked design contract
- `CONTEXT.md` (repo root) — canonical domain vocabulary
- `.planning/REQUIREMENTS.md` — DASH-01..04, CAT-01, CAT-02

### Secondary (MEDIUM confidence)
- `grep -r "TODO(Phase 49)"` — exhaustive call-site inventory (55 matches across 10 files)
- Schema field names and FK structure from `lib/db/schema.ts` (verified line-by-line)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all existing
- Architecture / call-site inventory: HIGH — exhaustive grep + direct code read
- Direction join SQL pattern: HIGH — derived directly from existing `effectiveNature` correlated subquery pattern already in production
- Test correctness: HIGH — based on ADR 0012 algebraic-sum semantics

**Research date:** 2026-06-12
**Valid until:** Until codebase changes; no external dependencies, no version drift risk
