import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  bulkInsertTransactionTags: vi.fn(),
  bulkDeleteTransactionTags: vi.fn(),
  getTag: vi.fn(),
  whereArgs: [] as unknown[],
  transactionQueryResult: [] as { id: string }[],
}))

function makeQueryChain() {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn((arg: unknown) => {
      mocks.whereArgs.push(arg)
      return Promise.resolve(mocks.transactionQueryResult)
    }),
  }
  return chain
}

vi.mock('@/lib/dal/transaction-tags', () => ({
  bulkInsertTransactionTags: mocks.bulkInsertTransactionTags,
  bulkDeleteTransactionTags: mocks.bulkDeleteTransactionTags,
}))
vi.mock('@/lib/dal/tags', () => ({
  getTag: mocks.getTag,
}))
vi.mock('@/lib/db', () => ({
  db: {
    select: () => makeQueryChain(),
  },
}))
vi.mock('@/lib/db/schema', () => ({
  transaction: { id: 'transaction.id', userId: 'transaction.userId' },
}))
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ op: 'and', args }),
  eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
  inArray: (column: unknown, values: unknown) => ({ op: 'inArray', column, values }),
}))

const { TagAssignmentError, bulkAssignTags, bulkRemoveTags, addSingleTransactionTag, removeSingleTransactionTag } =
  await import('@/lib/services/tag-assignment')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.whereArgs = []
  mocks.transactionQueryResult = []
  mocks.getTag.mockResolvedValue({ id: 1, userId: 'user-1' })
})

describe('bulkAssignTags (D-06 additive union)', () => {
  it('adds the chosen tags to a transaction that already carries another tag — nothing removed', async () => {
    mocks.transactionQueryResult = [{ id: 'tx-1' }]
    mocks.getTag.mockResolvedValue({ id: 1, userId: 'user-1' })

    await bulkAssignTags({ userId: 'user-1', transactionIds: ['tx-1'], tagIds: [1, 2] })

    expect(mocks.bulkInsertTransactionTags).toHaveBeenCalledWith([
      { tagId: 1, transactionId: 'tx-1' },
      { tagId: 2, transactionId: 'tx-1' },
    ])
    expect(mocks.bulkDeleteTransactionTags).not.toHaveBeenCalled()
  })

  it('rejects without calling bulkInsertTransactionTags when the transaction-ownership check comes up short', async () => {
    // Requested 1 transaction id but the ownership query returns 0 rows (owned by another user).
    mocks.transactionQueryResult = []

    await expect(
      bulkAssignTags({ userId: 'user-1', transactionIds: ['tx-owned-by-other'], tagIds: [1] }),
    ).rejects.toThrow(TagAssignmentError)

    expect(mocks.bulkInsertTransactionTags).not.toHaveBeenCalled()
  })

  it('rejects without calling bulkInsertTransactionTags when the tag-ownership check comes up short', async () => {
    mocks.transactionQueryResult = [{ id: 'tx-1' }]
    mocks.getTag.mockResolvedValue(null)

    await expect(bulkAssignTags({ userId: 'user-1', transactionIds: ['tx-1'], tagIds: [999] })).rejects.toThrow(
      TagAssignmentError,
    )

    expect(mocks.bulkInsertTransactionTags).not.toHaveBeenCalled()
  })
})

describe('bulkRemoveTags (D-07 symmetric removal)', () => {
  it('removes exactly the requested (tagId, transactionId) pairs', async () => {
    mocks.transactionQueryResult = [{ id: 'tx-1' }]

    await bulkRemoveTags({ userId: 'user-1', transactionIds: ['tx-1'], tagIds: [1] })

    expect(mocks.bulkDeleteTransactionTags).toHaveBeenCalledWith([1], ['tx-1'])
    expect(mocks.bulkInsertTransactionTags).not.toHaveBeenCalled()
  })

  it('rejects without calling bulkDeleteTransactionTags when ownership checks fail', async () => {
    mocks.transactionQueryResult = []

    await expect(bulkRemoveTags({ userId: 'user-1', transactionIds: ['tx-other'], tagIds: [1] })).rejects.toThrow(
      TagAssignmentError,
    )

    expect(mocks.bulkDeleteTransactionTags).not.toHaveBeenCalled()
  })
})

describe('addSingleTransactionTag / removeSingleTransactionTag (D-07b)', () => {
  it('addSingleTransactionTag delegates to the bulk insert path with single-element arrays', async () => {
    mocks.transactionQueryResult = [{ id: 'tx-1' }]

    await addSingleTransactionTag({ userId: 'user-1', transactionId: 'tx-1', tagId: 1 })

    expect(mocks.bulkInsertTransactionTags).toHaveBeenCalledWith([{ tagId: 1, transactionId: 'tx-1' }])
  })

  it('removeSingleTransactionTag delegates to the bulk delete path with single-element arrays', async () => {
    mocks.transactionQueryResult = [{ id: 'tx-1' }]

    await removeSingleTransactionTag({ userId: 'user-1', transactionId: 'tx-1', tagId: 1 })

    expect(mocks.bulkDeleteTransactionTags).toHaveBeenCalledWith([1], ['tx-1'])
  })
})
