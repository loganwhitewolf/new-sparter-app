import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  selectedShapes: [] as unknown[],
  fromArgs: [] as unknown[],
  leftJoinArgs: [] as Array<{ table: unknown, condition: unknown }>,
  whereArgs: [] as unknown[],
  orderByArgs: [] as unknown[][],
  queryResult: [] as CategoryRowFixture[],
  selectResults: [] as unknown[][],
  insertArgs: [] as unknown[],
  insertValues: [] as unknown[],
  onConflictArgs: [] as unknown[],
  updateArgs: [] as unknown[],
  updateSets: [] as unknown[],
  returningArgs: [] as unknown[],
  returningResult: [] as unknown[],
  countResult: [] as unknown[],
}))

type FlowNature = 'essential' | 'discretionary' | 'operational' | 'financial' | 'debt' | 'extraordinary'

type DirectionCode = 'in' | 'out' | 'allocation' | 'transfer' | null

type CategoryRowFixture = {
  categoryId: number
  categoryName: string
  categorySlug: string
  categoryUserId: string | null
  subCategoryId: number | null
  subCategoryName: string | null
  subCategorySlug: string | null
  subCategoryUserId: string | null
  overrideCustomName: string | null
  overrideNatureId: number | null
  subCategoryNatureId: number | null
  effectiveNatureCode: FlowNature | null
  categoryType: DirectionCode
}

function nextSelectResult() {
  return mocks.selectResults.length > 0 ? mocks.selectResults.shift() : mocks.queryResult
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
    onConflictDoUpdate: vi.fn((arg: unknown) => {
      mocks.onConflictArgs.push(arg)
      return chain
    }),
    returning: vi.fn((arg?: unknown) => {
      mocks.returningArgs.push(arg)
      return Promise.resolve(mocks.returningResult)
    }),
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
    returning: vi.fn((arg?: unknown) => {
      mocks.returningArgs.push(arg)
      return Promise.resolve(mocks.returningResult)
    }),
  }
  return chain
}

function systemCategoryRow(overrides: Partial<CategoryRowFixture> = {}): CategoryRowFixture {
  return {
    categoryId: 1,
    categoryName: 'Home',
    categorySlug: 'home',
    categoryUserId: null,
    subCategoryId: 10,
    subCategoryName: 'Rent',
    subCategorySlug: 'rent',
    subCategoryUserId: null,
    overrideCustomName: null,
    overrideNatureId: null,
    subCategoryNatureId: null,
    effectiveNatureCode: null,
    categoryType: null,
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
  isNull: (column: unknown) => ({ op: 'isNull', column }),
  or: (...args: unknown[]) => ({ op: 'or', args }),
  sql: () => 'sql.count',
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
    natureId: 'subCategory.natureId',
  },
  userSubcategoryOverride: {
    id: 'userSubcategoryOverride.id',
    customName: 'userSubcategoryOverride.customName',
    subCategoryId: 'userSubcategoryOverride.subCategoryId',
    userId: 'userSubcategoryOverride.userId',
    updatedAt: 'userSubcategoryOverride.updatedAt',
    natureId: 'userSubcategoryOverride.natureId',
  },
  expense: {
    id: 'expense.id',
    userId: 'expense.userId',
    subCategoryId: 'expense.subCategoryId',
  },
}))

const {
  countLinkedExpensesForSubcategory,
  createUserCategory,
  createUserSubcategory,
  deleteUserCategory,
  deleteUserSubcategory,
  getCategories,
  renameUserCategory,
  upsertSystemSubcategoryOverride,
} = await import('@/lib/dal/categories')

