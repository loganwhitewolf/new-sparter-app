import { z } from 'zod'
import { parseAmount, parseStatus } from '@/lib/utils/search-params'

export const CreateExpenseSchema = z.object({
  title: z
    .string()
    .min(2, { error: 'Il titolo deve contenere almeno 2 caratteri.' })
    .max(500, { error: 'Il titolo non può superare i 500 caratteri.' }),
  subCategoryId: z.number().int().positive().optional(),
  notes: z.string().max(500, { error: 'Le note non possono superare i 500 caratteri.' }).optional(),
})

export const UpdateExpenseSchema = CreateExpenseSchema.extend({
  id: z.string().min(1, { error: 'ID spesa mancante.' }),
})

export const UpdateExpenseTitleSchema = z.object({
  id: z.string().min(1, { error: 'ID spesa mancante.' }),
  title: z
    .string()
    .trim()
    .min(2, { error: 'Il titolo deve contenere almeno 2 caratteri.' })
    .max(500, { error: 'Il titolo non può superare i 500 caratteri.' }),
})

export const BulkCategorizeSchema = z.object({
  ids: z.array(z.string()).min(1, { error: 'Seleziona almeno una spesa per continuare.' }),
  subCategoryId: z.number().int().positive({ error: 'Seleziona una categoria prima di confermare.' }),
})

export const BulkDeleteExpensesSchema = z.object({
  ids: z
    .array(z.string().uuid())
    .min(1, { error: 'Seleziona almeno una spesa per continuare.' })
    .max(500, { error: 'Puoi eliminare al massimo 500 spese alla volta.' }),
  deleteLinkedTransactions: z
    .preprocess((value) => value === 'true' || value === true, z.boolean())
    .optional()
    .default(false),
})

export const DeleteExpenseSchema = z.object({
  id: z.string().uuid({ error: 'Spesa non valida.' }),
  deleteLinkedTransactions: z
    .preprocess((value) => value === 'true' || value === true, z.boolean())
    .optional()
    .default(false),
})

export const SingleCategorizeSchema = z.object({
  id: z.string().min(1, { error: 'ID spesa mancante.' }),
  subCategoryId: z.number().int().positive({ error: 'Seleziona una categoria prima di confermare.' }),
})

export const IgnoreExpenseSchema = z.object({
  id: z.string().min(1, { error: 'ID spesa mancante.' }),
})

// Merge (Unisci) — Phase 65, ADR 0017. Pure regrouping: deliberately carries no
// category field (D-02) — the merge dialog categorizes uncategorized selections
// via the pre-existing BulkCategorizeSchema/bulkCategorize action first, as a
// separate call, before this schema's input is ever submitted.
export const MergeExpensesSchema = z.object({
  selectedExpenseIds: z
    .array(z.string().uuid())
    .min(2, { error: 'Seleziona almeno due spese per unire.' })
    .max(500, { error: 'Puoi unire al massimo 500 spese alla volta.' })
    // WR-03: enforce "at least two DISTINCT expenses" — without this, a duplicated id
    // (e.g. ["a", "a"]) passes .min(2) on the raw array but dedupes to a single real
    // expense downstream in mergeExpenses, silently creating a one-member "group".
    .refine((ids) => new Set(ids).size === ids.length, {
      error: 'Spese duplicate nella selezione.',
    }),
  groupTitle: z
    .string()
    .trim()
    .min(2, { error: 'Il titolo del gruppo deve contenere almeno 2 caratteri.' })
    .max(500, { error: 'Il titolo del gruppo non può superare i 500 caratteri.' }),
})

export const RenameExpenseGroupSchema = z.object({
  groupId: z.coerce.number().int().positive({ error: 'Gruppo non valido.' }),
  title: z
    .string()
    .trim()
    .min(2, { error: 'Il titolo deve contenere almeno 2 caratteri.' })
    .max(500, { error: 'Il titolo non può superare i 500 caratteri.' }),
})

