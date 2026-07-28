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
import {
  reimbursement as reimbursementTable,
  reimbursementAnchorTransaction as reimbursementAnchorTransactionTable,
  transaction as transactionTable,
} from '@/lib/db/schema'
import type { createPair as CreatePair } from '@/lib/services/transaction-pairs'
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
  seedAmortizationPlan,
  seedExpenseGroup,
  seedExpenseWithTransaction,
  seedMinimalTaxonomy,
  seedReimbursement,
  seedReimbursementOnGroup,
  seedSecondEssentialCategory,
  seedTag,
  seedUser,
} from './fixtures/reimbursement-seed'
import { materializeInstalments } from '@/lib/services/amortization-math'
import { closePlanTx } from '@/lib/services/amortization-lifecycle'

vi.mock('@/lib/dal/auth', () => ({ verifySession: vi.fn() }))
vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))

const harness = await connectReimbursementTestDb()

if (!harness.ok) {
  console.warn(
    '[reimbursement-regression] Local Postgres unreachable — run `yarn db:up` to enable this suite. Skipping.',
  )
}

const describeIfReachable = harness.ok ? describe : describe.skip

// createPair — the live write path under test in the Task 2 blocks below. Same technique as
// tests/reimbursement-guard-group-anchor.test.ts: never let lib/services/transaction-pairs.ts
// build its own connection off the ambient process.env.DATABASE_URL — feed it the harness's own
// already-host-guarded client instead.
let createPair: typeof CreatePair

if (harness.ok) {
  vi.doMock('@/lib/db', () => ({ db: harness.db }))
  vi.resetModules()
  const servicesModule = await import('@/lib/services/transaction-pairs')
  createPair = servicesModule.createPair
}

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

// ---------------------------------------------------------------------------------------------
// Phase 74 Plan 01 — Group-anchor regression matrix (D-01/D-02/D-05, RMB-02). The Expense-anchor
// spread is already proven inert/correct above (N=1 scenarios + the Q3 N=2 case); these 3
// scenarios prove the genuinely new Group-anchor shapes: cross-subcategory attribution, exact
// largest-remainder cent assignment, and the division-by-zero landmine (RMB-02/empty).
// ---------------------------------------------------------------------------------------------

describeIfReachable(
  'Group anchor spanning two subcategories — proportional spread per D-05 (Phase 74 Plan 01 Scenario A)',
  () => {
    it('spreads the refund net proportionally into each member transaction\'s own subcategory as two separate breakdown rows, invisible on top-line totalOut', async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      vi.mocked(verifySession).mockResolvedValue({ userId } as never)
      const taxonomy = await seedMinimalTaxonomy(db, userId)
      const secondCategory = await seedSecondEssentialCategory(db, {
        userId,
        natureId: taxonomy.essentialNatureId,
      })

      const dateRange = dashboardPresetToDateRange('last-month')
      const occurredAt = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), 12, 12, 0, 0)

      const { expenseId: member1ExpenseId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '-300.00',
        occurredAt,
        title: 'Alloggio montagna',
      })
      const { expenseId: member2ExpenseId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: secondCategory.subCategoryId,
        amount: '-100.00',
        occurredAt,
        title: 'Trasporto montagna',
      })

      const { groupId } = await seedExpenseGroup(db, {
        userId,
        title: 'Vacanza in montagna',
        subCategoryId: taxonomy.essentialSubCategoryId,
        memberExpenseIds: [member1ExpenseId, member2ExpenseId],
      })

      const { transactionId: refundTransactionId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '200.00',
        occurredAt,
        title: 'Rimborso vacanza',
      })

      await seedReimbursementOnGroup(db, {
        userId,
        title: 'Vacanza in montagna',
        expenseGroupId: groupId,
        refundTransactionIds: [refundTransactionId],
      })

      // Expected shares computed via Decimal.js from the same seeded inputs -- never hand-typed.
      // Deliberately round numbers (no remainder) -- isolates the subcategory-attribution proof
      // from the rounding proof in Scenario B.
      const refundTotal = toDecimal('200.00')
      const memberSum = toDecimal('-300.00').plus('-100.00')
      const member1Share = refundTotal.times('-300.00').dividedBy(memberSum).toDecimalPlaces(2)
      const member2Share = refundTotal.times('-100.00').dividedBy(memberSum).toDecimalPlaces(2)
      expect(member1Share.equals('150.00')).toBe(true)
      expect(member2Share.equals('50.00')).toBe(true)

      const { tagId } = await seedTag(db, { userId, name: 'unused-scenario-A' })
      const snapshot = await captureAggregationSnapshot({
        harnessDb: db,
        userId,
        dateRange,
        categoryId: taxonomy.essentialCategoryId,
        tagId,
      })

      const categoriesBreakdown = snapshot.getCategoriesBreakdown as Array<{ id: number; amount: string }>
      const member1CategoryRow = categoriesBreakdown.find((row) => row.id === taxonomy.essentialCategoryId)
      const member2CategoryRow = categoriesBreakdown.find((row) => row.id === secondCategory.categoryId)
      expect(member1CategoryRow).toBeDefined()
      expect(member2CategoryRow).toBeDefined()
      // TWO SEPARATE rows (D-05) -- Member 1's category nets to 300-150=150.00, Member 2's to
      // 100-50=50.00 -- no separate subcategory-allocation mechanism, correct per-category
      // automatically because the netting already lands per-transaction.
      expect(toDecimal(member1CategoryRow!.amount).equals('150.00')).toBe(true)
      expect(toDecimal(member2CategoryRow!.amount).equals('50.00')).toBe(true)

      const categoryRanking = snapshot.getCategoryRanking as Array<{ id: number; amount: string }>
      const member1RankingRow = categoryRanking.find((row) => row.id === taxonomy.essentialCategoryId)
      const member2RankingRow = categoryRanking.find((row) => row.id === secondCategory.categoryId)
      expect(member1RankingRow).toBeDefined()
      expect(member2RankingRow).toBeDefined()
      expect(toDecimal(member1RankingRow!.amount).equals('150.00')).toBe(true)
      expect(toDecimal(member2RankingRow!.amount).equals('50.00')).toBe(true)

      // Invisible on top-line entrate/uscite (D-05): the combined totalOut is the sum of both
      // members' netted amounts, exactly the 200.00 refund regardless of the split between them.
      const overviewTotals = snapshot.getOverviewAmountTotals as { totalOut: string }
      expect(toDecimal(overviewTotals.totalOut).equals('200.00')).toBe(true)
    })
  },
)

