/**
 * Tests for formatAbsoluteAmount — display-only absolute-value currency formatter.
 * RED phase: these tests fail until the implementation is created.
 */
import { describe, it, expect } from 'vitest'
import { formatAbsoluteAmount, formatSignedAmount } from '@/lib/utils/format-amount'

describe('formatAbsoluteAmount', () => {
  it('returns no minus sign for a negative amount string', () => {
    const result = formatAbsoluteAmount('-12.50', 'EUR')
    expect(result).not.toContain('-')
    expect(result).not.toContain('−') // U+2212 minus sign
  })

  it('returns no minus sign for a positive amount string', () => {
    const result = formatAbsoluteAmount('12.50', 'EUR')
    expect(result).not.toContain('-')
    expect(result).not.toContain('−')
  })

  it('positive and negative amounts with the same absolute value produce the same formatted output', () => {
    const negative = formatAbsoluteAmount('-12.50', 'EUR')
    const positive = formatAbsoluteAmount('12.50', 'EUR')
    expect(negative).toBe(positive)
  })

  it('zero amount has no sign', () => {
    const result = formatAbsoluteAmount('0', 'EUR')
    expect(result).not.toContain('-')
    expect(result).not.toContain('−')
  })

  it('non-finite input falls back to raw value joined with currency code (no throw)', () => {
    const result = formatAbsoluteAmount('abc', 'EUR')
    expect(result).toBe('abc EUR')
  })

  it('non-finite input with custom currency falls back to raw + custom currency', () => {
    const result = formatAbsoluteAmount('xyz', 'USD')
    expect(result).toBe('xyz USD')
  })

  it('defaults currency to EUR when not provided', () => {
    const result = formatAbsoluteAmount('-5.00')
    expect(result).not.toContain('-')
    expect(result).not.toContain('−')
    // Should contain EUR currency symbol or abbreviation
    expect(result.toLowerCase()).toMatch(/eur|€/)
  })
})

describe('formatSignedAmount', () => {
  it('renders a positive amount with a leading + and it-IT grouping/decimals (D-07)', () => {
    const result = formatSignedAmount('2559.50', 'EUR')
    expect(result).toContain('+')
    expect(result).toContain('2.559,50')
  })

  it('renders a negative amount with a leading - (D-07)', () => {
    const result = formatSignedAmount('-1204', 'EUR')
    expect(result).toMatch(/[-−]/)
    expect(result).toContain('1.204,00')
  })

  it('renders zero with no sign prefix (D-07)', () => {
    const result = formatSignedAmount('0', 'EUR')
    expect(result).not.toContain('+')
    expect(result).not.toMatch(/[-−]/)
  })

  it('non-finite input falls back to raw value joined with currency code (no throw)', () => {
    const result = formatSignedAmount('abc', 'EUR')
    expect(result).toBe('abc EUR')
  })

  it('defaults currency to EUR when not provided', () => {
    const result = formatSignedAmount('10.00')
    expect(result.toLowerCase()).toMatch(/eur|€/)
  })
})
