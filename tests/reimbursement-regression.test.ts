// Real-Postgres regression proof (Phase 73, ADR 0018 D-07 — the phase's acceptance gate).
//
// Proves the migrated N=1 case (the Amazon order/refund) produces byte-identical results, via
// Decimal.js comparison (never string equality), across all 10 verified aggregation call sites
// before and after migration — plus the empty-refund probe (RMB-04).
//
// Requires local Docker Postgres (`yarn db:up`). Skips gracefully (console warning, no failure)
// when unreachable, so `vitest run` stays green in sandboxes without Docker.
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { verifySession } from '@/lib/dal/auth'
import { effectiveAmount, isNotSecondary } from '@/lib/dal/transaction-pairs-sql'
import { reimbursement as reimbursementTable, transaction as transactionTable } from '@/lib/db/schema'
import { dashboardPresetToDateRange, monthKey } from '@/lib/utils/date'
import { toDecimal } from '@/lib/utils/decimal'
import {
  applyReimbursementBackfillMigration,
  captureAggregationSnapshot,
  connectReimbursementTestDb,
  resetReimbursementFixtures,
  type AggregationSnapshot,
  type ReimbursementTestDb,
} from './helpers/reimbursement-test-db'
import {
  attachTagToTransaction,
  seedExpenseWithTransaction,
  seedLegacyPair,
  seedMinimalTaxonomy,
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
  let before: AggregationSnapshot
  let after: AggregationSnapshot
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
    const { transactionId: outflowTransactionId } = await seedExpenseWithTransaction(db, {
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

    // D-10: primary = the outflow (sign-based resolution), not the legacy magnitude rule.
    await seedLegacyPair(db, {
      primaryTransactionId: outflowTransactionId,
      secondaryTransactionId: refundTransactionId,
    })

    // "Before" — the frozen pre-Task-2 fragment, reading transaction_pair directly. Proves what
    // "before" meant using the real production query bodies for all 10 functions, without
    // requiring the old production code to still exist on disk.
    before = await captureAggregationSnapshot({
      harnessDb: db,
      userId,
      dateRange,
      categoryId: essentialCategoryId,
      tagId,
      useFrozenFragment: true,
    })

    // Apply the ACTUAL migration file (drizzle/migrations/0029_reimbursement_backfill.sql),
    // not a hand-duplicated copy — migrates this seeded legacy pair into reimbursement +
    // reimbursement_refund.
    await applyReimbursementBackfillMigration(db)

    // "After" — the REAL, current (Task-2-rewritten) fragment, reading reimbursement/
    // reimbursement_refund.
    after = await captureAggregationSnapshot({
      harnessDb: db,
      userId,
      dateRange,
      categoryId: essentialCategoryId,
      tagId,
      useFrozenFragment: false,
    })
  })

  it('getOverviewAmountTotals: totalOut identical before/after (net = 100.00 - 50.00 = 50.00)', () => {
    const b = before.getOverviewAmountTotals as { totalOut: string }
    const a = after.getOverviewAmountTotals as { totalOut: string }
    expect(toDecimal(a.totalOut).equals(toDecimal(b.totalOut))).toBe(true)
    expect(toDecimal(a.totalOut).equals(toDecimal('50.00'))).toBe(true)
  })

  it('getCategoriesBreakdown: essential category amount identical before/after', () => {
    const bRow = (before.getCategoriesBreakdown as Array<{ id: number; amount: string }>).find(
      (row) => row.id === essentialCategoryId,
    )
    const aRow = (after.getCategoriesBreakdown as Array<{ id: number; amount: string }>).find(
      (row) => row.id === essentialCategoryId,
    )
    expect(bRow).toBeDefined()
    expect(aRow).toBeDefined()
    expect(toDecimal(aRow!.amount).equals(toDecimal(bRow!.amount))).toBe(true)
  })

  it('getCategoryRanking: essential category amount identical before/after', () => {
    const bRow = (before.getCategoryRanking as Array<{ id: number; amount: string }>).find(
      (row) => row.id === essentialCategoryId,
    )
    const aRow = (after.getCategoryRanking as Array<{ id: number; amount: string }>).find(
      (row) => row.id === essentialCategoryId,
    )
    expect(bRow).toBeDefined()
    expect(aRow).toBeDefined()
    expect(toDecimal(aRow!.amount).equals(toDecimal(bRow!.amount))).toBe(true)
  })

  it('getCategoryDeviations: essential category deviation entry identical before/after', () => {
    const bMap = before.getCategoryDeviations as Map<number, { deviation: number | null; isNew: boolean; belowNoiseThreshold: boolean }>
    const aMap = after.getCategoryDeviations as Map<number, { deviation: number | null; isNew: boolean; belowNoiseThreshold: boolean }>
    const bEntry = bMap.get(essentialCategoryId)
    const aEntry = aMap.get(essentialCategoryId)
    expect(bEntry).toBeDefined()
    expect(aEntry).toBeDefined()
    expect(aEntry!.isNew).toBe(bEntry!.isNew)
    if (bEntry!.deviation === null || aEntry!.deviation === null) {
      expect(aEntry!.deviation).toBe(bEntry!.deviation)
    } else {
      expect(toDecimal(aEntry!.deviation).equals(toDecimal(bEntry!.deviation))).toBe(true)
    }
  })

  it('getCategoryDetail: summary total identical before/after', () => {
    const b = before.getCategoryDetail as { summary: { total: string } }
    const a = after.getCategoryDetail as { summary: { total: string } }
    expect(toDecimal(a.summary.total).equals(toDecimal(b.summary.total))).toBe(true)
  })

  it('getMonthlyTrendByNature: essential segment identical before/after', () => {
    const dateRange = dashboardPresetToDateRange('last-month')
    const targetMonth = monthKey(dateRange.from)
    const bPoint = (before.getMonthlyTrendByNature as Array<{ month: string; segments: Record<string, string> }>).find(
      (point) => point.month === targetMonth,
    )
    const aPoint = (after.getMonthlyTrendByNature as Array<{ month: string; segments: Record<string, string> }>).find(
      (point) => point.month === targetMonth,
    )
    expect(bPoint).toBeDefined()
    expect(aPoint).toBeDefined()
    expect(toDecimal(aPoint!.segments.essential).equals(toDecimal(bPoint!.segments.essential))).toBe(true)
  })

  it('getMonthOverMonthCategoryChanges: essential category delta identical before/after', () => {
    const bRow = (before.getMonthOverMonthCategoryChanges as Array<{ categoryId: number | null; delta: string; isNew: boolean }>).find(
      (row) => row.categoryId === essentialCategoryId,
    )
    const aRow = (after.getMonthOverMonthCategoryChanges as Array<{ categoryId: number | null; delta: string; isNew: boolean }>).find(
      (row) => row.categoryId === essentialCategoryId,
    )
    expect(bRow).toBeDefined()
    expect(aRow).toBeDefined()
    expect(aRow!.isNew).toBe(bRow!.isNew)
    expect(toDecimal(aRow!.delta).equals(toDecimal(bRow!.delta))).toBe(true)
  })

  it('getOverviewChart: out.essential identical before/after', () => {
    const dateRange = dashboardPresetToDateRange('last-month')
    const targetMonth = monthKey(dateRange.from)
    const bPoint = (before.getOverviewChart as Array<{ month: string; out: { essential: string } }>).find(
      (point) => point.month === targetMonth,
    )
    const aPoint = (after.getOverviewChart as Array<{ month: string; out: { essential: string } }>).find(
      (point) => point.month === targetMonth,
    )
    expect(bPoint).toBeDefined()
    expect(aPoint).toBeDefined()
    expect(toDecimal(aPoint!.out.essential).equals(toDecimal(bPoint!.out.essential))).toBe(true)
  })

  it('getTagTotals: tagged (outflow) total identical before/after', () => {
    const bRow = (before.getTagTotals as Array<{ tagId: number; total: string }>)[0]
    const aRow = (after.getTagTotals as Array<{ tagId: number; total: string }>)[0]
    expect(bRow).toBeDefined()
    expect(aRow).toBeDefined()
    expect(toDecimal(aRow!.total).equals(toDecimal(bRow!.total))).toBe(true)
  })

  it('getTagDetail: net identical before/after', () => {
    const b = before.getTagDetail as { net: string }
    const a = after.getTagDetail as { net: string }
    expect(toDecimal(a.net).equals(toDecimal(b.net))).toBe(true)
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
      useFrozenFragment: false,
    })
    const totals = snapshot.getOverviewAmountTotals as { totalOut: string }
    expect(toDecimal(totals.totalOut).equals(toDecimal('42.00'))).toBe(true)
  })
})
