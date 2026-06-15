import { describe, expect, it } from 'vitest'
import { subCategories } from '../scripts/seed-data'
import {
  systemCategorizationPatterns,
  validateSystemCategorizationPatterns,
} from '../scripts/seed-patterns-data'

describe('systemCategorizationPatterns', () => {
  it('references only subcategory slugs from seed-data', () => {
    const slugs = new Set(subCategories.map((row) => row.slug))
    const { missingSlugs, duplicateKeys, invalidRegex } = validateSystemCategorizationPatterns(slugs)

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
})
