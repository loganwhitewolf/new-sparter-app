# Phase 82: number-engine-and-regression-gate - Pattern Map

**Mapped:** 2026-07-30
**Files analyzed:** 13 (5 new, 8 modified)
**Analogs found:** 13 / 13

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/dal/covered-months.ts` | DAL query | CRUD | `lib/dal/months-with-data.ts` | exact (same role, pattern) |
| `lib/services/pace-and-projection.ts` | service | CRUD / transform | `lib/services/amortization-math.ts` | role-match (business logic) |
| `tests/pace-and-projection.test.ts` | unit test | testing | `tests/amortization-math.test.ts` | role-match (unit tests) |
| `tests/pace-engine-lens-regression.test.ts` | regression test | testing | `tests/amortization-lens-regression.test.ts` | exact (byte-identical gate pattern) |
| `tests/lens-switch-placement.test.tsx` | component test | testing | `tests/lens-persistence.test.tsx` | role-match (component test) |
| `components/dashboard/dashboard-tab-nav.tsx` | component | request-response | (modified in place) | self |
| `tests/dashboard-filters.test.ts` | unit test | testing | (modified in place) | self |
| `components/dashboard/lens-switch.tsx` | component | request-response | (modified in place — removal only) | self |
| `app/(app)/dashboard/categories/page.tsx` | page | request-response | (modified in place — deletion) | self |
| `app/(app)/dashboard/categories/[id]/page.tsx` | page | request-response | (modified in place — deletion) | self |
| `app/(app)/dashboard/tags/page.tsx` | page | request-response | (verified: no lens-switch present) | N/A |
| `components/dashboard/lens-persistence.ts` | utility | state management | (modified if participation confirmed — see below) | self |
| `lib/dal/dashboard.ts` | DAL query | CRUD | (modified in place — engine integration) | self |

---

## Pattern Assignments

### `lib/dal/covered-months.ts` (DAL, CRUD)

**Analog:** `lib/dal/months-with-data.ts` (exact match — same role, same data flow, same user scoping pattern)

**Imports pattern** (lines 1–6):
```typescript
import 'server-only'
import { cache } from 'react'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/dal/auth'
import type { Lens } from '@/lib/utils/search-params'
```

**Query pattern & type definition** (lines 8–60, excerpted):
```typescript
/**
 * Returns the distinct calendar months (YYYY-MM, DESC) that contain data for
 * the signed-in user in the given table.
 */
export const getMonthsWithData = cache(
  async (table: 'transactions' | 'files', lens: Lens = 'cassa'): Promise<string[]> => {
    const { userId } = await verifySession()

    if (table === 'transactions') {
      if (lens === 'competenza') {
        const result = await db.execute(sql`
          SELECT DISTINCT TO_CHAR(occurred_at, 'YYYY-MM') AS ym
          FROM (
            SELECT occurred_at FROM transaction WHERE user_id = ${userId}
            UNION ALL
            SELECT occurred_at FROM amortization_instalment WHERE user_id = ${userId}
          ) combined
          ORDER BY ym DESC
        `)
        const rows = result.rows as { ym: string }[]
        return rows.map((row) => row.ym)
      }

      const result = await db.execute(sql`
        SELECT DISTINCT TO_CHAR(occurred_at, 'YYYY-MM') AS ym
        FROM transaction
        WHERE user_id = ${userId}
        ORDER BY ym DESC
      `)
      const rows = result.rows as { ym: string }[]
      return rows.map((row) => row.ym)
    }
    // ... file branch
  }
)
```

**Copy pattern for `getCoveredMonthsInYear`:** Same structure, but:
- Filter to a given year: `WHERE user_id = ${userId} AND EXTRACT(YEAR FROM occurred_at)::integer = ${year}`
- Return richer type: `{ yearMonth: string; from: Date; to: Date }` (include date range for denominator)
- Use `MIN()` and `MAX()` to compute month boundaries within the GROUP BY (following D-01: covered month = any transaction in that month)

---

### `lib/services/pace-and-projection.ts` (service, CRUD/transform)

**Analog:** `lib/services/amortization-math.ts` (role-match: business logic transformation, Decimal.js arithmetic)

**Imports pattern** (from RESEARCH.md Example 2):
```typescript
import 'server-only'
import Decimal from 'decimal.js'
import { toDecimal, toDbDecimal } from '@/lib/utils/decimal'
```

**Core transformation pattern** (Decimal composition chain, derived from amortization-math and v2.9 regression tests):
```typescript
// From tests/amortization-lens-regression.test.ts, lines 103–105
const expectedAccrualTotal = instalments
  .filter((i) => i.date >= dateRange.from && i.date <= dateRange.to)
  .reduce((sum, i) => sum.plus(toDecimal(i.amount).abs()), toDecimal('0'))

