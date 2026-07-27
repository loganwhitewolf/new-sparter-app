// Real-Postgres proof for getReimbursementList() (Phase 76 Plan 01, RMB-10/RMB-11): the
// dedicated /reimbursements list is Expense-anchor-only (T-76-05), numerically identical to
// computeReimbursementResidual (RMB-11 precision), deterministically ordered (RMB-10), and
// resolves the D-03 title fallback correctly.
//
// Requires local Docker Postgres (`yarn db:up`). Skips gracefully (console warning, no failure)
// when unreachable — same pattern as tests/reimbursement-residual.test.ts.
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { getReimbursementList as GetReimbursementList } from '@/lib/dal/reimbursement'
import type { computeReimbursementResidual as ComputeReimbursementResidual } from '@/lib/services/reimbursement'
import { reimbursement as reimbursementTable } from '@/lib/db/schema'
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
  seedUser,
} from './fixtures/reimbursement-seed'

const harness = await connectReimbursementTestDb()

let getReimbursementList: typeof GetReimbursementList
let computeReimbursementResidual: typeof ComputeReimbursementResidual

if (harness.ok) {
  // Same technique as tests/reimbursement-residual.test.ts: never let lib/dal/reimbursement.ts
  // build its own connection off the ambient process.env.DATABASE_URL -- feed it the harness's
  // own already-host-guarded client instead.
  vi.doMock('@/lib/db', () => ({ db: harness.db }))
  vi.resetModules()
  const dalModule = await import('@/lib/dal/reimbursement')
  const serviceModule = await import('@/lib/services/reimbursement')
  getReimbursementList = dalModule.getReimbursementList
  computeReimbursementResidual = serviceModule.computeReimbursementResidual
} else {
  console.warn(
    '[reimbursement-list] Local Postgres unreachable — run `yarn db:up` to enable this suite. Skipping.',
  )
}

const describeIfReachable = harness.ok ? describe : describe.skip

function requireHarnessDb(): ReimbursementTestDb {
  if (!harness.ok) {
    throw new Error('reimbursement-list: harness unreachable — this must be unreachable when skipped')
  }
  return harness.db
}

afterAll(async () => {
  if (harness.ok) {
    await harness.pool.end()
  }
})

