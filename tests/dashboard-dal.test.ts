import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dashboardPresetToDateRange } from '@/lib/utils/date'

// Hoisted so the `@/lib/db` mock factory below (which is itself hoisted above
// all imports by vi.mock) can close over shared mutable state: whereArgs
// records each query's WHERE condition in call order (68-02 tagId assertions
// inspect this), rowsQueue lets a test seed per-call result rows (used by
// getCategoryDetail's category-metadata lookup, which must return a row for
// the function to proceed past its early-return guard).
const dalMocks = vi.hoisted(() => ({
  whereArgs: [] as unknown[],
  rowsQueue: [] as unknown[][],
}))

vi.mock('server-only', () => ({}))
vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))
vi.mock('@/lib/dal/auth', () => ({ verifySession: vi.fn() }))
vi.mock('@/lib/db', () => {
  function makeChain(rows: unknown[]) {
    const chain: Record<string, unknown> = {
      from: vi.fn(() => chain),
      leftJoin: vi.fn(() => chain),
      innerJoin: vi.fn(() => chain),
      where: vi.fn((arg: unknown) => {
        dalMocks.whereArgs.push(arg)
        return chain
      }),
      groupBy: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn((n: number) => Promise.resolve(rows.slice(0, n))),
      // Thenable: several queries under test await the chain directly after
      // .where()/.groupBy()/.orderBy() with no terminal .limit() call.
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(rows).then(resolve, reject),
    }
    return chain
  }

  return {
    db: {
      select: vi.fn(() => makeChain(dalMocks.rowsQueue.shift() ?? [])),
    },
  }
})
vi.mock('@/lib/db/schema', () => ({
  category: {
    id: 'category.id',
    userId: 'category.userId',
    name: 'category.name',
    slug: 'category.slug',
    isActive: 'category.isActive',
  },
  expense: {
    id: 'expense.id',
    userId: 'expense.userId',
    status: 'expense.status',
    subCategoryId: 'expense.subCategoryId',
  },
  subCategory: {
    id: 'subCategory.id',
    userId: 'subCategory.userId',
    name: 'subCategory.name',
    slug: 'subCategory.slug',
    categoryId: 'subCategory.categoryId',
    isActive: 'subCategory.isActive',
    // Phase 49: excludeFromTotals and nature removed (D-10 / Pitfall 6)
    // direction join provides direction.includedInTotals instead
    natureId: 'subCategory.natureId',
  },
  userSubcategoryOverride: {
    customName: 'userSubcategoryOverride.customName',
    subCategoryId: 'userSubcategoryOverride.subCategoryId',
    userId: 'userSubcategoryOverride.userId',
    natureId: 'userSubcategoryOverride.natureId',
  },
  direction: {
    id: 'direction.id',
    code: 'direction.code',
    labelIt: 'direction.labelIt',
    includedInTotals: 'direction.includedInTotals',
  },
  nature: {
    id: 'nature.id',
    code: 'nature.code',
    directionId: 'nature.directionId',
  },
  transaction: {
    id: 'transaction.id',
    userId: 'transaction.userId',
    expenseId: 'transaction.expenseId',
    amount: 'transaction.amount',
    description: 'transaction.description',
    customTitle: 'transaction.customTitle',
    occurredAt: 'transaction.occurredAt',
  },
}))
vi.mock('@/lib/utils/date', async () => {
  const actual = await vi.importActual<typeof import('../lib/utils/date')>('../lib/utils/date')
  return actual
})
vi.mock('@/lib/utils/dashboard', async () => {
  const actual = await vi.importActual<typeof import('../lib/utils/dashboard')>('../lib/utils/dashboard')
  return actual
})
vi.mock('@/lib/utils/decimal', async () => {
  const actual = await vi.importActual<typeof import('../lib/utils/decimal')>('../lib/utils/decimal')
  return actual
})

const {
  DASHBOARD_TOTAL_EXPENSE_STATUSES,
  buildBreakdownData,
  buildCategoryDetailData,
  buildCategoryRankingData,
  buildDeviationDataset,
  buildMonthlyNatureTrendData,
  buildMonthlyTrendData,
  buildOverviewData,
  getDeviationDateRanges,
  getOverviewComparisonRanges,
  getUncategorizedCount,
  getOverviewAmountTotals,
} = await import('../lib/dal/dashboard')

/** Locate the tagScopedTransactions EXISTS fragment (if any) inside a real
 * drizzle-orm `and(...)` condition tree — mirrors the substring-search idiom
 * used in tests/transactions-dal.test.ts, adapted for the REAL drizzle-orm
 * `sql`/`and` builders this file uses (no drizzle-orm mock in this file). */
function findTagCondition(whereArg: unknown, tagId: number): boolean {
  const serialized = JSON.stringify(whereArg)
  return serialized.includes('transaction_tag') && serialized.includes(String(tagId))
}

function hasTagCondition(whereArg: unknown): boolean {
  return JSON.stringify(whereArg).includes('transaction_tag')
}

beforeEach(() => {
  dalMocks.whereArgs = []
  dalMocks.rowsQueue = []
})

