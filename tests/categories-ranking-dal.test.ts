// Real-Postgres proof for getCategoryYearRanking (Phase 83, Plan 83-01) — the year+direction
// scoped category ranking DAL function the Categories list page reads.
//
// Follows tests/pace-engine-lens-regression.test.ts's exact harness pattern (real-Postgres,
// describeIfReachable guarded on harness.ok, graceful skip without Docker).
import { afterAll, describe, expect, it, vi } from 'vitest'
import { verifySession } from '@/lib/dal/auth'
import {
  category as categoryTable,
  direction as directionTable,
  nature as natureTable,
  subCategory as subCategoryTable,
} from '@/lib/db/schema'
import { toDecimal } from '@/lib/utils/decimal'
import {
  connectReimbursementTestDb,
  resetReimbursementFixtures,
  type ReimbursementTestDb,
} from './helpers/reimbursement-test-db'
import {
  seedExpenseWithTransaction,
  seedMinimalTaxonomy,
  seedSecondEssentialCategory,
  seedUser,
} from './fixtures/reimbursement-seed'

vi.mock('@/lib/dal/auth', () => ({ verifySession: vi.fn() }))
vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))

const harness = await connectReimbursementTestDb()
const describeIfReachable = harness.ok ? describe : describe.skip

if (!harness.ok) {
  console.warn(
    '[categories-ranking-dal] Local Postgres unreachable — run `yarn db:up` to enable this suite. Skipping.',
  )
}

function requireHarnessDb(): ReimbursementTestDb {
  if (!harness.ok) {
    throw new Error('categories-ranking-dal: harness unreachable — this must be unreachable when skipped')
  }
  return harness.db
}

afterAll(async () => {
  if (harness.ok) {
    await harness.pool.end()
  }
})

/** Inserts a THIRD direction row ('allocation') plus one nature/category/subCategory referencing
 * it directly — seedMinimalTaxonomy only seeds 'out'/'in' — mirroring its own insert pattern. */
async function seedAllocationTaxonomy(
  db: ReimbursementTestDb,
  userId: string,
): Promise<{ subCategoryId: number; categoryId: number }> {
  const [allocationDirection] = await db
    .insert(directionTable)
    .values({
      code: 'allocation',
      labelIt: 'Accantonamenti',
      netWorthEffect: 'neutral',
      includedInTotals: false,
      shownSeparately: true,
      hidden: false,
      displayOrder: 2,
    })
    .returning({ id: directionTable.id })

  const [allocationNature] = await db
    .insert(natureTable)
    .values({
      code: 'savings',
      directionId: allocationDirection.id,
      labelIt: 'Risparmio',
      displayOrder: 0,
    })
    .returning({ id: natureTable.id })

  const [allocationCategory] = await db
    .insert(categoryTable)
    .values({ userId, name: 'Risparmio Test', slug: 'risparmio-test' })
    .returning({ id: categoryTable.id })

  const [allocationSubCategory] = await db
    .insert(subCategoryTable)
    .values({
      userId,
      categoryId: allocationCategory.id,
      name: 'Risparmio Test',
      slug: 'risparmio-test',
      natureId: allocationNature.id,
    })
    .returning({ id: subCategoryTable.id })

  return { subCategoryId: allocationSubCategory.id, categoryId: allocationCategory.id }
}

