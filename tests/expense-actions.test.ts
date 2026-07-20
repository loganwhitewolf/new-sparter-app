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
  addExpensesToGroup: vi.fn(),
  removeExpenseFromGroup: vi.fn(),
  dissolveExpenseGroup: vi.fn(),
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
  addExpensesToGroup: mocks.addExpensesToGroup,
  removeExpenseFromGroup: mocks.removeExpenseFromGroup,
  dissolveExpenseGroup: mocks.dissolveExpenseGroup,
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
  expenseGroup: {
    id: 'expenseGroup.id',
    userId: 'expenseGroup.userId',
    subCategoryId: 'expenseGroup.subCategoryId',
    updatedAt: 'expenseGroup.updatedAt',
  },
  expenseGroupMembership: {
    id: 'expenseGroupMembership.id',
    groupId: 'expenseGroupMembership.groupId',
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

const {
  categorizeExpense,
  bulkCategorize,
  updateExpenseTitle,
  mergeExpenses,
  renameExpenseGroupAction,
  categorizeExpenseGroup,
  addExpensesToGroupAction,
  removeExpenseFromGroupAction,
  dissolveExpenseGroupAction,
} = await import('@/lib/actions/expenses')

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
  function mockTxSelectRows(
    rows: Array<{ id: string; subCategoryId: number | null; status?: string }>,
  ) {
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

  // WR-05: an ignored (status '4') member must be rejected — ignoreExpense doesn't
  // clear subCategoryId, so it would otherwise pass the "same category" gate above
  // and let a group's composed totals silently under-represent it under status filters.
  it('rejects when any selected expense is ignored (status 4)', async () => {
    mockTxSelectRows([
      { id: '11111111-1111-4111-8111-111111111111', subCategoryId: 42, status: '3' },
      { id: '22222222-2222-4222-8222-222222222222', subCategoryId: 42, status: '4' },
    ])

    const result = await mergeExpenses(
      { error: null },
      makeFormData({
        selectedExpenseIds: JSON.stringify(['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']),
        groupTitle: 'Cherasco 57',
      }),
    )

    expect(result).toEqual({ error: 'Una o più spese selezionate sono ignorate: riattivale prima di unire.' })
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

describe('categorizeExpenseGroup', () => {
  // The action issues two sequential tx.select() calls: (1) the group-ownership
  // check (`select().from(expenseGroup).where(...)`), then (2) the member load
  // (`select().from(expenseGroupMembership).innerJoin(expense,...).where(...)`).
  // Dispatch by call order, mirroring the categorizeExpense grouped-member mock.
  function makeGroupTx({
    groupRows = [{ id: 1 }],
    memberRows = [],
    updatedRows = [],
  }: {
    groupRows?: Array<{ id: number }>
    memberRows?: Array<{ id: string; subCategoryId: number | null; status: string }>
    updatedRows?: Array<{ id: string }>
  } = {}) {
    let selectCall = 0
    return {
      select: vi.fn().mockImplementation(() => {
        selectCall += 1
        if (selectCall === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(groupRows),
            }),
          }
        }
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(memberRows),
            }),
          }),
        }
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue(updatedRows),
          }),
        }),
      }),
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue({ userId: 'user-1' })
    mocks.writeClassificationHistory.mockResolvedValue(undefined)
    mocks.revalidateCategorizationSurfaces.mockReturnValue(undefined)
  })

  it('updates every member expense and the group row, writing one history row per member', async () => {
    mocks.isSubCategoryVisibleToUser.mockResolvedValue(true)
    const tx = makeGroupTx({
      groupRows: [{ id: 7 }],
      memberRows: [
        { id: 'expense-1', subCategoryId: null, status: '1' },
        { id: 'expense-2', subCategoryId: 10, status: '3' },
      ],
      updatedRows: [{ id: 'expense-1' }, { id: 'expense-2' }],
    })
    mocks.dbTransaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(tx))

    const result = await categorizeExpenseGroup(
      { error: null },
      makeFormData({ groupId: '7', subCategoryId: '42' }),
    )

    expect(result).toEqual({ error: null })
    expect(tx.update).toHaveBeenCalledTimes(2)
    expect(mocks.writeClassificationHistory).toHaveBeenCalledTimes(2)
    expect(mocks.revalidateCategorizationSurfaces).toHaveBeenCalledTimes(1)
  })

  it('returns a safe Italian error and never opens a transaction when the subcategory is not visible', async () => {
    mocks.isSubCategoryVisibleToUser.mockResolvedValue(false)

    const result = await categorizeExpenseGroup(
      { error: null },
      makeFormData({ groupId: '7', subCategoryId: '99' }),
    )

    expect(result).toEqual({ error: 'Sottocategoria non valida.' })
    expect(mocks.dbTransaction).not.toHaveBeenCalled()
    expect(mocks.revalidateCategorizationSurfaces).not.toHaveBeenCalled()
  })

  it('returns "Gruppo non trovato." and touches no expense row when the group is not owned', async () => {
    mocks.isSubCategoryVisibleToUser.mockResolvedValue(true)
    const tx = makeGroupTx({ groupRows: [] })
    mocks.dbTransaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(tx))

    const result = await categorizeExpenseGroup(
      { error: null },
      makeFormData({ groupId: '999', subCategoryId: '42' }),
    )

    expect(result).toEqual({ error: 'Gruppo non trovato.' })
    expect(tx.update).not.toHaveBeenCalled()
    expect(mocks.revalidateCategorizationSurfaces).not.toHaveBeenCalled()
  })
})

