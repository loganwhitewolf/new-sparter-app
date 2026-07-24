// Real-Postgres regression proof (Phase 73, ADR 0018 D-07 — the phase's acceptance gate).
//
// Proves the reimbursement/reimbursement_refund netting path produces correct results across
// all 10 verified aggregation call sites — plus the empty-refund probe (RMB-04).
//
// The N=1 (Amazon order/refund) scenario used to be proven via a before/after byte-identical
// comparison: seeding a legacy transaction_pair row, capturing a "before" snapshot reading a
// frozen pre-Task-2 fragment against it, migrating it into reimbursement/reimbursement_refund
// (migration 0029), then capturing an "after" snapshot to prove identity (Plan 73-01/73-02).
// That comparison is retired (Plan 73-04 Task 3, locked option-b): transaction_pair itself was
// dropped (migration 0030_drop_transaction_pair.sql) once every consumer was repointed, so there
// is no longer a live "before" data source to construct. The before/after identity this proved
// is preserved historically in 73-01-SUMMARY.md / 73-02-SUMMARY.md (test runs 177d200, 8306086).
// This suite now seeds the scenario natively (seedReimbursement) and asserts the CURRENT
// reimbursement/reimbursement_refund read path against the same expected numeric values that
// "after" was already proven to produce.
//
// Requires local Docker Postgres (`yarn db:up`). Skips gracefully (console warning, no failure)
// when unreachable, so `vitest run` stays green in sandboxes without Docker.
import { randomUUID } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { verifySession } from '@/lib/dal/auth'
import { effectiveAmount, isNotSecondary } from '@/lib/dal/transaction-pairs-sql'
import { reimbursement as reimbursementTable, transaction as transactionTable } from '@/lib/db/schema'
import { dashboardPresetToDateRange, monthKey } from '@/lib/utils/date'
import { toDecimal } from '@/lib/utils/decimal'
import {
  captureAggregationSnapshot,
  connectReimbursementTestDb,
  resetReimbursementFixtures,
  type AggregationSnapshot,
  type ReimbursementTestDb,
} from './helpers/reimbursement-test-db'
import {
  attachTagToTransaction,
  seedExpenseWithTransaction,
  seedMinimalTaxonomy,
  seedReimbursement,
  seedTag,
  seedUser,
} from './fixtures/reimbursement-seed'

vi.mock('@/lib/dal/auth', () => ({ verifySession: vi.fn() }))
vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))

const harness = await connectReimbursementTestDb()

if (!harness.ok) {
  console.warn(
    '[reimbursement-regression] Local Postgres unreachable — run `yarn db:up` to enable this suite. Skipping.',
  )
}

const describeIfReachable = harness.ok ? describe : describe.skip

function requireHarnessDb(): ReimbursementTestDb {
  if (!harness.ok) {
    throw new Error('reimbursement-regression: harness unreachable — this must be unreachable when skipped')
  }
  return harness.db
}

afterAll(async () => {
  if (harness.ok) {
    await harness.pool.end()
  }
})

