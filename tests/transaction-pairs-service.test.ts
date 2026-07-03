import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any module imports
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  dbSelectChain: vi.fn(),
  dbInsertChain: vi.fn(),
  dbDeleteChain: vi.fn(),
  applyDetachCleanupTx: vi.fn(),
}))

vi.mock('server-only', () => ({}))

// Mock schema so module imports resolve without real Drizzle types
vi.mock('@/lib/db/schema', () => ({
  transaction: {
    id: 'transaction.id',
    userId: 'transaction.userId',
    amount: 'transaction.amount',
    occurredAt: 'transaction.occurredAt',
    expenseId: 'transaction.expenseId',
  },
  transactionPair: {
    transactionAId: 'transactionPair.transactionAId',
    transactionBId: 'transactionPair.transactionBId',
  },
  expense: {
    id: 'expense.id',
    userId: 'expense.userId',
    subCategoryId: 'expense.subCategoryId',
    title: 'expense.title',
  },
}))

// Mock the detach cleanup core: createPair calls applyDetachCleanupTx to
// categorize the refund (secondary) expense under the primary's subcategory.
vi.mock('@/lib/services/transaction-detach', () => ({
  applyDetachCleanupTx: mocks.applyDetachCleanupTx,
}))

vi.mock('drizzle-orm', () => ({
  eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
  or: (...args: unknown[]) => ({ op: 'or', args }),
  and: (...args: unknown[]) => ({ op: 'and', args }),
}))

// ---------------------------------------------------------------------------
// db mock — controllable select/insert/delete chain
// The service calls:
//   db.select({...}).from(table).where(...).limit(1)  → [row] | []
//   db.insert(table).values({...})                    → void
//   db.delete(table).where(...)                       → void
// ---------------------------------------------------------------------------
function makeSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(rows)),
  }
  return chain
}

function makeInsertChain() {
  const chain = {
    values: vi.fn(() => Promise.resolve([])),
  }
  return chain
}

function makeDeleteChain() {
  const chain = {
    where: vi.fn(() => Promise.resolve([])),
  }
  return chain
}

// db.transaction(cb) invokes cb with the same db object as the tx handle, so the
// existing select/insert/delete chain mocks (and assertions on db.delete etc.) work
// unchanged inside the transaction (CR-02 atomicity).
vi.mock('@/lib/db', () => {
  const db: Record<string, unknown> = {
    select: vi.fn(() => mocks.dbSelectChain()),
    insert: vi.fn(() => mocks.dbInsertChain()),
    delete: vi.fn(() => mocks.dbDeleteChain()),
  }
  db.transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(db))
  return { db }
})

// ---------------------------------------------------------------------------
// Helpers: build transaction-row fixtures with Decimal-string amounts (PAIR-01)
// The service reads: id, amount (DECIMAL string), occurredAt, userId
// ---------------------------------------------------------------------------
function makeTx(
  id: string,
  amount: string,
  occurredAt: Date,
  userId = 'user-1',
) {
  return { id, amount, occurredAt, userId }
}

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks are declared (RED until Plan 03 lands)
// ---------------------------------------------------------------------------
const { createPair, deletePairByTransactionId } = await import(
  '@/lib/services/transaction-pairs'
)

