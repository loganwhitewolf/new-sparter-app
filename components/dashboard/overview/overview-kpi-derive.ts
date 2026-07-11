import type Decimal from 'decimal.js'
import { toDecimal } from '@/lib/utils/decimal'
import type { OverviewChartPoint } from '@/lib/dal/overview'
import { computeDeltaPercent, computeSavingsRate } from '@/lib/utils/dashboard'
import {
  sumSelected,
  type AllocationKey,
  type IncomeKey,
  type OutKey,
} from './overview-chart-utils'
import type { ExcludedChips } from './overview-persistence'

/**
 * Dashboard-wide default chip selection (260711-gfd, option B): the dashboard opens
 * answering the sustainability question — recurring income vs ALL spending — so
 * `extraordinary` income starts excluded. Persistence stores EXCLUDED keys; absence
 * of a stored value now means THIS default, not all-on.
 */
export const DEFAULT_EXCLUDED_CHIPS: ExcludedChips = {
  income: ['extraordinary'],
  out: [],
  allocation: [],
}

/**
 * YoY delta credibility ceiling (260711-gfd follow-up). A prior year that is partial or
 * near-zero yields a tiny denominator and an explosive percentage (e.g. +770%) that is
 * mathematically correct but useless. Beyond this magnitude the comparison is not
 * credible, so `credibleDelta` suppresses the chip (null) — the same treatment as a
 * zero prior-year base. Tunable in one place.
 */
export const MAX_CREDIBLE_DELTA_PERCENT = 300

/** Passes a delta through only when it is within the credibility ceiling. */
function credibleDelta(delta: number | null): number | null {
  if (delta === null) return null
  return Math.abs(delta) > MAX_CREDIBLE_DELTA_PERCENT ? null : delta
}

/**
 * KPI view derived from the monthly chart points under the current chip selection
 * (260711-gfd). Money values are DECIMAL strings (formatEur accepts them); deltas
 * mirror the DAL semantics (computeDeltaPercent current vs prior year, same selection).
 */
export type FilteredKpis = {
  totalIn: string
  totalOut: string
  totalAllocation: string
  balance: string
  savingsRate: number
  /**
   * Recurring income − included spending. Feeds the Bilancio structural warn, which is
   * only meaningful while `extraordinary` is included (otherwise the hero IS structural).
   */
  structuralBalance: string
  /** Per-key sums for the composition bars — only the INCLUDED keys are present. */
  incomeByKey: Partial<Record<IncomeKey, string>>
  outByKey: Partial<Record<OutKey, string>>
  deltas: {
    totalIn: number | null
    totalOut: number | null
    totalAllocation: number | null
    balance: number | null
    savingsRate: number | null
  }
}

function incomeValues(point: OverviewChartPoint): Record<string, string> {
  return { recurring: point.income.recurring, extraordinary: point.income.extraordinary }
}

function allocationValues(point: OverviewChartPoint): Record<string, string> {
  return { savings: point.allocation.savings, investment: point.allocation.investment }
}

/** Sum one bucket across all months for the included keys (Decimal — never native math). */
function sumAcrossMonths(
  points: OverviewChartPoint[],
  selectValues: (point: OverviewChartPoint) => Record<string, string>,
  includedKeys: readonly string[]
): Decimal {
  return points.reduce(
    (acc, point) => acc.plus(sumSelected(selectValues(point), includedKeys)),
    toDecimal('0.00')
  )
}

type SelectionTotals = {
  totalIn: Decimal
  totalOut: Decimal
  totalAllocation: Decimal
  balance: Decimal
  savingsRate: number
}

function totalsForSelection(
  points: OverviewChartPoint[],
  includedIncome: readonly IncomeKey[],
  includedOut: readonly OutKey[],
  includedAllocation: readonly AllocationKey[]
): SelectionTotals {
  const totalIn = sumAcrossMonths(points, incomeValues, includedIncome)
  const totalOut = sumAcrossMonths(points, (p) => p.out as unknown as Record<string, string>, includedOut)
  const totalAllocation = sumAcrossMonths(points, allocationValues, includedAllocation)
  const balance = totalIn.minus(totalOut)
  return {
    totalIn,
    totalOut,
    totalAllocation,
    balance,
    savingsRate: computeSavingsRate(totalIn.toFixed(2), totalOut.toFixed(2)),
  }
}

/**
 * Derive the KPI card view from the current + prior-year chart points under the chip
 * selection. Prior year with no data (or zero under the selection) degrades each delta
 * to null via computeDeltaPercent — the cards already render null deltas as "no chip".
 */
export function deriveFilteredKpis(
  points: OverviewChartPoint[],
  prevPoints: OverviewChartPoint[],
  includedIncome: ReadonlySet<IncomeKey>,
  includedOut: ReadonlySet<OutKey>,
  includedAllocation: ReadonlySet<AllocationKey>
): FilteredKpis {
  const income = [...includedIncome]
  const out = [...includedOut]
  const allocation = [...includedAllocation]

  const current = totalsForSelection(points, income, out, allocation)
  const previous = totalsForSelection(prevPoints, income, out, allocation)

  // Structural balance: recurring income only vs the included spending selection.
  const structural = sumAcrossMonths(points, incomeValues, ['recurring']).minus(current.totalOut)

  const incomeByKey: Partial<Record<IncomeKey, string>> = {}
  for (const key of income) {
    incomeByKey[key] = sumAcrossMonths(points, incomeValues, [key]).toFixed(2)
  }
  const outByKey: Partial<Record<OutKey, string>> = {}
  for (const key of out) {
    outByKey[key] = sumAcrossMonths(points, (p) => p.out as unknown as Record<string, string>, [key]).toFixed(2)
  }

  return {
    totalIn: current.totalIn.toFixed(2),
    totalOut: current.totalOut.toFixed(2),
    totalAllocation: current.totalAllocation.toFixed(2),
    balance: current.balance.toFixed(2),
    savingsRate: current.savingsRate,
    structuralBalance: structural.toFixed(2),
    incomeByKey,
    outByKey,
    deltas: {
      totalIn: credibleDelta(computeDeltaPercent(current.totalIn.toFixed(2), previous.totalIn.toFixed(2))),
      totalOut: credibleDelta(computeDeltaPercent(current.totalOut.toFixed(2), previous.totalOut.toFixed(2))),
      totalAllocation: credibleDelta(
        computeDeltaPercent(current.totalAllocation.toFixed(2), previous.totalAllocation.toFixed(2))
      ),
      balance: credibleDelta(computeDeltaPercent(current.balance.toFixed(2), previous.balance.toFixed(2))),
      savingsRate: credibleDelta(computeDeltaPercent(current.savingsRate, previous.savingsRate)),
    },
  }
}