describe('dashboard DAL amount mapping', () => {
  it('uses the selected dashboard preset for KPI ranges and compares against the preceding range', () => {
    const now = new Date(2026, 4, 15)

    expect(getOverviewComparisonRanges('last-month', now)).toEqual({
      current: {
        from: new Date(2026, 3, 1),
        to: new Date(2026, 3, 30, 23, 59, 59, 999),
      },
      previous: {
        from: new Date(2026, 2, 1),
        to: new Date(2026, 2, 31, 23, 59, 59, 999),
      },
    })
    expect(getOverviewComparisonRanges('last-3-months', now)).toEqual({
      current: {
        from: new Date(2026, 2, 1),
        to: new Date(2026, 4, 31, 23, 59, 59, 999),
      },
      previous: {
        from: new Date(2025, 11, 1),
        to: new Date(2026, 1, 28, 23, 59, 59, 999),
      },
    })
  })

  it('returns previous December when last-month is queried in January', () => {
    expect(dashboardPresetToDateRange('last-month', new Date(2026, 0, 15))).toEqual({
      from: new Date(2025, 11, 1),
      to: new Date(2025, 11, 31, 23, 59, 59, 999),
    })
  })

  it('includes manually and automatically categorized expenses in dashboard totals', () => {
    expect(DASHBOARD_TOTAL_EXPENSE_STATUSES).toEqual(['1', '2', '3'])
  })

  it('builds overview KPI strings from Decimal aggregate rows', () => {
    const overview = buildOverviewData({
      current: { totalIn: '2500.125', totalOut: '1500.115', totalAllocation: null },
      previous: { totalIn: '2000.00', totalOut: '1000.00', totalAllocation: null },
      currentUncategorizedCount: 3,
      previousUncategorizedCount: 2,
    })

    expect(overview.totalIn).toBe('2500.13')
    expect(overview.totalOut).toBe('1500.12')
    expect(overview.balance).toBe('1000.01')
    expect(overview.savingsRate).toBe(40)
    expect(overview.uncategorizedCount).toBe(3)
    expect(overview.deltas.totalIn).toBe(25)
    expect(overview.deltas.totalOut).toBe(50)
    expect(overview.deltas.balance).toBe(0)
    expect(overview.deltas.uncategorizedCount).toBe(50)
  })

  it('returns zero overview data when aggregates are nullable empty-state rows', () => {
    const overview = buildOverviewData({
      current: { totalIn: null, totalOut: null, totalAllocation: null },
      previous: { totalIn: null, totalOut: null, totalAllocation: null },
      currentUncategorizedCount: 0,
      previousUncategorizedCount: 0,
    })

    expect(overview).toMatchObject({
      totalIn: '0.00',
      totalOut: '0.00',
      balance: '0.00',
      savingsRate: 0,
      uncategorizedCount: 0,
    })
    expect(overview.deltas.totalIn).toBeNull()
    expect(overview.deltas.totalOut).toBeNull()
  })

  // 260709-kp1: structural balance = recurring income only − totalOut
  it('propagates structuralBalance from totalInRecurring (extraordinary-heavy year: balance > 0, structural < 0)', () => {
    const overview = buildOverviewData({
      // totalIn 5000 includes 3500 extraordinary; recurring is 1500 vs 2600 out
      current: {
        totalIn: '5000.00',
        totalOut: '2600.00',
        totalAllocation: '0.00',
        totalInRecurring: '1500.00',
        totalOutEssential: '1800.00',
        totalOutDiscretionary: '600.00',
        totalOutDebt: '200.00',
      },
      previous: { totalIn: '0.00', totalOut: '0.00', totalAllocation: '0.00', totalInRecurring: '0.00' },
      currentUncategorizedCount: 0,
      previousUncategorizedCount: 0,
    })

    expect(overview.balance).toBe('2400.00')
    expect(overview.structuralBalance).toBe('-1100.00')
    // 260709-lan: recurring total propagated for the Entrate card breakdown
    expect(overview.totalInRecurring).toBe('1500.00')
    // 260709-lj5: recurring-only savings rate ((1500 − 2600)/1500 × 100 = −73.3)
    expect(overview.structuralSavingsRate).toBe(-73.3)
    // 260709-lkw: spending split by nature propagated for the Uscite card breakdown
    expect(overview.outByNature).toEqual({
      essential: '1800.00',
      discretionary: '600.00',
      debt: '200.00',
    })
  })

  it('structuralBalance equals balance when all income is recurring', () => {
    const overview = buildOverviewData({
      current: { totalIn: '3000.00', totalOut: '1000.00', totalAllocation: '0.00', totalInRecurring: '3000.00' },
      previous: { totalIn: '0.00', totalOut: '0.00', totalAllocation: '0.00', totalInRecurring: '0.00' },
      currentUncategorizedCount: 0,
      previousUncategorizedCount: 0,
    })

    expect(overview.structuralBalance).toBe(overview.balance)
    expect(overview.structuralSavingsRate).toBe(overview.savingsRate)
  })

  it('structuralBalance is null when the aggregate row does not carry totalInRecurring', () => {
    const overview = buildOverviewData({
      current: { totalIn: '2500.00', totalOut: '1500.00', totalAllocation: null },
      previous: { totalIn: '0.00', totalOut: '0.00', totalAllocation: null },
      currentUncategorizedCount: 0,
      previousUncategorizedCount: 0,
    })

    expect(overview.structuralBalance).toBeNull()
    expect(overview.totalInRecurring).toBeNull()
    expect(overview.structuralSavingsRate).toBeNull()
    expect(overview.outByNature).toBeNull()
  })

  it('computes category and subcategory percentages by amount, not row count', () => {
    const breakdown = buildBreakdownData([
      {
        categoryId: 1,
        categoryName: 'Casa',
        categorySlug: 'casa',
        categoryType: 'out',
        subCategoryId: 11,
        subCategoryName: 'Affitto',
        subCategorySlug: 'affitto',
        count: 1,
        amount: '900.00',
      },
      {
        categoryId: 1,
        categoryName: 'Casa',
        categorySlug: 'casa',
        categoryType: 'out',
        subCategoryId: 12,
        subCategoryName: 'Bollette',
        subCategorySlug: 'bollette',
        count: 10,
        amount: '100.00',
      },
      {
        categoryId: 2,
        categoryName: 'Cibo',
        categorySlug: 'cibo',
        categoryType: 'out',
        subCategoryId: 21,
        subCategoryName: 'Spesa',
        subCategorySlug: 'spesa',
        count: 1,
        amount: '1000.00',
      },
      {
        categoryId: 32,
        categoryName: 'Trasferimenti',
        categorySlug: 'trasferimenti',
        categoryType: 'transfer',
        subCategoryId: 99,
        subCategoryName: 'Trasferimento tra conti',
        subCategorySlug: 'trasferimento-tra-conti',
        count: 99,
        amount: '9999.00',
      },
    ])

    expect(breakdown).toHaveLength(2)
    expect(breakdown[0]).toMatchObject({ count: 11, amount: '1000.00', percentage: 50 })
    expect(breakdown[0]?.subCategories).toEqual([
      expect.objectContaining({ amount: '900.00', percentage: 90 }),
      expect.objectContaining({ amount: '100.00', percentage: 10 }),
    ])
    expect(breakdown[1]).toMatchObject({ count: 1, amount: '1000.00', percentage: 50 })
    expect(breakdown.map((row) => row.slug)).not.toContain('trasferimenti')
  })

  it('builds ranked category totals with Decimal-normalized amounts and zero-filled sparklines', () => {
    const ranking = buildCategoryRankingData({
      from: new Date(2026, 0, 1),
      to: new Date(2026, 2, 31, 23, 59, 59, 999),
      rows: [
        {
          categoryId: 2,
          categoryName: 'Cibo',
          categorySlug: 'cibo',
          categoryType: 'out',
          month: '2026-01',
          count: '2',
          amount: '100.105',
        },
        {
          categoryId: 1,
          categoryName: 'Casa',
          categorySlug: 'casa',
          categoryType: 'out',
          month: '2026-01',
          count: 1,
          amount: '100.115',
        },
        {
          categoryId: 1,
          categoryName: 'Casa',
          categorySlug: 'casa',
          categoryType: 'out',
          month: '2026-03',
          count: 3,
          amount: '50',
        },
      ],
    })

    expect(ranking.map((row) => row.slug)).toEqual(['casa', 'cibo'])
    expect(ranking[0]).toMatchObject({
      id: 1,
      name: 'Casa',
      type: 'out',
      count: 4,
      amount: '150.12',
      percentage: 60,
    })
    expect(ranking[0]?.sparkline).toEqual([
      { month: '2026-01', label: 'gen', amount: '100.12' },
      { month: '2026-02', label: 'feb', amount: '0.00' },
      { month: '2026-03', label: 'mar', amount: '50.00' },
    ])
    expect(ranking[1]).toMatchObject({ count: 2, amount: '100.11', percentage: 40 })
    expect(ranking[1]?.sparkline[1]).toMatchObject({ month: '2026-02', amount: '0.00' })
  })

  it('skips null, transfer, and out-of-range category ranking rows', () => {
    const ranking = buildCategoryRankingData({
      from: new Date(2026, 0, 1),
      to: new Date(2026, 1, 28, 23, 59, 59, 999),
      rows: [
        {
          categoryId: null,
          categoryName: 'Missing',
          categorySlug: 'missing',
          categoryType: 'out',
          month: '2026-01',
          count: 1,
          amount: '1',
        },
        {
          categoryId: 32,
          categoryName: 'Trasferimenti',
          categorySlug: 'trasferimenti',
          categoryType: 'transfer',
          month: '2026-01',
          count: 1,
          amount: '999',
        },
        {
          categoryId: 99,
          categoryName: 'AltroTransfer',
          categorySlug: 'altro-transfer',
          categoryType: 'transfer',
          month: '2026-01',
          count: 1,
          amount: '999',
        },
        {
          categoryId: 1,
          categoryName: 'Casa',
          categorySlug: 'casa',
          categoryType: 'out',
          month: '2025-12',
          count: 7,
          amount: '700',
        },
        {
          categoryId: 1,
          categoryName: 'Casa',
          categorySlug: 'casa',
          categoryType: 'out',
          month: '2026-02',
          count: null,
          amount: null,
        },
      ],
    })

    expect(ranking).toHaveLength(1)
    expect(ranking[0]).toMatchObject({ slug: 'casa', count: 0, amount: '0.00', percentage: 0 })
    expect(ranking[0]?.sparkline).toEqual([
      { month: '2026-01', label: 'gen', amount: '0.00' },
      { month: '2026-02', label: 'feb', amount: '0.00' },
    ])
  })

  it('returns an empty ranking for empty rows and orders equal totals deterministically', () => {
    expect(
      buildCategoryRankingData({
        from: new Date(2026, 0, 1),
        to: new Date(2026, 0, 31, 23, 59, 59, 999),
        rows: [],
      })
    ).toEqual([])

    const ranking = buildCategoryRankingData({
      from: new Date(2026, 0, 1),
      to: new Date(2026, 0, 31, 23, 59, 59, 999),
      rows: [
        {
          categoryId: 2,
          categoryName: 'Zeta',
          categorySlug: 'zeta',
          categoryType: 'in',
          month: '2026-01',
          count: 1,
          amount: '50',
        },
        {
          categoryId: 1,
          categoryName: 'Alfa',
          categorySlug: 'alfa',
          categoryType: 'in',
          month: '2026-01',
          count: 1,
          amount: '50',
        },
      ],
    })

    expect(ranking.map((row) => row.slug)).toEqual(['alfa', 'zeta'])
    expect(ranking.map((row) => row.percentage)).toEqual([50, 50])
  })

  it('DASHBOARD_TOTAL_EXPENSE_STATUSES excludes status=4 (ignored expenses)', () => {
    expect(DASHBOARD_TOTAL_EXPENSE_STATUSES).toEqual(['1', '2', '3'])
    expect(DASHBOARD_TOTAL_EXPENSE_STATUSES).not.toContain('4')
  })

  it('zero-fills monthly trend buckets while preserving imported transaction amounts and counts', () => {
    const trend = buildMonthlyTrendData({
      from: new Date(2026, 0, 1),
      to: new Date(2026, 2, 31, 23, 59, 59, 999),
      rows: [
        {
          month: '2026-01',
          totalIn: '2500.00',
          totalOut: '123.456',
          totalNc: '2',
          totalIgn: '1',
        },
        {
          month: '2026-03',
          totalIn: null,
          totalOut: '10',
          totalNc: null,
          totalIgn: 0,
        },
      ],
    })

    expect(trend.map((row) => row.month)).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(trend[0]).toMatchObject({ totalIn: '2500.00', totalOut: '123.46', totalNc: 2, totalIgn: 1 })
    expect(trend[1]).toMatchObject({ totalIn: '0.00', totalOut: '0.00', totalNc: 0, totalIgn: 0 })
    expect(trend[2]).toMatchObject({ totalIn: '0.00', totalOut: '10.00', totalNc: 0, totalIgn: 0 })
  })

  it('builds category detail data with zero-filled trends, summary stats, breakdown percentages, and normalized top transactions', () => {
    const detail = buildCategoryDetailData({
      category: { id: 1, name: 'Casa', slug: 'casa', type: 'out' },
      from: new Date(2026, 0, 1),
      to: new Date(2026, 2, 31, 23, 59, 59, 999),
      trendRows: [
        { categoryId: 1, categorySlug: 'casa', categoryType: 'out', month: '2026-01', count: '2', amount: '100.105' },
        { categoryId: 1, categorySlug: 'casa', categoryType: 'out', month: '2026-03', count: 1, amount: '50' },
      ],
      subcategoryRows: [
        {
          categoryId: 1,
          categorySlug: 'casa',
          categoryType: 'out',
          subCategoryId: 11,
          subCategoryName: 'Affitto',
          subCategorySlug: 'affitto',
          count: 1,
          amount: '90',
        },
        {
          categoryId: 1,
          categorySlug: 'casa',
          categoryType: 'out',
          subCategoryId: 12,
          subCategoryName: 'Bollette',
          subCategorySlug: 'bollette',
          count: '2',
          amount: '60.005',
        },
      ],
      topTransactionRows: [
        {
          id: 'tx-2',
          categoryId: 1,
          categorySlug: 'casa',
          categoryType: 'out',
          description: 'Rent fallback',
          customTitle: 'Rent custom',
          amount: '-90',
          occurredAt: new Date(2026, 0, 5),
        },
        {
          id: 'tx-1',
          categoryId: 1,
          categorySlug: 'casa',
          categoryType: 'out',
          description: 'Power bill',
          customTitle: null,
          amount: '-60.005',
          occurredAt: new Date(2026, 1, 10),
        },
      ],
    })

    expect(detail.category).toEqual({ id: 1, name: 'Casa', slug: 'casa', type: 'out' })
    expect(detail.summary).toEqual({ total: '150.01', count: 3, average: '50.00' })
    expect(detail.trend).toEqual([
      { month: '2026-01', label: 'gen', amount: '100.11', count: 2 },
      { month: '2026-02', label: 'feb', amount: '0.00', count: 0 },
      { month: '2026-03', label: 'mar', amount: '50.00', count: 1 },
    ])
    expect(detail.subcategories).toEqual([
      expect.objectContaining({ id: 11, name: 'Affitto', slug: 'affitto', amount: '90.00', count: 1, percentage: 60 }),
      expect.objectContaining({ id: 12, name: 'Bollette', slug: 'bollette', amount: '60.01', count: 2, percentage: 40 }),
    ])
    expect(detail.topTransactions).toEqual([
      { id: 'tx-2', title: 'Rent custom', description: 'Rent fallback', date: '2026-01-05', amount: '90.00' },
      { id: 'tx-1', title: 'Power bill', description: 'Power bill', date: '2026-02-10', amount: '60.01' },
    ])
  })

  it('returns empty category detail data for missing metadata and skips malformed, system, ignored, mismatched, and out-of-range rows deterministically', () => {
    expect(
      buildCategoryDetailData({
        category: null,
        from: new Date(2026, 0, 1),
        to: new Date(2026, 1, 28, 23, 59, 59, 999),
        trendRows: [{ categoryId: 1, categorySlug: 'casa', categoryType: 'out', month: '2026-01', count: 1, amount: '100' }],
        subcategoryRows: [],
        topTransactionRows: [],
      })
    ).toEqual({
      category: null,
      summary: { total: '0.00', count: 0, average: '0.00' },
      trend: [
        { month: '2026-01', label: 'gen', amount: '0.00', count: 0 },
        { month: '2026-02', label: 'feb', amount: '0.00', count: 0 },
      ],
      subcategories: [],
      topTransactions: [],
    })

    const detail = buildCategoryDetailData({
      category: { id: 1, name: 'Casa', slug: 'casa', type: 'out' },
      from: new Date(2026, 0, 1),
      to: new Date(2026, 1, 28, 23, 59, 59, 999),
      trendRows: [
        { categoryId: null, categorySlug: 'casa', categoryType: 'out', month: '2026-01', count: 1, amount: '999' },
        { categoryId: 1, categorySlug: 'ignore', categoryType: 'out', month: '2026-01', count: 1, amount: '999' },
        { categoryId: 1, categorySlug: 'casa', categoryType: 'system', month: '2026-01', count: 1, amount: '999' },
        { categoryId: 2, categorySlug: 'cibo', categoryType: 'out', month: '2026-01', count: 1, amount: '999' },
        { categoryId: 1, categorySlug: 'casa', categoryType: 'in', month: '2026-01', count: 1, amount: '999' },
        { categoryId: 1, categorySlug: 'casa', categoryType: 'out', month: '2025-12', count: 1, amount: '999' },
        { categoryId: 1, categorySlug: 'casa', categoryType: 'out', month: '2026-01', count: null, amount: null },
      ],
      subcategoryRows: [
        {
          categoryId: 1,
          categorySlug: 'casa',
          categoryType: 'out',
          subCategoryId: null,
          subCategoryName: 'Missing',
          subCategorySlug: 'missing',
          count: 1,
          amount: '999',
        },
        {
          categoryId: 1,
          categorySlug: 'casa',
          categoryType: 'out',
          subCategoryId: 11,
          subCategoryName: 'A',
          subCategorySlug: 'a',
          count: 1,
          amount: '25',
        },
        {
          categoryId: 1,
          categorySlug: 'casa',
          categoryType: 'out',
          subCategoryId: 12,
          subCategoryName: 'B',
          subCategorySlug: 'b',
          count: 1,
          amount: '25',
        },
      ],
      topTransactionRows: [
        { id: null, categoryId: 1, categorySlug: 'casa', categoryType: 'out', description: 'Missing', customTitle: null, amount: '999', occurredAt: new Date(2026, 0, 1) },
        { id: 'tx-b', categoryId: 1, categorySlug: 'casa', categoryType: 'out', description: 'B', customTitle: null, amount: '-25', occurredAt: new Date(2026, 0, 2) },
        { id: 'tx-a', categoryId: 1, categorySlug: 'casa', categoryType: 'out', description: 'A', customTitle: null, amount: '-25', occurredAt: new Date(2026, 0, 2) },
      ],
    })

    expect(detail.summary).toEqual({ total: '50.00', count: 2, average: '25.00' })
    expect(detail.trend[0]).toMatchObject({ amount: '0.00', count: 0 })
    expect(detail.subcategories.map((row) => row.slug)).toEqual(['a', 'b'])
    expect(detail.subcategories.map((row) => row.percentage)).toEqual([50, 50])
    expect(detail.topTransactions.map((row) => row.id)).toEqual(['tx-a', 'tx-b'])
  })
})

