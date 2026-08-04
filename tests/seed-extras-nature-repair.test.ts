// Real-Postgres regression proof for a production bug found while investigating "trasporti non
// compare nei filtri": scripts/seed-extras.ts's ensureSystemSubcategory(), when it found a
// PRE-EXISTING subcategory row by slug, only ever touched isActive/name — never natureId. The
// 'carburante' subcategory predates the nature/direction model (added Phase 46-47) and isn't in
// V2_SUBCATEGORY_MANIFEST (it's a later split-phase slug — Phase 260731-hhv), so no backfill step
// ever repaired it. Production carried it ACTIVE with natureId NULL and 22 expenses / 40
// transactions silently excluded from every nature/direction-joined aggregation (every category
// ranking, category detail total, and dashboard chart INNER JOINs nature to resolve
// in/out/allocation — a NULL natureId with no user override means the row produces zero matches).
//
// Why this needs real Postgres and not a mocked db: the bug is specifically about what
// ensureSystemSubcategory's UPDATE statement does and does not touch — a mocked db can't prove
// the actual column value converges correctly.
//
// Harness pattern copied from tests/pace-engine-lens-regression.test.ts (host-guarded test db,
// graceful local skip, fatal in CI).
import { afterAll, describe, expect, it, vi } from 'vitest'
import { STEPS } from '../scripts/seed-extras'
import {
  category as categoryTable,
  direction as directionTable,
  expense as expenseTable,
  nature as natureTable,
  subCategory as subCategoryTable,
} from '@/lib/db/schema'
import {
  assertHarnessReachableInCi,
  connectReimbursementTestDb,
  resetReimbursementFixtures,
  type ReimbursementTestDb,
} from './helpers/reimbursement-test-db'
import { seedExpenseWithTransaction, seedUser } from './fixtures/reimbursement-seed'
import { eq } from 'drizzle-orm'

const harness = await connectReimbursementTestDb()

assertHarnessReachableInCi(harness, '[seed-extras-nature-repair]')

if (!harness.ok) {
  console.warn(
    '[seed-extras-nature-repair] Local Postgres unreachable — run `yarn db:up` to enable this suite. Skipping.',
  )
}

const describeIfReachable = harness.ok ? describe : describe.skip

function requireHarnessDb(): ReimbursementTestDb {
  if (!harness.ok) {
    throw new Error('seed-extras-nature-repair: harness unreachable — unreachable when skipped')
  }
  return harness.db
}

afterAll(async () => {
  if (harness.ok) {
    await harness.pool.end()
  }
})

describeIfReachable("split-carburante-e-ricarica repairs a pre-existing subcategory's NULL natureId", () => {
  it('backfills natureId on the existing active row, preserves its id, and keeps existing expenses attached', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)

    // splitCarburanteERicarica hardcodes categoryId: 7 — mirror production's shape directly
    // rather than relying on auto-increment sequencing to land on 7.
    await db.insert(categoryTable).values({ id: 7, name: 'trasporti', slug: 'trasporti', isActive: true })
    const [outDirection] = await db
      .insert(directionTable)
      .values({
        code: 'out',
        labelIt: 'Uscite',
        netWorthEffect: 'decrease',
        includedInTotals: true,
        shownSeparately: false,
        hidden: false,
        displayOrder: 1,
      })
      .returning({ id: directionTable.id })
    await db
      .insert(natureTable)
      .values({ code: 'essential', directionId: outDirection.id, labelIt: 'Essenziale', displayOrder: 0 })

    // The production shape: a pre-existing, ACTIVE 'carburante' row with NULL natureId.
    const [legacyCarburante] = await db
      .insert(subCategoryTable)
      .values({ categoryId: 7, name: 'carburante', slug: 'carburante', natureId: null, isActive: true })
      .returning({ id: subCategoryTable.id })

    // Real data attached to it — must survive untouched (same subcategory id, not recreated).
    const { expenseId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: legacyCarburante.id,
      amount: '-45.00',
      occurredAt: new Date(2026, 4, 4),
      title: 'TAMOIL 3861 CHERASCO IT',
    })

    const splitStep = STEPS.find((step) => step.name === 'split-carburante-e-ricarica')
    expect(splitStep, 'split-carburante-e-ricarica step missing from STEPS').toBeDefined()
    await splitStep!.run(db)

    const [repaired] = await db
      .select({ id: subCategoryTable.id, natureId: subCategoryTable.natureId, isActive: subCategoryTable.isActive })
      .from(subCategoryTable)
      .where(eq(subCategoryTable.id, legacyCarburante.id))

    expect(repaired.id).toBe(legacyCarburante.id) // never recreated — same row, id preserved
    expect(repaired.isActive).toBe(true)
    expect(repaired.natureId).not.toBeNull()

    const [expenseRow] = await db
      .select({ subCategoryId: expenseTable.subCategoryId })
      .from(expenseTable)
      .where(eq(expenseTable.id, expenseId))
    expect(expenseRow.subCategoryId).toBe(legacyCarburante.id) // expense still attached, untouched
  })
})
