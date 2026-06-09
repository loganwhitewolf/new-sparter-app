/**
 * Display-only absolute-value currency formatter shared by transactions, expenses,
 * and import tables.
 *
 * IMPORTANT: Display-only — never use for values written back to the DB.
 * Monetary amounts that re-enter persistence must use Decimal.js helpers
 * from @/lib/utils/decimal per CLAUDE.md rules.
 */

const formatterCache = new Map<string, Intl.NumberFormat>()

function getCurrencyFormatter(currency: string): Intl.NumberFormat {
  const key = currency || 'EUR'
  const cached = formatterCache.get(key)
  if (cached) return cached
  const formatter = new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: key,
  })
  formatterCache.set(key, formatter)
  return formatter
}

/**
 * Formats a DECIMAL string (from DB) as an absolute-value currency string for display.
 * The leading minus is stripped — color / dimming classes convey direction instead.
 *
 * @param amount - Raw DECIMAL string from the database (may be negative, e.g. '-12.50')
 * @param currency - ISO 4217 currency code (default: 'EUR')
 * @returns Formatted absolute-value currency string, e.g. '12,50 €'
 *
 * On non-finite input (e.g. 'abc'), returns `${amount} ${currency}` — mirrors the
 * existing fallback in transaction-table.tsx — and never throws.
 */
export function formatAbsoluteAmount(amount: string, currency = 'EUR'): string {
  const numericAmount = Number(amount)

  if (!Number.isFinite(numericAmount)) {
    return `${amount} ${currency || 'EUR'}`
  }

  return getCurrencyFormatter(currency).format(Math.abs(numericAmount))
}
