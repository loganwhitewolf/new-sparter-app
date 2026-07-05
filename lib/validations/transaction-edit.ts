import { z } from 'zod'

export const UpdateTransactionSchema = z
  .object({
    id: z.string().uuid(),
    amount: z
      .string()
      .min(1, { error: 'Importo obbligatorio.' })
      .refine(
        (v) => {
          const normalized = v.replace(',', '.')
          return !Number.isNaN(Number(normalized)) && Number.isFinite(Number(normalized))
        },
        { message: 'Importo non valido.' },
      )
      .optional(),
    occurredAt: z.string().min(1, { error: 'Data obbligatoria.' }).optional(),
    customTitle: z
      .string()
      .max(255)
      .nullable()
      .transform((v) => (v === '' ? null : v ?? null))
      .optional(),
  })
  .refine(
    (data) =>
      data.amount !== undefined || data.occurredAt !== undefined || data.customTitle !== undefined,
    { error: 'Nessun campo da modificare.' },
  )

export type UpdateTransactionInput = z.infer<typeof UpdateTransactionSchema>
