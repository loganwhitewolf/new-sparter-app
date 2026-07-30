// Unit coverage for buildCoveredMonthSeries — the D-01/D-02 composition rule that distinguishes
// "excluded because uncovered" (D-01) from "included as €0 because covered-but-no-movement"
// (D-02). No DB — categoryMonths/coveredMonths fixtures are built by hand.
import { describe, expect, it } from 'vitest'
import { toDecimal } from '@/lib/utils/decimal'
import type { CoveredMonth } from '@/lib/dal/covered-months'
import {
  buildCoveredMonthSeries,
  computeCurrentMonthHybrid,
  computePaceAndProjection,
  isPartialMonth,
  type MonthlyValue,
} from '@/lib/services/pace-and-projection'

function coveredMonth(yearMonth: string): CoveredMonth {
  const [year, month] = yearMonth.split('-').map(Number)
  return {
    yearMonth,
    from: new Date(year!, month! - 1, 1),
    to: new Date(year!, month! - 1, 28),
  }
}

/**
 * 12-entry zero-filled categoryMonths fixture matching getCategoryMonthlyAmounts' shape:
 * '200.00' in March, '180.00' in September, '0.00' every other month of 2024 — CONTEXT.md's
 * worked seasonal-category example (Salute-style spend).
 */
function seasonalCategoryMonths2024(): MonthlyValue[] {
  const months = [
    '2024-01',
    '2024-02',
    '2024-03',
    '2024-04',
    '2024-05',
    '2024-06',
    '2024-07',
    '2024-08',
    '2024-09',
    '2024-10',
    '2024-11',
    '2024-12',
  ]
  return months.map((yearMonth) => ({
    yearMonth,
    amount: yearMonth === '2024-03' ? '200.00' : yearMonth === '2024-09' ? '180.00' : '0.00',
  }))
}

describe('buildCoveredMonthSeries — seasonal category (PACE-01, D-01/D-02)', () => {
  it('keeps all 12 entries unchanged when every month of the year is covered (D-02: the 10 zero months count)', () => {
    const allTwelveCovered = seasonalCategoryMonths2024().map((m) => coveredMonth(m.yearMonth))
    const categoryMonths = seasonalCategoryMonths2024()

    const result = buildCoveredMonthSeries(allTwelveCovered, categoryMonths)

    expect(result).toHaveLength(12)
    expect(result).toEqual(categoryMonths)
  })

  it('drops an uncovered month entirely rather than zeroing it (D-01: excluded, not counted)', () => {
    const categoryMonths = seasonalCategoryMonths2024()
    const coveredExcludingJanuary = categoryMonths
      .map((m) => m.yearMonth)
      .filter((yearMonth) => yearMonth !== '2024-01')
      .map(coveredMonth)

    const result = buildCoveredMonthSeries(coveredExcludingJanuary, categoryMonths)

    expect(result).toHaveLength(11)
    expect(result.some((m) => m.yearMonth === '2024-01')).toBe(false)
  })

  it("matches CONTEXT.md's worked example: pace = €380 / 12 Covered Months = €31.67, not €380 / 2", () => {
    const allTwelveCovered = seasonalCategoryMonths2024().map((m) => coveredMonth(m.yearMonth))
    const series = buildCoveredMonthSeries(allTwelveCovered, seasonalCategoryMonths2024())

    const result = computePaceAndProjection(series)

    expect(result.status).toBe('complete')
    if (result.status === 'complete') {
      expect(toDecimal(result.pace).equals(toDecimal('31.67'))).toBe(true)
      expect(result.coveredMonthCount).toBe(12)
    }
  })
})

describe('Partial Month classification (PACE-02, D-03)', () => {
  it('classifies the current calendar month as partial regardless of how late in the month `today` falls', () => {
    expect(isPartialMonth('2026-07', new Date(2026, 6, 30))).toBe(true)
  })

  it('does NOT classify a month whose data merely stopped earlier as partial (data stops in May, today is July)', () => {
    expect(isPartialMonth('2026-05', new Date(2026, 6, 20))).toBe(false)
  })

  it('does NOT classify the month immediately before today\'s month as partial, even on day 1 of the next month', () => {
    expect(isPartialMonth('2026-06', new Date(2026, 6, 1))).toBe(false)
  })

  it('never throws for a year with zero Covered Months at all', () => {
    expect(() => isPartialMonth('2020-01', new Date(2026, 6, 30))).not.toThrow()
    expect(isPartialMonth('2020-01', new Date(2026, 6, 30))).toBe(false)
  })

  it('is a stateless per-month predicate: filtering ascending or descending yearMonths excludes the same months', () => {
    const today = new Date(2026, 6, 15)
    const ascending = ['2026-05', '2026-06', '2026-07']
    const descending = ['2026-07', '2026-06', '2026-05']

    const excludedFromAscending = ascending.filter((m) => !isPartialMonth(m, today))
    const excludedFromDescending = descending.filter((m) => !isPartialMonth(m, today)).sort()

    expect(excludedFromAscending.sort()).toEqual(excludedFromDescending)
    expect(excludedFromAscending.sort()).toEqual(['2026-05', '2026-06'])
  })
})

describe('Current month hybrid value (PACE-04, D-06)', () => {
  it('returns exactly spentSoFar when it exceeds pace', () => {
    expect(computeCurrentMonthHybrid('480.00', '300.00')).toBe('480.00')
  })

  it('returns exactly pace when pace exceeds spentSoFar', () => {
    expect(computeCurrentMonthHybrid('200.00', '300.00')).toBe('300.00')
  })

  it('returns the shared value at the exact tie — not a distinguishable branch', () => {
    expect(computeCurrentMonthHybrid('300.00', '300.00')).toBe('300.00')
  })

  it('never displays a value below the pace-1/pace/pace+1 boundary probe (D-06, PACE-04 boundary)', () => {
    expect(computeCurrentMonthHybrid('299.99', '300.00')).toBe('300.00')
    expect(computeCurrentMonthHybrid('300.00', '300.00')).toBe('300.00')
    expect(computeCurrentMonthHybrid('300.01', '300.00')).toBe('300.01')
  })

  it('the tie case returns the identical string both branches would independently produce, proving no silent divergent branch', () => {
    const spentSoFar = '300.00'
    const pace = '300.00'
    const fromSpentBranch = spentSoFar
    const fromPaceBranch = pace
    const result = computeCurrentMonthHybrid(spentSoFar, pace)

    expect(result).toBe(fromSpentBranch)
    expect(result).toBe(fromPaceBranch)
  })
})
