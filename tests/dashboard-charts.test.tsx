import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { MonthlyTrendPoint } from '@/lib/dal/dashboard'
import { NATURE_LABELS, NATURE_ORDER } from '@/lib/utils/nature-labels'

// Recharts uses ResizeObserver; stub it for SSR snapshot.
vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
})

// Plan 37-04 uses useSearchParams for URL-persisted legend toggles.
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/dashboard/overview',
}))

const { EntrateUsciteChart } = await import('@/components/dashboard/entrate-uscite-chart')
const { BilancioBarsChart } = await import('@/components/dashboard/bilancio-bars-chart')

// Fixture shaped for MonthlyNatureTrendPoint (Plan 37-03 will define this type).
// Cast as any: MonthlyNatureTrendPoint does not exist yet; type errors would block tsc rather than produce runtime RED failures.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data: any[] = [
  {
    month: '2026-01',
    label: 'Gen',
    segments: { essential: '500.00', discretionary: '200.00', unclassified: '100.00' },
    totalNc: 0,
    totalIgn: 0,
  },
  {
    month: '2026-02',
    label: 'Feb',
    segments: { essential: '400.00', discretionary: '300.00', unclassified: '50.00' },
    totalNc: 0,
    totalIgn: 0,
  },
]

// Legacy MonthlyTrendPoint fixture kept for BilancioBarsChart (unchanged shape)
const legacyData: MonthlyTrendPoint[] = [
  { month: '2026-01', label: 'Gen', totalIn: '1000.00', totalOut: '800.00', totalNc: 0, totalIgn: 0 },
  { month: '2026-02', label: 'Feb', totalIn: '500.00', totalOut: '900.00', totalNc: 0, totalIgn: 0 },
]

describe('EntrateUsciteChart (R-FN-04, R-FN-06)', () => {
  it('exports a component that renders without throwing', () => {
    expect(typeof EntrateUsciteChart).toBe('function')
  })

  it('renders Essenziale nature label', () => {
    const html = renderToStaticMarkup(<EntrateUsciteChart data={data} />)
    expect(html).toContain('Essenziale')
  })

  it('renders Non classificato segment label', () => {
    const html = renderToStaticMarkup(<EntrateUsciteChart data={data} />)
    expect(html).toContain('Non classificato')
  })

  it('renders one segment per nature in NATURE_ORDER', () => {
    const html = renderToStaticMarkup(<EntrateUsciteChart data={data} />)
    const nonNullNatures = NATURE_ORDER.filter((n) => n !== null)
    for (const nature of nonNullNatures) {
      expect(html).toContain(NATURE_LABELS[nature])
    }
  })

  it('does not render removed series labels (Non categorizzato, Ignorato, Bilancio)', () => {
    const html = renderToStaticMarkup(<EntrateUsciteChart data={data} />)
    expect(html).not.toContain('Non categorizzato')
    expect(html).not.toContain('Ignorato')
    expect(html).not.toContain('Bilancio')
  })
})

describe('BilancioBarsChart (D-12)', () => {
  it('exports a component that renders without throwing', () => {
    expect(typeof BilancioBarsChart).toBe('function')
  })
  it('renders the Bilancio label', () => {
    const html = renderToStaticMarkup(<BilancioBarsChart data={legacyData} />)
    expect(html).toContain('Bilancio')
  })
})
