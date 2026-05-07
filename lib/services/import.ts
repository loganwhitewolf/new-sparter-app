import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  expense,
  importFormatVersion,
  platform,
  transaction as transactionTable,
} from '@/lib/db/schema'
import {
  getFileForUser,
  markFileFailed,
  updateFileAnalysisState,
  updateFileImportState,
} from '@/lib/dal/files'
import {
  getDuplicateHashes,
  insertTransactionBatch,
  type TransactionInsertData,
} from '@/lib/dal/transactions'
import { parseImportFile, type ParsedImportFile } from '@/lib/services/import-parsers'
import { detectImportFormat } from '@/lib/services/import-format-detector'
import { readObjectBody } from '@/lib/services/r2'
import {
  categorizePipeline,
  loadActivePatterns,
  type SubscriptionPlan,
} from '@/lib/services/categorization'
import { normalizeTransactionRow } from '@/lib/utils/import'
import { toDbDecimal, toDecimal } from '@/lib/utils/decimal'
import { writeClassificationHistory } from '@/lib/dal/classification-history'

export type ImportAnalysisResult = {
  fileId: string
  formatVersionId: number | null
  platformName: string | null
  rowCount: number
  duplicateCount: number
  warnings: string[]
  errors: string[]
  sampleRows: {
    rowIndex: number
    description: string
    amount: string | null
    occurredAt: string | null
    duplicate: boolean
    valid: boolean
    errors: string[]
    warnings: string[]
  }[]
}

export type ImportFileResult = {
  fileId: string
  rowCount: number
  duplicateCount: number
  importedCount: number
  warnings: string[]
  errors: string[]
}

type PlatformConfig = {
  id: number
  name: string
  slug: string
  delimiter: string
  country: string
  timestampColumn: string
  descriptionColumn: string
  amountType: 'single' | 'separate'
  amountColumn: string | null
  positiveAmountColumn: string | null
  negativeAmountColumn: string | null
  multiplyBy: number
}

type FormatVersionWithPlatform = {
  id: number
  platformId: number
  version: number
  headerSignature: string
  isActive: boolean
  platform: PlatformConfig
}

async function loadFormatVersions(
  selectedFormatVersionId?: number,
): Promise<FormatVersionWithPlatform[]> {
  const rows = await db
    .select({
      id: importFormatVersion.id,
      platformId: importFormatVersion.platformId,
      version: importFormatVersion.version,
      headerSignature: importFormatVersion.headerSignature,
      isActive: importFormatVersion.isActive,
      platformName: platform.name,
      platformSlug: platform.slug,
      platformDelimiter: platform.delimiter,
      platformCountry: platform.country,
      platformTimestampColumn: platform.timestampColumn,
      platformDescriptionColumn: platform.descriptionColumn,
      platformAmountType: platform.amountType,
      platformAmountColumn: platform.amountColumn,
      platformPositiveAmountColumn: platform.positiveAmountColumn,
      platformNegativeAmountColumn: platform.negativeAmountColumn,
      platformMultiplyBy: platform.multiplyBy,
    })
    .from(importFormatVersion)
    .innerJoin(platform, eq(importFormatVersion.platformId, platform.id))
    .where(
      selectedFormatVersionId
        ? eq(importFormatVersion.id, selectedFormatVersionId)
        : eq(importFormatVersion.isActive, true),
    )

  return rows.map((r) => ({
    id: r.id,
    platformId: r.platformId,
    version: r.version,
    headerSignature: r.headerSignature,
    isActive: r.isActive,
    platform: {
      id: r.platformId,
      name: r.platformName,
      slug: r.platformSlug,
      delimiter: r.platformDelimiter,
      country: r.platformCountry,
      timestampColumn: r.platformTimestampColumn,
      descriptionColumn: r.platformDescriptionColumn,
      amountType: r.platformAmountType,
      amountColumn: r.platformAmountColumn,
      positiveAmountColumn: r.platformPositiveAmountColumn,
      negativeAmountColumn: r.platformNegativeAmountColumn,
      multiplyBy: r.platformMultiplyBy,
    },
  }))
}

