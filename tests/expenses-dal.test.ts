import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  selectedShapes: [] as unknown[],
  whereArgs: [] as unknown[],
  rawRows: [] as unknown[],
}))

vi.mock('server-only', () => ({}))
vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))
vi.mock('@/lib/dal/auth', () => ({ verifySession: mocks.verifySession }))
vi.mock('@/lib/utils/date', () => ({
  periodToDateRange: () => ({
    from: new Date('2026-01-01T00:00:00.000Z'),
    to: new Date('2026-01-31T23:59:59.999Z'),
  }),
}))
vi.mock('@/lib/db', () => ({
  db: {
    select: (shape: unknown) => {
      mocks.selectedShapes.push(shape)
      if (
        typeof shape === 'object' &&
        shape !== null &&
        'total' in (shape as Record<string, unknown>)
      ) {
        return {
          from: vi.fn(() => ({
            where: vi.fn((arg: unknown) => {
              mocks.whereArgs.push(arg)
              return Promise.resolve([{ total: 7 }])
            }),
          })),
        }
      }
      // getExpenses: fetches the full filtered+joined row set (no SQL .limit()/.offset()) —
      // composition/sorting/pagination happens entirely in JS over mocks.rawRows (Task 1, GRP-03).
      const chain = {
        from: vi.fn(() => chain),
        leftJoin: vi.fn(() => chain),
        where: vi.fn((arg: unknown) => {
          mocks.whereArgs.push(arg)
          return Promise.resolve(mocks.rawRows)
        }),
      }
      return chain
    },
  },
}))
function mockSql(strings: TemplateStringsArray, ...values: unknown[]) {
  return { op: 'sql', strings, values }
}

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ op: 'and', args }),
  asc: (column: unknown) => ({ op: 'asc', column }),
  count: () => ({ op: 'count' }),
  desc: (column: unknown) => ({ op: 'desc', column }),
  eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
  gte: (left: unknown, right: unknown) => ({ op: 'gte', left, right }),
  ilike: (left: unknown, right: unknown) => ({ op: 'ilike', left, right }),
  inArray: (left: unknown, right: unknown) => ({ op: 'inArray', left, right }),
  isNull: (column: unknown) => ({ op: 'isNull', column }),
  lte: (left: unknown, right: unknown) => ({ op: 'lte', left, right }),
  or: (...args: unknown[]) => ({ op: 'or', args }),
  sql: Object.assign(mockSql, {}),
}))
vi.mock('@/lib/db/schema', () => ({
  category: {
    id: 'category.id',
    name: 'category.name',
    slug: 'category.slug',
  },
  expense: {
    id: 'expense.id',
    title: 'expense.title',
    status: 'expense.status',
    notes: 'expense.notes',
    createdAt: 'expense.createdAt',
    totalAmount: 'expense.totalAmount',
    updatedAt: 'expense.updatedAt',
    userId: 'expense.userId',
    subCategoryId: 'expense.subCategoryId',
    importedFromFileId: 'expense.importedFromFileId',
    firstTransactionAt: 'expense.firstTransactionAt',
    lastTransactionAt: 'expense.lastTransactionAt',
  },
  expenseGroup: {
    id: 'expenseGroup.id',
    title: 'expenseGroup.title',
    subCategoryId: 'expenseGroup.subCategoryId',
  },
  expenseGroupMembership: {
    groupId: 'expenseGroupMembership.groupId',
    expenseId: 'expenseGroupMembership.expenseId',
  },
  file: {
    id: 'file.id',
    userId: 'file.userId',
    importFormatVersionId: 'file.importFormatVersionId',
  },
  importFormatVersion: {
    id: 'importFormatVersion.id',
    platformId: 'importFormatVersion.platformId',
  },
  nature: {
    id: 'nature.id',
    code: 'nature.code',
    directionId: 'nature.directionId',
  },
  direction: {
    id: 'direction.id',
    code: 'direction.code',
  },
  platform: {
    id: 'platform.id',
    name: 'platform.name',
    slug: 'platform.slug',
  },
  subCategory: {
    id: 'subCategory.id',
    name: 'subCategory.name',
    categoryId: 'subCategory.categoryId',
    natureId: 'subCategory.natureId',
  },
  userSubcategoryOverride: {
    customName: 'userSubcategoryOverride.customName',
    subCategoryId: 'userSubcategoryOverride.subCategoryId',
    userId: 'userSubcategoryOverride.userId',
  },
}))

