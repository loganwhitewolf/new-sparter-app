import { z } from 'zod'
import { DASHBOARD_PRESETS } from '@/lib/utils/date'

export const DashboardPresetSchema = z.enum(DASHBOARD_PRESETS).default('last-month')
export const DashboardTypeSchema = z.enum(['out', 'in', 'all']).default('out')
export const DashboardSortSchema = z.enum(['deviation', 'amount'])
export type DashboardSort = z.infer<typeof DashboardSortSchema>

export const DashboardFiltersSchema = z.object({
  preset: DashboardPresetSchema,
  type: DashboardTypeSchema,
  sort: DashboardSortSchema.default('amount'),
})

export type DashboardPreset = z.infer<typeof DashboardPresetSchema>
export type DashboardType = z.infer<typeof DashboardTypeSchema>
export type DashboardFilters = z.infer<typeof DashboardFiltersSchema>

export function parseDashboardFilters(
  input: {
    preset?: string | string[]
    period?: string | string[]
    type?: string | string[]
    sort?: string | string[]
  },
  options?: { defaultPreset?: DashboardPreset; defaultSort?: DashboardSort }
): DashboardFilters {
  const rawPreset = Array.isArray(input.preset) ? input.preset[0] : input.preset
  const rawPeriod = Array.isArray(input.period) ? input.period[0] : input.period
  const rawType = Array.isArray(input.type) ? input.type[0] : input.type
  const rawSort = Array.isArray(input.sort) ? input.sort[0] : input.sort
  const defaultPreset = options?.defaultPreset ?? 'last-month'
  const defaultSort: DashboardSort = options?.defaultSort ?? 'amount'
  const presetCandidate = rawPreset ?? rawPeriod ?? defaultPreset
  const sortCandidate = rawSort ?? defaultSort

  return {
    preset: DashboardPresetSchema.safeParse(presetCandidate).success
      ? (presetCandidate as DashboardPreset)
      : defaultPreset,
    type: DashboardTypeSchema.safeParse(rawType ?? 'out').success
      ? ((rawType ?? 'out') as DashboardType)
      : 'out',
    sort: DashboardSortSchema.safeParse(sortCandidate).success
      ? (sortCandidate as DashboardSort)
      : defaultSort,
  }
}

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
