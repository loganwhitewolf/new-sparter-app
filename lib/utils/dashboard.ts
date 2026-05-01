import Decimal from 'decimal.js'
import { toDecimal } from '@/lib/utils/decimal'

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
