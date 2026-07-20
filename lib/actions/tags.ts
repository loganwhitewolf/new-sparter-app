'use server'

import { verifySession } from '@/lib/dal/auth'
import {
  TagMutationError,
  archiveTag as archiveTagService,
  createTag as createTagService,
  updateTag as updateTagService,
} from '@/lib/services/tag-operations'
import { ArchiveTagSchema, CreateTagSchema, UpdateTagSchema } from '@/lib/validations/tags'
import type { ActionState } from '@/lib/validations/category'
import { revalidatePath } from 'next/cache'
import { APP_ROUTES } from '@/lib/routes'

const GENERIC_ERROR = 'Si è verificato un errore. Riprova tra qualche secondo.'

// Both TagMutationError codes already carry a user-facing Italian message from the service
// layer, so no separate message-remapping table is needed here (unlike categories.ts's
// mapKnownCategoryError, which adds a count-interpolated message for one code).
function mapKnownTagError(error: unknown): ActionState | null {
  if (!(error instanceof TagMutationError)) return null
  return { error: error.message }
}

// Widened state ONLY for createTagAction — Plan 67-08's create-time suggestion trigger (D-08a)
// needs the newly-created tag's id back to call getNewTagSuggestionsAction({ tagId }) right after
// a successful create. updateTagAction/archiveTagAction have no such need and keep plain ActionState.
export type CreateTagActionState = ActionState & { tagId?: number }

export async function createTagAction(
  _prev: CreateTagActionState,
  formData: FormData,
): Promise<CreateTagActionState> {
  const parsed = CreateTagSchema.safeParse({
    name: formData.get('name'),
    dateRangeStart: formData.get('dateRangeStart') || undefined,
    dateRangeEnd: formData.get('dateRangeEnd') || undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { userId } = await verifySession()

  try {
    const created = await createTagService({
      userId,
      name: parsed.data.name,
      dateRangeStart: parsed.data.dateRangeStart ?? null,
      dateRangeEnd: parsed.data.dateRangeEnd ?? null,
    })
    revalidatePath(APP_ROUTES.tagSettings)
    return { error: null, tagId: created.id }
  } catch (error) {
    return mapKnownTagError(error) ?? { error: GENERIC_ERROR }
  }
}

export async function updateTagAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = UpdateTagSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name') || undefined,
    dateRangeStart: formData.get('dateRangeStart') || undefined,
    dateRangeEnd: formData.get('dateRangeEnd') || undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { userId } = await verifySession()

  try {
    await updateTagService({
      userId,
      tagId: parsed.data.id,
      name: parsed.data.name,
      dateRangeStart: parsed.data.dateRangeStart ?? undefined,
      dateRangeEnd: parsed.data.dateRangeEnd ?? undefined,
    })
    revalidatePath(APP_ROUTES.tagSettings)
    return { error: null }
  } catch (error) {
    return mapKnownTagError(error) ?? { error: GENERIC_ERROR }
  }
}

export async function archiveTagAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = ArchiveTagSchema.safeParse({ id: formData.get('id') })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { userId } = await verifySession()

  try {
    await archiveTagService({ userId, tagId: parsed.data.id })
    revalidatePath(APP_ROUTES.tagSettings)
    return { error: null }
  } catch (error) {
    return mapKnownTagError(error) ?? { error: GENERIC_ERROR }
  }
}
