// Real-Postgres regression proof for Phase 75 Plans 02+03 (D-05/D-06/D-08 generalization of the
// reimbursement write path — create-or-append, dual anchor shape, multi-exclusion candidate
// loading — plus D-10's unlink-restores-baseline lifecycle). Exercises the REAL
// createPair()/createPairTx()/deletePairByTransactionId()/deleteReimbursementForAnchor()
// service and the REAL getEligibleCounterparts()/getGroupOccurrenceInterval() DAL functions
// against the same local Postgres harness used by tests/reimbursement-regression.test.ts.
//
// Requires local Docker Postgres (`yarn db:up`). Skips gracefully (console warning, no failure)
// when unreachable, so `vitest run` stays green in sandboxes without Docker.
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { verifySession } from '@/lib/dal/auth'
import {
  expense as expenseTable,
  reimbursement as reimbursementTable,
  reimbursementAnchorTransaction as reimbursementAnchorTransactionTable,
  reimbursementRefund as reimbursementRefundTable,
  reimbursementRefundSnapshot as reimbursementRefundSnapshotTable,
  transaction as transactionTable,
} from '@/lib/db/schema'
import type {
  getEligibleCounterparts as GetEligibleCounterparts,
  getGroupOccurrenceInterval as GetGroupOccurrenceInterval,
} from '@/lib/dal/transaction-pairs'
import type { getReimbursementPanelData as GetReimbursementPanelData } from '@/lib/dal/reimbursement'
import type { computeReimbursementResidual as ComputeReimbursementResidual } from '@/lib/services/reimbursement'
import type {
  createPair as CreatePair,
  deletePairByTransactionId as DeletePairByTransactionId,
  deleteReimbursementForAnchor as DeleteReimbursementForAnchor,
} from '@/lib/services/transaction-pairs'
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
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const harness = await connectReimbursementTestDb()

if (!harness.ok) {
  console.warn(
    '[reimbursement-phase-75] Local Postgres unreachable — run `yarn db:up` to enable this suite. Skipping.',
  )
}

const describeIfReachable = harness.ok ? describe : describe.skip

// createPair/deletePairByTransactionId/deleteReimbursementForAnchor/getEligibleCounterparts/
// getGroupOccurrenceInterval — the live write/read paths under test. Same technique as
// tests/reimbursement-regression.test.ts: never let the modules under test build their own
// connection off the ambient process.env.DATABASE_URL — feed them the harness's own
// already-host-guarded client instead.
let createPair: typeof CreatePair
let deletePairByTransactionId: typeof DeletePairByTransactionId
let deleteReimbursementForAnchor: typeof DeleteReimbursementForAnchor
let getEligibleCounterparts: typeof GetEligibleCounterparts
let getGroupOccurrenceInterval: typeof GetGroupOccurrenceInterval
let getReimbursementPanelData: typeof GetReimbursementPanelData
let computeReimbursementResidualForTest: typeof ComputeReimbursementResidual