describeIfReachable(
  'getCategoryYearRanking — year+direction predicate flip, D-07 total invariant (CLIST-01, CLIST-04, D-09)',
  () => {
    it('returns the year total as the exact sum of the 12-entry sparkline (D-07), covering Jan and Mar', async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      vi.mocked(verifySession).mockResolvedValue({ userId } as never)
      const taxonomy = await seedMinimalTaxonomy(db, userId)

      await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '-120.00',
        occurredAt: new Date(2024, 0, 15),
        title: 'January essential spend',
      })
      await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '-80.00',
        occurredAt: new Date(2024, 2, 10),
        title: 'March essential spend',
      })

      vi.doMock('@/lib/db', () => ({ db }))
      vi.resetModules()
      const dashboardModule = await import('@/lib/dal/dashboard')

      const result = await dashboardModule.getCategoryYearRanking(2024, 'out')

      expect(result).toHaveLength(1)
      const item = result[0]!
      expect(item.type).toBe('out')
      expect(toDecimal(item.amount).equals(toDecimal('200.00'))).toBe(true)
      expect(item.percentage).toBe(100)
      expect(item.sparkline).toHaveLength(12)
      expect(item.sparkline.map((point) => point.month)).toEqual([
        '2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06',
        '2024-07', '2024-08', '2024-09', '2024-10', '2024-11', '2024-12',
      ])

      const jan = item.sparkline.find((point) => point.month === '2024-01')!
      const mar = item.sparkline.find((point) => point.month === '2024-03')!
      expect(toDecimal(jan.amount).equals(toDecimal('120.00'))).toBe(true)
      expect(toDecimal(mar.amount).equals(toDecimal('80.00'))).toBe(true)

      for (const point of item.sparkline) {
        if (point.month !== '2024-01' && point.month !== '2024-03') {
          expect(point.amount).toBe('0.00')
        }
      }

      // D-07: amount is literally the reduce-sum of the displayed 12-point series, never
      // independently derived — recompute it here and assert byte-identical equality.
      const reSummed = item.sparkline
        .reduce((sum, point) => sum.plus(toDecimal(point.amount)), toDecimal('0'))
        .toFixed(2)
      expect(reSummed).toBe(item.amount)
    })

    it('surfaces the allocation direction for the first time (D-09: hidden=false replaces includedInTotals)', async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      vi.mocked(verifySession).mockResolvedValue({ userId } as never)
      await seedMinimalTaxonomy(db, userId)
      const allocationTaxonomy = await seedAllocationTaxonomy(db, userId)

      await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: allocationTaxonomy.subCategoryId,
        amount: '-300.00',
        occurredAt: new Date(2024, 4, 5),
        title: 'Allocation spend',
      })

      vi.doMock('@/lib/db', () => ({ db }))
      vi.resetModules()
      const dashboardModule = await import('@/lib/dal/dashboard')

      const result = await dashboardModule.getCategoryYearRanking(2024, 'allocation')

      expect(result).toHaveLength(1)
      expect(result[0]!.id).toBe(allocationTaxonomy.categoryId)
      expect(result[0]!.type).toBe('allocation')
    })

    it('preserves the signed monthly sum for the allocation direction — a net-divestment month stays negative, an exact-zero month never triggers the marker (CR-01)', async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      vi.mocked(verifySession).mockResolvedValue({ userId } as never)
      await seedMinimalTaxonomy(db, userId)
      const allocationTaxonomy = await seedAllocationTaxonomy(db, userId)

      // January: net deposit +200.00.
      await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: allocationTaxonomy.subCategoryId,
        amount: '200.00',
        occurredAt: new Date(2024, 0, 15),
        title: 'January deposit',
      })
      // May: net divestment -450.00 — must NOT be abs()'d away.
      await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: allocationTaxonomy.subCategoryId,
        amount: '-450.00',
        occurredAt: new Date(2024, 4, 10),
        title: 'May divestment',
      })
      // June: two transactions netting to exactly zero.
      await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: allocationTaxonomy.subCategoryId,
        amount: '300.00',
        occurredAt: new Date(2024, 5, 5),
        title: 'June deposit',
      })
      await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: allocationTaxonomy.subCategoryId,
        amount: '-300.00',
        occurredAt: new Date(2024, 5, 20),
        title: 'June divestment',
      })

      vi.doMock('@/lib/db', () => ({ db }))
      vi.resetModules()
      const dashboardModule = await import('@/lib/dal/dashboard')

      const result = await dashboardModule.getCategoryYearRanking(2024, 'allocation')

      expect(result).toHaveLength(1)
      const item = result[0]!

      const jan = item.sparkline.find((point) => point.month === '2024-01')!
      const may = item.sparkline.find((point) => point.month === '2024-05')!
      const jun = item.sparkline.find((point) => point.month === '2024-06')!

      expect(toDecimal(jan.amount).equals(toDecimal('200.00'))).toBe(true)
      expect(toDecimal(may.amount).equals(toDecimal('-450.00'))).toBe(true)
      expect(jun.amount).toBe('0.00')

      // D-07 holds against a NEGATIVE total too: the Totale is the exact Decimal.js sum of the
      // signed 12-point series, never independently re-derived or re-abs'd.
      expect(toDecimal(item.amount).equals(toDecimal('-250.00'))).toBe(true)
      const reSummed = item.sparkline
        .reduce((sum, point) => sum.plus(toDecimal(point.amount)), toDecimal('0'))
        .toFixed(2)
      expect(reSummed).toBe(item.amount)
    })

    it('returns [] on a year with zero out transactions, never throwing', async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      vi.mocked(verifySession).mockResolvedValue({ userId } as never)
      await seedMinimalTaxonomy(db, userId)
      // Deliberately no transactions seeded.

      vi.doMock('@/lib/db', () => ({ db }))
      vi.resetModules()
      const dashboardModule = await import('@/lib/dal/dashboard')

      const result = await dashboardModule.getCategoryYearRanking(2024, 'out')
      expect(result).toEqual([])
    })

    it("never leaks a second user's category into the first user's result (T-83-01 userId scoping)", async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId: firstUserId } = await seedUser(db, { email: 'clist-user-1@example.test' })
      const taxonomy = await seedMinimalTaxonomy(db, firstUserId)
      await seedExpenseWithTransaction(db, {
        userId: firstUserId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '-50.00',
        occurredAt: new Date(2024, 0, 10),
        title: 'First user January',
      })

      const { userId: secondUserId } = await seedUser(db, { email: 'clist-user-2@example.test' })
      const { subCategoryId: secondSubCategoryId } = await seedSecondEssentialCategory(db, {
        userId: secondUserId,
        natureId: taxonomy.essentialNatureId,
      })
      await seedExpenseWithTransaction(db, {
        userId: secondUserId,
        subCategoryId: secondSubCategoryId,
        amount: '-999.00',
        occurredAt: new Date(2024, 3, 10),
        title: 'Second user April',
      })

      vi.mocked(verifySession).mockResolvedValue({ userId: firstUserId } as never)
      vi.doMock('@/lib/db', () => ({ db }))
      vi.resetModules()
      const dashboardModule = await import('@/lib/dal/dashboard')

      const result = await dashboardModule.getCategoryYearRanking(2024, 'out')
      expect(result).toHaveLength(1)
      expect(result[0]!.id).toBe(taxonomy.essentialCategoryId)
    })

    it('carries exactly 12 sparkline entries in ascending order with covered/uncovered state at this stage', async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      vi.mocked(verifySession).mockResolvedValue({ userId } as never)
      const taxonomy = await seedMinimalTaxonomy(db, userId)

      await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '-50.00',
        occurredAt: new Date(2024, 0, 10),
        title: 'January',
      })

      vi.doMock('@/lib/db', () => ({ db }))
      vi.resetModules()
      const dashboardModule = await import('@/lib/dal/dashboard')

      const result = await dashboardModule.getCategoryYearRanking(2024, 'out')
      expect(result).toHaveLength(1)
      const sparkline = result[0]!.sparkline
      expect(sparkline).toHaveLength(12)

      const jan = sparkline.find((point) => point.month === '2024-01')!
      expect(jan.state).toBe('covered')
      const feb = sparkline.find((point) => point.month === '2024-02')!
      expect(feb.state).toBe('uncovered')

      for (const point of sparkline) {
        expect(['covered', 'uncovered']).toContain(point.state)
      }
    })
  },
)

