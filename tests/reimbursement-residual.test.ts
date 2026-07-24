// Real-Postgres proof for computeReimbursementResidual() / getReimbursementAggregates()
// (Phase 74 Plan 02, D-03, RMB-06): residual = Σoutflow + Σ(refunds linked so far), computed on
// the fly per reimbursement, NEVER a stored column. Sign convention: negative = still owed
// ("ancora dovuti €25"), zero = saldato, positive = surplus (never blocked).
//
// Requires local Docker Postgres (`yarn db:up`). Skips gracefully (console warning, no failure)
// when unreachable, so `vitest run` stays green in sandboxes without Docker — same pattern as
// tests/reimbursement-regression.test.ts.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getReimbursementAggregates } from '@/lib/dal/reimbursement'
import { computeReimbursementResidual } from '@/lib/services/reimbursement'
import { toDecimal } from '@/lib/utils/decimal'
import {
  connectReimbursementTestDb,
  resetReimbursementFixtures,
  type ReimbursementTestDb,
} from './helpers/reimbursement-test-db'
import {
  seedExpenseGroup,
  seedExpenseWithTransaction,
  seedMinimalTaxonomy,
  seedReimbursement,
  seedReimbursementOnGroup,
  seedSecondEssentialCategory,
  seedUser,
} from './fixtures/reimbursement-seed'

const harness = await connectReimbursementTestDb()

if (!harness.ok) {
  console.warn(
    '[reimbursement-residual] Local Postgres unreachable — run `yarn db:up` to enable this suite. Skipping.',
  )
}

const describeIfReachable = harness.ok ? describe : describe.skip

function requireHarnessDb(): ReimbursementTestDb {
  if (!harness.ok) {
    throw new Error('reimbursement-residual: harness unreachable — this must be unreachable when skipped')
  }
  return harness.db
}

afterAll(async () => {
  if (harness.ok) {
    await harness.pool.end()
  }
})

