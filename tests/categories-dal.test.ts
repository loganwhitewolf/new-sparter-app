import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  selectedShapes: [] as unknown[],
  fromArgs: [] as unknown[],
  leftJoinArgs: [] as Array<{ table: unknown, condition: unknown }>,
  whereArgs: [] as unknown[],
  orderByArgs: [] as unknown[][],
  queryResult: [] as CategoryRowFixture[],
}))

type CategoryRowFixture = {
  categoryId: number
  categoryName: string
  categorySlug: string
  categoryType: 'in' | 'out' | 'system'
  categoryUserId: string | null
  subCategoryId: number | null
  subCategoryName: string | null
  subCategorySlug: string | null
  subCategoryUserId: string | null
  overrideCustomName: string | null
}

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
    orderBy: vi.fn((...args: unknown[]) => {
      mocks.orderByArgs.push(args)
      return Promise.resolve(mocks.queryResult)
    }),
  }

  return chain
}

function systemCategoryRow(overrides: Partial<CategoryRowFixture> = {}): CategoryRowFixture {
  return {
    categoryId: 1,
    categoryName: 'Home',
    categorySlug: 'home',
    categoryType: 'out',
    categoryUserId: null,
    subCategoryId: 10,
    subCategoryName: 'Rent',
    subCategorySlug: 'rent',
    subCategoryUserId: null,
    overrideCustomName: null,
    ...overrides,
  }
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
vi.mock('@/lib/dal/auth', () => ({ verifySession: mocks.verifySession }))
vi.mock('@/lib/db', () => ({
  db: {
    select: (shape: unknown) => {
      mocks.selectedShapes.push(shape)
      return makeQueryChain()
    },
  },
}))
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ op: 'and', args }),
  asc: (column: unknown) => ({ op: 'asc', column }),
  eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
  isNull: (column: unknown) => ({ op: 'isNull', column }),
  or: (...args: unknown[]) => ({ op: 'or', args }),
}))
vi.mock('@/lib/db/schema', () => ({
  category: {
    id: 'category.id',
    name: 'category.name',
    slug: 'category.slug',
    type: 'category.type',
    userId: 'category.userId',
    displayOrder: 'category.displayOrder',
    isActive: 'category.isActive',
  },
  subCategory: {
    id: 'subCategory.id',
    name: 'subCategory.name',
    slug: 'subCategory.slug',
    userId: 'subCategory.userId',
    categoryId: 'subCategory.categoryId',
    displayOrder: 'subCategory.displayOrder',
    isActive: 'subCategory.isActive',
  },
  userSubcategoryOverride: {
    customName: 'userSubcategoryOverride.customName',
    subCategoryId: 'userSubcategoryOverride.subCategoryId',
    userId: 'userSubcategoryOverride.userId',
  },
}))

const { getCategories } = await import('@/lib/dal/categories')

