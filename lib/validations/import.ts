import { z } from 'zod'

export const MAX_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024

export const IMPORT_CONTENT_TYPES = [
  'text/csv',
  'application/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const

const SUPPORTED_EXTENSIONS = ['.csv', '.xlsx'] as const

function extensionOf(name: string) {
  return name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? ''
}

export const FileIdSchema = z.string().uuid({ error: 'Invalid file id.' })

export const InitiateUploadSchema = z.object({
  name: z
    .string({ error: 'File name is required.' })
    .trim()
    .min(1, { error: 'File name is required.' })
    .max(255, { error: 'File name is too long.' })
    .refine((name) => SUPPORTED_EXTENSIONS.includes(extensionOf(name) as (typeof SUPPORTED_EXTENSIONS)[number]), {
      error: 'Only CSV and XLSX imports are supported.',
    }),
  size: z
    .number({ error: 'File size is required.' })
    .int({ error: 'File size must be an integer.' })
    .positive({ error: 'File size must be greater than zero.' })
    .max(MAX_IMPORT_FILE_SIZE_BYTES, { error: 'File exceeds the maximum import size.' }),
  type: z
    .string({ error: 'Content type is required.' })
    .trim()
    .refine((type) => IMPORT_CONTENT_TYPES.includes(type as (typeof IMPORT_CONTENT_TYPES)[number]), {
      error: 'Unsupported import content type.',
    }),
})

export const ConfirmUploadSchema = z.object({
  fileId: FileIdSchema,
  contentType: z
    .string({ error: 'Content type is required.' })
    .trim()
    .refine((type) => IMPORT_CONTENT_TYPES.includes(type as (typeof IMPORT_CONTENT_TYPES)[number]), {
      error: 'Unsupported import content type.',
    })
    .optional(),
})

export const AnalyzeImportSchema = z.object({
  fileId: FileIdSchema,
  selectedFormatVersionId: z.number().int().positive().optional(),
})

export const ImportFileSchema = z.object({
  fileId: FileIdSchema,
  selectedFormatVersionId: z.number().int().positive().optional(),
  overrideWarnings: z.boolean().default(false),
})

export const UpdateImportDisplayNameSchema = z.object({
  fileId: FileIdSchema,
  displayName: z
    .string({ error: 'Import name is required.' })
    .trim()
    .max(255, { error: 'Import name is too long.' })
    .nullable(),
})

export const DeleteImportSchema = z.object({
  fileId: FileIdSchema,
})

export type InitiateUploadInput = z.infer<typeof InitiateUploadSchema>
export type ConfirmUploadInput = z.infer<typeof ConfirmUploadSchema>
export type AnalyzeImportInput = z.infer<typeof AnalyzeImportSchema>
export type ImportFileInput = z.infer<typeof ImportFileSchema>
export type UpdateImportDisplayNameInput = z.infer<typeof UpdateImportDisplayNameSchema>
export type DeleteImportInput = z.infer<typeof DeleteImportSchema>

export type ImportSearchParams = Record<string, string | string[] | undefined>

export type ParsedImportFilters = {
  q?: string
  importedFrom?: string
  importedTo?: string
  importedFromDate?: Date
  importedToDate?: Date
  referenceFrom?: string
  referenceTo?: string
  referenceFromDate?: Date
  referenceToDate?: Date
}

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const MAX_IMPORT_QUERY_LENGTH = 255

function firstTrimmed(value: string | string[] | undefined): string | undefined {
  const rawValue = Array.isArray(value) ? value[0] : value
  const trimmed = rawValue?.trim()

  return trimmed ? trimmed : undefined
}

function parseDateOnly(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined
  }

  const match = DATE_ONLY_RE.exec(value)

  if (!match) {
    return undefined
  }

  const [, year, month, day] = match
  const numericYear = Number(year)
  const numericMonth = Number(month)
  const numericDay = Number(day)
  const parsed = new Date(
    Date.UTC(numericYear, numericMonth - 1, numericDay, 0, 0, 0, 0),
  )

  if (
    parsed.getUTCFullYear() !== numericYear ||
    parsed.getUTCMonth() !== numericMonth - 1 ||
    parsed.getUTCDate() !== numericDay
  ) {
    return undefined
  }

  return parsed
}

function getInclusiveDate(value: string | undefined): Date | undefined {
  const startOfDay = parseDateOnly(value)

  if (!startOfDay) {
    return undefined
  }

  return new Date(
    Date.UTC(
      startOfDay.getUTCFullYear(),
      startOfDay.getUTCMonth(),
      startOfDay.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  )
}

export function parseImportFilters(input: ImportSearchParams): ParsedImportFilters {
  const q = firstTrimmed(input.q)
  const importedFrom = firstTrimmed(input.importedFrom)
  const importedTo = firstTrimmed(input.importedTo)
  const referenceFrom = firstTrimmed(input.referenceFrom)
  const referenceTo = firstTrimmed(input.referenceTo)
  const importedFromDate = parseDateOnly(importedFrom)
  const importedToDate = getInclusiveDate(importedTo)
  const referenceFromDate = parseDateOnly(referenceFrom)
  const referenceToDate = getInclusiveDate(referenceTo)

  return {
    ...(q && q.length <= MAX_IMPORT_QUERY_LENGTH ? { q } : {}),
    ...(importedFromDate ? { importedFrom, importedFromDate } : {}),
    ...(importedToDate ? { importedTo, importedToDate } : {}),
    ...(referenceFromDate ? { referenceFrom, referenceFromDate } : {}),
    ...(referenceToDate ? { referenceTo, referenceToDate } : {}),
  }
}
