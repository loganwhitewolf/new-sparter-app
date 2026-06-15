import { describe, expect, it } from 'vitest'
import {
  detectPatternSuggestions,
  type PatternDetectorRow,
  type CoveragePattern,
} from '../lib/utils/pattern-suggestions'

function row(overrides: Partial<PatternDetectorRow> & { normalizedDescription: string }): PatternDetectorRow {
  return {
    description: overrides.normalizedDescription.toUpperCase(),
    amount: '-10.00',
    valid: true,
    covered: false,
    ...overrides,
  }
}

describe('detectPatternSuggestions', () => {
  it('SUG-01: groups two rows sharing a normalized 2-token prefix and emits one suggestion', () => {
    // Row 1 has an extra non-numeric token "supermercato" so the bucket is a genuine partial
    // match (one member extends beyond the shared prefix ["pagamento", "pos"]).
    const rows = [
      row({ normalizedDescription: 'pagamento pos supermercato', amount: '-10.00' }),
      row({ normalizedDescription: 'pagamento pos farmacia', amount: '-20.00' }),
    ]
    const suggestions = detectPatternSuggestions(rows, [])
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].pattern).toBe('pagamento pos')
    expect(suggestions[0].matchCount).toBe(2)
  })

  it('SUG-02: strips purely numeric tokens (digits-only) before prefix comparison', () => {
    // The year tokens (2026/2025) are purely numeric and stripped; one row adds a
    // non-numeric city suffix so the bucket qualifies as a partial match.
    const rows = [
      row({ normalizedDescription: 'pagamento 2026 supermercato roma' }),
      row({ normalizedDescription: 'pagamento 2025 supermercato milano' }),
    ]
    const suggestions = detectPatternSuggestions(rows, [])
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].pattern).toBe('pagamento supermercato')
    expect(suggestions[0].matchCount).toBe(2)
  })

  it('SUG-03: rejects groups with <2 rows OR <2 non-numeric prefix tokens', () => {
    // (a) Single-row input
    const singleRow = [row({ normalizedDescription: 'pagamento pos market' })]
    expect(detectPatternSuggestions(singleRow, [])).toHaveLength(0)

    // (b) Two rows sharing only a 1-token prefix after numeric strip
    const oneTokenPrefix = [
      row({ normalizedDescription: 'bonifico 123' }),
      row({ normalizedDescription: 'bonifico 456' }),
    ]
    expect(detectPatternSuggestions(oneTokenPrefix, [])).toHaveLength(0)

    // (c) Two rows whose stripped token lists are entirely numeric
    const allNumeric = [
      row({ normalizedDescription: '12345 67890' }),
      row({ normalizedDescription: '11111 22222' }),
    ]
    expect(detectPatternSuggestions(allNumeric, [])).toHaveLength(0)
  })

  it('SUG-04: preserves the longest qualifying common prefix (3-token example), not truncated to 2', () => {
    const rows = [
      row({ normalizedDescription: 'pagamento pos negozio rossi' }),
      row({ normalizedDescription: 'pagamento pos negozio bianchi' }),
      row({ normalizedDescription: 'pagamento pos negozio verdi' }),
    ]
    const suggestions = detectPatternSuggestions(rows, [])
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].pattern).toBe('pagamento pos negozio')
    expect(suggestions[0].matchCount).toBe(3)
  })

  it('SUG-05: excludes invalid rows, caller-flagged covered rows, and coveragePattern-matched rows', () => {
    // Phase 46: amountSign removed from CoveragePattern (ADR 0012) — coverage is pattern-only
    const coverage: CoveragePattern[] = [{ pattern: 'already covered' }]
    const rows = [
      // row A: valid:true, covered:false → INCLUDED
      row({ normalizedDescription: 'pagamento pos market', description: 'ROW A', amount: '10.00' }),
      // row B: valid:false, covered:false → EXCLUDED (invalid)
      row({ normalizedDescription: 'pagamento pos market', description: 'ROW B', valid: false }),
      // row C: valid:true, covered:true → EXCLUDED (caller flag)
      row({ normalizedDescription: 'pagamento pos market', description: 'ROW C', covered: true }),
      // row D: valid:true, covered:false, description matches coverage → EXCLUDED (sign-agnostic)
      row({ normalizedDescription: 'already covered expense', description: 'ROW D', amount: '-10.00' }),
      // row E: valid:true, covered:false → INCLUDED
      row({ normalizedDescription: 'pagamento pos shop', description: 'ROW E', amount: '10.00' }),
    ]
    const suggestions = detectPatternSuggestions(rows, coverage)
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].matchCount).toBe(2)
  })

  it('SUG-06: escapes regex metacharacters in the generated pattern string', () => {
    const rows = [
      row({ normalizedDescription: 'addebito s.p.a. roma' }),
      row({ normalizedDescription: 'addebito s.p.a. milano' }),
    ]
    const suggestions = detectPatternSuggestions(rows, [])
    expect(suggestions).toHaveLength(1)
    // The literal dots must appear as escaped \. in the pattern source
    expect(suggestions[0].pattern).toBe('addebito s\\.p\\.a\\.')
    // Round-trip verification: the escaped pattern matches the original but not arbitrary chars
    expect(new RegExp(suggestions[0].pattern, 'i').test('addebito s.p.a. roma')).toBe(true)
    expect(new RegExp(suggestions[0].pattern, 'i').test('addebito sXpXaX roma')).toBe(false)
  })

  it('ANL-02: each PatternSuggestion exposes pattern, matchCount, sampleDescriptions (max 3 from raw description)', () => {
    const rows = [
      { description: 'PAGAMENTO POS A', normalizedDescription: 'pagamento pos a', amount: '-10.00', valid: true, covered: false },
      { description: 'PAGAMENTO POS B', normalizedDescription: 'pagamento pos b', amount: '-10.00', valid: true, covered: false },
      { description: 'PAGAMENTO POS C', normalizedDescription: 'pagamento pos c', amount: '-10.00', valid: true, covered: false },
      { description: 'PAGAMENTO POS D', normalizedDescription: 'pagamento pos d', amount: '-10.00', valid: true, covered: false },
      { description: 'PAGAMENTO POS E', normalizedDescription: 'pagamento pos e', amount: '-10.00', valid: true, covered: false },
    ]
    const suggestions = detectPatternSuggestions(rows, [])
    expect(suggestions).toHaveLength(1)
    const s = suggestions[0]
    // Has exactly the three required keys (detectedAmountSign removed — ADR 0012: sign-agnostic)
    expect(s).toHaveProperty('pattern')
    expect(s).toHaveProperty('matchCount')
    expect(s).toHaveProperty('sampleDescriptions')
    expect(s).not.toHaveProperty('detectedAmountSign')
    // matchCount includes all 5 rows
    expect(s.matchCount).toBe(5)
    // sampleDescriptions capped at 3, from raw description (uppercase)
    expect(s.sampleDescriptions).toHaveLength(3)
    for (const desc of s.sampleDescriptions) {
      expect(['PAGAMENTO POS A', 'PAGAMENTO POS B', 'PAGAMENTO POS C', 'PAGAMENTO POS D', 'PAGAMENTO POS E']).toContain(desc)
      // Proves descriptions came from row.description NOT row.normalizedDescription
      expect(desc).toMatch(/^PAGAMENTO POS [A-E]$/)
    }
    // Sample descriptions must be distinct
    expect(new Set(s.sampleDescriptions).size).toBe(s.sampleDescriptions.length)
  })

  // ANL-04 removed — detectedAmountSign dropped per ADR 0012 (patterns are sign-agnostic)

  it('SUG-07a: fully identical normalized descriptions emit one suggestion', () => {
    // Even identical descriptions deserve a pattern suggestion: useful for first-import
    // bulk categorization (Tier 2 has no history yet). isCoveredByPatterns already
    // suppresses re-suggestions once a pattern is in place.
    // Regression: DescriptionStripPattern can make originally-different Fineco descriptions
    // identical by removing the variable boilerplate (date, card ref). The allLiterallyIdentical
    // guard was a false positive — it prevented suggestions for these stripped groups.
    const rows = [
      row({ normalizedDescription: 'pagamento pos market' }),
      row({ normalizedDescription: 'pagamento pos market' }),
    ]
    const suggestions = detectPatternSuggestions(rows, [])
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].pattern).toBe('pagamento pos market')
    expect(suggestions[0].matchCount).toBe(2)
  })

  it('SUG-07a-strip: Fineco stripped-identical descriptions (originally different) emit one suggestion', () => {
    // All three rows originally had a different Fineco boilerplate suffix (date + card ref).
    // After descriptionStripPattern, all normalize to the same string. The suggestion is
    // essential for first-import Tier 1 rule setup.
    const rows = [
      { description: 'Revolut**5920* Dublin IE', normalizedDescription: 'revolut**5920* dublin ie', amount: '-50.00', valid: true, covered: false },
      { description: 'Revolut**5920* Dublin IE', normalizedDescription: 'revolut**5920* dublin ie', amount: '-75.00', valid: true, covered: false },
      { description: 'Revolut**5920* Dublin IE', normalizedDescription: 'revolut**5920* dublin ie', amount: '-30.00', valid: true, covered: false },
    ]
    const suggestions = detectPatternSuggestions(rows, [])
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].pattern).toBe('revolut\\*\\*5920\\* dublin ie')
    expect(suggestions[0].matchCount).toBe(3)
  })

  it('SUG-07b: two identical rows + one extension → one suggestion covering all three', () => {
    // "premium" row has tokens ["netflix", "abbonamento", "premium"] which extend beyond
    // the shared prefix ["netflix", "abbonamento"], so the bucket qualifies as a partial match.
    // All three rows are counted in matchCount.
    const rows = [
      row({ normalizedDescription: 'netflix abbonamento' }),
      row({ normalizedDescription: 'netflix abbonamento' }),
      row({ normalizedDescription: 'netflix abbonamento premium' }),
    ]
    const suggestions = detectPatternSuggestions(rows, [])
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].pattern).toBe('netflix abbonamento')
    expect(suggestions[0].matchCount).toBe(3)
  })

  it('SUG-07c: rows differing only in stripped numeric tokens emit one suggestion', () => {
    // "12345" and "67890" are purely numeric → stripped, leaving ["pagamento", "pos"] for
    // prefix computation. But the raw descriptions ARE different: different hashes → Tier 2
    // does NOT cross-match them. A regex pattern "pagamento pos" IS useful here.
    const rows = [
      row({ normalizedDescription: 'pagamento pos 12345' }),
      row({ normalizedDescription: 'pagamento pos 67890' }),
    ]
    const suggestions = detectPatternSuggestions(rows, [])
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].pattern).toBe('pagamento pos')
    expect(suggestions[0].matchCount).toBe(2)
  })

  it('SUG-08: coverage check strips numeric tokens before regex match — existing pattern covers new rows with numeric tokens', () => {
    // Stored pattern was built from stripped descriptions: no numeric tokens (e.g. no '114').
    // New import rows still carry the numeric reference between non-numeric tokens, so a
    // naive regex test against the full normalizedDescription fails. The fix: also test
    // against the stripped form of the description, matching applyTier1Regex behavior.
    // Phase 46: amountSign removed from CoveragePattern (ADR 0012)
    const coverage: CoveragePattern[] = [{
      pattern: 'revolut\\*\\*5920\\* dublin ie carta n\\. \\*\\*\\*\\*\\* data operazione',
    }]
    const rows = [
      row({
        normalizedDescription: 'revolut**5920* dublin ie carta n. ***** 114 data operazione',
        amount: '-50.00',
      }),
      row({
        normalizedDescription: 'revolut**5920* dublin ie carta n. ***** 115 data operazione',
        amount: '-75.00',
      }),
    ]
    // Both rows are covered by the existing pattern → no new suggestion emitted
    expect(detectPatternSuggestions(rows, coverage)).toHaveLength(0)
  })

  it('SUG-07d: virtual-card rows with numeric reference suffix emit one suggestion', () => {
    // "Revolut **5920* 1505" and "Revolut **5920* 1506": the reference suffix is numeric →
    // stripped, leaving ["revolut", "**5920*"]. The full descriptions differ → different
    // hashes → Tier 2 does NOT cross-match → pattern "revolut \\*\\*5920\\*" is useful.
    const rows = [
      row({ normalizedDescription: 'revolut **5920* 1505' }),
      row({ normalizedDescription: 'revolut **5920* 1506' }),
      row({ normalizedDescription: 'revolut **5920* 1507' }),
    ]
    const suggestions = detectPatternSuggestions(rows, [])
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].pattern).toBe('revolut \\*\\*5920\\*')
    expect(suggestions[0].matchCount).toBe(3)
  })
})
