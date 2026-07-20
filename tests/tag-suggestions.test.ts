import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Task 1: lib/dal/tag-suggestions.ts — date-range transaction query
// ---------------------------------------------------------------------------

const dalMocks = vi.hoisted(() => ({
  fromArgs: [] as unknown[],
  whereArgs: [] as unknown[],
  orderByArgs: [] as unknown[][],
  queryResult: [] as unknown[],
}))

function makeQueryChain() {
  const chain = {
    from: vi.fn((arg: unknown) => {
      dalMocks.fromArgs.push(arg)
      return chain
    }),
    where: vi.fn((arg: unknown) => {
      dalMocks.whereArgs.push(arg)
      return chain
    }),
    orderBy: vi.fn((...args: unknown[]) => {
      dalMocks.orderByArgs.push(args)
      return Promise.resolve(dalMocks.queryResult)
    }),
  }
  return chain
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
vi.mock('@/lib/db', () => ({
  db: {
    select: () => makeQueryChain(),
  },
}))
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ op: 'and', args }),
  asc: (column: unknown) => ({ op: 'asc', column }),
  eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
  gte: (left: unknown, right: unknown) => ({ op: 'gte', left, right }),
  lte: (left: unknown, right: unknown) => ({ op: 'lte', left, right }),
}))
vi.mock('@/lib/db/schema', () => ({
  transaction: {
    id: 'transaction.id',
    userId: 'transaction.userId',
    occurredAt: 'transaction.occurredAt',
    description: 'transaction.description',
    customTitle: 'transaction.customTitle',
    amount: 'transaction.amount',
    currency: 'transaction.currency',
  },
}))

// ---------------------------------------------------------------------------
// Task 2: lib/services/tag-suggestions.ts — shared matcher + dedup (D-09, D-10)
// ---------------------------------------------------------------------------
//
// `@/lib/dal/tag-suggestions` is deliberately NOT mocked here — its real implementation is
// exercised (backed by the `@/lib/db`/`drizzle-orm`/`@/lib/db/schema` mocks above, reused from
// Task 1), so `dalMocks.queryResult` controls what `getTransactionsInDateRange` resolves to.
// Only the tag-lookup and dedup DAL boundaries (`@/lib/dal/tags`, `@/lib/dal/transaction-tags`)
// are mocked, isolating the service's own matching/dedup/grouping logic.
const serviceMocks = vi.hoisted(() => ({
  getActiveTagsWithDateRange: vi.fn(),
  getTag: vi.fn(),
  getAlreadyTaggedTransactionIds: vi.fn(),
}))

vi.mock('@/lib/dal/tags', () => ({
  getActiveTagsWithDateRange: serviceMocks.getActiveTagsWithDateRange,
  getTag: serviceMocks.getTag,
}))
vi.mock('@/lib/dal/transaction-tags', () => ({
  getAlreadyTaggedTransactionIds: serviceMocks.getAlreadyTaggedTransactionIds,
}))

// ---------------------------------------------------------------------------
// Task 3: lib/actions/tag-suggestions.ts — fetch + confirm actions
// ---------------------------------------------------------------------------
//
// `@/lib/services/tag-suggestions` is deliberately NOT mocked here either, for the same reason
// as Task 2 above — `getNewTagSuggestionsAction` delegates to the real `computeSuggestionsForNewTag`,
// itself backed by the `@/lib/dal/tags`/`@/lib/dal/transaction-tags` mocks. Only the session and
// assignment-service boundaries are mocked.
const actionMocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  bulkAssignTags: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/dal/auth', () => ({ verifySession: actionMocks.verifySession }))
// Export the REAL TagAssignmentError class from the mock so `instanceof` checks in the action
// still work — only bulkAssignTags is mocked (bulkRemoveTags/addSingleTransactionTag/
// removeSingleTransactionTag are untouched, real exports).
vi.mock('@/lib/services/tag-assignment', async () => {
  const actual = await vi.importActual<typeof import('@/lib/services/tag-assignment')>(
    '@/lib/services/tag-assignment',
  )
  return { ...actual, bulkAssignTags: actionMocks.bulkAssignTags }
})
vi.mock('next/cache', () => ({ revalidatePath: actionMocks.revalidatePath }))

const { getTransactionsInDateRange } = await import('@/lib/dal/tag-suggestions')
const { isOccurredAtInRange, computeSuggestionsForTag, computeSuggestionsForNewTag, computeAllTagSuggestions } =
  await import('@/lib/services/tag-suggestions')