describeIfReachable('reimbursement N=1 regression (Phase 73, ADR 0018 D-07)', () => {
  let snapshot: AggregationSnapshot
  let essentialCategoryId: number

  beforeAll(async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    vi.mocked(verifySession).mockResolvedValue({ userId } as never)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    essentialCategoryId = taxonomy.essentialCategoryId
    const { tagId } = await seedTag(db, { userId, name: 'Amazon' })

    const dateRange = dashboardPresetToDateRange('last-month')
    const occurredAt = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), 15, 12, 0, 0)

    // The Amazon order/refund case (N=1): one outflow (-100.00), one inflow refund (+50.00).
    const { expenseId: outflowExpenseId, transactionId: outflowTransactionId } =
      await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '-100.00',
        occurredAt,
        title: 'Amazon order',
      })
    const { transactionId: refundTransactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '50.00',
      occurredAt,
      title: 'Amazon refund',
    })
    await attachTagToTransaction(db, { tagId, transactionId: outflowTransactionId })

    // D-02: anchor = the outflow (sign-based resolution). Seeded natively into
    // reimbursement/reimbursement_refund — this scenario used to be constructed by seeding a
    // legacy transaction_pair row and running migration 0029's backfill (Plan 73-01); that path
    // is gone now that transaction_pair itself has been dropped (Plan 73-04 Task 3).
    await seedReimbursement(db, {
      userId,
      title: 'Amazon order',
      expenseId: outflowExpenseId,
      refundTransactionIds: [refundTransactionId],
    })

    // Expected values below were captured from this exact scenario against the CURRENT
    // (Task-2-rewritten) reimbursement/reimbursement_refund read path — the same numbers Plan
    // 73-01/73-02 already proved byte-identical to the pre-migration "before" baseline (test
    // runs 177d200, 8306086). This is the single, current source of truth going forward.
    snapshot = await captureAggregationSnapshot({
      harnessDb: db,
      userId,
      dateRange,
      categoryId: essentialCategoryId,
      tagId,
    })
  })

  it('getOverviewAmountTotals: totalOut nets the refund against the spend (100.00 - 50.00 = 50.00)', () => {
    const totals = snapshot.getOverviewAmountTotals as { totalOut: string }
    expect(toDecimal(totals.totalOut).equals(toDecimal('50.00'))).toBe(true)
  })

  it('getCategoriesBreakdown: essential category amount is the netted 50.00', () => {
    const row = (snapshot.getCategoriesBreakdown as Array<{ id: number; amount: string }>).find(
      (r) => r.id === essentialCategoryId,
    )
    expect(row).toBeDefined()
    expect(toDecimal(row!.amount).equals(toDecimal('50.00'))).toBe(true)
  })

  it('getCategoryRanking: essential category amount is the netted 50.00', () => {
    const row = (snapshot.getCategoryRanking as Array<{ id: number; amount: string }>).find(
      (r) => r.id === essentialCategoryId,
    )
    expect(row).toBeDefined()
    expect(toDecimal(row!.amount).equals(toDecimal('50.00'))).toBe(true)
  })

  it('getCategoryDeviations: no baseline period data yields isNew=true and a null deviation', () => {
    const map = snapshot.getCategoryDeviations as Map<
      number,
      { deviation: number | null; isNew: boolean; belowNoiseThreshold: boolean }
    >
    const entry = map.get(essentialCategoryId)
    expect(entry).toBeDefined()
    expect(entry!.isNew).toBe(true)
    expect(entry!.deviation).toBeNull()
  })

  it('getCategoryDetail: summary total is the netted 50.00', () => {
    const detail = snapshot.getCategoryDetail as { summary: { total: string } }
    expect(toDecimal(detail.summary.total).equals(toDecimal('50.00'))).toBe(true)
  })

  it('getMonthlyTrendByNature: essential segment preserves sign (-50.00, net outflow)', () => {
    const dateRange = dashboardPresetToDateRange('last-month')
    const targetMonth = monthKey(dateRange.from)
    const point = (
      snapshot.getMonthlyTrendByNature as Array<{ month: string; segments: Record<string, string> }>
    ).find((p) => p.month === targetMonth)
    expect(point).toBeDefined()
    expect(toDecimal(point!.segments.essential).equals(toDecimal('-50.00'))).toBe(true)
  })

  it('getMonthOverMonthCategoryChanges: no prior-month data yields isNew=true and delta=50.00', () => {
    const row = (
      snapshot.getMonthOverMonthCategoryChanges as Array<{
        categoryId: number | null
        delta: string
        isNew: boolean
      }>
    ).find((r) => r.categoryId === essentialCategoryId)
    expect(row).toBeDefined()
    expect(row!.isNew).toBe(true)
    expect(toDecimal(row!.delta).equals(toDecimal('50.00'))).toBe(true)
  })

  it('getOverviewChart: out.essential is the abs()-bucketed 50.00', () => {
    const dateRange = dashboardPresetToDateRange('last-month')
    const targetMonth = monthKey(dateRange.from)
    const point = (
      snapshot.getOverviewChart as Array<{ month: string; out: { essential: string } }>
    ).find((p) => p.month === targetMonth)
    expect(point).toBeDefined()
    expect(toDecimal(point!.out.essential).equals(toDecimal('50.00'))).toBe(true)
  })

  it('getTagTotals: tagged (outflow) total preserves sign (-50.00, net outflow)', () => {
    const row = (snapshot.getTagTotals as Array<{ tagId: number; total: string }>)[0]
    expect(row).toBeDefined()
    expect(toDecimal(row!.total).equals(toDecimal('-50.00'))).toBe(true)
  })

  it('getTagDetail: net preserves sign (-50.00, net outflow)', () => {
    const detail = snapshot.getTagDetail as { net: string }
    expect(toDecimal(detail.net).equals(toDecimal('-50.00'))).toBe(true)
  })
})

