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
  assertHarnessReachableInCi,
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

// WR-04: skipping is fine locally, fatal in CI. This file carries the RETIRE-05 byte-identical
// baseline (D-15) that Phase 83 re-runs unchanged to prove its `direction.hidden` predicate flip
// moved nothing (D-16). A vacuous green here would let that flip land unguarded — the exact
// silent failure this phase was sequenced before any Categories UI to prevent.
assertHarnessReachableInCi(harness, '[pace-engine-regression]')

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

// getCategoryMonthlyAmounts had zero test coverage before this fix pass: 82-01-SUMMARY.md's D3
// entry claimed it was verified by tests/pace-and-projection.test.ts#buildCoveredMonthSeries,
// which is a pure unit test fed hand-built MonthlyValue[] fixtures and never imports or invokes
// the DAL function at all — the real SQL join chain (ledgerRowSource -> expense -> subCategory,
// dateScopedTransactions, coalesce(abs(sum(...)), 0), monthsBetween zero-fill) was never proven
// against a real database (WR-01 review fix).
describeIfReachable('getCategoryMonthlyAmounts — real Postgres (WR-01 review fix, PACE-01 D-02, T-82-01)', () => {
  it('zero-fills a Covered Month with no movement for this category (D-02) and never returns another user\'s amounts under a mismatched categoryId (T-82-01)', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    const taxonomy = await seedMinimalTaxonomy(db, userId)

    // January and March have movement in the target category; February is a Covered Month for
    // this user's account (the January transaction proves the account has data in 2024) but has
    // NO movement in THIS category — D-02 requires it to count as '0.00', never vanish.
    await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-120.00',
      occurredAt: new Date(2024, 0, 10),
      title: 'January essential spend',
    })
    await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-80.00',
      occurredAt: new Date(2024, 2, 5),
      title: 'March essential spend',
    })

    // A second user's category/spend, reusing the first taxonomy's essentialNatureId (direction/
    // nature are global lookups — see the userId-scoping test above for why seedMinimalTaxonomy
    // cannot be called twice).
    const { userId: otherUserId } = await seedUser(db, {
      email: 'category-monthly-other@example.test',
    })
    const { subCategoryId: otherSubCategoryId, categoryId: otherCategoryId } =
      await seedSecondEssentialCategory(db, {
        userId: otherUserId,
        natureId: taxonomy.essentialNatureId,
      })
    await seedExpenseWithTransaction(db, {
      userId: otherUserId,
      subCategoryId: otherSubCategoryId,
      amount: '-999.00',
      occurredAt: new Date(2024, 1, 15),
      title: 'Other user February spend',
    })

    vi.mocked(verifySession).mockResolvedValue({ userId } as never)
    vi.doMock('@/lib/db', () => ({ db }))
    vi.resetModules()
    const coveredMonthsModule = await import('@/lib/dal/covered-months')

    const result = await coveredMonthsModule.getCategoryMonthlyAmounts(
      taxonomy.essentialCategoryId,
      2024,
    )

    expect(result).toHaveLength(12)
    expect(result.map((m) => m.yearMonth)).toEqual([
      '2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06',
      '2024-07', '2024-08', '2024-09', '2024-10', '2024-11', '2024-12',
    ])

    const byMonth = new Map(result.map((m) => [m.yearMonth, m.amount]))
    expect(toDecimal(byMonth.get('2024-01') ?? '0').equals(toDecimal('120.00'))).toBe(true)
    // D-02: covered-but-no-movement-for-this-category counts as '0.00', it does not vanish from
    // the 12-entry series — and the other user's February spend must not leak in either.
    expect(byMonth.get('2024-02')).toBe('0.00')
    expect(toDecimal(byMonth.get('2024-03') ?? '0').equals(toDecimal('80.00'))).toBe(true)
    // Every remaining month with zero real movement is zero-filled too.
    expect(byMonth.get('2024-04')).toBe('0.00')
    expect(byMonth.get('2024-12')).toBe('0.00')

    // T-82-01: querying the OTHER user's categoryId under THIS user's session must return an
    // all-zero series, never the other user's real -999.00 amount — the userId filter inside
    // dateScopedTransactions gates every row, not merely the categoryId join.
    const crossUserResult = await coveredMonthsModule.getCategoryMonthlyAmounts(
      otherCategoryId,
      2024,
    )
    expect(crossUserResult).toHaveLength(12)
    expect(crossUserResult.every((m) => m.amount === '0.00')).toBe(true)
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
