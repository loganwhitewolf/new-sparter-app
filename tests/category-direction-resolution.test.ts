// Real-Postgres guard for the two category-direction resolution subqueries (the ones that decide
// whether a category renders with in/out colouring): getCategoryDetailMeta and the equivalent
// lookup inside getCategoryDetail.
//
// Why this needs real Postgres and not a mocked db: the bug this file exists to prevent was purely
// a SQL-semantics one. Both subqueries correlated on `${category.id}`, which Drizzle renders
// UNQUALIFIED (`"id"`) inside a select-list `sql` template of a single-table query — so
// `sc2.category_id = "id"` silently bound to `sub_category sc2`'s own `id` column instead of the
// outer category. Postgres accepted it, the subquery matched nothing, `type` came back null, and
// the `?? 'out'` fallback made EVERY category render as an uscita: red chart bars and inverted
// "in più"/"in meno" judgement colours on every entrata. No unit test with a mocked db can catch
// that — the query has to actually run.
//
// Harness pattern copied from tests/pace-engine-lens-regression.test.ts (host-guarded test db,
// graceful local skip, fatal in CI).
import { describe, expect, it, vi, afterAll } from 'vitest'
import { verifySession } from '@/lib/dal/auth'
import {
  assertHarnessReachableInCi,
  connectReimbursementTestDb,
  resetReimbursementFixtures,
  type ReimbursementTestDb,
} from './helpers/reimbursement-test-db'
import { seedMinimalTaxonomy, seedUser } from './fixtures/reimbursement-seed'

vi.mock('@/lib/dal/auth', () => ({ verifySession: vi.fn() }))
vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))

const harness = await connectReimbursementTestDb()

assertHarnessReachableInCi(harness, '[category-direction-resolution]')

if (!harness.ok) {
  console.warn(
    '[category-direction-resolution] Local Postgres unreachable — run `yarn db:up` to enable this suite. Skipping.',
  )
}

const describeIfReachable = harness.ok ? describe : describe.skip

function requireHarnessDb(): ReimbursementTestDb {
  if (!harness.ok) {
    throw new Error('category-direction-resolution: harness unreachable — unreachable when skipped')
  }
  return harness.db
}

afterAll(async () => {
  if (harness.ok) {
    await harness.pool.end()
  }
})

describeIfReachable('category direction resolution — real Postgres', () => {
  it('resolves an in-direction category as "in" and an out-direction one as "out"', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    vi.mocked(verifySession).mockResolvedValue({ userId } as never)
    const taxonomy = await seedMinimalTaxonomy(db, userId)

    vi.doMock('@/lib/db', () => ({ db }))
    vi.resetModules()
    const detailModule = await import('@/lib/dal/category-detail-year-window')

    const incomeMeta = await detailModule.getCategoryDetailMeta(taxonomy.incomeCategoryId)
    const expenseMeta = await detailModule.getCategoryDetailMeta(taxonomy.essentialCategoryId)

    // The regression: before the fix BOTH of these came back 'out' via the null fallback.
    expect(incomeMeta?.type).toBe('in')
    expect(expenseMeta?.type).toBe('out')
  })

  it('resolves the same directions through getCategoryDetail (dashboard.ts lookup)', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    vi.mocked(verifySession).mockResolvedValue({ userId } as never)
    const taxonomy = await seedMinimalTaxonomy(db, userId)

    vi.doMock('@/lib/db', () => ({ db }))
    vi.resetModules()
    const dashboardModule = await import('@/lib/dal/dashboard')

    const range = { from: new Date(2024, 0, 1), to: new Date(2024, 11, 31, 23, 59, 59, 999), type: 'all' as const }
    const income = await dashboardModule.getCategoryDetail(taxonomy.incomeCategoryId, range)
    const expense = await dashboardModule.getCategoryDetail(taxonomy.essentialCategoryId, range)

    expect(income.category?.type).toBe('in')
    expect(expense.category?.type).toBe('out')
  })
})
