import { toDbDecimal, toDecimal } from '@/lib/utils/decimal'

/**
 * D-05: below this many Covered Months in the selected year, no pace and no projection is
 * produced anywhere in the engine. Engine parameter, not a magic number — Phases 83/84 import it
 * rather than re-declaring the threshold.
 */
export const MIN_COVERED_MONTHS_FOR_PACE = 2

/** A single month's value in the engine's monthly series. Drizzle DECIMAL columns are strings. */
export type MonthlyValue = { yearMonth: string; amount: string }

/**
 * The pace ("Ritmo") / year-end projection outcome. D-05's "no fragile number" contract is
 * enforced at the type level: the `'insufficient'` member has NO `pace`/`projection` field at
 * all, so no downstream caller can read or default-coerce a number out of it — TypeScript
 * rejects any code path reading `.pace` without first narrowing on `status`.
 */
export type PaceResult =
  | { status: 'complete'; pace: string; projection: string; coveredMonthCount: number }
  | { status: 'insufficient'; coveredMonthCount: number }

/**
 * Computes the pace (average over the given monthly series) and its 12-month projection.
 *
 * Below MIN_COVERED_MONTHS_FOR_PACE entries (including the empty-array case, identically),
 * returns the 'insufficient' outcome immediately — D-05.
 *
 * All arithmetic goes through Decimal.js (toDecimal/toDbDecimal) — D-11, never native JS
 * `+ - * /` on the amount strings. Rounding relies on decimal.js's own default ROUND_HALF_UP,
 * applied once at the toDbDecimal() return boundary — no explicit Decimal.set({rounding:...})
 * override anywhere in this module.
 */
export function computePaceAndProjection(monthlyValues: MonthlyValue[]): PaceResult {
  const coveredMonthCount = monthlyValues.length

  if (coveredMonthCount < MIN_COVERED_MONTHS_FOR_PACE) {
    return { status: 'insufficient', coveredMonthCount }
  }

  const total = monthlyValues.reduce((sum, m) => sum.plus(toDecimal(m.amount)), toDecimal('0'))
  const pace = total.dividedBy(toDecimal(coveredMonthCount))
  const projection = pace.times(toDecimal('12'))

  return {
    status: 'complete',
    pace: toDbDecimal(pace),
    projection: toDbDecimal(projection),
    coveredMonthCount,
  }
}
