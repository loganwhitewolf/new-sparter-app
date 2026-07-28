// Seed builders for the real-Postgres reimbursement regression harness (Phase 73).
// All monetary inputs/outputs go through toDecimal()/toDbDecimal() — never raw JS string
// concatenation of an amount (CLAUDE.md — Decimal.js for money).
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import {
  amortizationInstalment as amortizationInstalmentTable,
  amortizationPlan as amortizationPlanTable,
  category as categoryTable,
  direction as directionTable,
  expense as expenseTable,
  expenseGroup as expenseGroupTable,
  expenseGroupMembership as expenseGroupMembershipTable,
  nature as natureTable,
  reimbursement as reimbursementTable,
  reimbursementAnchorTransaction as reimbursementAnchorTransactionTable,
  reimbursementRefund as reimbursementRefundTable,
  subCategory as subCategoryTable,
  tag as tagTable,
  transaction as transactionTable,
  transactionTag as transactionTagTable,
  user as userTable,
} from '@/lib/db/schema'
import { toDbDecimal, toDecimal } from '@/lib/utils/decimal'
import type { ReimbursementTestDb } from '@/tests/helpers/reimbursement-test-db'

export async function seedUser(
  db: ReimbursementTestDb,
  input?: { name?: string; email?: string },
): Promise<{ userId: string }> {
  const userId = randomUUID()
  await db.insert(userTable).values({
    id: userId,
    name: input?.name ?? 'Reimbursement Regression Test User',
    email: input?.email ?? `reimbursement-regression-${userId}@example.test`,
  })
  return { userId }
}

export type MinimalTaxonomy = {
  outDirectionId: number
  inDirectionId: number
  essentialNatureId: number
  incomeNatureId: number
  essentialCategoryId: number
  incomeCategoryId: number
  essentialSubCategoryId: number
  incomeSubCategoryId: number
}

/**
 * One 'out'-direction essential category/subcategory pair, one 'in'-direction income
 * category/subcategory pair — matching the direction/nature schema at lib/db/schema.ts
 * lines 221-251. Direction/nature/category/sub_category are all truncated per-test
 * (resetReimbursementFixtures), so this rebuilds the minimal slice each run.
 */
export async function seedMinimalTaxonomy(
  db: ReimbursementTestDb,
  userId: string,
): Promise<MinimalTaxonomy> {
  const [outDirection] = await db
    .insert(directionTable)
    .values({
      code: 'out',
      labelIt: 'Uscite',
      netWorthEffect: 'decrease',
      includedInTotals: true,
      shownSeparately: false,
      hidden: false,
      displayOrder: 1,
    })
    .returning({ id: directionTable.id })

  const [inDirection] = await db
    .insert(directionTable)
    .values({
      code: 'in',
      labelIt: 'Entrate',
      netWorthEffect: 'increase',
      includedInTotals: true,
      shownSeparately: false,
      hidden: false,
      displayOrder: 0,
    })
    .returning({ id: directionTable.id })

  const [essentialNature] = await db
    .insert(natureTable)
    .values({ code: 'essential', directionId: outDirection.id, labelIt: 'Essenziale', displayOrder: 0 })
    .returning({ id: natureTable.id })

  const [incomeNature] = await db
    .insert(natureTable)
    .values({ code: 'income', directionId: inDirection.id, labelIt: 'Entrate ricorrenti', displayOrder: 0 })
    .returning({ id: natureTable.id })

  const [essentialCategory] = await db
    .insert(categoryTable)
    .values({ userId, name: 'Spesa Test', slug: 'spesa-test' })
    .returning({ id: categoryTable.id })

  const [incomeCategory] = await db
    .insert(categoryTable)
    .values({ userId, name: 'Entrate Test', slug: 'entrate-test' })
    .returning({ id: categoryTable.id })

  const [essentialSubCategory] = await db
    .insert(subCategoryTable)
    .values({
      userId,
      categoryId: essentialCategory.id,
      name: 'Essenziale Test',
      slug: 'essenziale-test',
      natureId: essentialNature.id,
    })
    .returning({ id: subCategoryTable.id })

  const [incomeSubCategory] = await db
    .insert(subCategoryTable)
    .values({
      userId,
      categoryId: incomeCategory.id,
      name: 'Entrate Test',
      slug: 'entrate-test',
      natureId: incomeNature.id,
    })
    .returning({ id: subCategoryTable.id })

  return {
    outDirectionId: outDirection.id,
    inDirectionId: inDirection.id,
    essentialNatureId: essentialNature.id,
    incomeNatureId: incomeNature.id,
    essentialCategoryId: essentialCategory.id,
    incomeCategoryId: incomeCategory.id,
    essentialSubCategoryId: essentialSubCategory.id,
    incomeSubCategoryId: incomeSubCategory.id,
  }
}