describeIfReachable(
  'Group anchor largest-remainder cent exactness (Phase 74 Plan 01 Scenario B, RMB-02/precision + RMB-02/ordering)',
  () => {
    it('assigns the 0.01 rounding remainder to the earliest-occurring tied-largest-magnitude member, and the 3 raw-probed per-transaction shares sum back to the exact linked-refund total at the centesimo', async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      vi.mocked(verifySession).mockResolvedValue({ userId } as never)
      const taxonomy = await seedMinimalTaxonomy(db, userId)
      const dateRange = dashboardPresetToDateRange('last-month')

      const day5 = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), 5, 12, 0, 0)
      const day10 = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), 10, 12, 0, 0)
      const day15 = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), 15, 12, 0, 0)

      const { expenseId: day5ExpenseId, transactionId: day5TransactionId } =
        await seedExpenseWithTransaction(db, {
          userId,
          subCategoryId: taxonomy.essentialSubCategoryId,
          amount: '-100.00',
          occurredAt: day5,
          title: 'Spesa gruppo giorno 5',
        })
      const { expenseId: day10ExpenseId, transactionId: day10TransactionId } =
        await seedExpenseWithTransaction(db, {
          userId,
          subCategoryId: taxonomy.essentialSubCategoryId,
          amount: '-100.00',
          occurredAt: day10,
          title: 'Spesa gruppo giorno 10',
        })
      const { expenseId: day15ExpenseId, transactionId: day15TransactionId } =
        await seedExpenseWithTransaction(db, {
          userId,
          subCategoryId: taxonomy.essentialSubCategoryId,
          amount: '-100.00',
          occurredAt: day15,
          title: 'Spesa gruppo giorno 15',
        })

      const { groupId } = await seedExpenseGroup(db, {
        userId,
        title: 'Gruppo tre spese uguali',
        subCategoryId: taxonomy.essentialSubCategoryId,
        memberExpenseIds: [day5ExpenseId, day10ExpenseId, day15ExpenseId],
      })

      const { transactionId: refundTransactionId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '100.00',
        occurredAt: day5,
        title: 'Rimborso gruppo',
      })

      await seedReimbursementOnGroup(db, {
        userId,
        title: 'Gruppo tre spese uguali',
        expenseGroupId: groupId,
        refundTransactionIds: [refundTransactionId],
      })

      const probe = async (transactionId: string) => {
        const rows = await db
          .select({ amount: sql<string>`(${effectiveAmount()})::text` })
          .from(transactionTable)
          .where(eq(transactionTable.id, transactionId))
        return toDecimal(rows[0].amount)
      }

      // raw_share = ROUND(100 * -100 / -300, 2) = 33.33 for every member; 33.33*3 = 99.99, one
      // cent short of the 100.00 refund total. All 3 members have equal ABS(amount), so the
      // largest-remainder tie-break falls to occurredAt ASC -- the day-5 member absorbs the 0.01.
      const day5Amount = await probe(day5TransactionId)
      const day10Amount = await probe(day10TransactionId)
      const day15Amount = await probe(day15TransactionId)

      expect(day5Amount.equals('-66.66')).toBe(true) // -100 + (33.33 + 0.01)
      expect(day10Amount.equals('-66.67')).toBe(true) // -100 + 33.33
      expect(day15Amount.equals('-66.67')).toBe(true) // -100 + 33.33

      // Centesimo-exact reconciliation: the 3 raw-probed shares sum to exactly -300.00 + 100.00,
      // computed via toDecimal(...).plus(...), never a hand-typed sum.
      const total = day5Amount.plus(day10Amount).plus(day15Amount)
      const expectedTotal = toDecimal('-100.00').plus('-100.00').plus('-100.00').plus('100.00')
      expect(total.equals(expectedTotal)).toBe(true)
      expect(total.equals('-200.00')).toBe(true)
    })
  },
)

