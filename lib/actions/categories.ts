"use server";

import { revalidateCategorizationSurfaces } from '@/lib/actions/revalidation'
import { verifySession } from '@/lib/dal/auth'
import {
  CategoryMutationError,
  createUserCategory,
  createUserSubcategory,
  deactivateUserCategory,
  deactivateUserSubcategory,
  deleteUserCategory,
  deleteUserSubcategory,
  isSubCategoryVisibleToUser,
  reactivateUserCategory,
  reactivateUserSubcategory,
  renameUserCategory,
  renameUserSubcategory,
  upsertSubcategoryNatureOverride,
  upsertSystemSubcategoryOverride,
} from '@/lib/dal/categories'
import {
  CreateCategorySchema,
  CreateSubcategorySchema,
  DeactivateCategorySchema,
  DeactivateSubcategorySchema,
  DeleteCategorySchema,
  DeleteSubcategorySchema,
  ReactivateCategorySchema,
  ReactivateSubcategorySchema,
  RenameCategorySchema,
  RenameSubcategorySchema,
  SetSubcategoryNatureSchema,
  type ActionState,
} from '@/lib/validations/category'
import {
  DIRECTION_ID_BY_CODE,
  NATURE_ID_BY_CODE,
  type FlowNature,
} from '@/lib/utils/nature-labels'

const GENERIC_ERROR = 'Si è verificato un errore. Riprova tra qualche secondo.'
const NOT_FOUND_ERROR = 'Elemento non trovato o accesso negato.'
const DUPLICATE_ERROR = 'Esiste già una categoria o sottocategoria con questo nome.'
const SYSTEM_DELETE_ERROR = 'Non puoi eliminare una categoria o sottocategoria di sistema.'
const SYSTEM_DEACTIVATE_ERROR = 'Non puoi disattivare una categoria o sottocategoria di sistema.'
const SYSTEM_REACTIVATE_ERROR = 'Non puoi riattivare una categoria o sottocategoria di sistema.'
const PARENT_INACTIVE_ERROR =
  'Riattiva prima la categoria padre, poi la sottocategoria.'

function firstValidationError(error: { issues: Array<{ message: string }> }) {
  return error.issues[0]?.message ?? 'Dati non validi.'
}

function mapKnownCategoryError(error: unknown): ActionState | null {
  if (!(error instanceof CategoryMutationError)) return null

  if (error.code === 'duplicate') return { error: DUPLICATE_ERROR }
  if (error.code === 'linked_expenses') {
    const count = error.count ?? 0
    // Shared by category + subcategory delete — taxonomy is linked via expense.subCategoryId.
    // Domain: Transaction categorization lives on Expense (not the bank tx row).
    if (count === 1) {
      return {
        error:
          "Non puoi eliminare: c'è 1 spesa collegata a questa categoria o sottocategoria.",
      }
    }
    return {
      error: `Non puoi eliminare: ci sono ${count} spese collegate a questa categoria o sottocategoria.`,
    }
  }
  if (error.code === 'system_row') return { error: SYSTEM_DELETE_ERROR }
  if (error.code === 'parent_inactive') return { error: PARENT_INACTIVE_ERROR }
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
    direction: formData.get('direction'),
  })

  if (!parsed.success) return { error: firstValidationError(parsed.error) }

  const directionId = DIRECTION_ID_BY_CODE[parsed.data.direction]

  try {
    // Category only — nature belongs on subcategories the user creates next.
    await createUserCategory({
      userId,
      name: parsed.data.name,
      slug: parsed.data.slug,
      directionId,
    })
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

export async function deactivateCategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await verifySession()
  const parsed = DeactivateCategorySchema.safeParse({ id: formData.get('id') })

  if (!parsed.success) return { error: firstValidationError(parsed.error) }

  try {
    const deactivated = await deactivateUserCategory(parsed.data.id, userId)
    if (!deactivated) return { error: SYSTEM_DEACTIVATE_ERROR }
  } catch (error) {
    return mapKnownCategoryError(error) ?? { error: GENERIC_ERROR }
  }

  return successAfterRevalidation()
}

export async function reactivateCategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await verifySession()
  const parsed = ReactivateCategorySchema.safeParse({ id: formData.get('id') })

  if (!parsed.success) return { error: firstValidationError(parsed.error) }

  try {
    const reactivated = await reactivateUserCategory(parsed.data.id, userId)
    if (!reactivated) return { error: SYSTEM_REACTIVATE_ERROR }
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

  // Same resolution as setSubcategoryNatureAction — form sends FlowNature code, DAL stores FK id.
  const natureId = NATURE_ID_BY_CODE[parsed.data.nature]
  if (natureId === undefined) {
    return { error: 'Seleziona una natura valida.' }
  }

  try {
    await createUserSubcategory({
      userId,
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      slug: parsed.data.slug,
      natureId,
    })
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
  const visible = await isSubCategoryVisibleToUser(parsed.data.subCategoryId, userId)
  if (!visible) {
    return { ok: false, error: NOT_FOUND_ERROR }
  }
  // Resolve nature code → natureId via the closed lookup map (T-49-05-01: unknown code = null, no write)
  const natureId = parsed.data.nature !== null ? (NATURE_ID_BY_CODE[parsed.data.nature] ?? null) : null
  try {
    await upsertSubcategoryNatureOverride({ userId, subCategoryId: parsed.data.subCategoryId, natureId })
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

export async function deactivateSubcategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await verifySession()
  const parsed = DeactivateSubcategorySchema.safeParse({ id: formData.get('id') })

  if (!parsed.success) return { error: firstValidationError(parsed.error) }

  try {
    const deactivated = await deactivateUserSubcategory(parsed.data.id, userId)
    if (!deactivated) return { error: SYSTEM_DEACTIVATE_ERROR }
  } catch (error) {
    return mapKnownCategoryError(error) ?? { error: GENERIC_ERROR }
  }

  return successAfterRevalidation()
}

export async function reactivateSubcategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await verifySession()
  const parsed = ReactivateSubcategorySchema.safeParse({ id: formData.get('id') })

  if (!parsed.success) return { error: firstValidationError(parsed.error) }

  try {
    const reactivated = await reactivateUserSubcategory(parsed.data.id, userId)
    if (!reactivated) return { error: SYSTEM_REACTIVATE_ERROR }
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
