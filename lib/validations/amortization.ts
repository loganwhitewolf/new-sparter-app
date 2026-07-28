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
