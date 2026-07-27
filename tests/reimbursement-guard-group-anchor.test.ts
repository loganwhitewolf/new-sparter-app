// Real-Postgres regression proof for updateTransaction()'s amount-edit pair guard against a
// GROUP-anchored reimbursement (Phase 74-04 gap closure, CR-01/CR-02 in 74-REVIEW.md).
//
// tests/transaction-edit.test.ts is fully DB-mocked and never constructs a Group-anchor
// scenario — that blind spot is how CR-01/CR-02 slipped past review the first time (the mock
// only ever supplies canned `asAnchorReimbursementId`/`anchorAmount` values, so a bug in the
// REAL SQL that resolves a Group anchor is invisible to it). This suite exercises the real
// updateTransaction() service function against the same local Postgres harness used by
// tests/reimbursement-regression.test.ts / tests/reimbursement-residual.test.ts.
//
// Requires local Docker Postgres (`yarn db:up`). Skips gracefully (console warning, no failure)
// when unreachable, so `vitest run` stays green in sandboxes without Docker.
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { transaction as transactionTable } from '@/lib/db/schema'
import type { updateTransaction as UpdateTransaction } from '@/lib/services/transaction-edit'
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

let updateTransaction: typeof UpdateTransaction

if (harness.ok) {
  // Same technique as tests/reimbursement-residual.test.ts: never let
  // lib/services/transaction-edit.ts (or the expense-reconciliation helpers it calls) build
  // their own connection off the ambient process.env.DATABASE_URL — feed them the harness's
  // own already-host-guarded client instead.
  vi.doMock('@/lib/db', () => ({ db: harness.db }))
  vi.resetModules()
  const serviceModule = await import('@/lib/services/transaction-edit')
  updateTransaction = serviceModule.updateTransaction
} else {
  console.warn(
    '[reimbursement-guard-group-anchor] Local Postgres unreachable — run `yarn db:up` to enable this suite. Skipping.',
  )
}

const describeIfReachable = harness.ok ? describe : describe.skip

function requireHarnessDb(): ReimbursementTestDb {
  if (!harness.ok) {
    throw new Error(
      'reimbursement-guard-group-anchor: harness unreachable — this must be unreachable when skipped',
    )
  }
  return harness.db
}

afterAll(async () => {
  if (harness.ok) {
    await harness.pool.end()
  }
})

async function readTransactionAmount(db: ReimbursementTestDb, transactionId: string): Promise<string> {
  const rows = await db
    .select({ amount: transactionTable.amount })
    .from(transactionTable)
    .where(eq(transactionTable.id, transactionId))
  return rows[0]!.amount
}

