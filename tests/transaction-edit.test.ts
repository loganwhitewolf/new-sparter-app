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
  reimbursement: {
    id: 'reimbursement.id',
    expenseId: 'reimbursement.expenseId',
    title: 'reimbursement.title',
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
  // Thenable chain: `.where()` alone must be awaitable (as Drizzle's real
  // query builder is), while `.limit()`/`.groupBy()` remain chainable steps
  // that also resolve to the same rows.
  const chain: Record<string, unknown> = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(rows)),
    groupBy: vi.fn(() => Promise.resolve(rows)),
    then: (resolve: (value: unknown[]) => void) => resolve(rows),
  }
  return chain
}

function makeUpdateChain() {
  const chain = {
    set: vi.fn((_payload: Record<string, unknown>) => chain),
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
      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        // 1: transaction row load; 2: reimbursement role lookup — unpaired (both null).
        return callCount === 1
          ? makeSelectChain([row])
          : makeSelectChain([{ asRefundReimbursementId: null, asAnchorReimbursementId: null }])
      })
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
        // 2: reimbursement role lookup — unpaired (both null).
        if (callCount === 2) {
          return makeSelectChain([{ asRefundReimbursementId: null, asAnchorReimbursementId: null }])
        }
        // 3: loadAggregatesForExpenses (grouped select)
        if (callCount === 3) {
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
        // 4: loadManualOrOverrideExpenseIds
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
      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        // 1: transaction row load; 2: reimbursement role lookup — unpaired (both null).
        return callCount === 1
          ? makeSelectChain([row])
          : makeSelectChain([{ asRefundReimbursementId: null, asAnchorReimbursementId: null }])
      })
      const updateChain = makeUpdateChain()
      mocks.dbUpdateChain.mockReturnValue(updateChain)

      await updateTransaction({ userId: 'user-1', transactionId: 'tx-1', amount: '-75.00' })

      expect(mocks.dbUpdateChain).toHaveBeenCalledTimes(1)
    })
  })

  // ── DET-03: pair guard (Phase 73, T-73-10: repointed onto reimbursement/reimbursement_refund) ──
  describe('DET-03 — pair guard', () => {
    it('blocks an amount edit that would make both pair legs the same sign', async () => {
      // tx-1 is the reimbursement ANCHOR (outflow -100.00) with one linked refund (+100.00).
      const row = makeTxRow({ id: 'tx-1', amount: '-100.00', expenseId: null })
      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        // 1: transaction row load
        if (callCount === 1) return makeSelectChain([row])
        // 2: reimbursement role lookup — this tx is the anchor of reimbursement id 1
        if (callCount === 2) {
          return makeSelectChain([{ asRefundReimbursementId: null, asAnchorReimbursementId: 1 }])
        }
        // 3: refunds-sum lookup — one linked refund summing to +100.00
        return makeSelectChain([{ refundsSum: '100.00' }])
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
          return makeSelectChain([{ asRefundReimbursementId: null, asAnchorReimbursementId: 1 }])
        }
        return makeSelectChain([{ refundsSum: '100.00' }])
      })
      const updateChain = makeUpdateChain()
      mocks.dbUpdateChain.mockReturnValue(updateChain)

      await expect(
        updateTransaction({ userId: 'user-1', transactionId: 'tx-1', amount: '-60.00' }),
      ).resolves.toEqual({ success: true })

      expect(mocks.dbUpdateChain).toHaveBeenCalled()
    })

    it('does not affect unpaired transactions and never runs counterpart pair logic beyond the role check', async () => {
      const row = makeTxRow({ id: 'tx-1', amount: '-100.00', expenseId: null })
      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return makeSelectChain([row])
        // 2: reimbursement role lookup — unpaired (both null)
        return makeSelectChain([{ asRefundReimbursementId: null, asAnchorReimbursementId: null }])
      })
      const updateChain = makeUpdateChain()
      mocks.dbUpdateChain.mockReturnValue(updateChain)

      await expect(
        updateTransaction({ userId: 'user-1', transactionId: 'tx-1', amount: '-120.00' }),
      ).resolves.toEqual({ success: true })

      expect(callCount).toBe(2)
    })

    it('blocks a refund-side amount edit against the anchor + other-refunds sum (N>1 generalization)', async () => {
      // tx-2 is a REFUND (+40.00) linked to a reimbursement whose anchor is -100.00 and whose
      // OTHER linked refund is +60.00 — otherSum = -100.00 + 60.00 = -40.00 (still negative).
      // Editing tx-2 to +40.00 stays opposite-sign (allowed); editing it to -10.00 (now negative,
      // matching otherSum's sign) must be blocked.
      const row = makeTxRow({ id: 'tx-2', amount: '+40.00', expenseId: null })
      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return makeSelectChain([row])
        // 2: reimbursement role lookup — tx-2 is a refund of reimbursement id 7
        if (callCount === 2) {
          return makeSelectChain([{ asRefundReimbursementId: 7, asAnchorReimbursementId: null }])
        }
        // 3: anchor amount + other-refunds sum lookup (excludes tx-2 itself)
        return makeSelectChain([{ anchorAmount: '-100.00', otherRefundsSum: '60.00' }])
      })
      const updateChain = makeUpdateChain()
      mocks.dbUpdateChain.mockReturnValue(updateChain)

      await expect(
        updateTransaction({ userId: 'user-1', transactionId: 'tx-2', amount: '-10.00' }),
      ).rejects.toThrow('Scollega prima il rimborso')

      expect(mocks.dbUpdateChain).not.toHaveBeenCalled()
    })

    it('imposes no guard on an anchor edit when the reimbursement has zero linked refunds', async () => {
      const row = makeTxRow({ id: 'tx-1', amount: '-100.00', expenseId: null })
      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return makeSelectChain([row])
        if (callCount === 2) {
          return makeSelectChain([{ asRefundReimbursementId: null, asAnchorReimbursementId: 1 }])
        }
        // 3: refunds-sum lookup — SUM over zero refunds is NULL
        return makeSelectChain([{ refundsSum: null }])
      })
      const updateChain = makeUpdateChain()
      mocks.dbUpdateChain.mockReturnValue(updateChain)

      await expect(
        updateTransaction({ userId: 'user-1', transactionId: 'tx-1', amount: '+50.00' }),
      ).resolves.toEqual({ success: true })

      expect(mocks.dbUpdateChain).toHaveBeenCalled()
    })

    // ── RMB-09 (Phase 74): N>1 message enrichment + zero-amount boundary ──────
    it('enriches the anchor-edit N>1 message with the blocking reimbursement title', async () => {
      const row = makeTxRow({ id: 'tx-1', amount: '-100.00', expenseId: null })
      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return makeSelectChain([row])
        if (callCount === 2) {
          return makeSelectChain([{ asRefundReimbursementId: null, asAnchorReimbursementId: 1 }])
        }
        // 3: refunds-sum lookup — 2 linked refunds summing to +100.00
        return makeSelectChain([
          { refundsSum: '100.00', reimbursementTitle: 'Cena di gruppo', refundCount: 2 },
        ])
      })
      const updateChain = makeUpdateChain()
      mocks.dbUpdateChain.mockReturnValue(updateChain)

      await expect(
        updateTransaction({ userId: 'user-1', transactionId: 'tx-1', amount: '+50.00' }),
      ).rejects.toThrow(/Scollega prima il rimborso.*Cena di gruppo/)

      expect(mocks.dbUpdateChain).not.toHaveBeenCalled()
    })

    it('enriches the refund-edit N>1 message with the blocking reimbursement title', async () => {
      const row = makeTxRow({ id: 'tx-2', amount: '+40.00', expenseId: null })
      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return makeSelectChain([row])
        if (callCount === 2) {
          return makeSelectChain([{ asRefundReimbursementId: 7, asAnchorReimbursementId: null }])
        }
        // 3: anchor amount + other-refunds sum lookup — reimbursement has 2 total refunds
        return makeSelectChain([
          {
            anchorAmount: '-100.00',
            otherRefundsSum: '60.00',
            reimbursementTitle: 'Cena di gruppo',
            refundCount: 2,
          },
        ])
      })
      const updateChain = makeUpdateChain()
      mocks.dbUpdateChain.mockReturnValue(updateChain)

      await expect(
        updateTransaction({ userId: 'user-1', transactionId: 'tx-2', amount: '-10.00' }),
      ).rejects.toThrow(/Scollega prima il rimborso.*Cena di gruppo/)

      expect(mocks.dbUpdateChain).not.toHaveBeenCalled()
    })

    it('blocks an edit that would bring the amount to exactly 0.00 (boundary)', async () => {
      // 0 is neither gt(0) nor lt(0), so the existing oppositeSign check already rejects it —
      // this proves the pre-existing logic covers the boundary with no code change needed.
      const row = makeTxRow({ id: 'tx-1', amount: '-100.00', expenseId: null })
      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return makeSelectChain([row])
        if (callCount === 2) {
          return makeSelectChain([{ asRefundReimbursementId: null, asAnchorReimbursementId: 1 }])
        }
        return makeSelectChain([{ refundsSum: '100.00' }])
      })
      const updateChain = makeUpdateChain()
      mocks.dbUpdateChain.mockReturnValue(updateChain)

      await expect(
        updateTransaction({ userId: 'user-1', transactionId: 'tx-1', amount: '0.00' }),
      ).rejects.toThrow('Scollega prima il rimborso')

      expect(mocks.dbUpdateChain).not.toHaveBeenCalled()
    })
  })

  // ── AMORT-07 (Phase 78, D-04): amortization edit guard ─────────────────────
  describe('AMORT-07 — amortization edit guard', () => {
    it('blocks an amount edit when the transaction has an OPEN amortization plan', async () => {
      const row = makeTxRow({ amortizationPlanId: 'plan-1' })
      mocks.dbSelectChain.mockImplementation(() => makeSelectChain([row]))
      const updateChain = makeUpdateChain()
      mocks.dbUpdateChain.mockReturnValue(updateChain)

      await expect(
        updateTransaction({ userId: 'user-1', transactionId: 'tx-1', amount: '-75.00' }),
      ).rejects.toThrow('Rimuovi spesa dilazionata per modificare l\'importo o la data della transazione.')

      expect(mocks.dbUpdateChain).not.toHaveBeenCalled()
    })

    it('blocks a date-only edit (no amount) when the transaction has an OPEN amortization plan', async () => {
      // Proves the guard is NOT nested inside the amount-only pair-guard branch —
      // today's pair-guard only ever ran for amount edits, so this is new coverage.
      const row = makeTxRow({ amortizationPlanId: 'plan-1' })
      mocks.dbSelectChain.mockImplementation(() => makeSelectChain([row]))
      const updateChain = makeUpdateChain()
      mocks.dbUpdateChain.mockReturnValue(updateChain)

      await expect(
        updateTransaction({
          userId: 'user-1',
          transactionId: 'tx-1',
          occurredAt: new Date('2026-02-01'),
        }),
      ).rejects.toThrow('Rimuovi spesa dilazionata per modificare l\'importo o la data della transazione.')

      expect(mocks.dbUpdateChain).not.toHaveBeenCalled()
    })

    it('blocks a combined amount + date edit once with the same message when the plan is OPEN', async () => {
      const row = makeTxRow({ amortizationPlanId: 'plan-1' })
      mocks.dbSelectChain.mockImplementation(() => makeSelectChain([row]))
      const updateChain = makeUpdateChain()
      mocks.dbUpdateChain.mockReturnValue(updateChain)

      await expect(
        updateTransaction({
          userId: 'user-1',
          transactionId: 'tx-1',
          amount: '-75.00',
          occurredAt: new Date('2026-02-01'),
        }),
      ).rejects.toThrow('Rimuovi spesa dilazionata per modificare l\'importo o la data della transazione.')

      expect(mocks.dbUpdateChain).not.toHaveBeenCalled()
    })

    it('allows a customTitle-only edit on a transaction with an OPEN amortization plan', async () => {
      const row = makeTxRow({ amortizationPlanId: 'plan-1' })
      mocks.dbSelectChain.mockImplementation(() => makeSelectChain([row]))
      const updateChain = makeUpdateChain()
      mocks.dbUpdateChain.mockReturnValue(updateChain)

      await expect(
        updateTransaction({ userId: 'user-1', transactionId: 'tx-1', customTitle: 'Nuovo titolo' }),
      ).resolves.toEqual({ success: true })

      expect(updateChain.set).toHaveBeenCalledTimes(1)
      const setPayload = updateChain.set.mock.calls[0][0] as Record<string, unknown>
      expect(setPayload.customTitle).toBe('Nuovo titolo')
      expect(setPayload).not.toHaveProperty('amount')
      expect(setPayload).not.toHaveProperty('occurredAt')
    })

    it('allows an amount edit when the amortization plan is CLOSED (guard scoped to status=open only)', async () => {
      // The correlated subquery filters on status='open', so a CLOSED plan's row never
      // surfaces amortizationPlanId — same shape as "no plan at all".
      const row = makeTxRow({ amortizationPlanId: null, expenseId: null })
      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        return callCount === 1
          ? makeSelectChain([row])
          : makeSelectChain([{ asRefundReimbursementId: null, asAnchorReimbursementId: null }])
      })
      const updateChain = makeUpdateChain()
      mocks.dbUpdateChain.mockReturnValue(updateChain)

      await expect(
        updateTransaction({ userId: 'user-1', transactionId: 'tx-1', amount: '-75.00' }),
      ).resolves.toEqual({ success: true })

      expect(updateChain.set).toHaveBeenCalledTimes(1)
    })

    it('allows an amount edit when the transaction has no amortization plan at all', async () => {
      const row = makeTxRow({ amortizationPlanId: undefined, expenseId: null })
      let callCount = 0
      mocks.dbSelectChain.mockImplementation(() => {
        callCount += 1
        return callCount === 1
          ? makeSelectChain([row])
          : makeSelectChain([{ asRefundReimbursementId: null, asAnchorReimbursementId: null }])
      })
      const updateChain = makeUpdateChain()
      mocks.dbUpdateChain.mockReturnValue(updateChain)

      await expect(
        updateTransaction({ userId: 'user-1', transactionId: 'tx-1', amount: '-75.00' }),
      ).resolves.toEqual({ success: true })

      expect(updateChain.set).toHaveBeenCalledTimes(1)
    })
  })

  // ── AMORT-07 (Phase 78, Task 2): thrown error shape reaches the caller verbatim ──
  describe('AMORT-07 — error shape parity with the pair-guard message', () => {
    it('throws a plain Error carrying the exact guard string, not a differently-shaped error object', async () => {
      const row = makeTxRow({ amortizationPlanId: 'plan-1' })
      mocks.dbSelectChain.mockImplementation(() => makeSelectChain([row]))
      const updateChain = makeUpdateChain()
      mocks.dbUpdateChain.mockReturnValue(updateChain)

      try {
        await updateTransaction({ userId: 'user-1', transactionId: 'tx-1', amount: '-75.00' })
        throw new Error('updateTransaction should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe(
          'Rimuovi spesa dilazionata per modificare l\'importo o la data della transazione.',
        )
        // Plain Error (same shape as the pre-existing pair-guard throw) — no custom
        // error class, no extra fields — so lib/actions/transaction-edit.ts's
        // `{ error: (error as Error).message }` catch block needs no change.
        expect(Object.getPrototypeOf(error)).toBe(Error.prototype)
      }

      expect(mocks.dbUpdateChain).not.toHaveBeenCalled()
    })
  })
})
