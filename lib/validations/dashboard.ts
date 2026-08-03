import { z } from 'zod'

// D-12 — the year-based Categories URL contract (Phase 83). Additive: does not touch any
// existing export above, which the category DETAIL page (Phase 84 scope) and the v2.8/v2.9
// regression harness still depend on unchanged.
export const CategoryYearDirectionSchema = z.enum(['out', 'in', 'allocation']).default('out')
export type CategoryYearDirection = z.infer<typeof CategoryYearDirectionSchema>
export const CategoryYearSortSchema = z.enum(['amount', 'projection']).default('amount')
export type CategoryYearSort = z.infer<typeof CategoryYearSortSchema>

/**
 * Parses the Categories list's direction filter (D-09: Uscite / Entrate / Accantonamenti).
 * Total function — first-element semantics for array input, falls back to 'out' on any
 * invalid/absent value, never throws.
 */
export function parseCategoryYearDirection(
  value: string | string[] | undefined
): CategoryYearDirection {
  const raw = Array.isArray(value) ? value[0] : value
  const candidate = raw ?? 'out'
  return CategoryYearDirectionSchema.safeParse(candidate).success
    ? (candidate as CategoryYearDirection)
    : 'out'
}

/**
 * Parses the Categories list's sort filter (D-08: total | projection). 'deviation' is retired
 * vocabulary and falls back to 'amount' like any other invalid value — never throws.
 */
export function parseCategoryYearSort(value: string | string[] | undefined): CategoryYearSort {
  const raw = Array.isArray(value) ? value[0] : value
  const candidate = raw ?? 'amount'
  return CategoryYearSortSchema.safeParse(candidate).success
    ? (candidate as CategoryYearSort)
    : 'amount'
}
