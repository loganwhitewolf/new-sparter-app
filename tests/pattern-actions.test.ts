import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
  createPattern: vi.fn(),
  updatePattern: vi.fn(),
  deletePattern: vi.fn(),
  getCategoryTypeForSubCategory: vi.fn(),
  revalidatePath: vi.fn(),
  refresh: vi.fn(),
  applyNewPatternToExpenses: vi.fn(),
  applyNewPatternToPlatformExpenses: vi.fn(),
  getPlatformIdForUserFile: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({
  refresh: mocks.refresh,
  revalidatePath: mocks.revalidatePath,
}))

vi.mock('@/lib/dal/auth', () => ({
  verifySession: mocks.verifySession,
}))

vi.mock('@/lib/dal/patterns', () => ({
  createPattern: mocks.createPattern,
  updatePattern: mocks.updatePattern,
  deletePattern: mocks.deletePattern,
  getCategoryTypeForSubCategory: mocks.getCategoryTypeForSubCategory,
}))

vi.mock('@/lib/services/pattern-application', () => ({
  applyNewPatternToExpenses: mocks.applyNewPatternToExpenses,
  applyNewPatternToPlatformExpenses: mocks.applyNewPatternToPlatformExpenses,
}))

vi.mock('@/lib/dal/files', () => ({
  getPlatformIdForUserFile: mocks.getPlatformIdForUserFile,
}))

vi.mock('@/lib/validations/pattern', async () => {
  const actual = await vi.importActual<typeof import('../lib/validations/pattern')>(
    '../lib/validations/pattern',
  )
  return actual
})

const { createPatternAction, updatePatternAction, deletePatternAction, promoteSuggestionAction } = await import('../lib/actions/patterns')

const paidSession = {
  userId: 'user-abc',
  email: 'user@example.test',
  subscriptionPlan: 'basic' as const,
  role: 'user' as const,
}

const freeSession = {
  ...paidSession,
  subscriptionPlan: 'free' as const,
}

afterEach(() => {
  delete process.env.CATEGORIZATION_CUSTOM_PATTERNS_MIN_PLAN
})

function makeFormData(fields: Record<string, string | null>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    if (value !== null) fd.append(key, value)
  }
  return fd
}

function validCreateForm(overrides: Record<string, string | null> = {}) {
  return makeFormData({
    pattern: '/netflix/i',
    subCategoryId: '42',
    amountSign: 'negative',
    confidence: '0.95',
    description: 'Streaming subscriptions',
    ...overrides,
  })
}

function validPromoteForm(overrides: Record<string, string | null> = {}) {
  return makeFormData({
    pattern: 'netflix',          // pre-normalized suggestion.pattern (no /…/i delimiters)
    subCategoryId: '42',
    amountSign: 'negative',
    fileId: 'file-abc',
    ...overrides,
    // NOTE: `confidence` intentionally NOT included — server hardcodes 0.85 per D-01
  })
}

function validUpdateForm(overrides: Record<string, string | null> = {}) {
  return makeFormData({
    id: '7',
    pattern: '/netflix/i',
    subCategoryId: '42',
    amountSign: 'negative',
    confidence: '0.95',
    description: 'Streaming subscriptions',
    ...overrides,
  })
}

function expectExactCategoryRevalidationRoutes() {
  const uniqueSortedPaths = [
    ...new Set(mocks.revalidatePath.mock.calls.map(([path]) => path)),
  ].sort()

  expect(uniqueSortedPaths).toEqual([...EXPECTED_CATEGORY_REVALIDATION_ROUTES].sort())
  expect(mocks.refresh).toHaveBeenCalledOnce()
}

