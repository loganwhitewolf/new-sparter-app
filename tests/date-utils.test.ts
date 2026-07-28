import { describe, expect, it } from 'vitest'
import { formatDayMonthLong, formatDayMonthRange, formatMonthRange, yearProgressPercent } from '@/lib/utils/date'

describe('formatMonthRange (R-OB-10)', () => {
  it("formats same month and year as 'Mag 2026' (R-OB-10)", () => {
    const may2026 = new Date(2026, 4, 15) // JS month 4 = May
    expect(formatMonthRange(may2026, may2026)).toBe('Mag 2026')
  })

  it("formats same-year range with en-dash separator as 'Apr–Mag 2026' (R-OB-10)", () => {
    const apr2026 = new Date(2026, 3, 1) // JS month 3 = April
    const may2026 = new Date(2026, 4, 1) // JS month 4 = May
    expect(formatMonthRange(apr2026, may2026)).toBe('Apr–Mag 2026')
  })

  it("formats cross-year range with both years and en-dash as 'Dic 2025–Gen 2026' (R-OB-10)", () => {
    const dec2025 = new Date(2025, 11, 1) // JS month 11 = December
    const jan2026 = new Date(2026, 0, 1)  // JS month 0 = January
    expect(formatMonthRange(dec2025, jan2026)).toBe('Dic 2025–Gen 2026')
  })

  it('capitalizes first letter and strips trailing dot from Italian short month output (R-OB-10)', () => {
    // Italian Intl may produce 'mag.' (with trailing dot) — must become 'Mag'
    const may2026 = new Date(2026, 4, 1)
    const result = formatMonthRange(may2026, may2026)
    // Should not contain a dot
    expect(result).not.toMatch(/\./)
    // First character of month name should be uppercase
    expect(result[0]).toBe(result[0].toUpperCase())
  })
})

describe('yearProgressPercent (GBH-01)', () => {
  it('returns 0 at Jan 1 of the given year', () => {
    expect(yearProgressPercent(new Date(2026, 0, 1), 2026)).toBe(0)
  })

  it('returns 100 at Dec 31 23:59:59.999 of the given year', () => {
    expect(yearProgressPercent(new Date(2026, 11, 31, 23, 59, 59, 999), 2026)).toBe(100)
  })

  it('returns a value strictly between 0 and 100 for a mid-year date', () => {
    const result = yearProgressPercent(new Date(2026, 5, 15), 2026)
    expect(result).toBeGreaterThan(0)
    expect(result).toBeLessThan(100)
  })

  it('clamps a date before Jan 1 of the year to 0 (never negative)', () => {
    expect(yearProgressPercent(new Date(2025, 11, 31), 2026)).toBe(0)
  })

  it('clamps a date after Dec 31 of the year to 100 (never above 100)', () => {
    expect(yearProgressPercent(new Date(2027, 0, 1), 2026)).toBe(100)
  })
})

describe('formatDayMonthRange (GBH-01)', () => {
  it("formats a range as '1 gen – 30 apr' — day + lowercase short month, en-dash, no year", () => {
    expect(formatDayMonthRange(new Date(2026, 0, 1), new Date(2026, 3, 30))).toBe('1 gen – 30 apr')
  })

  it('formats a same-day start/end range without deduping (caller decides)', () => {
    const day = new Date(2026, 3, 30)
    expect(formatDayMonthRange(day, day)).toBe('30 apr – 30 apr')
  })
})

describe('formatDayMonthLong (GBH-01)', () => {
  it('formats as day + lowercase long month', () => {
    expect(formatDayMonthLong(new Date(2026, 6, 17))).toBe('17 luglio')
  })
})