// ---------------------------------------------------------------------------
// createPair — ownership, primary resolution, double-link guard (PAIR-01, T-50-01, T-50-02)
// ---------------------------------------------------------------------------
describe('createPair', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.dbInsertChain.mockReturnValue(makeInsertChain())
    mocks.dbDeleteChain.mockReturnValue(makeDeleteChain())
  })

  // ── (a) Ownership validation — IDOR guard (T-50-01) ──────────────────────
  describe('ownership rejection', () => {
    it('throws the Italian authorization error when transactionId belongs to a different user', async () => {
      const tx1 = makeTx('tx-1', '-100.00', new Date('2026-01-10'), 'user-ATTACKER')
      const tx2 = makeTx('tx-2', '+50.00', new Date('2026-01-15'), 'user-1')

      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        const row = callCount === 1 ? tx1 : tx2
        return makeSelectChain([row])
      })

      await expect(
        createPair({ userId: 'user-1', transactionId: 'tx-1', counterpartId: 'tx-2' }),
      ).rejects.toThrow('Non sei autorizzato')
    })

    it('throws the Italian authorization error when counterpartId belongs to a different user', async () => {
      const tx1 = makeTx('tx-1', '-100.00', new Date('2026-01-10'), 'user-1')
      const tx2 = makeTx('tx-2', '+50.00', new Date('2026-01-15'), 'user-OTHER')

      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        const row = callCount === 1 ? tx1 : tx2
        return makeSelectChain([row])
      })

      await expect(
        createPair({ userId: 'user-1', transactionId: 'tx-1', counterpartId: 'tx-2' }),
      ).rejects.toThrow('Non sei autorizzato')
    })

    it('does not expose internal user IDs in the authorization error message', async () => {
      const tx1 = makeTx('tx-1', '-100.00', new Date('2026-01-10'), 'user-ATTACKER')
      const tx2 = makeTx('tx-2', '+50.00', new Date('2026-01-15'), 'user-1')

      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        const row = callCount === 1 ? tx1 : tx2
        return makeSelectChain([row])
      })

      let errorMsg = ''
      try {
        await createPair({ userId: 'user-1', transactionId: 'tx-1', counterpartId: 'tx-2' })
      } catch (e) {
        if (e instanceof Error) errorMsg = e.message
      }

      expect(errorMsg).not.toContain('user-ATTACKER')
      expect(errorMsg).not.toContain('user-1')
      expect(errorMsg.length).toBeGreaterThan(0)
    })

    it('throws when neither transaction is found', async () => {
      mocks.dbSelectChain.mockImplementation(() => makeSelectChain([]))

      await expect(
        createPair({ userId: 'user-1', transactionId: 'tx-missing', counterpartId: 'tx-also-missing' }),
      ).rejects.toThrow()
    })
  })

  // ── (b) Primary resolution — larger |amount| wins (D-10, PAIR-01) ────────
  describe('primary resolution by |amount|', () => {
    it('inserts the larger-absolute-value transaction as transactionAId (primary)', async () => {
      // tx-A: -100.00 (larger |amount|), tx-B: +50.00 (smaller)
      const txA = makeTx('tx-big', '-100.00', new Date('2026-01-15'), 'user-1')
      const txB = makeTx('tx-small', '+50.00', new Date('2026-01-10'), 'user-1')

      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        const row = callCount === 1 ? txA : txB
        return makeSelectChain([row])
      })

      const insertedValues: unknown[] = []
      const insertChain = {
        values: vi.fn((v: unknown) => {
          insertedValues.push(v)
          return Promise.resolve([])
        }),
      }
      mocks.dbInsertChain.mockReturnValue(insertChain)

      await createPair({ userId: 'user-1', transactionId: 'tx-big', counterpartId: 'tx-small' })

      expect(insertedValues).toHaveLength(1)
      const inserted = insertedValues[0] as { transactionAId: string; transactionBId: string }
      // Primary (larger |amount| = -100.00) must be transactionAId
      expect(inserted.transactionAId).toBe('tx-big')
      expect(inserted.transactionBId).toBe('tx-small')
    })

    it('swaps primary when user initiates from the smaller-amount side (D-10 silent swap)', async () => {
      // User initiates from tx-small (+50.00), but tx-big (-100.00) is the real primary
      const txSmall = makeTx('tx-small', '+50.00', new Date('2026-01-10'), 'user-1')
      const txBig = makeTx('tx-big', '-100.00', new Date('2026-01-15'), 'user-1')

      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        // transactionId=tx-small passed first, counterpartId=tx-big second
        const row = callCount === 1 ? txSmall : txBig
        return makeSelectChain([row])
      })

      const insertedValues: unknown[] = []
      const insertChain = {
        values: vi.fn((v: unknown) => {
          insertedValues.push(v)
          return Promise.resolve([])
        }),
      }
      mocks.dbInsertChain.mockReturnValue(insertChain)

      await createPair({ userId: 'user-1', transactionId: 'tx-small', counterpartId: 'tx-big' })

      const inserted = insertedValues[0] as { transactionAId: string; transactionBId: string }
      // System silently promotes tx-big to primary even though user started from tx-small
      expect(inserted.transactionAId).toBe('tx-big')
      expect(inserted.transactionBId).toBe('tx-small')
    })
  })

  // ── (c) Tie-break by occurredAt when |amounts| are equal (D-10) ──────────
  describe('primary resolution tie-break by occurredAt', () => {
    it('makes the earlier-occurredAt transaction primary when amounts are equal in absolute value', async () => {
      const txEarlier = makeTx('tx-earlier', '-75.00', new Date('2026-01-05'), 'user-1')
      const txLater = makeTx('tx-later', '+75.00', new Date('2026-01-20'), 'user-1')

      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        const row = callCount === 1 ? txEarlier : txLater
        return makeSelectChain([row])
      })

      const insertedValues: unknown[] = []
      const insertChain = {
        values: vi.fn((v: unknown) => {
          insertedValues.push(v)
          return Promise.resolve([])
        }),
      }
      mocks.dbInsertChain.mockReturnValue(insertChain)

      await createPair({ userId: 'user-1', transactionId: 'tx-earlier', counterpartId: 'tx-later' })

      const inserted = insertedValues[0] as { transactionAId: string; transactionBId: string }
      expect(inserted.transactionAId).toBe('tx-earlier')
      expect(inserted.transactionBId).toBe('tx-later')
    })

    it('makes later-initiated tx secondary even when it arrives as transactionId arg if its date is later', async () => {
      const txEarlier = makeTx('tx-jan-01', '-50.00', new Date('2026-01-01'), 'user-1')
      const txLater = makeTx('tx-jan-15', '+50.00', new Date('2026-01-15'), 'user-1')

      // User initiates from tx-jan-15 (later date), counterpart is tx-jan-01 (earlier)
      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        const row = callCount === 1 ? txLater : txEarlier
        return makeSelectChain([row])
      })

      const insertedValues: unknown[] = []
      const insertChain = {
        values: vi.fn((v: unknown) => {
          insertedValues.push(v)
          return Promise.resolve([])
        }),
      }
      mocks.dbInsertChain.mockReturnValue(insertChain)

      await createPair({ userId: 'user-1', transactionId: 'tx-jan-15', counterpartId: 'tx-jan-01' })

      const inserted = insertedValues[0] as { transactionAId: string; transactionBId: string }
      // tx-jan-01 is earlier → promoted to primary
      expect(inserted.transactionAId).toBe('tx-jan-01')
      expect(inserted.transactionBId).toBe('tx-jan-15')
    })
  })

  // ── (d) Double-link guard (T-50-02) ───────────────────────────────────────
  describe('double-link rejection', () => {
    it('surfaces a DB uniqueness error when a transaction is already paired (T-50-02)', async () => {
      const tx1 = makeTx('tx-1', '-100.00', new Date('2026-01-10'), 'user-1')
      const tx2 = makeTx('tx-2', '+50.00', new Date('2026-01-15'), 'user-1')

      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        const row = callCount === 1 ? tx1 : tx2
        return makeSelectChain([row])
      })

      // Simulate unique constraint violation from DB
      const insertChain = {
        values: vi.fn(() => Promise.reject(new Error('duplicate key value violates unique constraint'))),
      }
      mocks.dbInsertChain.mockReturnValue(insertChain)

      await expect(
        createPair({ userId: 'user-1', transactionId: 'tx-1', counterpartId: 'tx-2' }),
      ).rejects.toThrow()
    })

    it('translates a Postgres unique violation (23505) into a localized message (WR-03)', async () => {
      const tx1 = makeTx('tx-1', '-100.00', new Date('2026-01-10'), 'user-1')
      const tx2 = makeTx('tx-2', '+50.00', new Date('2026-01-15'), 'user-1')

      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        const row = callCount === 1 ? tx1 : tx2
        return makeSelectChain([row])
      })

      // Drizzle/pg surface the SQLSTATE on error.cause.code
      const pgError = new Error('duplicate key value violates unique constraint "transaction_pair_a_unique"')
      ;(pgError as unknown as { cause: { code: string } }).cause = { code: '23505' }
      const insertChain = { values: vi.fn(() => Promise.reject(pgError)) }
      mocks.dbInsertChain.mockReturnValue(insertChain)

      let errorMsg = ''
      try {
        await createPair({ userId: 'user-1', transactionId: 'tx-1', counterpartId: 'tx-2' })
      } catch (e) {
        if (e instanceof Error) errorMsg = e.message
      }

      // No DB internals leak; the user sees the localized message.
      expect(errorMsg).toContain('già collegata')
      expect(errorMsg).not.toContain('unique constraint')
      expect(errorMsg).not.toContain('transaction_pair_a_unique')
    })

    it('re-throws a non-unique-violation insert error unchanged (WR-03)', async () => {
      const tx1 = makeTx('tx-1', '-100.00', new Date('2026-01-10'), 'user-1')
      const tx2 = makeTx('tx-2', '+50.00', new Date('2026-01-15'), 'user-1')

      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        const row = callCount === 1 ? tx1 : tx2
        return makeSelectChain([row])
      })

      const insertChain = { values: vi.fn(() => Promise.reject(new Error('connection reset'))) }
      mocks.dbInsertChain.mockReturnValue(insertChain)

      await expect(
        createPair({ userId: 'user-1', transactionId: 'tx-1', counterpartId: 'tx-2' }),
      ).rejects.toThrow('connection reset')
    })
  })

  // ── (g) Self-pair guard (CR-01) ───────────────────────────────────────────
  describe('self-pair rejection', () => {
    it('throws when transactionId === counterpartId, before any DB read or insert', async () => {
      const { db } = await import('@/lib/db')
      mocks.dbSelectChain.mockImplementation(() => makeSelectChain([]))

      await expect(
        createPair({ userId: 'user-1', transactionId: 'tx-1', counterpartId: 'tx-1' }),
      ).rejects.toThrow('a se stessa')

      // Must short-circuit before touching the DB.
      expect(db.select).not.toHaveBeenCalled()
      expect(db.insert).not.toHaveBeenCalled()
      expect(db.transaction).not.toHaveBeenCalled()
    })
  })

  // ── (h) Opposite-sign enforcement + zero-amount hazard (CR-03) ────────────
  describe('opposite-sign enforcement', () => {
    it('throws when both transactions have the same sign (two expenses)', async () => {
      const tx1 = makeTx('tx-1', '-100.00', new Date('2026-01-10'), 'user-1')
      const tx2 = makeTx('tx-2', '-40.00', new Date('2026-01-15'), 'user-1')
      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        return makeSelectChain([callCount === 1 ? tx1 : tx2])
      })

      await expect(
        createPair({ userId: 'user-1', transactionId: 'tx-1', counterpartId: 'tx-2' }),
      ).rejects.toThrow('segno opposto')
    })

    it('throws when one leg is exactly zero (no opposite sign)', async () => {
      const tx1 = makeTx('tx-1', '-100.00', new Date('2026-01-10'), 'user-1')
      const tx2 = makeTx('tx-2', '0.00', new Date('2026-01-15'), 'user-1')
      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        return makeSelectChain([callCount === 1 ? tx1 : tx2])
      })

      await expect(
        createPair({ userId: 'user-1', transactionId: 'tx-1', counterpartId: 'tx-2' }),
      ).rejects.toThrow('segno opposto')
    })

    it('does NOT insert a pair when the sign check fails', async () => {
      const tx1 = makeTx('tx-1', '+30.00', new Date('2026-01-10'), 'user-1')
      const tx2 = makeTx('tx-2', '+30.00', new Date('2026-01-15'), 'user-1')
      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        return makeSelectChain([callCount === 1 ? tx1 : tx2])
      })
      const insertChain = { values: vi.fn(() => Promise.resolve([])) }
      mocks.dbInsertChain.mockReturnValue(insertChain)

      await expect(
        createPair({ userId: 'user-1', transactionId: 'tx-1', counterpartId: 'tx-2' }),
      ).rejects.toThrow('segno opposto')
      expect(insertChain.values).not.toHaveBeenCalled()
    })
  })

  // ── (i) Atomicity — read-then-write runs inside db.transaction (CR-02) ────
  describe('atomic write path', () => {
    it('performs the ownership read and insert inside db.transaction', async () => {
      const { db } = await import('@/lib/db')
      const tx1 = makeTx('tx-1', '-100.00', new Date('2026-01-10'), 'user-1')
      const tx2 = makeTx('tx-2', '+50.00', new Date('2026-01-15'), 'user-1')
      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        return makeSelectChain([callCount === 1 ? tx1 : tx2])
      })
      mocks.dbInsertChain.mockReturnValue(makeInsertChain())

      await createPair({ userId: 'user-1', transactionId: 'tx-1', counterpartId: 'tx-2' })

      expect(db.transaction).toHaveBeenCalledTimes(1)
    })
  })
})

