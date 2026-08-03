import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import type * as React from 'react'
import type { CategoryYearRankingItem, CategoryYearSparklinePoint } from '@/lib/dal/dashboard'
import { resolveCategoryDirectionCopy } from '@/lib/services/category-direction-copy'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}))

const { CategoryRankingList, compareByProjection } = await import(
  '@/components/dashboard/category-ranking-list'
)

function buildSparkline(state: CategoryYearSparklinePoint['state'] = 'covered'): CategoryYearSparklinePoint[] {
  return Array.from({ length: 12 }).map((_, index) => ({
    month: `2026-${String(index + 1).padStart(2, '0')}`,
    label: String(index + 1),
    amount: '0.00',
    state,
  }))
}

const baseCategory: CategoryYearRankingItem = {
  id: 42,
  name: 'Categoria con un nome molto lungo che deve rimanere leggibile',
  slug: 'long-category-name',
  type: 'out',
  count: 3,
  amount: '1200.00',
  percentage: 40,
  sparkline: buildSparkline(),
  projection: '1500.00',
  pace: '125.00',
}

const outCopy = resolveCategoryDirectionCopy('out')

describe('CategoryRankingList', () => {
  test('renders the five D-04 fields: name, total, share, sparkline, subordinate projection', () => {
    const html = renderToStaticMarkup(
      <CategoryRankingList data={[baseCategory]} year={2026} direction="out" sort="amount" copy={outCopy} />
    )

    expect(html).toContain(baseCategory.name)
    expect(html).toContain('40% del totale')
    expect(html).toContain('Totale')
    expect(html).toContain('1200,00')
    expect(html).toContain('A questo passo')
    expect(html).toContain('1500,00')
    expect(html).toContain('role="img"')
  })

  test('renders NO "A questo passo" label or value when projection is null', () => {
    const category = { ...baseCategory, projection: null }
    const html = renderToStaticMarkup(
      <CategoryRankingList data={[category]} year={2026} direction="out" sort="amount" copy={outCopy} />
    )

    expect(html).not.toContain('A questo passo')
    expect(html).not.toMatch(/A questo passo[^<]*—/)
  })

  test("row href carries the SAME year via buildDashboardCategoryDetailHref(id, { year, type, lens })", () => {
    const category = { ...baseCategory, id: 7 }
    const html = renderToStaticMarkup(
      <CategoryRankingList data={[category]} year={2026} direction="in" sort="amount" copy={resolveCategoryDirectionCopy('in')} />
    )

    expect(html).toContain('href="/dashboard/categories/7?year=2026&amp;type=in"')
  })

  test('an allocation-direction row renders no anchor element while out/in rows keep their existing link (CR-01 NEW guard)', () => {
    const outHtml = renderToStaticMarkup(
      <CategoryRankingList
        data={[{ ...baseCategory, id: 10 }]}
        year={2026}
        direction="out"
        sort="amount"
        copy={resolveCategoryDirectionCopy('out')}
      />
    )
    expect(outHtml).toContain('<a')
    expect(outHtml).toContain('/dashboard/categories/10?year=2026"')

    const inHtml = renderToStaticMarkup(
      <CategoryRankingList
        data={[{ ...baseCategory, id: 11 }]}
        year={2026}
        direction="in"
        sort="amount"
        copy={resolveCategoryDirectionCopy('in')}
      />
    )
    expect(inHtml).toContain('<a')
    expect(inHtml).toContain('/dashboard/categories/11?year=2026&amp;type=in')

    const allocationHtml = renderToStaticMarkup(
      <CategoryRankingList
        data={[{ ...baseCategory, id: 12 }]}
        year={2026}
        direction="allocation"
        sort="amount"
        copy={resolveCategoryDirectionCopy('allocation')}
      />
    )
    expect(allocationHtml).not.toContain('<a')
    expect(allocationHtml).toContain(baseCategory.name)
    expect(allocationHtml).toContain('Totale')
    expect(allocationHtml).toContain(`aria-label="Andamento mensile ${baseCategory.name}"`)
    expect(allocationHtml).toContain('aria-disabled="true"')
    expect(allocationHtml).not.toContain('type=allocation')
  })

  test('sorting by projection reorders rows, falling back to amount for a null projection', () => {
    const items: CategoryYearRankingItem[] = [
      { ...baseCategory, id: 1, name: 'Row A', amount: '100.00', projection: '50.00' },
      { ...baseCategory, id: 2, name: 'Row B', amount: '50.00', projection: '200.00' },
      { ...baseCategory, id: 3, name: 'Row C', amount: '80.00', projection: null },
    ]

    expect(() =>
      renderToStaticMarkup(
        <CategoryRankingList data={items} year={2026} direction="out" sort="projection" copy={outCopy} />
      )
    ).not.toThrow()

    const html = renderToStaticMarkup(
      <CategoryRankingList data={items} year={2026} direction="out" sort="projection" copy={outCopy} />
    )

    const indexB = html.indexOf('Row B')
    const indexA = html.indexOf('Row A')
    const indexC = html.indexOf('Row C')
    // 200 (Row B) > 80 (Row C, falls back to its own amount) > 50 (Row A)
    expect(indexB).toBeLessThan(indexC)
    expect(indexC).toBeLessThan(indexA)
  })

  test('compareByProjection never crashes on a null projection and falls back to amount', () => {
    const a: CategoryYearRankingItem = { ...baseCategory, id: 1, amount: '100.00', projection: '50.00' }
    const b: CategoryYearRankingItem = { ...baseCategory, id: 2, amount: '80.00', projection: null }
    expect(() => compareByProjection(a, b)).not.toThrow()
    // b (falls back to 80) should sort BEFORE a (50) — positive comparedTo means b > a
    expect(compareByProjection(a, b)).toBeGreaterThan(0)
  })

  test('renders the per-direction empty state (not a blank container) with zero rows', () => {
    const html = renderToStaticMarkup(
      <CategoryRankingList data={[]} year={2026} direction="in" sort="amount" copy={resolveCategoryDirectionCopy('in')} />
    )

    expect(html).toContain('Nessuna entrata')
    expect(html).toContain('2026')
  })

  test('resolves the percentage bar colour per direction (allocation uses --total-allocation)', () => {
    const html = renderToStaticMarkup(
      <CategoryRankingList
        data={[baseCategory]}
        year={2026}
        direction="allocation"
        sort="amount"
        copy={resolveCategoryDirectionCopy('allocation')}
      />
    )

    expect(html).toContain('bg-[var(--total-allocation)]')
  })

  test('renders all-zero sparklines without throwing', () => {
    const html = renderToStaticMarkup(
      <CategoryRankingList data={[baseCategory]} year={2026} direction="out" sort="amount" copy={outCopy} />
    )

    expect(html).toContain(
      `aria-label="Andamento mensile ${baseCategory.name}"`
    )
  })
})
