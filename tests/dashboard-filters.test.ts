import { describe, expect, test } from 'vitest'
import { buildDashboardTabHref } from '@/components/dashboard/dashboard-tab-nav'
import {
  buildDashboardCategoriesHref,
  buildDashboardCategoryDetailHref,
  dashboardCategoryDetail,
} from '@/lib/routes'
import { parseDashboardFilters, parseTagIdParam } from '@/lib/validations/dashboard'

describe('parseDashboardFilters', () => {
  test('uses preset as the canonical period parameter', () => {
    expect(parseDashboardFilters({ preset: 'last-3-months' })).toMatchObject({
      preset: 'last-3-months',
      type: 'out',
    })
  })

  test('accepts period as an alias only when preset is absent', () => {
    expect(parseDashboardFilters({ period: 'this-year' })).toMatchObject({
      preset: 'this-year',
      type: 'out',
    })
  })

  test('lets preset take precedence over period', () => {
    expect(
      parseDashboardFilters({ preset: 'last-6-months', period: 'this-year' })
    ).toMatchObject({
      preset: 'last-6-months',
      type: 'out',
    })
  })

  test('supports a caller-provided default preset for categories', () => {
    expect(parseDashboardFilters({}, { defaultPreset: 'this-year' })).toMatchObject({
      preset: 'this-year',
      type: 'out',
    })
  })

  test('falls back deterministically for invalid preset and period values', () => {
    expect(parseDashboardFilters({ preset: 'invalid' })).toMatchObject({
      preset: 'last-month',
      type: 'out',
    })
    expect(parseDashboardFilters({ period: 'invalid' }, { defaultPreset: 'this-year' })).toMatchObject({
      preset: 'this-year',
      type: 'out',
    })
  })

  test('uses the first array value and falls back when it is invalid', () => {
    expect(
      parseDashboardFilters({ preset: ['last-3-months', 'this-year'], type: ['in', 'out'] })
    ).toMatchObject({
      preset: 'last-3-months',
      type: 'in',
    })
    expect(
      parseDashboardFilters({ preset: ['invalid', 'this-year'], type: ['invalid', 'in'] })
    ).toMatchObject({
      preset: 'last-month',
      type: 'out',
    })
  })

  test('falls back to out for malformed type but keeps all as a valid parser value', () => {
    expect(parseDashboardFilters({ type: 'malformed' })).toMatchObject({
      preset: 'last-month',
      type: 'out',
    })
    expect(parseDashboardFilters({ type: 'all' })).toMatchObject({
      preset: 'last-month',
      type: 'all',
    })
  })

  test('parses sort=deviation when explicit', () => {
    expect(parseDashboardFilters({ sort: 'deviation' })).toMatchObject({ sort: 'deviation' })
  })

  test('parses sort=amount when explicit', () => {
    expect(parseDashboardFilters({ sort: 'amount' })).toMatchObject({ sort: 'amount' })
  })

  test("falls back to the caller's defaultSort when sort is absent", () => {
    expect(parseDashboardFilters({}, { defaultSort: 'deviation' })).toMatchObject({ sort: 'deviation' })
    expect(parseDashboardFilters({}, { defaultSort: 'amount' })).toMatchObject({ sort: 'amount' })
  })

  test("falls back to 'amount' when defaultSort and sort are both absent", () => {
    expect(parseDashboardFilters({})).toMatchObject({ sort: 'amount' })
  })

  test('falls back to defaultSort for malformed sort values', () => {
    expect(
      parseDashboardFilters({ sort: 'oops' }, { defaultSort: 'deviation' })
    ).toMatchObject({ sort: 'deviation' })
  })
})

