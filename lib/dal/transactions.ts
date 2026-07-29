import 'server-only'
import { cache } from 'react'
import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, or, sql } from 'drizzle-orm'
import { DETAIL_LINKED_TRANSACTIONS_PREVIEW_LIMIT } from '@/lib/constants/detail-page-limits'
import { db, type DbOrTx } from '@/lib/db'
import { toDecimal } from '@/lib/utils/decimal'
import { verifySession } from '@/lib/dal/auth'
import { tagScopedTransactions } from '@/lib/dal/transaction-tags-sql'
import {
  category,
  direction,
  expense,
  expenseGroup,
  expenseGroupMembership,
  file as importFile,
  importFormatVersion,
  nature,
  platform,
  subCategory,
  transaction,
  userSubcategoryOverride,
} from '@/lib/db/schema'
import type { FileTransactionRow } from '@/lib/types/file-detail'
import type {
  ParsedTransactionFilters,
  TransactionSort,
  TransactionSortDirection,
} from '@/lib/validations/transactions'

export type { FileTransactionRow }

function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, '\\$&')
}

export const TRANSACTION_LIST_LIMIT = 50

export type TransactionPagination = {
  limit?: number
  offset?: number
}

export type TransactionInsertData = {
  id: string
  userId: string
  fileId: string | null
  expenseId: string | null
  transactionHash: string
  description: string
  descriptionHash: string
  amount: string
  currency?: string
  occurredAt: Date
  rowIndex: number
  rawRow?: Record<string, string | number | null>
}

export type TransactionFilters = {
  fromDate?: Date
  toDate?: Date
  platform?: string
  importId?: string
  name?: string
  categorySlug?: string
  subCategoryId?: number
  /** Tag click-through filter — LOCKED DECISION 3 (68-01) — `/transactions?tag={tagId}` */
  tagId?: number
  sort?: TransactionSort
  dir?: TransactionSortDirection
  // Wave 4 filter conditions (D-19..D-25):
  months?: string[]
  amountMin?: string
  amountMax?: string
  status?: 'uncategorized' | 'categorized'
  // Category-derived filters: nature via nature.code, direction via direction.code
  nature?: string
  direction?: string
}

/**
 * Phase 73 (D-05/D-06, T-73-09, ADR 0018): resolves the transaction id of the OTHER
 * participant in `${transaction.id}`'s reimbursement, for the paired-* display fields below.
 * Repoints the Phase 50 1:1 legacy-pair-table popover onto the generalized
 * `reimbursement`/`reimbursement_refund` tables.
 *
 * - Refund role (this id exists in reimbursement_refund): counterpart = the reimbursement's
 *   anchor transaction — the earliest transaction of the anchor Expense, the exact tie-break
 *   Plan 73-01 built into effectiveAmount() (lib/dal/transaction-pairs-sql.ts), reused here
 *   rather than inventing a second tie-break rule.
 * - Anchor role (a `reimbursement` row's expense_id matches this transaction's expense_id AND
 *   this transaction IS that earliest transaction — Q3 tie-break): counterpart = the
 *   earliest-LINKED refund (`reimbursement_refund.created_at ASC, transaction_id ASC` —
 *   T-73-11, a documented single-counterpart display limitation: only ONE refund is shown
 *   here when N>1 exist; a full multi-refund popover is Phase 75/76 scope, not silently
 *   dropped — pairedNetAmount below is NOT limited this way).
 * - Neither role: NULL (unpaired, unchanged from today).
 */
function pairedCounterpartIdExpr() {
  return sql`(
    CASE
      WHEN EXISTS (
        SELECT 1 FROM reimbursement_refund rr
        WHERE rr.transaction_id = ${transaction.id}
      )
      THEN (
        SELECT t2.id
        FROM reimbursement_refund rr
        INNER JOIN reimbursement r ON r.id = rr.reimbursement_id
        INNER JOIN transaction t2 ON t2.id = (
          SELECT t3.id FROM transaction t3
          WHERE t3.expense_id = r.expense_id
          ORDER BY t3.occurred_at ASC, t3.id ASC
          LIMIT 1
        )
        WHERE rr.transaction_id = ${transaction.id}
      )
      WHEN EXISTS (
        SELECT 1 FROM reimbursement r
        WHERE r.expense_id = ${transaction.expenseId}
        AND ${transaction.id} = (
          SELECT t3.id FROM transaction t3
          WHERE t3.expense_id = ${transaction.expenseId}
          ORDER BY t3.occurred_at ASC, t3.id ASC
          LIMIT 1
        )
      )
      THEN (
        SELECT rr2.transaction_id
        FROM reimbursement r2
        INNER JOIN reimbursement_refund rr2 ON rr2.reimbursement_id = r2.id
        WHERE r2.expense_id = ${transaction.expenseId}
        ORDER BY rr2.created_at ASC, rr2.transaction_id ASC
        LIMIT 1
      )
      ELSE NULL
    END
  )`
}

