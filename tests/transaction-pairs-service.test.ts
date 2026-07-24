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

// Mock schema so module imports resolve without real Drizzle types.
// `reimbursement`/`reimbursementRefund` are reference-distinct objects so
// db.insert(table)/db.delete(table) mocks can branch on which table is targeted.
vi.mock('@/lib/db/schema', () => ({
  transaction: {
    id: 'transaction.id',
    userId: 'transaction.userId',
    amount: 'transaction.amount',
    occurredAt: 'transaction.occurredAt',
    expenseId: 'transaction.expenseId',
  },
  expense: {
    id: 'expense.id',
    userId: 'expense.userId',
    subCategoryId: 'expense.subCategoryId',
    title: 'expense.title',
    descriptionHash: 'expense.descriptionHash',
    status: 'expense.status',
  },
  reimbursement: {
    id: 'reimbursement.id',
    userId: 'reimbursement.userId',
    title: 'reimbursement.title',
    expenseId: 'reimbursement.expenseId',
    expenseGroupId: 'reimbursement.expenseGroupId',
  },
  reimbursementRefund: {
    id: 'reimbursementRefund.id',
    reimbursementId: 'reimbursementRefund.reimbursementId',
    transactionId: 'reimbursementRefund.transactionId',
  },
  reimbursementRefundSnapshot: {
    id: 'reimbursementRefundSnapshot.id',
    reimbursementRefundId: 'reimbursementRefundSnapshot.reimbursementRefundId',
    expenseId: 'reimbursementRefundSnapshot.expenseId',
    expenseTitle: 'reimbursementRefundSnapshot.expenseTitle',
    expenseDescriptionHash: 'reimbursementRefundSnapshot.expenseDescriptionHash',
    expenseSubCategoryId: 'reimbursementRefundSnapshot.expenseSubCategoryId',
    expenseStatus: 'reimbursementRefundSnapshot.expenseStatus',
  },
  reimbursementAnchorTransaction: {
    id: 'reimbursementAnchorTransaction.id',
    reimbursementId: 'reimbursementAnchorTransaction.reimbursementId',
    transactionId: 'reimbursementAnchorTransaction.transactionId',
  },
  expenseGroup: {
    id: 'expenseGroup.id',
    userId: 'expenseGroup.userId',
    title: 'expenseGroup.title',
    subCategoryId: 'expenseGroup.subCategoryId',
  },
  expenseGroupMembership: {
    id: 'expenseGroupMembership.id',
    groupId: 'expenseGroupMembership.groupId',
    expenseId: 'expenseGroupMembership.expenseId',
  },
}))

// Mock the detach cleanup core: createPair calls applyDetachCleanupTx to
// categorize the refund expense under the anchor's subcategory.
vi.mock('@/lib/services/transaction-detach', () => ({
  applyDetachCleanupTx: mocks.applyDetachCleanupTx,
}))

vi.mock('drizzle-orm', () => ({
  eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
  and: (...args: unknown[]) => ({ op: 'and', args }),
}))

// ---------------------------------------------------------------------------
// db mock — controllable select/insert/delete chain
// The service calls:
//   db.select({...}).from(table).where(...).limit(1)                  → [row] | []
//   db.insert(reimbursement).values({...}).returning({...})           → [{ id }]
//   db.insert(reimbursementRefund).values({...})                      → thenable, resolves []
//   db.delete(table).where(...)                                       → void
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

// Supports both `await tx.insert(t).values(v)` (awaited directly, via `.then`)
// and `await tx.insert(t).values(v).returning({...})` (explicit `.returning()`).
function makeInsertChain(returningRows: unknown[] = [], onValues?: (v: unknown) => void) {
  const chain = {
    values: vi.fn((v: unknown) => {
      onValues?.(v)
      const result: {
        then: (resolve: (value: unknown[]) => void) => void
        returning: ReturnType<typeof vi.fn>
      } = {
        then: (resolve) => resolve([]),
        returning: vi.fn(() => Promise.resolve(returningRows)),
      }
      return result
    }),
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
    insert: vi.fn((table: unknown) => mocks.dbInsertChain(table)),
    delete: vi.fn((table: unknown) => mocks.dbDeleteChain(table)),
  }
  db.transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(db))
  return { db }
})

