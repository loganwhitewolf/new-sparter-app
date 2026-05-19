import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { DeviationBadge } = await import('@/components/dashboard/deviation-badge')

describe('DeviationBadge (D-06, D-09)', () => {
  it('renders nothing when deviation is null', () => {
    const html = renderToStaticMarkup(<DeviationBadge deviation={null} categoryType="out" />)
    expect(html).toBe('')
  })

  it('renders a Nuovo label when deviation is "new"', () => {
    const html = renderToStaticMarkup(<DeviationBadge deviation="new" categoryType="out" />)
    expect(html).toContain('Nuovo')
  })

  it('renders positive deviation in red for out categories (overspend)', () => {
    const html = renderToStaticMarkup(<DeviationBadge deviation={45} categoryType="out" />)
    expect(html).toContain('+45%')
    expect(html).toContain('text-destructive')
  })

  it('renders positive deviation in green for in categories (more income)', () => {
    const html = renderToStaticMarkup(<DeviationBadge deviation={45} categoryType="in" />)
    expect(html).toContain('+45%')
    expect(html).toContain('text-emerald-600')
  })

  it('renders negative deviation with explicit minus sign and inverted color polarity', () => {
    const outHtml = renderToStaticMarkup(<DeviationBadge deviation={-12} categoryType="out" />)
    expect(outHtml).toContain('-12%')
    expect(outHtml).toContain('text-emerald-600')

    const inHtml = renderToStaticMarkup(<DeviationBadge deviation={-12} categoryType="in" />)
    expect(inHtml).toContain('-12%')
    expect(inHtml).toContain('text-destructive')
  })
})
