import { describe, expect, it } from 'vitest'
import {
  buildCategoryOptions,
  filterCategoryOptions,
} from '@/lib/categorization/subcategory-options'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const categories: CategoryWithSubCategories[] = [
  {
    id: 1,
    name: 'Spese',
    slug: 'spese',
    type: 'out',
    userId: null,
    isOwned: false,
    subCategories: [
      {
        id: 10,
        name: 'Ristoranti speciali',
        slug: 'ristoranti',
        originalName: 'Ristoranti',
        userId: null,
        isOwned: false,
        hasOverride: true,
        customName: 'Ristoranti speciali',
        effectiveNature: null,
      },
      {
        id: 11,
        name: 'Casa vacanze',
        slug: 'casa-vacanze',
        originalName: 'Casa vacanze',
        userId: 'user-abc',
        isOwned: true,
        hasOverride: false,
        customName: null,
        effectiveNature: null,
      },
    ],
  },
  {
    id: 2,
    name: 'Entrate',
    slug: 'entrate',
    type: 'in',
    userId: null,
    isOwned: false,
    subCategories: [
      {
        id: 20,
        name: 'Stipendio',
        slug: 'stipendio',
        originalName: 'Stipendio',
        userId: null,
        isOwned: false,
        hasOverride: false,
        customName: null,
        effectiveNature: null,
      },
    ],
  },
  {
    id: 3,
    name: 'Trasferimenti',
    slug: 'trasferimenti',
    type: 'transfer',
    userId: null,
    isOwned: false,
    subCategories: [
      {
        id: 30,
        name: 'Bonifico',
        slug: 'bonifico',
        originalName: 'Bonifico',
        userId: null,
        isOwned: false,
        hasOverride: false,
        customName: null,
        effectiveNature: null,
      },
    ],
  },
  {
    id: 4,
    name: 'Categoria vuota',
    slug: 'vuota',
    type: 'out',
    userId: null,
    isOwned: false,
    subCategories: [],
  },
]

// ---------------------------------------------------------------------------
// buildCategoryOptions
// ---------------------------------------------------------------------------

describe('buildCategoryOptions', () => {
  it('flattens all subcategories when no type filter is provided', () => {
    const opts = buildCategoryOptions(categories)
    // 2 (category id=1) + 1 (category id=2) + 1 (category id=3) + 0 (empty category) = 4
    expect(opts).toHaveLength(4)
  })

  it('uses the overridden display name as label', () => {
    const opts = buildCategoryOptions(categories)
    const ristoranti = opts.find((o) => o.value === '10')
    expect(ristoranti?.label).toBe('Ristoranti speciali')
    expect(ristoranti?.originalName).toBe('Ristoranti')
  })

  it('exposes categoryName for each option', () => {
    const opts = buildCategoryOptions(categories)
    expect(opts.find((o) => o.value === '10')?.categoryName).toBe('Spese')
    expect(opts.find((o) => o.value === '20')?.categoryName).toBe('Entrate')
  })

  it('marks user-owned subcategories with isOwned: true', () => {
    const opts = buildCategoryOptions(categories)
    expect(opts.find((o) => o.value === '11')?.isOwned).toBe(true)
    expect(opts.find((o) => o.value === '10')?.isOwned).toBe(false)
  })

  it('filters to expense-compatible types (out + transfer), excluding income', () => {
    const opts = buildCategoryOptions(categories, ['out', 'transfer'])
    const values = opts.map((o) => o.value)
    expect(values).toContain('10')   // Spese > Ristoranti speciali
    expect(values).toContain('11')   // Spese > Casa vacanze
    expect(values).toContain('30')   // Trasferimenti > Bonifico
    expect(values).not.toContain('20') // Entrate > Stipendio (excluded)
  })

  it('returns no options when category type filter excludes everything', () => {
    const opts = buildCategoryOptions(categories, ['in'])
    expect(opts.map((o) => o.value)).toEqual(['20'])
  })

  it('produces empty array for categories with no subcategories', () => {
    const opts = buildCategoryOptions(categories, ['out'])
    // the empty category fixture has no subcategories — should not appear in options
    const fromEmpty = opts.filter((o) => o.categoryName === 'Categoria vuota')
    expect(fromEmpty).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// filterCategoryOptions
// ---------------------------------------------------------------------------

describe('filterCategoryOptions', () => {
  const allOpts = buildCategoryOptions(categories)

  it('returns all options for empty query', () => {
    expect(filterCategoryOptions(allOpts, '')).toHaveLength(allOpts.length)
    expect(filterCategoryOptions(allOpts, '   ')).toHaveLength(allOpts.length)
  })

  it('matches by display name (overridden label)', () => {
    const results = filterCategoryOptions(allOpts, 'ristoranti speciali')
    expect(results.map((o) => o.value)).toContain('10')
  })

  it('matches by original name (before override)', () => {
    // Display name is "Ristoranti speciali" but originalName is "Ristoranti"
    const results = filterCategoryOptions(allOpts, 'ristoranti')
    expect(results.map((o) => o.value)).toContain('10')
  })

  it('matches by category name', () => {
    const results = filterCategoryOptions(allOpts, 'spese')
    const values = results.map((o) => o.value)
    expect(values).toContain('10')
    expect(values).toContain('11')
  })

  it('matches by slug', () => {
    const results = filterCategoryOptions(allOpts, 'casa-vacanze')
    expect(results.map((o) => o.value)).toContain('11')
  })

  it('is case-insensitive', () => {
    expect(filterCategoryOptions(allOpts, 'STIPENDIO').map((o) => o.value)).toContain('20')
    expect(filterCategoryOptions(allOpts, 'Bonifico').map((o) => o.value)).toContain('30')
  })

  it('returns empty array when no option matches', () => {
    const results = filterCategoryOptions(allOpts, 'zzznonexistent')
    expect(results).toHaveLength(0)
  })

  it('handles partial matches', () => {
    const results = filterCategoryOptions(allOpts, 'bonif')
    expect(results.map((o) => o.value)).toContain('30')
  })
})

// ---------------------------------------------------------------------------
// Personale badge metadata
// ---------------------------------------------------------------------------

describe('Personale badge metadata', () => {
  it('only user-owned subcategories carry isOwned: true', () => {
    const opts = buildCategoryOptions(categories)
    const owned = opts.filter((o) => o.isOwned)
    expect(owned).toHaveLength(1)
    expect(owned[0].value).toBe('11')
    expect(owned[0].label).toBe('Casa vacanze')
  })

  it('system subcategories with user override remain isOwned: false', () => {
    const opts = buildCategoryOptions(categories)
    const overridden = opts.find((o) => o.value === '10')
    expect(overridden?.isOwned).toBe(false)
    expect(overridden?.label).toBe('Ristoranti speciali')
    expect(overridden?.originalName).toBe('Ristoranti')
  })

  it('user-owned option is searchable by its name', () => {
    const opts = buildCategoryOptions(categories)
    const results = filterCategoryOptions(opts, 'casa vacanze')
    const owned = results.find((o) => o.value === '11')
    expect(owned?.isOwned).toBe(true)
  })
})