describe('parseTagIdParam (68-01)', () => {
  test('parses a valid positive integer string', () => {
    expect(parseTagIdParam({ tag: '3' })).toBe(3)
  })

  test('returns undefined when tag is absent', () => {
    expect(parseTagIdParam({ tag: undefined })).toBeUndefined()
  })

  test('returns undefined for non-positive-integer values', () => {
    expect(parseTagIdParam({ tag: '0' })).toBeUndefined()
    expect(parseTagIdParam({ tag: '-1' })).toBeUndefined()
    expect(parseTagIdParam({ tag: 'abc' })).toBeUndefined()
  })

  test('uses the first array value', () => {
    expect(parseTagIdParam({ tag: ['7', '9'] })).toBe(7)
  })
})

describe('buildDashboardTabHref', () => {
  test('preserves only dashboard filter params across tabs', () => {
    const currentParams = new URLSearchParams({
      preset: 'last-3-months',
      type: 'in',
      page: '2',
    })

    expect(buildDashboardTabHref('/dashboard/categories', currentParams)).toBe(
      '/dashboard/categories?preset=last-3-months&type=in'
    )
    expect(buildDashboardTabHref('/dashboard/overview', currentParams)).toBe(
      '/dashboard/overview?preset=last-3-months&type=in'
    )
  })

  test('omits an empty query string when no dashboard filter params are present', () => {
    expect(buildDashboardTabHref('/dashboard/categories', new URLSearchParams('page=2'))).toBe(
      '/dashboard/categories'
    )
  })

  test('preserves sort across the tab nav builder', () => {
    const current = new URLSearchParams({ preset: 'last-3-months', sort: 'amount' })
    expect(buildDashboardTabHref('/dashboard/categories', current)).toBe(
      '/dashboard/categories?preset=last-3-months&sort=amount'
    )
  })
})

describe('dashboard category list routes', () => {
  test('builds the categories list path without query params by default', () => {
    expect(buildDashboardCategoriesHref()).toBe('/dashboard/categories')
  })

  test('omits default category filters from list hrefs', () => {
    expect(
      buildDashboardCategoriesHref({
        preset: 'this-year',
        type: 'out',
      })
    ).toBe('/dashboard/categories')
  })

  test('preserves non-default preset and income type for list hrefs', () => {
    expect(
      buildDashboardCategoriesHref({
        preset: 'last-3-months',
        type: 'in',
      })
    ).toBe('/dashboard/categories?preset=last-3-months&type=in')
  })

  test('canonicalizes inbound period alias to preset and never emits period', () => {
    const filters = parseDashboardFilters(
      { period: 'last-6-months', type: 'in' },
      { defaultPreset: 'this-year' }
    )

    expect(
      buildDashboardCategoriesHref({
        preset: filters.preset,
        type: filters.type === 'in' ? 'in' : 'out',
        defaultPreset: 'this-year',
      })
    ).toBe('/dashboard/categories?preset=last-6-months&type=in')
  })

  test('omits sort when it matches the default', () => {
    expect(
      buildDashboardCategoriesHref({ sort: 'deviation', defaultSort: 'deviation' })
    ).toBe('/dashboard/categories')
  })

  test('preserves non-default sort with preset and type', () => {
    expect(
      buildDashboardCategoriesHref({
        preset: 'last-3-months',
        type: 'in',
        sort: 'amount',
        defaultSort: 'deviation',
      })
    ).toBe('/dashboard/categories?preset=last-3-months&type=in&sort=amount')
  })
})

describe('dashboard category detail routes', () => {
  test('builds the detail path from the category id', () => {
    expect(dashboardCategoryDetail(42)).toBe('/dashboard/categories/42')
  })

  test('omits default category filters from detail hrefs', () => {
    expect(
      buildDashboardCategoryDetailHref(42, {
        preset: 'this-year',
        type: 'out',
      })
    ).toBe('/dashboard/categories/42')
  })

  test('preserves non-default preset and income type for detail hrefs', () => {
    expect(
      buildDashboardCategoryDetailHref(42, {
        preset: 'last-3-months',
        type: 'in',
      })
    ).toBe('/dashboard/categories/42?preset=last-3-months&type=in')
  })
})
