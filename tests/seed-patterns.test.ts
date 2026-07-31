import { describe, expect, it } from 'vitest'
import { subCategories } from '../scripts/seed-data'
import {
  systemCategorizationPatterns,
  validateSystemCategorizationPatterns,
} from '../scripts/seed-patterns-data'

/** Slugs inserted only via seed-extras (additive) — not present in seed-data.ts baseline. */
const ADDITIVE_SYSTEM_SUBCATEGORY_SLUGS = ['carburante', 'ricarica-auto-elettrica'] as const

function knownSystemSubcategorySlugs(): Set<string> {
  return new Set([
    ...subCategories.map((row) => row.slug),
    ...ADDITIVE_SYSTEM_SUBCATEGORY_SLUGS,
  ])
}

describe('systemCategorizationPatterns', () => {
  it('references only subcategory slugs from seed-data + additive extras', () => {
    const { missingSlugs, duplicateKeys, invalidRegex } = validateSystemCategorizationPatterns(
      knownSystemSubcategorySlugs(),
    )

    expect(missingSlugs).toEqual([])
    expect(duplicateKeys).toEqual([])
    expect(invalidRegex).toEqual([])
  })

  it('includes the labeled movements export patterns', () => {
    const patterns = systemCategorizationPatterns.map((row) => row.pattern).join('\n')
    expect(patterns).toContain('(?:\\bquas\\b)')
    expect(patterns).toContain('sapore di mare')
    expect(patterns).not.toContain('(?:\\bvinted\\b)')
  })

  it('keeps validateSystemCategorizationPatterns green after grocery hardening', () => {
    const result = validateSystemCategorizationPatterns(knownSystemSubcategorySlugs())
    expect(result).toEqual({ missingSlugs: [], duplicateKeys: [], invalidRegex: [] })
  })

  it('splits fuel vs EV onto carburante and ricarica-auto-elettrica (D-04)', () => {
    expect(
      systemCategorizationPatterns.some((p) => p.subCategorySlug === 'carburante'),
    ).toBe(true)
    expect(
      systemCategorizationPatterns.some((p) => p.subCategorySlug === 'ricarica-auto-elettrica'),
    ).toBe(true)
    expect(
      systemCategorizationPatterns.some((p) => p.subCategorySlug === 'carburante-e-ricarica'),
    ).toBe(false)
  })

  it('registers a travel-agency pattern mapped to pacchetto-vacanze', () => {
    const travel = systemCategorizationPatterns.find(
      (p) =>
        p.subCategorySlug === 'pacchetto-vacanze' &&
        p.pattern.includes('travel') &&
        p.pattern.includes('specialist'),
    )
    expect(travel).toBeDefined()
    expect(travel!.priority).toBeLessThan(10)
  })

  it('restricts Ins grocery alternatives away from bare bank Ins: labels', () => {
    const grocery = systemCategorizationPatterns.find(
      (p) => p.subCategorySlug === 'spesa-quotidiana' && p.description.startsWith('Grocery'),
    )
    expect(grocery?.pattern).toContain("\\bin'?s\\s+mercato\\b")
    expect(grocery?.pattern).not.toContain('\\bins\\b')
    expect(grocery?.pattern).not.toContain("\\bin'?s\\b")
  })
})
