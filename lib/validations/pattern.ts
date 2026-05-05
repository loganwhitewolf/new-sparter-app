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

export const CreatePatternSchema = z.object({
  pattern: regexString,
  subCategoryId: z.number().int().positive({ error: 'Seleziona una sottocategoria.' }),
  amountSign: z.enum(['positive', 'negative', 'any']),
  confidence: z.number().min(0).max(1),
  description: z.string().max(255).optional(),
})

export const UpdatePatternSchema = CreatePatternSchema.partial()

export type CreatePatternInput = z.infer<typeof CreatePatternSchema>
export type UpdatePatternInput = z.infer<typeof UpdatePatternSchema>
export type ActionState = { error: string | null }
