import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any module imports
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  dbSelectChain: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    cache: (fn: (...args: unknown[]) => unknown) => fn,
  }
})

vi.mock('@/lib/dal/auth', () => ({
  verifySession: vi.fn(),
}))

vi.mock('@/lib/dal/classification-history', () => ({
  writeClassificationHistory: vi.fn(),
}))

vi.mock('@/lib/utils/date', () => ({
  periodToDateRange: vi.fn(() => ({ from: new Date(), to: new Date() })),
}))

// String-keyed column stand-ins mirror tests/transaction-detail-dal.test.ts.
vi.mock('@/lib/db/schema', () => ({
  expense: {
    id: 'expense.id',
    userId: 'expense.userId',
    title: 'expense.title',
    status: 'expense.status',
    notes: 'expense.notes',
    createdAt: 'expense.createdAt',
    totalAmount: 'expense.totalAmount',
    transactionCount: 'expense.transactionCount',
    subCategoryId: 'expense.subCategoryId',
    importedFromFileId: 'expense.importedFromFileId',
  },
  transaction: {
    id: 'transaction.id',
    userId: 'transaction.userId',
    expenseId: 'transaction.expenseId',
    description: 'transaction.description',
    customTitle: 'transaction.customTitle',
    amount: 'transaction.amount',
    currency: 'transaction.currency',
    occurredAt: 'transaction.occurredAt',
  },
  file: {
    id: 'file.id',
    displayName: 'file.displayName',
    originalName: 'file.originalName',
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
    natureId: 'subCategory.natureId',
  },
  category: {
    id: 'category.id',
    name: 'category.name',
    slug: 'category.slug',
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
  userSubcategoryOverride: {
    subCategoryId: 'userSubcategoryOverride.subCategoryId',
    userId: 'userSubcategoryOverride.userId',
    customName: 'userSubcategoryOverride.customName',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
  and: (...args: unknown[]) => ({ op: 'and', args }),
  or: (...args: unknown[]) => ({ op: 'or', args }),
  asc: (col: unknown) => ({ op: 'asc', col }),
  desc: (col: unknown) => ({ op: 'desc', col }),
  isNull: (col: unknown) => ({ op: 'isNull', col }),
  ilike: (col: unknown, pattern: unknown) => ({ op: 'ilike', col, pattern }),
  inArray: (col: unknown, values: unknown) => ({ op: 'inArray', col, values }),
  gte: (col: unknown, value: unknown) => ({ op: 'gte', col, value }),
  lte: (col: unknown, value: unknown) => ({ op: 'lte', col, value }),
  count: () => ({ op: 'count' }),
  sql: (...args: unknown[]) => ({ op: 'sql', args }),
}))

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(rows)),
    then: (resolve: (value: unknown[]) => void) => resolve(rows),
  }
  return chain
}

vi.mock('@/lib/db', () => {
  const db: Record<string, unknown> = {
    select: vi.fn(() => mocks.dbSelectChain()),
  }
  return { db }
})

const { getExpenseForDetail } = await import('@/lib/dal/expenses')

function makeExpenseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'exp-1',
    title: 'Spesa settimanale',
    status: '3',
    notes: null,
    createdAt: new Date('2026-01-10'),
    totalAmount: '-95.20',
    transactionCount: 2,
    subCategoryId: 12,
    subCategoryName: 'Supermercato',
    categoryName: 'Casa',
    categorySlug: 'casa',
    platformName: 'Intesa SP',
    fileId: 'file-1',
    displayName: 'estratto-conto.csv',
    originalName: 'estratto-conto-raw.csv',
    ...overrides,
  }
}

function makeLinkedTransactionRows() {
  return [
    {
      id: 'tx-1',
      description: 'SUPERMERCATO CENTRALE',
      customTitle: null,
      amount: '-45.30',
      currency: 'EUR',
      occurredAt: new Date('2026-01-10'),
    },
    {
      id: 'tx-2',
      description: 'SUPERMERCATO CENTRALE',
      customTitle: null,
      amount: '-49.90',
      currency: 'EUR',
      occurredAt: new Date('2026-01-05'),
    },
  ]
}

