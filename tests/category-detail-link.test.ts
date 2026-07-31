import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { resolveYear } from '@/components/dashboard/overview/resolve-year'
import { buildDashboardTabHref } from '@/components/dashboard/dashboard-tab-nav'
import { buildDashboardCategoryDetailHref } from '@/lib/routes'

// CLIST-05/CLIST-07 integration proofs: pure, already-exported functions chained together as ONE
// assertion, not two independently-passing halves that were never actually chained (Plan 83-04
// Task 3).

describe('CLIST-05 — buildDashboardTabHref -> resolveYear round trip', () => {
  test('a year propagated through buildDashboardTabHref resolves back to the SAME year via resolveYear', () => {
    const href = buildDashboardTabHref('/dashboard/categories', new URLSearchParams({ year: '2025' }))
    const emittedYear = new URL(`http://x${href}`).searchParams.get('year')
    const years = ['2026', '2025', '2024']

    expect(emittedYear).toBe('2025')
    expect(resolveYear(emittedYear ?? undefined, years)).toBe(2025)
  })

  test('buildDashboardTabHref never propagates the retired ?preset= param', () => {
    const href = buildDashboardTabHref(
      '/dashboard/categories',
      new URLSearchParams({ year: '2025', preset: 'last-3-months' })
    )

    expect(href).not.toContain('preset=')
  })
})

describe('CLIST-07 — buildDashboardCategoryDetailHref year round trip', () => {
  test('the emitted href carries the SAME year, re-parsed via Number(...), with no precision loss', () => {
    const href = buildDashboardCategoryDetailHref(7, { year: 2025, type: 'allocation' })
    const emittedYear = Number(new URL(`http://x${href}`).searchParams.get('year'))

    expect(emittedYear).toBe(2025)
  })
})

describe('Phase 83 own new code never re-introduces a dependency on the retired Deviation/Preset machinery', () => {
  function readSource(relativePath: string): string {
    return readFileSync(`${process.cwd()}/${relativePath}`, 'utf-8')
  }

  test('the Categories list page contains no DeviationBadge/getCategoryDeviations/?preset= literal', () => {
    const source = readSource('app/(app)/dashboard/categories/page.tsx')

    expect(source).not.toContain('DeviationBadge')
    expect(source).not.toContain('getCategoryDeviations')
    expect(source).not.toContain('?preset=')
  })

  test('the category ranking row list contains no DeviationBadge/getCategoryDeviations/?preset= literal', () => {
    const source = readSource('components/dashboard/category-ranking-list.tsx')

    expect(source).not.toContain('DeviationBadge')
    expect(source).not.toContain('getCategoryDeviations')
    expect(source).not.toContain('?preset=')
  })

  test('the extracted list controls module contains no DeviationBadge/getCategoryDeviations/?preset= literal', () => {
    const source = readSource('components/dashboard/category-list-controls.tsx')

    expect(source).not.toContain('DeviationBadge')
    expect(source).not.toContain('getCategoryDeviations')
    expect(source).not.toContain('?preset=')
  })
})
