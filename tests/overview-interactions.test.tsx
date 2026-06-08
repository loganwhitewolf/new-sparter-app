import { describe, expect, it } from 'vitest'
import {
  deriveFilteredBarRow,
  sumSelected,
  OUT_KEYS,
  INCOME_KEYS,
} from '@/components/dashboard/overview/overview-chart-utils'
import type { OverviewChartPoint } from '@/lib/dal/overview'

// Fixture: a single OverviewChartPoint with distinct amounts per bucket
// so that exclusion is clearly observable in assertions.
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
    operational: '80.00',
    financial: '60.00',
    debt: '40.00',
    extraordinary: '20.00',
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
  it('KPI independence: returned row has exactly the keys label, entrate, uscite', () => {
    const row = deriveFilteredBarRow(FIXTURE, INCOME_KEYS, OUT_KEYS)
    const keys = Object.keys(row).sort()
    expect(keys).toEqual(['entrate', 'label', 'uscite'])
  })

  // All-off case
  it('all-off: empty selections return { label, entrate: 0, uscite: 0 }', () => {
    const row = deriveFilteredBarRow(FIXTURE, [], [])
    expect(row.label).toBe('Gen')
    expect(row.entrate).toBe(0)
    expect(row.uscite).toBe(0)
  })

  // Full selection
  it('all-selected income and expense: totals match expected sums', () => {
    const row = deriveFilteredBarRow(FIXTURE, INCOME_KEYS, OUT_KEYS)
    expect(row.entrate).toBe(1200)
    expect(row.uscite).toBe(650)
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

