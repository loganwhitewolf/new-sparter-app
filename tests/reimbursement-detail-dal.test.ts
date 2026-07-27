// Real-Postgres proof for the /reimbursements/[id] detail DAL (Phase 76 Plan 05, RMB-11):
// getReimbursement (IDOR/Group-anchor guard), getReimbursementPanelDataById (shared assembly with
// getReimbursementPanelData), getReimbursementAnchorTransaction (D-08 frozen anchor set), and
// updateReimbursementTitle (ownership-scoped write, idempotent).
//
// Requires local Docker Postgres (`yarn db:up`). Skips gracefully (console warning, no failure)
// when unreachable — same pattern as tests/reimbursement-list.test.ts.
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  getReimbursement as GetReimbursement,
  getReimbursementAnchorTransaction as GetReimbursementAnchorTransaction,
  getReimbursementPanelData as GetReimbursementPanelData,
  getReimbursementPanelDataById as GetReimbursementPanelDataById,
  updateReimbursementTitle as UpdateReimbursementTitle,
} from '@/lib/dal/reimbursement'
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

let getReimbursement: typeof GetReimbursement
let getReimbursementPanelData: typeof GetReimbursementPanelData
let getReimbursementPanelDataById: typeof GetReimbursementPanelDataById
let getReimbursementAnchorTransaction: typeof GetReimbursementAnchorTransaction
let updateReimbursementTitle: typeof UpdateReimbursementTitle

if (harness.ok) {
  // Same technique as tests/reimbursement-list.test.ts: never let lib/dal/reimbursement.ts build
  // its own connection off the ambient process.env.DATABASE_URL -- feed it the harness's own
  // already-host-guarded client instead.
  vi.doMock('@/lib/db', () => ({ db: harness.db }))
  vi.resetModules()
  const dalModule = await import('@/lib/dal/reimbursement')
  getReimbursement = dalModule.getReimbursement
  getReimbursementPanelData = dalModule.getReimbursementPanelData
  getReimbursementPanelDataById = dalModule.getReimbursementPanelDataById
  getReimbursementAnchorTransaction = dalModule.getReimbursementAnchorTransaction
  updateReimbursementTitle = dalModule.updateReimbursementTitle
} else {
  console.warn(
    '[reimbursement-detail-dal] Local Postgres unreachable — run `yarn db:up` to enable this suite. Skipping.',
  )
}

const describeIfReachable = harness.ok ? describe : describe.skip

function requireHarnessDb(): ReimbursementTestDb {
  if (!harness.ok) {
    throw new Error('reimbursement-detail-dal: harness unreachable — this must be unreachable when skipped')
  }
  return harness.db
}

afterAll(async () => {
  if (harness.ok) {
    await harness.pool.end()
  }
})

