import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { DetailPageShell } from '@/components/detail-pages/detail-page-shell'
import { expenseDetailHref, transactionDetailHref } from '@/lib/routes'

describe('DetailPageShell', () => {
  test('renders header (title, amount, actions) with only datiCard set', () => {
    const html = renderToStaticMarkup(
      <DetailPageShell
        backHref="/transactions"
        title="SUPERMERCATO CENTRALE"
        amount="-45,30 €"
        primaryAction={<span>Cerca su internet</span>}
        overflowMenu={<span>Overflow</span>}
        datiCard={<div>Dati card content</div>}
      />,
    )

    expect(html).toContain('SUPERMERCATO CENTRALE')
    expect(html).toContain('-45,30 €')
    expect(html).toContain('Cerca su internet')
    expect(html).toContain('Overflow')
    expect(html).toContain('Dati card content')
    expect(html).not.toContain('Categoria card content')
    expect(html).not.toContain('Collegamenti card content')
  })

  test('renders all five card slots in fixed DOM order when all provided', () => {
    const html = renderToStaticMarkup(
      <DetailPageShell
        backHref="/expenses"
        title="Spesa settimanale"
        datiCard={<div>Dati card content</div>}
        categoriaCard={<div>Categoria card content</div>}
        collegamentiCard={<div>Collegamenti card content</div>}
        riepilogoCard={<div>Riepilogo card content</div>}
        transactionsCard={<div>Transactions card content</div>}
      />,
    )

    const indices = [
      'Dati card content',
      'Categoria card content',
      'Collegamenti card content',
      'Riepilogo card content',
      'Transactions card content',
    ].map((marker) => html.indexOf(marker))

    for (const idx of indices) {
      expect(idx).toBeGreaterThan(-1)
    }
    // Fixed order: datiCard, categoriaCard, collegamentiCard, riepilogoCard, transactionsCard
    for (let i = 1; i < indices.length; i += 1) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1])
    }
  })

  test('renders a back link to backHref', () => {
    const html = renderToStaticMarkup(
      <DetailPageShell backHref="/transactions" title="Titolo" />,
    )

    expect(html).toContain('href="/transactions"')
  })
})

describe('route builders', () => {
  test('transactionDetailHref builds an encoded transactions detail path', () => {
    expect(transactionDetailHref('abc')).toBe('/transactions/abc')
  })

  test('expenseDetailHref builds an encoded expenses detail path', () => {
    expect(expenseDetailHref('abc')).toBe('/expenses/abc')
  })

  test('both href builders encode special characters in the id', () => {
    expect(transactionDetailHref('a/b')).toBe('/transactions/a%2Fb')
    expect(expenseDetailHref('a/b')).toBe('/expenses/a%2Fb')
  })
})
