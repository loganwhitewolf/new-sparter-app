// Real-Postgres regression proof for the dashboard accrual lens seam (Phase 80, Plan 80-01,
// ADR 0019 §10). Proves the ONE tracer path this plan wires end-to-end:
// getOverviewAmountTotals stays byte-identical under cassa (LENS-03) and correctly reads
// instalment amounts under competenza.
//
// Follows tests/reimbursement-regression.test.ts's exact harness pattern (real-Postgres,
// describeIfReachable guarded on harness.ok, graceful skip without Docker — see that file's
// header comment for the full four-guard connection-safety rationale).
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { verifySession } from '@/lib/dal/auth'
import { amortizationInstalment, ledgerEntryAccrual } from '@/lib/db/schema'
import { monthKey } from '@/lib/utils/date'
import { toDecimal } from '@/lib/utils/decimal'
import { materializeInstalments } from '@/lib/services/amortization-math'
import {
  captureAggregationSnapshot,
  connectReimbursementTestDb,
  lastMonthRange,
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

    const dateRange = lastMonthRange()
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

describeIfReachable(
  'dashboard accrual lens — remaining category-facing aggregations (Phase 80, Plan 80-02)',
  () => {
    it('cash lens stays unchanged (full purchase amount); competenza reflects only in-range instalments, including getCategoryDetail\'s Top 5 movimenti', async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      vi.mocked(verifySession).mockResolvedValue({ userId } as never)
      const taxonomy = await seedMinimalTaxonomy(db, userId)

      const dateRange = lastMonthRange()
      const occurredAt = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), 14, 12, 0, 0)
      const occurredMonthKey = monthKey(occurredAt)
      const title = 'Lens probe purchase (80-02)'

      // -30.00 over 3 EQUAL monthly instalments (-10.00 each, no rounding remainder) — gives a
      // clean cash-vs-accrual amount difference (30.00 vs 10.00) across every aggregation below.
      const { expenseId, transactionId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '-30.00',
        occurredAt,
        title,
      })

      const instalments = materializeInstalments('-30.00', occurredAt, 3)
      const { planId } = await seedAmortizationPlan(db, {
        userId,
        transactionId,
        expenseId,
        months: 3,
        instalments,
      })

      const [firstInstalment] = await db
        .select({ id: amortizationInstalment.id })
        .from(amortizationInstalment)
        .where(eq(amortizationInstalment.planId, planId))
      const instalmentId = firstInstalment?.id
      expect(instalmentId).toBeDefined()

      // Load the REAL, unmodified dashboard.ts module bound to the harness's own host-guarded
      // db client (same technique captureAggregationSnapshot uses internally) so the five
      // functions under test can be called directly with an explicit ledgerRowSource argument —
      // captureAggregationSnapshot's own five call sites never pass one through.
      vi.doMock('@/lib/db', () => ({ db }))
      vi.resetModules()
      const dashboardModule = await import('@/lib/dal/dashboard')

      const range = { from: dateRange.from, to: dateRange.to, type: 'all' as const }

      // (a) cassa (no 4th/2nd/3rd arg) — byte-identical to the full purchase amount.
      const [breakdownCash, rankingCash, detailCash, trendCash] = await Promise.all([
        dashboardModule.getCategoriesBreakdown(range),
        dashboardModule.getCategoryRanking(range),
        dashboardModule.getCategoryDetail(taxonomy.essentialCategoryId, range),
        dashboardModule.getMonthlyTrendByNature({ from: dateRange.from, to: dateRange.to }),
      ])

      const cashBreakdownAmount = breakdownCash.find((c) => c.id === taxonomy.essentialCategoryId)?.amount
      expect(toDecimal(cashBreakdownAmount ?? '0').equals(toDecimal('30.00'))).toBe(true)

      const cashRankingAmount = rankingCash.find((c) => c.id === taxonomy.essentialCategoryId)?.amount
      expect(toDecimal(cashRankingAmount ?? '0').equals(toDecimal('30.00'))).toBe(true)

      expect(toDecimal(detailCash.summary.total).equals(toDecimal('30.00'))).toBe(true)
      expect(detailCash.topTransactions[0]?.id).toBe(transactionId)
      expect(detailCash.topTransactions[0]?.title).toBe(title)
      expect(toDecimal(detailCash.topTransactions[0]?.amount ?? '0').equals(toDecimal('30.00'))).toBe(true)

      const cashTrendSegment = trendCash.find((point) => point.month === occurredMonthKey)?.segments.essential
      expect(toDecimal(cashTrendSegment ?? '0').abs().equals(toDecimal('30.00'))).toBe(true)

      // (b) competenza — every function now sums ONLY the in-range instalment(s): 10.00.
      const [breakdownAccrual, rankingAccrual, detailAccrual, trendAccrual] = await Promise.all([
        dashboardModule.getCategoriesBreakdown(range, ledgerEntryAccrual),
        dashboardModule.getCategoryRanking(range, ledgerEntryAccrual),
        dashboardModule.getCategoryDetail(taxonomy.essentialCategoryId, range, ledgerEntryAccrual),
        dashboardModule.getMonthlyTrendByNature({ from: dateRange.from, to: dateRange.to }, ledgerEntryAccrual),
      ])

      const accrualBreakdownAmount = breakdownAccrual.find((c) => c.id === taxonomy.essentialCategoryId)?.amount
      expect(toDecimal(accrualBreakdownAmount ?? '0').equals(toDecimal('10.00'))).toBe(true)

      const accrualRankingAmount = rankingAccrual.find((c) => c.id === taxonomy.essentialCategoryId)?.amount
      expect(toDecimal(accrualRankingAmount ?? '0').equals(toDecimal('10.00'))).toBe(true)

      expect(toDecimal(detailAccrual.summary.total).equals(toDecimal('10.00'))).toBe(true)
      // The instalment row (no matching `transaction` row) surfaces via the LEFT JOIN, never the
      // original transaction — proving topTransactionRows now reads FROM ledgerRowSource.
      expect(detailAccrual.topTransactions[0]?.id).toBe(instalmentId)
      expect(detailAccrual.topTransactions[0]?.id).not.toBe(transactionId)
      // No bank description exists for a virtual instalment row — falls back to the shared
      // Standalone Expense's title (coalesce(transaction.description, expense.title)).
      expect(detailAccrual.topTransactions[0]?.title).toBe(title)
      expect(toDecimal(detailAccrual.topTransactions[0]?.amount ?? '0').equals(toDecimal('10.00'))).toBe(true)

      const accrualTrendSegment = trendAccrual.find((point) => point.month === occurredMonthKey)?.segments.essential
      expect(toDecimal(accrualTrendSegment ?? '0').abs().equals(toDecimal('10.00'))).toBe(true)
    })
  },
)