export async function seedExpenseWithTransaction(
  db: ReimbursementTestDb,
  input: {
    userId: string
    // CR-01 regression (Phase 77 review-fix): `null` seeds a genuinely uncategorized
    // expense/transaction pair, exercising the same path that used to be mislabeled as
    // "categorized" by activatePlanTx -> applyDetachCleanupTx. Every pre-existing caller
    // passes a number, so status stays '3' for them — unchanged behavior.
    subCategoryId: number | null
    amount: string
    occurredAt: Date
    title?: string
  },
): Promise<{ expenseId: string; transactionId: string }> {
  const expenseId = randomUUID()
  const transactionId = randomUUID()
  const amount = toDbDecimal(toDecimal(input.amount))
  const title = input.title ?? 'Test transaction'

  await db.insert(expenseTable).values({
    id: expenseId,
    userId: input.userId,
    title,
    subCategoryId: input.subCategoryId,
    totalAmount: amount,
    transactionCount: 1,
    firstTransactionAt: input.occurredAt,
    lastTransactionAt: input.occurredAt,
    // manually categorized ('3', included in DASHBOARD_TOTAL_EXPENSE_STATUSES) when a
    // subCategoryId is given, uncategorized ('1') otherwise — kept consistent with the
    // subCategoryId column so the fixture itself never produces the CR-01 invariant violation.
    status: input.subCategoryId != null ? '3' : '1',
  })

  await db.insert(transactionTable).values({
    id: transactionId,
    userId: input.userId,
    expenseId,
    transactionHash: `hash-${transactionId}`,
    description: title,
    descriptionHash: `dh-${transactionId}`,
    amount,
    occurredAt: input.occurredAt,
    rowIndex: 0,
  })

  return { expenseId, transactionId }
}

export async function seedTag(
  db: ReimbursementTestDb,
  input: { userId: string; name: string },
): Promise<{ tagId: number }> {
  const [row] = await db
    .insert(tagTable)
    .values({
      userId: input.userId,
      name: input.name,
      normalizedName: input.name.trim().toLowerCase(),
    })
    .returning({ id: tagTable.id })

  return { tagId: row.id }
}

export async function attachTagToTransaction(
  db: ReimbursementTestDb,
  input: { tagId: number; transactionId: string },
): Promise<void> {
  await db.insert(transactionTagTable).values({ tagId: input.tagId, transactionId: input.transactionId })
}

/**
 * Inserts a reimbursement + its N reimbursement_refund rows directly into the new schema
 * (Phase 73 Plan 02) — for scenarios built natively rather than migrated from a legacy
 * transaction_pair, since a legacy pair can only ever express N=1 and cannot express the
 * dinner (N=3), adjacency-exceeds (N=2), or ordering (N=2) scenarios.
 *
 * Refund rows are inserted ONE AT A TIME (not as a single bulk values() array) so each gets
 * its own `created_at` at insert time — required by the ordering scenario, which links the
 * same two refund amounts in both possible sequences across two sub-tests.
 *
 * Phase 75 (D-08, the frozen anchored-transaction set): ALSO inserts one
 * reimbursement_anchor_transaction row per transaction CURRENTLY belonging to `input.expenseId` —
 * mirrors migration 0031's backfill (INSERT ... SELECT r.id, t.id FROM reimbursement r INNER JOIN
 * transaction t ON t.expense_id = r.expense_id). Queried rather than accepting a single
 * transactionId param because the Q3 multi-transaction-Expense scenario (this file's siblings
 * test) seeds TWO transactions under one expenseId, and effectiveAmount()'s frozen-set Branch A
 * must see both — omitting either would silently exclude a real member from the spread and every
 * existing regression assertion would read an incomplete (or empty) member set post-CTE-change.
 *
 * `anchorTransactionIds` overrides that Expense-wide default with an explicit set — the shape
 * `createPairTx` actually writes today (ONE transaction: the one the user linked, see
 * lib/services/transaction-pairs.ts). Needed to reproduce the multi-transaction Expense where only
 * one transaction is anchored; the default stays migration-0031's backfill shape.
 */
export async function seedReimbursement(
  db: ReimbursementTestDb,
  input: {
    userId: string
    title: string
    expenseId: string
    refundTransactionIds: string[]
    anchorTransactionIds?: string[]
  },
): Promise<{ reimbursementId: number }> {
  const [row] = await db
    .insert(reimbursementTable)
    .values({ userId: input.userId, title: input.title, expenseId: input.expenseId })
    .returning({ id: reimbursementTable.id })

  for (const transactionId of input.refundTransactionIds) {
    await db.insert(reimbursementRefundTable).values({ reimbursementId: row.id, transactionId })
  }

  const anchorTransactionIds =
    input.anchorTransactionIds ??
    (
      await db
        .select({ id: transactionTable.id })
        .from(transactionTable)
        .where(eq(transactionTable.expenseId, input.expenseId))
    ).map((row) => row.id)

  for (const transactionId of anchorTransactionIds) {
    await db
      .insert(reimbursementAnchorTransactionTable)
      .values({ reimbursementId: row.id, transactionId })
  }

  return { reimbursementId: row.id }
}

