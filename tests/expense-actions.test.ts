import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  isSubCategoryVisibleToUser: vi.fn(),
  dbTransaction: vi.fn(),
  writeClassificationHistory: vi.fn(),
  revalidateCategorizationSurfaces: vi.fn(),
  dbUpdate: vi.fn(),
  dbSelect: vi.fn(),
  createExpenseGroup: vi.fn(),
  renameExpenseGroup: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/dal/auth', () => ({ verifySession: mocks.verifySession }))
vi.mock('@/lib/dal/categories', () => ({
  isSubCategoryVisibleToUser: mocks.isSubCategoryVisibleToUser,
}))
vi.mock('@/lib/dal/classification-history', () => ({
  writeClassificationHistory: mocks.writeClassificationHistory,
}))
vi.mock('@/lib/dal/transactions', () => ({
  getTransactionsByExpenseId: vi.fn(),
}))
vi.mock('@/lib/actions/revalidation', () => ({
  revalidateCategorizationSurfaces: mocks.revalidateCategorizationSurfaces,
}))
vi.mock('@/lib/services/expense-group', () => ({
  createExpenseGroup: mocks.createExpenseGroup,
  renameExpenseGroup: mocks.renameExpenseGroup,
}))
vi.mock('@/lib/db', () => ({
  db: {
    transaction: mocks.dbTransaction,
    update: mocks.dbUpdate,
    select: mocks.dbSelect,
  },
}))
vi.mock('@/lib/db/schema', () => ({
  expense: {
    id: 'expense.id',
    userId: 'expense.userId',
    subCategoryId: 'expense.subCategoryId',
    status: 'expense.status',
    title: 'expense.title',
    totalAmount: 'expense.totalAmount',
    updatedAt: 'expense.updatedAt',
  },
  expenseGroupMembership: {
    id: 'expenseGroupMembership.id',
    expenseId: 'expenseGroupMembership.expenseId',
  },
  // Referenced by module-scope sort keys in lib/dal/expenses.ts
  category: { name: 'category.name' },
  subCategory: { name: 'subCategory.name' },
  userSubcategoryOverride: { customName: 'userSubcategoryOverride.customName' },
  direction: {},
  file: {},
  importFormatVersion: {},
  nature: {},
  platform: {},
  transaction: {},
}))
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ op: 'and', args }),
  eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
  inArray: (col: unknown, vals: unknown) => ({ op: 'inArray', col, vals }),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({ op: 'sql', strings, values }),
    { raw: (query: string) => ({ op: 'sql.raw', query }) },
  ),
}))

const { categorizeExpense, bulkCategorize, updateExpenseTitle, mergeExpenses, renameExpenseGroupAction } =
  await import('@/lib/actions/expenses')

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    fd.append(key, value)
  }
  return fd
}

describe('updateExpenseTitle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue({ userId: 'user-1' })
    mocks.revalidateCategorizationSurfaces.mockReturnValue(undefined)
    mocks.dbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    })
  })

  it('updates only the aggregate expense title for the current user', async () => {
    const result = await updateExpenseTitle(
      { error: null },
      makeFormData({ id: 'expense-1', title: '  Nuovo nome  ' }),
    )

    expect(result).toEqual({ error: null })
    expect(mocks.verifySession).toHaveBeenCalledTimes(1)
    expect(mocks.dbUpdate).toHaveBeenCalledTimes(1)
    expect(mocks.revalidateCategorizationSurfaces).toHaveBeenCalledTimes(1)
  })

  it('rejects too-short titles without mutating data', async () => {
    const result = await updateExpenseTitle(
      { error: null },
      makeFormData({ id: 'expense-1', title: 'x' }),
    )

    expect(result).toEqual({ error: 'Il titolo deve contenere almeno 2 caratteri.' })
    expect(mocks.verifySession).not.toHaveBeenCalled()
    expect(mocks.dbUpdate).not.toHaveBeenCalled()
    expect(mocks.revalidateCategorizationSurfaces).not.toHaveBeenCalled()
  })
})

