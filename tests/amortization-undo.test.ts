// Real-Postgres regression proof for reverseDetachTx (Phase 77, D-09 undo). Uses the same local
// Postgres harness as tests/amortization-guards.test.ts — transaction-detach.ts never imports the
// `@/lib/db` singleton at runtime for the tx-accepting reverseDetachTx path itself, but the module
// DOES import it at module scope for the non-tx-accepting `detachTransactionToDedicatedExpense`
// wrapper, so we still mock it before the dynamic import (same technique as amortization-guards).
//
// Requires local Docker Postgres (`yarn db:up`). Skips gracefully (console warning, no failure)
// when unreachable, so `vitest run` stays green in sandboxes without Docker.
import { randomUUID } from 'node:crypto'
import { and, count, eq } from 'drizzle-orm'
import { afterAll, describe, expect, it, vi } from 'vitest'
import type { activatePlanTx as ActivatePlanTx } from '@/lib/services/amortization-activation'
import type { reverseDetachTx as ReverseDetachTx } from '@/lib/services/transaction-detach'
import type { getUncategorizedCount as GetUncategorizedCount } from '@/lib/dal/dashboard'
import {
  amortizationInstalment as amortizationInstalmentTable,
  amortizationPlan as amortizationPlanTable,
  expense as expenseTable,
  transaction as transactionTable,
} from '@/lib/db/schema'
import { computeDescriptionHash } from '@/lib/utils/import'
import { toDbDecimal, toDecimal } from '@/lib/utils/decimal'
import {
  connectReimbursementTestDb,
  resetReimbursementFixtures,
  type ReimbursementTestDb,
} from './helpers/reimbursement-test-db'
import {
  seedExpenseWithTransaction,
  seedMinimalTaxonomy,
  seedUser,
} from './fixtures/reimbursement-seed'

const harness = await connectReimbursementTestDb()

// Same technique as tests/amortization-guards.test.ts: never let transaction-detach.ts's
// module-scope `import { db } from '@/lib/db'` build its own connection off the ambient
// process.env.DATABASE_URL — mock it before the dynamic import.
let activatePlanTx: typeof ActivatePlanTx
let reverseDetachTx: typeof ReverseDetachTx
let getUncategorizedCount: typeof GetUncategorizedCount

if (harness.ok) {
  vi.doMock('@/lib/db', () => ({ db: harness.db }))
  vi.resetModules()
  const activationModule = await import('@/lib/services/amortization-activation')
  activatePlanTx = activationModule.activatePlanTx
  const detachModule = await import('@/lib/services/transaction-detach')
  reverseDetachTx = detachModule.reverseDetachTx
  // CR-01 regression (Phase 77 review-fix): lib/dal/dashboard.ts's getUncategorizedCount is a
  // plain (non-cache()-wrapped) export, so importing it against the same harness-db-backed
  // module registry needs no additional 'react' mock beyond what's already set up above.
  const dashboardModule = await import('@/lib/dal/dashboard')
  getUncategorizedCount = dashboardModule.getUncategorizedCount
} else {
  console.warn(
    '[amortization-undo] Local Postgres unreachable — run `yarn db:up` to enable this suite. Skipping.',
  )
}

const describeIfReachable = harness.ok ? describe : describe.skip

function requireHarnessDb(): ReimbursementTestDb {
  if (!harness.ok) {
    throw new Error('amortization-undo: harness unreachable — this must be unreachable when skipped')
  }
  return harness.db
}

async function amortizationPlanCountFor(db: ReimbursementTestDb, planId: string): Promise<number> {
  const rows = await db
    .select({ count: count() })
    .from(amortizationPlanTable)
    .where(eq(amortizationPlanTable.id, planId))
  return Number(rows[0]?.count ?? 0)
}

async function amortizationInstalmentCountFor(db: ReimbursementTestDb, planId: string): Promise<number> {
  const rows = await db
    .select({ count: count() })
    .from(amortizationInstalmentTable)
    .where(eq(amortizationInstalmentTable.planId, planId))
  return Number(rows[0]?.count ?? 0)
}

afterAll(async () => {
  if (harness.ok) {
    await harness.pool.end()
  }
})

