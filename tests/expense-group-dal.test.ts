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
    firstTransactionAt: 'expense.firstTransactionAt',
    lastTransactionAt: 'expense.lastTransactionAt',
  },
  expenseGroup: {
    id: 'expenseGroup.id',
    userId: 'expenseGroup.userId',
    title: 'expenseGroup.title',
    subCategoryId: 'expenseGroup.subCategoryId',
    createdAt: 'expenseGroup.createdAt',
  },
  expenseGroupMembership: {
    id: 'expenseGroupMembership.id',
    groupId: 'expenseGroupMembership.groupId',
    expenseId: 'expenseGroupMembership.expenseId',
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

const { getExpenseGroupForDetail, getExpenseGroupMembers } = await import('@/lib/dal/expenses')

function makeGroupRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    title: 'Spesa supermercato',
    subCategoryId: 12,
    subCategoryName: 'Supermercato',
    categoryName: 'Casa',
    categorySlug: 'casa',
    categoryType: 'out',
    createdAt: new Date('2026-01-01'),
    ...overrides,
  }
}

function makeMemberRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'exp-1',
    title: 'Esselunga',
    totalAmount: '-45.30',
    transactionCount: 1,
    ...overrides,
  }
}

function makeTransactionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tx-1',
    description: 'ESSELUNGA MILANO',
    customTitle: null,
    amount: '-45.30',
    currency: 'EUR',
    occurredAt: new Date('2026-01-10'),
    ...overrides,
  }
}

describe('getExpenseGroupForDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the composed group with members and combined transactions sorted occurredAt DESC', async () => {
    const groupRow = makeGroupRow()
    const memberRows = [
      makeMemberRow({ id: 'exp-1', title: 'Esselunga', totalAmount: '-45.30', transactionCount: 1 }),
      makeMemberRow({ id: 'exp-2', title: 'Coop', totalAmount: '-20.00', transactionCount: 2 }),
    ]
    const txRows = [
      makeTransactionRow({ id: 'tx-old', occurredAt: new Date('2026-01-01') }),
      makeTransactionRow({ id: 'tx-new', occurredAt: new Date('2026-01-15') }),
      makeTransactionRow({ id: 'tx-mid', occurredAt: new Date('2026-01-10') }),
    ]

    let callCount = 0
    mocks.dbSelectChain.mockImplementation(() => {
      callCount += 1
      if (callCount === 1) return makeSelectChain([groupRow])
      if (callCount === 2) return makeSelectChain(memberRows)
      return makeSelectChain(txRows)
    })

    const result = await getExpenseGroupForDetail({ userId: 'user-1', groupId: 7 })

    expect(result).toBeDefined()
    expect(result?.id).toBe(7)
    expect(result?.title).toBe('Spesa supermercato')
    expect(result?.totalAmount).toBe('-65.30')
    expect(result?.transactionCount).toBe(3)
    expect(result?.members).toEqual([
      { id: 'exp-1', title: 'Esselunga', totalAmount: '-45.30', transactionCount: 1 },
      { id: 'exp-2', title: 'Coop', totalAmount: '-20.00', transactionCount: 2 },
    ])
    // Sorted occurredAt DESC, independent of member insertion order.
    expect(result?.transactions.map((t) => t.id)).toEqual(txRows.map((t) => t.id))
  })

  it('returns undefined (never throws) for a missing groupId', async () => {
    mocks.dbSelectChain.mockReturnValue(makeSelectChain([]))

    await expect(
      getExpenseGroupForDetail({ userId: 'user-1', groupId: 999 }),
    ).resolves.toBeUndefined()
  })

  it('returns undefined (never throws) for a groupId owned by a different user', async () => {
    // Ownership-scoped WHERE (expenseGroup.userId = userId) means a cross-user id
    // resolves to an empty row set, identical to a missing id (T-65-07).
    mocks.dbSelectChain.mockReturnValue(makeSelectChain([]))

    await expect(
      getExpenseGroupForDetail({ userId: 'user-OTHER', groupId: 7 }),
    ).resolves.toBeUndefined()
  })

  it('renders a member with zero transactions normally, without crashing (GRP-04 empty edge)', async () => {
    const groupRow = makeGroupRow()
    const memberRows = [
      makeMemberRow({ id: 'exp-1', title: 'Esselunga', totalAmount: '-45.30', transactionCount: 1 }),
      makeMemberRow({ id: 'exp-2', title: 'Vuoto', totalAmount: '0.00', transactionCount: 0 }),
    ]
    const txRows = [makeTransactionRow({ id: 'tx-1' })]

    let callCount = 0
    mocks.dbSelectChain.mockImplementation(() => {
      callCount += 1
      if (callCount === 1) return makeSelectChain([groupRow])
      if (callCount === 2) return makeSelectChain(memberRows)
      return makeSelectChain(txRows)
    })

    const result = await getExpenseGroupForDetail({ userId: 'user-1', groupId: 7 })

    expect(result?.members).toContainEqual({
      id: 'exp-2',
      title: 'Vuoto',
      totalAmount: '0.00',
      transactionCount: 0,
    })
    expect(result?.totalAmount).toBe('-45.30')
    expect(result?.transactionCount).toBe(1)
  })

  it('scopes the group-row query WHERE to both groupId and userId (ownership guard present)', async () => {
    const chain = makeSelectChain([makeGroupRow()])
    let callCount = 0
    mocks.dbSelectChain.mockImplementation(() => {
      callCount += 1
      if (callCount === 1) return chain
      return makeSelectChain([])
    })

    await getExpenseGroupForDetail({ userId: 'user-1', groupId: 7 })

    expect(chain.where).toHaveBeenCalledTimes(1)
    const whereArg = (chain.where as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      op: string
      args: Array<{ op: string; left: unknown; right: unknown }>
    }
    expect(whereArg.op).toBe('and')
    expect(
      whereArg.args.some(
        (c) => c.op === 'eq' && c.left === 'expenseGroup.id' && c.right === 7,
      ),
    ).toBe(true)
    expect(
      whereArg.args.some(
        (c) => c.op === 'eq' && c.left === 'expenseGroup.userId' && c.right === 'user-1',
      ),
    ).toBe(true)
  })
})

describe('getExpenseGroupMembers', () => {
  it('returns just the member expense ids for a group', async () => {
    mocks.dbSelectChain.mockReturnValue(
      makeSelectChain([{ expenseId: 'exp-1' }, { expenseId: 'exp-2' }]),
    )

    const result = await getExpenseGroupMembers(7)

    expect(result).toEqual(['exp-1', 'exp-2'])
  })
})
