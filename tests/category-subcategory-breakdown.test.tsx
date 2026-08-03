import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { CategorySubcategoryBreakdown } from '@/components/dashboard/category-subcategory-breakdown'
import type { CategoryDetailSubcategoryContribution } from '@/lib/dal/category-detail-year-window'

const contributions: CategoryDetailSubcategoryContribution[] = [
  {
    id: 1,
    name: 'Spesa quotidiana',
    slug: 'spesa-quotidiana',
    currentAmount: '2480.00',
    previousAmount: '2300.00',
    contribution: '180.00',
    weightPercentage: 55,
    presence: 'both',
  },
  {
    id: 4,
    name: 'Consegna a domicilio',
    slug: 'consegna-a-domicilio',
    currentAmount: '230.00',
    previousAmount: '0.00',
    contribution: '230.00',
    weightPercentage: 5,
    presence: 'current-only',
  },
  {
    id: 5,
    name: 'Mensa aziendale',
    slug: 'mensa-aziendale',
    currentAmount: '0.00',
    previousAmount: '230.00',
    contribution: '-230.00',
    weightPercentage: 0,
    presence: 'previous-only',
  },
]

describe('CategorySubcategoryBreakdown (D-16/CDET-05, Task 2)', () => {
  test('renders zero occurrences of Deviazione/DeviationBadge', () => {
    const html = renderToStaticMarkup(
      <CategorySubcategoryBreakdown contributions={contributions} year={2026} type="out" />,
    )

    expect(html).not.toContain('Deviazione')
    expect(html).not.toContain('DeviationBadge')
  })

  test("the Totale row's two right-hand values equal the sum of currentAmount/contribution exactly", () => {
    const html = renderToStaticMarkup(
      <CategorySubcategoryBreakdown contributions={contributions} year={2026} type="out" />,
    )

    // sum(currentAmount) = 2480.00 + 230.00 + 0.00 = 2710.00
    // sum(contribution)  = 180.00 + 230.00 - 230.00 = 180.00
    expect(html).toContain('2710,00')
    expect(html).toContain('180,00')
  })

  test("a presence: 'previous-only' row renders its name suffixed with 'solo nel 2025' and a 0% weight bar", () => {
    const html = renderToStaticMarkup(
      <CategorySubcategoryBreakdown contributions={contributions} year={2026} type="out" />,
    )

    expect(html).toContain('Mensa aziendale')
    expect(html).toContain('solo nel 2025')
    expect(html).toContain('width:0%')
  })

  test("a presence: 'current-only' row renders its name suffixed with 'nuova nel 2026'", () => {
    const html = renderToStaticMarkup(
      <CategorySubcategoryBreakdown contributions={contributions} year={2026} type="out" />,
    )

    expect(html).toContain('Consegna a domicilio')
    expect(html).toContain('nuova nel 2026')
  })

  test('renders an explicit empty state for zero contributions', () => {
    const html = renderToStaticMarkup(<CategorySubcategoryBreakdown contributions={[]} year={2026} />)
    expect(html).toContain('Nessuna sottocategoria nel periodo')
  })
})