/**
 * Resolves the reimbursement id `${transaction.id}` participates in (as either anchor or
 * refund role — same rules as pairedCounterpartIdExpr() above), for pairedNetAmount, which
 * needs the FULL reimbursement (anchor + every linked refund), not just the displayed
 * single counterpart.
 */
function pairedReimbursementIdExpr() {
  return sql`(
    CASE
      WHEN EXISTS (
        SELECT 1 FROM reimbursement_refund rr
        WHERE rr.transaction_id = ${transaction.id}
      )
      THEN (
        SELECT rr.reimbursement_id
        FROM reimbursement_refund rr
        WHERE rr.transaction_id = ${transaction.id}
        LIMIT 1
      )
      WHEN EXISTS (
        SELECT 1 FROM reimbursement r
        WHERE r.expense_id = ${transaction.expenseId}
        AND ${transaction.id} = (
          SELECT t3.id FROM transaction t3
          WHERE t3.expense_id = ${transaction.expenseId}
          ORDER BY t3.occurred_at ASC, t3.id ASC
          LIMIT 1
        )
      )
      THEN (
        SELECT r2.id
        FROM reimbursement r2
        WHERE r2.expense_id = ${transaction.expenseId}
        LIMIT 1
      )
      ELSE NULL
    END
  )`
}

export const transactionListSelect = {
  id: transaction.id,
  description: transaction.description,
  customTitle: transaction.customTitle,
  amount: transaction.amount,
  currency: transaction.currency,
  occurredAt: transaction.occurredAt,
  rowIndex: transaction.rowIndex,
  expenseId: expense.id,
  expenseTitle: expense.title,
  expenseTransactionCount: expense.transactionCount,
  expenseStatus: expense.status,
  expenseCategoryName: category.name,
  expenseSubCategoryName: sql<string | null>`coalesce(${userSubcategoryOverride.customName}, ${subCategory.name})`,
  fileId: importFile.id,
  /** Prefer user-facing display name; fall back to upload file name. */
  fileName: sql<string | null>`coalesce(nullif(trim(coalesce(${importFile.displayName}, '')), ''), ${importFile.originalName})`,
  importedAt: importFile.importedAt,
  platformId: platform.id,
  platformName: platform.name,
  platformSlug: platform.slug,
  // Direction code from the nature→direction join (replaces the category.id placeholder)
  categoryType: sql<'in' | 'out' | 'allocation' | 'system' | 'transfer' | null>`${direction.code}`,
  // Group-title display precedence (Task 3, GRP-08): non-null only when the linked expense is
  // an Expense Group member; display-only, never participates in sorting/filtering.
  groupId: expenseGroupMembership.groupId,
  groupTitle: expenseGroup.title,
  // Phase 73 (D-05/D-06, T-73-09, ADR 0018): pairing fields repointed from the 1:1
  // legacy 1:1 pair table to the generalized `reimbursement`/`reimbursement_refund` tables
  // — correlated subqueries (no LEFT JOIN, to preserve buildTransactionOrderBy). See
  // pairedCounterpartIdExpr()/pairedReimbursementIdExpr() above for role-resolution rules.
  pairedWithId: sql<string | null>`${pairedCounterpartIdExpr()}`,
  pairedNetAmount: sql<string | null>`(
    SELECT (
      t_anchor.amount::numeric + COALESCE((
        SELECT SUM(rt.amount::numeric)
        FROM reimbursement_refund rr
        INNER JOIN transaction rt ON rt.id = rr.transaction_id
        WHERE rr.reimbursement_id = r.id
      ), 0)
    )::text
    FROM reimbursement r
    INNER JOIN transaction t_anchor ON t_anchor.id = (
      SELECT t2.id FROM transaction t2
      WHERE t2.expense_id = r.expense_id
      ORDER BY t2.occurred_at ASC, t2.id ASC
      LIMIT 1
    )
    WHERE r.id = ${pairedReimbursementIdExpr()}
  )`,
  // Counterpart's OWN original amount (not the net) — shown as "Importo" in the pair popover.
  pairedAmount: sql<string | null>`(
    SELECT t2.amount::text FROM transaction t2 WHERE t2.id = ${pairedCounterpartIdExpr()}
  )`,
  pairedDescription: sql<string | null>`(
    SELECT t2.description FROM transaction t2 WHERE t2.id = ${pairedCounterpartIdExpr()}
  )`,
  pairedOccurredAt: sql<Date | null>`(
    SELECT t2.occurred_at FROM transaction t2 WHERE t2.id = ${pairedCounterpartIdExpr()}
  )`,
  // Phase 76 (D-06, RMB-10): the reimbursement id this transaction participates in (anchor or
  // refund role), for the row-indicator badge's deep link to /reimbursements/[id]. Same
  // role-resolution rules as pairedReimbursementIdExpr() above, exposed directly here rather than
  // only used internally by pairedNetAmount.
  reimbursementId: sql<number | null>`${pairedReimbursementIdExpr()}`,
  // Phase 77 (D-05, Task 3 guards): the amortization_plan id this transaction already has, if
  // any — a correlated subquery (not a LEFT JOIN, mirroring pairedWithId's own style exactly) so
  // buildTransactionOrderBy's grouping/sort shape is preserved. Non-null means "already-amortized"
  // (D-05 guard) client-side, with zero extra round-trips.
  amortizationPlanId: sql<string | null>`(
    SELECT ap.id FROM amortization_plan ap WHERE ap.transaction_id = ${transaction.id}
  )`,
  // Phase 78 (D-01, AMORT-04): the amortization_plan's own status ('open'/'closed'), gating the
  // "Chiudi ammortamento" action's visibility alongside amortizationPlanId — same
  // correlated-subquery style, one extra column, no join.
  amortizationPlanStatus: sql<string | null>`(
    SELECT ap.status FROM amortization_plan ap WHERE ap.transaction_id = ${transaction.id}
  )`,
}