describe('categorizeExpense — subcategory visibility guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue({ userId: 'user-1' })
    mocks.writeClassificationHistory.mockResolvedValue(undefined)
    mocks.revalidateCategorizationSurfaces.mockReturnValue(undefined)
    // Default: expense is not a grouped member (D-03/WR-02 guard passes through).
    mocks.dbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    })
    mocks.dbTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ subCategoryId: null, status: '1' }]),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: 'expense-1' }]),
            }),
          }),
        }),
      }
      return fn(tx)
    })
  })

  it('calls the update path when subcategory is visible to current user', async () => {
    mocks.isSubCategoryVisibleToUser.mockResolvedValue(true)

    const result = await categorizeExpense(
      { error: null },
      makeFormData({ id: 'expense-1', subCategoryId: '42' }),
    )

    expect(result).toEqual({ error: null })
    expect(mocks.isSubCategoryVisibleToUser).toHaveBeenCalledWith(42, 'user-1')
    expect(mocks.dbTransaction).toHaveBeenCalledTimes(1)
    expect(mocks.revalidateCategorizationSurfaces).toHaveBeenCalledTimes(1)
  })

  it('returns a safe Italian error and skips update when subcategory is not visible', async () => {
    mocks.isSubCategoryVisibleToUser.mockResolvedValue(false)

    const result = await categorizeExpense(
      { error: null },
      makeFormData({ id: 'expense-1', subCategoryId: '99' }),
    )

    expect(result).toEqual({ error: 'Sottocategoria non valida.' })
    expect(mocks.isSubCategoryVisibleToUser).toHaveBeenCalledWith(99, 'user-1')
    expect(mocks.dbTransaction).not.toHaveBeenCalled()
    expect(mocks.revalidateCategorizationSurfaces).not.toHaveBeenCalled()
  })

  it('does not expose private IDs or raw DB details in the error message', async () => {
    mocks.isSubCategoryVisibleToUser.mockResolvedValue(false)

    const result = await categorizeExpense(
      { error: null },
      makeFormData({ id: 'expense-1', subCategoryId: '999' }),
    )

    expect(result.error).not.toMatch(/999/)
    expect(result.error).not.toMatch(/user-/)
    expect(result.error).toBe('Sottocategoria non valida.')
  })

  it('revalidates surfaces only after a successful mutation', async () => {
    mocks.isSubCategoryVisibleToUser.mockResolvedValue(true)

    await categorizeExpense({ error: null }, makeFormData({ id: 'expense-1', subCategoryId: '42' }))

    expect(mocks.revalidateCategorizationSurfaces).toHaveBeenCalledTimes(1)
  })
})

describe('categorizeExpense — grouped member guard (D-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue({ userId: 'user-1' })
    mocks.isSubCategoryVisibleToUser.mockResolvedValue(true)
    mocks.revalidateCategorizationSurfaces.mockReturnValue(undefined)
  })

  it('rejects recategorizing an expense that is already a group member, without touching the transaction', async () => {
    mocks.dbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      }),
    })

    const result = await categorizeExpense(
      { error: null },
      makeFormData({ id: 'expense-1', subCategoryId: '42' }),
    )

    expect(result).toEqual({ error: 'Questa spesa fa parte di un gruppo: categorizza dal gruppo.' })
    expect(mocks.dbTransaction).not.toHaveBeenCalled()
    expect(mocks.revalidateCategorizationSurfaces).not.toHaveBeenCalled()
  })
})