describe('addExpensesToGroupAction', () => {
  // The action issues two sequential tx.select() calls: (1) the group-ownership
  // check (returns the group's own subCategoryId), then (2) the candidate
  // expenses' ownership/status/subcategory load. Dispatch by call order.
  function makeTx({
    groupRows = [{ subCategoryId: 42 }],
    expenseRows = [],
  }: {
    groupRows?: Array<{ subCategoryId: number | null }>
    expenseRows?: Array<{ id: string; subCategoryId: number | null; status: string }>
  } = {}) {
    let selectCall = 0
    return {
      select: vi.fn().mockImplementation(() => {
        selectCall += 1
        if (selectCall === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(groupRows),
            }),
          }
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(expenseRows),
          }),
        }
      }),
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue({ userId: 'user-1' })
    mocks.revalidateCategorizationSurfaces.mockReturnValue(undefined)
  })

  it('calls addExpensesToGroup when all additions already match the group category', async () => {
    const tx = makeTx({
      groupRows: [{ subCategoryId: 42 }],
      expenseRows: [
        { id: '11111111-1111-4111-8111-111111111111', subCategoryId: 42, status: '1' },
        { id: '22222222-2222-4222-8222-222222222222', subCategoryId: 42, status: '3' },
      ],
    })
    mocks.dbTransaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(tx))
    mocks.addExpensesToGroup.mockResolvedValue(undefined)

    const result = await addExpensesToGroupAction(
      { error: null },
      makeFormData({
        groupId: '7',
        expenseIds: JSON.stringify([
          '11111111-1111-4111-8111-111111111111',
          '22222222-2222-4222-8222-222222222222',
        ]),
      }),
    )

    expect(result).toEqual({ error: null })
    expect(mocks.addExpensesToGroup).toHaveBeenCalledWith(tx, {
      userId: 'user-1',
      groupId: 7,
      expenseIds: ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'],
    })
    expect(mocks.revalidateCategorizationSurfaces).toHaveBeenCalledTimes(1)
  })

  // CR-02: an uncategorized candidate must be rejected the same way mergeExpenses
  // rejects it ('Categorizza prima di unire.') — addExpensesToGroup never writes
  // expense.subCategoryId (D-09), so admitting a null candidate here would leave
  // a member with no category inside an already-categorized group.
  it('rejects an uncategorized addition without calling addExpensesToGroup', async () => {
    const tx = makeTx({
      groupRows: [{ subCategoryId: 42 }],
      expenseRows: [
        { id: '11111111-1111-4111-8111-111111111111', subCategoryId: null, status: '1' },
        { id: '22222222-2222-4222-8222-222222222222', subCategoryId: 42, status: '3' },
      ],
    })
    mocks.dbTransaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(tx))

    const result = await addExpensesToGroupAction(
      { error: null },
      makeFormData({
        groupId: '7',
        expenseIds: JSON.stringify([
          '11111111-1111-4111-8111-111111111111',
          '22222222-2222-4222-8222-222222222222',
        ]),
      }),
    )

    expect(result).toEqual({ error: 'Categorizza prima di aggiungere al gruppo.' })
    expect(mocks.addExpensesToGroup).not.toHaveBeenCalled()
  })

  it('rejects a differently-categorized addition without calling addExpensesToGroup', async () => {
    const tx = makeTx({
      groupRows: [{ subCategoryId: 42 }],
      expenseRows: [{ id: '11111111-1111-4111-8111-111111111111', subCategoryId: 99, status: '3' }],
    })
    mocks.dbTransaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(tx))

    const result = await addExpensesToGroupAction(
      { error: null },
      makeFormData({
        groupId: '7',
        expenseIds: JSON.stringify(['11111111-1111-4111-8111-111111111111']),
      }),
    )

    expect(result).toEqual({ error: 'Le spese devono avere la stessa categoria del gruppo.' })
    expect(mocks.addExpensesToGroup).not.toHaveBeenCalled()
  })

  it('rejects an ignored (status 4) addition', async () => {
    const tx = makeTx({
      groupRows: [{ subCategoryId: 42 }],
      expenseRows: [{ id: '11111111-1111-4111-8111-111111111111', subCategoryId: null, status: '4' }],
    })
    mocks.dbTransaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(tx))

    const result = await addExpensesToGroupAction(
      { error: null },
      makeFormData({
        groupId: '7',
        expenseIds: JSON.stringify(['11111111-1111-4111-8111-111111111111']),
      }),
    )

    expect(result).toEqual({
      error: 'Una o più spese selezionate sono ignorate: riattivale prima di aggiungerle.',
    })
    expect(mocks.addExpensesToGroup).not.toHaveBeenCalled()
  })

  it('surfaces addExpensesToGroup errors verbatim', async () => {
    const tx = makeTx({
      groupRows: [{ subCategoryId: 42 }],
      expenseRows: [{ id: '11111111-1111-4111-8111-111111111111', subCategoryId: 42, status: '1' }],
    })
    mocks.dbTransaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(tx))
    mocks.addExpensesToGroup.mockRejectedValue(
      new Error('Una spesa selezionata fa già parte di un gruppo.'),
    )

    const result = await addExpensesToGroupAction(
      { error: null },
      makeFormData({
        groupId: '7',
        expenseIds: JSON.stringify(['11111111-1111-4111-8111-111111111111']),
      }),
    )

    expect(result).toEqual({ error: 'Una spesa selezionata fa già parte di un gruppo.' })
  })

  it('rejects a parse failure (empty expenseIds array) without calling verifySession', async () => {
    const result = await addExpensesToGroupAction(
      { error: null },
      makeFormData({ groupId: '7', expenseIds: JSON.stringify([]) }),
    )

    expect(result.error).toBe('Seleziona almeno una spesa da aggiungere.')
    expect(mocks.verifySession).not.toHaveBeenCalled()
    expect(mocks.dbTransaction).not.toHaveBeenCalled()
  })
})

