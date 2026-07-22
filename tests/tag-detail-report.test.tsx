import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TagDetailReport } from '../components/tags/tag-detail-report'
import type { TagDetail } from '../lib/dal/tags'

/**
 * TagDetailReport static-render smoke test (repo constraint: no jsdom — the report is a pure
 * presentational server component that formats props, so renderToStaticMarkup + createElement
 * covers its structure directly, matching tests/tag-settings-panel.test.tsx).
 */

// Same formatter the component uses — asserting the exact it-IT output (incl. the narrow
// no-break space before €) without hardcoding invisible characters.
const amountFormatter = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })

const fixture: TagDetail = {
  inflow: '1200.00',
  outflow: '450.50',
  net: '749.50',
  count: 2,
  transactions: [
    {
      transactionId: 'tx-1',
      occurredAt: '2026-06-10T00:00:00.000Z',
      subCategoryName: 'Stipendio',
      amount: '1200.00',
    },
    {
      transactionId: 'tx-2',
      occurredAt: '2026-06-05T00:00:00.000Z',
      subCategoryName: 'Ristoranti',
      amount: '-450.50',
    },
  ],
}

describe('TagDetailReport (populated fixture)', () => {
  const html = renderToStaticMarkup(createElement(TagDetailReport, { detail: fixture }))

  it('renders the three KPI labels', () => {
    expect(html).toContain('Entrate')
    expect(html).toContain('Uscite')
    expect(html).toContain('Valore finale')
  })

  it('renders the count line matching the fixture transaction length (TAG-08)', () => {
    expect(html).toContain('2 transazioni incluse')
  })

  it('renders each fixture subcategory name (TAG-10)', () => {
    expect(html).toContain('Stipendio')
    expect(html).toContain('Ristoranti')
  })

  it('renders the it-IT-formatted signed net (TAG-07)', () => {
    expect(html).toContain(amountFormatter.format(749.5))
  })
})

describe('TagDetailReport (empty transactions)', () => {
  const empty: TagDetail = {
    inflow: '0.00',
    outflow: '0.00',
    net: '0.00',
    count: 0,
    transactions: [],
  }
  const html = renderToStaticMarkup(createElement(TagDetailReport, { detail: empty }))

  it('renders the empty-state copy', () => {
    expect(html).toContain('Nessuna transazione inclusa per questo tag.')
  })

  it('renders the plural "0 transazioni incluse" count line', () => {
    expect(html).toContain('0 transazioni incluse')
  })
})
