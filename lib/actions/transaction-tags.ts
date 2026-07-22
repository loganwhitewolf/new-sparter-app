'use server'

import { verifySession } from '@/lib/dal/auth'
import { APP_ROUTES } from '@/lib/routes'
import {
  addSingleTransactionTag,
  bulkAssignTags,
  bulkRemoveTags,
  removeSingleTransactionTag,
  TagAssignmentError,
} from '@/lib/services/tag-assignment'
import { BulkAssignTagsSchema, BulkRemoveTagsSchema, SingleTransactionTagSchema } from '@/lib/validations/tags'
import type { ActionState } from '@/lib/validations/category'
import { revalidatePath } from 'next/cache'

export async function bulkAssignTagsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let transactionIds: unknown
  let tagIds: unknown
  try {
    transactionIds = JSON.parse((formData.get('transactionIds') as string) ?? '[]')
    tagIds = JSON.parse((formData.get('tagIds') as string) ?? '[]')
  } catch {
    return { error: 'Selezione non valida.' }
  }

  const parsed = BulkAssignTagsSchema.safeParse({ transactionIds, tagIds })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Selezione non valida.' }
  }

  const { userId } = await verifySession()

  try {
    await bulkAssignTags({ userId, ...parsed.data })
  } catch (error) {
    if (error instanceof TagAssignmentError) {
      return { error: error.message }
    }
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }

  revalidatePath(APP_ROUTES.transactions)
  return { error: null }
}

export async function bulkRemoveTagsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let transactionIds: unknown
  let tagIds: unknown
  try {
    transactionIds = JSON.parse((formData.get('transactionIds') as string) ?? '[]')
    tagIds = JSON.parse((formData.get('tagIds') as string) ?? '[]')
  } catch {
    return { error: 'Selezione non valida.' }
  }

  const parsed = BulkRemoveTagsSchema.safeParse({ transactionIds, tagIds })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Selezione non valida.' }
  }

  const { userId } = await verifySession()

  try {
    await bulkRemoveTags({ userId, ...parsed.data })
  } catch (error) {
    if (error instanceof TagAssignmentError) {
      return { error: error.message }
    }
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }

  revalidatePath(APP_ROUTES.transactions)
  return { error: null }
}

export async function addTransactionTagAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = SingleTransactionTagSchema.safeParse({
    transactionId: formData.get('transactionId'),
    tagId: formData.get('tagId'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Selezione non valida.' }
  }

  const { userId } = await verifySession()

  try {
    await addSingleTransactionTag({ userId, ...parsed.data })
  } catch (error) {
    if (error instanceof TagAssignmentError) {
      return { error: error.message }
    }
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }

  revalidatePath(APP_ROUTES.transactions)
  return { error: null }
}

export async function removeTransactionTagAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = SingleTransactionTagSchema.safeParse({
    transactionId: formData.get('transactionId'),
    tagId: formData.get('tagId'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Selezione non valida.' }
  }

  const { userId } = await verifySession()

  try {
    await removeSingleTransactionTag({ userId, ...parsed.data })
  } catch (error) {
    if (error instanceof TagAssignmentError) {
      return { error: error.message }
    }
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }

  revalidatePath(APP_ROUTES.transactions)
  return { error: null }
}
