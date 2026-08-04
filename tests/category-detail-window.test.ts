import { describe, expect, test } from 'vitest'
import { parseCategoryDetailView } from '@/lib/validations/category-year-window'

describe('parseCategoryDetailView (CDET-VIEW-02/04, 260804-br9 Task 1)', () => {
  test('absent params default to ytd', () => {
    expect(parseCategoryDetailView({})).toBe('ytd')
  })

  test('view=projection resolves to projection', () => {
    expect(parseCategoryDetailView({ view: 'projection' })).toBe('projection')
  })

  test('view=ytd resolves to ytd', () => {
    expect(parseCategoryDetailView({ view: 'ytd' })).toBe('ytd')
  })

  test('a bogus view value degrades silently to ytd (CDET-VIEW-04)', () => {
    expect(parseCategoryDetailView({ view: 'bogus' })).toBe('ytd')
  })

  test('array input uses first-element semantics, matching this file\'s own firstOf convention', () => {
    expect(parseCategoryDetailView({ view: ['projection', 'ytd'] })).toBe('projection')
    expect(parseCategoryDetailView({ view: ['ytd', 'projection'] })).toBe('ytd')
  })
})