if (harness.ok) {
  vi.doMock('@/lib/db', () => ({ db: harness.db }))
  vi.resetModules()
  const servicesModule = await import('@/lib/services/transaction-pairs')
  createPair = servicesModule.createPair
  deletePairByTransactionId = servicesModule.deletePairByTransactionId
  deleteReimbursementForAnchor = servicesModule.deleteReimbursementForAnchor
  const dalModule = await import('@/lib/dal/transaction-pairs')
  getEligibleCounterparts = dalModule.getEligibleCounterparts
  getGroupOccurrenceInterval = dalModule.getGroupOccurrenceInterval
  const reimbursementDalModule = await import('@/lib/dal/reimbursement')
  getReimbursementPanelData = reimbursementDalModule.getReimbursementPanelData
  const reimbursementServiceModule = await import('@/lib/services/reimbursement')
  computeReimbursementResidualForTest = reimbursementServiceModule.computeReimbursementResidual
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

// ---------------------------------------------------------------------------------------------
// Task 2 — getEligibleCounterparts multi-exclusion + getGroupOccurrenceInterval (D-06)
// ---------------------------------------------------------------------------------------------
describeIfReachable(
  'eligible counterparts — multi-exclusion + Group occurrence-interval window (Phase 75 Plan 02 Task 2, D-06)',
  () => {
    it('excludes every id in excludeTransactionIds (2+ elements), not just one', async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      vi.mocked(verifySession).mockResolvedValue({ userId } as never)
      const taxonomy = await seedMinimalTaxonomy(db, userId)
      const occurredAt = new Date(2026, 0, 12, 12, 0, 0)

      const { transactionId: member1TransactionId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '-300.00',
        occurredAt,
        title: 'Alloggio montagna',
      })
      const { transactionId: member2TransactionId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '-100.00',
        occurredAt,
        title: 'Trasporto montagna',
      })
      const { transactionId: eligibleTransactionId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.incomeSubCategoryId,
        amount: '150.00',
        occurredAt,
        title: 'Rimborso montagna',
      })

      const dateFrom = new Date(2025, 10, 12, 0, 0, 0)
      const dateTo = new Date(2026, 3, 12, 0, 0, 0)

      // Excluding both group members (a negative reference amount wants positive counterparts) —
      // neither member should ever surface as its own candidate refund.
      const results = await getEligibleCounterparts({
        excludeTransactionIds: [member1TransactionId, member2TransactionId],
        referenceAmount: '-400.00',
        dateFrom,
        dateTo,
      })

      const resultIds = results.map((r) => r.id)
      expect(resultIds).not.toContain(member1TransactionId)
      expect(resultIds).not.toContain(member2TransactionId)
      expect(resultIds).toContain(eligibleTransactionId)
    })

    it('getGroupOccurrenceInterval resolves the min/max occurredAt across every member transaction, and undefined for an empty/foreign group', async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      vi.mocked(verifySession).mockResolvedValue({ userId } as never)
      const { userId: otherUserId } = await seedUser(db)
      const taxonomy = await seedMinimalTaxonomy(db, userId)

      const firstDate = new Date(2026, 0, 5, 9, 0, 0)
      const midDate = new Date(2026, 0, 12, 9, 0, 0)
      const lastDate = new Date(2026, 0, 20, 9, 0, 0)

      const { expenseId: member1ExpenseId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '-300.00',
        occurredAt: firstDate,
        title: 'Alloggio montagna',
      })
      const { expenseId: member2ExpenseId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '-100.00',
        occurredAt: midDate,
        title: 'Trasporto montagna',
      })
      const { expenseId: member3ExpenseId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '-50.00',
        occurredAt: lastDate,
        title: 'Cena montagna',
      })

      const { groupId } = await seedExpenseGroup(db, {
        userId,
        title: 'Vacanza in montagna',
        subCategoryId: taxonomy.essentialSubCategoryId,
        memberExpenseIds: [member1ExpenseId, member2ExpenseId, member3ExpenseId],
      })

      const interval = await getGroupOccurrenceInterval({ userId, groupId })
      expect(interval).toBeDefined()
      expect(interval!.first.getTime()).toBe(firstDate.getTime())
      expect(interval!.last.getTime()).toBe(lastDate.getTime())

      // Empty/foreign group: undefined, same not-found convention as getReimbursementAggregates.
      const { groupId: emptyGroupId } = await seedExpenseGroup(db, {
        userId,
        title: 'Gruppo vuoto',
        subCategoryId: taxonomy.essentialSubCategoryId,
        memberExpenseIds: [],
      })
      await expect(getGroupOccurrenceInterval({ userId, groupId: emptyGroupId })).resolves.toBeUndefined()
      await expect(
        getGroupOccurrenceInterval({ userId: otherUserId, groupId }),
      ).resolves.toBeUndefined()
    })
  },
)

// Reads the single reimbursement_refund_snapshot row for a refund transaction, if any — the
// join every Task 1/Task 2 test below uses to inspect what createPairTx recorded / what
// restoreRefundBaseline is reading from.
async function loadSnapshotForRefund(
  db: ReimbursementTestDb,
  refundTransactionId: string,
): Promise<
  | {
      expenseId: string | null
      expenseTitle: string | null
      expenseDescriptionHash: string | null
      expenseSubCategoryId: number | null
      expenseStatus: string | null
    }
  | undefined