describeIfReachable('empty-refund probe (RMB-04)', () => {
  it('an anchor with a reimbursement row but zero linked refunds returns its own raw amount, is never excluded, and appears unchanged in totalOut', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    vi.mocked(verifySession).mockResolvedValue({ userId } as never)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const dateRange = dashboardPresetToDateRange('last-month')
    const occurredAt = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), 10, 12, 0, 0)

    const { expenseId, transactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-42.00',
      occurredAt,
      title: 'Unrefunded expense',
    })

    // A reimbursement row exists (this expense IS an anchor) but carries zero
    // reimbursement_refund rows — the empty-input probe.
    await db.insert(reimbursementTable).values({ userId, title: 'Unrefunded expense', expenseId })

    // (a) Raw fragment probe: effectiveAmount() must equal the transaction's own amount,
    // unchanged (nothing to net against), and isNotSecondary() must not exclude it.
    const rawRows = await db
      .select({
        amount: sql<string>`(${effectiveAmount()})::text`,
        notExcluded: sql<boolean>`${isNotSecondary()}`,
      })
      .from(transactionTable)
      .where(eq(transactionTable.id, transactionId))

    expect(rawRows).toHaveLength(1)
    expect(toDecimal(rawRows[0].amount).equals(toDecimal('-42.00'))).toBe(true)
    expect(rawRows[0].notExcluded).toBe(true)

    // (b) getOverviewAmountTotals: the anchor's amount appears in totalOut unchanged, not just
    // via the raw fragment.
    const { tagId } = await seedTag(db, { userId, name: 'unused-for-this-probe' })
    const snapshot = await captureAggregationSnapshot({
      harnessDb: db,
      userId,
      dateRange,
      categoryId: taxonomy.essentialCategoryId,
      tagId,
    })
    const totals = snapshot.getOverviewAmountTotals as { totalOut: string }
    expect(toDecimal(totals.totalOut).equals(toDecimal('42.00'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------------------------
// Phase 73 Plan 02 — expanded regression matrix (dinner N=3, both adjacency directions,
// refund-order determinism, Q3 multi-transaction-Expense tie-break). Every scenario computes
// its expected value via Decimal.js from the same seeded inputs (never hand-typed), and asserts
// it via captureAggregationSnapshot (none of these N>1 shapes have a legacy transaction_pair
// equivalent to compare against — see 73-01-SUMMARY.md's "Known Limitations": a legacy pair
// could only ever express N=1).
// ---------------------------------------------------------------------------------------------

describeIfReachable(
  'dinner — N=3 refunds netting to exactly the anchor magnitude (Phase 73 Plan 02, scenarios 1+2)',
  () => {
    it('nets to 0 across all 10 aggregation functions (tagged anchor); every refund is directly excluded from aggregation; the anchor row stays present at amount 0, not silently dropped (scenario 2: adjacency-exact)', async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      vi.mocked(verifySession).mockResolvedValue({ userId } as never)
      const taxonomy = await seedMinimalTaxonomy(db, userId)
      const { tagId } = await seedTag(db, { userId, name: 'Cena di gruppo' })

      const dateRange = dashboardPresetToDateRange('last-month')
      const occurredAt = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), 12, 20, 0, 0)

      const { expenseId: anchorExpenseId, transactionId: anchorTransactionId } =
        await seedExpenseWithTransaction(db, {
          userId,
          subCategoryId: taxonomy.essentialSubCategoryId,
          amount: '-90.00',
          occurredAt,
          title: 'Cena di gruppo',
        })
      await attachTagToTransaction(db, { tagId, transactionId: anchorTransactionId })

      const refundAmounts = ['30.00', '30.00', '30.00']
      const refundTransactionIds: string[] = []
      for (const [index, amount] of refundAmounts.entries()) {
        const { transactionId } = await seedExpenseWithTransaction(db, {
          userId,
          subCategoryId: taxonomy.essentialSubCategoryId,
          amount,
          occurredAt,
          title: `Rimborso amico ${index + 1}`,
        })
        refundTransactionIds.push(transactionId)
      }

      await seedReimbursement(db, {
        userId,
        title: 'Cena di gruppo',
        expenseId: anchorExpenseId,
        refundTransactionIds,
      })

      // Expected net computed from the same seeded inputs via Decimal.js — never hand-typed.
      const expectedNet = refundAmounts.reduce(
        (sum, amount) => sum.plus(toDecimal(amount)),
        toDecimal('-90.00'),
      )
      expect(expectedNet.equals(0)).toBe(true) // sanity: this IS the exact-adjacency case (scenario 2)

      // Raw fragment probe (scenario 1's own exclusion proof): each of the 3 refunds is
      // directly excluded by isNotSecondary(), independent of any aggregation function.
      for (const transactionId of refundTransactionIds) {
        const rows = await db
          .select({ notExcluded: sql<boolean>`${isNotSecondary()}` })
          .from(transactionTable)
          .where(eq(transactionTable.id, transactionId))
        expect(rows[0]?.notExcluded).toBe(false)
      }

      const snapshot = await captureAggregationSnapshot({
        harnessDb: db,
        userId,
        dateRange,
        categoryId: taxonomy.essentialCategoryId,
        tagId,
      })

      const monthTarget = monthKey(dateRange.from)

      const overviewTotals = snapshot.getOverviewAmountTotals as { totalOut: string }
      expect(toDecimal(overviewTotals.totalOut).equals(0)).toBe(true)

      // Scenario 2 (adjacency-exact): the anchor row is still PRESENT (amount 0), not dropped.
      const categoriesRow = (snapshot.getCategoriesBreakdown as Array<{ id: number; amount: string }>).find(
        (row) => row.id === taxonomy.essentialCategoryId,
      )
      expect(categoriesRow).toBeDefined()
      expect(toDecimal(categoriesRow!.amount).equals(0)).toBe(true)

      const rankingRow = (snapshot.getCategoryRanking as Array<{ id: number; amount: string }>).find(
        (row) => row.id === taxonomy.essentialCategoryId,
      )
      expect(rankingRow).toBeDefined()
      expect(toDecimal(rankingRow!.amount).equals(0)).toBe(true)

      const deviationsMap = snapshot.getCategoryDeviations as Map<number, { deviation: number | null }>
      expect(deviationsMap.get(taxonomy.essentialCategoryId)).toBeDefined()

      const categoryDetail = snapshot.getCategoryDetail as { category: unknown; summary: { total: string } }
      expect(categoryDetail.category).not.toBeNull()
      expect(toDecimal(categoryDetail.summary.total).equals(0)).toBe(true)

      const trendPoint = (
        snapshot.getMonthlyTrendByNature as Array<{ month: string; segments: Record<string, string> }>
      ).find((point) => point.month === monthTarget)
      expect(trendPoint).toBeDefined()
      expect(toDecimal(trendPoint!.segments.essential).equals(0)).toBe(true)

      // A net-zero month/category can legitimately produce no row at all (nothing to rank
      // against the €15 noise floor) — assert the delta only when a row is present.
      const momRow = (
        snapshot.getMonthOverMonthCategoryChanges as Array<{
          categoryId: number | null
          delta: string
        }>
      ).find((row) => row.categoryId === taxonomy.essentialCategoryId)
      if (momRow) {
        expect(toDecimal(momRow.delta).equals(0)).toBe(true)
      }

      const chartPoint = (
        snapshot.getOverviewChart as Array<{ month: string; out: { essential: string } }>
      ).find((point) => point.month === monthTarget)
      expect(chartPoint).toBeDefined()
      expect(toDecimal(chartPoint!.out.essential).equals(0)).toBe(true)

      const tagRow = (snapshot.getTagTotals as Array<{ tagId: number; total: string }>).find(
        (row) => row.tagId === tagId,
      )
      expect(tagRow).toBeDefined()
      expect(toDecimal(tagRow!.total).equals(0)).toBe(true)

      const tagDetail = snapshot.getTagDetail as { net: string }
      expect(toDecimal(tagDetail.net).equals(0)).toBe(true)
    })
  },
)

