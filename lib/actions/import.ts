'use server'
import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/dal/auth'
import { AnalyzeImportSchema, ImportFileSchema } from '@/lib/validations/import'
import { analyzeFile, importFile } from '@/lib/services/import'
import type { ImportAnalysisResult, ImportFileResult } from '@/lib/services/import'

export type ImportActionState<T = null> = {
  error: string | null
  data?: T
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

    revalidatePath('/import')
    revalidatePath('/spese')

    return { error: null, data: result }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Import failed. Please retry.'
    return { error: msg }
  }
}
