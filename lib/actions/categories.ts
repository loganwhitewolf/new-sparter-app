"use server";

import { revalidateCategorizationSurfaces } from '@/lib/actions/revalidation'
import { verifySession } from '@/lib/dal/auth'
import {
  CategoryMutationError,
  createUserCategory,
  createUserSubcategory,
  deleteUserCategory,
  deleteUserSubcategory,
  renameUserCategory,
  renameUserSubcategory,
  upsertSubcategoryNatureOverride,
  upsertSystemSubcategoryOverride,
} from '@/lib/dal/categories'
import {
  CreateCategorySchema,
  CreateSubcategorySchema,
  DeleteCategorySchema,
  DeleteSubcategorySchema,
  RenameCategorySchema,
  RenameSubcategorySchema,
  SetSubcategoryNatureSchema,
  type ActionState,
} from '@/lib/validations/category'
import type { FlowNature } from '@/lib/utils/nature-labels'

const GENERIC_ERROR = 'Si è verificato un errore. Riprova tra qualche secondo.'
const NOT_FOUND_ERROR = 'Elemento non trovato o accesso negato.'
const DUPLICATE_ERROR = 'Esiste già una categoria o sottocategoria con questo nome.'
const SYSTEM_DELETE_ERROR = 'Non puoi eliminare una categoria o sottocategoria di sistema.'

function firstValidationError(error: { issues: Array<{ message: string }> }) {
  return error.issues[0]?.message ?? 'Dati non validi.'
}

function mapKnownCategoryError(error: unknown): ActionState | null {
  if (!(error instanceof CategoryMutationError)) return null

  if (error.code === 'duplicate') return { error: DUPLICATE_ERROR }
  if (error.code === 'linked_expenses') {
    const count = error.count ?? 0
    const noun = count === 1 ? 'spesa' : 'spese'
    return { error: `Non puoi eliminare questa sottocategoria: è collegata a ${count} ${noun}.` }
  }
  if (error.code === 'system_row') return { error: SYSTEM_DELETE_ERROR }
  return { error: NOT_FOUND_ERROR }
}

function successAfterRevalidation(): ActionState {
  revalidateCategorizationSurfaces()
  return { error: null }
}

export async function createCategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await verifySession()
  const parsed = CreateCategorySchema.safeParse({
    name: formData.get('name'),
    type: formData.get('type'),
  })

  if (!parsed.success) return { error: firstValidationError(parsed.error) }

  try {
    await createUserCategory({ ...parsed.data, userId })
  } catch (error) {
    return mapKnownCategoryError(error) ?? { error: GENERIC_ERROR }
  }

  return successAfterRevalidation()
}

export async function renameCategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await verifySession()
  const parsed = RenameCategorySchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
  })

  if (!parsed.success) return { error: firstValidationError(parsed.error) }

  try {
    const updated = await renameUserCategory(parsed.data.id, userId, {
      name: parsed.data.name,
      slug: parsed.data.slug,
    })
    if (!updated) return { error: NOT_FOUND_ERROR }
  } catch (error) {
    return mapKnownCategoryError(error) ?? { error: GENERIC_ERROR }
  }

  return successAfterRevalidation()
}

export async function deleteCategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await verifySession()
  const parsed = DeleteCategorySchema.safeParse({ id: formData.get('id') })

  if (!parsed.success) return { error: firstValidationError(parsed.error) }

  try {
    const deleted = await deleteUserCategory(parsed.data.id, userId)
    if (!deleted) return { error: SYSTEM_DELETE_ERROR }
  } catch (error) {
    return mapKnownCategoryError(error) ?? { error: GENERIC_ERROR }
  }

  return successAfterRevalidation()
}

export async function createSubcategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await verifySession()
  const parsed = CreateSubcategorySchema.safeParse({
    categoryId: formData.get('categoryId'),
    name: formData.get('name'),
    nature: formData.get('nature'),
  })

  if (!parsed.success) return { error: firstValidationError(parsed.error) }

  try {
    await createUserSubcategory({ ...parsed.data, userId })
  } catch (error) {
    return mapKnownCategoryError(error) ?? { error: GENERIC_ERROR }
  }

  return successAfterRevalidation()
}

export async function setSubcategoryNatureAction(input: {
  subCategoryId: number
  nature: FlowNature | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId } = await verifySession()
  const parsed = SetSubcategoryNatureSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dati non validi.' }
  }
  try {
    await upsertSubcategoryNatureOverride({ userId, subCategoryId: parsed.data.subCategoryId, nature: parsed.data.nature })
  } catch {
    return { ok: false, error: GENERIC_ERROR }
  }
  revalidateCategorizationSurfaces()
  return { ok: true }
}

export async function renameSubcategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await verifySession()
  const parsed = RenameSubcategorySchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
  })

  if (!parsed.success) return { error: firstValidationError(parsed.error) }

  try {
    const updated = await renameUserSubcategory(parsed.data.id, userId, {
      name: parsed.data.name,
      slug: parsed.data.slug,
    })

    if (!updated) {
      await upsertSystemSubcategoryOverride(userId, parsed.data.id, parsed.data.name)
    }
  } catch (error) {
    return mapKnownCategoryError(error) ?? { error: GENERIC_ERROR }
  }

  return successAfterRevalidation()
}

export async function deleteSubcategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await verifySession()
  const parsed = DeleteSubcategorySchema.safeParse({ id: formData.get('id') })

  if (!parsed.success) return { error: firstValidationError(parsed.error) }

  try {
    const deleted = await deleteUserSubcategory(parsed.data.id, userId)
    if (!deleted) return { error: SYSTEM_DELETE_ERROR }
  } catch (error) {
    return mapKnownCategoryError(error) ?? { error: GENERIC_ERROR }
  }

  return successAfterRevalidation()
}
