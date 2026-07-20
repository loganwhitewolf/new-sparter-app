import 'server-only'
import { db, type DbOrTx } from '@/lib/db'
import { tag, transaction, transactionTag } from '@/lib/db/schema'
import { and, eq, inArray } from 'drizzle-orm'

export type TransactionTagChip = {
  transactionId: string
  tagId: number
  tagName: string
  archived: boolean
}

// D-06: race-safe additive insert — onConflictDoNothing on the (tagId, transactionId) composite
// unique (Plan 67-01) means calling this twice with identical pairs is a safe no-op the second
// time, no thrown error, no duplicate rows.
export async function bulkInsertTransactionTags(
  rows: { tagId: number; transactionId: string }[],
  database: DbOrTx = db,
): Promise<void> {
  if (rows.length === 0) return

  await database
    .insert(transactionTag)
    .values(rows)
    .onConflictDoNothing({ target: [transactionTag.tagId, transactionTag.transactionId] })
}

// D-07: symmetric removal — deletes only rows matching BOTH arrays; a pair not present in both
// is left untouched.
export async function bulkDeleteTransactionTags(
  tagIds: number[],
  transactionIds: string[],
  database: DbOrTx = db,
): Promise<void> {
  if (tagIds.length === 0 || transactionIds.length === 0) return

  await database
    .delete(transactionTag)
    .where(and(inArray(transactionTag.tagId, tagIds), inArray(transactionTag.transactionId, transactionIds)))
}

// Per-row chip map for the transactions table — empty input short-circuits before querying to
// avoid an `IN ()` SQL error.
export async function getTagsForTransactionIds(transactionIds: string[]): Promise<TransactionTagChip[]> {
  if (transactionIds.length === 0) return []

  return db
    .select({
      transactionId: transactionTag.transactionId,
      tagId: tag.id,
      tagName: tag.name,
      archived: tag.archived,
    })
    .from(transactionTag)
    .innerJoin(tag, eq(transactionTag.tagId, tag.id))
    .where(inArray(transactionTag.transactionId, transactionIds))
}

// IDOR: the transaction.userId join clause verifies ownership — a transactionId belonging to
// another user returns [] rather than another user's tags.
export async function getTransactionTagsForTransaction(
  userId: string,
  transactionId: string,
): Promise<TransactionTagChip[]> {
  return db
    .select({
      transactionId: transactionTag.transactionId,
      tagId: tag.id,
      tagName: tag.name,
      archived: tag.archived,
    })
    .from(transactionTag)
    .innerJoin(tag, eq(transactionTag.tagId, tag.id))
    .innerJoin(transaction, eq(transactionTag.transactionId, transaction.id))
    .where(and(eq(transaction.userId, userId), eq(transactionTag.transactionId, transactionId)))
}

// D-10 dedup source: the subset of transactionIds that already carry tagId — empty input
// short-circuits to an empty Set without querying.
export async function getAlreadyTaggedTransactionIds(
  tagId: number,
  transactionIds: string[],
): Promise<Set<string>> {
  if (transactionIds.length === 0) return new Set()

  const rows = await db
    .select({ transactionId: transactionTag.transactionId })
    .from(transactionTag)
    .where(and(eq(transactionTag.tagId, tagId), inArray(transactionTag.transactionId, transactionIds)))

  return new Set(rows.map((row) => row.transactionId))
}
