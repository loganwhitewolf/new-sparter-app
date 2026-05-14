import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import type * as React from 'react'
import type { CategoryRankingItem } from '@/lib/dal/dashboard'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}))

const { CategoryRankingList } = await import('@/components/dashboard/category-ranking-list')

const baseCategory: CategoryRankingItem = {
  id: 42,
  name: 'Categoria con un nome molto lungo che deve rimanere leggibile',
  slug: 'long-category-name',
  type: 'out',
  count: 3,
  amount: '1234.50',
  percentage: 67,
  sparkline: [
    { month: '2026-01', label: 'Gen', amount: '0.00' },
    { month: '2026-02', label: 'Feb', amount: '0.00' },
    { month: '2026-03', label: 'Mar', amount: '0.00' },
  ],
}

describe('CategoryRankingList', () => {
  test('renders a useful empty state for no categories', () => {
    const html = renderToStaticMarkup(
      <CategoryRankingList data={[]} preset="this-year" type="out" />
    )

    expect(html).toContain('Nessuna categoria nel periodo selezionato')
  })

  test('builds default outgoing category links without redundant query params', () => {
    const html = renderToStaticMarkup(
      <CategoryRankingList data={[baseCategory]} preset="this-year" type="out" />
    )

    expect(html).toContain('href="/dashboard/categories/42"')
    expect(html).toContain('title="Categoria con un nome molto lungo che deve rimanere leggibile"')
  })

  test('preserves income type and non-default preset in category links', () => {
    const html = renderToStaticMarkup(
      <CategoryRankingList
        data={[{ ...baseCategory, type: 'in' }]}
        preset="last-3-months"
        type="in"
      />
    )

    expect(html).toContain('href="/dashboard/categories/42?preset=last-3-months&amp;type=in"')
  })

  test('renders all-zero sparklines without throwing', () => {
    const html = renderToStaticMarkup(
      <CategoryRankingList data={[baseCategory]} preset="this-year" type="out" />
    )

    expect(html).toContain('aria-label="Andamento mensile Categoria con un nome molto lungo che deve rimanere leggibile"')
    expect(html).toContain('<polyline')
  })
})
