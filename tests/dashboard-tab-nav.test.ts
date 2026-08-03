import { describe, expect, test } from 'vitest'
import { buildDashboardTabHref } from '@/components/dashboard/dashboard-tab-nav'

/**
 * RETIRE-04 / D-13 / D-14 — buildDashboardTabHref parameter allowlist
 *
 * Requirement: "Dashboard tab navigation carries only the parameters that are actually read,
 * dropping the `tag` parameter dead since v2.7 (D7)". Design decisions D-13 (tab nav
 * propagates `?lens=`) and D-14 (tab nav drops `?tag=`).
 *
 * This test file replaces the deleted tests/dashboard-filters.test.ts coverage for RETIRE-04.
 * It verifies:
 * a) A `tag` param present in input searchParams is NOT present in emitted href
 * b) A `lens` param present in input IS preserved in emitted href
 * c) `year`, `type`, `sort` are all preserved (they are read)
 * d) Combined input (tag + preset + year + lens + type + sort) emits ONLY the read params
 */
describe('RETIRE-04 / D-13 / D-14 — buildDashboardTabHref parameter allowlist', () => {
  test('drops the dead ?tag= parameter when present in searchParams (D-14)', () => {
    const href = buildDashboardTabHref(
      '/dashboard/overview',
      new URLSearchParams({ tag: '5' })
    )

    expect(href).not.toContain('tag=')
    expect(href).toBe('/dashboard/overview')
  })

  test('preserves ?lens= parameter when present in searchParams (D-13)', () => {
    const href = buildDashboardTabHref(
      '/dashboard/categories',
      new URLSearchParams({ lens: 'competenza' })
    )

    expect(href).toContain('lens=competenza')
    expect(href).toBe('/dashboard/categories?lens=competenza')
  })

  test('preserves ?year= parameter when present in searchParams', () => {
    const href = buildDashboardTabHref(
      '/dashboard/overview',
      new URLSearchParams({ year: '2025' })
    )

    expect(href).toContain('year=2025')
    expect(href).toBe('/dashboard/overview?year=2025')
  })

  test('preserves ?type= parameter when present in searchParams', () => {
    const href = buildDashboardTabHref(
      '/dashboard/categories',
      new URLSearchParams({ type: 'expense' })
    )

    expect(href).toContain('type=expense')
    expect(href).toBe('/dashboard/categories?type=expense')
  })

  test('preserves ?sort= parameter when present in searchParams', () => {
    const href = buildDashboardTabHref(
      '/dashboard/tags',
      new URLSearchParams({ sort: 'name' })
    )

    expect(href).toContain('sort=name')
    expect(href).toBe('/dashboard/tags?sort=name')
  })

  test('drops ?tag= while preserving ?lens= when both are present (RETIRE-04, D-13, D-14)', () => {
    const href = buildDashboardTabHref(
      '/dashboard/overview',
      new URLSearchParams({ tag: '5', lens: 'competenza' })
    )

    expect(href).not.toContain('tag=')
    expect(href).toContain('lens=competenza')
  })

  test('emits exactly the read parameters when all possible params are present: tag + preset + year + lens + type + sort (RETIRE-04 allowlist)', () => {
    const href = buildDashboardTabHref(
      '/dashboard/categories',
      new URLSearchParams({
        tag: '5',
        preset: 'last-3-months',
        year: '2025',
        lens: 'competenza',
        type: 'expense',
        sort: 'name',
      })
    )

    const url = new URL(`http://x${href}`)
    const params = url.searchParams

    // Assert exactly the read parameters are present
    expect(params.has('year')).toBe(true)
    expect(params.get('year')).toBe('2025')

    expect(params.has('type')).toBe(true)
    expect(params.get('type')).toBe('expense')

    expect(params.has('sort')).toBe(true)
    expect(params.get('sort')).toBe('name')

    expect(params.has('lens')).toBe(true)
    expect(params.get('lens')).toBe('competenza')

    // Assert dead parameters are NOT present
    expect(params.has('tag')).toBe(false)
    expect(params.has('preset')).toBe(false)

    // Assert key set is exactly what we expect (no additional params)
    const keys = Array.from(params.keys()).sort()
    expect(keys).toEqual(['lens', 'sort', 'type', 'year'])
  })

  test('omits all optional parameters when none are present, returning the bare href', () => {
    const href = buildDashboardTabHref(
      '/dashboard/overview',
      new URLSearchParams()
    )

    expect(href).toBe('/dashboard/overview')
    expect(href).not.toContain('?')
  })

  test('forwards ?lens= across Overview <-> Categorie <-> Tag tab switches (Phase 80, unchanged behavior)', () => {
    const overviewHref = buildDashboardTabHref(
      '/dashboard/overview',
      new URLSearchParams({ lens: 'competenza' })
    )
    const categorieiHref = buildDashboardTabHref(
      '/dashboard/categories',
      new URLSearchParams(overviewHref.split('?')[1] || '')
    )
    const tagHref = buildDashboardTabHref(
      '/dashboard/tags',
      new URLSearchParams(categorieiHref.split('?')[1] || '')
    )

    expect(overviewHref).toContain('lens=competenza')
    expect(categorieiHref).toContain('lens=competenza')
    expect(tagHref).toContain('lens=competenza')
  })
})