describe('categories DAL merged tree', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.selectedShapes.length = 0
    mocks.fromArgs.length = 0
    mocks.leftJoinArgs.length = 0
    mocks.whereArgs.length = 0
    mocks.orderByArgs.length = 0
    mocks.queryResult = []
    mocks.verifySession.mockResolvedValue({ userId: 'user-1' })
  })

  it('returns system categories with compatibility fields and no override metadata', async () => {
    mocks.queryResult = [systemCategoryRow()]

    await expect(getCategories()).resolves.toEqual([
      {
        id: 1,
        name: 'Home',
        slug: 'home',
        type: 'out',
        userId: null,
        isOwned: false,
        subCategories: [
          {
            id: 10,
            name: 'Rent',
            slug: 'rent',
            originalName: 'Rent',
            userId: null,
            isOwned: false,
            hasOverride: false,
            customName: null,
          },
        ],
      },
    ])
  })

  it('merges system and user-owned category rows with ownership metadata', async () => {
    mocks.queryResult = [
      systemCategoryRow(),
      systemCategoryRow({
        categoryId: 2,
        categoryName: 'Side projects',
        categorySlug: 'side-projects',
        categoryType: 'in',
        categoryUserId: 'user-1',
        subCategoryId: 20,
        subCategoryName: 'Consulting',
        subCategorySlug: 'consulting',
        subCategoryUserId: 'user-1',
      }),
    ]

    const categories = await getCategories()

    expect(categories).toHaveLength(2)
    expect(categories[0]).toMatchObject({ id: 1, isOwned: false, userId: null })
    expect(categories[1]).toMatchObject({ id: 2, isOwned: true, userId: 'user-1' })
    expect(categories[1]?.subCategories).toEqual([
      {
        id: 20,
        name: 'Consulting',
        slug: 'consulting',
        originalName: 'Consulting',
        userId: 'user-1',
        isOwned: true,
        hasOverride: false,
        customName: null,
      },
    ])
  })

  it('uses a user override as the displayed subcategory name while preserving the original name', async () => {
    mocks.queryResult = [systemCategoryRow({ overrideCustomName: 'Monthly lease' })]

    const categories = await getCategories()

    expect(categories[0]?.subCategories[0]).toMatchObject({
      id: 10,
      name: 'Monthly lease',
      originalName: 'Rent',
      hasOverride: true,
      customName: 'Monthly lease',
    })
  })

  it('keeps an empty category when a left-joined subcategory is missing', async () => {
    mocks.queryResult = [
      systemCategoryRow({
        categoryId: 3,
        categoryName: 'Unassigned',
        categorySlug: 'unassigned',
        subCategoryId: null,
        subCategoryName: null,
        subCategorySlug: null,
        subCategoryUserId: null,
      }),
    ]

    await expect(getCategories()).resolves.toEqual([
      {
        id: 3,
        name: 'Unassigned',
        slug: 'unassigned',
        type: 'out',
        userId: null,
        isOwned: false,
        subCategories: [],
      },
    ])
  })

  it('scopes category, subcategory, and override reads to the verified user', async () => {
    await getCategories()

    expect(mocks.verifySession).toHaveBeenCalledTimes(1)
    expect(mocks.fromArgs[0]).toMatchObject({ id: 'category.id', userId: 'category.userId' })
    expect(mocks.leftJoinArgs).toHaveLength(2)
    expect(mocks.leftJoinArgs[0]).toEqual({
      table: expect.objectContaining({ id: 'subCategory.id', userId: 'subCategory.userId' }),
      condition: {
        op: 'and',
        args: [
          { op: 'eq', left: 'subCategory.categoryId', right: 'category.id' },
          { op: 'eq', left: 'subCategory.isActive', right: true },
          {
            op: 'or',
            args: [
              { op: 'isNull', column: 'subCategory.userId' },
              { op: 'eq', left: 'subCategory.userId', right: 'user-1' },
            ],
          },
        ],
      },
    })
    expect(mocks.leftJoinArgs[1]).toEqual({
      table: expect.objectContaining({ userId: 'userSubcategoryOverride.userId' }),
      condition: {
        op: 'and',
        args: [
          { op: 'eq', left: 'userSubcategoryOverride.subCategoryId', right: 'subCategory.id' },
          { op: 'eq', left: 'userSubcategoryOverride.userId', right: 'user-1' },
        ],
      },
    })
    expect(mocks.whereArgs[0]).toEqual({
      op: 'and',
      args: [
        { op: 'eq', left: 'category.isActive', right: true },
        {
          op: 'or',
          args: [
            { op: 'isNull', column: 'category.userId' },
            { op: 'eq', left: 'category.userId', right: 'user-1' },
          ],
        },
      ],
    })
    expect(mocks.orderByArgs[0]).toEqual([
      { op: 'asc', column: 'category.displayOrder' },
      { op: 'asc', column: 'category.id' },
      { op: 'asc', column: 'subCategory.displayOrder' },
      { op: 'asc', column: 'subCategory.id' },
    ])
    expectContainsPredicate(mocks.leftJoinArgs[0]?.condition, { op: 'eq', left: 'subCategory.userId', right: 'user-1' })
    expectContainsPredicate(mocks.leftJoinArgs[1]?.condition, { op: 'eq', left: 'userSubcategoryOverride.userId', right: 'user-1' })
    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'category.userId', right: 'user-1' })
  })
})
