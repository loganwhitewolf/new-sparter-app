/**
 * Shared URL search-param parsers for filter + sort toolbar system.
 *
 * All parsers are total functions: they accept any input and return empty / undefined
 * on bad input. They NEVER throw. This prevents malformed query strings from
 * surfacing as errors in server components (T-40-01 mitigation).
 *
 * Pattern modelled after lib/validations/transactions.ts (firstTrimmed + allowlist guards).
 */

/**
 * Returns the first element of an array value (as from URL searchParams), or the
 * raw string, trimmed. Returns undefined if the value is absent or blank.
 */
function firstTrimmed(value: string | string[] | undefined): string | undefined {
  const rawValue = Array.isArray(value) ? value[0] : value
  const trimmed = rawValue?.trim()
  return trimmed ? trimmed : undefined
}

/**
 * Strict regex for YYYY-MM calendar month tokens.
 * Months are 01–12 (leading zero required); year is any 4-digit number.
 */
export const YEAR_MONTH_RE = /^\d{4}-(?:0[1-9]|1[0-2])$/

/**
 * Parses a comma-separated list of YYYY-MM calendar months.
 * Accepts the raw searchParam value (string, string[], or undefined).
 * Invalid tokens are silently dropped. Never throws.
 *
 * @example
 * parseMonths("2026-04,2026-05")  // ["2026-04", "2026-05"]
 * parseMonths("2026-13,foo,2026-05")  // ["2026-05"]
 * parseMonths(undefined)  // []
 */
export function parseMonths(value: string | string[] | undefined): string[] {
  const raw = firstTrimmed(value)
  if (!raw) return []
  return raw
    .split(',')
    .map((m) => m.trim())
    .filter((m) => YEAR_MONTH_RE.test(m))
}

/**
 * Parses an absolute (non-negative) numeric amount string.
 * Returns the trimmed value only if it matches the non-negative numeric pattern.
 * Negative values and non-numeric strings return undefined. Never throws.
 *
 * Semantics: D-20 — amount filter = absolute value (|amount|), so only non-negative
 * values are valid inputs. The caller controls min/max semantics.
 *
 * @example
 * parseAmount("10.50")  // "10.50"
 * parseAmount("-5")     // undefined
 * parseAmount("abc")    // undefined
 */
export function parseAmount(value: string | string[] | undefined): string | undefined {
  const raw = firstTrimmed(value)
  if (!raw) return undefined
  return /^\d+(\.\d+)?$/.test(raw) ? raw : undefined
}

/**
 * Validates a status value against an allowlist of permitted strings.
 * Returns the trimmed value only if it is included in `allowed`. Never throws.
 *
 * @example
 * parseStatus("categorized", ["categorized","uncategorized"])  // "categorized"
 * parseStatus("bogus", [...])  // undefined
 */
export function parseStatus(
  value: string | string[] | undefined,
  allowed: readonly string[],
): string | undefined {
  const raw = firstTrimmed(value)
  if (!raw) return undefined
  return allowed.includes(raw) ? raw : undefined
}

/**
 * Validates sort column and direction values against an allowlist.
 * Unknown sort keys return `sort: undefined` so callers fall back to their default.
 * Direction defaults to 'desc' unless exactly 'asc'.
 *
 * @example
 * parseSortDir("amount","asc",["amount","occurredAt"])
 *   // { sort: "amount", dir: "asc" }
 * parseSortDir("unknown","asc",["amount","occurredAt"])
 *   // { sort: undefined, dir: "asc" }
 */
export function parseSortDir(
  sort: string | string[] | undefined,
  dir: string | string[] | undefined,
  allowedSortKeys: readonly string[],
): { sort: string | undefined; dir: 'asc' | 'desc' } {
  const rawSort = firstTrimmed(sort)
  const rawDir = firstTrimmed(dir)
  const validSort = rawSort && allowedSortKeys.includes(rawSort) ? rawSort : undefined
  const validDir: 'asc' | 'desc' = rawDir === 'asc' ? 'asc' : 'desc'
  return { sort: validSort, dir: validDir }
}
