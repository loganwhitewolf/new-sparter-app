'use server'

import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/dal/auth'
import { APP_ROUTES } from '@/lib/routes'
import { bulkAssignTags, TagAssignmentError } from '@/lib/services/tag-assignment'
import { computeSuggestionsForNewTag, type TagSuggestionGroup } from '@/lib/services/tag-suggestions'
import { BulkAssignTagsSchema } from '@/lib/validations/tags'
import type { ActionState } from '@/lib/validations/category'

// D-08a: create-time trigger — a plain async data-returning function (not a `useActionState`
// form submission), following the `detachTransaction` shape: the create-time modal (Plan 67-08)
// calls this directly with a typed object to render the pre-checked checklist.
export async function getNewTagSuggestionsAction(input: {
  tagId: number
}): Promise<{ group: TagSuggestionGroup | null; error: string | null }> {
  const { userId } = await verifySession()

  try {
    const group = await computeSuggestionsForNewTag({ userId, tagId: input.tagId })
    return { group, error: null }
  } catch {
    return { group: null, error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }
}

// Confirming a suggestion is exactly a bulk-assign of one tag to the confirmed transaction ids —
// delegates entirely to Plan 67-04's ownership-verified bulkAssignTags (D-06's additive-union
// guarantee and its IDOR checks apply identically here; no separate insert path exists).
export async function confirmTagSuggestionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let transactionIds: unknown
  try {
    transactionIds = JSON.parse((formData.get('transactionIds') as string) ?? '[]')
  } catch {
    return { error: 'Selezione non valida.' }
  }

  const parsed = BulkAssignTagsSchema.safeParse({
    transactionIds,
    tagIds: [Number(formData.get('tagId'))],
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Selezione non valida.' }
  }

  const { userId } = await verifySession()

  try {
    await bulkAssignTags({
      userId,
      transactionIds: parsed.data.transactionIds,
      tagIds: parsed.data.tagIds,
    })
  } catch (error) {
    if (error instanceof TagAssignmentError) {
      return { error: error.message }
    }
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }

  revalidatePath(APP_ROUTES.transactions)
  return { error: null }
}
