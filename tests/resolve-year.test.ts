import { describe, expect, it } from 'vitest'
import { resolveYear } from '@/components/dashboard/overview/resolve-year'

describe('resolveYear', () => {
  it('returns null when years is empty', () => {
    expect(resolveYear('2026', [])).toBeNull()
  })

  it('returns the requested year when it is a member of years', () => {
    expect(resolveYear('2025', ['2026', '2025', '2024'])).toBe(2025)
  })

  it('falls back to the current calendar year when requested is undefined and current year has data', () => {
    const currentYear = String(new Date().getFullYear())
    expect(resolveYear(undefined, [currentYear, '2020'])).toBe(Number(currentYear))
  })

  it('falls back to the most recent year (years[0]) when requested is undefined and current year has no data', () => {
    expect(resolveYear(undefined, ['2020', '2019'])).toBe(2020)
  })

  it('falls back to the most recent year when requested is not a member of years or yearsForOtherLens', () => {
    expect(resolveYear('1999', ['2020', '2019'])).toBe(2020)
  })

  // Phase 80, D-10: cross-lens clamp.
  it('clamps to the active lens latest year when requested exists only in yearsForOtherLens', () => {
    expect(resolveYear('2030', ['2026'], ['2030'])).toBe(2026)
  })

  it('preserves existing single-lens behavior when yearsForOtherLens is omitted', () => {
    expect(resolveYear('2026', ['2026'], undefined)).toBe(2026)
  })

  it('does not clamp when requested is a member of BOTH years and yearsForOtherLens (active lens wins)', () => {
    expect(resolveYear('2025', ['2026', '2025'], ['2025'])).toBe(2025)
  })

  it('falls through to current-year fallback when requested is absent from years AND yearsForOtherLens', () => {
    const currentYear = String(new Date().getFullYear())
    expect(resolveYear('1999', [currentYear, '2020'], ['2030'])).toBe(Number(currentYear))
  })
})
