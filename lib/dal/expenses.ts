import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/db'
import { category, direction, expense, expenseGroup, expenseGroupMembership, file, importFormatVersion, nature, platform, subCategory, transaction, userSubcategoryOverride } from '@/lib/db/schema'
import { eq, and, count, gte, ilike, inArray, isNull, lte, or, asc, desc, sql } from 'drizzle-orm'
import { verifySession } from '@/lib/dal/auth'
import { periodToDateRange } from '@/lib/utils/date'
import { writeClassificationHistory } from '@/lib/dal/classification-history'
import { toDecimal, toDbDecimal } from '@/lib/utils/decimal'
import type { ExpenseTransactionRow } from '@/lib/dal/transactions'

export { periodToDateRange } from '@/lib/utils/date'

function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, '\\$&')
}

export const EXPENSE_LIST_LIMIT = 50

export type ExpenseSort = 'createdAt' | 'totalAmount' | 'title' | 'category'
export type ExpenseSortDirection = 'asc' | 'desc'

export type ExpenseFilters = {
  categorySlug?: string
  status?: 'uncategorized' | 'categorized'
  /**
   * Optional period filter — kept for backwards compatibility with any existing callers.
   * D-05: the expenses page no longer defaults to any period; this is only applied when
   * explicitly provided. D-11: Expenses toolbar does not expose a temporal filter at all.
   */
  period?: 'last-3-months' | 'last-6-months' | 'this-year' | 'last-year'
  name?: string
  /** Canonical search param key (D-19); same semantics as name */
  q?: string
  sort?: ExpenseSort
  dir?: ExpenseSortDirection
  // Wave 4: absolute-value amount range (D-20)
  amountMin?: string
  amountMax?: string
  /** Platform slug filter — requires importedFromFileId join chain */
  platform?: string
  /** FlowNature filter — eight nature codes plus sentinel 'unclassified' (null natureId). */
  nature?: string
  /** Direction filter — in/out/allocation/transfer plus sentinel 'unclassified' (null natureId). */
  direction?: string
  /** Subcategory id filter — narrows to a specific subCategory.id. */
  subCategoryId?: number
}

export type ExpensePagination = {
  limit?: number
  offset?: number
}

export type ExpenseRow = {
  id: string
  title: string
  status: '1' | '2' | '3' | '4'
  notes: string | null
  createdAt: Date
  totalAmount: string
  transactionCount: number
  subCategoryId: number | null
  subCategoryName: string | null
  categoryName: string | null
  categorySlug: string | null
  categoryType?: 'in' | 'out' | 'allocation' | 'system' | 'transfer' | null
  platformName: string | null
  /** Earliest/latest linked transaction dates (own for an ungrouped expense, MIN/MAX across
   *  members for a composed group row) — GRP-03. */
  firstTransactionAt: Date | null
  lastTransactionAt: Date | null
  /** Non-null when this row represents (or belongs to) an Expense Group — GRP-03/04. */
  groupId: number | null
  groupTitle: string | null
}

export type ExpenseSourceFile = {
  id: string
  name: string
}

export type ExpenseImportContext = {
  sourceFile: ExpenseSourceFile | null
  platformName: string | null
}

/** Matches "Titolo" column label (case-insensitive). */
export const expenseTitleSortKey = sql<string>`LOWER(${expense.title})`

/** Total column uses formatAbsoluteAmount — sort by magnitude, not sign (D-20). */
export const expenseTotalAmountAbsSortKey = sql`ABS(${expense.totalAmount}::numeric)`

/** Rows showing "—" in the category column (missing category or subcategory name). */
export const expenseCategoryIncompleteBucket = sql<number>`CASE
  WHEN ${category.name} IS NULL THEN 1
  WHEN COALESCE(
    NULLIF(TRIM(${userSubcategoryOverride.customName}), ''),
    NULLIF(TRIM(${subCategory.name}), '')
  ) IS NULL THEN 1
  ELSE 0
END`

/** Matches "Categoria · Sottocategoria" when both names are present (case-insensitive). */
export const expenseCategorySortKey = sql<string>`LOWER(
  CONCAT(
    ${category.name},
    ' · ',
    COALESCE(NULLIF(TRIM(${userSubcategoryOverride.customName}), ''), ${subCategory.name})
  )
)`

