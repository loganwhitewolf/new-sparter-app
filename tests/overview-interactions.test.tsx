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

const { deriveFilteredKpis, DEFAULT_EXCLUDED_CHIPS } = await import(
  '@/components/dashboard/overview/overview-kpi-derive'
)

describe('deriveFilteredKpis (260711-gfd)', () => {
  // Two months of data + one prior-year month; distinct amounts per bucket.
  const points: OverviewChartPoint[] = [
    FIXTURE,
    {
      month: '2024-02',
      label: 'Feb',
      income: { recurring: '1000.00', extraordinary: '300.00' },
      out: { essential: '700.00', discretionary: '250.00', debt: '60.00' },
      allocation: { savings: '30.00', investment: '40.00' },
    },
  ]
  const prevPoints: OverviewChartPoint[] = [
    {
      month: '2023-01',
      label: 'Gen',
      income: { recurring: '1600.00', extraordinary: '100.00' },
      out: { essential: '800.00', discretionary: '200.00', debt: '0.00' },
      allocation: { savings: '50.00', investment: '0.00' },
    },
  ]
  const allIncome = new Set(INCOME_KEYS)
  const allOut = new Set(OUT_KEYS)
  const allAllocation = new Set(ALLOCATION_KEYS)

  it('all-on selection sums every bucket across months (parity with the chart rows)', () => {
    const kpis = deriveFilteredKpis(points, prevPoints, allIncome, allOut, allAllocation)
    // income: (1000+200) + (1000+300) = 2500; out: 490 + 1010 = 1500; alloc: 80 + 70 = 150
    expect(kpis.totalIn).toBe('2500.00')
    expect(kpis.totalOut).toBe('1500.00')
    expect(kpis.totalAllocation).toBe('150.00')
    expect(kpis.balance).toBe('1000.00')
    // savingsRate = 1000/2500 = 40%
    expect(kpis.savingsRate).toBe(40)
    // Per-month net for the sparkline: Gen 1200−490=710, Feb 1300−1010=290
    expect(kpis.balanceSeries).toEqual([710, 290])
  })

  it('sustainability default: extraordinary excluded → totals are recurring-only', () => {
    const income = new Set(
      INCOME_KEYS.filter((k) => !DEFAULT_EXCLUDED_CHIPS.income.includes(k))
    )
    const kpis = deriveFilteredKpis(points, prevPoints, income, allOut, allAllocation)
    // recurring only: 1000 + 1000 = 2000; balance = 2000 − 1500 = 500 (the structural balance)
    expect(kpis.totalIn).toBe('2000.00')
    expect(kpis.balance).toBe('500.00')
    // With recurring-only income, balance IS the structural balance
    expect(kpis.structuralBalance).toBe(kpis.balance)
    // Only the included key is present in incomeByKey
    expect(kpis.incomeByKey.recurring).toBe('2000.00')
    expect(kpis.incomeByKey.extraordinary).toBeUndefined()
  })

  it('deltas compare the SAME selection year-over-year', () => {
    const kpis = deriveFilteredKpis(points, prevPoints, allIncome, allOut, allAllocation)
    // totalIn: 2500 vs prev 1700 → +47.1%
    expect(kpis.deltas.totalIn).toBeCloseTo(47.1, 1)
    // totalOut: 1500 vs prev 1000 → +50%
    expect(kpis.deltas.totalOut).toBe(50)
  })

  it('empty prior year → all deltas null', () => {
    const kpis = deriveFilteredKpis(points, [], allIncome, allOut, allAllocation)
    expect(kpis.deltas.totalIn).toBeNull()
    expect(kpis.deltas.totalOut).toBeNull()
    expect(kpis.deltas.totalAllocation).toBeNull()
    expect(kpis.deltas.balance).toBeNull()
    expect(kpis.deltas.savingsRate).toBeNull()
  })

  it('guardrail: a non-credible delta (tiny prior-year base → >300%) is suppressed to null, credible ones pass', () => {
    // Prior year: income near-zero (partial year), spending close to current.
    const tinyPrev: OverviewChartPoint[] = [
      {
        month: '2023-01',
        label: 'Gen',
        income: { recurring: '100.00', extraordinary: '50.00' },
        out: { essential: '1200.00', discretionary: '0.00', debt: '0.00' },
        allocation: { savings: '0.00', investment: '0.00' },
      },
    ]
    const kpis = deriveFilteredKpis(points, tinyPrev, allIncome, allOut, allAllocation)
    // totalIn: 2500 vs 150 → ~1566% → suppressed
    expect(kpis.deltas.totalIn).toBeNull()
    // totalOut: 1500 vs 1200 → +25% → credible, still shown
    expect(kpis.deltas.totalOut).toBe(25)
  })

  it('excluding an out key drops it from totals AND outByKey', () => {
    const out = new Set(OUT_KEYS.filter((k) => k !== 'debt'))
    const kpis = deriveFilteredKpis(points, prevPoints, allIncome, out, allAllocation)
    // out without debt: (300+150) + (700+250) = 1400
    expect(kpis.totalOut).toBe('1400.00')
    expect(kpis.outByKey.debt).toBeUndefined()
    expect(kpis.outByKey.essential).toBe('1000.00')
  })

  it('empty income selection → zero totals, savingsRate 0 (guarded division)', () => {
    const kpis = deriveFilteredKpis(points, prevPoints, new Set(), allOut, allAllocation)
    expect(kpis.totalIn).toBe('0.00')
    expect(kpis.savingsRate).toBe(0)
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

describe('ReadingKpiCard composition-first layout (option B)', () => {
  it('renders the hero total, a composition bar with per-segment hover titles, and the dominant legend', () => {
    const html = renderToStaticMarkup(
      <ReadingKpiCard
        label="Uscite"
        hero={{ value: '3.240 €', tone: 'neutral' }}
        bar={{
          kind: 'composition',
          segments: [
            { label: 'Essenziale', value: 1980, display: '1.980 €', tone: 'out', step: 0 },
            { label: 'Discrezionale', value: 820, display: '820 €', tone: 'out', step: 1 },
            { label: 'Debiti', value: 440, display: '440 €', tone: 'out', step: 2 },
          ],
        }}
        delta={8}
        goodWhenPositive={false}
        prevYear={2025}
      />
    )
    expect(html).toContain('3.240')
    // Legend shows EVERY segment's share (icons + %); names via sr-only + hover title.
    expect(html).toContain('Essenziale')
    expect(html).toContain('61%') // 1980/3240
    expect(html).toContain('Discrezionale')
    expect(html).toContain('25%') // 820/3240
    expect(html).toContain('Debiti')
    expect(html).toContain('14%') // 440/3240
    // Amounts still surface via the bar's hover titles
    expect(html).toContain('1.980')
    // Delta chip
    expect(html).toContain('8%')
  })

  it('renders a two-colour sparkline: green above zero, red below (split at the crossing)', () => {
    const html = renderToStaticMarkup(
      <ReadingKpiCard
        label="Bilancio"
        hero={{ value: '4.690 €', tone: 'in' }}
        bar={{ kind: 'sparkline', points: [200, -150, 600, -80, 900] }}
        delta={-3}
        prevYear={2025}
        reading={{ text: 'Ottimo, sopra il 20% consigliato', sentiment: 'good' }}
      />
    )
    expect(html).toContain('4.690')
    expect(html).toContain('Ottimo, sopra il 20% consigliato')
    expect(html).toContain('<svg')
    expect(html).toContain('Andamento del bilancio')
    // Both signs present → both stroke colours rendered
    expect(html).toContain('stroke-total-in')
    expect(html).toContain('stroke-total-out')
  })

  it('renders an all-positive sparkline with no red segment', () => {
    const html = renderToStaticMarkup(
      <ReadingKpiCard
        label="Bilancio"
        hero={{ value: '4.690 €', tone: 'in' }}
        bar={{ kind: 'sparkline', points: [200, 450, 100, 600] }}
        delta={2}
        prevYear={2025}
        reading={{ text: 'Ottimo', sentiment: 'good' }}
      />
    )
    expect(html).toContain('stroke-total-in')
    expect(html).not.toContain('stroke-total-out')
  })

  it('neutral threshold: months within the ±band render neither green nor red', () => {
    const html = renderToStaticMarkup(
      <ReadingKpiCard
        label="Bilancio"
        hero={{ value: '120 €', tone: 'in' }}
        // All within ±500 → every segment neutral (no green/red).
        bar={{ kind: 'sparkline', points: [100, -200, 300, -50], neutralThreshold: 500 }}
        delta={2}
        prevYear={2025}
        reading={{ text: 'In pareggio', sentiment: 'neutral' }}
      />
    )
    expect(html).toContain('<svg')
    expect(html).not.toContain('stroke-total-in')
    expect(html).not.toContain('stroke-total-out')
  })

  it('neutral threshold: a big surplus is green, a big deficit red, small months neutral', () => {
    const html = renderToStaticMarkup(
      <ReadingKpiCard
        label="Bilancio"
        hero={{ value: '900 €', tone: 'in' }}
        bar={{ kind: 'sparkline', points: [900, -800, 100], neutralThreshold: 500 }}
        delta={2}
        prevYear={2025}
        reading={{ text: 'Ballerino', sentiment: 'warn' }}
      />
    )
    expect(html).toContain('stroke-total-in') // 900 surplus
    expect(html).toContain('stroke-total-out') // −800 deficit
  })

  it('renders no sparkline for a single data point (needs ≥2)', () => {
    const html = renderToStaticMarkup(
      <ReadingKpiCard
        label="Bilancio"
        hero={{ value: '4.690 €', tone: 'in' }}
        bar={{ kind: 'sparkline', points: [200] }}
        delta={null}
        prevYear={2025}
        reading={{ text: 'Ottimo', sentiment: 'good' }}
      />
    )
    expect(html).not.toContain('<svg')
    expect(html).toContain('4.690')
  })

  it('renders a hero + reading with no bar and no delta chip (Accantonato, delta null)', () => {
    const html = renderToStaticMarkup(
      <ReadingKpiCard
        label="Accantonato"
        hero={{ value: '1.200 €', tone: 'allocation' }}
        delta={null}
        prevYear={2025}
        reading={{ text: 'Nessun confronto con il 2025', sentiment: 'neutral' }}
      />
    )
    expect(html).toContain('1.200')
    expect(html).toContain('Nessun confronto')
    // No delta chip (and thus no arrow) when delta is null
    expect(html).not.toContain('▲')
    expect(html).not.toContain('▼')
  })

  it('renders the YoY delta chip with an arrow when a delta is present', () => {
    const html = renderToStaticMarkup(
      <ReadingKpiCard
        label="Entrate"
        hero={{ value: '5.000 €', tone: 'in' }}
        delta={12}
        goodWhenPositive
        prevYear={2025}
      />
    )
    expect(html).toContain('+12%')
    expect(html).toContain('▲')
    // prevYear surfaces via the chip title
    expect(html).toContain('2025')
  })
})

const { KpiRow } = await import('@/components/dashboard/overview/kpi-row')

describe('KpiRow dashboard-wide filter wiring (260711-gfd)', () => {
  // Single-month year: recurring 1500, extraordinary 3500, out 1800/600/200 → balance 2400,
  // structural (recurring − out) = 1500 − 2600 = −1100.
  const kpiPoints: OverviewChartPoint[] = [
    {
      month: '2026-01',
      label: 'Gen',
      income: { recurring: '1500.00', extraordinary: '3500.00' },
      out: { essential: '1800.00', discretionary: '600.00', debt: '200.00' },
      allocation: { savings: '0.00', investment: '0.00' },
    },
  ]
  const allIncome = new Set(INCOME_KEYS)
  const allOut = new Set(OUT_KEYS)
  const allAllocation = new Set(ALLOCATION_KEYS)

  it('all-on: composition segments render and Bilancio surfaces the structural warn', () => {
    const html = renderToStaticMarkup(
      <KpiRow
        data={kpiPoints}
        prevData={[]}
        includedIncome={allIncome}
        includedOut={allOut}
        includedAllocation={allAllocation}
        year={2026}
      />
    )
    // Entrate composition: both income segments present (legend or bar hover title)
    expect(html).toContain('Ricorrenti')
    expect(html).toContain('Straordinarie')
    expect(html).toMatch(/3\.500|3500/)
    // Balance 2400 positive but structural −1100 → warn quantifies the structural balance
    expect(html).toContain('Senza le entrate straordinarie')
    expect(html).toMatch(/1\.100|1100/)
    // Savings-rate caption restored: (5000−2600)/5000 = 48% vs the 20% benchmark
    expect(html).toContain('Tasso 48%')
    expect(html).toContain('obiettivo 20%')
    // Uscite split by nature — labels from NATURE_LABELS (chip lexicon)
    expect(html).toContain('Essenziale')
    expect(html).toContain('Discrezionale')
    expect(html).toContain('Debiti')
    expect(html).toMatch(/1\.800|1800/)
  })

  it('sustainability selection (extraordinary excluded): heroes ARE the structural numbers, no tautological warn', () => {
    const recurringOnly = new Set(INCOME_KEYS.filter((k) => k !== 'extraordinary'))
    const html = renderToStaticMarkup(
      <KpiRow
        data={kpiPoints}
        prevData={[]}
        includedIncome={recurringOnly}
        includedOut={allOut}
        includedAllocation={allAllocation}
        year={2026}
      />
    )
    // Entrate hero = recurring only (1500); extraordinary segment gone
    expect(html).toMatch(/1\.500|1500/)
    expect(html).not.toContain('Straordinarie')
    // Bilancio hero = structural balance −1100; the warn would be tautological → the merged
    // card falls back to the savings-rate reading (negative rate → "Attenzione: …").
    expect(html).toMatch(/1\.100|1100/)
    expect(html).not.toContain('Senza le entrate straordinarie')
    expect(html).toContain('Attenzione: spendi più di quanto guadagni')
  })

  it('excluding an out nature removes its segment and shrinks the Uscite hero', () => {
    const noDebt = new Set(OUT_KEYS.filter((k) => k !== 'debt'))
    const html = renderToStaticMarkup(
      <KpiRow
        data={kpiPoints}
        prevData={[]}
        includedIncome={allIncome}
        includedOut={noDebt}
        includedAllocation={allAllocation}
        year={2026}
      />
    )
    expect(html).not.toContain('Debiti')
    // Uscite total without debt: 2400
    expect(html).toMatch(/2\.400|2400/)
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

