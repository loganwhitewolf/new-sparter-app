import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { CategoryDetailTable } from '@/components/dashboard/category-detail-table'
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

describe('CategoryDetailTable (D-06/D-10, Task 1)', () => {
  test("an 'uncovered' month renders literal 'non importato' text and no amount", () => {
    const html = renderToStaticMarkup(<CategoryDetailTable data={buildFixture()} />)

    expect(html).toContain('non importato')
    // The uncovered month title carries the D-10 rationale.
    expect(html).toContain('Mese non importato: escluso dalle medie')
  })

  test('a covered index-1 month whose predecessor is covered shows the exact delta text', () => {
    const html = renderToStaticMarkup(<CategoryDetailTable data={buildFixture()} />)

    expect(html).toContain('350,00')
    expect(html).toContain('50,00')
    expect(html).toContain('in meno')
  })

  test("index 0 never carries a delta line — no 'nessun confronto' or word for the first column", () => {
    const html = renderToStaticMarkup(
      <CategoryDetailTable
        data={buildFixture({
          current: {
            months: [
              { yearMonth: '2026-01', label: 'gen', amount: '400.00', state: 'covered', monthOverMonthDelta: null },
            ],
            total: '400.00',
            average: '400.00',
            coveredMonthCountInWindow: 1,
            uncoveredMonthLabels: [],
          },
          window: { months: 3, from: '2026-01' },
        })}
      />,
    )

    expect(html).toContain('400,00')
    expect(html).not.toContain('nessun confronto')
  })

  test('an estimated month renders its pace value with no delta line', () => {
    const html = renderToStaticMarkup(
      <CategoryDetailTable
        data={buildFixture({
          current: {
            months: [
              { yearMonth: '2026-01', label: 'gen', amount: '400.00', state: 'covered', monthOverMonthDelta: null },
              { yearMonth: '2026-02', label: 'feb', amount: '406.00', state: 'estimated', monthOverMonthDelta: null },
            ],
            total: '806.00',
            average: '403.00',
            coveredMonthCountInWindow: 2,
            uncoveredMonthLabels: [],
          },
        })}
      />,
    )

    expect(html).toContain('406,00')
    expect(html).not.toContain('nessun confronto')
  })

  test("a covered/current month with a null delta (predecessor not real) renders 'nessun confronto'", () => {
    const html = renderToStaticMarkup(
      <CategoryDetailTable
        data={buildFixture({
          current: {
            months: [
              { yearMonth: '2026-01', label: 'gen', amount: null, state: 'uncovered', monthOverMonthDelta: null },
              { yearMonth: '2026-02', label: 'feb', amount: '455.80', state: 'covered', monthOverMonthDelta: null },
            ],
            total: '455.80',
            average: '455.80',
            coveredMonthCountInWindow: 1,
            uncoveredMonthLabels: ['gen'],
          },
        })}
      />,
    )

    expect(html).toContain('nessun confronto')
  })

  test('the summary column carries the D-10 reduced-denominator qualifiers when coverage is short', () => {
    const html = renderToStaticMarkup(<CategoryDetailTable data={buildFixture()} />)

    expect(html).toContain('su 2 mesi coperti')
    expect(html).toContain('Mese non importato: mar')
  })

  test('the summary column omits the qualifiers when the window is fully covered', () => {
    const html = renderToStaticMarkup(
      <CategoryDetailTable
        data={buildFixture({
          current: {
            months: [
              { yearMonth: '2026-01', label: 'gen', amount: '400.00', state: 'covered', monthOverMonthDelta: null },
            ],
            total: '400.00',
            average: '400.00',
            coveredMonthCountInWindow: 1,
            uncoveredMonthLabels: [],
          },
        })}
      />,
    )

    expect(html).not.toContain('mesi coperti')
  })
})

describe('CategoryDetailTable — previous-year row and Differenza row (D-11/D-12/CDET-02/CDET-04/CDET-07, Task 2)', () => {
  test('a previousYear: unavailable fixture renders a stated-reason line and zero per-month amounts in that row, and no Differenza row at all', () => {
    const html = renderToStaticMarkup(<CategoryDetailTable data={buildFixture()} />)

    expect(html).toContain('Nessun mese coperto nel 2025 per questa finestra')
    expect(html).not.toContain('Differenza')
  })

  test('a previousYear: available fixture renders row 2 as plain amounts with no delta line', () => {
    const html = renderToStaticMarkup(
      <CategoryDetailTable
        data={buildFixture({
          previousYear: {
            status: 'available',
            series: {
              months: [
                { yearMonth: '2025-01', label: 'gen', amount: '380.00', state: 'covered' },
                { yearMonth: '2025-02', label: 'feb', amount: '320.00', state: 'covered' },
                { yearMonth: '2025-03', label: 'mar', amount: null, state: 'uncovered' },
              ],
              total: '700.00',
              average: '350.00',
              coveredMonthCountInWindow: 2,
            },
            totalDifference: { status: 'shown', value: '50.00' },
            averageDifference: '25.00',
            rawTotalDifference: { status: 'shown', value: '50.00' },
          },
        })}
      />,
    )

    expect(html).toContain('2025 (stessa finestra)')
    expect(html).toContain('380,00')
    expect(html).toContain('320,00')
    expect(html).toContain('non importato')
  })

  test("a totalDifference: {status:'insufficient', coveredMonthCount:3} fixture renders a stated reason containing '3' in the Totale cell AND a real magnitude+word value in the Media cell", () => {
    const html = renderToStaticMarkup(
      <CategoryDetailTable
        data={buildFixture({
          previousYear: {
            status: 'available',
            series: {
              months: [
                { yearMonth: '2025-01', label: 'gen', amount: '380.00', state: 'covered' },
                { yearMonth: '2025-02', label: 'feb', amount: '320.00', state: 'covered' },
                { yearMonth: '2025-03', label: 'mar', amount: '300.00', state: 'covered' },
              ],
              total: '1000.00',
              average: '333.33',
              coveredMonthCountInWindow: 3,
            },
            totalDifference: { status: 'insufficient', coveredMonthCount: 3 },
            averageDifference: '41.67',
            rawTotalDifference: { status: 'insufficient', coveredMonthCount: 3 },
          },
        })}
      />,
    )

    expect(html).toContain('Differenza')
    expect(html).toContain('Dati insufficienti nel 2025: 3 mesi')
    expect(html).toContain('41,67')
    expect(html).toContain('in più')
  })

  test('a totalDifference: shown fixture renders a real magnitude+word value labelled "Rispetto al 2025" for both Totale and Media', () => {
    const html = renderToStaticMarkup(
      <CategoryDetailTable
        data={buildFixture({
          previousYear: {
            status: 'available',
            series: {
              months: [
                { yearMonth: '2025-01', label: 'gen', amount: '380.00', state: 'covered' },
                { yearMonth: '2025-02', label: 'feb', amount: '320.00', state: 'covered' },
                { yearMonth: '2025-03', label: 'mar', amount: '300.00', state: 'covered' },
              ],
              total: '1000.00',
              average: '333.33',
              coveredMonthCountInWindow: 3,
            },
            totalDifference: { status: 'shown', value: '-250.00' },
            averageDifference: '41.67',
            rawTotalDifference: { status: 'shown', value: '-250.00' },
          },
        })}
      />,
    )

    expect(html.match(/Rispetto al 2025/g)?.length).toBe(2)
    expect(html).toContain('250,00')
    expect(html).toContain('in meno')
  })
})
