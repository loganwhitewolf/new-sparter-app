// Real-Postgres proof for getAmortizationPlanList() (Phase 79 Plan 01 tracer, REG-01/REG-03):
// IDOR-safe by construction, Decimal-precise consumed/net derivation (explicit SUM of past
// instalments, never initial-minus-net), deterministic ordering (remainingMonths ASC, id ASC
// tie-break), open+closed both returned, and the D-03-style displayTitle fallback.
//
// Requires local Docker Postgres (`yarn db:up`). Skips gracefully (console warning, no failure)
// when unreachable — same pattern as tests/reimbursement-list.test.ts / amortization-lifecycle.test.ts.
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { getAmortizationPlanList as GetAmortizationPlanList } from '@/lib/dal/amortization'
import {
  amortizationPlan as amortizationPlanTable,
  transaction as transactionTable,
} from '@/lib/db/schema'
import { materializeInstalments } from '@/lib/services/amortization-math'
import { toDecimal } from '@/lib/utils/decimal'
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

const harness = await connectReimbursementTestDb()

let getAmortizationPlanList: typeof GetAmortizationPlanList

if (harness.ok) {
  // Same technique as tests/reimbursement-list.test.ts: never let lib/dal/amortization.ts build
  // its own connection off the ambient process.env.DATABASE_URL — feed it the harness's own
  // already-host-guarded client instead.
  vi.doMock('@/lib/db', () => ({ db: harness.db }))
  vi.resetModules()
  const dalModule = await import('@/lib/dal/amortization')
  getAmortizationPlanList = dalModule.getAmortizationPlanList
} else {
  console.warn(
    '[amortization-registry-dal] Local Postgres unreachable — run `yarn db:up` to enable this suite. Skipping.',
  )
}

const describeIfReachable = harness.ok ? describe : describe.skip

function requireHarnessDb(): ReimbursementTestDb {
  if (!harness.ok) {
    throw new Error('amortization-registry-dal: harness unreachable — this must be unreachable when skipped')
  }
  return harness.db
}

afterAll(async () => {
  if (harness.ok) {
    await harness.pool.end()
  }
})

const DAY_MS = 24 * 60 * 60 * 1000

function daysFromNow(offsetDays: number): Date {
  return new Date(Date.now() + offsetDays * DAY_MS)
}

/**
 * Builds a `pastCount`+`futureCount`-instalment schedule with Decimal-precise amounts (via
 * materializeInstalments, per the plan's read_first note — never hand-computed) but
 * independently-controlled dates: `pastCount` instalments strictly before "today" (buffered by
 * at least 15 days) followed by `futureCount` instalments strictly on/after "today" (buffered by
 * at least 30 days) — computed relative to `new Date()` at test time, never a hardcoded calendar
 * date, since the DAL query's CURRENT_DATE is the real wall clock.
 */
function buildPastFutureInstalments(
  totalAmount: string,
  pastCount: number,
  futureCount: number,
): { date: Date; amount: string }[] {
  const months = pastCount + futureCount
  const schedule = materializeInstalments(totalAmount, new Date(), months)

  return schedule.map((instalment, index) => ({
    amount: instalment.amount,
    date:
      index < pastCount
        ? daysFromNow(-((pastCount - index) * 30 + 15))
        : daysFromNow((index - pastCount + 1) * 30),
  }))
}

