import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any module imports
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  dbSelectChain: vi.fn(),
  dbUpdateChain: vi.fn(),
}))

vi.mock('server-only', () => ({}))

// Mock schema so module imports resolve without real Drizzle types.
// String-keyed column stand-ins mirror tests/transaction-pairs-service.test.ts.
vi.mock('@/lib/db/schema', () => ({
  transaction: {
    id: 'transaction.id',
    userId: 'transaction.userId',
    amount: 'transaction.amount',
    occurredAt: 'transaction.occurredAt',
    expenseId: 'transaction.expenseId',
    transactionHash: 'transaction.transactionHash',
    descriptionHash: 'transaction.descriptionHash',
    description: 'transaction.description',
    customTitle: 'transaction.customTitle',
  },
  transactionPair: {
    transactionAId: 'transactionPair.transactionAId',
    transactionBId: 'transactionPair.transactionBId',
  },
  expense: {
    id: 'expense.id',
    userId: 'expense.userId',
    totalAmount: 'expense.totalAmount',
    transactionCount: 'expense.transactionCount',
    firstTransactionAt: 'expense.firstTransactionAt',
    lastTransactionAt: 'expense.lastTransactionAt',
    importedFromFileId: 'expense.importedFromFileId',
    updatedAt: 'expense.updatedAt',
  },
  expenseClassificationHistory: {
    userId: 'expenseClassificationHistory.userId',
    expenseId: 'expenseClassificationHistory.expenseId',
    source: 'expenseClassificationHistory.source',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
  and: (...args: unknown[]) => ({ op: 'and', args }),
  or: (...args: unknown[]) => ({ op: 'or', args }),
  inArray: (a: unknown, b: unknown) => ({ op: 'inArray', a, b }),
  sql: (...args: unknown[]) => ({ op: 'sql', args }),
}))

// ---------------------------------------------------------------------------
// db mock — controllable select/update chain.
// db.transaction(cb) invokes cb with the same db object as the tx handle, so
// the same select/update chain mocks work unchanged inside the transaction
// (mirrors tests/transaction-pairs-service.test.ts).
// ---------------------------------------------------------------------------
function makeSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(rows)),
    groupBy: vi.fn(() => Promise.resolve(rows)),
  }
  return chain
}

function makeUpdateChain() {
  const chain = {
    set: vi.fn(() => chain),
    where: vi.fn(() => Promise.resolve([])),
  }
  return chain
}

vi.mock('@/lib/db', () => {
  const db: Record<string, unknown> = {
    select: vi.fn(() => mocks.dbSelectChain()),
    update: vi.fn(() => mocks.dbUpdateChain()),
  }
  db.transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(db))
  return { db }
})

// ---------------------------------------------------------------------------
// Import module under test AFTER all vi.mock calls (RED until Task 2 lands).
// ---------------------------------------------------------------------------
const { updateTransaction } = await import('@/lib/services/transaction-edit')

function makeTxRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tx-1',
    userId: 'user-1',
    amount: '-50.00',
    occurredAt: new Date('2026-01-10'),
    customTitle: null,
    expenseId: null,
    transactionHash: 'h1',
    descriptionHash: 'd1',
    description: 'ORIG DESC',
    ...overrides,
  }
}

