import { describe, expect, it } from 'vitest'
import { categories, subCategories, natures } from '../scripts/seed-data'
import {
  DISSOLVED_CATEGORY_SLUGS,
  DROPPED_SUBCATEGORY_SLUGS,
  NATURE_ID_BY_CODE,
  V2_CATEGORY_SLUGS,
  V2_SUBCATEGORY_MANIFEST,
} from './fixtures/v2-taxonomy-manifest'

const NATURE_BY_ID = Object.fromEntries(natures.map((n) => [n.id, n.code]))

function activeCategories() {
  return categories.filter((c) => c.isActive !== false)
}

function activeSubcategories() {
  return subCategories.filter((s) => s.isActive !== false)
}

// Wave 0 RED scaffold — tests fail against v1 baseline until Plan 02 wholesale replace.
describe('seed taxonomy contract (TAX-01/02/03)', () => {
  it('has 23 active system categories', () => {
    expect(activeCategories()).toHaveLength(23)
  })

  it('every system subcategory has natureId 1-8', () => {
    for (const sub of subCategories) {
      expect(sub.natureId, sub.slug).toBeDefined()
      expect(sub.natureId, sub.slug).toBeGreaterThanOrEqual(1)
      expect(sub.natureId, sub.slug).toBeLessThanOrEqual(8)
      expect(NATURE_BY_ID[sub.natureId!], sub.slug).toBeTruthy()
    }
  })

  it('active category slugs match v2 manifest', () => {
    const activeSlugs = new Set(activeCategories().map((c) => c.slug))
    const expectedSlugs = new Set(V2_CATEGORY_SLUGS)

    expect(activeSlugs).toEqual(expectedSlugs)
  })

  it('subcategory slugs and nature codes match manifest', () => {
    const subsBySlug = new Map(subCategories.map((s) => [s.slug, s]))

    for (const entry of V2_SUBCATEGORY_MANIFEST) {
      const sub = subsBySlug.get(entry.slug)
      expect(sub, `missing subcategory: ${entry.slug}`).toBeDefined()
      expect(sub!.natureId, entry.slug).toBe(NATURE_ID_BY_CODE[entry.natureCode])
    }
  })

  it('dissolved wrapper categories are not active', () => {
    const activeSlugs = new Set(activeCategories().map((c) => c.slug))

    for (const slug of DISSOLVED_CATEGORY_SLUGS) {
      expect(activeSlugs.has(slug), `dissolved category still active: ${slug}`).toBe(false)
    }
  })

  it('dropped subcategory slugs are not active', () => {
    const activeSlugs = new Set(activeSubcategories().map((s) => s.slug))

    for (const slug of DROPPED_SUBCATEGORY_SLUGS) {
      expect(activeSlugs.has(slug), `dropped subcategory still active: ${slug}`).toBe(false)
    }
  })
})
