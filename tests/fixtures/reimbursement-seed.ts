// Seed builders for the real-Postgres reimbursement regression harness (Phase 73).
// All monetary inputs/outputs go through toDecimal()/toDbDecimal() — never raw JS string
// concatenation of an amount (CLAUDE.md — Decimal.js for money).
import { randomUUID } from 'node:crypto'
import {
  category as categoryTable,
  direction as directionTable,
  expense as expenseTable,
  nature as natureTable,
  reimbursement as reimbursementTable,
  reimbursementRefund as reimbursementRefundTable,
  subCategory as subCategoryTable,
  tag as tagTable,
  transaction as transactionTable,
  transactionPair as transactionPairTable,
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
    subCategoryId: number
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
    status: '3', // manually categorized — included in DASHBOARD_TOTAL_EXPENSE_STATUSES
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

/**
 * Inserts directly into transaction_pair (old-shape data, for the "before" snapshot). Per D-10's
 * sign-based resolution (not the old magnitude rule): pass the OUTFLOW transaction as
 * `primaryTransactionId` so the seeded legacy pair matches what a real, correctly-signed pair
 * looks like.
 */
export async function seedLegacyPair(
  db: ReimbursementTestDb,
  input: { primaryTransactionId: string; secondaryTransactionId: string },
): Promise<{ pairId: number }> {
  const [row] = await db
    .insert(transactionPairTable)
    .values({
      transactionAId: input.primaryTransactionId,
      transactionBId: input.secondaryTransactionId,
    })
    .returning({ id: transactionPairTable.id })

  return { pairId: row.id }
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
 */
export async function seedReimbursement(
  db: ReimbursementTestDb,
  input: {
    userId: string
    title: string
    expenseId: string
    refundTransactionIds: string[]
  },
): Promise<{ reimbursementId: number }> {
  const [row] = await db
    .insert(reimbursementTable)
    .values({ userId: input.userId, title: input.title, expenseId: input.expenseId })
    .returning({ id: reimbursementTable.id })

  for (const transactionId of input.refundTransactionIds) {
    await db.insert(reimbursementRefundTable).values({ reimbursementId: row.id, transactionId })
  }

  return { reimbursementId: row.id }
}

/**
 * Seeds one fully independent legacy transaction_pair row: its own user, its own outflow
 * expense/transaction, and its own inflow refund expense/transaction — for the
 * migration-backfill bulk correctness suite (K independent pairs across different users).
 *
 * `taxonomy` is passed in (seeded ONCE by the caller, shared across all K calls) rather than
 * seeded fresh per call: `direction.code` and `nature.code` carry a global UNIQUE constraint
 * (not user-scoped), so calling seedMinimalTaxonomy() once per independent pair would violate
 * it on the second call. Sharing one taxonomy across the K users does not affect backfill
 * correctness — the migration keys strictly on transaction/expense/reimbursement user_id, never
 * on which user "owns" the category/subcategory a transaction happens to reference.
 *
 * `index` only seeds distinct occurredAt/title values across calls; it is not an ownership or
 * ordering signal.
 */
export async function seedIndependentLegacyPair(
  db: ReimbursementTestDb,
  input: { index: number; taxonomy: MinimalTaxonomy },
): Promise<{
  userId: string
  outflowExpenseId: string
  outflowTransactionId: string
  refundTransactionId: string
  pairId: number
}> {
  const { userId } = await seedUser(db, { name: `Backfill User ${input.index}` })
  const occurredAt = new Date(2026, 0, 1 + input.index, 12, 0, 0)

  const { expenseId: outflowExpenseId, transactionId: outflowTransactionId } =
    await seedExpenseWithTransaction(db, {
      userId,
      subCategoryId: input.taxonomy.essentialSubCategoryId,
      amount: '-30.00',
      occurredAt,
      title: `Backfill outflow ${input.index}`,
    })

  const { transactionId: refundTransactionId } = await seedExpenseWithTransaction(db, {
    userId,
    subCategoryId: input.taxonomy.incomeSubCategoryId,
    amount: '15.00',
    occurredAt,
    title: `Backfill refund ${input.index}`,
  })

  const { pairId } = await seedLegacyPair(db, {
    primaryTransactionId: outflowTransactionId,
    secondaryTransactionId: refundTransactionId,
  })

  return { userId, outflowExpenseId, outflowTransactionId, refundTransactionId, pairId }
}