// Pattern for pace engine (from RESEARCH.md Example 2):
const coveredCount = toDecimal(coveredMonths.length)
const yearTotal = coveredMonths.reduce(
  (sum, m) => sum.plus(toDecimal(m.categoryTotal)),
  toDecimal('0'),
)
const pace = total.dividedBy(toDecimal(coveredMonthCount))
const projection = pace.times(toDecimal('12'))
```

**Insufficient-coverage outcome pattern** (D-05 requirement):
- Use discriminated union: `{ status: 'complete'; pace: Decimal } | { status: 'insufficient'; coveredMonthCount: number }`
- Return immediately if `coveredMonthCount < 2`, never allow silent `null` coercion

**Error handling:** All aggregations in `lib/services/` return explicit types; no thrown errors inside computation logic.

---

### `tests/pace-and-projection.test.ts` (unit test)

**Analog:** `tests/amortization-math.test.ts` (role-match: unit tests for business logic, Decimal assertions)

**Pattern:** Standard vitest unit test structure, using `describe`, `it`, `expect`. No mock/harness required (pure functions). Decimal assertions use `.equals()` method, never `===` or `toBeCloseTo()`.

**Coverage areas:**
- D-01/D-02: Covered month classification (month with ≥1 transaction counts; zero-transaction month is excluded)
- D-03: Partial month (current calendar month) exclusion
- D-04/D-05: Insufficient-coverage outcome (< 2 Covered Months returns explicit sentinel, never null)
- D-06: Hybrid current month (`max(spent so far, pace)`)
- D-07: Total = sum of monthly series verification
- D-08/D-09: `current − previous` sign convention + per-direction judgement function

---

### `tests/pace-engine-lens-regression.test.ts` (regression test, real-Postgres)

**Analog:** `tests/amortization-lens-regression.test.ts` (exact match — byte-identical regression gate pattern, v2.9 precedent)

**Harness setup** (lines 1–54 from `amortization-lens-regression.test.ts`):
```typescript
import { afterAll, describe, expect, it, vi } from 'vitest'
import { verifySession } from '@/lib/dal/auth'
import { toDecimal } from '@/lib/utils/decimal'
import {
  captureAggregationSnapshot,
  connectReimbursementTestDb,
  resetReimbursementFixtures,
  type ReimbursementTestDb,
} from './helpers/reimbursement-test-db'
import {
  seedAmortizationPlan,
  seedExpenseWithTransaction,
  seedMinimalTaxonomy,
  seedTag,
  seedUser,
} from './fixtures/reimbursement-seed'

vi.mock('@/lib/dal/auth', () => ({ verifySession: vi.fn() }))
vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))

const harness = await connectReimbursementTestDb()

if (!harness.ok) {
  console.warn('[pace-engine-regression] Local Postgres unreachable — run `yarn db:up` to enable this suite. Skipping.')
}

const describeIfReachable = harness.ok ? describe : describe.skip

function requireHarnessDb(): ReimbursementTestDb {
  if (!harness.ok) {
    throw new Error('pace-engine-regression: harness unreachable — this must be unreachable when skipped')
  }
  return harness.db
}

afterAll(async () => {
  if (harness.ok) {
    await harness.pool.end()
  }
})
```

**`captureAggregationSnapshot()` signature** (lines 222–246 from `reimbursement-test-db.ts`):
```typescript
export type CaptureAggregationSnapshotInput = {
  harnessDb: ReimbursementTestDb
  userId: string
  dateRange: { from: Date; to: Date }
  categoryId: number
  tagId: number
  ledgerRowSource?: LedgerRowSource  // Phase 80: optional lens row source
}