export const transactionPlatformSelect = {
  id: platform.id,
  name: platform.name,
  slug: platform.slug,
}

export type TransactionListRow = {
  id: string
  description: string
  customTitle: string | null
  amount: string
  currency: string
  occurredAt: Date
  rowIndex: number
  expenseId: string | null
  expenseTitle: string | null
  expenseTransactionCount: number | null
  expenseStatus: (typeof expense.$inferSelect)['status'] | null
  expenseCategoryName: string | null
  expenseSubCategoryName: string | null
  fileId: string | null
  fileName: string | null
  importedAt: Date | null
  platformId: number | null
  platformName: string | null
  platformSlug: string | null
  // Direction code from the nature→direction join
  categoryType: 'in' | 'out' | 'allocation' | 'system' | 'transfer' | null
  // Group-title display precedence (Task 3, GRP-08)
  groupId: number | null
  groupTitle: string | null
  // Phase 50: pairing fields (nullable — null when transaction is unpaired)
  pairedWithId: string | null
  pairedNetAmount: string | null
  pairedAmount: string | null
  pairedDescription: string | null
  pairedOccurredAt: Date | null
  // Phase 76 (D-06, RMB-10): reimbursement id this transaction participates in (anchor or refund)
  reimbursementId: number | null
  // Phase 77 (D-05): amortization_plan id this transaction already has, if any
  amortizationPlanId: string | null
  // Phase 78 (D-01): the amortization_plan's own status ('open'/'closed'), if any
  amortizationPlanStatus: string | null
}

export type TransactionPlatformOption = {
  id: number
  name: string
  slug: string
}

export type TransactionRow = typeof transaction.$inferSelect

/** Matches table display label: customTitle when set, else bank description. */
export const transactionDisplayTitleSortKey = sql<string>`LOWER(COALESCE(NULLIF(TRIM(${transaction.customTitle}), ''), ${transaction.description}))`

/** Amount column is rendered with formatAbsoluteAmount — sort by magnitude, not sign (D-20). */
export const transactionAmountAbsSortKey = sql`ABS(${transaction.amount}::numeric)`

/** Matches "Spesa collegata" cell labels (categorized, "da categorizzare", "nessuna spesa"). */
export const transactionLinkedExpenseCategorySortKey = sql<string>`LOWER(
  CASE
    WHEN ${expense.id} IS NULL THEN 'nessuna spesa collegata'
    WHEN ${expense.status} NOT IN ('2', '3') THEN 'da categorizzare'
    WHEN ${category.name} IS NULL
      OR COALESCE(
        NULLIF(TRIM(${userSubcategoryOverride.customName}), ''),
        NULLIF(TRIM(${subCategory.name}), '')
      ) IS NULL THEN 'categorizzata'
    ELSE CONCAT(
      ${category.name},
      ' → ',
      COALESCE(NULLIF(TRIM(${userSubcategoryOverride.customName}), ''), ${subCategory.name})
    )
  END
)`

/** Matches primary "Sorgente" label (platform name, manual, or fallback). */
export const transactionPlatformSortKey = sql<string>`LOWER(
  CASE
    WHEN ${transaction.fileId} IS NULL THEN 'manuale'
    ELSE COALESCE(${platform.name}, 'piattaforma non disponibile')
  END
)`

export function getTransactionSortColumn(sort: TransactionSort) {
  switch (sort) {
    case 'amount':
      return transactionAmountAbsSortKey
    case 'description':
      return transactionDisplayTitleSortKey
    case 'category':
      return transactionLinkedExpenseCategorySortKey
    case 'platform':
      return transactionPlatformSortKey
    case 'occurredAt':
      return transaction.occurredAt
    default: {
      const _exhaustive: never = sort
      return _exhaustive
    }
  }
}

export function mapParsedTransactionFiltersToDal(
  parsed: ParsedTransactionFilters,
): TransactionFilters {
  const { type, ...rest } = parsed
  return {
    ...rest,
    ...(type ? { direction: type } : {}),
  }
}

export function buildTransactionOrderBy({
  sort = 'occurredAt',
  dir = 'desc',
}: Pick<TransactionFilters, 'sort' | 'dir'> = {}) {
  const column = getTransactionSortColumn(sort)
  // Tiebreaker on id as LAST element so OFFSET pagination never returns duplicate or
  // missing rows when multiple rows share the same sort column value (D-06).
  return dir === 'asc'
    ? [asc(column), asc(transaction.id)]
    : [desc(column), desc(transaction.id)]
}