/**
 * Inserts one additional 'out'-direction essential category/subcategory pair (Phase 74 Plan 01),
 * for the cross-subcategory Group-anchor spread scenario — mirrors seedMinimalTaxonomy's
 * essential category/subcategory insert shape, but under a distinct name/slug so it groups
 * separately from taxonomy.essentialCategoryId in the per-category breakdown assertions.
 */
export async function seedSecondEssentialCategory(
  db: ReimbursementTestDb,
  input: { userId: string; natureId: number },
): Promise<{ categoryId: number; subCategoryId: number }> {
  const [category] = await db
    .insert(categoryTable)
    .values({ userId: input.userId, name: 'Trasporti Test', slug: 'trasporti-test' })
    .returning({ id: categoryTable.id })

  const [subCategory] = await db
    .insert(subCategoryTable)
    .values({
      userId: input.userId,
      categoryId: category.id,
      name: 'Trasporti Test',
      slug: 'trasporti-test',
      natureId: input.natureId,
    })
    .returning({ id: subCategoryTable.id })

  return { categoryId: category.id, subCategoryId: subCategory.id }
}

/**
 * Inserts one expense_group row plus one expense_group_membership row per member expense id
 * (Phase 74 Plan 01) — mirrors seedReimbursement's one-row-then-loop shape. Group totals are
 * computed at read time (ADR 0017); this fixture only wires the membership.
 */
export async function seedExpenseGroup(
  db: ReimbursementTestDb,
  input: { userId: string; title: string; subCategoryId: number; memberExpenseIds: string[] },
): Promise<{ groupId: number }> {
  const [group] = await db
    .insert(expenseGroupTable)
    .values({ userId: input.userId, title: input.title, subCategoryId: input.subCategoryId })
    .returning({ id: expenseGroupTable.id })

  for (const expenseId of input.memberExpenseIds) {
    await db.insert(expenseGroupMembershipTable).values({ groupId: group.id, expenseId })
  }

  return { groupId: group.id }
}

/**
 * Inserts a reimbursement anchored on an Expense Group (expenseGroupId set, expenseId left null —
 * the reimbursement_anchor_xor CHECK constraint requires exactly one) plus its N
 * reimbursement_refund rows (Phase 74 Plan 01). Identical shape to seedReimbursement, refund rows
 * inserted one at a time so each gets its own created_at (ordering-determinism convention).
 */
export async function seedReimbursementOnGroup(
  db: ReimbursementTestDb,
  input: {
    userId: string
    title: string
    expenseGroupId: number
    refundTransactionIds: string[]
  },
): Promise<{ reimbursementId: number }> {
  const [row] = await db
    .insert(reimbursementTable)
    .values({ userId: input.userId, title: input.title, expenseGroupId: input.expenseGroupId })
    .returning({ id: reimbursementTable.id })

  for (const transactionId of input.refundTransactionIds) {
    await db.insert(reimbursementRefundTable).values({ reimbursementId: row.id, transactionId })
  }

  return { reimbursementId: row.id }
}

/**
 * Inserts one amortization_plan row + N amortization_instalment rows DIRECTLY (Phase 77,
 * ADR 0019 D-12) — mirrors seedExpenseWithTransaction's direct-insert style, NOT the production
 * activatePlanTx write path, so the regression fixture stays independent of the code under test.
 * totalAmount defaults to the sum of the given instalments (Decimal.js, never native +) unless
 * overridden.
 */
export async function seedAmortizationPlan(
  db: ReimbursementTestDb,
  input: {
    userId: string
    transactionId: string
    expenseId: string
    months: number
    instalments: Array<{ date: Date; amount: string }>
    totalAmount?: string
  },
): Promise<{ planId: string }> {
  const planId = randomUUID()
  const totalAmount = toDbDecimal(
    toDecimal(
      input.totalAmount ??
        input.instalments
          .reduce((sum, instalment) => sum.plus(toDecimal(instalment.amount)), toDecimal('0'))
          .toString(),
    ),
  )

  await db.insert(amortizationPlanTable).values({
    id: planId,
    userId: input.userId,
    transactionId: input.transactionId,
    months: input.months,
    startDate: input.instalments[0]!.date,
    status: 'open',
    totalAmount,
  })

  for (const [index, instalment] of input.instalments.entries()) {
    await db.insert(amortizationInstalmentTable).values({
      id: randomUUID(),
      userId: input.userId,
      planId,
      instalmentNumber: index + 1,
      expenseId: input.expenseId,
      amount: toDbDecimal(toDecimal(instalment.amount)),
      occurredAt: instalment.date,
    })
  }

  return { planId }
}
