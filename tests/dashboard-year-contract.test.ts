import { describe, expect, test } from 'vitest'
import {
  buildDashboardCategoriesHref,
  buildDashboardCategoryDetailHref,
} from '@/lib/routes'
import { extractLensPassthrough } from '@/lib/utils/search-params'
import { parseCategoryYearDirection, parseCategoryYearSort } from '@/lib/validations/dashboard'

describe('parseCategoryYearDirection / parseCategoryYearSort (D-09, D-08)', () => {
  test('parseCategoryYearDirection accepts a valid direction', () => {
    expect(parseCategoryYearDirection('allocation')).toBe('allocation')
    expect(parseCategoryYearDirection('in')).toBe('in')
    expect(parseCategoryYearDirection('out')).toBe('out')
  })

  test('parseCategoryYearDirection falls back to out for an invalid value', () => {
    expect(parseCategoryYearDirection('bogus')).toBe('out')
  })

  test('parseCategoryYearDirection falls back to out when absent', () => {
    expect(parseCategoryYearDirection(undefined)).toBe('out')
  })

  test('parseCategoryYearDirection uses first-element semantics for array input', () => {
    expect(parseCategoryYearDirection(['in', 'out'])).toBe('in')
  })

  test('parseCategoryYearSort accepts projection', () => {
    expect(parseCategoryYearSort('projection')).toBe('projection')
  })

  test("parseCategoryYearSort falls back to amount for retired 'deviation' vocabulary", () => {
    expect(parseCategoryYearSort('deviation')).toBe('amount')
  })

  test('parseCategoryYearSort falls back to amount when absent', () => {
    expect(parseCategoryYearSort(undefined)).toBe('amount')
  })
})

describe('buildDashboardCategoriesHref / buildDashboardCategoryDetailHref — year mode (D-12, CLIST-05)', () => {
  test('emits year, non-default type and non-default sort', () => {
    expect(
      buildDashboardCategoriesHref({ year: 2026, type: 'allocation', sort: 'projection' })
    ).toBe('/dashboard/categories?year=2026&type=allocation&sort=projection')
  })

  test('omits type and sort when they equal their own defaults', () => {
    expect(buildDashboardCategoriesHref({ year: 2026 })).toBe('/dashboard/categories?year=2026')
  })

  test('carries lens through the year-mode href', () => {
    const lens = extractLensPassthrough('competenza')

    expect(buildDashboardCategoriesHref({ year: 2026, lens })).toBe(
      '/dashboard/categories?year=2026&lens=competenza'
    )
  })

  test('year-mode href for the detail page omits default type and preserves lens (D-13)', () => {
    const lens = extractLensPassthrough('competenza')

    expect(buildDashboardCategoryDetailHref(42, { year: 2026, type: 'out', lens })).toBe(
      '/dashboard/categories/42?year=2026&lens=competenza'
    )
  })

  test('year-mode href for the detail page preserves a non-default type', () => {
    expect(buildDashboardCategoryDetailHref(42, { year: 2026, type: 'in' })).toBe(
      '/dashboard/categories/42?year=2026&type=in'
    )
  })

  test('year round-trips through the URL with no precision loss for any 4-digit year (CLIST-05 precision probe)', () => {
    for (const year of [2024, 2025, 2026]) {
      const href = buildDashboardCategoriesHref({ year })
      const roundTripped = Number(new URL(`http://x${href}`).searchParams.get('year'))
      expect(roundTripped).toBe(year)
    }
  })
})
