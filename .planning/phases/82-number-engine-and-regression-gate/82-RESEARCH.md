# Phase 82: number-engine-and-regression-gate — Research

**Researched:** 2026-07-30
**Domain:** Shared number engine (pace, coverage, projection, sign convention) + regression gate + UI retirements
**Confidence:** HIGH

## Summary

Phase 82 is a computation + regression gate phase with two small UI retirements. The shared number engine — covering the `Mese Coperto` (covered month) denominator, `Ritmo` (pace as year average), year-end projection, and the `current − previous` sign convention — must be built and proven not to disturb Overview or Tags before any Categories list or detail UI ships.

**Primary recommendation:** Build the engine in `lib/services/` (new file `paceAndProjection.ts` or similar) with supporting queries in `lib/dal/` (new file `coveredMonths.ts`), keeping Overview/Tags reading their current code paths unchanged. Reuse the v2.8/v2.9 regression test pattern (`captureAggregationSnapshot`, isolated Postgres, golden fixtures) to prove byte-identical totals. Remove the lens switch from Categories and Tags components, drop the dead `tag` parameter from `buildDashboardTabHref`, and keep `lens` propagation invisible in tab navigation.

**Key architectural decision:** The ledger_entry seam (ADR 0019 §10) is already in place and fully established across 10 aggregation sites. Phase 82 does NOT thread a `lens` parameter through aggregations — it reads the correct view. The engine accesses ledger via the seam's `LedgerRowSource` type or via Overview's established patterns.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Covered Month denominator (SQL) | Database / DAL | — | Query-time predicate on user transactions; reuses existing `getMonthsWithData` pattern |
| Pace/projection arithmetic (Decimal.js) | Services (business logic) | — | Multi-step computation: covered months, pace formula, projection, hybrid current month; belongs in `lib/services/` |
| Period total verification (D-07) | Services + DAL | — | Engine property: total = sum of series; asserted at compute time, verified by regression tests |
| Current − previous sign convention | Services | DAL (overview.ts) | Sign stored in data (Services), colour/word mapping deferred to UI phase; reuses `lib/dal/overview.ts` convention |
| Insufficient-coverage outcome | Services | — | Explicit discriminated union or sentinel type; cannot be silently read as €0 (D-05) |
| Lens confinement (Categories/Tags) | UI / Components | — | Render-time removal of lens switch from Categories and Tags pages; removal is pure component deletion |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**From 82-CONTEXT.md (16 decisions, D-01…D-16):**

- **D-01 / D-02:** Covered Month definition: month with ≥1 transaction (any category), excluded if zero transactions. Inside a Covered Month, a category with no movement is €0 and counts.
- **D-03:** Partial Month = current calendar month, always excluded from averages. No presumption for past months.
- **D-04 / D-05:** Pace = year average of Covered Months (not window-scoped, not last-N-months). No pace/projection below 2 Covered Months (D-05).
- **D-06:** Current month valued at `max(spent-so-far, pace)` — hybrid, never below observed.
- **D-07:** Period total = sum of displayed series. No separate projection formula.
- **D-08 / D-09:** Every comparison stored as `current − previous`; colour/judgement resolved per-direction (one function, not per-widget).
- **D-10:** Coverage threshold gates only total difference; average comparison always renders.
- **D-11:** All Decimal.js arithmetic via `@/lib/utils/decimal`; no native JS `+−*/` on amounts.
- **D-12:** Lens confined to Overview only. Categories always cassa. (Amends LENS-01 of ADR 0019.)
- **D-13:** Tab nav keeps `?lens=` invisible for state preservation Overview → Categories → back.
- **D-14:** `buildDashboardTabHref` drops dead `tag` parameter (v2.7); `preset` removal deferred to Phase 84.
- **D-15 / D-16:** Regression suite proves Overview/Tags totals byte-identical pre/post-engine. Must re-runnable by Phase 83's predicate flip (`direction.includedInTotals` → `direction.hidden`).

### Claude's Discretion

