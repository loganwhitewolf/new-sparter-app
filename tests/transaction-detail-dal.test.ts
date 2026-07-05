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
    // Bypass React's request-scoped memoization so repeated calls within a
    // single test actually hit the mocked db chain again.
    cache: (fn: (...args: unknown[]) => unknown) => fn,
  }
})

vi.mock('@/lib/dal/auth', () => ({
  verifySession: vi.fn(),
}))

// String-keyed column stand-ins mirror tests/transaction-edit.test.ts.
vi.mock('@/lib/db/schema', () => ({
  transaction: {
    id: 'transaction.id',
    userId: 'transaction.userId',
    description: 'transaction.description',
    transactionHash: 'transaction.transactionHash',
    descriptionHash: 'transaction.descriptionHash',
    customTitle: 'transaction.customTitle',
    amount: 'transaction.amount',
    currency: 'transaction.currency',
    occurredAt: 'transaction.occurredAt',
    rowIndex: 'transaction.rowIndex',
    expenseId: 'transaction.expenseId',
    fileId: 'transaction.fileId',
  },
  expense: {
    id: 'expense.id',
    title: 'expense.title',
    status: 'expense.status',
    notes: 'expense.notes',
    subCategoryId: 'expense.subCategoryId',
    transactionCount: 'expense.transactionCount',
  },
  file: {
    id: 'file.id',
    displayName: 'file.displayName',
    originalName: 'file.originalName',
    importFormatVersionId: 'file.importFormatVersionId',
    userId: 'file.userId',
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
  isNotNull: (col: unknown) => ({ op: 'isNotNull', col }),
  ilike: (col: unknown, pattern: unknown) => ({ op: 'ilike', col, pattern }),
  inArray: (col: unknown, values: unknown) => ({ op: 'inArray', col, values }),
  gte: (col: unknown, value: unknown) => ({ op: 'gte', col, value }),
  lte: (col: unknown, value: unknown) => ({ op: 'lte', col, value }),
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

const { getTransactionForDetail } = await import('@/lib/dal/transactions')

function makeDetailRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tx-1',
    description: 'SUPERMERCATO CENTRALE',
    transactionHash: 'hash-1',
    descriptionHash: 'dhash-1',
    customTitle: null,
    amount: '-45.30',
    currency: 'EUR',
    occurredAt: new Date('2026-01-10'),
    rowIndex: 3,
    expenseId: 'exp-1',
    expenseTitle: 'Spesa settimanale',
    expenseStatus: '3',
    expenseNotes: null,
    expenseSubCategoryId: 12,
    subCategoryName: 'Supermercato',
    categoryName: 'Casa',
    categorySlug: 'casa',
    expenseTransactionCount: 1,
    fileId: 'file-1',
    fileName: 'estratto-conto.csv',
    platformName: 'Intesa SP',
    pairedWithId: null,
    pairedAmount: null,
    pairedDescription: null,
    pairedOccurredAt: null,
    pairedNetAmount: null,
    ...overrides,
  }
}

describe('getTransactionForDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a full detail row when the transaction is owned by the user', async () => {
    const row = makeDetailRow()
    mocks.dbSelectChain.mockReturnValue(makeSelectChain([row]))

    const result = await getTransactionForDetail({ userId: 'user-1', id: 'tx-1' })

    expect(result).toEqual(row)
  })

  it('returns undefined for a non-existent transaction id, without throwing', async () => {
    mocks.dbSelectChain.mockReturnValue(makeSelectChain([]))

    await expect(
      getTransactionForDetail({ userId: 'user-1', id: 'tx-missing' }),
    ).resolves.toBeUndefined()
  })

  it('returns undefined when the transaction belongs to a different user, without throwing', async () => {
    // Ownership-scoped WHERE excludes cross-user rows at the query layer — the
    // mocked chain simulates that by returning an empty result set.
    mocks.dbSelectChain.mockReturnValue(makeSelectChain([]))

    await expect(
      getTransactionForDetail({ userId: 'user-OTHER', id: 'tx-1' }),
    ).resolves.toBeUndefined()
  })

  it('scopes the query WHERE to both id and userId (ownership guard present)', async () => {
    const chain = makeSelectChain([makeDetailRow()])
    mocks.dbSelectChain.mockReturnValue(chain)

    await getTransactionForDetail({ userId: 'user-1', id: 'tx-1' })

    expect(chain.where).toHaveBeenCalledTimes(1)
    const whereArg = (chain.where as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      op: string
      args: Array<{ op: string; left: unknown; right: unknown }>
    }
    expect(whereArg.op).toBe('and')
    const conditions = whereArg.args
    expect(
      conditions.some((c) => c.op === 'eq' && c.left === 'transaction.id' && c.right === 'tx-1'),
    ).toBe(true)
    expect(
      conditions.some(
        (c) => c.op === 'eq' && c.left === 'transaction.userId' && c.right === 'user-1',
      ),
    ).toBe(true)
  })
})