export const getTransactions = cache(
  async (
    filters: TransactionFilters = {},
    pagination: TransactionPagination = {},
  ): Promise<TransactionListRow[]> => {
    const { userId } = await verifySession()
    const limit = pagination.limit ?? TRANSACTION_LIST_LIMIT
    const offset = pagination.offset ?? 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditions: any[] = [
      eq(transaction.userId, userId),
      or(isNull(transaction.fileId), eq(importFile.userId, userId)),
    ]

    if (filters.fromDate) {
      conditions.push(gte(transaction.occurredAt, filters.fromDate))
    }

    if (filters.toDate) {
      conditions.push(lte(transaction.occurredAt, filters.toDate))
    }

    if (filters.platform) {
      conditions.push(eq(platform.slug, filters.platform))
    }

    if (filters.importId) {
      conditions.push(eq(transaction.fileId, filters.importId))
    }

    if (filters.name) {
      const pattern = `%${escapeLikePattern(filters.name)}%`
      conditions.push(
        or(
          ilike(transaction.description, pattern),
          ilike(transaction.customTitle, pattern),
          // Matches table label: customTitle → group title → expense title → bank description
          ilike(expense.title, pattern),
          ilike(expenseGroup.title, pattern),
        ),
      )
    }

    if (filters.categorySlug) {
      conditions.push(eq(category.slug, filters.categorySlug))
    }

    if (filters.subCategoryId) {
      conditions.push(eq(subCategory.id, filters.subCategoryId))
    }

    // Tag click-through filter (68-01) — EXISTS predicate, never a leftJoin against
    // transaction_tag (a genuine N:M table; a join would fan out multi-tag rows).
    if (filters.tagId) {
      conditions.push(tagScopedTransactions(filters.tagId))
    }

    // Wave 4: months filter — OR across TO_CHAR(occurredAt, 'YYYY-MM') = ym (D-07/D-08)
    if (filters.months && filters.months.length > 0) {
      conditions.push(
        or(...filters.months.map((ym) => sql`TO_CHAR(${transaction.occurredAt}, 'YYYY-MM') = ${ym}`)),
      )
    }

    // Wave 4: amount range — absolute value (D-20)
    if (filters.amountMin !== undefined) {
      conditions.push(sql`ABS(${transaction.amount}::numeric) >= ${filters.amountMin}::numeric`)
    }
    if (filters.amountMax !== undefined) {
      conditions.push(sql`ABS(${transaction.amount}::numeric) <= ${filters.amountMax}::numeric`)
    }

    // Wave 4: categorization status (D-21/D-23)
    if (filters.status === 'uncategorized') {
      conditions.push(isNull(expense.subCategoryId))
    }
    if (filters.status === 'categorized') {
      conditions.push(isNotNull(expense.subCategoryId))
    }

    // Nature filter — cascade child via subCategory.natureId → nature.code join
    if (filters.nature === 'unclassified') {
      conditions.push(or(isNull(expense.subCategoryId), isNull(subCategory.natureId)))
    } else if (filters.nature) {
      conditions.push(eq(nature.code, filters.nature))
    }

    // Direction filter — via nature→direction join; 'unclassified' matches null natureId rows
    if (filters.direction === 'unclassified') {
      conditions.push(isNull(subCategory.natureId))
    } else if (filters.direction) {
      conditions.push(eq(direction.code, filters.direction))
    }

    return db
      .select(transactionListSelect)
      .from(transaction)
      .leftJoin(importFile, eq(transaction.fileId, importFile.id))
      .leftJoin(
        importFormatVersion,
        eq(importFile.importFormatVersionId, importFormatVersion.id),
      )
      .leftJoin(platform, eq(importFormatVersion.platformId, platform.id))
      .leftJoin(expense, eq(transaction.expenseId, expense.id))
      .leftJoin(expenseGroupMembership, eq(expense.id, expenseGroupMembership.expenseId))
      .leftJoin(expenseGroup, eq(expenseGroupMembership.groupId, expenseGroup.id))
      .leftJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
      .leftJoin(category, eq(subCategory.categoryId, category.id))
      .leftJoin(nature, eq(subCategory.natureId, nature.id))
      .leftJoin(direction, eq(nature.directionId, direction.id))
      .leftJoin(
        userSubcategoryOverride,
        and(
          eq(userSubcategoryOverride.subCategoryId, subCategory.id),
          eq(userSubcategoryOverride.userId, userId),
        ),
      )
      .where(and(...conditions))
      .orderBy(...buildTransactionOrderBy(filters))
      .limit(limit)
      .offset(offset)
  },
)

export const getTransactionPlatforms = cache(
  async (): Promise<TransactionPlatformOption[]> => {
    const { userId } = await verifySession()

    return db
      .selectDistinct(transactionPlatformSelect)
      .from(transaction)
      .innerJoin(importFile, eq(transaction.fileId, importFile.id))
      .innerJoin(
        importFormatVersion,
        eq(importFile.importFormatVersionId, importFormatVersion.id),
      )
      .innerJoin(platform, eq(importFormatVersion.platformId, platform.id))
      .where(and(eq(transaction.userId, userId), eq(importFile.userId, userId)))
      .orderBy(asc(platform.name))
  },
)

