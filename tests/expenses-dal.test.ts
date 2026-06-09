import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  selectedShapes: [] as unknown[],
  whereArgs: [] as unknown[],
  orderByArgs: [] as unknown[],
  limitArgs: [] as number[],
  offsetArgs: [] as number[],
}))

function makeQueryChain(finalValue: unknown[] = []) {
  const chain = {
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    where: vi.fn((arg: unknown) => {
      mocks.whereArgs.push(arg)
      return chain
    }),
    orderBy: vi.fn((...args: unknown[]) => {
      mocks.orderByArgs.push(...args)
      return chain
    }),
    limit: vi.fn((arg: number) => {
      mocks.limitArgs.push(arg)
      return chain
    }),
    offset: vi.fn((arg: number) => {
      mocks.offsetArgs.push(arg)
      return Promise.resolve(finalValue)
    }),
  }

  return chain
}

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
      return makeQueryChain([])
    },
  },
}))
function mockSql(strings: TemplateStringsArray, ...values: unknown[]) {
  return { op: 'sql', strings, values }
}

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ op: 'and', args }),
  asc: (column: unknown) => ({ op: 'asc', column }),
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
    type: 'category.type',
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
  platform: {
    id: 'platform.id',
    name: 'platform.name',
    slug: 'platform.slug',
  },
  subCategory: {
    id: 'subCategory.id',
    name: 'subCategory.name',
    categoryId: 'subCategory.categoryId',
    nature: 'subCategory.nature',
  },
  userSubcategoryOverride: {
    customName: 'userSubcategoryOverride.customName',
    subCategoryId: 'userSubcategoryOverride.subCategoryId',
    userId: 'userSubcategoryOverride.userId',
  },
}))

const { EXPENSE_LIST_LIMIT, getExpenses } = await import('../lib/dal/expenses')

describe('expense DAL list pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.selectedShapes.length = 0
    mocks.whereArgs.length = 0
    mocks.orderByArgs.length = 0
    mocks.limitArgs.length = 0
    mocks.offsetArgs.length = 0
    mocks.verifySession.mockResolvedValue({ userId: 'user-1' })
  })

  it('limits expenses to 50 rows by default for infinite loading', async () => {
    await getExpenses()

    expect(EXPENSE_LIST_LIMIT).toBe(50)
    expect(mocks.verifySession).toHaveBeenCalledTimes(1)
    expect(mocks.limitArgs).toEqual([EXPENSE_LIST_LIMIT])
    expect(mocks.offsetArgs).toEqual([0])
    expect(mocks.orderByArgs).toEqual([
      { op: 'desc', column: 'expense.createdAt' },
      { op: 'desc', column: 'expense.id' },
    ])
    expect((mocks.selectedShapes[0] as { subCategoryName: unknown }).subCategoryName).toMatchObject({ op: 'sql' })
  })

  it('applies explicit pagination offsets without changing user scoping', async () => {
    await getExpenses({ status: 'categorized' }, { limit: 50, offset: 100 })

    expect(mocks.limitArgs).toEqual([50])
    expect(mocks.offsetArgs).toEqual([100])
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
    await getExpenses({ sort: 'totalAmount', dir: 'asc' })

    expect(mocks.orderByArgs).toEqual([
      { op: 'asc', column: 'expense.totalAmount' },
      { op: 'asc', column: 'expense.id' },
    ])
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

  // ── Wave 4: amountMin/amountMax ABS conditions ─────────────────────────────

  it('amountMin adds ABS(totalAmount::numeric) >= amountMin::numeric condition', async () => {
    await getExpenses({ amountMin: '50' })

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    const amountMinCondition = where.args.find(
      (arg) =>
        typeof arg === 'object' &&
        arg !== null &&
        (arg as { op?: string }).op === 'sql' &&
        ((arg as { strings?: string[] }).strings ?? []).join('').includes('>='),
    ) as { op: string; strings: string[]; values: unknown[] } | undefined

    expect(amountMinCondition).toBeDefined()
    expect(amountMinCondition!.strings.join('')).toContain('ABS')
    expect(amountMinCondition!.values).toContain('50')
  })

  it('amountMax adds ABS(totalAmount::numeric) <= amountMax::numeric condition', async () => {
    await getExpenses({ amountMax: '500' })

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    const amountMaxCondition = where.args.find(
      (arg) =>
        typeof arg === 'object' &&
        arg !== null &&
        (arg as { op?: string }).op === 'sql' &&
        ((arg as { strings?: string[] }).strings ?? []).join('').includes('<='),
    ) as { op: string; strings: string[]; values: unknown[] } | undefined

    expect(amountMaxCondition).toBeDefined()
    expect(amountMaxCondition!.values).toContain('500')
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

  it("nature with a specific value adds eq(subCategory.nature, value) condition", async () => {
    await getExpenses({ nature: 'essential' })

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    expect(where.args).toContainEqual({
      op: 'eq',
      left: 'subCategory.nature',
      right: 'essential',
    })
  })

  it("type 'unclassified' adds isNull(category.type) condition", async () => {
    await getExpenses({ type: 'unclassified' })

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    expect(where.args).toContainEqual({
      op: 'isNull',
      column: 'category.type',
    })
  })

  it("type with a specific value adds eq(category.type, value) condition", async () => {
    await getExpenses({ type: 'out' })

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    expect(where.args).toContainEqual({
      op: 'eq',
      left: 'category.type',
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
})
