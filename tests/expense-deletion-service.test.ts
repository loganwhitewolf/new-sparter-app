import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  select: vi.fn(),
  delete: vi.fn(),
  cleanupFinanceLinksForExpenses: vi.fn(),
  deleteEmptyReimbursementsForUser: vi.fn(),
}))

vi.mock('server-only', () => ({}))

// PR #66 routes expense deletion through cleanupFinanceLinksForExpenses, which drops amortization
// plans and reimbursements tied to the expense or its transactions. Stubbed here rather than
// teaching this file's minimal schema mock the whole reimbursement/amortization surface — the
// subject of these tests is expense deletion's own ordering and return shape. The call itself is
// asserted below so the wiring cannot silently disappear.
vi.mock('@/lib/services/linked-finance-cleanup', () => ({
  cleanupFinanceLinksForExpenses: mocks.cleanupFinanceLinksForExpenses,
  deleteEmptyReimbursementsForUser: mocks.deleteEmptyReimbursementsForUser,
}))

vi.mock('@/lib/db', () => ({
  db: {
    transaction: mocks.transaction,
  },
}))

vi.mock('@/lib/db/schema', () => ({
  expense: {
    id: 'expense.id',
    userId: 'expense.userId',
  },
  expenseGroupMembership: {
    expenseId: 'expenseGroupMembership.expenseId',
  },
  transaction: {
    id: 'transaction.id',
    userId: 'transaction.userId',
    expenseId: 'transaction.expenseId',
  },
}))

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args) => ({ kind: 'and', args })),
  eq: vi.fn((a, b) => ({ kind: 'eq', a, b })),
  inArray: vi.fn((a, b) => ({ kind: 'inArray', a, b })),
}))

import { deleteExpensesWithOptions } from '@/lib/services/expense-deletion'

function makeSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  }
  mocks.select.mockReturnValueOnce(chain)
  return chain
}

function makeDeleteChain() {
  const chain = {
    where: vi.fn().mockResolvedValue(undefined),
  }
  mocks.delete.mockReturnValueOnce(chain)
  return chain
}

describe('deleteExpensesWithOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        select: mocks.select,
        delete: mocks.delete,
      }),
    )
  })

  it('deletes only expenses when deleteLinkedTransactions is false', async () => {
    makeSelectChain([{ id: 'expense-1' }])
    makeSelectChain([]) // CR-01: no grouped members among the target ids
    // PR #66: the linked-transaction lookup is now UNCONDITIONAL — plans/reimbursements must be
    // cleaned up even when the transactions themselves are kept — so it runs on this path too.
    makeSelectChain([{ id: 'txn-kept' }])
    makeDeleteChain()

    const result = await deleteExpensesWithOptions({
      userId: 'user-1',
      expenseIds: ['expense-1'],
      deleteLinkedTransactions: false,
    })

    expect(result).toEqual({
      deletedExpenseIds: ['expense-1'],
      deletedTransactionIds: [],
    })
    expect(mocks.select).toHaveBeenCalledTimes(3)
    // Only the expenses are deleted — the linked transaction survives...
    expect(mocks.delete).toHaveBeenCalledTimes(1)
    // ...but its finance links are still cleaned up (that is the point of the unconditional lookup).
    expect(mocks.cleanupFinanceLinksForExpenses).toHaveBeenCalledWith(expect.anything(), {
      userId: 'user-1',
      expenseIds: ['expense-1'],
      linkedTransactionIds: ['txn-kept'],
    })
  })

  it('deletes linked transactions before expenses when deleteLinkedTransactions is true', async () => {
    makeSelectChain([{ id: 'expense-1' }])
    makeSelectChain([]) // CR-01: no grouped members among the target ids
    makeSelectChain([{ id: 'txn-1' }, { id: 'txn-2' }])
    makeDeleteChain()
    makeDeleteChain()

    const result = await deleteExpensesWithOptions({
      userId: 'user-1',
      expenseIds: ['expense-1'],
      deleteLinkedTransactions: true,
    })

    expect(result).toEqual({
      deletedExpenseIds: ['expense-1'],
      deletedTransactionIds: ['txn-1', 'txn-2'],
    })
    expect(mocks.select).toHaveBeenCalledTimes(3)
    expect(mocks.delete).toHaveBeenCalledTimes(2)
  })

  // CR-01: deleting a grouped member expense must be rejected — it would otherwise
  // silently cascade-delete the expense_group_membership row (ON DELETE CASCADE),
  // shrinking or orphaning the group with zero warning to the user.
  it('rejects deleting an expense that is a group member, without deleting anything', async () => {
    makeSelectChain([{ id: 'expense-1' }])
    makeSelectChain([{ expenseId: 'expense-1' }]) // grouped member found

    await expect(
      deleteExpensesWithOptions({
        userId: 'user-1',
        expenseIds: ['expense-1'],
        deleteLinkedTransactions: false,
      }),
    ).rejects.toThrow('Una o più spese fanno parte di un gruppo: rimuovile dal gruppo prima di eliminarle.')

    expect(mocks.delete).not.toHaveBeenCalled()
  })
})
