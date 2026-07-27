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

/**
 * D-05's multi-select add-refund submission (Phase 75 Plan 04): the anchor is a discriminated
 * shape carried as two OPTIONAL flat fields (FormData cannot nest objects) — exactly one of
 * `transactionId` / `groupId` must be present, enforced by the `.refine` below (never both, never
 * neither). `counterpartIds` rejects an empty selection server-side (Edge RMB-08/empty) — the
 * client also disables submit on an empty selection, but the server never trusts that alone.
 */
export const CreateMultiRefundSchema = z
  .object({
    transactionId: z.string().min(1).optional(),
    groupId: z.coerce.number().int().positive().optional(),
    counterpartIds: z
      .array(z.string().min(1))
      .min(1, { error: 'Seleziona almeno un rimborso da collegare.' }),
  })
  .refine((v) => Boolean(v.transactionId) !== Boolean(v.groupId), {
    error: 'Specificare esattamente un ancoraggio (transazione o gruppo).',
    path: ['transactionId'],
  })

/**
 * D-06's Group-anchor picker window: resolves the Group's occurrence interval to default the
 * candidate date range (±90 days from first/last member transaction), rather than a single
 * reference date.
 */
export const LoadGroupOccurrenceIntervalSchema = z.object({
  groupId: z.coerce.number({ error: 'Gruppo non valido.' }).int().positive(),
})

/**
 * D-06's Group-anchor candidate loading: same shape as LoadCounterpartsSchema but keyed on
 * `groupId` (the DAL resolves the group's own member transaction ids for exclusion server-side —
 * see `getGroupMemberTransactionIds`) instead of a single `referenceId`.
 */
export const LoadGroupRefundCandidatesSchema = z
  .object({
    groupId: z.coerce.number({ error: 'Gruppo non valido.' }).int().positive(),
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
export type CreateMultiRefundInput = z.infer<typeof CreateMultiRefundSchema>
export type LoadGroupOccurrenceIntervalInput = z.infer<typeof LoadGroupOccurrenceIntervalSchema>
export type LoadGroupRefundCandidatesInput = z.infer<typeof LoadGroupRefundCandidatesSchema>
