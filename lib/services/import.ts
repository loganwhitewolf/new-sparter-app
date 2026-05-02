import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  expense,
  expenseClassificationHistory,
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
import { parseImportFile } from '@/lib/services/import-parsers'
import { detectImportFormat } from '@/lib/services/import-format-detector'
import { readObjectBody } from '@/lib/services/r2'
import {
  categorizePipeline,
  loadActivePatterns,
  type SubscriptionPlan,
} from '@/lib/services/categorization'
import { normalizeTransactionRow } from '@/lib/utils/import'
import { toDbDecimal, toDecimal } from '@/lib/utils/decimal'

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
    const msg = error instanceof Error ? error.message : 'Could not read uploaded file.'
    await markFileFailed({ userId: input.userId, fileId: input.fileId, errorMessage: msg })
    throw new Error(msg)
  }

  const parsed = await parseImportFile(bytes, { fileName: fileRow.originalName })

  const formats = await loadFormatVersions(input.selectedFormatVersionId)
  const detected = detectImportFormat({ parsed, formats, userId: input.userId })
  const best = detected.bestCandidate

  const previewHashes = detected.preview.sampleRows
    .map((r) => r.transactionHash)
    .filter((h): h is string => Boolean(h))

  const existingHashes = await getDuplicateHashes(db, input.userId, previewHashes)

  const sampleRows = detected.preview.sampleRows.map((r) => ({
    rowIndex: r.rowIndex,
    description: r.description,
    amount: r.amount,
    occurredAt: r.occurredAt,
    duplicate: Boolean(r.transactionHash && existingHashes.has(r.transactionHash)),
    valid: r.valid,
    errors: r.errors,
    warnings: r.warnings,
  }))

  const duplicateCount = sampleRows.filter((r) => r.duplicate).length

  await updateFileAnalysisState({
    userId: input.userId,
    fileId: input.fileId,
    status: detected.errors.length > 0 ? 'failed' : 'analyzed',
    rowCount: parsed.rowCount,
    duplicateCount,
    importFormatVersionId: best?.formatVersionId ?? null,
    errorMessage: detected.errors[0] ?? null,
  })

  return {
    fileId: input.fileId,
    formatVersionId: best?.formatVersionId ?? null,
    platformName: best?.platform.name ?? null,
    rowCount: parsed.rowCount,
    duplicateCount,
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
    const msg = error instanceof Error ? error.message : 'Could not read uploaded file.'
    await markFileFailed({ userId: input.userId, fileId: input.fileId, errorMessage: msg })
    throw new Error(msg)
  }

  const parsed = await parseImportFile(bytes, { fileName: fileRow.originalName })

  if (parsed.errors.length > 0) {
    const msg = parsed.errors[0] ?? 'Parse error.'
    await markFileFailed({ userId: input.userId, fileId: input.fileId, errorMessage: msg })
    throw new Error(msg)
  }

  const formats = await loadFormatVersions(
    input.selectedFormatVersionId ?? fileRow.importFormatVersionId ?? undefined,
  )
  const detected = detectImportFormat({ parsed, formats, userId: input.userId })

  if (!detected.bestCandidate) {
    const msg = detected.errors[0] ?? 'No matching import format found.'
    await markFileFailed({ userId: input.userId, fileId: input.fileId, errorMessage: msg })
    throw new Error(msg)
  }

  const best = detected.bestCandidate
  const plan = input.subscriptionPlan ?? 'free'

  try {
    const result = await db.transaction(async (tx) => {
      const patterns = await loadActivePatterns(tx, input.userId)

      // Collect all transaction hashes for bulk duplicate check
      const allNormalized = parsed.rows
        .map((row, idx) =>
          normalizeTransactionRow(
            row,
            { ...best.platform, platformId: best.platformId },
            { userId: input.userId, rowIndex: idx + 1 },
          ),
        )

      const allHashes = allNormalized
        .map((n) => n.transactionHash)
        .filter((h): h is string => Boolean(h))

      const existingHashes = await getDuplicateHashes(tx, input.userId, allHashes)

      // Build transaction rows and per-descriptionHash aggregation in a single pass
      const transactionRows: TransactionInsertData[] = []
      let duplicateCount = 0

      type ExpenseAccum = {
        description: string
        descriptionHash: string
        totalAmount: string
        firstOccurredAt: Date
        lastOccurredAt: Date
        txIds: string[]
      }
      const expenseAccumMap = new Map<string, ExpenseAccum>()

      for (const normalized of allNormalized) {
        if (!normalized.valid || !normalized.transactionHash || !normalized.amount || !normalized.occurredAt) {
          continue
        }

        if (existingHashes.has(normalized.transactionHash)) {
          duplicateCount += 1
          continue
        }

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
          .select({ id: expense.id, amount: expense.amount, transactionCount: expense.transactionCount, subCategoryId: expense.subCategoryId })
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
              amount: toDbDecimal(toDecimal(existing.amount).plus(toDecimal(acc.totalAmount))),
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
            amount: acc.totalAmount,
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
            await tx.insert(expenseClassificationHistory).values({
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
        rowCount: parsed.rows.length,
        duplicateCount,
        importedAt: new Date(),
        errorMessage: null,
      })

      return {
        fileId: input.fileId,
        rowCount: parsed.rows.length,
        duplicateCount,
        importedCount: insertedTxs.length,
        warnings: detected.warnings,
        errors: [],
      }
    })

    return result
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Import failed.'
    await markFileFailed({ userId: input.userId, fileId: input.fileId, errorMessage: msg })
    throw new Error(msg)
  }
}