describeIfReachable(
  'Month-state classification and projection composition (CLIST-01, CLIST-02, CLIST-06, D-15)',
  () => {
    it('computes projection/pace from >= 2 pace-eligible Covered Months in a past year, with every month covered/uncovered (never current/estimated)', async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      vi.mocked(verifySession).mockResolvedValue({ userId } as never)
      const taxonomy = await seedMinimalTaxonomy(db, userId)

      await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '-400.00',
        occurredAt: new Date(2024, 0, 15),
        title: 'Month 1',
      })
      await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '-420.00',
        occurredAt: new Date(2024, 1, 15),
        title: 'Month 2',
      })
      await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '-410.00',
        occurredAt: new Date(2024, 2, 15),
        title: 'Month 3',
      })

      vi.doMock('@/lib/db', () => ({ db }))
      vi.resetModules()
      const dashboardModule = await import('@/lib/dal/dashboard')

      const result = await dashboardModule.getCategoryYearRanking(2024, 'out')
      expect(result).toHaveLength(1)
      const item = result[0]!

      expect(toDecimal(item.pace ?? '0').equals(toDecimal('410.00'))).toBe(true)
      expect(toDecimal(item.projection ?? '0').equals(toDecimal('4920.00'))).toBe(true)
      expect(toDecimal(item.amount).equals(toDecimal('1230.00'))).toBe(true)

      for (const point of item.sparkline) {
        expect(['covered', 'uncovered']).toContain(point.state)
      }
    })

    it('leaves projection/pace both null with exactly 1 Covered Month (D-15)', async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      vi.mocked(verifySession).mockResolvedValue({ userId } as never)
      const taxonomy = await seedMinimalTaxonomy(db, userId)

      await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '-150.00',
        occurredAt: new Date(2024, 0, 10),
        title: 'Only Covered Month',
      })

      vi.doMock('@/lib/db', () => ({ db }))
      vi.resetModules()
      const dashboardModule = await import('@/lib/dal/dashboard')

      const result = await dashboardModule.getCategoryYearRanking(2024, 'out')
      expect(result).toHaveLength(1)
      expect(result[0]!.projection).toBeNull()
      expect(result[0]!.pace).toBeNull()
    })

    it('returns [] with zero Covered Months, never throwing', async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      vi.mocked(verifySession).mockResolvedValue({ userId } as never)
      await seedMinimalTaxonomy(db, userId)
      // Deliberately no transactions seeded — a category with no transactions never appears in
      // the ranking at all, so this is the same observable outcome as the empty-year case.

      vi.doMock('@/lib/db', () => ({ db }))
      vi.resetModules()
      const dashboardModule = await import('@/lib/dal/dashboard')

      const result = await dashboardModule.getCategoryYearRanking(2024, 'out')
      expect(result).toEqual([])
    })

    it('classifies the current calendar month as current (hybrid amount) and future months as estimated (D-06, D-07)', async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      vi.mocked(verifySession).mockResolvedValue({ userId } as never)
      const taxonomy = await seedMinimalTaxonomy(db, userId)

      const today = new Date()
      const currentYear = today.getFullYear()
      const currentMonthIndex = today.getMonth()

      // Requires the current month to be April or later, so 3 whole past months exist within
      // the same calendar year (this environment's fixed date is 2026-07-31 — current month
      // July, index 6).
      expect(currentMonthIndex).toBeGreaterThanOrEqual(3)

      const pastMonthIndexes = [currentMonthIndex - 3, currentMonthIndex - 2, currentMonthIndex - 1]
      for (const monthIndex of pastMonthIndexes) {
        await seedExpenseWithTransaction(db, {
          userId,
          subCategoryId: taxonomy.essentialSubCategoryId,
          amount: '-300.00',
          occurredAt: new Date(currentYear, monthIndex, 10),
          title: `Past month ${monthIndex}`,
        })
      }
      // Current month: spent so far is well below the pace, so the hybrid must show the pace.
      // Noon (not midnight) avoids a local-timezone-vs-UTC month-boundary shift for day 1 (a
      // CEST midnight on the 1st stores as 22:00 UTC the previous day, landing in the prior
      // month's aggregation — noon stays safely within the same UTC calendar day everywhere).
      await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '-50.00',
        occurredAt: new Date(currentYear, currentMonthIndex, 1, 12, 0, 0),
        title: 'Current month spend so far',
      })

      vi.doMock('@/lib/db', () => ({ db }))
      vi.resetModules()
      const dashboardModule = await import('@/lib/dal/dashboard')

      const result = await dashboardModule.getCategoryYearRanking(currentYear, 'out')
      expect(result).toHaveLength(1)
      const item = result[0]!

      // 3 pace-eligible Covered Months at -300.00 each -> pace 300.00, projection 3600.00.
      expect(toDecimal(item.pace ?? '0').equals(toDecimal('300.00'))).toBe(true)
      expect(toDecimal(item.projection ?? '0').equals(toDecimal('3600.00'))).toBe(true)

      const monthKey = (monthIndex: number) =>
        `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}`

      const currentPoint = item.sparkline.find((point) => point.month === monthKey(currentMonthIndex))!
      expect(currentPoint.state).toBe('current')
      // Hybrid: max(50.00 spent so far, 300.00 pace) = 300.00 — never below the observed fact,
      // never a per-day pro-rate (D-06).
      expect(toDecimal(currentPoint.amount).equals(toDecimal('300.00'))).toBe(true)

      for (const monthIndex of pastMonthIndexes) {
        const point = item.sparkline.find((p) => p.month === monthKey(monthIndex))!
        expect(point.state).toBe('covered')
        expect(toDecimal(point.amount).equals(toDecimal('300.00'))).toBe(true)
      }

      for (let monthIndex = currentMonthIndex + 1; monthIndex <= 11; monthIndex++) {
        const point = item.sparkline.find((p) => p.month === monthKey(monthIndex))!
        expect(point.state).toBe('estimated')
        // D-07: an estimated (future) month never carries a fabricated pace-derived amount — it
        // stays '0.00'.
        expect(point.amount).toBe('0.00')
      }

      // D-07: the displayed total is the exact reduce-sum of the DISPLAYED (post-hybrid) series.
      const reSummed = item.sparkline
        .reduce((sum, point) => sum.plus(toDecimal(point.amount)), toDecimal('0'))
        .toFixed(2)
      expect(reSummed).toBe(item.amount)
    })
  },
)
