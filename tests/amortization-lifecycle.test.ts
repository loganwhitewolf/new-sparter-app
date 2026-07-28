// Real-Postgres regression proof for closePlanTx (Phase 78, D-01/AMORT-04). Uses the same local
// Postgres harness as tests/reimbursement-regression.test.ts / tests/amortization-guards.test.ts.
//
// Requires local Docker Postgres (`yarn db:up`). Skips gracefully (console warning, no failure)
// when unreachable, so `vitest run` stays green in sandboxes without Docker.
import { randomUUID } from 'node:crypto'
import { asc, eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import {
  AmortizationLifecycleError,
  closePlanTx,
  realizePlanTx,
  reducePlanTx,
} from '@/lib/services/amortization-lifecycle'
import {
  amortizationInstalment as amortizationInstalmentTable,
  amortizationPlan as amortizationPlanTable,
  reimbursement as reimbursementTable,
  reimbursementRefund as reimbursementRefundTable,
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

async function loadPlanTotalAmount(db: ReimbursementTestDb, planId: string): Promise<string | undefined> {
  const rows = await db
    .select({ totalAmount: amortizationPlanTable.totalAmount })
    .from(amortizationPlanTable)
    .where(eq(amortizationPlanTable.id, planId))
    .limit(1)
  return rows[0]?.totalAmount
}

async function countReimbursementRows(
  db: ReimbursementTestDb,
): Promise<{ reimbursements: number; refunds: number }> {
  const [reimbursements, refunds] = await Promise.all([
    db.select({ id: reimbursementTable.id }).from(reimbursementTable),
    db.select({ id: reimbursementRefundTable.id }).from(reimbursementRefundTable),
  ])
  return { reimbursements: reimbursements.length, refunds: refunds.length }
}

/**
 * Shared setup for the realizePlanTx/reducePlanTx suites below: given an already-seeded owner +
 * subCategoryId, seeds one open plan (purchase transaction + N materialized instalments) —
 * mirrors the closePlanTx suite's own seedExpenseWithTransaction -> materializeInstalments ->
 * seedAmortizationPlan sequence, so each `it` only needs to describe its OWN scenario-specific
 * amount/dates instead of repeating the full fixture chain.
 */
async function seedOpenPlanFixture(
  db: ReimbursementTestDb,
  input: {
    userId: string
    subCategoryId: number
    amount: string
    months: number
    startDate: Date
    title: string
  },
): Promise<{ expenseId: string; transactionId: string; planId: string }> {
  const { expenseId, transactionId } = await seedExpenseWithTransaction(db, {
    userId: input.userId,
    subCategoryId: input.subCategoryId,
    amount: input.amount,
    occurredAt: input.startDate,
    title: input.title,
  })
  const instalments = materializeInstalments(input.amount, input.startDate, input.months)
  const { planId } = await seedAmortizationPlan(db, {
    userId: input.userId,
    transactionId,
    expenseId,
    months: input.months,
    instalments,
  })
  return { expenseId, transactionId, planId }
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

describeIfReachable('realizePlanTx (Phase 78, D-02/AMORT-05)', () => {
  it('partial recovery (sale magnitude < remaining magnitude): closure instalment keeps the ORIGINAL (cost) sign, smaller magnitude', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const startDate = new Date(2026, 0, 15, 12, 0, 0) // 2026-01-15

    const { planId } = await seedOpenPlanFixture(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-1200.00',
      months: 12,
      startDate,
      title: 'MacBook (partial recovery)',
    })

    // Sale in June (month 6): 5 past (Jan-May), 7 remaining (Jun-Dec) = -700.00 remaining.
    const saleDate = new Date(2026, 5, 15, 12, 0, 0)
    const { transactionId: saleTransactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: null,
      amount: '500.00',
      occurredAt: saleDate,
      title: 'MacBook sale (partial)',
    })

    const result = await realizePlanTx(db, { userId, planId, saleTransactionId })

    // -700.00 (remaining cost) + 500.00 (sale) = -200.00 — still a cost, smaller magnitude.
    expect(toDecimal(result.remainingValue).equals(toDecimal('-200.00'))).toBe(true)
    expect(result.closureInstalmentId).not.toBeNull()
    expect(result.saleTransactionId).toBe(saleTransactionId)

    const status = await loadPlanStatus(db, planId)
    expect(status).toBe('closed')

    // The sale is linked via the v2.8 mechanism against the ORIGINAL transaction, not synthesized.
    const { reimbursements, refunds } = await countReimbursementRows(db)
    expect(reimbursements).toBe(1)
    expect(refunds).toBe(1)
  })

  it('over-recovery (sale magnitude > remaining magnitude): closure instalment FLIPS sign to positive (income) — never blocked, never clamped', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const startDate = new Date(2026, 0, 15, 12, 0, 0)

    const { planId } = await seedOpenPlanFixture(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-1200.00',
      months: 12,
      startDate,
      title: 'MacBook (over-recovery)',
    })

    const saleDate = new Date(2026, 5, 15, 12, 0, 0) // -700.00 remaining at this closure month
    const { transactionId: saleTransactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: null,
      amount: '2500.00',
      occurredAt: saleDate,
      title: 'MacBook sale (over-recovery)',
    })

    const result = await realizePlanTx(db, { userId, planId, saleTransactionId })

    // -700.00 + 2500.00 = +1800.00 — POSITIVE net, extraordinary income, never blocked/clamped.
    expect(toDecimal(result.remainingValue).equals(toDecimal('1800.00'))).toBe(true)
    expect(toDecimal(result.remainingValue).isPositive()).toBe(true)

    const remaining = await loadInstalments(db, planId)
    const closureRow = remaining.find((r) => r.id === result.closureInstalmentId)
    expect(closureRow).toBeDefined()
    expect(toDecimal(closureRow!.amount).equals(toDecimal('1800.00'))).toBe(true)
  })

  it('exact-zero recovery (sale magnitude == remaining magnitude): closure instalment amount is exactly 0.00', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const startDate = new Date(2026, 0, 15, 12, 0, 0)

    const { planId } = await seedOpenPlanFixture(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-1200.00',
      months: 12,
      startDate,
      title: 'MacBook (exact recovery)',
    })

    const saleDate = new Date(2026, 5, 15, 12, 0, 0) // -700.00 remaining
    const { transactionId: saleTransactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: null,
      amount: '700.00',
      occurredAt: saleDate,
      title: 'MacBook sale (exact)',
    })

    const result = await realizePlanTx(db, { userId, planId, saleTransactionId })

    expect(result.remainingValue).toBe('0.00')
    expect(result.closureInstalmentId).not.toBeNull()
  })

  it('zero-remaining-before-sale (plan fully consumed before the sale month): NO closure instalment row is created, but the sale is STILL linked', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const startDate = new Date(2026, 0, 10, 12, 0, 0)

    const { planId } = await seedOpenPlanFixture(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-200.00',
      months: 2,
      startDate,
      title: 'Fully consumed before sale',
    })

    const saleDate = new Date(2026, 5, 1, 12, 0, 0) // Well after both instalments (Jan/Feb).
    const { transactionId: saleTransactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: null,
      amount: '50.00',
      occurredAt: saleDate,
      title: 'Sale after full consumption',
    })

    const result = await realizePlanTx(db, { userId, planId, saleTransactionId })

    expect(result.closureInstalmentId).toBeNull()
    expect(result.remainingValue).toBe('0.00')

    const status = await loadPlanStatus(db, planId)
    expect(status).toBe('closed')

    // The sale link STILL happens even with nothing left to net against materially.
    const { reimbursements, refunds } = await countReimbursementRows(db)
    expect(reimbursements).toBe(1)
    expect(refunds).toBe(1)
  })

  it('a missing or foreign-owned saleTransactionId throws TRANSACTION_NOT_FOUND (T-78-05)', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId: ownerId } = await seedUser(db)
    const { userId: strangerId } = await seedUser(db)
    const taxonomy = await seedMinimalTaxonomy(db, ownerId)
    const startDate = new Date(2026, 0, 10, 12, 0, 0)

    const { planId } = await seedOpenPlanFixture(db, {
      userId: ownerId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-200.00',
      months: 2,
      startDate,
      title: 'Foreign sale test',
    })

    // A transaction owned by a DIFFERENT user.
    const { transactionId: strangerTransactionId } = await seedExpenseWithTransaction(db, {
      userId: strangerId,
      subCategoryId: null,
      amount: '50.00',
      occurredAt: new Date(2026, 1, 10, 12, 0, 0),
      title: 'Stranger transaction',
    })

    await expect(
      realizePlanTx(db, { userId: ownerId, planId, saleTransactionId: strangerTransactionId }),
    ).rejects.toThrow('Transazione non trovata.')
    await expect(
      realizePlanTx(db, { userId: ownerId, planId, saleTransactionId: randomUUID() }),
    ).rejects.toBeInstanceOf(AmortizationLifecycleError)
  })
})

