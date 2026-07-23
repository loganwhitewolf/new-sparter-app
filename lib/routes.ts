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

export const MARKETING_ROUTES = {
  home: '/',
  howItWorks: '/how-it-works',
  privacy: '/privacy',
  terms: '/terms',
} as const

export const AUTH_PAGE_ROUTES = {
  login: '/login',
  register: '/register',
} as const

export const PUBLIC_MARKETING_ROUTES = [
  MARKETING_ROUTES.home,
  MARKETING_ROUTES.howItWorks,
  MARKETING_ROUTES.privacy,
  MARKETING_ROUTES.terms,
] as const

export const AUTH_ROUTES = [AUTH_PAGE_ROUTES.login, AUTH_PAGE_ROUTES.register] as const

export const PUBLIC_ROUTES = [...PUBLIC_MARKETING_ROUTES, ...AUTH_ROUTES] as const

/** Exact allowlist helper — avoids `as const` Array.includes type narrowing pain */
export function isPublicPath(path: string): boolean {
  return (PUBLIC_ROUTES as readonly string[]).includes(path)
}

export function isAuthPath(path: string): boolean {
  return (AUTH_ROUTES as readonly string[]).includes(path)
}

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

// Transactions list narrowed to one tag. `?tag=` is the transactions filter param (TAG-14) —
// read by parseTransactionFilters and guarded by resolveOwnedTagId on the page. Distinct from
// the dashboard, which no longer has a tag filter at all (TAG-13).
export function transactionsByTagHref(tagId: number | string) {
  return `${APP_ROUTES.transactions}?tag=${encodeURIComponent(String(tagId))}`
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
