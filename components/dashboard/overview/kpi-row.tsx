import type { OverviewChartPoint } from '@/lib/dal/overview'
import { toDecimal } from '@/lib/utils/decimal'
import { NATURE_LABELS } from '@/lib/utils/nature-labels'
import { formatEur } from './format'
import { ReadingKpiCard, type BarSegment, type CardBar, type Reading, type ValueTone } from './kpi-card-reading'
import {
  INCOME_KEYS,
  OUT_KEYS,
  type AllocationKey,
  type IncomeKey,
  type OutKey,
} from './overview-chart-utils'
import { NATURE_ICONS, NATURE_KEY_COLORS } from './nature-icons'
import { deriveFilteredKpis } from './overview-kpi-derive'

/** Recurring-only savings-rate target — the "sopra il 20% consigliato" benchmark. */
const SAVINGS_TARGET_RATE = 20

/** Income segment labels — mirror the filter chips (INCOME_CHIP_LABELS, D-05). */
const INCOME_SEGMENT_LABELS: Record<IncomeKey, string> = {
  recurring: 'Ricorrenti',
  extraordinary: 'Straordinarie',
}

function savingsReading(rate: number): Reading {
  if (rate >= 20) return { text: 'Ottimo, sopra il 20% consigliato', sentiment: 'good' }
  if (rate >= 10) return { text: 'Buono, puoi puntare al 20%', sentiment: 'good' }
  if (rate >= 0) return { text: 'Migliorabile', sentiment: 'warn' }
  return { text: 'Attenzione: spendi più di quanto guadagni', sentiment: 'bad' }
}

/**
 * Balance reading — structural-aware (260709-kp1, decision B+).
 *
 * The headline value stays the filtered balance; the reading exposes when a positive
 * balance holds only thanks to extraordinary income, quantifying the recurring-only
 * ("structural") balance so the diagnosis carries its evidence. Callers pass
 * `structural = null` when extraordinary income is excluded from the selection —
 * the hero already IS the structural balance, so the warn would be tautological.
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

/** Sign-based tone: green when ≥ 0, red when < 0 (Bilancio / Tasso risparmio). */
function signTone(value: number): ValueTone {
  return value < 0 ? 'out' : 'in'
}

type KpiRowProps = {
  /** Monthly chart points for the selected year — the single KPI data source (260711-gfd). */
  data: OverviewChartPoint[]
  /** Prior-year points — YoY deltas are recomputed under the SAME chip selection. */
  prevData: OverviewChartPoint[]
  includedIncome: ReadonlySet<IncomeKey>
  includedOut: ReadonlySet<OutKey>
  includedAllocation: ReadonlySet<AllocationKey>
  year: number
}

/**
 * KpiRow — dashboard-wide filtered KPI cards (260711-gfd, option B).
 *
 * Four cards (Entrate · Uscite · Bilancio · Accantonato) derive from the monthly chart
 * points under the current chip selection, so the cards and the chart always tell the
 * same story. Bilancio merges the former Bilancio + Tasso risparmio cards (same numerator:
 * the € net is the hero, the savings rate is that net as a share of income in the progress
 * bar). Under the sustainability default (extraordinary excluded) Bilancio's hero IS the
 * structural balance and its rate IS the structural savings rate.
 */
export function KpiRow({ data, prevData, includedIncome, includedOut, includedAllocation, year }: KpiRowProps) {
  const prevYear = year - 1
  const kpis = deriveFilteredKpis(data, prevData, includedIncome, includedOut, includedAllocation)
  const balanceNumeric = Number(kpis.balance)

  // ── Entrate: composition of the INCLUDED income keys (single key → honest 100% bar).
  // Shade is key-fixed (recurring solid, extraordinary lighter) — see Uscite note below.
  const entrateSegments: BarSegment[] = INCOME_KEYS.filter((key) => includedIncome.has(key)).map(
    (key) => ({
      label: INCOME_SEGMENT_LABELS[key],
      value: Number(kpis.incomeByKey[key] ?? '0.00'),
      display: formatEur(kpis.incomeByKey[key] ?? '0.00'),
      tone: 'in',
      step: INCOME_KEYS.indexOf(key),
      icon: NATURE_ICONS[key],
      iconColor: NATURE_KEY_COLORS[key],
    })
  )
  const entrateBar: CardBar | null =
    entrateSegments.length > 0 ? { kind: 'composition', segments: entrateSegments } : null

  // ── Uscite: composition of the INCLUDED spending natures. Shade is key-fixed
  // (essential always solid, debt always lightest) so colours stay recognisable
  // across filter changes. Labels from NATURE_LABELS — never drift from the chips.
  const usciteSegments: BarSegment[] = OUT_KEYS.filter((key) => includedOut.has(key)).map((key) => ({
    label: NATURE_LABELS[key],
    value: Number(kpis.outByKey[key] ?? '0.00'),
    display: formatEur(kpis.outByKey[key] ?? '0.00'),
    tone: 'out',
    step: OUT_KEYS.indexOf(key),
    icon: NATURE_ICONS[key],
    iconColor: NATURE_KEY_COLORS[key],
  }))
  const usciteBar: CardBar | null =
    usciteSegments.length > 0 ? { kind: 'composition', segments: usciteSegments } : null

  // ── Bilancio: merged card (was Bilancio + Tasso risparmio). They share the numerator
  // (net = totalIn − totalOut): the € net is the hero, the savings rate is the same net as
  // a share of income and lives in the progress bar toward the 20% benchmark. One reading:
  // the structural warn when a positive balance holds only on extraordinary income
  // (extraordinary still included), otherwise the savings-rate tier judgement.
  const structuralForReading = includedIncome.has('extraordinary')
    ? Number(kpis.structuralBalance)
    : null
  const balanceReadingResolved =
    balanceNumeric > 0 && structuralForReading !== null && structuralForReading < 0
      ? balanceReading(balanceNumeric, structuralForReading)
      : savingsReading(kpis.savingsRate)

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <ReadingKpiCard
        label="Entrate"
        hero={{ value: formatEur(kpis.totalIn), tone: entrateBar ? 'neutral' : 'in' }}
        bar={entrateBar}
        delta={kpis.deltas.totalIn}
        goodWhenPositive
        prevYear={prevYear}
        className="min-h-0"
      />
      <ReadingKpiCard
        label="Uscite"
        hero={{ value: formatEur(kpis.totalOut), tone: usciteBar ? 'neutral' : 'out' }}
        bar={usciteBar}
        delta={kpis.deltas.totalOut}
        goodWhenPositive={false}
        prevYear={prevYear}
        className="min-h-0"
      />
      <ReadingKpiCard
        label="Bilancio"
        hero={{ value: formatEur(kpis.balance), tone: signTone(balanceNumeric) }}
        bar={{ kind: 'progress', value: kpis.savingsRate, target: SAVINGS_TARGET_RATE, tone: signTone(kpis.savingsRate) }}
        delta={kpis.deltas.balance}
        goodWhenPositive
        prevYear={prevYear}
        reading={balanceReadingResolved}
        className="min-h-0"
      />
      <ReadingKpiCard
        label="Accantonato"
        hero={{ value: formatEur(toDecimal(kpis.totalAllocation).abs().toNumber()), tone: 'allocation' }}
        delta={kpis.deltas.totalAllocation}
        goodWhenPositive
        prevYear={prevYear}
        reading={allocationReading(kpis.deltas.totalAllocation, prevYear)}
        className="min-h-0"
      />
    </div>
  )
}
