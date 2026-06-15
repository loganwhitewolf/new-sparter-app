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
  executeArgs: [] as unknown[],
  executeResult: null as unknown,
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
    select: vi.fn((shape: unknown) => {
      mocks.selectedShapes.push(shape)
      return makeQueryChain([])
    }),
    selectDistinct: vi.fn((shape: unknown) => {
      mocks.selectedShapes.push(shape)
      return makeQueryChain([])
    }),
    update: vi.fn(() => makeUpdateChain()),
    execute: vi.fn((query: unknown) => {
      mocks.executeArgs.push(query)
      return Promise.resolve(mocks.executeResult ?? { rows: [] })
    }),
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
  isNotNull: (column: unknown) => ({ op: 'isNotNull', column }),
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
    subCategoryId: 'expense.subCategoryId',
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
  getTransactionCount,
  getTopUncategorizedExpenses,
  getTopExpensesForOnboarding,
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

  it('builds orderBy array with id tiebreaker as LAST element (D-06)', () => {
    // After the tiebreaker fix, buildTransactionOrderBy returns an array
    // so that OFFSET pagination never returns duplicate or missing rows on amount sort.
    expect(buildTransactionOrderBy({ sort: 'amount', dir: 'asc' })).toEqual([
      { op: 'asc', column: 'transaction.amount' },
      { op: 'asc', column: 'transaction.id' },
    ])
    expect(buildTransactionOrderBy({ sort: 'amount', dir: 'desc' })).toEqual([
      { op: 'desc', column: 'transaction.amount' },
      { op: 'desc', column: 'transaction.id' },
    ])
    expect(buildTransactionOrderBy({ sort: 'occurredAt', dir: 'desc' })).toEqual([
      { op: 'desc', column: 'transaction.occurredAt' },
      { op: 'desc', column: 'transaction.id' },
    ])
    expect(buildTransactionOrderBy({ sort: 'description' as never, dir: 'asc' })).toEqual([
      { op: 'asc', column: 'transaction.occurredAt' },
      { op: 'asc', column: 'transaction.id' },
    ])
  })

  it('id tiebreaker is the LAST element in the orderBy array for default sort', () => {
    const result = buildTransactionOrderBy()
    expect(Array.isArray(result)).toBe(true)
    const arr = result as unknown[]
    expect(arr[arr.length - 1]).toEqual({ op: 'desc', column: 'transaction.id' })
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

  // ── Wave 4: new filter conditions ──────────────────────────────────────────

  it('months filter adds OR(TO_CHAR(occurredAt, YYYY-MM) = ym) for each month', async () => {
    await getTransactions({ months: ['2026-04', '2026-05'] })

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    // Find the OR whose every arg is a sql node (months OR), not the file-ownership OR
    const monthsCondition = where.args.find(
      (arg) => {
        if (typeof arg !== 'object' || arg === null) return false
        const a = arg as { op?: string; args?: unknown[] }
        if (a.op !== 'or' || !Array.isArray(a.args)) return false
        return a.args.every(
          (inner) =>
            typeof inner === 'object' &&
            inner !== null &&
            (inner as { op?: string }).op === 'sql',
        )
      },
    ) as { op: string; args: { op: string; strings: string[]; values: unknown[] }[] } | undefined

    expect(monthsCondition).toBeDefined()
    expect(monthsCondition!.args).toHaveLength(2)
    // Each element is a sql`` template node containing YYYY-MM values
    expect(monthsCondition!.args[0].op).toBe('sql')
    expect(monthsCondition!.args[0].values).toContain('2026-04')
    expect(monthsCondition!.args[1].op).toBe('sql')
    expect(monthsCondition!.args[1].values).toContain('2026-05')
  })

  it('single month produces OR with one sql node containing TO_CHAR and the month', async () => {
    await getTransactions({ months: ['2026-01'] })

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    // Find OR where every inner arg is sql (months OR)
    const monthsCondition = where.args.find(
      (arg) => {
        if (typeof arg !== 'object' || arg === null) return false
        const a = arg as { op?: string; args?: unknown[] }
        if (a.op !== 'or' || !Array.isArray(a.args)) return false
        return a.args.every(
          (inner) =>
            typeof inner === 'object' &&
            inner !== null &&
            (inner as { op?: string }).op === 'sql',
        )
      },
    ) as { op: string; args: { op: string; strings: string[]; values: unknown[] }[] } | undefined

    expect(monthsCondition).toBeDefined()
    expect(monthsCondition!.args[0].op).toBe('sql')
    const sqlText = monthsCondition!.args[0].strings.join('')
    expect(sqlText).toContain('YYYY-MM')
    expect(monthsCondition!.args[0].values).toContain('2026-01')
  })

  it('amountMin adds ABS(amount::numeric) >= amountMin::numeric sql condition', async () => {
    await getTransactions({ amountMin: '10' })

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    const amountMinCondition = where.args.find(
      (arg) =>
        typeof arg === 'object' &&
        arg !== null &&
        (arg as { op?: string }).op === 'sql' &&
        ((arg as { strings?: string[] }).strings ?? []).join('').includes('ABS'),
    ) as { op: string; strings: string[]; values: unknown[] } | undefined

    expect(amountMinCondition).toBeDefined()
    const text = amountMinCondition!.strings.join('')
    expect(text).toContain('ABS')
    expect(text).toContain('>=')
    expect(amountMinCondition!.values).toContain('10')
  })

  it('amountMax adds ABS(amount::numeric) <= amountMax::numeric sql condition', async () => {
    await getTransactions({ amountMax: '200' })

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    const amountMaxCondition = where.args.find(
      (arg) =>
        typeof arg === 'object' &&
        arg !== null &&
        (arg as { op?: string }).op === 'sql' &&
        ((arg as { strings?: string[] }).strings ?? []).join('').includes('<='),
    ) as { op: string; strings: string[]; values: unknown[] } | undefined

    expect(amountMaxCondition).toBeDefined()
    expect(amountMaxCondition!.values).toContain('200')
  })

  it('status uncategorized adds isNull(expense.subCategoryId)', async () => {
    await getTransactions({ status: 'uncategorized' })

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    expect(where.args).toEqual(
      expect.arrayContaining([
        { op: 'isNull', column: 'expense.subCategoryId' },
      ]),
    )
  })

  it('status categorized adds isNotNull(expense.subCategoryId)', async () => {
    await getTransactions({ status: 'categorized' })

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    expect(where.args).toEqual(
      expect.arrayContaining([
        { op: 'isNotNull', column: 'expense.subCategoryId' },
      ]),
    )
  })

  it('no months condition added when months array is empty', async () => {
    await getTransactions({ months: [] })

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    // The only OR in the where should be the file ownership OR, not a months OR
    const orConditions = where.args.filter(
      (arg) =>
        typeof arg === 'object' &&
        arg !== null &&
        (arg as { op?: string }).op === 'or',
    ) as { op: string; args: unknown[] }[]

    // The only OR should be the file ownership one (fileId IS NULL OR file.userId = user-1)
    expect(orConditions).toHaveLength(1)
    const fileOwnershipOr = orConditions[0]
    expect(fileOwnershipOr.args).toEqual(
      expect.arrayContaining([
        { op: 'isNull', column: 'transaction.fileId' },
      ]),
    )
  })
})