describe('updateTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── DET-01: amount / occurredAt / customTitle edit, hashes/description frozen ──
  describe('DET-01 — amount, date, title edits', () => {
    it('updates amount without touching transactionHash/descriptionHash/description', async () => {
      const row = makeTxRow()
      mocks.dbSelectChain.mockImplementation(() => makeSelectChain([row]))
      const updateChain = makeUpdateChain()
      mocks.dbUpdateChain.mockReturnValue(updateChain)

      await updateTransaction({ userId: 'user-1', transactionId: 'tx-1', amount: '-75.00' })

      expect(updateChain.set).toHaveBeenCalledTimes(1)
      const setPayload = updateChain.set.mock.calls[0][0] as Record<string, unknown>
      expect(setPayload.amount).toBe('-75.00')
      expect(setPayload).not.toHaveProperty('transactionHash')
      expect(setPayload).not.toHaveProperty('descriptionHash')
      expect(setPayload).not.toHaveProperty('description')
    })

    it('updates occurredAt and customTitle together, omitting amount/hash/description keys', async () => {
      const row = makeTxRow()
      mocks.dbSelectChain.mockImplementation(() => makeSelectChain([row]))
      const updateChain = makeUpdateChain()
      mocks.dbUpdateChain.mockReturnValue(updateChain)

      const newOccurredAt = new Date('2026-02-01')
      await updateTransaction({
        userId: 'user-1',
        transactionId: 'tx-1',
        occurredAt: newOccurredAt,
        customTitle: 'Nuovo titolo',
      })

      expect(updateChain.set).toHaveBeenCalledTimes(1)
      const setPayload = updateChain.set.mock.calls[0][0] as Record<string, unknown>
      expect(setPayload.occurredAt).toBe(newOccurredAt)
      expect(setPayload.customTitle).toBe('Nuovo titolo')
      expect(setPayload).not.toHaveProperty('amount')
      expect(setPayload).not.toHaveProperty('transactionHash')
      expect(setPayload).not.toHaveProperty('descriptionHash')
      expect(setPayload).not.toHaveProperty('description')
    })

    it('rejects when the transaction belongs to a different user and never updates', async () => {
      const row = makeTxRow({ userId: 'user-OTHER' })
      // Ownership-scoped SELECT (and(eq(id), eq(userId))) returns no row for this user.
      mocks.dbSelectChain.mockImplementation(() => makeSelectChain([]))
      const updateChain = makeUpdateChain()
      mocks.dbUpdateChain.mockReturnValue(updateChain)

      await expect(
        updateTransaction({ userId: 'user-1', transactionId: 'tx-1', amount: '-10.00' }),
      ).rejects.toThrow()

      expect(updateChain.where).not.toHaveBeenCalled()
    })

    it('rejects with "Transazione non trovata" when no row exists', async () => {
      mocks.dbSelectChain.mockImplementation(() => makeSelectChain([]))

      await expect(
        updateTransaction({ userId: 'user-1', transactionId: 'tx-missing', amount: '-10.00' }),
      ).rejects.toThrow('Transazione non trovata')
    })
  })

  // ── DET-02: linked-expense reconciliation ──────────────────────────────────
  describe('DET-02 — expense reconciliation', () => {
    it('reconciles the linked expense aggregates after an amount edit', async () => {
      const row = makeTxRow({ expenseId: 'exp-1' })
      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        // 1: transaction row load
        if (callCount === 1) return makeSelectChain([row])
        // 2: loadAggregatesForExpenses (grouped select)
        if (callCount === 2) {
          return makeSelectChain([
            {
              expenseId: 'exp-1',
              totalAmount: '-75.00',
              transactionCount: 1,
              firstTransactionAt: new Date('2026-01-10'),
              lastTransactionAt: new Date('2026-01-10'),
            },
          ])
        }
        // 3: loadManualOrOverrideExpenseIds
        return makeSelectChain([])
      })

      const txUpdateChain = makeUpdateChain()
      const expenseUpdateChain = makeUpdateChain()
      let updateCallCount = 0
      mocks.dbUpdateChain.mockImplementation(() => {
        updateCallCount += 1
        return updateCallCount === 1 ? txUpdateChain : expenseUpdateChain
      })

      await updateTransaction({ userId: 'user-1', transactionId: 'tx-1', amount: '-75.00' })

      expect(expenseUpdateChain.set).toHaveBeenCalledTimes(1)
      const expenseSetPayload = expenseUpdateChain.set.mock.calls[0][0] as Record<string, unknown>
      expect(expenseSetPayload.totalAmount).toBe('-75.00')
      expect(expenseSetPayload.transactionCount).toBe(1)
    })

    it('does not touch expense when no expense is linked', async () => {
      const row = makeTxRow({ expenseId: null })
      mocks.dbSelectChain.mockImplementation(() => makeSelectChain([row]))
      const updateChain = makeUpdateChain()
      mocks.dbUpdateChain.mockReturnValue(updateChain)

      await updateTransaction({ userId: 'user-1', transactionId: 'tx-1', amount: '-75.00' })

      expect(mocks.dbUpdateChain).toHaveBeenCalledTimes(1)
    })
  })

  // ── DET-03: pair guard ──────────────────────────────────────────────────────
  describe('DET-03 — pair guard', () => {
    it('blocks an amount edit that would make both pair legs the same sign', async () => {
      const row = makeTxRow({ id: 'tx-1', amount: '-100.00', expenseId: null })
      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        // 1: transaction row load
        if (callCount === 1) return makeSelectChain([row])
        // 2: transactionPair lookup — this tx is paired
        if (callCount === 2) {
          return makeSelectChain([{ transactionAId: 'tx-1', transactionBId: 'tx-2' }])
        }
        // 3: counterpart transaction amount lookup
        return makeSelectChain([{ amount: '+100.00' }])
      })
      const updateChain = makeUpdateChain()
      mocks.dbUpdateChain.mockReturnValue(updateChain)

      await expect(
        updateTransaction({ userId: 'user-1', transactionId: 'tx-1', amount: '+50.00' }),
      ).rejects.toThrow('Scollega prima il rimborso')

      expect(mocks.dbUpdateChain).not.toHaveBeenCalled()
    })

    it('allows a coherent amount edit that preserves the opposite sign', async () => {
      const row = makeTxRow({ id: 'tx-1', amount: '-100.00', expenseId: null })
      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return makeSelectChain([row])
        if (callCount === 2) {
          return makeSelectChain([{ transactionAId: 'tx-1', transactionBId: 'tx-2' }])
        }
        return makeSelectChain([{ amount: '+100.00' }])
      })
      const updateChain = makeUpdateChain()
      mocks.dbUpdateChain.mockReturnValue(updateChain)

      await expect(
        updateTransaction({ userId: 'user-1', transactionId: 'tx-1', amount: '-60.00' }),
      ).resolves.toEqual({ success: true })

      expect(mocks.dbUpdateChain).toHaveBeenCalled()
    })

    it('does not affect unpaired transactions and never runs counterpart pair logic beyond the empty check', async () => {
      const row = makeTxRow({ id: 'tx-1', amount: '-100.00', expenseId: null })
      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return makeSelectChain([row])
        // 2: transactionPair lookup — no pair found
        return makeSelectChain([])
      })
      const updateChain = makeUpdateChain()
      mocks.dbUpdateChain.mockReturnValue(updateChain)

      await expect(
        updateTransaction({ userId: 'user-1', transactionId: 'tx-1', amount: '-120.00' }),
      ).resolves.toEqual({ success: true })

      expect(callCount).toBe(2)
    })
  })
})
