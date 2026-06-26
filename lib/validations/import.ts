import { z } from 'zod'
import { parseAmount, parseMonths, parseStatus } from '@/lib/utils/search-params'

export const MAX_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024

export const IMPORT_CONTENT_TYPES = [
  'text/csv',
  'application/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/pdf',
  // Defensive fallback: some browsers emit octet-stream for PDF files (Assumption A5)
  'application/octet-stream',
] as const

const SUPPORTED_EXTENSIONS = ['.csv', '.xlsx', '.pdf'] as const

function extensionOf(name: string) {
  return name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? ''
}

export const FileIdSchema = z.string().uuid({ error: 'Invalid file id.' })

const HEX_64_RE = /^[0-9a-f]{64}$/

export const InitiateUploadSchema = z.object({
  name: z
    .string({ error: 'File name is required.' })
    .trim()
    .min(1, { error: 'File name is required.' })
    .max(255, { error: 'File name is too long.' })
    .refine((name) => SUPPORTED_EXTENSIONS.includes(extensionOf(name) as (typeof SUPPORTED_EXTENSIONS)[number]), {
      error: 'Only CSV, XLSX, and PDF imports are supported.',
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
  contentHash: z
    .string()
    .regex(HEX_64_RE, { error: 'Content hash must be a 64-character lowercase hex string.' })
    .optional(),
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

export const ImportFormatWizardDelimiterSchema = z.enum([',', ';', '\t', '|'], {
  error: 'Unsupported delimiter.',
})

const ImportFormatWizardColumnSchema = z
  .string({ error: 'Column is required.' })
  .trim()
  .min(1, { error: 'Column is required.' })
  .max(120, { error: 'Column is too long.' })

const OptionalImportFormatWizardColumnSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  ImportFormatWizardColumnSchema.optional(),
)

export const LoadImportFormatWizardContextSchema = z.object({
  fileId: FileIdSchema,
})

export const CreatePrivateImportFormatSchema = z
  .object({
    fileId: FileIdSchema,
    platformName: z
      .string({ error: 'Platform name is required.' })
      .trim()
      .min(1, { error: 'Platform name is required.' })
      .max(100, { error: 'Platform name is too long.' }),
    delimiter: ImportFormatWizardDelimiterSchema,
    timestampColumn: ImportFormatWizardColumnSchema,
    descriptionColumn: ImportFormatWizardColumnSchema,
    amountMode: z.enum(['single', 'separate'], { error: 'Amount mode is required.' }),
    amountColumn: OptionalImportFormatWizardColumnSchema,
    positiveAmountColumn: OptionalImportFormatWizardColumnSchema,
    negativeAmountColumn: OptionalImportFormatWizardColumnSchema,
  })
  .superRefine((value, ctx) => {
    if (value.amountMode === 'single' && !value.amountColumn) {
      ctx.addIssue({
        code: 'custom',
        path: ['amountColumn'],
        message: 'Amount column is required for single amount mode.',
      })
    }

    if (value.amountMode === 'single' && (value.positiveAmountColumn || value.negativeAmountColumn)) {
      ctx.addIssue({
        code: 'custom',
        path: ['amountMode'],
        message: 'Separate amount columns are not allowed in single amount mode.',
      })
    }

    if (value.amountMode === 'separate' && (!value.positiveAmountColumn || !value.negativeAmountColumn)) {
      ctx.addIssue({
        code: 'custom',
        path: ['positiveAmountColumn'],
        message: 'Positive and negative amount columns are required for separate amount mode.',
      })
    }

    if (value.amountMode === 'separate' && value.amountColumn) {
      ctx.addIssue({
        code: 'custom',
        path: ['amountColumn'],
        message: 'Single amount column is not allowed in separate amount mode.',
      })
    }
  })

export function getPrivateImportFormatColumnValidationError(
  input: CreatePrivateImportFormatInput,
  headers: readonly string[],
): string | null {
  const headerSet = new Set(headers)
  const requiredColumns = [
    input.timestampColumn,
    input.descriptionColumn,
    ...(input.amountMode === 'single'
      ? [input.amountColumn]
      : [input.positiveAmountColumn, input.negativeAmountColumn]),
  ].filter((column): column is string => typeof column === 'string' && column.length > 0)

  const missingColumn = requiredColumns.find((column) => !headerSet.has(column))
  return missingColumn ? `Selected column does not exist in uploaded file: ${missingColumn}` : null
}

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
export type LoadImportFormatWizardContextInput = z.infer<typeof LoadImportFormatWizardContextSchema>
export type CreatePrivateImportFormatInput = z.infer<typeof CreatePrivateImportFormatSchema>
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
  // Wave 4: new filter fields
  platform?: string
  statusBucket?: 'imported' | 'pending' | 'failed'
  months?: string[]
  amountMin?: string
  amountMax?: string
  sort?:
    | 'displayName'
    | 'status'
    | 'platform'
    | 'importedAt'
    | 'rowCount'
    | 'positiveTotal'
    | 'negativeTotal'
    | 'referenceStartedAt'
  dir?: 'asc' | 'desc'
}

export const importSortSchema = z.enum([
  'displayName',
  'status',
  'platform',
  'importedAt',
  'rowCount',
  'positiveTotal',
  'negativeTotal',
  'referenceStartedAt',
])

export const importSortDirectionSchema = z.enum(['asc', 'desc'])

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

const PLATFORM_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function parseImportFilters(input: ImportSearchParams): ParsedImportFilters {
  const q = firstTrimmed(input.q)

  const importedFromDate = parseDateOnly(firstTrimmed(input.importedFrom))
  const importedToDate = getInclusiveDate(firstTrimmed(input.importedTo))
  const referenceFromDate = parseDateOnly(firstTrimmed(input.referenceFrom))
  const referenceToDate = getInclusiveDate(firstTrimmed(input.referenceTo))

  const importedFromStr = importedFromDate ? (firstTrimmed(input.importedFrom) as string) : undefined
  const importedToStr = importedToDate ? (firstTrimmed(input.importedTo) as string) : undefined
  const referenceFromStr = referenceFromDate ? (firstTrimmed(input.referenceFrom) as string) : undefined
  const referenceToStr = referenceToDate ? (firstTrimmed(input.referenceTo) as string) : undefined

  // Wave 4: new filter fields
  const rawPlatform = firstTrimmed(input.platform)
  const platform = rawPlatform && PLATFORM_SLUG_RE.test(rawPlatform) ? rawPlatform : undefined
  const statusBucket = parseStatus(input.statusBucket, ['imported', 'pending', 'failed']) as
    | 'imported'
    | 'pending'
    | 'failed'
    | undefined
  const months = parseMonths(input.months)
  const amountMin = parseAmount(input.amountMin)
  const amountMax = parseAmount(input.amountMax)
  const sort = importSortSchema.safeParse(firstTrimmed(input.sort))
  const dir = importSortDirectionSchema.safeParse(firstTrimmed(input.dir))

  return {
    ...(q && q.length <= MAX_IMPORT_QUERY_LENGTH ? { q } : {}),
    ...(importedFromStr ? { importedFrom: importedFromStr, importedFromDate } : {}),
    ...(importedToStr ? { importedTo: importedToStr, importedToDate } : {}),
    ...(referenceFromStr ? { referenceFrom: referenceFromStr, referenceFromDate } : {}),
    ...(referenceToStr ? { referenceTo: referenceToStr, referenceToDate } : {}),
    ...(platform ? { platform } : {}),
    ...(statusBucket ? { statusBucket } : {}),
    ...(months.length > 0 ? { months } : {}),
    ...(amountMin ? { amountMin } : {}),
    ...(amountMax ? { amountMax } : {}),
    ...(sort.success ? { sort: sort.data } : {}),
    ...(dir.success ? { dir: dir.data } : {}),
  }
}
