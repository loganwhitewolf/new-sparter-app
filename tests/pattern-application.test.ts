import { beforeEach, describe, expect, it, vi } from 'vitest'

// Hoisted mocks — must be declared before any import
const mocks = vi.hoisted(() => ({
  uncategorizedExpenses: [] as Array<{ id: string; title: string; totalAmount: string }>,
  writeClassificationHistoryCalls: [] as unknown[],
  updateExpenseCalls: [] as unknown[],

  getUncategorizedExpensesForPlatformApply: vi.fn(),
  writeClassificationHistory: vi.fn(),

  // DB mock for UPDATE
  dbUpdate: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/dal/regex-discovery', () => ({
  getUncategorizedExpensesForPlatformApply: mocks.getUncategorizedExpensesForPlatformApply,
}))

vi.mock('@/lib/dal/classification-history', () => ({
  writeClassificationHistory: mocks.writeClassificationHistory,
}))

// Mock DB with chainable update
vi.mock('@/lib/db', () => {
  const updateChain = {
    set: vi.fn(() => updateChain),
    where: vi.fn(() => Promise.resolve()),
  }
  const db = {
    update: vi.fn(() => updateChain),
  }
  return { db }
})

vi.mock('@/lib/db/schema', () => ({
  expense: {
    id: 'expense.id',
    userId: 'expense.userId',
    subCategoryId: 'expense.subCategoryId',
  },
}))

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ op: 'and', args }),
  eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
  inArray: (column: unknown, values: unknown[]) => ({ op: 'inArray', column, values }),
  isNull: (column: unknown) => ({ op: 'isNull', column }),
}))

// normalizeDescription: real implementation from utils/import would normalize titles;
// for tests we need a simple version that matches the production logic
vi.mock('@/lib/utils/import', () => ({
  normalizeDescription: (title: string) =>
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s*]/g, '')
      .trim(),
}))

const { applyNewPatternToPlatformExpenses } = await import('../lib/services/pattern-application')

