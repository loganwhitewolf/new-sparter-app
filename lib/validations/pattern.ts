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

  if (source.length === 0) {
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

/**
 * Derives the amountSign for a pattern from the parent category type.
 * Per ADR 0008: out -> negative, in -> positive, transfer/system -> any.
 */
export function deriveAmountSign(
  categoryType: 'in' | 'out' | 'system' | 'transfer',
): 'positive' | 'negative' | 'any' {
  if (categoryType === 'out') return 'negative'
  if (categoryType === 'in') return 'positive'
  return 'any' // transfer | system
}

export const CreatePatternSchema = z.object({
  pattern: regexString,
  subCategoryId: z.number({ error: 'Seleziona una sottocategoria.' }).int().positive({ error: 'Seleziona una sottocategoria.' }),
  amountSign: z.enum(['positive', 'negative', 'any']),
  confidence: z.number().min(0).max(1),
  description: z.string().max(255).optional(),
})

export const UpdatePatternSchema = CreatePatternSchema.partial()

/**
 * Client-facing update schema — omits server-derived fields (ADR 0008).
 * Used by updatePatternAction to prevent clients from injecting amountSign
 * or confidence values that must always be derived server-side.
 */
export const UpdatePatternClientSchema = CreatePatternSchema
  .omit({ amountSign: true, confidence: true })
  .partial()

export type CreatePatternInput = z.infer<typeof CreatePatternSchema>
export type UpdatePatternInput = z.infer<typeof UpdatePatternSchema>
export type UpdatePatternClientInput = z.infer<typeof UpdatePatternClientSchema>
export type ActionState = { error: string | null }
