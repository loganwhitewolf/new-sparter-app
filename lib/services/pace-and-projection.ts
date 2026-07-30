import Decimal from 'decimal.js'
import { toDbDecimal, toDecimal } from '@/lib/utils/decimal'
import type { CoveredMonth } from '@/lib/dal/covered-months'

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

/**
 * Composes a category's monthly series with the account's Covered Months (D-01/D-02). Pure,
 * synchronous — no DB/network/await inside its body.
 *
 * A `categoryMonths` entry whose `yearMonth` is NOT in `coveredMonths` is dropped entirely
 * (D-01: excluded, not zeroed — the month never existed on the account, so it cannot exist for
 * this category either). Every entry whose `yearMonth` IS covered survives with whatever amount
 * it already carries, including '0.00' (D-02: a Covered Month with no movement for this category
 * still counts, pulling its average down).
 */
export function buildCoveredMonthSeries(
  coveredMonths: CoveredMonth[],
  categoryMonths: MonthlyValue[],
): MonthlyValue[] {
  const coveredSet = new Set(coveredMonths.map((m) => m.yearMonth))
  return categoryMonths.filter((m) => coveredSet.has(m.yearMonth))
}

/**
 * D-03: `Mese Parziale` is the current calendar month, always excluded from every average — no
 * exceptions based on how much of the month has elapsed. A month whose data merely stopped
 * earlier (e.g. no import since May, today is July) is a concluded Covered Month, never partial;
 * this function makes no presumption in either direction (CONTEXT.md's two worked examples).
 *
 * Pure function of (yearMonth, today) — no day-of-month comparison at all, so it never throws and
 * evaluates identically regardless of array order upstream (stateless per-month predicate, not a
 * stateful reducer).
 */
export function isPartialMonth(yearMonth: string, today: Date = new Date()): boolean {
  const [year, month] = yearMonth.split('-').map(Number)
  return year === today.getFullYear() && month === today.getMonth() + 1
}

/**
 * D-06: the current month is valued at `max(spent so far, pace)` — a hybrid, never a value below
 * an already-observed fact. `Decimal.max` compares the two UNROUNDED Decimal instances; the single
 * winner is rounded to cents via toDbDecimal exactly once, at this return boundary (D-11) — never
 * per-operand, never twice.
 */
export function computeCurrentMonthHybrid(spentSoFar: string, pace: string): string {
  return toDbDecimal(Decimal.max(toDecimal(spentSoFar), toDecimal(pace)))
}
