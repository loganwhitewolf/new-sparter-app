import { computeTransactionHash, normalizeTransactionRow, parseBankDate, parseItalianAmount, type ImportPlatformConfig } from '../utils/import'
import type { ParsedImportFile, ParsedImportRow } from './import-parsers'

export type ImportFormatCandidateInput = {
  id: number
  platformId: number
  version: number
  headerSignature: string
  isActive?: boolean
  platform: ImportPlatformConfig & {
    id: number
    name: string
    slug: string
    delimiter: string
    country?: string
  }
}

export type ImportFormatCandidate = {
  formatVersionId: number
  platformId: number
  version: number
  platform: ImportFormatCandidateInput['platform']
  confidence: number
  matchedHeaders: string[]
  missingHeaders: string[]
  warnings: string[]
  sampleValidity: {
    rowsChecked: number
    validRows: number
    invalidRows: number
  }
}

export type ImportPreviewRow = {
  rowIndex: number
  description: string
  amount: string | null
  occurredAt: string | null
  transactionHash: string | null
  duplicate: boolean
  valid: boolean
  errors: string[]
  warnings: string[]
  rawRow: Record<string, string | number | null>
}

export type ImportPreview = {
  rowCount: number
  sampleRows: ImportPreviewRow[]
  duplicateCount: number
  warnings: string[]
}

export type DetectImportFormatResult = {
  bestCandidate: ImportFormatCandidate | null
  candidates: ImportFormatCandidate[]
  preview: ImportPreview
  warnings: string[]
  errors: string[]
}

const MIN_CONFIDENCE = 0.8
const PREVIEW_SAMPLE_SIZE = 25

function requiredColumns(format: ImportFormatCandidateInput): string[] {
  return [
    format.platform.timestampColumn,
    format.platform.descriptionColumn,
    format.platform.amountColumn,
    format.platform.positiveAmountColumn,
    format.platform.negativeAmountColumn,
  ].filter((column): column is string => Boolean(column))
}

function normalizeHeader(header: string) {
  return header.trim().toLocaleLowerCase('it-IT')
}

function headerLookup(headers: string[]) {
  return new Map(headers.map((header) => [normalizeHeader(header), header]))
}

function hasValue(row: ParsedImportRow, column: string | null) {
  return Boolean(column && String(row[column] ?? '').trim())
}

function scoreCandidate(parsed: ParsedImportFile, format: ImportFormatCandidateInput): ImportFormatCandidate {
  const warnings: string[] = []
  const lookup = headerLookup(parsed.headers)
  const required = requiredColumns(format)
  const matchedHeaders = required.filter((column) => lookup.has(normalizeHeader(column)))
  const missingHeaders = required.filter((column) => !lookup.has(normalizeHeader(column)))
  const headerScore = required.length === 0 ? 0 : matchedHeaders.length / required.length

  if (parsed.delimiter && parsed.delimiter !== format.platform.delimiter) {
    warnings.push(`Detected delimiter ${JSON.stringify(parsed.delimiter)} differs from seeded delimiter ${JSON.stringify(format.platform.delimiter)}.`)
  }

  let rowsChecked = 0
  let validRows = 0
  let amountShapeRows = 0
  for (const row of parsed.sampleRows.slice(0, PREVIEW_SAMPLE_SIZE)) {
    rowsChecked += 1
    const dateOk = Boolean(parseBankDate(row[format.platform.timestampColumn]))
    const descriptionOk = hasValue(row, format.platform.descriptionColumn)
    let amountOk = false
    if (format.platform.amountType === 'single') {
      amountOk = Boolean(parseItalianAmount(row[format.platform.amountColumn ?? '']))
    } else {
      const positive = parseItalianAmount(row[format.platform.positiveAmountColumn ?? ''])
      const negative = parseItalianAmount(row[format.platform.negativeAmountColumn ?? ''])
      amountOk = Boolean(positive || negative)
      if (positive || negative) amountShapeRows += 1
    }
    if (format.platform.amountType === 'single' && amountOk) amountShapeRows += 1
    if (dateOk && descriptionOk && amountOk) validRows += 1
  }

  const parseScore = rowsChecked === 0 ? 0 : validRows / rowsChecked
  const amountShapeScore = rowsChecked === 0 ? 0 : amountShapeRows / rowsChecked
  const delimiterScore = !parsed.delimiter || parsed.delimiter === format.platform.delimiter ? 1 : 0.75
  const signatureScore = parsed.headers.join(format.platform.delimiter) === format.headerSignature ? 1 : headerScore
  const confidence = Number(
    Math.min(1, headerScore * 0.45 + parseScore * 0.3 + amountShapeScore * 0.15 + delimiterScore * 0.05 + signatureScore * 0.05).toFixed(2),
  )

  if (missingHeaders.length > 0) warnings.push(`Missing expected columns: ${missingHeaders.join(', ')}.`)
  if (rowsChecked > 0 && validRows === 0) warnings.push('No sampled rows parsed as valid transactions for this format.')

  return {
    formatVersionId: format.id,
    platformId: format.platformId,
    version: format.version,
    platform: format.platform,
    confidence,
    matchedHeaders,
    missingHeaders,
    warnings,
    sampleValidity: {
      rowsChecked,
      validRows,
      invalidRows: rowsChecked - validRows,
    },
  }
}

