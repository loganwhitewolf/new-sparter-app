import { describe, expect, it } from 'vitest'
import {
  detectPatternSuggestions,
  detectPatternSuggestionsWithMeta,
  type PatternDetectorRowWithMeta,
  type CoveragePattern,
} from '../lib/utils/pattern-suggestions'

/**
 * Helper to build a PatternDetectorRowWithMeta with sensible defaults.
 * By default strippedByNormalization is false (no platform strip applied).
 */
function rowMeta(
  overrides: Partial<PatternDetectorRowWithMeta> & { normalizedDescription: string },
): PatternDetectorRowWithMeta {
  const rawTitle = overrides.rawTitle ?? overrides.normalizedDescription.toUpperCase()
  return {
    description: rawTitle,
    amount: null,
    valid: true,
    covered: false,
    rawTitle,
    strippedByNormalization: false,
    ...overrides,
  }
}

/**
 * Fineco-style test fixture: three salary transfers differing only in the month token.
 * normalizedDescription is the post-strip, post-normalizeDescription form.
 */
function finecoRows(): PatternDetectorRowWithMeta[] {
  return [
    rowMeta({ normalizedDescription: 'bonifico andrea bernardini causale stipendio marzo' }),
    rowMeta({ normalizedDescription: 'bonifico andrea bernardini causale stipendio maggio' }),
    rowMeta({ normalizedDescription: 'bonifico andrea bernardini causale stipendio giugno' }),
  ]
}

describe('detectPatternSuggestionsWithMeta — D-05 metadata', () => {
  // ---------------------------------------------------------------------------
  // PIPE-03-a: stablePrefix and residualVariablePart
  // ---------------------------------------------------------------------------
  it('PIPE-03-a: stablePrefix contains the shared prefix; residualVariablePart is the month token', () => {
    const suggestions = detectPatternSuggestionsWithMeta(finecoRows(), [])
    expect(suggestions).toHaveLength(1)
    const s = suggestions[0]
    // stablePrefix is the human-readable, pre-escape joined prefix
    expect(s.stablePrefix).toBe('bonifico andrea bernardini causale stipendio')
    // residualVariablePart is the variable portion from the first sample row
    expect(s.residualVariablePart).toBe('marzo')
    expect(s.residualVariablePart.length).toBeGreaterThan(0)
  })

  // ---------------------------------------------------------------------------
  // PIPE-03-b: strippedByNormalization rollup
  // ---------------------------------------------------------------------------
  it('PIPE-03-b: strippedByNormalization is true when at least one row had the strip applied', () => {
    const rows = finecoRows()
    // Mark the first row as having been altered by the platform strip pattern
    rows[0] = { ...rows[0], strippedByNormalization: true }

    const suggestions = detectPatternSuggestionsWithMeta(rows, [])
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].strippedByNormalization).toBe(true)
  })

  it('PIPE-03-b: strippedByNormalization is false when all member rows were not stripped', () => {
    // All rows have strippedByNormalization: false (default from rowMeta)
    const suggestions = detectPatternSuggestionsWithMeta(finecoRows(), [])
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].strippedByNormalization).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // PIPE-03-c: sampleNormalized
  // ---------------------------------------------------------------------------
  it('PIPE-03-c: sampleNormalized equals the first member row normalizedDescription', () => {
    const rows = finecoRows()
    const suggestions = detectPatternSuggestionsWithMeta(rows, [])
    expect(suggestions).toHaveLength(1)
    // sampleNormalized must equal the normalizedDescription of the first grouped row
    expect(suggestions[0].sampleNormalized).toBe('bonifico andrea bernardini causale stipendio marzo')
  })

  // ---------------------------------------------------------------------------
  // Parity: same clustering result as detectPatternSuggestions for identical input
  // ---------------------------------------------------------------------------
  it('parity: same pattern and matchCount as detectPatternSuggestions for the same rows', () => {
    const rows = finecoRows()
    // Build plain PatternDetectorRow equivalents for the baseline function
    const plainRows = rows.map(r => ({
      description: r.description,
      normalizedDescription: r.normalizedDescription,
      amount: r.amount,
      valid: r.valid,
      covered: r.covered,
    }))

    const withMeta = detectPatternSuggestionsWithMeta(rows, [])
    const plain = detectPatternSuggestions(plainRows, [])

    expect(withMeta).toHaveLength(plain.length)
    for (let i = 0; i < plain.length; i++) {
      expect(withMeta[i].pattern).toBe(plain[i].pattern)
      expect(withMeta[i].matchCount).toBe(plain[i].matchCount)
    }
  })

  // ---------------------------------------------------------------------------
  // Coverage exclusion — same isCoveredByPatterns gate as existing function
  // ---------------------------------------------------------------------------
  it('covered rows excluded from clustering (same gate as detectPatternSuggestions)', () => {
    const coverage: CoveragePattern[] = [{ pattern: 'bonifico andrea' }]
    // All three rows match the coverage pattern → no suggestion emitted
    const suggestions = detectPatternSuggestionsWithMeta(finecoRows(), coverage)
    expect(suggestions).toHaveLength(0)
  })

  // ---------------------------------------------------------------------------
  // WithMeta type shape: all four D-05 fields must be present
  // ---------------------------------------------------------------------------
  it('suggestion carries all four D-05 fields: stablePrefix, strippedByNormalization, residualVariablePart, sampleNormalized', () => {
    const suggestions = detectPatternSuggestionsWithMeta(finecoRows(), [])
    expect(suggestions).toHaveLength(1)
    const s = suggestions[0]
    expect(s).toHaveProperty('stablePrefix')
    expect(s).toHaveProperty('strippedByNormalization')
    expect(s).toHaveProperty('residualVariablePart')
    expect(s).toHaveProperty('sampleNormalized')
    // Base PatternSuggestion fields also present
    expect(s).toHaveProperty('pattern')
    expect(s).toHaveProperty('matchCount')
    expect(s).toHaveProperty('sampleDescriptions')
  })
})
