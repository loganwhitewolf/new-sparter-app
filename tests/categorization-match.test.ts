import { describe, expect, it } from 'vitest'
// Import DIRECTLY from the pure module — this proves the module loads outside a
// server-only context (no `import 'server-only'` guard), which is what lets a
// plain tsx script reuse the production matcher verbatim.
import { applyTier1Regex, type ActivePattern } from '@/lib/services/categorization-match'
import { systemCategorizationPatterns } from '../scripts/seed-patterns-data'

// System patterns (userId null) ordered by priority, plus one user-owned pattern.
const patterns: ActivePattern[] = [
  { id: 1, userId: null, pattern: 'coop', subCategoryId: 10, confidence: '0.80', priority: 10 },
  { id: 2, userId: null, pattern: 'esselunga', subCategoryId: 11, confidence: '0.85', priority: 20 },
  { id: 3, userId: 'user-1', pattern: 'gym', subCategoryId: 12, confidence: '0.90', priority: 30 },
]

describe('applyTier1Regex (pure module)', () => {
  it('matches a system pattern and returns subCategoryId, confidence, patternId, source', () => {
    const result = applyTier1Regex('Pagamento COOP centro', '-12.50', patterns)
    expect(result).toEqual({
      subCategoryId: 10,
      confidence: '0.80',
      patternId: 1,
      source: 'system_pattern',
    })
  })

  it('matches the pure-number-stripped variant of the description', () => {
    // Raw tokens include a pure-number token (12345) that the matcher strips before
    // re-testing. The pattern still matches the surviving "coop" token.
    const result = applyTier1Regex('PAGAMENTO 12345 COOP', '-9.99', patterns)
    expect(result?.subCategoryId).toBe(10)
    expect(result?.source).toBe('system_pattern')
  })

  it("returns source 'user_pattern' for a user-owned pattern", () => {
    const result = applyTier1Regex('Monthly GYM membership', '-30.00', patterns)
    expect(result).toEqual({
      subCategoryId: 12,
      confidence: '0.90',
      patternId: 3,
      source: 'user_pattern',
    })
  })

  it('returns null when no pattern matches', () => {
    expect(applyTier1Regex('Totally unknown merchant', '-10.00', patterns)).toBeNull()
  })

  it('skips an invalid regex pattern without throwing', () => {
    const invalid: ActivePattern[] = [
      { id: 99, userId: null, pattern: '([invalid', subCategoryId: 1, confidence: '0.80', priority: 10 },
    ]
    expect(() => applyTier1Regex('anything', '-1.00', invalid)).not.toThrow()
    expect(applyTier1Regex('anything', '-1.00', invalid)).toBeNull()
  })

  it('first match in priority order wins when two patterns could match', () => {
    // Both "coop" (priority 10) and a lower-priority pattern could match this
    // description; the earlier (priority 10) pattern in the array wins.
    const ambiguous: ActivePattern[] = [
      { id: 1, userId: null, pattern: 'coop', subCategoryId: 10, confidence: '0.80', priority: 10 },
      { id: 2, userId: null, pattern: 'centro', subCategoryId: 20, confidence: '0.80', priority: 20 },
    ]
    const result = applyTier1Regex('COOP centro', '-5.00', ambiguous)
    expect(result?.subCategoryId).toBe(10)
    expect(result?.patternId).toBe(1)
  })
})

describe('trasporto pattern (D-14, travel-only)', () => {
  const found = systemCategorizationPatterns.find((p) => p.subCategorySlug === 'trasporto')

  it('is registered in systemCategorizationPatterns', () => {
    expect(found).toBeDefined()
  })

  const trasportoPattern: ActivePattern[] = found
    ? [
        {
          id: 1,
          userId: null,
          subCategoryId: 1,
          confidence: found.confidence.toString(),
          priority: found.priority,
          pattern: found.pattern,
        },
      ]
    : []

  it('matches a flight booking', () => {
    const result = applyTier1Regex('Volo Ryanair Bergamo-Palermo', '-89.00', trasportoPattern)
    expect(result?.subCategoryId).toBe(1)
  })

  it('matches a ferry crossing', () => {
    const result = applyTier1Regex('Traghetto Livorno Olbia', '-120.00', trasportoPattern)
    expect(result?.subCategoryId).toBe(1)
  })

  it('matches a car rental', () => {
    const result = applyTier1Regex('Autonoleggio Hertz aeroporto', '-210.00', trasportoPattern)
    expect(result?.subCategoryId).toBe(1)
  })

  it('does NOT match daily-commute metro subscription', () => {
    const result = applyTier1Regex('ATM abbonamento mensile metro Milano', '-39.00', trasportoPattern)
    expect(result).toBeNull()
  })

  it('does NOT match a Trenitalia description (mezzi-pubblici territory, unchanged)', () => {
    const result = applyTier1Regex('Trenitalia Roma-Milano', '-45.00', trasportoPattern)
    expect(result).toBeNull()
  })
})
