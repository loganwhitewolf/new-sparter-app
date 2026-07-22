import type { DashboardPreset, DashboardSort } from '@/lib/validations/dashboard'

export const APP_ROUTES = {
  dashboard: '/dashboard',
  dashboardOverview: '/dashboard/overview',
  dashboardCategories: '/dashboard/categories',
  expenses: '/expenses',
  import: '/import',
  onboarding: '/onboarding',
  transactions: '/transactions',
  settings: '/settings',
  categorySettings: '/settings/categories',
  tags: '/tags',
  patterns: '/patterns',
  dashboardTags: '/dashboard/tags',
  profile: '/profile',                  // compatibility alias (D-04)
  profileSettings: '/settings/profile', // canonical (D-03)
} as const

export const ONBOARDING_STEP_AFTER_PRIVATE_PLATFORM_CREATION = 2
export const ONBOARDING_AFTER_PRIVATE_PLATFORM_CREATION_ROUTE =
  `${APP_ROUTES.onboarding}?step=${ONBOARDING_STEP_AFTER_PRIVATE_PLATFORM_CREATION}` as const

type DashboardCategoryFilters = {
  preset?: DashboardPreset
  type?: 'in' | 'out'
  sort?: DashboardSort
  defaultPreset?: DashboardPreset
  defaultSort?: DashboardSort
}

export function buildDashboardCategoriesHref(filters: DashboardCategoryFilters = {}) {
  const params = new URLSearchParams()
  const defaultPreset = filters.defaultPreset ?? 'this-year'
  const defaultSort: DashboardSort = filters.defaultSort ?? 'amount'

  if (filters.preset && filters.preset !== defaultPreset) {
    params.set('preset', filters.preset)
  }

  if (filters.type === 'in') {
    params.set('type', filters.type)
  }

  if (filters.sort && filters.sort !== defaultSort) {
    params.set('sort', filters.sort)
  }

  const search = params.toString()
  return APP_ROUTES.dashboardCategories + (search ? `?${search}` : '')
}

export function dashboardCategoryDetail(id: number | string) {
  return `${APP_ROUTES.dashboardCategories}/${encodeURIComponent(String(id))}`
}

export function tagDetail(id: number | string) {
  return `${APP_ROUTES.tags}/${encodeURIComponent(String(id))}`
}

export function transactionDetailHref(id: string) {
  return `${APP_ROUTES.transactions}/${encodeURIComponent(id)}`
}

export function expenseDetailHref(id: string) {
  return `${APP_ROUTES.expenses}/${encodeURIComponent(id)}`
}

export function expenseGroupDetailHref(groupId: number | string): string {
  return `${APP_ROUTES.expenses}/groups/${encodeURIComponent(String(groupId))}`
}

export function importFileDetailHref(fileId: string): string {
  return `${APP_ROUTES.import}/${encodeURIComponent(fileId)}`
}

export function buildDashboardCategoryDetailHref(
  id: number | string,
  filters: DashboardCategoryFilters = {}
) {
  const params = new URLSearchParams()
  const defaultPreset = filters.defaultPreset ?? 'this-year'
  const defaultSort: DashboardSort = filters.defaultSort ?? 'amount'

  if (filters.preset && filters.preset !== defaultPreset) {
    params.set('preset', filters.preset)
  }

  if (filters.type === 'in') {
    params.set('type', filters.type)
  }

  if (filters.sort && filters.sort !== defaultSort) {
    params.set('sort', filters.sort)
  }

  const search = params.toString()
  return dashboardCategoryDetail(id) + (search ? `?${search}` : '')
}