describeIfReachable(
  'Group anchor division-by-zero guard — zero-sum member set (Phase 74 Plan 01 Scenario C, RMB-02/empty)',
  () => {
    it("never throws and falls back to each member's own raw amount when the anchor's member set sums to exactly zero", async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      vi.mocked(verifySession).mockResolvedValue({ userId } as never)
      const taxonomy = await seedMinimalTaxonomy(db, userId)
      const dateRange = dashboardPresetToDateRange('last-month')
      const occurredAt = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), 12, 12, 0, 0)

      // Deliberately constructed to sum to exactly zero -- constructed directly via fixtures,
      // bypassing the app's own group-creation invariants, since this is a defensive-SQL guard
      // test, not a scenario reachable via any current UI or service.
      const { expenseId: negativeExpenseId, transactionId: negativeTransactionId } =
        await seedExpenseWithTransaction(db, {
          userId,
          subCategoryId: taxonomy.essentialSubCategoryId,
          amount: '-50.00',
          occurredAt,
          title: 'Membro negativo',
        })
      const { expenseId: positiveExpenseId, transactionId: positiveTransactionId } =
        await seedExpenseWithTransaction(db, {
          userId,
          subCategoryId: taxonomy.essentialSubCategoryId,
          amount: '50.00',
          occurredAt,
          title: 'Membro positivo',
        })

      const { groupId } = await seedExpenseGroup(db, {
        userId,
        title: 'Gruppo somma zero',
        subCategoryId: taxonomy.essentialSubCategoryId,
        memberExpenseIds: [negativeExpenseId, positiveExpenseId],
      })

      const { transactionId: refundTransactionId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '30.00',
        occurredAt,
        title: 'Rimborso gruppo somma zero',
      })

      await seedReimbursementOnGroup(db, {
        userId,
        title: 'Gruppo somma zero',
        expenseGroupId: groupId,
        refundTransactionIds: [refundTransactionId],
      })

      const probe = async (transactionId: string) => {
        const rows = await db
          .select({ amount: sql<string>`(${effectiveAmount()})::text` })
          .from(transactionTable)
          .where(eq(transactionTable.id, transactionId))
        return toDecimal(rows[0].amount)
      }

      // Must not throw (a Postgres division-by-zero error would surface as a rejected promise)
      // and each member falls back to its own raw amount, unchanged -- the NULLIF/COALESCE guard
      // degrades safely rather than corrupting the dashboard totals.
      const negativeAmount = await probe(negativeTransactionId)
      const positiveAmount = await probe(positiveTransactionId)
      expect(negativeAmount.equals('-50.00')).toBe(true)
      expect(positiveAmount.equals('50.00')).toBe(true)

      const { tagId } = await seedTag(db, { userId, name: 'unused-scenario-C' })
      const snapshot = await captureAggregationSnapshot({
        harnessDb: db,
        userId,
        dateRange,
        categoryId: taxonomy.essentialCategoryId,
        tagId,
      })

      const overviewTotals = snapshot.getOverviewAmountTotals as { totalOut: string }
      const expectedTotalOut = toDecimal('-50.00').plus('50.00').abs()
      expect(toDecimal(overviewTotals.totalOut).equals(expectedTotalOut)).toBe(true)
    })
  },
)

