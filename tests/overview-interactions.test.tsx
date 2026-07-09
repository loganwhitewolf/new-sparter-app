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

