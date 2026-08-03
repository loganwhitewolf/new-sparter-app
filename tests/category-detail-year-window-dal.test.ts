import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

// Task 1 (84-01): mocks @/lib/dal/covered-months's getCoveredMonthsInYear/getCategoryMonthlyAmounts
// and @/lib/dal/auth's verifySession — deliberately NOT the raw db chain (that pattern is
// reserved for Plan 84-02's genuinely new SQL, per this plan's <read_first> instruction).
vi.mock('server-only', () => ({}))
vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))
vi.mock('@/lib/dal/auth', () => ({
  verifySession: vi.fn(async () => ({ userId: 'user-1' })),
}))

const coveredMonthsMocks = vi.hoisted(() => ({
  getCoveredMonthsInYear: vi.fn(),
  getCategoryMonthlyAmounts: vi.fn(),
}))
vi.mock('@/lib/dal/covered-months', () => coveredMonthsMocks)

const categoryMetaRow = vi.hoisted(() => ({
  rows: [{ id: 42, name: 'Alimentari & Ristorazione', slug: 'alimentari-ristorazione', type: 'out' as const }],
}))

vi.mock('@/lib/db', () => {
  function makeChain(rows: unknown[]) {
    const chain: Record<string, unknown> = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn(() => Promise.resolve(rows)),
    }
    return chain
  }

  return {
    db: {
      select: vi.fn(() => makeChain(categoryMetaRow.rows)),
    },
  }
})

vi.mock('@/lib/db/schema', () => ({
  category: {
    id: 'category.id',
    name: 'category.name',
    slug: 'category.slug',
    isActive: 'category.isActive',
    userId: 'category.userId',
  },
  ledgerEntryCash: {
    occurredAt: 'ledgerEntryCash.occurredAt',
    amount: 'ledgerEntryCash.amount',
    expenseId: 'ledgerEntryCash.expenseId',
  },
}))

const { getCategoryDetailYearWindow } = await import('@/lib/dal/category-detail-year-window')

// Fixture reproduces the locked prototype's own numbers verbatim
// (.scratch/dashboard-categories/detail-table.html) as an independent correctness check: pace
// 406.00, current-month hybrid 480.30, whole-year total 4540.30 / average 412.75, and the
// documented per-cell deltas (down 24.30 / no comparison / down 54.70 / down 28.70 / up 107.90)
// all fall out of this single fixture with no fudging.
const RAW_AMOUNTS_2026: Record<string, string> = {
  '2026-01': '412.50',
  '2026-02': '388.20',
  '2026-03': '0.00', // uncovered — excluded from getCoveredMonthsInYear below
  '2026-04': '455.80',
  '2026-05': '401.10',
  '2026-06': '372.40',
  '2026-07': '480.30', // calendar-current month (system time fixed to 2026-07-15)
  '2026-08': '0.00',
  '2026-09': '0.00',
  '2026-10': '0.00',
  '2026-11': '0.00',
  '2026-12': '0.00',
}

const COVERED_MONTHS_2026 = ['2026-01', '2026-02', '2026-04', '2026-05', '2026-06', '2026-07']

function seedFixture() {
  coveredMonthsMocks.getCategoryMonthlyAmounts.mockResolvedValue(
    Object.entries(RAW_AMOUNTS_2026).map(([yearMonth, amount]) => ({ yearMonth, amount })),
  )
  coveredMonthsMocks.getCoveredMonthsInYear.mockResolvedValue(
    COVERED_MONTHS_2026.map((yearMonth) => ({
      yearMonth,
      from: new Date(`${yearMonth}-01`),
      to: new Date(`${yearMonth}-01`),
    })),
  )
}

