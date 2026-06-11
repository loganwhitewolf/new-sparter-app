import { describe, expect, it } from 'vitest'
import { classifyResults } from '../scripts/verify-migration'

describe('classifyResults — pass/fail classification', () => {
  it('returns ok:true when all fatal counts are zero', () => {
    const result = classifyResults({
      activeSystemNullNatureCount: 0,
      patternDuplicateCount: 0,
      userOwnedNullNatureCount: 0,
      overrideBackfilledCount: 0,
    })
    expect(result.ok).toBe(true)
    expect(result.fatal).toHaveLength(0)
  })

  it('returns ok:false with fatal entry when activeSystemNullNatureCount > 0 (D-04)', () => {
    const result = classifyResults({
      activeSystemNullNatureCount: 3,
      patternDuplicateCount: 0,
      userOwnedNullNatureCount: 0,
      overrideBackfilledCount: 0,
    })
    expect(result.ok).toBe(false)
    expect(result.fatal.length).toBeGreaterThan(0)
    expect(result.fatal.some((msg) => msg.includes('nature_id'))).toBe(true)
  })

  it('returns ok:false with fatal entry when patternDuplicateCount > 0 (MIG-03)', () => {
    const result = classifyResults({
      activeSystemNullNatureCount: 0,
      patternDuplicateCount: 2,
      userOwnedNullNatureCount: 0,
      overrideBackfilledCount: 0,
    })
    expect(result.ok).toBe(false)
    expect(result.fatal.length).toBeGreaterThan(0)
    expect(result.fatal.some((msg) => msg.includes('duplicate'))).toBe(true)
  })

  it('remains ok:true when only non-fatal (informational) counts are non-zero (D-01/D-03/D-04)', () => {
    const result = classifyResults({
      activeSystemNullNatureCount: 0,
      patternDuplicateCount: 0,
      userOwnedNullNatureCount: 5,
      overrideBackfilledCount: 10,
    })
    expect(result.ok).toBe(true)
    expect(result.fatal).toHaveLength(0)
    // Informational items should be captured in info array
    expect(result.info.length).toBeGreaterThan(0)
  })
})