// ---------------------------------------------------------------------------
// Helpers: build transaction-row fixtures with Decimal-string amounts (PAIR-01)
// The service reads: id, amount (DECIMAL string), occurredAt, userId, expenseId
// ---------------------------------------------------------------------------
function makeTx(
  id: string,
  amount: string,
  occurredAt: Date,
  userId = 'user-1',
  expenseId: string | null = 'exp-default',
) {
  return { id, amount, occurredAt, userId, expenseId }
}

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks are declared
// ---------------------------------------------------------------------------
const { createPair, deletePairByTransactionId } = await import(
  '@/lib/services/transaction-pairs'
)

// ---------------------------------------------------------------------------
// createPair — ownership, sign-based anchor resolution, double-link guard
// (PAIR-01, T-50-01, T-50-02, Phase 73 T-73-12)
// ---------------------------------------------------------------------------
describe('createPair', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.dbInsertChain.mockReturnValue(makeInsertChain([{ id: 1 }]))
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
        createPair({ userId: 'user-1', anchor: { transactionId: 'tx-1' }, counterpartId: 'tx-2' }),
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
        createPair({ userId: 'user-1', anchor: { transactionId: 'tx-1' }, counterpartId: 'tx-2' }),
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
        await createPair({ userId: 'user-1', anchor: { transactionId: 'tx-1' }, counterpartId: 'tx-2' })
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
        createPair({ userId: 'user-1', anchor: { transactionId: 'tx-missing' }, counterpartId: 'tx-also-missing' }),
      ).rejects.toThrow()
    })
  })

  // ── (b) Anchor resolution — by SIGN, never |amount| magnitude ────────────
  // Phase 73 (D-02, T-73-12, ADR 0018): retires the Phase 50 magnitude-based
  // primary/secondary tie-break, which could anchor on the wrong leg when a
  // refund's |amount| exceeded its spend's. The negative leg is always the
  // anchor; the positive leg is always the refund — regardless of magnitude.
  describe('anchor resolution by sign (D-02, retires magnitude tie-break)', () => {
    it('anchors on the negative (outflow) leg even when its |amount| is SMALLER than the refund', async () => {
      // A €30 outflow paired with a €50 refund still anchors on the €30 outflow —
      // the OLD magnitude-based tie-break would have picked the €50 leg as "primary".
      const outflow = makeTx('tx-outflow', '-30.00', new Date('2026-01-10'), 'user-1', 'exp-spend')
      const refund = makeTx('tx-refund', '+50.00', new Date('2026-01-15'), 'user-1', 'exp-refund')

      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return makeSelectChain([outflow])
        if (callCount === 2) return makeSelectChain([refund])
        // call 3: anchor-expense lookup (uncategorized — skip cleanup)
        if (callCount === 3) {
          return makeSelectChain([{ expenseId: 'exp-spend', subCategoryId: null, title: 'Spesa Piccola' }])
        }
        // call 4: create-or-append lookup — no existing reimbursement (CREATE path)
        return makeSelectChain([])
      })

      const reimbursementValues: unknown[] = []
      const refundValues: unknown[] = []
      mocks.dbInsertChain.mockImplementation((table: unknown) => {
        const t = table as { title?: string; reimbursementId?: string }
        if (t.title === 'reimbursement.title') {
          return makeInsertChain([{ id: 42 }], (v) => reimbursementValues.push(v))
        }
        if (t.reimbursementId === 'reimbursementRefund.reimbursementId') {
          return makeInsertChain([{ id: 99 }], (v) => refundValues.push(v))
        }
        return makeInsertChain([], (v) => refundValues.push(v))
      })

      const result = await createPair({
        userId: 'user-1',
        anchor: { transactionId: 'tx-outflow' },
        counterpartId: 'tx-refund',
      })

      expect(reimbursementValues[0]).toMatchObject({ expenseId: 'exp-spend' })
      expect(refundValues[0]).toMatchObject({ reimbursementId: 42, transactionId: 'tx-refund' })
      expect(result.secondaryTransactionId).toBe('tx-refund')
    })

    it('anchors on the negative leg even when initiated from the positive (refund) side', async () => {
      const refund = makeTx('tx-refund', '+50.00', new Date('2026-01-15'), 'user-1', 'exp-refund')
      const outflow = makeTx('tx-outflow', '-30.00', new Date('2026-01-10'), 'user-1', 'exp-spend')

      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        // transactionId=tx-refund passed first, counterpartId=tx-outflow second
        if (callCount === 1) return makeSelectChain([refund])
        if (callCount === 2) return makeSelectChain([outflow])
        if (callCount === 3) {
          return makeSelectChain([{ expenseId: 'exp-spend', subCategoryId: null, title: 'Spesa Piccola' }])
        }
        // call 4: create-or-append lookup — no existing reimbursement (CREATE path)
        return makeSelectChain([])
      })

      const reimbursementValues: unknown[] = []
      const refundValues: unknown[] = []
      mocks.dbInsertChain.mockImplementation((table: unknown) => {
        const t = table as { title?: string; reimbursementId?: string }
        if (t.title === 'reimbursement.title') {
          return makeInsertChain([{ id: 1 }], (v) => reimbursementValues.push(v))
        }
        if (t.reimbursementId === 'reimbursementRefund.reimbursementId') {
          return makeInsertChain([{ id: 99 }], (v) => refundValues.push(v))
        }
        return makeInsertChain([], (v) => refundValues.push(v))
      })

      const result = await createPair({
        userId: 'user-1',
        anchor: { transactionId: 'tx-refund' },
        counterpartId: 'tx-outflow',
      })

      // The outflow is always the anchor, regardless of which side initiated the pair.
      expect(reimbursementValues[0]).toMatchObject({ expenseId: 'exp-spend' })
      expect(result.secondaryTransactionId).toBe('tx-refund')
    })

    it('rejects an anchor with no linked Expense (D-03 XOR would otherwise be violated)', async () => {
      const outflow = makeTx('tx-outflow', '-30.00', new Date('2026-01-10'), 'user-1', null)
      const refund = makeTx('tx-refund', '+50.00', new Date('2026-01-15'), 'user-1', 'exp-refund')

      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return makeSelectChain([outflow])
        if (callCount === 2) return makeSelectChain([refund])
        // call 3: anchor-expense lookup — inner join yields no row (no Expense)
        return makeSelectChain([])
      })

      await expect(
        createPair({ userId: 'user-1', anchor: { transactionId: 'tx-outflow' }, counterpartId: 'tx-refund' }),
      ).rejects.toThrow('non è associata a nessuna spesa')
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
        if (callCount === 1) return makeSelectChain([tx1])
        if (callCount === 2) return makeSelectChain([tx2])
        if (callCount === 3) {
          return makeSelectChain([{ expenseId: 'exp-default', subCategoryId: null, title: 'Spesa X' }])
        }
        // call 4: create-or-append lookup — no existing reimbursement (CREATE path)
        return makeSelectChain([])
      })

      // Simulate unique constraint violation from DB on the reimbursement insert
      const insertChain = {
        values: vi.fn(() => ({
          then: (resolve: (v: unknown[]) => void) => resolve([]),
          returning: vi.fn(() =>
            Promise.reject(new Error('duplicate key value violates unique constraint')),
          ),
        })),
      }
      mocks.dbInsertChain.mockReturnValue(insertChain)

      await expect(
        createPair({ userId: 'user-1', anchor: { transactionId: 'tx-1' }, counterpartId: 'tx-2' }),
      ).rejects.toThrow()
    })

    it('translates a Postgres unique violation (23505) into a localized message (WR-03)', async () => {
      const tx1 = makeTx('tx-1', '-100.00', new Date('2026-01-10'), 'user-1')
      const tx2 = makeTx('tx-2', '+50.00', new Date('2026-01-15'), 'user-1')

      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return makeSelectChain([tx1])
        if (callCount === 2) return makeSelectChain([tx2])
        if (callCount === 3) {
          return makeSelectChain([{ expenseId: 'exp-default', subCategoryId: null, title: 'Spesa X' }])
        }
        // call 4: create-or-append lookup — no existing reimbursement (CREATE path)
        return makeSelectChain([])
      })

      // Drizzle/pg surface the SQLSTATE on error.cause.code — now triggered by
      // reimbursement_expenseId_unique / reimbursement_refund_transactionId_unique
      // instead of transaction_pair's old uniques.
      const pgError = new Error(
        'duplicate key value violates unique constraint "reimbursement_expenseId_unique"',
      )
      ;(pgError as unknown as { cause: { code: string } }).cause = { code: '23505' }
      const insertChain = {
        values: vi.fn(() => ({
          then: (resolve: (v: unknown[]) => void) => resolve([]),
          returning: vi.fn(() => Promise.reject(pgError)),
        })),
      }
      mocks.dbInsertChain.mockReturnValue(insertChain)

      let errorMsg = ''
      try {
        await createPair({ userId: 'user-1', anchor: { transactionId: 'tx-1' }, counterpartId: 'tx-2' })
      } catch (e) {
        if (e instanceof Error) errorMsg = e.message
      }

      // No DB internals leak; the user sees the localized message.
      expect(errorMsg).toContain('già collegata')
      expect(errorMsg).not.toContain('unique constraint')
      expect(errorMsg).not.toContain('reimbursement_expenseId_unique')
    })

    it('re-throws a non-unique-violation insert error unchanged (WR-03)', async () => {
      const tx1 = makeTx('tx-1', '-100.00', new Date('2026-01-10'), 'user-1')
      const tx2 = makeTx('tx-2', '+50.00', new Date('2026-01-15'), 'user-1')

      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return makeSelectChain([tx1])
        if (callCount === 2) return makeSelectChain([tx2])
        if (callCount === 3) {
          return makeSelectChain([{ expenseId: 'exp-default', subCategoryId: null, title: 'Spesa X' }])
        }
        // call 4: create-or-append lookup — no existing reimbursement (CREATE path)
        return makeSelectChain([])
      })

      const insertChain = {
        values: vi.fn(() => ({
          then: (resolve: (v: unknown[]) => void) => resolve([]),
          returning: vi.fn(() => Promise.reject(new Error('connection reset'))),
        })),
      }
      mocks.dbInsertChain.mockReturnValue(insertChain)

      await expect(
        createPair({ userId: 'user-1', anchor: { transactionId: 'tx-1' }, counterpartId: 'tx-2' }),
      ).rejects.toThrow('connection reset')
    })
  })

  // ── (g) Self-pair guard (CR-01) ───────────────────────────────────────────
  describe('self-pair rejection', () => {
    it('throws when transactionId === counterpartId, before any DB read or insert', async () => {
      const { db } = await import('@/lib/db')
      mocks.dbSelectChain.mockImplementation(() => makeSelectChain([]))

      await expect(
        createPair({ userId: 'user-1', anchor: { transactionId: 'tx-1' }, counterpartId: 'tx-1' }),
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
        createPair({ userId: 'user-1', anchor: { transactionId: 'tx-1' }, counterpartId: 'tx-2' }),
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
        createPair({ userId: 'user-1', anchor: { transactionId: 'tx-1' }, counterpartId: 'tx-2' }),
      ).rejects.toThrow('segno opposto')
    })

    it('does NOT insert a reimbursement when the sign check fails', async () => {
      const tx1 = makeTx('tx-1', '+30.00', new Date('2026-01-10'), 'user-1')
      const tx2 = makeTx('tx-2', '+30.00', new Date('2026-01-15'), 'user-1')
      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        return makeSelectChain([callCount === 1 ? tx1 : tx2])
      })
      const insertChain = makeInsertChain()
      mocks.dbInsertChain.mockReturnValue(insertChain)

      await expect(
        createPair({ userId: 'user-1', anchor: { transactionId: 'tx-1' }, counterpartId: 'tx-2' }),
      ).rejects.toThrow('segno opposto')
      expect(insertChain.values).not.toHaveBeenCalled()
    })
  })

  // ── (i) Atomicity — read-then-write runs inside db.transaction (CR-02) ────
  describe('atomic write path', () => {
    it('performs the ownership read and both inserts inside db.transaction', async () => {
      const { db } = await import('@/lib/db')
      const tx1 = makeTx('tx-1', '-100.00', new Date('2026-01-10'), 'user-1')
      const tx2 = makeTx('tx-2', '+50.00', new Date('2026-01-15'), 'user-1')
      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return makeSelectChain([tx1])
        if (callCount === 2) return makeSelectChain([tx2])
        if (callCount === 3) {
          return makeSelectChain([{ expenseId: 'exp-default', subCategoryId: null, title: 'Spesa X' }])
        }
        // call 4: create-or-append lookup — no existing reimbursement (CREATE path)
        return makeSelectChain([])
      })
      mocks.dbInsertChain.mockReturnValue(makeInsertChain([{ id: 1 }]))

      await createPair({ userId: 'user-1', anchor: { transactionId: 'tx-1' }, counterpartId: 'tx-2' })

      expect(db.transaction).toHaveBeenCalledTimes(1)
    })
  })
})

