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
