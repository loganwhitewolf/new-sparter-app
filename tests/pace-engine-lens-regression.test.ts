// Real-Postgres proof for the shared number engine's foundation (Phase 82, Plan 82-01,
// ADR 0020 §4). Two describe blocks:
//
// 1. "Covered Months engine" — the tracer's end-to-end proof: getCoveredMonthsInYear(year) ->
//    computePaceAndProjection(monthlyValues) -> PaceResult, against a real-Postgres fixture with
//    a gap month, a zero-transaction year, and a second user's fixture (T-82-01 userId scoping).
// 2. "Overview and Tags totals — byte-identical regression" — the RETIRE-05 baseline. This test
//    is re-run unchanged by every later Phase 82 wave (Sampling Rate policy) and by Phase 83
//    after its direction.hidden predicate flip (D-16) — do not edit its expected values without
//    a genuine intentional change to Overview/Tags totals.
//
// Follows tests/amortization-lens-regression.test.ts's exact harness pattern (real-Postgres,
// describeIfReachable guarded on harness.ok, graceful skip without Docker).
import { afterAll, describe, expect, it, vi } from 'vitest'
import { verifySession } from '@/lib/dal/auth'
import { toDecimal } from '@/lib/utils/decimal'
import {
  captureAggregationSnapshot,
  connectReimbursementTestDb,
  resetReimbursementFixtures,
  type ReimbursementTestDb,
} from './helpers/reimbursement-test-db'
import {
  attachTagToTransaction,
  seedExpenseWithTransaction,
  seedMinimalTaxonomy,
  seedSecondEssentialCategory,
  seedTag,
  seedUser,
} from './fixtures/reimbursement-seed'

vi.mock('@/lib/dal/auth', () => ({ verifySession: vi.fn() }))
vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))

const harness = await connectReimbursementTestDb()

if (!harness.ok) {
  console.warn(
    '[pace-engine-regression] Local Postgres unreachable — run `yarn db:up` to enable this suite. Skipping.',
  )
}

const describeIfReachable = harness.ok ? describe : describe.skip

function requireHarnessDb(): ReimbursementTestDb {
  if (!harness.ok) {
    throw new Error('pace-engine-regression: harness unreachable — this must be unreachable when skipped')
  }
  return harness.db
}

afterAll(async () => {
  if (harness.ok) {
    await harness.pool.end()
  }
})

