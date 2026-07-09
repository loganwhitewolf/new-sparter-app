import type { OverviewData } from '@/lib/dal/dashboard'
import { toDecimal } from '@/lib/utils/decimal'
import { NATURE_LABELS } from '@/lib/utils/nature-labels'
import { formatEur } from './format'
import { ReadingKpiCard, type KpiComponentRow, type Reading, type ValueTone } from './kpi-card-reading'

/**
 * Label for the recurring-only ("structural") breakdown row on the Bilancio and
 * Tasso risparmio cards — locked in the cross-card label review (2026-07-09).
 */
const STRUCTURAL_ROW_LABEL = 'Solo ricorrenti'

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

  // ── Entrate: Ricorrenti emphasised + Straordinarie muted; grand total below.
  // Straordinarie derived as totalIn − recurring (Decimal.js — never native math on money).
  const entrateComponents: KpiComponentRow[] =
    data.totalInRecurring !== null
      ? [
          { label: 'Ricorrenti', value: formatEur(data.totalInRecurring), tone: 'in', emphasis: true },
          {
            label: 'Straordinarie',
            value: formatEur(toDecimal(data.totalIn).minus(toDecimal(data.totalInRecurring)).toNumber()),
            tone: 'muted',
          },
        ]
      : [{ value: formatEur(data.totalIn), tone: 'in', emphasis: true }]

  // ── Uscite: Essenziale emphasised + Discrezionale/Debiti muted; labels from
  // NATURE_LABELS so the card can never drift from the chart's Uscite chips.
  const usciteComponents: KpiComponentRow[] =
    data.outByNature !== null
      ? [
          { label: NATURE_LABELS.essential, value: formatEur(data.outByNature.essential), tone: 'out', emphasis: true },
          { label: NATURE_LABELS.discretionary, value: formatEur(data.outByNature.discretionary), tone: 'muted' },
          { label: NATURE_LABELS.debt, value: formatEur(data.outByNature.debt), tone: 'muted' },
        ]
      : [{ value: formatEur(data.totalOut), tone: 'out', emphasis: true }]

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <ReadingKpiCard
        label="Entrate"
        components={entrateComponents}
        total={data.totalInRecurring !== null ? { value: formatEur(data.totalIn), tone: 'neutral' } : null}
        delta={data.deltas.totalIn}
        goodWhenPositive
        prevYear={prevYear}
        // Trend reading dropped here — redundant with the YoY delta badge (260709-mf6).
        reading={data.totalInRecurring !== null ? null : resolveTrendReading(data.deltas.totalIn, prevYear, 'in')}
        className="min-h-0"
      />
      <ReadingKpiCard
        label="Uscite"
        components={usciteComponents}
        total={data.outByNature !== null ? { value: formatEur(data.totalOut), tone: 'neutral' } : null}
        delta={data.deltas.totalOut}
        goodWhenPositive={false}
        prevYear={prevYear}
        reading={data.outByNature !== null ? null : resolveTrendReading(data.deltas.totalOut, prevYear, 'out')}
        className="min-h-0"
      />
      <ReadingKpiCard
        label="Bilancio"
        // Structural (recurring-only) balance is the hero; grand total drops to the summary.
        components={
          structuralNumeric !== null
            ? [
                {
                  label: STRUCTURAL_ROW_LABEL,
                  value: formatEur(structuralNumeric),
                  tone: signTone(structuralNumeric),
                  emphasis: true,
                  layout: 'stacked' as const,
                },
              ]
            : [{ value: formatEur(data.balance), tone: signTone(balanceNumeric), emphasis: true }]
        }
        total={structuralNumeric !== null ? { value: formatEur(data.balance), tone: signTone(balanceNumeric) } : null}
        delta={data.deltas.balance}
        goodWhenPositive
        prevYear={prevYear}
        reading={balanceReading(balanceNumeric, structuralNumeric)}
        className="min-h-0"
      />
      <ReadingKpiCard
        label="Tasso risparmio"
        components={
          data.structuralSavingsRate !== null
            ? [
                {
                  label: STRUCTURAL_ROW_LABEL,
                  value: `${data.structuralSavingsRate}%`,
                  tone: signTone(data.structuralSavingsRate),
                  emphasis: true,
                  layout: 'stacked' as const,
                },
              ]
            : [{ value: `${data.savingsRate}%`, tone: signTone(data.savingsRate), emphasis: true }]
        }
        total={
          data.structuralSavingsRate !== null
            ? { value: `${data.savingsRate}%`, tone: signTone(data.savingsRate) }
            : null
        }
        delta={data.deltas.savingsRate}
        goodWhenPositive
        prevYear={prevYear}
        reading={savingsReading(data.savingsRate)}
        className="min-h-0"
      />
      <ReadingKpiCard
        label="Accantonato"
        components={[
          { value: formatEur(toDecimal(data.totalAllocation).abs().toNumber()), tone: 'allocation', emphasis: true },
        ]}
        total={null}
        delta={data.deltas.totalAllocation}
        goodWhenPositive
        prevYear={prevYear}
        reading={allocationReading(data.deltas.totalAllocation, prevYear)}
        className="min-h-0"
      />
    </div>
  )
}
