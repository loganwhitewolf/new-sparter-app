import 'server-only'

import crypto from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { file as fileTable, importFormatVersion, platform } from '@/lib/db/schema'
import { getFileForUser } from '@/lib/dal/files'
import { logger } from '@/lib/logger'
import { parseImportFile, type ParsedImportFile } from '@/lib/services/import-parsers'
import { readObjectBody } from '@/lib/services/r2'
import {
  CreatePrivateImportFormatSchema,
  getPrivateImportFormatColumnValidationError,
  type CreatePrivateImportFormatInput,
} from '@/lib/validations/import'

export type ImportFormatWizardErrorCode =
  | 'invalid_input'
  | 'file_not_found'
  | 'file_read_failed'
  | 'file_parse_failed'
  | 'column_not_found'
  | 'db_write_failed'

export class ImportFormatWizardError extends Error {
  constructor(
    readonly code: ImportFormatWizardErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'ImportFormatWizardError'
  }
}

export type ImportFormatWizardContext = {
  fileId: string
  fileName: string
  detectedDelimiter: string | null
  headers: string[]
  sampleRows: Array<{
    rowIndex: number
    values: Record<string, string>
  }>
}

export type CreatePrivateImportFormatResult = {
  fileId: string
  platformId: number
  platformName: string
  platformSlug: string
  formatVersionId: number
  headerSignature: string
}

const SAFE_WIZARD_PARSE_ERROR = 'Impossibile leggere le intestazioni del file. Riprova.'
const SAFE_WIZARD_READ_ERROR = 'Impossibile leggere il file caricato. Riprova.'
const PRIVATE_VISIBILITY = 'private'
const DRAFT_REVIEW_STATUS = 'draft'
const HEADER_SAMPLE_ROWS = 5
const HEADER_MAX_ROWS = 25

async function readR2Bytes(objectKey: string): Promise<Buffer> {
  const body = await readObjectBody(objectKey)
  if (!body) throw new Error('R2 object body was empty.')
  const chunks: Uint8Array[] = []
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

function logWizard(
  level: 'info' | 'warn' | 'error',
  event: string,
  fields: {
    userId: string
    fileId: string
    formatVersionId?: number
    platformId?: number
    code?: ImportFormatWizardErrorCode
  },
) {
  logger[level]({ event, ...fields })
}

function sanitizeHeader(value: string) {
  return value.trim().slice(0, 120)
}

function safeSampleRows(parsed: ParsedImportFile) {
  return parsed.sampleRows.slice(0, HEADER_SAMPLE_ROWS).map((row, index) => ({
    rowIndex: index + 1,
    values: Object.fromEntries(
      parsed.headers.map((header) => [header, sanitizeHeader(row[header] ?? '')]),
    ),
  }))
}

function slugifyPlatformName(name: string) {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)

  return slug || 'private-format'
}

function privatePlatformSlug(input: { platformName: string; userId: string; fileId: string }) {
  const suffix = crypto
    .createHash('sha256')
    .update(`${input.userId}:${input.fileId}:${input.platformName}`)
    .digest('hex')
    .slice(0, 12)

  return `${slugifyPlatformName(input.platformName)}-${suffix}`.slice(0, 100)
}

function headerSignature(headers: readonly string[], delimiter: string) {
  return headers.join(delimiter)
}

function assertParsedHeaders(parsed: ParsedImportFile, input: { userId: string; fileId: string }) {
  if (parsed.errors.length > 0 || parsed.headers.length === 0) {
    logWizard('warn', 'import_format_wizard.rejected', {
      userId: input.userId,
      fileId: input.fileId,
      code: 'file_parse_failed',
    })
    throw new ImportFormatWizardError('file_parse_failed', SAFE_WIZARD_PARSE_ERROR)
  }
}

async function readAndParseOwnedFile(input: { userId: string; fileId: string }) {
  const fileRow = await getFileForUser({ userId: input.userId, fileId: input.fileId })
  if (!fileRow) {
    logWizard('warn', 'import_format_wizard.rejected', {
      userId: input.userId,
      fileId: input.fileId,
      code: 'file_not_found',
    })
    throw new ImportFormatWizardError('file_not_found', 'Importazione non trovata o accesso negato.')
  }

  let bytes: Buffer
  try {
    bytes = await readR2Bytes(fileRow.objectKey)
  } catch {
    logWizard('error', 'import_format_wizard.retry_failed', {
      userId: input.userId,
      fileId: input.fileId,
      code: 'file_read_failed',
    })
    throw new ImportFormatWizardError('file_read_failed', SAFE_WIZARD_READ_ERROR)
  }

  let parsed: ParsedImportFile
  try {
    parsed = await parseImportFile(bytes, {
      fileName: fileRow.originalName,
      maxRows: HEADER_MAX_ROWS,
      sampleSize: HEADER_SAMPLE_ROWS,
    })
  } catch {
    logWizard('warn', 'import_format_wizard.rejected', {
      userId: input.userId,
      fileId: input.fileId,
      code: 'file_parse_failed',
    })
    throw new ImportFormatWizardError('file_parse_failed', SAFE_WIZARD_PARSE_ERROR)
  }

  assertParsedHeaders(parsed, input)

  return { fileRow, parsed }
}

