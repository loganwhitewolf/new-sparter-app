import { describe, expect, it } from 'vitest'
import {
  deriveFilteredBarRow,
  sumSelected,
  deriveNatureBreakdown,
  OUT_KEYS,
  INCOME_KEYS,
  ALLOCATION_KEYS,
} from '@/components/dashboard/overview/overview-chart-utils'
import type { OverviewChartPoint } from '@/lib/dal/overview'
import { renderToStaticMarkup } from 'react-dom/server'

const { OverviewNudge, shouldShowNudge } = await import(
  '@/components/dashboard/overview/overview-nudge'
)

const { OverviewChartFilters } = await import(
  '@/components/dashboard/overview/overview-chart-filters'
)

// Fixture: a single OverviewChartPoint with distinct amounts per bucket
// so that exclusion is clearly observable in assertions.
// Phase 49: out = spending only (essential/discretionary/debt); allocation = savings/investment.
const FIXTURE: OverviewChartPoint = {
  month: '2024-01',
  label: 'Gen',
  income: {
    recurring: '1000.00',
    extraordinary: '200.00',
  },
  out: {
    essential: '300.00',
    discretionary: '150.00',
    debt: '40.00',
  },
  allocation: {
    savings: '20.00',
    investment: '60.00',
  },
}

describe('overview chart filters (FILT-01, FILT-02, FILT-03)', () => {
  // FILT-01: income filter
  it('filters income buckets: toggling extraordinary income off drops entrate by 200', () => {
    const allIncomeRow = deriveFilteredBarRow(FIXTURE, INCOME_KEYS, OUT_KEYS)
    const noExtraordinaryRow = deriveFilteredBarRow(FIXTURE, ['recurring'], OUT_KEYS)
    expect(allIncomeRow.entrate).toBe(1200)
    expect(noExtraordinaryRow.entrate).toBe(1000)
    expect(allIncomeRow.entrate - noExtraordinaryRow.entrate).toBe(200)
  })

  // FILT-02: expense filter
  it('filters expense buckets: selecting only essential yields uscite equal to 300', () => {
    const row = deriveFilteredBarRow(FIXTURE, INCOME_KEYS, ['essential'])
    expect(row.uscite).toBe(300)
  })

  // FILT-03: KPI independence
  it('KPI independence: returned row has exactly the keys label, entrate, uscite, accantonato', () => {
    const row = deriveFilteredBarRow(FIXTURE, INCOME_KEYS, OUT_KEYS)
    const keys = Object.keys(row).sort()
    expect(keys).toEqual(['accantonato', 'entrate', 'label', 'uscite'])
  })

  // All-off case
  it('all-off: empty selections return { label, entrate: 0, uscite: 0, accantonato: 80 }', () => {
    const row = deriveFilteredBarRow(FIXTURE, [], [])
    expect(row.label).toBe('Gen')
    expect(row.entrate).toBe(0)
    expect(row.uscite).toBe(0)
    // accantonato is always totalled in full (savings 20 + investment 60 = 80)
    expect(row.accantonato).toBe(80)
  })

  // Full selection — Phase 49: out = essential+discretionary+debt = 300+150+40 = 490
  it('all-selected income and expense: totals match expected sums', () => {
    const row = deriveFilteredBarRow(FIXTURE, INCOME_KEYS, OUT_KEYS)
    expect(row.entrate).toBe(1200)
    expect(row.uscite).toBe(490)
    // accantonato = savings + investment = 20 + 60 = 80
    expect(row.accantonato).toBe(80)
  })

  // sumSelected unit tests
  it('sumSelected with partial keys returns only the sum of included keys', () => {
    const values = { recurring: '1000.00', extraordinary: '200.00' }
    const result = sumSelected(values, ['recurring'])
    expect(result.toNumber()).toBe(1000)
  })

  it('sumSelected with empty keys returns 0', () => {
    const values = { recurring: '1000.00', extraordinary: '200.00' }
    const result = sumSelected(values, [])
    expect(result.toNumber()).toBe(0)
  })

  it('sumSelected tolerates missing keys by treating them as 0', () => {
    const values = { recurring: '500.00' }
    const result = sumSelected(values, ['recurring', 'extraordinary'])
    expect(result.toNumber()).toBe(500)
  })
})