describe('removeExpenseFromGroupAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue({ userId: 'user-1' })
    mocks.revalidateCategorizationSurfaces.mockReturnValue(undefined)
    mocks.dbTransaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn({}))
  })

  it('removes the member and revalidates on success', async () => {
    mocks.removeExpenseFromGroup.mockResolvedValue({ autoDissolved: false })

    const result = await removeExpenseFromGroupAction(
      { error: null },
      makeFormData({ groupId: '7', expenseId: '11111111-1111-4111-8111-111111111111' }),
    )

    expect(result).toEqual({ error: null, autoDissolved: false })
    expect(mocks.removeExpenseFromGroup).toHaveBeenCalledWith(expect.anything(), {
      userId: 'user-1',
      groupId: 7,
      expenseId: '11111111-1111-4111-8111-111111111111',
    })
    expect(mocks.revalidateCategorizationSurfaces).toHaveBeenCalledTimes(1)
  })

  // WR-01: the caller (RemoveGroupMemberButton / GroupDetailClient) needs this
  // signal to redirect instead of refreshing into a now-404'd group detail page.
  it('threads autoDissolved: true through when the removal was the last-pair boundary', async () => {
    mocks.removeExpenseFromGroup.mockResolvedValue({ autoDissolved: true })

    const result = await removeExpenseFromGroupAction(
      { error: null },
      makeFormData({ groupId: '7', expenseId: '11111111-1111-4111-8111-111111111111' }),
    )

    expect(result).toEqual({ error: null, autoDissolved: true })
    expect(mocks.revalidateCategorizationSurfaces).toHaveBeenCalledTimes(1)
  })

  it('surfaces the not-found service error verbatim without revalidating', async () => {
    mocks.removeExpenseFromGroup.mockRejectedValue(new Error('Gruppo non trovato.'))

    const result = await removeExpenseFromGroupAction(
      { error: null },
      makeFormData({ groupId: '999', expenseId: '11111111-1111-4111-8111-111111111111' }),
    )

    expect(result).toEqual({ error: 'Gruppo non trovato.', autoDissolved: false })
    expect(mocks.revalidateCategorizationSurfaces).not.toHaveBeenCalled()
  })
})

describe('dissolveExpenseGroupAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue({ userId: 'user-1' })
    mocks.revalidateCategorizationSurfaces.mockReturnValue(undefined)
    mocks.dbTransaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn({}))
  })

  it('dissolves the group and revalidates on success', async () => {
    mocks.dissolveExpenseGroup.mockResolvedValue(true)

    const result = await dissolveExpenseGroupAction({ error: null }, makeFormData({ groupId: '7' }))

    expect(result).toEqual({ error: null })
    expect(mocks.dissolveExpenseGroup).toHaveBeenCalledWith(expect.anything(), {
      userId: 'user-1',
      groupId: 7,
    })
    expect(mocks.revalidateCategorizationSurfaces).toHaveBeenCalledTimes(1)
  })

  it('surfaces the not-found service error verbatim without revalidating', async () => {
    mocks.dissolveExpenseGroup.mockRejectedValue(new Error('Gruppo non trovato.'))

    const result = await dissolveExpenseGroupAction({ error: null }, makeFormData({ groupId: '999' }))

    expect(result).toEqual({ error: 'Gruppo non trovato.' })
    expect(mocks.revalidateCategorizationSurfaces).not.toHaveBeenCalled()
  })
})