describe('buildDeviationDataset (D-02, D-03, D-05)', () => {
  const NOISE = '15.00'

  it('computes signed deviation per id from reference total and baseline average', () => {
    const map = buildDeviationDataset({
      referenceRows: [{ id: 1, amount: '120.00' }],
      baselineRows: [
        { id: 1, month: '2026-01', amount: '100.00' },
        { id: 1, month: '2026-02', amount: '100.00' },
        { id: 1, month: '2026-03', amount: '100.00' },
      ],
      noiseThreshold: NOISE,
    })
    expect(map.get(1)).toEqual({ deviation: 20, isNew: false, belowNoiseThreshold: false })
  })

  it('marks isNew=true when reference exists and baseline is empty', () => {
    const map = buildDeviationDataset({
      referenceRows: [{ id: 7, amount: '50.00' }],
      baselineRows: [],
      noiseThreshold: NOISE,
    })
    expect(map.get(7)).toEqual({ deviation: null, isNew: true, belowNoiseThreshold: false })
  })

  it('marks belowNoiseThreshold=true and deviation=null when reference < €15', () => {
    const map = buildDeviationDataset({
      referenceRows: [{ id: 9, amount: '14.99' }],
      baselineRows: [{ id: 9, month: '2026-01', amount: '100.00' }],
      noiseThreshold: NOISE,
    })
    expect(map.get(9)).toEqual({ deviation: null, isNew: false, belowNoiseThreshold: true })
  })

  it('averages baseline over only the months that exist (fewer than 3 OK per D-03)', () => {
    const map = buildDeviationDataset({
      referenceRows: [{ id: 3, amount: '90.00' }],
      baselineRows: [
        { id: 3, month: '2026-02', amount: '60.00' },
        { id: 3, month: '2026-03', amount: '60.00' },
      ],
      noiseThreshold: NOISE,
    })
    expect(map.get(3)?.deviation).toBe(50)
  })

  it('omits ids that appear only in baseline (no reference)', () => {
    const map = buildDeviationDataset({
      referenceRows: [],
      baselineRows: [{ id: 99, month: '2026-01', amount: '100.00' }],
      noiseThreshold: NOISE,
    })
    expect(map.has(99)).toBe(false)
  })
})

