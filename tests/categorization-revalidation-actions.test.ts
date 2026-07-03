import { beforeEach, describe, expect, it, vi } from 'vitest'

const EXPECTED_CATEGORY_REVALIDATION_ROUTES = [
  '/dashboard',
  '/expenses',
  '/import',
  '/settings/categories',
  '/transactions',
]

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  revalidatePath: vi.fn(),
  refresh: vi.fn(),
  insertExpense: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
  deleteExpenses: vi.fn(),
  deleteExpensesWithOptions: vi.fn(),
  getExpenses: vi.fn(),
  writeClassificationHistory: vi.fn(),
  insertManualTransaction: vi.fn(),
  updateTransactionCustomTitle: vi.fn(),
  getTransactions: vi.fn(),
  deleteTransactionsAndReconcileExpenses: vi.fn(),
  createPattern: vi.fn(),
  updatePattern: vi.fn(),
  deletePattern: vi.fn(),
  getCategoryTypeForSubCategory: vi.fn(),
  dbTransaction: vi.fn(),
  dbUpdate: vi.fn(),
  and: vi.fn(() => ({ kind: 'and' })),
  eq: vi.fn(() => ({ kind: 'eq' })),
  inArray: vi.fn(() => ({ kind: 'inArray' })),
}))

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({
  refresh: mocks.refresh,
  revalidatePath: mocks.revalidatePath,
}))
vi.mock('drizzle-orm', () => ({
  and: mocks.and,
  eq: mocks.eq,
  inArray: mocks.inArray,
  or: vi.fn(() => ({ kind: 'or' })),
  isNull: vi.fn(() => ({ kind: 'isNull' })),
  asc: vi.fn(() => ({ kind: 'asc' })),
  sql: vi.fn(() => ({ kind: 'sql' })),
}))

vi.mock('@/lib/dal/auth', () => ({
  verifySession: mocks.verifySession,
}))

vi.mock('@/lib/dal/expenses', () => ({
  EXPENSE_LIST_LIMIT: 50,
  insertExpense: mocks.insertExpense,
  updateExpense: mocks.updateExpense,
  deleteExpense: mocks.deleteExpense,
  deleteExpenses: mocks.deleteExpenses,
  getExpenses: mocks.getExpenses,
}))

vi.mock('@/lib/dal/classification-history', () => ({
  writeClassificationHistory: mocks.writeClassificationHistory,
}))

vi.mock('@/lib/dal/transactions', () => ({
  TRANSACTION_LIST_LIMIT: 50,
  insertManualTransaction: mocks.insertManualTransaction,
  updateTransactionCustomTitle: mocks.updateTransactionCustomTitle,
  getTransactions: mocks.getTransactions,
}))

vi.mock('@/lib/services/expense-deletion', () => ({
  deleteExpensesWithOptions: mocks.deleteExpensesWithOptions,
}))

vi.mock('@/lib/services/transaction-deletion', () => ({
  deleteTransactionsAndReconcileExpenses: mocks.deleteTransactionsAndReconcileExpenses,
}))

vi.mock('@/lib/dal/patterns', () => ({
  createPattern: mocks.createPattern,
  updatePattern: mocks.updatePattern,
  deletePattern: mocks.deletePattern,
  getCategoryTypeForSubCategory: mocks.getCategoryTypeForSubCategory,
}))

vi.mock('@/lib/db/schema', () => ({
  expense: {
    id: 'expense.id',
    userId: 'expense.userId',
    subCategoryId: 'expense.subCategoryId',
    status: 'expense.status',
  },
  subCategory: {
    id: 'subCategory.id',
    userId: 'subCategory.userId',
    categoryId: 'subCategory.categoryId',
    isActive: 'subCategory.isActive',
  },
  category: {
    id: 'category.id',
    userId: 'category.userId',
    isActive: 'category.isActive',
  },
}))

const dbSelectChain = {
  from: () => dbSelectChain,
  leftJoin: () => dbSelectChain,
  where: () => dbSelectChain,
  limit: () => Promise.resolve([{ id: 42 }]),
}

vi.mock('@/lib/db', () => ({
  db: {
    transaction: mocks.dbTransaction,
    update: mocks.dbUpdate,
    select: () => dbSelectChain,
  },
}))