export function getExpenseSortColumn(sort: ExpenseSort) {
  switch (sort) {
    case 'title':
      return expenseTitleSortKey
    case 'category':
      return expenseCategorySortKey
    case 'totalAmount':
      return expenseTotalAmountAbsSortKey
    case 'createdAt':
      return expense.createdAt
    default: {
      const _exhaustive: never = sort
      return _exhaustive
    }
  }
}

export function buildExpenseOrderBy({
  sort = 'createdAt',
  dir = 'desc',
}: Pick<ExpenseFilters, 'sort' | 'dir'> = {}) {
  // Incomplete category rows ("—") stay last in both ASC and DESC via bucket 0/1.
  if (sort === 'category') {
    return dir === 'asc'
      ? [asc(expenseCategoryIncompleteBucket), asc(expenseCategorySortKey), asc(expense.id)]
      : [asc(expenseCategoryIncompleteBucket), desc(expenseCategorySortKey), desc(expense.id)]
  }

  const column = getExpenseSortColumn(sort)
  // Tie-break on id so OFFSET pagination never returns the same expense twice.
  return dir === 'asc'
    ? [asc(column), asc(expense.id)]
    : [desc(column), desc(expense.id)]
}

/** All-time uncategorized bucket — same status set as getExpenses status=uncategorized (O-01). */
export const getUncategorizedExpenseCount = cache(async (): Promise<number> => {
  const { userId } = await verifySession()
  const rows = await db
    .select({ total: count() })
    .from(expense)
    .where(
      and(
        eq(expense.userId, userId),
        inArray(expense.status, ['1', '4']),
      ),
    )

  return Number(rows[0]?.total ?? 0)
})

/** Raw per-member row shape fetched from the DB before group composition (Task 1, GRP-03). */
type RawExpenseRow = ExpenseRow

/**
 * Collapses raw (per-expense) rows sharing an `expenseGroupMembership.groupId` into a single
 * composed `ExpenseRow`, applies the amount-range filter to the FINAL (composed) totals, sorts
 * with a JS mirror of `buildExpenseOrderBy`, and slices by `offset`/`limit` — all in JS, over the
 * full filtered+joined set. This guarantees a group is never split across two pagination pages
 * (65-RESEARCH.md pitfall #3) and that pagination never operates on a stale SQL LIMIT/OFFSET
 * taken before grouping.
 */
function composeExpenseRows(
  rawRows: RawExpenseRow[],
  filters: Pick<ExpenseFilters, 'sort' | 'dir' | 'amountMin' | 'amountMax'>,
  pagination: { limit: number; offset: number },
): ExpenseRow[] {
  const buckets = new Map<string, RawExpenseRow[]>()
  for (const row of rawRows) {
    const key = row.groupId != null ? `group:${row.groupId}` : `own:${row.id}`
    const bucket = buckets.get(key)
    if (bucket) bucket.push(row)
    else buckets.set(key, [row])
  }

  let composed: ExpenseRow[] = [...buckets.values()].map((members) => {
    const first = members[0]
    if (first.groupId == null) {
      // Ungrouped expense — pass through unchanged (regression safety).
      return first
    }

    const totalAmount = members.reduce(
      (sum, m) => sum.plus(toDecimal(m.totalAmount)),
      toDecimal('0'),
    )
    const transactionCount = members.reduce((sum, m) => sum + m.transactionCount, 0)
    const firstTransactionAt = members.reduce<Date | null>((min, m) => {
      if (!m.firstTransactionAt) return min
      return !min || m.firstTransactionAt < min ? m.firstTransactionAt : min
    }, null)
    const lastTransactionAt = members.reduce<Date | null>((max, m) => {
      if (!m.lastTransactionAt) return max
      return !max || m.lastTransactionAt > max ? m.lastTransactionAt : max
    }, null)

    return {
      id: `group:${first.groupId}`,
      title: first.groupTitle ?? '',
      status: '3',
      notes: null,
      createdAt: first.createdAt,
      totalAmount: toDbDecimal(totalAmount),
      transactionCount,
      // A group's members all share one non-null subcategory (merge gate, D-02) — the shared
      // member-resolved category display fields are therefore identical to what a dedicated
      // expenseGroup.subCategoryId join chain would resolve, without a second joined chain.
      subCategoryId: first.subCategoryId,
      subCategoryName: first.subCategoryName,
      categoryName: first.categoryName,
      categorySlug: first.categorySlug,
      categoryType: first.categoryType,
      // A group's members may span multiple platforms — composing that display is out of
      // scope for GRP-03; left null rather than guessed.
      platformName: null,
      firstTransactionAt,
      lastTransactionAt,
      groupId: first.groupId,
      groupTitle: first.groupTitle,
    }
  })

  if (filters.amountMin !== undefined) {
    const min = toDecimal(filters.amountMin)
    composed = composed.filter((row) => toDecimal(row.totalAmount).abs().gte(min))
  }
  if (filters.amountMax !== undefined) {
    const max = toDecimal(filters.amountMax)
    composed = composed.filter((row) => toDecimal(row.totalAmount).abs().lte(max))
  }

  composed.sort(buildComposedExpenseComparator(filters))

  return composed.slice(pagination.offset, pagination.offset + pagination.limit)
}