describe('pattern Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue(paidSession)
    mocks.createPattern.mockResolvedValue({ id: 7, pattern: 'netflix', subCategoryId: 42, confidence: '0.85' })
    mocks.updatePattern.mockResolvedValue({ id: 7 })
    mocks.deletePattern.mockResolvedValue({ id: 7 })
    mocks.getCategoryTypeForSubCategory.mockResolvedValue('out')
    mocks.applyNewPatternToExpenses.mockResolvedValue(0)
    mocks.applyNewPatternToPlatformExpenses.mockResolvedValue({ updatedCount: 3, notUpdatedCount: 12 })
    mocks.getPlatformIdForUserFile.mockResolvedValue(1)
  })

  describe('createPatternAction', () => {
    it('passes canonical schema output and session userId to the DAL', async () => {
      const result = await createPatternAction({ error: null }, validCreateForm({ userId: 'attacker-id' }))

      expect(result).toEqual({ error: null })
      expect(mocks.createPattern).toHaveBeenCalledWith({
        userId: 'user-abc',
        pattern: 'netflix',
        subCategoryId: 42,
        confidence: 0.95,
        description: 'Streaming subscriptions',
      })
      expectExactCategoryRevalidationRoutes()
    })

    it('denies free users before validation or mutation when configured for Basic+', async () => {
      process.env.CATEGORIZATION_CUSTOM_PATTERNS_MIN_PLAN = 'basic'
      mocks.verifySession.mockResolvedValueOnce(freeSession)

      const result = await createPatternAction({ error: null }, validCreateForm())

      expect(result.error).toMatch(/Basic o Pro/)
      expect(mocks.createPattern).not.toHaveBeenCalled()
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })

    it('prevents mutation when auth lookup fails', async () => {
      mocks.verifySession.mockRejectedValueOnce(new Error('NEXT_REDIRECT'))

      await expect(createPatternAction({ error: null }, validCreateForm())).rejects.toThrow('NEXT_REDIRECT')
      expect(mocks.createPattern).not.toHaveBeenCalled()
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })

    it('returns validation errors without writing when subcategory is missing', async () => {
      const result = await createPatternAction({ error: null }, validCreateForm({ subCategoryId: null }))

      expect(result.error).toMatch(/sottocategoria/i)
      expect(mocks.createPattern).not.toHaveBeenCalled()
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })

    it('returns validation errors without writing when confidence is outside range', async () => {
      const result = await createPatternAction({ error: null }, validCreateForm({ confidence: '1.2' }))

      expect(result.error).toBeTruthy()
      expect(mocks.createPattern).not.toHaveBeenCalled()
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })

    it('returns unsupported flag validation errors without writing for /netflix/g', async () => {
      const result = await createPatternAction({ error: null }, validCreateForm({ pattern: '/netflix/g' }))

      expect(result.error).toMatch(/Flag regex non supportati/)
      expect(mocks.createPattern).not.toHaveBeenCalled()
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })

    it('returns malformed regex validation errors without writing', async () => {
      const result = await createPatternAction({ error: null }, validCreateForm({ pattern: '([' }))

      expect(result.error).toBe('Pattern regex non valido.')
      expect(mocks.createPattern).not.toHaveBeenCalled()
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })

    it('returns a generic error without leaking DAL failures', async () => {
      mocks.createPattern.mockRejectedValueOnce(new Error('FATAL: password authentication failed for db_admin'))

      const result = await createPatternAction({ error: null }, validCreateForm())

      expect(result.error).toBe('Si è verificato un errore. Riprova tra qualche secondo.')
      expect(result.error).not.toContain('FATAL')
      expect(result.error).not.toContain('db_admin')
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })
  })

  describe('updatePatternAction', () => {
    it('passes canonical schema output, id, and session userId to the DAL (no confidence — client-controlled confidence removed, WR-04)', async () => {
      const result = await updatePatternAction({ error: null }, validUpdateForm({ userId: 'attacker-id' }))

      expect(result).toEqual({ error: null })
      // confidence is no longer accepted from the client (UpdatePatternClientSchema omits it)
      expect(mocks.updatePattern).toHaveBeenCalledWith(7, 'user-abc', {
        pattern: 'netflix',
        subCategoryId: 42,
        description: 'Streaming subscriptions',
      })
      expectExactCategoryRevalidationRoutes()
    })

    it('denies free users before mutation when configured for Basic+', async () => {
      process.env.CATEGORIZATION_CUSTOM_PATTERNS_MIN_PLAN = 'basic'
      mocks.verifySession.mockResolvedValueOnce(freeSession)

      const result = await updatePatternAction({ error: null }, validUpdateForm())

      expect(result.error).toMatch(/Basic o Pro/)
      expect(mocks.updatePattern).not.toHaveBeenCalled()
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })

    it('prevents mutation when auth lookup fails', async () => {
      mocks.verifySession.mockRejectedValueOnce(new Error('NEXT_REDIRECT'))

      await expect(updatePatternAction({ error: null }, validUpdateForm())).rejects.toThrow('NEXT_REDIRECT')
      expect(mocks.updatePattern).not.toHaveBeenCalled()
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })

    it('ignores client-supplied confidence — does not pass it to the DAL (WR-04)', async () => {
      // UpdatePatternClientSchema omits confidence; any client value is silently dropped.
      // The action should succeed and call updatePattern without a confidence field.
      const result = await updatePatternAction({ error: null }, validUpdateForm({ confidence: '-0.1' }))

      expect(result).toEqual({ error: null })
      const callArgs = mocks.updatePattern.mock.calls[0][2]
      expect(callArgs).not.toHaveProperty('confidence')
    })

    it('returns validation errors without writing for unsupported flags', async () => {
      const result = await updatePatternAction({ error: null }, validUpdateForm({ pattern: '/netflix/g' }))

      expect(result.error).toMatch(/Flag regex non supportati/)
      expect(mocks.updatePattern).not.toHaveBeenCalled()
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })

    it('returns validation errors without writing for malformed regex', async () => {
      const result = await updatePatternAction({ error: null }, validUpdateForm({ pattern: '([' }))

      expect(result.error).toBe('Pattern regex non valido.')
      expect(mocks.updatePattern).not.toHaveBeenCalled()
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })

    it('returns a safe not-found error and does not revalidate when DAL returns null', async () => {
      mocks.updatePattern.mockResolvedValueOnce(null)

      const result = await updatePatternAction({ error: null }, validUpdateForm())

      expect(result.error).toBe('Pattern non trovato o accesso negato.')
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })

    it('returns a generic error without leaking DAL failures', async () => {
      mocks.updatePattern.mockRejectedValueOnce(new Error('SQL timeout on categorization_pattern'))

      const result = await updatePatternAction({ error: null }, validUpdateForm())

      expect(result.error).toBe('Si è verificato un errore. Riprova tra qualche secondo.')
      expect(result.error).not.toContain('SQL')
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })
  })

  describe('deletePatternAction', () => {
    it('deletes using the session userId and revalidates categorization surfaces on success', async () => {
      const result = await deletePatternAction({ error: null }, makeFormData({ id: '7', userId: 'attacker-id' }))

      expect(result).toEqual({ error: null })
      expect(mocks.deletePattern).toHaveBeenCalledWith(7, 'user-abc')
      expectExactCategoryRevalidationRoutes()
    })

    it('denies free users before mutation when configured for Basic+', async () => {
      process.env.CATEGORIZATION_CUSTOM_PATTERNS_MIN_PLAN = 'basic'
      mocks.verifySession.mockResolvedValueOnce(freeSession)

      const result = await deletePatternAction({ error: null }, makeFormData({ id: '7' }))

      expect(result.error).toMatch(/Basic o Pro/)
      expect(mocks.deletePattern).not.toHaveBeenCalled()
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })

    it('prevents mutation when auth lookup fails', async () => {
      mocks.verifySession.mockRejectedValueOnce(new Error('NEXT_REDIRECT'))

      await expect(deletePatternAction({ error: null }, makeFormData({ id: '7' }))).rejects.toThrow('NEXT_REDIRECT')
      expect(mocks.deletePattern).not.toHaveBeenCalled()
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })

    it('returns a validation error without mutation when id is missing', async () => {
      const result = await deletePatternAction({ error: null }, makeFormData({ id: null }))

      expect(result.error).toBe('ID pattern mancante.')
      expect(mocks.deletePattern).not.toHaveBeenCalled()
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })

    it('returns a safe not-found error and does not revalidate when DAL returns null', async () => {
      mocks.deletePattern.mockResolvedValueOnce(null)

      const result = await deletePatternAction({ error: null }, makeFormData({ id: '7' }))

      expect(result.error).toBe('Pattern non trovato o accesso negato.')
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })

    it('returns a generic error without leaking DAL failures', async () => {
      mocks.deletePattern.mockRejectedValueOnce(new Error('database host is unreachable'))

      const result = await deletePatternAction({ error: null }, makeFormData({ id: '7' }))

      expect(result.error).toBe('Si è verificato un errore. Riprova tra qualche secondo.')
      expect(result.error).not.toContain('database host')
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })
  })

  describe('promoteSuggestionAction', () => {
    it('passes session userId, hardcoded confidence 0.85, and rejects FormData userId tampering (REV-03, T-35-01)', async () => {
      const result = await promoteSuggestionAction({ error: null }, validPromoteForm({ userId: 'attacker-id' }))

      expect(result).toEqual({ error: null, applyResult: { updatedCount: 3, notUpdatedCount: 12 } })
      expect(mocks.createPattern).toHaveBeenCalledWith({
        userId: 'user-abc',          // from session, NOT 'attacker-id' from FormData
        pattern: 'netflix',
        subCategoryId: 42,
        confidence: 0.85,            // hardcoded — never read from FormData
        description: undefined,
      })
      expectExactCategoryRevalidationRoutes()
    })

    it('ignores FormData confidence value and always sends 0.85 to the DAL', async () => {
      const result = await promoteSuggestionAction(
        { error: null },
        validPromoteForm({ confidence: '0.99' }),
      )

      expect(result).toEqual({ error: null, applyResult: { updatedCount: 3, notUpdatedCount: 12 } })
      expect(mocks.createPattern).toHaveBeenCalledWith(
        expect.objectContaining({ confidence: 0.85 }),
      )
    })

    it('allows free users to promote even when CATEGORIZATION_CUSTOM_PATTERNS_MIN_PLAN=basic (D-03)', async () => {
      process.env.CATEGORIZATION_CUSTOM_PATTERNS_MIN_PLAN = 'basic'
      mocks.verifySession.mockResolvedValueOnce(freeSession)

      const result = await promoteSuggestionAction({ error: null }, validPromoteForm())

      expect(result).toEqual({ error: null, applyResult: { updatedCount: 3, notUpdatedCount: 12 } })
      expect(mocks.createPattern).toHaveBeenCalledOnce()
      expectExactCategoryRevalidationRoutes()
    })

    it('returns validation error without writing when subcategory is missing', async () => {
      const result = await promoteSuggestionAction(
        { error: null },
        validPromoteForm({ subCategoryId: null }),
      )

      expect(result.error).toMatch(/sottocategoria/i)
      expect(mocks.createPattern).not.toHaveBeenCalled()
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })

    it('returns "Pattern regex non valido." for malformed pattern source', async () => {
      const result = await promoteSuggestionAction(
        { error: null },
        validPromoteForm({ pattern: '([' }),
      )

      expect(result.error).toBe('Pattern regex non valido.')
      expect(mocks.createPattern).not.toHaveBeenCalled()
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })

    it('returns generic error without leaking DAL failure detail', async () => {
      mocks.createPattern.mockRejectedValueOnce(
        new Error('FATAL: password authentication failed for db_admin'),
      )

      const result = await promoteSuggestionAction({ error: null }, validPromoteForm())

      expect(result.error).toBe('Si è verificato un errore. Riprova tra qualche secondo.')
      expect(result.error).not.toContain('FATAL')
      expect(result.error).not.toContain('db_admin')
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })

    it('prevents mutation when auth lookup fails', async () => {
      mocks.verifySession.mockRejectedValueOnce(new Error('NEXT_REDIRECT'))

      await expect(
        promoteSuggestionAction({ error: null }, validPromoteForm()),
      ).rejects.toThrow('NEXT_REDIRECT')
      expect(mocks.createPattern).not.toHaveBeenCalled()
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })

    // --- Plan 53-02: applyResult + platform resolution ---

    it('resolves platformId server-side from fileId and calls applyNewPatternToPlatformExpenses (APPLY-01/02)', async () => {
      const result = await promoteSuggestionAction({ error: null }, validPromoteForm())

      expect(result).toEqual({ error: null, applyResult: { updatedCount: 3, notUpdatedCount: 12 } })
      expect(mocks.getPlatformIdForUserFile).toHaveBeenCalledWith({ userId: 'user-abc', fileId: 'file-abc' })
      expect(mocks.applyNewPatternToPlatformExpenses).toHaveBeenCalledWith(
        expect.anything(), // db
        expect.objectContaining({ userId: 'user-abc', platformId: 1 }),
      )
    })

    it('does NOT call legacy applyNewPatternToExpenses on the promote path', async () => {
      await promoteSuggestionAction({ error: null }, validPromoteForm())

      expect(mocks.applyNewPatternToExpenses).not.toHaveBeenCalled()
    })

    it('returns Italian error and does not create pattern when fileId is missing from FormData (T-53-04)', async () => {
      const result = await promoteSuggestionAction(
        { error: null },
        validPromoteForm({ fileId: null }),
      )

      expect(result.error).toBeTruthy()
      expect(result.error).toMatch(/file/i)
      expect(mocks.createPattern).not.toHaveBeenCalled()
    })

    it('returns Italian error and does not create pattern when platformId cannot be resolved (T-53-05)', async () => {
      mocks.getPlatformIdForUserFile.mockResolvedValueOnce(null)

      const result = await promoteSuggestionAction({ error: null }, validPromoteForm())

      expect(result.error).toBeTruthy()
      expect(result.error).toMatch(/piattaforma/i)
      expect(mocks.createPattern).not.toHaveBeenCalled()
    })

    it('returns applyResult with zero counts when apply throws after pattern is saved (non-fatal)', async () => {
      mocks.applyNewPatternToPlatformExpenses.mockRejectedValueOnce(new Error('DB timeout'))

      const result = await promoteSuggestionAction({ error: null }, validPromoteForm())

      expect(result).toEqual({ error: null, applyResult: { updatedCount: 0, notUpdatedCount: 0 } })
      expect(mocks.createPattern).toHaveBeenCalledOnce()
      expectExactCategoryRevalidationRoutes()
    })
  })
})
