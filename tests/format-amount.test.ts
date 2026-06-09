/**
 * Tests for formatAbsoluteAmount — display-only absolute-value currency formatter.
 * RED phase: these tests fail until the implementation is created.
 */
import { describe, it, expect } from 'vitest'
import { formatAbsoluteAmount } from '@/lib/utils/format-amount'

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