describeIfReachable('reverseDetachTx (Phase 77, D-09 undo)', () => {
  it('creates a new shared Expense when no existing expense matches the recomputed original hash', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const occurredAt = new Date(2026, 0, 12, 12, 0, 0)
    const description = 'Laptop Apple'

    const { expenseId: originalExpenseId, transactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-1000.00',
      occurredAt,
      title: description,
    })

    const activation = await activatePlanTx(db, { userId, transactionId, months: 4 })
    // seedExpenseWithTransaction creates a single-transaction (transactionCount=1) expense, so
    // applyDetachCleanupTx's 1:1 branch re-hashes it IN PLACE — same expense id, synthetic hash.
    expect(activation.expenseId).toBe(originalExpenseId)

    const result = await reverseDetachTx(db, {
      userId,
      transactionId,
      planId: activation.planId,
    })

    expect(result.expenseId).not.toBe(originalExpenseId)

    const originalHash = computeDescriptionHash(description)
    const newExpenseRows = await db
      .select()
      .from(expenseTable)
      .where(eq(expenseTable.id, result.expenseId))
    expect(newExpenseRows).toHaveLength(1)
    expect(newExpenseRows[0]?.descriptionHash).toBe(originalHash)
    // subCategoryId/status carried forward from the abandoned Standalone Expense's current
    // values (the forced detach set status='3' because a subCategoryId was preserved).
    expect(newExpenseRows[0]?.subCategoryId).toBe(taxonomy.essentialSubCategoryId)
    expect(newExpenseRows[0]?.status).toBe('3')
    expect(toDecimal(newExpenseRows[0]!.totalAmount).equals(toDecimal('-1000.00'))).toBe(true)
    expect(newExpenseRows[0]?.transactionCount).toBe(1)

    const txRows = await db
      .select({ expenseId: transactionTable.expenseId })
      .from(transactionTable)
      .where(eq(transactionTable.id, transactionId))
    expect(txRows[0]?.expenseId).toBe(result.expenseId)

    // The abandoned Standalone Expense has zero remaining transactions and is deleted (no
    // manual/override classification history exists for it in this scenario).
    const abandonedRows = await db
      .select()
      .from(expenseTable)
      .where(eq(expenseTable.id, originalExpenseId))
    expect(abandonedRows).toHaveLength(0)

    // The amortization_plan row and all its amortization_instalment rows are gone.
    expect(await amortizationPlanCountFor(db, activation.planId)).toBe(0)
    expect(await amortizationInstalmentCountFor(db, activation.planId)).toBe(0)
  })

  it('merges into an existing shared Expense when a second transaction with the same description was imported after activation', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const occurredAt = new Date(2026, 0, 12, 12, 0, 0)
    const description = 'Netflix'

    const { expenseId: originalExpenseId, transactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-120.00',
      occurredAt,
      title: description,
    })

    const activation = await activatePlanTx(db, { userId, transactionId, months: 2 })

    // Simulate a second import of the same-description merchant AFTER activation, forming the
    // shared Expense the undo should merge into. Untouched fields (title/status/subCategoryId)
    // must prove the merge branch never rewrites an existing shared expense's identity.
    const originalHash = computeDescriptionHash(description)
    const sharedExpenseId = randomUUID()
    const secondTransactionId = randomUUID()
    const laterOccurredAt = new Date(2026, 1, 12, 12, 0, 0)
    const secondAmount = toDbDecimal(toDecimal('-45.00'))

    await db.insert(expenseTable).values({
      id: sharedExpenseId,
      userId,
      title: description,
      descriptionHash: originalHash,
      subCategoryId: taxonomy.essentialSubCategoryId,
      totalAmount: secondAmount,
      transactionCount: 1,
      firstTransactionAt: laterOccurredAt,
      lastTransactionAt: laterOccurredAt,
      status: '2',
    })
    await db.insert(transactionTable).values({
      id: secondTransactionId,
      userId,
      expenseId: sharedExpenseId,
      transactionHash: `hash-${secondTransactionId}`,
      description,
      descriptionHash: originalHash,
      amount: secondAmount,
      occurredAt: laterOccurredAt,
      rowIndex: 0,
    })

    const result = await reverseDetachTx(db, {
      userId,
      transactionId,
      planId: activation.planId,
    })

    expect(result.expenseId).toBe(sharedExpenseId)

    const sharedRows = await db
      .select()
      .from(expenseTable)
      .where(eq(expenseTable.id, sharedExpenseId))
    expect(sharedRows).toHaveLength(1)
    // The merge branch never rewrites the existing shared expense's own identity.
    expect(sharedRows[0]?.title).toBe(description)
    expect(sharedRows[0]?.status).toBe('2')
    expect(sharedRows[0]?.subCategoryId).toBe(taxonomy.essentialSubCategoryId)
    // Reconciled aggregate now spans both linked transactions.
    expect(sharedRows[0]?.transactionCount).toBe(2)
    expect(toDecimal(sharedRows[0]!.totalAmount).equals(toDecimal('-165.00'))).toBe(true)

    const txRows = await db
      .select({ expenseId: transactionTable.expenseId })
      .from(transactionTable)
      .where(eq(transactionTable.id, transactionId))
    expect(txRows[0]?.expenseId).toBe(sharedExpenseId)

    const abandonedRows = await db
      .select()
      .from(expenseTable)
      .where(eq(expenseTable.id, originalExpenseId))
    expect(abandonedRows).toHaveLength(0)

    expect(await amortizationPlanCountFor(db, activation.planId)).toBe(0)
    expect(await amortizationInstalmentCountFor(db, activation.planId)).toBe(0)
  })

  it('throws and writes nothing when the transactionId/userId does not match the caller ownership', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    const { userId: otherUserId } = await seedUser(db)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const occurredAt = new Date(2026, 0, 12, 12, 0, 0)

    const { transactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-1000.00',
      occurredAt,
      title: 'Foreign-owned purchase',
    })

    const activation = await activatePlanTx(db, { userId, transactionId, months: 3 })

    await expect(
      reverseDetachTx(db, { userId: otherUserId, transactionId, planId: activation.planId }),
    ).rejects.toThrow()

    // Nothing changed: the plan and its instalments are untouched.
    expect(await amortizationPlanCountFor(db, activation.planId)).toBe(1)
    expect(await amortizationInstalmentCountFor(db, activation.planId)).toBe(3)

    // Also verify the id-only mismatch path (right userId, wrong planId scoping combination is
    // covered by the transactionId check above) — a random unrelated planId also resolves to
    // "not found" and writes nothing.
    const unrelatedPlanId = randomUUID()
    await expect(
      reverseDetachTx(db, { userId, transactionId, planId: unrelatedPlanId }),
    ).rejects.toThrow()
    expect(
      await db
        .select({ id: amortizationPlanTable.id })
        .from(amortizationPlanTable)
        .where(
          and(eq(amortizationPlanTable.transactionId, transactionId), eq(amortizationPlanTable.userId, userId)),
        ),
    ).toHaveLength(1)
  })
})