const { TagAssignmentError } = await import('@/lib/services/tag-assignment')
const { getNewTagSuggestionsAction, confirmTagSuggestionAction } = await import('@/lib/actions/tag-suggestions')

const validTransactionId = '11111111-1111-4111-8111-111111111111'

function formDataFrom(entries: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(entries)) {
    fd.set(key, value)
  }
  return fd
}

describe('lib/dal/tag-suggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dalMocks.fromArgs.length = 0
    dalMocks.whereArgs.length = 0
    dalMocks.orderByArgs.length = 0
    dalMocks.queryResult = []
  })

  it('scopes to userId and uses inclusive gte/lte bounds against occurredAt', async () => {
    const start = new Date('2026-07-01T00:00:00.000Z')
    const end = new Date('2026-07-31T23:59:59.999Z')

    await getTransactionsInDateRange('user-1', start, end)

    expectContainsPredicate(dalMocks.whereArgs[0], { op: 'eq', left: 'transaction.userId', right: 'user-1' })
    expectContainsPredicate(dalMocks.whereArgs[0], { op: 'gte', left: 'transaction.occurredAt', right: start })
    expectContainsPredicate(dalMocks.whereArgs[0], { op: 'lte', left: 'transaction.occurredAt', right: end })
  })

  it('orders by occurredAt asc, id asc (TAG-03 ordering edge)', async () => {
    await getTransactionsInDateRange('user-1', new Date(), new Date())

    expect(dalMocks.orderByArgs[0]).toEqual([
      { op: 'asc', column: 'transaction.occurredAt' },
      { op: 'asc', column: 'transaction.id' },
    ])
  })

  it('resolves to an empty array, never an error, when no transactions fall in range', async () => {
    dalMocks.queryResult = []

    await expect(getTransactionsInDateRange('user-1', new Date(), new Date())).resolves.toEqual([])
  })

  it('includes a transaction dated exactly at start or end (boundary inclusion is a DB-query concern proven by gte/lte usage above)', async () => {
    const boundaryDate = new Date('2026-07-15T12:00:00.000Z')
    dalMocks.queryResult = [
      {
        id: 'tx-1',
        occurredAt: boundaryDate,
        description: 'Hotel Roma',
        customTitle: null,
        amount: '-120.00',
        currency: 'EUR',
      },
    ]

    const result = await getTransactionsInDateRange('user-1', boundaryDate, boundaryDate)

    expect(result).toEqual(dalMocks.queryResult)
  })
})

