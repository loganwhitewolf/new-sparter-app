// Real-Postgres regression proof for insertManualTransactionTx's get-or-create + accumulate
// Expense semantics (SEED-005 decision D14). Uses the same local Postgres harness as
// tests/amortization-manual-entry.test.ts — insertManualTransactionTx is tx-composable and
// takes the db handle as its first argument, so this file calls it DIRECTLY against the
// harness, no need to mock `@/lib/db` or go through the createTransaction Server Action.
//
// Requires local Docker Postgres (`yarn db:up`). Skips gracefully (console warning, no failure)
// when unreachable, so `vitest run` stays green in sandboxes without Docker.
import { and, eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { insertManualTransactionTx } from '@/lib/dal/transactions'
import { expense as expenseTable, transaction as transactionTable } from '@/lib/db/schema'
import { toDecimal } from '@/lib/utils/decimal'
import {
  assertHarnessReachableInCi,
  connectReimbursementTestDb,
  resetReimbursementFixtures,
  type ReimbursementTestDb,
} from './helpers/reimbursement-test-db'
import { seedMinimalTaxonomy, seedUser } from './fixtures/reimbursement-seed'

const harness = await connectReimbursementTestDb()
assertHarnessReachableInCi(harness, 'manual-transaction-expense-aggregation')

const describeIfReachable = harness.ok ? describe : describe.skip

function requireHarnessDb(): ReimbursementTestDb {
  if (!harness.ok) {
    throw new Error(
      'manual-transaction-expense-aggregation: harness unreachable — this must be unreachable when skipped',
    )
  }
  return harness.db
}

afterAll(async () => {
  if (harness.ok) {
    await harness.pool.end()
  }
})

async function getExpenseByDescriptionHash(db: ReimbursementTestDb, userId: string, description: string) {
  const { computeDescriptionHash } = await import('@/lib/utils/import')
  const descriptionHash = computeDescriptionHash(description)
  const rows = await db
    .select()
    .from(expenseTable)
    .where(and(eq(expenseTable.userId, userId), eq(expenseTable.descriptionHash, descriptionHash)))
  return rows
}

describeIfReachable('insertManualTransactionTx get-or-create + accumulate (SEED-005 D14)', () => {
  it('two manual transactions with the same description resolve into ONE expense with correct aggregates, regardless of insertion order', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)
    const { userId } = await seedUser(db)

    const description = 'caffè'

    // First call: later date.
    const first = await db.transaction((tx) =>
      insertManualTransactionTx(tx, {
        userId,
        description,
        amount: '-1.50',
        currency: 'EUR',
        occurredAt: new Date('2026-01-20'),
      }),
    )

    // Second call: SAME description, EARLIER date — proves firstTransactionAt moves backward.
    const second = await db.transaction((tx) =>
      insertManualTransactionTx(tx, {
        userId,
        description,
        amount: '-1.20',
        currency: 'EUR',
        occurredAt: new Date('2026-01-05'),
      }),
    )

    // No PG 23505 thrown — both calls resolved. Same expenseId.
    expect(second.expenseId).toBe(first.expenseId)

    const expenses = await getExpenseByDescriptionHash(db, userId, description)
    expect(expenses).toHaveLength(1)
    const expenseRow = expenses[0]!
    expect(expenseRow.transactionCount).toBe(2)
    expect(toDecimal(expenseRow.totalAmount).equals(toDecimal('-2.70'))).toBe(true)
    expect(expenseRow.firstTransactionAt?.toISOString().slice(0, 10)).toBe('2026-01-05')
    expect(expenseRow.lastTransactionAt?.toISOString().slice(0, 10)).toBe('2026-01-20')

    // Both transactions link to the same expense.
    const txRows = await db
      .select()
      .from(transactionTable)
      .where(and(eq(transactionTable.userId, userId), eq(transactionTable.description, description)))
    expect(txRows).toHaveLength(2)
    for (const row of txRows) {
      expect(row.expenseId).toBe(first.expenseId)
    }
  })

  it('never overwrites an already-set subCategoryId when a later manual entry supplies a different one (manual lock)', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)
    const { userId } = await seedUser(db)
    const taxonomy = await seedMinimalTaxonomy(db, userId)

    const description = 'Spesa già categorizzata'

    const first = await db.transaction((tx) =>
      insertManualTransactionTx(tx, {
        userId,
        description,
        amount: '-10.00',
        currency: 'EUR',
        occurredAt: new Date('2026-02-01'),
        subCategoryId: taxonomy.essentialSubCategoryId,
      }),
    )

    await db.transaction((tx) =>
      insertManualTransactionTx(tx, {
        userId,
        description,
        amount: '-5.00',
        currency: 'EUR',
        occurredAt: new Date('2026-02-10'),
        subCategoryId: taxonomy.incomeSubCategoryId,
      }),
    )

    const expenses = await getExpenseByDescriptionHash(db, userId, description)
    expect(expenses).toHaveLength(1)
    expect(expenses[0]!.subCategoryId).toBe(taxonomy.essentialSubCategoryId)
    expect(expenses[0]!.id).toBe(first.expenseId)
  })

  it('applies the caller-supplied subCategoryId (and sets status 3) when the existing expense has none yet', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)
    const { userId } = await seedUser(db)
    const taxonomy = await seedMinimalTaxonomy(db, userId)

    const description = 'Spesa non categorizzata'

    await db.transaction((tx) =>
      insertManualTransactionTx(tx, {
        userId,
        description,
        amount: '-10.00',
        currency: 'EUR',
        occurredAt: new Date('2026-03-01'),
      }),
    )

    await db.transaction((tx) =>
      insertManualTransactionTx(tx, {
        userId,
        description,
        amount: '-5.00',
        currency: 'EUR',
        occurredAt: new Date('2026-03-10'),
        subCategoryId: taxonomy.essentialSubCategoryId,
      }),
    )

    const expenses = await getExpenseByDescriptionHash(db, userId, description)
    expect(expenses).toHaveLength(1)
    expect(expenses[0]!.subCategoryId).toBe(taxonomy.essentialSubCategoryId)
    expect(expenses[0]!.status).toBe('3')
  })

  it('a single call with a brand-new description still creates exactly one new expense with transactionCount 1 (no regression)', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)
    const { userId } = await seedUser(db)

    const description = 'Spesa unica mai vista'

    const result = await db.transaction((tx) =>
      insertManualTransactionTx(tx, {
        userId,
        description,
        amount: '-42.00',
        currency: 'EUR',
        occurredAt: new Date('2026-04-01'),
      }),
    )

    const expenses = await getExpenseByDescriptionHash(db, userId, description)
    expect(expenses).toHaveLength(1)
    expect(expenses[0]!.id).toBe(result.expenseId)
    expect(expenses[0]!.transactionCount).toBe(1)
    expect(toDecimal(expenses[0]!.totalAmount).equals(toDecimal('-42.00'))).toBe(true)
  })
})