function buildPreview(parsed: ParsedImportFile, best: ImportFormatCandidate | null, userId: string): ImportPreview {
  const warnings = [...parsed.warnings]
  if (!best) {
    return {
      rowCount: parsed.rowCount,
      sampleRows: parsed.sampleRows.map((row, index) => ({
        rowIndex: index + 1,
        description: '',
        amount: null,
        occurredAt: null,
        transactionHash: null,
        duplicate: false,
        valid: false,
        errors: ['No supported import format matched this row.'],
        warnings: [],
        rawRow: row,
      })),
      duplicateCount: 0,
      warnings,
    }
  }

  const seenHashes = new Set<string>()
  let duplicateCount = 0
  const sampleRows = parsed.sampleRows.slice(0, PREVIEW_SAMPLE_SIZE).map((row, index) => {
    const normalized = normalizeTransactionRow(row, { ...best.platform, platformId: best.platformId }, { userId, rowIndex: index + 1 })
    let transactionHash = normalized.transactionHash
    if (!transactionHash && normalized.occurredAt && normalized.amount && normalized.description) {
      transactionHash = computeTransactionHash({
        userId,
        platformId: best.platformId,
        occurredAt: normalized.occurredAt,
        amount: normalized.amount,
        description: normalized.description,
      })
    }
    const duplicate = Boolean(transactionHash && seenHashes.has(transactionHash))
    if (transactionHash) seenHashes.add(transactionHash)
    if (duplicate) duplicateCount += 1

    return {
      rowIndex: normalized.rowIndex,
      description: normalized.description,
      amount: normalized.amount,
      occurredAt: normalized.occurredAt?.toISOString() ?? null,
      transactionHash,
      duplicate,
      valid: normalized.valid,
      errors: normalized.errors,
      warnings: normalized.warnings,
      rawRow: normalized.rawRow,
    }
  })

  return {
    rowCount: parsed.rowCount,
    sampleRows,
    duplicateCount,
    warnings,
  }
}

export function detectImportFormat(input: {
  parsed: ParsedImportFile
  formats: ImportFormatCandidateInput[]
  userId: string
}): DetectImportFormatResult {
  const activeFormats = input.formats.filter((format) => format.isActive !== false)
  const candidates = activeFormats
    .map((format) => scoreCandidate(input.parsed, format))
    .sort((a, b) => b.confidence - a.confidence || a.platform.name.localeCompare(b.platform.name))

  const bestCandidate = candidates[0] && candidates[0].confidence >= MIN_CONFIDENCE ? candidates[0] : null
  const errors = [...input.parsed.errors]
  if (!bestCandidate && input.parsed.errors.length === 0) {
    errors.push('No supported import format matched the uploaded file headers and sample rows.')
  }

  const preview = buildPreview(input.parsed, bestCandidate, input.userId)

  return {
    bestCandidate,
    candidates,
    preview,
    warnings: [...input.parsed.warnings, ...(bestCandidate?.warnings ?? [])],
    errors,
  }
}
