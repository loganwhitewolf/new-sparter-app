// Real-Postgres regression proof for Phase 75 Plan 02 (D-05/D-06/D-08 generalization of the
// reimbursement write path — create-or-append, dual anchor shape, multi-exclusion candidate
// loading). Exercises the REAL createPair()/createPairTx() service and the REAL
// getEligibleCounterparts()/getGroupOccurrenceInterval() DAL functions against the same local
// Postgres harness used by tests/reimbursement-regression.test.ts.
//
// Requires local Docker Postgres (`yarn db:up`). Skips gracefully (console warning, no failure)
// when unreachable, so `vitest run` stays green in sandboxes without Docker.
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { verifySession } from '@/lib/dal/auth'
import {
  reimbursement as reimbursementTable,
  reimbursementAnchorTransaction as reimbursementAnchorTransactionTable,
  reimbursementRefund as reimbursementRefundTable,
} from '@/lib/db/schema'
import type { createPair as CreatePair } from '@/lib/services/transaction-pairs'
import {
  connectReimbursementTestDb,
  resetReimbursementFixtures,
  type ReimbursementTestDb,
} from './helpers/reimbursement-test-db'
import {
  seedExpenseGroup,
  seedExpenseWithTransaction,
  seedMinimalTaxonomy,
  seedUser,
} from './fixtures/reimbursement-seed'

vi.mock('@/lib/dal/auth', () => ({ verifySession: vi.fn() }))
vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))

const harness = await connectReimbursementTestDb()

if (!harness.ok) {
  console.warn(
    '[reimbursement-phase-75] Local Postgres unreachable — run `yarn db:up` to enable this suite. Skipping.',
  )
}

const describeIfReachable = harness.ok ? describe : describe.skip

// createPair — the live write path under test in the Task 1 block below. Same technique as
// tests/reimbursement-regression.test.ts: never let lib/services/transaction-pairs.ts build its
// own connection off the ambient process.env.DATABASE_URL — feed it the harness's own
// already-host-guarded client instead.
let createPair: typeof CreatePair

if (harness.ok) {
  vi.doMock('@/lib/db', () => ({ db: harness.db }))
  vi.resetModules()
  const servicesModule = await import('@/lib/services/transaction-pairs')
  createPair = servicesModule.createPair
}

function requireHarnessDb(): ReimbursementTestDb {
  if (!harness.ok) {
    throw new Error('reimbursement-phase-75: harness unreachable — this must be unreachable when skipped')
  }
  return harness.db
}

afterAll(async () => {
  if (harness.ok) {
    await harness.pool.end()
  }
})