async function readR2Bytes(objectKey: string): Promise<Buffer> {
  const body = await readObjectBody(objectKey)
  if (!body) throw new Error('R2 object body was empty.')
  const chunks: Uint8Array[] = []
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

const SAFE_ERROR_MAX_LENGTH = 500

function safeImportErrorMessage(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : fallback
  return raw
    .replace(/https?:\/\/\S+/g, '[redacted-url]')
    .replace(/\s+at\s+[^\n]+/g, '')
    .slice(0, SAFE_ERROR_MAX_LENGTH)
}

type FullFileImportStats = {
  rowCount: number
  importedCount: number
  duplicateCount: number
  positiveTotal: string
  negativeTotal: string
  referenceStartedAt: Date | null
  referenceEndedAt: Date | null
}

type NormalizedImportStats = FullFileImportStats & {
  normalizedRows: ReturnType<typeof normalizeTransactionRow>[]
  allHashes: string[]
  repeatedInFileHashes: Set<string>
  uniqueImportableHashes: Set<string>
}

function deriveFullFileImportStats(input: {
  parsed: ParsedImportFile
  format: { platformId: number; platform: Parameters<typeof normalizeTransactionRow>[1] }
  userId: string
  existingHashes?: Set<string>
}): NormalizedImportStats {
  const seenHashes = new Set<string>()
  const repeatedInFileHashes = new Set<string>()
  const uniqueImportableHashes = new Set<string>()
  const normalizedRows: ReturnType<typeof normalizeTransactionRow>[] = []
  const allHashes: string[] = []
  let skippedOrDuplicateCount = 0
  let importableCount = 0
  let positiveTotal = toDecimal('0')
  let negativeTotal = toDecimal('0')
  let referenceStartedAt: Date | null = null
  let referenceEndedAt: Date | null = null

  for (const [index, row] of input.parsed.rows.entries()) {
    const normalized = normalizeTransactionRow(
      row,
      { ...input.format.platform, platformId: input.format.platformId },
      { userId: input.userId, rowIndex: index + 1 },
    )
    normalizedRows.push(normalized)

    if (normalized.amount) {
      const amount = toDecimal(normalized.amount)
      if (amount.gt(0)) positiveTotal = positiveTotal.plus(amount)
      if (amount.lt(0)) negativeTotal = negativeTotal.plus(amount)
    }

    if (normalized.occurredAt) {
      if (!referenceStartedAt || normalized.occurredAt < referenceStartedAt) referenceStartedAt = normalized.occurredAt
      if (!referenceEndedAt || normalized.occurredAt > referenceEndedAt) referenceEndedAt = normalized.occurredAt
    }

    if (!normalized.valid || !normalized.transactionHash || !normalized.amount || !normalized.occurredAt) {
      skippedOrDuplicateCount += 1
      continue
    }

    allHashes.push(normalized.transactionHash)

    if (seenHashes.has(normalized.transactionHash)) {
      repeatedInFileHashes.add(normalized.transactionHash)
      skippedOrDuplicateCount += 1
      continue
    }
    seenHashes.add(normalized.transactionHash)

    if (input.existingHashes?.has(normalized.transactionHash)) {
      skippedOrDuplicateCount += 1
      continue
    }

    uniqueImportableHashes.add(normalized.transactionHash)
    importableCount += 1
  }

  return {
    normalizedRows,
    allHashes,
    repeatedInFileHashes,
    uniqueImportableHashes,
    rowCount: input.parsed.rowCount,
    importedCount: importableCount,
    duplicateCount: skippedOrDuplicateCount,
    positiveTotal: toDbDecimal(positiveTotal),
    negativeTotal: toDbDecimal(negativeTotal),
    referenceStartedAt,
    referenceEndedAt,
  }
}

function applyExistingHashesToStats(stats: NormalizedImportStats, existingHashes: Set<string>): NormalizedImportStats {
  let existingDuplicateCount = 0
  for (const hash of stats.uniqueImportableHashes) {
    if (existingHashes.has(hash)) existingDuplicateCount += 1
  }

  if (existingDuplicateCount === 0) return stats

  return {
    ...stats,
    importedCount: Math.max(0, stats.importedCount - existingDuplicateCount),
    duplicateCount: stats.duplicateCount + existingDuplicateCount,
  }
}

const EMPTY_IMPORT_STATS: FullFileImportStats = {
  rowCount: 0,
  importedCount: 0,
  duplicateCount: 0,
  positiveTotal: '0.00',
  negativeTotal: '0.00',
  referenceStartedAt: null,
  referenceEndedAt: null,
}

export async function analyzeFile(input: {
  userId: string
  fileId: string
  selectedFormatVersionId?: number
}): Promise<ImportAnalysisResult> {
  const fileRow = await getFileForUser({ userId: input.userId, fileId: input.fileId })
  if (!fileRow) throw new Error('File not found or access denied.')

  await updateFileAnalysisState({
    userId: input.userId,
    fileId: input.fileId,
    status: 'analyzing',
  })

  let bytes: Buffer
  try {
    bytes = await readR2Bytes(fileRow.objectKey)
  } catch (error) {
    const msg = safeImportErrorMessage(error, 'Could not read uploaded file.')
    await markFileFailed({ userId: input.userId, fileId: input.fileId, errorMessage: msg })
    throw new Error(msg)
  }

  let parsed: ParsedImportFile
  try {
    parsed = await parseImportFile(bytes, { fileName: fileRow.originalName })
  } catch (error) {
    const msg = safeImportErrorMessage(error, 'Could not parse uploaded file.')
    await markFileFailed({ userId: input.userId, fileId: input.fileId, errorMessage: msg })
    throw new Error(msg)
  }

  const formats = await loadFormatVersions(input.selectedFormatVersionId)
  const detected = detectImportFormat({ parsed, formats, userId: input.userId })
  const best = detected.bestCandidate

  const provisionalStats = best
    ? deriveFullFileImportStats({ parsed, format: best, userId: input.userId })
    : { ...EMPTY_IMPORT_STATS, rowCount: parsed.rowCount, allHashes: [] as string[], normalizedRows: [], repeatedInFileHashes: new Set<string>(), uniqueImportableHashes: new Set<string>() }
  const existingHashes = await getDuplicateHashes(db, input.userId, provisionalStats.allHashes)
  const fullStats = best
    ? applyExistingHashesToStats(provisionalStats, existingHashes)
    : { ...EMPTY_IMPORT_STATS, rowCount: parsed.rowCount }

  const sampleRows = detected.preview.sampleRows.map((r) => ({
    rowIndex: r.rowIndex,
    description: r.description,
    amount: r.amount,
    occurredAt: r.occurredAt,
    duplicate: Boolean(r.transactionHash && (existingHashes.has(r.transactionHash) || provisionalStats.repeatedInFileHashes.has(r.transactionHash))),
    valid: r.valid,
    errors: r.errors,
    warnings: r.warnings,
  }))

  const safeErrorMessage = detected.errors[0] ? safeImportErrorMessage(detected.errors[0], 'Analysis failed.') : null

  await updateFileAnalysisState({
    userId: input.userId,
    fileId: input.fileId,
    status: detected.errors.length > 0 ? 'failed' : 'analyzed',
    rowCount: fullStats.rowCount,
    importedCount: 0,
    duplicateCount: fullStats.duplicateCount,
    positiveTotal: fullStats.positiveTotal,
    negativeTotal: fullStats.negativeTotal,
    referenceStartedAt: fullStats.referenceStartedAt,
    referenceEndedAt: fullStats.referenceEndedAt,
    importFormatVersionId: best?.formatVersionId ?? null,
    errorMessage: safeErrorMessage,
  })

  return {
    fileId: input.fileId,
    formatVersionId: best?.formatVersionId ?? null,
    platformName: best?.platform.name ?? null,
    rowCount: parsed.rowCount,
    duplicateCount: fullStats.duplicateCount,
    warnings: detected.warnings,
    errors: detected.errors,
    sampleRows,
  }
}

export async function importFile(input: {
  userId: string
  fileId: string
  selectedFormatVersionId?: number
  overrideWarnings?: boolean
  subscriptionPlan?: SubscriptionPlan
}): Promise<ImportFileResult> {
  const fileRow = await getFileForUser({ userId: input.userId, fileId: input.fileId })
  if (!fileRow) throw new Error('File not found or access denied.')

  await updateFileImportState({
    userId: input.userId,
    fileId: input.fileId,
    status: 'importing',
    importStartedAt: new Date(),
  })

  let bytes: Buffer
  try {
    bytes = await readR2Bytes(fileRow.objectKey)
  } catch (error) {
    const msg = safeImportErrorMessage(error, 'Could not read uploaded file.')
    await markFileFailed({ userId: input.userId, fileId: input.fileId, errorMessage: msg })
    throw new Error(msg)
  }

  let parsed: ParsedImportFile
  try {
    parsed = await parseImportFile(bytes, { fileName: fileRow.originalName })
  } catch (error) {
    const msg = safeImportErrorMessage(error, 'Could not parse uploaded file.')
    await markFileFailed({ userId: input.userId, fileId: input.fileId, errorMessage: msg })
    throw new Error(msg)
  }

  if (parsed.errors.length > 0) {
    const msg = safeImportErrorMessage(parsed.errors[0] ?? 'Parse error.', 'Parse error.')
    await updateFileImportState({
      userId: input.userId,
      fileId: input.fileId,
      status: 'failed',
      rowCount: parsed.rowCount,
      importedCount: 0,
      duplicateCount: parsed.rowCount,
      positiveTotal: '0.00',
      negativeTotal: '0.00',
      referenceStartedAt: null,
      referenceEndedAt: null,
      errorMessage: msg,
    })
    throw new Error(msg)
  }

  const formats = await loadFormatVersions(
    input.selectedFormatVersionId ?? fileRow.importFormatVersionId ?? undefined,
  )
  const detected = detectImportFormat({ parsed, formats, userId: input.userId })

  if (!detected.bestCandidate) {
    const msg = safeImportErrorMessage(detected.errors[0] ?? 'No matching import format found.', 'No matching import format found.')
    await updateFileImportState({
      userId: input.userId,
      fileId: input.fileId,
      status: 'failed',
      rowCount: parsed.rowCount,
      importedCount: 0,
      duplicateCount: parsed.rowCount,
      positiveTotal: '0.00',
      negativeTotal: '0.00',
      referenceStartedAt: null,
      referenceEndedAt: null,
      errorMessage: msg,
    })
    throw new Error(msg)
  }

  const best = detected.bestCandidate
  const plan = input.subscriptionPlan ?? 'free'

  try {
    const result = await db.transaction(async (tx) => {
      const patterns = await loadActivePatterns(tx, input.userId)

      const provisionalStats = deriveFullFileImportStats({ parsed, format: best, userId: input.userId })
      const existingHashes = await getDuplicateHashes(tx, input.userId, provisionalStats.allHashes)
      const fullStats = applyExistingHashesToStats(provisionalStats, existingHashes)

      // Build transaction rows and per-descriptionHash aggregation in a single pass over normalized rows
      const transactionRows: TransactionInsertData[] = []
      const acceptedHashes = new Set<string>()

      type ExpenseAccum = {
        description: string
        descriptionHash: string
        totalAmount: string
        firstOccurredAt: Date
        lastOccurredAt: Date
        txIds: string[]
      }
      const expenseAccumMap = new Map<string, ExpenseAccum>()

      for (const normalized of fullStats.normalizedRows) {
        if (!normalized.valid || !normalized.transactionHash || !normalized.amount || !normalized.occurredAt) {
          continue
        }

        if (existingHashes.has(normalized.transactionHash) || acceptedHashes.has(normalized.transactionHash)) {
          continue
        }
        acceptedHashes.add(normalized.transactionHash)

        const txId = crypto.randomUUID()
        const txData: TransactionInsertData = {
          id: txId,
          userId: input.userId,
          fileId: input.fileId,
          expenseId: null,
          transactionHash: normalized.transactionHash,
          description: normalized.description,
          descriptionHash: normalized.descriptionHash,
          amount: normalized.amount,
          occurredAt: normalized.occurredAt,
          rowIndex: normalized.rowIndex,
          rawRow: normalized.rawRow,
        }
        transactionRows.push(txData)

        const acc = expenseAccumMap.get(normalized.descriptionHash)
        if (acc) {
          acc.totalAmount = toDbDecimal(toDecimal(acc.totalAmount).plus(toDecimal(normalized.amount)))
          if (normalized.occurredAt < acc.firstOccurredAt) acc.firstOccurredAt = normalized.occurredAt
          if (normalized.occurredAt > acc.lastOccurredAt) acc.lastOccurredAt = normalized.occurredAt
          acc.txIds.push(txId)
        } else {
          expenseAccumMap.set(normalized.descriptionHash, {
            description: normalized.description,
            descriptionHash: normalized.descriptionHash,
            totalAmount: normalized.amount,
            firstOccurredAt: normalized.occurredAt,
            lastOccurredAt: normalized.occurredAt,
            txIds: [txId],
          })
        }
      }

      // Insert all transactions
      const insertedTxs = await insertTransactionBatch(tx, transactionRows)

      // Upsert expenses and write classification history
      const expenseIdMap = new Map<string, string>() // descriptionHash -> expenseId

      for (const [descHash, acc] of expenseAccumMap.entries()) {
        let catResult = null
        try {
          catResult = await categorizePipeline(tx, input.userId, plan, acc.description, acc.totalAmount, descHash, patterns)
        } catch {
          // categorization error — uncategorized, never fails import
        }

        // Upsert expense by (userId, descriptionHash) — check-then-update-or-insert
        const existing = await tx
          .select({ id: expense.id, totalAmount: expense.totalAmount, transactionCount: expense.transactionCount, subCategoryId: expense.subCategoryId })
          .from(expense)
          .where(and(eq(expense.userId, input.userId), eq(expense.descriptionHash, descHash)))
          .limit(1)
          .then((rows) => rows[0] ?? null)

        let expenseId: string
        if (existing) {
          expenseId = existing.id
          await tx
            .update(expense)
            .set({
              totalAmount: toDbDecimal(toDecimal(existing.totalAmount).plus(toDecimal(acc.totalAmount))),
              transactionCount: (existing.transactionCount ?? 0) + acc.txIds.length,
              lastTransactionAt: acc.lastOccurredAt,
              subCategoryId: catResult?.subCategoryId ?? existing.subCategoryId ?? null,
              status: catResult ? '3' : existing.subCategoryId ? '3' : '1',
              updatedAt: new Date(),
            })
            .where(and(eq(expense.id, expenseId), eq(expense.userId, input.userId)))
        } else {
          expenseId = crypto.randomUUID()
          await tx.insert(expense).values({
            id: expenseId,
            userId: input.userId,
            title: acc.description.slice(0, 120),
            descriptionHash: descHash,
            subCategoryId: catResult?.subCategoryId ?? null,
            totalAmount: acc.totalAmount,
            transactionCount: acc.txIds.length,
            importedFromFileId: input.fileId,
            firstTransactionAt: acc.firstOccurredAt,
            lastTransactionAt: acc.lastOccurredAt,
            status: catResult ? '3' : '1',
          })
        }

        expenseIdMap.set(descHash, expenseId)

        if (catResult) {
          try {
            await writeClassificationHistory(tx, {
              userId: input.userId,
              expenseId,
              toSubCategoryId: catResult.subCategoryId,
              toStatus: '3',
              source: catResult.source,
              patternId: catResult.patternId ?? null,
              confidence: catResult.confidence,
            })
          } catch {
            // history write failure is non-fatal
          }
        }
      }

      // Link transactions to their expense
      for (const txRow of insertedTxs) {
        const expenseId = expenseIdMap.get(txRow.descriptionHash)
        if (expenseId) {
          await tx
            .update(transactionTable)
            .set({ expenseId })
            .where(and(eq(transactionTable.id, txRow.id), eq(transactionTable.userId, input.userId)))
        }
      }

      await updateFileImportState({
        userId: input.userId,
        fileId: input.fileId,
        status: 'imported',
        rowCount: fullStats.rowCount,
        importedCount: insertedTxs.length,
        duplicateCount: fullStats.duplicateCount,
        positiveTotal: fullStats.positiveTotal,
        negativeTotal: fullStats.negativeTotal,
        referenceStartedAt: fullStats.referenceStartedAt,
        referenceEndedAt: fullStats.referenceEndedAt,
        importedAt: new Date(),
        errorMessage: null,
      })

      return {
        fileId: input.fileId,
        rowCount: fullStats.rowCount,
        duplicateCount: fullStats.duplicateCount,
        importedCount: insertedTxs.length,
        warnings: detected.warnings,
        errors: [],
      }
    })

    return result
  } catch (error) {
    const msg = safeImportErrorMessage(error, 'Import failed.')
    await markFileFailed({ userId: input.userId, fileId: input.fileId, errorMessage: msg })
    throw new Error(msg)
  }
}