describe('lib/services/tag-suggestions', () => {
  const start = new Date('2026-07-01T00:00:00.000Z')
  const end = new Date('2026-07-31T23:59:59.999Z')

  beforeEach(() => {
    vi.clearAllMocks()
    dalMocks.fromArgs.length = 0
    dalMocks.whereArgs.length = 0
    dalMocks.orderByArgs.length = 0
    dalMocks.queryResult = []
    serviceMocks.getAlreadyTaggedTransactionIds.mockResolvedValue(new Set())
  })

  describe('isOccurredAtInRange (D-09 inclusive boundary)', () => {
    it('returns true when the date equals start or end exactly', () => {
      expect(isOccurredAtInRange(start, start, end)).toBe(true)
      expect(isOccurredAtInRange(end, start, end)).toBe(true)
    })

    it('returns true strictly between start and end', () => {
      const mid = new Date('2026-07-15T00:00:00.000Z')
      expect(isOccurredAtInRange(mid, start, end)).toBe(true)
    })

    it('returns false outside the range', () => {
      const before = new Date('2026-06-30T23:59:59.999Z')
      const after = new Date('2026-08-01T00:00:00.001Z')
      expect(isOccurredAtInRange(before, start, end)).toBe(false)
      expect(isOccurredAtInRange(after, start, end)).toBe(false)
    })
  })

  describe('computeSuggestionsForTag', () => {
    it('returns [] immediately, without querying, when dateRangeStart/dateRangeEnd are both null', async () => {
      const result = await computeSuggestionsForTag('user-1', {
        id: 1,
        name: 'Sharm 2026',
        dateRangeStart: null,
        dateRangeEnd: null,
      })

      expect(result).toEqual([])
      expect(dalMocks.fromArgs).toHaveLength(0)
      expect(serviceMocks.getAlreadyTaggedTransactionIds).not.toHaveBeenCalled()
    })

    it('excludes transactions already carrying the tag (D-10), even though they fall in range', async () => {
      dalMocks.queryResult = [
        {
          id: 'tx-1',
          occurredAt: new Date('2026-07-05T00:00:00.000Z'),
          description: 'Hotel Roma',
          customTitle: null,
          amount: '-120.00',
          currency: 'EUR',
        },
        {
          id: 'tx-2',
          occurredAt: new Date('2026-07-06T00:00:00.000Z'),
          description: 'Ristorante Da Mario',
          customTitle: null,
          amount: '-45.00',
          currency: 'EUR',
        },
      ]
      serviceMocks.getAlreadyTaggedTransactionIds.mockResolvedValue(new Set(['tx-1']))

      const result = await computeSuggestionsForTag('user-1', {
        id: 1,
        name: 'Sharm 2026',
        dateRangeStart: start,
        dateRangeEnd: end,
      })

      expect(result).toEqual([
        {
          transactionId: 'tx-2',
          occurredAt: new Date('2026-07-06T00:00:00.000Z'),
          description: 'Ristorante Da Mario',
          customTitle: null,
          amount: '-45.00',
          currency: 'EUR',
        },
      ])
      expect(serviceMocks.getAlreadyTaggedTransactionIds).toHaveBeenCalledWith(1, ['tx-1', 'tx-2'])
    })
  })

  describe('computeSuggestionsForNewTag (D-08a)', () => {
    it('returns null when the tag is not found (IDOR-safe via getTag)', async () => {
      serviceMocks.getTag.mockResolvedValue(null)

      const result = await computeSuggestionsForNewTag({ userId: 'user-1', tagId: 999 })

      expect(result).toBeNull()
    })

    it('loads the tag via getTag and delegates to computeSuggestionsForTag, returning the group', async () => {
      serviceMocks.getTag.mockResolvedValue({
        id: 1,
        name: 'Sharm 2026',
        dateRangeStart: start,
        dateRangeEnd: end,
      })
      dalMocks.queryResult = [
        {
          id: 'tx-1',
          occurredAt: start,
          description: 'Hotel Roma',
          customTitle: null,
          amount: '-120.00',
          currency: 'EUR',
        },
      ]

      const result = await computeSuggestionsForNewTag({ userId: 'user-1', tagId: 1 })

      expect(result).toEqual({
        tagId: 1,
        tagName: 'Sharm 2026',
        matches: [
          {
            transactionId: 'tx-1',
            occurredAt: start,
            description: 'Hotel Roma',
            customTitle: null,
            amount: '-120.00',
            currency: 'EUR',
          },
        ],
      })
    })

    it('returns the group with empty matches (never null) when the found tag has no date range', async () => {
      serviceMocks.getTag.mockResolvedValue({
        id: 2,
        name: 'No range tag',
        dateRangeStart: null,
        dateRangeEnd: null,
      })

      const result = await computeSuggestionsForNewTag({ userId: 'user-1', tagId: 2 })

      expect(result).toEqual({ tagId: 2, tagName: 'No range tag', matches: [] })
    })
  })

  describe('computeAllTagSuggestions (D-08b)', () => {
    it('omits empty-match groups (TAG-03 empty edge, group level)', async () => {
      serviceMocks.getActiveTagsWithDateRange.mockResolvedValue([
        { id: 1, name: 'Sharm 2026', dateRangeStart: start, dateRangeEnd: end },
        { id: 2, name: 'Milano weekend', dateRangeStart: start, dateRangeEnd: end },
      ])
      dalMocks.queryResult = []

      const result = await computeAllTagSuggestions({ userId: 'user-1' })

      expect(result).toEqual([])
    })

    it('returns only groups with at least one match', async () => {
      serviceMocks.getActiveTagsWithDateRange.mockResolvedValue([
        { id: 1, name: 'Sharm 2026', dateRangeStart: start, dateRangeEnd: end },
      ])
      dalMocks.queryResult = [
        {
          id: 'tx-1',
          occurredAt: start,
          description: 'Hotel Roma',
          customTitle: null,
          amount: '-120.00',
          currency: 'EUR',
        },
      ]

      const result = await computeAllTagSuggestions({ userId: 'user-1' })

      expect(result).toEqual([
        {
          tagId: 1,
          tagName: 'Sharm 2026',
          matches: [
            {
              transactionId: 'tx-1',
              occurredAt: start,
              description: 'Hotel Roma',
              customTitle: null,
              amount: '-120.00',
              currency: 'EUR',
            },
          ],
        },
      ])
    })
  })
})

