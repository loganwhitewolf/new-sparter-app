import { describe, expect, it } from 'vitest'

// Import module under test — fails until lib/validations/onboarding.ts is created
const { parseOnboardingStep, STEP_NAMES, onboardingThemeForStep } = await import(
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

describe('onboardingThemeForStep (R-OB-09 — all steps dark invariant)', () => {
  it('resolves step 4 to the dark theme (regression guard — must NOT be light)', () => {
    expect(onboardingThemeForStep(4)).toBe('dark')
  })

  it('resolves step 1 to the dark theme', () => {
    expect(onboardingThemeForStep(1)).toBe('dark')
  })

  it('resolves step 2 to the dark theme', () => {
    expect(onboardingThemeForStep(2)).toBe('dark')
  })

  it('resolves step 3 to the dark theme', () => {
    expect(onboardingThemeForStep(3)).toBe('dark')
  })

  it('resolves step 5 to the dark theme', () => {
    expect(onboardingThemeForStep(5)).toBe('dark')
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