export async function loadImportFormatWizardContext(input: {
  userId: string
  fileId: string
}): Promise<ImportFormatWizardContext> {
  const { fileRow, parsed } = await readAndParseOwnedFile(input)

  logWizard('info', 'import_format_wizard.context_loaded', {
    userId: input.userId,
    fileId: input.fileId,
  })

  return {
    fileId: input.fileId,
    fileName: fileRow.displayName?.trim() || fileRow.originalName,
    detectedDelimiter: parsed.delimiter,
    headers: parsed.headers,
    sampleRows: safeSampleRows(parsed),
  }
}

async function createPrivateRows(
  database: DbOrTx,
  input: CreatePrivateImportFormatInput & { userId: string; headers: string[] },
): Promise<CreatePrivateImportFormatResult> {
  const slug = privatePlatformSlug(input)
  const header = headerSignature(input.headers, input.delimiter)
  const createdPlatforms = await database
    .insert(platform)
    .values({
      id: sql`nextval('platform_id_seq')`,
      ownerUserId: input.userId,
      visibility: PRIVATE_VISIBILITY,
      reviewStatus: DRAFT_REVIEW_STATUS,
      name: input.platformName,
      slug,
      country: 'IT',
      delimiter: input.delimiter,
      timestampColumn: input.timestampColumn,
      descriptionColumn: input.descriptionColumn,
      amountType: input.amountMode,
      amountColumn: input.amountMode === 'single' ? input.amountColumn ?? null : null,
      positiveAmountColumn: input.amountMode === 'separate' ? input.positiveAmountColumn ?? null : null,
      negativeAmountColumn: input.amountMode === 'separate' ? input.negativeAmountColumn ?? null : null,
      multiplyBy: 1,
      isActive: true,
    })
    .returning({ id: platform.id, name: platform.name, slug: platform.slug })

  const createdPlatform = createdPlatforms[0]
  if (!createdPlatform || typeof createdPlatform.id !== 'number') {
    throw new ImportFormatWizardError('db_write_failed', 'Impossibile salvare il formato. Riprova.')
  }

  const createdVersions = await database
    .insert(importFormatVersion)
    .values({
      platformId: createdPlatform.id,
      ownerUserId: input.userId,
      visibility: PRIVATE_VISIBILITY,
      reviewStatus: DRAFT_REVIEW_STATUS,
      version: 1,
      headerSignature: header,
      notes: 'Created from private import format wizard.',
      isActive: true,
    })
    .returning({ id: importFormatVersion.id, headerSignature: importFormatVersion.headerSignature })

  const createdVersion = createdVersions[0]
  if (!createdVersion || typeof createdVersion.id !== 'number') {
    throw new ImportFormatWizardError('db_write_failed', 'Impossibile salvare il formato. Riprova.')
  }

  await database
    .update(fileTable)
    .set({
      status: 'uploaded',
      importFormatVersionId: createdVersion.id,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(and(eq(fileTable.id, input.fileId), eq(fileTable.userId, input.userId)))

  return {
    fileId: input.fileId,
    platformId: createdPlatform.id,
    platformName: createdPlatform.name,
    platformSlug: createdPlatform.slug,
    formatVersionId: createdVersion.id,
    headerSignature: createdVersion.headerSignature,
  }
}

export async function createPrivateImportFormat(input: CreatePrivateImportFormatInput & { userId: string }) {
  const parsedInput = CreatePrivateImportFormatSchema.safeParse(input)
  if (!parsedInput.success) {
    logWizard('warn', 'import_format_wizard.rejected', {
      userId: input.userId,
      fileId: input.fileId,
      code: 'invalid_input',
    })
    throw new ImportFormatWizardError('invalid_input', 'Controlla i campi del formato e riprova.')
  }

  const { parsed } = await readAndParseOwnedFile({ userId: input.userId, fileId: parsedInput.data.fileId })
  const columnError = getPrivateImportFormatColumnValidationError(parsedInput.data, parsed.headers)
  if (columnError) {
    logWizard('warn', 'import_format_wizard.rejected', {
      userId: input.userId,
      fileId: parsedInput.data.fileId,
      code: 'column_not_found',
    })
    throw new ImportFormatWizardError('column_not_found', 'Una o più colonne selezionate non esistono nel file caricato.')
  }

  try {
    const result = await db.transaction((tx) =>
      createPrivateRows(tx, {
        ...parsedInput.data,
        userId: input.userId,
        headers: parsed.headers,
      }),
    )

    logWizard('info', 'import_format_wizard.created', {
      userId: input.userId,
      fileId: parsedInput.data.fileId,
      platformId: result.platformId,
      formatVersionId: result.formatVersionId,
    })

    return result
  } catch (error) {
    if (error instanceof ImportFormatWizardError) {
      logWizard('error', 'import_format_wizard.retry_failed', {
        userId: input.userId,
        fileId: parsedInput.data.fileId,
        code: error.code,
      })
      throw error
    }

    logWizard('error', 'import_format_wizard.retry_failed', {
      userId: input.userId,
      fileId: parsedInput.data.fileId,
      code: 'db_write_failed',
    })
    throw new ImportFormatWizardError('db_write_failed', 'Impossibile salvare il formato. Riprova.')
  }
}
