import { beforeEach, describe, expect, it, vi } from 'vitest'

const EXPECTED_CATEGORY_REVALIDATION_ROUTES = [
  '/dashboard',
  '/expenses',
  '/import',
  '/patterns',
  '/settings/categories',
  '/transactions',
]

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  createUserCategory: vi.fn(),
  renameUserCategory: vi.fn(),
  deactivateUserCategory: vi.fn(),
  deleteUserCategory: vi.fn(),
  createUserSubcategory: vi.fn(),
  renameUserSubcategory: vi.fn(),
  deactivateUserSubcategory: vi.fn(),
  deleteUserSubcategory: vi.fn(),
  upsertSystemSubcategoryOverride: vi.fn(),
  upsertSubcategoryNatureOverride: vi.fn(),
  isSubCategoryVisibleToUser: vi.fn(),
  revalidatePath: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({
  refresh: mocks.refresh,
  revalidatePath: mocks.revalidatePath,
}))
vi.mock('@/lib/dal/auth', () => ({ verifySession: mocks.verifySession }))
vi.mock('@/lib/dal/categories', async () => {
  const actual = await vi.importActual<typeof import('../lib/dal/categories')>('../lib/dal/categories')
  return {
    CategoryMutationError: actual.CategoryMutationError,
    createUserCategory: mocks.createUserCategory,
    renameUserCategory: mocks.renameUserCategory,
    deactivateUserCategory: mocks.deactivateUserCategory,
    deleteUserCategory: mocks.deleteUserCategory,
    createUserSubcategory: mocks.createUserSubcategory,
    renameUserSubcategory: mocks.renameUserSubcategory,
    deactivateUserSubcategory: mocks.deactivateUserSubcategory,
    deleteUserSubcategory: mocks.deleteUserSubcategory,
    upsertSystemSubcategoryOverride: mocks.upsertSystemSubcategoryOverride,
    upsertSubcategoryNatureOverride: mocks.upsertSubcategoryNatureOverride,
    isSubCategoryVisibleToUser: mocks.isSubCategoryVisibleToUser,
  }
})