export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>
export type UpdateExpenseInput = z.infer<typeof UpdateExpenseSchema>
export type UpdateExpenseTitleInput = z.infer<typeof UpdateExpenseTitleSchema>
export type BulkCategorizeInput = z.infer<typeof BulkCategorizeSchema>
export type BulkDeleteExpensesInput = z.infer<typeof BulkDeleteExpensesSchema>
export type SingleCategorizeInput = z.infer<typeof SingleCategorizeSchema>
export type IgnoreExpenseInput = z.infer<typeof IgnoreExpenseSchema>
export type MergeExpensesInput = z.infer<typeof MergeExpensesSchema>
export type RenameExpenseGroupInput = z.infer<typeof RenameExpenseGroupSchema>
export type ActionState = { error: string | null }

// ─── Shared filter parser for the Expenses page toolbar ───────────────────────

export type ExpenseSearchParams = Record<string, string | string[] | undefined>

export type ParsedExpenseFilters = {
  q?: string
  categorySlug?: string
  platform?: string
  status?: 'uncategorized' | 'categorized'
  amountMin?: string
  amountMax?: string
  sort?: 'createdAt' | 'totalAmount' | 'title' | 'category'
  dir?: 'asc' | 'desc'
  /** FlowNature filter — nine enum members plus sentinel 'unclassified'. Mirrors transactions. */
  nature?: string
  /** Category type filter — in/out/transfer plus sentinel 'unclassified'. */
  type?: string
  /** Subcategory id derived from subCategory URL param (positive integer). */
  subCategoryId?: number
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// Allowlists mirroring lib/validations/transactions.ts — local const to avoid coupling.
const NATURE_ALLOWED = [
  'essential',
  'discretionary',
  'operational',
  'financial',
  'income',
  'income_extraordinary',
  'debt',
  'extraordinary',
  'transfer',
  'unclassified',
] as const

const TYPE_ALLOWED = ['in', 'out', 'allocation', 'transfer', 'unclassified'] as const

function firstTrimmed(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  const trimmed = raw?.trim()
  return trimmed ? trimmed : undefined
}

/**
 * Total function — never throws. Drops invalid tokens silently.
 * D-05: period is NOT included; expenses default to all-time view.
 */
export function parseExpenseFilters(input: ExpenseSearchParams): ParsedExpenseFilters {
  const rawQ = firstTrimmed(input.q)
  const rawCategory = firstTrimmed(input.category)
  const rawPlatform = firstTrimmed(input.platform)
  const rawSort = firstTrimmed(input.sort)
  const rawDir = firstTrimmed(input.dir)
  const rawSubCategory = firstTrimmed(input.subCategory)

  const q = rawQ && rawQ.length <= 200 ? rawQ : undefined
  const categorySlug = rawCategory && SLUG_RE.test(rawCategory) ? rawCategory : undefined
  const platform = rawPlatform && SLUG_RE.test(rawPlatform) ? rawPlatform : undefined
  const status = parseStatus(input.status, ['categorized', 'uncategorized']) as
    | 'categorized'
    | 'uncategorized'
    | undefined
  const amountMin = parseAmount(input.amountMin)
  const amountMax = parseAmount(input.amountMax)
  const sort: 'createdAt' | 'totalAmount' | 'title' | 'category' | undefined =
    rawSort === 'totalAmount'
      ? 'totalAmount'
      : rawSort === 'createdAt'
        ? 'createdAt'
        : rawSort === 'title'
          ? 'title'
          : rawSort === 'category'
            ? 'category'
            : undefined
  const dir: 'asc' | 'desc' | undefined = rawDir === 'asc' ? 'asc' : rawDir === 'desc' ? 'desc' : undefined
  const nature = parseStatus(input.nature, NATURE_ALLOWED)
  const type = parseStatus(input.direction ?? input.type, TYPE_ALLOWED)
  const parsedSubCategoryId = rawSubCategory ? Number(rawSubCategory) : NaN
  const subCategoryId =
    Number.isInteger(parsedSubCategoryId) && parsedSubCategoryId > 0
      ? parsedSubCategoryId
      : undefined

  return {
    ...(q ? { q } : {}),
    ...(categorySlug ? { categorySlug } : {}),
    ...(platform ? { platform } : {}),
    ...(status ? { status } : {}),
    ...(amountMin ? { amountMin } : {}),
    ...(amountMax ? { amountMax } : {}),
    ...(sort ? { sort } : {}),
    ...(dir ? { dir } : {}),
    ...(nature ? { nature } : {}),
    ...(type ? { type } : {}),
    ...(subCategoryId ? { subCategoryId } : {}),
  }
}
