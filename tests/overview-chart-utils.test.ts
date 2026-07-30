// Pure-function coverage for deriveCashOverlayValues (lens-selector redesign, LSD-03).
// No DOM/render harness needed — this is a pure numeric derivation over OverviewChartPoint[].
import { describe, expect, it } from 'vitest'
import { deriveCashOverlayValues, type OutKey } from '@/components/dashboard/overview/overview-chart-utils'
import type { OverviewChartPoint } from '@/lib/dal/overview'

function buildPoint(overrides: Partial<OverviewChartPoint['out']> = {}): OverviewChartPoint {
  return {
    month: '2026-01',
    label: 'Gen',
    income: { recurring: '0.00', extraordinary: '0.00' },
    out: {
      essential: '0.00',
      discretionary: '0.00',
      debt: '0.00',
      ...overrides,
    },
    allocation: { savings: '0.00', investment: '0.00' },
  }
}

describe('deriveCashOverlayValues', () => {
  it('sums only the out keys present in includedOut, Decimal-precise', () => {
    const point = buildPoint({ essential: '100.00', discretionary: '50.00', debt: '0.00' })
    const includedOut: OutKey[] = ['essential', 'discretionary', 'debt']

    const result = deriveCashOverlayValues([point], includedOut)

    expect(result).toEqual([150])
  })

  it('excludes keys outside includedOut', () => {
    const point = buildPoint({ essential: '100.00', discretionary: '50.00', debt: '0.00' })
    const includedOut: OutKey[] = ['essential']

    const result = deriveCashOverlayValues([point], includedOut)

    expect(result).toEqual([100])
  })

  it('preserves index alignment across multiple points', () => {
    const points = [
      buildPoint({ essential: '10.00' }),
      buildPoint({ essential: '20.00' }),
      buildPoint({ essential: '30.00' }),
    ]
    const includedOut: OutKey[] = ['essential']

    const result = deriveCashOverlayValues(points, includedOut)

    expect(result).toEqual([10, 20, 30])
    expect(result).toHaveLength(3)
  })

  it('an empty includedOut set yields 0 for every point — never throws, never NaN', () => {
    const points = [
      buildPoint({ essential: '100.00', discretionary: '50.00', debt: '25.00' }),
      buildPoint({ essential: '5.00' }),
    ]

    const result = deriveCashOverlayValues(points, [])

    expect(result).toEqual([0, 0])
    expect(result.every((v) => !Number.isNaN(v))).toBe(true)
  })
})