describeIfReachable('computeReimbursementResidual — Expense anchor (Task 1)', () => {
  let db: ReimbursementTestDb
  let userId: string
  let subCategoryId: number

  beforeAll(async () => {
    db = requireHarnessDb()
    await resetReimbursementFixtures(db)
    const seededUser = await seedUser(db)
    userId = seededUser.userId
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    subCategoryId = taxonomy.essentialSubCategoryId
  })

  it('zero linked refunds: residual equals the anchor\'s own outflow sum exactly, state=owed (RMB-06/empty)', async () => {
    const { expenseId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId,
      amount: '-100.00',
      occurredAt: new Date('2026-01-10T12:00:00Z'),
      title: 'Dinner (no refunds yet)',
    })
    const { reimbursementId } = await seedReimbursement(db, {
      userId,
      title: 'Dinner (no refunds yet)',
      expenseId,
      refundTransactionIds: [],
    })

    const result = await computeReimbursementResidual({ reimbursementId, userId })

    expect(result).toBeDefined()
    expect(toDecimal(result!.residual).equals(toDecimal('-100.00'))).toBe(true)
    expect(result!.state).toBe('owed')
  })

  it('3-of-4 friends repaid: anchor -100.00, refunds 25+25+25=75.00 -> residual=-25.00, state=owed (the exact "ancora dovuti €25" motivating example)', async () => {
    const { expenseId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId,
      amount: '-100.00',
      occurredAt: new Date('2026-01-11T12:00:00Z'),
      title: 'Dinner (3 of 4)',
    })

    const refundIds: string[] = []
    for (let i = 0; i < 3; i++) {
      const { transactionId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId,
        amount: '25.00',
        occurredAt: new Date('2026-01-12T12:00:00Z'),
        title: `Friend ${i + 1} repayment`,
      })
      refundIds.push(transactionId)
    }

    const { reimbursementId } = await seedReimbursement(db, {
      userId,
      title: 'Dinner (3 of 4)',
      expenseId,
      refundTransactionIds: refundIds,
    })

    const result = await computeReimbursementResidual({ reimbursementId, userId })

    expect(result).toBeDefined()
    expect(toDecimal(result!.residual).equals(toDecimal('-25.00'))).toBe(true)
    expect(result!.state).toBe('owed')
  })

  it('full repayment: the 4th friend also repays 25.00, total refunds=100.00 -> residual=0.00, state=settled (exact zero boundary)', async () => {
    const { expenseId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId,
      amount: '-100.00',
      occurredAt: new Date('2026-01-13T12:00:00Z'),
      title: 'Dinner (full repayment)',
    })

    const refundIds: string[] = []
    for (let i = 0; i < 4; i++) {
      const { transactionId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId,
        amount: '25.00',
        occurredAt: new Date('2026-01-14T12:00:00Z'),
        title: `Friend ${i + 1} repayment`,
      })
      refundIds.push(transactionId)
    }

    const { reimbursementId } = await seedReimbursement(db, {
      userId,
      title: 'Dinner (full repayment)',
      expenseId,
      refundTransactionIds: refundIds,
    })

    const result = await computeReimbursementResidual({ reimbursementId, userId })

    expect(result).toBeDefined()
    expect(toDecimal(result!.residual).equals(toDecimal('0.00'))).toBe(true)
    expect(result!.state).toBe('settled')
  })

  it('over-repayment: refunds sum to 120.00 -> residual=+20.00, state=surplus -- never throws, never blocked', async () => {
    const { expenseId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId,
      amount: '-100.00',
      occurredAt: new Date('2026-01-15T12:00:00Z'),
      title: 'Dinner (surplus)',
    })

    const { transactionId: refund1 } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId,
      amount: '100.00',
      occurredAt: new Date('2026-01-16T12:00:00Z'),
      title: 'Repayment 1',
    })
    const { transactionId: refund2 } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId,
      amount: '20.00',
      occurredAt: new Date('2026-01-16T12:00:00Z'),
      title: 'Repayment 2 (extra)',
    })

    const { reimbursementId } = await seedReimbursement(db, {
      userId,
      title: 'Dinner (surplus)',
      expenseId,
      refundTransactionIds: [refund1, refund2],
    })

    const result = await computeReimbursementResidual({ reimbursementId, userId })

    expect(result).toBeDefined()
    expect(toDecimal(result!.residual).equals(toDecimal('20.00'))).toBe(true)
    expect(result!.state).toBe('surplus')
  })

  it('order-independence: linking the same set of refunds in two different insertion orders yields the identical residual (residual is a SUM)', async () => {
    const { expenseId: expenseA } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId,
      amount: '-100.00',
      occurredAt: new Date('2026-01-17T12:00:00Z'),
      title: 'Order A',
    })
    const { transactionId: aRefund1 } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId,
      amount: '30.00',
      occurredAt: new Date('2026-01-18T12:00:00Z'),
      title: 'Order A repayment 1',
    })
    const { transactionId: aRefund2 } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId,
      amount: '45.00',
      occurredAt: new Date('2026-01-18T12:00:00Z'),
      title: 'Order A repayment 2',
    })
    const { reimbursementId: reimbursementA } = await seedReimbursement(db, {
      userId,
      title: 'Order A',
      expenseId: expenseA,
      refundTransactionIds: [aRefund1, aRefund2],
    })

    const { expenseId: expenseB } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId,
      amount: '-100.00',
      occurredAt: new Date('2026-01-19T12:00:00Z'),
      title: 'Order B',
    })
    const { transactionId: bRefund1 } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId,
      amount: '30.00',
      occurredAt: new Date('2026-01-20T12:00:00Z'),
      title: 'Order B repayment 1',
    })
    const { transactionId: bRefund2 } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId,
      amount: '45.00',
      occurredAt: new Date('2026-01-20T12:00:00Z'),
      title: 'Order B repayment 2',
    })
    // Same amounts (30.00 + 45.00) as reimbursementA, linked in the REVERSE insertion order.
    const { reimbursementId: reimbursementB } = await seedReimbursement(db, {
      userId,
      title: 'Order B',
      expenseId: expenseB,
      refundTransactionIds: [bRefund2, bRefund1],
    })

    const resultA = await computeReimbursementResidual({ reimbursementId: reimbursementA, userId })
    const resultB = await computeReimbursementResidual({ reimbursementId: reimbursementB, userId })

    expect(resultA).toBeDefined()
    expect(resultB).toBeDefined()
    expect(toDecimal(resultA!.residual).equals(toDecimal(resultB!.residual))).toBe(true)
    expect(resultA!.state).toBe(resultB!.state)
  })
})

