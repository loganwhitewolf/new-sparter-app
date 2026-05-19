import Decimal from 'decimal.js'
import { toDecimal } from '@/lib/utils/decimal'

export type DeviationResult = number | null | 'new'

export function computeDeviation(
  referenceAmount: string | number,
  baseline: string | number
): DeviationResult {
  const ref = toDecimal(referenceAmount)
  const base = toDecimal(baseline)
  if (base.isZero() && ref.isZero()) return null
  if (base.isZero()) return 'new'
  return roundedPercent(ref.minus(base).div(base.abs()).times(100))
}

export type DeviationReferenceRow = { id: number; amount: string }
export type DeviationBaselineRow = { id: number; month: string; amount: string }

export function buildDeviationMap(input: {
  referenceRows: DeviationReferenceRow[]
  baselineRows: DeviationBaselineRow[]
  noiseThreshold: string
}): Map<number, DeviationResult> {
  const threshold = toDecimal(input.noiseThreshold)

  // Group baseline rows by id, collecting unique months and summed amounts per month.
  const baselineById = new Map<number, Map<string, Decimal>>()
  for (const row of input.baselineRows) {
    const months = baselineById.get(row.id) ?? new Map<string, Decimal>()
    const prev = months.get(row.month) ?? new Decimal(0)
    months.set(row.month, prev.plus(toDecimal(row.amount).abs()))
    baselineById.set(row.id, months)
  }

  const result = new Map<number, DeviationResult>()
  for (const ref of input.referenceRows) {
    const refAmount = toDecimal(ref.amount).abs()
    if (refAmount.lt(threshold)) {
      result.set(ref.id, null)
      continue
    }
    const months = baselineById.get(ref.id)
    let avg = new Decimal(0)
    if (months && months.size > 0) {
      const total = Array.from(months.values()).reduce(
        (sum, value) => sum.plus(value),
        new Decimal(0)
      )
      avg = total.div(months.size)
    }
    result.set(ref.id, computeDeviation(refAmount.toFixed(2), avg.toFixed(2)))
  }
  return result
}

function roundedPercent(value: Decimal): number {
  return value.toDecimalPlaces(1).toNumber()
}

export function computeSavingsRate(totalIn: string | number, totalOut: string | number): number {
  const inValue = toDecimal(totalIn)

  if (inValue.isZero()) {
    return 0
  }

  const outValue = toDecimal(totalOut)
  return roundedPercent(inValue.minus(outValue).div(inValue).times(100))
}

export function computeDeltaPercent(
  current: string | number,
  previous: string | number
): number | null {
  const currentValue = toDecimal(current)
  const previousValue = toDecimal(previous)

  if (previousValue.isZero()) {
    return null
  }

  return roundedPercent(currentValue.minus(previousValue).div(previousValue.abs()).times(100))
}

export function computeBreakdownPercentages<T extends { amount: string | number }>(
  rows: T[]
): Array<T & { percentage: number }> {
  const total = rows.reduce((sum, row) => sum.plus(toDecimal(row.amount).abs()), new Decimal(0))

  if (total.isZero()) {
    return rows.map((row) => ({ ...row, percentage: 0 }))
  }

  return rows.map((row) => ({
    ...row,
    percentage: roundedPercent(toDecimal(row.amount).abs().div(total).times(100)),
  }))
}