const {
  createCategoryAction,
  renameCategoryAction,
  deactivateCategoryAction,
  deleteCategoryAction,
  createSubcategoryAction,
  renameSubcategoryAction,
  deactivateSubcategoryAction,
  deleteSubcategoryAction,
  setSubcategoryNatureAction,
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
    mocks.deactivateUserCategory.mockResolvedValue(true)
    mocks.deleteUserCategory.mockResolvedValue(true)
    mocks.createUserSubcategory.mockResolvedValue({ id: 10 })
    mocks.upsertSubcategoryNatureOverride.mockResolvedValue({ id: 20 })
    mocks.renameUserSubcategory.mockResolvedValue({ id: 10 })
    mocks.deactivateUserSubcategory.mockResolvedValue(true)
    mocks.deleteUserSubcategory.mockResolvedValue(true)
    mocks.upsertSystemSubcategoryOverride.mockResolvedValue({ id: 20 })
  })

  it('creates a user-owned category with direction and no automatic subcategory', async () => {
    const result = await createCategoryAction(
      { error: null },
      makeFormData({ name: '  Entrate  Extra ', direction: 'in', userId: 'attacker' }),
    )

    expect(result).toEqual({ error: null })
    expect(mocks.createUserCategory).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'Entrate Extra',
      slug: 'entrate-extra',
      directionId: 1,
    })
    expect(mocks.createUserSubcategory).not.toHaveBeenCalled()
    expectExactCategoryRevalidationRoutes()
  })

  it('rejects category create without direction', async () => {
    const result = await createCategoryAction(
      { error: null },
      makeFormData({ name: 'Casa vacanze' }),
    )

    expect(result.error).not.toBeNull()
    expect(mocks.createUserCategory).not.toHaveBeenCalled()
    expect(mocks.createUserSubcategory).not.toHaveBeenCalled()
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
      makeFormData({ categoryId: '2', name: ' Affitto ', nature: 'essential' }),
    )

    expect(result).toEqual({ error: null })
    // Form posts nature code; action resolves via NATURE_ID_BY_CODE (essential → 3)
    expect(mocks.createUserSubcategory).toHaveBeenCalledWith({
      userId: 'user-1',
      categoryId: 2,
      name: 'Affitto',
      slug: 'affitto',
      natureId: 3,
    })
    expectExactCategoryRevalidationRoutes()
  })

  it('resolves income nature so new subcategories can sit under Entrate', async () => {
    const result = await createSubcategoryAction(
      { error: null },
      makeFormData({ categoryId: '2', name: 'Stipendio extra', nature: 'income' }),
    )

    expect(result).toEqual({ error: null })
    expect(mocks.createUserSubcategory).toHaveBeenCalledWith(
      expect.objectContaining({ natureId: 1, slug: 'stipendio-extra' }),
    )
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

    await expect(
      createCategoryAction({ error: null }, makeFormData({ name: 'Casa', direction: 'out' })),
    ).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.createUserCategory).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it('returns validation errors without writing for malformed names and ids', async () => {
    await expect(
      createCategoryAction({ error: null }, makeFormData({ name: '   ', direction: 'out' })),
    ).resolves.toEqual({ error: 'Inserisci un nome.' })
    await expect(
      renameSubcategoryAction({ error: null }, makeFormData({ id: '0', name: 'Casa' })),
    ).resolves.toEqual({ error: 'ID non valido.' })
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
      makeFormData({ name: 'Casa', direction: 'out' }),
    )

    expect(result.error).toBe('Esiste già una categoria o sottocategoria con questo nome.')
    expect(result.error).not.toContain('unique')
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it('does not mislabel primary-key sequence collisions as duplicate names (bug 3.7)', async () => {
    // DAL should heal category_pkey / stale serial and succeed; if a raw pkey error
    // ever escapes, the action must not map it to the slug-duplicate Italian copy.
    mocks.createUserCategory.mockRejectedValueOnce(
      Object.assign(new Error('duplicate key value violates unique constraint "category_pkey"'), {
        code: '23505',
        constraint: 'category_pkey',
      }),
    )

    const result = await createCategoryAction(
      { error: null },
      makeFormData({ name: 'Casa vacanze', direction: 'out' }),
    )

    expect(result.error).toBe('Si è verificato un errore. Riprova tra qualche secondo.')
    expect(result.error).not.toBe('Esiste già una categoria o sottocategoria con questo nome.')
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

    expect(result.error).toBe(
      'Non puoi eliminare: ci sono 3 spese collegate a questa categoria o sottocategoria.',
    )
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it('blocks linked-expense category deletion with the shared Italian message', async () => {
    mocks.deleteUserCategory.mockRejectedValueOnce(
      new CategoryMutationError('linked_expenses', 'linked expenses', 1),
    )

    const result = await deleteCategoryAction({ error: null }, makeFormData({ id: '9' }))

    expect(result.error).toBe(
      "Non puoi eliminare: c'è 1 spesa collegata a questa categoria o sottocategoria.",
    )
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it('deactivates a category without a linked-expense guard', async () => {
    const result = await deactivateCategoryAction({ error: null }, makeFormData({ id: '9' }))

    expect(result).toEqual({ error: null })
    expect(mocks.deactivateUserCategory).toHaveBeenCalledWith(9, 'user-1')
    expectExactCategoryRevalidationRoutes()
  })

  it('deactivates a subcategory without a linked-expense guard', async () => {
    const result = await deactivateSubcategoryAction({ error: null }, makeFormData({ id: '10' }))

    expect(result).toEqual({ error: null })
    expect(mocks.deactivateUserSubcategory).toHaveBeenCalledWith(10, 'user-1')
    expectExactCategoryRevalidationRoutes()
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

describe('setSubcategoryNatureAction (R-FN-07)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue({ userId: 'user-1', subscriptionPlan: 'basic' })
    mocks.upsertSubcategoryNatureOverride.mockResolvedValue({ id: 20 })
    mocks.isSubCategoryVisibleToUser.mockResolvedValue(true)
  })

  it('returns ok:true and resolves nature code to natureId via NATURE_ID_BY_CODE', async () => {
    const result = await setSubcategoryNatureAction({ subCategoryId: 10, nature: 'debt' })
    expect(result).toEqual({ ok: true })
    // 'debt' maps to NATURE_ID_BY_CODE['debt'] = 5
    expect(mocks.upsertSubcategoryNatureOverride).toHaveBeenCalledWith({
      userId: 'user-1',
      subCategoryId: 10,
      natureId: 5,
    })
  })

  it('accepts null nature to reset override (natureId: null)', async () => {
    const result = await setSubcategoryNatureAction({ subCategoryId: 10, nature: null })
    expect(result).toEqual({ ok: true })
    expect(mocks.upsertSubcategoryNatureOverride).toHaveBeenCalledWith({
      userId: 'user-1',
      subCategoryId: 10,
      natureId: null,
    })
  })

  it('returns ok:false for an invalid nature string', async () => {
    const result = await setSubcategoryNatureAction({ subCategoryId: 10, nature: 'invalid' as never })
    expect(result).toMatchObject({ ok: false })
    expect(mocks.upsertSubcategoryNatureOverride).not.toHaveBeenCalled()
  })

  it('rejects override for subcategory not visible to the session user (IDOR guard)', async () => {
    mocks.isSubCategoryVisibleToUser.mockResolvedValueOnce(false)
    const result = await setSubcategoryNatureAction({ subCategoryId: 999, nature: 'essential' })
    expect(result).toMatchObject({ ok: false })
    expect(mocks.upsertSubcategoryNatureOverride).not.toHaveBeenCalled()
  })

  it('prevents mutation when auth lookup fails', async () => {
    mocks.verifySession.mockRejectedValueOnce(new Error('NEXT_REDIRECT'))
    await expect(setSubcategoryNatureAction({ subCategoryId: 10, nature: 'essential' })).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.upsertSubcategoryNatureOverride).not.toHaveBeenCalled()
  })
})

describe('createSubcategoryAction nature requirement (R-FN-09 action layer)', () => {
  it('setSubcategoryNatureAction exists as an export (R-FN-07) — RED until Plan 37-05 ships', async () => {
    try {
      const actions = await import('../lib/actions/categories')
      const action = (actions as Record<string, unknown>)['setSubcategoryNatureAction']
      expect(action).toBeDefined()
    } catch {
      // Plan 37-05 has not landed yet — this is the expected RED state
      expect(true).toBe(false)
    }
  })

  it('createSubcategoryAction requires nature code from the form', async () => {
    const fd = new FormData()
    fd.append('name', 'Test Sub')
    fd.append('categoryId', '1')
    // omit nature — UI always posts it; missing value must not silently create unclassified rows

    const { createSubcategoryAction } = await import('../lib/actions/categories')
    const result = await createSubcategoryAction({ error: null }, fd)
    expect(result.error).not.toBeNull()
    expect(mocks.createUserSubcategory).not.toHaveBeenCalled()
  })
})