export async function captureAggregationSnapshot(
  input: CaptureAggregationSnapshotInput,
): Promise<AggregationSnapshot> {
  const { harnessDb, userId, dateRange, categoryId, tagId, ledgerRowSource } = input
  
  // CRITICAL: inject harness's guarded db client, never let functions build from ambient env
  vi.doMock('@/lib/db', () => ({ db: harnessDb }))
  vi.doUnmock('@/lib/dal/transaction-pairs-sql')
  vi.resetModules()

  const dashboardModule = await import('@/lib/dal/dashboard')
  const overviewModule = await import('@/lib/dal/overview')
  const tagsModule = await import('@/lib/dal/tags')
  
  // Call 10 aggregation functions in parallel, capturing their return values
  const [
    overviewAmountTotals,
    categoriesBreakdown,
    categoryRanking,
    // ... remaining functions
  ] = await Promise.all([
    dashboardModule.getOverviewAmountTotals(userId, dateRange.from, dateRange.to, ledgerRowSource),
    dashboardModule.getCategoriesBreakdown(filters),
    dashboardModule.getCategoryRanking(filters),
    // ... remaining calls
  ])

  return {
    getOverviewAmountTotals: overviewAmountTotals,
    // ... remaining properties
  }
}
```

**Test pattern** (lines 56–117 from `amortization-lens-regression.test.ts`):
```typescript
describeIfReachable('pace-and-projection engine', () => {
  it('produces byte-identical Overview totals before and after engine integration', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    vi.mocked(verifySession).mockResolvedValue({ userId } as never)
    const taxonomy = await seedMinimalTaxonomy(db, userId)

    // Seed test data: 3 months of outflows
    await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-400.00',
      occurredAt: new Date(2024, 0, 15),
      title: 'Month 1',
    })
    
    // ... seed remaining months ...

    // Capture pre-engine baseline
    const baselineSnapshot = await captureAggregationSnapshot({
      harnessDb: db,
      userId,
      dateRange,
      categoryId: taxonomy.essentialCategoryId,
      tagId,
      ledgerRowSource: undefined,  // defaults to cash
    })
    const baselineTotals = baselineSnapshot.getOverviewAmountTotals as { totalOut: string }

    // After engine change: same query must return identical amount
    expect(toDecimal(baselineTotals.totalOut).equals(toDecimal('1230.00'))).toBe(true)
  })
})
```

**Key pattern (D-15, D-16):** The regression captures `getOverviewAmountTotals` and `getTagTotals` totals **before** the engine lands, then re-asserts them **after** to prove byte-identical. Must be re-runnable when Phase 83's predicate flips from `direction.includedInTotals` to `direction.hidden` (the harness does not change, only the predicate inside dashboard.ts).

---

### `tests/lens-switch-placement.test.tsx` (component test)

**Analog:** `tests/lens-persistence.test.tsx` or similar component test pattern

**Pattern:** Component-level vitest test using `@testing-library/react` or equivalent shallow render. Asserts:
- LensSwitch renders on Overview page
- LensSwitch does NOT render on Categories page
- LensSwitch does NOT render on Tags page

```typescript
import { render, screen } from '@testing-library/react'
import { LensSwitch } from '@/components/dashboard/lens-switch'

describe('LensSwitch placement (D-12, RETIRE-03)', () => {
  it('renders only on Overview, not on Categories or Tags', () => {
    // Render LensSwitch component
    const { rerender } = render(<LensSwitch lens="cassa" />)
    
    // Should be present (Overview context)
    expect(screen.getByRole('button')).toBeInTheDocument()
    
    // When mounted in Categories/Tags context (conditionally), should not render
    // This test verifies the conditional `{hasPlans && <LensSwitch />}` pattern
  })
})
```

---

## Shared Patterns

### Ledger Entry Seam (ADR 0019 §10, Inherited by Engine)

**Source:** `lib/dal/dashboard-filters.ts` (lines 43–55)

```typescript
// ledger_entry seam row-source selection (Phase 80, ADR 0019 §10)
export type LedgerRowSource = typeof ledgerEntryCash | typeof ledgerEntryAccrual

/**
 * Resolves a validated `Lens` to its backing row source. Reference-equal to `ledgerEntryCash`
 * for `'cassa'` (the default), `ledgerEntryAccrual` for `'competenza'`.
 */
export function resolveLedgerRowSource(lens: Lens): LedgerRowSource {
  return lens === 'competenza' ? ledgerEntryAccrual : ledgerEntryCash
}
```

**Apply to:** All engine aggregation functions. Pattern inherited from Overview (line 132 in `lib/dal/overview.ts`):
```typescript
export const getOverview = cache(async (
  year: number,
  ledgerRowSource: LedgerRowSource = ledgerEntryCash,
): Promise<OverviewData> => {
  // ...
})
```

**Critical rule:** Never thread `lens` as a parameter through aggregation WHERE/AMOUNT logic. The view swap (ledgerEntryCash ↔ ledgerEntryAccrual) happens once at the function signature; all internal SQL references to `ledgerRowSource.amount` read from the correct view.

---

### Decimal.js Arithmetic (D-11)

**Source:** `lib/utils/decimal.ts` (full file)

```typescript
import Decimal from 'decimal.js'

/**
 * Parse a DB DECIMAL string or JS number to a Decimal instance.
 * Use this whenever reading an amount from the database (Drizzle returns DECIMAL as string).
 */
export function toDecimal(value: string | number): Decimal {
  return new Decimal(value)
}

/**
 * Convert a Decimal to a string suitable for DB insertion into a DECIMAL(10,2) column.
 * Never insert raw JS numbers — always use toDbDecimal() before writing amounts.
 */
