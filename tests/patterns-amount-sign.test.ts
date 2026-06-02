import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock helpers (mirror categories-dal.test.ts patterns)
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  selectResults: [] as unknown[][],
  fromArgs: [] as unknown[],
  leftJoinArgs: [] as Array<{ table: unknown; condition: unknown }>,
  whereArgs: [] as unknown[],
  limitArgs: [] as number[],
}))

function makeQueryChain() {
  const chain = {
    from: vi.fn((arg: unknown) => {
      mocks.fromArgs.push(arg)
      return chain
    }),
    leftJoin: vi.fn((table: unknown, condition: unknown) => {
      mocks.leftJoinArgs.push({ table, condition })
      return chain
    }),
    where: vi.fn((arg: unknown) => {
      mocks.whereArgs.push(arg)
      return chain
    }),
    limit: vi.fn((n: number) => {
      mocks.limitArgs.push(n)
      return Promise.resolve(mocks.selectResults.length > 0 ? mocks.selectResults.shift() : [])
    }),
  }
  return chain
}

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db', () => ({
  db: {
    select: (shape: unknown) => {
      void shape
      return makeQueryChain()
    },
  },
}))
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ op: 'and', args }),
  eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
  isNull: (column: unknown) => ({ op: 'isNull', column }),
  or: (...args: unknown[]) => ({ op: 'or', args }),
}))
vi.mock('@/lib/db/schema', () => ({
  subCategory: {
    id: 'subCategory.id',
    userId: 'subCategory.userId',
    categoryId: 'subCategory.categoryId',
    isActive: 'subCategory.isActive',
  },
  category: {
    id: 'category.id',
    userId: 'category.userId',
    type: 'category.type',
    isActive: 'category.isActive',
  },
}))

// ---------------------------------------------------------------------------
// Imports under test
// ---------------------------------------------------------------------------

const { getCategoryTypeForSubCategory } = await import('@/lib/dal/patterns')
const { deriveAmountSign } = await import('@/lib/validations/pattern')

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function findPredicate(node: unknown, predicate: (c: unknown) => boolean): unknown {
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
  expect(
    findPredicate(node, (candidate) => JSON.stringify(candidate) === JSON.stringify(expected)),
  ).toEqual(expected)
}

// ---------------------------------------------------------------------------
// deriveAmountSign tests
// ---------------------------------------------------------------------------

describe('deriveAmountSign — ADR 0008 derivation table', () => {
  it('maps out -> negative', () => {
    expect(deriveAmountSign('out')).toBe('negative')
  })

  it('maps in -> positive', () => {
    expect(deriveAmountSign('in')).toBe('positive')
  })

  it('maps transfer -> any', () => {
    expect(deriveAmountSign('transfer')).toBe('any')
  })

  it('maps system -> any', () => {
    expect(deriveAmountSign('system')).toBe('any')
  })
})

// ---------------------------------------------------------------------------
// getCategoryTypeForSubCategory tests
// ---------------------------------------------------------------------------

describe('getCategoryTypeForSubCategory — DAL scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.selectResults.length = 0
    mocks.fromArgs.length = 0
    mocks.leftJoinArgs.length = 0
    mocks.whereArgs.length = 0
    mocks.limitArgs.length = 0
  })

  it('returns the category type for a subcategory visible to the user', async () => {
    mocks.selectResults.push([{ type: 'out' }])

    const result = await getCategoryTypeForSubCategory(10, 'user-1')

    expect(result).toBe('out')
  })

  it('returns null when the subcategory is not visible to the user', async () => {
    mocks.selectResults.push([]) // empty = not found

    const result = await getCategoryTypeForSubCategory(99, 'user-1')

    expect(result).toBeNull()
  })

  it('returns null when the subcategory does not exist at all', async () => {
    mocks.selectResults.push([])

    const result = await getCategoryTypeForSubCategory(999, 'user-1')

    expect(result).toBeNull()
  })

  it('scopes the lookup to the active subcategory id', async () => {
    mocks.selectResults.push([{ type: 'in' }])

    await getCategoryTypeForSubCategory(42, 'user-7')

    // The WHERE clause must contain the subcategory id constraint
    expectContainsPredicate(mocks.whereArgs[0], {
      op: 'eq',
      left: 'subCategory.id',
      right: 42,
    })
  })

  it('scopes the lookup to the requesting user for user-owned subcategories and categories', async () => {
    mocks.selectResults.push([{ type: 'in' }])

    await getCategoryTypeForSubCategory(10, 'user-abc')

    // Must restrict subCategory to userId null-or-user
    const whereNode = mocks.whereArgs[0]
    expectContainsPredicate(whereNode, {
      op: 'eq',
      left: 'subCategory.userId',
      right: 'user-abc',
    })
    // Must restrict category to userId null-or-user
    expectContainsPredicate(whereNode, {
      op: 'eq',
      left: 'category.userId',
      right: 'user-abc',
    })
  })

  it('uses limit(1) to avoid unnecessary full scans', async () => {
    mocks.selectResults.push([{ type: 'out' }])

    await getCategoryTypeForSubCategory(5, 'user-1')

    expect(mocks.limitArgs[0]).toBe(1)
  })
})
