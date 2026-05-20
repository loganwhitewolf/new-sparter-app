import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { MonthlyTrendPoint } from '@/lib/dal/dashboard'

// Recharts uses ResizeObserver; stub it for SSR snapshot.
vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
})

const { EntrateUsciteChart } = await import('@/components/dashboard/entrate-uscite-chart')
const { BilancioBarsChart } = await import('@/components/dashboard/bilancio-bars-chart')

const data: MonthlyTrendPoint[] = [
  { month: '2026-01', label: 'Gen', totalIn: '1000.00', totalOut: '800.00', totalNc: 0, totalIgn: 0 },
  { month: '2026-02', label: 'Feb', totalIn: '500.00', totalOut: '900.00', totalNc: 0, totalIgn: 0 },
]

describe('EntrateUsciteChart (D-10, D-11)', () => {
  it('exports a component that renders without throwing', () => {
    expect(typeof EntrateUsciteChart).toBe('function')
  })
  it('renders Entrate and Uscite labels', () => {
    const html = renderToStaticMarkup(<EntrateUsciteChart data={data} />)
    expect(html).toContain('Entrate')
    expect(html).toContain('Uscite')
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
    const html = renderToStaticMarkup(<BilancioBarsChart data={data} />)
    expect(html).toContain('Bilancio')
  })
})