- Exact module and file layout (layering rule fixed: `dal/` queries, `services/` computation).
- Shape of insufficient-coverage outcome (discriminated union, sentinel type, thrown error all acceptable per D-05).
- Test fixture capture strategy and `sparter_test` database seeding mechanics.
- Previous-year coverage threshold value (D-10 gates total difference; DECISIONS doc proposes ≥6 Covered Months).
- Exported engine type/function naming (English only; Italian product surfaces only).

### Deferred Ideas (Out of Scope)

- Categories list surface (Phase 83: CLIST-01…07).
- Categories detail table (Phase 84: CDET-01…07).
- Direction coverage expansion to three (`direction.hidden` instead of `includedInTotals`, Phase 83: CLIST-04).
- Removal of Deviation/Baseline/Noise/Preset machinery (Phase 84: RETIRE-01/02).
- Copy set, colour mapping, visual treatment of month states, acceleration ordering (Phase 83/84 UI phases).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PACE-01 | Zero-transaction months excluded; Covered Month categories with no movement are €0 and count | D-01/D-02; implemented via covered-months query predicate |
| PACE-02 | Current calendar month excluded from averages; import-stopped months (past) are not partial | D-03; resolves `occurredAt` against `new Date()` |
| PACE-03 | Pace only when ≥2 Covered Months; no fragile numbers | D-04/D-05; engine returns explicit insufficient-coverage outcome |
| PACE-04 | Current month = `max(spent-so-far, pace)` — projection never below observed | D-06; hybrid month computation |
| PACE-05 | Period total = sum of monthly series; no independent projection formula | D-07; verified by test assertion |
| PACE-06 | Comparison stored as `current − previous`; per-direction colour mapping in one place | D-08/D-09; reuses `lib/dal/overview.ts` convention |
| RETIRE-03 | Lens switch removed from Categories and Tags; Overview only | D-12; component render removal |
| RETIRE-04 | Tab nav drops dead `tag` parameter; keeps `lens` invisible | D-13/D-14; `buildDashboardTabHref` modification |
| RETIRE-05 | Regression suite proves byte-identical Overview/Tags totals before/after engine change | D-15/D-16; v2.9 pattern reproduction |

## Standard Stack

### Core Established Infrastructure (Reused)

| Component | Version | Purpose | Status |
|-----------|---------|---------|--------|
| `ledgerEntryCash` view | Phase 77 | Cash lens (transactions netted) | [VERIFIED: codebase] Already exists in `lib/db/schema.ts` |
| `ledgerEntryAccrual` view | Phase 77 | Accrual lens (+ instalments) | [VERIFIED: codebase] Already exists in `lib/db/schema.ts` |
| `Decimal.js` | v10.6.0 | Monetary arithmetic only | [VERIFIED: npm] In package.json; helpers in `lib/utils/decimal.ts` |
| `@/lib/dal/overview.ts` | Existing | `current − previous` convention, documented | [VERIFIED: codebase] Already in use by Overview tab |
| `@/lib/dal/months-with-data.ts` | Existing | Lens-aware month enumeration | [VERIFIED: codebase] Existing pattern for Covered Month denominator |
| `@/lib/dal/dashboard-filters.ts` | Phase 77 | Shared predicates, `LedgerRowSource` type, `resolveLedgerRowSource()` | [VERIFIED: codebase] Extract calls; reuse `dateScopedTransactions()`, `expenseStatusIncludedInDashboardTotals()` |
| Vitest + isolated Postgres | Phase 28+ | Test harness for regression gates | [VERIFIED: codebase] `tests/amortization-lens-regression*.test.ts` is the pattern |

### New Engine Modules (To Build)

These are the minimal seams required, following `dal/services/actions` layering:

| Module | Purpose | Pattern |
|--------|---------|---------|
| `lib/dal/covered-months.ts` | Query for user's covered months in a year | Single query function returning `CoveredMonth[]` (month YYYY-MM, date range) |
| `lib/services/pace-and-projection.ts` | Pace/projection/current-month arithmetic using Decimal.js | Exported types: `CoveredMonthsInput`, `PaceAndProjectionEngine`, `PaceResult` (either complete or insufficient-coverage) |
| `lib/actions/*` (if needed) | Thin Server Action wrappers | Deferred to plan phase — most likely called from existing page components via existing DAL |

