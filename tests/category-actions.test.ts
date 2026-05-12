import { beforeEach, describe, expect, it, vi } from 'vitest'

const EXPECTED_CATEGORY_REVALIDATION_ROUTES = [
  '/dashboard',
  '/expenses',
  '/settings/categories',
  '/settings/patterns',
  '/transactions',
]

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  createUserCategory: vi.fn(),
  renameUserCategory: vi.fn(),
  deleteUserCategory: vi.fn(),
  createUserSubcategory: vi.fn(),
  renameUserSubcategory: vi.fn(),
  deleteUserSubcategory: vi.fn(),
  upsertSystemSubcategoryOverride: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/dal/auth', () => ({ verifySession: mocks.verifySession }))
vi.mock('@/lib/dal/categories', async () => {
  const actual = await vi.importActual<typeof import('../lib/dal/categories')>('../lib/dal/categories')
  return {
    CategoryMutationError: actual.CategoryMutationError,
    createUserCategory: mocks.createUserCategory,
    renameUserCategory: mocks.renameUserCategory,
    deleteUserCategory: mocks.deleteUserCategory,
    createUserSubcategory: mocks.createUserSubcategory,
    renameUserSubcategory: mocks.renameUserSubcategory,
    deleteUserSubcategory: mocks.deleteUserSubcategory,
    upsertSystemSubcategoryOverride: mocks.upsertSystemSubcategoryOverride,
  }
})

const {
  createCategoryAction,
  renameCategoryAction,
  deleteCategoryAction,
  createSubcategoryAction,
  renameSubcategoryAction,
  deleteSubcategoryAction,
} = await import('../lib/actions/categories')
const { CategoryMutationError } = await import('../lib/dal/categories')

function makeFormData(fields: Record<string, string | null>) {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    if (value !== null) fd.append(key, value)
  }
  return fd
}

function expectExactCategoryRevalidationRoutes() {
  const uniqueSortedPaths = [...new Set(mocks.revalidatePath.mock.calls.map(([path]) => path))].sort()
  expect(uniqueSortedPaths).toEqual([...EXPECTED_CATEGORY_REVALIDATION_ROUTES].sort())
}

