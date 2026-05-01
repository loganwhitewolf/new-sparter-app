import { createHash } from 'node:crypto'
import Decimal from 'decimal.js'
import { toDbDecimal } from './decimal'

export type AmountType = 'single' | 'separate'

export type ImportPlatformConfig = {
  platformId?: number
  id?: number
  timestampColumn: string
  descriptionColumn: string
  amountType: AmountType
  amountColumn: string | null
  positiveAmountColumn: string | null
  negativeAmountColumn: string | null
  multiplyBy: number
}

export type RawImportRow = Record<string, string | number | null | undefined>

export type NormalizedTransactionRow = {
  rowIndex: number
  valid: boolean
  errors: string[]
  warnings: string[]
  description: string
  normalizedDescription: string
  descriptionHash: string
  amount: string | null
  occurredAt: Date | null
  transactionHash: string | null
  rawRow: Record<string, string | number | null>
}

const ITALIAN_MONTHS: Record<string, number> = {
  gen: 0,
  gennaio: 0,
  feb: 1,
  febbraio: 1,
  mar: 2,
  marzo: 2,
  apr: 3,
  aprile: 3,
  mag: 4,
  maggio: 4,
  giu: 5,
  giugno: 5,
  lug: 6,
  luglio: 6,
  ago: 7,
  agosto: 7,
  set: 8,
  settembre: 8,
  ott: 9,
  ottobre: 9,
  nov: 10,
  novembre: 10,
  dic: 11,
  dicembre: 11,
}

function sha256(input: string) {
  return createHash('sha256').update(input).digest('hex')
}

export function normalizeDescription(description: string | null | undefined): string {
  return String(description ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('it-IT')
}

export function computeDescriptionHash(description: string): string {
  return sha256(normalizeDescription(description))
}

export function parseItalianAmount(value: string | number | null | undefined): string | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return toDbDecimal(new Decimal(value))
  }

  const raw = String(value ?? '')
    .trim()
    .replace(/^"|"$/g, '')
    .replace(/\s/g, '')
    .replace(/[€]/g, '')

  if (!raw) return null

  const hasComma = raw.includes(',')
  const hasDot = raw.includes('.')
  let normalized = raw

  if (hasComma && hasDot) {
    const lastComma = raw.lastIndexOf(',')
    const lastDot = raw.lastIndexOf('.')
    if (lastComma > lastDot) {
      normalized = raw.replace(/\./g, '').replace(',', '.')
    } else {
      normalized = raw.replace(/,/g, '')
    }
  } else if (hasComma) {
    normalized = raw.replace(',', '.')
  }

  try {
    const decimal = new Decimal(normalized)
    if (!decimal.isFinite()) return null
    return toDbDecimal(decimal)
  } catch {
    return null
  }
}

function utcDate(year: number, monthIndex: number, day: number, hour = 0, minute = 0, second = 0) {
  const date = new Date(Date.UTC(year, monthIndex, day, hour, minute, second))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== monthIndex ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second
  ) {
    return null
  }
  return date
}

export function parseBankDate(value: string | Date | null | undefined): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const raw = String(value ?? '').trim()
  if (!raw) return null

  const isoLike = /^\d{4}-\d{2}-\d{2}(?:[T ][\d:.]+(?:Z)?)?$/.exec(raw)
  if (isoLike) {
    const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T')
    const date = new Date(normalized.endsWith('Z') || !normalized.includes('T') ? normalized : `${normalized}Z`)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const numeric = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ .T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(raw)
  if (numeric) {
    const [, day, month, year, hour = '0', minute = '0', second = '0'] = numeric
    return utcDate(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second))
  }

  const monthName = /^(\d{1,2})\s+([\p{L}.]+)\s+(\d{4})\.?(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/u.exec(raw)
  if (monthName) {
    const [, day, monthToken, year, hour = '0', minute = '0', second = '0'] = monthName
    const monthIndex = ITALIAN_MONTHS[monthToken.replace('.', '').toLocaleLowerCase('it-IT')]
    if (monthIndex === undefined) return null
    return utcDate(Number(year), monthIndex, Number(day), Number(hour), Number(minute), Number(second))
  }

  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

export function computeTransactionHash(input: {
  userId: string
  platformId: number
  occurredAt: Date
  amount: string | number
  description: string
}): string {
  const amount = parseItalianAmount(input.amount) ?? String(input.amount)
  const identity = [
    input.userId,
    input.platformId,
    input.occurredAt.toISOString(),
    amount,
    normalizeDescription(input.description),
  ].join('|')
  return sha256(identity)
}

function cleanRawRow(row: RawImportRow): Record<string, string | number | null> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, value === undefined ? null : value]),
  )
}

function applyMultiplier(amount: string, multiplyBy: number): string | null {
  try {
    return toDbDecimal(new Decimal(amount).mul(multiplyBy))
  } catch {
    return null
  }
}

export function normalizeTransactionRow(
  row: RawImportRow,
  platform: ImportPlatformConfig,
  context: { userId: string; rowIndex: number },
): NormalizedTransactionRow {
  const errors: string[] = []
  const warnings: string[] = []
  const description = String(row[platform.descriptionColumn] ?? '').trim()
  const normalizedDescription = normalizeDescription(description)
  const occurredAt = parseBankDate(row[platform.timestampColumn] as string | number | null | undefined as string | null | undefined)

  if (!description) errors.push(`Row ${context.rowIndex}: missing description`)
  if (!occurredAt) errors.push(`Row ${context.rowIndex}: invalid date`)

  let amount: string | null = null
  if (platform.amountType === 'single') {
    amount = parseItalianAmount(row[platform.amountColumn ?? ''])
  } else {
    const positive = parseItalianAmount(row[platform.positiveAmountColumn ?? ''])
    const negative = parseItalianAmount(row[platform.negativeAmountColumn ?? ''])
    if (positive && negative && positive !== '0.00' && negative !== '0.00') {
      warnings.push(`Row ${context.rowIndex}: both positive and negative amount columns are populated; positive column wins`)
    }
    if (positive && positive !== '0.00') {
      amount = positive
    } else if (negative) {
      amount = toDbDecimal(new Decimal(negative).abs().mul(-1))
    }
  }

  if (amount) {
    amount = applyMultiplier(amount, platform.multiplyBy)
  }
  if (!amount) errors.push(`Row ${context.rowIndex}: invalid amount`)

  const platformId = platform.platformId ?? platform.id
  const descriptionHash = computeDescriptionHash(description)
  const transactionHash =
    platformId && occurredAt && amount && description
      ? computeTransactionHash({ userId: context.userId, platformId, occurredAt, amount, description })
      : null

  return {
    rowIndex: context.rowIndex,
    valid: errors.length === 0,
    errors,
    warnings,
    description,
    normalizedDescription,
    descriptionHash,
    amount,
    occurredAt,
    transactionHash,
    rawRow: cleanRawRow(row),
  }
}