// ---------------------------------------------------------------------------------------------
// Phase 75 Plan 01 Task 2 — createPair's frozen-set write + the contamination guard it exists to
// prove (D-08). Exercises the REAL createPair() service (not seedReimbursement's direct-insert
// fixture) against the same real-Postgres harness, so the assertion below proves the live write
// path — not just that the CTE reads a frozen set correctly when one happens to be seeded.
// ---------------------------------------------------------------------------------------------

describeIfReachable(
  'createPair frozen-set write — records the frozen anchor-transaction set unconditionally (Phase 75 Plan 01 Task 2, D-08 Pitfall 3)',
  () => {
    it('a fresh createPair call (first ever link on that anchor) records exactly one reimbursement_anchor_transaction row for the anchor transaction id — never skipped because "there is only one transaction anyway"', async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      const taxonomy = await seedMinimalTaxonomy(db, userId)
      const dateRange = dashboardPresetToDateRange('last-month')
      const occurredAt = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), 5, 12, 0, 0)

      const { expenseId: anchorExpenseId, transactionId: anchorTransactionId } =
        await seedExpenseWithTransaction(db, {
          userId,
          subCategoryId: taxonomy.essentialSubCategoryId,
          amount: '-100.00',
          occurredAt,
          title: 'Spesa Task 2 (frozen-set write)',
        })
      const { transactionId: refundTransactionId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '50.00',
        occurredAt,
        title: 'Rimborso Task 2 (frozen-set write)',
      })

      await createPair({
        userId,
        anchor: { transactionId: anchorTransactionId },
        counterpartId: refundTransactionId,
      })

      const reimbursementRows = await db
        .select({ id: reimbursementTable.id })
        .from(reimbursementTable)
        .where(eq(reimbursementTable.expenseId, anchorExpenseId))
      expect(reimbursementRows).toHaveLength(1)

      const anchorRows = await db
        .select({
          id: reimbursementAnchorTransactionTable.id,
          reimbursementId: reimbursementAnchorTransactionTable.reimbursementId,
        })
        .from(reimbursementAnchorTransactionTable)
        .where(eq(reimbursementAnchorTransactionTable.transactionId, anchorTransactionId))

      expect(anchorRows).toHaveLength(1)
      expect(anchorRows[0]!.reimbursementId).toBe(reimbursementRows[0]!.id)
    })
  },
)

describeIfReachable(
  'createPair frozen-set write — contamination guard: a same-expense_id transaction imported AFTER linking never inherits a share of the linked refund (Phase 75 Plan 01 Task 2, D-08)',
  () => {
    it("a later same-merchant transaction inserted directly into the anchor's expense_id (simulating import.ts's descriptionHash upsert) is excluded from effectiveAmount()'s member set, returning exactly its own raw amount, and the original anchor transaction's share is unchanged from before the second transaction existed", async () => {
      const db = requireHarnessDb()
      await resetReimbursementFixtures(db)

      const { userId } = await seedUser(db)
      const taxonomy = await seedMinimalTaxonomy(db, userId)
      const dateRange = dashboardPresetToDateRange('last-month')
      const occurredAt = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), 5, 12, 0, 0)

      const { expenseId: anchorExpenseId, transactionId: anchorTransactionId } =
        await seedExpenseWithTransaction(db, {
          userId,
          subCategoryId: taxonomy.essentialSubCategoryId,
          amount: '-100.00',
          occurredAt,
          title: 'Amazon order (contamination guard)',
        })
      const { transactionId: refundTransactionId } = await seedExpenseWithTransaction(db, {
        userId,
        subCategoryId: taxonomy.essentialSubCategoryId,
        amount: '50.00',
        occurredAt,
        title: 'Amazon refund (contamination guard)',
      })

      await createPair({
        userId,
        anchor: { transactionId: anchorTransactionId },
        counterpartId: refundTransactionId,
      })

      const probe = async (transactionId: string) => {
        const rows = await db
          .select({ amount: sql<string>`(${effectiveAmount()})::text` })
          .from(transactionTable)
          .where(eq(transactionTable.id, transactionId))
        return toDecimal(rows[0]!.amount)
      }

      // Baseline BEFORE the contaminating import: the anchor is fully netted against its refund.
      const anchorShareBefore = await probe(anchorTransactionId)
      expect(anchorShareBefore.equals('-50.00')).toBe(true)

      // Simulate import.ts's (userId, descriptionHash) upsert: a later same-merchant purchase
      // reuses the SAME expense_id as the already-linked anchor, with NO frozen-set row of its
      // own (createPair was never called for this transaction).
      const laterTransactionId = randomUUID()
      await db.insert(transactionTable).values({
        id: laterTransactionId,
        userId,
        expenseId: anchorExpenseId,
        transactionHash: `hash-${laterTransactionId}`,
        description: 'Amazon order — seconda visita',
        descriptionHash: `dh-${laterTransactionId}`,
        amount: '-80.00',
        occurredAt: new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), 20, 12, 0, 0),
        rowIndex: 1,
      })

      // The new transaction is NEVER a row in the frozen set — it returns its own raw amount,
      // unchanged (0 inherited share) — the contamination this table exists to prevent.
      const laterAmount = await probe(laterTransactionId)
      expect(laterAmount.equals('-80.00')).toBe(true)

      // The original anchor's share is UNCHANGED by the contaminating import.
      const anchorShareAfter = await probe(anchorTransactionId)
      expect(anchorShareAfter.equals(anchorShareBefore)).toBe(true)
    })
  },
)

