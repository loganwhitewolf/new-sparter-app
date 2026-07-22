import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const { TransactionBulkActionBar } = await import(
  '../components/transactions/transaction-bulk-action-bar'
)

describe('TransactionBulkActionBar', () => {
  it('shows categorize and delete actions when rows are selected', () => {
    const html = renderToStaticMarkup(
      createElement(TransactionBulkActionBar, {
        selectedIds: ['tx-1', 'tx-2'],
        canBulkCategorize: true,
        onBulkCategorize: vi.fn(),
        onBulkAssignTags: vi.fn(),
        onBulkDelete: vi.fn(),
      }),
    )

    expect(html).toContain('2')
    expect(html).toContain('selezionate')
    expect(html).toContain('Categorizza (2)')
    expect(html).toContain('Elimina (2)')
  })

  it('disables categorize when no linked expense is available', () => {
    const html = renderToStaticMarkup(
      createElement(TransactionBulkActionBar, {
        selectedIds: ['tx-1'],
        canBulkCategorize: false,
        onBulkCategorize: vi.fn(),
        onBulkAssignTags: vi.fn(),
        onBulkDelete: vi.fn(),
      }),
    )

    expect(html).toContain('disabled=""')
    expect(html).toContain('Categorizza (1)')
  })

  it('shows the Assegna tag action, always enabled', () => {
    const html = renderToStaticMarkup(
      createElement(TransactionBulkActionBar, {
        selectedIds: ['tx-1', 'tx-2'],
        canBulkCategorize: false,
        onBulkCategorize: vi.fn(),
        onBulkAssignTags: vi.fn(),
        onBulkDelete: vi.fn(),
      }),
    )

    expect(html).toContain('Assegna tag (2)')
    const assegnaTagButtonMatch = html.match(/<button[^>]*>Assegna tag \(2\)<\/button>/)
    expect(assegnaTagButtonMatch).not.toBeNull()
    expect(assegnaTagButtonMatch?.[0]).not.toContain('disabled=""')
  })
})