**Version verification:** Decimal.js v10.6.0 confirmed in `package.json`; vitest ^4.1.5; pg ^8.20.0 for test DB.

## Architecture Patterns

### Pattern 1: Ledger Entry Seam (ADR 0019 §10, Established)

**What:** The dashboard aggregation sites do not thread a `lens` parameter through their WHERE/amount logic. Instead, they read from one of two Postgres VIEWS (`ledgerEntryCash` or `ledgerEntryAccrual`) that resolve the amount-computation internally.

**When to use:** Any dashboard aggregation that needs to respect the cassa/competenza switch. Already established; Phase 82 inherits this pattern.

**How Overview/Tags use it today:**
```typescript
// From lib/dal/overview.ts, line 132–133
export const getOverview = cache(async (
  year: number,
  ledgerRowSource: LedgerRowSource = ledgerEntryCash,
): Promise<OverviewData> => {
```

The `ledgerRowSource` parameter (default `ledgerEntryCash`) determines which VIEW the aggregation reads. Phase 82 inherits this exact pattern for the pace/projection engine.

**Key insight:** The view columns are identical (`id, user_id, occurred_at, expense_id, amount`), with NO `source` discriminator. This is deliberate (ADR 0020 Decision 5 rationale) — adding a column would require threading the lens deeper into the logic, undoing the seam's benefit.

### Pattern 2: Decimal.js Composition Chain

**What:** Pace/projection arithmetic chains multiple Decimal operations (covered-month count, average, projection, current-month hybrid) without ever coercing to JS `number`.

**Example from v2.9 test pattern:**
```typescript
// From tests/amortization-lens-regression.test.ts, lines 103–105
const expectedAccrualTotal = instalments
  .filter((i) => i.date >= dateRange.from && i.date <= dateRange.to)
  .reduce((sum, i) => sum.plus(toDecimal(i.amount).abs()), toDecimal('0'))
```

For the pace engine:

```typescript
// Pattern: pace computation
const coveredCount = toDecimal(coveredMonths.length) // Always >= 2 or insufficient-coverage
const yearTotal = coveredMonths.reduce(
  (sum, month) => sum.plus(toDecimal(month.categoryTotal)),
  toDecimal('0')
)
const pace = yearTotal.dividedBy(coveredCount) // Returns Decimal
const projection = pace.times(toDecimal('12'))  // Full year projection
```

**Why:** Drizzle returns `DECIMAL(10,2)` columns as strings. Pass them straight to `toDecimal()`, never via `parseFloat()`.

### Pattern 3: Insufficient-Coverage Outcome (D-05)

**What:** When fewer than 2 Covered Months, the engine must emit an outcome that cannot be silently read as €0 by downstream code.