function compare(a: string | number, b: string | number): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

/** Mirrors expenseCategoryIncompleteBucket's "—" bucket, over a composed ExpenseRow. */
function composedCategoryIncompleteBucket(row: ExpenseRow): number {
  if (!row.categoryName) return 1
  if (!row.subCategoryName || row.subCategoryName.trim() === '') return 1
  return 0
}

/** Mirrors expenseCategorySortKey's "Categoria · Sottocategoria" string, lowercased. */
function composedCategorySortKey(row: ExpenseRow): string {
  return `${row.categoryName ?? ''} · ${row.subCategoryName ?? ''}`.toLowerCase()
}

/**
 * JS re-implementation of buildExpenseOrderBy's four sort options plus the row's own `id` as
 * tiebreaker (mirroring the existing SQL order-by semantics), operating on the composed
 * `ExpenseRow[]` after group collapsing.
 */
function buildComposedExpenseComparator(
  filters: Pick<ExpenseFilters, 'sort' | 'dir'>,
): (a: ExpenseRow, b: ExpenseRow) => number {
  const sort = filters.sort ?? 'createdAt'
  const dir = filters.dir ?? 'desc'
  const sign = dir === 'asc' ? 1 : -1

  return (a, b) => {
    if (sort === 'category') {
      // Incomplete category rows ("—") stay last in both ASC and DESC via bucket 0/1.
      const bucketDiff = composedCategoryIncompleteBucket(a) - composedCategoryIncompleteBucket(b)
      if (bucketDiff !== 0) return bucketDiff
      const keyCmp = compare(composedCategorySortKey(a), composedCategorySortKey(b)) * sign
      if (keyCmp !== 0) return keyCmp
      return compare(a.id, b.id) * sign
    }

    let primary = 0
    switch (sort) {
      case 'title':
        primary = compare(a.title.toLowerCase(), b.title.toLowerCase())
        break
      case 'totalAmount':
        primary = toDecimal(a.totalAmount).abs().comparedTo(toDecimal(b.totalAmount).abs())
        break
      case 'createdAt':
      default:
        primary = compare(a.createdAt.getTime(), b.createdAt.getTime())
        break
    }
    if (primary !== 0) return primary * sign
    return compare(a.id, b.id) * sign
  }
}

