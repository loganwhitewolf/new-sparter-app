import 'server-only'

import { and, count, eq, inArray } from 'drizzle-orm'
import type { DbOrTx } from '@/lib/db'
import { expense, expenseGroup, expenseGroupMembership } from '@/lib/db/schema'

/**
 * Extract the Postgres SQLSTATE error code from a Drizzle/pg error's `cause`.
 * Mirrors lib/services/transaction-pairs.ts's errorCauseCode helper — used to
 * translate a 23505 unique-violation into a localized Error message.
 */
function errorCauseCode(error: unknown): string {
  const cause =
    typeof error === 'object' && error !== null && 'cause' in error
      ? (error as { cause?: unknown }).cause
      : undefined

  if (typeof cause !== 'object' || cause === null || !('code' in cause)) {
    return ''
  }

  const code = (cause as { code?: unknown }).code
  return typeof code === 'string' ? code : ''
}

export type CreateExpenseGroupInput = {
  userId: string
  selectedExpenseIds: string[]
  groupTitle: string
  subCategoryId: number
}

export type CreateExpenseGroupResult = { groupId: number }

/**
 * Create an Expense Group from a set of owned, ungrouped expenses (ADR 0017 D-01).
 *
 * Structural guarantee (D-02): this function only ever inserts an `expenseGroup`
 * row and `expenseGroupMembership` rows — it never writes `expense.subCategoryId`
 * or `expense.status`. The merge is pure regrouping.
 *
 * Standalone Expenses (ADR 0016) are not special-cased (D-05): the ownership and
 * eligibility checks below apply identically regardless of a synthetic
 * `descriptionHash`.
 *
 * Caller owns the transaction boundary — `dbOrTx` may be `db` or a `tx` handle,
 * so this never calls `dbOrTx.transaction(...)` itself (matches
 * lib/services/expense-deletion.ts's DbOrTx convention).
 */
export async function createExpenseGroup(
  dbOrTx: DbOrTx,
  input: CreateExpenseGroupInput,
): Promise<CreateExpenseGroupResult> {
  const { userId, selectedExpenseIds, groupTitle, subCategoryId } = input

  // 1. Ownership check (IDOR guard) — every selected id must belong to userId.
  //    Checked BEFORE any insert.
  const ownedRows = await dbOrTx
    .select({ id: expense.id })
    .from(expense)
    .where(and(eq(expense.userId, userId), inArray(expense.id, selectedExpenseIds)))

  if (ownedRows.length < selectedExpenseIds.length) {
    throw new Error('Spesa non trovata o non tua.')
  }

  // 2. Already-grouped pre-check — one-group-per-expense invariant (D-04 schema
  //    consequence). Covers the common case; the insert below covers the race.
  const alreadyGrouped = await dbOrTx
    .select({ expenseId: expenseGroupMembership.expenseId })
    .from(expenseGroupMembership)
    .where(inArray(expenseGroupMembership.expenseId, selectedExpenseIds))

  if (alreadyGrouped.length > 0) {
    throw new Error('Una spesa selezionata fa già parte di un gruppo.')
  }

  // 3. Insert the group row.
  const [insertedGroup] = await dbOrTx
    .insert(expenseGroup)
    .values({ userId, title: groupTitle, subCategoryId })
    .returning({ id: expenseGroup.id })

  const groupId = insertedGroup.id

  // 4. Insert membership rows. A 23505 here means another request grouped one of
  //    these expenses between step 2's pre-check and this insert (the race the
  //    pre-check alone cannot close) — translate it to the same Italian message.
  try {
    await dbOrTx
      .insert(expenseGroupMembership)
      .values(selectedExpenseIds.map((expenseId) => ({ groupId, expenseId })))
  } catch (e) {
    if (errorCauseCode(e) === '23505') {
      throw new Error('Una spesa selezionata fa già parte di un gruppo.')
    }
    throw e
  }

  return { groupId }
}

export type RenameExpenseGroupInput = {
  userId: string
  groupId: number
  title: string
}

/**
 * Rename an owned Expense Group. Scoped UPDATE — zero affected rows means the
 * group doesn't exist or isn't owned by userId, treated as a thrown error
 * (never a silent no-op that could mask a cross-user rename attempt).
 */
export async function renameExpenseGroup(
  dbOrTx: DbOrTx,
  input: RenameExpenseGroupInput,
): Promise<true> {
  const [updated] = await dbOrTx
    .update(expenseGroup)
    .set({ title: input.title, updatedAt: new Date() })
    .where(and(eq(expenseGroup.id, input.groupId), eq(expenseGroup.userId, input.userId)))
    .returning({ id: expenseGroup.id })

  if (!updated) {
    throw new Error('Gruppo non trovato.')
  }

  return true
}

export type AddExpensesToGroupInput = {
  userId: string
  groupId: number
  expenseIds: string[]
}

/**
 * Add owned, ungrouped expenses to an existing owned Expense Group (GRP-06,
 * ADR 0017 D-04/D-05/D-06).
 *
 * Structural guarantee: only ever inserts `expenseGroupMembership` rows — never
 * writes `expense.subCategoryId`/`expense.status` and never inserts a new
 * `expenseGroup` row (the group already exists). Shared-subcategory validation
 * (D-05) is deliberately NOT this function's job — it belongs to the caller
 * action, which already has the group's subCategoryId in scope.
 *
 * Caller owns the transaction boundary — never calls `dbOrTx.transaction(...)`
 * itself (matches createExpenseGroup/renameExpenseGroup convention).
 */