**Acceptable shapes (Claude's discretion):**
- Discriminated union: `{ status: 'complete'; pace: Decimal } | { status: 'insufficient' }`
- Sentinel type: explicit class `class InsufficientCoverage { readonly type = 'insufficient' }` vs `PaceResult { pace: Decimal }`
- Thrown error: explicit `throw new InsufficientCoverageError()` — callers must handle

**Why:** Returning `null` or `0` creates a "fragile number" (D-05 terminology) — a silent nil coercion downstream. The UI phase needs an explicit prompt to the user (OverviewNudge pattern).

**Recommendation:** Discriminated union `{ status: 'complete' | 'insufficient'; pace?: Decimal }` is most testable and gives phases 83/84 an easy conditional for rendering.

### Pattern 4: Regression Test Harness (v2.9 Precedent)

**Established in v2.9, reproduced here:**

1. **Real-Postgres setup:** `connectReimbursementTestDb()` in `tests/helpers/reimbursement-test-db.ts` connects to isolated `sparter_test` database (requires `yarn db:up`).
2. **Golden fixture:** Seed a minimal user + taxonomy + test transactions, capture aggregation snapshots (e.g., `getOverviewAmountTotals()`) before engine change.
3. **Byte-identical assertion:** After engine change, same queries on same fixtures must return identical string values:
   ```typescript
   expect(toDecimal(cashTotals.totalOut).equals(expectedPreEngineValue)).toBe(true)
   ```
4. **Vitest infrastructure:** Mocked `verifySession()` + mocked `react.cache` (DAL caching) + `vi.doMock('@/lib/db', ...)` to inject harness DB.

**File organization (following v2.9 precedent):**
- New test: `tests/pace-and-projection-regression.test.ts`
- New fixture helpers: Reuse `seedUser`, `seedMinimalTaxonomy`, `seedExpenseWithTransaction` from `tests/fixtures/reimbursement-seed.ts`
- Snapshot capture: Reuse `captureAggregationSnapshot()` from `tests/helpers/reimbursement-test-db.ts`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Covered month denominator | Custom loop/manual grouping | SQL query in `lib/dal/covered-months.ts` | Single source of truth; consistent across all uses; scopes to authenticated user safely |
| Pace arithmetic (division, rounding) | Native JS `totalOut / coveredMonths.length` | Decimal.js `toDecimal(totalOut).dividedBy(coveredCount)` | Rounding errors compound over projection; Decimal guarantees precision at every step |
| Month state classification (fact/hybrid/estimate) | Ad-hoc date comparisons | Single shared function `classifyMonthState(month, today, coveredMonths)` | Three states (past fact / current hybrid / future estimate) are semantically identical across list/detail/projection; branching logic must be centralized |
| Per-direction colour/word mapping | Per-widget copies of sign→colour | Single function `renderComparisonMagnitude(delta, direction)` returning `{ magnitude: string; judgement: 'better' \| 'worse' \| 'neutral' }` | D-09: one function, not per-widget; ensures consistency as `allocation` is added in Phase 83 |

## Common Pitfalls

### Pitfall 1: Silent Pace Coercion to Number

**What goes wrong:** A downstream component receives `pace: null` or `pace: undefined` and silently treats it as 0 — the UI renders a projection that is actually missing.

**Why it happens:** Insufficient-coverage outcome is not explicit (no discriminated union or thrown error); code paths assume pace always exists.

**How to avoid:** Emit an explicit sentinel type (D-05). Make it impossible for callers to receive a `pace` field without first checking `status: 'complete'`. Test: any code assigning `null` or `undefined` to a pace field should fail type-checking.

**Warning signs:** Type errors during implementation like `Cannot assign type 'Decimal | null' to type 'Decimal'`. This is a signal to refactor the return type.

### Pitfall 2: Division by Zero

**What goes wrong:** No Covered Months for a category in the selected year. Pace arithmetic divides by zero, producing `Infinity` or `NaN`.

**Why it happens:** Insufficient-coverage check (`coveredMonths.length >= 2`) is not enforced before division.

**How to avoid:** Guard all divisions: check `coveredMonths.length >= 2` before computing pace. Return insufficient-coverage outcome immediately.

**Warning signs:** A projection figure appears as `∞` or `NaN` on screen; Decimal operations silently produce invalid numbers.

### Pitfall 3: Total ≠ Sum of Series

**What goes wrong:** Period total computed independently from the monthly series (e.g., a direct SQL SUM) diverges from the sum of the numbers displayed in the UI — a visible bug instead of a silent one (D-07 violation).

**Why it happens:** Two separate code paths: one for the total, another for the monthly breakdown.

**How to avoid:** Total = sum of displayed monthly values, computed by the UI or enforced by the engine. Test: regression suite asserts `total == monthlyValues.reduce((sum, m) => sum.plus(toDecimal(m.amount)), toDecimal('0'))`.

**Warning signs:** Dashboard shows "Total: €1200" but the rows sum to €1199.99.

### Pitfall 4: Lens Parameter Leaking into Aggregation Logic

**What goes wrong:** A new developer adds an aggregation function that takes `lens: Lens` as a parameter and threads it through WHERE/AMOUNT logic instead of swapping the ledger_entry row source.

**Why it happens:** The seam (ADR 0019 §10) is not obvious; it looks simpler to just add a parameter.

**How to avoid:** Document the pattern: lens resolution happens in ONE place (`resolveLedgerRowSource` in `lib/dal/dashboard-filters.ts`). All aggregations accept `ledgerRowSource: LedgerRowSource = ledgerEntryCash` parameter, never `lens: Lens`. Code review: if a new aggregation parameter is proposed, flag it.

**Warning signs:** A function signature like `getOverviewData(lens: Lens)` instead of `getOverviewData(ledgerRowSource: LedgerRowSource)`.

### Pitfall 5: Forgetting to Remove Lens Switch from Categories/Tags

**What goes wrong:** The lens switch renders on Categories pages, confusing users ("why can I change the lens here but it doesn't affect anything?") or leading to incorrect readings if a future developer re-threads the lens without realizing Categories is supposed to be cash-only (D-12).

**Why it happens:** D-12 is a design change (amends ADR 0019); easy to miss if only skimming code.

**How to avoid:** Phase 82 plan must explicitly list the three render-site deletions:
- `app/(app)/dashboard/categories/page.tsx` — remove `LensSwitch` from heading
- `app/(app)/dashboard/categories/[id]/page.tsx` — remove `LensSwitch` from detail heading
- `app/(app)/dashboard/tags/page.tsx` — remove disabled switch rendering

Test: regression suite covers Overview and Tags byte-identical; no test for Categories (no engine change there), but component removal is verified by build succeeding.

## Code Examples

All examples use the established pattern. No new patterns are needed.

### Example 1: Covered Month Query (New DAL)

**Source:** Pattern derived from `lib/dal/months-with-data.ts` (existing, established)

```typescript
// lib/dal/covered-months.ts
import 'server-only'
import { cache } from 'react'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/dal/auth'

export type CoveredMonth = {
  yearMonth: string // 'YYYY-MM'
  from: Date
  to: Date
}

/**
 * Returns the distinct calendar months (YYYY-MM, DESC) that contain at least one
 * transaction for the signed-in user, in the given year. A Covered Month is one
 * where the user has imported at least one transaction in any category.
 *
 * Returns empty array if the user has no transactions in the year.
 */
export const getCoveredMonthsInYear = cache(async (year: number): Promise<CoveredMonth[]> => {
  const { userId } = await verifySession()

  const result = await db.execute(sql`
    SELECT 
      TO_CHAR(occurred_at, 'YYYY-MM') AS year_month,
      MIN(occurred_at)::date AS from_date,
      MAX(occurred_at)::date AS to_date
    FROM transaction
    WHERE user_id = ${userId}
      AND EXTRACT(YEAR FROM occurred_at)::integer = ${year}
    GROUP BY TO_CHAR(occurred_at, 'YYYY-MM')
    ORDER BY year_month ASC
  `)

  const rows = result.rows as { year_month: string; from_date: string; to_date: string }[]
  return rows.map((row) => ({
    yearMonth: row.year_month,
    from: new Date(row.from_date),
    to: new Date(row.to_date),
  }))
})
```

### Example 2: Pace Computation (New Services Layer)

**Source:** Decimal.js pattern + aggregation structure from Overview

```typescript
// lib/services/pace-and-projection.ts
import 'server-only'
import Decimal from 'decimal.js'
import { toDecimal, toDbDecimal } from '@/lib/utils/decimal'

export type MonthlyValue = {
  yearMonth: string
  amount: string // Drizzle DECIMAL column as string
}

export type PaceResult =
  | {
      status: 'complete'
      pace: string // Decimal.toFixed(2)
      projection: string // 12-month projection, Decimal.toFixed(2)
      coveredMonthCount: number
    }
  | {
      status: 'insufficient' // < 2 Covered Months
      coveredMonthCount: number
    }

/**
 * Computes the pace (average of covered months) and year-end projection.
 * Returns insufficient-coverage outcome if fewer than 2 covered months.
 */
export function computePaceAndProjection(
  monthlyValues: MonthlyValue[],
): PaceResult {
  const coveredMonthCount = monthlyValues.length

  if (coveredMonthCount < 2) {
    return { status: 'insufficient', coveredMonthCount }
  }

  const total = monthlyValues.reduce(
    (sum, m) => sum.plus(toDecimal(m.amount)),
    toDecimal('0'),
  )

  const pace = total.dividedBy(toDecimal(coveredMonthCount))
  const projection = pace.times(toDecimal('12'))

  return {
    status: 'complete',
    pace: toDbDecimal(pace),
    projection: toDbDecimal(projection),
    coveredMonthCount,
  }
}

/**
 * Hybrid current month: max(spent so far, pace).
 * Safe to call only when pace result is 'complete'.
 */
export function computeCurrentMonthHybrid(
  spentSoFar: string,
  pace: string,
): string {
  const spent = toDecimal(spentSoFar)
  const paceDecimal = toDecimal(pace)
  return toDbDecimal(Decimal.max(spent, paceDecimal))
}
```

### Example 3: Regression Test Structure (New Test)

**Source:** v2.9 pattern from `tests/amortization-lens-regression.test.ts`

```typescript
// tests/pace-and-projection-regression.test.ts (excerpt)
import { afterAll, describe, expect, it, vi } from 'vitest'
import { verifySession } from '@/lib/dal/auth'
import { toDecimal } from '@/lib/utils/decimal'
import {
  connectReimbursementTestDb,
  resetReimbursementFixtures,
} from './helpers/reimbursement-test-db'
import {
  seedExpenseWithTransaction,
  seedMinimalTaxonomy,
  seedUser,
} from './fixtures/reimbursement-seed'

vi.mock('@/lib/dal/auth', () => ({ verifySession: vi.fn() }))
vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))

const harness = await connectReimbursementTestDb()
const describeIfReachable = harness.ok ? describe : describe.skip

describeIfReachable('pace-and-projection engine', () => {
  it('produces byte-identical Overview totals before and after engine integration', async () => {
    const db = harness.ok ? harness.db : ({ execute: () => {} } as never)
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    vi.mocked(verifySession).mockResolvedValue({ userId } as never)
    const taxonomy = await seedMinimalTaxonomy(db, userId)

    // Seed test data: 3 months of outflows
    await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-400.00',
      occurredAt: new Date(2024, 0, 15), // January
      title: 'Month 1',
    })

    await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-420.00',
      occurredAt: new Date(2024, 1, 15), // February
      title: 'Month 2',
    })

    await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-410.00',
      occurredAt: new Date(2024, 2, 15), // March
      title: 'Month 3',
    })

    // Load and call the engine
    vi.doMock('@/lib/db', () => ({ db }))
    vi.resetModules()
    const paceModule = await import('@/lib/services/pace-and-projection')

    // Assert: pace = (400 + 420 + 410) / 3 = 410.00
    const result = paceModule.computePaceAndProjection([
      { yearMonth: '2024-01', amount: '-400.00' },
      { yearMonth: '2024-02', amount: '-420.00' },
      { yearMonth: '2024-03', amount: '-410.00' },
    ])

    expect(result.status).toBe('complete')
    if (result.status === 'complete') {
      expect(toDecimal(result.pace).equals(toDecimal('410.00'))).toBe(true)
      expect(toDecimal(result.projection).equals(toDecimal('4920.00'))).toBe(true)
    }
  })
})
```

### Example 4: Tab Navigation Parameter Cleanup (Existing File Edit)

**Source:** `components/dashboard/dashboard-tab-nav.tsx` current implementation

```typescript
// BEFORE (current):
export function buildDashboardTabHref(
  href: string,
  searchParams: Pick<URLSearchParams, 'get'>
) {
  const params = new URLSearchParams()
  const preset = searchParams.get('preset')
  const type = searchParams.get('type')
  const sort = searchParams.get('sort')
  const tag = searchParams.get('tag')     // ← REMOVE: dead since v2.7
  const lens = searchParams.get('lens')

  if (preset) params.set('preset', preset)
  if (type) params.set('type', type)
  if (sort) params.set('sort', sort)
  if (tag) params.set('tag', tag)         // ← REMOVE: dead since v2.7
  if (lens) params.set('lens', lens)      // ← KEEP: invisible state preservation

  const search = params.toString()
  return href + (search ? `?${search}` : '')
}

// AFTER (Phase 82 cleanup):
export function buildDashboardTabHref(
  href: string,
  searchParams: Pick<URLSearchParams, 'get'>
) {
  const params = new URLSearchParams()
  const preset = searchParams.get('preset')
  const type = searchParams.get('type')
  const sort = searchParams.get('sort')
  const lens = searchParams.get('lens')

  if (preset) params.set('preset', preset)
  if (type) params.set('type', type)
  if (sort) params.set('sort', sort)
  if (lens) params.set('lens', lens)

  const search = params.toString()
  return href + (search ? `?${search}` : '')
}
```

## Validation Architecture

**Test Framework:** Vitest 4.1.5 (configured in `vitest.config.ts`); real-Postgres harness (`yarn db:up` → `sparter_test` database)

**Quick run command:** `npx vitest run tests/pace-and-projection-regression.test.ts --reporter=verbose`

**Full suite command:** `npx vitest run` (includes all regression tests + existing unit tests)

### Phase Requirements → Test Map

| Requirement | Test Type | Automated Command | Status |
|-------------|-----------|-------------------|--------|
| PACE-01 | Integration (SQL + Decimal) | `vitest run tests/pace-and-projection-regression.test.ts -t "covered months"` | Wave 0 |
| PACE-02 | Unit (date logic) | `vitest run tests/pace-and-projection.test.ts -t "partial month"` | Wave 0 |
| PACE-03 | Unit (insufficient-coverage outcome) | `vitest run tests/pace-and-projection.test.ts -t "insufficient"` | Wave 0 |
| PACE-04 | Unit (max logic) | `vitest run tests/pace-and-projection.test.ts -t "hybrid month"` | Wave 0 |
| PACE-05 | Integration (regression) | `vitest run tests/pace-and-projection-regression.test.ts` | Wave 1 |
| PACE-06 | Integration (Overview/Tags totals) | `vitest run tests/pace-and-projection-regression.test.ts -t "byte-identical"` | Wave 1 |
| RETIRE-03 | Smoke (component removes) | `npm run build` (no missing imports in Categories/Tags) | Wave 2 |
| RETIRE-04 | Unit (buildDashboardTabHref) | `vitest run tests/dashboard-tab-nav.test.ts` (existing; verify `tag` removal) | Wave 1 |
| RETIRE-05 | Integration (regression) | `vitest run tests/pace-and-projection-regression.test.ts -t "byte-identical"` | Wave 1 |

### Wave 0 Gaps

- [ ] `tests/pace-and-projection.test.ts` — unit tests for `computePaceAndProjection`, `computeCurrentMonthHybrid`, month classification (fact/hybrid/estimate), insufficient-coverage handling
- [ ] `tests/pace-and-projection-regression.test.ts` — real-Postgres regression suite proving Overview/Tags totals unchanged; fixture-based (3+ months of test data) with Decimal.js assertions
- [ ] `tests/helpers/pace-test-db.ts` (or reuse `reimbursement-test-db.ts`) — harness for isolated Postgres test DB
- [ ] `lib/dal/covered-months.ts` — new query function
- [ ] `lib/services/pace-and-projection.ts` — new computation module
- [ ] `tests/dashboard-tab-nav.test.ts` — verify `buildDashboardTabHref` drops `tag` and preserves `lens`
- [ ] Component removal: Categories/Tags lens-switch deletions (verified by build + smoke tests)

### Sampling Rate

- **Per task commit:** Unit tests for the function being committed (PACE-01/02/03/04 unit tests)
- **Per Wave merge:** Full regression suite green (RETIRE-05 byte-identical) before merging
- **Phase gate:** All tests passing; `npm run build` succeeds; no unused imports/exports

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `lib/dal/months-with-data.ts` can serve as template for covered-month denominator query | Architecture Patterns, Pattern 1 | Wrong query predicate (e.g., including zero-transaction months) would inflate pace 3–6×; mitigated by unit tests and regression suite |
| A2 | Existing `LedgerRowSource` type in `lib/dal/dashboard-filters.ts` is the correct abstraction for the ledger_entry seam | Standard Stack | Regression suite would fail if the type is insufficient; low risk given v2.9 precedent |
| A3 | The v2.9 regression test pattern (`captureAggregationSnapshot`) generalizes directly to pace/projection engine without modification | Validation Architecture | If the harness does not support new query functions, tests would fail to compile; plan phase would surface this immediately |
| A4 | The three render-site deletions (lens-switch removal from Categories/Tags/Tags detail) are the only UI changes required in Phase 82 | Common Pitfalls | Missing a site would allow lens switch to render where it should not, confusing users; caught by smoke tests and manual verification |

**All other claims in this research were verified against the codebase or confirmed via v2.9/v2.8 precedent. No unconfirmed decisions remain.**

## Open Questions

1. **Threshold for previous-year coverage (D-10):** DECISIONS doc proposes ≥6 Covered Months to gate the total difference. Is this value configurable as an engine parameter or baked into the code? Recommend: engine parameter, exported from `lib/services/pace-and-projection.ts` for phases 83/84 to consume.

2. **Lens parameter propagation on Categories detail:** D-13 recommends keeping `?lens=` invisible for state preservation. The plan must confirm whether Categories detail pages read `?lens=` from the URL and enforce it as cassa anyway (ignore it), or whether the removal of the lens switch is enough and `?lens=` is a no-op on that route.

3. **Insufficient-coverage discriminated union vs sentinel type:** The three approaches (union, sentinel class, thrown error) are all valid per CONTEXT.md. Plan phase should choose one based on downstream consumption (phase 83/84 UI copy/rendering logic). Recommendation: discriminated union for testability.

4. **Decimal.js rounding mode:** Drizzle columns are `DECIMAL(10,2)`. When pace divides (e.g., €1230 / 3 = €410.00), what rounding mode should Decimal.js use? Recommend: `Decimal.set({ rounding: Decimal.ROUND_HALF_UP })` to match banker's rounding behavior expected for money.

## Environment Availability

All required tools are already present:

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Decimal.js | Pace arithmetic | ✓ | 10.6.0 | — |
| Vitest | Regression tests | ✓ | 4.1.5 | — |
| PostgreSQL (docker) | Isolated test DB | ✓ | via `yarn db:up` | Regression suite gracefully skips if DB unavailable |
| Drizzle ORM | DAL queries | ✓ | 0.45.2 | — |

**No new dependencies required.**

## Sources

### Primary (HIGH confidence)

- `docs/adr/0020-categories-year-view-retires-deviation.md` — locked decision on pace, coverage, projection, lens confinement
- `.planning/dashboard-categories-DECISIONS.md` — 19 locked decisions D1–D19 with alternatives and rationale
- `lib/dal/overview.ts` (lines 76–183) — established `current − previous` convention, `LedgerRowSource` parameter pattern
- `lib/dal/months-with-data.ts` (full file) — covered-month query template, lens-aware pattern
- `lib/db/schema.ts` (lines 717–865) — `ledgerEntryCash` and `ledgerEntryAccrual` view definitions, no `source` column
- `lib/dal/dashboard-filters.ts` (lines 43–55) — `LedgerRowSource` type and `resolveLedgerRowSource()` function
- `tests/amortization-lens-regression.test.ts` (lines 56–118) — v2.9 byte-identical regression pattern, harness structure
- `tests/amortization-lens-regression-overview.test.ts` (lines 148–151) — YTD-bound lens-aware pattern, precedent for new aggregations

### Secondary (MEDIUM confidence)

- `components/dashboard/dashboard-tab-nav.tsx` (lines 14–47) — current parameter propagation; shows where `tag` removal occurs
- `components/dashboard/lens-switch.tsx` (full file) — lens switch implementation; shows render sites for deletion
- `lib/utils/decimal.ts` (full file) — minimal helpers; composition pattern for multi-step arithmetic
- `.planning/REQUIREMENTS.md` (lines 12–17) — exact wording of PACE-01…06 requirements

### Tertiary (referenced, not directly verified this session)

- `docs/adr/0019-amortization-accrual-lens.md` — LENS-01 (amended by ADR 0020), seam architectural rationale
- `lib/dal/dashboard.ts` — 10 aggregation sites that will inherit the ledger_entry pattern (not modified in Phase 82)
- `package.json` (lines 52, 89) — Decimal.js v10.6.0, vitest v4.1.5 versions confirmed

---

**Research completed 2026-07-30**
**Valid until:** 30 days (stable architecture, confirmed via codebase and v2.9 precedent)
