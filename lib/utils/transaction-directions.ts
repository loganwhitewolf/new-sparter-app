/**
 * Shared transaction direction filter vocabulary (client + server safe).
 * Used by parseTransactionFilters, DAL mapping, and the transactions toolbar.
 */

export const TRANSACTION_DIRECTION_ALLOWED = [
  'in',
  'out',
  'allocation',
  'transfer',
  'unclassified',
] as const

export type TransactionDirectionCode = (typeof TRANSACTION_DIRECTION_ALLOWED)[number]

/** Implicit default when URL has no `direction` param — hides transfers. */
export const DEFAULT_TRANSACTION_DIRECTIONS: readonly TransactionDirectionCode[] = [
  'in',
  'out',
  'allocation',
  'unclassified',
]

export const TRANSACTION_DIRECTION_LABELS: Record<TransactionDirectionCode, string> = {
  in: 'Entrate',
  out: 'Uscite',
  allocation: 'Accantonamenti',
  transfer: 'Trasferimenti',
  unclassified: 'Non classificato',
}

const ALLOWED_SET = new Set<string>(TRANSACTION_DIRECTION_ALLOWED)

/**
 * Parse a CSV / single direction token list against the allowlist (order preserved, deduped).
 */
export function parseDirectionTokens(raw: string | undefined): TransactionDirectionCode[] {
  if (!raw) return []
  const seen = new Set<string>()
  const out: TransactionDirectionCode[] = []
  for (const part of raw.split(',')) {
    const token = part.trim()
    if (!token || seen.has(token) || !ALLOWED_SET.has(token)) continue
    seen.add(token)
    out.push(token as TransactionDirectionCode)
  }
  return out
}

/** True when both sets contain the same members (order-independent). */
export function sameDirectionSet(
  a: readonly string[],
  b: readonly string[],
): boolean {
  if (a.length !== b.length) return false
  const setB = new Set(b)
  return a.every((x) => setB.has(x))
}

/**
 * Effective directions for the transactions list.
 * - `directionParam === undefined` → default (no transfers), not explicit
 * - otherwise (including "") → parsed CSV, explicit
 * - legacy single `type` only when direction param is absent
 */
export function resolveTransactionDirections(
  directionParam: string | undefined,
  legacyTypeParam?: string | undefined,
): { directions: TransactionDirectionCode[]; explicit: boolean } {
  if (directionParam !== undefined) {
    return { directions: parseDirectionTokens(directionParam), explicit: true }
  }
  if (legacyTypeParam !== undefined && legacyTypeParam !== '') {
    const parsed = parseDirectionTokens(legacyTypeParam)
    if (parsed.length > 0) return { directions: parsed, explicit: true }
  }
  return { directions: [...DEFAULT_TRANSACTION_DIRECTIONS], explicit: false }
}