describeIfReachable('amortization cash-lens byte-identical (Phase 77, ADR 0019 D-12)', () => {
  it('getOverviewAmountTotals.totalOut is unchanged before and after an amortization plan exists on the transaction', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    vi.mocked(verifySession).mockResolvedValue({ userId } as never)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const { tagId } = await seedTag(db, { userId, name: 'Amortization probe' })

    const dateRange = dashboardPresetToDateRange('last-month')
    const occurredAt = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), 14, 12, 0, 0)

    // A plain outflow transaction, no amortization yet.
    const { expenseId, transactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-1000.00',
      occurredAt,
      title: 'Amortization probe purchase',
    })
    // Tagged so getTagTotals/getTagDetail below exercise a real row (dual-join), not the
    // zero-transaction-tag path — proving Plan 77-05's amount seam, not just the join's shape.
    await attachTagToTransaction(db, { tagId, transactionId })

    const before = await captureAggregationSnapshot({
      harnessDb: db,
      userId,
      dateRange,
      categoryId: taxonomy.essentialCategoryId,
      tagId,
    })
    const beforeTotals = before.getOverviewAmountTotals as { totalOut: string }

    // Activate a 3-month plan on the SAME transaction (fixture-inserted, not via activatePlanTx —
    // this suite proves the READ path, independent of the write path under test elsewhere).
    const instalments = materializeInstalments('-1000.00', occurredAt, 3)
    await seedAmortizationPlan(db, {
      userId,
      transactionId,
      expenseId,
      months: 3,
      instalments,
    })

    const after = await captureAggregationSnapshot({
      harnessDb: db,
      userId,
      dateRange,
      categoryId: taxonomy.essentialCategoryId,
      tagId,
    })
    const afterTotals = after.getOverviewAmountTotals as { totalOut: string }

    // The amortized transaction's full original amount still counts once, via ledger_entry_cash,
    // unchanged by the existence of instalment rows (ledger_entry_cash reads FROM transaction,
    // not FROM amortization_instalment — the accrual lens is what branches on instalments, and
    // it is unconsumed in Phase 77).
    expect(toDecimal(afterTotals.totalOut).equals(toDecimal(beforeTotals.totalOut))).toBe(true)
    expect(toDecimal(afterTotals.totalOut).equals(toDecimal('1000.00'))).toBe(true)

    // Plan 77-04's five migrated aggregation functions: same before/after snapshot pair, proving
    // the ledger_entry_cash seam migration (D-11) changed the SQL, never the observable output.

    // getCategoriesBreakdown: essentialCategoryId's total amount is unchanged.
    const beforeBreakdown = before.getCategoriesBreakdown as Array<{ id: number; amount: string }>
    const afterBreakdown = after.getCategoriesBreakdown as Array<{ id: number; amount: string }>
    const beforeBreakdownAmount = beforeBreakdown.find((c) => c.id === taxonomy.essentialCategoryId)?.amount
    const afterBreakdownAmount = afterBreakdown.find((c) => c.id === taxonomy.essentialCategoryId)?.amount
    expect(afterBreakdownAmount).toBe(beforeBreakdownAmount)
    expect(toDecimal(afterBreakdownAmount ?? '0').equals(toDecimal('1000.00'))).toBe(true)

    // getCategoryRanking: same category's ranked amount is unchanged.
    const beforeRanking = before.getCategoryRanking as Array<{ id: number; amount: string }>
    const afterRanking = after.getCategoryRanking as Array<{ id: number; amount: string }>
    const beforeRankingAmount = beforeRanking.find((c) => c.id === taxonomy.essentialCategoryId)?.amount
    const afterRankingAmount = afterRanking.find((c) => c.id === taxonomy.essentialCategoryId)?.amount
    expect(afterRankingAmount).toBe(beforeRankingAmount)
    expect(toDecimal(afterRankingAmount ?? '0').equals(toDecimal('1000.00'))).toBe(true)

    // getCategoryDeviations: same category's deviation entry is byte-identical.
    const beforeDeviations = before.getCategoryDeviations as Map<number, unknown>
    const afterDeviations = after.getCategoryDeviations as Map<number, unknown>
    expect(JSON.stringify(afterDeviations.get(taxonomy.essentialCategoryId))).toBe(
      JSON.stringify(beforeDeviations.get(taxonomy.essentialCategoryId)),
    )

    // getCategoryDetail: the top-transaction's RAW (un-netted) amount and the summary total are
    // unchanged — proving the dual-join special case (ranking-only netted join) never touched the
    // displayed value.
    const beforeDetail = before.getCategoryDetail as {
      summary: { total: string }
      topTransactions: Array<{ amount: string }>
    }
    const afterDetail = after.getCategoryDetail as typeof beforeDetail
    expect(afterDetail.summary.total).toBe(beforeDetail.summary.total)
    expect(afterDetail.topTransactions[0]?.amount).toBe(beforeDetail.topTransactions[0]?.amount)
    expect(toDecimal(afterDetail.summary.total).equals(toDecimal('1000.00'))).toBe(true)
    expect(toDecimal(afterDetail.topTransactions[0]?.amount ?? '0').equals(toDecimal('1000.00'))).toBe(true)

    // getMonthlyTrendByNature: the transaction's month/nature segment is unchanged, including the
    // LEFT JOIN chain (unaffected by amortization here, but proven byte-identical regardless).
    const beforeTrend = before.getMonthlyTrendByNature as Array<{
      month: string
      segments: Record<string, string>
    }>
    const afterTrend = after.getMonthlyTrendByNature as typeof beforeTrend
    const occurredMonthKey = monthKey(occurredAt)
    const beforeSegment = beforeTrend.find((point) => point.month === occurredMonthKey)?.segments.essential
    const afterSegment = afterTrend.find((point) => point.month === occurredMonthKey)?.segments.essential
    expect(afterSegment).toBe(beforeSegment)
    expect(toDecimal(afterSegment ?? '0').abs().equals(toDecimal('1000.00'))).toBe(true)

    // Plan 77-05's two migrated functions — closing the full 10-function LENS-03 coverage.

    // getTagTotals: the tagged transaction's total is unchanged and preserves sign (-1000.00).
    const beforeTagTotal = (before.getTagTotals as Array<{ tagId: number; total: string }>).find(
      (r) => r.tagId === tagId,
    )
    const afterTagTotal = (after.getTagTotals as Array<{ tagId: number; total: string }>).find(
      (r) => r.tagId === tagId,
    )
    expect(afterTagTotal?.total).toBe(beforeTagTotal?.total)
    expect(toDecimal(afterTagTotal?.total ?? '0').equals(toDecimal('-1000.00'))).toBe(true)

    // getTagDetail: proves the dual-join special case — the raw (immutable) description stays
    // sourced from `transaction`, while `net`/the row's `amount` come from ledger_entry_cash.
    const beforeTagDetail = before.getTagDetail as {
      net: string
      transactions: Array<{ description: string; amount: string }>
    }
    const afterTagDetail = after.getTagDetail as typeof beforeTagDetail
    expect(afterTagDetail.net).toBe(beforeTagDetail.net)
    expect(toDecimal(afterTagDetail.net).equals(toDecimal('-1000.00'))).toBe(true)
    expect(afterTagDetail.transactions[0]?.description).toBe('Amortization probe purchase')
    expect(afterTagDetail.transactions[0]?.amount).toBe(beforeTagDetail.transactions[0]?.amount)
    expect(toDecimal(afterTagDetail.transactions[0]?.amount ?? '0').equals(toDecimal('-1000.00'))).toBe(true)
  })

  it('reimbursement netting and amortization spread do not interact — the original N=1 scenario stays correct with amortization data present elsewhere in the same fixture set', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    vi.mocked(verifySession).mockResolvedValue({ userId } as never)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const essentialCategoryId = taxonomy.essentialCategoryId
    const { tagId } = await seedTag(db, { userId, name: 'Amazon' })

    const dateRange = dashboardPresetToDateRange('last-month')
    const occurredAt = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), 15, 12, 0, 0)

    // Byte-identical replica of the Phase 73 N=1 scenario (this file's very first
    // describeIfReachable block, above) — same category, same amounts, same tag name.
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
    await seedReimbursement(db, {
      userId,
      title: 'Amazon order',
      expenseId: outflowExpenseId,
      refundTransactionIds: [refundTransactionId],
    })

    // Elsewhere in the SAME fixture set: an unrelated amortization plan, seeded under a SECOND
    // category (never essentialCategoryId) and in a different month than the N=1 scenario above —
    // the two isolation axes every one of the 10 aggregation functions groups by (category id for
    // breakdown/ranking/deviations/MoM/detail, month for the nature-keyed trend/chart segments).
    // Neither axis can leak into the N=1 assertions below, proving reimbursement netting and
    // amortization coexist in one fixture set without cross-contamination.
    const secondCategory = await seedSecondEssentialCategory(db, {
      userId,
      natureId: taxonomy.essentialNatureId,
    })
    const amortOccurredAt = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth() - 3, 10, 12, 0, 0)
    const { expenseId: amortExpenseId, transactionId: amortTransactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: secondCategory.subCategoryId,
      amount: '-600.00',
      occurredAt: amortOccurredAt,
      title: 'Cross-feature amortization purchase',
    })
    const instalments = materializeInstalments('-600.00', amortOccurredAt, 3)
    await seedAmortizationPlan(db, {
      userId,
      transactionId: amortTransactionId,
      expenseId: amortExpenseId,
      months: 3,
      instalments,
    })

    const snapshot = await captureAggregationSnapshot({
      harnessDb: db,
      userId,
      dateRange,
      categoryId: essentialCategoryId,
      tagId,
    })

    // Every assertion from the file's very first N=1 regression block, replayed byte-identical
    // against a snapshot that ALSO has amortization data present (D-12): reimbursement netting
    // and amortization do not interact or leak into each other's totals.
    const totals = snapshot.getOverviewAmountTotals as { totalOut: string }
    expect(toDecimal(totals.totalOut).equals(toDecimal('50.00'))).toBe(true)

    const breakdownRow = (snapshot.getCategoriesBreakdown as Array<{ id: number; amount: string }>).find(
      (r) => r.id === essentialCategoryId,
    )
    expect(breakdownRow).toBeDefined()
    expect(toDecimal(breakdownRow!.amount).equals(toDecimal('50.00'))).toBe(true)

    const rankingRow = (snapshot.getCategoryRanking as Array<{ id: number; amount: string }>).find(
      (r) => r.id === essentialCategoryId,
    )
    expect(rankingRow).toBeDefined()
    expect(toDecimal(rankingRow!.amount).equals(toDecimal('50.00'))).toBe(true)

    const deviationsMap = snapshot.getCategoryDeviations as Map<
      number,
      { deviation: number | null; isNew: boolean; belowNoiseThreshold: boolean }
    >
    const deviationEntry = deviationsMap.get(essentialCategoryId)
    expect(deviationEntry).toBeDefined()
    expect(deviationEntry!.isNew).toBe(true)
    expect(deviationEntry!.deviation).toBeNull()

    const detail = snapshot.getCategoryDetail as { summary: { total: string } }
    expect(toDecimal(detail.summary.total).equals(toDecimal('50.00'))).toBe(true)

    const targetMonth = monthKey(dateRange.from)
    const trendPoint = (
      snapshot.getMonthlyTrendByNature as Array<{ month: string; segments: Record<string, string> }>
    ).find((p) => p.month === targetMonth)
    expect(trendPoint).toBeDefined()
    expect(toDecimal(trendPoint!.segments.essential).equals(toDecimal('-50.00'))).toBe(true)

    const momRow = (
      snapshot.getMonthOverMonthCategoryChanges as Array<{
        categoryId: number | null
        delta: string
        isNew: boolean
      }>
    ).find((r) => r.categoryId === essentialCategoryId)
    expect(momRow).toBeDefined()
    expect(momRow!.isNew).toBe(true)
    expect(toDecimal(momRow!.delta).equals(toDecimal('50.00'))).toBe(true)

    const chartPoint = (
      snapshot.getOverviewChart as Array<{ month: string; out: { essential: string } }>
    ).find((p) => p.month === targetMonth)
    expect(chartPoint).toBeDefined()
    expect(toDecimal(chartPoint!.out.essential).equals(toDecimal('50.00'))).toBe(true)

    const tagTotalsRow = (snapshot.getTagTotals as Array<{ tagId: number; total: string }>).find(
      (r) => r.tagId === tagId,
    )
    expect(tagTotalsRow).toBeDefined()
    expect(toDecimal(tagTotalsRow!.total).equals(toDecimal('-50.00'))).toBe(true)

    const tagDetail = snapshot.getTagDetail as { net: string }
    expect(toDecimal(tagDetail.net).equals(toDecimal('-50.00'))).toBe(true)
  })
})

