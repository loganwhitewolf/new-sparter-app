/**
 * Trade Republic PDF parser.
 *
 * Converts Trade Republic bank statement PDF bytes into a ParsedImportFile
 * with synthetic headers, ready for the existing import pipeline (detector →
 * normalizeTransactionRow → dedup → preview) unchanged.
 *
 * Design constraints (ADR 0014, 57-CONTEXT.md):
 *   - Per-bank template: recognizes TR by document markers only.
 *   - Section isolation: extracts only the movements section (TR_MARKERS[1]); discards
 *     the summary/position sections (SECTION_END_PATTERNS).
 *   - Positional sign: credit/debit determined by X-coordinate band.
 *   - Balance chain: validated with Decimal.js before returning rows.
 *   - delimiter: null in output (scoreCandidate gives delimiterScore 1.0).
 *
 * X-coordinate column boundaries calibrated from:
 *   tests/fixtures/import/trade-republic-sample.pdf
 *   (22.7 KB, 4-page real TR statement, Italian locale, exported 2026-06-25)
 */

import { getDocumentProxy, extractTextItems } from 'unpdf'
import type { StructuredTextItem } from 'unpdf'
import Decimal from 'decimal.js'
import { parseItalianAmount } from '@/lib/utils/import'
import type { ParsedImportFile, ParsedImportRow, ParseImportFileOptions } from './import-parsers'

// ---------------------------------------------------------------------------
// Public constants
// ---------------------------------------------------------------------------

/**
 * Synthetic headers emitted by the parser.
 * MUST match the columns seeded in the Trade Republic import_format_version row.
 */
export const TR_SYNTHETIC_HEADERS = ['data', 'descrizione', 'importo_entrata', 'importo_uscita'] as const

/**
 * Maximum number of PDF pages accepted before rejecting the file.
 * Trade Republic statements are typically 2–10 pages; 50 is a defensive ceiling.
 */
export const MAX_PDF_PAGES = 50

// ---------------------------------------------------------------------------
// X-coordinate column boundaries
// Calibrated from: tests/fixtures/import/trade-republic-sample.pdf
// ---------------------------------------------------------------------------

/**
 * Left edge of the IN ENTRATA (credit) column.
 * Observed: header "IN ENTRATA" at x=405.8; values at x≈405.8.
 */
export const CREDIT_X_MIN = 395

/**
 * Right edge of the IN ENTRATA (credit) column (exclusive).
 * The IN USCITA header starts at x=448.9, so credit ends before that.
 */
export const CREDIT_X_MAX = 440

/**
 * Left edge of the IN USCITA (debit) column.
 * Observed: header "IN USCITA" at x=448.9; values at x≈448.9.
 */
export const DEBIT_X_MIN = 440

/**
 * Right edge of the IN USCITA (debit) column (exclusive).
 * Balance values start at x≈479.1, so debit ends before that.
 */
export const DEBIT_X_MAX = 470

/**
 * Left edge of the SALDO (running balance) column.
 * Observed: header "SALDO" at x=501.2; values at x≈479.1–483.4
 * (amount width causes left edge to vary — use a lower bound).
 */
export const BALANCE_X_MIN = 470

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type AmountColumnKind = 'credit' | 'debit' | 'balance' | 'other'

