import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  selectArgs: [] as unknown[],
  fromArgs: [] as unknown[],
  innerJoinArgs: [] as Array<{ table: unknown; condition: unknown }>,
  whereArgs: [] as unknown[],
  insertArgs: [] as unknown[],
  insertValues: [] as unknown[],
  onConflictArgs: [] as unknown[],
  deleteArgs: [] as unknown[],
  queryResult: [] as unknown[],
}))

function makeQueryChain() {
  const chain = {
    from: vi.fn((arg: unknown) => {
      mocks.fromArgs.push(arg)
      return chain
    }),
    innerJoin: vi.fn((table: unknown, condition: unknown) => {
      mocks.innerJoinArgs.push({ table, condition })
      return chain
    }),
    where: vi.fn((arg: unknown) => {
      mocks.whereArgs.push(arg)
      return Promise.resolve(mocks.queryResult)
    }),
  }
  return chain
}

function makeInsertChain() {
  const chain = {
    values: vi.fn((value: unknown) => {
      mocks.insertValues.push(value)
      return chain
    }),
    onConflictDoNothing: vi.fn((arg: unknown) => {
      mocks.onConflictArgs.push(arg)
      return Promise.resolve(undefined)
    }),
  }
  return chain
}

function makeDeleteChain() {
  const chain = {
    where: vi.fn((arg: unknown) => {
      mocks.whereArgs.push(arg)
      return Promise.resolve(undefined)
    }),
  }
  return chain
}

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db', () => ({
  db: {
    select: (arg: unknown) => {
      mocks.selectArgs.push(arg)
      return makeQueryChain()
    },
    insert: (table: unknown) => {
      mocks.insertArgs.push(table)
      return makeInsertChain()
    },
    delete: (table: unknown) => {
      mocks.deleteArgs.push(table)
      return makeDeleteChain()
    },
  },
}))
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ op: 'and', args }),
  eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
  inArray: (column: unknown, values: unknown) => ({ op: 'inArray', column, values }),
}))
vi.mock('@/lib/db/schema', () => ({
  tag: { id: 'tag.id', name: 'tag.name', archived: 'tag.archived' },
  transaction: { id: 'transaction.id', userId: 'transaction.userId' },
  transactionTag: {
    tagId: 'transactionTag.tagId',
    transactionId: 'transactionTag.transactionId',
  },
}))

const {
  bulkInsertTransactionTags,
  bulkDeleteTransactionTags,
  getTagsForTransactionIds,
  getTransactionTagsForTransaction,
  getAlreadyTaggedTransactionIds,
} = await import('@/lib/dal/transaction-tags')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.selectArgs = []
  mocks.fromArgs = []
  mocks.innerJoinArgs = []
  mocks.whereArgs = []
  mocks.insertArgs = []
  mocks.insertValues = []
  mocks.onConflictArgs = []
  mocks.deleteArgs = []
  mocks.queryResult = []
})

describe('bulkInsertTransactionTags', () => {
  it('inserts rows via onConflictDoNothing targeting the (tagId, transactionId) unique constraint', async () => {
    const rows = [
      { tagId: 1, transactionId: 'tx-1' },
      { tagId: 2, transactionId: 'tx-1' },
    ]

    await bulkInsertTransactionTags(rows)

    expect(mocks.insertArgs).toHaveLength(1)
    expect(mocks.insertValues[0]).toEqual(rows)
    expect(mocks.onConflictArgs[0]).toEqual({
      target: ['transactionTag.tagId', 'transactionTag.transactionId'],
    })
  })

  it('calling it twice with identical pairs is a safe no-op — no thrown error', async () => {
    const rows = [{ tagId: 1, transactionId: 'tx-1' }]

    await bulkInsertTransactionTags(rows)
    await expect(bulkInsertTransactionTags(rows)).resolves.toBeUndefined()

    expect(mocks.insertArgs).toHaveLength(2)
  })

  it('empty rows short-circuits without calling db.insert', async () => {
    await bulkInsertTransactionTags([])

    expect(mocks.insertArgs).toHaveLength(0)
  })
})

describe('bulkDeleteTransactionTags', () => {
  it('deletes only rows matching inArray(tagId) AND inArray(transactionId)', async () => {
    await bulkDeleteTransactionTags([1, 2], ['tx-1', 'tx-2'])

    expect(mocks.deleteArgs).toHaveLength(1)
    expect(mocks.whereArgs[0]).toEqual({
      op: 'and',
      args: [
        { op: 'inArray', column: 'transactionTag.tagId', values: [1, 2] },
        { op: 'inArray', column: 'transactionTag.transactionId', values: ['tx-1', 'tx-2'] },
      ],
    })
  })

  it('empty tagIds short-circuits without calling db.delete', async () => {
    await bulkDeleteTransactionTags([], ['tx-1'])

    expect(mocks.deleteArgs).toHaveLength(0)
  })

  it('empty transactionIds short-circuits without calling db.delete', async () => {
    await bulkDeleteTransactionTags([1], [])

    expect(mocks.deleteArgs).toHaveLength(0)
  })
})

describe('getTagsForTransactionIds', () => {
  it('returns the per-row chip shape for the given transactionIds', async () => {
    mocks.queryResult = [{ transactionId: 'tx-1', tagId: 1, tagName: 'Sharm', archived: false }]

    const result = await getTagsForTransactionIds(['tx-1'])

    expect(result).toEqual(mocks.queryResult)
    expect(mocks.selectArgs).toHaveLength(1)
  })

  it('empty transactionIds returns [] without querying', async () => {
    const result = await getTagsForTransactionIds([])

    expect(result).toEqual([])
    expect(mocks.selectArgs).toHaveLength(0)
  })
})

describe('getTransactionTagsForTransaction', () => {
  it('joins through transaction.userId as the IDOR check', async () => {
    mocks.queryResult = [{ transactionId: 'tx-1', tagId: 1, tagName: 'Sharm', archived: false }]

    const result = await getTransactionTagsForTransaction('user-1', 'tx-1')

    expect(result).toEqual(mocks.queryResult)
    expect(mocks.innerJoinArgs).toHaveLength(2)
    expect(mocks.whereArgs[0]).toEqual({
      op: 'and',
      args: [
        { op: 'eq', left: 'transaction.userId', right: 'user-1' },
        { op: 'eq', left: 'transactionTag.transactionId', right: 'tx-1' },
      ],
    })
  })

  it('a transactionId belonging to another user returns [] (mocked as empty query result)', async () => {
    mocks.queryResult = []

    const result = await getTransactionTagsForTransaction('user-1', 'tx-owned-by-other')

    expect(result).toEqual([])
  })
})

describe('getAlreadyTaggedTransactionIds', () => {
  it('returns a Set of the transactionIds subset already carrying tagId', async () => {
    mocks.queryResult = [{ transactionId: 'tx-1' }, { transactionId: 'tx-2' }]

    const result = await getAlreadyTaggedTransactionIds(1, ['tx-1', 'tx-2', 'tx-3'])

    expect(result).toEqual(new Set(['tx-1', 'tx-2']))
  })

  it('empty transactionIds returns an empty Set without querying', async () => {
    const result = await getAlreadyTaggedTransactionIds(1, [])

    expect(result).toEqual(new Set())
    expect(mocks.selectArgs).toHaveLength(0)
  })
})
