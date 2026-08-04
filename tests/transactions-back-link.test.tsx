import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import { TransactionsBackLink } from '@/components/transactions/transactions-back-link'

// Mirrors tests/detail-page-shell.test.tsx's own next/navigation mock.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}))

describe('TransactionsBackLink', () => {
  test('renders a real navigable <a> to backHref with the "Torna indietro" label', () => {
    const html = renderToStaticMarkup(
      <TransactionsBackLink backHref="/dashboard/categories/7?year=2026" />,
    )

    expect(html).toContain('href="/dashboard/categories/7?year=2026"')
    expect(html).toContain('Torna indietro')
  })
})
