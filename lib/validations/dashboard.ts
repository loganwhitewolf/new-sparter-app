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

/**
 * Sync candidate-tagId parser for the dashboard's `?tag=` searchParam — same
 * numeric-parse idiom as the transactions `tag`/`subCategoryId` handling
 * (accept string or string[], take the first value, reject non-positive
 * integers). This only produces a CANDIDATE id; callers MUST pass the result
 * through resolveOwnedTagId() (lib/dal/tags.ts) before trusting it, since
 * this function performs no ownership check (68-01, IDOR defense-in-depth).
 */
export function parseTagIdParam(input: { tag?: string | string[] }): number | undefined {
  const rawTag = Array.isArray(input.tag) ? input.tag[0] : input.tag
  const trimmed = rawTag?.trim()
  const parsed = trimmed ? Number(trimmed) : NaN

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

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
