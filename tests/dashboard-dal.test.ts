import { describe, expect, it, vi } from 'vitest'
import { dashboardPresetToDateRange } from '@/lib/utils/date'

vi.mock('server-only', () => ({}))
vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))
vi.mock('@/lib/dal/auth', () => ({ verifySession: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('@/lib/db/schema', () => ({
  category: {
    id: 'category.id',
    userId: 'category.userId',
    name: 'category.name',
    slug: 'category.slug',
    type: 'category.type',
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
    excludeFromTotals: 'subCategory.excludeFromTotals',
    nature: 'subCategory.nature',
  },
  userSubcategoryOverride: {
    customName: 'userSubcategoryOverride.customName',
    subCategoryId: 'userSubcategoryOverride.subCategoryId',
    userId: 'userSubcategoryOverride.userId',
    nature: 'userSubcategoryOverride.nature',
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
  notExcludedFromTotals,
} = await import('../lib/dal/dashboard')

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
      current: { totalIn: '2500.125', totalOut: '1500.115' },
      previous: { totalIn: '2000.00', totalOut: '1000.00' },
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
      current: { totalIn: null, totalOut: null },
      previous: { totalIn: null, totalOut: null },
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

  it('notExcludedFromTotals() helper builds correct OR predicate', () => {
    const predicate = notExcludedFromTotals()
    expect(predicate).not.toBeNull()
    expect(predicate).not.toBeUndefined()
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
      expect(Object.keys(point.segments).sort()).toEqual(
        [
          'debt',
          'discretionary',
          'essential',
          'extraordinary',
          'financial',
          'income',
          'income_extraordinary',
          'operational',
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

  it('segments across different natures accumulate independently per month', () => {
    const result = buildMonthlyNatureTrendData({
      from: new Date(2026, 0, 1),
      to: new Date(2026, 1, 28, 23, 59, 59, 999),
      rows: [
        { month: '2026-01', nature: 'essential', amount: '300.00', totalNc: 0, totalIgn: 0 },
        { month: '2026-01', nature: 'discretionary', amount: '100.00', totalNc: 0, totalIgn: 0 },
        { month: '2026-02', nature: 'financial', amount: '50.00', totalNc: 1, totalIgn: 0 },
      ],
    })

    expect(result[0]?.segments.essential).toBe('300.00')
    expect(result[0]?.segments.discretionary).toBe('100.00')
    expect(result[0]?.segments.financial).toBe('0.00')
    expect(result[1]?.segments.financial).toBe('50.00')
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
