import { toDecimal } from '@/lib/utils/decimal'
import { formatMonthRange } from '@/lib/utils/date'
import type { LatestImportSummary } from '@/lib/dal/imports'

export type Step2ViewModel = {
  formattedPositiveTotal: string
  formattedNegativeTotal: string
  pct: number
  monthsLabel: string
}

const italianFormatter = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

/**
 * Pure view-model builder for Step 2 overview data.
 * Extracted for testability (async RSC rendering in Vitest has no jsdom).
 *
 * Monetary totals are wrapped in toDecimal() to validate they are real decimal strings,
 * then formatted via Intl — no native arithmetic on monetary values (project hard rule).
 */
export function buildStep2ViewModel(summary: LatestImportSummary): Step2ViewModel {
  // Validate monetary strings via Decimal.js — no native +/-/*/÷ on money (CLAUDE.md hard rule)
  const positiveDecimal = toDecimal(summary.positiveTotal)
  const negativeDecimal = toDecimal(summary.negativeTotal)

  const formattedPositiveTotal = italianFormatter.format(positiveDecimal.toNumber())
  const formattedNegativeTotal = italianFormatter.format(negativeDecimal.abs().toNumber())

  // Percentage uses integer division on transaction counts (not money) — native JS arithmetic OK
  const pct =
    summary.importedCount > 0
      ? Math.round((summary.autoCategorizedCount / summary.importedCount) * 100)
      : 0

  const monthsLabel =
    summary.firstMonth && summary.lastMonth
      ? formatMonthRange(summary.firstMonth, summary.lastMonth)
      : 'Periodo non disponibile'

  return {
    formattedPositiveTotal,
    formattedNegativeTotal,
    pct,
    monthsLabel,
  }
}
