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
    orderBy: vi.fn((arg: unknown) => {
      mocks.orderByArgs.push(arg)
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
  },
  subCategory: {
    id: 'subCategory.id',
    name: 'subCategory.name',
    categoryId: 'subCategory.categoryId',
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
    expect(mocks.orderByArgs[0]).toEqual({ op: 'desc', column: 'expense.createdAt' })
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
        {
          op: 'or',
          args: [
            { op: 'eq', left: 'expense.status', right: '2' },
            { op: 'eq', left: 'expense.status', right: '3' },
          ],
        },
      ]),
    })
  })

  it('orders expenses by total amount when requested', async () => {
    await getExpenses({ sort: 'totalAmount', dir: 'asc' })

    expect(mocks.orderByArgs[0]).toEqual({ op: 'asc', column: 'expense.totalAmount' })
  })
})