// ---------------------------------------------------------------------------
// createPair — refund cleanup on pairing (decision 2)
// After the pair insert, the refund (secondary) expense inherits the refunded
// spend's (primary's) subcategory via applyDetachCleanupTx — but only when the
// primary is categorized and the secondary has its own distinct expense.
// ---------------------------------------------------------------------------
// A transaction leg row as loaded by createPair (now includes expenseId).
function makeLeg(
  id: string,
  amount: string,
  occurredAt: Date,
  expenseId: string | null,
  userId = 'user-1',
) {
  return { id, amount, occurredAt, userId, expenseId }
}

// Drive the sequential selects createPair performs: legA, legB, the primary-expense
// join, then (only on the cleanup path) the secondary-expense title lookup used to
// compose the refund title. Promise.all preserves array order, so legA is call 1
// (transactionId) and legB is call 2 (counterpartId); primary-expense is call 3 and
// the secondary-expense title is call 4.
function mockPairSelects(
  legA: unknown,
  legB: unknown,
  primaryExpenseRow: unknown | null,
  secondaryExpenseTitle?: string,
) {
  let callCount = 0
  mocks.dbSelectChain.mockImplementation(() => {
    callCount += 1
    if (callCount === 1) return makeSelectChain([legA])
    if (callCount === 2) return makeSelectChain([legB])
    if (callCount === 3) return makeSelectChain(primaryExpenseRow ? [primaryExpenseRow] : [])
    return makeSelectChain(secondaryExpenseTitle != null ? [{ title: secondaryExpenseTitle }] : [])
  })
}

