import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const { BulkActionBar } = await import('../components/expenses/bulk-action-bar')

describe('BulkActionBar — Unisci button (GRP-01)', () => {
  it('renders the Unisci button labeled with the selection count when onBulkMerge is passed', () => {
    const html = renderToStaticMarkup(
      createElement(BulkActionBar, {
        selectedIds: ['exp-1', 'exp-2'],
        onBulkCategorize: vi.fn(),
        onBulkDelete: vi.fn(),
        onBulkMerge: vi.fn(),
      }),
    )

    expect(html).toContain('Unisci (2)')
  })

  it('omits the Unisci button entirely when onBulkMerge is not passed', () => {
    const html = renderToStaticMarkup(
      createElement(BulkActionBar, {
        selectedIds: ['exp-1', 'exp-2'],
        onBulkCategorize: vi.fn(),
        onBulkDelete: vi.fn(),
      }),
    )

    expect(html).not.toContain('Unisci')
  })

  it('still renders Categorizza and Elimina buttons alongside Unisci', () => {
    const html = renderToStaticMarkup(
      createElement(BulkActionBar, {
        selectedIds: ['exp-1', 'exp-2'],
        onBulkCategorize: vi.fn(),
        onBulkDelete: vi.fn(),
        onBulkMerge: vi.fn(),
      }),
    )

    expect(html).toContain('Categorizza (2)')
    expect(html).toContain('Elimina (2)')
  })
})
