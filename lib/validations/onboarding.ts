import { z } from 'zod'

/**
 * Zod schema for the ?step URL search param (R-OB-03 / T-38-06).
 * Coerces to integer, clamps to 1..5, defaults to 1 on any invalid value.
 */
export const OnboardingStepSchema = z.coerce.number().int().min(1).max(5).catch(1)

/** Italian display names for each onboarding step (R-OB-09). */
export const STEP_NAMES: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Carica il file',
  2: 'Riepilogo',
  3: 'Come funziona',
  4: 'Categorizzazione',
  5: 'Completato',
}

/**
 * Maps an onboarding step to its visual theme. This is the single documented source of
 * truth for the step→theme decision — page.tsx MUST call this instead of re-deriving the
 * theme inline.
 *
 * INVARIANT: EVERY onboarding step is dark, including step 4 (Categorizzazione).
 * WHY: the whole onboarding flow uses the onboarding-dark palette for visual consistency.
 * Step 4 was historically (and repeatedly) set to 'light' by mistake — a recurring
 * regression. The regression test asserts ALL steps (incl. 4) → 'dark' so light cannot
 * sneak back in. Do not special-case step 4 to 'light' again.
 */
export function onboardingThemeForStep(_step: 1 | 2 | 3 | 4 | 5): 'light' | 'dark' {
  return 'dark'
}

/**
 * Parses and validates the ?step search param from Next.js searchParams.
 * Handles undefined, string, and array-of-string shapes (Next.js may pass either).
 * Always returns a valid step number in the literal union 1|2|3|4|5.
 */
export function parseOnboardingStep(value: string | string[] | undefined): 1 | 2 | 3 | 4 | 5 {
  if (value === undefined) {
    return 1
  }

  // When the same param appears multiple times Next.js passes an array — use first element
  const scalar = Array.isArray(value) ? (value[0] ?? '') : value

  return OnboardingStepSchema.parse(scalar) as 1 | 2 | 3 | 4 | 5
}
