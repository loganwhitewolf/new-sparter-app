// PROTOTYPE — wipe me. Year-scoped KPI row with a qualitative "reading" per card.
// Readings differ by card: savings uses a benchmark (50/30/20 → 20% target), balance
// uses its sign, entrate/uscite use the year-over-year trend (no fake absolute verdict —
// there's no universal "good" income/spend). Gentle guidance, NOT financial advice.
import { getKpis, eur } from './mock-data'
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

export function KpiRow({ year }: { year: number }) {
  const k = getKpis(year, new Set(), new Set()) // KPIs show REAL totals, ignore chart filters
  const prevYear = year - 1

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <ReadingKpiCard
        label="Totale entrate"
        value={eur(k.totalIn)}
        tone="in"
        delta={k.deltas.totalIn}
        goodWhenPositive
        prevYear={prevYear}
        reading={trendReading(k.deltas.totalIn, prevYear, 'in')}
        className="min-h-0"
      />
      <ReadingKpiCard
        label="Totale uscite"
        value={eur(k.totalOut)}
        tone="out"
        delta={k.deltas.totalOut}
        goodWhenPositive={false}
        prevYear={prevYear}
        reading={trendReading(k.deltas.totalOut, prevYear, 'out')}
        className="min-h-0"
      />
      <ReadingKpiCard
        label="Bilancio"
        value={eur(k.balance)}
        tone="balance"
        delta={k.deltas.balance}
        goodWhenPositive
        prevYear={prevYear}
        reading={balanceReading(k.balance)}
        className="min-h-0"
      />
      <ReadingKpiCard
        label="Tasso risparmio"
        value={`${k.savings}%`}
        tone="savings"
        delta={k.deltas.savings}
        goodWhenPositive
        prevYear={prevYear}
        reading={savingsReading(k.savings)}
        className="min-h-0"
      />
    </div>
  )
}