describeIfReachable('getReimbursementList — Expense anchor only, precision, ordering, title fallback (Phase 76 Plan 01)', () => {
  let db: ReimbursementTestDb
  let userId: string
  let subCategoryId: number

  beforeEach(async () => {
    db = requireHarnessDb()
    await resetReimbursementFixtures(db)
    const seededUser = await seedUser(db)
    userId = seededUser.userId
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    subCategoryId = taxonomy.essentialSubCategoryId
  })

  it('T-76-05: returns ONLY the Expense-anchored reimbursement — a Group-anchored one for the SAME user never appears', async () => {
    const { expenseId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId,
      amount: '-100.00',
      occurredAt: new Date('2026-03-01T12:00:00Z'),
      title: 'Expense-anchored dinner',
    })
    const { reimbursementId: expenseReimbursementId } = await seedReimbursement(db, {
      userId,
      title: 'Expense-anchored dinner',
      expenseId,
      refundTransactionIds: [],
    })

    const { expenseId: memberA } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId,
      amount: '-300.00',
      occurredAt: new Date('2026-03-02T12:00:00Z'),
      title: 'Holiday flight',
    })
    const { expenseId: memberB } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId,
      amount: '-100.00',
      occurredAt: new Date('2026-03-03T12:00:00Z'),
      title: 'Holiday hotel',
    })
    const { groupId } = await seedExpenseGroup(db, {
      userId,
      title: 'Holiday',
      subCategoryId,
      memberExpenseIds: [memberA, memberB],
    })
    await seedReimbursementOnGroup(db, {
      userId,
      title: 'Holiday',
      expenseGroupId: groupId,
      refundTransactionIds: [],
    })

    const rows = await getReimbursementList(userId)

    expect(rows).toHaveLength(1)
    expect(rows[0]!.id).toBe(expenseReimbursementId)
  })

  it('RMB-11: per-row residual/state is numerically and categorically identical to computeReimbursementResidual', async () => {
    const { expenseId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId,
      amount: '-100.00',
      occurredAt: new Date('2026-03-05T12:00:00Z'),
      title: 'Dinner (2 refunds)',
    })
    const { transactionId: refund1 } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId,
      amount: '25.00',
      occurredAt: new Date('2026-03-06T12:00:00Z'),
      title: 'Repayment 1',
    })
    const { transactionId: refund2 } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId,
      amount: '30.00',
      occurredAt: new Date('2026-03-06T12:00:00Z'),
      title: 'Repayment 2',
    })
    const { reimbursementId } = await seedReimbursement(db, {
      userId,
      title: 'Dinner (2 refunds)',
      expenseId,
      refundTransactionIds: [refund1, refund2],
    })

    const rows = await getReimbursementList(userId)
    const row = rows.find((r) => r.id === reimbursementId)
    expect(row).toBeDefined()

    const directResult = await computeReimbursementResidual({ reimbursementId, userId })
    expect(directResult).toBeDefined()

    expect(toDecimal(row!.residual).equals(toDecimal(directResult!.residual))).toBe(true)
    expect(row!.state).toBe(directResult!.state)
  })

  it('RMB-10: two reimbursements sharing the identical anchor date order deterministically by id DESC', async () => {
    const sharedOccurredAt = new Date('2026-03-10T12:00:00Z')

    const { expenseId: expenseA } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId,
      amount: '-50.00',
      occurredAt: sharedOccurredAt,
      title: 'Same-date reimbursement A',
    })
    const { reimbursementId: reimbursementA } = await seedReimbursement(db, {
      userId,
      title: 'Same-date reimbursement A',
      expenseId: expenseA,
      refundTransactionIds: [],
    })

    const { expenseId: expenseB } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId,
      amount: '-60.00',
      occurredAt: sharedOccurredAt,
      title: 'Same-date reimbursement B',
    })
    const { reimbursementId: reimbursementB } = await seedReimbursement(db, {
      userId,
      title: 'Same-date reimbursement B',
      expenseId: expenseB,
      refundTransactionIds: [],
    })

    expect(reimbursementB).toBeGreaterThan(reimbursementA)

    const rows = await getReimbursementList(userId)
    const indexA = rows.findIndex((r) => r.id === reimbursementA)
    const indexB = rows.findIndex((r) => r.id === reimbursementB)

    expect(indexA).toBeGreaterThanOrEqual(0)
    expect(indexB).toBeGreaterThanOrEqual(0)
    // Higher id (B) sorts BEFORE lower id (A) — id DESC tie-break.
    expect(indexB).toBeLessThan(indexA)
  })

  it('D-03: an empty reimbursement.title falls back to the anchor Expense\'s title; a non-empty title wins unchanged', async () => {
    const { expenseId: fallbackExpenseId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId,
      amount: '-40.00',
      occurredAt: new Date('2026-03-15T12:00:00Z'),
      title: 'Anchor title for fallback',
    })
    const { reimbursementId: fallbackReimbursementId } = await seedReimbursement(db, {
      userId,
      title: 'Explicit title (will be cleared)',
      expenseId: fallbackExpenseId,
      refundTransactionIds: [],
    })

    await db
      .update(reimbursementTable)
      .set({ title: '' })
      .where(eq(reimbursementTable.id, fallbackReimbursementId))

    const { expenseId: explicitExpenseId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId,
      amount: '-45.00',
      occurredAt: new Date('2026-03-16T12:00:00Z'),
      title: 'Anchor title (unused)',
    })
    const { reimbursementId: explicitReimbursementId } = await seedReimbursement(db, {
      userId,
      title: 'Explicit title stays',
      expenseId: explicitExpenseId,
      refundTransactionIds: [],
    })

    const rows = await getReimbursementList(userId)

    const fallbackRow = rows.find((r) => r.id === fallbackReimbursementId)
    const explicitRow = rows.find((r) => r.id === explicitReimbursementId)

    expect(fallbackRow).toBeDefined()
    expect(fallbackRow!.displayTitle).toBe('Anchor title for fallback')

    expect(explicitRow).toBeDefined()
    expect(explicitRow!.displayTitle).toBe('Explicit title stays')
  })
})