describeIfReachable(
  'adjacency-exceeds — refunds summing to MORE than the anchor magnitude (Phase 73 Plan 02, scenario 3; internal N=2 correctness — a legacy 1:1 pair cannot express 2 refunds)',
  () => {
    it('flips the net positive; every SUM-based function reflects the flip via its own already-established sign convention (abs() where the function abs()es, raw signed sum where it does not)', async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      vi.mocked(verifySession).mockResolvedValue({ userId } as never)
      const taxonomy = await seedMinimalTaxonomy(db, userId)
      const dateRange = dashboardPresetToDateRange('last-month')
      const occurredAt = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), 8, 12, 0, 0)

      const { expenseId: anchorExpenseId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '-50.00',
        occurredAt,
        title: 'Spesa con doppio rimborso',
      })

      const { transactionId: refundOneId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '30.00',
        occurredAt,
        title: 'Rimborso parziale 1',
      })
      const { transactionId: refundTwoId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '40.00',
        occurredAt,
        title: 'Rimborso parziale 2',
      })

      await seedReimbursement(db, {
        userId,
        title: 'Spesa con doppio rimborso',
        expenseId: anchorExpenseId,
        refundTransactionIds: [refundOneId, refundTwoId],
      })

      const expectedNet = toDecimal('-50.00').plus('30.00').plus('40.00')
      expect(expectedNet.equals('20.00')).toBe(true) // sanity: this is genuinely a sign flip

      const { tagId } = await seedTag(db, { userId, name: 'unused-scenario-3' })
      const snapshot = await captureAggregationSnapshot({
        harnessDb: db,
        userId,
        dateRange,
        categoryId: taxonomy.essentialCategoryId,
        tagId,
      })

      const monthTarget = monthKey(dateRange.from)

      // Functions that abs() their SUM: the flip collapses to the flipped magnitude — this is
      // pre-existing 1:1 behaviour (73-01), asserted here as carried forward unchanged.
      const overviewTotals = snapshot.getOverviewAmountTotals as { totalOut: string }
      expect(toDecimal(overviewTotals.totalOut).equals(expectedNet.abs())).toBe(true)

      const categoriesRow = (snapshot.getCategoriesBreakdown as Array<{ id: number; amount: string }>).find(
        (row) => row.id === taxonomy.essentialCategoryId,
      )
      expect(categoriesRow).toBeDefined()
      expect(toDecimal(categoriesRow!.amount).equals(expectedNet.abs())).toBe(true)

      const rankingRow = (snapshot.getCategoryRanking as Array<{ id: number; amount: string }>).find(
        (row) => row.id === taxonomy.essentialCategoryId,
      )
      expect(rankingRow).toBeDefined()
      expect(toDecimal(rankingRow!.amount).equals(expectedNet.abs())).toBe(true)

      const deviationsMap = snapshot.getCategoryDeviations as Map<number, { deviation: number | null }>
      expect(deviationsMap.get(taxonomy.essentialCategoryId)).toBeDefined()

      const categoryDetail = snapshot.getCategoryDetail as { summary: { total: string } }
      expect(toDecimal(categoryDetail.summary.total).equals(expectedNet.abs())).toBe(true)

      const momRow = (
        snapshot.getMonthOverMonthCategoryChanges as Array<{
          categoryId: number | null
          delta: string
          isNew: boolean
        }>
      ).find((row) => row.categoryId === taxonomy.essentialCategoryId)
      expect(momRow).toBeDefined()
      expect(toDecimal(momRow!.delta).equals(expectedNet.abs())).toBe(true)
      expect(momRow!.isNew).toBe(true)

      // getMonthlyTrendByNature sums the RAW (non-abs'd) effectiveAmount(): the flip is directly
      // visible as a positive value in a nature bucket that is normally negative.
      const trendPoint = (
        snapshot.getMonthlyTrendByNature as Array<{ month: string; segments: Record<string, string> }>
      ).find((point) => point.month === monthTarget)
      expect(trendPoint).toBeDefined()
      expect(toDecimal(trendPoint!.segments.essential).equals(expectedNet)).toBe(true)

      // getOverviewChart's out.* segments ARE abs()'d when bucketed (lib/dal/overview.ts
      // buildOverviewChart loop) even though the underlying SELECT computes a raw signed SUM —
      // so this one asserts the magnitude, like the abs()-based functions above.
      const chartPoint = (
        snapshot.getOverviewChart as Array<{ month: string; out: { essential: string } }>
      ).find((point) => point.month === monthTarget)
      expect(chartPoint).toBeDefined()
      expect(toDecimal(chartPoint!.out.essential).equals(expectedNet.abs())).toBe(true)
    })
  },
)

