import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  whereArgs: [] as unknown[],
  groupByArgs: [] as unknown[],
  orderByArgs: [] as unknown[],
  limitResult: [] as unknown[],
  innerJoinCalls: 0,
}))

function makeQueryChain(result: unknown[] = []) {
  const chain = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => {
      mocks.innerJoinCalls++
      return chain
    }),
    where: vi.fn((arg: unknown) => {
      mocks.whereArgs.push(arg)
      return chain
    }),
    groupBy: vi.fn((...args: unknown[]) => {
      mocks.groupByArgs.push(...args)
      return chain
    }),
    orderBy: vi.fn((...args: unknown[]) => {
      mocks.orderByArgs.push(...args)
      return chain
    }),
    limit: vi.fn(() => Promise.resolve(result)),
  }
  return chain
}

vi.mock('server-only', () => ({}))
vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))
vi.mock('@/lib/dal/auth', () => ({ verifySession: mocks.verifySession }))
vi.mock('@/lib/db', () => ({
  db: {
    select: () => makeQueryChain(mocks.limitResult),
  },
}))
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ op: 'and', args }),
  count: (col?: unknown) => ({ op: 'count', col }),
  desc: (col: unknown) => ({ op: 'desc', col }),
  eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
  inArray: (col: unknown, vals: unknown) => ({ op: 'inArray', col, vals }),
  isNotNull: (col: unknown) => ({ op: 'isNotNull', col }),
}))
vi.mock('@/lib/db/schema', () => ({
  expense: { id: 'expense.id', userId: 'expense.userId', subCategoryId: 'expense.subCategoryId' },
  subCategory: { id: 'subCategory.id', name: 'subCategory.name', categoryId: 'subCategory.categoryId' },
  category: { id: 'category.id', name: 'category.name', type: 'category.type' },
}))

beforeEach(() => {
  mocks.verifySession.mockResolvedValue({ userId: 'user-abc' })
  mocks.whereArgs.length = 0
  mocks.groupByArgs.length = 0
  mocks.orderByArgs.length = 0
  mocks.limitResult.length = 0
  mocks.innerJoinCalls = 0
})

describe('getMostUsedSubcategories', () => {
  it('returns empty array when allowedTypes is empty', async () => {
    const { getMostUsedSubcategories } = await import('@/lib/dal/subcategory-usage')
    const result = await getMostUsedSubcategories([])
    expect(result).toEqual([])
  })

  it('scopes query to session userId', async () => {
    vi.resetModules()
    mocks.verifySession.mockResolvedValue({ userId: 'user-xyz' })
    const { getMostUsedSubcategories } = await import('@/lib/dal/subcategory-usage')
    await getMostUsedSubcategories(['out'])
    const whereArg = mocks.whereArgs[0] as { op: string; args: unknown[] }
    const eqClauses = whereArg.args as Array<{ op: string; left: unknown; right: unknown }>
    const userIdClause = eqClauses.find((c) => c.op === 'eq' && c.right === 'user-xyz')
    expect(userIdClause).toBeDefined()
  })

  // Phase 46: category.type removed — allowedTypes is accepted but not applied until Phase 49 restores direction filter
  it('allowedTypes is accepted without error (category.type filter deferred to Phase 49)', async () => {
    vi.resetModules()
    mocks.verifySession.mockResolvedValue({ userId: 'u1' })
    const { getMostUsedSubcategories } = await import('@/lib/dal/subcategory-usage')
    await expect(getMostUsedSubcategories(['out', 'transfer'])).resolves.not.toThrow()
  })

  it('returns empty array when no categorized expenses', async () => {
    vi.resetModules()
    mocks.verifySession.mockResolvedValue({ userId: 'u1' })
    mocks.limitResult.length = 0
    const { getMostUsedSubcategories } = await import('@/lib/dal/subcategory-usage')
    const result = await getMostUsedSubcategories(['out'])
    expect(result).toEqual([])
  })

  it('maps rows to MostUsedSubcategory shape', async () => {
    vi.resetModules()
    mocks.verifySession.mockResolvedValue({ userId: 'u1' })
    mocks.limitResult.push(
      { subCategoryId: 5, name: 'Affitto', categoryName: 'Casa', useCount: 10 },
      { subCategoryId: 6, name: 'Bollette', categoryName: 'Casa', useCount: 3 },
    )
    const { getMostUsedSubcategories } = await import('@/lib/dal/subcategory-usage')
    const result = await getMostUsedSubcategories(['out'])
    expect(result).toEqual([
      { subCategoryId: 5, name: 'Affitto', categoryName: 'Casa' },
      { subCategoryId: 6, name: 'Bollette', categoryName: 'Casa' },
    ])
  })

  it('joins both subCategory and category tables', async () => {
    vi.resetModules()
    mocks.verifySession.mockResolvedValue({ userId: 'u1' })
    const { getMostUsedSubcategories } = await import('@/lib/dal/subcategory-usage')
    await getMostUsedSubcategories(['in'])
    expect(mocks.innerJoinCalls).toBe(2)
  })
})
