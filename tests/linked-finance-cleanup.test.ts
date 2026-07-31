// Real-Postgres: deleting expenses/transactions must tear down amortization + reimbursements.
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it, vi } from 'vitest'
import {
  amortizationPlan as amortizationPlanTable,
  reimbursement as reimbursementTable,
  reimbursementRefund as reimbursementRefundTable,
  transaction as transactionTable,
} from '@/lib/db/schema'
import { materializeInstalments } from '@/lib/services/amortization-math'
import { reducePlanTx } from '@/lib/services/amortization-lifecycle'
import {
  connectReimbursementTestDb,
  resetReimbursementFixtures,
  type ReimbursementTestDb,
} from './helpers/reimbursement-test-db'
import {
  seedAmortizationPlan,
  seedExpenseWithTransaction,
  seedMinimalTaxonomy,
  seedUser,
} from './fixtures/reimbursement-seed'

const harness = await connectReimbursementTestDb()

if (!harness.ok) {
  console.warn(
    '[linked-finance-cleanup] Local Postgres unreachable — run `yarn db:up` to enable this suite. Skipping.',
  )
}

const describeIfReachable = harness.ok ? describe : describe.skip

function requireHarnessDb(): ReimbursementTestDb {
  if (!harness.ok) {
    throw new Error('linked-finance-cleanup: harness unreachable')
  }
  return harness.db
}

afterAll(async () => {
  if (harness.ok) {
    await harness.pool.end()
  }
})

async function countPlans(db: ReimbursementTestDb, userId: string) {
  return (
    await db
      .select({ id: amortizationPlanTable.id })
      .from(amortizationPlanTable)
      .where(eq(amortizationPlanTable.userId, userId))
  ).length
}

async function countReimbursements(db: ReimbursementTestDb, userId: string) {
  return (
    await db
      .select({ id: reimbursementTable.id })
      .from(reimbursementTable)
      .where(eq(reimbursementTable.userId, userId))
  ).length
}

describeIfReachable('linked finance cleanup on hard delete', () => {
  it('deleting expense without linked txs removes amortization plan and reimbursement', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)
    vi.doMock('@/lib/db', () => ({ db }))
    vi.resetModules()
    const { deleteExpensesWithOptions } = await import('@/lib/services/expense-deletion')

    const { userId } = await seedUser(db)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const start = new Date()
    const startDate = new Date(start.getFullYear(), start.getMonth() - 2, 10, 12, 0, 0)

    const { expenseId, transactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-600.00',
      occurredAt: startDate,
      title: 'Amortized purchase',
    })
    const instalments = materializeInstalments('-600.00', startDate, 6)
    const { planId } = await seedAmortizationPlan(db, {
      userId,
      transactionId,
      expenseId,
      months: 6,
      instalments,
    })

    const { transactionId: refundTransactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: null,
      amount: '100.00',
      occurredAt: new Date(start.getFullYear(), start.getMonth(), 1),
      title: 'Partial refund',
    })
    await reducePlanTx(db, { userId, planId, refundTransactionId })

    expect(await countPlans(db, userId)).toBe(1)
    expect(await countReimbursements(db, userId)).toBe(1)

    await deleteExpensesWithOptions({
      userId,
      expenseIds: [expenseId],
      deleteLinkedTransactions: false,
    })

    expect(await countPlans(db, userId)).toBe(0)
    expect(await countReimbursements(db, userId)).toBe(0)
    expect(
      (
        await db
          .select({ id: reimbursementRefundTable.id })
          .from(reimbursementRefundTable)
      ).length,
    ).toBe(0)
    // Anchor transaction kept when deleteLinkedTransactions=false
    const remainingTx = await db
      .select({ id: transactionTable.id })
      .from(transactionTable)
      .where(eq(transactionTable.id, transactionId))
    expect(remainingTx).toHaveLength(1)
  })

  it('deleting the anchor transaction removes plan and whole reimbursement', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)
    vi.doMock('@/lib/db', () => ({ db }))
    vi.resetModules()
    const { deleteTransactionsAndReconcileExpenses } = await import(
      '@/lib/services/transaction-deletion'
    )

    const { userId } = await seedUser(db)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const start = new Date()
    const startDate = new Date(start.getFullYear(), start.getMonth() - 1, 10, 12, 0, 0)

    const { expenseId, transactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-400.00',
      occurredAt: startDate,
      title: 'Anchor',
    })
    const instalments = materializeInstalments('-400.00', startDate, 4)
    const { planId } = await seedAmortizationPlan(db, {
      userId,
      transactionId,
      expenseId,
      months: 4,
      instalments,
    })

    const { transactionId: refundTransactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: null,
      amount: '50.00',
      occurredAt: new Date(start.getFullYear(), start.getMonth(), 1),
      title: 'Credit',
    })
    await reducePlanTx(db, { userId, planId, refundTransactionId })

    await deleteTransactionsAndReconcileExpenses({
      userId,
      transactionIds: [transactionId],
    })

    expect(await countPlans(db, userId)).toBe(0)
    expect(await countReimbursements(db, userId)).toBe(0)
    // Refund transaction itself is kept — only the reimbursement link is removed.
    const refundStillThere = await db
      .select({ id: transactionTable.id })
      .from(transactionTable)
      .where(eq(transactionTable.id, refundTransactionId))
    expect(refundStillThere).toHaveLength(1)
  })
})
