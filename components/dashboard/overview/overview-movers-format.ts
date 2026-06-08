// Pure formatting functions for the overview movers panel.
// These functions have no side effects and no React dependencies — unit-tested in isolation.

import { formatEur } from './format'
import type { MonthOverMonthChange } from '@/lib/dal/overview'

/**
 * Formats a single mover entry into a human-readable Italian sentence.
 *
 * Rules (D-08, MOVE-03):
 * - isNew:true → "{name} · spesa nuova" (isNew wins regardless of delta)
 * - positive delta → "{name} · {amount} in più"
 * - negative delta → "{name} · {amount} in meno" (absolute value shown)
 *
 * Note: Math.abs(Number(delta)) is used here for display formatting only
 * (passed to formatEur which produces a UI string). This is NOT monetary
 * arithmetic — no financial calculation occurs, so Decimal.js is not required.
 * See CLAUDE.md: Decimal.js applies to monetary arithmetic, not display conversions.
 */
export function formatMoverLine(m: MonthOverMonthChange): string {
  if (m.isNew) {
    return `${m.name} · spesa nuova`
  }

  const absAmount = formatEur(Math.abs(Number(m.delta)))
  const isIncrease = Number(m.delta) > 0

  return isIncrease
    ? `${m.name} · ${absAmount} in più`
    : `${m.name} · ${absAmount} in meno`
}

/**
 * Partitions a flat movers array into two sections:
 * - increases: items where delta > 0 OR isNew === true (D-07: "Dove hai speso di più")
 * - savings:   items where delta < 0 AND isNew === false (D-07: "Dove hai risparmiato")
 *
 * Per D-07: isNew items are NEVER suppressed and always land in increases.
 * Input order is preserved within each section (the DAL already sorts by |Δ€| descending).
 */
export function splitMovers(movers: MonthOverMonthChange[]): {
  increases: MonthOverMonthChange[]
  savings: MonthOverMonthChange[]
} {
  const increases: MonthOverMonthChange[] = []
  const savings: MonthOverMonthChange[] = []

  for (const m of movers) {
    if (m.isNew || Number(m.delta) > 0) {
      increases.push(m)
    } else {
      savings.push(m)
    }
  }

  return { increases, savings }
}
