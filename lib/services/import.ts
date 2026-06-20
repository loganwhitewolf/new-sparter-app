import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  expense,
  transaction as transactionTable,
} from '@/lib/db/schema'
import {
  getFileForUser,
  getPlatformIdForUserFile,
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
import {
  detectPatternSuggestions,
  type PatternDetectorRow,
  type PatternSuggestion,
} from '@/lib/utils/pattern-suggestions'
import { normalizeTransactionRow } from '@/lib/utils/import'
import { toDbDecimal, toDecimal } from '@/lib/utils/decimal'
import { writeClassificationHistory } from '@/lib/dal/classification-history'
import { loadImportFormatsForDetection } from '@/lib/dal/import-formats'
import { logger } from '@/lib/logger'
import { discoverRegexCandidates } from '@/lib/services/regex-discovery'

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
  patternSuggestions: PatternSuggestion[]
}

export type ImportFileResult = {
  fileId: string
  rowCount: number
  duplicateCount: number
  importedCount: number
  warnings: string[]
  errors: string[]
  discoveryCount: number
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

type ImportRetryLogCode =
  | 'selected_format_inaccessible'
  | 'no_matching_format'
  | 'analysis_failed'
  | 'import_failed'

function logImportRetry(
  level: 'info' | 'warn' | 'error',
  event: string,
  fields: {
    userId: string
    fileId: string
    formatVersionId?: number
    code?: ImportRetryLogCode
  },
) {
  logger[level]({ event, ...fields })
}

function safeImportErrorMessage(
  error: unknown,
  fallback: string,
  options: { exposeMessage?: boolean } = { exposeMessage: true },
): string {
  const raw = options.exposeMessage === false
    ? fallback
    : error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : fallback
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

const ANALYSIS_ALLOWED_STATUSES = new Set(['uploaded', 'failed', 'analyzed'])
const IMPORT_ALLOWED_STATUSES = new Set(['analyzed'])

export async function analyzeFile(input: {
  userId: string
  fileId: string
  selectedFormatVersionId?: number
  skipPatternSuggestions?: boolean
}): Promise<ImportAnalysisResult> {
  const fileRow = await getFileForUser({ userId: input.userId, fileId: input.fileId })
  if (!fileRow) throw new Error('File not found or access denied.')

  if (!ANALYSIS_ALLOWED_STATUSES.has(fileRow.status)) {
    throw new Error('Analisi non consentita per questo file nel suo stato attuale.')
  }

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
    const msg = safeImportErrorMessage(error, 'Could not parse uploaded file.', { exposeMessage: false })
    await markFileFailed({ userId: input.userId, fileId: input.fileId, errorMessage: msg })
    throw new Error(msg)
  }

  const selectedFormatVersionId = input.selectedFormatVersionId ?? fileRow.importFormatVersionId ?? undefined
  const formats = await loadImportFormatsForDetection({
    userId: input.userId,
    selectedFormatVersionId,
  })
  if (selectedFormatVersionId !== undefined && formats.length === 0) {
    logImportRetry('warn', 'import_format_wizard.retry_failed', {
      userId: input.userId,
      fileId: input.fileId,
      formatVersionId: selectedFormatVersionId,
      code: 'selected_format_inaccessible',
    })
  }
  const detected = detectImportFormat({ parsed, formats, userId: input.userId })
  const best = detected.bestCandidate

  const provisionalStats = best
    ? deriveFullFileImportStats({ parsed, format: best, userId: input.userId })
    : { ...EMPTY_IMPORT_STATS, rowCount: parsed.rowCount, allHashes: [] as string[], normalizedRows: [], repeatedInFileHashes: new Set<string>(), uniqueImportableHashes: new Set<string>() }
  const existingHashes = await getDuplicateHashes(db, input.userId, provisionalStats.allHashes)
  const fullStats = best
    ? applyExistingHashesToStats(provisionalStats, existingHashes)
    : { ...EMPTY_IMPORT_STATS, rowCount: parsed.rowCount }

  let patternSuggestions: PatternSuggestion[] = []
  // TODO Phase 55: remove — regex discovery now runs post-import via discoverRegexCandidates in lib/services/regex-discovery.ts (PIPE-01/02)
  if (best && !input.skipPatternSuggestions) {
    try {
      const activePatterns = await loadActivePatterns(db, input.userId)
      const detectorRows: PatternDetectorRow[] = provisionalStats.normalizedRows.map((r) => ({
        description: r.description,
        normalizedDescription: r.normalizedDescription,
        amount: r.amount,
        valid: r.valid,
        covered: false,
      }))
      const raw = detectPatternSuggestions(detectorRows, activePatterns)
      patternSuggestions = raw
        .sort((a, b) => b.matchCount - a.matchCount)
        .slice(0, 5)
    } catch (error) {
      const msg = safeImportErrorMessage(error, 'Pattern suggestion detection failed.', { exposeMessage: false })
      logger.warn({
        event: 'pattern_suggestion_detection_failed',
        message: msg,
        userId: input.userId,
        fileId: input.fileId,
      })
    }
  }

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

  if (selectedFormatVersionId !== undefined) {
    if (best) {
      logImportRetry('info', 'import_format_wizard.retry_analyzed', {
        userId: input.userId,
        fileId: input.fileId,
        formatVersionId: best.formatVersionId,
      })
    } else if (formats.length > 0) {
      logImportRetry('warn', 'import_format_wizard.retry_failed', {
        userId: input.userId,
        fileId: input.fileId,
        formatVersionId: selectedFormatVersionId,
        code: 'no_matching_format',
      })
    }
  }

  return {
    fileId: input.fileId,
    formatVersionId: best?.formatVersionId ?? null,
    platformName: best?.platform.name ?? null,
    rowCount: parsed.rowCount,
    duplicateCount: fullStats.duplicateCount,
    warnings: detected.warnings,
    errors: detected.errors,
    sampleRows,
    patternSuggestions,
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

  if (!IMPORT_ALLOWED_STATUSES.has(fileRow.status)) {
    throw new Error('Importazione non consentita per questo file nel suo stato attuale.')
  }

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
    const msg = safeImportErrorMessage(error, 'Could not parse uploaded file.', { exposeMessage: false })
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

  const selectedFormatVersionId = input.selectedFormatVersionId ?? fileRow.importFormatVersionId ?? undefined
  const formats = await loadImportFormatsForDetection({
    userId: input.userId,
    selectedFormatVersionId,
  })
  if (selectedFormatVersionId !== undefined && formats.length === 0) {
    logImportRetry('warn', 'import_format_wizard.retry_failed', {
      userId: input.userId,
      fileId: input.fileId,
      formatVersionId: selectedFormatVersionId,
      code: 'selected_format_inaccessible',
    })
  }
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
    if (selectedFormatVersionId !== undefined && formats.length > 0) {
      logImportRetry('warn', 'import_format_wizard.retry_failed', {
        userId: input.userId,
        fileId: input.fileId,
        formatVersionId: selectedFormatVersionId,
        code: 'no_matching_format',
      })
    }
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
        importFormatVersionId: best.formatVersionId,
        importedAt: new Date(),
        errorMessage: null,
      })

      if (selectedFormatVersionId !== undefined) {
        logImportRetry('info', 'import_format_wizard.retry_imported', {
          userId: input.userId,
          fileId: input.fileId,
          formatVersionId: best.formatVersionId,
        })
      }

      return {
        fileId: input.fileId,
        rowCount: fullStats.rowCount,
        duplicateCount: fullStats.duplicateCount,
        importedCount: insertedTxs.length,
        warnings: detected.warnings,
        errors: [],
      }
    })

    // TRIG-01: run discovery post-commit (outside db.transaction — service contract forbids tx handle)
    // Non-fatal: import is already committed; discovery failure must not throw.
    let discoveryCount = 0
    try {
      const platformId = await getPlatformIdForUserFile({ userId: input.userId, fileId: input.fileId })
      if (platformId != null) {
        const discovery = await discoverRegexCandidates({ userId: input.userId, scope: { platformId } })
        discoveryCount = discovery.candidates.length + discovery.singleCategorizationSuggestions.length
      }
    } catch (err) {
      logger.warn({
        event: 'post_import_discovery_failed',
        message: err instanceof Error ? err.message : String(err),
        userId: input.userId,
        fileId: input.fileId,
      })
    }

    return { ...result, discoveryCount }
  } catch (error) {
    const msg = safeImportErrorMessage(error, 'Import failed.')
    await markFileFailed({ userId: input.userId, fileId: input.fileId, errorMessage: msg })
    if (selectedFormatVersionId !== undefined) {
      logImportRetry('error', 'import_format_wizard.retry_failed', {
        userId: input.userId,
        fileId: input.fileId,
        formatVersionId: selectedFormatVersionId,
        code: 'import_failed',
      })
    }
    throw new Error(msg)
  }
}