const {
  EXPENSE_LIST_LIMIT,
  expenseTitleSortKey,
  expenseCategorySortKey,
  expenseTotalAmountAbsSortKey,
  getExpenseSortColumn,
  getExpenses,
  getUncategorizedExpenseCount,
} = await import('../lib/dal/expenses')

type RawRow = {
  id: string
  title: string
  status: '1' | '2' | '3' | '4'
  notes: string | null
  createdAt: Date
  totalAmount: string
  transactionCount: number
  subCategoryId: number | null
  subCategoryName: string | null
  categoryName: string | null
  categorySlug: string | null
  categoryType: 'in' | 'out' | 'allocation' | 'system' | 'transfer' | null
  platformName: string | null
  firstTransactionAt: Date | null
  lastTransactionAt: Date | null
  groupId: number | null
  groupTitle: string | null
}

function makeRawRow(overrides: Partial<RawRow> = {}): RawRow {
  const createdAt = overrides.createdAt ?? new Date('2026-01-01T00:00:00.000Z')
  return {
    id: 'exp-1',
    title: 'Spesa',
    status: '3',
    notes: null,
    createdAt,
    totalAmount: '-10.00',
    transactionCount: 1,
    subCategoryId: 1,
    subCategoryName: 'Supermercato',
    categoryName: 'Casa',
    categorySlug: 'casa',
    categoryType: 'out',
    platformName: 'Intesa SP',
    firstTransactionAt: createdAt,
    lastTransactionAt: createdAt,
    groupId: null,
    groupTitle: null,
    ...overrides,
  }
}

