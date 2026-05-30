import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const mocks = vi.hoisted(() => ({
  rows: [] as unknown[],
}))

function makeQueryChain() {
  const resolve = () => Promise.resolve(mocks.rows)
  const proxy: Record<string, unknown> = new Proxy({}, {
    get: (_target, prop) => {
      if (prop === 'then') return resolve().then.bind(resolve())
      if (typeof prop === 'string') return () => proxy
      return undefined
    },
  })
  return proxy
}

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => makeQueryChain()),
  },
}))

const { loadImportFormatsForDetection } = await import('../lib/dal/import-formats')

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    platformId: 1,
    version: 1,
    headerSignature: 'Date;Description;Amount',
    isActive: true,
    ownerUserId: null,
    visibility: 'global',
    reviewStatus: 'approved',
    platformOwnerUserId: null,
    platformVisibility: 'global',
    platformReviewStatus: 'approved',
    platformIsActive: true,
    platformName: 'Global Bank',
    platformSlug: 'global-bank',
    platformDelimiter: ';',
    platformCountry: 'IT',
    platformTimestampColumn: 'Date',
    platformDescriptionColumn: 'Description',
    platformAmountType: 'single',
    platformAmountColumn: 'Amount',
    platformPositiveAmountColumn: null,
    platformNegativeAmountColumn: null,
    platformMultiplyBy: 1,
    platformDescriptionStripPattern: null,
    ...overrides,
  }
}

describe('loadImportFormatsForDetection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.rows = []
  })

  it('returns active global approved formats to any user', async () => {
    mocks.rows = [makeRow()]

    const result = await loadImportFormatsForDetection({ userId: 'user-a' })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 1,
      platformId: 1,
      version: 1,
      headerSignature: 'Date;Description;Amount',
      isActive: true,
      platform: expect.objectContaining({ name: 'Global Bank', slug: 'global-bank' }),
    })
  })

  it('returns private formats only to the owning user', async () => {
    mocks.rows = [
      makeRow({ id: 2, ownerUserId: 'user-a', visibility: 'private', reviewStatus: 'draft', platformOwnerUserId: 'user-a', platformVisibility: 'private', platformReviewStatus: 'draft' }),
      makeRow({ id: 3, ownerUserId: 'user-b', visibility: 'private', reviewStatus: 'draft', platformOwnerUserId: 'user-b', platformVisibility: 'private', platformReviewStatus: 'draft' }),
    ]

    const result = await loadImportFormatsForDetection({ userId: 'user-a' })

    expect(result.map((format) => format.id)).toEqual([2])
  })

  it('returns no candidate for selected cross-user, inactive, or nonexistent versions', async () => {
    mocks.rows = [
      makeRow({ id: 4, ownerUserId: 'other-user', visibility: 'private', platformOwnerUserId: 'other-user', platformVisibility: 'private' }),
      makeRow({ id: 5, isActive: false }),
      makeRow({ id: 6, platformIsActive: false }),
    ]

    const result = await loadImportFormatsForDetection({ userId: 'user-a', selectedFormatVersionId: 4 })

    expect(result).toEqual([])
  })

  it('fails closed when ownership columns are missing from an unexpected row shape', async () => {
    const row = makeRow()
    delete (row as Record<string, unknown>).visibility
    mocks.rows = [row]

    await expect(loadImportFormatsForDetection({ userId: 'user-a' })).resolves.toEqual([])
  })
})