const { resolveTrendReading } = await import('@/components/dashboard/overview/kpi-row')

describe('resolveTrendReading (FRU-FIX-04)', () => {
  it('delta=null → neutral reading NOT "In linea con il {prevYear}"', () => {
    const result = resolveTrendReading(null, 2023, 'in')
    expect(result.text).not.toContain('In linea con il')
    expect(result.sentiment).toBe('neutral')
  })

  it('delta=null → truthful neutral text includes the prevYear', () => {
    const result = resolveTrendReading(null, 2023, 'in')
    expect(result.text).toContain('2023')
  })

  it('delta=0 → "In linea con il 2023" (within ±1)', () => {
    const result = resolveTrendReading(0, 2023, 'in')
    expect(result.text).toBe('In linea con il 2023')
    expect(result.sentiment).toBe('neutral')
  })

  it('delta=+10, kind=in → Più entrate, sentiment good', () => {
    const result = resolveTrendReading(10, 2023, 'in')
    expect(result.text).toContain('entrate')
    expect(result.sentiment).toBe('good')
  })

  it('delta=+10, kind=out → Spendi più, sentiment warn', () => {
    const result = resolveTrendReading(10, 2023, 'out')
    expect(result.text).toContain('più')
    expect(result.sentiment).toBe('warn')
  })

  it('delta=-10, kind=in → Meno entrate, sentiment warn', () => {
    const result = resolveTrendReading(-10, 2023, 'in')
    expect(result.text).toContain('Meno entrate')
    expect(result.sentiment).toBe('warn')
  })

  it('delta=-10, kind=out → Spendi meno, sentiment good', () => {
    const result = resolveTrendReading(-10, 2023, 'out')
    expect(result.text).toContain('meno')
    expect(result.sentiment).toBe('good')
  })
})

const { balanceReading } = await import('@/components/dashboard/overview/kpi-row')

describe('balanceReading — structural-aware (260709-kp1, decision B+)', () => {
  it('total > 0 and structural > 0 → good, legacy text', () => {
    const result = balanceReading(1000, 400)
    expect(result.text).toBe('Spendi meno di quanto guadagni')
    expect(result.sentiment).toBe('good')
  })

  it('total > 0 but structural < 0 → warn carrying the formatted structural amount', () => {
    const result = balanceReading(2400, -1100)
    expect(result.sentiment).toBe('warn')
    expect(result.text).toContain('Senza le entrate straordinarie')
    // formatEur output carries the amount digits (locale-dependent separators)
    expect(result.text).toMatch(/1[.  ]?100/)
  })

  it('total > 0 and structural = 0 → good (structural break-even still covers spending)', () => {
    const result = balanceReading(500, 0)
    expect(result.sentiment).toBe('good')
  })

  it('total < 0 → bad regardless of structural', () => {
    expect(balanceReading(-300, -900).sentiment).toBe('bad')
    expect(balanceReading(-300, null).sentiment).toBe('bad')
  })

  it('total = 0 → neutral pareggio', () => {
    const result = balanceReading(0, -50)
    expect(result.text).toBe('Sei in pareggio')
    expect(result.sentiment).toBe('neutral')
  })

  it('structural null (unknown) → legacy behavior, never warn', () => {
    const result = balanceReading(2400, null)
    expect(result.text).toBe('Spendi meno di quanto guadagni')
    expect(result.sentiment).toBe('good')
  })
})

const { ReadingKpiCard } = await import('@/components/dashboard/overview/kpi-card-reading')

