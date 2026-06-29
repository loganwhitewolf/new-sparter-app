import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  reconcileExpensesAfterTransactionRemoval: vi.fn(),
  dbSelectChain: vi.fn(),
  dbInsertChain: vi.fn(),
  dbUpdateChain: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/db/schema', () => ({
  expense: {
    id: 'expense.id',
    userId: 'expense.userId',
    title: 'expense.title',
    descriptionHash: 'expense.descriptionHash',
    subCategoryId: 'expense.subCategoryId',
    totalAmount: 'expense.totalAmount',
    transactionCount: 'expense.transactionCount',
    importedFromFileId: 'expense.importedFromFileId',
    firstTransactionAt: 'expense.firstTransactionAt',
    lastTransactionAt: 'expense.lastTransactionAt',
    status: 'expense.status',
  },
  transaction: {
    id: 'transaction.id',
    userId: 'transaction.userId',
    amount: 'transaction.amount',
    occurredAt: 'transaction.occurredAt',
    expenseId: 'transaction.expenseId',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
  and: (...args: unknown[]) => ({ op: 'and', args }),
}))

vi.mock('@/lib/services/expense-reconciliation', () => ({
  reconcileExpensesAfterTransactionRemoval: mocks.reconcileExpensesAfterTransactionRemoval,
}))

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
  return {
    values: vi.fn(() => Promise.resolve([])),
  }
}

function makeUpdateChain() {
  return {
    set: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve([])),
    })),
  }
}

vi.mock('@/lib/db', () => {
  const db: Record<string, unknown> = {
    select: vi.fn(() => mocks.dbSelectChain()),
    insert: vi.fn(() => mocks.dbInsertChain()),
    update: vi.fn(() => mocks.dbUpdateChain()),
  }
  db.transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(db))
  return { db }
})

const USER_ID = 'user-test-1'
const TX_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SOURCE_EXPENSE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const OCCURRED_AT = new Date('2026-01-15T12:00:00.000Z')

const {
  DetachTransactionError,
  detachTransactionToDedicatedExpense,
} = await import('@/lib/services/transaction-detach')

describe('detachTransactionToDedicatedExpense', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.dbSelectChain.mockReturnValue(makeSelectChain([]))
    mocks.dbInsertChain.mockReturnValue(makeInsertChain())
    mocks.dbUpdateChain.mockReturnValue(makeUpdateChain())
    mocks.reconcileExpensesAfterTransactionRemoval.mockResolvedValue(undefined)
    vi.stubGlobal('crypto', {
      randomUUID: () => 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    })
  })

  function makeLoadedRow(overrides: Record<string, unknown> = {}) {
    return {
      transactionId: TX_ID,
      transactionUserId: USER_ID,
      transactionAmount: '-25.50',
      transactionOccurredAt: OCCURRED_AT,
      expenseId: SOURCE_EXPENSE_ID,
      expenseUserId: USER_ID,
      expenseTransactionCount: 3,
      ...overrides,
    }
  }

  it('moves transaction to a new expense with synthetic descriptionHash and reconciles source', async () => {
    mocks.dbSelectChain.mockReturnValue(makeSelectChain([makeLoadedRow()]))
    const insertValues = vi.fn(() => Promise.resolve([]))
    mocks.dbInsertChain.mockReturnValue({ values: insertValues })
    const updateSet = vi.fn(() => ({
      where: vi.fn(() => Promise.resolve([])),
    }))
    mocks.dbUpdateChain.mockReturnValue({ set: updateSet })

    const result = await detachTransactionToDedicatedExpense({
      userId: USER_ID,
      transactionId: TX_ID,
      title: '  Pranzo con amici  ',
    })

    expect(result).toEqual({
      newExpenseId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      newExpenseTitle: 'Pranzo con amici',
    })

    const expectedHash = createHash('sha256').update(`detached:${TX_ID}`).digest('hex')
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        userId: USER_ID,
        title: 'Pranzo con amici',
        descriptionHash: expectedHash,
        subCategoryId: null,
        totalAmount: '-25.50',
        transactionCount: 1,
        status: '1',
        firstTransactionAt: OCCURRED_AT,
        lastTransactionAt: OCCURRED_AT,
      }),
    )

    expect(updateSet).toHaveBeenCalledWith({ expenseId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' })
    expect(mocks.reconcileExpensesAfterTransactionRemoval).toHaveBeenCalledWith(
      expect.anything(),
      { userId: USER_ID, affectedExpenseIds: [SOURCE_EXPENSE_ID] },
    )
  })

  it('rejects when transaction is not found', async () => {
    await expect(
      detachTransactionToDedicatedExpense({
        userId: USER_ID,
        transactionId: TX_ID,
        title: 'Titolo',
      }),
    ).rejects.toMatchObject({ code: 'TRANSACTION_NOT_FOUND' })
  })

  it('rejects when source expense has only one transaction', async () => {
    mocks.dbSelectChain.mockReturnValue(
      makeSelectChain([makeLoadedRow({ expenseTransactionCount: 1 })]),
    )

    await expect(
      detachTransactionToDedicatedExpense({
        userId: USER_ID,
        transactionId: TX_ID,
        title: 'Titolo',
      }),
    ).rejects.toMatchObject({ code: 'SINGLE_TRANSACTION_EXPENSE' })
  })

  it('rejects when transaction has no linked expense', async () => {
    mocks.dbSelectChain.mockReturnValue(
      makeSelectChain([makeLoadedRow({ expenseId: null })]),
    )

    await expect(
      detachTransactionToDedicatedExpense({
        userId: USER_ID,
        transactionId: TX_ID,
        title: 'Titolo',
      }),
    ).rejects.toMatchObject({ code: 'NO_EXPENSE_LINKED' })
  })

  it('rejects empty title after trim', async () => {
    await expect(
      detachTransactionToDedicatedExpense({
        userId: USER_ID,
        transactionId: TX_ID,
        title: '   ',
      }),
    ).rejects.toBeInstanceOf(DetachTransactionError)
  })
})