> {
  const rows = await db
    .select({
      expenseId: reimbursementRefundSnapshotTable.expenseId,
      expenseTitle: reimbursementRefundSnapshotTable.expenseTitle,
      expenseDescriptionHash: reimbursementRefundSnapshotTable.expenseDescriptionHash,
      expenseSubCategoryId: reimbursementRefundSnapshotTable.expenseSubCategoryId,
      expenseStatus: reimbursementRefundSnapshotTable.expenseStatus,
    })
    .from(reimbursementRefundTable)
    .innerJoin(
      reimbursementRefundSnapshotTable,
      eq(reimbursementRefundSnapshotTable.reimbursementRefundId, reimbursementRefundTable.id),
    )
    .where(eq(reimbursementRefundTable.transactionId, refundTransactionId))
    .limit(1)

  return rows[0]
}

// ---------------------------------------------------------------------------------------------
// Plan 03 Task 1 — reimbursement_refund_snapshot schema + record-on-link (D-10)
// ---------------------------------------------------------------------------------------------
describeIfReachable(
  'reimbursement_refund_snapshot — record-on-link (Phase 75 Plan 03 Task 1, D-10)',
  () => {
    it('Test 1: linking a refund whose expense was categorized records exactly one snapshot row capturing its pre-link state', async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      vi.mocked(verifySession).mockResolvedValue({ userId } as never)
      const taxonomy = await seedMinimalTaxonomy(db, userId)
      const occurredAt = new Date(2026, 0, 12, 12, 0, 0)

      const { transactionId: anchorTransactionId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '-100.00',
        occurredAt,
        title: 'Ordine Amazon',
      })
      const { transactionId: refundTransactionId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.incomeSubCategoryId,
        amount: '50.00',
        occurredAt,
        title: 'Rimborso Amazon',
      })

      await createPair({
        userId,
        anchor: { transactionId: anchorTransactionId },
        counterpartId: refundTransactionId,
      })

      const snapshot = await loadSnapshotForRefund(db, refundTransactionId)
      expect(snapshot).toBeDefined()
      // The pre-link values are the refund's ORIGINAL seed state (before applyDetachCleanupTx
      // re-hashed/re-titled/re-categorized it), not the anchor's subcategory it inherited after.
      // seedExpenseWithTransaction never sets expense.descriptionHash (only transaction's), so
      // its true pre-link value is null — the snapshot must match that exactly, not invent one.
      expect(snapshot!.expenseTitle).toBe('Rimborso Amazon')
      expect(snapshot!.expenseDescriptionHash).toBeNull()
      expect(snapshot!.expenseSubCategoryId).toBe(taxonomy.incomeSubCategoryId)
      expect(snapshot!.expenseStatus).toBe('3')

      // Exactly one row — no duplicate snapshot writes.
      const allSnapshotRows = await db
        .select({ id: reimbursementRefundSnapshotTable.id })
        .from(reimbursementRefundSnapshotTable)
      expect(allSnapshotRows).toHaveLength(1)
    })

    it('Test 2: linking a refund whose refund-cleanup is skipped (anchor uncategorized, or refund shares the anchor Expense) records NO snapshot row', async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      vi.mocked(verifySession).mockResolvedValue({ userId } as never)
      const taxonomy = await seedMinimalTaxonomy(db, userId)
      const occurredAt = new Date(2026, 0, 12, 12, 0, 0)

      // Sub-scenario A: the anchor itself is UNCATEGORIZED (subCategoryId null) — refund cleanup
      // never runs (anchorSubCategoryId !== null guard), so no snapshot is recorded.
      const uncategorizedAnchorExpenseId = crypto.randomUUID()
      const uncategorizedAnchorTransactionId = crypto.randomUUID()
      await db.insert(expenseTable).values({
        id: uncategorizedAnchorExpenseId,
        userId,
        title: 'Spesa non categorizzata',
        subCategoryId: null,
        totalAmount: '-40.00',
        transactionCount: 1,
        firstTransactionAt: occurredAt,
        lastTransactionAt: occurredAt,
        status: '1',
      })
      await db.insert(transactionTable).values({
        id: uncategorizedAnchorTransactionId,
        userId,
        expenseId: uncategorizedAnchorExpenseId,
        transactionHash: `hash-${uncategorizedAnchorTransactionId}`,
        description: 'Spesa non categorizzata',
        descriptionHash: `dh-${uncategorizedAnchorTransactionId}`,
        amount: '-40.00',
        occurredAt,
        rowIndex: 0,
      })
      const { transactionId: refundATransactionId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.incomeSubCategoryId,
        amount: '40.00',
        occurredAt,
        title: 'Rimborso non categorizzato',
      })

      await createPair({
        userId,
        anchor: { transactionId: uncategorizedAnchorTransactionId },
        counterpartId: refundATransactionId,
      })

      expect(await loadSnapshotForRefund(db, refundATransactionId)).toBeUndefined()

      // Sub-scenario B: the refund's OWN expense IS the anchor's Expense (a second transaction
      // under the SAME expense_id as the categorized anchor) — refund cleanup is skipped by the
      // anchorMemberExpenseIds same-expense guard, so no snapshot is recorded either.
      const { expenseId: sharedExpenseId, transactionId: anchorBTransactionId } =
        await seedExpenseWithTransaction(db, {
          userId,
          subCategoryId: taxonomy.essentialSubCategoryId,
          amount: '-90.00',
          occurredAt,
          title: 'Spesa condivisa',
        })
      const refundBTransactionId = crypto.randomUUID()
      await db.insert(transactionTable).values({
        id: refundBTransactionId,
        userId,
        expenseId: sharedExpenseId,
        transactionHash: `hash-${refundBTransactionId}`,
        description: 'Rimborso stessa spesa',
        descriptionHash: `dh-${refundBTransactionId}`,
        amount: '30.00',
        occurredAt,
        rowIndex: 1,
      })

      await createPair({
        userId,
        anchor: { transactionId: anchorBTransactionId },
        counterpartId: refundBTransactionId,
      })

      expect(await loadSnapshotForRefund(db, refundBTransactionId)).toBeUndefined()

      // Neither sub-scenario ever wrote a snapshot row.
      const allSnapshotRows = await db
        .select({ id: reimbursementRefundSnapshotTable.id })
        .from(reimbursementRefundSnapshotTable)
      expect(allSnapshotRows).toHaveLength(0)
    })

    it('Test 3: appending a second refund (Plan 75-02 append path) ALSO records a snapshot for that refund', async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      vi.mocked(verifySession).mockResolvedValue({ userId } as never)
      const taxonomy = await seedMinimalTaxonomy(db, userId)
      const occurredAt = new Date(2026, 0, 12, 12, 0, 0)

      const { transactionId: anchorTransactionId } = await seedExpenseWithTransaction(db, {
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
      // Second link on the SAME anchor — APPEND (Plan 75-02's create-or-append path).
      await createPair({
        userId,
        anchor: { transactionId: anchorTransactionId },
        counterpartId: refundBTransactionId,
      })

      const snapshotA = await loadSnapshotForRefund(db, refundATransactionId)
      const snapshotB = await loadSnapshotForRefund(db, refundBTransactionId)
      expect(snapshotA).toBeDefined()
      expect(snapshotB).toBeDefined()
      expect(snapshotB!.expenseTitle).toBe('Rimborso Giulia')
      expect(snapshotB!.expenseSubCategoryId).toBe(taxonomy.incomeSubCategoryId)

      const allSnapshotRows = await db
        .select({ id: reimbursementRefundSnapshotTable.id })
        .from(reimbursementRefundSnapshotTable)
      expect(allSnapshotRows).toHaveLength(2)
    })
  },
)

