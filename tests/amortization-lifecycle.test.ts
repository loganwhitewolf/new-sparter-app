// Real-Postgres regression proof for closePlanTx (Phase 78, D-01/AMORT-04). Uses the same local
// Postgres harness as tests/reimbursement-regression.test.ts / tests/amortization-guards.test.ts.
//
// Requires local Docker Postgres (`yarn db:up`). Skips gracefully (console warning, no failure)
// when unreachable, so `vitest run` stays green in sandboxes without Docker.
import { randomUUID } from 'node:crypto'
import { asc, eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { AmortizationLifecycleError, closePlanTx } from '@/lib/services/amortization-lifecycle'
import {
  amortizationInstalment as amortizationInstalmentTable,
  amortizationPlan as amortizationPlanTable,
} from '@/lib/db/schema'
import { materializeInstalments } from '@/lib/services/amortization-math'
import { toDecimal } from '@/lib/utils/decimal'
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
    '[amortization-lifecycle] Local Postgres unreachable — run `yarn db:up` to enable this suite. Skipping.',
  )
}

const describeIfReachable = harness.ok ? describe : describe.skip

function requireHarnessDb(): ReimbursementTestDb {
  if (!harness.ok) {
    throw new Error('amortization-lifecycle: harness unreachable — this must be unreachable when skipped')
  }
  return harness.db
}

afterAll(async () => {
  if (harness.ok) {
    await harness.pool.end()
  }
})

async function loadPlanStatus(db: ReimbursementTestDb, planId: string): Promise<string | undefined> {
  const rows = await db
    .select({ status: amortizationPlanTable.status })
    .from(amortizationPlanTable)
    .where(eq(amortizationPlanTable.id, planId))
    .limit(1)
  return rows[0]?.status
}

async function loadInstalments(db: ReimbursementTestDb, planId: string) {
  return db
    .select({
      id: amortizationInstalmentTable.id,
      instalmentNumber: amortizationInstalmentTable.instalmentNumber,
      amount: amortizationInstalmentTable.amount,
      occurredAt: amortizationInstalmentTable.occurredAt,
      expenseId: amortizationInstalmentTable.expenseId,
    })
    .from(amortizationInstalmentTable)
    .where(eq(amortizationInstalmentTable.planId, planId))
    .orderBy(asc(amortizationInstalmentTable.occurredAt))
}

