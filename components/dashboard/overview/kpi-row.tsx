import type { OverviewData } from '@/lib/dal/dashboard'
import { formatEur } from './format'
import { ReadingKpiCard, type Reading } from './kpi-card-reading'

function savingsReading(rate: number): Reading {
  if (rate >= 20) return { text: 'Ottimo, sopra il 20% consigliato', sentiment: 'good' }
  if (rate >= 10) return { text: 'Buono, puoi puntare al 20%', sentiment: 'good' }
  if (rate >= 0) return { text: 'Migliorabile', sentiment: 'warn' }
  return { text: 'Attenzione: spendi più di quanto guadagni', sentiment: 'bad' }
}

function balanceReading(balance: number): Reading {
  if (balance > 0) return { text: 'Spendi meno di quanto guadagni', sentiment: 'good' }
  if (balance < 0) return { text: 'Spendi più di quanto guadagni', sentiment: 'bad' }
  return { text: 'Sei in pareggio', sentiment: 'neutral' }
}

function trendReading(delta: number, prevYear: number, kind: 'in' | 'out'): Reading {
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

export function KpiRow({ data, year }: { data: OverviewData; year: number }) {
  const prevYear = year - 1
  const balanceNumeric = Number(data.balance)

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <ReadingKpiCard
        label="Totale entrate"
        value={formatEur(data.totalIn)}
        tone="in"
        delta={data.deltas.totalIn}
        goodWhenPositive
        prevYear={prevYear}
        reading={
          data.deltas.totalIn !== null
            ? trendReading(data.deltas.totalIn, prevYear, 'in')
            : { text: `In linea con il ${prevYear}`, sentiment: 'neutral' }
        }
        className="min-h-0"
      />
      <ReadingKpiCard
        label="Totale uscite"
        value={formatEur(data.totalOut)}
        tone="out"
        delta={data.deltas.totalOut}
        goodWhenPositive={false}
        prevYear={prevYear}
        reading={
          data.deltas.totalOut !== null
            ? trendReading(data.deltas.totalOut, prevYear, 'out')
            : { text: `In linea con il ${prevYear}`, sentiment: 'neutral' }
        }
        className="min-h-0"
      />
      <ReadingKpiCard
        label="Bilancio"
        value={formatEur(data.balance)}
        tone="balance"
        delta={data.deltas.balance}
        goodWhenPositive
        prevYear={prevYear}
        reading={balanceReading(balanceNumeric)}
        className="min-h-0"
      />
      <ReadingKpiCard
        label="Tasso risparmio"
        value={`${data.savingsRate}%`}
        tone="savings"
        delta={data.deltas.savingsRate}
        goodWhenPositive
        prevYear={prevYear}
        reading={savingsReading(data.savingsRate)}
        className="min-h-0"
      />
    </div>
  )
}