// Reads an expense's title/descriptionHash/subCategoryId/status — the fields
// applyDetachCleanupTx mutates and restoreRefundBaseline reverts.
async function loadExpenseState(
  db: ReimbursementTestDb,
  expenseId: string,
): Promise<
  | {
      title: string
      descriptionHash: string | null
      subCategoryId: number | null
      status: string
    }
  | undefined
> {
  const rows = await db
    .select({
      title: expenseTable.title,
      descriptionHash: expenseTable.descriptionHash,
      subCategoryId: expenseTable.subCategoryId,
      status: expenseTable.status,
    })
    .from(expenseTable)
    .where(eq(expenseTable.id, expenseId))
    .limit(1)

  return rows[0]
}

// ---------------------------------------------------------------------------------------------
// Plan 03 Task 2 — Unlink and delete-reimbursement restore baseline (D-09, D-10, RMB-07)
// ---------------------------------------------------------------------------------------------
describeIfReachable(
  'unlink and delete-reimbursement restore baseline (Phase 75 Plan 03 Task 2, D-09/D-10, RMB-07)',
  () => {
    it('Test 1 (Amazon 1:1 unlink): unlinking the refund restores its expense to pre-link state; the now-empty reimbursement is deleted', async () => {
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
          amount: '-100.00',
          occurredAt,
          title: 'Ordine Amazon',
        })
      const { expenseId: refundExpenseId, transactionId: refundTransactionId } =
        await seedExpenseWithTransaction(db, {
          userId,
          subCategoryId: taxonomy.incomeSubCategoryId,
          amount: '50.00',
          occurredAt,
          title: 'Rimborso Amazon',
        })

      await createPair({
        userId,
        anchor: { transactionId: anchorTransactionId },
        counterpartId: refundTransactionId,
      })

      // Sanity: refund-cleanup DID run — the refund is recategorized under the anchor's
      // subcategory before we unlink it.
      const afterLink = await loadExpenseState(db, refundExpenseId)
      expect(afterLink!.subCategoryId).toBe(taxonomy.essentialSubCategoryId)

      await deletePairByTransactionId({ userId, transactionId: refundTransactionId })

      const restored = await loadExpenseState(db, refundExpenseId)
      expect(restored!.title).toBe('Rimborso Amazon')
      expect(restored!.descriptionHash).toBeNull()
      expect(restored!.subCategoryId).toBe(taxonomy.incomeSubCategoryId)
      expect(restored!.status).toBe('3')

      const reimbursementRows = await db
        .select({ id: reimbursementTable.id })
        .from(reimbursementTable)
        .where(eq(reimbursementTable.expenseId, anchorExpenseId))
      expect(reimbursementRows).toHaveLength(0)
    })

    it('Test 2 (dinner 1:N per-refund unlink): unlinking one refund restores only its own baseline; the other two stay linked and untouched', async () => {
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
      const { expenseId: refundAExpenseId, transactionId: refundATransactionId } =
        await seedExpenseWithTransaction(db, {
          userId,
          subCategoryId: taxonomy.incomeSubCategoryId,
          amount: '30.00',
          occurredAt,
          title: 'Rimborso Carlo',
        })
      const { expenseId: refundBExpenseId, transactionId: refundBTransactionId } =
        await seedExpenseWithTransaction(db, {
          userId,
          subCategoryId: taxonomy.incomeSubCategoryId,
          amount: '30.00',
          occurredAt,
          title: 'Rimborso Giulia',
        })
      const { expenseId: refundCExpenseId, transactionId: refundCTransactionId } =
        await seedExpenseWithTransaction(db, {
          userId,
          subCategoryId: taxonomy.incomeSubCategoryId,
          amount: '30.00',
          occurredAt,
          title: 'Rimborso Marco',
        })

      await createPair({
        userId,
        anchor: { transactionId: anchorTransactionId },
        counterpartId: refundATransactionId,
      })
      await createPair({
        userId,
        anchor: { transactionId: anchorTransactionId },
        counterpartId: refundBTransactionId,
      })
      await createPair({
        userId,
        anchor: { transactionId: anchorTransactionId },
        counterpartId: refundCTransactionId,
      })

      await deletePairByTransactionId({ userId, transactionId: refundATransactionId })

      const restoredA = await loadExpenseState(db, refundAExpenseId)
      expect(restoredA!.title).toBe('Rimborso Carlo')
      expect(restoredA!.subCategoryId).toBe(taxonomy.incomeSubCategoryId)

      // B and C remain linked — their expense states are UNTOUCHED (still recategorized).
      const stillLinkedB = await loadExpenseState(db, refundBExpenseId)
      expect(stillLinkedB!.subCategoryId).toBe(taxonomy.essentialSubCategoryId)
      const stillLinkedC = await loadExpenseState(db, refundCExpenseId)
      expect(stillLinkedC!.subCategoryId).toBe(taxonomy.essentialSubCategoryId)

      const reimbursementRows = await db
        .select({ id: reimbursementTable.id })
        .from(reimbursementTable)
        .where(eq(reimbursementTable.expenseId, anchorExpenseId))
      expect(reimbursementRows).toHaveLength(1)

      const remainingRefunds = await db
        .select({ transactionId: reimbursementRefundTable.transactionId })
        .from(reimbursementRefundTable)
        .where(eq(reimbursementRefundTable.reimbursementId, reimbursementRows[0]!.id))
      expect(remainingRefunds.map((r) => r.transactionId).sort()).toEqual(
        [refundBTransactionId, refundCTransactionId].sort(),
      )
    })

    it('Test 3 (final unlink collapses): unlinking the last remaining refund restores baseline AND deletes the now-empty reimbursement row', async () => {
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
          amount: '-60.00',
          occurredAt,
          title: 'Cena in due',
        })
      const { expenseId: refundAExpenseId, transactionId: refundATransactionId } =
        await seedExpenseWithTransaction(db, {
          userId,
          subCategoryId: taxonomy.incomeSubCategoryId,
          amount: '30.00',
          occurredAt,
          title: 'Rimborso Carlo',
        })
      const { expenseId: refundBExpenseId, transactionId: refundBTransactionId } =
        await seedExpenseWithTransaction(db, {
          userId,
          subCategoryId: taxonomy.incomeSubCategoryId,
          amount: '30.00',
          occurredAt,
          title: 'Rimborso Giulia',
        })

      await createPair({
        userId,
        anchor: { transactionId: anchorTransactionId },
        counterpartId: refundATransactionId,
      })
      await createPair({
        userId,
        anchor: { transactionId: anchorTransactionId },
        counterpartId: refundBTransactionId,
      })

      await deletePairByTransactionId({ userId, transactionId: refundATransactionId })

      // Reimbursement still exists — refund B remains.
      let reimbursementRows = await db
        .select({ id: reimbursementTable.id })
        .from(reimbursementTable)
        .where(eq(reimbursementTable.expenseId, anchorExpenseId))
      expect(reimbursementRows).toHaveLength(1)

      await deletePairByTransactionId({ userId, transactionId: refundBTransactionId })

      const restoredA = await loadExpenseState(db, refundAExpenseId)
      const restoredB = await loadExpenseState(db, refundBExpenseId)
      expect(restoredA!.subCategoryId).toBe(taxonomy.incomeSubCategoryId)
      expect(restoredB!.subCategoryId).toBe(taxonomy.incomeSubCategoryId)

      reimbursementRows = await db
        .select({ id: reimbursementTable.id })
        .from(reimbursementTable)
        .where(eq(reimbursementTable.expenseId, anchorExpenseId))
      expect(reimbursementRows).toHaveLength(0)
    })

    it('Test 4 (delete-whole-reimbursement): deleteReimbursementForAnchor restores baseline for ALL refunds, not just the last one removed', async () => {
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
      const { expenseId: refundAExpenseId, transactionId: refundATransactionId } =
        await seedExpenseWithTransaction(db, {
          userId,
          subCategoryId: taxonomy.incomeSubCategoryId,
          amount: '30.00',
          occurredAt,
          title: 'Rimborso Carlo',
        })
      const { expenseId: refundBExpenseId, transactionId: refundBTransactionId } =
        await seedExpenseWithTransaction(db, {
          userId,
          subCategoryId: taxonomy.incomeSubCategoryId,
          amount: '30.00',
          occurredAt,
          title: 'Rimborso Giulia',
        })
      const { expenseId: refundCExpenseId, transactionId: refundCTransactionId } =
        await seedExpenseWithTransaction(db, {
          userId,
          subCategoryId: taxonomy.incomeSubCategoryId,
          amount: '30.00',
          occurredAt,
          title: 'Rimborso Marco',
        })

      await createPair({
        userId,
        anchor: { transactionId: anchorTransactionId },
        counterpartId: refundATransactionId,
      })
      await createPair({
        userId,
        anchor: { transactionId: anchorTransactionId },
        counterpartId: refundBTransactionId,
      })
      await createPair({
        userId,
        anchor: { transactionId: anchorTransactionId },
        counterpartId: refundCTransactionId,
      })

      const reimbursementRows = await db
        .select({ id: reimbursementTable.id })
        .from(reimbursementTable)
        .where(eq(reimbursementTable.expenseId, anchorExpenseId))
      const reimbursementId = reimbursementRows[0]!.id

      await deleteReimbursementForAnchor({ userId, reimbursementId })

      // ALL THREE refunds restored — not just the last one removed.
      const restoredA = await loadExpenseState(db, refundAExpenseId)
      const restoredB = await loadExpenseState(db, refundBExpenseId)
      const restoredC = await loadExpenseState(db, refundCExpenseId)
      expect(restoredA!.subCategoryId).toBe(taxonomy.incomeSubCategoryId)
      expect(restoredA!.title).toBe('Rimborso Carlo')
      expect(restoredB!.subCategoryId).toBe(taxonomy.incomeSubCategoryId)
      expect(restoredB!.title).toBe('Rimborso Giulia')
      expect(restoredC!.subCategoryId).toBe(taxonomy.incomeSubCategoryId)
      expect(restoredC!.title).toBe('Rimborso Marco')

      const remainingReimbursementRows = await db
        .select({ id: reimbursementTable.id })
        .from(reimbursementTable)
        .where(eq(reimbursementTable.id, reimbursementId))
      expect(remainingReimbursementRows).toHaveLength(0)
    })

    it('Test 5 (Group-anchor Option B): a refund linked to a Group anchor restores its OWN pre-link subCategoryId on unlink', async () => {
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

      const { expenseId: refundExpenseId, transactionId: refundTransactionId } =
        await seedExpenseWithTransaction(db, {
          userId,
          subCategoryId: taxonomy.incomeSubCategoryId,
          amount: '150.00',
          occurredAt,
          title: 'Rimborso vacanza (Marco)',
        })

      await createPair({ userId, anchor: { groupId }, counterpartId: refundTransactionId })

      // Sanity: cleanup ran, the refund inherited the GROUP's subcategory (not its own).
      const afterLink = await loadExpenseState(db, refundExpenseId)
      expect(afterLink!.subCategoryId).toBe(taxonomy.essentialSubCategoryId)

      await deletePairByTransactionId({ userId, transactionId: refundTransactionId })

      // Restored from the refund's OWN pre-link snapshot — never left uncategorized just
      // because the Group anchor spans multiple subcategories with no single subCategoryId.
      const restored = await loadExpenseState(db, refundExpenseId)
      expect(restored!.subCategoryId).toBe(taxonomy.incomeSubCategoryId)
      expect(restored!.title).toBe('Rimborso vacanza (Marco)')
    })

    it('Test 6 (idempotent no-op): removing an already-unlinked refund a second time is a silent no-op', async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      vi.mocked(verifySession).mockResolvedValue({ userId } as never)
      const taxonomy = await seedMinimalTaxonomy(db, userId)
      const occurredAt = new Date(2026, 0, 12, 12, 0, 0)

      const { transactionId: anchorTransactionId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '-100.00',
        occurredAt,
        title: 'Ordine Amazon',
      })
      const { expenseId: refundExpenseId, transactionId: refundTransactionId } =
        await seedExpenseWithTransaction(db, {
          userId,
          subCategoryId: taxonomy.incomeSubCategoryId,
          amount: '50.00',
          occurredAt,
          title: 'Rimborso Amazon',
        })

      await createPair({
        userId,
        anchor: { transactionId: anchorTransactionId },
        counterpartId: refundTransactionId,
      })

      await deletePairByTransactionId({ userId, transactionId: refundTransactionId })
      const restoredOnce = await loadExpenseState(db, refundExpenseId)

      // Calling it again on the SAME (already-unlinked) transaction id must be a silent no-op —
      // never a thrown error, never a second restore mutating the already-restored expense.
      await expect(
        deletePairByTransactionId({ userId, transactionId: refundTransactionId }),
      ).resolves.toBeUndefined()

      const restoredTwice = await loadExpenseState(db, refundExpenseId)
      expect(restoredTwice).toEqual(restoredOnce)
    })
  },
)

