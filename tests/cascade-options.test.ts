/**
 * Tests for cascade-options utility — buildTypeNatureMap and buildCategorySubcategoryMap.
 * These pure functions derive dependent-select option maps from the taxonomy.
 * RED phase: tests fail until the implementation is created.
 */
import { describe, it, expect } from 'vitest'
import {
  buildTypeNatureMap,
  buildCategorySubcategoryMap,
} from '@/lib/utils/cascade-options'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'

// Minimal taxonomy fixture
const fixture: CategoryWithSubCategories[] = [
  {
    id: 1,
    name: 'Alimentari',
    slug: 'alimentari',
    type: 'out',
    userId: null,
    isOwned: false,
    subCategories: [
      {
        id: 10,
        name: 'Supermercato',
        slug: 'supermercato',
        originalName: 'Supermercato',
        userId: null,
        isOwned: false,
        hasOverride: false,
        customName: null,
        effectiveNature: 'essential',
      },
      {
        id: 11,
        name: 'Ristorante',
        slug: 'ristorante',
        originalName: 'Ristorante',
        userId: null,
        isOwned: false,
        hasOverride: false,
        customName: null,
        effectiveNature: 'discretionary',
      },
    ],
  },
  {
    id: 2,
    name: 'Stipendio',
    slug: 'stipendio',
    type: 'in',
    userId: null,
    isOwned: false,
    subCategories: [
      {
        id: 20,
        name: 'Stipendio mensile',
        slug: 'stipendio-mensile',
        originalName: 'Stipendio mensile',
        userId: null,
        isOwned: false,
        hasOverride: false,
        customName: null,
        effectiveNature: 'income',
      },
    ],
  },
  {
    id: 3,
    name: 'Sistema',
    slug: 'sistema',
    type: 'system',
    userId: null,
    isOwned: false,
    subCategories: [
      {
        id: 30,
        name: 'Ignorato',
        slug: 'ignorato',
        originalName: 'Ignorato',
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
    name: 'Trasferimento',
    slug: 'trasferimento',
    type: 'transfer',
    userId: null,
    isOwned: false,
    subCategories: [
      {
        id: 40,
        name: 'Bonifico',
        slug: 'bonifico',
        originalName: 'Bonifico',
        userId: null,
        isOwned: false,
        hasOverride: false,
        customName: null,
        effectiveNature: 'transfer',
      },
    ],
  },
]

// ─── buildTypeNatureMap ───────────────────────────────────────────────────────

describe('buildTypeNatureMap', () => {
  it('returns empty maps for empty input', () => {
    const result = buildTypeNatureMap([])
    expect(result).toEqual({})
  })

  it('excludes system-type categories from the map', () => {
    const result = buildTypeNatureMap(fixture)
    expect('system' in result).toBe(false)
  })

  it("includes 'unclassified' option for every type bucket", () => {
    const result = buildTypeNatureMap(fixture)
    expect(result['out']?.some((o) => o.value === 'unclassified')).toBe(true)
    expect(result['in']?.some((o) => o.value === 'unclassified')).toBe(true)
    expect(result['transfer']?.some((o) => o.value === 'unclassified')).toBe(true)
  })

  it("places 'unclassified' as the last entry in each type bucket", () => {
    const result = buildTypeNatureMap(fixture)
    const outOptions = result['out'] ?? []
    expect(outOptions[outOptions.length - 1]?.value).toBe('unclassified')
  })

  it('derives correct natures for the out bucket from subcategory effectiveNature', () => {
    const result = buildTypeNatureMap(fixture)
    const outValues = (result['out'] ?? []).map((o) => o.value)
    expect(outValues).toContain('essential')
    expect(outValues).toContain('discretionary')
  })

  it("the all-bucket key '' includes natures from all non-system types", () => {
    const result = buildTypeNatureMap(fixture)
    const allValues = (result[''] ?? []).map((o) => o.value)
    expect(allValues).toContain('essential')
    expect(allValues).toContain('discretionary')
    expect(allValues).toContain('income')
    expect(allValues).toContain('transfer')
    expect(allValues).toContain('unclassified')
  })

  it('does not include natures from system categories in the all-bucket', () => {
    const result = buildTypeNatureMap(fixture)
    // system subcategory has effectiveNature null — only shows up as 'unclassified' sentinel
    // but we shouldn't have a separate 'system' bucket
    expect('system' in result).toBe(false)
  })
})

// ─── buildCategorySubcategoryMap ─────────────────────────────────────────────

describe('buildCategorySubcategoryMap', () => {
  it('returns empty map for empty input', () => {
    const result = buildCategorySubcategoryMap([])
    expect(result).toEqual({})
  })

  it('excludes system-type categories', () => {
    const result = buildCategorySubcategoryMap(fixture)
    expect('sistema' in result).toBe(false)
  })

  it('keys each non-system category by its slug', () => {
    const result = buildCategorySubcategoryMap(fixture)
    expect('alimentari' in result).toBe(true)
    expect('stipendio' in result).toBe(true)
    expect('trasferimento' in result).toBe(true)
  })

  it('maps subcategory options with value = String(subCategory.id)', () => {
    const result = buildCategorySubcategoryMap(fixture)
    const alimentariOptions = result['alimentari'] ?? []
    expect(alimentariOptions).toContainEqual({ value: '10', label: 'Supermercato' })
    expect(alimentariOptions).toContainEqual({ value: '11', label: 'Ristorante' })
  })

  it("the all-bucket key '' contains all subcategories from non-system categories", () => {
    const result = buildCategorySubcategoryMap(fixture)
    const allValues = (result[''] ?? []).map((o) => o.value)
    expect(allValues).toContain('10')
    expect(allValues).toContain('11')
    expect(allValues).toContain('20')
    expect(allValues).toContain('40')
    // System subcategory (id=30) should not appear
    expect(allValues).not.toContain('30')
  })
})