// ---------------------------------------------------------------------------
// createPair — refund cleanup on pairing (decision 2, UNRELATED to Phase 73's
// sign-based anchor change — kept as-is, just re-pointed to the new inserts)
// ---------------------------------------------------------------------------
// A transaction leg row as loaded by createPair (includes expenseId).
function makeLeg(
  id: string,
  amount: string,
  occurredAt: Date,
  expenseId: string | null,
  userId = 'user-1',
) {
  return { id, amount, occurredAt, userId, expenseId }
}

// Drive the sequential selects createPair performs: legA, legB, the anchor-expense
// join, the create-or-append existing-reimbursement lookup (Phase 75 Plan 02 — always
// "not found" here, since every scenario in this describe block simulates a first-ever
// CREATE), then (only on the cleanup path) the refund-expense title lookup used to
// compose the refund title. Promise.all preserves array order, so legA is call 1
// (transactionId) and legB is call 2 (counterpartId); anchor-expense is call 3, the
// create-or-append lookup is call 4, and the refund-expense title is call 5.
function mockPairSelects(
  legA: unknown,
  legB: unknown,
  anchorExpenseRow: unknown | null,
  refundExpenseTitle?: string,
) {
  let callCount = 0
  mocks.dbSelectChain.mockImplementation(() => {
    callCount += 1
    if (callCount === 1) return makeSelectChain([legA])
    if (callCount === 2) return makeSelectChain([legB])
    if (callCount === 3) return makeSelectChain(anchorExpenseRow ? [anchorExpenseRow] : [])
    if (callCount === 4) return makeSelectChain([])
    return makeSelectChain(refundExpenseTitle != null ? [{ title: refundExpenseTitle }] : [])
  })
}