describe('category Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue({ userId: 'user-1', subscriptionPlan: 'basic' })
    mocks.createUserCategory.mockResolvedValue({ id: 1 })
    mocks.renameUserCategory.mockResolvedValue({ id: 1 })
    mocks.deleteUserCategory.mockResolvedValue(true)
    mocks.createUserSubcategory.mockResolvedValue({ id: 10 })
    mocks.renameUserSubcategory.mockResolvedValue({ id: 10 })
    mocks.deleteUserSubcategory.mockResolvedValue(true)
    mocks.upsertSystemSubcategoryOverride.mockResolvedValue({ id: 20 })
  })

  it('creates a user-owned category using the session user and normalized slug', async () => {
    const result = await createCategoryAction(
      { error: null },
      makeFormData({ name: '  Entrate  Extra ', type: 'in', userId: 'attacker' }),
    )

    expect(result).toEqual({ error: null })
    expect(mocks.createUserCategory).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'Entrate Extra',
      slug: 'entrate-extra',
      type: 'in',
    })
    expectExactCategoryRevalidationRoutes()
  })

  it('renames a user-owned category and ignores attacker userId fields', async () => {
    const result = await renameCategoryAction(
      { error: null },
      makeFormData({ id: '7', name: ' Casa ', userId: 'attacker' }),
    )

    expect(result).toEqual({ error: null })
    expect(mocks.renameUserCategory).toHaveBeenCalledWith(7, 'user-1', {
      name: 'Casa',
      slug: 'casa',
    })
    expectExactCategoryRevalidationRoutes()
  })

  it('creates a user-owned subcategory under a visible category', async () => {
    const result = await createSubcategoryAction(
      { error: null },
      makeFormData({ categoryId: '2', name: ' Affitto ' }),
    )

    expect(result).toEqual({ error: null })
    expect(mocks.createUserSubcategory).toHaveBeenCalledWith({
      userId: 'user-1',
      categoryId: 2,
      name: 'Affitto',
      slug: 'affitto',
    })
    expectExactCategoryRevalidationRoutes()
  })

  it('renames a user-owned subcategory without creating an override', async () => {
    const result = await renameSubcategoryAction(
      { error: null },
      makeFormData({ id: '10', name: ' Nuovo nome ' }),
    )

    expect(result).toEqual({ error: null })
    expect(mocks.renameUserSubcategory).toHaveBeenCalledWith(10, 'user-1', {
      name: 'Nuovo nome',
      slug: 'nuovo-nome',
    })
    expect(mocks.upsertSystemSubcategoryOverride).not.toHaveBeenCalled()
    expectExactCategoryRevalidationRoutes()
  })

  it('renames a system subcategory through a per-user override when it is not user-owned', async () => {
    mocks.renameUserSubcategory.mockResolvedValueOnce(null)

    const result = await renameSubcategoryAction(
      { error: null },
      makeFormData({ id: '10', name: ' Affitto casa ' }),
    )

    expect(result).toEqual({ error: null })
    expect(mocks.upsertSystemSubcategoryOverride).toHaveBeenCalledWith('user-1', 10, 'Affitto casa')
    expectExactCategoryRevalidationRoutes()
  })

  it('deletes user-owned rows using the session user only', async () => {
    await expect(
      deleteCategoryAction({ error: null }, makeFormData({ id: '9', userId: 'attacker' })),
    ).resolves.toEqual({ error: null })
    await expect(
      deleteSubcategoryAction({ error: null }, makeFormData({ id: '10', userId: 'attacker' })),
    ).resolves.toEqual({ error: null })

    expect(mocks.deleteUserCategory).toHaveBeenCalledWith(9, 'user-1')
    expect(mocks.deleteUserSubcategory).toHaveBeenCalledWith(10, 'user-1')
    expectExactCategoryRevalidationRoutes()
  })

  it('prevents mutation when auth lookup fails', async () => {
    mocks.verifySession.mockRejectedValueOnce(new Error('NEXT_REDIRECT'))

    await expect(createCategoryAction({ error: null }, makeFormData({ name: 'Casa', type: 'out' }))).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.createUserCategory).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it('returns validation errors without writing for malformed names and ids', async () => {
    await expect(
      createCategoryAction({ error: null }, makeFormData({ name: '   ', type: 'out' })),
    ).resolves.toEqual({ error: 'Inserisci un nome.' })
    await expect(
      renameSubcategoryAction({ error: null }, makeFormData({ id: '0', name: 'Casa' })),
    ).resolves.toEqual({ error: 'ID non valido.' })
    await expect(
      createCategoryAction({ error: null }, makeFormData({ name: 'Casa', type: 'system' })),
    ).resolves.toEqual({ error: 'Tipo categoria non valido.' })

    expect(mocks.createUserCategory).not.toHaveBeenCalled()
    expect(mocks.renameUserSubcategory).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it('maps duplicate and known DAL failures to safe Italian errors without revalidation', async () => {
    mocks.createUserCategory.mockRejectedValueOnce(
      new CategoryMutationError('duplicate', 'duplicate key value violates unique constraint category_user_slug_unique'),
    )

    const result = await createCategoryAction(
      { error: null },
      makeFormData({ name: 'Casa', type: 'out' }),
    )

    expect(result.error).toBe('Esiste già una categoria o sottocategoria con questo nome.')
    expect(result.error).not.toContain('unique')
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it('rejects system deletion and does not revalidate', async () => {
    mocks.deleteUserSubcategory.mockResolvedValueOnce(false)

    const result = await deleteSubcategoryAction({ error: null }, makeFormData({ id: '10' }))

    expect(result.error).toBe('Non puoi eliminare una categoria o sottocategoria di sistema.')
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it('blocks linked-expense deletion with a count-bearing message and no revalidation', async () => {
    mocks.deleteUserSubcategory.mockRejectedValueOnce(
      new CategoryMutationError('linked_expenses', 'linked expenses', 3),
    )

    const result = await deleteSubcategoryAction({ error: null }, makeFormData({ id: '10' }))

    expect(result.error).toBe('Non puoi eliminare questa sottocategoria: è collegata a 3 spese.')
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it('collapses unexpected DAL errors without leaking details or revalidating', async () => {
    mocks.renameUserCategory.mockRejectedValueOnce(new Error('raw SQL password timeout'))

    const result = await renameCategoryAction(
      { error: null },
      makeFormData({ id: '7', name: 'Casa' }),
    )

    expect(result.error).toBe('Si è verificato un errore. Riprova tra qualche secondo.')
    expect(result.error).not.toContain('SQL')
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })
})
