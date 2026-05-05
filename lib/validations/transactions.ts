import { z } from "zod"

export const UpdateTransactionCustomTitleSchema = z.object({
  id: z.string().uuid(),
  customTitle: z
    .string()
    .max(255)
    .nullable()
    .transform((v) => (v === "" ? null : v ?? null)),
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
  sort: TransactionSort
  dir: TransactionSortDirection
}

const DEFAULT_SORT: TransactionSort = "occurredAt"
const DEFAULT_DIR: TransactionSortDirection = "desc"
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const PLATFORM_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

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
  const from = firstTrimmed(input.from)
  const to = firstTrimmed(input.to)
  const platform = firstTrimmed(input.platform)
  const sort = transactionSortSchema.safeParse(firstTrimmed(input.sort))
  const dir = transactionSortDirectionSchema.safeParse(firstTrimmed(input.dir))
  const fromDate = parseDateOnly(from)
  const toDate = to ? getInclusiveToDate(to) : undefined

  return {
    ...(fromDate ? { from, fromDate } : {}),
    ...(toDate ? { to, toDate } : {}),
    ...(platform && PLATFORM_SLUG_RE.test(platform) ? { platform } : {}),
    sort: sort.success ? sort.data : DEFAULT_SORT,
    dir: dir.success ? dir.data : DEFAULT_DIR,
  }
}
