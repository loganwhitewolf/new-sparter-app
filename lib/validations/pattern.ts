import { z } from 'zod'

const INVALID_PATTERN_MESSAGE = 'Pattern regex non valido.'
const UNSUPPORTED_FLAGS_MESSAGE = 'Flag regex non supportati. Usa solo /pattern/i oppure pattern.'

export function normalizePatternInput(input: string): string {
  const trimmed = input.trim()

  if (trimmed.length === 0) {
    throw new Error(INVALID_PATTERN_MESSAGE)
  }

  let source = trimmed

  if (trimmed.startsWith('/')) {
    const closingSlashIndex = trimmed.lastIndexOf('/')

    if (closingSlashIndex > 0) {
      source = trimmed.slice(1, closingSlashIndex)
      const flags = trimmed.slice(closingSlashIndex + 1)

      if (flags !== '' && flags !== 'i') {
        throw new Error(UNSUPPORTED_FLAGS_MESSAGE)
      }
    }
  }

  // Reject empty source (e.g. //) or single-char source (e.g. ///) — too short to be meaningful
  // and a bare `/` as source matches every string containing a slash (over-categorization).
  if (source.length < 2) {
    throw new Error(INVALID_PATTERN_MESSAGE)
  }

  try {
    new RegExp(source, 'i')
  } catch {
    throw new Error(INVALID_PATTERN_MESSAGE)
  }

  return source
}

const regexString = z.string().transform((val, ctx) => {
  try {
    return normalizePatternInput(val)
  } catch (error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: error instanceof Error ? error.message : INVALID_PATTERN_MESSAGE,
    })
    return z.NEVER
  }
})

// Phase 46: patterns are sign-agnostic (amount_sign removed, ADR 0012, supersedes ADR 0008)
// deriveAmountSign removed — patterns no longer have a sign field

export const CreatePatternSchema = z.object({
  pattern: regexString,
  subCategoryId: z.number({ error: 'Seleziona una sottocategoria.' }).int().positive({ error: 'Seleziona una sottocategoria.' }),
  // amountSign removed — Phase 46: patterns are sign-agnostic (ADR 0012)
  confidence: z.number().min(0).max(1),
  description: z.string().max(255).optional(),
})

export const UpdatePatternSchema = CreatePatternSchema.partial()

/**
 * Client-facing update schema — omits server-derived fields.
 * Used by updatePatternAction to prevent clients from injecting
 * confidence values that must always be derived server-side.
 */
export const UpdatePatternClientSchema = CreatePatternSchema
  .omit({ confidence: true })
  .partial()

export type CreatePatternInput = z.infer<typeof CreatePatternSchema>
export type UpdatePatternInput = z.infer<typeof UpdatePatternSchema>
export type UpdatePatternClientInput = z.infer<typeof UpdatePatternClientSchema>

/**
 * Structured result returned after a retroactive apply (APPLY-01/02).
 * Re-exported from service layer (PatternApplyResult) for client consumers
 * (useActionState, SuggestionCard) without importing from the service directly.
 */
export type PatternApplyResult = {
  updatedCount: number
  notUpdatedCount: number
}

/**
 * Server action state for pattern actions.
 * applyResult is populated on successful promoteSuggestionAction calls (Plan 53-02).
 */
export type ActionState = {
  error: string | null
  applyResult?: PatternApplyResult | null
}
