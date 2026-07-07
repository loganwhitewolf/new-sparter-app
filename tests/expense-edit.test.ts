import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  writeClassificationHistory: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/db', () => ({
  db: {
    transaction: mocks.transaction,
  },
}))

vi.mock('@/lib/db/schema', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db/schema')>()
  return {
    ...actual,
    expense: {
      ...actual.expense,
      id: 'expense.id',
      userId: 'expense.userId',
      subCategoryId: 'expense.subCategoryId',
      status: 'expense.status',
    },
  }
})

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    and: vi.fn((...args) => ({ kind: 'and', args })),
    eq: vi.fn((a, b) => ({ kind: 'eq', a, b })),
  }
})

vi.mock('@/lib/dal/classification-history', () => ({
  writeClassificationHistory: mocks.writeClassificationHistory,
}))

const { updateExpense } = await import('@/lib/dal/expenses')

function makeSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  }
  mocks.select.mockReturnValueOnce(chain)
  return chain
}

function makeUpdateChain() {
  const chain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  }
  mocks.update.mockReturnValueOnce(chain)
  return chain
}

const DERIVED_FIELD_KEYS = ['totalAmount', 'transactionCount', 'firstTransactionAt', 'lastTransactionAt']

describe('updateExpense', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transaction.mockImplementation(async (cb) =>
      cb({
        select: mocks.select,
        update: mocks.update,
      }),
    )
  })

  it('runs the whole read+write+history sequence inside a single db.transaction (DET-04 atomicity)', async () => {
    makeSelectChain([{ subCategoryId: null, status: '1' }])
    const updateChain = makeUpdateChain()

    await updateExpense({ id: 'exp-1', userId: 'user-1', title: 'Spesa X', subCategoryId: 7 })

    expect(mocks.transaction).toHaveBeenCalledTimes(1)
    expect(updateChain.set).toHaveBeenCalledTimes(1)
  })

  it('transitions status to categorized and writes manual history on assignment (DET-04 categorize)', async () => {
    makeSelectChain([{ subCategoryId: null, status: '1' }])
    const updateChain = makeUpdateChain()

    await updateExpense({ id: 'exp-1', userId: 'user-1', title: 'Spesa X', subCategoryId: 7 })

    const setPayload = updateChain.set.mock.calls[0][0]
    expect(setPayload.subCategoryId).toBe(7)
    expect(setPayload.status).toBe('3')
    for (const key of DERIVED_FIELD_KEYS) {
      expect(setPayload).not.toHaveProperty(key)
    }

    expect(mocks.writeClassificationHistory).toHaveBeenCalledTimes(1)
    expect(mocks.writeClassificationHistory).toHaveBeenCalledWith(
      expect.anything(),
      {
        userId: 'user-1',
        expenseId: 'exp-1',
        fromSubCategoryId: null,
        toSubCategoryId: 7,
        fromStatus: '1',
        toStatus: '3',
        source: 'manual',
      },
    )
  })

  it('transitions status to uncategorized on explicit clear without writing history (DET-04 uncategorize)', async () => {
    makeSelectChain([{ subCategoryId: 7, status: '3' }])
    const updateChain = makeUpdateChain()

    await updateExpense({ id: 'exp-1', userId: 'user-1', title: 'Spesa X', subCategoryId: null })

    const setPayload = updateChain.set.mock.calls[0][0]
    expect(setPayload.subCategoryId).toBeNull()
    expect(setPayload.status).toBe('1')
    for (const key of DERIVED_FIELD_KEYS) {
      expect(setPayload).not.toHaveProperty(key)
    }

    expect(mocks.writeClassificationHistory).not.toHaveBeenCalled()
  })

  it('leaves category/status untouched when subCategoryId is omitted (DET-04 no-op)', async () => {
    makeSelectChain([{ subCategoryId: 7, status: '3' }])
    const updateChain = makeUpdateChain()

    await updateExpense({ id: 'exp-1', userId: 'user-1', title: 'New title only' })

    const setPayload = updateChain.set.mock.calls[0][0]
    expect(setPayload).not.toHaveProperty('subCategoryId')
    expect(setPayload).not.toHaveProperty('status')
    for (const key of DERIVED_FIELD_KEYS) {
      expect(setPayload).not.toHaveProperty(key)
    }

    expect(mocks.writeClassificationHistory).not.toHaveBeenCalled()
  })

  it('never writes derived aggregate fields under any call shape (DET-04 immutability)', async () => {
    const cases: Array<{ before: { subCategoryId: number | null; status: '1' | '2' | '3' | '4' }; call: Parameters<typeof updateExpense>[0] }> = [
      { before: { subCategoryId: null, status: '1' }, call: { id: 'exp-1', userId: 'user-1', title: 'A', subCategoryId: 7 } },
      { before: { subCategoryId: 7, status: '3' }, call: { id: 'exp-1', userId: 'user-1', title: 'B', subCategoryId: null } },
      { before: { subCategoryId: 7, status: '3' }, call: { id: 'exp-1', userId: 'user-1', title: 'C' } },
    ]

    for (const { before, call } of cases) {
      makeSelectChain([before])
      const updateChain = makeUpdateChain()

      await updateExpense(call)

      const setPayload = updateChain.set.mock.calls[0][0]
      for (const key of DERIVED_FIELD_KEYS) {
        expect(setPayload).not.toHaveProperty(key)
      }
    }
  })

  it('scopes both the read and the write to the caller-owned expense id + userId (IDOR guard)', async () => {
    makeSelectChain([{ subCategoryId: null, status: '1' }])
    const updateChain = makeUpdateChain()

    await updateExpense({ id: 'exp-1', userId: 'user-1', title: 'Spesa X', subCategoryId: 7 })

    const whereArg = updateChain.where.mock.calls[0][0]
    expect(whereArg.kind).toBe('and')
    const eqArgs = whereArg.args.map((arg: { a: string; b: unknown }) => ({ a: arg.a, b: arg.b }))
    expect(eqArgs).toEqual(
      expect.arrayContaining([
        { a: 'expense.id', b: 'exp-1' },
        { a: 'expense.userId', b: 'user-1' },
      ]),
    )
  })
})
