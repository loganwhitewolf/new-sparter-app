import { z } from 'zod'

export const CreatePairSchema = z.object({
  transactionId: z.string().min(1, { error: 'Transazione non valida.' }),
  counterpartId: z.string().min(1, { error: 'Contropartita non valida.' }),
})

export const DeletePairSchema = z.object({
  transactionId: z.string().min(1, { error: 'Transazione non valida.' }),
})

export type CreatePairInput = z.infer<typeof CreatePairSchema>
export type DeletePairInput = z.infer<typeof DeletePairSchema>
