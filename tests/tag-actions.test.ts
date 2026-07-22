import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  archiveTag: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/dal/auth', () => ({ verifySession: mocks.verifySession }))

// Export the REAL TagMutationError class from the mock so `instanceof` checks in the action
// still work — only the three functions are mocked.
vi.mock('@/lib/services/tag-operations', async () => {
  const actual = await vi.importActual<typeof import('@/lib/services/tag-operations')>(
    '@/lib/services/tag-operations',
  )
  return {
    ...actual,
    createTag: mocks.createTag,
    updateTag: mocks.updateTag,
    archiveTag: mocks.archiveTag,
  }
})
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))

const { TagMutationError } = await import('@/lib/services/tag-operations')
const { createTagAction, updateTagAction, archiveTagAction } = await import('@/lib/actions/tags')

function formDataFrom(entries: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(entries)) {
    fd.set(key, value)
  }
  return fd
}

describe('lib/actions/tags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue({ userId: 'user-1' })
  })

  describe('createTagAction', () => {
    it('returns the zod validation message for invalid form data without calling verifySession', async () => {
      const result = await createTagAction({ error: null }, formDataFrom({ name: 'a' }))

      expect(result.error).toBeTruthy()
      expect(mocks.verifySession).not.toHaveBeenCalled()
      expect(mocks.createTag).not.toHaveBeenCalled()
    })

    it('calls the service with parsed data and returns { error: null, tagId } on success', async () => {
      mocks.createTag.mockResolvedValue({ id: 42, name: 'Sharm', normalizedName: 'sharm' })

      const result = await createTagAction({ error: null }, formDataFrom({ name: 'Sharm' }))

      expect(result).toEqual({ error: null, tagId: 42 })
      expect(mocks.createTag).toHaveBeenCalledWith({
        userId: 'user-1',
        name: 'Sharm',
        dateRangeStart: null,
        dateRangeEnd: null,
      })
      expect(mocks.revalidatePath).toHaveBeenCalledWith('/tags')
      // WR-02 — a newly created tag must also refresh the dashboard Tag section
      expect(mocks.revalidatePath).toHaveBeenCalledWith('/dashboard/tags')
    })

    it('surfaces the exact TagMutationError message for a duplicate, not the generic fallback', async () => {
      mocks.createTag.mockRejectedValue(
        new TagMutationError('duplicate', 'Esiste già un tag con questo nome.'),
      )

      const result = await createTagAction({ error: null }, formDataFrom({ name: 'Sharm' }))

      expect(result).toEqual({ error: 'Esiste già un tag con questo nome.' })
    })

    it('falls back to the generic error message for unrelated failures', async () => {
      mocks.createTag.mockRejectedValue(new Error('db down'))

      const result = await createTagAction({ error: null }, formDataFrom({ name: 'Sharm' }))

      expect(result.error).toBe('Si è verificato un errore. Riprova tra qualche secondo.')
    })
  })

  describe('updateTagAction', () => {
    it('returns the zod validation message for an invalid id', async () => {
      const result = await updateTagAction({ error: null }, formDataFrom({ id: 'not-a-number', name: 'Sharm' }))

      expect(result.error).toBeTruthy()
      expect(mocks.updateTag).not.toHaveBeenCalled()
    })

    it('calls the service with the parsed tagId and returns { error: null } on success', async () => {
      mocks.updateTag.mockResolvedValue({ id: 1, name: 'Sharm 2027' })

      const result = await updateTagAction({ error: null }, formDataFrom({ id: '1', name: 'Sharm 2027' }))

      expect(result).toEqual({ error: null })
      expect(mocks.updateTag).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', tagId: 1, name: 'Sharm 2027' }),
      )
      expect(mocks.revalidatePath).toHaveBeenCalledWith('/tags')
      // WR-02 — a renamed tag must also refresh the dashboard Tag section
      expect(mocks.revalidatePath).toHaveBeenCalledWith('/dashboard/tags')
    })

    it('surfaces a not_found TagMutationError message', async () => {
      mocks.updateTag.mockRejectedValue(new TagMutationError('not_found', 'Tag non trovato.'))

      const result = await updateTagAction({ error: null }, formDataFrom({ id: '999', name: 'Sharm' }))

      expect(result).toEqual({ error: 'Tag non trovato.' })
    })
  })

  describe('archiveTagAction', () => {
    it('returns the zod validation message for a missing id', async () => {
      const result = await archiveTagAction({ error: null }, formDataFrom({}))

      expect(result.error).toBeTruthy()
      expect(mocks.archiveTag).not.toHaveBeenCalled()
    })

    it('calls the service and returns { error: null } on success', async () => {
      mocks.archiveTag.mockResolvedValue({ id: 1, archived: true })

      const result = await archiveTagAction({ error: null }, formDataFrom({ id: '1' }))

      expect(result).toEqual({ error: null })
      expect(mocks.archiveTag).toHaveBeenCalledWith({ userId: 'user-1', tagId: 1 })
      expect(mocks.revalidatePath).toHaveBeenCalledWith('/tags')
    })

    it('revalidates BOTH /tags and /dashboard/tags on success (Pitfall 3 fix — 68-04)', async () => {
      mocks.archiveTag.mockResolvedValue({ id: 1, archived: true })

      await archiveTagAction({ error: null }, formDataFrom({ id: '1' }))

      expect(mocks.revalidatePath).toHaveBeenCalledTimes(2)
      expect(mocks.revalidatePath).toHaveBeenNthCalledWith(1, '/tags')
      expect(mocks.revalidatePath).toHaveBeenNthCalledWith(2, '/dashboard/tags')
    })

    it('does not call revalidatePath at all when the service call fails', async () => {
      mocks.archiveTag.mockRejectedValue(new Error('db down'))

      await archiveTagAction({ error: null }, formDataFrom({ id: '1' }))

      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })

    it('surfaces a not_found TagMutationError message', async () => {
      mocks.archiveTag.mockRejectedValue(new TagMutationError('not_found', 'Tag non trovato.'))

      const result = await archiveTagAction({ error: null }, formDataFrom({ id: '999' }))

      expect(result).toEqual({ error: 'Tag non trovato.' })
    })
  })
})