describe('expense DAL list pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.selectedShapes.length = 0
    mocks.whereArgs.length = 0
    mocks.rawRows = []
    mocks.verifySession.mockResolvedValue({ userId: 'user-1' })
  })

  it('limits expenses to 50 rows by default for infinite loading', async () => {
    mocks.rawRows = Array.from({ length: 60 }, (_, i) =>
      makeRawRow({
        id: `exp-${i}`,
        createdAt: new Date(2026, 0, i + 1),
      }),
    )

    const result = await getExpenses()

    expect(EXPENSE_LIST_LIMIT).toBe(50)
    expect(mocks.verifySession).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(50)
    // Default sort createdAt desc — most recent (highest index) first.
    expect(result[0].id).toBe('exp-59')
    expect(result[49].id).toBe('exp-10')
    expect((mocks.selectedShapes[0] as { subCategoryName: unknown }).subCategoryName).toMatchObject({ op: 'sql' })
  })

  it('applies explicit pagination offsets without changing user scoping', async () => {
    mocks.rawRows = Array.from({ length: 150 }, (_, i) =>
      makeRawRow({ id: `exp-${i}`, createdAt: new Date(2026, 0, i + 1) }),
    )

    const result = await getExpenses({ status: 'categorized' }, { limit: 50, offset: 100 })

    expect(result).toHaveLength(50)
    // offset 100 in a desc-by-createdAt list of 150 (idx 0..149) → idx 49..0
    expect(result[0].id).toBe('exp-49')
    expect(result[49].id).toBe('exp-0')
    expect(mocks.whereArgs[0]).toEqual({
      op: 'and',
      args: expect.arrayContaining([
        { op: 'eq', left: 'expense.userId', right: 'user-1' },
        // Wave 4: status categorized → inArray(['2','3'])
        { op: 'inArray', left: 'expense.status', right: ['2', '3'] },
      ]),
    })
  })

  it('orders expenses by total amount when requested', async () => {
    mocks.rawRows = [
      makeRawRow({ id: 'small', totalAmount: '-5.00' }),
      makeRawRow({ id: 'large', totalAmount: '-500.00' }),
      makeRawRow({ id: 'medium', totalAmount: '-50.00' }),
    ]

    const result = await getExpenses({ sort: 'totalAmount', dir: 'asc' })

    expect(result.map((r) => r.id)).toEqual(['small', 'medium', 'large'])
  })

  it('orders category sort with incomplete rows last in both directions', async () => {
    mocks.rawRows = [
      makeRawRow({ id: 'complete-b', categoryName: 'Casa', subCategoryName: 'Bollette' }),
      makeRawRow({ id: 'incomplete', categoryName: null, subCategoryName: null }),
      makeRawRow({ id: 'complete-a', categoryName: 'Auto', subCategoryName: 'Benzina' }),
    ]

    const desc = await getExpenses({ sort: 'category', dir: 'desc' })
    expect(desc.map((r) => r.id)).toEqual(['complete-b', 'complete-a', 'incomplete'])

    const asc = await getExpenses({ sort: 'category', dir: 'asc' })
    expect(asc.map((r) => r.id)).toEqual(['complete-a', 'complete-b', 'incomplete'])
  })

  it('maps sort keys to DAL columns and expressions', () => {
    expect(getExpenseSortColumn('createdAt')).toBe('expense.createdAt')
    expect(getExpenseSortColumn('totalAmount')).toBe(expenseTotalAmountAbsSortKey)
    expect(getExpenseSortColumn('title')).toBe(expenseTitleSortKey)
    expect(getExpenseSortColumn('category')).toBe(expenseCategorySortKey)
  })

  // ── Wave 4: this-month default removed (D-05) ──────────────────────────────

  it('no date clamp applied when no period filter is passed (D-05 — this-month default removed)', async () => {
    await getExpenses({})

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    // Should only have the userId condition (no gte/lte date predicates)
    const hasGte = where.args.some(
      (arg) =>
        typeof arg === 'object' &&
        arg !== null &&
        (arg as { op?: string }).op === 'gte',
    )
    const hasLte = where.args.some(
      (arg) =>
        typeof arg === 'object' &&
        arg !== null &&
        (arg as { op?: string }).op === 'lte',
    )
    expect(hasGte).toBe(false)
    expect(hasLte).toBe(false)
  })

  it('date range is applied only when period is explicitly passed', async () => {
    await getExpenses({ period: 'last-3-months' })

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    // period set → gte + lte should be added
    const hasGte = where.args.some(
      (arg) =>
        typeof arg === 'object' &&
        arg !== null &&
        (arg as { op?: string }).op === 'gte',
    )
    expect(hasGte).toBe(true)
  })

  // ── Wave 4: status 4 → uncategorized bucket (O-01) ────────────────────────

  it("status 'uncategorized' maps to inArray(expense.status, ['1','4']) — O-01", async () => {
    await getExpenses({ status: 'uncategorized' })

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    expect(where.args).toEqual(
      expect.arrayContaining([
        { op: 'inArray', left: 'expense.status', right: ['1', '4'] },
      ]),
    )
  })

  it("status 'categorized' maps to inArray(expense.status, ['2','3'])", async () => {
    await getExpenses({ status: 'categorized' })

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    expect(where.args).toEqual(
      expect.arrayContaining([
        { op: 'inArray', left: 'expense.status', right: ['2', '3'] },
      ]),
    )
  })

  // ── Wave 4: amountMin/amountMax now applied to the FINAL composed totals (Task 1) ──────

  it('amountMin filters the composed output by |totalAmount| >= amountMin, not as a SQL condition', async () => {
    mocks.rawRows = [
      makeRawRow({ id: 'below', totalAmount: '-10.00' }),
      makeRawRow({ id: 'above', totalAmount: '-100.00' }),
    ]

    const result = await getExpenses({ amountMin: '50' })

    expect(result.map((r) => r.id)).toEqual(['above'])
    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    const hasSqlAmountCondition = where.args.some(
      (arg) =>
        typeof arg === 'object' &&
        arg !== null &&
        (arg as { op?: string }).op === 'sql' &&
        ((arg as { strings?: string[] }).strings ?? []).join('').includes('ABS'),
    )
    expect(hasSqlAmountCondition).toBe(false)
  })

  it('amountMax filters the composed output by |totalAmount| <= amountMax, not as a SQL condition', async () => {
    mocks.rawRows = [
      makeRawRow({ id: 'below', totalAmount: '-10.00' }),
      makeRawRow({ id: 'above', totalAmount: '-1000.00' }),
    ]

    const result = await getExpenses({ amountMax: '500' })

    expect(result.map((r) => r.id)).toEqual(['below'])
  })

  // ── lcp-01 Task 3: cascade filters (nature / type / subCategoryId) ─────────

  it("nature 'unclassified' adds or(isNull(subCategoryId), isNull(nature)) condition", async () => {
    await getExpenses({ nature: 'unclassified' })

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    const orCondition = where.args.find(
      (arg) =>
        typeof arg === 'object' &&
        arg !== null &&
        (arg as { op?: string }).op === 'or',
    ) as { op: string; args: unknown[] } | undefined

    expect(orCondition).toBeDefined()
    // or(...) should contain isNull conditions
    const hasIsNull = orCondition!.args.some(
      (a) =>
        typeof a === 'object' &&
        a !== null &&
        (a as { op?: string }).op === 'isNull',
    )
    expect(hasIsNull).toBe(true)
  })

  it("nature with a specific value adds eq(nature.code, value) condition", async () => {
    await getExpenses({ nature: 'essential' })

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    expect(where.args).toContainEqual({
      op: 'eq',
      left: 'nature.code',
      right: 'essential',
    })
  })

  it("direction 'unclassified' adds isNull(subCategory.natureId) condition", async () => {
    await getExpenses({ direction: 'unclassified' })

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    expect(where.args).toContainEqual({
      op: 'isNull',
      column: 'subCategory.natureId',
    })
  })

  it("direction with a specific value adds eq(direction.code, value) condition", async () => {
    await getExpenses({ direction: 'out' })

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    expect(where.args).toContainEqual({
      op: 'eq',
      left: 'direction.code',
      right: 'out',
    })
  })

  it('subCategoryId adds eq(subCategory.id, value) condition', async () => {
    await getExpenses({ subCategoryId: 42 })

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    expect(where.args).toContainEqual({
      op: 'eq',
      left: 'subCategory.id',
      right: 42,
    })
  })

  // ── Task 1 (65-03): search matches member title OR group title ────────────

  it('search term (q) adds or(ilike(expense.title), ilike(expenseGroup.title)) condition', async () => {
    await getExpenses({ q: 'super' })

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    const orCondition = where.args.find(
      (arg) =>
        typeof arg === 'object' &&
        arg !== null &&
        (arg as { op?: string }).op === 'or' &&
        (arg as { args?: unknown[] }).args?.some(
          (a) => typeof a === 'object' && a !== null && (a as { op?: string }).op === 'ilike',
        ),
    ) as { op: string; args: Array<{ op: string; left: unknown; right: unknown }> } | undefined

    expect(orCondition).toBeDefined()
    expect(orCondition!.args).toContainEqual({ op: 'ilike', left: 'expense.title', right: '%super%' })
    expect(orCondition!.args).toContainEqual({ op: 'ilike', left: 'expenseGroup.title', right: '%super%' })
  })

  // ── Task 1 (65-03): read-time Expense Group composition (GRP-03) ──────────

  describe('Expense Group composition', () => {
    it('is a pure pass-through when no row carries an expenseGroupMembership entry (regression safety)', async () => {
      const row = makeRawRow({ id: 'exp-solo', platformName: 'Revolut' })
      mocks.rawRows = [row]

      const result = await getExpenses()

      expect(result).toEqual([row])
    })

    it('collapses N grouped member rows into one composed row with Decimal.js-correct summed totals', async () => {
      mocks.rawRows = [
        makeRawRow({
          id: 'member-1',
          groupId: 5,
          groupTitle: 'Spesa supermercato',
          totalAmount: '-10.00',
          transactionCount: 1,
          firstTransactionAt: new Date('2026-01-05'),
          lastTransactionAt: new Date('2026-01-05'),
          platformName: 'Intesa SP',
        }),
        makeRawRow({
          id: 'member-2',
          groupId: 5,
          groupTitle: 'Spesa supermercato',
          totalAmount: '-20.50',
          transactionCount: 2,
          firstTransactionAt: new Date('2026-01-01'),
          lastTransactionAt: new Date('2026-01-10'),
          platformName: 'Revolut',
        }),
        makeRawRow({
          id: 'member-3',
          groupId: 5,
          groupTitle: 'Spesa supermercato',
          totalAmount: '-5.25',
          transactionCount: 3,
          firstTransactionAt: new Date('2026-01-15'),
          lastTransactionAt: new Date('2026-01-20'),
          platformName: 'Satispay',
        }),
      ]

      const result = await getExpenses()

      expect(result).toHaveLength(1)
      const [group] = result
      expect(group.id).toBe('group:5')
      expect(group.title).toBe('Spesa supermercato')
      expect(group.status).toBe('3')
      expect(group.totalAmount).toBe('-35.75')
      expect(group.transactionCount).toBe(6)
      expect(group.firstTransactionAt).toEqual(new Date('2026-01-01'))
      expect(group.lastTransactionAt).toEqual(new Date('2026-01-20'))
      // A group spanning multiple platforms is not guessed — left null (GRP-03).
      expect(group.platformName).toBeNull()
      expect(group.groupId).toBe(5)
      expect(group.groupTitle).toBe('Spesa supermercato')
    })

    it('never splits a group across two limit/offset pages', async () => {
      mocks.rawRows = [
        makeRawRow({ id: 'member-1', groupId: 5, groupTitle: 'Gruppo', createdAt: new Date('2026-01-10') }),
        makeRawRow({ id: 'member-2', groupId: 5, groupTitle: 'Gruppo', createdAt: new Date('2026-01-10') }),
        makeRawRow({ id: 'exp-solo-1', createdAt: new Date('2026-01-05') }),
        makeRawRow({ id: 'exp-solo-2', createdAt: new Date('2026-01-01') }),
      ]

      // Composition happens before pagination: 4 raw rows collapse to 3 composed entities
      // (1 group + 2 ungrouped) BEFORE the limit/offset slice is taken.
      const page1 = await getExpenses({}, { limit: 1, offset: 0 })
      expect(page1).toHaveLength(1)
      expect(page1[0].id).toBe('group:5')

      const page2 = await getExpenses({}, { limit: 1, offset: 1 })
      expect(page2).toHaveLength(1)
      expect(page2[0].id).toBe('exp-solo-1')

      const page3 = await getExpenses({}, { limit: 1, offset: 2 })
      expect(page3).toHaveLength(1)
      expect(page3[0].id).toBe('exp-solo-2')
    })

    it("leaves an ungrouped expense's output fields unchanged from before this phase", async () => {
      const row = makeRawRow({ id: 'exp-unchanged', groupId: null, groupTitle: null })
      mocks.rawRows = [row]

      const [result] = await getExpenses()

      expect(result).toEqual(row)
    })
  })
})

describe('getUncategorizedExpenseCount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.whereArgs.length = 0
    mocks.verifySession.mockResolvedValue({ userId: 'user-1' })
  })

  it("counts expenses with status in ['1','4'] for the current user", async () => {
    const total = await getUncategorizedExpenseCount()

    expect(total).toBe(7)
    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    expect(where.args).toEqual(
      expect.arrayContaining([
        { op: 'eq', left: 'expense.userId', right: 'user-1' },
        { op: 'inArray', left: 'expense.status', right: ['1', '4'] },
      ]),
    )
  })
})