describe('ReadingKpiCard recurring-first layout (260709-mf6)', () => {
  it('renders stacked component rows with an emphasised value and a total summary', () => {
    const html = renderToStaticMarkup(
      <ReadingKpiCard
        label="Entrate"
        components={[
          { label: 'Ricorrenti', value: '1.500 €', tone: 'in', emphasis: true },
          { label: 'Straordinarie', value: '3.500 €', tone: 'muted' },
        ]}
        total={{ value: '5.000 €', tone: 'neutral' }}
        delta={null}
        prevYear={2025}
      />
    )
    expect(html).toContain('Ricorrenti')
    expect(html).toContain('Straordinarie')
    expect(html).toContain('1.500')
    expect(html).toContain('3.500')
    // Grand total summary line
    expect(html).toContain('Totale')
    expect(html).toContain('5.000')
    // Emphasised row uses the large type scale; secondary uses the smaller one
    expect(html).toContain('text-2xl')
    expect(html).toContain('text-lg')
  })

  it('renders a labelless single value with no total line (Accantonato shape)', () => {
    const html = renderToStaticMarkup(
      <ReadingKpiCard
        label="Accantonato"
        components={[{ value: '1.200 €', tone: 'allocation', emphasis: true }]}
        total={null}
        delta={null}
        prevYear={2025}
        reading={{ text: 'Nessun confronto con il 2025', sentiment: 'neutral' }}
      />
    )
    expect(html).toContain('1.200')
    expect(html).toContain('Nessun confronto')
    expect(html).not.toContain('Totale')
  })

  it('renders the YoY delta badge when a delta is present', () => {
    const html = renderToStaticMarkup(
      <ReadingKpiCard
        label="Entrate"
        components={[{ value: '5.000 €', tone: 'in', emphasis: true }]}
        total={null}
        delta={12}
        goodWhenPositive
        prevYear={2025}
      />
    )
    expect(html).toContain('+12%')
    expect(html).toContain('2025')
  })
})

const { KpiRow } = await import('@/components/dashboard/overview/kpi-row')

describe('KpiRow breakdown wiring (260709-lan, 260709-leg)', () => {
  const overviewFixture = {
    totalIn: '5000.00',
    totalOut: '2600.00',
    totalAllocation: '0.00',
    balance: '2400.00',
    structuralBalance: '-1100.00',
    totalInRecurring: '1500.00',
    structuralSavingsRate: -73.3,
    outByNature: { essential: '1800.00', discretionary: '600.00', debt: '200.00' },
    savingsRate: 48,
    uncategorizedCount: 0,
    deltas: {
      totalIn: null,
      totalOut: null,
      totalAllocation: null,
      balance: null,
      savingsRate: null,
      uncategorizedCount: null,
    },
  }

  it('Entrate shows Ricorrenti/Straordinarie; Bilancio and Tasso show Solo ricorrenti (label review 2026-07-09)', () => {
    const html = renderToStaticMarkup(<KpiRow data={overviewFixture} year={2026} />)
    expect(html).toContain('Ricorrenti')
    expect(html).toContain('Straordinarie')
    // Structural rows on Bilancio + Tasso risparmio (locked label)
    expect(html).toContain('Solo ricorrenti')
    // Structural amount −1100 and derived extraordinary 3500 both rendered
    expect(html).toMatch(/1\.100|1100/)
    expect(html).toMatch(/3\.500|3500/)
    // 260709-lj5: recurring-only savings rate row on the Tasso risparmio card
    expect(html).toContain('-73.3%')
    // 260709-lkw: Uscite split by nature — labels from NATURE_LABELS (chip lexicon)
    expect(html).toContain('Essenziale')
    expect(html).toContain('Discrezionale')
    expect(html).toContain('Debiti')
    expect(html).toMatch(/1\.800|1800/)
  })

  it('null structural/recurring fields → no breakdown rows anywhere', () => {
    const html = renderToStaticMarkup(
      <KpiRow
        data={{
          ...overviewFixture,
          structuralBalance: null,
          totalInRecurring: null,
          structuralSavingsRate: null,
          outByNature: null,
        }}
        year={2026}
      />
    )
    expect(html).not.toContain('Ricorrenti')
    expect(html).not.toContain('Solo ricorrenti')
    expect(html).not.toContain('Straordinarie')
    expect(html).not.toContain('-73.3%')
    expect(html).not.toContain('Essenziale')
  })
})

