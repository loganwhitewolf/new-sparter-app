import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { PlatformYearCoverageSection } from '@/components/import/platform-year-coverage'
import type { PlatformYearCoverageRow } from '@/lib/dal/transactions'

vi.mock('next/navigation', () => ({
  usePathname: () => '/import',
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

const YEAR = 2026
const YEARS = ['2026', '2025']

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
      <PlatformYearCoverageSection coverage={coverage} year={YEAR} years={YEARS} />,
    )

    expect(html).toContain('Copertura per piattaforma')
    expect(html).toContain('Fineco')
    expect(html).toContain('Trade Republic')
    expect(html).toContain('1 gen – 30 apr')
    expect(html).toContain('1 gen – 31 lug')
    expect(html).toContain('Stai tracciando le tue spese fino al 31 luglio')
  })

  it('renders two fill bars with distinct left/width percentages reflecting the two date ranges', () => {
    const html = renderToStaticMarkup(
      <PlatformYearCoverageSection coverage={coverage} year={YEAR} years={YEARS} />,
    )

    const widths = [...html.matchAll(/width:([\d.]+)%/g)].map((m) => Number(m[1]))
    expect(widths).toHaveLength(2)
    const [finecoWidth, tradeRepublicWidth] = widths
    // Trade Republic's range (Jan-Jul) is wider than Fineco's (Jan-Apr).
    expect(tradeRepublicWidth).toBeGreaterThan(finecoWidth)
  })

  it('renders nothing when there are no years with data', () => {
    const html = renderToStaticMarkup(
      <PlatformYearCoverageSection coverage={[]} year={YEAR} years={[]} />,
    )

    expect(html).toBe('')
    expect(html).not.toContain('Copertura')
  })

  it('keeps the card and shows an empty message when the selected year has no coverage', () => {
    const html = renderToStaticMarkup(
      <PlatformYearCoverageSection coverage={[]} year={2025} years={YEARS} />,
    )

    expect(html).toContain('Copertura per piattaforma')
    expect(html).toContain('Nessuna copertura per 2025')
    expect(html).not.toContain('Fineco')
    expect(html).not.toContain('Stai tracciando le tue spese fino al')
  })
})