describeIfReachable('reducePlanTx (Phase 78, D-03/AMORT-06)', () => {
  /**
   * Builds a plan anchored relative to TODAY (not a fixed 2026 date, unlike closePlanTx's tests
   * above): reducePlanTx's residual boundary is always the start of the CURRENT calendar month
   * (D-03 — "today, not any date derived from the plan itself"), so these fixtures must be
   * seeded relative to `new Date()` at test-run time. 3 months already "consumed" (before the
   * current month), 9 months remaining (current month inclusive onward) — matches the
   * subscription worked example (78-CONTEXT.md).
   */
  function currentMonthStart(): Date {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  }

  async function seedSubscriptionPlan(
    db: ReimbursementTestDb,
    input: { userId: string; subCategoryId: number },
  ): Promise<{ transactionId: string; planId: string; instalments: Array<{ date: Date; amount: string }> }> {
    const start = currentMonthStart()
    // Day 10, 3 months before the current month — instalments 1-3 (months -3..-1) land BEFORE
    // the current month; instalments 4-12 (current month onward) are the 9 "remaining" ones.
    const startDate = new Date(start.getFullYear(), start.getMonth() - 3, 10, 12, 0, 0)
    const { expenseId, transactionId } = await seedExpenseWithTransaction(db, {
      userId: input.userId,
      subCategoryId: input.subCategoryId,
      amount: '-1200.00',
      occurredAt: startDate,
      title: 'Software subscription',
    })
    const instalments = materializeInstalments('-1200.00', startDate, 12)
    const { planId } = await seedAmortizationPlan(db, {
      userId: input.userId,
      transactionId,
      expenseId,
      months: 12,
      instalments,
    })
    return { transactionId, planId, instalments }
  }

  it('normal re-spread: reduces the base by the refund and re-spreads the 9 remaining months proportionally (remainder on the month of reduction)', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const { planId, instalments } = await seedSubscriptionPlan(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
    })

    const { transactionId: refundTransactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: null,
      amount: '300.00',
      occurredAt: currentMonthStart(),
      title: 'Partial credit',
    })

    const result = await reducePlanTx(db, { userId, planId, refundTransactionId })

    // -1200.00 (original base) + 300.00 (refund) = -900.00.
    expect(toDecimal(result.newTotalAmount).equals(toDecimal('-900.00'))).toBe(true)
    expect(result.reSpreadInstalments).toHaveLength(9)

    const status = await loadPlanStatus(db, planId)
    expect(status).toBe('open')

    const totalAmount = await loadPlanTotalAmount(db, planId)
    expect(toDecimal(totalAmount!).equals(toDecimal('-900.00'))).toBe(true)

    // Re-spread math reuses materializeInstalments verbatim, anchored at the earliest cancelled
    // instalment's own date (instalment #4, index 3 in the original 12-row schedule) — remainder
    // lands on the FIRST new row (the month of reduction).
    const earliestCancelledDate = instalments[3]!.date
    const expected = materializeInstalments('-600.00', earliestCancelledDate, 9)
    const sortedResult = [...result.reSpreadInstalments].sort(
      (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
    )
    for (const [index, expectedInstalment] of expected.entries()) {
      expect(toDecimal(sortedResult[index]!.amount).equals(toDecimal(expectedInstalment.amount))).toBe(
        true,
      )
      expect(sortedResult[index]!.occurredAt.getTime()).toBe(expectedInstalment.date.getTime())
    }

    // New instalmentNumbers start at the MINIMUM cancelled number (4), sequential.
    const numbers = sortedResult.map((r) => r.instalmentNumber)
    expect(numbers).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12])

    // Total instalment row count is unchanged (3 untouched past + 9 re-spread future = 12).
    const allInstalments = await loadInstalments(db, planId)
    expect(allInstalments).toHaveLength(12)

    // D-03 "instead" mechanic: NO v2.8 reimbursement/refund link is created on this path.
    const { reimbursements, refunds } = await countReimbursementRows(db)
    expect(reimbursements).toBe(0)
    expect(refunds).toBe(0)
  })

  it('exact-residual boundary: refund exactly equals the residual — ALLOWED, every re-spread instalment materializes to 0.00, plan stays open', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const { planId } = await seedSubscriptionPlan(db, { userId, subCategoryId: taxonomy.essentialSubCategoryId })

    const { transactionId: refundTransactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: null,
      amount: '900.00', // exactly the residual (9 remaining months * -100.00)
      occurredAt: currentMonthStart(),
      title: 'Full residual credit',
    })

    const result = await reducePlanTx(db, { userId, planId, refundTransactionId })

    expect(toDecimal(result.newTotalAmount).equals(toDecimal('-300.00'))).toBe(true)
    expect(result.reSpreadInstalments).toHaveLength(9)
    for (const instalment of result.reSpreadInstalments) {
      expect(instalment.amount).toBe('0.00')
    }

    const status = await loadPlanStatus(db, planId)
    expect(status).toBe('open')
  })

  it('over-residual: refund one cent over the residual is BLOCKED with a message redirecting to "chiudi per vendita" — no write happens', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const { planId } = await seedSubscriptionPlan(db, { userId, subCategoryId: taxonomy.essentialSubCategoryId })

    const beforeInstalments = await loadInstalments(db, planId)
    const beforeTotalAmount = await loadPlanTotalAmount(db, planId)

    const { transactionId: refundTransactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: null,
      amount: '900.01', // one cent over the 900.00 residual
      occurredAt: currentMonthStart(),
      title: 'Over-residual credit',
    })

    await expect(reducePlanTx(db, { userId, planId, refundTransactionId })).rejects.toThrow(
      'chiudi per vendita',
    )
    await expect(
      reducePlanTx(db, { userId, planId, refundTransactionId }),
    ).rejects.toBeInstanceOf(AmortizationLifecycleError)

    // No write happened — instalments and totalAmount are untouched.
    const afterInstalments = await loadInstalments(db, planId)
    expect(afterInstalments).toEqual(beforeInstalments)
    const afterTotalAmount = await loadPlanTotalAmount(db, planId)
    expect(afterTotalAmount).toBe(beforeTotalAmount)

    const status = await loadPlanStatus(db, planId)
    expect(status).toBe('open')
  })

  it('self-link: refundTransactionId === the plan\'s own original transaction is REJECTED before any other check', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const { planId, transactionId } = await seedSubscriptionPlan(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
    })

    const beforeInstalments = await loadInstalments(db, planId)

    await expect(
      reducePlanTx(db, { userId, planId, refundTransactionId: transactionId }),
    ).rejects.toBeInstanceOf(AmortizationLifecycleError)

    const afterInstalments = await loadInstalments(db, planId)
    expect(afterInstalments).toEqual(beforeInstalments)
    const status = await loadPlanStatus(db, planId)
    expect(status).toBe('open')
  })

  it('a missing or foreign-owned refundTransactionId throws TRANSACTION_NOT_FOUND (T-78-06)', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId: ownerId } = await seedUser(db)
    const { userId: strangerId } = await seedUser(db)
    const taxonomy = await seedMinimalTaxonomy(db, ownerId)
    const { planId } = await seedSubscriptionPlan(db, { userId: ownerId, subCategoryId: taxonomy.essentialSubCategoryId })

    const { transactionId: strangerTransactionId } = await seedExpenseWithTransaction(db, {
      userId: strangerId,
      subCategoryId: null,
      amount: '50.00',
      occurredAt: new Date(),
      title: 'Stranger refund transaction',
    })

    await expect(
      reducePlanTx(db, { userId: ownerId, planId, refundTransactionId: strangerTransactionId }),
    ).rejects.toThrow('Transazione non trovata.')
  })
})
