import Decimal from 'decimal.js'
import { toDecimal } from '@/lib/utils/decimal'
import type { OverviewChartPoint } from '@/lib/dal/overview'

// ─── Key constants ────────────────────────────────────────────────────────────

/**
 * All OUT nature keys in display order.
 * Use as the default includedOut argument to select all expense buckets.
 */
export const OUT_KEYS = [
  'essential',
  'discretionary',
  'operational',
  'financial',
  'debt',
  'extraordinary',
] as const

/**
 * All INCOME nature keys.
 * Use as the default includedIncome argument to select all income buckets.
 */
export const INCOME_KEYS = ['recurring', 'extraordinary'] as const

// ─── Types ────────────────────────────────────────────────────────────────────

export type OutKey = (typeof OUT_KEYS)[number]
export type IncomeKey = (typeof INCOME_KEYS)[number]

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
 *
 * Rules:
 * - includedIncome drives entrate (subset of INCOME_KEYS)
 * - includedOut drives uscite (subset of OUT_KEYS)
 * - Number() conversion happens ONLY in the returned row (Recharts boundary)
 * - The returned object has exactly { label, entrate, uscite } — no KPI fields
 */
export function deriveFilteredBarRow(
  point: OverviewChartPoint,
  includedIncome: readonly IncomeKey[],
  includedOut: readonly OutKey[]
): { label: string; entrate: number; uscite: number } {
  const incomeValues: Record<string, string> = {
    recurring: point.income.recurring,
    extraordinary: point.income.extraordinary,
  }

  const entrate = sumSelected(incomeValues, includedIncome)
  const uscite = sumSelected(
    point.out as unknown as Record<string, string>,
    includedOut
  )

  return {
    label: point.label,
    // Convert to number only at the Recharts boundary (Recharts requires numbers).
    entrate: Number(entrate),
    uscite: Number(uscite),
  }
}

