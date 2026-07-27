import { z } from 'zod'

/**
 * D-03's inline edit-title submission (Phase 76 Plan 05, RMB-11): deliberately NO `.min(1)` on
 * `title` — an empty title is a valid, meaningful state (it triggers the anchor-title fallback via
 * `resolveReimbursementDisplayTitle`, lib/utils/reimbursement-format.ts), not a validation error.
 *
 * `.trim()` (WR-02) normalizes at the source of truth: a whitespace-only submission (`"   "`) is
 * stored as `''`, not verbatim, so the D-03 fallback semantics hold for every future reader of
 * `reimbursement.title` — not only the ones that happen to `.trim()` again at display time.
 */
export const UpdateReimbursementTitleSchema = z.object({
  reimbursementId: z.coerce.number({ error: 'Rimborso non valido.' }).int().positive(),
  title: z.string().trim().max(255, { error: 'Titolo troppo lungo.' }),
})

export type UpdateReimbursementTitleInput = z.infer<typeof UpdateReimbursementTitleSchema>
