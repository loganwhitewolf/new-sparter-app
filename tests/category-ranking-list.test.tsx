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
  test('renders DeviationBadge when deviations map provides a value for the category', () => {
    const deviations = new Map([[42, { deviation: 45, isNew: false, belowNoiseThreshold: false }]])
    const html = renderToStaticMarkup(
      <CategoryRankingList data={[baseCategory]} preset="this-year" type="out" sort="amount" deviations={deviations} />
    )
    expect(html).toContain('+45%')
    expect(html).toContain('text-destructive')
  })

  test('omits the DeviationBadge when deviation is null (noise threshold)', () => {
    const deviations = new Map([[42, { deviation: null, isNew: false, belowNoiseThreshold: true }]])
    const html = renderToStaticMarkup(
      <CategoryRankingList data={[baseCategory]} preset="this-year" type="out" sort="amount" deviations={deviations} />
    )
    expect(html).not.toMatch(/[+\-]\d+%/)
    expect(html).not.toContain('text-destructive')
    expect(html).not.toContain('text-emerald-600')
  })

  test('reorders rows by absolute deviation when sort=deviation', () => {
    const items = [
      { ...baseCategory, id: 1, name: 'Small dev', amount: '500.00' },
      { ...baseCategory, id: 2, name: 'Big dev', amount: '100.00' },
      { ...baseCategory, id: 3, name: 'No data', amount: '999.00' },
    ]
    const deviations = new Map([
      [1, { deviation: 10, isNew: false, belowNoiseThreshold: false }],
      [2, { deviation: -80, isNew: false, belowNoiseThreshold: false }],
      [3, { deviation: null, isNew: false, belowNoiseThreshold: true }],
    ])
    const html = renderToStaticMarkup(
      <CategoryRankingList data={items} preset="this-year" type="out" sort="deviation" deviations={deviations} />
    )
    expect(html.indexOf('Big dev')).toBeLessThan(html.indexOf('Small dev'))
    expect(html.indexOf('Small dev')).toBeLessThan(html.indexOf('No data'))
  })

  test("places 'new' rows between numeric and null buckets when sort=deviation", () => {
    const items = [
      { ...baseCategory, id: 10, name: 'Numeric' },
      { ...baseCategory, id: 11, name: 'New entry' },
      { ...baseCategory, id: 12, name: 'Null entry' },
    ]
    const deviations = new Map([
      [10, { deviation: 5, isNew: false, belowNoiseThreshold: false }],
      [11, { deviation: null, isNew: true, belowNoiseThreshold: false }],
      [12, { deviation: null, isNew: false, belowNoiseThreshold: true }],
    ])
    const html = renderToStaticMarkup(
      <CategoryRankingList data={items} preset="this-year" type="out" sort="deviation" deviations={deviations} />
    )
    expect(html.indexOf('Numeric')).toBeLessThan(html.indexOf('New entry'))
    expect(html.indexOf('New entry')).toBeLessThan(html.indexOf('Null entry'))
  })

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