describeIfReachable(
  'getAmortizationPlanList — IDOR, Decimal precision, ordering, open+closed, displayTitle fallback (Phase 79 Plan 01)',
  () => {
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

    it('a brand-new user with zero plans resolves to an empty array, never undefined/throw', async () => {
      const rows = await getAmortizationPlanList(userId)
      expect(rows).toEqual([])
    })

    it('IDOR: a plan seeded for a different user never appears', async () => {
      const { expenseId, transactionId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId,
        amount: '-600.00',
        occurredAt: new Date(),
        title: 'Own plan',
      })
      const ownInstalments = buildPastFutureInstalments('-600.00', 2, 4)
      const { planId: ownPlanId } = await seedAmortizationPlan(db, {
        userId,
        transactionId,
        expenseId,
        months: 6,
        instalments: ownInstalments,
      })

      // `direction`/`nature` are global lookup tables (unique on `code`) — seedMinimalTaxonomy
      // must run only once per test; the other user's expense reuses this same subCategoryId
      // (no FK constraint ties subCategory ownership to the expense's own userId).
      const { userId: otherUserId } = await seedUser(db)
      const { expenseId: otherExpenseId, transactionId: otherTransactionId } =
        await seedExpenseWithTransaction(db, {
          userId: otherUserId,
          subCategoryId,
          amount: '-900.00',
          occurredAt: new Date(),
          title: 'Other user plan',
        })
      const otherInstalments = buildPastFutureInstalments('-900.00', 3, 3)
      await seedAmortizationPlan(db, {
        userId: otherUserId,
        transactionId: otherTransactionId,
        expenseId: otherExpenseId,
        months: 6,
        instalments: otherInstalments,
      })

      const rows = await getAmortizationPlanList(userId)

      expect(rows).toHaveLength(1)
      expect(rows[0]!.id).toBe(ownPlanId)
    })

    it('consumedAmount/netValue/remainingMonths are Decimal-precise, computed from the real past/future instalment split (never initial minus net)', async () => {
      const totalAmount = '-1200.00'
      const { expenseId, transactionId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId,
        amount: totalAmount,
        occurredAt: daysFromNow(-135),
        title: 'Partial consumption plan',
      })
      const pastCount = 4
      const futureCount = 2
      const instalments = buildPastFutureInstalments(totalAmount, pastCount, futureCount)
      const { planId } = await seedAmortizationPlan(db, {
        userId,
        transactionId,
        expenseId,
        months: pastCount + futureCount,
        instalments,
      })

      const expectedConsumed = instalments
        .slice(0, pastCount)
        .reduce((sum, i) => sum.plus(toDecimal(i.amount)), toDecimal('0'))
      const expectedNet = toDecimal(totalAmount).minus(expectedConsumed)

      const rows = await getAmortizationPlanList(userId)
      const row = rows.find((r) => r.id === planId)
      expect(row).toBeDefined()

      expect(toDecimal(row!.consumedAmount).equals(expectedConsumed)).toBe(true)
      expect(toDecimal(row!.netValue).equals(expectedNet)).toBe(true)
      expect(row!.remainingMonths).toBe(futureCount)
      expect(row!.totalMonths).toBe(pastCount + futureCount)
      expect(toDecimal(row!.initialAmount).equals(toDecimal(totalAmount))).toBe(true)
      expect(row!.status).toBe('open')
    })

    it('a manually status=closed plan (direct db.update, since seedAmortizationPlan always inserts open) still appears with status: closed', async () => {
      const { expenseId, transactionId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId,
        amount: '-300.00',
        occurredAt: new Date(),
        title: 'Closed plan',
      })
      const instalments = buildPastFutureInstalments('-300.00', 3, 0)
      const { planId } = await seedAmortizationPlan(db, {
        userId,
        transactionId,
        expenseId,
        months: 3,
        instalments,
      })

      await db
        .update(amortizationPlanTable)
        .set({ status: 'closed' })
        .where(eq(amortizationPlanTable.id, planId))

      const rows = await getAmortizationPlanList(userId)
      const row = rows.find((r) => r.id === planId)

      expect(row).toBeDefined()
      expect(row!.status).toBe('closed')
    })

    it('two plans sharing an identical remainingMonths value order deterministically by plan id ascending', async () => {
      const { expenseId: expenseA, transactionId: transactionA } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId,
        amount: '-200.00',
        occurredAt: new Date(),
        title: 'Tie-break plan A',
      })
      const instalmentsA = buildPastFutureInstalments('-200.00', 0, 4)
      const { planId: planA } = await seedAmortizationPlan(db, {
        userId,
        transactionId: transactionA,
        expenseId: expenseA,
        months: 4,
        instalments: instalmentsA,
      })

      const { expenseId: expenseB, transactionId: transactionB } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId,
        amount: '-250.00',
        occurredAt: new Date(),
        title: 'Tie-break plan B',
      })
      const instalmentsB = buildPastFutureInstalments('-250.00', 0, 4)
      const { planId: planB } = await seedAmortizationPlan(db, {
        userId,
        transactionId: transactionB,
        expenseId: expenseB,
        months: 4,
        instalments: instalmentsB,
      })

      const rows = await getAmortizationPlanList(userId)
      expect(rows).toHaveLength(2)
      expect(rows[0]!.remainingMonths).toBe(rows[1]!.remainingMonths)

      const [lowerId, higherId] = [planA, planB].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      expect(rows[0]!.id).toBe(lowerId)
      expect(rows[1]!.id).toBe(higherId)
    })

    it('displayTitle resolves to a non-empty trimmed customTitle when set, falling back to the raw description otherwise', async () => {
      const { expenseId: expenseCustom, transactionId: transactionCustom } =
        await seedExpenseWithTransaction(db, {
          userId,
          subCategoryId,
          amount: '-400.00',
          occurredAt: new Date(),
          title: 'Raw bank description',
        })
      await db
        .update(transactionTable)
        .set({ customTitle: '  My Custom Title  ' })
        .where(eq(transactionTable.id, transactionCustom))
      const instalmentsCustom = buildPastFutureInstalments('-400.00', 0, 4)
      const { planId: planCustom } = await seedAmortizationPlan(db, {
        userId,
        transactionId: transactionCustom,
        expenseId: expenseCustom,
        months: 4,
        instalments: instalmentsCustom,
      })

      const { expenseId: expenseFallback, transactionId: transactionFallback } =
        await seedExpenseWithTransaction(db, {
          userId,
          subCategoryId,
          amount: '-500.00',
          occurredAt: new Date(),
          title: 'Fallback bank description',
        })
      const instalmentsFallback = buildPastFutureInstalments('-500.00', 0, 5)
      const { planId: planFallback } = await seedAmortizationPlan(db, {
        userId,
        transactionId: transactionFallback,
        expenseId: expenseFallback,
        months: 5,
        instalments: instalmentsFallback,
      })

      const rows = await getAmortizationPlanList(userId)
      const customRow = rows.find((r) => r.id === planCustom)
      const fallbackRow = rows.find((r) => r.id === planFallback)

      expect(customRow).toBeDefined()
      expect(customRow!.displayTitle).toBe('My Custom Title')

      expect(fallbackRow).toBeDefined()
      expect(fallbackRow!.displayTitle).toBe('Fallback bank description')
    })
  },
)