describe('getCategoryDetailYearWindow (D-06/D-07/D-10, Task 1)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 15)) // 15 luglio 2026
    coveredMonthsMocks.getCoveredMonthsInYear.mockReset()
    coveredMonthsMocks.getCategoryMonthlyAmounts.mockReset()
    seedFixture()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('whole-year window: month states, hybrid current month, pace-derived estimates', async () => {
    const data = await getCategoryDetailYearWindow(42, 2026, { months: 12, from: '2026-01' })

    expect(data.category).toEqual({
      id: 42,
      name: 'Alimentari & Ristorazione',
      slug: 'alimentari-ristorazione',
      type: 'out',
    })
    expect(data.pace).toBe('406.00')
    expect(data.projection).toBe('4872.00')

    const byMonth = new Map(data.current.months.map((m) => [m.yearMonth, m]))

    // A month absent from getCoveredMonthsInYear renders 'uncovered' with a null amount (D-10).
    expect(byMonth.get('2026-03')).toMatchObject({ state: 'uncovered', amount: null, monthOverMonthDelta: null })

    // A future month renders 'estimated' with amount equal to the computed pace.
    expect(byMonth.get('2026-08')).toMatchObject({ state: 'estimated', amount: '406.00', monthOverMonthDelta: null })

    // The calendar-current month renders 'current' with computeCurrentMonthHybrid(raw, pace).
    expect(byMonth.get('2026-07')).toMatchObject({ state: 'current', amount: '480.30' })
  })

  test('index 0 of any window slice has monthOverMonthDelta: null', async () => {
    const data = await getCategoryDetailYearWindow(42, 2026, { months: 12, from: '2026-01' })
    expect(data.current.months[0].monthOverMonthDelta).toBeNull()

    const windowed = await getCategoryDetailYearWindow(42, 2026, { months: 6, from: '2026-02' })
    expect(windowed.current.months[0].monthOverMonthDelta).toBeNull()
  })

  test('a covered index i>0 whose predecessor is uncovered has monthOverMonthDelta: null, otherwise computeComparison(cur, prev)', async () => {
    const data = await getCategoryDetailYearWindow(42, 2026, { months: 12, from: '2026-01' })
    const byMonth = new Map(data.current.months.map((m) => [m.yearMonth, m]))

    // April (index 3) follows uncovered March (index 2) -> no comparison.
    expect(byMonth.get('2026-04')).toMatchObject({ monthOverMonthDelta: null })

    // Every other consecutive covered/current pair matches computeComparison(cur, prev) exactly,
    // reproducing the locked prototype's own printed deltas.
    expect(byMonth.get('2026-02')).toMatchObject({ monthOverMonthDelta: '-24.30' }) // 24,30 in meno
    expect(byMonth.get('2026-05')).toMatchObject({ monthOverMonthDelta: '-54.70' }) // 54,70 in meno
    expect(byMonth.get('2026-06')).toMatchObject({ monthOverMonthDelta: '-28.70' }) // 28,70 in meno
    expect(byMonth.get('2026-07')).toMatchObject({ monthOverMonthDelta: '107.90' }) // 107,90 in più
  })

  test('an estimated month never carries a monthOverMonthDelta', async () => {
    const data = await getCategoryDetailYearWindow(42, 2026, { months: 12, from: '2026-01' })
    const estimatedMonths = data.current.months.filter((m) => m.state === 'estimated')
    expect(estimatedMonths.length).toBeGreaterThan(0)
    for (const month of estimatedMonths) {
      expect(month.monthOverMonthDelta).toBeNull()
    }
  })

  test('D-10: whole-year total/average exclude the uncovered month from both sum and denominator', async () => {
    const data = await getCategoryDetailYearWindow(42, 2026, { months: 12, from: '2026-01' })

    expect(data.current.total).toBe('4540.30')
    expect(data.current.coveredMonthCountInWindow).toBe(11)
    expect(data.current.average).toBe('412.75')
    expect(data.current.uncoveredMonthLabels).toEqual(['mar'])
  })

  test('window slice re-derives indices from window.from/window.months without re-clamping', async () => {
    const data = await getCategoryDetailYearWindow(42, 2026, { months: 6, from: '2026-02' })
    expect(data.current.months.map((m) => m.yearMonth)).toEqual([
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
    ])
  })

  test('an insufficient pace-eligible series leaves estimated amounts null and pace/projection null', async () => {
    coveredMonthsMocks.getCategoryMonthlyAmounts.mockResolvedValue(
      Object.keys(RAW_AMOUNTS_2026).map((yearMonth) => ({ yearMonth, amount: '0.00' })),
    )
    coveredMonthsMocks.getCoveredMonthsInYear.mockResolvedValue([
      { yearMonth: '2026-07', from: new Date('2026-07-01'), to: new Date('2026-07-01') },
    ])

    const data = await getCategoryDetailYearWindow(42, 2026, { months: 12, from: '2026-01' })

    expect(data.pace).toBeNull()
    expect(data.projection).toBeNull()
    const estimatedMonth = data.current.months.find((m) => m.yearMonth === '2026-08')
    expect(estimatedMonth?.amount).toBeNull()
  })
})
