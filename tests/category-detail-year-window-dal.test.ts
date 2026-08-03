import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

// Task 1 (84-01/84-02): mocks @/lib/dal/covered-months's getCoveredMonthsInYear/
// getCategoryMonthlyAmounts and @/lib/dal/auth's verifySession. The category-metadata query and
// the two new query families (subcategory contributions, window-scoped top transactions) go
// through a real chain mock on @/lib/db, routed by the shape of the `.select({...})` columns
// object rather than by call order — getCategoryDetailMeta has its own internal
// `await verifySession()` before its db.select() call, which reorders db.select() invocations
// relative to the plain synchronous helpers below it in the same Promise.all.
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

// dateScopedTransactions is wrapped (not replaced) so the "topTransactions (D-05)" window-scoping
// test below can assert on its call arguments — real and()/eq()/gte()/lte() logic is preserved,
// only the wrapping vi.fn() adds call-recording.
const dashboardFiltersMocks = vi.hoisted(() => ({ dateScopedTransactions: vi.fn() }))
vi.mock('@/lib/dal/dashboard-filters', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/dal/dashboard-filters')>('@/lib/dal/dashboard-filters')
  dashboardFiltersMocks.dateScopedTransactions.mockImplementation(actual.dateScopedTransactions)
  return { ...actual, dateScopedTransactions: dashboardFiltersMocks.dateScopedTransactions }
})

const categoryMetaRow = vi.hoisted(() => ({
  rows: [{ id: 42, name: 'Alimentari & Ristorazione', slug: 'alimentari-ristorazione', type: 'out' as const }],
}))

// Shifted in declared-call order: getSubcategoryWindowAmounts is called for the CURRENT window
// first, then the PREVIOUS window — both are synchronous (no internal await) so their mutual
// order is deterministic regardless of getCategoryDetailMeta's interleaving.
const subcategoryRowsQueue = vi.hoisted(() => ({ queue: [] as unknown[][] }))
const topTransactionRowsMock = vi.hoisted(() => ({ rows: [] as unknown[] }))

