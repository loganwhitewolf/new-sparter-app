import { describe, expect, test } from 'vitest'
import { buildStartMonthOptions } from '@/components/dashboard/category-detail-window-controls'
import { buildDashboardCategoryDetailHref } from '@/lib/routes'
import { parseCategoryDetailWindow } from '@/lib/validations/category-year-window'

describe('parseCategoryDetailWindow (D-01/D-02/D-03, Task 1)', () => {
  test('months absent defaults to the whole year starting January', () => {
    expect(parseCategoryDetailWindow(2026, {})).toEqual({ months: 12, from: '2026-01' })
  })

  test('an explicit months=12 also defaults to January, ignoring any from', () => {
    expect(parseCategoryDetailWindow(2026, { months: '12', from: '2026-09' })).toEqual({
      months: 12,
      from: '2026-01',
    })
  })

  test('an invalid months value falls back to the whole year', () => {
    expect(parseCategoryDetailWindow(2026, { months: 'bogus' })).toEqual({ months: 12, from: '2026-01' })
    expect(parseCategoryDetailWindow(2026, { months: '5' })).toEqual({ months: 12, from: '2026-01' })
  })

  test("D-02 worked example: months=6 with no from ends on today's month (July)", () => {
    expect(parseCategoryDetailWindow(2026, { months: '6' }, new Date(2026, 6, 15))).toEqual({
      months: 6,
      from: '2026-02',
    })
  })

  test('months=6 with no from, on a closed past year, ends on December', () => {
    expect(parseCategoryDetailWindow(2025, { months: '6' }, new Date(2026, 6, 15))).toEqual({
      months: 6,
      from: '2025-07',
    })
  })

  test('an out-of-range from is clamped to the nearest valid start month, never rejected', () => {
    expect(parseCategoryDetailWindow(2026, { months: '6', from: '2026-09' })).toEqual({
      months: 6,
      from: '2026-07',
    })
  })

  test('from below month 1 clamps up to 1', () => {
    expect(parseCategoryDetailWindow(2026, { months: '3', from: '2026-00' })).toEqual({
      months: 3,
      from: '2026-01',
    })
  })

  test('the YYYY part of from is always ignored and re-stamped with the year argument', () => {
    expect(parseCategoryDetailWindow(2025, { months: '6', from: '2026-02' })).toEqual({
      months: 6,
      from: '2025-02',
    })
  })

  test('array input uses first-element semantics and never throws', () => {
    expect(parseCategoryDetailWindow(2026, { months: ['9', '6'], from: ['2026-02', '2026-03'] })).toEqual({
      months: 9,
      from: '2026-02',
    })
  })

  test('a malformed from string is treated as absent, applying the D-02 default', () => {
    expect(parseCategoryDetailWindow(2026, { months: '3', from: 'not-a-month' }, new Date(2026, 6, 15))).toEqual({
      months: 3,
      from: '2026-05',
    })
  })
})

describe('D-04 year-preserves-window round trip (Task 2)', () => {
  test(
    'starting from ?year=2026&months=6&from=2026-02, simulating CategoryYearSelect.update("2025") ' +
      '(set year, leave months/from untouched) and re-parsing against the new year re-anchors ' +
      'from with zero new re-anchoring code',
    () => {
      const params = new URLSearchParams('year=2026&months=6&from=2026-02')

      // CategoryYearSelect's own update() mutation: set year, leave every other param untouched.
      params.set('year', '2025')

      expect(
        parseCategoryDetailWindow(Number(params.get('year')), {
          months: params.get('months') ?? undefined,
          from: params.get('from') ?? undefined,
        }),
      ).toEqual({ months: 6, from: '2025-02' })
    },
  )

  test('a whole-year window round-trips through a year change with no window params at all', () => {
    const params = new URLSearchParams('year=2026')
    params.set('year', '2025')

    expect(
      parseCategoryDetailWindow(Number(params.get('year')), {
        months: params.get('months') ?? undefined,
        from: params.get('from') ?? undefined,
      }),
    ).toEqual({ months: 12, from: '2025-01' })
  })
})

describe('buildDashboardCategoryDetailHref — window params (D-01/D-04, Task 2)', () => {
  test('emits months and from for a non-default window', () => {
    expect(buildDashboardCategoryDetailHref(42, { year: 2026, months: 6, from: '2026-02' })).toBe(
      '/dashboard/categories/42?year=2026&months=6&from=2026-02',
    )
  })

  test('omits months and from entirely for the whole-year default', () => {
    expect(buildDashboardCategoryDetailHref(42, { year: 2026, months: 12 })).toBe(
      '/dashboard/categories/42?year=2026',
    )
  })

  test('omits from when it equals the implicit January default for its own year', () => {
    expect(buildDashboardCategoryDetailHref(42, { year: 2026, months: 6, from: '2026-01' })).toBe(
      '/dashboard/categories/42?year=2026&months=6',
    )
  })
})

describe('buildStartMonthOptions (D-03, Task 2)', () => {
  test('renders exactly 13 - months options for a 6-month window', () => {
    const options = buildStartMonthOptions(2026, 6)
    expect(options).toHaveLength(7)
    expect(options[0]).toEqual({ value: '01', label: 'gen' })
    expect(options[6]).toEqual({ value: '07', label: 'lug' })
  })

  test('renders exactly 13 - months options for a 3-month window', () => {
    const options = buildStartMonthOptions(2026, 3)
    expect(options).toHaveLength(10)
    expect(options[9]).toEqual({ value: '10', label: 'ott' })
  })

  test('renders exactly 13 - months options for a 9-month window', () => {
    const options = buildStartMonthOptions(2026, 9)
    expect(options).toHaveLength(4)
    expect(options[3]).toEqual({ value: '04', label: 'apr' })
  })
})
