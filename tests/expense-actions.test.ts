import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  isSubCategoryVisibleToUser: vi.fn(),
  dbTransaction: vi.fn(),
  writeClassificationHistory: vi.fn(),
  revalidateCategorizationSurfaces: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/dal/auth', () => ({ verifySession: mocks.verifySession }))
vi.mock('@/lib/dal/categories', () => ({
  isSubCategoryVisibleToUser: mocks.isSubCategoryVisibleToUser,
}))
vi.mock('@/lib/dal/classification-history', () => ({
  writeClassificationHistory: mocks.writeClassificationHistory,
}))
vi.mock('@/lib/actions/revalidation', () => ({
  revalidateCategorizationSurfaces: mocks.revalidateCategorizationSurfaces,
}))
vi.mock('@/lib/db', () => ({
  db: {
    transaction: mocks.dbTransaction,
  },
}))
vi.mock('@/lib/db/schema', () => ({
  expense: {
    id: 'expense.id',
    userId: 'expense.userId',
    subCategoryId: 'expense.subCategoryId',
    status: 'expense.status',
    updatedAt: 'expense.updatedAt',
  },
}))
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ op: 'and', args }),
  eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
  inArray: (col: unknown, vals: unknown) => ({ op: 'inArray', col, vals }),
}))

const { categorizeExpense, bulkCategorize } = await import('@/lib/actions/expenses')

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    fd.append(key, value)
  }
  return fd
}

describe('categorizeExpense — subcategory visibility guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue({ userId: 'user-1' })
    mocks.writeClassificationHistory.mockResolvedValue(undefined)
    mocks.revalidateCategorizationSurfaces.mockReturnValue(undefined)
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
