// Real-Postgres regression proof for the dashboard accrual lens seam (Phase 80, Plan 80-01,
// ADR 0019 §10). Proves the ONE tracer path this plan wires end-to-end:
// getOverviewAmountTotals stays byte-identical under cassa (LENS-03) and correctly reads
// instalment amounts under competenza.
//
// Follows tests/reimbursement-regression.test.ts's exact harness pattern (real-Postgres,
// describeIfReachable guarded on harness.ok, graceful skip without Docker — see that file's
// header comment for the full four-guard connection-safety rationale).
import { afterAll, describe, expect, it, vi } from 'vitest'
import { verifySession } from '@/lib/dal/auth'
import { ledgerEntryAccrual } from '@/lib/db/schema'
import { dashboardPresetToDateRange } from '@/lib/utils/date'
import { toDecimal } from '@/lib/utils/decimal'
import { materializeInstalments } from '@/lib/services/amortization-math'
import {
  captureAggregationSnapshot,
  connectReimbursementTestDb,
  resetReimbursementFixtures,
  type ReimbursementTestDb,
} from './helpers/reimbursement-test-db'
import {
  seedAmortizationPlan,
  seedExpenseWithTransaction,
  seedMinimalTaxonomy,
  seedTag,
  seedUser,
} from './fixtures/reimbursement-seed'

vi.mock('@/lib/dal/auth', () => ({ verifySession: vi.fn() }))
vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))

const harness = await connectReimbursementTestDb()

if (!harness.ok) {
  console.warn(
    '[amortization-lens-regression] Local Postgres unreachable — run `yarn db:up` to enable this suite. Skipping.',
  )
}

const describeIfReachable = harness.ok ? describe : describe.skip

function requireHarnessDb(): ReimbursementTestDb {
  if (!harness.ok) {
    throw new Error('amortization-lens-regression: harness unreachable — this must be unreachable when skipped')
  }
  return harness.db
}

afterAll(async () => {
  if (harness.ok) {
    await harness.pool.end()
  }
})

describeIfReachable('dashboard accrual lens — getOverviewAmountTotals seam (Phase 80, ADR 0019 §10)', () => {
  it('is byte-identical under cassa and sums only in-range instalments under competenza', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    vi.mocked(verifySession).mockResolvedValue({ userId } as never)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const { tagId } = await seedTag(db, { userId, name: 'Lens probe' })

    const dateRange = dashboardPresetToDateRange('last-month')
    const occurredAt = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), 14, 12, 0, 0)

    // A plain -1000.00 outflow, then activate a 3-month plan on it (fixture-inserted, mirroring
    // tests/reimbursement-regression.test.ts's amortization cash-lens byte-identical block).
    const { expenseId, transactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-1000.00',
      occurredAt,
      title: 'Lens probe purchase',
    })

    const instalments = materializeInstalments('-1000.00', occurredAt, 3)
    await seedAmortizationPlan(db, {
      userId,
      transactionId,
      expenseId,
      months: 3,
      instalments,
    })

    // (a) cassa (no 4th arg / undefined ledgerRowSource): totalOut is the raw purchase amount,
    // byte-identical to pre-Phase-80 behavior (LENS-03) — untouched by the instalment rows.
    const cashSnapshot = await captureAggregationSnapshot({
      harnessDb: db,
      userId,
      dateRange,
      categoryId: taxonomy.essentialCategoryId,
      tagId,
      ledgerRowSource: undefined,
    })
    const cashTotals = cashSnapshot.getOverviewAmountTotals as { totalOut: string }
    expect(toDecimal(cashTotals.totalOut).equals(toDecimal('1000.00'))).toBe(true)

    // (b) competenza: totalOut equals the Decimal.js sum of ONLY the instalments whose date
    // falls in [dateRange.from, dateRange.to] — never hand-computed with native arithmetic.
    const expectedAccrualTotal = instalments
      .filter((i) => i.date >= dateRange.from && i.date <= dateRange.to)
      .reduce((sum, i) => sum.plus(toDecimal(i.amount).abs()), toDecimal('0'))

    const accrualSnapshot = await captureAggregationSnapshot({
      harnessDb: db,
      userId,
      dateRange,
      categoryId: taxonomy.essentialCategoryId,
      tagId,
      ledgerRowSource: ledgerEntryAccrual,
    })
    const accrualTotals = accrualSnapshot.getOverviewAmountTotals as { totalOut: string }
    expect(toDecimal(accrualTotals.totalOut).equals(expectedAccrualTotal)).toBe(true)
  })
})
