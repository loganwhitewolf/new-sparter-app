import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))
vi.mock('@/lib/dal/auth', () => ({ verifySession: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('@/lib/db/schema', () => ({
  category: { id: 'category.id', name: 'category.name', slug: 'category.slug', type: 'category.type' },
  expense: {
    id: 'expense.id',
    userId: 'expense.userId',
    status: 'expense.status',
    subCategoryId: 'expense.subCategoryId',
  },
  subCategory: {
    id: 'subCategory.id',
    name: 'subCategory.name',
    slug: 'subCategory.slug',
    categoryId: 'subCategory.categoryId',
  },
  transaction: {
    userId: 'transaction.userId',
    expenseId: 'transaction.expenseId',
    amount: 'transaction.amount',
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
  buildBreakdownData,
  buildMonthlyTrendData,
  buildOverviewData,
} = await import('../lib/dal/dashboard')

describe('dashboard DAL amount mapping', () => {
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
        categoryId: 99,
        categoryName: 'Ignora',
        categorySlug: 'ignore',
        categoryType: 'system',
        subCategoryId: 99,
        subCategoryName: 'Ignora',
        subCategorySlug: 'ignore',
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
    expect(breakdown.map((row) => row.slug)).not.toContain('ignore')
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
})
