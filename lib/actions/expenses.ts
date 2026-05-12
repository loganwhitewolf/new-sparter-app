'use server'
import { verifySession } from '@/lib/dal/auth'
import {
  CreateExpenseSchema,
  UpdateExpenseSchema,
  BulkCategorizeSchema,
  BulkDeleteExpensesSchema,
  SingleCategorizeSchema,
  IgnoreExpenseSchema,
  ActionState,
} from '@/lib/validations/expense'
import {
  insertExpense,
  updateExpense as updateExpenseDAL,
  deleteExpense as deleteExpenseDAL,
  deleteExpenses as deleteExpensesDAL,
  getExpenses,
  EXPENSE_LIST_LIMIT,
  type ExpenseFilters,
} from '@/lib/dal/expenses'
import { db } from '@/lib/db'
import { expense } from '@/lib/db/schema'
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

export async function deleteExpense(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = formData.get('id') as string
  if (!id) return { error: 'ID spesa mancante.' }
  const { userId } = await verifySession()
  try {
    await deleteExpenseDAL(id, userId)
  } catch {
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
  const parsed = BulkDeleteExpensesSchema.safeParse({ ids })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Selezione non valida.' }
  }
  const { userId } = await verifySession()
  try {
    await deleteExpensesDAL(parsed.data.ids, userId)
  } catch {
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }
  revalidateCategorizationSurfaces()
  return { error: null }
}

export async function bulkCategorize(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = BulkCategorizeSchema.safeParse({
    ids: JSON.parse((formData.get('ids') as string) ?? '[]'),
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
