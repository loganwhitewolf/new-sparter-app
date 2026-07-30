import type { DashboardPreset, DashboardSort } from '@/lib/validations/dashboard'
import type { Lens } from '@/lib/utils/search-params'

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
  reimbursements: '/reimbursements',
  amortizations: '/amortizations',
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
  // Phase 80, CR-02: the global cash/accrual lens must survive same-tab category
  // navigation (sort toggle, back link, row click-through) the same way preset/type/sort
  // already do — only appended when non-default ('competenza'), mirroring how
  // DashboardTabNav forwards `?lens=` from the current searchParams.
  lens?: Lens
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

  if (filters.lens === 'competenza') {
    params.set('lens', filters.lens)
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

export function reimbursementHref(id: number | string) {
  return `${APP_ROUTES.reimbursements}/${encodeURIComponent(String(id))}`
}

// The `/amortizations/[id]` plan-detail page is deferred (D-D1) — row clicks in the registry
// navigate to transactionDetailHref instead. This helper is provided for future use/consistency
// only, mirroring reimbursementHref's shape.
export function amortizationDetailHref(planId: string) {
  return `${APP_ROUTES.amortizations}/${encodeURIComponent(planId)}`
}

/** Registry narrowed to the UNIQUE plan for one anchor transaction (260730-n2z). */
export function amortizationsByTransactionHref(transactionId: string) {
  return `${APP_ROUTES.amortizations}?transactionId=${encodeURIComponent(transactionId)}`
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

  if (filters.lens === 'competenza') {
    params.set('lens', filters.lens)
  }

  const search = params.toString()
  return dashboardCategoryDetail(id) + (search ? `?${search}` : '')
}
