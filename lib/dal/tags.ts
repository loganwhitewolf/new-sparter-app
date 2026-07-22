import 'server-only'
import { cache } from 'react'
import { db, type DbOrTx } from '@/lib/db'
import {
  category,
  direction,
  expense,
  nature,
  subCategory,
  tag,
  transaction as transactionTable,
  transactionTag,
  userSubcategoryOverride,
} from '@/lib/db/schema'
import { and, asc, eq, inArray, isNotNull, ne, sql } from 'drizzle-orm'
import { effectiveAmount, isNotSecondary } from '@/lib/dal/transaction-pairs-sql'
import { DASHBOARD_TOTAL_EXPENSE_STATUSES } from '@/lib/dal/dashboard'
import { toDecimal } from '@/lib/utils/decimal'

// Name it `TagRow`, NOT `Tag` — `Tag` as a bare name would collide with the
// `Tag` icon already imported from `lucide-react` in transaction-table.tsx /
// transaction-detail-client.tsx, both consumed by later plans in this phase.
export type TagRow = typeof tag.$inferSelect

const getTagsForUser = cache(async (userId: string): Promise<TagRow[]> => {
  return db
    .select()
    .from(tag)
    .where(eq(tag.userId, userId))
    .orderBy(asc(tag.createdAt), asc(tag.id))
})

// Accepts `userId` explicitly rather than calling `verifySession()` itself — callers in this
// phase already have `userId` from their own session check, avoiding a second round trip.
export async function getTags(userId: string): Promise<TagRow[]> {
  return getTagsForUser(userId)
}

export async function getTag(
  userId: string,
  tagId: number,
  database: DbOrTx = db,
): Promise<TagRow | null> {
  const rows = await database
    .select()
    .from(tag)
    .where(and(eq(tag.id, tagId), eq(tag.userId, userId)))
    .limit(1)

  return rows[0] ?? null
}

export async function getActiveTagsWithDateRange(userId: string): Promise<TagRow[]> {
  return db
    .select()
    .from(tag)
    .where(
      and(
        eq(tag.userId, userId),
        eq(tag.archived, false),
        isNotNull(tag.dateRangeStart),
        isNotNull(tag.dateRangeEnd),
      ),
    )
    .orderBy(asc(tag.createdAt), asc(tag.id))
}

export async function getTagByNormalizedName(
  userId: string,
  normalizedName: string,
  database: DbOrTx = db,
): Promise<TagRow | null> {
  const rows = await database
    .select()
    .from(tag)
    .where(and(eq(tag.userId, userId), eq(tag.normalizedName, normalizedName)))

  return rows[0] ?? null
}

// The DAL performs no normalization itself — the caller-supplied `normalizedName` is written
// verbatim; normalization is the service layer's responsibility (single-responsibility).
export async function insertTagRow(
  input: {
    userId: string
    name: string
    normalizedName: string
    dateRangeStart: Date | null
    dateRangeEnd: Date | null
  },
  database: DbOrTx = db,
): Promise<TagRow> {
  const rows = await database
    .insert(tag)
    .values({ ...input, archived: false })
    .returning()

  return rows[0]
}

export async function updateTagRow(
  userId: string,
  tagId: number,
  input: {
    name?: string
    normalizedName?: string
    dateRangeStart?: Date | null
    dateRangeEnd?: Date | null
  },
  database: DbOrTx = db,
): Promise<TagRow | null> {
  const rows = await database
    .update(tag)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(tag.id, tagId), eq(tag.userId, userId)))
    .returning()

  return rows[0] ?? null
}

/**
 * IDOR defense-in-depth for the dashboard `?tag=` filter (68-01, T-68-01).
 *
 * Ownership is already enforced structurally: tagScopedTransactions() only
 * narrows rows already scoped by eq(transaction.userId, userId) in the same
 * query's WHERE clause, so a foreign tagId matches zero rows — no leak is
 * possible even without this check. This helper is the belt-and-suspenders
 * addition every RSC page reading `?tag=` in Wave 3/4 of this phase MUST call
 * before forwarding a user-supplied tagId to any DAL function.
 *
 * Fail-closed by design: a tagId that does not belong to the authenticated
 * user (or does not exist) is silently ignored (resolves to undefined),
 * never thrown as an error.
 */
export async function resolveOwnedTagId(
  userId: string,
  candidateTagId?: number,
): Promise<number | undefined> {
  if (candidateTagId === undefined) return undefined

  const owned = await getTag(userId, candidateTagId)
  return owned ? candidateTagId : undefined
}

