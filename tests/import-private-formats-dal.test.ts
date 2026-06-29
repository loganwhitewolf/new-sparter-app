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
    // Contract fields sourced from importFormatVersion (ADR 0013)
    delimiter: ';',
    timestampColumn: 'Date',
    descriptionColumn: 'Description',
    amountType: 'single' as const,
    amountColumn: 'Amount',
    positiveAmountColumn: null,
    negativeAmountColumn: null,
    multiplyBy: 1,
    descriptionStripPattern: null,
    // Identity fields sourced from platform (post-58-01: no platformVisibility, no platformOwnerUserId)
    platformProposedByUserId: null,
    platformReviewStatus: 'approved',
    platformIsActive: true,
    platformName: 'Global Bank',
    platformSlug: 'global-bank',
    platformCountry: 'IT',
    ...overrides,
  }
}

describe('loadImportFormatsForDetection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.rows = []
  })

  // SC4 / D-05: global-approved path must be unregressed — any user gets all approved formats
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

  // PLAT-03 (D-04): owner sees own private format on an approved platform
  it('returns owner-owned private format on an approved platform to its owner', async () => {
    mocks.rows = [
      makeRow({
        id: 2,
        ownerUserId: 'user-a',
        reviewStatus: 'draft',
        platformReviewStatus: 'approved',
        platformProposedByUserId: null,
      }),
    ]

    const result = await loadImportFormatsForDetection({ userId: 'user-a' })

    expect(result.map((f) => f.id)).toEqual([2])
  })

  // PLAT-03 cross-user isolation: non-owner cannot see another user's private format
  it('does NOT return owner-owned private format to a different user (cross-user isolation)', async () => {
    mocks.rows = [
      makeRow({
        id: 3,
        ownerUserId: 'user-a',
        reviewStatus: 'draft',
        platformReviewStatus: 'approved',
        platformProposedByUserId: null,
      }),
    ]

    const result = await loadImportFormatsForDetection({ userId: 'user-b' })

    expect(result).toEqual([])
  })

  // PLAT-02: pending platform is visible only to its proposer
  it('returns pending platform format to its proposer only', async () => {
    mocks.rows = [
      makeRow({
        id: 4,
        ownerUserId: 'user-a',
        reviewStatus: 'draft',
        platformReviewStatus: 'pending',
        platformProposedByUserId: 'user-a',
      }),
    ]

    const resultOwner = await loadImportFormatsForDetection({ userId: 'user-a' })
    expect(resultOwner.map((f) => f.id)).toEqual([4])
  })

  // PLAT-02: pending platform is NOT visible to other users
  it('does NOT return pending platform format to another user', async () => {
    mocks.rows = [
      makeRow({
        id: 5,
        ownerUserId: 'user-a',
        reviewStatus: 'draft',
        platformReviewStatus: 'pending',
        platformProposedByUserId: 'user-a',
      }),
    ]

    const resultOther = await loadImportFormatsForDetection({ userId: 'user-b' })
    expect(resultOther).toEqual([])
  })

  // Cross-user isolation with pending platform
  it('returns no candidate for cross-user, inactive, or nonexistent versions', async () => {
    mocks.rows = [
      makeRow({ id: 6, ownerUserId: 'other-user', reviewStatus: 'draft', platformProposedByUserId: 'other-user', platformReviewStatus: 'pending' }),
      makeRow({ id: 7, isActive: false }),
      makeRow({ id: 8, platformIsActive: false }),
    ]

    const result = await loadImportFormatsForDetection({ userId: 'user-a', selectedFormatVersionId: 6 })

    expect(result).toEqual([])
  })

  // Fail-closed: missing a required shape column → row dropped (defense-in-depth)
  it('fails closed when a required row column is missing from the row shape', async () => {
    const row = makeRow()
    delete (row as Record<string, unknown>).reviewStatus
    mocks.rows = [row]

    await expect(loadImportFormatsForDetection({ userId: 'user-a' })).resolves.toEqual([])
  })
})