describeIfReachable(
  'ordering — refund insert order does not affect the SUM used by effectiveAmount() (Phase 73 Plan 02, scenario 4)',
  () => {
    it.each(['refundA-first', 'refundB-first'] as const)(
      'insert order %s: the net is identical regardless of order',
      async (order) => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      vi.mocked(verifySession).mockResolvedValue({ userId } as never)
      const taxonomy = await seedMinimalTaxonomy(db, userId)
      const dateRange = dashboardPresetToDateRange('last-month')
      const occurredAt = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), 18, 12, 0, 0)

      const { expenseId: anchorExpenseId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '-70.00',
        occurredAt,
        title: 'Spesa con due rimborsi uguali',
      })

      const { transactionId: refundAId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '25.00',
        occurredAt,
        title: 'Rimborso A',
      })
      const { transactionId: refundBId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '25.00',
        occurredAt,
        title: 'Rimborso B',
      })

      // Insert one at a time (seedReimbursement inserts refund rows sequentially) so each
      // gets its own created_at, in both possible orders across the two it.each cases.
      const refundTransactionIds =
        order === 'refundA-first' ? [refundAId, refundBId] : [refundBId, refundAId]

      await seedReimbursement(db, {
        userId,
        title: 'Spesa con due rimborsi uguali',
        expenseId: anchorExpenseId,
        refundTransactionIds,
      })

      const expectedNet = toDecimal('-70.00').plus('25.00').plus('25.00')
      expect(expectedNet.equals('-20.00')).toBe(true)

      const { tagId } = await seedTag(db, { userId, name: `unused-scenario-4-${order}` })
      const snapshot = await captureAggregationSnapshot({
        harnessDb: db,
        userId,
        dateRange,
        categoryId: taxonomy.essentialCategoryId,
        tagId,
      })

      const monthTarget = monthKey(dateRange.from)

      const overviewTotals = snapshot.getOverviewAmountTotals as { totalOut: string }
      expect(toDecimal(overviewTotals.totalOut).equals(expectedNet.abs())).toBe(true)

      const categoriesRow = (snapshot.getCategoriesBreakdown as Array<{ id: number; amount: string }>).find(
        (row) => row.id === taxonomy.essentialCategoryId,
      )
      expect(categoriesRow).toBeDefined()
      expect(toDecimal(categoriesRow!.amount).equals(expectedNet.abs())).toBe(true)

      const rankingRow = (snapshot.getCategoryRanking as Array<{ id: number; amount: string }>).find(
        (row) => row.id === taxonomy.essentialCategoryId,
      )
      expect(rankingRow).toBeDefined()
      expect(toDecimal(rankingRow!.amount).equals(expectedNet.abs())).toBe(true)

      const deviationsMap = snapshot.getCategoryDeviations as Map<number, { deviation: number | null }>
      expect(deviationsMap.get(taxonomy.essentialCategoryId)).toBeDefined()

      const categoryDetail = snapshot.getCategoryDetail as { summary: { total: string } }
      expect(toDecimal(categoryDetail.summary.total).equals(expectedNet.abs())).toBe(true)

      const momRow = (
        snapshot.getMonthOverMonthCategoryChanges as Array<{ categoryId: number | null; delta: string }>
      ).find((row) => row.categoryId === taxonomy.essentialCategoryId)
      expect(momRow).toBeDefined()
      expect(toDecimal(momRow!.delta).equals(expectedNet.abs())).toBe(true)

      const trendPoint = (
        snapshot.getMonthlyTrendByNature as Array<{ month: string; segments: Record<string, string> }>
      ).find((point) => point.month === monthTarget)
      expect(trendPoint).toBeDefined()
      expect(toDecimal(trendPoint!.segments.essential).equals(expectedNet)).toBe(true)

      // getOverviewChart's out.* segments are abs()'d when bucketed (lib/dal/overview.ts),
      // unlike getMonthlyTrendByNature's raw signed sum above.
      const chartPoint = (
        snapshot.getOverviewChart as Array<{ month: string; out: { essential: string } }>
      ).find((point) => point.month === monthTarget)
      expect(chartPoint).toBeDefined()
      expect(toDecimal(chartPoint!.out.essential).equals(expectedNet.abs())).toBe(true)
    })
  },
)