export async function addExpensesToGroup(
  dbOrTx: DbOrTx,
  input: AddExpensesToGroupInput,
): Promise<void> {
  const { userId, groupId, expenseIds } = input

  // 1. Group ownership check.
  const [ownedGroup] = await dbOrTx
    .select({ id: expenseGroup.id })
    .from(expenseGroup)
    .where(and(eq(expenseGroup.id, groupId), eq(expenseGroup.userId, userId)))

  if (!ownedGroup) {
    throw new Error('Gruppo non trovato.')
  }

  // 2. Ownership check (IDOR guard) — every id must belong to userId.
  const ownedRows = await dbOrTx
    .select({ id: expense.id })
    .from(expense)
    .where(and(eq(expense.userId, userId), inArray(expense.id, expenseIds)))

  if (ownedRows.length < expenseIds.length) {
    throw new Error('Spesa non trovata o non tua.')
  }

  // 3. Already-grouped pre-check — covers the common case; the insert below
  //    covers the race.
  const alreadyGrouped = await dbOrTx
    .select({ expenseId: expenseGroupMembership.expenseId })
    .from(expenseGroupMembership)
    .where(inArray(expenseGroupMembership.expenseId, expenseIds))

  if (alreadyGrouped.length > 0) {
    throw new Error('Una spesa selezionata fa già parte di un gruppo.')
  }

  // 4. Insert membership rows. A 23505 here means another request grouped one
  //    of these expenses between step 3's pre-check and this insert.
  try {
    await dbOrTx
      .insert(expenseGroupMembership)
      .values(expenseIds.map((expenseId) => ({ groupId, expenseId })))
  } catch (e) {
    if (errorCauseCode(e) === '23505') {
      throw new Error('Una spesa selezionata fa già parte di un gruppo.')
    }
    throw e
  }
}

export type RemoveExpenseFromGroupInput = {
  userId: string
  groupId: number
  expenseId: string
}

/**
 * Remove a single member from an owned Expense Group (GRP-07, ADR 0017
 * D-07/D-08). Auto-dissolves the group (deletes the `expenseGroup` row too)
 * when this removal leaves exactly one member behind — a lone survivor is not
 * a group.
 *
 * The membership count is read and the auto-dissolve decision made using the
 * SAME dbOrTx call/transaction as the delete (no separate `db.transaction`
 * opened here) — the caller MUST invoke this from within `db.transaction` to
 * close the TOCTOU gap between the count and the delete (T-66-03).
 *
 * Structural guarantee (D-09): never writes `expense.subCategoryId`/`status`
 * and never stores/restores a per-member pre-merge subcategory.
 */
export async function removeExpenseFromGroup(
  dbOrTx: DbOrTx,
  input: RemoveExpenseFromGroupInput,
): Promise<{ autoDissolved: boolean }> {
  const { userId, groupId, expenseId } = input

  // 1. Group ownership check.
  const [ownedGroup] = await dbOrTx
    .select({ id: expenseGroup.id })
    .from(expenseGroup)
    .where(and(eq(expenseGroup.id, groupId), eq(expenseGroup.userId, userId)))

  if (!ownedGroup) {
    throw new Error('Gruppo non trovato.')
  }

  // 2. The expenseId must currently be a member of this group.
  const [membershipRow] = await dbOrTx
    .select({ id: expenseGroupMembership.id })
    .from(expenseGroupMembership)
    .where(
      and(eq(expenseGroupMembership.groupId, groupId), eq(expenseGroupMembership.expenseId, expenseId)),
    )

  if (!membershipRow) {
    throw new Error('Spesa non trovata nel gruppo.')
  }

  // 3. Count total members BEFORE the delete — exactly 2 means exactly 1
  //    remains after this delete, which triggers auto-dissolve.
  const [{ count: memberCount }] = await dbOrTx
    .select({ count: count(expenseGroupMembership.id) })
    .from(expenseGroupMembership)
    .where(eq(expenseGroupMembership.groupId, groupId))

  // 4. Delete the single membership row.
  await dbOrTx
    .delete(expenseGroupMembership)
    .where(
      and(eq(expenseGroupMembership.groupId, groupId), eq(expenseGroupMembership.expenseId, expenseId)),
    )

  // 5. Auto-dissolve when this was the second-to-last member.
  if (Number(memberCount) === 2) {
    await dbOrTx
      .delete(expenseGroup)
      .where(and(eq(expenseGroup.id, groupId), eq(expenseGroup.userId, userId)))

    return { autoDissolved: true }
  }

  return { autoDissolved: false }
}

export type DissolveExpenseGroupInput = {
  userId: string
  groupId: number
}

/**
 * Dissolve an owned Expense Group entirely (GRP-07, ADR 0017 D-07/D-08):
 * deletes every membership row for the group, then the group row itself.
 * Members revert to plain, ungrouped Expenses — this never touches
 * `expense.subCategoryId`/`status` (D-09).
 */
export async function dissolveExpenseGroup(
  dbOrTx: DbOrTx,
  input: DissolveExpenseGroupInput,
): Promise<true> {
  const { userId, groupId } = input

  // 1. Group ownership check.
  const [ownedGroup] = await dbOrTx
    .select({ id: expenseGroup.id })
    .from(expenseGroup)
    .where(and(eq(expenseGroup.id, groupId), eq(expenseGroup.userId, userId)))

  if (!ownedGroup) {
    throw new Error('Gruppo non trovato.')
  }

  // 2. Delete all membership rows for this group.
  await dbOrTx.delete(expenseGroupMembership).where(eq(expenseGroupMembership.groupId, groupId))

  // 3. Delete the group row itself.
  await dbOrTx
    .delete(expenseGroup)
    .where(and(eq(expenseGroup.id, groupId), eq(expenseGroup.userId, userId)))

  return true
}