export type PlatformYearCoverageRow = {
  platformId: number
  platformName: string
  firstTransactionAt: Date
  lastTransactionAt: Date
}

/**
 * Import-section coverage dashboard (GBH-01): one row per platform with ≥1
 * transaction in `year`, with its earliest/latest occurredAt within that year.
 * Reuses getTransactionPlatforms' exact join/ownership pattern — inner joins plus
 * the year-bounded WHERE mean a platform with zero rows in the window is naturally
 * excluded, no extra filtering needed. Ordered most-behind-first (oldest "last
 * transaction" first, then platform name) so the platform needing attention surfaces
 * immediately instead of requiring the user to scan every row.
 */
export const getPlatformYearCoverage = cache(
  async (year: number): Promise<PlatformYearCoverageRow[]> => {
    const { userId } = await verifySession()

    const from = new Date(year, 0, 1)
    const to = new Date(year, 11, 31, 23, 59, 59, 999)

    const rows = await db
      .select({
        platformId: platform.id,
        platformName: platform.name,
        firstTransactionAt: sql<Date>`min(${transaction.occurredAt})`,
        lastTransactionAt: sql<Date>`max(${transaction.occurredAt})`,
      })
      .from(transaction)
      .innerJoin(importFile, eq(transaction.fileId, importFile.id))
      .innerJoin(
        importFormatVersion,
        eq(importFile.importFormatVersionId, importFormatVersion.id),
      )
      .innerJoin(platform, eq(importFormatVersion.platformId, platform.id))
      .where(
        and(
          eq(transaction.userId, userId),
          eq(importFile.userId, userId),
          gte(transaction.occurredAt, from),
          lte(transaction.occurredAt, to),
        ),
      )
      .groupBy(platform.id, platform.name)
      .orderBy(asc(sql`max(${transaction.occurredAt})`), asc(platform.name))

    // Some pg driver paths return timestamp aggregates as strings — guard like getFileCoveredMonths.
    return rows.map((row) => ({
      platformId: row.platformId,
      platformName: row.platformName,
      firstTransactionAt:
        row.firstTransactionAt instanceof Date
          ? row.firstTransactionAt
          : new Date(row.firstTransactionAt),
      lastTransactionAt:
        row.lastTransactionAt instanceof Date
          ? row.lastTransactionAt
          : new Date(row.lastTransactionAt),
    }))
  },
)

/**
 * Calendar YYYY-MM-DD of the latest transaction for a user+platform
 * (ownership joins match getPlatformYearCoverage). Null when the platform has no txs.
 */