describeIfReachable('reimbursement detail DAL — header, panel-by-id, anchor tx, edit-title (Phase 76 Plan 05)', () => {
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

  describe('getReimbursement', () => {
    it('returns the correct header for an owned Expense-anchored reimbursement', async () => {
      const { expenseId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId,
        amount: '-100.00',
        occurredAt: new Date('2026-04-01T12:00:00Z'),
        title: 'Dinner with friends',
      })
      const { reimbursementId } = await seedReimbursement(db, {
        userId,
        title: 'Custom title',
        expenseId,
        refundTransactionIds: [],
      })

      const header = await getReimbursement(userId, reimbursementId)

      expect(header).toBeDefined()
      expect(header!.id).toBe(reimbursementId)
      expect(header!.title).toBe('Custom title')
      expect(header!.displayTitle).toBe('Custom title')
      expect(header!.anchorExpenseId).toBe(expenseId)
      expect(header!.anchorTitle).toBe('Dinner with friends')
    })

    it('T-76-01: returns undefined for a foreign user\'s reimbursementId (cross-user IDOR)', async () => {
      const { expenseId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId,
        amount: '-50.00',
        occurredAt: new Date('2026-04-02T12:00:00Z'),
        title: 'Foreign reimbursement',
      })
      const { reimbursementId } = await seedReimbursement(db, {
        userId,
        title: 'Foreign reimbursement',
        expenseId,
        refundTransactionIds: [],
      })

      const { userId: otherUserId } = await seedUser(db)
      const header = await getReimbursement(otherUserId, reimbursementId)

      expect(header).toBeUndefined()
    })

    it('T-76-05: returns undefined for a Group-anchored reimbursement id even when owned by the SAME user', async () => {
      const { expenseId: memberA } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId,
        amount: '-200.00',
        occurredAt: new Date('2026-04-03T12:00:00Z'),
        title: 'Holiday flight',
      })
      const { expenseId: memberB } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId,
        amount: '-100.00',
        occurredAt: new Date('2026-04-04T12:00:00Z'),
        title: 'Holiday hotel',
      })
      const { groupId } = await seedExpenseGroup(db, {
        userId,
        title: 'Holiday',
        subCategoryId,
        memberExpenseIds: [memberA, memberB],
      })
      const { reimbursementId } = await seedReimbursementOnGroup(db, {
        userId,
        title: 'Holiday',
        expenseGroupId: groupId,
        refundTransactionIds: [],
      })

      const header = await getReimbursement(userId, reimbursementId)

      expect(header).toBeUndefined()
    })
  })

  describe('getReimbursementPanelDataById', () => {
    it('RMB-11: returns the identical shape as getReimbursementPanelData({anchor: {transactionId}}) for the same reimbursement', async () => {
      const { expenseId, transactionId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId,
        amount: '-100.00',
        occurredAt: new Date('2026-04-05T12:00:00Z'),
        title: 'Dinner (id-based lookup)',
      })
      const { transactionId: refund1 } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId,
        amount: '30.00',
        occurredAt: new Date('2026-04-06T12:00:00Z'),
        title: 'Repayment 1',
      })
      const { reimbursementId } = await seedReimbursement(db, {
        userId,
        title: 'Dinner (id-based lookup)',
        expenseId,
        refundTransactionIds: [refund1],
      })

      const byId = await getReimbursementPanelDataById({ userId, reimbursementId })
      const byAnchor = await getReimbursementPanelData({ userId, anchor: { transactionId } })

      expect(byId).toBeDefined()
      expect(byAnchor).toBeDefined()
      expect(byId).toEqual(byAnchor)
    })

    it('T-76-05: returns undefined for a Group-anchored reimbursement id', async () => {
      const { expenseId: memberA } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId,
        amount: '-150.00',
        occurredAt: new Date('2026-04-07T12:00:00Z'),
        title: 'Trip flight',
      })
      const { groupId } = await seedExpenseGroup(db, {
        userId,
        title: 'Trip',
        subCategoryId,
        memberExpenseIds: [memberA],
      })
      const { reimbursementId } = await seedReimbursementOnGroup(db, {
        userId,
        title: 'Trip',
        expenseGroupId: groupId,
        refundTransactionIds: [],
      })

      const result = await getReimbursementPanelDataById({ userId, reimbursementId })

      expect(result).toBeUndefined()
    })
  })

  describe('getReimbursementAnchorTransaction', () => {
    it('returns a transaction whose expense_id equals the reimbursement\'s expense_id, and it is genuinely the outflow side', async () => {
      const { expenseId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId,
        amount: '-80.00',
        occurredAt: new Date('2026-04-08T12:00:00Z'),
        title: 'Anchor tx lookup',
      })
      const { reimbursementId } = await seedReimbursement(db, {
        userId,
        title: 'Anchor tx lookup',
        expenseId,
        refundTransactionIds: [],
      })

      const anchorTx = await getReimbursementAnchorTransaction({ userId, reimbursementId })

      expect(anchorTx).toBeDefined()
      expect(toDecimal(anchorTx!.amount).isNegative()).toBe(true)
    })

    it('returns undefined for a foreign user\'s reimbursementId', async () => {
      const { expenseId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId,
        amount: '-80.00',
        occurredAt: new Date('2026-04-09T12:00:00Z'),
        title: 'Foreign anchor tx',
      })
      const { reimbursementId } = await seedReimbursement(db, {
        userId,
        title: 'Foreign anchor tx',
        expenseId,
        refundTransactionIds: [],
      })

      const { userId: otherUserId } = await seedUser(db)
      const anchorTx = await getReimbursementAnchorTransaction({ userId: otherUserId, reimbursementId })

      expect(anchorTx).toBeUndefined()
    })
  })

  describe('updateReimbursementTitle', () => {
    it('updates the row for the owning user, and a second call with the SAME title succeeds identically (idempotency)', async () => {
      const { expenseId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId,
        amount: '-60.00',
        occurredAt: new Date('2026-04-10T12:00:00Z'),
        title: 'Editable title',
      })
      const { reimbursementId } = await seedReimbursement(db, {
        userId,
        title: 'Original title',
        expenseId,
        refundTransactionIds: [],
      })

      await updateReimbursementTitle({ userId, reimbursementId, title: 'Updated title' })
      let rows = await db.select().from(reimbursementTable).where(eq(reimbursementTable.id, reimbursementId))
      expect(rows[0]!.title).toBe('Updated title')

      // Double-submit — same value again — must succeed identically, no crash.
      await updateReimbursementTitle({ userId, reimbursementId, title: 'Updated title' })
      rows = await db.select().from(reimbursementTable).where(eq(reimbursementTable.id, reimbursementId))
      expect(rows[0]!.title).toBe('Updated title')
    })

    it('T-76-02: throws \'Rimborso non trovato.\' for a mismatched userId and leaves the title unchanged', async () => {
      const { expenseId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId,
        amount: '-60.00',
        occurredAt: new Date('2026-04-11T12:00:00Z'),
        title: 'Concurrency guard',
      })
      const { reimbursementId } = await seedReimbursement(db, {
        userId,
        title: 'Original title',
        expenseId,
        refundTransactionIds: [],
      })

      const { userId: otherUserId } = await seedUser(db)

      await expect(
        updateReimbursementTitle({ userId: otherUserId, reimbursementId, title: 'Hijacked title' }),
      ).rejects.toThrow('Rimborso non trovato.')

      const rows = await db.select().from(reimbursementTable).where(eq(reimbursementTable.id, reimbursementId))
      expect(rows[0]!.title).toBe('Original title')
    })
  })
})
