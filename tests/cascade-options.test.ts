/**
 * Tests for cascade-options utility — buildTypeNatureMap, buildCategorySubcategoryMap,
 * and the Phase 49 buildDirectionNatureMap (direction-keyed variant).
 */
import { describe, it, expect } from 'vitest'
import {
  buildTypeNatureMap,
  buildCategorySubcategoryMap,
  buildDirectionNatureMap,
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
    type: null,
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

  it('excludes null-type (unassigned direction) categories from the map', () => {
    const result = buildTypeNatureMap(fixture)
    // The 'sistema' fixture has type: null — it should not create any bucket
    expect('sistema' in result).toBe(false)
    // The value null is never a key in the result record
    expect('null' in result).toBe(false)
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

  it('does not create a null/system bucket in the all-bucket', () => {
    const result = buildTypeNatureMap(fixture)
    // null-type (unassigned direction) subcategory has effectiveNature null
    // it should not produce a separate bucket
    expect('null' in result).toBe(false)
  })
})

// ─── buildCategorySubcategoryMap ─────────────────────────────────────────────

describe('buildCategorySubcategoryMap', () => {
  it('returns empty map for empty input', () => {
    const result = buildCategorySubcategoryMap([])
    expect(result).toEqual({})
  })

  it('excludes null-type (unassigned direction) categories', () => {
    const result = buildCategorySubcategoryMap(fixture)
    // 'sistema' has type: null — it should not appear in the subcategory map
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

// ─── buildDirectionNatureMap (Phase 49 RED — CAT-01) ─────────────────────────
// buildDirectionNatureMap is the renamed/reworked version of buildTypeNatureMap.
// It accepts the same CategoryWithSubCategories array but treats category.type as a
// direction code ('in' | 'out' | 'allocation' | 'transfer') instead of the old
// category type string.
//
// This describe block is RED until Plan 05 adds the export to cascade-options.ts.
// Key contract: result keyed by direction code; allocation bucket contains savings+investment.

// Direction-aware taxonomy fixture (v2 direction codes, not stale category types)
const directionFixture: CategoryWithSubCategories[] = [
  // OUT direction: essential + discretionary natures
  {
    id: 10,
    name: 'Spesa',
    slug: 'spesa',
    type: 'out',
    userId: null,
    isOwned: false,
    subCategories: [
      {
        id: 101,
        name: 'Spesa quotidiana',
        slug: 'spesa-quotidiana',
        originalName: 'Spesa quotidiana',
        userId: null,
        isOwned: false,
        hasOverride: false,
        customName: null,
        effectiveNature: 'essential',
      },
      {
        id: 102,
        name: 'Bio vino e gourmet',
        slug: 'bio-vino-e-gourmet',
        originalName: 'Bio vino e gourmet',
        userId: null,
        isOwned: false,
        hasOverride: false,
        customName: null,
        effectiveNature: 'discretionary',
      },
    ],
  },
  // ALLOCATION direction: savings + investment natures (from v2 manifest)
  {
    id: 20,
    name: 'Risparmio',
    slug: 'risparmio',
    type: 'allocation',
    userId: null,
    isOwned: false,
    subCategories: [
      {
        id: 201,
        name: 'Conto risparmio',
        slug: 'conto-risparmio',
        originalName: 'Conto risparmio',
        userId: null,
        isOwned: false,
        hasOverride: false,
        customName: null,
        effectiveNature: 'savings',
      },
    ],
  },
  {
    id: 21,
    name: 'Investimenti',
    slug: 'investimenti',
    type: 'allocation',
    userId: null,
    isOwned: false,
    subCategories: [
      {
        id: 211,
        name: 'Titoli e fondi',
        slug: 'titoli-e-fondi',
        originalName: 'Titoli e fondi',
        userId: null,
        isOwned: false,
        hasOverride: false,
        customName: null,
        effectiveNature: 'investment',
      },
    ],
  },
  // IN direction: income nature
  {
    id: 30,
    name: 'Income da lavoro',
    slug: 'income-da-lavoro',
    type: 'in',
    userId: null,
    isOwned: false,
    subCategories: [
      {
        id: 301,
        name: 'Stipendio base',
        slug: 'stipendio-base',
        originalName: 'Stipendio base',
        userId: null,
        isOwned: false,
        hasOverride: false,
        customName: null,
        effectiveNature: 'income',
      },
    ],
  },
  // NULL type (v2 — no 'system' direction code): must be excluded from all direction buckets
  {
    id: 40,
    name: 'Sistema',
    slug: 'sistema',
    type: null,
    userId: null,
    isOwned: false,
    subCategories: [
      {
        id: 401,
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
  // NULL type: must be skipped (no crash); categories with valid direction codes still produce buckets
  {
    id: 50,
    name: 'Senza tipo',
    slug: 'senza-tipo',
    type: null,
    userId: null,
    isOwned: false,
    subCategories: [
      {
        id: 501,
        name: 'Sub senza tipo',
        slug: 'sub-senza-tipo',
        originalName: 'Sub senza tipo',
        userId: null,
        isOwned: false,
        hasOverride: false,
        customName: null,
        effectiveNature: 'essential',
      },
    ],
  },
]

describe('buildDirectionNatureMap (Phase 49 — CAT-01)', () => {
  // CAT-01: basic shape — returns record keyed by direction code with non-empty option arrays
  it('CAT-01: returns a record keyed by direction code with non-empty option arrays', () => {
    const result = buildDirectionNatureMap(directionFixture)
    expect(typeof result).toBe('object')
    expect(result).not.toBeNull()
  })

  // CAT-01: allocation bucket contains savings and investment options
  it("CAT-01: result['allocation'] is a non-empty array containing savings and investment options", () => {
    const result = buildDirectionNatureMap(directionFixture)
    const allocationOptions = result['allocation'] as Array<{ value: string; label: string }> | undefined
    expect(allocationOptions).toBeDefined()
    expect(Array.isArray(allocationOptions)).toBe(true)
    expect(allocationOptions!.length).toBeGreaterThan(0)
    expect(allocationOptions!.some((o) => o.value === 'savings')).toBe(true)
    expect(allocationOptions!.some((o) => o.value === 'investment')).toBe(true)
  })

  // CAT-01: out bucket contains essential and discretionary (spending natures, not savings/investment)
  it("CAT-01: result['out'] contains essential and discretionary (not savings or investment)", () => {
    const result = buildDirectionNatureMap(directionFixture)
    const outOptions = result['out'] as Array<{ value: string }> | undefined
    expect(outOptions).toBeDefined()
    expect(outOptions!.some((o) => o.value === 'essential')).toBe(true)
    expect(outOptions!.some((o) => o.value === 'discretionary')).toBe(true)
    // savings and investment must NOT appear in the OUT bucket
    expect(outOptions!.some((o) => o.value === 'savings')).toBe(false)
    expect(outOptions!.some((o) => o.value === 'investment')).toBe(false)
  })

  // CAT-01 regression guard: type===null skipped without crash; valid direction codes still produce buckets
  it("CAT-01: categories with type===null are skipped without crashing; valid direction codes still produce non-empty buckets", () => {
    const result = buildDirectionNatureMap(directionFixture)
    // The null-type category (id=50) must not produce a 'null' key
    expect('null' in result).toBe(false)
    // Allocation and out buckets must still be populated despite the null-type category
    expect((result['allocation'] as unknown[])?.length).toBeGreaterThan(0)
    expect((result['out'] as unknown[])?.length).toBeGreaterThan(0)
  })

  // null-type category (v2 — 'system' direction code removed) is excluded from all buckets
  it("CAT-01: type===null category is excluded from all direction buckets", () => {
    const result = buildDirectionNatureMap(directionFixture)
    // No 'null' or 'system' key in result
    expect('system' in result).toBe(false)
    expect('null' in result).toBe(false)
    // null-type subcategory (effectiveNature null) must not pollute any bucket
    for (const bucket of Object.values(result as Record<string, Array<{ value: string }>>)) {
      // effectiveNature is null — it should not produce a real option (only 'unclassified' sentinel is allowed)
      expect(bucket.some((o) => o.value === 'null')).toBe(false)
    }
  })

  // empty input returns empty object
  it('returns empty object for empty input', () => {
    const result = buildDirectionNatureMap([])
    expect(result).toEqual({})
  })
})