describeIfReachable('activatePlanTx (Phase 77 review-fix, CR-01 regression)', () => {
  it('keeps an uncategorized source transaction uncategorized after activation, and it stays visible in the uncategorized-count widget query', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    // Taxonomy is seeded even though this scenario never assigns a subcategory — the harness
    // truncates direction/nature/category/sub_category per test (resetReimbursementFixtures),
    // and other fixtures in this file rely on the same rebuild-per-test convention.
    await seedMinimalTaxonomy(db, userId)
    const occurredAt = new Date(2026, 0, 12, 12, 0, 0)

    // CR-01 root cause: activatePlanTx always passed `subCategoryId` through to
    // applyDetachCleanupTx (even when `null`), which used to gate on `!== undefined` — treating
    // an uncategorized source as "categorized". Seed a transaction whose expense genuinely has
    // no subcategory (status '1', subCategoryId null) to prove the fix.
    const { expenseId: originalExpenseId, transactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: null,
      amount: '-250.00',
      occurredAt,
      title: 'Uncategorized outflow',
    })

    const activation = await activatePlanTx(db, { userId, transactionId, months: 5 })
    // seedExpenseWithTransaction creates a single-transaction (transactionCount=1) expense, so
    // applyDetachCleanupTx's 1:1 branch re-hashes it IN PLACE — same expense id.
    expect(activation.expenseId).toBe(originalExpenseId)

    const expenseRows = await db
      .select()
      .from(expenseTable)
      .where(eq(expenseTable.id, activation.expenseId))
    expect(expenseRows).toHaveLength(1)
    // The invariant CR-01 violated: an uncategorized source must produce an uncategorized
    // Standalone Expense — never `{ subCategoryId: null, status: '3' }`.
    expect(expenseRows[0]?.subCategoryId).toBeNull()
    expect(expenseRows[0]?.status).toBe('1')

    // Same WHERE shape as getUncategorizedCount's own query (lib/dal/dashboard.ts) — the
    // resulting expense must actually surface in the "Da categorizzare" dashboard widget, not
    // just look right on direct inspection.
    const from = new Date(2026, 0, 1)
    const to = new Date(2026, 0, 31)
    const uncategorizedCount = await getUncategorizedCount(userId, from, to)
    expect(uncategorizedCount).toBe(1)
  })
})
