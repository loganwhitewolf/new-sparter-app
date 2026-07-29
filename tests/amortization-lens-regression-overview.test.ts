// Real-Postgres regression proof for the movers drill-down + bar chart under the dashboard
// accrual lens (Phase 80, Plan 80-03, ADR 0019 §10). Sibling to
// tests/amortization-lens-regression.test.ts (created in Plan 80-01, extended in Plan 80-02) —
// kept as a SEPARATE file because Plan 80-02 is a parallel Wave 2 plan already modifying that
// one (same-wave plans must have zero files_modified overlap). Follows the exact harness/fixture
// pattern established there.
import { afterAll, describe, expect, it, vi } from 'vitest'
import { verifySession } from '@/lib/dal/auth'
import { ledgerEntryAccrual } from '@/lib/db/schema'
import { monthKey } from '@/lib/utils/date'
import { toDecimal } from '@/lib/utils/decimal'
import { materializeInstalments } from '@/lib/services/amortization-math'
import {
  connectReimbursementTestDb,
  resetReimbursementFixtures,
  type ReimbursementTestDb,
} from './helpers/reimbursement-test-db'
import {
  seedAmortizationPlan,
  seedExpenseWithTransaction,
  seedMinimalTaxonomy,
  seedUser,
} from './fixtures/reimbursement-seed'

vi.mock('@/lib/dal/auth', () => ({ verifySession: vi.fn() }))
vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))

const harness = await connectReimbursementTestDb()

if (!harness.ok) {
  console.warn(
    '[amortization-lens-regression-overview] Local Postgres unreachable — run `yarn db:up` to enable this suite. Skipping.',
  )
}

const describeIfReachable = harness.ok ? describe : describe.skip

function requireHarnessDb(): ReimbursementTestDb {
  if (!harness.ok) {
    throw new Error(
      'amortization-lens-regression-overview: harness unreachable — this must be unreachable when skipped',
    )
  }
  return harness.db
}

afterAll(async () => {
  if (harness.ok) {
    await harness.pool.end()
  }
})

describeIfReachable(
  'dashboard accrual lens — movers + bar chart seam (Phase 80, Plan 80-03, ADR 0019 §10)',
  () => {
    it('cash stays byte-identical to the full purchase; competenza reflects instalment amounts, including a future month', async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      vi.mocked(verifySession).mockResolvedValue({ userId } as never)
      const taxonomy = await seedMinimalTaxonomy(db, userId)

      // Month N = the current calendar month; the 3-month plan's instalments span N/N+1/N+2, so
      // N+2 always lands beyond "today" (LENS-04) regardless of which day-of-month the suite runs.
      const now = new Date()
      const occurredAt = new Date(now.getFullYear(), now.getMonth(), 14, 12, 0, 0)
      const yearN = occurredAt.getFullYear()
      const monthIndexN = occurredAt.getMonth()

      const { expenseId, transactionId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '-600.00',
        occurredAt,
        title: 'Lens probe purchase (80-03)',
      })

      const instalments = materializeInstalments('-600.00', occurredAt, 3)
      await seedAmortizationPlan(db, {
        userId,
        transactionId,
        expenseId,
        months: 3,
        instalments,
      })

      const futureInstalment = instalments[2]!
      const futureMonthKey = monthKey(futureInstalment.date)
      const futureYear = futureInstalment.date.getFullYear()

      // Load the REAL, unmodified overview.ts module bound to the harness's own host-guarded db
      // client — same technique tests/helpers/reimbursement-test-db.ts's
      // captureAggregationSnapshot() uses internally.
      vi.doMock('@/lib/db', () => ({ db }))
      vi.resetModules()
      const overviewModule = await import('@/lib/dal/overview')

      // (a) cash (no 5th/2nd arg): month-N movers + bar chart both show the full -600.00
      // purchase amount, unaffected by the plan existing (LENS-03 byte-identical).
      const cashChanges = await overviewModule.getMonthOverMonthCategoryChanges(
        yearN,
        monthIndexN,
        'out',
        10,
      )
      const cashMover = cashChanges.find((c) => c.categoryId === taxonomy.essentialCategoryId)
      expect(cashMover).toBeDefined()
      expect(toDecimal(cashMover!.delta).abs().equals(toDecimal('600.00'))).toBe(true)
      expect(cashMover!.isNew).toBe(true)

      const cashChart = await overviewModule.getOverviewChart(yearN)
      const cashBucket = cashChart.find((p) => p.month === monthKey(occurredAt))
      expect(cashBucket).toBeDefined()
      expect(toDecimal(cashBucket!.out.essential).equals(toDecimal('600.00'))).toBe(true)

      // (b) competenza: month-N movers still fire isNew (D-07 — no special-case suppression of a
      // plan's first instalment month), and the bar chart's future month-(N+2) bucket is non-zero
      // even though no `transaction` row exists there — only the materialized instalment does.
      const accrualChanges = await overviewModule.getMonthOverMonthCategoryChanges(
        yearN,
        monthIndexN,
        'out',
        10,
        ledgerEntryAccrual,
      )
      const accrualMover = accrualChanges.find((c) => c.categoryId === taxonomy.essentialCategoryId)
      expect(accrualMover).toBeDefined()
      expect(accrualMover!.isNew).toBe(true)
      expect(
        toDecimal(accrualMover!.delta).abs().equals(toDecimal(instalments[0]!.amount).abs()),
      ).toBe(true)

      const accrualChart = await overviewModule.getOverviewChart(futureYear, ledgerEntryAccrual)
      const futureBucket = accrualChart.find((p) => p.month === futureMonthKey)
      expect(futureBucket).toBeDefined()
      expect(
        toDecimal(futureBucket!.out.essential).equals(toDecimal(futureInstalment.amount).abs()),
      ).toBe(true)
      expect(toDecimal(futureBucket!.out.essential).gt(0)).toBe(true)
    })
  },
)
