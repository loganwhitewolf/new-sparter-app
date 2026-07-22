import { z } from 'zod'
import { getInclusiveToDate, parseDateOnly } from './transactions'

// D-01/D-02: tags are a curated entity — name + optional date range, case/whitespace-insensitive
// uniqueness enforced by createTag/updateTag (Plan 67-03) and the DB unique(userId, normalizedName)
// constraint (lib/db/schema.ts). Never free-typed inline.
export const CreateTagSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, { error: 'Il nome del tag deve contenere almeno 2 caratteri.' })
      .max(60, { error: 'Il nome del tag non può superare i 60 caratteri.' }),
    // D-09: dateRangeEnd runs through getInclusiveToDate (end-of-day) so a later
    // `occurredAt <= dateRangeEnd` comparison is correctly inclusive with no extra date math.
    dateRangeStart: z
      .string()
      .optional()
      .transform((v) => (v ? parseDateOnly(v) : undefined)),
    dateRangeEnd: z
      .string()
      .optional()
      .transform((v) => (v ? getInclusiveToDate(v) : undefined)),
  })
  .refine((data) => !data.dateRangeStart || !data.dateRangeEnd || data.dateRangeStart <= data.dateRangeEnd, {
    error: 'La data di inizio deve precedere la data di fine.',
    path: ['dateRangeEnd'],
  })

// D-03: edit allows changing both name and date range independently after creation.
export const UpdateTagSchema = z
  .object({
    id: z.coerce.number().int().positive({ error: 'Tag non valido.' }),
    name: z
      .string()
      .trim()
      .min(2, { error: 'Il nome del tag deve contenere almeno 2 caratteri.' })
      .max(60, { error: 'Il nome del tag non può superare i 60 caratteri.' })
      .optional(),
    dateRangeStart: z
      .string()
      .optional()
      .transform((v) => (v ? parseDateOnly(v) : undefined)),
    dateRangeEnd: z
      .string()
      .optional()
      .transform((v) => (v ? getInclusiveToDate(v) : undefined)),
  })
  .refine((data) => !data.dateRangeStart || !data.dateRangeEnd || data.dateRangeStart <= data.dateRangeEnd, {
    error: 'La data di inizio deve precedere la data di fine.',
    path: ['dateRangeEnd'],
  })

// D-04: archive, never delete — the only removal state a tag can enter.
export const ArchiveTagSchema = z.object({
  id: z.coerce.number().int().positive({ error: 'Tag non valido.' }),
})

// D-06: bulk-assign is additive (union) — chosen tags are added to whatever the selected
// transactions already carry.
export const BulkAssignTagsSchema = z.object({
  transactionIds: z
    .array(z.string().uuid())
    .min(1, { error: 'Seleziona almeno una transazione.' })
    .max(500, { error: 'Puoi assegnare tag ad al massimo 500 transazioni alla volta.' }),
  tagIds: z
    .array(z.coerce.number().int().positive())
    .min(1, { error: 'Seleziona almeno un tag.' }),
})

// D-07: symmetric bulk removal — same shape, separate export so both call sites in
// lib/actions/transaction-tags.ts read unambiguously.
export const BulkRemoveTagsSchema = z.object({
  transactionIds: z
    .array(z.string().uuid())
    .min(1, { error: 'Seleziona almeno una transazione.' })
    .max(500, { error: 'Puoi rimuovere tag da al massimo 500 transazioni alla volta.' }),
  tagIds: z
    .array(z.coerce.number().int().positive())
    .min(1, { error: 'Seleziona almeno un tag.' }),
})

// D-07b: single-transaction add/remove action pair (detail page + row chips).
export const SingleTransactionTagSchema = z.object({
  transactionId: z.string().uuid({ error: 'Transazione non valida.' }),
  tagId: z.coerce.number().int().positive({ error: 'Tag non valido.' }),
})

export type CreateTagInput = z.infer<typeof CreateTagSchema>
export type UpdateTagInput = z.infer<typeof UpdateTagSchema>
export type ArchiveTagInput = z.infer<typeof ArchiveTagSchema>
export type BulkAssignTagsInput = z.infer<typeof BulkAssignTagsSchema>
export type BulkRemoveTagsInput = z.infer<typeof BulkRemoveTagsSchema>
export type SingleTransactionTagInput = z.infer<typeof SingleTransactionTagSchema>
