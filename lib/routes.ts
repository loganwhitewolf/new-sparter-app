import type { CategoryYearSort } from '@/lib/validations/dashboard'
import type { LensPassthrough } from '@/lib/utils/search-params'

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
  type?: 'in' | 'out' | 'allocation'
  sort?: CategoryYearSort
  // D-12 (Phase 83) — the year-mode URL contract (D-17, Phase 84: the sole remaining mode
  // since the preset-mode branch was retired). Every live caller always sets `year`.
  year?: number
  // Phase 82, D-12+D-13 (review fix WR-03): `lens` here is a raw, UNVALIDATED passthrough
  // value threaded through Categories' own hrefs (sort toggle, row click-through, detail back
  // link) purely so the tab nav's `?lens=` survives a round trip through Categories instead of
  // silently resetting to cassa on the way back to Overview (D-13). It is typed
  // `LensPassthrough`, NOT `Lens`, specifically so it can never be handed to
  // `resolveLedgerRowSource` (which only accepts a validated `Lens`) — Categories' own
  // aggregation always falls through to its `ledgerEntryCash` default and never reads this
  // value (D-12). Making that misuse a type error, not a review convention.
  lens?: LensPassthrough
}

/** Builds the `?year=...` query string shared by the two Categories href builders (D-12). */
function buildYearModeSearch(filters: DashboardCategoryFilters & { year: number }): string {
  const params = new URLSearchParams()
  params.set('year', String(filters.year))

  if (filters.type && filters.type !== 'out') {
    params.set('type', filters.type)
  }

  if (filters.sort && filters.sort !== 'amount') {
    params.set('sort', filters.sort)
  }

  if (filters.lens) {
    params.set('lens', filters.lens)
  }

  return params.toString()
}

export function buildDashboardCategoriesHref(filters: DashboardCategoryFilters = {}) {
  if (filters.year !== undefined) {
    const search = buildYearModeSearch({ ...filters, year: filters.year })
    return APP_ROUTES.dashboardCategories + (search ? `?${search}` : '')
  }

  return APP_ROUTES.dashboardCategories
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
  if (filters.year !== undefined) {
    const search = buildYearModeSearch({ ...filters, year: filters.year })
    return dashboardCategoryDetail(id) + (search ? `?${search}` : '')
  }

  return dashboardCategoryDetail(id)
}