const expensesActions = await import('../lib/actions/expenses')
const transactionActions = await import('../lib/actions/transactions')
const patternActions = await import('../lib/actions/patterns')

const session = {
  userId: 'session-user-id',
  email: 'user@example.test',
  subscriptionPlan: 'basic' as const,
  role: 'user' as const,
}

const expenseId = 'expense-123'
const transactionId = '11111111-1111-4111-8111-111111111111'

function makeFormData(fields: Record<string, string | null>): FormData {
  const formData = new FormData()

  for (const [key, value] of Object.entries(fields)) {
    if (value !== null) formData.append(key, value)
  }

  return formData
}

function uniqueSortedRevalidatedPaths(): string[] {
  return [...new Set(mocks.revalidatePath.mock.calls.map(([path]) => path))].sort()
}

function expectExactCategoryRevalidationRoutes() {
  expect(uniqueSortedRevalidatedPaths()).toEqual([...EXPECTED_CATEGORY_REVALIDATION_ROUTES].sort())
  expect(mocks.refresh).toHaveBeenCalledTimes(1)
}

function expectNoRevalidation() {
  expect(mocks.revalidatePath).not.toHaveBeenCalled()
  expect(mocks.refresh).not.toHaveBeenCalled()
}

function makeTx() {
  const selectLimit = vi.fn().mockResolvedValue([
    { subCategoryId: 1, status: '1', id: expenseId },
  ])
  const selectWhere = vi.fn(() => ({ limit: selectLimit, then: selectLimit().then.bind(selectLimit()) }))
  const selectFrom = vi.fn(() => ({ where: selectWhere }))
  const select = vi.fn(() => ({ from: selectFrom }))

  const returning = vi.fn().mockResolvedValue([{ id: expenseId }])
  const updateWhere = vi.fn(() => ({ returning }))
  const set = vi.fn(() => ({ where: updateWhere }))
  const update = vi.fn(() => ({ set }))

  return { select, update, selectWhere, updateWhere }
}

function makeDbUpdateChain() {
  const where = vi.fn().mockResolvedValue(undefined)
  const set = vi.fn(() => ({ where }))
  return { set, where }
}

function validCreateExpenseForm(overrides: Record<string, string | null> = {}) {
  return makeFormData({
    title: 'Coffee beans',
    subCategoryId: '42',
    notes: 'Pantry',
    ...overrides,
  })
}

function validCategorizeExpenseForm(overrides: Record<string, string | null> = {}) {
  return makeFormData({
    id: expenseId,
    subCategoryId: '42',
    ...overrides,
  })
}

function validBulkCategorizeForm(overrides: Record<string, string | null> = {}) {
  return makeFormData({
    ids: JSON.stringify([expenseId]),
    subCategoryId: '42',
    ...overrides,
  })
}

function validCreateTransactionForm(overrides: Record<string, string | null> = {}) {
  return makeFormData({
    description: 'Manual grocery transaction',
    amount: '-12.34',
    currency: 'EUR',
    occurredAt: '2026-01-15',
    subCategoryId: '42',
    ...overrides,
  })
}

function validUpdateTransactionTitleForm(overrides: Record<string, string | null> = {}) {
  return makeFormData({
    id: transactionId,
    customTitle: 'Readable merchant title',
    ...overrides,
  })
}

function validDeleteTransactionForm(overrides: Record<string, string | null> = {}) {
  return makeFormData({
    id: transactionId,
    ...overrides,
  })
}

function validCreatePatternForm(overrides: Record<string, string | null> = {}) {
  return makeFormData({
    pattern: '/netflix/i',
    subCategoryId: '42',
    amountSign: 'negative',
    confidence: '0.95',
    description: 'Streaming subscriptions',
    ...overrides,
  })
}

function validUpdatePatternForm(overrides: Record<string, string | null> = {}) {
  return makeFormData({
    id: '7',
    pattern: '/netflix/i',
    subCategoryId: '42',
    amountSign: 'negative',
    confidence: '0.95',
    description: 'Streaming subscriptions',
    ...overrides,
  })
}

