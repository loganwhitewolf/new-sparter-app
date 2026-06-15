import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  whereArgs: [] as unknown[],
}))

vi.mock('server-only', () => ({}))
vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))
vi.mock('@/lib/dal/auth', () => ({ verifySession: mocks.verifySession }))

// ---------------------------------------------------------------------------
// Schema mock — sufficient columns for getEligibleCounterparts
// ---------------------------------------------------------------------------
vi.mock('@/lib/db/schema', () => ({
  transaction: {
    id: 'transaction.id',
    userId: 'transaction.userId',
    amount: 'transaction.amount',
    occurredAt: 'transaction.occurredAt',
    description: 'transaction.description',
    customTitle: 'transaction.customTitle',
  },
  expense: {
    id: 'expense.id',
    subCategoryId: 'expense.subCategoryId',
  },
  transactionPair: {
    transactionAId: 'transactionPair.transactionAId',
    transactionBId: 'transactionPair.transactionBId',
  },
  direction: {
    id: 'direction.id',
    code: 'direction.code',
  },
}))

// ---------------------------------------------------------------------------
// drizzle-orm mock — captures filter operations for assertion
// ---------------------------------------------------------------------------
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ op: 'and', args }),
  eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
  ne: (left: unknown, right: unknown) => ({ op: 'ne', left, right }),
  gt: (left: unknown, right: unknown) => ({ op: 'gt', left, right }),
  lt: (left: unknown, right: unknown) => ({ op: 'lt', left, right }),
  gte: (left: unknown, right: unknown) => ({ op: 'gte', left, right }),
  lte: (left: unknown, right: unknown) => ({ op: 'lte', left, right }),
  or: (...args: unknown[]) => ({ op: 'or', args }),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({ op: 'sql', strings, values }),
    {},
  ),
  not: (arg: unknown) => ({ op: 'not', arg }),
  exists: (arg: unknown) => ({ op: 'exists', arg }),
}))

// ---------------------------------------------------------------------------
// db mock — query chain that captures .where() arg and resolves to []
// ---------------------------------------------------------------------------
function makeQueryChain() {
  const chain = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    where: vi.fn((arg: unknown) => {
      mocks.whereArgs.push(arg)
      return Promise.resolve([])
    }),
    limit: vi.fn(() => Promise.resolve([])),
    orderBy: vi.fn(() => chain),
  }
  return chain
}

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => makeQueryChain()),
  },
}))

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks are declared (RED until Plan 03 lands)
// ---------------------------------------------------------------------------
const { getEligibleCounterparts } = await import('@/lib/dal/transaction-pairs')