// makeQueryChain terminates at .offset(); getUncategorizedTransactionsByFileId ends at .where().
// This variant makes .where() the terminal step so await resolves to the final value.
function makeWhereTerminalChain(finalValue: unknown[] = []) {
  const chain = {
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn((arg: unknown) => {
      mocks.whereArgs.push(arg)
      return { limit: vi.fn(() => Promise.resolve(finalValue)) }
    }),
    select: vi.fn((shape: unknown) => {
      mocks.selectedShapes.push(shape)
      return chain
    }),
  }
  return chain
}

describe('getUncategorizedTransactionsByFileId', () => {
  beforeEach(() => {
    mocks.selectedShapes.length = 0
    mocks.whereArgs.length = 0
    mocks.verifySession.mockReset()
  })

  it('returns only description+amount rows and filters by fileId + expense.subCategoryId IS NULL (POST-04)', async () => {
    const chain = makeWhereTerminalChain([{ description: 'AMAZON 123', amount: '-12.50' }])
    const { getUncategorizedTransactionsByFileId } = await import('@/lib/dal/transactions')
    const result = await getUncategorizedTransactionsByFileId(chain as never, 'file-1', 'user-1')
    expect(result).toEqual([{ description: 'AMAZON 123', amount: '-12.50' }])
    const lastWhere = mocks.whereArgs.at(-1) as { op: string; args: unknown[] }
    // The where arg is { op: 'and', args: [...] } produced by the mocked drizzle-orm and()
    expect(lastWhere.op).toBe('and')
    expect(lastWhere.args).toEqual(
      expect.arrayContaining([
        { op: 'isNull', column: 'expense.subCategoryId' },
        { op: 'eq', left: 'transaction.fileId', right: 'file-1' },
      ]),
    )
  })

  it('enforces ownership via innerJoin on importFile and expense (POST-03)', async () => {
    const chain = makeWhereTerminalChain([])
    const { getUncategorizedTransactionsByFileId } = await import('@/lib/dal/transactions')
    await getUncategorizedTransactionsByFileId(chain as never, 'file-1', 'user-1')
    expect(chain.innerJoin).toHaveBeenCalledTimes(2)
    expect(chain.innerJoin).toHaveBeenNthCalledWith(
      1,
      expect.anything(), // importFile schema reference
      expect.anything(), // join condition: eq(transaction.fileId, importFile.id)
    )
    expect(chain.innerJoin).toHaveBeenNthCalledWith(
      2,
      expect.anything(), // expense schema reference
      expect.anything(), // join condition: eq(transaction.expenseId, expense.id)
    )
    const lastWhere = mocks.whereArgs.at(-1) as { op: string; args: unknown[] }
    expect(lastWhere.op).toBe('and')
    expect(lastWhere.args).toEqual(
      expect.arrayContaining([
        { op: 'eq', left: 'file.userId', right: 'user-1' },
      ]),
    )
  })

  it('selects only { description, amount } (narrow projection)', async () => {
    const chain = makeWhereTerminalChain([])
    const { getUncategorizedTransactionsByFileId } = await import('@/lib/dal/transactions')
    await getUncategorizedTransactionsByFileId(chain as never, 'file-1', 'user-1')
    const shape = mocks.selectedShapes[0] as Record<string, unknown>
    expect(Object.keys(shape).sort()).toEqual(['amount', 'description'])
  })

  it('does not call verifySession (userId is passed explicitly — composability)', async () => {
    const chain = makeWhereTerminalChain([])
    const { getUncategorizedTransactionsByFileId } = await import('@/lib/dal/transactions')
    await getUncategorizedTransactionsByFileId(chain as never, 'file-1', 'user-1')
    expect(mocks.verifySession).not.toHaveBeenCalled()
  })

  it('uses the passed-in DbOrTx argument, not the module-level db singleton', async () => {
    const chain = makeWhereTerminalChain([])
    const { getUncategorizedTransactionsByFileId } = await import('@/lib/dal/transactions')
    await getUncategorizedTransactionsByFileId(chain as never, 'file-1', 'user-1')
    // .from() is called on the chain returned by .select(), which itself is on chain (the db substitute)
    expect(chain.from).toHaveBeenCalledTimes(1)
    expect(chain.select).toHaveBeenCalledTimes(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getTransactionCount — R-OB-02
// ─────────────────────────────────────────────────────────────────────────────

// makeCountChain: terminates at .where() (count query has no limit/offset)
function makeCountChain(finalValue: unknown[] = []) {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn((arg: unknown) => {
      mocks.whereArgs.push(arg)
      return Promise.resolve(finalValue)
    }),
  }
  return chain
}

describe('getTransactionCount (R-OB-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.selectedShapes.length = 0
    mocks.whereArgs.length = 0
    mocks.executeArgs.length = 0
    mocks.executeResult = null
    mocks.verifySession.mockResolvedValue({ userId: 'user-1' })
  })

  it('returns the integer COUNT(*) for the userId argument (R-OB-02)', async () => {
    const { db } = await import('@/lib/db')
    const countChain = makeCountChain([{ c: 7 }])
    ;(db.select as ReturnType<typeof vi.fn>).mockImplementationOnce((shape: unknown) => {
      mocks.selectedShapes.push(shape)
      return countChain
    })

    const result = await getTransactionCount('user-1')

    expect(result).toBe(7)
  })

  it('returns 0 when no rows exist (R-OB-02)', async () => {
    const { db } = await import('@/lib/db')
    const countChain = makeCountChain([])
    ;(db.select as ReturnType<typeof vi.fn>).mockImplementationOnce((shape: unknown) => {
      mocks.selectedShapes.push(shape)
      return countChain
    })

    const result = await getTransactionCount('user-1')

    expect(result).toBe(0)
  })

  it('does NOT call verifySession (userId is an explicit argument) (R-OB-02)', async () => {
    const { db } = await import('@/lib/db')
    const countChain = makeCountChain([{ c: 3 }])
    ;(db.select as ReturnType<typeof vi.fn>).mockImplementationOnce((shape: unknown) => {
      mocks.selectedShapes.push(shape)
      return countChain
    })

    await getTransactionCount('user-1')

    expect(mocks.verifySession).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getTopUncategorizedExpenses — R-OB-07 query
// ─────────────────────────────────────────────────────────────────────────────

describe('getTopUncategorizedExpenses (R-OB-07 query)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.selectedShapes.length = 0
    mocks.whereArgs.length = 0
    mocks.executeArgs.length = 0
    mocks.executeResult = null
    mocks.verifySession.mockResolvedValue({ userId: 'user-1' })
  })

  it('executes parameterized SQL with DISTINCT ON, sub_category_id IS NULL, total_amount < 0, ORDER BY ABS DESC, LIMIT (R-OB-07)', async () => {
    const { db } = await import('@/lib/db')

    mocks.executeResult = { rows: [] }

    await getTopUncategorizedExpenses('user-1')

    expect(db.execute).toHaveBeenCalledTimes(1)
    const sqlArg = mocks.executeArgs[0] as { strings: string[]; values: unknown[] }
    const fullSql = sqlArg.strings.join('?')
    expect(fullSql).toContain('DISTINCT ON (description_hash)')
    expect(fullSql).toContain('sub_category_id IS NULL')
    expect(fullSql).toContain('total_amount::numeric < 0')
    expect(fullSql).toContain('ORDER BY description_hash, ABS(total_amount::numeric) DESC')
    expect(fullSql).toContain('LIMIT')
  })

  it('defaults limit to 15 when not provided (R-OB-07)', async () => {
    mocks.executeResult = { rows: [] }

    await getTopUncategorizedExpenses('user-1')

    const sqlArg = mocks.executeArgs[0] as { strings: string[]; values: unknown[] }
    // The limit value (15) is bound as a parameterized value
    expect(sqlArg.values).toContain(15)
  })

  it('passes through custom limit (R-OB-07)', async () => {
    mocks.executeResult = { rows: [] }

    await getTopUncategorizedExpenses('user-1', 5)

    const sqlArg = mocks.executeArgs[0] as { strings: string[]; values: unknown[] }
    expect(sqlArg.values).toContain(5)
  })

  it('returns rows sorted by |totalAmount| DESC after JS-side reorder (R-OB-07)', async () => {
    // Rows in descriptionHash order (as DISTINCT ON returns them), not by amount
    mocks.executeResult = {
      rows: [
        { id: 'e1', title: 'AMAZON', descriptionHash: 'aaa', totalAmount: '-5.00' },
        { id: 'e2', title: 'NETFLIX', descriptionHash: 'bbb', totalAmount: '-99.00' },
        { id: 'e3', title: 'GAS', descriptionHash: 'ccc', totalAmount: '-12.50' },
      ],
    }

    const result = await getTopUncategorizedExpenses('user-1')

    expect(result[0].id).toBe('e2') // -99.00 largest absolute value
    expect(result[1].id).toBe('e3') // -12.50
    expect(result[2].id).toBe('e1') // -5.00
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getTopExpensesForOnboarding — stable top-15 incl. categorized rows (260615-n3t)
// ─────────────────────────────────────────────────────────────────────────────

describe('getTopExpensesForOnboarding (260615-n3t — stable list)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.selectedShapes.length = 0
    mocks.whereArgs.length = 0
    mocks.executeArgs.length = 0
    mocks.executeResult = null
    mocks.verifySession.mockResolvedValue({ userId: 'user-1' })
  })

  it('executes parameterized SQL with DISTINCT ON, total_amount < 0, ORDER BY ABS DESC, LIMIT', async () => {
    const { db } = await import('@/lib/db')

    mocks.executeResult = { rows: [] }

    await getTopExpensesForOnboarding('user-1')

    expect(db.execute).toHaveBeenCalledTimes(1)
    const sqlArg = mocks.executeArgs[0] as { strings: string[]; values: unknown[] }
    const fullSql = sqlArg.strings.join('?')
    expect(fullSql).toContain('DISTINCT ON (description_hash)')
    expect(fullSql).toContain('total_amount::numeric < 0')
    expect(fullSql).toContain('ORDER BY description_hash, ABS(total_amount::numeric) DESC')
    expect(fullSql).toContain('LIMIT')
  })

  it('does NOT filter sub_category_id IS NULL — the list is stable across categorization (regression guard)', async () => {
    mocks.executeResult = { rows: [] }

    await getTopExpensesForOnboarding('user-1')

    const sqlArg = mocks.executeArgs[0] as { strings: string[]; values: unknown[] }
    const fullSql = sqlArg.strings.join('?')
    expect(fullSql).not.toContain('sub_category_id IS NULL')
  })

  it('LEFT JOINs sub_category and selects the subcategory id + name per row', async () => {
    mocks.executeResult = { rows: [] }

    await getTopExpensesForOnboarding('user-1')

    const sqlArg = mocks.executeArgs[0] as { strings: string[]; values: unknown[] }
    const fullSql = sqlArg.strings.join('?')
    expect(fullSql).toContain('LEFT JOIN sub_category')
    expect(fullSql).toContain('subCategoryName')
    expect(fullSql).toContain('subCategoryId')
  })

  it('defaults limit to 15 when not provided', async () => {
    mocks.executeResult = { rows: [] }

    await getTopExpensesForOnboarding('user-1')

    const sqlArg = mocks.executeArgs[0] as { strings: string[]; values: unknown[] }
    expect(sqlArg.values).toContain(15)
  })

  it('passes through a custom limit', async () => {
    mocks.executeResult = { rows: [] }

    await getTopExpensesForOnboarding('user-1', 5)

    const sqlArg = mocks.executeArgs[0] as { strings: string[]; values: unknown[] }
    expect(sqlArg.values).toContain(5)
  })

  it('hard-caps the limit at 100', async () => {
    mocks.executeResult = { rows: [] }

    await getTopExpensesForOnboarding('user-1', 9999)

    const sqlArg = mocks.executeArgs[0] as { strings: string[]; values: unknown[] }
    expect(sqlArg.values).toContain(100)
    expect(sqlArg.values).not.toContain(9999)
  })

  it('returns rows sorted by |totalAmount| DESC after JS-side reorder (incl. categorized rows)', async () => {
    mocks.executeResult = {
      rows: [
        { id: 'e1', title: 'AMAZON', descriptionHash: 'aaa', totalAmount: '-5.00', subCategoryId: null, subCategoryName: null },
        { id: 'e2', title: 'NETFLIX', descriptionHash: 'bbb', totalAmount: '-99.00', subCategoryId: 7, subCategoryName: 'Streaming' },
        { id: 'e3', title: 'GAS', descriptionHash: 'ccc', totalAmount: '-12.50', subCategoryId: null, subCategoryName: null },
      ],
    }

    const result = await getTopExpensesForOnboarding('user-1')

    expect(result[0].id).toBe('e2') // -99.00 largest absolute value
    expect(result[1].id).toBe('e3') // -12.50
    expect(result[2].id).toBe('e1') // -5.00
    // categorized row is retained with its subcategory metadata
    expect(result[0].subCategoryId).toBe(7)
    expect(result[0].subCategoryName).toBe('Streaming')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Phase 50 RED: transaction-pairing select-shape contract (PAIR-02)
// These cases are RED until Plan 04 extends transactionListSelect + TransactionListRow.
// ─────────────────────────────────────────────────────────────────────────────

describe('transaction pairing select-shape contract (Phase 50 — PAIR-02)', () => {
  // ── transactionListSelect exposes all four paired fields ──────────────────
  it('transactionListSelect includes pairedWithId as a sql fragment (PAIR-02)', () => {
    // Plan 04 will add a correlated subselect for pairedWithId to transactionListSelect.
    // Until then this assertion is RED (key absent on the object).
    expect(transactionListSelect).toHaveProperty('pairedWithId')
    // The value must be a sql fragment (not a plain column reference string)
    expect((transactionListSelect as Record<string, unknown>).pairedWithId).toMatchObject({ op: 'sql' })
  })

  it('transactionListSelect includes pairedNetAmount as a sql fragment with ::numeric addition (PAIR-02)', () => {
    expect(transactionListSelect).toHaveProperty('pairedNetAmount')
    const fragment = (transactionListSelect as Record<string, unknown>).pairedNetAmount as {
      op: string
      strings?: string[]
    }
    expect(fragment).toMatchObject({ op: 'sql' })
    // The fragment must contain a ::numeric cast for the signed Decimal net computation
    const sqlText = (fragment.strings ?? []).join('')
    expect(sqlText).toContain('::numeric')
  })

  it('transactionListSelect includes pairedAmount (counterpart original amount, not the net) as a sql fragment (PAIR-02)', () => {
    expect(transactionListSelect).toHaveProperty('pairedAmount')
    const fragment = (transactionListSelect as Record<string, unknown>).pairedAmount as {
      op: string
      strings?: string[]
    }
    expect(fragment).toMatchObject({ op: 'sql' })
    // It must select the counterpart's own amount (t2.amount), NOT a summed net.
    const sqlText = (fragment.strings ?? []).join('')
    expect(sqlText).toContain('t2.amount')
    expect(sqlText).not.toContain('+')
  })

  it('transactionListSelect includes pairedDescription as a sql fragment (PAIR-02)', () => {
    expect(transactionListSelect).toHaveProperty('pairedDescription')
    expect((transactionListSelect as Record<string, unknown>).pairedDescription).toMatchObject({ op: 'sql' })
  })

  it('transactionListSelect includes pairedOccurredAt as a sql fragment (PAIR-02)', () => {
    expect(transactionListSelect).toHaveProperty('pairedOccurredAt')
    expect((transactionListSelect as Record<string, unknown>).pairedOccurredAt).toMatchObject({ op: 'sql' })
  })

  // ── TypeScript-level: all four keys appear in the select object ──────────
  it('transactionListSelect exposes all four pairedWithId / pairedNetAmount / pairedDescription / pairedOccurredAt keys (PAIR-02)', () => {
    const keys = Object.keys(transactionListSelect)
    expect(keys).toContain('pairedWithId')
    expect(keys).toContain('pairedNetAmount')
    expect(keys).toContain('pairedDescription')
    expect(keys).toContain('pairedOccurredAt')
  })
})
