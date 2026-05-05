export const APP_ROUTES = {
  dashboard: '/dashboard',
  expenses: '/expenses',
  import: '/import',
  transactions: '/transactions',
  settings: '/settings',
  patternSettings: '/settings/patterns',
} as const

export const LEGACY_LOCALIZED_ROUTES = [
  { source: '/spese', destination: APP_ROUTES.expenses },
  { source: '/transazioni', destination: APP_ROUTES.transactions },
  { source: '/impostazioni/pattern', destination: APP_ROUTES.patternSettings },
] as const
