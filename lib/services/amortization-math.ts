// Instalment materialisation math for amortization plans (Phase 77, AMORT-03, D-02/D-07).
// Pure functions — no DB, no server-only import — so the same code drives both the client-side
// dialog preview (D-01) and the server-side write path (activatePlanTx), with zero drift.
//
// Sign-agnostic by construction: `amount` is passed through as-is (the raw signed
// transaction.amount, negative for an outflow). Decimal.ROUND_DOWN truncates toward zero for
// both signs, so the remainder-on-first-instalment invariant holds identically whether the
// amount is positive or negative — instalments always sum back to the exact original amount.
import Decimal from 'decimal.js'
import { toDbDecimal, toDecimal } from '@/lib/utils/decimal'

export type Instalment = {
  date: Date
  amount: string
}

export type MonthsValidation = {
  valid: boolean
  reason?: string
}

const MINIMUM_INSTALMENT = '0.01'

/**
 * Adds `monthsToAdd` calendar months to `date`, clamping the day-of-month to the target month's
 * last day when the source day does not exist there (e.g. 31/1 -> 28/2, never rolling into
 * March). Never relies on JS Date's own month-overflow rollover for the target day — the last
 * day of the target month is computed explicitly via `new Date(year, month + 1, 0)` and the
 * clamp applied with Math.min before the Date is ever constructed with that day.
 */
function addMonthsClamped(date: Date, monthsToAdd: number): Date {
  const targetYear = date.getFullYear()
  const targetMonthIndex = date.getMonth() + monthsToAdd
  const lastDayOfTargetMonth = new Date(targetYear, targetMonthIndex + 1, 0).getDate()
  const clampedDay = Math.min(date.getDate(), lastDayOfTargetMonth)

  return new Date(
    targetYear,
    targetMonthIndex,
    clampedDay,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  )
}

/**
 * The natural cap on plan duration (D-02): every instalment must be at least €0.01, so the
 * maximum number of months a given amount can be split over is the amount's magnitude in cents.
 */
export function maxMonthsForAmount(amount: string): number {
  const cents = toDecimal(amount).abs().times(100).toDecimalPlaces(0, Decimal.ROUND_DOWN)
  return cents.toNumber()
}

/**
 * Validates a candidate plan duration against D-02 (minimum 2 months) and D-07 (every instalment
 * >= €0.01). Returns the exact Italian messages the UI-SPEC's Copywriting Contract specifies.
 */
export function validateMonthsForAmount(amount: string, months: number): MonthsValidation {
  if (!Number.isInteger(months) || months < 2) {
    return { valid: false, reason: 'Minimo 2 mesi.' }
  }

  const total = toDecimal(amount).abs()
  const base = total.dividedBy(months).toDecimalPlaces(2, Decimal.ROUND_DOWN)

  if (base.lessThan(MINIMUM_INSTALMENT)) {
    const maxMonths = maxMonthsForAmount(amount)
    return {
      valid: false,
      reason: `Impossibile: €${total.toFixed(2)} diviso ${months} mesi = €${base.toFixed(2)}. Massimo ${maxMonths} mesi.`,
    }
  }

  return { valid: true }
}

/**
 * Computes the N-instalment schedule for a plan (AMORT-03): a uniform base instalment per month
 * (Decimal.dividedBy().toDecimalPlaces(2, ROUND_DOWN) — never native division), with the
 * rounding remainder folded wholly into the FIRST instalment so the sum always equals the
 * original amount to the cent. Each instalment date is independently clamped to its own target
 * month's last day (never carrying the excess days forward).
 */
export function materializeInstalments(amount: string, date: Date, months: number): Instalment[] {
  const total = toDecimal(amount)
  const base = total.dividedBy(months).toDecimalPlaces(2, Decimal.ROUND_DOWN)
  const remainder = total.minus(base.times(months))

  const instalments: Instalment[] = []

  for (let i = 0; i < months; i++) {
    const instalmentDate = addMonthsClamped(date, i)
    const instalmentAmount = i === 0 ? base.plus(remainder) : base

    instalments.push({
      date: instalmentDate,
      amount: toDbDecimal(instalmentAmount),
    })
  }

  return instalments
}
