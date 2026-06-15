import { z } from "zod"
import { parseAmount, parseMonths, parseStatus } from '@/lib/utils/search-params'

export const CreateTransactionSchema = z.object({
  description: z
    .string()
    .min(2, { error: "La descrizione deve contenere almeno 2 caratteri." })
    .max(255, { error: "La descrizione non può superare i 255 caratteri." }),
  amount: z
    .string()
    .min(1, { error: "Importo obbligatorio." })
    .refine(
      (v) => {
        const normalized = v.replace(",", ".")
        return !Number.isNaN(Number(normalized)) && Number.isFinite(Number(normalized))
      },
      { message: "Importo non valido." },
    ),
  currency: z.string().length(3).default("EUR"),
  occurredAt: z.string().min(1, { error: "Data obbligatoria." }),
  subCategoryId: z.number().int().positive().optional(),
})

export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>

export const UpdateTransactionCustomTitleSchema = z.object({
  id: z.string().uuid(),
  customTitle: z
    .string()
    .max(255)
    .nullable()
    .transform((v) => (v === "" ? null : v ?? null)),
})

export const DeleteTransactionSchema = z.object({
  id: z.string().uuid({ error: "Transazione non valida." }),
})

export const BulkDeleteTransactionsSchema = z.object({
  ids: z
    .array(z.string().uuid())
    .min(1, { error: "Seleziona almeno una transazione per continuare." })
    .max(500, { error: "Puoi eliminare al massimo 500 transazioni alla volta." }),
})

export type UpdateTransactionCustomTitleInput = z.infer<
  typeof UpdateTransactionCustomTitleSchema
>

export const transactionSortSchema = z.enum(["occurredAt", "amount"])
export const transactionSortDirectionSchema = z.enum(["asc", "desc"])

export type TransactionSort = z.infer<typeof transactionSortSchema>
export type TransactionSortDirection = z.infer<
  typeof transactionSortDirectionSchema
>

export type TransactionSearchParams = Record<
  string,
  string | string[] | undefined
>

export type ParsedTransactionFilters = {
  from?: string
  to?: string
  fromDate?: Date
  toDate?: Date
  platform?: string
  importId?: string
  /** Canonical search param key is 'q'; 'name' accepted for back-compat (Wave 5 migrates URLs) */
  q?: string
  /** Kept for back-compat — Wave 5 URL migration removes this key */
  name?: string
  categorySlug?: string
  subCategoryId?: number
  months?: string[]
  amountMin?: string
  amountMax?: string
  status?: 'uncategorized' | 'categorized'
  /** FlowNature filter — nine enum members plus sentinel 'unclassified' */
  nature?: string
  /** Category type filter — in/out/transfer plus sentinel 'unclassified' */
  type?: string
  sort: TransactionSort
  dir: TransactionSortDirection
}

const DEFAULT_SORT: TransactionSort = "occurredAt"
const DEFAULT_DIR: TransactionSortDirection = "desc"
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const PLATFORM_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const CATEGORY_SLUG_RE = PLATFORM_SLUG_RE
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Allowlists for category-derived filters (Task 1)
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
  const rawValue = Array.isArray(value) ? value[0] : value
  const trimmed = rawValue?.trim()

  return trimmed ? trimmed : undefined
}

function parseDateOnly(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined
  }

  const match = DATE_ONLY_RE.exec(value)

  if (!match) {
    return undefined
  }

  const [, year, month, day] = match
  const numericYear = Number(year)
  const numericMonth = Number(month)
  const numericDay = Number(day)
  const parsed = new Date(
    Date.UTC(numericYear, numericMonth - 1, numericDay, 0, 0, 0, 0),
  )

  if (
    parsed.getUTCFullYear() !== numericYear ||
    parsed.getUTCMonth() !== numericMonth - 1 ||
    parsed.getUTCDate() !== numericDay
  ) {
    return undefined
  }

  return parsed
}

export function getInclusiveToDate(value: string): Date | undefined {
  const startOfDay = parseDateOnly(value)

  if (!startOfDay) {
    return undefined
  }

  return new Date(
    Date.UTC(
      startOfDay.getUTCFullYear(),
      startOfDay.getUTCMonth(),
      startOfDay.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  )
}

export function parseTransactionFilters(
  input: TransactionSearchParams,
): ParsedTransactionFilters {
  // Wave 5 URL migration: legacy `from`/`to` date params are no longer parsed into active
  // filters. Old shared links with ?from=&to= silently degrade to the default view (total
  // parsing — never throw). The month-multi `months` param is the canonical temporal filter.
  const platform = firstTrimmed(input.platform)
  const rawImportId = firstTrimmed(input.importId)
  // D-19: canonical key is 'q'; 'name' accepted for back-compat (Wave 5 migrates old URLs)
  const rawQ = firstTrimmed(input.q) ?? firstTrimmed(input.name)
  const rawCategory = firstTrimmed(input.category)
  const rawSubCategory = firstTrimmed(input.subCategory)
  const sort = transactionSortSchema.safeParse(firstTrimmed(input.sort))
  const dir = transactionSortDirectionSchema.safeParse(firstTrimmed(input.dir))
  const importId =
    rawImportId && UUID_RE.test(rawImportId) ? rawImportId : undefined
  const q = rawQ && rawQ.length <= 200 ? rawQ : undefined
  const categorySlug = rawCategory && CATEGORY_SLUG_RE.test(rawCategory) ? rawCategory : undefined
  const parsedSubCategoryId = rawSubCategory ? Number(rawSubCategory) : NaN
  const subCategoryId = Number.isInteger(parsedSubCategoryId) && parsedSubCategoryId > 0
    ? parsedSubCategoryId
    : undefined
  const months = parseMonths(input.months)
  const amountMin = parseAmount(input.amountMin)
  const amountMax = parseAmount(input.amountMax)
  const status = parseStatus(input.status, ['categorized', 'uncategorized']) as
    | 'categorized'
    | 'uncategorized'
    | undefined
  const nature = parseStatus(input.nature, NATURE_ALLOWED)
  const type = parseStatus(input.direction ?? input.type, TYPE_ALLOWED)

  return {
    ...(platform && PLATFORM_SLUG_RE.test(platform) ? { platform } : {}),
    ...(importId ? { importId } : {}),
    ...(q ? { q, name: q } : {}),
    ...(categorySlug ? { categorySlug } : {}),
    ...(subCategoryId ? { subCategoryId } : {}),
    ...(months.length > 0 ? { months } : {}),
    ...(amountMin ? { amountMin } : {}),
    ...(amountMax ? { amountMax } : {}),
    ...(status ? { status } : {}),
    ...(nature ? { nature } : {}),
    ...(type ? { type } : {}),
    sort: sort.success ? sort.data : DEFAULT_SORT,
    dir: dir.success ? dir.data : DEFAULT_DIR,
  }
}
