import { z } from 'zod'

// D-02 (minimum 2 months) is enforced here at the input-shape level; D-07 (every instalment
// must be at least €0.01) is validated against the transaction's actual amount inside
// activatePlanTx (lib/services/amortization-activation.ts), since it depends on data this schema
// has no access to.
export const CreateAmortizationPlanSchema = z.object({
  transactionId: z.string().uuid({ error: 'Transazione non valida.' }),
  months: z.number().int().min(2, { error: 'Minimo 2 mesi.' }),
})

export type CreateAmortizationPlanInput = z.infer<typeof CreateAmortizationPlanSchema>

// D-09 undo (Plan 77-02): only the planId crosses the trust boundary — reverseDetachTx re-derives
// the transactionId server-side from the plan row it looks up, scoped to the caller's own userId.
export const RemoveAmortizationPlanSchema = z.object({
  planId: z.string().uuid({ error: 'Pianificazione non valida.' }),
})

export type RemoveAmortizationPlanInput = z.infer<typeof RemoveAmortizationPlanSchema>

// Phase 78 (D-01, AMORT-04): only the planId crosses the trust boundary — closePlanTx re-derives
// ownership server-side, scoped to the caller's own userId (T-78-02).
export const ClosePlanSchema = z.object({
  planId: z.string().uuid({ error: 'Pianificazione non valida.' }),
})

export type ClosePlanInput = z.infer<typeof ClosePlanSchema>

// Phase 78 (D-02, AMORT-05): planId + saleTransactionId cross the trust boundary — realizePlanTx
// re-derives ownership of both server-side (T-78-05).
export const RealizePlanSchema = z.object({
  planId: z.string().uuid({ error: 'Pianificazione non valida.' }),
  saleTransactionId: z.string().uuid({ error: 'Transazione non valida.' }),
})

export type RealizePlanInput = z.infer<typeof RealizePlanSchema>

// Phase 78 (D-03, AMORT-06): planId + refundTransactionId cross the trust boundary — reducePlanTx
// re-derives ownership of both server-side (T-78-06).
export const ReimbursePlanSchema = z.object({
  planId: z.string().uuid({ error: 'Pianificazione non valida.' }),
  refundTransactionId: z.string().uuid({ error: 'Transazione non valida.' }),
})

export type ReimbursePlanInput = z.infer<typeof ReimbursePlanSchema>
