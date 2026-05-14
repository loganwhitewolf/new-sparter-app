import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  createPattern: vi.fn(),
  updatePattern: vi.fn(),
  deletePattern: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))

vi.mock('@/lib/dal/auth', () => ({
  verifySession: mocks.verifySession,
}))

vi.mock('@/lib/dal/patterns', () => ({
  createPattern: mocks.createPattern,
  updatePattern: mocks.updatePattern,
  deletePattern: mocks.deletePattern,
}))

vi.mock('@/lib/validations/pattern', async () => {
  const actual = await vi.importActual<typeof import('../lib/validations/pattern')>(
    '../lib/validations/pattern',
  )
  return actual
})

const { createPatternAction, updatePatternAction, deletePatternAction } = await import('../lib/actions/patterns')

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
}

describe('pattern Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue(paidSession)
    mocks.createPattern.mockResolvedValue({ id: 7 })
    mocks.updatePattern.mockResolvedValue({ id: 7 })
    mocks.deletePattern.mockResolvedValue({ id: 7 })
  })

  describe('createPatternAction', () => {
    it('passes canonical schema output and session userId to the DAL', async () => {
      const result = await createPatternAction({ error: null }, validCreateForm({ userId: 'attacker-id' }))

      expect(result).toEqual({ error: null })
      expect(mocks.createPattern).toHaveBeenCalledWith({
        userId: 'user-abc',
        pattern: 'netflix',
        subCategoryId: 42,
        amountSign: 'negative',
        confidence: 0.95,
        description: 'Streaming subscriptions',
      })
      expect(mocks.revalidatePath).toHaveBeenCalledWith('/settings/patterns')
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
    it('passes canonical schema output, id, and session userId to the DAL', async () => {
      const result = await updatePatternAction({ error: null }, validUpdateForm({ userId: 'attacker-id' }))

      expect(result).toEqual({ error: null })
      expect(mocks.updatePattern).toHaveBeenCalledWith(7, 'user-abc', {
        pattern: 'netflix',
        subCategoryId: 42,
        amountSign: 'negative',
        confidence: 0.95,
        description: 'Streaming subscriptions',
      })
      expect(mocks.revalidatePath).toHaveBeenCalledWith('/settings/patterns')
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

    it('returns validation errors without writing for invalid confidence', async () => {
      const result = await updatePatternAction({ error: null }, validUpdateForm({ confidence: '-0.1' }))

      expect(result.error).toBeTruthy()
      expect(mocks.updatePattern).not.toHaveBeenCalled()
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
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
    it('deletes using the session userId and revalidates settings on success', async () => {
      const result = await deletePatternAction({ error: null }, makeFormData({ id: '7', userId: 'attacker-id' }))

      expect(result).toEqual({ error: null })
      expect(mocks.deletePattern).toHaveBeenCalledWith(7, 'user-abc')
      expect(mocks.revalidatePath).toHaveBeenCalledWith('/settings/patterns')
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
})
