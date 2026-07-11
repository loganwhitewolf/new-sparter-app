import type { OverviewData } from '@/lib/dal/dashboard'
import { toDecimal } from '@/lib/utils/decimal'
import { NATURE_LABELS } from '@/lib/utils/nature-labels'
import { formatEur } from './format'
import { ReadingKpiCard, type BarSegment, type CardBar, type Reading, type ValueTone } from './kpi-card-reading'

/** Recurring-only savings-rate target — the "sopra il 20% consigliato" benchmark. */
const SAVINGS_TARGET_RATE = 20

function savingsReading(rate: number): Reading {
  if (rate >= 20) return { text: 'Ottimo, sopra il 20% consigliato', sentiment: 'good' }
  if (rate >= 10) return { text: 'Buono, puoi puntare al 20%', sentiment: 'good' }
  if (rate >= 0) return { text: 'Migliorabile', sentiment: 'warn' }
  return { text: 'Attenzione: spendi più di quanto guadagni', sentiment: 'bad' }
}

/**
 * Balance reading — structural-aware (260709-kp1, decision B+).
 *
 * The headline value stays totalIn − totalOut (reconciles with the Entrate/Uscite
 * cards); the reading exposes when a positive balance holds only thanks to
 * extraordinary income, quantifying the recurring-only ("structural") balance so
 * the diagnosis carries its evidence. `structural === null` (unknown) degrades to
 * the legacy reading.
 */
export function balanceReading(balance: number, structural: number | null = null): Reading {
  if (balance > 0 && structural !== null && structural < 0) {
    return {
      text: `Senza le entrate straordinarie saresti a ${formatEur(structural)}`,
      sentiment: 'warn',
    }
  }
  if (balance > 0) return { text: 'Spendi meno di quanto guadagni', sentiment: 'good' }
  if (balance < 0) return { text: 'Spendi più di quanto guadagni', sentiment: 'bad' }
  return { text: 'Sei in pareggio', sentiment: 'neutral' }
}

/**
 * D-05: Allocation reading — "more allocated = positive" sentiment.
 * Mirrors the shape of savingsReading/balanceReading.
 * When delta is null (no prior-year data), returns a neutral reading.
 */
function allocationReading(delta: number | null, prevYear: number): Reading {
  if (delta === null) return { text: `Nessun confronto con il ${prevYear}`, sentiment: 'neutral' }
  if (delta > 0) return { text: `Stai accantonando più del ${prevYear}`, sentiment: 'good' }
  if (delta < 0) return { text: `Stai accantonando meno del ${prevYear}`, sentiment: 'warn' }
  return { text: `In linea con il ${prevYear}`, sentiment: 'neutral' }
}

export function trendReading(delta: number, prevYear: number, kind: 'in' | 'out'): Reading {
  if (Math.abs(delta) <= 1) return { text: `In linea con il ${prevYear}`, sentiment: 'neutral' }
  if (kind === 'in') {
    return delta > 0
      ? { text: `Più entrate del ${prevYear}`, sentiment: 'good' }
      : { text: `Meno entrate del ${prevYear}`, sentiment: 'warn' }
  }
  return delta < 0
    ? { text: `Spendi meno del ${prevYear}`, sentiment: 'good' }
    : { text: `Spendi più del ${prevYear}`, sentiment: 'warn' }
}

/**
 * Resolves the Entrate/Uscite KPI reading based on whether a real prior-year
 * comparison exists.
 *
 * When delta is null (no prior-year data), returns a truthful neutral reading
 * rather than a misleading "In linea con il {prevYear}".
 * When delta is non-null, delegates to trendReading.
 */
export function resolveTrendReading(
  delta: number | null,
  prevYear: number,
  kind: 'in' | 'out'
): Reading {
  if (delta === null) {
    return { text: `Nessun confronto con il ${prevYear}`, sentiment: 'neutral' }
  }
  return trendReading(delta, prevYear, kind)
}

/** Sign-based tone: green when ≥ 0, red when < 0 (Bilancio / Tasso risparmio). */
function signTone(value: number): ValueTone {
  return value < 0 ? 'out' : 'in'
}

