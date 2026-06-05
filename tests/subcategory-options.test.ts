import { describe, expect, it } from 'vitest'
import { buildCategoryOptions, filterCategoryOptions } from '@/lib/categorization/subcategory-options'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'

function makeCategory(
  overrides: Partial<CategoryWithSubCategories> & { id: number; name: string; type: CategoryWithSubCategories['type'] },
): CategoryWithSubCategories {
  return {
    slug: overrides.name.toLowerCase(),
    userId: null,
    isOwned: false,
    subCategories: [],
    ...overrides,
  }
}

function makeSub(id: number, name: string, owned = false) {
  return {
    id,
    name,
    slug: name.toLowerCase(),
    originalName: name,
    userId: owned ? 'user-1' : null,
    isOwned: owned,
    hasOverride: false,
    customName: null,
    effectiveNature: null,
  }
}

const catOut = makeCategory({
  id: 1,
  name: 'Casa',
  type: 'out',
  subCategories: [makeSub(10, 'Affitto'), makeSub(11, 'Bollette', true)],
})

const catIn = makeCategory({
  id: 2,
  name: 'Stipendio',
  type: 'in',
  subCategories: [makeSub(20, 'Lavoro')],
})

const catTransfer = makeCategory({
  id: 3,
  name: 'Trasferimenti',
  type: 'transfer',
  subCategories: [makeSub(30, 'Banca')],
})

describe('buildCategoryOptions', () => {
  it('flattens all categories when no allowedTypes given', () => {
    const opts = buildCategoryOptions([catOut, catIn, catTransfer])
    expect(opts).toHaveLength(4)
  })

  it('filters by allowedTypes', () => {
    const opts = buildCategoryOptions([catOut, catIn, catTransfer], ['out'])
    expect(opts).toHaveLength(2)
    expect(opts.every((o) => o.categoryType === 'out')).toBe(true)
  })

  it('attaches categoryType to every option', () => {
    const opts = buildCategoryOptions([catOut, catIn])
    const outOpts = opts.filter((o) => o.categoryType === 'out')
    const inOpts = opts.filter((o) => o.categoryType === 'in')
    expect(outOpts).toHaveLength(2)
    expect(inOpts).toHaveLength(1)
  })

  it('marks isOwned correctly', () => {
    const opts = buildCategoryOptions([catOut])
    expect(opts.find((o) => o.value === '11')?.isOwned).toBe(true)
    expect(opts.find((o) => o.value === '10')?.isOwned).toBe(false)
  })

  it('sets value as string id', () => {
    const opts = buildCategoryOptions([catIn])
    expect(opts[0].value).toBe('20')
  })

  it('returns empty array for empty categories list', () => {
    expect(buildCategoryOptions([])).toHaveLength(0)
  })

  it('returns empty array when no category matches allowedTypes', () => {
    expect(buildCategoryOptions([catOut], ['in'])).toHaveLength(0)
  })
})

describe('filterCategoryOptions', () => {
  const opts = buildCategoryOptions([catOut, catIn])

  it('returns all options on empty query', () => {
    expect(filterCategoryOptions(opts, '')).toHaveLength(opts.length)
  })

  it('returns all options on whitespace query', () => {
    expect(filterCategoryOptions(opts, '   ')).toHaveLength(opts.length)
  })

  it('matches on label case-insensitively', () => {
    const results = filterCategoryOptions(opts, 'affitto')
    expect(results).toHaveLength(1)
    expect(results[0].value).toBe('10')
  })

  it('matches on categoryName', () => {
    const results = filterCategoryOptions(opts, 'casa')
    expect(results).toHaveLength(2)
  })

  it('matches on originalName', () => {
    const results = filterCategoryOptions(opts, 'bollette')
    expect(results).toHaveLength(1)
  })

  it('returns empty array when no match', () => {
    expect(filterCategoryOptions(opts, 'zzznomatch')).toHaveLength(0)
  })
})