// The ONLY write to `archived` in this file; there is no `db.delete(tag)` call anywhere (D-04).
export async function archiveTagRow(
  userId: string,
  tagId: number,
  database: DbOrTx = db,
): Promise<TagRow | null> {
  const rows = await database
    .update(tag)
    .set({ archived: true, updatedAt: new Date() })
    .where(and(eq(tag.id, tagId), eq(tag.userId, userId)))
    .returning()

  return rows[0] ?? null
}

/**
 * TAG-05 per-tag aggregate (dashboard Tag section, Plan 68-08).
 *
 * All-time, sign-colored total — NOT period-scoped by the dashboard's month/year
 * selector (LOCKED DECISION 1). Applies the SAME exclusions as every other
 * dashboard total (LOCKED DECISION 2): expenseStatusIncludedInDashboardTotals(),
 * exclude `transfer` direction, effectiveAmount()/isNotSecondary() pair-netting.
 * The number MUST match what the user sees filtering transactions by that tag.
 */
export type TagTotalItem = {
  tagId: number
  name: string
  archived: boolean
  count: number
  minDate: string | null
  maxDate: string | null
  total: string // signed — sign-colored per the UI-SPEC, a tag can net positive or negative
}

type TagTotalAggregateRow = {
  tagId: number
  name: string
  archived: boolean
  count: number | string | null
  minDate: string | null
  maxDate: string | null
  total: string | null
}

// Pure, unit-testable without a DB — mirrors buildCategoryRankingData's query-vs-shaping
// split. Sorts by absolute total descending (UI-SPEC default sort).
export function buildTagTotalsData(rows: TagTotalAggregateRow[]): TagTotalItem[] {
  return rows
    .map((row) => ({
      tagId: row.tagId,
      name: row.name,
      archived: row.archived,
      count: Number(row.count ?? 0),
      minDate: row.minDate ?? null,
      maxDate: row.maxDate ?? null,
      total: toDecimal(row.total ?? '0').toFixed(2),
    }))
    .sort((a, b) => toDecimal(b.total).abs().comparedTo(toDecimal(a.total).abs()))
}

export async function getTagTotals(userId: string): Promise<TagTotalItem[]> {
  // Shared FILTER predicate — applies the exact same exclusion set as
  // getOverviewAmountTotals (the dashboard total reference point). Composed once
  // and reused inside every aggregate expression (count/minDate/maxDate/total)
  // via a SQL FILTER clause, NEVER in the outer WHERE — a tag whose only
  // transactions are excluded (or a tag with zero transactions at all) must
  // still surface a row via the LEFT JOIN, not be silently dropped.
  const tagTotalExclusion = sql`(
    ${inArray(expense.status, [...DASHBOARD_TOTAL_EXPENSE_STATUSES])}
    AND ${ne(direction.code, 'transfer')}
    AND ${isNotSecondary()}
  )`

  const rows = await db
    .select({
      tagId: tag.id,
      name: tag.name,
      archived: tag.archived,
      count: sql<string>`count(distinct ${transactionTable.id}) FILTER (WHERE ${tagTotalExclusion})`,
      minDate: sql<string | null>`(MIN(${transactionTable.occurredAt}) FILTER (WHERE ${tagTotalExclusion}))::text`,
      maxDate: sql<string | null>`(MAX(${transactionTable.occurredAt}) FILTER (WHERE ${tagTotalExclusion}))::text`,
      total: sql<string>`coalesce(sum(${effectiveAmount()}) FILTER (WHERE ${tagTotalExclusion}), 0)::text`,
    })
    // FROM tag, never FROM transaction — the join direction is inverted vs every
    // other dashboard aggregate in this codebase (see 68-RESEARCH.md Anti-Pattern).
    .from(tag)
    .leftJoin(transactionTag, eq(transactionTag.tagId, tag.id))
    .leftJoin(transactionTable, eq(transactionTag.transactionId, transactionTable.id))
    .leftJoin(expense, eq(transactionTable.expenseId, expense.id))
    .leftJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
    .leftJoin(category, eq(subCategory.categoryId, category.id))
    .leftJoin(
      userSubcategoryOverride,
      and(
        eq(userSubcategoryOverride.subCategoryId, subCategory.id),
        eq(userSubcategoryOverride.userId, userId),
      ),
    )
    .leftJoin(
      nature,
      eq(nature.id, sql`COALESCE(${userSubcategoryOverride.natureId}, ${subCategory.natureId})`),
    )
    .leftJoin(direction, eq(nature.directionId, direction.id))
    .where(eq(tag.userId, userId))
    .groupBy(tag.id, tag.name, tag.archived)

  return buildTagTotalsData(rows)
}
