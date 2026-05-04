import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
}))
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}))
vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}))

const { KpiCard } = await import('../components/dashboard/kpi-card')

describe('KpiCard', () => {
  it('hides the comparison badge when there is no previous-period delta', () => {
    const html = renderToStaticMarkup(
      <KpiCard label="Totale entrate" value="0.00" delta={null} tone="in" />,
    )

    expect(html).not.toContain('--')
    expect(html).not.toContain('periodo precedente')
  })

  it('labels available deltas as previous-period comparisons', () => {
    const html = renderToStaticMarkup(
      <KpiCard label="Totale entrate" value="100.00" delta={12.5} tone="in" />,
    )

    expect(html).toContain('+12.5%')
    expect(html).toContain('rispetto al periodo precedente')
    expect(html).toContain('vs periodo prec.')
  })
})