vi.mock('@/lib/db', () => {
  function makeChain(rows: unknown[]) {
    const chain: Record<string, unknown> = {
      from: vi.fn(() => chain),
      innerJoin: vi.fn(() => chain),
      leftJoin: vi.fn(() => chain),
      where: vi.fn(() => chain),
      groupBy: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn((n: number) => Promise.resolve(rows.slice(0, n))),
      // Thenable: getSubcategoryWindowAmounts awaits the chain directly after .groupBy(), with
      // no terminal .limit() call.
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(rows).then(resolve, reject),
    }
    return chain
  }

  return {
    db: {
      select: vi.fn((columns: Record<string, unknown>) => {
        if ('type' in columns) return makeChain(categoryMetaRow.rows)
        if ('subCategoryId' in columns) return makeChain(subcategoryRowsQueue.queue.shift() ?? [])
        if ('occurredAt' in columns) return makeChain(topTransactionRowsMock.rows)
        return makeChain([])
      }),
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
  subCategory: {
    id: 'subCategory.id',
    name: 'subCategory.name',
    slug: 'subCategory.slug',
    categoryId: 'subCategory.categoryId',
    isActive: 'subCategory.isActive',
    userId: 'subCategory.userId',
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
    includedInTotals: 'direction.includedInTotals',
  },
  nature: {
    id: 'nature.id',
    directionId: 'nature.directionId',
  },
  expense: {
    id: 'expense.id',
    subCategoryId: 'expense.subCategoryId',
    status: 'expense.status',
    title: 'expense.title',
  },
  expenseGroup: {
    id: 'expenseGroup.id',
    title: 'expenseGroup.title',
  },
  expenseGroupMembership: {
    groupId: 'expenseGroupMembership.groupId',
    expenseId: 'expenseGroupMembership.expenseId',
  },
  transaction: {
    id: 'transaction.id',
    description: 'transaction.description',
    customTitle: 'transaction.customTitle',
    amount: 'transaction.amount',
  },
  ledgerEntryCash: {
    id: 'ledgerEntryCash.id',
    userId: 'ledgerEntryCash.userId',
    occurredAt: 'ledgerEntryCash.occurredAt',
    amount: 'ledgerEntryCash.amount',
    expenseId: 'ledgerEntryCash.expenseId',
  },
  ledgerEntryAccrual: {
    id: 'ledgerEntryAccrual.id',
    userId: 'ledgerEntryAccrual.userId',
    occurredAt: 'ledgerEntryAccrual.occurredAt',
    amount: 'ledgerEntryAccrual.amount',
    expenseId: 'ledgerEntryAccrual.expenseId',
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

// Deliberately a flat 350.00/month (NOT the prototype's own hand-typed row values, whose
// printed Totale 4.284,00 does not actually equal the sum of its own 12 printed cells —
// 4.274,00 — a static-mockup inconsistency documented in 84-RESEARCH.md's "two examples
// contained real defects" note. A clean, self-consistent fixture is used here instead so this
// test's expected total/average are independently verifiable by hand.
const RAW_AMOUNTS_2025: Record<string, string> = {
  '2025-01': '350.00',
  '2025-02': '350.00',
  '2025-03': '350.00',
  '2025-04': '350.00',
  '2025-05': '350.00',
  '2025-06': '350.00',
  '2025-07': '350.00',
  '2025-08': '350.00',
  '2025-09': '350.00',
  '2025-10': '350.00',
  '2025-11': '350.00',
  '2025-12': '350.00',
}

function toMonthRows(amounts: Record<string, string>) {
  return Object.entries(amounts).map(([yearMonth, amount]) => ({ yearMonth, amount }))
}

function toCoveredRows(months: string[]) {
  return months.map((yearMonth) => ({ yearMonth, from: new Date(`${yearMonth}-01`), to: new Date(`${yearMonth}-01`) }))
}

function seedFixture() {
  coveredMonthsMocks.getCategoryMonthlyAmounts.mockImplementation(async (_categoryId: number, year: number) =>
    year === 2026 ? toMonthRows(RAW_AMOUNTS_2026) : toMonthRows(RAW_AMOUNTS_2025),
  )
  coveredMonthsMocks.getCoveredMonthsInYear.mockImplementation(async (year: number) =>
    year === 2026
      ? toCoveredRows(COVERED_MONTHS_2026)
      : toCoveredRows(Object.keys(RAW_AMOUNTS_2025)),
  )
}

describe('getCategoryDetailYearWindow (D-06/D-07/D-10, Task 1)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 15)) // 15 luglio 2026
    coveredMonthsMocks.getCoveredMonthsInYear.mockReset()
    coveredMonthsMocks.getCategoryMonthlyAmounts.mockReset()
    subcategoryRowsQueue.queue = []
    topTransactionRowsMock.rows = []
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
    coveredMonthsMocks.getCategoryMonthlyAmounts.mockImplementation(async () =>
      Object.keys(RAW_AMOUNTS_2026).map((yearMonth) => ({ yearMonth, amount: '0.00' })),
    )
    coveredMonthsMocks.getCoveredMonthsInYear.mockImplementation(async () => [
      { yearMonth: '2026-07', from: new Date('2026-07-01'), to: new Date('2026-07-01') },
    ])

    const data = await getCategoryDetailYearWindow(42, 2026, { months: 12, from: '2026-01' })

    expect(data.pace).toBeNull()
    expect(data.projection).toBeNull()
    const estimatedMonth = data.current.months.find((m) => m.yearMonth === '2026-08')
    expect(estimatedMonth?.amount).toBeNull()
  })

  describe('previousYear (D-11/D-12, Task 2 prep)', () => {
    test('zero Covered Months in the 2025 homologous window -> unavailable', async () => {
      coveredMonthsMocks.getCoveredMonthsInYear.mockImplementation(async (year: number) =>
        year === 2026 ? toCoveredRows(COVERED_MONTHS_2026) : [],
      )

      const data = await getCategoryDetailYearWindow(42, 2026, { months: 12, from: '2026-01' })
      expect(data.previousYear).toEqual({ status: 'unavailable' })
    })

    test('whole-year window: 12 Covered Months in 2025 -> available, totalDifference shown', async () => {
      const data = await getCategoryDetailYearWindow(42, 2026, { months: 12, from: '2026-01' })

      expect(data.previousYear.status).toBe('available')
      if (data.previousYear.status !== 'available') throw new Error('unreachable')
      // 12 x 350.00
      expect(data.previousYear.series.total).toBe('4200.00')
      expect(data.previousYear.series.average).toBe('350.00')
      // current.total 4540.30 - previous.total 4200.00
      expect(data.previousYear.totalDifference).toEqual({ status: 'shown', value: '340.30' })
      // current.average 412.75 - previous.average 350.00
      expect(data.previousYear.averageDifference).toBe('62.75')
    })

    test('3 Covered Months in the homologous window (below the 6-month threshold): available, totalDifference insufficient, averageDifference still present', async () => {
      coveredMonthsMocks.getCoveredMonthsInYear.mockImplementation(async (year: number) =>
        year === 2026 ? toCoveredRows(COVERED_MONTHS_2026) : toCoveredRows(['2025-01', '2025-02', '2025-03']),
      )

      const data = await getCategoryDetailYearWindow(42, 2026, { months: 12, from: '2026-01' })

      expect(data.previousYear.status).toBe('available')
      if (data.previousYear.status !== 'available') throw new Error('unreachable')
      expect(data.previousYear.totalDifference).toEqual({ status: 'insufficient', coveredMonthCount: 3 })
      expect(data.previousYear.averageDifference).not.toBeNull()
      expect(typeof data.previousYear.averageDifference).toBe('string')
    })
  })

  describe('subcategories (D-16, Task 2 prep)', () => {
    // CR-01 fix (84-REVIEW.md): the OLD version of this test derived `expectedDifference` from
    // `data.subcategories` itself (currentTotal/previousTotal summed from the very array under
    // test) — a tautology that could never catch the divergence between the subcategory sum and
    // the parent category's own difference. This fixture instead makes the mocked subcategory
    // rows a genuine partition of the category-level RAW (non-pace-projected) window totals:
    // current raw total 2510.30 = sum of RAW_AMOUNTS_2026's Jan-Jul (412.50+388.20+455.80+401.10
    // +372.40+480.30, March excluded/uncovered contributes 0, Aug-Dec not-yet-happened contribute
    // 0 raw) = 2280.30 (id 1) + 230.00 (id 4); previous raw total 4200.00 (12 x 350.00) =
    // 3970.00 (id 1) + 230.00 (id 5). The window (whole year 2026, system time fixed to
    // 2026-07-15) deliberately includes the calendar-current month AND future 'estimated' months,
    // so `data.current.total` (row 1, pace/hybrid-projected) is 4540.30 — provably NOT what the
    // subcategory contributions sum to; `previousYear.rawTotalDifference` IS.
    test('exact-sum (CR-01 fix): contributions sum to the RAW parent difference (previousYear.rawTotalDifference), never the pace/hybrid-projected current.total, for a window including the calendar-current month', async () => {
      subcategoryRowsQueue.queue = [
        // current window — a genuine partition of the RAW current total (2510.30)
        [
          { subCategoryId: 1, subCategoryName: 'Spesa quotidiana', subCategorySlug: 'spesa-quotidiana', amount: '2280.30' },
          { subCategoryId: 4, subCategoryName: 'Consegna a domicilio', subCategorySlug: 'consegna-a-domicilio', amount: '230.00' },
        ],
        // previous (homologous) window — a genuine partition of the RAW previous total (4200.00)
        [
          { subCategoryId: 1, subCategoryName: 'Spesa quotidiana', subCategorySlug: 'spesa-quotidiana', amount: '3970.00' },
          { subCategoryId: 5, subCategoryName: 'Mensa aziendale', subCategorySlug: 'mensa-aziendale', amount: '230.00' },
        ],
      ]

      const data = await getCategoryDetailYearWindow(42, 2026, { months: 12, from: '2026-01' })

      // Sanity: row 1's own total is pace/hybrid-projected (includes Aug-Dec pace) — deliberately
      // NOT what the subcategory block is checked against below (that mismatch was the CR-01 bug).
      expect(data.current.total).toBe('4540.30')

      const currentOnly = data.subcategories.find((s) => s.id === 4)
      const previousOnly = data.subcategories.find((s) => s.id === 5)
      expect(currentOnly).toMatchObject({ presence: 'current-only', contribution: '230.00' })
      expect(previousOnly).toMatchObject({ presence: 'previous-only', contribution: '-230.00', weightPercentage: 0 })

      expect(data.previousYear.status).toBe('available')
      if (data.previousYear.status !== 'available') throw new Error('unreachable')
      // The parent-level RAW difference (CR-01 fix): 2510.30 - 4200.00 = -1689.70. Computed by
      // the DAL from `amountByMonth` (the month-level fixture), entirely independent of
      // `data.subcategories` — never a self-referential derivation.
      expect(data.previousYear.rawTotalDifference).toEqual({ status: 'shown', value: '-1689.70' })
      const { rawTotalDifference } = data.previousYear
      if (rawTotalDifference.status !== 'shown') throw new Error('unreachable')

      const { toDecimal } = await import('@/lib/utils/decimal')
      const summed = data.subcategories
        .reduce((sum, s) => sum.plus(toDecimal(s.contribution)), toDecimal(0))
        .toFixed(2)

      expect(summed).toBe(rawTotalDifference.value)
    })

    test('sorted by currentAmount descending', async () => {
      subcategoryRowsQueue.queue = [
        [
          { subCategoryId: 1, subCategoryName: 'Piccola', subCategorySlug: 'piccola', amount: '10.00' },
          { subCategoryId: 2, subCategoryName: 'Grande', subCategorySlug: 'grande', amount: '500.00' },
        ],
        [],
      ]

      const data = await getCategoryDetailYearWindow(42, 2026, { months: 12, from: '2026-01' })
      expect(data.subcategories.map((s) => s.id)).toEqual([2, 1])
    })
  })

  describe('topTransactions (D-05, Task 2 prep)', () => {
    test('maps DB rows to CategoryDetailTopTransaction, applying the title fallback chain', async () => {
      topTransactionRowsMock.rows = [
        {
          id: 'tx-1',
          description: 'PAGAMENTO POS ESSELUNGA',
          customTitle: null,
          groupTitle: null,
          amount: '-45.30',
          occurredAt: new Date('2026-07-10'),
        },
        {
          id: 'tx-2',
          description: 'PAGAMENTO POS RISTORANTE',
          customTitle: 'Cena compleanno',
          groupTitle: null,
          amount: '-88.00',
          occurredAt: new Date('2026-07-05'),
        },
      ]

      const data = await getCategoryDetailYearWindow(42, 2026, { months: 12, from: '2026-01' })

      expect(data.topTransactions).toEqual([
        { id: 'tx-1', title: 'PAGAMENTO POS ESSELUNGA', description: 'PAGAMENTO POS ESSELUNGA', date: '2026-07-10', amount: '45.30' },
        { id: 'tx-2', title: 'Cena compleanno', description: 'PAGAMENTO POS RISTORANTE', date: '2026-07-05', amount: '88.00' },
      ])
    })

    test('is scoped to the WINDOW date range, never the full calendar year', async () => {
      dashboardFiltersMocks.dateScopedTransactions.mockClear()

      await getCategoryDetailYearWindow(42, 2026, { months: 3, from: '2026-05' })

      const fullYearFrom = new Date(2026, 0, 1)
      const fullYearTo = new Date(2026, 11, 31, 23, 59, 59, 999)
      const windowFrom = new Date(2026, 4, 1)
      const windowTo = new Date(2026, 6, 31, 23, 59, 59, 999)

      const callArgs = dashboardFiltersMocks.dateScopedTransactions.mock.calls.map((call) => ({
        from: call[2] as Date,
        to: call[3] as Date,
      }))
      expect(callArgs.some((c) => c.from.getTime() === windowFrom.getTime() && c.to.getTime() === windowTo.getTime())).toBe(true)
      expect(
        callArgs.some((c) => c.from.getTime() === fullYearFrom.getTime() && c.to.getTime() === fullYearTo.getTime()),
      ).toBe(false)
    })
  })
})