describe('createPair — refund cleanup (decision 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.dbInsertChain.mockReturnValue(makeInsertChain([{ id: 1 }]))
    mocks.dbDeleteChain.mockReturnValue(makeDeleteChain())
    mocks.applyDetachCleanupTx.mockResolvedValue({
      newExpenseId: 'exp-refund',
      newExpenseTitle: 'Spesa X',
    })
  })

  it('inherits the spend subcategory onto the refund expense (1:1 inherit path)', async () => {
    // Spend -100.00 (anchor, categorized), refund +50.00 (own expense).
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
      anchor: { transactionId: 'tx-spend' },
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
    // The service surfaces the resolved refund + inherited subcategory for the UI.
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

    const insertedValues: unknown[] = []
    mocks.dbInsertChain.mockImplementation((table: unknown) => {
      const t = table as { title?: string; reimbursementId?: string }
      if (t.title === 'reimbursement.title') {
        return makeInsertChain([{ id: 1 }], (v) => insertedValues.push(v))
      }
      if (t.reimbursementId === 'reimbursementRefund.reimbursementId') {
        return makeInsertChain([{ id: 99 }], (v) => insertedValues.push(v))
      }
      return makeInsertChain([], (v) => insertedValues.push(v))
    })

    const result = await createPair({
      userId: 'user-1',
      anchor: { transactionId: 'tx-spend' },
      counterpartId: 'tx-refund',
    })

    expect(mocks.applyDetachCleanupTx).not.toHaveBeenCalled()
    // The reimbursement, refund, and frozen anchor-transaction row are all inserted
    // (Phase 75 D-08: the anchor-transaction insert is unconditional, independent of
    // whether refund cleanup runs).
    expect(insertedValues).toHaveLength(3)
    expect(result).toEqual({ secondaryTransactionId: 'tx-refund' })
  })

  it('skips cleanup when anchor and refund share the same expense', async () => {
    const spend = makeLeg('tx-spend', '-100.00', new Date('2026-01-10'), 'exp-shared')
    const refund = makeLeg('tx-refund', '+50.00', new Date('2026-01-15'), 'exp-shared')
    mockPairSelects(spend, refund, {
      expenseId: 'exp-shared',
      subCategoryId: 7,
      title: 'Spesa X',
    })

    await createPair({
      userId: 'user-1',
      anchor: { transactionId: 'tx-spend' },
      counterpartId: 'tx-refund',
    })

    expect(mocks.applyDetachCleanupTx).not.toHaveBeenCalled()
  })

  it('skips cleanup when the refund has no linked expense', async () => {
    const spend = makeLeg('tx-spend', '-100.00', new Date('2026-01-10'), 'exp-spend')
    const refund = makeLeg('tx-refund', '+50.00', new Date('2026-01-15'), null)
    mockPairSelects(spend, refund, {
      expenseId: 'exp-spend',
      subCategoryId: 7,
      title: 'Spesa X',
    })

    await createPair({
      userId: 'user-1',
      anchor: { transactionId: 'tx-spend' },
      counterpartId: 'tx-refund',
    })

    expect(mocks.applyDetachCleanupTx).not.toHaveBeenCalled()
  })

  it('targets the refund even when initiated from the refund (positive) leg', async () => {
    // User initiates from the refund (+50.00). The spend (-100.00) is still
    // resolved as anchor by sign; cleanup targets the refund.
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
      anchor: { transactionId: 'tx-refund' },
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

  it('anchors on the negative leg regardless of |amount| and cleans up the positive leg', async () => {
    // Equal |amount| no longer matters — sign alone resolves anchor vs refund.
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
      anchor: { transactionId: 'tx-early' },
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
      createPair({ userId: 'user-1', anchor: { transactionId: 'tx-1' }, counterpartId: 'tx-2' }),
    ).rejects.toThrow('segno opposto')
    expect(mocks.applyDetachCleanupTx).not.toHaveBeenCalled()
  })

  it('never calls cleanup when the ownership guard rejects', async () => {
    const spend = makeLeg('tx-1', '-100.00', new Date('2026-01-10'), 'exp-a', 'user-ATTACKER')
    const refund = makeLeg('tx-2', '+50.00', new Date('2026-01-15'), 'exp-b', 'user-1')
    mockPairSelects(spend, refund, null)

    await expect(
      createPair({ userId: 'user-1', anchor: { transactionId: 'tx-1' }, counterpartId: 'tx-2' }),
    ).rejects.toThrow('Non sei autorizzato')
    expect(mocks.applyDetachCleanupTx).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// deletePairByTransactionId — ownership validation + role-resolution delete
// (PAIR-03, Phase 73 T-73-10: repointed onto reimbursement/reimbursement_refund)
// ---------------------------------------------------------------------------
describe('deletePairByTransactionId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.dbInsertChain.mockReturnValue(makeInsertChain([{ id: 1 }]))
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

    // Unpair regression (decision 4): unlinking only removes the reimbursement
    // link — it never runs the detach cleanup, so the inherited subcategory +
    // synthetic hash persist.
    it('never invokes the detach cleanup when unlinking', async () => {
      const tx = makeTx('tx-1', '-100.00', new Date('2026-01-10'), 'user-1')
      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return makeSelectChain([tx])
        // refund-role lookup → not a refund
        return makeSelectChain([])
      })
      mocks.dbDeleteChain.mockReturnValue(makeDeleteChain())

      await deletePairByTransactionId({ userId: 'user-1', transactionId: 'tx-1' })

      expect(mocks.applyDetachCleanupTx).not.toHaveBeenCalled()
    })
  })

  // ── (f) Refund-side unlink: removes reimbursement_refund, cascades empty
  //        reimbursement (PAIR-03 unlink-restores-baseline) ─────────────────
  describe('unlink-restores-baseline — refund side', () => {
    it('removes the reimbursement_refund row when unlinking a refund transaction', async () => {
      const tx = makeTx('tx-refund', '+50.00', new Date('2026-01-10'), 'user-1', 'exp-refund')
      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return makeSelectChain([tx])
        // refund-role lookup: this transaction IS a refund of reimbursement 7
        if (callCount === 2) return makeSelectChain([{ id: 99, reimbursementId: 7 }])
        // remaining-refunds check: no other refunds left
        return makeSelectChain([])
      })

      const deletedTables: unknown[] = []
      const deletedWhereArgs: unknown[] = []
      mocks.dbDeleteChain.mockImplementation((table: unknown) => {
        deletedTables.push(table)
        return {
          where: vi.fn((arg: unknown) => {
            deletedWhereArgs.push(arg)
            return Promise.resolve([])
          }),
        }
      })

      await deletePairByTransactionId({ userId: 'user-1', transactionId: 'tx-refund' })

      // First delete: the reimbursement_refund row itself.
      expect((deletedTables[0] as { reimbursementId?: string }).reimbursementId).toBe(
        'reimbursementRefund.reimbursementId',
      )
      expect(deletedWhereArgs[0]).toMatchObject({ op: 'eq', right: 99 })
    })

    it('also removes the reimbursement row when the unlinked refund was the ONLY one', async () => {
      const tx = makeTx('tx-refund', '+50.00', new Date('2026-01-10'), 'user-1', 'exp-refund')
      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return makeSelectChain([tx])
        if (callCount === 2) return makeSelectChain([{ id: 99, reimbursementId: 7 }])
        // No remaining refunds → reimbursement row must also be deleted.
        return makeSelectChain([])
      })

      const deletedTables: unknown[] = []
      mocks.dbDeleteChain.mockImplementation((table: unknown) => {
        deletedTables.push(table)
        return { where: vi.fn(() => Promise.resolve([])) }
      })

      await deletePairByTransactionId({ userId: 'user-1', transactionId: 'tx-refund' })

      // Both the reimbursement_refund row AND the now-empty reimbursement row are deleted.
      expect(deletedTables).toHaveLength(2)
      expect((deletedTables[1] as { title?: string }).title).toBe('reimbursement.title')
    })

    it('does NOT remove the reimbursement row when other refunds remain', async () => {
      const tx = makeTx('tx-refund', '+50.00', new Date('2026-01-10'), 'user-1', 'exp-refund')
      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return makeSelectChain([tx])
        if (callCount === 2) return makeSelectChain([{ id: 99, reimbursementId: 7 }])
        // A sibling refund still exists.
        return makeSelectChain([{ id: 100 }])
      })

      const deletedTables: unknown[] = []
      mocks.dbDeleteChain.mockImplementation((table: unknown) => {
        deletedTables.push(table)
        return { where: vi.fn(() => Promise.resolve([])) }
      })

      await deletePairByTransactionId({ userId: 'user-1', transactionId: 'tx-refund' })

      // Only the reimbursement_refund row is deleted; the reimbursement stays.
      expect(deletedTables).toHaveLength(1)
    })

    it('performs the ownership read and delete inside db.transaction (CR-02)', async () => {
      const { db } = await import('@/lib/db')
      const tx = makeTx('tx-refund', '+50.00', new Date('2026-01-10'), 'user-1', 'exp-refund')
      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return makeSelectChain([tx])
        if (callCount === 2) return makeSelectChain([{ id: 99, reimbursementId: 7 }])
        return makeSelectChain([])
      })
      mocks.dbDeleteChain.mockReturnValue(makeDeleteChain())

      await deletePairByTransactionId({ userId: 'user-1', transactionId: 'tx-refund' })

      expect(db.transaction).toHaveBeenCalledTimes(1)
    })
  })

  // ── (g) Anchor-side unlink: removes the reimbursement row (cascades) ──────
  describe('unlink-restores-baseline — anchor side', () => {
    it('removes the reimbursement row when unlinking the anchor transaction', async () => {
      const tx = makeTx('tx-anchor', '-100.00', new Date('2026-01-10'), 'user-1', 'exp-spend')
      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return makeSelectChain([tx])
        // refund-role lookup: NOT a refund
        if (callCount === 2) return makeSelectChain([])
        // anchor-role lookup: this expense_id has a reimbursement
        return makeSelectChain([{ id: 7 }])
      })

      const deletedTables: unknown[] = []
      const deletedWhereArgs: unknown[] = []
      mocks.dbDeleteChain.mockImplementation((table: unknown) => {
        deletedTables.push(table)
        return {
          where: vi.fn((arg: unknown) => {
            deletedWhereArgs.push(arg)
            return Promise.resolve([])
          }),
        }
      })

      await deletePairByTransactionId({ userId: 'user-1', transactionId: 'tx-anchor' })

      expect(deletedTables).toHaveLength(1)
      expect((deletedTables[0] as { title?: string }).title).toBe('reimbursement.title')
      expect(deletedWhereArgs[0]).toMatchObject({ op: 'eq', right: 7 })
    })

    it('is a no-op when the transaction is neither a refund nor an anchor (already unpaired)', async () => {
      const tx = makeTx('tx-lonely', '-100.00', new Date('2026-01-10'), 'user-1', 'exp-lonely')
      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return makeSelectChain([tx])
        // Neither refund lookup nor anchor lookup finds anything.
        return makeSelectChain([])
      })

      const deletedTables: unknown[] = []
      mocks.dbDeleteChain.mockImplementation((table: unknown) => {
        deletedTables.push(table)
        return { where: vi.fn(() => Promise.resolve([])) }
      })

      await expect(
        deletePairByTransactionId({ userId: 'user-1', transactionId: 'tx-lonely' }),
      ).resolves.toBeUndefined()
      expect(deletedTables).toHaveLength(0)
    })

    it('succeeds when the user owns the transaction', async () => {
      const tx = makeTx('tx-anchor', '-100.00', new Date('2026-01-10'), 'user-1', 'exp-spend')
      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return makeSelectChain([tx])
        if (callCount === 2) return makeSelectChain([])
        return makeSelectChain([{ id: 7 }])
      })
      mocks.dbDeleteChain.mockReturnValue(makeDeleteChain())

      await expect(
        deletePairByTransactionId({ userId: 'user-1', transactionId: 'tx-anchor' }),
      ).resolves.toBeUndefined()
    })
  })
})
