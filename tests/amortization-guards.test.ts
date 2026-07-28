// Real-Postgres regression proof for getAmortizationEligibility (Phase 77, D-04..D-07 +
// outflow-only). Uses the same local Postgres harness as tests/reimbursement-regression.test.ts —
// amortization-guards.ts never imports the `@/lib/db` singleton at runtime (only the `DbOrTx`
// type), so no vi.doMock('@/lib/db', ...) indirection is needed here: the harness's own
// already-host-guarded db client is passed directly as the `tx` parameter.
//
// Requires local Docker Postgres (`yarn db:up`). Skips gracefully (console warning, no failure)
// when unreachable, so `vitest run` stays green in sandboxes without Docker.
import { count, eq } from 'drizzle-orm'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { getAmortizationEligibility } from '@/lib/services/amortization-guards'
import type { activatePlanTx as ActivatePlanTx } from '@/lib/services/amortization-activation'
import { amortizationPlan as amortizationPlanTable } from '@/lib/db/schema'
import {
  connectReimbursementTestDb,
  resetReimbursementFixtures,
  type ReimbursementTestDb,
} from './helpers/reimbursement-test-db'
import {
  seedAmortizationPlan,
  seedExpenseGroup,
  seedExpenseWithTransaction,
  seedMinimalTaxonomy,
  seedReimbursement,
  seedUser,
} from './fixtures/reimbursement-seed'

const harness = await connectReimbursementTestDb()

// activatePlanTx composes applyDetachCleanupTx (lib/services/transaction-detach.ts), which
// imports the REAL `db` singleton at module scope (it also exports a non-tx-accepting wrapper
// that uses it) — same technique as tests/reimbursement-guard-group-anchor.test.ts: never let it
// build its own connection off the ambient process.env.DATABASE_URL.
let activatePlanTx: typeof ActivatePlanTx

if (harness.ok) {
  vi.doMock('@/lib/db', () => ({ db: harness.db }))
  vi.resetModules()
  const activationModule = await import('@/lib/services/amortization-activation')
  activatePlanTx = activationModule.activatePlanTx
} else {
  console.warn(
    '[amortization-guards] Local Postgres unreachable — run `yarn db:up` to enable this suite. Skipping.',
  )
}

const describeIfReachable = harness.ok ? describe : describe.skip

function requireHarnessDb(): ReimbursementTestDb {
  if (!harness.ok) {
    throw new Error('amortization-guards: harness unreachable — this must be unreachable when skipped')
  }
  return harness.db
}

async function amortizationPlanCountFor(db: ReimbursementTestDb, transactionId: string): Promise<number> {
  const rows = await db
    .select({ count: count() })
    .from(amortizationPlanTable)
    .where(eq(amortizationPlanTable.transactionId, transactionId))
  return Number(rows[0]?.count ?? 0)
}

afterAll(async () => {
  if (harness.ok) {
    await harness.pool.end()
  }
})

