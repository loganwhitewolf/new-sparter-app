// Production number formatters for the dashboard overview.
// Replaces the throwaway proto eur/eurCompact from mock-data.ts.

// Module-scoped formatter instances (single allocation, re-used on every call).
const eurFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

/**
 * Format a monetary value as Italian EUR currency without decimal places.
 * Accepts DAL DECIMAL strings (e.g. "1234.56") or numbers.
 * Example: formatEur("1234.56") → "€ 1.235"
 */
export function formatEur(value: string | number): string {
  return eurFormatter.format(Number(value))
}

/**
 * Format a monetary value in compact k-notation for always-on bar labels.
 * Values ≥ 1000 render as k-notation with 1 decimal (locale it-IT).
 * Values < 1000 render as a rounded integer.
 * Accepts DAL DECIMAL strings or numbers.
 * Examples: formatEurCompact(2500) → "2,5k"  formatEurCompact(850) → "850"
 */
export function formatEurCompact(value: string | number): string {
  const n = Number(value)
  if (n >= 1000) {
    return `${(n / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })}k`
  }
  return String(Math.round(n))
}
