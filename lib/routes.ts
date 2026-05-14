import type { DashboardPreset } from '@/lib/validations/dashboard'

export const APP_ROUTES = {
  dashboard: '/dashboard',
  dashboardOverview: '/dashboard/overview',
  dashboardCategories: '/dashboard/categories',
  expenses: '/expenses',
  import: '/import',
  transactions: '/transactions',
  settings: '/settings',
  categorySettings: '/settings/categories',
} as const

type DashboardCategoryDetailFilters = {
  preset?: DashboardPreset
  type?: 'in' | 'out'
  defaultPreset?: DashboardPreset
}

export function dashboardCategoryDetail(id: number | string) {
  return `${APP_ROUTES.dashboardCategories}/${encodeURIComponent(String(id))}`
}

export function buildDashboardCategoryDetailHref(
  id: number | string,
  filters: DashboardCategoryDetailFilters = {}
) {
  const params = new URLSearchParams()
  const defaultPreset = filters.defaultPreset ?? 'this-year'

  if (filters.preset && filters.preset !== defaultPreset) {
    params.set('preset', filters.preset)
  }

  if (filters.type === 'in') {
    params.set('type', filters.type)
  }

  const search = params.toString()
  return dashboardCategoryDetail(id) + (search ? `?${search}` : '')
}
