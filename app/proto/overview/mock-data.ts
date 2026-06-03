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

// In-context education: one-liner per nature so the jargon labels are self-explanatory
// at the point of use (the filter chips), not only after onboarding. See NOTES.md.
export const NATURE_DESCRIPTIONS: Record<UsciteNature, string> = {
  essential: 'Spese necessarie e ricorrenti: affitto, bollette, spesa alimentare, salute.',
  discretionary: 'Consumi opzionali: ristoranti, intrattenimento, shopping.',
  operational: 'Spese di gestione e lavoro: strumenti, costi professionali.',
  financial: 'Risparmio e investimenti: ETF, conto deposito, fondi.',
  debt: 'Rimborso di debiti: rate mutuo (quota capitale), finanziamenti.',
  extraordinary: 'Spese una-tantum non ricorrenti: imprevisti, acquisti eccezionali.',
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

export const INCOME_DESCRIPTIONS: Record<IncomeType, string> = {
  recurring: 'Entrate regolari e prevedibili: stipendio, pensione, affitti incassati.',
  extraordinary: 'Entrate una-tantum: bonus, vendita di beni, rimborsi, regali.',
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

// Per-category monthly uscite (€) for the month-over-month drill-down. monthly[i] = month i.
// Independent from the by-nature totals above: the drill-down shows TOP MOVERS only
// (a subset of changes), not the full "di cui" composition (which would need to sum to
// the bar total). 2026 baked so Apr-vs-Mar keeps the original narrative.
type CategoryMonthly = { id: number; name: string; monthly: number[] }

const CATEGORIES_2026: CategoryMonthly[] = [
  { id: 1, name: 'Spesa alimentare', monthly: [430, 450, 420, 480, 460] },
  { id: 7, name: 'Ristoranti', monthly: [210, 240, 180, 360, 300] },
  { id: 12, name: 'Viaggi', monthly: [0, 0, 0, 220, 120] },
  { id: 3, name: 'Shopping', monthly: [130, 180, 150, 60, 90] },
  { id: 9, name: 'Bollette', monthly: [190, 220, 210, 160, 205] },
  { id: 15, name: 'Trasporti', monthly: [95, 100, 100, 110, 105] },
  { id: 16, name: 'Abbonamenti', monthly: [45, 45, 45, 60, 45] },
  { id: 17, name: 'Salute', monthly: [0, 80, 0, 0, 55] },
  { id: 4, name: 'Caffè & bar', monthly: [25, 28, 22, 30, 27] },
]

// 12 plausible months with Nov/Dec baked to keep the original year-end narrative.
const gen2025 = (nov: number, dec: number, base: number, wiggle: number) =>
  Array.from({ length: 12 }, (_, i) =>
    i === 10 ? nov : i === 11 ? dec : Math.max(0, Math.round(base + wiggle * Math.sin(i * 1.3)))
  )

const CATEGORIES_2025: CategoryMonthly[] = [
  { id: 7, name: 'Ristoranti', monthly: gen2025(210, 410, 250, 40) },
  { id: 14, name: 'Regali', monthly: gen2025(30, 290, 45, 20) },
  { id: 1, name: 'Spesa alimentare', monthly: gen2025(460, 540, 480, 35) },
  { id: 9, name: 'Bollette', monthly: gen2025(240, 180, 210, 25) },
  { id: 3, name: 'Shopping', monthly: gen2025(320, 240, 280, 60) },
  { id: 12, name: 'Viaggi', monthly: gen2025(40, 90, 70, 80) },
  { id: 15, name: 'Trasporti', monthly: gen2025(100, 105, 100, 12) },
]

function categoriesFor(year: number): CategoryMonthly[] {
  return year === 2025 ? CATEGORIES_2025 : CATEGORIES_2026
}

export const AVAILABLE_YEARS = [2026, 2025] as const

export function getYearData(year: number): MonthPoint[] {
  return year === 2025 ? YEAR_2025 : YEAR_2026
}

const NOISE_FLOOR = 15

// Default selected month = the LAST month that has transactions. We can't know whether a
// month is "complete" — only what's been imported — so this is the only honest default.
export function lastMonthIndex(year: number): number {
  return getYearData(year).length - 1
}

// Top movers of `monthIndex` vs the previous month (defaults to the last month with data).
export function getMovers(year: number, monthIndex?: number, limit = 5) {
  const idx = monthIndex ?? lastMonthIndex(year)
  const prevIdx = idx - 1
  const currentLabel = MONTH_LABELS[idx] ?? ''
  if (prevIdx < 0) {
    return { current: currentLabel, previous: '', monthIndex: idx, rows: [] as (Mover & { delta: number })[] }
  }
  const rows = categoriesFor(year)
    .map((c) => ({ id: c.id, name: c.name, prev: c.monthly[prevIdx], curr: c.monthly[idx], delta: c.monthly[idx] - c.monthly[prevIdx] }))
    .filter((r) => Math.abs(r.delta) >= NOISE_FLOOR)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, limit)
  return { current: currentLabel, previous: MONTH_LABELS[prevIdx], monthIndex: idx, rows }
}

export function usciteTotal(point: MonthPoint, hidden: Set<UsciteNature>): number {
  return USCITE_NATURES.reduce((sum, n) => (hidden.has(n) ? sum : sum + point.uscite[n]), 0)
}

export function incomeTotal(point: MonthPoint, hidden: Set<IncomeType>): number {
  return INCOME_TYPES.reduce((sum, t) => (hidden.has(t) ? sum : sum + point.income[t]), 0)
}

export const eur = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

// Compact label for always-on bar labels (k-notation) — fits even with 12 months.
export const eurCompact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })}k` : String(Math.round(n))

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
