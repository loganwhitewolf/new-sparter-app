import { describe, expect, test } from 'vitest'
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
