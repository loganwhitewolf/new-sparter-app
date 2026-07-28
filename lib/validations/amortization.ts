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