export const getExpenses = cache(async (
  filters: ExpenseFilters = {},
  pagination: ExpensePagination = {},
): Promise<ExpenseRow[]> => {
  const { userId } = await verifySession()
  const limit = pagination.limit ?? EXPENSE_LIST_LIMIT
  const offset = pagination.offset ?? 0

  // Build conditions array — all expense queries are always scoped to userId.
  // D-05: no implicit period — default view is all-time, no date clamp.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [
    eq(expense.userId, userId),
  ]

  // Period date range only when explicitly requested (D-05)
  if (filters.period) {
    const { from, to } = periodToDateRange(filters.period)
    conditions.push(gte(expense.createdAt, from), lte(expense.createdAt, to))
  }

  // O-01: status 4 → uncategorized bucket (conservative mapping)
  if (filters.status === 'uncategorized') {
    conditions.push(inArray(expense.status, ['1', '4']))
  }
  if (filters.status === 'categorized') {
    conditions.push(inArray(expense.status, ['2', '3']))
  }
  if (filters.categorySlug) {
    conditions.push(eq(category.slug, filters.categorySlug))
  }
  const searchTerm = filters.q ?? filters.name
  if (searchTerm) {
    const pattern = `%${escapeLikePattern(searchTerm)}%`
    // Search matches either the member's own bank-derived title OR the group's display title
    // (GRP-03) — a grouped member's own title stays searchable after the group gets a name.
    conditions.push(or(ilike(expense.title, pattern), ilike(expenseGroup.title, pattern)))
  }

  // Wave 4: platform filter — via importedFromFileId → file → importFormatVersion → platform
  if (filters.platform) {
    conditions.push(eq(platform.slug, filters.platform))
  }

  // Nature filter — cascade child via subCategory.natureId → nature.code join
  if (filters.nature === 'unclassified') {
    // Unclassified: no subCategory linked, or subCategory has null natureId
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

  if (filters.subCategoryId) {
    conditions.push(eq(subCategory.id, filters.subCategoryId))
  }

  // NOTE: no SQL .limit()/.offset() here (and amountMin/amountMax are NOT applied as SQL
  // conditions) — the full filtered+joined per-expense row set is fetched, then
  // composeExpenseRows() collapses group members into composed rows, applies the amount-range
  // filter to the FINAL composed totals, sorts, and paginates entirely in JS (Task 1, GRP-03:
  // pagination must happen AFTER grouping, never before).
  const rawRows = await db
    .select({
      id: expense.id,
      title: expense.title,
      status: expense.status,
      notes: expense.notes,
      createdAt: expense.createdAt,
      totalAmount: expense.totalAmount,
      transactionCount: expense.transactionCount,
      subCategoryId: expense.subCategoryId,
      subCategoryName: sql<string | null>`coalesce(${userSubcategoryOverride.customName}, ${subCategory.name})`,
      categoryName: category.name,
      categorySlug: category.slug,
      categoryType: sql<'in' | 'out' | 'allocation' | 'system' | 'transfer' | null>`${direction.code}`,
      platformName: platform.name,
      firstTransactionAt: expense.firstTransactionAt,
      lastTransactionAt: expense.lastTransactionAt,
      groupId: expenseGroupMembership.groupId,
      groupTitle: expenseGroup.title,
    })
    .from(expense)
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
    // Platform join chain — only materializes a platform row when expense was imported from a file
    .leftJoin(file, eq(expense.importedFromFileId, file.id))
    .leftJoin(importFormatVersion, eq(file.importFormatVersionId, importFormatVersion.id))
    .leftJoin(platform, eq(importFormatVersion.platformId, platform.id))
    // Group-composition join chain (Task 1, GRP-03): only materializes when the expense is a
    // member of an Expense Group.
    .leftJoin(expenseGroupMembership, eq(expense.id, expenseGroupMembership.expenseId))
    .leftJoin(expenseGroup, eq(expenseGroupMembership.groupId, expenseGroup.id))
    .where(and(...conditions))

  return composeExpenseRows(rawRows, filters, { limit, offset })
})

export const getExpenseById = cache(async (id: string): Promise<ExpenseRow | undefined> => {
  const { userId } = await verifySession()
  const rows = await db
    .select({
      id: expense.id,
      title: expense.title,
      status: expense.status,
      notes: expense.notes,
      createdAt: expense.createdAt,
      totalAmount: expense.totalAmount,
      transactionCount: expense.transactionCount,
      subCategoryId: expense.subCategoryId,
      subCategoryName: sql<string | null>`coalesce(${userSubcategoryOverride.customName}, ${subCategory.name})`,
      categoryName: category.name,
      categorySlug: category.slug,
      categoryType: sql<'in' | 'out' | 'allocation' | 'system' | 'transfer' | null>`${direction.code}`,
      platformName: platform.name,
      firstTransactionAt: expense.firstTransactionAt,
      lastTransactionAt: expense.lastTransactionAt,
      groupId: expenseGroupMembership.groupId,
      groupTitle: expenseGroup.title,
    })
    .from(expense)
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
    // Platform join chain for getExpenseById — mirrors getExpenses join order
    .leftJoin(file, eq(expense.importedFromFileId, file.id))
    .leftJoin(importFormatVersion, eq(file.importFormatVersionId, importFormatVersion.id))
    .leftJoin(platform, eq(importFormatVersion.platformId, platform.id))
    .leftJoin(expenseGroupMembership, eq(expense.id, expenseGroupMembership.expenseId))
    .leftJoin(expenseGroup, eq(expenseGroupMembership.groupId, expenseGroup.id))
    .where(and(eq(expense.id, id), eq(expense.userId, userId)))
    .limit(1)
  return rows[0]
})