describeIfReachable('Covered Months engine — real Postgres (PACE-01, D-01/D-04/D-05/D-11)', () => {
  it('returns exactly the 3 seeded Covered Months ascending and computes pace/projection from them', async () => {
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
    const coveredMonthsModule = await import('@/lib/dal/covered-months')
    const paceModule = await import('@/lib/services/pace-and-projection')

    const coveredMonths = await coveredMonthsModule.getCoveredMonthsInYear(2024)
    expect(coveredMonths.map((m) => m.yearMonth)).toEqual(['2024-01', '2024-02', '2024-03'])

    // MonthlyValue amounts are magnitudes (D-02/D-11 convention — matches getCategoryRanking's
    // abs(sum(...))), fed here directly since getCategoryMonthlyAmounts is not yet built (Task 2).
    const result = paceModule.computePaceAndProjection([
      { yearMonth: '2024-01', amount: '400.00' },
      { yearMonth: '2024-02', amount: '420.00' },
      { yearMonth: '2024-03', amount: '410.00' },
    ])

    expect(result.status).toBe('complete')
    if (result.status === 'complete') {
      expect(toDecimal(result.pace).equals(toDecimal('410.00'))).toBe(true)
      expect(toDecimal(result.projection).equals(toDecimal('4920.00'))).toBe(true)
      expect(result.coveredMonthCount).toBe(3)
    }
  })

  it('returns [] for a zero-transaction year, never throwing, and computePaceAndProjection([]) is insufficient', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    vi.mocked(verifySession).mockResolvedValue({ userId } as never)
    await seedMinimalTaxonomy(db, userId)
    // Deliberately no transactions seeded.

    vi.doMock('@/lib/db', () => ({ db }))
    vi.resetModules()
    const coveredMonthsModule = await import('@/lib/dal/covered-months')
    const paceModule = await import('@/lib/services/pace-and-projection')

    const coveredMonths = await coveredMonthsModule.getCoveredMonthsInYear(2024)
    expect(coveredMonths).toEqual([])

    const result = paceModule.computePaceAndProjection([])
    expect(result).toEqual({ status: 'insufficient', coveredMonthCount: 0 })
  })

  it('never leaks a second user\'s Covered Months into the first user\'s result (T-82-01 userId scoping)', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId: firstUserId } = await seedUser(db, { email: 'pace-user-1@example.test' })
    const taxonomy = await seedMinimalTaxonomy(db, firstUserId)
    await seedExpenseWithTransaction(db, {
      userId: firstUserId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-100.00',
      occurredAt: new Date(2024, 0, 10),
      title: 'First user January',
    })

    const { userId: secondUserId } = await seedUser(db, { email: 'pace-user-2@example.test' })
    // direction/nature are global lookups (not user-scoped) — reuse the first taxonomy's
    // essentialNatureId instead of calling seedMinimalTaxonomy again, which would violate
    // direction/nature's unique(code) constraint on a second insert.
    const { subCategoryId: secondSubCategoryId } = await seedSecondEssentialCategory(db, {
      userId: secondUserId,
      natureId: taxonomy.essentialNatureId,
    })
    await seedExpenseWithTransaction(db, {
      userId: secondUserId,
      subCategoryId: secondSubCategoryId,
      amount: '-200.00',
      occurredAt: new Date(2024, 3, 10),
      title: 'Second user April',
    })

    vi.mocked(verifySession).mockResolvedValue({ userId: firstUserId } as never)
    vi.doMock('@/lib/db', () => ({ db }))
    vi.resetModules()
    const coveredMonthsModule = await import('@/lib/dal/covered-months')

    const coveredMonths = await coveredMonthsModule.getCoveredMonthsInYear(2024)
    expect(coveredMonths.map((m) => m.yearMonth)).toEqual(['2024-01'])
  })
})

// This test is re-run unchanged by every later Phase 82 wave (Sampling Rate policy) and by
// Phase 83 after its direction.hidden predicate flip (D-16) — do not edit its expected values
// without a genuine intentional change to Overview/Tags totals.
describeIfReachable('Overview and Tags totals — byte-identical regression (RETIRE-05, D-15/D-16)', () => {
  it('produces hardcoded, byte-identical Overview and Tags totals for the seeded fixture', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    vi.mocked(verifySession).mockResolvedValue({ userId } as never)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const { tagId } = await seedTag(db, { userId, name: 'RETIRE-05 baseline' })

    const { transactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-100.00',
      occurredAt: new Date(2024, 0, 15),
      title: 'RETIRE-05 baseline transaction',
    })
    await attachTagToTransaction(db, { tagId, transactionId })

    const dateRange = { from: new Date(2024, 0, 1), to: new Date(2024, 0, 31, 23, 59, 59, 999) }

    const snapshot = await captureAggregationSnapshot({
      harnessDb: db,
      userId,
      dateRange,
      categoryId: taxonomy.essentialCategoryId,
      tagId,
    })

    // Hardcoded, hand-computed from the fixture above — never re-derived from the function under
    // test. A single -100.00 outflow: getOverviewAmountTotals.totalOut is the abs magnitude;
    // getTagTotals' per-tag total is the signed sum.
    const overviewTotals = snapshot.getOverviewAmountTotals as { totalOut: string }
    expect(toDecimal(overviewTotals.totalOut).equals(toDecimal('100.00'))).toBe(true)

    const tagTotals = snapshot.getTagTotals as Array<{ tagId: number; total: string }>
    const ourTagTotal = tagTotals.find((row) => row.tagId === tagId)
    expect(ourTagTotal).toBeDefined()
    expect(toDecimal(ourTagTotal?.total ?? '0').equals(toDecimal('-100.00'))).toBe(true)
  })
})
