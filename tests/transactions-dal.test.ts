import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  selectedShapes: [] as unknown[],
  whereArgs: [] as unknown[],
  orderByArgs: [] as unknown[],
  limitArgs: [] as number[],
  offsetArgs: [] as number[],
  updateSetArgs: [] as unknown[],
  updateWhereArgs: [] as unknown[],
}))

function makeQueryChain(finalValue: unknown[] = []) {
  const chain = {
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
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
function makeUpdateChain() {
  const chain = {
    set: vi.fn((arg: unknown) => {
      mocks.updateSetArgs.push(arg)
      return chain
    }),
    where: vi.fn((arg: unknown) => {
      mocks.updateWhereArgs.push(arg)
      return Promise.resolve()
    }),
  }
  return chain
}

vi.mock('@/lib/db', () => ({
  db: {
    select: (shape: unknown) => {
      mocks.selectedShapes.push(shape)
      return makeQueryChain([])
    },
    selectDistinct: (shape: unknown) => {
      mocks.selectedShapes.push(shape)
      return makeQueryChain([])
    },
    update: vi.fn(() => makeUpdateChain()),
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
  inArray: (left: unknown, right: unknown) => ({ op: 'inArray', left, right }),
  isNull: (column: unknown) => ({ op: 'isNull', column }),
  lte: (left: unknown, right: unknown) => ({ op: 'lte', left, right }),
  or: (...args: unknown[]) => ({ op: 'or', args }),
  sql: Object.assign(mockSql, {
    // Drizzle allows sql`...` as tagged template only; generic sql<T> is compile-time.
  }),
}))
vi.mock('@/lib/db/schema', () => ({
  category: {
    id: 'category.id',
    name: 'category.name',
    slug: 'category.slug',
  },
  expense: {
    id: 'expense.id',
    status: 'expense.status',
    title: 'expense.title',
    userId: 'expense.userId',
  },
  file: {
    id: 'file.id',
    displayName: 'file.displayName',
    importFormatVersionId: 'file.importFormatVersionId',
    importedAt: 'file.importedAt',
    originalName: 'file.originalName',
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
  },
  userSubcategoryOverride: {
    customName: 'userSubcategoryOverride.customName',
    subCategoryId: 'userSubcategoryOverride.subCategoryId',
    userId: 'userSubcategoryOverride.userId',
  },
  transaction: {
    id: 'transaction.id',
    userId: 'transaction.userId',
    fileId: 'transaction.fileId',
    expenseId: 'transaction.expenseId',
    transactionHash: 'transaction.transactionHash',
    description: 'transaction.description',
    customTitle: 'transaction.customTitle',
    descriptionHash: 'transaction.descriptionHash',
    amount: 'transaction.amount',
    currency: 'transaction.currency',
    occurredAt: 'transaction.occurredAt',
    rowIndex: 'transaction.rowIndex',
    rawRow: 'transaction.rawRow',
    createdAt: 'transaction.createdAt',
  },
}))

const {
  TRANSACTION_LIST_LIMIT,
  buildTransactionOrderBy,
  getTransactionPlatforms,
  getTransactions,
  getTransactionSortColumn,
  transactionListSelect,
  transactionPlatformSelect,
  updateTransactionCustomTitle,
} = await import('../lib/dal/transactions')

describe('transaction DAL query helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.selectedShapes.length = 0
    mocks.whereArgs.length = 0
    mocks.orderByArgs.length = 0
    mocks.limitArgs.length = 0
    mocks.offsetArgs.length = 0
    mocks.updateSetArgs.length = 0
    mocks.updateWhereArgs.length = 0
    mocks.verifySession.mockResolvedValue({ userId: 'user-1' })
  })

  it('uses explicit whitelisted sort branches and defaults unsupported values to occurredAt', () => {
    expect(getTransactionSortColumn('occurredAt')).toBe('transaction.occurredAt')
    expect(getTransactionSortColumn('amount')).toBe('transaction.amount')
    expect(getTransactionSortColumn('description' as never)).toBe('transaction.occurredAt')
  })

  it('builds order direction without letting caller-provided values become columns', () => {
    expect(buildTransactionOrderBy({ sort: 'amount', dir: 'asc' })).toEqual({
      op: 'asc',
      column: 'transaction.amount',
    })
    expect(buildTransactionOrderBy({ sort: 'amount', dir: 'desc' })).toEqual({
      op: 'desc',
      column: 'transaction.amount',
    })
    expect(buildTransactionOrderBy({ sort: 'description' as never, dir: 'asc' })).toEqual({
      op: 'asc',
      column: 'transaction.occurredAt',
    })
  })

  it('keeps the list bounded and exposes display metadata for the /transactions table', () => {
    expect(TRANSACTION_LIST_LIMIT).toBe(50)
    expect(transactionListSelect).toMatchObject({
      id: 'transaction.id',
      description: 'transaction.description',
      customTitle: 'transaction.customTitle',
      amount: 'transaction.amount',
      currency: 'transaction.currency',
      occurredAt: 'transaction.occurredAt',
      expenseTitle: 'expense.title',
      expenseStatus: 'expense.status',
      expenseCategoryName: 'category.name',
      fileId: 'file.id',
      platformName: 'platform.name',
      platformSlug: 'platform.slug',
    })
    expect(transactionListSelect.expenseSubCategoryName).toMatchObject({ op: 'sql' })
    expect(transactionListSelect.fileName).toMatchObject({ op: 'sql' })
    expect(transactionPlatformSelect).toEqual({
      id: 'platform.id',
      name: 'platform.name',
      slug: 'platform.slug',
    })
  })

  it('verifies the session, scopes transaction rows to the user and file owner, and applies filters safely', async () => {
    await getTransactions({
      fromDate: new Date('2026-01-01T00:00:00.000Z'),
      toDate: new Date('2026-01-31T23:59:59.999Z'),
      platform: 'fineco',
      categorySlug: 'food',
      subCategoryId: 42,
      sort: 'amount',
      dir: 'asc',
    })

    expect(mocks.verifySession).toHaveBeenCalledTimes(1)
    expect(mocks.selectedShapes[0]).toBe(transactionListSelect)
    expect(mocks.limitArgs).toEqual([TRANSACTION_LIST_LIMIT])
    expect(mocks.offsetArgs).toEqual([0])
    expect(mocks.orderByArgs[0]).toEqual({ op: 'asc', column: 'transaction.amount' })
    expect(mocks.whereArgs[0]).toEqual({
      op: 'and',
      args: expect.arrayContaining([
        { op: 'eq', left: 'transaction.userId', right: 'user-1' },
        {
          op: 'or',
          args: [
            { op: 'isNull', column: 'transaction.fileId' },
            { op: 'eq', left: 'file.userId', right: 'user-1' },
          ],
        },
        { op: 'gte', left: 'transaction.occurredAt', right: new Date('2026-01-01T00:00:00.000Z') },
        { op: 'lte', left: 'transaction.occurredAt', right: new Date('2026-01-31T23:59:59.999Z') },
        { op: 'eq', left: 'platform.slug', right: 'fineco' },
        { op: 'eq', left: 'category.slug', right: 'food' },
        { op: 'eq', left: 'subCategory.id', right: 42 },
      ]),
    })
  })

  it('applies explicit pagination offsets for infinite loading', async () => {
    await getTransactions({ sort: 'occurredAt', dir: 'desc' }, { limit: 50, offset: 100 })

    expect(mocks.limitArgs).toEqual([50])
    expect(mocks.offsetArgs).toEqual([100])
  })

  it('verifies the session before reading platform options and scopes options to owned transactions', async () => {
    await getTransactionPlatforms()

    expect(mocks.verifySession).toHaveBeenCalledTimes(1)
    expect(mocks.selectedShapes[0]).toBe(transactionPlatformSelect)
    expect(mocks.whereArgs[0]).toEqual({
      op: 'and',
      args: expect.arrayContaining([
        { op: 'eq', left: 'transaction.userId', right: 'user-1' },
        { op: 'eq', left: 'file.userId', right: 'user-1' },
      ]),
    })
  })

  it('updateTransactionCustomTitle scopes update to userId (IDOR) and sets customTitle to null', async () => {
    const { db } = await import('@/lib/db')
    await updateTransactionCustomTitle(db, 'txn-id-1', 'user-1', null)

    expect(mocks.updateSetArgs[0]).toMatchObject({ customTitle: null })
    expect(mocks.updateWhereArgs[0]).toEqual({
      op: 'and',
      args: expect.arrayContaining([
        { op: 'eq', left: 'transaction.id', right: 'txn-id-1' },
        { op: 'eq', left: 'transaction.userId', right: 'user-1' },
      ]),
    })
  })

  it('updateTransactionCustomTitle sets customTitle to the provided string', async () => {
    const { db } = await import('@/lib/db')
    await updateTransactionCustomTitle(db, 'txn-id-2', 'user-1', 'My custom title')

    expect(mocks.updateSetArgs[0]).toMatchObject({ customTitle: 'My custom title' })
    expect(mocks.updateWhereArgs[0]).toEqual({
      op: 'and',
      args: expect.arrayContaining([
        { op: 'eq', left: 'transaction.id', right: 'txn-id-2' },
        { op: 'eq', left: 'transaction.userId', right: 'user-1' },
      ]),
    })
  })

  it('filters to a specific import when importId is provided', async () => {
    const importId = '550e8400-e29b-41d4-a716-446655440000'
    await getTransactions({ importId })

    expect(mocks.whereArgs[0]).toEqual({
      op: 'and',
      args: expect.arrayContaining([
        { op: 'eq', left: 'transaction.userId', right: 'user-1' },
        {
          op: 'or',
          args: [
            { op: 'isNull', column: 'transaction.fileId' },
            { op: 'eq', left: 'file.userId', right: 'user-1' },
          ],
        },
        { op: 'eq', left: 'transaction.fileId', right: importId },
      ]),
    })
  })

  it('enforces both ownership conditions when importId is set so a foreign-user importId returns no rows', async () => {
    mocks.verifySession.mockResolvedValueOnce({ userId: 'user-2' })
    const importId = '550e8400-e29b-41d4-a716-446655440000'
    await getTransactions({ importId })

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    // Both the user-scoped ownership predicate and the fileId equality must be present,
    // so a file owned by user-1 is not accessible to user-2.
    expect(where.args).toEqual(
      expect.arrayContaining([
        { op: 'eq', left: 'transaction.userId', right: 'user-2' },
        {
          op: 'or',
          args: [
            { op: 'isNull', column: 'transaction.fileId' },
            { op: 'eq', left: 'file.userId', right: 'user-2' },
          ],
        },
        { op: 'eq', left: 'transaction.fileId', right: importId },
      ]),
    )
  })

  it('does not add a fileId predicate when importId is absent', async () => {
    await getTransactions({})

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    const hasFileIdPredicate = where.args.some(
      (arg) =>
        typeof arg === 'object' &&
        arg !== null &&
        (arg as Record<string, unknown>).op === 'eq' &&
        (arg as Record<string, unknown>).left === 'transaction.fileId',
    )
    expect(hasFileIdPredicate).toBe(false)
  })

  it('composes importId with date and platform filters without dropping existing predicates', async () => {
    const importId = '550e8400-e29b-41d4-a716-446655440000'
    await getTransactions({
      importId,
      fromDate: new Date('2026-01-01T00:00:00.000Z'),
      toDate: new Date('2026-01-31T23:59:59.999Z'),
      platform: 'fineco',
      categorySlug: 'food',
      subCategoryId: 42,
      sort: 'amount',
      dir: 'asc',
    })

    expect(mocks.whereArgs[0]).toEqual({
      op: 'and',
      args: expect.arrayContaining([
        { op: 'eq', left: 'transaction.userId', right: 'user-1' },
        {
          op: 'or',
          args: [
            { op: 'isNull', column: 'transaction.fileId' },
            { op: 'eq', left: 'file.userId', right: 'user-1' },
          ],
        },
        { op: 'gte', left: 'transaction.occurredAt', right: new Date('2026-01-01T00:00:00.000Z') },
        { op: 'lte', left: 'transaction.occurredAt', right: new Date('2026-01-31T23:59:59.999Z') },
        { op: 'eq', left: 'platform.slug', right: 'fineco' },
        { op: 'eq', left: 'category.slug', right: 'food' },
        { op: 'eq', left: 'subCategory.id', right: 42 },
        { op: 'eq', left: 'transaction.fileId', right: importId },
      ]),
    })
    expect(mocks.orderByArgs[0]).toEqual({ op: 'asc', column: 'transaction.amount' })
  })
})