describeIfReachable('amortization lifecycle: close/collapse regression (Phase 78, AMORT-04)', () => {
  it('closePlanTx leaves the cash lens byte-identical and the accrual lens reflects the materialized closure instalment', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    vi.mocked(verifySession).mockResolvedValue({ userId } as never)
    const taxonomy = await seedMinimalTaxonomy(db, userId)
    const { tagId } = await seedTag(db, { userId, name: 'Amortization close probe' })

    const dateRange = dashboardPresetToDateRange('last-month')
    const startDate = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth() - 5, 10, 12, 0, 0)

    const { expenseId, transactionId } = await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: taxonomy.essentialSubCategoryId,
      amount: '-1200.00',
      occurredAt: startDate,
      title: 'Amortization close/collapse probe purchase',
    })
    // Tagged so getTagTotals/getTagDetail exercise a real row (dual-join), same convention as
    // the Phase 77 block above.
    await attachTagToTransaction(db, { tagId, transactionId })

    // -1200.00 / 12 = -100.00/mo, no remainder — deterministic 12-month schedule from startDate.
    const instalments = materializeInstalments('-1200.00', startDate, 12)
    const { planId } = await seedAmortizationPlan(db, {
      userId,
      transactionId,
      expenseId,
      months: 12,
      instalments,
    })

    const before = await captureAggregationSnapshot({
      harnessDb: db,
      userId,
      dateRange,
      categoryId: taxonomy.essentialCategoryId,
      tagId,
    })

    // Close mid-schedule (month 6 of the plan) via the SAME closePlanTx under test elsewhere —
    // this suite proves the cash-lens invariant of the REAL write path, not a fixture stand-in.
    const closureMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 5, startDate.getDate(), 12, 0, 0)
    const { closureInstalmentId, remainingValue } = await closePlanTx(db, {
      userId,
      planId,
      closureMonth,
    })
    expect(closureInstalmentId).not.toBeNull()

    const after = await captureAggregationSnapshot({
      harnessDb: db,
      userId,
      dateRange,
      categoryId: taxonomy.essentialCategoryId,
      tagId,
    })

    // Cash lens byte-identical before/after: closePlanTx writes ONLY to
    // amortization_instalment/amortization_plan, never to transaction, so ledger_entry_cash
    // (sourced from transaction) is structurally unreachable by this write.
    const beforeTotals = before.getOverviewAmountTotals as { totalOut: string }
    const afterTotals = after.getOverviewAmountTotals as { totalOut: string }
    expect(afterTotals.totalOut).toBe(beforeTotals.totalOut)

    const beforeBreakdown = before.getCategoriesBreakdown as Array<{ id: number; amount: string }>
    const afterBreakdown = after.getCategoriesBreakdown as Array<{ id: number; amount: string }>
    expect(
      afterBreakdown.find((c) => c.id === taxonomy.essentialCategoryId)?.amount,
    ).toBe(beforeBreakdown.find((c) => c.id === taxonomy.essentialCategoryId)?.amount)

    const beforeTagTotal = (before.getTagTotals as Array<{ tagId: number; total: string }>).find(
      (r) => r.tagId === tagId,
    )
    const afterTagTotal = (after.getTagTotals as Array<{ tagId: number; total: string }>).find(
      (r) => r.tagId === tagId,
    )
    expect(afterTagTotal?.total).toBe(beforeTagTotal?.total)

    // Accrual-lens probe: branch 2 (ledger_entry_accrual) selects amortization_instalment rows
    // directly with NO further netting — the closure-month row's amount must equal exactly what
    // closePlanTx returned as remainingValue, proving the materialized write is faithfully read
    // with zero live netting (ADR 0019 §10).
    const accrualRows = await db.execute(sql`
      SELECT amount FROM ledger_entry_accrual
      WHERE expense_id = ${expenseId} AND occurred_at = ${closureMonth}
    `)
    expect(accrualRows.rows).toHaveLength(1)
    const accrualAmount = (accrualRows.rows[0] as { amount: string }).amount
    expect(toDecimal(accrualAmount).equals(toDecimal(remainingValue))).toBe(true)
  })
})