describeIfReachable('getAmortizationEligibility (Phase 77, D-04..D-07 + outflow-only)', () => {
  it('a transaction that is a reimbursement_refund row is ineligible: reimbursement', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const occurredAt = new Date(2026, 0, 12, 12, 0, 0)

    const { expenseId: outflowExpenseId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-100.00',
      occurredAt,
      title: 'Amazon order',
    })
    const { transactionId: refundTransactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '50.00',
      occurredAt,
      title: 'Amazon refund',
    })
    await seedReimbursement(db, {
      userId,
      title: 'Amazon order',
      expenseId: outflowExpenseId,
      refundTransactionIds: [refundTransactionId],
    })

    const result = await getAmortizationEligibility(db, { userId, transactionId: refundTransactionId })
    expect(result).toEqual({ eligible: false, reason: 'reimbursement' })

    // Acceptance criteria: activation must be blocked server-side and write nothing.
    await expect(
      activatePlanTx(db, { userId, transactionId: refundTransactionId, months: 3 }),
    ).rejects.toThrow(
      'Non puoi ammortizzare una transazione coinvolta in un rimborso. Scollega il rimborso prima.',
    )
    expect(await amortizationPlanCountFor(db, refundTransactionId)).toBe(0)
  })

  it('a transaction whose expense.id matches a reimbursement.expenseId (anchor) is ineligible: reimbursement', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const occurredAt = new Date(2026, 0, 12, 12, 0, 0)

    const { expenseId: outflowExpenseId, transactionId: outflowTransactionId } =
      await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '-100.00',
        occurredAt,
        title: 'Amazon order',
      })
    const { transactionId: refundTransactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '50.00',
      occurredAt,
      title: 'Amazon refund',
    })
    await seedReimbursement(db, {
      userId,
      title: 'Amazon order',
      expenseId: outflowExpenseId,
      refundTransactionIds: [refundTransactionId],
    })

    // The ANCHOR transaction itself (not the refund) — its expense.id matches
    // reimbursement.expenseId.
    const result = await getAmortizationEligibility(db, { userId, transactionId: outflowTransactionId })
    expect(result).toEqual({ eligible: false, reason: 'reimbursement' })
  })

  it('a transaction with an existing amortization_plan row is ineligible: already-amortized', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const occurredAt = new Date(2026, 0, 12, 12, 0, 0)

    const { expenseId, transactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-1000.00',
      occurredAt,
      title: 'Already amortized purchase',
    })
    await seedAmortizationPlan(db, {
      userId,
      transactionId,
      expenseId,
      months: 2,
      instalments: [
        { date: occurredAt, amount: '-500.00' },
        { date: occurredAt, amount: '-500.00' },
      ],
    })

    const result = await getAmortizationEligibility(db, { userId, transactionId })
    expect(result).toEqual({ eligible: false, reason: 'already-amortized' })

    const planCountBefore = await amortizationPlanCountFor(db, transactionId)
    await expect(activatePlanTx(db, { userId, transactionId, months: 3 })).rejects.toThrow(
      'Questa transazione ha già una pianificazione attiva. Rimuovila prima di crearne una nuova.',
    )
    // No SECOND plan row was written — the existing one is untouched.
    expect(await amortizationPlanCountFor(db, transactionId)).toBe(planCountBefore)
  })

  it('a transaction whose expense is in an expense_group_membership is ineligible: expense-group', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const occurredAt = new Date(2026, 0, 12, 12, 0, 0)

    const { expenseId, transactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-300.00',
      occurredAt,
      title: 'Alloggio montagna',
    })
    await seedExpenseGroup(db, {
      userId,
      title: 'Vacanza in montagna',
      subCategoryId: taxonomy.essentialSubCategoryId,
      memberExpenseIds: [expenseId],
    })

    const result = await getAmortizationEligibility(db, { userId, transactionId })
    expect(result).toEqual({ eligible: false, reason: 'expense-group' })

    await expect(activatePlanTx(db, { userId, transactionId, months: 3 })).rejects.toThrow(
      'Non puoi ammortizzare una transazione che fa parte di un gruppo di spese. Rimuovila dal gruppo prima.',
    )
    expect(await amortizationPlanCountFor(db, transactionId)).toBe(0)
  })

  it('a positive-amount (inflow) transaction is ineligible: not-outflow', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const occurredAt = new Date(2026, 0, 12, 12, 0, 0)

    const { transactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.incomeSubCategoryId,
      amount: '45.90',
      occurredAt,
      title: 'Stipendio',
    })

    const result = await getAmortizationEligibility(db, { userId, transactionId })
    expect(result).toEqual({ eligible: false, reason: 'not-outflow' })

    await expect(activatePlanTx(db, { userId, transactionId, months: 3 })).rejects.toThrow(
      'Puoi ammortizzare solo transazioni in uscita.',
    )
    expect(await amortizationPlanCountFor(db, transactionId)).toBe(0)
  })

  it('an outflow too small to split over the minimum 2 months is ineligible: too-small', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const occurredAt = new Date(2026, 0, 12, 12, 0, 0)

    // -0.01 / 2 months rounds (ROUND_DOWN) to 0.00 per instalment — below the €0.01 floor.
    const { transactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-0.01',
      occurredAt,
      title: 'Micro purchase',
    })

    const result = await getAmortizationEligibility(db, { userId, transactionId })
    expect(result).toEqual({ eligible: false, reason: 'too-small', requiredPerMonth: '0.00' })

    await expect(activatePlanTx(db, { userId, transactionId, months: 2 })).rejects.toThrow(
      'Importo troppo piccolo. Ammortizzare su 2 mesi richiederebbe rate di €0.00, impossibili.',
    )
    expect(await amortizationPlanCountFor(db, transactionId)).toBe(0)
  })

  it('a transaction with none of the above is eligible', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const occurredAt = new Date(2026, 0, 12, 12, 0, 0)

    const { transactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-1000.00',
      occurredAt,
      title: 'Eligible purchase',
    })

    const result = await getAmortizationEligibility(db, { userId, transactionId })
    expect(result).toEqual({ eligible: true })
  })
})
