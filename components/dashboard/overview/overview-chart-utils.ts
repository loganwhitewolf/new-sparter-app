import Decimal from 'decimal.js'
import { toDecimal } from '@/lib/utils/decimal'
import type { OverviewChartPoint } from '@/lib/dal/overview'
import { NATURE_COLORS, NATURE_LABELS } from '@/lib/utils/nature-labels'

// ─── Key constants ────────────────────────────────────────────────────────────

/**
 * OUT nature keys in display order — spending only (essential / discretionary / debt).
 * Phase 49: savings and investment moved to allocation bucket; transfer excluded entirely.
 */
export const OUT_KEYS = [
  'essential',
  'discretionary',
  'debt',
] as const

/**
 * All INCOME nature keys.
 * Use as the default includedIncome argument to select all income buckets.
 */
export const INCOME_KEYS = ['recurring', 'extraordinary'] as const

/**
 * Allocation nature keys (savings + investment).
 */
export const ALLOCATION_KEYS = ['savings', 'investment'] as const

// ─── Types ────────────────────────────────────────────────────────────────────

export type OutKey = (typeof OUT_KEYS)[number]
export type IncomeKey = (typeof INCOME_KEYS)[number]
export type AllocationKey = (typeof ALLOCATION_KEYS)[number]

// ─── Pure helpers ─────────────────────────────────────────────────────────────

// ─── Nature breakdown for tooltip ────────────────────────────────────────────

export type NatureBreakdownItem = {
  key: string
  label: string
  color: string
  amount: number
}

export type NatureBreakdown = {
  income: NatureBreakdownItem[]
  out: NatureBreakdownItem[]
  allocation: NatureBreakdownItem[]
}

/**
 * Derive a per-nature breakdown from a single OverviewChartPoint, respecting
 * the current includedIncome and includedOut filter sets.
 *
 * Income key mapping (chart → FlowNature for labels/colors):
 *   'recurring'     → NATURE_LABELS/NATURE_COLORS['income']
 *   'extraordinary' → NATURE_LABELS/NATURE_COLORS['income_extraordinary']
 *
 * Out keys map 1:1 to FlowNature (essential/discretionary/debt only).
 * Allocation keys: savings + investment.
 *
 * Only included keys are returned in each array; excluded keys are omitted.
 * Amount conversions use Number() at the presentation boundary — not monetary arithmetic.
 */
export function deriveNatureBreakdown(
  point: OverviewChartPoint,
  includedIncome: Set<IncomeKey>,
  includedOut: Set<OutKey>
): NatureBreakdown {
  const income: NatureBreakdownItem[] = []

  if (includedIncome.has('recurring')) {
    income.push({
      key: 'recurring',
      label: NATURE_LABELS['income'],
      color: NATURE_COLORS['income'],
      amount: Number(toDecimal(point.income.recurring)),
    })
  }

  if (includedIncome.has('extraordinary')) {
    income.push({
      key: 'extraordinary',
      label: NATURE_LABELS['income_extraordinary'],
      color: NATURE_COLORS['income_extraordinary'],
      amount: Number(toDecimal(point.income.extraordinary)),
    })
  }

  const out: NatureBreakdownItem[] = []
  for (const key of OUT_KEYS) {
    if (!includedOut.has(key)) continue
    out.push({
      key,
      label: NATURE_LABELS[key],
      color: NATURE_COLORS[key],
      amount: Number(toDecimal((point.out as Record<string, string>)[key] ?? '0.00')),
    })
  }

  const allocation: NatureBreakdownItem[] = [
    {
      key: 'savings',
      label: 'Risparmio',
      color: NATURE_COLORS['savings'],
      amount: Number(toDecimal(point.allocation.savings)),
    },
    {
      key: 'investment',
      label: 'Investimento',
      color: NATURE_COLORS['investment'],
      amount: Number(toDecimal(point.allocation.investment)),
    },
  ]

  return { income, out, allocation }
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Sum only the values at the included keys.
 * - Missing keys are treated as '0.00' (defensive, never throws).
 * - Returns a Decimal (not a number) — caller controls the Number() conversion boundary.
 * - NEVER uses native + on DECIMAL strings; always uses toDecimal().plus() per project rules.
 */
export function sumSelected(
  values: Record<string, string>,
  includedKeys: readonly string[]
): Decimal {
  return includedKeys.reduce(
    (acc, key) => acc.plus(toDecimal(values[key] ?? '0.00')),
    toDecimal('0.00')
  )
}

/**
 * Derive a single bar chart row from an OverviewChartPoint,
 * summing only the income and out buckets that are currently selected.
 * The allocation bucket is always totalled in full (no per-nature filtering).
 *
 * Rules:
 * - includedIncome drives entrate (subset of INCOME_KEYS)
 * - includedOut drives uscite (subset of OUT_KEYS — essential/discretionary/debt)
 * - accantonato = savings + investment (always shown in full — D-01)
 * - Number() conversion happens ONLY in the returned row (Recharts boundary)
 * - The returned object has exactly { label, entrate, uscite, accantonato }
 */
export function deriveFilteredBarRow(
  point: OverviewChartPoint,
  includedIncome: readonly IncomeKey[],
  includedOut: readonly OutKey[]
): { label: string; entrate: number; uscite: number; accantonato: number } {
  const incomeValues: Record<string, string> = {
    recurring: point.income.recurring,
    extraordinary: point.income.extraordinary,
  }

  const entrate = sumSelected(incomeValues, includedIncome)
  const uscite = sumSelected(
    point.out as unknown as Record<string, string>,
    includedOut
  )
  const accantonato = toDecimal(point.allocation.savings)
    .plus(toDecimal(point.allocation.investment))

  return {
    label: point.label,
    // Convert to number only at the Recharts boundary (Recharts requires numbers).
    entrate: Number(entrate),
    uscite: Number(uscite),
    accantonato: Number(accantonato),
  }
}
