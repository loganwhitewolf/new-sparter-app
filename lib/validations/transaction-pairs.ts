import { z } from 'zod'

export const CreatePairSchema = z.object({
  transactionId: z.string().min(1, { error: 'Transazione non valida.' }),
  counterpartId: z.string().min(1, { error: 'Contropartita non valida.' }),
})

export const DeletePairSchema = z.object({
  transactionId: z.string().min(1, { error: 'Transazione non valida.' }),
})

/**
 * D-09's "remove a single refund" lifecycle action — same shape as DeletePairSchema (a bare
 * transactionId), aliased rather than duplicated since removeRefundAction wraps the same
 * `deletePairByTransactionId` service call.
 */
export const RemoveRefundSchema = DeletePairSchema

/**
 * D-09's "delete the whole reimbursement" lifecycle action — a coerced number since FormData
 * values arrive as strings.
 */
export const DeleteReimbursementSchema = z.object({
  reimbursementId: z.coerce.number({ error: 'Rimborso non valido.' }).int().positive(),
})

/**
 * Validates the parameters for loading eligible counterparts (WR-02).
 *
 * `referenceAmount` is a Drizzle DECIMAL string, so it is validated as a
 * numeric string (never coerced to a JS number — monetary hard rule). The
 * candidate list is already `userId`-scoped in the DAL, so `referenceAmount`
 * only drives the sign filter; this schema rejects malformed input before it
 * reaches the query and enforces `dateFrom <= dateTo`.
 */
export const LoadCounterpartsSchema = z
  .object({
    referenceId: z.string().min(1, { error: 'Transazione di riferimento non valida.' }),
    referenceAmount: z
      .string()
      .regex(/^-?\d+(\.\d+)?$/, { error: 'Importo di riferimento non valido.' }),
    dateFrom: z.date({ error: 'Data iniziale non valida.' }),
    dateTo: z.date({ error: 'Data finale non valida.' }),
  })
  .refine((v) => v.dateFrom <= v.dateTo, {
    error: 'La data iniziale deve precedere la data finale.',
    path: ['dateFrom'],
  })

export type CreatePairInput = z.infer<typeof CreatePairSchema>
export type DeletePairInput = z.infer<typeof DeletePairSchema>
export type LoadCounterpartsInput = z.infer<typeof LoadCounterpartsSchema>
export type RemoveRefundInput = z.infer<typeof RemoveRefundSchema>
export type DeleteReimbursementInput = z.infer<typeof DeleteReimbursementSchema>
