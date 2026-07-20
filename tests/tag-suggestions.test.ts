import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Task 1: lib/dal/tag-suggestions.ts — date-range transaction query
// ---------------------------------------------------------------------------

const dalMocks = vi.hoisted(() => ({
  fromArgs: [] as unknown[],
  whereArgs: [] as unknown[],
  orderByArgs: [] as unknown[][],
  queryResult: [] as unknown[],
}))

function makeQueryChain() {
  const chain = {
    from: vi.fn((arg: unknown) => {
      dalMocks.fromArgs.push(arg)
      return chain
    }),
    where: vi.fn((arg: unknown) => {
      dalMocks.whereArgs.push(arg)
      return chain
    }),
    orderBy: vi.fn((...args: unknown[]) => {
      dalMocks.orderByArgs.push(args)
      return Promise.resolve(dalMocks.queryResult)
    }),
  }
  return chain
}

function findPredicate(node: unknown, predicate: (candidate: unknown) => boolean): unknown {
  if (predicate(node)) return node

  if (node && typeof node === 'object') {
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          const found = findPredicate(item, predicate)
          if (found) return found
        }
      } else {
        const found = findPredicate(value, predicate)
        if (found) return found
      }
    }
  }

  return undefined
}

function expectContainsPredicate(node: unknown, expected: unknown) {
  expect(findPredicate(node, (candidate) => JSON.stringify(candidate) === JSON.stringify(expected))).toEqual(expected)
}

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db', () => ({
  db: {
    select: () => makeQueryChain(),
  },
}))
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ op: 'and', args }),
  asc: (column: unknown) => ({ op: 'asc', column }),
  eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
  gte: (left: unknown, right: unknown) => ({ op: 'gte', left, right }),
  lte: (left: unknown, right: unknown) => ({ op: 'lte', left, right }),
}))
vi.mock('@/lib/db/schema', () => ({
  transaction: {
    id: 'transaction.id',
    userId: 'transaction.userId',
    occurredAt: 'transaction.occurredAt',
    description: 'transaction.description',
    customTitle: 'transaction.customTitle',
    amount: 'transaction.amount',
    currency: 'transaction.currency',
  },
}))

const { getTransactionsInDateRange } = await import('@/lib/dal/tag-suggestions')

describe('lib/dal/tag-suggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dalMocks.fromArgs.length = 0
    dalMocks.whereArgs.length = 0
    dalMocks.orderByArgs.length = 0
    dalMocks.queryResult = []
  })

  it('scopes to userId and uses inclusive gte/lte bounds against occurredAt', async () => {
    const start = new Date('2026-07-01T00:00:00.000Z')
    const end = new Date('2026-07-31T23:59:59.999Z')

    await getTransactionsInDateRange('user-1', start, end)

    expectContainsPredicate(dalMocks.whereArgs[0], { op: 'eq', left: 'transaction.userId', right: 'user-1' })
    expectContainsPredicate(dalMocks.whereArgs[0], { op: 'gte', left: 'transaction.occurredAt', right: start })
    expectContainsPredicate(dalMocks.whereArgs[0], { op: 'lte', left: 'transaction.occurredAt', right: end })
  })

  it('orders by occurredAt asc, id asc (TAG-03 ordering edge)', async () => {
    await getTransactionsInDateRange('user-1', new Date(), new Date())

    expect(dalMocks.orderByArgs[0]).toEqual([
      { op: 'asc', column: 'transaction.occurredAt' },
      { op: 'asc', column: 'transaction.id' },
    ])
  })

  it('resolves to an empty array, never an error, when no transactions fall in range', async () => {
    dalMocks.queryResult = []

    await expect(getTransactionsInDateRange('user-1', new Date(), new Date())).resolves.toEqual([])
  })

  it('includes a transaction dated exactly at start or end (boundary inclusion is a DB-query concern proven by gte/lte usage above)', async () => {
    const boundaryDate = new Date('2026-07-15T12:00:00.000Z')
    dalMocks.queryResult = [
      {
        id: 'tx-1',
        occurredAt: boundaryDate,
        description: 'Hotel Roma',
        customTitle: null,
        amount: '-120.00',
        currency: 'EUR',
      },
    ]

    const result = await getTransactionsInDateRange('user-1', boundaryDate, boundaryDate)

    expect(result).toEqual(dalMocks.queryResult)
  })
})