export const getExpenseImportContext = cache(async (expenseId: string): Promise<ExpenseImportContext> => {
  const { userId } = await verifySession()

  const rows = await db
    .select({
      fileId: file.id,
      displayName: file.displayName,
      originalName: file.originalName,
      platformName: platform.name,
    })
    .from(expense)
    .leftJoin(file, eq(expense.importedFromFileId, file.id))
    .leftJoin(importFormatVersion, eq(file.importFormatVersionId, importFormatVersion.id))
    .leftJoin(platform, eq(importFormatVersion.platformId, platform.id))
    .where(and(eq(expense.id, expenseId), eq(expense.userId, userId)))
    .limit(1)

  const row = rows[0]
  if (!row) {
    return { sourceFile: null, platformName: null }
  }

  return {
    sourceFile: row.fileId
      ? {
          id: row.fileId,
          name: row.displayName?.trim() || row.originalName || '',
        }
      : null,
    platformName: row.platformName,
  }
})

export type ExpenseDetailRow = ExpenseRow & {
  sourceFile: ExpenseSourceFile | null
  transactions: ExpenseTransactionRow[]
}

/**
 * Ownership-scoped detail query for `/expenses/[id]` (DET-06). Accepts `userId`
 * as an argument instead of calling `verifySession()` internally — the RSC
 * page already verifies the session once. Folds `getExpenseImportContext`'s
 * sourceFile resolution into the same row query to avoid a second round-trip,
 * then loads linked transactions scoped to both `expenseId` and `userId`
 * (T-63-02), matching `getTransactionsByExpenseId`'s double-userId guard.
 * Returns `undefined` — never throws — for a missing or non-owned id (T-63-01).
 */
export const getExpenseForDetail = cache(
  async ({
    userId,
    id,
  }: {
    userId: string
    id: string
  }): Promise<ExpenseDetailRow | undefined> => {
    const rows = await db
      .select({
        id: expense.id,
        title: expense.title,
        status: expense.status,
        notes: expense.notes,
        createdAt: expense.createdAt,
        totalAmount: expense.totalAmount,
        transactionCount: expense.transactionCount,
        subCategoryId: expense.subCategoryId,
        subCategoryName: sql<string | null>`coalesce(${userSubcategoryOverride.customName}, ${subCategory.name})`,
        categoryName: category.name,
        categorySlug: category.slug,
        categoryType: sql<'in' | 'out' | 'allocation' | 'system' | 'transfer' | null>`${direction.code}`,
        platformName: platform.name,
        fileId: file.id,
        displayName: file.displayName,
        originalName: file.originalName,
        firstTransactionAt: expense.firstTransactionAt,
        lastTransactionAt: expense.lastTransactionAt,
        groupId: expenseGroupMembership.groupId,
        groupTitle: expenseGroup.title,
      })
      .from(expense)
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
      .leftJoin(file, eq(expense.importedFromFileId, file.id))
      .leftJoin(importFormatVersion, eq(file.importFormatVersionId, importFormatVersion.id))
      .leftJoin(platform, eq(importFormatVersion.platformId, platform.id))
      // Group precedence join chain (Task 1, GRP-04/GRP-08): resolves this expense's own
      // groupId/groupTitle for "Parte di: {groupTitle}" — no composition, always one row.
      .leftJoin(expenseGroupMembership, eq(expense.id, expenseGroupMembership.expenseId))
      .leftJoin(expenseGroup, eq(expenseGroupMembership.groupId, expenseGroup.id))
      .where(and(eq(expense.id, id), eq(expense.userId, userId)))
      .limit(1)

    const row = rows[0]
    if (!row) return undefined

    const transactions = await db
      .select({
        id: transaction.id,
        description: transaction.description,
        customTitle: transaction.customTitle,
        amount: transaction.amount,
        currency: transaction.currency,
        occurredAt: transaction.occurredAt,
      })
      .from(transaction)
      .where(and(eq(transaction.expenseId, id), eq(transaction.userId, userId)))
      .orderBy(desc(transaction.occurredAt))

    return {
      id: row.id,
      title: row.title,
      status: row.status,
      notes: row.notes,
      createdAt: row.createdAt,
      totalAmount: row.totalAmount,
      transactionCount: row.transactionCount,
      subCategoryId: row.subCategoryId,
      subCategoryName: row.subCategoryName,
      categoryName: row.categoryName,
      categorySlug: row.categorySlug,
      categoryType: row.categoryType,
      platformName: row.platformName,
      firstTransactionAt: row.firstTransactionAt,
      lastTransactionAt: row.lastTransactionAt,
      groupId: row.groupId,
      groupTitle: row.groupTitle,
      sourceFile: row.fileId
        ? {
            id: row.fileId,
            name: row.displayName?.trim() || row.originalName || '',
          }
        : null,
      transactions,
    }
  },
)

