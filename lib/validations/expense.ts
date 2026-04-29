import { z } from 'zod'

export const CreateExpenseSchema = z.object({
  title: z
    .string()
    .min(2, { error: 'Il titolo deve contenere almeno 2 caratteri.' })
    .max(120, { error: 'Il titolo non può superare i 120 caratteri.' }),
  subCategoryId: z.number().int().positive().optional(),
  notes: z.string().max(500, { error: 'Le note non possono superare i 500 caratteri.' }).optional(),
})

export const UpdateExpenseSchema = CreateExpenseSchema.extend({
  id: z.string().min(1, { error: 'ID spesa mancante.' }),
})

export const BulkCategorizeSchema = z.object({
  ids: z.array(z.string()).min(1, { error: 'Seleziona almeno una spesa per continuare.' }),
  subCategoryId: z.number().int().positive({ error: 'Seleziona una categoria prima di confermare.' }),
})

export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>
export type UpdateExpenseInput = z.infer<typeof UpdateExpenseSchema>
export type BulkCategorizeInput = z.infer<typeof BulkCategorizeSchema>
export type ActionState = { error: string | null }
