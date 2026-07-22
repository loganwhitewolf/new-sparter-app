import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  bulkAssignTags: vi.fn(),
  bulkRemoveTags: vi.fn(),
  addSingleTransactionTag: vi.fn(),
  removeSingleTransactionTag: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/dal/auth', () => ({ verifySession: mocks.verifySession }))

// Export the REAL TagAssignmentError class from the mock so `instanceof` checks in the action
// still work — only the four functions are mocked.
vi.mock('@/lib/services/tag-assignment', async () => {
  const actual = await vi.importActual<typeof import('@/lib/services/tag-assignment')>(
    '@/lib/services/tag-assignment',
  )
  return {
    ...actual,
    bulkAssignTags: mocks.bulkAssignTags,
    bulkRemoveTags: mocks.bulkRemoveTags,
    addSingleTransactionTag: mocks.addSingleTransactionTag,
    removeSingleTransactionTag: mocks.removeSingleTransactionTag,
  }
})
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))

const { TagAssignmentError } = await import('@/lib/services/tag-assignment')
const {
  bulkAssignTagsAction,
  bulkRemoveTagsAction,
  addTransactionTagAction,
  removeTransactionTagAction,
} = await import('@/lib/actions/transaction-tags')

const validTransactionId = '11111111-1111-4111-8111-111111111111'

function formDataFrom(entries: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(entries)) {
    fd.set(key, value)
  }
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.verifySession.mockResolvedValue({ userId: 'user-1' })
})

describe('bulkAssignTagsAction', () => {
  it('returns { error: "Selezione non valida." } for malformed transactionIds JSON without calling verifySession', async () => {
    const result = await bulkAssignTagsAction(
      { error: null },
      formDataFrom({ transactionIds: 'not-json', tagIds: '[1]' }),
    )

    expect(result).toEqual({ error: 'Selezione non valida.' })
    expect(mocks.verifySession).not.toHaveBeenCalled()
    expect(mocks.bulkAssignTags).not.toHaveBeenCalled()
  })

  it('returns { error: "Selezione non valida." } for malformed tagIds JSON without calling verifySession', async () => {
    const result = await bulkAssignTagsAction(
      { error: null },
      formDataFrom({ transactionIds: `["${validTransactionId}"]`, tagIds: 'not-json' }),
    )

    expect(result).toEqual({ error: 'Selezione non valida.' })
    expect(mocks.verifySession).not.toHaveBeenCalled()
  })

  it('calls the service with the parsed arrays and returns { error: null } on success', async () => {
    mocks.bulkAssignTags.mockResolvedValue(undefined)

    const result = await bulkAssignTagsAction(
      { error: null },
      formDataFrom({ transactionIds: `["${validTransactionId}"]`, tagIds: '[1,2]' }),
    )

    expect(result).toEqual({ error: null })
    expect(mocks.bulkAssignTags).toHaveBeenCalledWith({
      userId: 'user-1',
      transactionIds: [validTransactionId],
      tagIds: [1, 2],
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/transactions')
  })

  it('surfaces the exact TagAssignmentError message, not the generic fallback', async () => {
    mocks.bulkAssignTags.mockRejectedValue(
      new TagAssignmentError('forbidden', 'Una o più transazioni selezionate non sono valide.'),
    )

    const result = await bulkAssignTagsAction(
      { error: null },
      formDataFrom({ transactionIds: `["${validTransactionId}"]`, tagIds: '[1]' }),
    )

    expect(result).toEqual({ error: 'Una o più transazioni selezionate non sono valide.' })
  })

  it('falls back to the generic error message for unrelated failures', async () => {
    mocks.bulkAssignTags.mockRejectedValue(new Error('db down'))

    const result = await bulkAssignTagsAction(
      { error: null },
      formDataFrom({ transactionIds: `["${validTransactionId}"]`, tagIds: '[1]' }),
    )

    expect(result).toEqual({ error: 'Si è verificato un errore. Riprova tra qualche secondo.' })
  })
})

describe('bulkRemoveTagsAction', () => {
  it('returns { error: "Selezione non valida." } for malformed JSON without calling verifySession', async () => {
    const result = await bulkRemoveTagsAction({ error: null }, formDataFrom({ transactionIds: '{', tagIds: '[1]' }))

    expect(result).toEqual({ error: 'Selezione non valida.' })
    expect(mocks.verifySession).not.toHaveBeenCalled()
  })

  it('calls the service with the parsed arrays and returns { error: null } on success', async () => {
    mocks.bulkRemoveTags.mockResolvedValue(undefined)

    const result = await bulkRemoveTagsAction(
      { error: null },
      formDataFrom({ transactionIds: `["${validTransactionId}"]`, tagIds: '[1]' }),
    )

    expect(result).toEqual({ error: null })
    expect(mocks.bulkRemoveTags).toHaveBeenCalledWith({
      userId: 'user-1',
      transactionIds: [validTransactionId],
      tagIds: [1],
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/transactions')
  })
})

describe('addTransactionTagAction / removeTransactionTagAction (D-07b single-item wrappers)', () => {
  it('addTransactionTagAction calls addSingleTransactionTag with a single transactionId/tagId pair, not an array', async () => {
    mocks.addSingleTransactionTag.mockResolvedValue(undefined)

    const result = await addTransactionTagAction(
      { error: null },
      formDataFrom({ transactionId: validTransactionId, tagId: '1' }),
    )

    expect(result).toEqual({ error: null })
    expect(mocks.addSingleTransactionTag).toHaveBeenCalledWith({
      userId: 'user-1',
      transactionId: validTransactionId,
      tagId: 1,
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/transactions')
  })

  it('removeTransactionTagAction calls removeSingleTransactionTag with a single transactionId/tagId pair', async () => {
    mocks.removeSingleTransactionTag.mockResolvedValue(undefined)

    const result = await removeTransactionTagAction(
      { error: null },
      formDataFrom({ transactionId: validTransactionId, tagId: '1' }),
    )

    expect(result).toEqual({ error: null })
    expect(mocks.removeSingleTransactionTag).toHaveBeenCalledWith({
      userId: 'user-1',
      transactionId: validTransactionId,
      tagId: 1,
    })
  })

  it('addTransactionTagAction surfaces the exact TagAssignmentError message', async () => {
    mocks.addSingleTransactionTag.mockRejectedValue(new TagAssignmentError('forbidden', 'Tag non valido.'))

    const result = await addTransactionTagAction(
      { error: null },
      formDataFrom({ transactionId: validTransactionId, tagId: '999' }),
    )

    expect(result).toEqual({ error: 'Tag non valido.' })
  })
})