export function toDbDecimal(value: Decimal): string {
  return value.toFixed(2)
}
```

**Apply to:** All pace/projection arithmetic in `lib/services/pace-and-projection.ts`. Pattern from `lib/dal/dashboard.ts` line 462 (reading DECIMAL from Drizzle):

```typescript
// Example: getOverviewAmountTotals reads SQL DECIMAL columns as strings via sql<string>
export async function getOverviewAmountTotals(
  userId: string,
  from: Date,
  to: Date,
  ledgerRowSource: LedgerRowSource = ledgerEntryCash,
): Promise<OverviewAggregateRow> {
  try {
    const rows = await db
      .select({
        totalIn: sql<string>`coalesce(sum(case when ${direction.code} = 'in' then ${ledgerRowSource.amount} else 0 end), 0)::text`,
        totalOut: sql<string>`coalesce(abs(sum(case when ${direction.code} = 'out' then ${ledgerRowSource.amount} else 0 end)), 0)::text`,
        // ... more amounts ...
      })
      .from(ledgerRowSource)
      // ... joins and where ...
    return rows[0] ?? { totalIn: '0.00', totalOut: '0.00', /* ... */ }
  } catch {
    return { totalIn: '0.00', totalOut: '0.00', /* ... */ }
  }
}
```

**Key:** SQL casts amounts to `::text` so Drizzle returns `string`, never `number`. Pass directly to `toDecimal()`.

---

### Tab Navigation Parameter Propagation (D-13, D-14)

**Source:** `components/dashboard/dashboard-tab-nav.tsx` (lines 14–47)

**Current (pre-Phase-82):**
```typescript
export function buildDashboardTabHref(
  href: string,
  searchParams: Pick<URLSearchParams, 'get'>
) {
  const params = new URLSearchParams()
  const preset = searchParams.get('preset')
  const type = searchParams.get('type')
  const sort = searchParams.get('sort')
  const tag = searchParams.get('tag')      // ← REMOVE: dead since v2.7
  const lens = searchParams.get('lens')

  if (preset) params.set('preset', preset)
  if (type) params.set('type', type)
  if (sort) params.set('sort', sort)
  if (tag) params.set('tag', tag)          // ← REMOVE: dead since v2.7
  if (lens) params.set('lens', lens)       // ← KEEP: invisible state preservation (D-13)

  const search = params.toString()
  return href + (search ? `?${search}` : '')
}
```

**Phase 82 change (D-14):** Remove the two lines that read/propagate `tag`. Keep `lens` invisible propagation.

**After (Phase 82):**
```typescript
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

**Existing test coverage:** `tests/dashboard-filters.test.ts` already exercises this function with a `tag=5` case (per RESEARCH.md). Phase 82 extends that test to verify `tag` is no longer propagated while `lens` is preserved.

---

### Lens Switch Render Site Deletions (D-12, RETIRE-03)

**Source:** `components/dashboard/lens-switch.tsx` (component, lines 41–97)

**Render sites (current):**
1. `app/(app)/dashboard/categories/page.tsx` — conditional render: `{hasPlans && <LensSwitch lens={lens} />}`
2. `app/(app)/dashboard/categories/[id]/page.tsx` — conditional render: `{hasPlans && <LensSwitch lens={lens} />}`
3. `app/(app)/dashboard/tags/page.tsx` — **verification shows no lens control present**, no deletion needed

**Phase 82 change:** Delete the two conditional LensSwitch render statements from categories pages. Categories always reads `cassa` (cash lens), so the lens switch is misleading.

**Verification:** Build must succeed with no missing imports after deletion. The component itself (`lens-switch.tsx`) is left untouched; only its call sites are removed.

---

## No Analog Found

None. All files have clear analogs in the established codebase (v2.8 reimbursement/v2.9 amortization lens patterns, existing test harness, DAL query conventions).

---

## Metadata

**Analog search scope:** 
- `lib/dal/` — month query functions, dashboard aggregations, lens seam implementation
- `lib/services/` — business logic transformation (amortization-math)
- `tests/` — regression harness (amortization-lens-regression), unit test patterns, fixtures
- `components/dashboard/` — lens-switch component, tab navigation, persistence utilities

**Files scanned:** 15 (codebase reads + RESEARCH provided)

**Pattern extraction date:** 2026-07-30

**Architecture locked:** 
- `dal/` for queries, `services/` for computation, `actions/` for Server Action wrappers (D-11)
- Ledger entry seam (ADR 0019 §10) with `LedgerRowSource` type, no `lens` parameter threading
- Decimal.js only, no native JS arithmetic on amounts (CLAUDE.md)
- React `cache()` for DAL functions, vitest for tests, real-Postgres harness for regression gates (v2.9 precedent)

---

*Pattern mapping complete. Ready for planning.*
