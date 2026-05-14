import { describe, expect, test } from 'vitest'
import { buildDashboardTabHref } from '@/components/dashboard/dashboard-tab-nav'
import {
  buildDashboardCategoryDetailHref,
  dashboardCategoryDetail,
} from '@/lib/routes'
import { parseDashboardFilters } from '@/lib/validations/dashboard'

describe('parseDashboardFilters', () => {
  test('uses preset as the canonical period parameter', () => {
    expect(parseDashboardFilters({ preset: 'last-3-months' })).toEqual({
      preset: 'last-3-months',
      type: 'out',
    })
  })

  test('accepts period as an alias only when preset is absent', () => {
    expect(parseDashboardFilters({ period: 'this-year' })).toEqual({
      preset: 'this-year',
      type: 'out',
    })
  })

  test('lets preset take precedence over period', () => {
    expect(
      parseDashboardFilters({ preset: 'last-6-months', period: 'this-year' })
    ).toEqual({
      preset: 'last-6-months',
      type: 'out',
    })
  })

  test('supports a caller-provided default preset for categories', () => {
    expect(parseDashboardFilters({}, { defaultPreset: 'this-year' })).toEqual({
      preset: 'this-year',
      type: 'out',
    })
  })

  test('falls back deterministically for invalid preset and period values', () => {
    expect(parseDashboardFilters({ preset: 'invalid' })).toEqual({
      preset: 'last-month',
      type: 'out',
    })
    expect(parseDashboardFilters({ period: 'invalid' }, { defaultPreset: 'this-year' })).toEqual({
      preset: 'this-year',
      type: 'out',
    })
  })

  test('uses the first array value and falls back when it is invalid', () => {
    expect(
      parseDashboardFilters({ preset: ['last-3-months', 'this-year'], type: ['in', 'out'] })
    ).toEqual({
      preset: 'last-3-months',
      type: 'in',
    })
    expect(
      parseDashboardFilters({ preset: ['invalid', 'this-year'], type: ['invalid', 'in'] })
    ).toEqual({
      preset: 'last-month',
      type: 'out',
    })
  })

  test('falls back to out for malformed type but keeps all as a valid parser value', () => {
    expect(parseDashboardFilters({ type: 'malformed' })).toEqual({
      preset: 'last-month',
      type: 'out',
    })
    expect(parseDashboardFilters({ type: 'all' })).toEqual({
      preset: 'last-month',
      type: 'all',
    })
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