describe('deriveNatureBreakdown (FRU-FIX-02)', () => {
  it('income has recurring=1000 with correct label and color', () => {
    const result = deriveNatureBreakdown(FIXTURE, new Set(INCOME_KEYS), new Set(OUT_KEYS))
    const recurring = result.income.find((item) => item.key === 'recurring')
    expect(recurring).toBeDefined()
    expect(recurring!.amount).toBe(1000)
    expect(recurring!.label).toBe('Entrate ricorrenti')
    expect(recurring!.color).toBe('#34d399')
  })

  it('income has extraordinary=200 with correct label and color', () => {
    const result = deriveNatureBreakdown(FIXTURE, new Set(INCOME_KEYS), new Set(OUT_KEYS))
    const extraordinary = result.income.find((item) => item.key === 'extraordinary')
    expect(extraordinary).toBeDefined()
    expect(extraordinary!.amount).toBe(200)
    expect(extraordinary!.label).toBe('Straordinaria')
    expect(extraordinary!.color).toBe('#a7f3d0')
  })

  it('out lists the three spending natures (essential/discretionary/debt) with correct fixture amounts', () => {
    const result = deriveNatureBreakdown(FIXTURE, new Set(INCOME_KEYS), new Set(OUT_KEYS))
    expect(result.out).toHaveLength(3)
    const essential = result.out.find((item) => item.key === 'essential')
    expect(essential!.amount).toBe(300)
    const discretionary = result.out.find((item) => item.key === 'discretionary')
    expect(discretionary!.amount).toBe(150)
    const debt = result.out.find((item) => item.key === 'debt')
    expect(debt!.amount).toBe(40)
  })

  it('allocation section lists savings and investment from the allocation bucket', () => {
    const result = deriveNatureBreakdown(FIXTURE, new Set(INCOME_KEYS), new Set(OUT_KEYS))
    expect(result.allocation).toHaveLength(2)
    const savings = result.allocation.find((item) => item.key === 'savings')
    expect(savings!.amount).toBe(20)
    const investment = result.allocation.find((item) => item.key === 'investment')
    expect(investment!.amount).toBe(60)
  })

  it('excluding a key drops it from the returned array', () => {
    const result = deriveNatureBreakdown(FIXTURE, new Set(['recurring'] as const), new Set(OUT_KEYS))
    const extraordinary = result.income.find((item) => item.key === 'extraordinary')
    expect(extraordinary).toBeUndefined()
    expect(result.income).toHaveLength(1)
  })

  it('excluding an out key drops it from the out array', () => {
    const reducedOut = new Set(OUT_KEYS.filter((k) => k !== 'debt'))
    const result = deriveNatureBreakdown(FIXTURE, new Set(INCOME_KEYS), reducedOut)
    const debt = result.out.find((item) => item.key === 'debt')
    expect(debt).toBeUndefined()
    expect(result.out).toHaveLength(2)
  })

  it('out items carry correct colors from NATURE_COLORS', () => {
    const result = deriveNatureBreakdown(FIXTURE, new Set(INCOME_KEYS), new Set(OUT_KEYS))
    const essential = result.out.find((item) => item.key === 'essential')
    expect(essential!.color).toBe('#4ade80')
    const debt = result.out.find((item) => item.key === 'debt')
    expect(debt!.color).toBe('#f87171')
  })
})