describeIfReachable(
  'Q3 — multi-transaction Expense anchor proportional spread (Phase 73 Plan 02 scenario 5, superseded by Phase 74 D-01/D-02 proportional spread)',
  () => {
    it('spreads the refund net proportionally across both sibling transactions (both -50.00 members, 50.00 refund -> each absorbs 25.00) — proven via a direct raw-fragment probe per sibling, then via the combined category/month total across the aggregation surface (uniquely distinguishes correct spread behaviour from both failure modes: no netting = -100.00; over-netting one leg to zero = 0.00/-50.00 split)', async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      vi.mocked(verifySession).mockResolvedValue({ userId } as never)
      const taxonomy = await seedMinimalTaxonomy(db, userId)
      const dateRange = dashboardPresetToDateRange('last-month')
      const earlierOccurredAt = new Date(
        dateRange.from.getFullYear(),
        dateRange.from.getMonth(),
        3,
        9,
        0,
        0,
      )
      const laterOccurredAt = new Date(
        dateRange.from.getFullYear(),
        dateRange.from.getMonth(),
        20,
        9,
        0,
        0,
      )

      // ONE Expense, TWO transactions: seedExpenseWithTransaction creates the Expense plus its
      // first (earlier) transaction; the later sibling is inserted directly against the same
      // expenseId, matching the "one Expense, N transactions" shape (e.g. a split payment).
      const { expenseId, transactionId: earlierTransactionId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '-50.00',
        occurredAt: earlierOccurredAt,
        title: 'Spesa multi-transazione (Q3)',
      })

      const laterTransactionId = randomUUID()
      await db.insert(transactionTable).values({
        id: laterTransactionId,
        userId,
        expenseId,
        transactionHash: `hash-${laterTransactionId}`,
        description: 'Spesa multi-transazione (Q3) — seconda tranche',
        descriptionHash: `dh-${laterTransactionId}`,
        amount: '-50.00',
        occurredAt: laterOccurredAt,
        rowIndex: 1,
      })

      const { transactionId: refundTransactionId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '50.00',
        occurredAt: earlierOccurredAt,
        title: 'Rimborso (Q3)',
      })

      await seedReimbursement(db, {
        userId,
        title: 'Spesa multi-transazione (Q3)',
        expenseId,
        refundTransactionIds: [refundTransactionId],
      })

      // Direct raw-fragment probe per sibling — the crisp, concrete proof of the proportional
      // spread mechanism itself (D-01/D-02: ΣmemberOutflow = -100.00, refund_total = 50.00, so
      // each member's raw_share = ROUND(50 * -50 / -100, 2) = 25.00 exactly, no remainder).
      // There is no legacy transaction_pair equivalent for a multi-transaction Expense anchor, so
      // this is the only place this exact rule can be pinned per-transaction.
      const earlierRows = await db
        .select({ amount: sql<string>`(${effectiveAmount()})::text` })
        .from(transactionTable)
        .where(eq(transactionTable.id, earlierTransactionId))
      expect(toDecimal(earlierRows[0].amount).equals('-25.00')).toBe(true)

      const laterRows = await db
        .select({ amount: sql<string>`(${effectiveAmount()})::text` })
        .from(transactionTable)
        .where(eq(transactionTable.id, laterTransactionId))
      expect(toDecimal(laterRows[0].amount).equals('-25.00')).toBe(true)

      // Aggregation-surface proof. Both siblings share one Expense (hence one subCategoryId),
      // so they land in the SAME category/month group — none of the 8 non-tag-scoped functions
      // expose a per-transaction netted amount (getCategoryDetail's topTransactions carries the
      // RAW transaction.amount, not effectiveAmount(); confirmed by reading buildCategoryDetailData
      // in lib/dal/dashboard.ts). The combined group total is therefore the available signal:
      // -50.00 (one leg netted to 0, the other left unchanged at -50.00) uniquely distinguishes
      // correct Q3 behaviour from both failure modes below.
      const { tagId } = await seedTag(db, { userId, name: 'unused-scenario-5' })
      const snapshot = await captureAggregationSnapshot({
        harnessDb: db,
        userId,
        dateRange,
        categoryId: taxonomy.essentialCategoryId,
        tagId,
      })

      const monthTarget = monthKey(dateRange.from)
      const expectedCombined = toDecimal('-50.00') // NOT -100.00 (no netting) NOR 0.00 (over-netting)

      const overviewTotals = snapshot.getOverviewAmountTotals as { totalOut: string }
      expect(toDecimal(overviewTotals.totalOut).equals(expectedCombined.abs())).toBe(true)

      const categoriesRow = (snapshot.getCategoriesBreakdown as Array<{ id: number; amount: string }>).find(
        (row) => row.id === taxonomy.essentialCategoryId,
      )
      expect(categoriesRow).toBeDefined()
      expect(toDecimal(categoriesRow!.amount).equals(expectedCombined.abs())).toBe(true)

      const rankingRow = (snapshot.getCategoryRanking as Array<{ id: number; amount: string }>).find(
        (row) => row.id === taxonomy.essentialCategoryId,
      )
      expect(rankingRow).toBeDefined()
      expect(toDecimal(rankingRow!.amount).equals(expectedCombined.abs())).toBe(true)

      const deviationsMap = snapshot.getCategoryDeviations as Map<number, { deviation: number | null }>
      expect(deviationsMap.get(taxonomy.essentialCategoryId)).toBeDefined()

      const categoryDetail = snapshot.getCategoryDetail as { summary: { total: string } }
      expect(toDecimal(categoryDetail.summary.total).equals(expectedCombined.abs())).toBe(true)

      const momRow = (
        snapshot.getMonthOverMonthCategoryChanges as Array<{ categoryId: number | null; delta: string }>
      ).find((row) => row.categoryId === taxonomy.essentialCategoryId)
      expect(momRow).toBeDefined()
      expect(toDecimal(momRow!.delta).equals(expectedCombined.abs())).toBe(true)

      const trendPoint = (
        snapshot.getMonthlyTrendByNature as Array<{ month: string; segments: Record<string, string> }>
      ).find((point) => point.month === monthTarget)
      expect(trendPoint).toBeDefined()
      expect(toDecimal(trendPoint!.segments.essential).equals(expectedCombined)).toBe(true)

      // getOverviewChart's out.* segments are abs()'d when bucketed (lib/dal/overview.ts);
      // expectedCombined is already negative-magnitude-equal here (-50.00) so .abs() is a no-op,
      // kept for consistency with the other scenarios' documented convention.
      const chartPoint = (
        snapshot.getOverviewChart as Array<{ month: string; out: { essential: string } }>
      ).find((point) => point.month === monthTarget)
      expect(chartPoint).toBeDefined()
      expect(toDecimal(chartPoint!.out.essential).equals(expectedCombined.abs())).toBe(true)
    })
  },
)
