import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { CategoryDetailDifferenceChart } from '@/components/dashboard/category-detail-difference-chart'
import type { CategoryDetailYearWindowData } from '@/lib/dal/category-detail-year-window'

function buildFixture(overrides?: Partial<CategoryDetailYearWindowData>): CategoryDetailYearWindowData {
  return {
    category: { id: 1, name: 'Alimentari & Ristorazione', slug: 'alimentari-ristorazione', type: 'out' },
    window: { months: 3, from: '2026-01' },
    current: {
      months: [
        { yearMonth: '2026-01', label: 'gen', amount: '400.00', state: 'covered', monthOverMonthDelta: null },
        { yearMonth: '2026-02', label: 'feb', amount: '350.00', state: 'covered', monthOverMonthDelta: '-50.00' },
        { yearMonth: '2026-03', label: 'mar', amount: null, state: 'uncovered', monthOverMonthDelta: null },
      ],
      total: '750.00',
      average: '375.00',
      coveredMonthCountInWindow: 2,
      uncoveredMonthLabels: ['mar'],
    },
    previousYear: { status: 'unavailable' },
    pace: '375.00',
    projection: '4500.00',
    subcategories: [],
    topTransactions: [],
    ...overrides,
  }
}

describe('CategoryDetailDifferenceChart (D-08/D-09, Task 3)', () => {
  test('renders zero occurrences of sign glyphs adjacent to an amount', () => {
    const html = renderToStaticMarkup(
      <CategoryDetailDifferenceChart
        data={buildFixture({
          previousYear: {
            status: 'available',
            series: {
              months: [
                { yearMonth: '2026-01', label: 'gen', amount: '380.00', state: 'covered' },
                { yearMonth: '2026-02', label: 'feb', amount: '390.00', state: 'covered' },
                { yearMonth: '2026-03', label: 'mar', amount: null, state: 'uncovered' },
              ],
              total: '770.00',
              average: '385.00',
              coveredMonthCountInWindow: 2,
            },
            totalDifference: { status: 'shown', value: '-20.00' },
            averageDifference: '-10.00',
            rawTotalDifference: { status: 'shown', value: '-20.00' },
          },
        })}
      />,
    )

    expect(html).not.toMatch(/[▲▼]/)
    // A sign glyph attached to a FORMATTED AMOUNT (e.g. "-107,90" or "+40,00") — not a blanket
    // digit check, which would also flag unrelated Tailwind utility classes like `space-y-3`.
    expect(html).not.toMatch(/[+-]\d{1,3}(\.\d{3})*,\d{2}/)
  })

  test('a previousYear: unavailable fixture renders a flat marker for every month, never a thrown error or an omitted column', () => {
    const html = renderToStaticMarkup(<CategoryDetailDifferenceChart data={buildFixture()} />)

    expect((html.match(/<rect/g) ?? []).length).toBe(3)
    expect(html).toContain('gen')
    expect(html).toContain('feb')
    expect(html).toContain('mar')
  })

  test('renders a tooltip with magnitude + word for a real delta', () => {
    const html = renderToStaticMarkup(
      <CategoryDetailDifferenceChart
        data={buildFixture({
          previousYear: {
            status: 'available',
            series: {
              months: [
                { yearMonth: '2026-01', label: 'gen', amount: '292.10', state: 'covered' },
                { yearMonth: '2026-02', label: 'feb', amount: '390.00', state: 'covered' },
                { yearMonth: '2026-03', label: 'mar', amount: null, state: 'uncovered' },
              ],
              total: '682.10',
              average: '341.05',
              coveredMonthCountInWindow: 2,
            },
            totalDifference: { status: 'shown', value: '67.90' },
            averageDifference: '33.95',
            rawTotalDifference: { status: 'shown', value: '67.90' },
          },
        })}
      />,
    )

    expect(html).toContain('107,90')
    expect(html).toContain('in più di gen 2025')
  })

  test('renders a legend line stating what above/below means for this category direction', () => {
    const html = renderToStaticMarkup(<CategoryDetailDifferenceChart data={buildFixture()} />)
    expect(html).toContain('Sopra la linea')
    expect(html).toContain('Sotto')
  })
})