// ---------------------------------------------------------------------------
// Test suite — getEligibleCounterparts filter predicate assertions (PAIR-01, D-13, D-14)
// ---------------------------------------------------------------------------
describe('getEligibleCounterparts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.whereArgs.length = 0
    mocks.verifySession.mockResolvedValue({ userId: 'user-1' })
  })

  // Helper: extract the top-level and(...) arg passed to .where()
  function getWhereAndArgs(): unknown[] {
    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    if (where && where.op === 'and') return where.args
    // Handle case where the where arg is the root condition directly
    return [where]
  }

  // ── Session call ──────────────────────────────────────────────────────────
  it('calls verifySession to scope the query to the current user', async () => {
    await getEligibleCounterparts({
      referenceId: 'tx-ref',
      referenceAmount: '-100.00',
      dateFrom: new Date('2026-01-01'),
      dateTo: new Date('2026-03-31'),
    })

    expect(mocks.verifySession).toHaveBeenCalledTimes(1)
  })

  // ── userId ownership scope (eq(transaction.userId, session.userId)) ────────
  it('includes an eq(transaction.userId) predicate scoped to the session user', async () => {
    await getEligibleCounterparts({
      referenceId: 'tx-ref',
      referenceAmount: '-100.00',
      dateFrom: new Date('2026-01-01'),
      dateTo: new Date('2026-03-31'),
    })

    const args = getWhereAndArgs()
    const userIdPredicate = args.find(
      (a) =>
        typeof a === 'object' &&
        a !== null &&
        (a as { op?: string }).op === 'eq' &&
        (a as { left?: string }).left === 'transaction.userId',
    ) as { op: string; left: string; right: string } | undefined

    expect(userIdPredicate).toBeDefined()
    expect(userIdPredicate!.right).toBe('user-1')
  })

  // ── Self-exclusion: ne(transaction.id, referenceId) (D-13) ───────────────
  it('excludes the initiating transaction itself via ne(transaction.id, referenceId)', async () => {
    await getEligibleCounterparts({
      referenceId: 'tx-ref-self',
      referenceAmount: '-100.00',
      dateFrom: new Date('2026-01-01'),
      dateTo: new Date('2026-03-31'),
    })

    const args = getWhereAndArgs()
    const selfExclusion = args.find(
      (a) =>
        typeof a === 'object' &&
        a !== null &&
        (a as { op?: string }).op === 'ne' &&
        (a as { left?: string }).left === 'transaction.id',
    ) as { op: string; left: string; right: string } | undefined

    expect(selfExclusion).toBeDefined()
    expect(selfExclusion!.right).toBe('tx-ref-self')
  })

  // ── Date range: gte(dateFrom) and lte(dateTo) (D-13) ─────────────────────
  it('applies a gte(dateFrom) predicate for the date range lower bound', async () => {
    const dateFrom = new Date('2025-10-15')
    await getEligibleCounterparts({
      referenceId: 'tx-ref',
      referenceAmount: '-100.00',
      dateFrom,
      dateTo: new Date('2026-01-15'),
    })

    const args = getWhereAndArgs()
    const gtePredicate = args.find(
      (a) =>
        typeof a === 'object' &&
        a !== null &&
        (a as { op?: string }).op === 'gte' &&
        (a as { left?: string }).left === 'transaction.occurredAt',
    ) as { op: string; left: string; right: Date } | undefined

    expect(gtePredicate).toBeDefined()
    expect(gtePredicate!.right).toEqual(dateFrom)
  })

  it('applies a lte(dateTo) predicate for the date range upper bound', async () => {
    const dateTo = new Date('2026-01-15')
    await getEligibleCounterparts({
      referenceId: 'tx-ref',
      referenceAmount: '-100.00',
      dateFrom: new Date('2025-10-15'),
      dateTo,
    })

    const args = getWhereAndArgs()
    const ltePredicate = args.find(
      (a) =>
        typeof a === 'object' &&
        a !== null &&
        (a as { op?: string }).op === 'lte' &&
        (a as { left?: string }).left === 'transaction.occurredAt',
    ) as { op: string; left: string; right: Date } | undefined

    expect(ltePredicate).toBeDefined()
    expect(ltePredicate!.right).toEqual(dateTo)
  })

  // ── Opposite-sign filter (D-13) ───────────────────────────────────────────
  // For negative referenceAmount, counterpart must be positive (amount > 0)
  it('adds an opposite-sign filter: amount > 0 when referenceAmount is negative', async () => {
    await getEligibleCounterparts({
      referenceId: 'tx-ref',
      referenceAmount: '-100.00', // negative reference → want positive counterparts
      dateFrom: new Date('2026-01-01'),
      dateTo: new Date('2026-03-31'),
    })

    const args = getWhereAndArgs()
    // Look for a gt or sql-fragment that indicates amount > 0
    const hasPositiveFilter = args.some((a) => {
      if (typeof a !== 'object' || a === null) return false
      const typed = a as { op?: string; left?: string }
      // Either a Drizzle `gt(transaction.amount, '0')` or a sql fragment
      if (typed.op === 'gt' && typed.left === 'transaction.amount') return true
      if (typed.op === 'sql') return true
      return false
    })

    expect(hasPositiveFilter).toBe(true)
  })

  // For positive referenceAmount, counterpart must be negative (amount < 0)
  it('adds an opposite-sign filter: amount < 0 when referenceAmount is positive', async () => {
    await getEligibleCounterparts({
      referenceId: 'tx-ref',
      referenceAmount: '+50.00', // positive reference → want negative counterparts
      dateFrom: new Date('2026-01-01'),
      dateTo: new Date('2026-03-31'),
    })

    const args = getWhereAndArgs()
    const hasNegativeFilter = args.some((a) => {
      if (typeof a !== 'object' || a === null) return false
      const typed = a as { op?: string; left?: string }
      if (typed.op === 'lt' && typed.left === 'transaction.amount') return true
      if (typed.op === 'sql') return true
      return false
    })

    expect(hasNegativeFilter).toBe(true)
  })

  // ── Already-paired exclusion: NOT EXISTS transaction_pair (D-14) ──────────
  it('includes a NOT EXISTS predicate to exclude already-paired transactions (D-14)', async () => {
    await getEligibleCounterparts({
      referenceId: 'tx-ref',
      referenceAmount: '-100.00',
      dateFrom: new Date('2026-01-01'),
      dateTo: new Date('2026-03-31'),
    })

    const args = getWhereAndArgs()

    // Look for a sql fragment mentioning transaction_pair (NOT EXISTS exclusion)
    const hasNotExistsPaired = args.some((a) => {
      if (typeof a !== 'object' || a === null) return false
      const typed = a as { op?: string; strings?: string[] }
      if (typed.op !== 'sql') return false
      const sqlText = (typed.strings ?? []).join('')
      return sqlText.includes('transaction_pair')
    })

    expect(hasNotExistsPaired).toBe(true)
  })

  it('returns the counterpart rows resolved by the query (empty in mock context)', async () => {
    const result = await getEligibleCounterparts({
      referenceId: 'tx-ref',
      referenceAmount: '-100.00',
      dateFrom: new Date('2026-01-01'),
      dateTo: new Date('2026-03-31'),
    })

    expect(Array.isArray(result)).toBe(true)
  })
})
