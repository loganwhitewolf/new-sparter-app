import Decimal from 'decimal.js'

/**
 * Parse a DB DECIMAL string or JS number to a Decimal instance.
 * Use this whenever reading an amount from the database (Drizzle returns DECIMAL as string).
 */
export function toDecimal(value: string | number): Decimal {
  return new Decimal(value)
}

/**
 * Convert a Decimal to a string suitable for DB insertion into a DECIMAL(10,2) column.
 * Never insert raw JS numbers — always use toDbDecimal() before writing amounts.
 */
export function toDbDecimal(value: Decimal): string {
  return value.toFixed(2)
}
