// Migration-backfill correctness suite (Phase 73 Plan 02, RMB-05).
//
// Plan 73-01's dev DB had 0 transaction_pair rows at execution time, so
// drizzle/migrations/0029_reimbursement_backfill.sql ran as a structural no-op against real
// data there (see 73-01-SUMMARY.md "Known Limitations" #2). This suite is the first real
// numeric proof of the backfill: it seeds real transaction_pair rows and asserts the migration
// produces the correct reimbursement/reimbursement_refund shape — sign-based anchor resolution
// and group-by-anchor-expense_id (see 73-01-SUMMARY.md "Known Limitations" #1: pairs whose
// outflow leg has no expense_id are an EXPECTED discrepancy class, not asserted here since
// this suite's fixtures always seed a valid outflow expense_id).
//
// Requires local Docker Postgres (`yarn db:up`). Skips gracefully (console warning, no failure)
// when unreachable, so `vitest run` stays green in sandboxes without Docker.
import { afterAll, describe, expect, it } from 'vitest'
import {
  reimbursement as reimbursementTable,
  reimbursementRefund as reimbursementRefundTable,
} from '@/lib/db/schema'
import {
  applyReimbursementBackfillMigration,
  connectReimbursementTestDb,
  resetReimbursementFixtures,
  type ReimbursementTestDb,
} from './helpers/reimbursement-test-db'
import { seedIndependentLegacyPair, seedMinimalTaxonomy, seedUser } from './fixtures/reimbursement-seed'

const harness = await connectReimbursementTestDb()

if (!harness.ok) {
  console.warn(
    '[migration-backfill] Local Postgres unreachable — run `yarn db:up` to enable this suite. Skipping.',
  )
}

const describeIfReachable = harness.ok ? describe : describe.skip

function requireHarnessDb(): ReimbursementTestDb {
  if (!harness.ok) {
    throw new Error('migration-backfill: harness unreachable — this must be unreachable when skipped')
  }
  return harness.db
}

afterAll(async () => {
  if (harness.ok) {
    await harness.pool.end()
  }
})

describeIfReachable('migration-backfill row-count reconciliation (Phase 73 Plan 02, RMB-05)', () => {
  it('K=5 independent legacy transaction_pair rows across different users backfill to exactly 5 reimbursement + 5 reimbursement_refund rows, zero orphans, zero cross-wiring', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    // Taxonomy is seeded ONCE and shared across all K independent pairs — direction.code /
    // nature.code carry a global unique constraint (see seedIndependentLegacyPair's doc
    // comment), so it cannot be re-seeded per pair.
    const { userId: taxonomyOwnerId } = await seedUser(db, { name: 'Backfill Taxonomy Owner' })
    const taxonomy = await seedMinimalTaxonomy(db, taxonomyOwnerId)

    const K = 5
    const pairs = []
    for (let index = 0; index < K; index++) {
      pairs.push(await seedIndependentLegacyPair(db, { index, taxonomy }))
    }

    await applyReimbursementBackfillMigration(db)

    const reimbursementRows = await db
      .select({ id: reimbursementTable.id, expenseId: reimbursementTable.expenseId })
      .from(reimbursementTable)
    expect(reimbursementRows).toHaveLength(K)

    const refundRows = await db
      .select({
        id: reimbursementRefundTable.id,
        reimbursementId: reimbursementRefundTable.reimbursementId,
        transactionId: reimbursementRefundTable.transactionId,
      })
      .from(reimbursementRefundTable)
    expect(refundRows).toHaveLength(K)

    // Every originating pair's outflow expense produced exactly one reimbursement row
    // (sign-based anchor resolution: transactionAId was seeded as the negative-amount leg).
    for (const pair of pairs) {
      const matchingReimbursement = reimbursementRows.find(
        (row) => row.expenseId === pair.outflowExpenseId,
      )
      expect(matchingReimbursement).toBeDefined()

      // Every originating pair's inflow (refund) transaction is linked to that SAME
      // reimbursement — zero cross-wiring between independent pairs across different users.
      const matchingRefund = refundRows.find((row) => row.transactionId === pair.refundTransactionId)
      expect(matchingRefund).toBeDefined()
      expect(matchingRefund!.reimbursementId).toBe(matchingReimbursement!.id)
    }

    // Zero orphans: every reimbursement_refund.reimbursementId resolves to a real reimbursement row.
    const reimbursementIds = new Set(reimbursementRows.map((row) => row.id))
    for (const refund of refundRows) {
      expect(reimbursementIds.has(refund.reimbursementId)).toBe(true)
    }
  })

  it('an empty transaction_pair table backfills to zero reimbursement rows with no error (0-row safety)', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    await expect(applyReimbursementBackfillMigration(db)).resolves.not.toThrow()

    const reimbursementRows = await db.select({ id: reimbursementTable.id }).from(reimbursementTable)
    expect(reimbursementRows).toHaveLength(0)

    const refundRows = await db
      .select({ id: reimbursementRefundTable.id })
      .from(reimbursementRefundTable)
    expect(refundRows).toHaveLength(0)
  })
})