// ---------------------------------------------------------------------------------------------
// Plan 04 Task 1 — getReimbursementPanelData (D-01/D-02/D-03/D-04, RMB-08)
// ---------------------------------------------------------------------------------------------
describeIfReachable('getReimbursementPanelData — panel data (Phase 75 Plan 04 Task 1)', () => {
  it('Test 1 (transaction anchor, 2 refunds): returns reimbursementId/title/refunds ordered by created_at ASC, transaction_id ASC, and residual/state matching computeReimbursementResidual', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    vi.mocked(verifySession).mockResolvedValue({ userId } as never)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const occurredAt = new Date(2026, 0, 12, 12, 0, 0)

    const { transactionId: anchorTransactionId } = await seedExpenseWithTransaction(db, {
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

    // Linked in this order — refundA CREATEs, refundB APPENDs (created_at ASC tie-break proof).
    await createPair({ userId, anchor: { transactionId: anchorTransactionId }, counterpartId: refundATransactionId })
    await createPair({ userId, anchor: { transactionId: anchorTransactionId }, counterpartId: refundBTransactionId })

    const panelData = await getReimbursementPanelData({ userId, anchor: { transactionId: anchorTransactionId } })
    expect(panelData).toBeDefined()
    expect(panelData!.title).toBe('Cena in tre')
    expect(panelData!.refunds).toHaveLength(2)
    expect(panelData!.refunds.map((r) => r.id)).toEqual([refundATransactionId, refundBTransactionId])

    const residual = await computeReimbursementResidualForTest({ reimbursementId: panelData!.reimbursementId, userId })
    expect(panelData!.residual).toBe(residual!.residual)
    expect(panelData!.state).toBe(residual!.state)
  })

  it('Test 2 (no reimbursement): a transaction with no linked reimbursement returns undefined — the empty/CTA state, never a throw', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    vi.mocked(verifySession).mockResolvedValue({ userId } as never)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const occurredAt = new Date(2026, 0, 12, 12, 0, 0)

    const { transactionId: unpairedTransactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-40.00',
      occurredAt,
      title: 'Spesa non collegata',
    })

    await expect(
      getReimbursementPanelData({ userId, anchor: { transactionId: unpairedTransactionId } }),
    ).resolves.toBeUndefined()
  })

  it('Test 3 (Group anchor): resolves the same shape for a Group-anchored reimbursement, refunds ordered identically', async () => {
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
    await createPair({ userId, anchor: { groupId }, counterpartId: refundBTransactionId })

    const panelData = await getReimbursementPanelData({ userId, anchor: { groupId } })
    expect(panelData).toBeDefined()
    expect(panelData!.title).toBe('Vacanza in montagna')
    expect(panelData!.refunds.map((r) => r.id)).toEqual([refundATransactionId, refundBTransactionId])

    const residual = await computeReimbursementResidualForTest({ reimbursementId: panelData!.reimbursementId, userId })
    expect(panelData!.residual).toBe(residual!.residual)
    expect(panelData!.state).toBe(residual!.state)
  })
})
