import { parse } from 'csv-parse/sync'
import { detect } from 'chardet'
import iconv from 'iconv-lite'
import { readSheet } from 'read-excel-file/node'

export type ParsedImportRow = Record<string, string>

export type ParsedImportFile = {
  fileName: string
  byteLength: number
  encoding: string | null
  delimiter: string | null
  headers: string[]
  rows: ParsedImportRow[]
  rowCount: number
  sampleRows: ParsedImportRow[]
  warnings: string[]
  errors: string[]
}

export type ParseImportFileOptions = {
  fileName: string
  maxBytes?: number
  maxRows?: number
  sampleSize?: number
  warningLimit?: number
}

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024
const DEFAULT_MAX_ROWS = 10_000
const DEFAULT_SAMPLE_SIZE = 25
const DEFAULT_WARNING_LIMIT = 20
const DELIMITERS = [',', ';', '\t', '|'] as const

function boundedPush(messages: string[], message: string, limit: number) {
  if (messages.length < limit) messages.push(message)
}

function emptyResult(options: ParseImportFileOptions, bytes: Buffer, errors: string[], warnings: string[] = []): ParsedImportFile {
  return {
    fileName: options.fileName,
    byteLength: bytes.byteLength,
    encoding: null,
    delimiter: null,
    headers: [],
    rows: [],
    rowCount: 0,
    sampleRows: [],
    warnings,
    errors,
  }
}

function decodeBuffer(bytes: Buffer, warningLimit: number): { text: string; encoding: string; warnings: string[] } {
  const warnings: string[] = []
  const detected = detect(bytes)
  const candidates = Array.from(new Set([detected, 'UTF-8', 'ISO-8859-1'].filter(Boolean))) as string[]

  for (const encoding of candidates) {
    try {
      if (encoding.toUpperCase() === 'UTF-8' || encoding.toLowerCase() === 'ascii') {
        return { text: bytes.toString('utf8'), encoding: 'UTF-8', warnings }
      }
      if (iconv.encodingExists(encoding)) {
        return { text: iconv.decode(bytes, encoding), encoding, warnings }
      }
      boundedPush(warnings, `Encoding detector returned unsupported encoding ${encoding}; tried fallback decoding.`, warningLimit)
    } catch (error) {
      boundedPush(warnings, `Could not decode as ${encoding}: ${error instanceof Error ? error.message : 'unknown decode error'}.`, warningLimit)
    }
  }

  boundedPush(warnings, 'Encoding detection failed; decoded with ISO-8859-1 fallback.', warningLimit)
  return { text: iconv.decode(bytes, 'ISO-8859-1'), encoding: 'ISO-8859-1', warnings }
}

function stripBom(value: string) {
  return value.replace(/^\uFEFF/, '')
}

function scoreDelimiter(text: string, delimiter: string) {
  const [first = '', second = ''] = text.split(/\r?\n/, 2)
  const firstCount = first.split(delimiter).length
  const secondCount = second.split(delimiter).length
  return Math.min(firstCount, secondCount || firstCount)
}

function chooseDelimiter(text: string): string | null {
  const scored = DELIMITERS.map((delimiter) => ({ delimiter, score: scoreDelimiter(text, delimiter) })).sort(
    (a, b) => b.score - a.score,
  )
  return scored[0] && scored[0].score > 1 ? scored[0].delimiter : null
}

function normalizeCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  return String(value).trim()
}

function parseCsv(text: string, delimiter: string, options: Required<Pick<ParseImportFileOptions, 'maxRows' | 'sampleSize' | 'warningLimit'>>) {
  const warnings: string[] = []
  const records = parse(text, {
    bom: true,
    columns: (headers: string[]) => headers.map((header) => stripBom(String(header).trim())),
    delimiter,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
    quote: '"',
    escape: '"',
  }) as ParsedImportRow[]

  if (records.length > options.maxRows) {
    boundedPush(warnings, `Parsed row count ${records.length} exceeds cap ${options.maxRows}; only capped rows are returned.`, options.warningLimit)
  }

  const rows = records.slice(0, options.maxRows).map((record) =>
    Object.fromEntries(Object.entries(record).map(([key, value]) => [stripBom(key), normalizeCell(value)])),
  )
  const headers = rows[0] ? Object.keys(rows[0]) : []
  return { headers, rows, warnings, rowCount: rows.length, sampleRows: rows.slice(0, options.sampleSize) }
}

async function parseXlsx(bytes: Buffer, options: Required<Pick<ParseImportFileOptions, 'maxRows' | 'sampleSize' | 'warningLimit'>>) {
  const warnings: string[] = []
  const sheet = await readSheet(bytes)
  const [headerRow, ...dataRows] = sheet
  const headers = (headerRow ?? []).map((cell) => normalizeCell(cell))
  const rows = dataRows.slice(0, options.maxRows).map((row) => {
    const record: ParsedImportRow = {}
    headers.forEach((header, index) => {
      record[header] = normalizeCell(row[index])
    })
    return record
  })

  if (dataRows.length > options.maxRows) {
    boundedPush(warnings, `Parsed row count ${dataRows.length} exceeds cap ${options.maxRows}; only capped rows are returned.`, options.warningLimit)
  }

  return { headers, rows, warnings, rowCount: rows.length, sampleRows: rows.slice(0, options.sampleSize) }
}

export async function parseImportFile(bytes: Buffer, inputOptions: ParseImportFileOptions): Promise<ParsedImportFile> {
  const options = {
    maxBytes: DEFAULT_MAX_BYTES,
    maxRows: DEFAULT_MAX_ROWS,
    sampleSize: DEFAULT_SAMPLE_SIZE,
    warningLimit: DEFAULT_WARNING_LIMIT,
    ...inputOptions,
  }

  if (bytes.byteLength > options.maxBytes) {
    return emptyResult(options, bytes, [
      `File ${options.fileName} exceeds the maximum import size of ${options.maxBytes} bytes.`,
    ])
  }

  if (bytes.byteLength === 0) {
    return emptyResult(options, bytes, ['File is empty.'])
  }

  const lowerName = options.fileName.toLocaleLowerCase('it-IT')

  try {
    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
      const parsed = await parseXlsx(bytes, options)
      return {
        fileName: options.fileName,
        byteLength: bytes.byteLength,
        encoding: null,
        delimiter: null,
        ...parsed,
        errors: parsed.headers.length === 0 ? ['Spreadsheet has no header row.'] : [],
      }
    }

    const decoded = decodeBuffer(bytes, options.warningLimit)
    const text = stripBom(decoded.text)
    if (!text.trim()) return emptyResult(options, bytes, ['File is empty.'], decoded.warnings)

    const delimiter = chooseDelimiter(text)
    if (!delimiter) {
      return {
        fileName: options.fileName,
        byteLength: bytes.byteLength,
        encoding: decoded.encoding,
        delimiter: null,
        headers: [],
        rows: [],
        rowCount: 0,
        sampleRows: [],
        warnings: decoded.warnings,
        errors: ['Could not determine a supported CSV delimiter from the header row.'],
      }
    }

    const parsed = parseCsv(text, delimiter, options)
    return {
      fileName: options.fileName,
      byteLength: bytes.byteLength,
      encoding: decoded.encoding,
      delimiter,
      ...parsed,
      warnings: [...decoded.warnings, ...parsed.warnings].slice(0, options.warningLimit),
      errors: parsed.headers.length === 0 ? ['CSV file has no header row.'] : [],
    }
  } catch (error) {
    return emptyResult(options, bytes, [
      `Could not parse import file: ${error instanceof Error ? error.message : 'unknown parser error'}.`,
    ])
  }
}