describe('applyNewPatternToPlatformExpenses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.uncategorizedExpenses = []
    mocks.writeClassificationHistoryCalls.length = 0
    mocks.updateExpenseCalls.length = 0
    mocks.getUncategorizedExpensesForPlatformApply.mockImplementation(
      async (_userId: string, _platformId: number) => mocks.uncategorizedExpenses,
    )
    mocks.writeClassificationHistory.mockResolvedValue(undefined)
  })

  // ── Platform boundary ──────────────────────────────────────────────────────
  it('calls getUncategorizedExpensesForPlatformApply with the correct userId and platformId', async () => {
    mocks.uncategorizedExpenses = []
    const db = (await import('@/lib/db')).db

    await applyNewPatternToPlatformExpenses(db as never, {
      userId: 'user-1',
      platformId: 7,
      patternId: 42,
      patternString: 'netflix',
      subCategoryId: 99,
      confidence: 0.85,
    })

    expect(mocks.getUncategorizedExpensesForPlatformApply).toHaveBeenCalledWith(
      'user-1',
      7,
    )
    expect(mocks.getUncategorizedExpensesForPlatformApply).toHaveBeenCalledTimes(1)
  })

  it('only updates expenses returned by platform-scoped DAL (platform boundary, APPLY-02 T-53-01)', async () => {
    // Platform 1 (Fineco) fixture — returned by the mock
    mocks.uncategorizedExpenses = [
      { id: 'exp-fineco-1', title: 'Pagamento Netflix', totalAmount: '-9.99' },
      { id: 'exp-fineco-2', title: 'Pagamento Spotify', totalAmount: '-4.99' },
    ]

    const db = (await import('@/lib/db')).db
    // Reset to ensure update call tracking works
    const updateChain = { set: vi.fn(() => updateChain), where: vi.fn(() => Promise.resolve()) }
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue(updateChain)

    const result = await applyNewPatternToPlatformExpenses(db as never, {
      userId: 'user-1',
      platformId: 1, // Fineco
      patternId: 42,
      patternString: 'netflix',
      subCategoryId: 99,
      confidence: 0.85,
    })

    // Only Fineco exp-fineco-1 matches "netflix"; exp-fineco-2 does not
    expect(result.updatedCount).toBe(1)
    expect(result.notUpdatedCount).toBe(1)
    // Platform 2 (Revolut) expenses are never passed — the mock only returns Fineco rows
    expect(mocks.getUncategorizedExpensesForPlatformApply).toHaveBeenCalledWith('user-1', 1)
  })

  // ── Count semantics ────────────────────────────────────────────────────────
  it('returns { updatedCount: 2, notUpdatedCount: 1 } when 3 scanned, 2 match', async () => {
    mocks.uncategorizedExpenses = [
      { id: 'exp-1', title: 'Addebito Netflix abbonamento', totalAmount: '-9.99' },
      { id: 'exp-2', title: 'Netflix pagamento mensile', totalAmount: '-9.99' },
      { id: 'exp-3', title: 'Macellaio San Salvatore', totalAmount: '-35.00' },
    ]

    const db = (await import('@/lib/db')).db

    const result = await applyNewPatternToPlatformExpenses(db as never, {
      userId: 'user-1',
      platformId: 1,
      patternId: 42,
      patternString: 'netflix',
      subCategoryId: 99,
      confidence: 0.85,
    })

    expect(result.updatedCount).toBe(2)
    expect(result.notUpdatedCount).toBe(1)
  })

  it('returns { updatedCount: 0, notUpdatedCount: scanned } when no match', async () => {
    mocks.uncategorizedExpenses = [
      { id: 'exp-1', title: 'Macellaio San Salvatore', totalAmount: '-35.00' },
      { id: 'exp-2', title: 'Supermercato Esselunga', totalAmount: '-55.00' },
    ]

    const db = (await import('@/lib/db')).db

    const result = await applyNewPatternToPlatformExpenses(db as never, {
      userId: 'user-1',
      platformId: 1,
      patternId: 42,
      patternString: 'netflix',
      subCategoryId: 99,
      confidence: 0.85,
    })

    expect(result.updatedCount).toBe(0)
    expect(result.notUpdatedCount).toBe(2)
  })

  it('returns { updatedCount: 0, notUpdatedCount: 0 } when no expenses in scope', async () => {
    mocks.uncategorizedExpenses = []

    const db = (await import('@/lib/db')).db

    const result = await applyNewPatternToPlatformExpenses(db as never, {
      userId: 'user-1',
      platformId: 1,
      patternId: 42,
      patternString: 'netflix',
      subCategoryId: 99,
      confidence: 0.85,
    })

    expect(result.updatedCount).toBe(0)
    expect(result.notUpdatedCount).toBe(0)
  })

  // ── Invalid regex ──────────────────────────────────────────────────────────
  it('returns { updatedCount: 0, notUpdatedCount: scanned } for invalid regex without throwing', async () => {
    mocks.uncategorizedExpenses = [
      { id: 'exp-1', title: 'Netflix abbonamento', totalAmount: '-9.99' },
      { id: 'exp-2', title: 'Macellaio', totalAmount: '-35.00' },
    ]

    const db = (await import('@/lib/db')).db

    const result = await applyNewPatternToPlatformExpenses(db as never, {
      userId: 'user-1',
      platformId: 1,
      patternId: 42,
      patternString: '[invalid(regex', // invalid regex pattern
      subCategoryId: 99,
      confidence: 0.85,
    })

    expect(result.updatedCount).toBe(0)
    expect(result.notUpdatedCount).toBe(2) // scanned count
  })

  // ── Numeric-stripped dual match (Pitfall 6 / matcher fidelity) ────────────
  it('matches via numeric-stripped form for titles with pure-numeric tokens', async () => {
    // "***** 114 data operazione" → normalized "* 114 data operazione"
    // → stripped: "* data operazione" (removes "114")
    // Pattern "data operazione" matches the stripped form
    mocks.uncategorizedExpenses = [
      { id: 'exp-num-1', title: '***** 114 data operazione', totalAmount: '-50.00' },
      { id: 'exp-num-2', title: '***** 998 data operazione', totalAmount: '-75.00' },
      { id: 'exp-num-3', title: 'Macellaio San Salvatore', totalAmount: '-35.00' },
    ]

    const db = (await import('@/lib/db')).db

    const result = await applyNewPatternToPlatformExpenses(db as never, {
      userId: 'user-1',
      platformId: 1,
      patternId: 43,
      patternString: 'data operazione', // matches stripped form only (numeric "114"/"998" removed)
      subCategoryId: 88,
      confidence: 0.9,
    })

    expect(result.updatedCount).toBe(2) // both numeric-prefixed rows match via strip
    expect(result.notUpdatedCount).toBe(1) // Macellaio does not match
  })

  // ── writeClassificationHistory called for each matched expense ─────────────
  it('calls writeClassificationHistory for each matched expense with source=user_pattern', async () => {
    mocks.uncategorizedExpenses = [
      { id: 'exp-1', title: 'Netflix abbonamento', totalAmount: '-9.99' },
      { id: 'exp-2', title: 'Netflix mensile', totalAmount: '-9.99' },
    ]

    const db = (await import('@/lib/db')).db

    await applyNewPatternToPlatformExpenses(db as never, {
      userId: 'user-1',
      platformId: 1,
      patternId: 42,
      patternString: 'netflix',
      subCategoryId: 99,
      confidence: 0.85,
    })

    expect(mocks.writeClassificationHistory).toHaveBeenCalledTimes(2)
    expect(mocks.writeClassificationHistory).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ source: 'user_pattern', patternId: 42 }),
    )
  })
})