// ---------------------------------------------------------------------------------------------
// Task 1 — createPairTx: create-or-append, dual anchor shape (Expense or Group)
// ---------------------------------------------------------------------------------------------
describeIfReachable(
  'createPairTx create-or-append, dual anchor shape (Phase 75 Plan 02 Task 1, D-05/D-06/D-08)',
  () => {
    it('Test 1 (dinner 1:N append): linking a second refund to an anchor that already has a reimbursement appends instead of throwing 23505', async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      vi.mocked(verifySession).mockResolvedValue({ userId } as never)
      const taxonomy = await seedMinimalTaxonomy(db, userId)
      const occurredAt = new Date(2026, 0, 12, 12, 0, 0)

      const { expenseId: anchorExpenseId, transactionId: anchorTransactionId } =
        await seedExpenseWithTransaction(db, {
          userId,
          subCategoryId: taxonomy.essentialSubCategoryId,
          amount: '-90.00',
          occurredAt,
          title: 'Cena in tre',
        })
      const { transactionId: refundATransactionId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.incomeSubCategoryId,
        amount: '30.00',
        occurredAt,
        title: 'Rimborso Carlo',
      })
      const { transactionId: refundBTransactionId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.incomeSubCategoryId,
        amount: '30.00',
        occurredAt,
        title: 'Rimborso Giulia',
      })

      // First link — CREATE.
      await createPair({
        userId,
        anchor: { transactionId: anchorTransactionId },
        counterpartId: refundATransactionId,
      })

      // Second link on the SAME anchor — must APPEND, never throw 23505.
      await expect(
        createPair({
          userId,
          anchor: { transactionId: anchorTransactionId },
          counterpartId: refundBTransactionId,
        }),
      ).resolves.toBeDefined()

      const reimbursementRows = await db
        .select({ id: reimbursementTable.id })
        .from(reimbursementTable)
        .where(eq(reimbursementTable.expenseId, anchorExpenseId))
      expect(reimbursementRows).toHaveLength(1)

      const refundRows = await db
        .select({ id: reimbursementRefundTable.id, transactionId: reimbursementRefundTable.transactionId })
        .from(reimbursementRefundTable)
        .where(eq(reimbursementRefundTable.reimbursementId, reimbursementRows[0]!.id))
      expect(refundRows).toHaveLength(2)
      expect(refundRows.map((r) => r.transactionId).sort()).toEqual(
        [refundATransactionId, refundBTransactionId].sort(),
      )
    })

    it('Test 2 (Group-anchor create): anchoring on an Expense Group creates a reimbursement with expenseGroupId set and expenseId null, with NO reimbursement_anchor_transaction row', async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      vi.mocked(verifySession).mockResolvedValue({ userId } as never)
      const taxonomy = await seedMinimalTaxonomy(db, userId)
      const occurredAt = new Date(2026, 0, 12, 12, 0, 0)

      const { expenseId: member1ExpenseId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '-300.00',
        occurredAt,
        title: 'Alloggio montagna',
      })
      const { expenseId: member2ExpenseId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '-100.00',
        occurredAt,
        title: 'Trasporto montagna',
      })
      const { groupId } = await seedExpenseGroup(db, {
        userId,
        title: 'Vacanza in montagna',
        subCategoryId: taxonomy.essentialSubCategoryId,
        memberExpenseIds: [member1ExpenseId, member2ExpenseId],
      })

      const { transactionId: refundTransactionId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.incomeSubCategoryId,
        amount: '150.00',
        occurredAt,
        title: 'Rimborso vacanza (Marco)',
      })

      await createPair({
        userId,
        anchor: { groupId },
        counterpartId: refundTransactionId,
      })

      const reimbursementRows = await db
        .select({
          id: reimbursementTable.id,
          expenseId: reimbursementTable.expenseId,
          expenseGroupId: reimbursementTable.expenseGroupId,
        })
        .from(reimbursementTable)
        .where(eq(reimbursementTable.expenseGroupId, groupId))
      expect(reimbursementRows).toHaveLength(1)
      expect(reimbursementRows[0]!.expenseId).toBeNull()
      expect(reimbursementRows[0]!.expenseGroupId).toBe(groupId)

      const refundRows = await db
        .select({ id: reimbursementRefundTable.id })
        .from(reimbursementRefundTable)
        .where(eq(reimbursementRefundTable.reimbursementId, reimbursementRows[0]!.id))
      expect(refundRows).toHaveLength(1)

      // Group anchors are out of D-08's scope — no frozen-set row is ever written for one.
      const anchorTransactionRows = await db
        .select({ id: reimbursementAnchorTransactionTable.id })
        .from(reimbursementAnchorTransactionTable)
        .where(eq(reimbursementAnchorTransactionTable.reimbursementId, reimbursementRows[0]!.id))
      expect(anchorTransactionRows).toHaveLength(0)
    })

    it('Test 3 (Group-anchor append): a second refund on the SAME group anchor appends to the existing reimbursement', async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      vi.mocked(verifySession).mockResolvedValue({ userId } as never)
      const taxonomy = await seedMinimalTaxonomy(db, userId)
      const occurredAt = new Date(2026, 0, 12, 12, 0, 0)

      const { expenseId: member1ExpenseId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '-300.00',
        occurredAt,
        title: 'Alloggio montagna',
      })
      const { expenseId: member2ExpenseId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '-100.00',
        occurredAt,
        title: 'Trasporto montagna',
      })
      const { groupId } = await seedExpenseGroup(db, {
        userId,
        title: 'Vacanza in montagna',
        subCategoryId: taxonomy.essentialSubCategoryId,
        memberExpenseIds: [member1ExpenseId, member2ExpenseId],
      })

      const { transactionId: refundATransactionId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.incomeSubCategoryId,
        amount: '150.00',
        occurredAt,
        title: 'Rimborso vacanza (Marco)',
      })
      const { transactionId: refundBTransactionId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.incomeSubCategoryId,
        amount: '250.00',
        occurredAt,
        title: 'Rimborso vacanza (Sara)',
      })

      await createPair({ userId, anchor: { groupId }, counterpartId: refundATransactionId })
      await expect(
        createPair({ userId, anchor: { groupId }, counterpartId: refundBTransactionId }),
      ).resolves.toBeDefined()

      const reimbursementRows = await db
        .select({ id: reimbursementTable.id })
        .from(reimbursementTable)
        .where(eq(reimbursementTable.expenseGroupId, groupId))
      expect(reimbursementRows).toHaveLength(1)

      const refundRows = await db
        .select({ transactionId: reimbursementRefundTable.transactionId })
        .from(reimbursementRefundTable)
        .where(eq(reimbursementRefundTable.reimbursementId, reimbursementRows[0]!.id))
      expect(refundRows).toHaveLength(2)
      expect(refundRows.map((r) => r.transactionId).sort()).toEqual(
        [refundATransactionId, refundBTransactionId].sort(),
      )
    })

    it('Test 4 (invariant preserved): a Group anchor whose resolved outflow total is non-negative is still rejected by assertOutflowAnchorAmount', async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      vi.mocked(verifySession).mockResolvedValue({ userId } as never)
      const taxonomy = await seedMinimalTaxonomy(db, userId)
      const occurredAt = new Date(2026, 0, 12, 12, 0, 0)

      // Both member expenses are POSITIVE (an income group, not an outflow) — the group's
      // resolved sum is non-negative, so the anchor-level sign check must still reject it, even
      // though the anchor is now a Group rather than a single transaction (RMB-03 invariant).
      const { expenseId: member1ExpenseId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.incomeSubCategoryId,
        amount: '50.00',
        occurredAt,
        title: 'Entrata montagna 1',
      })
      const { expenseId: member2ExpenseId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.incomeSubCategoryId,
        amount: '25.00',
        occurredAt,
        title: 'Entrata montagna 2',
      })
      const { groupId } = await seedExpenseGroup(db, {
        userId,
        title: 'Gruppo non-uscita',
        subCategoryId: taxonomy.incomeSubCategoryId,
        memberExpenseIds: [member1ExpenseId, member2ExpenseId],
      })

      const { transactionId: refundTransactionId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.incomeSubCategoryId,
        amount: '10.00',
        occurredAt,
        title: 'Entrata correlata',
      })

      await expect(
        createPair({ userId, anchor: { groupId }, counterpartId: refundTransactionId }),
      ).rejects.toThrow('deve essere un’uscita')

      const reimbursementRows = await db
        .select({ id: reimbursementTable.id })
        .from(reimbursementTable)
        .where(eq(reimbursementTable.expenseGroupId, groupId))
      expect(reimbursementRows).toHaveLength(0)
    })
  },
)