describeIfReachable('closePlanTx (Phase 78, D-01/AMORT-04)', () => {
  it('collapses every future instalment onto ONE closure-month instalment, past instalments untouched', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const startDate = new Date(2026, 0, 15, 12, 0, 0) // 2026-01-15

    const { expenseId, transactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-1200.00',
      occurredAt: startDate,
      title: 'MacBook',
    })
    // -1200.00 / 12 = -100.00/mo, no remainder — deterministic Jan..Dec 2026 schedule.
    const instalments = materializeInstalments('-1200.00', startDate, 12)
    const { planId } = await seedAmortizationPlan(db, {
      userId,
      transactionId,
      expenseId,
      months: 12,
      instalments,
    })

    // Close at month 6 (2026-06-15): 5 past (Jan-May), 7 remaining (Jun-Dec, INCLUSIVE of Jun).
    const closureMonth = new Date(2026, 5, 15, 12, 0, 0)
    const result = await closePlanTx(db, { userId, planId, closureMonth })

    expect(result.closureInstalmentId).not.toBeNull()
    expect(toDecimal(result.remainingValue).equals(toDecimal('-700.00'))).toBe(true)

    const remaining = await loadInstalments(db, planId)
    expect(remaining).toHaveLength(6) // 5 past (Jan-May) + 1 new closure instalment
    const closureRow = remaining.find((r) => r.id === result.closureInstalmentId)
    expect(closureRow).toBeDefined()
    expect(toDecimal(closureRow!.amount).equals(toDecimal('-700.00'))).toBe(true)
    expect(closureRow!.occurredAt.getFullYear()).toBe(2026)
    expect(closureRow!.occurredAt.getMonth()).toBe(5)
    expect(closureRow!.occurredAt.getDate()).toBe(15)
    expect(closureRow!.expenseId).toBe(expenseId)

    // Past instalments (Jan-May) untouched — same amount, same count.
    const pastRows = remaining.filter((r) => r.id !== result.closureInstalmentId)
    expect(pastRows).toHaveLength(5)
    for (const row of pastRows) {
      expect(toDecimal(row.amount).equals(toDecimal('-100.00'))).toBe(true)
    }

    const status = await loadPlanStatus(db, planId)
    expect(status).toBe('closed')
  })

  it("closure month equal to a scheduled instalment's own month collapses that instalment too (inclusive adjacency edge)", async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const startDate = new Date(2026, 0, 10, 12, 0, 0) // 2026-01-10

    const { expenseId, transactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-300.00',
      occurredAt: startDate,
      title: 'Adjacency boundary plan',
    })
    // -300.00 / 3 = -100.00/mo — Jan/Feb/Mar 2026.
    const instalments = materializeInstalments('-300.00', startDate, 3)
    const { planId } = await seedAmortizationPlan(db, {
      userId,
      transactionId,
      expenseId,
      months: 3,
      instalments,
    })

    // Close exactly in Feb (instalment 2's own month) — Feb must be COLLAPSED, not preserved.
    const closureMonth = new Date(2026, 1, 10, 12, 0, 0)
    const result = await closePlanTx(db, { userId, planId, closureMonth })

    expect(toDecimal(result.remainingValue).equals(toDecimal('-200.00'))).toBe(true)

    const remaining = await loadInstalments(db, planId)
    expect(remaining).toHaveLength(2) // 1 past (Jan) + 1 closure instalment (Feb collapses Feb+Mar)
    const pastRows = remaining.filter((r) => r.id !== result.closureInstalmentId)
    expect(pastRows).toHaveLength(1)
    expect(pastRows[0]!.occurredAt.getMonth()).toBe(0) // January untouched
    expect(toDecimal(pastRows[0]!.amount).equals(toDecimal('-100.00'))).toBe(true)
  })

  it('every instalment already occurred before the closure month: status closed, zero new instalment rows (empty-input edge)', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const startDate = new Date(2026, 0, 10, 12, 0, 0)

    const { expenseId, transactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-200.00',
      occurredAt: startDate,
      title: 'Fully consumed plan',
    })
    const instalments = materializeInstalments('-200.00', startDate, 2) // Jan/Feb 2026
    const { planId } = await seedAmortizationPlan(db, {
      userId,
      transactionId,
      expenseId,
      months: 2,
      instalments,
    })

    const closureMonth = new Date(2026, 5, 1, 12, 0, 0) // June — after both instalments
    const result = await closePlanTx(db, { userId, planId, closureMonth })

    expect(result.closureInstalmentId).toBeNull()
    expect(result.remainingValue).toBe('0.00')

    const remaining = await loadInstalments(db, planId)
    expect(remaining).toHaveLength(2) // untouched originals, no new row

    const status = await loadPlanStatus(db, planId)
    expect(status).toBe('closed')
  })

  it('an already-closed plan throws PLAN_NOT_OPEN', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const startDate = new Date(2026, 0, 10, 12, 0, 0)

    const { expenseId, transactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-200.00',
      occurredAt: startDate,
      title: 'Already closed plan',
    })
    const instalments = materializeInstalments('-200.00', startDate, 2)
    const { planId } = await seedAmortizationPlan(db, {
      userId,
      transactionId,
      expenseId,
      months: 2,
      instalments,
    })

    // First close succeeds.
    await closePlanTx(db, { userId, planId, closureMonth: new Date(2026, 5, 1) })

    // Second close attempt on the now-closed plan.
    await expect(
      closePlanTx(db, { userId, planId, closureMonth: new Date(2026, 6, 1) }),
    ).rejects.toThrow('Questo piano è già chiuso.')
    await expect(
      closePlanTx(db, { userId, planId, closureMonth: new Date(2026, 6, 1) }),
    ).rejects.toBeInstanceOf(AmortizationLifecycleError)
  })

  it('a foreign-owned or nonexistent planId throws the SAME generic PLAN_NOT_FOUND message', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId: ownerId } = await seedUser(db)
    const { userId: strangerId } = await seedUser(db)
    const taxonomy = await seedMinimalTaxonomy(db, ownerId)
    const startDate = new Date(2026, 0, 10, 12, 0, 0)

    const { expenseId, transactionId } = await seedExpenseWithTransaction(db, {
      userId: ownerId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-200.00',
      occurredAt: startDate,
      title: 'Owned by someone else',
    })
    const instalments = materializeInstalments('-200.00', startDate, 2)
    const { planId } = await seedAmortizationPlan(db, {
      userId: ownerId,
      transactionId,
      expenseId,
      months: 2,
      instalments,
    })

    // Foreign owner: same planId, wrong userId — no ownership-enumeration signal.
    await expect(
      closePlanTx(db, { userId: strangerId, planId, closureMonth: new Date(2026, 5, 1) }),
    ).rejects.toThrow('Pianificazione non trovata.')

    // Nonexistent planId: the SAME message.
    await expect(
      closePlanTx(db, {
        userId: ownerId,
        planId: randomUUID(),
        closureMonth: new Date(2026, 5, 1),
      }),
    ).rejects.toThrow('Pianificazione non trovata.')
  })

  it('closing with EXACTLY ONE remaining future instalment carries its amount forward unchanged (Decimal identity, no rounding drift)', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const startDate = new Date(2026, 0, 5, 12, 0, 0) // 2026-01-05

    const { expenseId, transactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-100.00',
      occurredAt: startDate,
      title: 'Single-remaining-instalment plan',
    })
    // -100.00 / 3 does NOT divide evenly: -33.34/-33.33/-33.33 (remainder folds onto the FIRST
    // instalment, materializeInstalments contract) — the LAST instalment (the one still
    // remaining at close) carries no rounding artefact of its own.
    const instalments = materializeInstalments('-100.00', startDate, 3)
    const { planId } = await seedAmortizationPlan(db, {
      userId,
      transactionId,
      expenseId,
      months: 3,
      instalments,
    })
    const lastInstalmentAmount = instalments[2]!.amount

    // Close in March (the 3rd/last instalment's own month) — exactly ONE instalment remains.
    const closureMonth = new Date(2026, 2, 5, 12, 0, 0)
    const result = await closePlanTx(db, { userId, planId, closureMonth })

    expect(toDecimal(result.remainingValue).equals(toDecimal(lastInstalmentAmount))).toBe(true)

    const remaining = await loadInstalments(db, planId)
    const closureRow = remaining.find((r) => r.id === result.closureInstalmentId)
    expect(closureRow).toBeDefined()
    expect(toDecimal(closureRow!.amount).equals(toDecimal(lastInstalmentAmount))).toBe(true)
  })

  it("does not affect an unrelated plan for the SAME user (ownership/scoping regression, not just a single-plan happy path)", async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const startDate = new Date(2026, 0, 10, 12, 0, 0)

    // Plan A — the one we close.
    const planA = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-300.00',
      occurredAt: startDate,
      title: 'Plan A (closed)',
    })
    const instalmentsA = materializeInstalments('-300.00', startDate, 3)
    const { planId: planIdA } = await seedAmortizationPlan(db, {
      userId,
      transactionId: planA.transactionId,
      expenseId: planA.expenseId,
      months: 3,
      instalments: instalmentsA,
    })

    // Plan B — a second, unrelated open plan for the SAME user.
    const planB = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-600.00',
      occurredAt: startDate,
      title: 'Plan B (untouched)',
    })
    const instalmentsB = materializeInstalments('-600.00', startDate, 6)
    const { planId: planIdB } = await seedAmortizationPlan(db, {
      userId,
      transactionId: planB.transactionId,
      expenseId: planB.expenseId,
      months: 6,
      instalments: instalmentsB,
    })
    const beforeB = await loadInstalments(db, planIdB)

    await closePlanTx(db, { userId, planId: planIdA, closureMonth: new Date(2026, 1, 10) })

    const statusA = await loadPlanStatus(db, planIdA)
    expect(statusA).toBe('closed')

    // Plan B's instalments and status are COMPLETELY untouched.
    const statusB = await loadPlanStatus(db, planIdB)
    expect(statusB).toBe('open')
    const afterB = await loadInstalments(db, planIdB)
    expect(afterB).toHaveLength(beforeB.length)
    expect(afterB.map((r) => ({ id: r.id, amount: r.amount, occurredAt: r.occurredAt.getTime() }))).toEqual(
      beforeB.map((r) => ({ id: r.id, amount: r.amount, occurredAt: r.occurredAt.getTime() })),
    )
  })
})
