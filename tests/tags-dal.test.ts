import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fromArgs: [] as unknown[],
  whereArgs: [] as unknown[],
  orderByArgs: [] as unknown[][],
  limitArgs: [] as unknown[],
  queryResult: [] as unknown[],
  selectResults: [] as unknown[][],
  insertArgs: [] as unknown[],
  insertValues: [] as unknown[],
  updateArgs: [] as unknown[],
  updateSets: [] as unknown[],
  returningResult: [] as unknown[],
}))

function nextSelectResult() {
  return mocks.selectResults.length > 0 ? mocks.selectResults.shift() : mocks.queryResult
}

function makeQueryChain() {
  const chain = {
    from: vi.fn((arg: unknown) => {
      mocks.fromArgs.push(arg)
      return chain
    }),
    where: vi.fn((arg: unknown) => {
      mocks.whereArgs.push(arg)
      return chain
    }),
    orderBy: vi.fn((...args: unknown[]) => {
      mocks.orderByArgs.push(args)
      return Promise.resolve(mocks.queryResult)
    }),
    limit: vi.fn((arg: unknown) => {
      mocks.limitArgs.push(arg)
      return Promise.resolve(nextSelectResult())
    }),
    then: vi.fn((resolve: (value: unknown[] | undefined) => unknown) => Promise.resolve(resolve(nextSelectResult()))),
  }

  return chain
}

function makeInsertChain() {
  const chain = {
    values: vi.fn((value: unknown) => {
      mocks.insertValues.push(value)
      return chain
    }),
    returning: vi.fn(() => Promise.resolve(mocks.returningResult)),
  }
  return chain
}

function makeUpdateChain() {
  const chain = {
    set: vi.fn((value: unknown) => {
      mocks.updateSets.push(value)
      return chain
    }),
    where: vi.fn((arg: unknown) => {
      mocks.whereArgs.push(arg)
      return chain
    }),
    returning: vi.fn(() => Promise.resolve(mocks.returningResult)),
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
vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))
vi.mock('@/lib/db', () => ({
  db: {
    select: () => makeQueryChain(),
    insert: (table: unknown) => {
      mocks.insertArgs.push(table)
      return makeInsertChain()
    },
    update: (table: unknown) => {
      mocks.updateArgs.push(table)
      return makeUpdateChain()
    },
  },
}))
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ op: 'and', args }),
  asc: (column: unknown) => ({ op: 'asc', column }),
  eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
  isNotNull: (column: unknown) => ({ op: 'isNotNull', column }),
}))
vi.mock('@/lib/db/schema', () => ({
  tag: {
    id: 'tag.id',
    userId: 'tag.userId',
    name: 'tag.name',
    normalizedName: 'tag.normalizedName',
    dateRangeStart: 'tag.dateRangeStart',
    dateRangeEnd: 'tag.dateRangeEnd',
    archived: 'tag.archived',
    createdAt: 'tag.createdAt',
  },
}))

const {
  getTags,
  getTag,
  getActiveTagsWithDateRange,
  getTagByNormalizedName,
  insertTagRow,
  updateTagRow,
  archiveTagRow,
} = await import('@/lib/dal/tags')

describe('lib/dal/tags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fromArgs.length = 0
    mocks.whereArgs.length = 0
    mocks.orderByArgs.length = 0
    mocks.limitArgs.length = 0
    mocks.selectResults.length = 0
    mocks.insertArgs.length = 0
    mocks.insertValues.length = 0
    mocks.updateArgs.length = 0
    mocks.updateSets.length = 0
    mocks.returningResult = []
    mocks.queryResult = []
  })

  it('scopes getTags to userId, ordered by createdAt then id asc, and includes archived rows (D-04)', async () => {
    mocks.queryResult = [{ id: 1, userId: 'user-1', archived: true }]

    const result = await getTags('user-1')

    expect(result).toEqual([{ id: 1, userId: 'user-1', archived: true }])
    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'tag.userId', right: 'user-1' })
    expect(mocks.orderByArgs[0]).toEqual([
      { op: 'asc', column: 'tag.createdAt' },
      { op: 'asc', column: 'tag.id' },
    ])
  })

  it('resolves to an empty array, never null/throw, for a user with zero tags', async () => {
    mocks.queryResult = []

    await expect(getTags('user-with-none')).resolves.toEqual([])
  })

  it('filters getActiveTagsWithDateRange to archived=false and both range bounds present', async () => {
    mocks.queryResult = []

    await getActiveTagsWithDateRange('user-1')

    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'tag.userId', right: 'user-1' })
    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'tag.archived', right: false })
    expectContainsPredicate(mocks.whereArgs[0], { op: 'isNotNull', column: 'tag.dateRangeStart' })
    expectContainsPredicate(mocks.whereArgs[0], { op: 'isNotNull', column: 'tag.dateRangeEnd' })
  })

  it('getTagByNormalizedName filters on (userId, normalizedName) and returns the single row', async () => {
    mocks.selectResults.push([{ id: 5, userId: 'user-1', normalizedName: 'sharm' }])

    const result = await getTagByNormalizedName('user-1', 'sharm')

    expect(result).toEqual({ id: 5, userId: 'user-1', normalizedName: 'sharm' })
    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'tag.userId', right: 'user-1' })
    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'tag.normalizedName', right: 'sharm' })
  })

  it('getTagByNormalizedName returns null when absent', async () => {
    mocks.selectResults.push([])

    await expect(getTagByNormalizedName('user-1', 'nope')).resolves.toBeNull()
  })

  it('getTag scopes to (id, userId) and returns null when not found', async () => {
    mocks.selectResults.push([])

    await expect(getTag('user-1', 99)).resolves.toBeNull()
    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'tag.id', right: 99 })
    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'tag.userId', right: 'user-1' })
    expect(mocks.limitArgs[0]).toBe(1)
  })

  it('insertTagRow writes the caller-supplied normalizedName verbatim, performing no normalization itself', async () => {
    mocks.returningResult = [{ id: 1, userId: 'user-1', name: '  Sharm ', normalizedName: 'sharm' }]

    const result = await insertTagRow({
      userId: 'user-1',
      name: '  Sharm ',
      normalizedName: 'sharm',
      dateRangeStart: null,
      dateRangeEnd: null,
    })

    expect(result).toEqual({ id: 1, userId: 'user-1', name: '  Sharm ', normalizedName: 'sharm' })
    expect(mocks.insertValues[0]).toEqual({
      userId: 'user-1',
      name: '  Sharm ',
      normalizedName: 'sharm',
      dateRangeStart: null,
      dateRangeEnd: null,
      archived: false,
    })
  })

  it('updateTagRow scopes the update to (id, userId) and returns null when no owned row matches', async () => {
    mocks.returningResult = []

    await expect(updateTagRow('user-1', 5, { name: 'New name' })).resolves.toBeNull()
    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'tag.id', right: 5 })
    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'tag.userId', right: 'user-1' })
  })

  it('archiveTagRow is the only writer of archived=true and never deletes', async () => {
    mocks.returningResult = [{ id: 5, archived: true }]

    const result = await archiveTagRow('user-1', 5)

    expect(result).toEqual({ id: 5, archived: true })
    expect(mocks.updateSets[0]).toMatchObject({ archived: true })
    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'tag.id', right: 5 })
    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'tag.userId', right: 'user-1' })
  })
})
