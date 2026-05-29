import { describe, expect, it } from 'vitest'
import { formatMonthRange } from '@/lib/utils/date'

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
