import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getTagByNormalizedName: vi.fn(),
  insertTagRow: vi.fn(),
  updateTagRow: vi.fn(),
  archiveTagRow: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/dal/tags', () => ({
  getTagByNormalizedName: mocks.getTagByNormalizedName,
  insertTagRow: mocks.insertTagRow,
  updateTagRow: mocks.updateTagRow,
  archiveTagRow: mocks.archiveTagRow,
}))

const { TagMutationError, normalizeTagName, createTag, updateTag, archiveTag } = await import(
  '@/lib/services/tag-operations'
)

describe('lib/services/tag-operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('normalizeTagName (D-02 / TAG-01 encoding edge)', () => {
    it('trims and lowercases', () => {
      expect(normalizeTagName('  Sharm ')).toBe('sharm')
    })
  })

  describe('createTag', () => {
    it('succeeds and returns a tag with the normalized name', async () => {
      mocks.getTagByNormalizedName.mockResolvedValue(null)
      mocks.insertTagRow.mockResolvedValue({
        id: 1,
        userId: 'user-1',
        name: 'Sharm',
        normalizedName: 'sharm',
      })

      const result = await createTag({
        userId: 'user-1',
        name: 'Sharm',
        dateRangeStart: null,
        dateRangeEnd: null,
      })

      expect(result).toMatchObject({ normalizedName: 'sharm' })
      expect(mocks.insertTagRow).toHaveBeenCalledWith({
        userId: 'user-1',
        name: 'Sharm',
        normalizedName: 'sharm',
        dateRangeStart: null,
        dateRangeEnd: null,
      })
    })

    it('rejects via the service-level pre-check for a same-user duplicate, without attempting an insert', async () => {
      mocks.getTagByNormalizedName.mockResolvedValue({ id: 1, normalizedName: 'sharm' })

      await expect(
        createTag({ userId: 'user-1', name: '  sharm ', dateRangeStart: null, dateRangeEnd: null }),
      ).rejects.toMatchObject({ name: 'TagMutationError', code: 'duplicate' })

      expect(mocks.insertTagRow).not.toHaveBeenCalled()
    })

    it('catches a 23505 from insertTagRow even when the pre-check found nothing (concurrency edge, TAG-01)', async () => {
      mocks.getTagByNormalizedName.mockResolvedValue(null)
      mocks.insertTagRow.mockRejectedValue({ code: '23505' })

      await expect(
        createTag({ userId: 'user-1', name: 'Sharm', dateRangeStart: null, dateRangeEnd: null }),
      ).rejects.toBeInstanceOf(TagMutationError)
      await expect(
        createTag({ userId: 'user-1', name: 'Sharm', dateRangeStart: null, dateRangeEnd: null }),
      ).rejects.toMatchObject({ code: 'duplicate' })
    })

    it('rethrows non-conflict errors from insertTagRow unchanged', async () => {
      mocks.getTagByNormalizedName.mockResolvedValue(null)
      const unrelated = new Error('connection lost')
      mocks.insertTagRow.mockRejectedValue(unrelated)

      await expect(
        createTag({ userId: 'user-1', name: 'Sharm', dateRangeStart: null, dateRangeEnd: null }),
      ).rejects.toBe(unrelated)
    })
  })

  describe('updateTag', () => {
    it('re-checks uniqueness excluding the tag own row (renaming to its own current name does not self-reject)', async () => {
      mocks.getTagByNormalizedName.mockResolvedValue({ id: 1, normalizedName: 'sharm' })
      mocks.updateTagRow.mockResolvedValue({ id: 1, name: 'Sharm', normalizedName: 'sharm' })

      const result = await updateTag({ userId: 'user-1', tagId: 1, name: 'Sharm' })

      expect(result).toMatchObject({ id: 1 })
      expect(mocks.updateTagRow).toHaveBeenCalledWith('user-1', 1, {
        name: 'Sharm',
        normalizedName: 'sharm',
      })
    })

    it('rejects renaming to a name owned by a different tag', async () => {
      mocks.getTagByNormalizedName.mockResolvedValue({ id: 2, normalizedName: 'sharm 2027' })

      await expect(
        updateTag({ userId: 'user-1', tagId: 1, name: 'Sharm 2027' }),
      ).rejects.toMatchObject({ name: 'TagMutationError', code: 'duplicate' })
      expect(mocks.updateTagRow).not.toHaveBeenCalled()
    })

    it('throws not_found when updateTagRow returns null (no matching owned row)', async () => {
      mocks.updateTagRow.mockResolvedValue(null)

      await expect(
        updateTag({ userId: 'user-1', tagId: 999, dateRangeStart: new Date('2027-01-01') }),
      ).rejects.toMatchObject({ name: 'TagMutationError', code: 'not_found' })
    })

    it('updates only the date range when name is not provided (D-03 partial update)', async () => {
      mocks.updateTagRow.mockResolvedValue({ id: 1, name: 'Sharm' })

      await updateTag({
        userId: 'user-1',
        tagId: 1,
        dateRangeStart: new Date('2027-01-01'),
        dateRangeEnd: new Date('2027-01-10'),
      })

      expect(mocks.getTagByNormalizedName).not.toHaveBeenCalled()
      expect(mocks.updateTagRow).toHaveBeenCalledWith('user-1', 1, {
        dateRangeStart: new Date('2027-01-01'),
        dateRangeEnd: new Date('2027-01-10'),
      })
    })

    it('catches a 23505 from updateTagRow and maps it to duplicate', async () => {
      mocks.getTagByNormalizedName.mockResolvedValue(null)
      mocks.updateTagRow.mockRejectedValue({ code: '23505' })

      await expect(
        updateTag({ userId: 'user-1', tagId: 1, name: 'Sharm' }),
      ).rejects.toMatchObject({ code: 'duplicate' })
    })
  })

  describe('archiveTag', () => {
    it('calls archiveTagRow only, never any delete function', async () => {
      mocks.archiveTagRow.mockResolvedValue({ id: 1, archived: true })

      const result = await archiveTag({ userId: 'user-1', tagId: 1 })

      expect(result).toMatchObject({ archived: true })
      expect(mocks.archiveTagRow).toHaveBeenCalledWith('user-1', 1)
    })

    it('is a safe no-op when called twice in a row (already archived)', async () => {
      mocks.archiveTagRow.mockResolvedValue({ id: 1, archived: true })

      await expect(archiveTag({ userId: 'user-1', tagId: 1 })).resolves.toMatchObject({ archived: true })
      await expect(archiveTag({ userId: 'user-1', tagId: 1 })).resolves.toMatchObject({ archived: true })
    })

    it('throws not_found when archiveTagRow returns null', async () => {
      mocks.archiveTagRow.mockResolvedValue(null)

      await expect(archiveTag({ userId: 'user-1', tagId: 999 })).rejects.toMatchObject({
        name: 'TagMutationError',
        code: 'not_found',
      })
    })
  })
})
