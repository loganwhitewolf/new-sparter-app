import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PlatformYearCoverageSection } from '@/components/import/platform-year-coverage'
import type { PlatformYearCoverageRow } from '@/lib/dal/transactions'

const YEAR = 2026

const coverage: PlatformYearCoverageRow[] = [
  {
    platformId: 1,
    platformName: 'Fineco',
    firstTransactionAt: new Date(YEAR, 0, 1),
    lastTransactionAt: new Date(YEAR, 3, 30),
  },
  {
    platformId: 2,
    platformName: 'Trade Republic',
    firstTransactionAt: new Date(YEAR, 0, 1),
    lastTransactionAt: new Date(YEAR, 6, 31),
  },
]

describe('PlatformYearCoverageSection (GBH-01)', () => {
  it('renders one row per platform with its name and formatted date-range label', () => {
    const html = renderToStaticMarkup(
      <PlatformYearCoverageSection coverage={coverage} year={YEAR} />,
    )

    expect(html).toContain(`Copertura ${YEAR} per piattaforma`)
    expect(html).toContain('Fineco')
    expect(html).toContain('Trade Republic')
    expect(html).toContain('1 gen – 30 apr')
    expect(html).toContain('1 gen – 31 lug')
  })

  it('renders two fill bars with distinct left/width percentages reflecting the two date ranges', () => {
    const html = renderToStaticMarkup(
      <PlatformYearCoverageSection coverage={coverage} year={YEAR} />,
    )

    const widths = [...html.matchAll(/width:([\d.]+)%/g)].map((m) => Number(m[1]))
    expect(widths).toHaveLength(2)
    const [finecoWidth, tradeRepublicWidth] = widths
    // Trade Republic's range (Jan-Jul) is wider than Fineco's (Jan-Apr).
    expect(tradeRepublicWidth).toBeGreaterThan(finecoWidth)
  })

  it('renders nothing when coverage is empty', () => {
    const html = renderToStaticMarkup(<PlatformYearCoverageSection coverage={[]} year={YEAR} />)

    expect(html).toBe('')
    expect(html).not.toContain('Copertura')
  })
})