describe('lib/actions/tag-suggestions', () => {
  const start = new Date('2026-07-01T00:00:00.000Z')
  const end = new Date('2026-07-31T23:59:59.999Z')

  beforeEach(() => {
    vi.clearAllMocks()
    dalMocks.fromArgs.length = 0
    dalMocks.whereArgs.length = 0
    dalMocks.orderByArgs.length = 0
    dalMocks.queryResult = []
    serviceMocks.getAlreadyTaggedTransactionIds.mockResolvedValue(new Set())
    actionMocks.verifySession.mockResolvedValue({ userId: 'user-1' })
  })

  describe('getNewTagSuggestionsAction', () => {
    it('returns the computed group unchanged on success', async () => {
      serviceMocks.getTag.mockResolvedValue({
        id: 1,
        name: 'Sharm 2026',
        dateRangeStart: start,
        dateRangeEnd: end,
      })
      dalMocks.queryResult = [
        {
          id: 'tx-1',
          occurredAt: start,
          description: 'Hotel Roma',
          customTitle: null,
          amount: '-120.00',
          currency: 'EUR',
        },
      ]

      const result = await getNewTagSuggestionsAction({ tagId: 1 })

      expect(result).toEqual({
        group: {
          tagId: 1,
          tagName: 'Sharm 2026',
          matches: [
            {
              transactionId: 'tx-1',
              occurredAt: start,
              description: 'Hotel Roma',
              customTitle: null,
              amount: '-120.00',
              currency: 'EUR',
            },
          ],
        },
        error: null,
      })
    })

    it('returns { group: null } when the tag is not found (IDOR-safe, T-67-12)', async () => {
      serviceMocks.getTag.mockResolvedValue(null)

      const result = await getNewTagSuggestionsAction({ tagId: 999 })

      expect(result).toEqual({ group: null, error: null })
    })

    it('returns a generic error and group: null on unexpected failure', async () => {
      serviceMocks.getTag.mockRejectedValue(new Error('db down'))

      const result = await getNewTagSuggestionsAction({ tagId: 1 })

      expect(result).toEqual({
        group: null,
        error: 'Si è verificato un errore. Riprova tra qualche secondo.',
      })
    })
  })

  describe('confirmTagSuggestionAction', () => {
    it('returns { error: "Selezione non valida." } for malformed transactionIds JSON, without calling verifySession', async () => {
      const result = await confirmTagSuggestionAction(
        { error: null },
        formDataFrom({ transactionIds: 'not-json', tagId: '1' }),
      )

      expect(result).toEqual({ error: 'Selezione non valida.' })
      expect(actionMocks.verifySession).not.toHaveBeenCalled()
      expect(actionMocks.bulkAssignTags).not.toHaveBeenCalled()
    })

    it('delegates to bulkAssignTags with tagIds: [tagId] and the parsed transactionIds on success (T-67-13)', async () => {
      actionMocks.bulkAssignTags.mockResolvedValue(undefined)

      const result = await confirmTagSuggestionAction(
        { error: null },
        formDataFrom({ transactionIds: `["${validTransactionId}"]`, tagId: '1' }),
      )

      expect(result).toEqual({ error: null })
      expect(actionMocks.bulkAssignTags).toHaveBeenCalledWith({
        userId: 'user-1',
        transactionIds: [validTransactionId],
        tagIds: [1],
      })
      expect(actionMocks.revalidatePath).toHaveBeenCalledWith('/transactions')
    })

    it('surfaces the exact TagAssignmentError message, not the generic fallback', async () => {
      actionMocks.bulkAssignTags.mockRejectedValue(
        new TagAssignmentError('forbidden', 'Una o più transazioni selezionate non sono valide.'),
      )

      const result = await confirmTagSuggestionAction(
        { error: null },
        formDataFrom({ transactionIds: `["${validTransactionId}"]`, tagId: '1' }),
      )

      expect(result).toEqual({ error: 'Una o più transazioni selezionate non sono valide.' })
    })

    it('falls back to the generic error message for unrelated failures', async () => {
      actionMocks.bulkAssignTags.mockRejectedValue(new Error('db down'))

      const result = await confirmTagSuggestionAction(
        { error: null },
        formDataFrom({ transactionIds: `["${validTransactionId}"]`, tagId: '1' }),
      )

      expect(result).toEqual({ error: 'Si è verificato un errore. Riprova tra qualche secondo.' })
    })
  })
})