describe('bulkCategorize — subcategory visibility guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue({ userId: 'user-1' })
    mocks.writeClassificationHistory.mockResolvedValue(undefined)
    mocks.revalidateCategorizationSurfaces.mockReturnValue(undefined)
    mocks.dbTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { id: 'expense-1', subCategoryId: null, status: '1' },
            ]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: 'expense-1' }]),
            }),
          }),
        }),
      }
      return fn(tx)
    })
  })

  it('calls the bulk update path when subcategory is visible to current user', async () => {
    mocks.isSubCategoryVisibleToUser.mockResolvedValue(true)

    const result = await bulkCategorize(
      { error: null },
      makeFormData({
        ids: JSON.stringify(['expense-1', 'expense-2']),
        subCategoryId: '42',
      }),
    )

    expect(result).toEqual({ error: null })
    expect(mocks.isSubCategoryVisibleToUser).toHaveBeenCalledWith(42, 'user-1')
    expect(mocks.dbTransaction).toHaveBeenCalledTimes(1)
    expect(mocks.revalidateCategorizationSurfaces).toHaveBeenCalledTimes(1)
  })

  it('returns a safe Italian error and skips bulk updates when subcategory is not visible', async () => {
    mocks.isSubCategoryVisibleToUser.mockResolvedValue(false)

    const result = await bulkCategorize(
      { error: null },
      makeFormData({
        ids: JSON.stringify(['expense-1', 'expense-2']),
        subCategoryId: '99',
      }),
    )

    expect(result).toEqual({ error: 'Sottocategoria non valida.' })
    expect(mocks.isSubCategoryVisibleToUser).toHaveBeenCalledWith(99, 'user-1')
    expect(mocks.dbTransaction).not.toHaveBeenCalled()
    expect(mocks.revalidateCategorizationSurfaces).not.toHaveBeenCalled()
  })

  it('skips history writes and revalidation when subcategory is rejected', async () => {
    mocks.isSubCategoryVisibleToUser.mockResolvedValue(false)

    await bulkCategorize(
      { error: null },
      makeFormData({
        ids: JSON.stringify(['expense-1']),
        subCategoryId: '99',
      }),
    )

    expect(mocks.writeClassificationHistory).not.toHaveBeenCalled()
    expect(mocks.revalidateCategorizationSurfaces).not.toHaveBeenCalled()
  })
})

