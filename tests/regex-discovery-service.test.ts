import { describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks (vi.hoisted runs before module imports)
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  getUncategorizedExpensesForDiscovery: vi.fn(),
  loadActivePatterns: vi.fn(),
}))

// Mock server-only to avoid Next.js server boundary errors in tests
vi.mock('server-only', () => ({}))

// Mock the DAL query — we do NOT mock detectPatternSuggestionsWithMeta or normalizeDescription
// so real clustering + normalization run against the fixture data
vi.mock('@/lib/dal/regex-discovery', () => ({
  getUncategorizedExpensesForDiscovery: mocks.getUncategorizedExpensesForDiscovery,
}))

// Mock categorization service for loadActivePatterns
vi.mock('@/lib/services/categorization', () => ({
  loadActivePatterns: mocks.loadActivePatterns,
}))

// Mock db — the service passes db straight to the mocked loadActivePatterns
vi.mock('@/lib/db', () => ({
  db: {},
}))

import { discoverRegexCandidates } from '../lib/services/regex-discovery'

// ---------------------------------------------------------------------------
// Fineco DoD fixture
// The three expenses share the Fineco descriptionStripPattern: '\s+Carta N\..*$'
// Their titles do NOT contain the strip suffix, so strippedByNormalization = false
// for these rows — the strip is a no-op because the raw title has no "Carta N." tail.
// After normalizeDescription they become:
//   "bonifico andrea bernardini causale stipendio marzo"
//   "bonifico andrea bernardini causale stipendio maggio"
//   "bonifico andrea bernardini causale stipendio giugno"
// The shared stable prefix is "bonifico andrea bernardini causale stipendio"
// ---------------------------------------------------------------------------
const FINECO_STRIP_PATTERN = '\\s+Carta N\\..*$'
const FINECO_PLATFORM_ID = 5

const finecoExpenses = [
  {
    id: 'exp-1',
    title: 'Bonifico Andrea Bernardini causale stipendio marzo',
    descriptionHash: 'hash1',
    descriptionStripPattern: FINECO_STRIP_PATTERN,
  },
  {
    id: 'exp-2',
    title: 'Bonifico Andrea Bernardini causale stipendio maggio',
    descriptionHash: 'hash2',
    descriptionStripPattern: FINECO_STRIP_PATTERN,
  },
  {
    id: 'exp-3',
    title: 'Bonifico Andrea Bernardini causale stipendio giugno',
    descriptionHash: 'hash3',
    descriptionStripPattern: FINECO_STRIP_PATTERN,
  },
]

describe('discoverRegexCandidates', () => {
  it('SC-4: Fineco DoD anchor — three salary transfers yield one candidate with expected stable prefix', async () => {
    mocks.getUncategorizedExpensesForDiscovery.mockResolvedValueOnce(finecoExpenses)
    // Empty active patterns — DoD text is NOT pre-covered, survives as Set B
    mocks.loadActivePatterns.mockResolvedValueOnce([])

    const result = await discoverRegexCandidates({
      userId: 'user-1',
      scope: { platformId: FINECO_PLATFORM_ID },
    })

    // totalUncategorized echoes Set B size
    expect(result.totalUncategorized).toBe(3)
    // platformId echoes scope
    expect(result.platformId).toBe(FINECO_PLATFORM_ID)
    // Exactly one candidate
    expect(result.candidates).toHaveLength(1)

    const candidate = result.candidates[0]
    // Stable prefix contains the invariant portion of all three titles
    expect(candidate.stablePrefix).toContain('bonifico andrea bernardini causale stipendio')
    // D-05 fields must be present and non-empty
    expect(candidate.stablePrefix).toBeTruthy()
    expect(candidate.residualVariablePart).toBeTruthy()
    expect(candidate.sampleNormalized).toBeTruthy()
    expect(typeof candidate.strippedByNormalization).toBe('boolean')
  })

  it('PIPE-02: standalone callable — resolves with only userId + platformId, no import context', async () => {
    mocks.getUncategorizedExpensesForDiscovery.mockResolvedValueOnce(finecoExpenses)
    mocks.loadActivePatterns.mockResolvedValueOnce([])

    // The call takes no fileId, no parsed rows, no R2 handle — proving standalone callability
    const result = await discoverRegexCandidates({
      userId: 'user-standalone',
      scope: { platformId: 99 },
    })

    expect(result).toBeDefined()
    expect(result.platformId).toBe(99)
    // DAL was called with the right args
    expect(mocks.getUncategorizedExpensesForDiscovery).toHaveBeenCalledWith('user-standalone', 99)
  })

  it('PIPE-03: strip before cluster — Carta N. suffix is removed before clustering', async () => {
    // An expense whose title DOES carry the strip suffix
    const expensesWithSuffix = [
      {
        id: 'exp-a',
        title: 'Bonifico Andrea Bernardini causale stipendio marzo Carta N. 1234',
        descriptionHash: 'hasha',
        descriptionStripPattern: FINECO_STRIP_PATTERN,
      },
      {
        id: 'exp-b',
        title: 'Bonifico Andrea Bernardini causale stipendio maggio Carta N. 5678',
        descriptionHash: 'hashb',
        descriptionStripPattern: FINECO_STRIP_PATTERN,
      },
      {
        id: 'exp-c',
        title: 'Bonifico Andrea Bernardini causale stipendio giugno Carta N. 9012',
        descriptionHash: 'hashc',
        descriptionStripPattern: FINECO_STRIP_PATTERN,
      },
    ]

    mocks.getUncategorizedExpensesForDiscovery.mockResolvedValueOnce(expensesWithSuffix)
    mocks.loadActivePatterns.mockResolvedValueOnce([])

    const result = await discoverRegexCandidates({
      userId: 'user-strip',
      scope: { platformId: FINECO_PLATFORM_ID },
    })

    expect(result.candidates).toHaveLength(1)
    const candidate = result.candidates[0]

    // The strip removed the "Carta N." suffix — it must NOT appear in sampleNormalized or residualVariablePart
    expect(candidate.sampleNormalized).not.toContain('carta n')
    if (candidate.residualVariablePart) {
      expect(candidate.residualVariablePart).not.toContain('carta n')
    }
    // strippedByNormalization must be true — the strip pattern altered at least one row's title
    expect(candidate.strippedByNormalization).toBe(true)
  })

  it('PIPE-01: coverage filter — a candidate covered by an active pattern is excluded', async () => {
    mocks.getUncategorizedExpensesForDiscovery.mockResolvedValueOnce(finecoExpenses)
    // Active pattern matching "bonifico" — covers all DoD rows
    mocks.loadActivePatterns.mockResolvedValueOnce([{ pattern: 'bonifico', id: 'pat-1', userId: null, confidence: '1.00' }])

    const result = await discoverRegexCandidates({
      userId: 'user-covered',
      scope: { platformId: FINECO_PLATFORM_ID },
    })

    // All DoD rows are covered by the active pattern — no candidates should emerge
    expect(result.candidates).toHaveLength(0)
    // totalUncategorized still reports the raw Set B count (fetch is separate from clustering)
    expect(result.totalUncategorized).toBe(3)
  })
})
