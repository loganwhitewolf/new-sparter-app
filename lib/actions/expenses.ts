'use server'
import { verifySession } from '@/lib/dal/auth'
import {
  CreateExpenseSchema,
  UpdateExpenseSchema,
  UpdateExpenseTitleSchema,
  BulkCategorizeSchema,
  BulkDeleteExpensesSchema,
  DeleteExpenseSchema,
  SingleCategorizeSchema,
  IgnoreExpenseSchema,
  MergeExpensesSchema,
  RenameExpenseGroupSchema,
  CategorizeExpenseGroupSchema,
  ActionState,
} from '@/lib/validations/expense'
import {
  insertExpense,
  updateExpense as updateExpenseDAL,
  updateExpenseTitle as updateExpenseTitleDAL,
  getExpenses,
  getExpenseImportContext,
  EXPENSE_LIST_LIMIT,
  type ExpenseFilters,
  type ExpenseSourceFile,
} from '@/lib/dal/expenses'
import { deleteExpensesWithOptions } from '@/lib/services/expense-deletion'
import { createExpenseGroup, renameExpenseGroup } from '@/lib/services/expense-group'
import {
  getTransactionsByExpenseId,
  type ExpenseTransactionRow,
} from '@/lib/dal/transactions'
import { db } from '@/lib/db'
import { expense, expenseGroup, expenseGroupMembership } from '@/lib/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { writeClassificationHistory } from '@/lib/dal/classification-history'
import { revalidateCategorizationSurfaces } from '@/lib/actions/revalidation'
import { isSubCategoryVisibleToUser } from '@/lib/dal/categories'

type LoadMoreExpensesInput = {
  filters?: ExpenseFilters
  offset?: number
}

type LoadMoreExpensesResult = {
  expenses: Awaited<ReturnType<typeof getExpenses>>
  hasMore: boolean
  error: string | null
}

function normalizeOffset(offset: number | undefined): number {
  const normalizedOffset = offset ?? 0

  if (!Number.isInteger(normalizedOffset) || normalizedOffset < 0) {
    return 0
  }

  return normalizedOffset
}

export async function loadMoreExpenses({
  filters = {},
  offset,
}: LoadMoreExpensesInput): Promise<LoadMoreExpensesResult> {
  try {
    const normalizedOffset = normalizeOffset(offset)
    const expenses = await getExpenses(filters, {
      limit: EXPENSE_LIST_LIMIT,
      offset: normalizedOffset,
    })

    return {
      expenses,
      hasMore: expenses.length === EXPENSE_LIST_LIMIT,
      error: null,
    }
  } catch {
    return {
      expenses: [],
      hasMore: false,
      error: 'Non è stato possibile caricare altre spese. Riprova.',
    }
  }
}

