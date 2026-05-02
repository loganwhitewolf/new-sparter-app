import { z } from 'zod'

const regexString = z.string().min(1).superRefine((val, ctx) => {
  try {
    new RegExp(val, 'i')
  } catch {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Pattern regex non valido.' })
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