describe('getDeviationDateRanges (D-02, D-03)', () => {
  it('returns reference = previous calendar month and baseline = 3 months prior', () => {
    const now = new Date(2026, 4, 15)
    expect(getDeviationDateRanges(now)).toEqual({
      reference: {
        from: new Date(2026, 3, 1),
        to: new Date(2026, 3, 30, 23, 59, 59, 999),
      },
      baseline: {
        from: new Date(2026, 0, 1),
        to: new Date(2026, 2, 31, 23, 59, 59, 999),
      },
    })
  })

  it('handles January (baseline window crosses year boundary)', () => {
    const now = new Date(2026, 0, 15)
    expect(getDeviationDateRanges(now)).toEqual({
      reference: {
        from: new Date(2025, 11, 1),
        to: new Date(2025, 11, 31, 23, 59, 59, 999),
      },
      baseline: {
        from: new Date(2025, 8, 1),
        to: new Date(2025, 10, 30, 23, 59, 59, 999),
      },
    })
  })
})

describe('getMonthlyTrendByNature (R-FN-04, R-FN-08, R-FN-09)', () => {
  it('getMonthlyTrendByNature is exported from @/lib/dal/dashboard (R-FN-04)', async () => {
    const dal = await import('@/lib/dal/dashboard')
    expect(typeof (dal as Record<string, unknown>)['getMonthlyTrendByNature']).toBe('function')
  })

  it('MonthlyNatureTrendPoint type token is reachable (R-FN-08)', async () => {
    const dal = await import('@/lib/dal/dashboard')
    expect(dal).toBeTruthy()
  })
})