describe('categorization-related action route revalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue(session)
    mocks.insertExpense.mockResolvedValue({ id: expenseId })
    mocks.updateExpense.mockResolvedValue({ id: expenseId })
    mocks.deleteExpensesWithOptions.mockResolvedValue({
      deletedExpenseIds: [expenseId],
      deletedTransactionIds: [],
    })
    mocks.writeClassificationHistory.mockResolvedValue(undefined)
    mocks.dbTransaction.mockImplementation(async (callback) => callback(makeTx()))
    mocks.dbUpdate.mockReturnValue(makeDbUpdateChain())
    mocks.insertManualTransaction.mockResolvedValue({ id: transactionId })
    mocks.updateTransactionCustomTitle.mockResolvedValue({ id: transactionId })
    mocks.deleteTransactionsAndReconcileExpenses.mockResolvedValue({
      deletedTransactionIds: [transactionId],
    })
    mocks.createPattern.mockResolvedValue({ id: 7 })
    mocks.updatePattern.mockResolvedValue({ id: 7 })
    mocks.deletePattern.mockResolvedValue({ id: 7 })
    mocks.getCategoryTypeForSubCategory.mockResolvedValue('out')
  })

  describe('expense actions', () => {
    it('categorizeExpense uses the session user id and revalidates every category-rendering route', async () => {
      const result = await expensesActions.categorizeExpense(
        { error: null },
        validCategorizeExpenseForm({ userId: 'attacker-user-id' }),
      )

      expect(result).toEqual({ error: null })
      expect(mocks.verifySession).toHaveBeenCalledTimes(1)
      expect(mocks.eq).toHaveBeenCalledWith('expense.userId', 'session-user-id')
      expect(JSON.stringify(mocks.dbTransaction.mock.calls)).not.toContain('attacker-user-id')
      expectExactCategoryRevalidationRoutes()
    })

    it('bulkCategorize revalidates every category-rendering route on success', async () => {
      const result = await expensesActions.bulkCategorize(
        { error: null },
        validBulkCategorizeForm(),
      )

      expect(result).toEqual({ error: null })
      expectExactCategoryRevalidationRoutes()
    })

    it('createExpense revalidates every category-rendering route on success', async () => {
      const result = await expensesActions.createExpense(
        { error: null },
        validCreateExpenseForm({ userId: 'attacker-user-id' }),
      )

      expect(result).toEqual({ error: null })
      expect(mocks.insertExpense).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'session-user-id',
      }))
      expect(mocks.insertExpense).not.toHaveBeenCalledWith(expect.objectContaining({
        userId: 'attacker-user-id',
      }))
      expectExactCategoryRevalidationRoutes()
    })

    it('returns validation errors without revalidating expense routes', async () => {
      const result = await expensesActions.categorizeExpense(
        { error: null },
        validCategorizeExpenseForm({ subCategoryId: '0' }),
      )

      expect(result.error).toBe('Seleziona una categoria prima di confermare.')
      expect(mocks.dbTransaction).not.toHaveBeenCalled()
      expectNoRevalidation()
    })

    it('returns safe DAL errors without revalidating expense routes', async () => {
      mocks.dbTransaction.mockRejectedValueOnce(new Error('database password leaked in diagnostic'))

      const result = await expensesActions.categorizeExpense(
        { error: null },
        validCategorizeExpenseForm(),
      )

      expect(result.error).toBe('Si è verificato un errore. Riprova tra qualche secondo.')
      expect(JSON.stringify(result)).not.toContain('database password')
      expectNoRevalidation()
    })
  })

  describe('transaction actions', () => {
    it('createTransaction revalidates every category-rendering route on success', async () => {
      const result = await transactionActions.createTransaction(
        { error: null },
        validCreateTransactionForm({ userId: 'attacker-user-id' }),
      )

      expect(result).toEqual({ error: null })
      expect(mocks.insertManualTransaction).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'session-user-id',
      }))
      expect(mocks.insertManualTransaction).not.toHaveBeenCalledWith(expect.objectContaining({
        userId: 'attacker-user-id',
      }))
      expectExactCategoryRevalidationRoutes()
    })

    it('updateTransactionCustomTitle revalidates every category-rendering route on success', async () => {
      const result = await transactionActions.updateTransactionCustomTitle(
        { error: null },
        validUpdateTransactionTitleForm({ userId: 'attacker-user-id' }),
      )

      expect(result).toEqual({ error: null })
      expect(mocks.updateTransactionCustomTitle).toHaveBeenCalledWith(
        expect.anything(),
        transactionId,
        'session-user-id',
        'Readable merchant title',
      )
      expectExactCategoryRevalidationRoutes()
    })

    it('deleteTransaction revalidates every category-rendering route on success', async () => {
      const result = await transactionActions.deleteTransaction(
        { error: null },
        validDeleteTransactionForm(),
      )

      expect(result).toEqual({ error: null })
      expect(mocks.deleteTransactionsAndReconcileExpenses).toHaveBeenCalledWith({
        userId: 'session-user-id',
        transactionIds: [transactionId],
        deleteLinkedExpenses: false,
      })
      expectExactCategoryRevalidationRoutes()
    })

    it('returns validation errors without revalidating transaction routes', async () => {
      const result = await transactionActions.deleteTransaction(
        { error: null },
        validDeleteTransactionForm({ id: 'not-a-uuid' }),
      )

      expect(result.error).toBe('Transazione non valida.')
      expect(mocks.deleteTransactionsAndReconcileExpenses).not.toHaveBeenCalled()
      expectNoRevalidation()
    })

    it('returns safe service errors without revalidating transaction routes', async () => {
      mocks.deleteTransactionsAndReconcileExpenses.mockRejectedValueOnce(
        new Error('SQL details with session token'),
      )

      const result = await transactionActions.deleteTransaction(
        { error: null },
        validDeleteTransactionForm(),
      )

      expect(result.error).toBe('Si è verificato un errore. Riprova tra qualche secondo.')
      expect(JSON.stringify(result)).not.toContain('session token')
      expectNoRevalidation()
    })
  })

  describe('pattern actions', () => {
    it('createPatternAction revalidates every category-rendering route on success', async () => {
      const result = await patternActions.createPatternAction(
        { error: null },
        validCreatePatternForm({ userId: 'attacker-user-id' }),
      )

      expect(result).toEqual({ error: null })
      expect(mocks.createPattern).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'session-user-id',
      }))
      expect(mocks.createPattern).not.toHaveBeenCalledWith(expect.objectContaining({
        userId: 'attacker-user-id',
      }))
      expectExactCategoryRevalidationRoutes()
    })

    it('updatePatternAction revalidates every category-rendering route on success', async () => {
      const result = await patternActions.updatePatternAction(
        { error: null },
        validUpdatePatternForm(),
      )

      expect(result).toEqual({ error: null })
      expect(mocks.updatePattern).toHaveBeenCalledWith(7, 'session-user-id', expect.objectContaining({
        subCategoryId: 42,
      }))
      expectExactCategoryRevalidationRoutes()
    })

    it('deletePatternAction revalidates every category-rendering route on success', async () => {
      const result = await patternActions.deletePatternAction(
        { error: null },
        makeFormData({ id: '7' }),
      )

      expect(result).toEqual({ error: null })
      expect(mocks.deletePattern).toHaveBeenCalledWith(7, 'session-user-id')
      expectExactCategoryRevalidationRoutes()
    })

    it('returns validation errors without revalidating pattern routes', async () => {
      const result = await patternActions.createPatternAction(
        { error: null },
        validCreatePatternForm({ subCategoryId: null }),
      )

      expect(result.error).toMatch(/sottocategoria/i)
      expect(mocks.createPattern).not.toHaveBeenCalled()
      expectNoRevalidation()
    })

    it('returns safe DAL errors without revalidating pattern routes', async () => {
      mocks.createPattern.mockRejectedValueOnce(new Error('SQL failed with db credentials'))

      const result = await patternActions.createPatternAction(
        { error: null },
        validCreatePatternForm(),
      )

      expect(result.error).toBe('Si è verificato un errore. Riprova tra qualche secondo.')
      expect(JSON.stringify(result)).not.toContain('db credentials')
      expectNoRevalidation()
    })
  })
})
