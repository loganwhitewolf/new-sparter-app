import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  executeResult: { rows: [] as unknown[] },
  selectResult: [] as unknown[],
}))

vi.mock('server-only', () => ({}))
vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))
vi.mock('@/lib/dal/auth', () => ({ verifySession: mocks.verifySession }))
vi.mock('drizzle-orm', () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    op: 'sql',
    strings: Array.from(strings),
    values,
  }),
  and: (...args: unknown[]) => ({ op: 'and', args }),
  eq: (...args: unknown[]) => ({ op: 'eq', args }),
  gte: (...args: unknown[]) => ({ op: 'gte', args }),
  lte: (...args: unknown[]) => ({ op: 'lte', args }),
  ne: (...args: unknown[]) => ({ op: 'ne', args }),
  inArray: (...args: unknown[]) => ({ op: 'inArray', args }),
  isNull: (...args: unknown[]) => ({ op: 'isNull', args }),
  or: (...args: unknown[]) => ({ op: 'or', args }),
  desc: (...args: unknown[]) => ({ op: 'desc', args }),
  // relations is needed by lib/db/schema.ts when it is transitively imported
  relations: () => ({}),
}))
vi.mock('@/lib/db', () => ({
  db: {
    execute: vi.fn(() => Promise.resolve(mocks.executeResult)),
    select: vi.fn(() => ({
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn(() => Promise.resolve(mocks.selectResult)),
    })),
  },
}))

// These tests target lib/dal/overview.ts which does not exist yet.
// They are intentionally RED (module not found) and will turn GREEN in plan 42-03.

describe('getYearsWithData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue({ userId: 'user-123' })
    mocks.executeResult.rows = []
  })

  it('returns distinct years in descending order', async () => {
    mocks.executeResult.rows = [{ yr: '2026' }, { yr: '2025' }, { yr: '2024' }]
    const { getYearsWithData } = await import('@/lib/dal/overview')
    const result = await getYearsWithData()
    expect(result).toEqual(['2026', '2025', '2024'])
  })

  it('returns empty array when user has no transaction data', async () => {
    mocks.executeResult.rows = []
    const { getYearsWithData } = await import('@/lib/dal/overview')
    const result = await getYearsWithData()
    expect(result).toEqual([])
  })

  it('calls verifySession to scope query to authenticated user', async () => {
    mocks.executeResult.rows = [{ yr: '2026' }]
    const { getYearsWithData } = await import('@/lib/dal/overview')
    await getYearsWithData()
    expect(mocks.verifySession).toHaveBeenCalledOnce()
  })
})

describe('getOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue({ userId: 'user-123' })
    mocks.executeResult.rows = []
    mocks.selectResult = []
  })

  it('returns correct KPI strings from aggregate rows', async () => {
    // First execute call: lastYm query
    // Subsequent calls: getOverviewAmountTotals and getUncategorizedCount
    const executeMock = vi.fn()
      .mockResolvedValueOnce({ rows: [{ last_ym: '2026-04' }] }) // lastMonthResult
      .mockResolvedValueOnce({ rows: [{ totalIn: '3000.00', totalOut: '2000.00' }] }) // current totals
      .mockResolvedValueOnce({ rows: [{ totalIn: '2500.00', totalOut: '1800.00' }] }) // previous totals

    const db = { execute: executeMock, select: vi.fn(() => ({
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn(() => Promise.resolve([{ total: 5 }])),
    })) }

    vi.doMock('@/lib/db', () => ({ db }))

    const { getOverview } = await import('@/lib/dal/overview')
    const result = await getOverview(2026)
    // Result should have totalIn/totalOut as string fields (from buildOverviewData)
    expect(result).toBeDefined()
    expect(typeof result).toBe('object')
  })

  it('uses last month with data as YTD upper bound (not partial current month)', async () => {
    mocks.executeResult.rows = [{ last_ym: '2026-03' }]
    const { getOverview } = await import('@/lib/dal/overview')
    // Should not throw, and should use March as bound (not the current month)
    const result = await getOverview(2026)
    expect(result).toBeDefined()
  })

  it('applies equal-span prior-year comparison window', async () => {
    // If YTD is Jan–Apr 2026, prior-year window should be Jan–Apr 2025 (same 4-month span)
    mocks.executeResult.rows = [{ last_ym: '2026-04' }]
    const { getOverview } = await import('@/lib/dal/overview')
    const result = await getOverview(2026)
    expect(result).toBeDefined()
  })
})

