// PROTOTYPE — wipe me. Throwaway mock data for the /dashboard/overview redesign.
// Answers: "is the new year-based overview legible, vs the confusing stacked-by-nature chart?"
// No DB, no real DAL. Numbers are plausible Italian personal-finance figures.

export const USCITE_NATURES = [
  'essential',
  'discretionary',
  'operational',
  'financial',
  'debt',
  'extraordinary',
] as const

export type UsciteNature = (typeof USCITE_NATURES)[number]

export const NATURE_LABELS: Record<UsciteNature, string> = {
  essential: 'Essenziale',
  discretionary: 'Discrezionale',
  operational: 'Operativo',
  financial: 'Finanziario',
  debt: 'Debiti',
  extraordinary: 'Straordinario',
}

export const NATURE_COLORS: Record<UsciteNature, string> = {
  essential: '#4ade80',
  discretionary: '#f97316',
  operational: '#60a5fa',
  financial: '#a78bfa',
  debt: '#f87171',
  extraordinary: '#fbbf24',
}

// Entrate split into two types: recurring (stipendio) vs extraordinary (vendita azioni).
export const INCOME_TYPES = ['recurring', 'extraordinary'] as const
export type IncomeType = (typeof INCOME_TYPES)[number]

export const INCOME_LABELS: Record<IncomeType, string> = {
  recurring: 'Ricorrente',
  extraordinary: 'Straordinaria',
}

export const INCOME_COLORS: Record<IncomeType, string> = {
  recurring: '#34d399',
  extraordinary: '#a7f3d0',
}

export type MonthPoint = {
  month: string // YYYY-MM
  label: string // Gen, Feb...
  income: Record<IncomeType, number>
  uscite: Record<UsciteNature, number>
}

export type Mover = {
  id: number
  name: string
  prev: number
  curr: number
}

const MONTH_LABELS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

function m(
  year: number,
  monthIndex: number,
  income: Record<IncomeType, number>,
  uscite: Record<UsciteNature, number>
): MonthPoint {
  return {
    month: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
    label: MONTH_LABELS[monthIndex],
    income,
    uscite,
  }
}

// Current year, in progress (today = 29 May 2026): Jan→May only.
// April has a big extraordinary income (vendita azioni) to make the income filter visible.
const YEAR_2026: MonthPoint[] = [
  m(2026, 0, { recurring: 2800, extraordinary: 200 }, { essential: 900, discretionary: 450, operational: 200, financial: 150, debt: 300, extraordinary: 0 }),
  m(2026, 1, { recurring: 2800, extraordinary: 200 }, { essential: 880, discretionary: 520, operational: 180, financial: 150, debt: 300, extraordinary: 120 }),
  m(2026, 2, { recurring: 2800, extraordinary: 300 }, { essential: 910, discretionary: 480, operational: 220, financial: 160, debt: 300, extraordinary: 0 }),
  m(2026, 3, { recurring: 2800, extraordinary: 900 }, { essential: 950, discretionary: 680, operational: 210, financial: 160, debt: 300, extraordinary: 250 }),
  m(2026, 4, { recurring: 2800, extraordinary: 400 }, { essential: 900, discretionary: 500, operational: 190, financial: 150, debt: 300, extraordinary: 0 }),
]

// Past year, complete: all 12 months.
const YEAR_2025: MonthPoint[] = MONTH_LABELS.map((_, i) =>
  m(
    2025,
    i,
    { recurring: 2700, extraordinary: i === 6 || i === 11 ? 700 : 100 + ((i * 13) % 150) },
    {
      essential: 820 + ((i * 23) % 160),
      discretionary: 380 + ((i * 53) % 320),
      operational: 170 + ((i * 11) % 90),
      financial: 140,
      debt: 300,
      extraordinary: i === 6 || i === 11 ? 400 : 0, // summer trip + Christmas
    }
  )
)

const MOVERS: Record<number, { current: string; previous: string; rows: Mover[] }> = {
  2026: {
    current: 'Apr',
    previous: 'Mar',
    rows: [
      { id: 12, name: 'Viaggi', prev: 0, curr: 220 },
      { id: 7, name: 'Ristoranti', prev: 180, curr: 360 },
      { id: 3, name: 'Shopping', prev: 150, curr: 60 },
      { id: 1, name: 'Spesa alimentare', prev: 420, curr: 480 },
      { id: 9, name: 'Bollette', prev: 210, curr: 160 },
      { id: 4, name: 'Caffè', prev: 22, curr: 30 }, // below 15€ delta → filtered out
    ],
  },
  2025: {
    current: 'Dic',
    previous: 'Nov',
    rows: [
      { id: 7, name: 'Ristoranti', prev: 210, curr: 410 },
      { id: 14, name: 'Regali', prev: 30, curr: 290 },
      { id: 1, name: 'Spesa alimentare', prev: 460, curr: 540 },
      { id: 9, name: 'Bollette', prev: 240, curr: 180 },
      { id: 3, name: 'Shopping', prev: 320, curr: 240 },
    ],
  },
}

export const AVAILABLE_YEARS = [2026, 2025] as const

export function getYearData(year: number): MonthPoint[] {
  return year === 2025 ? YEAR_2025 : YEAR_2026
}

const NOISE_FLOOR = 15

export function getMovers(year: number) {
  const set = MOVERS[year] ?? MOVERS[2026]
  const rows = set.rows
    .map((r) => ({ ...r, delta: r.curr - r.prev }))
    .filter((r) => Math.abs(r.delta) >= NOISE_FLOOR)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 5)
  return { current: set.current, previous: set.previous, rows }
}

export function usciteTotal(point: MonthPoint, hidden: Set<UsciteNature>): number {
  return USCITE_NATURES.reduce((sum, n) => (hidden.has(n) ? sum : sum + point.uscite[n]), 0)
}

export function incomeTotal(point: MonthPoint, hidden: Set<IncomeType>): number {
  return INCOME_TYPES.reduce((sum, t) => (hidden.has(t) ? sum : sum + point.income[t]), 0)
}

export const eur = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

export const eurSigned = (n: number) =>
  `${n > 0 ? '+' : n < 0 ? '−' : ''}${eur(Math.abs(n))}`

// Year-scoped KPIs with YTD-vs-same-span-previous-year deltas (mocked deltas).
export function getKpis(year: number, hiddenUscite: Set<UsciteNature>, hiddenIncome: Set<IncomeType>) {
  const data = getYearData(year)
  const totalIn = data.reduce((s, p) => s + incomeTotal(p, hiddenIncome), 0)
  const totalOut = data.reduce((s, p) => s + usciteTotal(p, hiddenUscite), 0)
  const balance = totalIn - totalOut
  const savings = totalIn > 0 ? Math.round((balance / totalIn) * 100) : 0
  // Fake but plausible YTD-vs-YTD deltas.
  const deltas = year === 2025
    ? { totalIn: 4.2, totalOut: 6.1, balance: -3.4, savings: -2.0, uncat: -40 }
    : { totalIn: 6.8, totalOut: -2.3, balance: 18.5, savings: 9.1, uncat: -25 }
  return { totalIn, totalOut, balance, savings, uncategorized: year === 2025 ? 0 : 14, deltas }
}
