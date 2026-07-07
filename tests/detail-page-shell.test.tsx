import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import {
  attachPopstateRefresh,
  DetailPageShell,
  hasInAppHistory,
} from '@/components/detail-pages/detail-page-shell'
import { expenseDetailHref, importFileDetailHref, transactionDetailHref } from '@/lib/routes'

// DetailPageShell's smart-back control (D-08) calls useRouter from next/navigation.
// Pattern matches tests/transaction-table-menu.test.tsx / tests/data-table-toolbar.test.tsx.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}))

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

  test('renders a back link to backHref for the file detail page fallback route (D-08 applies to all three detail pages)', () => {
    const html = renderToStaticMarkup(
      <DetailPageShell backHref="/import" title="report.csv" />,
    )

    expect(html).toContain('href="/import"')
  })

  test('header title wrapper carries the .group class so the inline-edit pencil can reveal on hover (CR-01)', () => {
    const html = renderToStaticMarkup(
      <DetailPageShell backHref="/import" title="report.csv" />,
    )

    expect(html).toContain('class="group min-w-0 flex-1"')
  })

  test('two-column layout renders lg grid and places azioniCard in the sidebar column', () => {
    const html = renderToStaticMarkup(
      <DetailPageShell
        backHref="/transactions"
        title="Titolo"
        layout="two-column"
        datiCard={<div>Dati card content</div>}
        categoriaCard={<div>Categoria card content</div>}
        collegamentiCard={<div>Collegamenti card content</div>}
        azioniCard={<div>Azioni card content</div>}
      />,
    )

    expect(html).toContain('lg:grid-cols-5')
    expect(html).toContain('lg:col-span-3')
    expect(html).toContain('lg:col-span-2')
    expect(html).toContain('Azioni card content')

    const datiIdx = html.indexOf('Dati card content')
    const azioniIdx = html.indexOf('Azioni card content')
    expect(datiIdx).toBeGreaterThan(-1)
    expect(azioniIdx).toBeGreaterThan(datiIdx)
  })

  test('file-detail layout places collegamenti on row 1 and stacks riepilogo with azioni beside transactions', () => {
    const html = renderToStaticMarkup(
      <DetailPageShell
        backHref="/import"
        title="report.csv"
        layout="file-detail"
        datiCard={<div>Dati card content</div>}
        collegamentiCard={<div>Collegamenti card content</div>}
        azioniCard={<div>Azioni card content</div>}
        riepilogoCard={<div>Riepilogo card content</div>}
        transactionsCard={<div>Transactions card content</div>}
      />,
    )

    expect(html).toContain('lg:grid-cols-5')
    expect(html).toContain('lg:row-start-2')

    const indices = [
      'Dati card content',
      'Collegamenti card content',
      'Riepilogo card content',
      'Azioni card content',
      'Transactions card content',
    ].map((marker) => html.indexOf(marker))

    for (const idx of indices) {
      expect(idx).toBeGreaterThan(-1)
    }
    for (let i = 1; i < indices.length; i += 1) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1])
    }
  })
})

describe('route builders', () => {
  test('transactionDetailHref builds an encoded transactions detail path', () => {
    expect(transactionDetailHref('abc')).toBe('/transactions/abc')
  })

  test('expenseDetailHref builds an encoded expenses detail path', () => {
    expect(expenseDetailHref('abc')).toBe('/expenses/abc')
  })

  test('importFileDetailHref builds an encoded import file detail path', () => {
    expect(importFileDetailHref('abc')).toBe('/import/abc')
  })

  test('both href builders encode special characters in the id', () => {
    expect(transactionDetailHref('a/b')).toBe('/transactions/a%2Fb')
    expect(expenseDetailHref('a/b')).toBe('/expenses/a%2Fb')
  })

  test('importFileDetailHref encodes special characters in the id', () => {
    expect(importFileDetailHref('a/b')).toBe('/import/a%2Fb')
  })
})

describe('attachPopstateRefresh', () => {
  test('registers a once-only popstate listener that invokes the callback', () => {
    const target = { addEventListener: vi.fn() }
    const onPopstate = vi.fn()

    attachPopstateRefresh(target, onPopstate)

    expect(target.addEventListener).toHaveBeenCalledTimes(1)
    expect(target.addEventListener).toHaveBeenCalledWith('popstate', expect.any(Function), {
      once: true,
    })

    const registeredHandler = target.addEventListener.mock.calls[0][1] as () => void
    registeredHandler()

    expect(onPopstate).toHaveBeenCalledTimes(1)
  })
})

describe('hasInAppHistory', () => {
  test('returns false when historyLength is 0 (no in-app history)', () => {
    expect(hasInAppHistory(0)).toBe(false)
  })

  test('returns false when historyLength is 1 (fresh tab / directly-opened URL)', () => {
    expect(hasInAppHistory(1)).toBe(false)
  })

  test('returns true when historyLength is 2 (genuine in-app history exists)', () => {
    expect(hasInAppHistory(2)).toBe(true)
  })
})
