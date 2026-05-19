import { describe, expect, it } from 'vitest'
import { computeDeviation, buildDeviationMap } from '@/lib/utils/dashboard'

describe('computeDeviation', () => {
  it('returns signed percentage with 1-decimal rounding', () => {
    expect(computeDeviation('120.00', '100.00')).toBe(20)
    expect(computeDeviation('80.00', '100.00')).toBe(-20)
    expect(computeDeviation('150.456', '100.00')).toBe(50.5)
  })
  it("returns 'new' when baseline is zero and reference is non-zero", () => {
    expect(computeDeviation('100.50', '0')).toBe('new')
    expect(computeDeviation('0.01', '0.00')).toBe('new')
  })
  it('returns null when both reference and baseline are zero', () => {
    expect(computeDeviation('0', '0')).toBeNull()
    expect(computeDeviation('0.00', '0.00')).toBeNull()
  })
  it('handles negative reference (zero baseline) as new', () => {
    // amounts arrive as abs() from the DAL, but defensive coverage
    expect(computeDeviation('-50.00', '0')).toBe('new')
  })
})

describe('buildDeviationMap', () => {
  const noiseThreshold = '15.00'

  it('averages baseline across present months and returns deviation per id', () => {
    const map = buildDeviationMap({
      referenceRows: [{ id: 1, amount: '120.00' }],
      baselineRows: [
        { id: 1, month: '2026-01', amount: '100.00' },
        { id: 1, month: '2026-02', amount: '100.00' },
        { id: 1, month: '2026-03', amount: '100.00' },
      ],
      noiseThreshold,
    })
    expect(map.get(1)).toBe(20)
  })

  it("returns 'new' for ids present in reference but absent from baseline", () => {
    const map = buildDeviationMap({
      referenceRows: [{ id: 7, amount: '50.00' }],
      baselineRows: [],
      noiseThreshold,
    })
    expect(map.get(7)).toBe('new')
  })

  it('returns null for reference rows below the noise threshold', () => {
    const map = buildDeviationMap({
      referenceRows: [{ id: 9, amount: '14.99' }],
      baselineRows: [{ id: 9, month: '2026-01', amount: '100.00' }],
      noiseThreshold,
    })
    expect(map.get(9)).toBeNull()
  })

  it('averages over only the months present (D-03: fewer than 3 months allowed)', () => {
    const map = buildDeviationMap({
      referenceRows: [{ id: 3, amount: '90.00' }],
      baselineRows: [
        { id: 3, month: '2026-02', amount: '60.00' },
        { id: 3, month: '2026-03', amount: '60.00' },
      ],
      noiseThreshold,
    })
    // baseline = (60 + 60) / 2 = 60; deviation = (90 - 60)/60 * 100 = 50
    expect(map.get(3)).toBe(50)
  })

  it('omits ids that appear only in baseline', () => {
    const map = buildDeviationMap({
      referenceRows: [],
      baselineRows: [{ id: 99, month: '2026-01', amount: '100.00' }],
      noiseThreshold,
    })
    expect(map.has(99)).toBe(false)
  })
})
