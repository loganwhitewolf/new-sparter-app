import { describe, expect, it } from 'vitest'
import {
  candidateCoveredByExistingPattern,
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
    descriptionHash: null,
    ...overrides,
  }
}

/**
 * Fineco-style test fixture: three salary transfers differing only in the month token.
 * normalizedDescription is the post-strip, post-normalizeDescription form.
 */
function finecoRows(): PatternDetectorRowWithMeta[] {
  return [
    rowMeta({
      normalizedDescription: 'bonifico andrea bernardini causale stipendio marzo',
      descriptionHash: 'fineco-hash-1',
    }),
    rowMeta({
      normalizedDescription: 'bonifico andrea bernardini causale stipendio maggio',
      descriptionHash: 'fineco-hash-2',
    }),
    rowMeta({
      normalizedDescription: 'bonifico andrea bernardini causale stipendio giugno',
      descriptionHash: 'fineco-hash-3',
    }),
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

describe('detectPatternSuggestionsWithMeta — Phase 52 validity and dedup metadata', () => {
  it('passes every grouped member descriptionHash through to the suggestion', () => {
    const suggestions = detectPatternSuggestionsWithMeta(finecoRows(), [])

    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].descriptionHashes).toHaveLength(3)
    expect(suggestions[0].descriptionHashes).toEqual(
      expect.arrayContaining(['fineco-hash-1', 'fineco-hash-2', 'fineco-hash-3']),
    )
  })

  it('filters null descriptionHash values from the suggestion hash list', () => {
    const rows = finecoRows()
    rows[1] = { ...rows[1], descriptionHash: null }

    const suggestions = detectPatternSuggestionsWithMeta(rows, [])

    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].descriptionHashes).toEqual(['fineco-hash-1', 'fineco-hash-3'])
  })

  it('emits an empty residual for identical multi-token groups', () => {
    const rows = [
      rowMeta({ normalizedDescription: 'macellaio da mario', descriptionHash: 'macellaio-hash-1' }),
      rowMeta({ normalizedDescription: 'macellaio da mario', descriptionHash: 'macellaio-hash-2' }),
      rowMeta({ normalizedDescription: 'macellaio da mario', descriptionHash: 'macellaio-hash-3' }),
    ]

    const suggestions = detectPatternSuggestionsWithMeta(rows, [])

    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].residualVariablePart).toBe('')
    expect(suggestions[0].descriptionHashes).toEqual(
      expect.arrayContaining(['macellaio-hash-1', 'macellaio-hash-2', 'macellaio-hash-3']),
    )
  })

  it('returns true when an existing pattern covers the candidate sample', () => {
    const suggestions = detectPatternSuggestionsWithMeta(finecoRows(), [])

    expect(suggestions).toHaveLength(1)
    expect(candidateCoveredByExistingPattern(suggestions[0], [{ pattern: 'bonifico' }])).toBe(true)
  })

  it('returns false when no existing pattern covers the candidate sample', () => {
    const suggestions = detectPatternSuggestionsWithMeta(finecoRows(), [])

    expect(suggestions).toHaveLength(1)
    expect(candidateCoveredByExistingPattern(suggestions[0], [{ pattern: 'revolut' }])).toBe(false)
  })

  it('matches the numeric-stripped candidate sample and skips invalid regex patterns', () => {
    const rows = [
      rowMeta({ normalizedDescription: 'revolut 114 data operazione', descriptionHash: 'revolut-hash-1' }),
      rowMeta({ normalizedDescription: 'revolut 115 data operazione', descriptionHash: 'revolut-hash-2' }),
    ]
    const suggestions = detectPatternSuggestionsWithMeta(rows, [])

    expect(suggestions).toHaveLength(1)
    expect(
      candidateCoveredByExistingPattern(suggestions[0], [
        { pattern: '[' },
        { pattern: 'revolut data operazione' },
      ]),
    ).toBe(true)
  })
})