describe('mergeExpenses', () => {
  function mockTxSelectRows(rows: Array<{ id: string; subCategoryId: number | null }>) {
    mocks.dbTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(rows),
          }),
        }),
      }
      return fn(tx)
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue({ userId: 'user-1' })
    mocks.revalidateCategorizationSurfaces.mockReturnValue(undefined)
  })

  it('merges when every selected expense shares the same non-null subcategory', async () => {
    mockTxSelectRows([
      { id: '11111111-1111-4111-8111-111111111111', subCategoryId: 42 },
      { id: '22222222-2222-4222-8222-222222222222', subCategoryId: 42 },
    ])
    mocks.createExpenseGroup.mockResolvedValue({ groupId: 7 })

    const result = await mergeExpenses(
      { error: null },
      makeFormData({
        selectedExpenseIds: JSON.stringify(['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']),
        groupTitle: 'Cherasco 57',
      }),
    )

    expect(result).toEqual({ error: null })
    expect(mocks.createExpenseGroup).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'user-1',
        selectedExpenseIds: ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'],
        groupTitle: 'Cherasco 57',
        subCategoryId: 42,
      }),
    )
    expect(mocks.revalidateCategorizationSurfaces).toHaveBeenCalledTimes(1)
  })

  it('rejects when a selected id is missing or not owned', async () => {
    mockTxSelectRows([{ id: '11111111-1111-4111-8111-111111111111', subCategoryId: 42 }]) // expense-2 missing/unowned

    const result = await mergeExpenses(
      { error: null },
      makeFormData({
        selectedExpenseIds: JSON.stringify(['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']),
        groupTitle: 'Cherasco 57',
      }),
    )

    expect(result).toEqual({ error: 'Una o più spese non sono state trovate.' })
    expect(mocks.createExpenseGroup).not.toHaveBeenCalled()
  })

  it('rejects when any selected expense is uncategorized', async () => {
    mockTxSelectRows([
      { id: '11111111-1111-4111-8111-111111111111', subCategoryId: 42 },
      { id: '22222222-2222-4222-8222-222222222222', subCategoryId: null },
    ])

    const result = await mergeExpenses(
      { error: null },
      makeFormData({
        selectedExpenseIds: JSON.stringify(['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']),
        groupTitle: 'Cherasco 57',
      }),
    )

    expect(result).toEqual({ error: 'Categorizza prima di unire.' })
    expect(mocks.createExpenseGroup).not.toHaveBeenCalled()
  })

  it('rejects when selected expenses disagree on subcategory', async () => {
    mockTxSelectRows([
      { id: '11111111-1111-4111-8111-111111111111', subCategoryId: 42 },
      { id: '22222222-2222-4222-8222-222222222222', subCategoryId: 43 },
    ])

    const result = await mergeExpenses(
      { error: null },
      makeFormData({
        selectedExpenseIds: JSON.stringify(['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']),
        groupTitle: 'Cherasco 57',
      }),
    )

    expect(result).toEqual({ error: 'Le spese devono avere la stessa categoria.' })
    expect(mocks.createExpenseGroup).not.toHaveBeenCalled()
  })

  it('surfaces the already-grouped service error verbatim', async () => {
    mockTxSelectRows([
      { id: '11111111-1111-4111-8111-111111111111', subCategoryId: 42 },
      { id: '22222222-2222-4222-8222-222222222222', subCategoryId: 42 },
    ])
    mocks.createExpenseGroup.mockRejectedValue(
      new Error('Una spesa selezionata fa già parte di un gruppo.'),
    )

    const result = await mergeExpenses(
      { error: null },
      makeFormData({
        selectedExpenseIds: JSON.stringify(['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']),
        groupTitle: 'Cherasco 57',
      }),
    )

    expect(result).toEqual({ error: 'Una spesa selezionata fa già parte di un gruppo.' })
  })

  it('rejects a parse failure (fewer than 2 ids) without touching the DB', async () => {
    const result = await mergeExpenses(
      { error: null },
      makeFormData({
        selectedExpenseIds: JSON.stringify(['11111111-1111-4111-8111-111111111111']),
        groupTitle: 'Cherasco 57',
      }),
    )

    expect(result.error).toBe('Seleziona almeno due spese per unire.')
    expect(mocks.verifySession).not.toHaveBeenCalled()
    expect(mocks.dbTransaction).not.toHaveBeenCalled()
  })
})

describe('renameExpenseGroupAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue({ userId: 'user-1' })
    mocks.revalidateCategorizationSurfaces.mockReturnValue(undefined)
  })

  it('renames the group and revalidates on success', async () => {
    mocks.renameExpenseGroup.mockResolvedValue(true)

    const result = await renameExpenseGroupAction(
      { error: null },
      makeFormData({ groupId: '7', title: 'Nuovo titolo' }),
    )

    expect(result).toEqual({ error: null })
    expect(mocks.renameExpenseGroup).toHaveBeenCalledWith(
      expect.anything(),
      { userId: 'user-1', groupId: 7, title: 'Nuovo titolo' },
    )
    expect(mocks.revalidateCategorizationSurfaces).toHaveBeenCalledTimes(1)
  })

  it('surfaces the not-found service error verbatim', async () => {
    mocks.renameExpenseGroup.mockRejectedValue(new Error('Gruppo non trovato.'))

    const result = await renameExpenseGroupAction(
      { error: null },
      makeFormData({ groupId: '999', title: 'Nuovo titolo' }),
    )

    expect(result).toEqual({ error: 'Gruppo non trovato.' })
    expect(mocks.revalidateCategorizationSurfaces).not.toHaveBeenCalled()
  })
})
