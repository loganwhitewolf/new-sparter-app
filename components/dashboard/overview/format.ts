// Production number formatters for the overview dashboard.
// DAL returns DECIMAL columns as strings — accept string | number for convenience.

const eurFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

/**
 * Format a monetary value as a Euro string using it-IT locale with no decimals.
 * Accepts a DAL DECIMAL string or a plain number.
 * Example: "1234.56" → "€1.235"
 */
export function formatEur(value: string | number): string {
  const numeric = typeof value === 'string' ? Number(value) : value
  return eurFormatter.format(Number.isFinite(numeric) ? numeric : 0)
}

/**
 * Compact k-notation formatter for always-on bar labels.
 * Values ≥ 1000 render as "2,5k" (it-IT locale, 1 decimal max).
 * Values < 1000 render as a rounded integer string.
 * Accepts a DAL DECIMAL string or a plain number.
 * Example: 2500 → "2,5k" | 800 → "800"
 */
export function formatEurCompact(value: string | number): string {
  const numeric = typeof value === 'string' ? Number(value) : value
  const n = Number.isFinite(numeric) ? numeric : 0
  if (n >= 1000) {
    return `${(n / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })}k`
  }
  return String(Math.round(n))
}
