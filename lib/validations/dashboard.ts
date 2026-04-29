import { z } from 'zod'
import { DASHBOARD_PRESETS } from '@/lib/utils/date'

export const DashboardPresetSchema = z.enum(DASHBOARD_PRESETS).default('last-month')
export const DashboardTypeSchema = z.enum(['out', 'in', 'all']).default('out')

export const DashboardFiltersSchema = z.object({
  preset: DashboardPresetSchema,
  type: DashboardTypeSchema,
})

export type DashboardPreset = z.infer<typeof DashboardPresetSchema>
export type DashboardType = z.infer<typeof DashboardTypeSchema>
export type DashboardFilters = z.infer<typeof DashboardFiltersSchema>

export function parseDashboardFilters(input: {
  preset?: string | string[]
  type?: string | string[]
}): DashboardFilters {
  const rawPreset = Array.isArray(input.preset) ? input.preset[0] : input.preset
  const rawType = Array.isArray(input.type) ? input.type[0] : input.type

  return DashboardFiltersSchema.parse({
    preset: rawPreset ?? 'last-month',
    type: rawType ?? 'out',
  })
}
