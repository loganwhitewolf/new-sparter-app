import {
  archiveTagRow,
  getTagByNormalizedName,
  insertTagRow,
  updateTagRow,
  type TagRow,
} from '@/lib/dal/tags'

export type TagMutationErrorCode = 'not_found' | 'duplicate'

export class TagMutationError extends Error {
  constructor(
    public readonly code: TagMutationErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'TagMutationError'
  }
}

// Duplicated locally (not imported from lib/dal/categories.ts) — keeps the categories and tags
// domains independent, per this plan's read_first note.
function isUniqueConflict(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: unknown }).code === '23505',
  )
}

// D-02: case- and whitespace-insensitive uniqueness. Exported so tests can assert normalization
// independently of the full createTag flow (TAG-01 encoding edge).
export function normalizeTagName(name: string): string {
  return name.trim().toLowerCase()
}

export async function createTag(input: {
  userId: string
  name: string
  dateRangeStart: Date | null
  dateRangeEnd: Date | null
}): Promise<TagRow> {
  const normalizedName = normalizeTagName(input.name)

  // Fast pre-check path: catches the common case with no DB write attempted.
  const existing = await getTagByNormalizedName(input.userId, normalizedName)
  if (existing) {
    throw new TagMutationError('duplicate', 'Esiste già un tag con questo nome.')
  }

  try {
    return await insertTagRow({
      userId: input.userId,
      name: input.name.trim(),
      normalizedName,
      dateRangeStart: input.dateRangeStart,
      dateRangeEnd: input.dateRangeEnd,
    })
  } catch (error) {
    // This catch is what closes the concurrency edge the pre-check alone cannot (TAG-01).
    if (isUniqueConflict(error)) {
      throw new TagMutationError('duplicate', 'Esiste già un tag con questo nome.')
    }
    throw error
  }
}

export async function updateTag(input: {
  userId: string
  tagId: number
  name?: string
  dateRangeStart?: Date | null
  dateRangeEnd?: Date | null
}): Promise<TagRow> {
  const updates: {
    name?: string
    normalizedName?: string
    dateRangeStart?: Date | null
    dateRangeEnd?: Date | null
  } = {}

  // Partial update semantics (D-03): only fields explicitly provided are touched.
  if (input.dateRangeStart !== undefined) updates.dateRangeStart = input.dateRangeStart
  if (input.dateRangeEnd !== undefined) updates.dateRangeEnd = input.dateRangeEnd

  if (input.name !== undefined) {
    const normalizedName = normalizeTagName(input.name)
    const existing = await getTagByNormalizedName(input.userId, normalizedName)
    // Renaming a tag to its own current name must not self-reject.
    if (existing && existing.id !== input.tagId) {
      throw new TagMutationError('duplicate', 'Esiste già un tag con questo nome.')
    }
    updates.name = input.name
    updates.normalizedName = normalizedName
  }

  let updated: TagRow | null
  try {
    updated = await updateTagRow(input.userId, input.tagId, updates)
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new TagMutationError('duplicate', 'Esiste già un tag con questo nome.')
    }
    throw error
  }

  if (!updated) {
    throw new TagMutationError('not_found', 'Tag non trovato.')
  }

  return updated
}

// D-04: archive, never delete. Idempotent — archiving an already-archived tag is a safe no-op
// (no separate archive-history/audit table to double-write).
export async function archiveTag(input: { userId: string; tagId: number }): Promise<TagRow> {
  const archived = await archiveTagRow(input.userId, input.tagId)
  if (!archived) {
    throw new TagMutationError('not_found', 'Tag non trovato.')
  }
  return archived
}
