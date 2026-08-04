import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { CategoryDetailAmountsChart } from '@/components/dashboard/category-detail-amounts-chart'
import type { CategoryDetailYearWindowData } from '@/lib/dal/category-detail-year-window'

function buildFixture(overrides?: Partial<CategoryDetailYearWindowData>): CategoryDetailYearWindowData {
  return {
    category: { id: 1, name: 'Alimentari & Ristorazione', slug: 'alimentari-ristorazione', type: 'out' },
    year: 2026,
    view: 'ytd',
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
    pace: null,
    projection: null,
    subcategories: [],
    topTransactions: [],
    ...overrides,
  }
}

function buildProjectionFixture(): CategoryDetailYearWindowData {
  return buildFixture({
    view: 'projection',
    pace: '406.00',
    projection: '4872.00',
    current: {
      months: [
        { yearMonth: '2026-01', label: 'gen', amount: '412.50', state: 'covered', monthOverMonthDelta: null },
        { yearMonth: '2026-02', label: 'feb', amount: '388.20', state: 'covered', monthOverMonthDelta: '-24.30' },
        { yearMonth: '2026-03', label: 'mar', amount: null, state: 'uncovered', monthOverMonthDelta: null },
        { yearMonth: '2026-04', label: 'apr', amount: '455.80', state: 'covered', monthOverMonthDelta: null },
        { yearMonth: '2026-05', label: 'mag', amount: '401.10', state: 'covered', monthOverMonthDelta: '-54.70' },
        { yearMonth: '2026-06', label: 'giu', amount: '372.40', state: 'covered', monthOverMonthDelta: '-28.70' },
        { yearMonth: '2026-07', label: 'lug', amount: '480.30', state: 'current', monthOverMonthDelta: '107.90' },
        { yearMonth: '2026-08', label: 'ago', amount: '406.00', state: 'estimated', monthOverMonthDelta: null },
        { yearMonth: '2026-09', label: 'set', amount: '406.00', state: 'estimated', monthOverMonthDelta: null },
        { yearMonth: '2026-10', label: 'ott', amount: '406.00', state: 'estimated', monthOverMonthDelta: null },
        { yearMonth: '2026-11', label: 'nov', amount: '406.00', state: 'estimated', monthOverMonthDelta: null },
        { yearMonth: '2026-12', label: 'dic', amount: '406.00', state: 'estimated', monthOverMonthDelta: null },
      ],
      total: '4540.30',
      average: '412.75',
      coveredMonthCountInWindow: 11,
      uncoveredMonthLabels: ['mar'],
    },
  })
}

describe('CategoryDetailAmountsChart (CDET-VIEW-01, 260804-br9 Task 2)', () => {
  test('renders exactly one bar-column per data.current.months entry, each carrying data-month/data-state — 3-month (ytd-shaped) fixture', () => {
    const html = renderToStaticMarkup(<CategoryDetailAmountsChart data={buildFixture()} />)

    expect(html).toContain('data-month="2026-01"')
    expect(html).toContain('data-month="2026-02"')
    expect(html).toContain('data-month="2026-03"')
    expect(html).toContain('data-state="covered"')
    expect(html).toContain('data-state="uncovered"')
    expect((html.match(/data-month="/g) ?? []).length).toBe(3)
  })

  test('renders exactly one bar-column per data.current.months entry — 12-month (projection-shaped) fixture', () => {
    const html = renderToStaticMarkup(<CategoryDetailAmountsChart data={buildProjectionFixture()} />)

    expect((html.match(/data-month="/g) ?? []).length).toBe(12)
    expect(html).toContain('data-state="current"')
    expect(html).toContain('data-state="estimated"')
  })

  test("an 'uncovered' month never crashes, never renders a numeric amount for that column, and carries the uncovered hatch signature", () => {
    const html = renderToStaticMarkup(<CategoryDetailAmountsChart data={buildFixture()} />)

    expect(html).toContain('repeating-linear-gradient(45deg')
    // The uncovered column's tooltip states "non importato", never a formatted amount.
    expect(html).toContain('non importato')
  })

  test("an 'estimated' month renders the pace amount in its tooltip and carries the estimated hatch signature", () => {
    const html = renderToStaticMarkup(<CategoryDetailAmountsChart data={buildProjectionFixture()} />)

    expect(html).toContain('repeating-linear-gradient(135deg')
    expect(html).toContain('(proiezione)')
    expect(html).toMatch(/406,00.*\(proiezione\)|ago 2026.*406,00/)
  })

  test('renders zero <svg elements', () => {
    const html = renderToStaticMarkup(<CategoryDetailAmountsChart data={buildProjectionFixture()} />)
    expect(html).not.toContain('<svg')
  })

  test('renders zero delta/comparison vocabulary words', () => {
    const html = renderToStaticMarkup(<CategoryDetailAmountsChart data={buildProjectionFixture()} />)
    expect(html).not.toMatch(/in più|in meno|invariato/)
  })
})
