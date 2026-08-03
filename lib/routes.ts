import type {
  CategoryYearSort,
  DashboardPreset,
  DashboardSort,
} from '@/lib/validations/dashboard'
import type { CategoryDetailWindowLength } from '@/lib/validations/category-year-window'
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
  preset?: DashboardPreset
  type?: 'in' | 'out' | 'allocation'
  sort?: DashboardSort | CategoryYearSort
  defaultPreset?: DashboardPreset
  defaultSort?: DashboardSort
  // D-12 (Phase 83) — additive year mode. When set, buildDashboardCategoriesHref and
  // buildDashboardCategoryDetailHref emit a `?year=` href instead of the preset-based one below;
  // omitted, both functions behave exactly as before. Callers in year mode are expected never to
  // also pass `preset`.
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
  // D-01/D-04 (Phase 84) — the category DETAIL page's own window params. Structurally shared
  // with buildDashboardCategoriesHref's type (like `sort` above), but the LIST has no window
  // (D-04): only buildDashboardCategoryDetailHref callers ever set these.
  months?: CategoryDetailWindowLength
  from?: string
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

  // D-01: a whole-year window (months === 12, or absent) omits both params entirely.
  if (filters.months !== undefined && filters.months !== 12) {
    params.set('months', String(filters.months))
  }

  // D-04: `from` is only emitted when it diverges from the implicit January default for this
  // filters' own `year` — never a stale prior year's prefix.
  if (filters.from !== undefined && filters.from !== `${filters.year}-01`) {
    params.set('from', filters.from)
  }

  return params.toString()
}

export function buildDashboardCategoriesHref(filters: DashboardCategoryFilters = {}) {
  if (filters.year !== undefined) {
    const search = buildYearModeSearch({ ...filters, year: filters.year })
    return APP_ROUTES.dashboardCategories + (search ? `?${search}` : '')
  }

  const params = new URLSearchParams()
  const defaultPreset = filters.defaultPreset ?? 'this-year'
  const defaultSort: DashboardSort = filters.defaultSort ?? 'amount'

  if (filters.preset && filters.preset !== defaultPreset) {
    params.set('preset', filters.preset)
  }

  if (filters.type && filters.type !== 'out') {
    params.set('type', filters.type)
  }

  if (filters.sort && filters.sort !== defaultSort) {
    params.set('sort', filters.sort)
  }

  if (filters.lens) {
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
  if (filters.year !== undefined) {
    const search = buildYearModeSearch({ ...filters, year: filters.year })
    return dashboardCategoryDetail(id) + (search ? `?${search}` : '')
  }

  const params = new URLSearchParams()
  const defaultPreset = filters.defaultPreset ?? 'this-year'
  const defaultSort: DashboardSort = filters.defaultSort ?? 'amount'

  if (filters.preset && filters.preset !== defaultPreset) {
    params.set('preset', filters.preset)
  }

  if (filters.type && filters.type !== 'out') {
    params.set('type', filters.type)
  }

  if (filters.sort && filters.sort !== defaultSort) {
    params.set('sort', filters.sort)
  }

  if (filters.lens) {
    params.set('lens', filters.lens)
  }

  const search = params.toString()
  return dashboardCategoryDetail(id) + (search ? `?${search}` : '')
}
