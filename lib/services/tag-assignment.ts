import { bulkDeleteTransactionTags, bulkInsertTransactionTags } from '@/lib/dal/transaction-tags'
import { getTag } from '@/lib/dal/tags'
import { db, type DbOrTx } from '@/lib/db'
import { transaction } from '@/lib/db/schema'
import { and, eq, inArray } from 'drizzle-orm'

export class TagAssignmentError extends Error {
  constructor(
    public readonly code: 'forbidden',
    message: string,
  ) {
    super(message)
    this.name = 'TagAssignmentError'
  }
}

// IDOR: re-queries the transaction table directly rather than trusting the client-supplied
// id list — a request mixing in even one id owned by another user rejects entirely (T-67-09).
async function assertOwnsAllTransactions(
  userId: string,
  transactionIds: string[],
  database: DbOrTx = db,
): Promise<void> {
  const rows = await database
    .select({ id: transaction.id })
    .from(transaction)
    .where(and(eq(transaction.userId, userId), inArray(transaction.id, transactionIds)))

  if (rows.length !== transactionIds.length) {
    throw new TagAssignmentError('forbidden', 'Una o più transazioni selezionate non sono valide.')
  }
}

// IDOR: re-verifies every tagId belongs to userId via getTag (Plan 67-03) — a forged tagId
// causes the whole call to reject before any write (T-67-09).
async function assertOwnsAllTags(userId: string, tagIds: number[]): Promise<void> {
  const results = await Promise.all(tagIds.map((id) => getTag(userId, id)))

  if (results.some((result) => result === null)) {
    throw new TagAssignmentError('forbidden', 'Uno o più tag selezionati non sono validi.')
  }
}

// D-06: additive union — the chosen tags are added to whatever the selected transactions
// already carry. This function is purely insert-only; no removal path is reachable from here.
export async function bulkAssignTags(input: {
  userId: string
  transactionIds: string[]
  tagIds: number[]
}): Promise<void> {
  await assertOwnsAllTransactions(input.userId, input.transactionIds)
  await assertOwnsAllTags(input.userId, input.tagIds)

  const rows = input.tagIds.flatMap((tagId) =>
    input.transactionIds.map((transactionId) => ({ tagId, transactionId })),
  )

  await bulkInsertTransactionTags(rows)
}

// D-07: symmetric removal — removes exactly the requested (tagId, transactionId) pairs.
export async function bulkRemoveTags(input: {
  userId: string
  transactionIds: string[]
  tagIds: number[]
}): Promise<void> {
  await assertOwnsAllTransactions(input.userId, input.transactionIds)
  await assertOwnsAllTags(input.userId, input.tagIds)

  await bulkDeleteTransactionTags(input.tagIds, input.transactionIds)
}

// D-07b: single-transaction wrappers — thin one-element-array delegates, no duplicated logic.
export async function addSingleTransactionTag(input: {
  userId: string
  transactionId: string
  tagId: number
}): Promise<void> {
  return bulkAssignTags({
    userId: input.userId,
    transactionIds: [input.transactionId],
    tagIds: [input.tagId],
  })
}

export async function removeSingleTransactionTag(input: {
  userId: string
  transactionId: string
  tagId: number
}): Promise<void> {
  return bulkRemoveTags({
    userId: input.userId,
    transactionIds: [input.transactionId],
    tagIds: [input.tagId],
  })
}