describe('overview nudge (NUDGE-01..04, NUDGE-03)', () => {
  // shouldShowNudge unit tests covering lastSeenCount semantics

  it('shouldShowNudge: zero count is always hidden (NUDGE-04)', () => {
    expect(shouldShowNudge(0, null)).toBe(false)
  })

  it('shouldShowNudge: count > 0 with no stored value shows the nudge (NUDGE-01)', () => {
    expect(shouldShowNudge(5, null)).toBe(true)
  })

  it('shouldShowNudge: dismissed at current count hides the nudge (NUDGE-03)', () => {
    expect(shouldShowNudge(5, { lastSeenCount: 5 })).toBe(false)
  })

  it('shouldShowNudge reappears when new uncategorized arrive above lastSeenCount (NUDGE-03 lastSeenCount)', () => {
    expect(shouldShowNudge(8, { lastSeenCount: 5 })).toBe(true)
  })

  it('shouldShowNudge: count fell below lastSeenCount stays hidden', () => {
    expect(shouldShowNudge(3, { lastSeenCount: 5 })).toBe(false)
  })

  // Static render tests: visible defaults false (SSR-safe), so count>0 renders nothing before hydration.
  // NUDGE-04: count === 0 → renders empty string in static markup.
  it('nudge renders nothing (empty string) when uncategorizedCount is 0 (NUDGE-04)', () => {
    const html = renderToStaticMarkup(
      <OverviewNudge uncategorizedCount={0} year={2024} />
    )
    expect(html).toBe('')
  })

  // NUDGE-01: count > 0 still renders nothing in static (visible=false before useEffect),
  // but shouldShowNudge(5, null) === true covers the show logic at unit level.
  it('nudge static render with count > 0 returns empty string (SSR-safe default hidden, NUDGE-01 covered by shouldShowNudge)', () => {
    const html = renderToStaticMarkup(
      <OverviewNudge uncategorizedCount={5} year={2024} />
    )
    expect(html).toBe('')
  })
})

describe('overview chart education (EDU-01, EDU-02)', () => {
  // Pitfall 4: Tooltip and Popover content is portaled and will NOT appear in
  // renderToStaticMarkup output. We assert only on trigger elements and aria-labels.

  // Helper: all-on state for OverviewChartFilters
  const allOnProps = {
    includedIncome: new Set(INCOME_KEYS),
    includedOut: new Set(OUT_KEYS),
    includedAllocation: new Set(ALLOCATION_KEYS),
    onToggleIncome: () => {},
    onToggleOut: () => {},
    onToggleAllocation: () => {},
  }

  // EDU-01: group info popovers have accessible aria-labels on their triggers
  it('education: Entrate group info trigger has aria-label "Informazioni sul gruppo Entrate"', () => {
    const html = renderToStaticMarkup(<OverviewChartFilters {...allOnProps} />)
    expect(html).toContain('aria-label="Informazioni sul gruppo Entrate"')
  })

  it('education: Uscite group info trigger has aria-label "Informazioni sul gruppo Uscite"', () => {
    const html = renderToStaticMarkup(<OverviewChartFilters {...allOnProps} />)
    expect(html).toContain('aria-label="Informazioni sul gruppo Uscite"')
  })

  // EDU-02: chip trigger labels render in static markup (button text, not portaled tooltip body)
  it('tooltip: income chip label "Ricorrenti" appears as a trigger in the rendered output', () => {
    const html = renderToStaticMarkup(<OverviewChartFilters {...allOnProps} />)
    expect(html).toContain('Ricorrenti')
  })

  it('tooltip: income chip label "Straordinarie" appears as a trigger in the rendered output', () => {
    const html = renderToStaticMarkup(<OverviewChartFilters {...allOnProps} />)
    expect(html).toContain('Straordinarie')
  })

  it('tooltip: expense chip label "Essenziale" appears as a trigger in the rendered output', () => {
    const html = renderToStaticMarkup(<OverviewChartFilters {...allOnProps} />)
    expect(html).toContain('Essenziale')
  })

  // aria-pressed is present (accessibility check)
  it('tooltip: chips render with aria-pressed attribute', () => {
    const html = renderToStaticMarkup(<OverviewChartFilters {...allOnProps} />)
    expect(html).toContain('aria-pressed')
  })
})

