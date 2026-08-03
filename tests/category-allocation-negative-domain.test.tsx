// Real-Postgres -> DAL -> rendered-component tracer proof for CR-01 (Phase 83, Plan 83-05).
//
// tests/category-sparkline.test.tsx's existing negative-domain assertion feeds the component a
// synthetic '-45.50' prop directly, bypassing getCategoryYearRanking — 83-VERIFICATION.md found
// this insufficient to prove the fix. This file closes that exact gap: it seeds real Postgres,
// calls the real getCategoryYearRanking(2024, 'allocation'), and renders the REAL returned
// sparkline through CategorySparkline via renderToStaticMarkup, asserting the negative-domain
// border marker fires exactly once (May, the net-divestment month) and never for January
// (positive) or June (exact zero).
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { verifySession } from '@/lib/dal/auth'
import {
  category as categoryTable,
  direction as directionTable,
  nature as natureTable,
  subCategory as subCategoryTable,
} from '@/lib/db/schema'
import {
  connectReimbursementTestDb,
  resetReimbursementFixtures,
  type ReimbursementTestDb,
} from './helpers/reimbursement-test-db'
import { seedExpenseWithTransaction, seedMinimalTaxonomy, seedUser } from './fixtures/reimbursement-seed'

vi.mock('@/lib/dal/auth', () => ({ verifySession: vi.fn() }))
// SPREAD mock (not the wholesale replacement used in tests/categories-ranking-dal.test.ts) —
// this file also calls renderToStaticMarkup and needs real React internals.
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  }
})

const harness = await connectReimbursementTestDb()
const describeIfReachable = harness.ok ? describe : describe.skip

if (!harness.ok) {
  console.warn(
    '[category-allocation-negative-domain] Local Postgres unreachable — run `yarn db:up` to enable this suite. Skipping.',
  )
}

function requireHarnessDb(): ReimbursementTestDb {
  if (!harness.ok) {
    throw new Error('category-allocation-negative-domain: harness unreachable — this must be unreachable when skipped')
  }
  return harness.db
}

afterAll(async () => {
  if (harness.ok) {
    await harness.pool.end()
  }
})

/** Local copy of the same seedAllocationTaxonomy helper shape used in
 * tests/categories-ranking-dal.test.ts — each test file owns its own copy, nothing shared. */
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
  'CategorySparkline negative-domain marker fires end-to-end from real Postgres data (CR-01)',
  () => {
    it('renders exactly one border-top marker for the May net-divestment month, never for January (positive) or June (exact zero)', async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      vi.mocked(verifySession).mockResolvedValue({ userId } as never)
      await seedMinimalTaxonomy(db, userId)
      const allocationTaxonomy = await seedAllocationTaxonomy(db, userId)

      await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: allocationTaxonomy.subCategoryId,
        amount: '200.00',
        occurredAt: new Date(2024, 0, 15),
        title: 'January deposit',
      })
      await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: allocationTaxonomy.subCategoryId,
        amount: '-450.00',
        occurredAt: new Date(2024, 4, 10),
        title: 'May divestment',
      })
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
      const { CategorySparkline } = await import('@/components/dashboard/category-sparkline')

      const result = await dashboardModule.getCategoryYearRanking(2024, 'allocation')
      expect(result).toHaveLength(1)
      const item = result[0]!

      const element = createElement(CategorySparkline, {
        points: item.sparkline.map((point) => ({
          month: point.month,
          label: point.label,
          amount: point.amount,
        })),
        type: 'allocation',
        pointStates: item.sparkline.map((point) => point.state),
        estimatedHeightHint: item.pace,
      })
      const html = renderToStaticMarkup(element)

      const markerOccurrences = html.split('border-top:2px solid var(--total-allocation)').length - 1
      expect(markerOccurrences).toBe(1)
    })
  },
)