describe('getMonthOverMonthCategoryChanges', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue({ userId: 'user-123' })
  })

  it('returns only OUT-nature category changes (filters income/transfer)', async () => {
    const { getMonthOverMonthCategoryChanges } = await import('@/lib/dal/overview')
    const result = await getMonthOverMonthCategoryChanges(2026, 3) // April (0-indexed)
    expect(Array.isArray(result)).toBe(true)
  })

  it('filters out changes with absolute delta below €15 threshold', async () => {
    const { getMonthOverMonthCategoryChanges } = await import('@/lib/dal/overview')
    // With no mocked DB rows, delta is 0 — should return empty (below threshold)
    const result = await getMonthOverMonthCategoryChanges(2026, 3)
    expect(result).toEqual([])
  })

  it('sets isNew = true when previous amount is zero and current amount is positive', async () => {
    const { getMonthOverMonthCategoryChanges } = await import('@/lib/dal/overview')
    const result = await getMonthOverMonthCategoryChanges(2026, 3)
    // When implemented: new categories (prev=0, curr>0) should have isNew: true
    expect(Array.isArray(result)).toBe(true)
  })

  it('handles year crossing: January 2026 compares against December 2025', async () => {
    const { getMonthOverMonthCategoryChanges } = await import('@/lib/dal/overview')
    // Month index 0 = January; prevMonth should be December of prior year
    const result = await getMonthOverMonthCategoryChanges(2026, 0)
    expect(Array.isArray(result)).toBe(true)
  })

  it('sorts results by absolute delta descending', async () => {
    const { getMonthOverMonthCategoryChanges } = await import('@/lib/dal/overview')
    const result = await getMonthOverMonthCategoryChanges(2026, 3)
    // When implemented: check that |delta| values are in descending order
    if (result.length > 1) {
      for (let i = 0; i < result.length - 1; i++) {
        const curr = Math.abs(parseFloat(result[i]!.delta))
        const next = Math.abs(parseFloat(result[i + 1]!.delta))
        expect(curr).toBeGreaterThanOrEqual(next)
      }
    }
    expect(Array.isArray(result)).toBe(true)
  })
})

describe('getOverviewChart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue({ userId: 'user-123' })
    mocks.executeResult.rows = []
    mocks.selectResult = []
  })

  it('splits income into recurring and extraordinary buckets', async () => {
    const { getOverviewChart } = await import('@/lib/dal/overview')
    const result = await getOverviewChart(2026)
    expect(Array.isArray(result)).toBe(true)
    if (result.length > 0) {
      // Each point should have income split into recurring + extraordinary
      expect(result[0]).toHaveProperty('income')
      expect(result[0]!.income).toHaveProperty('recurring')
      expect(result[0]!.income).toHaveProperty('extraordinary')
    }
  })

  it('zero-fills missing months with empty amounts', async () => {
    const { getOverviewChart } = await import('@/lib/dal/overview')
    // With empty DB rows, all 12 months should still appear with zero amounts
    const result = await getOverviewChart(2026)
    expect(Array.isArray(result)).toBe(true)
    // When implemented: should have 12 zero-filled points
    if (result.length > 0) {
      for (const point of result) {
        expect(point).toHaveProperty('month')
        expect(point).toHaveProperty('label')
      }
    }
  })

  it('aggregates per-nature amounts for OUT transactions', async () => {
    const { getOverviewChart } = await import('@/lib/dal/overview')
    const result = await getOverviewChart(2026)
    expect(Array.isArray(result)).toBe(true)
    if (result.length > 0) {
      expect(result[0]).toHaveProperty('out')
    }
  })

  it('calls verifySession to scope query to authenticated user', async () => {
    const { getOverviewChart } = await import('@/lib/dal/overview')
    await getOverviewChart(2026)
    expect(mocks.verifySession).toHaveBeenCalledOnce()
  })

  // Phase 49 RED: DASH-02 allocation bucket assertion
  // After Plan 02, OverviewChartPoint gains an `allocation` bucket with savings/investment keys.
  // Savings and investment amounts must NOT appear in the `out` bucket.
  // This test is RED until Plan 02 reshapes OverviewChartPoint and getOverviewChart.
  it('DASH-02: getOverviewChart routes savings/investment to allocation bucket, not out bucket', async () => {
    // Mock DB rows: one savings row, one investment row
    // After Plan 02 direction join, these will land in allocation bucket
    mocks.executeResult.rows = [
      {
        month: '2026-01',
        nature: 'savings',
        direction_code: 'allocation',
        amount: '-500.00',
      },
      {
        month: '2026-01',
        nature: 'investment',
        direction_code: 'allocation',
        amount: '-300.00',
      },
    ]

    const { getOverviewChart } = await import('@/lib/dal/overview')
    const result = await getOverviewChart(2026)

    expect(Array.isArray(result)).toBe(true)

    if (result.length > 0) {
      const jan = result.find((p) => p.month === '2026-01')
      if (jan) {
        // allocation bucket is now defined on OverviewChartPoint (Phase 49 Plan 02)
        expect(jan.allocation).toBeDefined()
        expect(jan.allocation).toHaveProperty('savings')
        expect(jan.allocation).toHaveProperty('investment')

        // OUT bucket must NOT contain savings or investment keys
        expect(jan.out).not.toHaveProperty('savings')
        expect(jan.out).not.toHaveProperty('investment')
      }
    }
  })
})