export async function createExpense(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = CreateExpenseSchema.safeParse({
    title: formData.get('title'),
    subCategoryId: formData.get('subCategoryId') ? Number(formData.get('subCategoryId')) : undefined,
    notes: (formData.get('notes') as string) || undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }
  const { userId } = await verifySession()
  try {
    await insertExpense({ ...parsed.data, userId })
  } catch {
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }
  revalidateCategorizationSurfaces()
  return { error: null }
}

export async function updateExpense(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = UpdateExpenseSchema.safeParse({
    id: formData.get('id'),
    title: formData.get('title'),
    subCategoryId: formData.get('subCategoryId') ? Number(formData.get('subCategoryId')) : undefined,
    notes: (formData.get('notes') as string) || undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }
  const { userId } = await verifySession()
  try {
    await updateExpenseDAL({ ...parsed.data, userId })
  } catch {
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }
  revalidateCategorizationSurfaces()
  return { error: null }
}

export async function updateExpenseTitle(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = UpdateExpenseTitleSchema.safeParse({
    id: formData.get('id'),
    title: formData.get('title'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }
  const { userId } = await verifySession()
  try {
    await updateExpenseTitleDAL({ ...parsed.data, userId })
  } catch {
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }
  revalidateCategorizationSurfaces()
  return { error: null }
}

export async function deleteExpense(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = DeleteExpenseSchema.safeParse({
    id: formData.get('id'),
    deleteLinkedTransactions: formData.get('deleteLinkedTransactions'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Spesa non valida.' }
  }
  const { userId } = await verifySession()
  try {
    const result = await deleteExpensesWithOptions({
      userId,
      expenseIds: [parsed.data.id],
      deleteLinkedTransactions: parsed.data.deleteLinkedTransactions,
    })
    if (result.deletedExpenseIds.length === 0) {
      return { error: 'Spesa non trovata o già eliminata.' }
    }
  } catch (err) {
    if (err instanceof Error) return { error: err.message }
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }
  revalidateCategorizationSurfaces()
  return { error: null }
}

export async function bulkDeleteExpenses(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ids: unknown
  try {
    ids = JSON.parse((formData.get('ids') as string) ?? '[]')
  } catch {
    return { error: 'Selezione non valida.' }
  }
  const parsed = BulkDeleteExpensesSchema.safeParse({
    ids,
    deleteLinkedTransactions: formData.get('deleteLinkedTransactions'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Selezione non valida.' }
  }
  const { userId } = await verifySession()
  try {
    await deleteExpensesWithOptions({
      userId,
      expenseIds: parsed.data.ids,
      deleteLinkedTransactions: parsed.data.deleteLinkedTransactions,
    })
  } catch (err) {
    if (err instanceof Error) return { error: err.message }
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }
  revalidateCategorizationSurfaces()
  return { error: null }
}

export async function bulkCategorize(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  // WR-04: guard against malformed/tampered `ids` payload (a raw JSON.parse throw
  // would otherwise escape as an uncaught exception instead of an ActionState),
  // matching the sibling try/catch pattern in bulkDeleteExpenses/mergeExpenses —
  // this action is also invoked from the new merge dialog's categorize step.
  let ids: unknown
  try {
    ids = JSON.parse((formData.get('ids') as string) ?? '[]')
  } catch {
    return { error: 'Selezione non valida.' }
  }

  const parsed = BulkCategorizeSchema.safeParse({
    ids,
    subCategoryId: Number(formData.get('subCategoryId')),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }
  // SECURITY: verifySession() first, then scope update to userId (T-3-02)
  const { userId } = await verifySession()
  const subCategoryVisible = await isSubCategoryVisibleToUser(parsed.data.subCategoryId, userId)
  if (!subCategoryVisible) {
    return { error: 'Sottocategoria non valida.' }
  }
  try {
    await db.transaction(async (tx) => {
      const beforeRows = await tx
        .select({
          id: expense.id,
          subCategoryId: expense.subCategoryId,
          status: expense.status,
        })
        .from(expense)
        .where(
          and(
            inArray(expense.id, parsed.data.ids),
            eq(expense.userId, userId),
          ),
        )

      const beforeById = new Map(beforeRows.map((row) => [row.id, row]))

      // CRITICAL SECURITY: inArray alone is NOT sufficient — must also include eq(expense.userId, userId).
      // This prevents IDOR: a user submitting IDs belonging to another user's expenses.
      const updated = await tx
        .update(expense)
        .set({
          subCategoryId: parsed.data.subCategoryId,
          status: '3',
          updatedAt: new Date(),
        })
        .where(
          and(
            inArray(expense.id, parsed.data.ids),
            eq(expense.userId, userId),
          ),
        )
        .returning({ id: expense.id })

      // Write classification history rows for manual categorization (ADV-02).
      // Non-fatal per row: history loss is acceptable vs a failed bulk-categorize action.
      await Promise.all(
        updated.map(async (row) => {
          const before = beforeById.get(row.id)
          try {
            await writeClassificationHistory(tx, {
              userId,
              expenseId: row.id,
              fromSubCategoryId: before?.subCategoryId ?? null,
              toSubCategoryId: parsed.data.subCategoryId,
              fromStatus: before?.status ?? null,
              toStatus: '3',
              source: 'manual',
            })
          } catch {
            // history write failure is non-fatal
          }
        }),
      )
    })
  } catch {
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }
  revalidateCategorizationSurfaces()
  return { error: null }
}

export async function categorizeExpense(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = SingleCategorizeSchema.safeParse({
    id: formData.get('id'),
    subCategoryId: Number(formData.get('subCategoryId')),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }
  // SECURITY: verifySession() first, then scope update to userId (IDOR prevention)
  const { userId } = await verifySession()
  const subCategoryVisible = await isSubCategoryVisibleToUser(parsed.data.subCategoryId, userId)
  if (!subCategoryVisible) {
    return { error: 'Sottocategoria non valida.' }
  }
  // D-03 defense-in-depth (WR-02): a grouped expense's category is set at the group
  // level (Phase 66) — recategorizing a member directly here would silently diverge
  // it from its group. Reject before starting the transaction; nothing is written.
  // Joined through `expense` and scoped to `userId` (not just expenseId) — the
  // original guard checked expenseId alone, so any caller could learn via the
  // distinct error response whether an arbitrary (unowned) expense id was grouped,
  // before ownership was ever checked (IDOR info-leak).
  const groupMembership = await db
    .select({ id: expenseGroupMembership.id })
    .from(expenseGroupMembership)
    .innerJoin(expense, eq(expense.id, expenseGroupMembership.expenseId))
    .where(
      and(
        eq(expenseGroupMembership.expenseId, parsed.data.id),
        eq(expense.userId, userId),
      ),
    )
    .limit(1)
  if (groupMembership.length > 0) {
    return { error: 'Questa spesa fa parte di un gruppo: categorizza dal gruppo.' }
  }
  try {
    await db.transaction(async (tx) => {
      const before = await tx
        .select({ subCategoryId: expense.subCategoryId, status: expense.status })
        .from(expense)
        .where(and(eq(expense.id, parsed.data.id), eq(expense.userId, userId)))
        .limit(1)

      const [updated] = await tx
        .update(expense)
        .set({ subCategoryId: parsed.data.subCategoryId, status: '3', updatedAt: new Date() })
        .where(and(eq(expense.id, parsed.data.id), eq(expense.userId, userId)))
        .returning({ id: expense.id })

      if (!updated) return

      try {
        await writeClassificationHistory(tx, {
          userId,
          expenseId: updated.id,
          fromSubCategoryId: before[0]?.subCategoryId ?? null,
          toSubCategoryId: parsed.data.subCategoryId,
          fromStatus: before[0]?.status ?? null,
          toStatus: '3',
          source: 'manual',
        })
      } catch {
        // history write failure is non-fatal
      }
    })
  } catch {
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }
  revalidateCategorizationSurfaces()
  return { error: null }
}

export async function fetchExpenseTransactions(
  expenseId: string,
): Promise<{
  transactions: ExpenseTransactionRow[]
  sourceFile: ExpenseSourceFile | null
  platformName: string | null
  error: string | null
}> {
  if (!expenseId) {
    return { transactions: [], sourceFile: null, platformName: null, error: 'ID spesa mancante.' }
  }
  try {
    const [transactions, importContext] = await Promise.all([
      getTransactionsByExpenseId(expenseId),
      getExpenseImportContext(expenseId),
    ])
    return {
      transactions,
      sourceFile: importContext.sourceFile,
      platformName: importContext.platformName,
      error: null,
    }
  } catch {
    return {
      transactions: [],
      sourceFile: null,
      platformName: null,
      error: 'Non è stato possibile caricare i dettagli. Riprova.',
    }
  }
}

export async function ignoreExpense(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = IgnoreExpenseSchema.safeParse({ id: formData.get('id') })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }
  // SECURITY: verifySession() first, then scope update to userId (IDOR prevention)
  const { userId } = await verifySession()
  try {
    await db
      .update(expense)
      .set({ status: '4', updatedAt: new Date() })
      .where(and(eq(expense.id, parsed.data.id), eq(expense.userId, userId)))
  } catch {
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }
  revalidateCategorizationSurfaces()
  return { error: null }
}

/**
 * Merge (Unisci) — Phase 65, ADR 0017. Pure regrouping (D-02): this action never
 * assigns a category. Every selected expense must already share the same
 * non-null subCategoryId; uncategorized selections are categorized separately
 * (via bulkCategorize) in the merge dialog before this action is ever called.
 */
export async function mergeExpenses(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  let selectedExpenseIds: unknown
  try {
    selectedExpenseIds = JSON.parse((formData.get('selectedExpenseIds') as string) ?? '[]')
  } catch {
    return { error: 'Selezione non valida.' }
  }

  const parsed = MergeExpensesSchema.safeParse({
    selectedExpenseIds,
    groupTitle: formData.get('groupTitle'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { userId } = await verifySession()
  const dedupedIds = [...new Set(parsed.data.selectedExpenseIds)]

  try {
    await db.transaction(async (tx) => {
      const rows = await tx
        .select({ id: expense.id, subCategoryId: expense.subCategoryId, status: expense.status })
        .from(expense)
        .where(and(eq(expense.userId, userId), inArray(expense.id, dedupedIds)))

      if (rows.length !== dedupedIds.length) {
        throw new Error('Una o più spese non sono state trovate.')
      }

      if (rows.some((row) => row.subCategoryId === null)) {
        throw new Error('Categorizza prima di unire.')
      }

      // WR-05: reject ignored (status '4') members. getExpenses applies status as a
      // SQL WHERE filter BEFORE composeExpenseRows groups members by groupId, so a
      // group containing a mix of ignored/non-ignored members would have its composed
      // totals silently built from whichever status subset survives a given filter —
      // ignoreExpense sets status='4' without clearing subCategoryId, so this
      // divergence is otherwise invisible to the "same category" gate above.
      if (rows.some((row) => row.status === '4')) {
        throw new Error('Una o più spese selezionate sono ignorate: riattivale prima di unire.')
      }

      const subCategoryIds = new Set(rows.map((row) => row.subCategoryId))
      if (subCategoryIds.size > 1) {
        throw new Error('Le spese devono avere la stessa categoria.')
      }

      const commonSubCategoryId = rows[0].subCategoryId as number

      await createExpenseGroup(tx, {
        userId,
        selectedExpenseIds: dedupedIds,
        groupTitle: parsed.data.groupTitle,
        subCategoryId: commonSubCategoryId,
      })
    })
  } catch (err) {
    if (err instanceof Error) return { error: err.message }
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }

  revalidateCategorizationSurfaces()
  return { error: null }
}

/**
 * Recategorize an entire Expense Group (GRP-05, ADR 0017 D-01/D-02). Every
 * member's expense.subCategoryId/status is updated AND expenseGroup.subCategoryId
 * is dual-written in the same transaction (D-09) — the group and its members
 * must never diverge on category. This is the ONLY path that may move a grouped
 * member's category; categorizeExpense's D-03 guard blocks direct member edits.
 */
export async function categorizeExpenseGroup(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = CategorizeExpenseGroupSchema.safeParse({
    groupId: formData.get('groupId'),
    subCategoryId: Number(formData.get('subCategoryId')),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  // SECURITY: verifySession() first, then scope everything to userId (T-3-02 / T-66-05).
  const { userId } = await verifySession()
  const subCategoryVisible = await isSubCategoryVisibleToUser(parsed.data.subCategoryId, userId)
  if (!subCategoryVisible) {
    return { error: 'Sottocategoria non valida.' }
  }

  try {
    await db.transaction(async (tx) => {
      // Group ownership check — a groupId belonging to another user resolves to
      // the same 'Gruppo non trovato.' as a missing groupId, before any row is touched.
      const [ownedGroup] = await tx
        .select({ id: expenseGroup.id })
        .from(expenseGroup)
        .where(and(eq(expenseGroup.id, parsed.data.groupId), eq(expenseGroup.userId, userId)))

      if (!ownedGroup) {
        throw new Error('Gruppo non trovato.')
      }

      const memberRows = await tx
        .select({
          id: expense.id,
          subCategoryId: expense.subCategoryId,
          status: expense.status,
        })
        .from(expenseGroupMembership)
        .innerJoin(expense, eq(expense.id, expenseGroupMembership.expenseId))
        .where(
          and(
            eq(expenseGroupMembership.groupId, parsed.data.groupId),
            eq(expense.userId, userId),
          ),
        )

      const beforeById = new Map(memberRows.map((row) => [row.id, row]))
      const memberIds = memberRows.map((row) => row.id)

      const updated = await tx
        .update(expense)
        .set({
          subCategoryId: parsed.data.subCategoryId,
          status: '3',
          updatedAt: new Date(),
        })
        .where(and(inArray(expense.id, memberIds), eq(expense.userId, userId)))
        .returning({ id: expense.id })

      // D-09: dual-write the group's own subCategoryId in the SAME transaction —
      // the group and its members must never diverge on category.
      await tx
        .update(expenseGroup)
        .set({ subCategoryId: parsed.data.subCategoryId, updatedAt: new Date() })
        .where(and(eq(expenseGroup.id, parsed.data.groupId), eq(expenseGroup.userId, userId)))

      // Non-fatal per-member history write (ADV-02 precedent).
      await Promise.all(
        updated.map(async (row) => {
          const before = beforeById.get(row.id)
          try {
            await writeClassificationHistory(tx, {
              userId,
              expenseId: row.id,
              fromSubCategoryId: before?.subCategoryId ?? null,
              toSubCategoryId: parsed.data.subCategoryId,
              fromStatus: before?.status ?? null,
              toStatus: '3',
              source: 'manual',
            })
          } catch {
            // history write failure is non-fatal
          }
        }),
      )
    })
  } catch (err) {
    if (err instanceof Error) return { error: err.message }
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }

  revalidateCategorizationSurfaces()
  return { error: null }
}

export async function renameExpenseGroupAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = RenameExpenseGroupSchema.safeParse({
    groupId: formData.get('groupId'),
    title: formData.get('title'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { userId } = await verifySession()

  try {
    await renameExpenseGroup(db, {
      userId,
      groupId: parsed.data.groupId,
      title: parsed.data.title,
    })
  } catch (err) {
    if (err instanceof Error) return { error: err.message }
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }

  revalidateCategorizationSurfaces()
  return { error: null }
}