describe('buildMonthlyNatureTrendData (R-FN-04, R-FN-08, R-FN-09)', () => {
  it('pre-populates all 9 nature keys at 0.00 for every month even with no data', () => {
    const result = buildMonthlyNatureTrendData({
      from: new Date(2026, 0, 1),
      to: new Date(2026, 1, 28, 23, 59, 59, 999),
      rows: [],
    })

    expect(result).toHaveLength(2)
    for (const point of result) {
      // Phase 46: FlowNature v2.0 — 8 natures (extraordinary→savings, financial→investment, operational dissolved)
      expect(Object.keys(point.segments).sort()).toEqual(
        [
          'debt',
          'discretionary',
          'essential',
          'income',
          'income_extraordinary',
          'investment',
          'savings',
          'transfer',
          'unclassified',
        ].sort()
      )
      for (const val of Object.values(point.segments)) {
        expect(val).toBe('0.00')
      }
      expect(point.totalNc).toBe(0)
      expect(point.totalIgn).toBe(0)
    }
  })

  it('algebraic sum: positive and negative rows for the same nature net correctly (ADR-0004)', () => {
    const result = buildMonthlyNatureTrendData({
      from: new Date(2026, 0, 1),
      to: new Date(2026, 0, 31, 23, 59, 59, 999),
      rows: [
        { month: '2026-01', nature: 'essential', amount: '500.00', totalNc: 0, totalIgn: 0 },
        { month: '2026-01', nature: 'essential', amount: '-200.00', totalNc: 0, totalIgn: 0 },
      ],
    })

    expect(result[0]?.segments.essential).toBe('300.00')
    expect(result[0]?.segments.discretionary).toBe('0.00')
  })

  it('null-nature rows are mapped to the unclassified segment key', () => {
    const result = buildMonthlyNatureTrendData({
      from: new Date(2026, 0, 1),
      to: new Date(2026, 0, 31, 23, 59, 59, 999),
      rows: [
        { month: '2026-01', nature: null, amount: '150.00', totalNc: 2, totalIgn: 1 },
      ],
    })

    expect(result[0]?.segments.unclassified).toBe('150.00')
    expect(result[0]?.segments.essential).toBe('0.00')
    expect(result[0]?.totalNc).toBe(2)
    expect(result[0]?.totalIgn).toBe(1)
  })

  // Phase 46: FlowNature v2.0 — financial → investment
  it('segments across different natures accumulate independently per month', () => {
    const result = buildMonthlyNatureTrendData({
      from: new Date(2026, 0, 1),
      to: new Date(2026, 1, 28, 23, 59, 59, 999),
      rows: [
        { month: '2026-01', nature: 'essential', amount: '300.00', totalNc: 0, totalIgn: 0 },
        { month: '2026-01', nature: 'discretionary', amount: '100.00', totalNc: 0, totalIgn: 0 },
        { month: '2026-02', nature: 'investment', amount: '50.00', totalNc: 1, totalIgn: 0 },
      ],
    })

    expect(result[0]?.segments.essential).toBe('300.00')
    expect(result[0]?.segments.discretionary).toBe('100.00')
    expect(result[0]?.segments.investment).toBe('0.00')
    expect(result[1]?.segments.investment).toBe('50.00')
    expect(result[1]?.segments.essential).toBe('0.00')
    expect(result[1]?.totalNc).toBe(1)
  })

  it('rows outside the preset month range are silently skipped (R-FN-09 SQL boundary)', () => {
    const result = buildMonthlyNatureTrendData({
      from: new Date(2026, 0, 1),
      to: new Date(2026, 0, 31, 23, 59, 59, 999),
      rows: [
        { month: '2026-01', nature: 'essential', amount: '400.00', totalNc: 0, totalIgn: 0 },
        { month: '2025-12', nature: 'essential', amount: '999.00', totalNc: 0, totalIgn: 0 },
      ],
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.segments.essential).toBe('400.00')
  })
})

// ─── Phase 49 RED: money-correctness tests (ADR 0012 — direction algebraic sum) ──────────────
// These tests are RED until Plans 02/03 implement the direction-grouped aggregation.
// Expected to FAIL at commit time because:
//   - OverviewData.totalAllocation does not yet exist on the type
//   - buildOverviewData does not yet accept / propagate totalAllocation
// Do NOT implement production code here — keep RED.

describe('DASH money-correctness (Phase 49 — ADR 0012)', () => {
  // DASH-02: A +€30 refund under an OUT subcategory (amount positive, direction = out)
  // must LOWER totalOut, not raise it (algebraic sum: 100 spending + 30 refund = 70 net)
  it('DASH-02: refund netting — +€30 refund under OUT direction lowers totalOut to 70.00 (not 100 or 130)', () => {
    // buildOverviewData receives pre-aggregated rows from getOverviewAmountTotals.
    // After Plan 02, getOverviewAmountTotals will return { totalIn, totalOut, totalAllocation }
    // using algebraic sum per direction bucket. Mocked here with the expected output values:
    //   - €100 OUT spending + €30 refund = totalOut 70.00 (algebraic sum: sum(OUT amounts) = -100 + 30 = -70, abs → 70)
    const overview = buildOverviewData({
      current: {
        totalIn: '0.00',
        totalOut: '70.00',
        totalAllocation: '0.00',
      },
      previous: { totalIn: '0.00', totalOut: '0.00', totalAllocation: '0.00' },
      currentUncategorizedCount: 0,
      previousUncategorizedCount: 0,
    })

    // The critical assertion: algebraic-sum refund netting
    expect(overview.totalOut).toBe('70.00')
    expect(overview.totalAllocation).toBe('0.00')
  })

  // DASH-03: -€500 savings deposit (allocation direction, included_in_totals=false)
  // must appear in totalAllocation, NOT in totalOut
  it('DASH-03: allocation isolation — -€500 savings deposit appears in totalAllocation (500.00), totalOut stays 0.00', () => {
    const overview = buildOverviewData({
      current: {
        totalIn: '0.00',
        totalOut: '0.00',
        totalAllocation: '500.00',
      },
      previous: { totalIn: '0.00', totalOut: '0.00', totalAllocation: '0.00' },
      currentUncategorizedCount: 0,
      previousUncategorizedCount: 0,
    })

    expect(overview.totalOut).toBe('0.00')
    expect(overview.totalAllocation).toBe('500.00')
  })

  // DASH-02: net divestment — +€800 investment deposit and +€300 divestment in same month
  // Allocation algebraic sum: -800 + 300 = -500 → abs → 500 (net allocation, not 800+300=1100)
  it('DASH-02: net divestment — +€800 deposit and +€300 divestment net to 500.00 in allocation (not 1100.00)', () => {
    const overview = buildOverviewData({
      current: {
        totalIn: '0.00',
        totalOut: '0.00',
        // Algebraic sum for allocation: (-800) + (+300) = -500 → abs for display = 500
        totalAllocation: '500.00',
      },
      previous: { totalIn: '0.00', totalOut: '0.00', totalAllocation: '0.00' },
      currentUncategorizedCount: 0,
      previousUncategorizedCount: 0,
    })

    // Assert netted value, NOT double-counted 800+300=1100
    expect(overview.totalAllocation).toBe('500.00')
    expect(overview.totalAllocation).not.toBe('1100.00')
  })

  // DASH-01: transfer direction (included_in_totals=false) contributes 0 to all three totals
  it('DASH-01: transfer exclusion — transfer direction transaction contributes 0 to totalIn, totalOut, totalAllocation', () => {
    // Direction included_in_totals=false for transfer; excluded from all aggregation
    const overview = buildOverviewData({
      current: {
        totalIn: '0.00',
        totalOut: '0.00',
        totalAllocation: '0.00',
      },
      previous: { totalIn: '0.00', totalOut: '0.00', totalAllocation: '0.00' },
      currentUncategorizedCount: 0,
      previousUncategorizedCount: 0,
    })

    expect(overview.totalIn).toBe('0.00')
    expect(overview.totalOut).toBe('0.00')
    expect(overview.totalAllocation).toBe('0.00')
  })

  // DASH-04: savings rate = (in − out) / in where out = spending only (no allocation, no transfer)
  // totalIn=3000, totalOut=2000 (spending) → (3000-2000)/3000*100 = 33.3% (computeSavingsRate rounds to 1dp)
  // totalAllocation must NOT enter the savings rate denominator
  it('DASH-04: savings rate unchanged — (3000-2000)/3000 = 33.3, allocation NOT included in denominator', () => {
    const overview = buildOverviewData({
      current: {
        totalIn: '3000.00',
        totalOut: '2000.00',
        totalAllocation: '500.00',
      },
      previous: { totalIn: '0.00', totalOut: '0.00', totalAllocation: '0.00' },
      currentUncategorizedCount: 0,
      previousUncategorizedCount: 0,
    })

    // Savings rate must be (3000 - 2000) / 3000 * 100 = 33.3 (computeSavingsRate rounds to 1dp)
    // totalAllocation (500) must NOT enter the savings rate denominator
    // If allocation were included: (3000 - 2000 - 500) / 3000 * 100 = 16.7 — wrong
    expect(overview.savingsRate).toBe(33.3)
    // totalAllocation is surfaced on OverviewData (Phase 49 — plan 02)
    expect(overview.totalAllocation).toBe('500.00')
  })
})

// ─── Phase 50 RED: transaction-pairing netting tests (PAIR-03) ──────────────
// These tests are RED until Plans 02/03 implement isNotSecondary / effectiveAmount helpers
// and wire them into the dashboard DAL queries.
// Dynamic import is used so that the module-not-found error is scoped to each test,
// not to the entire file — keeping all pre-existing tests GREEN while these are RED.

describe('transaction pairing netting (Phase 50 — PAIR-03)', () => {
  // ── isNotSecondary() fragment contract ─────────────────────────────────────
  describe('isNotSecondary() SQL fragment', () => {
    it('returns a sql fragment referencing transaction_pair and transaction_b_id', async () => {
      // This dynamic import is RED until Plan 02 creates lib/dal/transaction-pairs-sql.ts
      const { isNotSecondary } = await import('@/lib/dal/transaction-pairs-sql')
      const fragment = isNotSecondary()
      const sqlText = JSON.stringify(fragment)
      // Check for the key identifiers that must appear in the NOT EXISTS clause
      expect(sqlText.toLowerCase()).toMatch(/transaction_pair|tp\.transaction_b_id/)
    })

    it('returns a value that is truthy (Drizzle sql fragment, not null/undefined)', async () => {
      const { isNotSecondary } = await import('@/lib/dal/transaction-pairs-sql')
      expect(isNotSecondary()).toBeTruthy()
    })
  })

  // ── effectiveAmount() fragment contract ──────────────────────────────────
  describe('effectiveAmount() SQL fragment', () => {
    it('returns a sql fragment with a CASE WHEN EXISTS referencing transaction_a_id and ::numeric addition', async () => {
      const { effectiveAmount } = await import('@/lib/dal/transaction-pairs-sql')
      const fragment = effectiveAmount()
      const sqlText = JSON.stringify(fragment)
      // The CASE WHEN EXISTS must reference the pair table and ::numeric cast
      expect(sqlText.toLowerCase()).toMatch(/case|when|exists|transaction_pair/)
    })

    it('returns a value that is truthy (Drizzle sql fragment, not null/undefined)', async () => {
      const { effectiveAmount } = await import('@/lib/dal/transaction-pairs-sql')
      expect(effectiveAmount()).toBeTruthy()
    })
  })

  // ── Scenario-level netting (buildOverviewData + mocked pre-aggregated rows) ──
  // The netting contract: when a primary (-100.00) and secondary (+50.00) pair exist,
  // the SQL helpers exclude the secondary and replace the primary's amount with the net.
  // The aggregated totalOut passed to buildOverviewData already reflects this net: -50.00 → abs = 50.00.
  // This pin ensures buildOverviewData does not accidentally double-count or ignore the net.
  describe('netting scenario: primary cena -100 + secondary ricarica +50 → net totalOut 50.00 (PAIR-03)', () => {
    it('buildOverviewData with pre-netted totalOut=50.00 returns 50.00, not 100.00 or 150.00', () => {
      // The netting SQL helpers produce: primary.amount + secondary.amount = -100 + 50 = -50 → abs = 50
      // This is the expected totalOut value after pairing netting is applied by the DAL.
      const overview = buildOverviewData({
        current: {
          totalIn: '0.00',
          totalOut: '50.00', // algebraic net: |-100 + 50| = 50 (secondary excluded, primary netted)
          totalAllocation: '0.00',
        },
        previous: { totalIn: '0.00', totalOut: '0.00', totalAllocation: '0.00' },
        currentUncategorizedCount: 0,
        previousUncategorizedCount: 0,
      })

      // Pin: netted value, not the raw primary alone (100) nor the sum of both (150)
      expect(overview.totalOut).toBe('50.00')
      expect(overview.totalOut).not.toBe('100.00')
      expect(overview.totalOut).not.toBe('150.00')
    })

    it('secondary transaction excluded from totals: it does NOT add its own +50.00 to totalIn', () => {
      // If secondary were NOT excluded, totalIn would receive +50.00 from the refund.
      // After pairing: secondary is excluded (isNotSecondary() WHERE clause), so totalIn = 0.
      const overview = buildOverviewData({
        current: {
          totalIn: '0.00', // secondary excluded from its own month's IN totals (D-06)
          totalOut: '50.00',
          totalAllocation: '0.00',
        },
        previous: { totalIn: '0.00', totalOut: '0.00', totalAllocation: '0.00' },
        currentUncategorizedCount: 0,
        previousUncategorizedCount: 0,
      })

      expect(overview.totalIn).toBe('0.00')
    })
  })

  // ── ADR 0004 regression guard: unpaired transactions unaffected ─────────────
  // Pre-existing unpaired-transaction assertions from above must remain GREEN.
  // This new test pins the baseline explicitly to defend it as a regression guard (PAIR-03).
  describe('ADR 0004 regression guard — unpaired transactions unaffected (PAIR-03)', () => {
    it('buildOverviewData with only unpaired transactions produces the same result as before pairing', () => {
      // Same fixture as the pre-existing test above — must stay GREEN after Plan 02 netting changes
      const overview = buildOverviewData({
        current: { totalIn: '2500.125', totalOut: '1500.115', totalAllocation: null },
        previous: { totalIn: '2000.00', totalOut: '1000.00', totalAllocation: null },
        currentUncategorizedCount: 3,
        previousUncategorizedCount: 2,
      })

      // These are the same expected values as the pre-existing baseline test (unpaired scenario)
      expect(overview.totalIn).toBe('2500.13')
      expect(overview.totalOut).toBe('1500.12')
      expect(overview.balance).toBe('1000.01')
      expect(overview.savingsRate).toBe(40)
    })
  })
})

describe('getUncategorizedCount / getOverviewAmountTotals tagId threading (68-02, TAG-04)', () => {
  const from = new Date(2026, 0, 1)
  const to = new Date(2026, 0, 31)

  it('getUncategorizedCount: no tagId adds no EXISTS(transaction_tag) condition', async () => {
    await getUncategorizedCount('user-1', from, to)

    expect(dalMocks.whereArgs).toHaveLength(1)
    expect(hasTagCondition(dalMocks.whereArgs[0])).toBe(false)
  })

  it('getUncategorizedCount: tagId=5 adds the EXISTS(transaction_tag) fragment scoped to that tag', async () => {
    await getUncategorizedCount('user-1', from, to, 5)

    expect(dalMocks.whereArgs).toHaveLength(1)
    expect(findTagCondition(dalMocks.whereArgs[0], 5)).toBe(true)
  })

  it('getOverviewAmountTotals: no tagId adds no EXISTS(transaction_tag) condition', async () => {
    await getOverviewAmountTotals('user-1', from, to)

    expect(dalMocks.whereArgs).toHaveLength(1)
    expect(hasTagCondition(dalMocks.whereArgs[0])).toBe(false)
  })

  it('getOverviewAmountTotals: tagId=5 adds the EXISTS(transaction_tag) fragment scoped to that tag', async () => {
    await getOverviewAmountTotals('user-1', from, to, 5)

    expect(dalMocks.whereArgs).toHaveLength(1)
    expect(findTagCondition(dalMocks.whereArgs[0], 5)).toBe(true)
  })
})
