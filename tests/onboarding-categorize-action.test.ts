import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  isSubCategoryVisibleToUser: vi.fn(),
  dbTransaction: vi.fn(),
  writeClassificationHistory: vi.fn(),
  revalidateCategorizationSurfaces: vi.fn(),
  revalidatePath: vi.fn(),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  eq: vi.fn((left: unknown, right: unknown) => ({ op: 'eq', left, right })),
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
vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
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
  and: mocks.and,
  eq: mocks.eq,
}))

const { onboardingCategorizeExpense } = await import('@/lib/actions/onboarding')

function makeFormData(fields: Record<string, string | null>) {
  const formData = new FormData()

  for (const [key, value] of Object.entries(fields)) {
    if (value !== null) formData.append(key, value)
  }

  return formData
}

function makeTx() {
  const selectLimit = vi.fn().mockResolvedValue([{ subCategoryId: null, status: '1' }])
  const selectWhere = vi.fn(() => ({ limit: selectLimit }))
  const selectFrom = vi.fn(() => ({ where: selectWhere }))
  const select = vi.fn(() => ({ from: selectFrom }))

  const returning = vi.fn().mockResolvedValue([{ id: 'expense-1' }])
  const updateWhere = vi.fn(() => ({ returning }))
  const set = vi.fn(() => ({ where: updateWhere }))
  const update = vi.fn(() => ({ set }))

  return { select, update, selectWhere, updateWhere }
}

describe('onboardingCategorizeExpense (R-OB-07)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue({ userId: 'user-1' })
    mocks.isSubCategoryVisibleToUser.mockResolvedValue(true)
    mocks.writeClassificationHistory.mockResolvedValue(undefined)
    mocks.revalidateCategorizationSurfaces.mockReturnValue(undefined)
    mocks.revalidatePath.mockReturnValue(undefined)
    mocks.dbTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(makeTx()),
    )
  })

  it('R-OB-07 rejects when SingleCategorizeSchema fails with missing id', async () => {
    const result = await onboardingCategorizeExpense(
      { error: null },
      makeFormData({ id: null, subCategoryId: '42' }),
    )

    expect(result).toEqual({ error: 'ID spesa mancante.' })
    expect(mocks.verifySession).not.toHaveBeenCalled()
    expect(mocks.dbTransaction).not.toHaveBeenCalled()
  })

  it('R-OB-07 rejects when isSubCategoryVisibleToUser returns false', async () => {
    mocks.isSubCategoryVisibleToUser.mockResolvedValue(false)

    const result = await onboardingCategorizeExpense(
      { error: null },
      makeFormData({ id: 'expense-1', subCategoryId: '99' }),
    )

    expect(result).toEqual({ error: 'Sottocategoria non valida.' })
    expect(mocks.isSubCategoryVisibleToUser).toHaveBeenCalledWith(99, 'user-1')
    expect(mocks.dbTransaction).not.toHaveBeenCalled()
  })

  it('R-OB-07 scopes the UPDATE to id and userId as an IDOR guard', async () => {
    const tx = makeTx()
    mocks.dbTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(tx),
    )

    await onboardingCategorizeExpense(
      { error: null },
      makeFormData({ id: 'expense-1', subCategoryId: '42' }),
    )

    expect(tx.updateWhere).toHaveBeenCalledWith(
      expect.objectContaining({
        op: 'and',
        args: expect.arrayContaining([
          { op: 'eq', left: 'expense.id', right: 'expense-1' },
          { op: 'eq', left: 'expense.userId', right: 'user-1' },
        ]),
      }),
    )
    expect(mocks.eq).toHaveBeenCalledWith('expense.userId', 'user-1')
  })

  it("R-OB-07 writes classification history with source='manual'", async () => {
    await onboardingCategorizeExpense(
      { error: null },
      makeFormData({ id: 'expense-1', subCategoryId: '42' }),
    )

    expect(mocks.writeClassificationHistory).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'user-1',
        expenseId: 'expense-1',
        toSubCategoryId: 42,
        toStatus: '3',
        source: 'manual',
      }),
    )
  })

  it('R-OB-07 revalidates /onboarding in addition to categorization surfaces', async () => {
    await onboardingCategorizeExpense(
      { error: null },
      makeFormData({ id: 'expense-1', subCategoryId: '42' }),
    )

    expect(mocks.revalidateCategorizationSurfaces).toHaveBeenCalledTimes(1)
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/onboarding')
  })

  it('R-OB-07 returns { error: null } on the happy path', async () => {
    const result = await onboardingCategorizeExpense(
      { error: null },
      makeFormData({ id: 'expense-1', subCategoryId: '42' }),
    )

    expect(result).toEqual({ error: null })
  })
})
