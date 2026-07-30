/**
 * Plain unit tests (no rendering, no React) for `applyAmortizationRemovedUpdate` — the pure
 * helper backing "Rimuovi ammortamento"'s optimistic client-state update (Bug 2, quick task
 * 260730-m2x). Regression: `markAmortizationRemoved` used to clear ONLY `amortizationPlanId`,
 * leaving `reimbursementId` stale so `computeAmortizationEligibility` kept returning
 * `reason: 'reimbursement'` until a full page reload.
 */
import { describe, expect, it } from 'vitest'
import { applyAmortizationRemovedUpdate } from '@/components/transactions/transaction-table'
import type { TransactionListRow } from '@/lib/dal/transactions'

function makeTransaction(overrides: Partial<TransactionListRow> = {}): TransactionListRow {
  return {
    id: 'aabbccdd-0000-4000-8000-aabbccddeeff',
    description: 'PAGAMENTO POS ESSELUNGA',
    customTitle: null,
    amount: '-25.50',
    currency: 'EUR',
    occurredAt: new Date('2026-06-01'),
    rowIndex: 0,
    expenseId: null,
    expenseTitle: null,
    expenseTransactionCount: null,
    expenseStatus: null,
    expenseCategoryName: null,
    expenseSubCategoryName: null,
    fileId: null,
    fileName: null,
    importedAt: null,
    platformId: null,
    platformName: null,
    platformSlug: null,
    categoryType: null,
    groupId: null,
    groupTitle: null,
    pairedWithId: null,
    pairedNetAmount: null,
    pairedAmount: null,
    pairedDescription: null,
    pairedOccurredAt: null,
    reimbursementId: null,
    amortizationPlanId: null,
    amortizationPlanStatus: null,
    ...overrides,
  }
}

describe('applyAmortizationRemovedUpdate (Bug 2 — 260730-m2x)', () => {
  it('clears amortizationPlanId AND reimbursementId on the target row', () => {
    const target = makeTransaction({
      id: 'target',
      amortizationPlanId: 'plan-1',
      amortizationPlanStatus: 'open',
      reimbursementId: 42,
    })

    const result = applyAmortizationRemovedUpdate([target], 'target')

    const updated = result.find((t) => t.id === 'target')!
    expect(updated.amortizationPlanId).toBeNull()
    expect(updated.reimbursementId).toBeNull()
  })

  it("clears the counterpart row's pairing fields (pairedWithId/pairedNetAmount/pairedDescription/pairedOccurredAt/reimbursementId), leaving its own amortizationPlanId untouched", () => {
    const target = makeTransaction({
      id: 'target',
      amortizationPlanId: 'plan-1',
      amortizationPlanStatus: 'open',
      reimbursementId: 42,
      pairedWithId: 'counterpart',
      pairedNetAmount: '-20.00',
      pairedDescription: 'Rimborso Esselunga',
      pairedOccurredAt: new Date('2026-06-05'),
    })
    const counterpart = makeTransaction({
      id: 'counterpart',
      amount: '5.50',
      amortizationPlanId: null,
      reimbursementId: 42,
      pairedWithId: 'target',
      pairedNetAmount: '-20.00',
      pairedDescription: 'PAGAMENTO POS ESSELUNGA',
      pairedOccurredAt: new Date('2026-06-01'),
    })

    const result = applyAmortizationRemovedUpdate([target, counterpart], 'target')

    const updatedCounterpart = result.find((t) => t.id === 'counterpart')!
    expect(updatedCounterpart.pairedWithId).toBeNull()
    expect(updatedCounterpart.pairedNetAmount).toBeNull()
    expect(updatedCounterpart.pairedDescription).toBeNull()
    expect(updatedCounterpart.pairedOccurredAt).toBeNull()
    expect(updatedCounterpart.reimbursementId).toBeNull()
    // The counterpart is a separate transaction — it never had an amortization plan of its own.
    expect(updatedCounterpart.amortizationPlanId).toBeNull()
  })

  it('leaves an unrelated third row in the list unchanged', () => {
    const target = makeTransaction({ id: 'target', amortizationPlanId: 'plan-1', reimbursementId: 42 })
    const counterpart = makeTransaction({ id: 'counterpart', pairedWithId: 'target', reimbursementId: 42 })
    const unrelated = makeTransaction({
      id: 'unrelated',
      amortizationPlanId: 'plan-2',
      amortizationPlanStatus: 'open',
      reimbursementId: 7,
      pairedWithId: 'someone-else',
    })

    const result = applyAmortizationRemovedUpdate([target, counterpart, unrelated], 'target')

    const updatedUnrelated = result.find((t) => t.id === 'unrelated')!
    expect(updatedUnrelated.amortizationPlanId).toBe('plan-2')
    expect(updatedUnrelated.amortizationPlanStatus).toBe('open')
    expect(updatedUnrelated.reimbursementId).toBe(7)
    expect(updatedUnrelated.pairedWithId).toBe('someone-else')
  })
})