describe('getExpenseForDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the expense with sourceFile and linked transactions when found', async () => {
    const expenseRow = makeExpenseRow()
    const txRows = makeLinkedTransactionRows()
    let callCount = 0
    mocks.dbSelectChain.mockImplementation(() => {
      callCount += 1
      return callCount === 1 ? makeSelectChain([expenseRow]) : makeSelectChain(txRows)
    })

    const result = await getExpenseForDetail({ userId: 'user-1', id: 'exp-1' })

    expect(result).toBeDefined()
    expect(result?.id).toBe('exp-1')
    expect(result?.sourceFile).toEqual({ id: 'file-1', name: 'estratto-conto.csv' })
    expect(result?.transactions).toEqual(txRows)
  })

  it('resolves sourceFile to null when the expense has no linked file', async () => {
    const expenseRow = makeExpenseRow({ fileId: null, displayName: null, originalName: null })
    let callCount = 0
    mocks.dbSelectChain.mockImplementation(() => {
      callCount += 1
      return callCount === 1 ? makeSelectChain([expenseRow]) : makeSelectChain([])
    })

    const result = await getExpenseForDetail({ userId: 'user-1', id: 'exp-1' })

    expect(result?.sourceFile).toBeNull()
  })

  it('returns undefined for a non-existent expense id, without throwing', async () => {
    mocks.dbSelectChain.mockReturnValue(makeSelectChain([]))

    await expect(
      getExpenseForDetail({ userId: 'user-1', id: 'exp-missing' }),
    ).resolves.toBeUndefined()
  })

  it('returns undefined when the expense belongs to a different user, without throwing', async () => {
    mocks.dbSelectChain.mockReturnValue(makeSelectChain([]))

    await expect(
      getExpenseForDetail({ userId: 'user-OTHER', id: 'exp-1' }),
    ).resolves.toBeUndefined()
  })

  it('scopes the expense-row query WHERE to both id and userId (ownership guard present)', async () => {
    const chain = makeSelectChain([makeExpenseRow()])
    let callCount = 0
    mocks.dbSelectChain.mockImplementation(() => {
      callCount += 1
      return callCount === 1 ? chain : makeSelectChain(makeLinkedTransactionRows())
    })

    await getExpenseForDetail({ userId: 'user-1', id: 'exp-1' })

    expect(chain.where).toHaveBeenCalledTimes(1)
    const whereArg = (chain.where as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      op: string
      args: Array<{ op: string; left: unknown; right: unknown }>
    }
    expect(whereArg.op).toBe('and')
    const conditions = whereArg.args
    expect(
      conditions.some((c) => c.op === 'eq' && c.left === 'expense.id' && c.right === 'exp-1'),
    ).toBe(true)
    expect(
      conditions.some((c) => c.op === 'eq' && c.left === 'expense.userId' && c.right === 'user-1'),
    ).toBe(true)
  })

  it('scopes the linked-transactions query WHERE to both expenseId and userId', async () => {
    const expenseRow = makeExpenseRow()
    const txChain = makeSelectChain(makeLinkedTransactionRows())
    let callCount = 0
    mocks.dbSelectChain.mockImplementation(() => {
      callCount += 1
      return callCount === 1 ? makeSelectChain([expenseRow]) : txChain
    })

    await getExpenseForDetail({ userId: 'user-1', id: 'exp-1' })

    expect(txChain.where).toHaveBeenCalledTimes(1)
    const whereArg = (txChain.where as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      op: string
      args: Array<{ op: string; left: unknown; right: unknown }>
    }
    expect(whereArg.op).toBe('and')
    const conditions = whereArg.args
    expect(
      conditions.some(
        (c) => c.op === 'eq' && c.left === 'transaction.expenseId' && c.right === 'exp-1',
      ),
    ).toBe(true)
    expect(
      conditions.some(
        (c) => c.op === 'eq' && c.left === 'transaction.userId' && c.right === 'user-1',
      ),
    ).toBe(true)
  })
})
