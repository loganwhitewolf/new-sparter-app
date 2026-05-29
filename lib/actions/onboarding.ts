'use server'

import { and, eq } from 'drizzle-orm'
import { revalidateCategorizationSurfaces } from '@/lib/actions/revalidation'
import { verifySession } from '@/lib/dal/auth'
import { isSubCategoryVisibleToUser } from '@/lib/dal/categories'
import { writeClassificationHistory } from '@/lib/dal/classification-history'
import { db } from '@/lib/db'
import { expense } from '@/lib/db/schema'
import {
  SingleCategorizeSchema,
  type ActionState,
} from '@/lib/validations/expense'

export async function onboardingCategorizeExpense(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = SingleCategorizeSchema.safeParse({
    id: formData.get('id') ?? '',
    subCategoryId: Number(formData.get('subCategoryId')),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { userId } = await verifySession()
  const subCategoryVisible = await isSubCategoryVisibleToUser(
    parsed.data.subCategoryId,
    userId,
  )

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
        .set({
          subCategoryId: parsed.data.subCategoryId,
          status: '3',
          updatedAt: new Date(),
        })
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
        // Classification history is non-fatal; the categorization itself already succeeded.
      }
    })
  } catch {
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }

  revalidateCategorizationSurfaces()

  return { error: null }
}