export async function insertExpense(data: {
  userId: string
  title: string
  subCategoryId?: number
  notes?: string
}): Promise<void> {
  await db.insert(expense).values({
    id: crypto.randomUUID(),
    userId: data.userId,
    title: data.title,
    subCategoryId: data.subCategoryId ?? null,
    status: data.subCategoryId ? '3' : '1',
    notes: data.notes ?? null,
  })
}

export async function updateExpense(data: {
  id: string
  userId: string
  title: string
  /**
   * Three-state contract (DET-04): `undefined` = field not present in this
   * edit, leave subCategoryId/status untouched; `null` = explicit clear
   * (status -> '1', no history write); positive number = assign category
   * (status -> '3', classification-history row written with source 'manual').
   */
  subCategoryId?: number | null
  notes?: string
}): Promise<void> {
  await db.transaction(async (tx) => {
    const before = await tx
      .select({ subCategoryId: expense.subCategoryId, status: expense.status })
      .from(expense)
      .where(and(eq(expense.id, data.id), eq(expense.userId, data.userId)))
      .limit(1)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateSet: Record<string, any> = {
      title: data.title,
      notes: data.notes ?? null,
      updatedAt: new Date(),
    }

    if (data.subCategoryId === undefined) {
      // Omitted — leave subCategoryId/status untouched (title/notes-only edit).
    } else if (data.subCategoryId === null) {
      updateSet.subCategoryId = null
      updateSet.status = '1'
    } else {
      updateSet.subCategoryId = data.subCategoryId
      updateSet.status = '3'
    }

    await tx
      .update(expense)
      .set(updateSet)
      .where(and(eq(expense.id, data.id), eq(expense.userId, data.userId)))

    if (typeof data.subCategoryId === 'number') {
      try {
        await writeClassificationHistory(tx, {
          userId: data.userId,
          expenseId: data.id,
          fromSubCategoryId: before[0]?.subCategoryId ?? null,
          toSubCategoryId: data.subCategoryId,
          fromStatus: before[0]?.status ?? null,
          toStatus: '3',
          source: 'manual',
        })
      } catch {
        // history write failure is non-fatal
      }
    }
  })
}

export async function updateExpenseTitle(data: {
  id: string
  userId: string
  title: string
}): Promise<void> {
  await db
    .update(expense)
    .set({
      title: data.title,
      updatedAt: new Date(),
    })
    .where(and(eq(expense.id, data.id), eq(expense.userId, data.userId)))
}

export async function deleteExpense(id: string, userId: string): Promise<void> {
  await db
    .delete(expense)
    .where(and(eq(expense.id, id), eq(expense.userId, userId)))
}

export async function deleteExpenses(ids: string[], userId: string): Promise<void> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return

  await db
    .delete(expense)
    .where(and(eq(expense.userId, userId), inArray(expense.id, unique)))
}
