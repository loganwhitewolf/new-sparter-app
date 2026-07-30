// Unit coverage for buildCoveredMonthSeries — the D-01/D-02 composition rule that distinguishes
// "excluded because uncovered" (D-01) from "included as €0 because covered-but-no-movement"
// (D-02). No DB — categoryMonths/coveredMonths fixtures are built by hand.
import { describe, expect, it } from 'vitest'
import { toDecimal } from '@/lib/utils/decimal'
import type { CoveredMonth } from '@/lib/dal/covered-months'
import {
  buildCoveredMonthSeries,
  buildYearSeries,
  canShowPreviousYearTotalDifference,
  computeComparison,
  computeCurrentMonthHybrid,
  computePaceAndProjection,
  isPartialMonth,
  PREVIOUS_YEAR_TOTAL_DIFFERENCE_MIN_COVERED_MONTHS,
  resolveComparisonJudgement,
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

describe('Pace availability boundary (PACE-03, D-05: MIN_COVERED_MONTHS_FOR_PACE = 2)', () => {
  // The only cases exercised elsewhere in this repo are 0 (real-Postgres, insufficient) and
  // 3/12 (complete) — this closes the actual off-by-one boundary the constant exists to enforce
  // (review fix WR-02).
  it('is insufficient at exactly 1 Covered Month', () => {
    const oneMonth: MonthlyValue[] = [{ yearMonth: '2026-01', amount: '100.00' }]

    expect(computePaceAndProjection(oneMonth)).toEqual({
      status: 'insufficient',
      coveredMonthCount: 1,
    })
  })

  it('is complete at exactly 2 Covered Months', () => {
    const twoMonths: MonthlyValue[] = [
      { yearMonth: '2026-01', amount: '100.00' },
      { yearMonth: '2026-02', amount: '200.00' },
    ]

    const result = computePaceAndProjection(twoMonths)
    expect(result.status).toBe('complete')
    if (result.status === 'complete') {
      expect(result.coveredMonthCount).toBe(2)
      expect(toDecimal(result.pace).equals(toDecimal('150.00'))).toBe(true)
    }
  })
})

describe('Total equals sum of series (PACE-05, D-07)', () => {
  it('total is the reduce-sum of the months array for a straightforward fixture', () => {
    const months: MonthlyValue[] = [
      { yearMonth: '2026-01', amount: '100.00' },
      { yearMonth: '2026-02', amount: '200.00' },
      { yearMonth: '2026-03', amount: '150.50' },
    ]

    const result = buildYearSeries(months)

    expect(result.total).toBe('450.50')
    expect(result.months).toEqual(months)
  })

  it('holds the invariant EXACTLY (not approximately) when the already-rounded monthly values do not sum to a "clean" total — the total is the literal sum of the displayed series, never independently re-derived', () => {
    // €100.00 spread evenly over 3 months at the pace formula's own rounding boundary:
    // 100 / 3 = 33.333... -> rounds (ROUND_HALF_UP, toDbDecimal) to '33.33' per month.
    // The naive/independent total would be '100.00'; the D-07-correct total is '99.99' —
    // the literal sum of the three already-rounded, already-displayed month values.
    const roundedMonths: MonthlyValue[] = [
      { yearMonth: '2026-01', amount: '33.33' },
      { yearMonth: '2026-02', amount: '33.33' },
      { yearMonth: '2026-03', amount: '33.33' },
    ]

    const result = buildYearSeries(roundedMonths)

    const handComputedSumOfDisplayedSeries = roundedMonths
      .reduce((sum, m) => sum.plus(toDecimal(m.amount)), toDecimal('0'))
      .toFixed(2)

    expect(result.total).toBe(handComputedSumOfDisplayedSeries)
    expect(result.total).toBe('99.99')
    expect(result.total).not.toBe('100.00')
  })

  it('changes total by exactly the delta when one month is mutated, proving the structural link (not a coincidental match)', () => {
    const months: MonthlyValue[] = [
      { yearMonth: '2026-01', amount: '100.00' },
      { yearMonth: '2026-02', amount: '200.00' },
      { yearMonth: '2026-03', amount: '150.50' },
    ]
    const before = buildYearSeries(months)

    const mutatedMonths: MonthlyValue[] = months.map((m) =>
      m.yearMonth === '2026-02' ? { ...m, amount: '250.00' } : m,
    )
    const after = buildYearSeries(mutatedMonths)

    const delta = toDecimal(after.total).minus(toDecimal(before.total))
    expect(delta.toFixed(2)).toBe('50.00')
  })
})

describe('Comparison sign convention and judgement (PACE-06, D-08/D-09/D-10)', () => {
  it('computeComparison follows current − previous (D-08)', () => {
    expect(computeComparison('380.00', '200.00')).toBe('180.00')
    expect(computeComparison('200.00', '380.00')).toBe('-180.00')
  })

  it('never throws for a zero-value previous period', () => {
    expect(() => computeComparison('0.00', '0.00')).not.toThrow()
    expect(computeComparison('0.00', '0.00')).toBe('0.00')
  })

  it('resolveComparisonJudgement: on "out", positive delta is worse, negative is better, zero is neutral', () => {
    expect(resolveComparisonJudgement('180.00', 'out')).toBe('worse')
    expect(resolveComparisonJudgement('-180.00', 'out')).toBe('better')
    expect(resolveComparisonJudgement('0.00', 'out')).toBe('neutral')
  })

  it('resolveComparisonJudgement: on "allocation"/"in", positive delta is better, negative is worse, zero is neutral', () => {
    expect(resolveComparisonJudgement('180.00', 'allocation')).toBe('better')
    expect(resolveComparisonJudgement('180.00', 'in')).toBe('better')
    expect(resolveComparisonJudgement('-180.00', 'allocation')).toBe('worse')
    expect(resolveComparisonJudgement('-180.00', 'in')).toBe('worse')
    expect(resolveComparisonJudgement('0.00', 'allocation')).toBe('neutral')
    expect(resolveComparisonJudgement('0.00', 'in')).toBe('neutral')
  })

  it('is deterministic: identical inputs always yield identical, ===-equal outputs across repeated calls', () => {
    const first = resolveComparisonJudgement('180.00', 'out')
    const second = resolveComparisonJudgement('180.00', 'out')
    expect(first).toBe(second)

    const firstComparison = computeComparison('380.00', '200.00')
    const secondComparison = computeComparison('380.00', '200.00')
    expect(firstComparison).toBe(secondComparison)
  })

  it('canShowPreviousYearTotalDifference gates only at the D-10 threshold (exported as PREVIOUS_YEAR_TOTAL_DIFFERENCE_MIN_COVERED_MONTHS = 6)', () => {
    expect(PREVIOUS_YEAR_TOTAL_DIFFERENCE_MIN_COVERED_MONTHS).toBe(6)
    expect(canShowPreviousYearTotalDifference(5)).toBe(false)
    expect(canShowPreviousYearTotalDifference(6)).toBe(true)
    expect(canShowPreviousYearTotalDifference(7)).toBe(true)
  })
})