export async function getLastPlatformTransactionDate(
  userId: string,
  platformId: number,
): Promise<string | null> {
  const rows = await db
    .select({
      lastTransactionAt: sql<Date | string | null>`max(${transaction.occurredAt})`,
    })
    .from(transaction)
    .innerJoin(importFile, eq(transaction.fileId, importFile.id))
    .innerJoin(
      importFormatVersion,
      eq(importFile.importFormatVersionId, importFormatVersion.id),
    )
    .innerJoin(platform, eq(importFormatVersion.platformId, platform.id))
    .where(
      and(
        eq(transaction.userId, userId),
        eq(importFile.userId, userId),
        eq(platform.id, platformId),
      ),
    )

  const raw = rows[0]?.lastTransactionAt
  if (raw == null) return null
  const date = raw instanceof Date ? raw : new Date(raw)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

export async function insertTransaction(
  database: DbOrTx,
  data: TransactionInsertData,
): Promise<TransactionRow> {
  const rows = await database
    .insert(transaction)
    .values({
      id: data.id,
      userId: data.userId,
      fileId: data.fileId,
      expenseId: data.expenseId,
      transactionHash: data.transactionHash,
      description: data.description,
      descriptionHash: data.descriptionHash,
      amount: data.amount,
      currency: data.currency ?? 'EUR',
      occurredAt: data.occurredAt,
      rowIndex: data.rowIndex,
      rawRow: data.rawRow ?? null,
    })
    .returning()

  const created = rows[0]
  if (!created) throw new Error('Failed to insert transaction')
  return created
}

export async function getDuplicateHashes(
  database: DbOrTx,
  userId: string,
  hashes: string[],
): Promise<Set<string>> {
  if (hashes.length === 0) return new Set()

  const existing = await database
    .select({ transactionHash: transaction.transactionHash })
    .from(transaction)
    .where(
      and(
        eq(transaction.userId, userId),
        inArray(transaction.transactionHash, hashes),
      ),
    )

  return new Set(existing.map((r) => r.transactionHash))
}

export async function insertTransactionBatch(
  database: DbOrTx,
  rows: TransactionInsertData[],
): Promise<TransactionRow[]> {
  if (rows.length === 0) return []
  const inserted = await database
    .insert(transaction)
    .values(
      rows.map((data) => ({
        id: data.id,
        userId: data.userId,
        fileId: data.fileId,
        expenseId: data.expenseId,
        transactionHash: data.transactionHash,
        description: data.description,
        descriptionHash: data.descriptionHash,
        amount: data.amount,
        currency: data.currency ?? 'EUR',
        occurredAt: data.occurredAt,
        rowIndex: data.rowIndex,
        rawRow: data.rawRow ?? null,
      })),
    )
    .onConflictDoNothing()
    .returning()
  return inserted
}

export type ManualTransactionData = {
  userId: string
  description: string
  amount: string
  currency: string
  occurredAt: Date
  subCategoryId?: number
}

/**
 * Tx-composable core of manual transaction creation (D-10): performs the SAME expense+transaction
 * inserts against the passed-in `tx` — no internal db.transaction call — so callers can compose it
 * inside a larger db.transaction (e.g. the combined create+amortize path, alongside activatePlanTx),
 * matching applyDetachCleanupTx's own tx-core-plus-thin-wrapper pattern.
 */
export async function insertManualTransactionTx(
  tx: DbOrTx,
  data: ManualTransactionData,
): Promise<{ transactionId: string; expenseId: string }> {
  const { computeDescriptionHash, computeTransactionHash } = await import(
    '@/lib/utils/import'
  )

  const descriptionHash = computeDescriptionHash(data.description)
  const transactionId = crypto.randomUUID()
  const expenseId = crypto.randomUUID()
  const transactionHash = computeTransactionHash({
    userId: data.userId,
    occurredAt: data.occurredAt,
    amount: data.amount,
    description: data.description,
  })

  await tx.insert(expense).values({
    id: expenseId,
    userId: data.userId,
    title: data.description,
    descriptionHash,
    subCategoryId: data.subCategoryId ?? null,
    totalAmount: data.amount,
    transactionCount: 1,
    firstTransactionAt: data.occurredAt,
    lastTransactionAt: data.occurredAt,
    status: data.subCategoryId ? '3' : '1',
  })

  await tx.insert(transaction).values({
    id: transactionId,
    userId: data.userId,
    fileId: null,
    expenseId,
    transactionHash,
    description: data.description,
    descriptionHash,
    amount: data.amount,
    currency: data.currency,
    occurredAt: data.occurredAt,
    rowIndex: 0,
  })

  return { transactionId, expenseId }
}

export async function insertManualTransaction(
  data: ManualTransactionData,
): Promise<{ transactionId: string; expenseId: string }> {
  return db.transaction((tx) => insertManualTransactionTx(tx, data))
}

export async function updateTransactionCustomTitle(
  database: DbOrTx,
  id: string,
  userId: string,
  customTitle: string | null,
): Promise<void> {
  await database
    .update(transaction)
    .set({ customTitle })
    .where(and(eq(transaction.id, id), eq(transaction.userId, userId)))
}

export type ExpenseTransactionRow = {
  id: string
  description: string
  customTitle: string | null
  amount: string
  currency: string
  occurredAt: Date
}

export type TransactionDetailRow = {
  id: string
  description: string
  transactionHash: string
  descriptionHash: string
  customTitle: string | null
  amount: string
  currency: string
  occurredAt: Date
  rowIndex: number
  expenseId: string | null
  expenseTitle: string | null
  expenseStatus: (typeof expense.$inferSelect)['status'] | null
  expenseNotes: string | null
  expenseSubCategoryId: number | null
  subCategoryName: string | null
  categoryName: string | null
  categorySlug: string | null
  categoryType: 'in' | 'out' | 'allocation' | 'system' | 'transfer' | null
  expenseTransactionCount: number | null
  fileId: string | null
  fileName: string | null
  platformName: string | null
  // Group-title display precedence (Task 3, GRP-08)
  groupId: number | null
  groupTitle: string | null
  pairedWithId: string | null
  pairedAmount: string | null
  pairedDescription: string | null
  pairedOccurredAt: Date | null
  pairedNetAmount: string | null
  // Phase 77 (D-05, Plan 77-02): the amortization_plan id this transaction already has, if any.
  amortizationPlanId: string | null
  // Phase 78 (D-01): the amortization_plan's own status ('open'/'closed'), if any.
  amortizationPlanStatus: string | null
}

/**
 * Ownership-scoped detail query for `/transactions/[id]` (DET-05). Reuses the
 * pairing sub-queries from `transactionListSelect` and adds the fields the
 * detail page needs beyond the list view (hashes, expense notes/subCategoryId,
 * categorySlug). Returns `undefined` — never throws — for a missing or
 * non-owned id (T-63-01).
 */
export const getTransactionForDetail = cache(
  async ({
    userId,
    id,
  }: {
    userId: string
    id: string
  }): Promise<TransactionDetailRow | undefined> => {
    const rows = await db
      .select({
        id: transaction.id,
        description: transaction.description,
        transactionHash: transaction.transactionHash,
        descriptionHash: transaction.descriptionHash,
        customTitle: transaction.customTitle,
        amount: transaction.amount,
        currency: transaction.currency,
        occurredAt: transaction.occurredAt,
        rowIndex: transaction.rowIndex,
        expenseId: expense.id,
        expenseTitle: expense.title,
        expenseStatus: expense.status,
        expenseNotes: expense.notes,
        expenseSubCategoryId: expense.subCategoryId,
        subCategoryName: sql<string | null>`coalesce(${userSubcategoryOverride.customName}, ${subCategory.name})`,
        categoryName: category.name,
        categorySlug: category.slug,
        categoryType: sql<'in' | 'out' | 'allocation' | 'system' | 'transfer' | null>`${direction.code}`,
        expenseTransactionCount: expense.transactionCount,
        fileId: importFile.id,
        fileName: sql<string | null>`coalesce(nullif(trim(coalesce(${importFile.displayName}, '')), ''), ${importFile.originalName})`,
        platformName: platform.name,
        groupId: expenseGroupMembership.groupId,
        groupTitle: expenseGroup.title,
        pairedWithId: transactionListSelect.pairedWithId,
        pairedAmount: transactionListSelect.pairedAmount,
        pairedDescription: transactionListSelect.pairedDescription,
        pairedOccurredAt: transactionListSelect.pairedOccurredAt,
        pairedNetAmount: transactionListSelect.pairedNetAmount,
        amortizationPlanId: transactionListSelect.amortizationPlanId,
        amortizationPlanStatus: transactionListSelect.amortizationPlanStatus,
      })
      .from(transaction)
      .leftJoin(importFile, eq(transaction.fileId, importFile.id))
      .leftJoin(
        importFormatVersion,
        eq(importFile.importFormatVersionId, importFormatVersion.id),
      )
      .leftJoin(platform, eq(importFormatVersion.platformId, platform.id))
      .leftJoin(expense, eq(transaction.expenseId, expense.id))
      .leftJoin(expenseGroupMembership, eq(expense.id, expenseGroupMembership.expenseId))
      .leftJoin(expenseGroup, eq(expenseGroupMembership.groupId, expenseGroup.id))
      .leftJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
      .leftJoin(category, eq(subCategory.categoryId, category.id))
      .leftJoin(nature, eq(subCategory.natureId, nature.id))
      .leftJoin(direction, eq(nature.directionId, direction.id))
      .leftJoin(
        userSubcategoryOverride,
        and(
          eq(userSubcategoryOverride.subCategoryId, subCategory.id),
          eq(userSubcategoryOverride.userId, userId),
        ),
      )
      .where(and(eq(transaction.id, id), eq(transaction.userId, userId)))
      .limit(1)

    return rows[0]
  },
)

export const getTransactionsByExpenseId = cache(
  async (expenseId: string): Promise<ExpenseTransactionRow[]> => {
    const { userId } = await verifySession()

    return db
      .select({
        id: transaction.id,
        description: transaction.description,
        customTitle: transaction.customTitle,
        amount: transaction.amount,
        currency: transaction.currency,
        occurredAt: transaction.occurredAt,
      })
      .from(transaction)
      .innerJoin(expense, eq(transaction.expenseId, expense.id))
      .where(
        and(
          eq(transaction.expenseId, expenseId),
          eq(transaction.userId, userId),
          eq(expense.userId, userId),
        ),
      )
      .orderBy(desc(transaction.occurredAt))
  },
)

/**
 * Ownership-scoped preview query for the file detail page's transactions card
 * (D-01, DET-08). Capped by `limit` (default 8) so a file with hundreds of
 * rows never renders an unbounded list here — "Vedi tutte" links to the full
 * filtered `/transactions` view instead.
 */
export const getTransactionsByFileId = cache(
  async ({
    userId,
    fileId,
    limit,
  }: {
    userId: string
    fileId: string
    limit?: number
  }): Promise<FileTransactionRow[]> => {
    return db
      .select({
        id: transaction.id,
        description: transaction.description,
        customTitle: transaction.customTitle,
        amount: transaction.amount,
        currency: transaction.currency,
        occurredAt: transaction.occurredAt,
        categoryType: sql<'in' | 'out' | 'allocation' | 'system' | 'transfer' | null>`${direction.code}`,
      })
      .from(transaction)
      .leftJoin(expense, eq(transaction.expenseId, expense.id))
      .leftJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
      .leftJoin(nature, eq(subCategory.natureId, nature.id))
      .leftJoin(direction, eq(nature.directionId, direction.id))
      .where(and(eq(transaction.fileId, fileId), eq(transaction.userId, userId)))
      .orderBy(desc(transaction.occurredAt))
      .limit(limit ?? DETAIL_LINKED_TRANSACTIONS_PREVIEW_LIMIT)
  },
)

const UNCATEGORIZED_TX_LIMIT = 2000

export async function getUncategorizedTransactionsByFileId(
  database: DbOrTx,
  fileId: string,
  userId: string,
): Promise<Array<{ description: string; amount: string }>> {
  return database
    .select({
      description: transaction.description,
      amount: transaction.amount,
    })
    .from(transaction)
    .innerJoin(importFile, eq(transaction.fileId, importFile.id))
    .innerJoin(expense, eq(transaction.expenseId, expense.id))
    .where(
      and(
        eq(transaction.fileId, fileId),
        eq(importFile.userId, userId),
        isNull(expense.subCategoryId),
      ),
    )
    .limit(UNCATEGORIZED_TX_LIMIT)
}

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding gate queries (R-OB-02, R-OB-07) — Phase 38 Plan 01
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the total number of transactions for the given userId.
 * Does NOT call verifySession — caller (RSC layout guard) provides a verified userId.
 * Wrapped in react cache() per DAL convention for RSC deduplication.
 */
export const getTransactionCount = cache(
  async (userId: string): Promise<number> => {
    const rows = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(transaction)
      .where(eq(transaction.userId, userId))

    return Number(rows[0]?.c ?? 0)
  },
)

/** Row shape returned by getTopUncategorizedExpenses (R-OB-07) */
export type TopUncategorizedExpenseRow = {
  id: string
  title: string
  descriptionHash: string
  totalAmount: string
}

/**
 * Returns up to `limit` uncategorized expense rows for the given userId.
 * Filtering: subCategoryId IS NULL AND totalAmount < 0.
 * Deduplication: DISTINCT ON (description_hash) keeping highest |amount| per hash.
 * Result is sorted client-side by |totalAmount| DESC.
 *
 * Security: userId bound from session (T-38-03). Limit hard-capped at 100 (T-38-05).
 */
export const getTopUncategorizedExpenses = cache(
  async (userId: string, limit = 15): Promise<TopUncategorizedExpenseRow[]> => {
    // T-38-05: hard cap to prevent DoS from large limit values
    const safeLimitValue = Math.min(limit, 100)

    const result = await db.execute(sql`
      SELECT DISTINCT ON (description_hash)
        id,
        title,
        description_hash AS "descriptionHash",
        total_amount AS "totalAmount"
      FROM expense
      WHERE user_id = ${userId}
        AND sub_category_id IS NULL
        AND total_amount::numeric < 0
      ORDER BY description_hash, ABS(total_amount::numeric) DESC
      LIMIT ${safeLimitValue}
    `)

    const rows = result.rows as TopUncategorizedExpenseRow[]

    // JS-side sort by |totalAmount| DESC because DISTINCT ON orders by description_hash
    return rows.sort(
      (a, b) => toDecimal(b.totalAmount).abs().comparedTo(toDecimal(a.totalAmount).abs()),
    )
  },
)

/** Row shape returned by getTopExpensesForOnboarding (260615-n3t). */
export type TopOnboardingExpenseRow = TopUncategorizedExpenseRow & {
  subCategoryId: number | null
  subCategoryName: string | null
}

/**
 * Returns up to `limit` top expense rows for the onboarding categorize step.
 * Same dedupe/order/cap as getTopUncategorizedExpenses (DISTINCT ON description_hash,
 * total_amount < 0, ORDER BY description_hash + ABS DESC, limit capped at 100, JS-side
 * |amount| DESC re-sort), but WITHOUT the `sub_category_id IS NULL` predicate.
 *
 * INVARIANT: the onboarding categorize step must show a STABLE set — a row must never
 * vanish after it is categorized or after a manual refresh. Categorized rows are returned
 * here (with their subcategory id + canonical name) and rendered with a persistent green
 * check; the done-state derives from "no uncategorized remain", not from an empty list.
 *
 * Non-goal: user_subcategory_override.custom_name is intentionally NOT joined — the green
 * check uses the canonical system subcategory name only (keep it cheap).
 *
 * Security: userId is bound from the session by the caller. Limit hard-capped at 100.
 */
export const getTopExpensesForOnboarding = cache(
  async (userId: string, limit = 15): Promise<TopOnboardingExpenseRow[]> => {
    // Hard cap to prevent DoS from large limit values
    const safeLimitValue = Math.min(limit, 100)

    // sub_category ALSO has a user_id column, so user_id (and id) are ambiguous after the
    // JOIN and MUST be qualified with expense. description_hash/total_amount/title live only
    // on expense; sub_category.name is the only column taken from the joined table.
    const result = await db.execute(sql`
      SELECT DISTINCT ON (description_hash)
        expense.id AS "id",
        title,
        description_hash AS "descriptionHash",
        total_amount AS "totalAmount",
        expense.sub_category_id AS "subCategoryId",
        sub_category.name AS "subCategoryName"
      FROM expense
      LEFT JOIN sub_category ON sub_category.id = expense.sub_category_id
      WHERE expense.user_id = ${userId}
        AND total_amount::numeric < 0
      ORDER BY description_hash, ABS(total_amount::numeric) DESC
      LIMIT ${safeLimitValue}
    `)

    const rows = result.rows as TopOnboardingExpenseRow[]

    // JS-side sort by |totalAmount| DESC because DISTINCT ON orders by description_hash
    return rows.sort(
      (a, b) => toDecimal(b.totalAmount).abs().comparedTo(toDecimal(a.totalAmount).abs()),
    )
  },
)

export { db }