describe('createPair — refund cleanup (decision 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.dbInsertChain.mockReturnValue(makeInsertChain())
    mocks.dbDeleteChain.mockReturnValue(makeDeleteChain())
    mocks.applyDetachCleanupTx.mockResolvedValue({
      newExpenseId: 'exp-refund',
      newExpenseTitle: 'Spesa X',
    })
  })

  it('inherits the spend subcategory onto the refund expense (1:1 inherit path)', async () => {
    // Spend -100.00 (primary, categorized), refund +50.00 (secondary, own expense).
    const spend = makeLeg('tx-spend', '-100.00', new Date('2026-01-10'), 'exp-spend')
    const refund = makeLeg('tx-refund', '+50.00', new Date('2026-01-15'), 'exp-refund')
    mockPairSelects(
      spend,
      refund,
      { expenseId: 'exp-spend', subCategoryId: 7, title: 'Spesa X' },
      'Giulia Bianchi',
    )

    const result = await createPair({
      userId: 'user-1',
      transactionId: 'tx-spend',
      counterpartId: 'tx-refund',
    })

    expect(mocks.applyDetachCleanupTx).toHaveBeenCalledTimes(1)
    // Title composed as "{refund's own title} — rimborso {spend title}".
    expect(mocks.applyDetachCleanupTx).toHaveBeenCalledWith(expect.anything(), {
      userId: 'user-1',
      transactionId: 'tx-refund',
      title: 'Giulia Bianchi — rimborso Spesa X',
      subCategoryId: 7,
    })
    // The service surfaces the resolved secondary + inherited subcategory for the UI.
    expect(result).toEqual({
      secondaryTransactionId: 'tx-refund',
      inheritedSubCategoryId: 7,
    })
  })

  it('skips cleanup when the refunded spend is uncategorized (donor uncategorized)', async () => {
    const spend = makeLeg('tx-spend', '-100.00', new Date('2026-01-10'), 'exp-spend')
    const refund = makeLeg('tx-refund', '+50.00', new Date('2026-01-15'), 'exp-refund')
    mockPairSelects(spend, refund, {
      expenseId: 'exp-spend',
      subCategoryId: null,
      title: 'Spesa X',
    })

    const insertChain = { values: vi.fn(() => Promise.resolve([])) }
    mocks.dbInsertChain.mockReturnValue(insertChain)

    const result = await createPair({
      userId: 'user-1',
      transactionId: 'tx-spend',
      counterpartId: 'tx-refund',
    })

    expect(mocks.applyDetachCleanupTx).not.toHaveBeenCalled()
    // The pair is still inserted.
    expect(insertChain.values).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ secondaryTransactionId: 'tx-refund' })
  })

  it('skips cleanup when primary and secondary share the same expense', async () => {
    const spend = makeLeg('tx-spend', '-100.00', new Date('2026-01-10'), 'exp-shared')
    const refund = makeLeg('tx-refund', '+50.00', new Date('2026-01-15'), 'exp-shared')
    mockPairSelects(spend, refund, {
      expenseId: 'exp-shared',
      subCategoryId: 7,
      title: 'Spesa X',
    })

    await createPair({
      userId: 'user-1',
      transactionId: 'tx-spend',
      counterpartId: 'tx-refund',
    })

    expect(mocks.applyDetachCleanupTx).not.toHaveBeenCalled()
  })

  it('skips cleanup when the secondary has no linked expense', async () => {
    const spend = makeLeg('tx-spend', '-100.00', new Date('2026-01-10'), 'exp-spend')
    const refund = makeLeg('tx-refund', '+50.00', new Date('2026-01-15'), null)
    mockPairSelects(spend, refund, {
      expenseId: 'exp-spend',
      subCategoryId: 7,
      title: 'Spesa X',
    })

    await createPair({
      userId: 'user-1',
      transactionId: 'tx-spend',
      counterpartId: 'tx-refund',
    })

    expect(mocks.applyDetachCleanupTx).not.toHaveBeenCalled()
  })

  it('targets the secondary (refund) even when initiated from the smaller-|amount| leg', async () => {
    // User initiates from the refund (+50.00, smaller). The spend (-100.00) is
    // still resolved as primary; cleanup targets the refund as secondary.
    const refund = makeLeg('tx-refund', '+50.00', new Date('2026-01-15'), 'exp-refund')
    const spend = makeLeg('tx-spend', '-100.00', new Date('2026-01-10'), 'exp-spend')
    // call 1 = transactionId (tx-refund), call 2 = counterpartId (tx-spend)
    mockPairSelects(
      refund,
      spend,
      { expenseId: 'exp-spend', subCategoryId: 9, title: 'Spesa Y' },
      'Marco Rossi',
    )

    const result = await createPair({
      userId: 'user-1',
      transactionId: 'tx-refund',
      counterpartId: 'tx-spend',
    })

    expect(mocks.applyDetachCleanupTx).toHaveBeenCalledTimes(1)
    expect(mocks.applyDetachCleanupTx).toHaveBeenCalledWith(expect.anything(), {
      userId: 'user-1',
      transactionId: 'tx-refund',
      title: 'Marco Rossi — rimborso Spesa Y',
      subCategoryId: 9,
    })
    expect(result.secondaryTransactionId).toBe('tx-refund')
  })

  it('resolves primary by earlier occurredAt on an |amount| tie and cleans up the later leg', async () => {
    // Equal |amount|: earlier date is primary (the spend), later is the refund.
    const spend = makeLeg('tx-early', '-75.00', new Date('2026-01-05'), 'exp-spend')
    const refund = makeLeg('tx-late', '+75.00', new Date('2026-01-20'), 'exp-refund')
    mockPairSelects(
      spend,
      refund,
      { expenseId: 'exp-spend', subCategoryId: 3, title: 'Spesa Z' },
      'Anna Verdi',
    )

    await createPair({
      userId: 'user-1',
      transactionId: 'tx-early',
      counterpartId: 'tx-late',
    })

    expect(mocks.applyDetachCleanupTx).toHaveBeenCalledWith(expect.anything(), {
      userId: 'user-1',
      transactionId: 'tx-late',
      title: 'Anna Verdi — rimborso Spesa Z',
      subCategoryId: 3,
    })
  })

  it('never calls cleanup when the opposite-sign guard rejects', async () => {
    const spend = makeLeg('tx-1', '-100.00', new Date('2026-01-10'), 'exp-a')
    const alsoSpend = makeLeg('tx-2', '-40.00', new Date('2026-01-15'), 'exp-b')
    mockPairSelects(spend, alsoSpend, null)

    await expect(
      createPair({ userId: 'user-1', transactionId: 'tx-1', counterpartId: 'tx-2' }),
    ).rejects.toThrow('segno opposto')
    expect(mocks.applyDetachCleanupTx).not.toHaveBeenCalled()
  })

  it('never calls cleanup when the ownership guard rejects', async () => {
    const spend = makeLeg('tx-1', '-100.00', new Date('2026-01-10'), 'exp-a', 'user-ATTACKER')
    const refund = makeLeg('tx-2', '+50.00', new Date('2026-01-15'), 'exp-b', 'user-1')
    mockPairSelects(spend, refund, null)

    await expect(
      createPair({ userId: 'user-1', transactionId: 'tx-1', counterpartId: 'tx-2' }),
    ).rejects.toThrow('Non sei autorizzato')
    expect(mocks.applyDetachCleanupTx).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// deletePairByTransactionId — ownership validation + or-predicate delete (PAIR-03)
// ---------------------------------------------------------------------------
describe('deletePairByTransactionId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.dbInsertChain.mockReturnValue(makeInsertChain())
  })

  // ── (e) Ownership validation before delete ────────────────────────────────
  describe('ownership validation', () => {
    it('throws the Italian authorization error when the transaction does not belong to the session user', async () => {
      const tx = makeTx('tx-1', '-100.00', new Date('2026-01-10'), 'user-OTHER')
      mocks.dbSelectChain.mockImplementation(() => makeSelectChain([tx]))

      await expect(
        deletePairByTransactionId({ userId: 'user-1', transactionId: 'tx-1' }),
      ).rejects.toThrow('Non sei autorizzato')
    })

    it('throws when the transaction is not found at all', async () => {
      mocks.dbSelectChain.mockImplementation(() => makeSelectChain([]))

      await expect(
        deletePairByTransactionId({ userId: 'user-1', transactionId: 'tx-missing' }),
      ).rejects.toThrow()
    })

    // Unpair regression (decision 4): unlinking only removes the pair — it never
    // runs the detach cleanup, so the inherited subcategory + synthetic hash persist.
    it('never invokes the detach cleanup when unlinking', async () => {
      const tx = makeTx('tx-1', '-100.00', new Date('2026-01-10'), 'user-1')
      mocks.dbSelectChain.mockImplementation(() => makeSelectChain([tx]))
      mocks.dbDeleteChain.mockReturnValue(makeDeleteChain())

      await deletePairByTransactionId({ userId: 'user-1', transactionId: 'tx-1' })

      expect(mocks.applyDetachCleanupTx).not.toHaveBeenCalled()
    })
  })

  // ── (f) or-predicate delete covers both FK sides (PAIR-03 unlink contract) ─
  describe('unlink-restores-baseline — or-predicate delete', () => {
    it('deletes the pair where the transaction appears as transactionAId OR transactionBId', async () => {
      const tx = makeTx('tx-1', '-100.00', new Date('2026-01-10'), 'user-1')
      mocks.dbSelectChain.mockImplementation(() => makeSelectChain([tx]))

      const { db } = await import('@/lib/db')
      const capturedWhereArgs: unknown[] = []
      const deleteChain = {
        where: vi.fn((arg: unknown) => {
          capturedWhereArgs.push(arg)
          return Promise.resolve([])
        }),
      }
      mocks.dbDeleteChain.mockReturnValue(deleteChain)

      await deletePairByTransactionId({ userId: 'user-1', transactionId: 'tx-1' })

      // delete must have been called with a WHERE clause
      expect(db.delete).toHaveBeenCalledTimes(1)
      expect(deleteChain.where).toHaveBeenCalledTimes(1)

      // The WHERE predicate must be an OR combining both FK sides
      const whereArg = capturedWhereArgs[0] as { op: string; args: unknown[] }
      expect(whereArg.op).toBe('or')
      expect(whereArg.args).toHaveLength(2)
    })

    it('includes transactionAId equality in the or-predicate (primary side)', async () => {
      const tx = makeTx('tx-1', '-100.00', new Date('2026-01-10'), 'user-1')
      mocks.dbSelectChain.mockImplementation(() => makeSelectChain([tx]))

      const capturedWhereArgs: unknown[] = []
      const deleteChain = {
        where: vi.fn((arg: unknown) => {
          capturedWhereArgs.push(arg)
          return Promise.resolve([])
        }),
      }
      mocks.dbDeleteChain.mockReturnValue(deleteChain)

      await deletePairByTransactionId({ userId: 'user-1', transactionId: 'tx-1' })

      const whereArg = capturedWhereArgs[0] as { op: string; args: { op: string; left: string; right: string }[] }
      const eqArgs = whereArg.args.map((a) => a.right)
      // Both sides of the OR must reference 'tx-1' (the transactionId)
      expect(eqArgs).toContain('tx-1')
    })

    it('succeeds when the user owns the transaction', async () => {
      const tx = makeTx('tx-1', '-100.00', new Date('2026-01-10'), 'user-1')
      mocks.dbSelectChain.mockImplementation(() => makeSelectChain([tx]))
      mocks.dbDeleteChain.mockReturnValue(makeDeleteChain())

      await expect(
        deletePairByTransactionId({ userId: 'user-1', transactionId: 'tx-1' }),
      ).resolves.toBeUndefined()
    })

    it('performs the ownership read and delete inside db.transaction (CR-02)', async () => {
      const { db } = await import('@/lib/db')
      const tx = makeTx('tx-1', '-100.00', new Date('2026-01-10'), 'user-1')
      mocks.dbSelectChain.mockImplementation(() => makeSelectChain([tx]))
      mocks.dbDeleteChain.mockReturnValue(makeDeleteChain())

      await deletePairByTransactionId({ userId: 'user-1', transactionId: 'tx-1' })

      expect(db.transaction).toHaveBeenCalledTimes(1)
    })
  })
})
