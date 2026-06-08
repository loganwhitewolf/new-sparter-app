// Pure formatting functions for the overview movers panel.
// These functions have no side effects and no React dependencies — unit-tested in isolation.

import { formatEur } from './format'
import type { MonthOverMonthChange } from '@/lib/dal/overview'

/**
 * Formats a single mover entry into a humanized Italian sentence (D-08, MOVE-03).
 *
 * isNew wins over delta: returns the "new spend" label regardless of delta value.
 * Positive delta: "{name} · {amount} more" (Italian UI copy).
 * Negative delta: "{name} · {amount} less" (absolute value, Italian UI copy).
 *
 * Math.abs(Number(delta)) is used for display-only formatting — not monetary
 * arithmetic — so Decimal.js is not required here (CLAUDE.md rule applies to
 * financial calculations, not presentation-layer string conversions).
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
 * Partitions a flat movers array into two sections (D-07):
 * - increases: items where delta > 0 OR isNew === true ("spent more" section)
 * - savings:   items where delta < 0 AND isNew === false ("saved more" section)
 *
 * isNew items are never suppressed — they always land in increases regardless of delta.
 * Input order is preserved within each section (the DAL already sorts by |delta| descending).
 */
/**
 * Formats the right-side amount+label for a table-layout mover row.
 *
 * Returns only the amount portion (e.g. "€55 spesa nuova", "€100 in meno").
 * Use m.name separately for the left side of the row.
 * Always shows the absolute delta amount — including for isNew items.
 */
export function formatMoverAmount(m: MonthOverMonthChange): string {
  // Display-only conversion — not monetary arithmetic (see formatMoverLine comment).
  const absAmount = formatEur(Math.abs(Number(m.delta)))
  if (m.isNew) return `${absAmount} spesa nuova`
  return Number(m.delta) > 0 ? `${absAmount} in più` : `${absAmount} in meno`
}

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