export function KpiRow({ data, year }: { data: OverviewData; year: number }) {
  const prevYear = year - 1
  const balanceNumeric = Number(data.balance)
  const structuralNumeric = data.structuralBalance !== null ? Number(data.structuralBalance) : null

  // ── Entrate: composition bar of Ricorrenti (solid) + Straordinarie (lighter), total hero.
  // Straordinarie derived as totalIn − recurring (Decimal.js — never native math on money).
  const entrateBar: CardBar | null =
    data.totalInRecurring !== null
      ? {
          kind: 'composition',
          segments: [
            {
              label: 'Ricorrenti',
              value: Number(data.totalInRecurring),
              display: formatEur(data.totalInRecurring),
              tone: 'in',
              step: 0,
            },
            {
              label: 'Straordinarie',
              value: toDecimal(data.totalIn).minus(toDecimal(data.totalInRecurring)).toNumber(),
              display: formatEur(toDecimal(data.totalIn).minus(toDecimal(data.totalInRecurring)).toNumber()),
              tone: 'in',
              step: 1,
            },
          ],
        }
      : null

  // ── Uscite: composition bar Essenziale (solid) / Discrezionale / Debiti (lighter), total hero.
  // Labels from NATURE_LABELS so the card can never drift from the chart's Uscite chips.
  const usciteBar: CardBar | null =
    data.outByNature !== null
      ? {
          kind: 'composition',
          segments: [
            { label: NATURE_LABELS.essential, value: Number(data.outByNature.essential), display: formatEur(data.outByNature.essential), tone: 'out', step: 0 },
            { label: NATURE_LABELS.discretionary, value: Number(data.outByNature.discretionary), display: formatEur(data.outByNature.discretionary), tone: 'out', step: 1 },
            { label: NATURE_LABELS.debt, value: Number(data.outByNature.debt), display: formatEur(data.outByNature.debt), tone: 'out', step: 2 },
          ] satisfies BarSegment[],
        }
      : null

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <ReadingKpiCard
        label="Entrate"
        // Total is the hero (neutral) when the mix bar carries the colour; else tone the number.
        hero={{ value: formatEur(data.totalIn), tone: entrateBar ? 'neutral' : 'in' }}
        bar={entrateBar}
        delta={data.deltas.totalIn}
        goodWhenPositive
        prevYear={prevYear}
        // Trend reading only in the no-breakdown fallback — the delta chip covers it otherwise.
        reading={entrateBar ? null : resolveTrendReading(data.deltas.totalIn, prevYear, 'in')}
        className="min-h-0"
      />
      <ReadingKpiCard
        label="Uscite"
        hero={{ value: formatEur(data.totalOut), tone: usciteBar ? 'neutral' : 'out' }}
        bar={usciteBar}
        delta={data.deltas.totalOut}
        goodWhenPositive={false}
        prevYear={prevYear}
        reading={usciteBar ? null : resolveTrendReading(data.deltas.totalOut, prevYear, 'out')}
        className="min-h-0"
      />
      <ReadingKpiCard
        label="Bilancio"
        // Grand-total balance is the hero; the recurring-only ("structural") signal lives in
        // the reading, which quantifies it when a positive balance holds only on extras.
        hero={{ value: formatEur(data.balance), tone: signTone(balanceNumeric) }}
        delta={data.deltas.balance}
        goodWhenPositive
        prevYear={prevYear}
        reading={balanceReading(balanceNumeric, structuralNumeric)}
        className="min-h-0"
      />
      <ReadingKpiCard
        label="Tasso risparmio"
        hero={{ value: `${data.savingsRate}%`, tone: signTone(data.savingsRate) }}
        // Progress toward the 20% benchmark — a glanceable distance-to-target.
        bar={{ kind: 'progress', value: data.savingsRate, target: SAVINGS_TARGET_RATE, tone: signTone(data.savingsRate) }}
        delta={data.deltas.savingsRate}
        goodWhenPositive
        prevYear={prevYear}
        reading={savingsReading(data.savingsRate)}
        className="min-h-0"
      />
      <ReadingKpiCard
        label="Accantonato"
        hero={{ value: formatEur(toDecimal(data.totalAllocation).abs().toNumber()), tone: 'allocation' }}
        delta={data.deltas.totalAllocation}
        goodWhenPositive
        prevYear={prevYear}
        reading={allocationReading(data.deltas.totalAllocation, prevYear)}
        className="min-h-0"
      />
    </div>
  )
}