describeIfReachable('Group-anchor amount-edit pair guard (Phase 74-04, CR-01/CR-02)', () => {
  it(
    'CR-01: blocks a same-sign amount edit on a member transaction of a GROUP-anchored ' +
      'reimbursement (previously unguarded — reimbursementId resolved null and the write proceeded)',
    async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      const taxonomy = await seedMinimalTaxonomy(db, userId)
      const occurredAt = new Date(2026, 0, 12, 12, 0, 0)

      const { expenseId: member1ExpenseId, transactionId: member1TransactionId } =
        await seedExpenseWithTransaction(db, {
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
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '200.00',
        occurredAt,
        title: 'Rimborso vacanza',
      })

      await seedReimbursementOnGroup(db, {
        userId,
        title: 'Vacanza in montagna',
        expenseGroupId: groupId,
        refundTransactionIds: [refundTransactionId],
      })

      // +50.00 matches the refund's sign (+200.00) — must be blocked, exactly as an
      // Expense-anchored member edit already is.
      await expect(
        updateTransaction({ userId, transactionId: member1TransactionId, amount: '50.00' }),
      ).rejects.toThrow('Scollega prima il rimborso')

      // Hard-block proof: the transaction's amount is untouched in the DB, not partially written.
      const amountAfter = await readTransactionAmount(db, member1TransactionId)
      expect(toDecimal(amountAfter).equals('-300.00')).toBe(true)
    },
  )

  it(
    'a valid opposite-sign amount edit on a group-anchor member PASSES and is persisted',
    async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      const taxonomy = await seedMinimalTaxonomy(db, userId)
      const occurredAt = new Date(2026, 0, 12, 12, 0, 0)

      const { expenseId: member1ExpenseId, transactionId: member1TransactionId } =
        await seedExpenseWithTransaction(db, {
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
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '200.00',
        occurredAt,
        title: 'Rimborso vacanza',
      })

      await seedReimbursementOnGroup(db, {
        userId,
        title: 'Vacanza in montagna',
        expenseGroupId: groupId,
        refundTransactionIds: [refundTransactionId],
      })

      // -350.00 stays opposite-sign of the +200.00 refund total — allowed.
      await expect(
        updateTransaction({ userId, transactionId: member1TransactionId, amount: '-350.00' }),
      ).resolves.toEqual({ success: true })

      const amountAfter = await readTransactionAmount(db, member1TransactionId)
      expect(toDecimal(amountAfter).equals('-350.00')).toBe(true)
    },
  )

  it(
    'CR-02: a refund edit on a GROUP-anchored reimbursement evaluates against the anchor\'s ' +
      "real ΣmemberOutflow, not zero — an opposite-sign edit passes",
    async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      const taxonomy = await seedMinimalTaxonomy(db, userId)
      const occurredAt = new Date(2026, 0, 12, 12, 0, 0)

      // ΣmemberOutflow = -300.00 + -100.00 = -400.00 (the anchor's real magnitude CR-02 must
      // resolve, instead of silently defaulting to 0).
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
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '200.00',
        occurredAt,
        title: 'Rimborso vacanza',
      })

      await seedReimbursementOnGroup(db, {
        userId,
        title: 'Vacanza in montagna',
        expenseGroupId: groupId,
        refundTransactionIds: [refundTransactionId],
      })

      // Pre-fix (CR-02) behaviour: anchorAmount silently resolved to 0 for a Group anchor, so
      // otherSum collapsed to 0 (neither >0 nor <0) and the oppositeSign check was ALWAYS false
      // — every refund edit, including this valid one, was wrongly rejected. With the fix,
      // otherSum = -400.00 (correctly negative), so this +150.00 edit (still positive) is
      // opposite-sign and must be ALLOWED.
      await expect(
        updateTransaction({ userId, transactionId: refundTransactionId, amount: '150.00' }),
      ).resolves.toEqual({ success: true })

      const amountAfter = await readTransactionAmount(db, refundTransactionId)
      expect(toDecimal(amountAfter).equals('150.00')).toBe(true)
    },
  )

  it(
    'CR-02: a same-sign refund edit on a GROUP-anchored reimbursement is still correctly blocked',
    async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
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
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '200.00',
        occurredAt,
        title: 'Rimborso vacanza',
      })

      await seedReimbursementOnGroup(db, {
        userId,
        title: 'Vacanza in montagna',
        expenseGroupId: groupId,
        refundTransactionIds: [refundTransactionId],
      })

      // -50.00 matches the anchor's negative sign (-400.00) — must be blocked.
      await expect(
        updateTransaction({ userId, transactionId: refundTransactionId, amount: '-50.00' }),
      ).rejects.toThrow('Scollega prima il rimborso')

      const amountAfter = await readTransactionAmount(db, refundTransactionId)
      expect(toDecimal(amountAfter).equals('200.00')).toBe(true)
    },
  )

  it(
    'sanity check: the Expense-anchor N=1 refund-edit path (unchanged by this fix) still ' +
      'evaluates correctly against real Postgres',
    async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      const taxonomy = await seedMinimalTaxonomy(db, userId)
      const occurredAt = new Date(2026, 0, 15, 12, 0, 0)

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

      // otherSum = anchorAmount (-100.00) + otherRefundsSum (0, no other refunds) = -100.00.
      // +75.00 stays opposite-sign — allowed.
      await expect(
        updateTransaction({ userId, transactionId: refundTransactionId, amount: '75.00' }),
      ).resolves.toEqual({ success: true })

      const amountAfter = await readTransactionAmount(db, refundTransactionId)
      expect(toDecimal(amountAfter).equals('75.00')).toBe(true)
    },
  )
})
