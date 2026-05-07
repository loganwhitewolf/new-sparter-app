'use server'
import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/dal/auth'
import {
  AnalyzeImportSchema,
  ImportFileSchema,
  UpdateImportDisplayNameSchema,
  parseImportFilters,
  type ImportSearchParams,
} from '@/lib/validations/import'
import { analyzeFile, importFile } from '@/lib/services/import'
import type { ImportAnalysisResult, ImportFileResult } from '@/lib/services/import'
import {
  getImports,
  IMPORT_LIST_LIMIT,
  updateImportDisplayName,
} from '@/lib/dal/imports'
import { db } from '@/lib/db'
import { APP_ROUTES } from '@/lib/routes'

export type ImportActionState<T = null> = {
  error: string | null
  data?: T
}

type LoadMoreImportsInput = {
  filters?: ImportSearchParams
  offset?: number
}

type LoadMoreImportsResult = {
  imports: Awaited<ReturnType<typeof getImports>>
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

export async function loadMoreImports({
  filters = {},
  offset,
}: LoadMoreImportsInput): Promise<LoadMoreImportsResult> {
  try {
    const normalizedOffset = normalizeOffset(offset)
    const imports = await getImports(parseImportFilters(filters), {
      limit: IMPORT_LIST_LIMIT,
      offset: normalizedOffset,
    })

    return {
      imports,
      hasMore: imports.length === IMPORT_LIST_LIMIT,
      error: null,
    }
  } catch {
    return {
      imports: [],
      hasMore: false,
      error: 'Non è stato possibile caricare altre importazioni. Riprova.',
    }
  }
}

export async function analyzeImportAction(
  formData: FormData,
): Promise<ImportActionState<ImportAnalysisResult>> {
  const raw = {
    fileId: formData.get('fileId'),
    selectedFormatVersionId: formData.get('selectedFormatVersionId')
      ? Number(formData.get('selectedFormatVersionId'))
      : undefined,
  }

  const parsed = AnalyzeImportSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const { userId } = await verifySession()

  try {
    const result = await analyzeFile({
      userId,
      fileId: parsed.data.fileId,
      selectedFormatVersionId: parsed.data.selectedFormatVersionId,
    })

    if (result.errors.length > 0) {
      return { error: result.errors[0] ?? 'Analysis failed.', data: result }
    }

    return { error: null, data: result }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Analysis failed. Please retry.'
    return { error: msg }
  }
}

export async function confirmImportAction(
  formData: FormData,
): Promise<ImportActionState<ImportFileResult>> {
  const raw = {
    fileId: formData.get('fileId'),
    selectedFormatVersionId: formData.get('selectedFormatVersionId')
      ? Number(formData.get('selectedFormatVersionId'))
      : undefined,
    overrideWarnings: formData.get('overrideWarnings') === 'true',
  }

  const parsed = ImportFileSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const { userId, subscriptionPlan } = await verifySession()

  try {
    const result = await importFile({
      userId,
      fileId: parsed.data.fileId,
      selectedFormatVersionId: parsed.data.selectedFormatVersionId,
      overrideWarnings: parsed.data.overrideWarnings,
      subscriptionPlan,
    })

    revalidatePath(APP_ROUTES.import)
    revalidatePath(APP_ROUTES.expenses)

    return { error: null, data: result }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Import failed. Please retry.'
    return { error: msg }
  }
}

export async function updateImportDisplayNameAction(
  _prev: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  const parsed = UpdateImportDisplayNameSchema.safeParse({
    fileId: formData.get('fileId') ?? '',
    displayName: formData.get('displayName') ?? null,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  let userId: string

  try {
    const session = await verifySession()
    userId = session.userId
  } catch {
    return { error: 'Sessione scaduta. Accedi di nuovo per rinominare questa importazione.' }
  }

  try {
    const updated = await updateImportDisplayName(db, {
      userId,
      fileId: parsed.data.fileId,
      displayName: parsed.data.displayName,
    })

    if (!updated) {
      return { error: 'Importazione non trovata o accesso negato.' }
    }

    revalidatePath(APP_ROUTES.import)

    return { error: null }
  } catch {
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }
}
