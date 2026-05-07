export type PlanGate = 'free' | 'basic' | 'pro'

const PLAN_ORDER: Record<PlanGate, number> = {
  free: 0,
  basic: 1,
  pro: 2,
}

const PLAN_VALUES = new Set<PlanGate>(['free', 'basic', 'pro'])

function readMinimumPlan(key: string, defaultPlan: PlanGate = 'free'): PlanGate {
  const value = process.env[key]?.trim().toLowerCase()

  if (value && PLAN_VALUES.has(value as PlanGate)) {
    return value as PlanGate
  }

  return defaultPlan
}

function planMeetsMinimum(plan: PlanGate, minimumPlan: PlanGate): boolean {
  return PLAN_ORDER[plan] >= PLAN_ORDER[minimumPlan]
}

export function getCategorizationAccessConfig() {
  return {
    regexMinPlan: readMinimumPlan('CATEGORIZATION_REGEX_MIN_PLAN'),
    historyMinPlan: readMinimumPlan('CATEGORIZATION_HISTORY_MIN_PLAN'),
    customPatternsMinPlan: readMinimumPlan('CATEGORIZATION_CUSTOM_PATTERNS_MIN_PLAN'),
  }
}

export function canUseRegexCategorization(plan: PlanGate): boolean {
  return planMeetsMinimum(plan, getCategorizationAccessConfig().regexMinPlan)
}

export function canUseHistoryCategorization(plan: PlanGate): boolean {
  return planMeetsMinimum(plan, getCategorizationAccessConfig().historyMinPlan)
}

export function canManageCustomPatterns(plan: PlanGate): boolean {
  return planMeetsMinimum(plan, getCategorizationAccessConfig().customPatternsMinPlan)
}