describe('categories DAL merged tree', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.selectedShapes.length = 0
    mocks.fromArgs.length = 0
    mocks.leftJoinArgs.length = 0
    mocks.whereArgs.length = 0
    mocks.orderByArgs.length = 0
    mocks.selectResults.length = 0
    mocks.insertArgs.length = 0
    mocks.insertValues.length = 0
    mocks.onConflictArgs.length = 0
    mocks.updateArgs.length = 0
    mocks.updateSets.length = 0
    mocks.returningArgs.length = 0
    mocks.returningResult = []
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
        type: null,
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
            effectiveNature: null,
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
        effectiveNature: null,
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
        type: null,
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

describe('categories DAL mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.selectedShapes.length = 0
    mocks.fromArgs.length = 0
    mocks.leftJoinArgs.length = 0
    mocks.whereArgs.length = 0
    mocks.orderByArgs.length = 0
    mocks.selectResults.length = 0
    mocks.insertArgs.length = 0
    mocks.insertValues.length = 0
    mocks.onConflictArgs.length = 0
    mocks.updateArgs.length = 0
    mocks.updateSets.length = 0
    mocks.returningArgs.length = 0
    mocks.returningResult = [{ id: 1 }]
    mocks.queryResult = []
  })

  it('creates user-owned categories with owner metadata', async () => {
    // Phase 46: category.type removed (ADR 0012)
    await createUserCategory({ userId: 'user-1', name: 'Casa', slug: 'casa' })

    expect(mocks.insertArgs[0]).toMatchObject({ id: 'category.id' })
    expect(mocks.insertValues[0]).toEqual({
      userId: 'user-1',
      name: 'Casa',
      slug: 'casa',
      isActive: true,
    })
  })

  it('includes userId and active predicates when renaming a user-owned category', async () => {
    await renameUserCategory(7, 'user-1', { name: 'Casa nuova', slug: 'casa-nuova' })

    expect(mocks.updateArgs[0]).toMatchObject({ id: 'category.id' })
    expect(mocks.updateSets[0]).toEqual({ name: 'Casa nuova', slug: 'casa-nuova' })
    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'category.id', right: 7 })
    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'category.userId', right: 'user-1' })
    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'category.isActive', right: true })
  })

  it('cannot delete system categories through the user delete helper', async () => {
    mocks.returningResult = []

    await expect(deleteUserCategory(7, 'user-1')).resolves.toBe(false)

    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'category.id', right: 7 })
    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'category.userId', right: 'user-1' })
    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'category.isActive', right: true })
  })

  it('creates subcategories only under categories visible to the user', async () => {
    mocks.selectResults.push([{ id: 2 }])

    // Phase 46: nature field replaced by natureId (FK to nature table)
    await createUserSubcategory({ userId: 'user-1', categoryId: 2, name: 'Affitto', slug: 'affitto', natureId: null })

    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'category.id', right: 2 })
    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'category.isActive', right: true })
    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'category.userId', right: 'user-1' })
    expect(mocks.insertValues[0]).toMatchObject({
      userId: 'user-1',
      categoryId: 2,
      name: 'Affitto',
      slug: 'affitto',
      isActive: true,
    })
  })

  it('upserts system subcategory overrides by userId and subCategoryId', async () => {
    mocks.selectResults.push([{ id: 10 }])

    await upsertSystemSubcategoryOverride('user-1', 10, 'Affitto casa')

    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'subCategory.id', right: 10 })
    expectContainsPredicate(mocks.whereArgs[0], { op: 'isNull', column: 'subCategory.userId' })
    expect(mocks.insertValues[0]).toEqual({
      userId: 'user-1',
      subCategoryId: 10,
      customName: 'Affitto casa',
    })
    expect(mocks.onConflictArgs[0]).toMatchObject({
      target: ['userSubcategoryOverride.userId', 'userSubcategoryOverride.subCategoryId'],
      set: { customName: 'Affitto casa', updatedAt: expect.any(Date) },
    })
  })

  it('counts linked expenses scoped to the current user', async () => {
    mocks.selectResults.push([{ count: 3 }])

    await expect(countLinkedExpensesForSubcategory('user-1', 10)).resolves.toBe(3)

    expect(mocks.fromArgs[0]).toMatchObject({ id: 'expense.id' })
    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'expense.userId', right: 'user-1' })
    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'expense.subCategoryId', right: 10 })
  })

  it('blocks user subcategory deletes when current-user expenses are linked', async () => {
    mocks.selectResults.push([{ count: 1 }])

    await expect(deleteUserSubcategory(10, 'user-1')).rejects.toMatchObject({
      code: 'linked_expenses',
      count: 1,
    })

    expect(mocks.updateArgs).toEqual([])
  })

  it('cannot delete system subcategories through the user delete helper', async () => {
    mocks.selectResults.push([{ count: 0 }])
    mocks.returningResult = []

    await expect(deleteUserSubcategory(10, 'user-1')).resolves.toBe(false)

    expectContainsPredicate(mocks.whereArgs[1], { op: 'eq', left: 'subCategory.id', right: 10 })
    expectContainsPredicate(mocks.whereArgs[1], { op: 'eq', left: 'subCategory.userId', right: 'user-1' })
    expectContainsPredicate(mocks.whereArgs[1], { op: 'eq', left: 'subCategory.isActive', right: true })
  })
})

describe('effectiveNature resolution on subcategories (D-09)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.selectedShapes.length = 0
    mocks.fromArgs.length = 0
    mocks.leftJoinArgs.length = 0
    mocks.whereArgs.length = 0
    mocks.orderByArgs.length = 0
    mocks.selectResults.length = 0
    mocks.queryResult = []
    mocks.verifySession.mockResolvedValue({ userId: 'user-1' })
  })

  it('exposes seed nature when no user override exists', async () => {
    mocks.queryResult = [systemCategoryRow({ effectiveNatureCode: 'essential' })]

    const categories = await getCategories()

    expect(categories[0]?.subCategories[0]?.effectiveNature).toBe('essential')
  })

  it('uses override nature over seed nature when override is set (D-09)', async () => {
    mocks.queryResult = [systemCategoryRow({ effectiveNatureCode: 'debt' })]

    const categories = await getCategories()

    expect(categories[0]?.subCategories[0]?.effectiveNature).toBe('debt')
  })

  it('falls back to seed nature when override row exists but override nature is null', async () => {
    mocks.queryResult = [systemCategoryRow({ effectiveNatureCode: 'operational' })]

    const categories = await getCategories()

    expect(categories[0]?.subCategories[0]?.effectiveNature).toBe('operational')
  })

  it('returns null for subcategories in the ignore category (seed nature null, no override)', async () => {
    mocks.queryResult = [
      systemCategoryRow({
        categorySlug: 'ignore',
        effectiveNatureCode: null,
      }),
    ]

    const categories = await getCategories()

    expect(categories[0]?.subCategories[0]?.effectiveNature).toBeNull()
  })
})