/** @internal — exported only for unit tests of validateBalanceChain. */
export interface ExtractedRow {
  data: string
  descrizione: string
  importo_entrata: string
  importo_uscita: string
  /** Running balance token extracted from the SALDO column — used for chain validation. */
  runningBalance: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Document markers that must be present for the file to be recognized as
 * a Trade Republic Italian statement.
 */
const TR_MARKERS = ['TRADE REPUBLIC', 'TRANSAZIONI SUL CONTO'] as const

/**
 * Section header tokens that terminate the movements section.
 * Any item whose str contains one of these strings ends the movements section (TR_MARKERS[1]).
 */
const SECTION_END_PATTERNS = [
  'PANORAMICA',
  'RIEPILOGO DEL PORTAFOGLIO',
  'POSIZIONI',
  'PANORAMICA DEL SALDO',
] as const

/** Row Y-axis grouping tolerance in PDF points. */
const Y_TOLERANCE = 3

/** Minimum X for a token to be considered part of the data columns (excludes page decorations). */
const DATA_X_MIN = 60

/** Maximum X for a date token (leftmost data column). */
const DATE_X_MAX = 120

/** Maximum X for a tipo (movement type) token. */
const TIPO_X_MAX = 163

/**
 * Regex matching a TR date token: "DD MMM YYYY" (e.g. "01 gen 2024").
 * Also matches when the date is fused with following content (e.g. "01 gen 2024 Interessi"),
 * which occurs on some page layouts where the PDF text renderer merges adjacent tokens.
 */
const DATE_PATTERN = /^\d{1,2}\s+\w{3,9}\s+\d{4}/

/** Extracts the date portion from a potentially fused date+tipo token. */
const DATE_EXTRACT = /^(\d{1,2}\s+\w{3,9}\s+\d{4})/

function classifyAmountColumn(item: StructuredTextItem): AmountColumnKind {
  const x = item.x
  if (x >= CREDIT_X_MIN && x < CREDIT_X_MAX) return 'credit'
  if (x >= DEBIT_X_MIN && x < DEBIT_X_MAX) return 'debit'
  if (x >= BALANCE_X_MIN) return 'balance'
  return 'other'
}

/**
 * Returns true if the item looks like a numeric amount token
 * (contains digits after stripping € and whitespace).
 */
function isAmountToken(item: StructuredTextItem): boolean {
  const raw = item.str.replace(/[€\s]/g, '')
  return /^-?[\d.,]+$/.test(raw)
}

/**
 * Returns true if the item is a section-end marker.
 */
function isSectionEnd(str: string): boolean {
  return SECTION_END_PATTERNS.some(p => str.toUpperCase().includes(p))
}

/**
 * Returns true if the item is a column header row token (DATA, TIPO, DESCRIZIONE, etc.).
 * Header rows appear at the top of each page's section and should not produce movement rows.
 */
function isColumnHeader(str: string): boolean {
  const HEADER_TOKENS = ['DATA', 'TIPO', 'DESCRIZIONE', 'IN ENTRATA', 'IN USCITA', 'SALDO']
  return HEADER_TOKENS.includes(str.trim())
}

/**
 * Given a list of items from a single page of the movements section,
 * group them into logical rows by Y coordinate proximity (Y-axis bucketing).
 *
 * PDF Y=0 is at the bottom; items are sorted by y DESCENDING to get
 * top-to-bottom reading order (Pitfall 1).
 *
 * IMPORTANT: call this per-page, not on a flat cross-page list. Cross-page
 * merging would mix Y values from different pages and produce incorrect row order.
 */
function groupPageItemsIntoRows(items: StructuredTextItem[]): StructuredTextItem[][] {
  // Sort descending by y (top of page = highest y)
  const sorted = [...items].sort((a, b) => b.y - a.y)

  const rowBuckets: StructuredTextItem[][] = []
  let currentBucket: StructuredTextItem[] = []
  let currentY: number | null = null

  for (const item of sorted) {
    if (currentY === null || Math.abs(item.y - currentY) <= Y_TOLERANCE) {
      currentBucket.push(item)
      // Use first item's y as the bucket reference
      if (currentY === null) currentY = item.y
    } else {
      if (currentBucket.length > 0) rowBuckets.push(currentBucket)
      currentBucket = [item]
      currentY = item.y
    }
  }
  if (currentBucket.length > 0) rowBuckets.push(currentBucket)

  return rowBuckets
}

/**
 * Extract items belonging to the movements section (TR_MARKERS[1]) from all pages.
 * Discards the summary/mirror section and all other non-movements sections (Pitfall 3).
 *
 * Returns a list of per-page item arrays so that row-grouping can be done
 * correctly within each page boundary (avoids mixing Y values from different
 * pages, which would corrupt reading order).
 *
 * TR PDFs may contain the section across multiple pages — we collect items
 * from all pages until a section-end marker is found.
 */
function extractSectionItemsByPage(allPageItems: StructuredTextItem[][]): StructuredTextItem[][] {
  const resultByPage: StructuredTextItem[][] = []
  let inSection = false

  for (const pageItems of allPageItems) {
    const pageResult: StructuredTextItem[] = []

    for (const item of pageItems) {
      const str = item.str

      // Detect section start
      if (!inSection && str.includes('TRANSAZIONI SUL CONTO')) {
        inSection = true
        // Do not include the header item itself — it's a label, not data
        continue
      }

      if (!inSection) continue

      // Detect section end
      if (isSectionEnd(str)) {
        // Continue scanning other pages (section may restart on next page)
        inSection = false
        continue
      }

      // Skip column header rows
      if (isColumnHeader(str)) continue

      // Skip page decoration items (page numbers, dates outside data range)
      if (item.x < DATA_X_MIN && !str.trim()) continue

      pageResult.push(item)
    }

    if (pageResult.length > 0) {
      resultByPage.push(pageResult)
    }
  }

  return resultByPage
}

/**
 * Convert a row bucket (items sharing the same Y baseline) into an ExtractedRow.
 * Returns null if the row does not look like a movement row (e.g. empty or decorative).
 */
function parseRowBucket(bucket: StructuredTextItem[]): ExtractedRow | null {
  // Sort within bucket by x ascending (left to right)
  const sorted = [...bucket].sort((a, b) => a.x - b.x)

  let data = ''
  let descrizione = ''
  let importo_entrata = ''
  let importo_uscita = ''
  let runningBalance = ''

  // Accumulate description tokens (between date/tipo range and credit column)
  const descParts: string[] = []

  for (const item of sorted) {
    const str = item.str.trim()
    if (!str) continue

    // Date token (leftmost column).
    // Some page layouts fuse date+tipo+description into one token (e.g. "14 mag 2026 Rendimento Cash Dividend for ISIN US0378331005").
    // Extract the date, strip the next word as tipo, and keep any remainder as description.
    if (DATE_PATTERN.test(str) && item.x < DATE_X_MAX) {
      const match = DATE_EXTRACT.exec(str)
      data = match ? match[1]! : str
      if (match) {
        const remainder = str.slice(match[0].length).trim()
        if (remainder) {
          // remainder = "Rendimento Cash Dividend ..." — first word is tipo, rest is description
          const spaceIdx = remainder.indexOf(' ')
          const descPart = spaceIdx >= 0 ? remainder.slice(spaceIdx + 1).trim() : ''
          if (descPart) descParts.push(descPart)
        }
      }
      continue
    }

    // Amount-like tokens get classified by X position
    if (isAmountToken(item)) {
      const kind = classifyAmountColumn(item)
      if (kind === 'credit') {
        importo_entrata = str
        continue
      }
      if (kind === 'debit') {
        importo_uscita = str
        continue
      }
      if (kind === 'balance') {
        runningBalance = str
        continue
      }
    }

    // Everything between TIPO_X_MAX and CREDIT_X_MIN is description
    if (item.x >= TIPO_X_MAX && item.x < CREDIT_X_MIN) {
      descParts.push(str)
      continue
    }

    // Tipo column — first word is the movement type (skip), but some layouts fuse tipo+description
    // into a single token starting in this range (e.g. "Rendimento Cash Dividend for ISIN US…").
    // Strip the tipo word and keep any remainder as description.
    if (item.x >= DATA_X_MIN && item.x < TIPO_X_MAX) {
      const spaceIdx = str.indexOf(' ')
      if (spaceIdx >= 0) {
        const descPart = str.slice(spaceIdx + 1).trim()
        if (descPart) descParts.push(descPart)
      }
      continue
    }
  }

  descrizione = descParts.join(' ').trim()

  // A row without a date is not a movement row (likely a continuation label)
  if (!data) return null

  return {
    data,
    descrizione,
    importo_entrata,
    importo_uscita,
    runningBalance,
  }
}

/**
 * Validate the running-balance chain using Decimal.js.
 * For each consecutive pair: prev_balance + signed_amount === curr_balance.
 *
 * Per D-03 / T-57-03-01: any mismatch returns an explicit error — never
 * silently import wrong numbers.
 *
 * Exported for unit testing — callers should use parseTradeRepublicPdf instead.
 *
 * @returns null if valid, or an error string on mismatch.
 */
export function validateBalanceChain(rows: ExtractedRow[]): string | null {
  if (rows.length < 2) return null

  for (let i = 1; i < rows.length; i++) {
    const prevRow = rows[i - 1]!
    const currRow = rows[i]!

    const prevBalanceStr = parseItalianAmount(prevRow.runningBalance)
    const currBalanceStr = parseItalianAmount(currRow.runningBalance)

    // If either balance is missing, skip this pair (balance column may be absent for some rows)
    if (!prevBalanceStr || !currBalanceStr) continue

    // Determine signed amount for the current row
    const creditStr = parseItalianAmount(currRow.importo_entrata)
    const debitStr = parseItalianAmount(currRow.importo_uscita)

    let signedAmountStr: string | null = null
    if (creditStr && creditStr !== '0.00') {
      signedAmountStr = creditStr // positive
    } else if (debitStr && debitStr !== '0.00') {
      // Debit amounts are positive in the PDF column; they are stored as positive here
      // but represent money leaving the account. For balance chain: prev - debit = curr.
      signedAmountStr = new Decimal(debitStr).neg().toFixed(2)
    }

    if (!signedAmountStr) continue

    // Compute expected balance using Decimal.js (CLAUDE.md hard rule: no native arithmetic)
    const prevBalance = new Decimal(prevBalanceStr)
    const signedAmount = new Decimal(signedAmountStr)
    const expectedBalance = prevBalance.plus(signedAmount)
    const currBalance = new Decimal(currBalanceStr)

    if (!expectedBalance.eq(currBalance)) {
      return (
        `Balance chain mismatch at row ${i + 1}: ` +
        `expected ${prevBalance.toFixed(2)} + ${signedAmount.toFixed(2)} = ${expectedBalance.toFixed(2)}, ` +
        `got ${currBalance.toFixed(2)}`
      )
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type ParseTradeRepublicPdfOptions = Pick<ParseImportFileOptions, 'fileName' | 'sampleSize'>

/**
 * Parse Trade Republic bank statement PDF bytes into a ParsedImportFile.
 *
 * @param bytes - Raw PDF bytes (Buffer or compatible ArrayBufferLike).
 * @param options - Must include fileName; sampleSize defaults to 25.
 * @returns ParsedImportFile with synthetic headers and delimiter: null.
 */
export async function parseTradeRepublicPdf(
  bytes: Buffer | Uint8Array,
  options: ParseTradeRepublicPdfOptions,
): Promise<ParsedImportFile> {
  const sampleSize = options.sampleSize ?? 25
  const byteLength = bytes.byteLength

  function errorResult(errors: string[]): ParsedImportFile {
    return {
      fileName: options.fileName,
      byteLength,
      encoding: null,
      delimiter: null,
      headers: [...TR_SYNTHETIC_HEADERS],
      rows: [],
      rowCount: 0,
      sampleRows: [],
      warnings: [],
      errors,
    }
  }

  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>

  try {
    pdf = await getDocumentProxy(new Uint8Array(bytes))
  } catch (err) {
    return errorResult([
      `Failed to open PDF: ${err instanceof Error ? err.message : 'unknown error'}`,
    ])
  }

  // T-57-03-02: page ceiling check before any extraction (D-05)
  if (pdf.numPages > MAX_PDF_PAGES) {
    return errorResult([
      `PDF has ${pdf.numPages} pages, which exceeds the maximum of ${MAX_PDF_PAGES} pages. ` +
        'Please split the file before importing.',
    ])
  }

  // Extract positioned tokens from all pages
  let allPageItems: StructuredTextItem[][]
  try {
    const { items } = await extractTextItems(pdf)
    allPageItems = items
  } catch (err) {
    return errorResult([
      `Failed to extract text from PDF: ${err instanceof Error ? err.message : 'unknown error'}`,
    ])
  }

  // Flatten all tokens for marker detection
  const allTokens = allPageItems.flat()
  const fullText = allTokens.map(t => t.str).join(' ')

  // D-01: verify both TR markers are present
  const missingMarkers = TR_MARKERS.filter(marker => !fullText.includes(marker))
  if (missingMarkers.length > 0) {
    return errorResult([
      `This does not appear to be a Trade Republic bank statement. ` +
        `Missing document markers: ${missingMarkers.join(', ')}.`,
    ])
  }

  // Isolate the movements section items, grouped by page (Pitfall 3)
  const sectionItemsByPage = extractSectionItemsByPage(allPageItems)

  if (sectionItemsByPage.length === 0 || sectionItemsByPage.every(p => p.length === 0)) {
    return errorResult([
      'Could not find any items in the TRANSAZIONI SUL CONTO section.',
    ])
  }

  // Group items into row buckets per page, then concatenate in page order.
  // This preserves correct top-to-bottom reading order across pages without
  // mixing Y values from different pages (which would corrupt chronological order).
  const rowBuckets: StructuredTextItem[][] = []
  for (const pageItems of sectionItemsByPage) {
    const pageBuckets = groupPageItemsIntoRows(pageItems)
    rowBuckets.push(...pageBuckets)
  }

  // Convert each bucket to an ExtractedRow
  const extractedRows: ExtractedRow[] = []
  for (const bucket of rowBuckets) {
    const row = parseRowBucket(bucket)
    if (row) extractedRows.push(row)
  }

  if (extractedRows.length === 0) {
    return errorResult([
      'No movement rows could be extracted from the TRANSAZIONI SUL CONTO section.',
    ])
  }

  // Validate balance chain with Decimal.js (T-57-03-01)
  const chainError = validateBalanceChain(extractedRows)
  if (chainError) {
    return errorResult([chainError])
  }

  // Build warnings
  const warnings: string[] = []

  // Convert ExtractedRows to ParsedImportRows (emit the 4 synthetic columns only)
  const rows: ParsedImportRow[] = extractedRows.map((r, idx) => {
    // Sanity check: warn if both credit and debit are empty for a row with a description
    if (r.importo_entrata === '' && r.importo_uscita === '' && r.descrizione) {
      warnings.push(
        `Row ${idx + 1} (${r.data}): both importo_entrata and importo_uscita are empty — ` +
          'column boundaries may be miscalibrated (Pitfall 4).',
      )
    }

    return {
      data: r.data,
      descrizione: r.descrizione,
      importo_entrata: r.importo_entrata,
      importo_uscita: r.importo_uscita,
    }
  })

  return {
    fileName: options.fileName,
    byteLength,
    encoding: null,
    delimiter: null, // Pitfall 5: must be null for delimiterScore = 1.0
    headers: [...TR_SYNTHETIC_HEADERS],
    rows,
    rowCount: rows.length,
    sampleRows: rows.slice(0, sampleSize),
    warnings,
    errors: [],
  }
}
