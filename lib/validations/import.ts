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

export type InitiateUploadInput = z.infer<typeof InitiateUploadSchema>
export type ConfirmUploadInput = z.infer<typeof ConfirmUploadSchema>
export type AnalyzeImportInput = z.infer<typeof AnalyzeImportSchema>
export type ImportFileInput = z.infer<typeof ImportFileSchema>
