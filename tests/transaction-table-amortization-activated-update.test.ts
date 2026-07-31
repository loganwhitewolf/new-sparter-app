/**
 * Plain unit tests (no rendering, no React) for `applyAmortizationActivatedUpdate` — the pure
 * helper backing "Dilaziona"'s optimistic client-state update. Regression: the old inline
 * `markTransactionAmortized` cleared expenseStatus/category names and never set
 * amortizationPlanId, so a categorized outflow looked uncategorized and the menu still
 * offered "Dilaziona" until a full page reload.
 */
import { describe, expect, it } from 'vitest'
import { applyAmortizationActivatedUpdate } from '@/components/transactions/transaction-table'
import type { TransactionListRow } from '@/lib/dal/transactions'

function makeTransaction(overrides: Partial<TransactionListRow> = {}): TransactionListRow {
  return {
    id: 'aabbccdd-0000-4000-8000-aabbccddeeff',
    description: 'PAGAMENTO POS MEDIAWORLD',
    customTitle: null,
    amount: '-1200.00',
    currency: 'EUR',
    occurredAt: new Date('2026-06-01'),
    rowIndex: 0,
    expenseId: 'expense-shared',
    expenseTitle: 'Mediaworld',
    expenseTransactionCount: 3,
    expenseStatus: '3',
    expenseCategoryName: 'Tecnologia',
    expenseSubCategoryName: 'Elettronica',
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

describe('applyAmortizationActivatedUpdate', () => {
  it('points the row at the Standalone Expense, opens the plan, and preserves category fields', () => {
    const target = makeTransaction({ id: 'target' })

    const result = applyAmortizationActivatedUpdate([target], 'target', {
      id: 'expense-standalone',
      planId: 'plan-1',
    })

    const updated = result.find((t) => t.id === 'target')!
    expect(updated.expenseId).toBe('expense-standalone')
    expect(updated.expenseTransactionCount).toBe(1)
    expect(updated.amortizationPlanId).toBe('plan-1')
    expect(updated.amortizationPlanStatus).toBe('open')
    expect(updated.expenseStatus).toBe('3')
    expect(updated.expenseCategoryName).toBe('Tecnologia')
    expect(updated.expenseSubCategoryName).toBe('Elettronica')
  })

  it('leaves an uncategorized source uncategorized (does not invent status 3)', () => {
    const target = makeTransaction({
      id: 'target',
      expenseStatus: '1',
      expenseCategoryName: null,
      expenseSubCategoryName: null,
    })

    const result = applyAmortizationActivatedUpdate([target], 'target', {
      id: 'expense-standalone',
      planId: 'plan-2',
    })

    const updated = result.find((t) => t.id === 'target')!
    expect(updated.expenseStatus).toBe('1')
    expect(updated.expenseCategoryName).toBeNull()
    expect(updated.expenseSubCategoryName).toBeNull()
    expect(updated.amortizationPlanId).toBe('plan-2')
  })

  it('leaves an unrelated row in the list unchanged', () => {
    const target = makeTransaction({ id: 'target' })
    const unrelated = makeTransaction({
      id: 'unrelated',
      expenseId: 'expense-other',
      amortizationPlanId: null,
      expenseCategoryName: 'Casa',
      expenseSubCategoryName: 'Affitto',
    })

    const result = applyAmortizationActivatedUpdate([target, unrelated], 'target', {
      id: 'expense-standalone',
      planId: 'plan-1',
    })

    const updatedUnrelated = result.find((t) => t.id === 'unrelated')!
    expect(updatedUnrelated.expenseId).toBe('expense-other')
    expect(updatedUnrelated.amortizationPlanId).toBeNull()
    expect(updatedUnrelated.expenseCategoryName).toBe('Casa')
    expect(updatedUnrelated.expenseSubCategoryName).toBe('Affitto')
  })
})
