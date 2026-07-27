import { z } from 'zod'

/**
 * D-03's inline edit-title submission (Phase 76 Plan 05, RMB-11): deliberately NO `.min(1)` on
 * `title` — an empty title is a valid, meaningful state (it triggers the anchor-title fallback via
 * `resolveReimbursementDisplayTitle`, lib/utils/reimbursement-format.ts), not a validation error.
 */
export const UpdateReimbursementTitleSchema = z.object({
  reimbursementId: z.coerce.number({ error: 'Rimborso non valido.' }).int().positive(),
  title: z.string().max(255, { error: 'Titolo troppo lungo.' }),
})

export type UpdateReimbursementTitleInput = z.infer<typeof UpdateReimbursementTitleSchema>
