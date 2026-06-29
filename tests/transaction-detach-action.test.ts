import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  detachTransactionToDedicatedExpense: vi.fn(),
  revalidateCategorizationSurfaces: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({
  refresh: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/dal/auth', () => ({
  verifySession: mocks.verifySession,
}))

vi.mock('@/lib/services/transaction-detach', () => ({
  DetachTransactionError: class DetachTransactionError extends Error {
    code: string
    constructor(code: string, message: string) {
      super(message)
      this.code = code
    }
  },
  detachTransactionToDedicatedExpense: mocks.detachTransactionToDedicatedExpense,
}))

vi.mock('@/lib/actions/revalidation', () => ({
  revalidateCategorizationSurfaces: mocks.revalidateCategorizationSurfaces,
}))

const { detachTransaction } = await import('@/lib/actions/transactions')

const USER_ID = 'user-test-1'
const TX_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

describe('detachTransaction action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue({ userId: USER_ID })
    mocks.detachTransactionToDedicatedExpense.mockResolvedValue({
      newExpenseId: 'new-expense-id',
      newExpenseTitle: 'Pranzo',
    })
  })

  it('delegates to service after session and schema validation', async () => {
    const result = await detachTransaction({
      transactionId: TX_ID,
      title: 'Pranzo',
    })

    expect(mocks.verifySession).toHaveBeenCalled()
    expect(mocks.detachTransactionToDedicatedExpense).toHaveBeenCalledWith({
      userId: USER_ID,
      transactionId: TX_ID,
      title: 'Pranzo',
    })
    expect(mocks.revalidateCategorizationSurfaces).toHaveBeenCalled()
    expect(result).toEqual({
      newExpenseId: 'new-expense-id',
      newExpenseTitle: 'Pranzo',
      error: null,
    })
  })

  it('returns validation error for invalid transaction id', async () => {
    const result = await detachTransaction({
      transactionId: 'not-a-uuid',
      title: 'Pranzo',
    })

    expect(mocks.detachTransactionToDedicatedExpense).not.toHaveBeenCalled()
    expect(result.error).toBeTruthy()
    expect(result.newExpenseId).toBe('')
  })
})