describeIfReachable('computeReimbursementResidual — Group anchor + cross-user IDOR (Task 2)', () => {
  let db: ReimbursementTestDb
  let userId: string
  let subCategoryId: number
  let essentialNatureId: number

  beforeAll(async () => {
    db = requireHarnessDb()
    await resetReimbursementFixtures(db)
    const seededUser = await seedUser(db)
    userId = seededUser.userId
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    subCategoryId = taxonomy.essentialSubCategoryId
    essentialNatureId = taxonomy.essentialNatureId
  })

  it('Group anchor: 2-member group (-300.00/-100.00), one partial refund of 150.00 -> residual=-250.00, state=owed (exercises the Group-branch SUM, not just its existence)', async () => {
    const { expenseId: memberA } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId,
      amount: '-300.00',
      occurredAt: new Date('2026-02-01T12:00:00Z'),
      title: 'Holiday flight',
    })
    const { expenseId: memberB } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId,
      amount: '-100.00',
      occurredAt: new Date('2026-02-02T12:00:00Z'),
      title: 'Holiday hotel',
    })
    const { groupId } = await seedExpenseGroup(db, {
      userId,
      title: 'Holiday',
      subCategoryId,
      memberExpenseIds: [memberA, memberB],
    })
    const { transactionId: refundTransactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId,
      amount: '150.00',
      occurredAt: new Date('2026-02-03T12:00:00Z'),
      title: 'Partial holiday repayment',
    })
    const { reimbursementId } = await seedReimbursementOnGroup(db, {
      userId,
      title: 'Holiday',
      expenseGroupId: groupId,
      refundTransactionIds: [refundTransactionId],
    })

    const result = await computeReimbursementResidual({ reimbursementId, userId })

    expect(result).toBeDefined()
    expect(toDecimal(result!.residual).equals(toDecimal('-250.00'))).toBe(true)
    expect(result!.state).toBe('owed')
  })

  it('cross-user IDOR: getReimbursementAggregates and computeReimbursementResidual both return undefined for the first user\'s userId against the second user\'s reimbursementId', async () => {
    const { userId: secondUserId } = await seedUser(db, { name: 'Second User' })
    // direction/nature are global lookups (not user-scoped) — reuse essentialNatureId from the
    // first user's taxonomy instead of calling seedMinimalTaxonomy again, which would violate
    // direction/nature's unique(code) constraint on a second insert.
    const { subCategoryId: secondSubCategoryId } = await seedSecondEssentialCategory(db, {
      userId: secondUserId,
      natureId: essentialNatureId,
    })
    const { expenseId: secondExpenseId } = await seedExpenseWithTransaction(db, {
      userId: secondUserId,
      subCategoryId: secondSubCategoryId,
      amount: '-80.00',
      occurredAt: new Date('2026-02-05T12:00:00Z'),
      title: 'Second user expense',
    })
    const { reimbursementId: secondReimbursementId } = await seedReimbursement(db, {
      userId: secondUserId,
      title: 'Second user reimbursement',
      expenseId: secondExpenseId,
      refundTransactionIds: [],
    })

    const aggregates = await getReimbursementAggregates({
      reimbursementId: secondReimbursementId,
      userId,
    })
    const residual = await computeReimbursementResidual({
      reimbursementId: secondReimbursementId,
      userId,
    })

    expect(aggregates).toBeUndefined()
    expect(residual).toBeUndefined()

    // Sanity check: the same reimbursementId DOES resolve for its actual owner, proving the
    // undefined results above are genuinely an ownership mismatch, not a broken query.
    const ownedResidual = await computeReimbursementResidual({
      reimbursementId: secondReimbursementId,
      userId: secondUserId,
    })
    expect(ownedResidual).toBeDefined()
  })
})
