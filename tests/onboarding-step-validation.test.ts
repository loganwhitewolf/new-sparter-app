import { describe, expect, it } from 'vitest'

// Import module under test — fails until lib/validations/onboarding.ts is created
const { parseOnboardingStep, STEP_NAMES } = await import(
  '../lib/validations/onboarding'
)

describe('parseOnboardingStep (R-OB-03)', () => {
  it('returns 1 when value is undefined', () => {
    expect(parseOnboardingStep(undefined)).toBe(1)
  })

  it('returns 1 for ?step=1', () => {
    expect(parseOnboardingStep('1')).toBe(1)
  })

  it('returns 2 for ?step=2', () => {
    expect(parseOnboardingStep('2')).toBe(2)
  })

  it('returns 3 for ?step=3', () => {
    expect(parseOnboardingStep('3')).toBe(3)
  })

  it('returns 4 for ?step=4', () => {
    expect(parseOnboardingStep('4')).toBe(4)
  })

  it('returns 5 for ?step=5', () => {
    expect(parseOnboardingStep('5')).toBe(5)
  })

  it('clamps out-of-range ?step=99 to 1', () => {
    expect(parseOnboardingStep('99')).toBe(1)
  })

  it('falls back to 1 for non-numeric ?step=abc', () => {
    expect(parseOnboardingStep('abc')).toBe(1)
  })

  it('returns first element when value is an array (?step=2&step=3)', () => {
    expect(parseOnboardingStep(['2', '3'])).toBe(2)
  })

  it('falls back to 1 for empty string', () => {
    expect(parseOnboardingStep('')).toBe(1)
  })
})

describe('STEP_NAMES (R-OB-09)', () => {
  it('has Italian labels for all five steps', () => {
    expect(STEP_NAMES[1]).toBe('Carica il file')
    expect(STEP_NAMES[2]).toBe('Riepilogo')
    expect(STEP_NAMES[3]).toBe('Come funziona')
    expect(STEP_NAMES[4]).toBe('Categorizzazione')
    expect(STEP_NAMES[5]).toBe('Completato')
  })
})
