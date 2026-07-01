import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    useActionState: vi.fn(() => [{ error: null }, vi.fn(), false]),
  }
})

const { TransactionTitleEdit } = await import(
  '../components/transactions/transaction-title-edit'
)

const TX_ID = '11111111-1111-4111-8111-111111111111'

describe('TransactionTitleEdit', () => {
  it('shows customTitle when set, regardless of fallbackTitle/description', () => {
    const html = renderToStaticMarkup(
      createElement(TransactionTitleEdit, {
        id: TX_ID,
        description: 'PAGAMENTO POS BAR ROMA',
        customTitle: 'Caffè con Marco',
        fallbackTitle: 'Rimborso YouTube',
      }),
    )

    expect(html).toContain('Caffè con Marco')
    expect(html).not.toContain('Rimborso YouTube')
  })

  it('falls back to the expense title (fallbackTitle) when customTitle is absent — STEXP display fix', () => {
    const html = renderToStaticMarkup(
      createElement(TransactionTitleEdit, {
        id: TX_ID,
        description: 'BONIFICO SEPA DA MARIO ROSSI',
        customTitle: null,
        fallbackTitle: 'Rimborso YouTube',
      }),
    )

    expect(html).toContain('Rimborso YouTube')
    expect(html).not.toContain('BONIFICO SEPA DA MARIO ROSSI')
  })

  it('falls back to the raw description when both customTitle and fallbackTitle are absent', () => {
    const html = renderToStaticMarkup(
      createElement(TransactionTitleEdit, {
        id: TX_ID,
        description: 'BONIFICO SEPA DA MARIO ROSSI',
        customTitle: null,
        fallbackTitle: null,
      }),
    )

    expect(html).toContain('BONIFICO SEPA DA MARIO ROSSI')
  })

  it('keeps the "Originale" caption showing the true raw description, not fallbackTitle, when customTitle is set', () => {
    const html = renderToStaticMarkup(
      createElement(TransactionTitleEdit, {
        id: TX_ID,
        description: 'BONIFICO SEPA DA MARIO ROSSI',
        customTitle: 'Caffè con Marco',
        fallbackTitle: 'Rimborso YouTube',
      }),
    )

    expect(html).toContain('Originale: BONIFICO SEPA DA MARIO ROSSI')
    expect(html).not.toContain('Originale: Rimborso YouTube')
  })
})
