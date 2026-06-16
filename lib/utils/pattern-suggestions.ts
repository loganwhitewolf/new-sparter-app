// Pure prefix/variable clustering util — shared by the in-app discovery pipeline and
// plain Node/tsx scripts (e.g. scripts/regex-discovery.ts).
//
// This module deliberately carries NO server-only import guard so it can be
// imported both from production server code and from plain Node/tsx scripts. The
// `server-only` package throws unconditionally outside a React Server Component
// context, so a script can never import server-only modules directly; it imports
// this module instead.

export interface PatternDetectorRow {
  description: string
  normalizedDescription: string
  amount: string | null
  valid: boolean
  covered: boolean
}

// Phase 46: patterns are sign-agnostic (ADR 0012) — amountSign removed from CoveragePattern
export interface CoveragePattern {
  pattern: string
}

export interface PatternSuggestion {
  pattern: string
  matchCount: number
  sampleDescriptions: string[]
}

function isNumericToken(token: string): boolean {
  return /^\d+$/.test(token)
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&')
}

// amountSignMatches removed — Phase 46: patterns are sign-agnostic (ADR 0012)
// Coverage is now determined by regex match alone.

function isCoveredByPatterns(
  row: PatternDetectorRow,
  coveragePatterns: CoveragePattern[],
): boolean {
  // Patterns are generated from stripped descriptions (numeric tokens removed), so we must
  // also test the stripped form here — otherwise a pattern like "revolut\*\*5920\* … data
  // operazione" won't match a description that still has a numeric reference ("114") between
  // the non-numeric tokens. Mirrors the dual-test logic in applyTier1Regex.
  const strippedDescription = stripNumericTokens(row.normalizedDescription).join(' ')
  for (const p of coveragePatterns) {
    try {
      const regex = new RegExp(p.pattern, 'i')
      // Phase 46: patterns are sign-agnostic (ADR 0012) — coverage is regex-match only
      if (regex.test(row.normalizedDescription) || regex.test(strippedDescription)) {
        return true
      }
    } catch {
      // invalid regex pattern — skip and continue
    }
  }
  return false
}

function stripNumericTokens(normalized: string): string[] {
  return normalized.split(/\s+/).filter(t => t.length > 0 && !isNumericToken(t))
}

function longestCommonPrefix(a: string[], b: string[]): string[] {
  const result: string[] = []
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) break
    result.push(a[i])
  }
  return result
}

// inferAmountSign removed — ADR 0012: patterns are sign-agnostic

export function detectPatternSuggestions(
  rows: PatternDetectorRow[],
  coveragePatterns: CoveragePattern[],
): PatternSuggestion[] {
  // Step 1: filter eligible rows and compute stripped tokens; drop rows with <2 stripped tokens
  type Candidate = { row: PatternDetectorRow; tokens: string[] }
  const candidates: Candidate[] = []
  for (const r of rows) {
    if (!r.valid) continue
    if (r.covered) continue
    if (isCoveredByPatterns(r, coveragePatterns)) continue
    const tokens = stripNumericTokens(r.normalizedDescription)
    if (tokens.length < 2) continue
    candidates.push({ row: r, tokens })
  }

  // Step 2: bucket by first 2 stripped tokens — any qualifying suggestion (min prefix
  // length = 2) must share the same first 2 tokens. Bucketing at this granularity
  // prevents outliers with a different second token from collapsing unrelated subgroups.
  const buckets = new Map<string, Candidate[]>()
  for (const c of candidates) {
    const head = c.tokens.slice(0, 2).join(' ')
    const list = buckets.get(head) ?? []
    list.push(c)
    buckets.set(head, list)
  }

  // Step 3: for each bucket with >=2 members, compute the longest prefix
  // shared by ALL members (intersect down). If the shared prefix has >=2 tokens,
  // emit one suggestion.
  const suggestions: PatternSuggestion[] = []
  for (const group of buckets.values()) {
    if (group.length < 2) continue
    let prefix = group[0].tokens
    for (let i = 1; i < group.length; i++) {
      prefix = longestCommonPrefix(prefix, group[i].tokens)
      if (prefix.length < 2) break
    }
    if (prefix.length < 2) continue

    const prefixString = prefix.join(' ')
    const escaped = escapeRegex(prefixString)
    const sampleDescriptions = group.slice(0, 3).map(g => g.row.description)

    suggestions.push({
      pattern: escaped,
      matchCount: group.length,
      sampleDescriptions,
    })
  }

  return suggestions
}

// ---------------------------------------------------------------------------
// WithMeta variant — additive extension for PIPE-03 (D-05 per-candidate metadata)
// ---------------------------------------------------------------------------

export interface PatternDetectorRowWithMeta extends PatternDetectorRow {
  /** Raw (pre-strip) title for D-05 reporting */
  rawTitle: string
  /** Whether descriptionStripPattern altered rawTitle before normalizeDescription was called */
  strippedByNormalization: boolean
  /** Stable content hash for deduping grouped descriptions against manual history */
  descriptionHash: string | null
}

export interface PatternSuggestionWithMeta extends PatternSuggestion {
  /** Shared prefix tokens joined, pre-escape (human-readable stable portion) */
  stablePrefix: string
  /** True if at least one sample had its description altered by the platform strip pattern */
  strippedByNormalization: boolean
  /** Example residual variable text beyond the stable prefix (from first sample description) */
  residualVariablePart: string
  /** One sample normalized description (post-strip, post-normalizeDescription) */
  sampleNormalized: string
  /** Hashes for all grouped member descriptions, with legacy nulls filtered out */
  descriptionHashes: string[]
}

export function candidateCoveredByExistingPattern(
  candidate: PatternSuggestionWithMeta,
  coveragePatterns: CoveragePattern[],
): boolean {
  const strippedDescription = stripNumericTokens(candidate.sampleNormalized).join(' ')
  for (const p of coveragePatterns) {
    try {
      const regex = new RegExp(p.pattern, 'i')
      if (regex.test(candidate.sampleNormalized) || regex.test(strippedDescription)) {
        return true
      }
    } catch {
      // invalid regex pattern — skip and continue
    }
  }
  return false
}

/**
 * Identical clustering pipeline as detectPatternSuggestions, extended to carry
 * per-candidate D-05 metadata. The input rows must include rawTitle and
 * strippedByNormalization (computed by the caller before normalization runs).
 *
 * The original detectPatternSuggestions and PatternSuggestion are unchanged so
 * the existing analyzeFile caller in lib/services/import.ts keeps compiling.
 */
export function detectPatternSuggestionsWithMeta(
  rows: PatternDetectorRowWithMeta[],
  coveragePatterns: CoveragePattern[],
): PatternSuggestionWithMeta[] {
  // Step 1: filter eligible rows and compute stripped tokens; drop rows with <2 stripped tokens
  type Candidate = { row: PatternDetectorRowWithMeta; tokens: string[] }
  const candidates: Candidate[] = []
  for (const r of rows) {
    if (!r.valid) continue
    if (r.covered) continue
    if (isCoveredByPatterns(r, coveragePatterns)) continue
    const tokens = stripNumericTokens(r.normalizedDescription)
    if (tokens.length < 2) continue
    candidates.push({ row: r, tokens })
  }

  // Step 2: bucket by first 2 stripped tokens
  const buckets = new Map<string, Candidate[]>()
  for (const c of candidates) {
    const head = c.tokens.slice(0, 2).join(' ')
    const list = buckets.get(head) ?? []
    list.push(c)
    buckets.set(head, list)
  }

  // Step 3: compute longest common prefix per bucket; emit WithMeta suggestions
  const suggestions: PatternSuggestionWithMeta[] = []
  for (const group of buckets.values()) {
    if (group.length < 2) continue
    let prefix = group[0].tokens
    for (let i = 1; i < group.length; i++) {
      prefix = longestCommonPrefix(prefix, group[i].tokens)
      if (prefix.length < 2) break
    }
    if (prefix.length < 2) continue

    const prefixString = prefix.join(' ')
    const escaped = escapeRegex(prefixString)
    const sampleDescriptions = group.slice(0, 3).map(g => g.row.description)
    const descriptionHashes = group
      .map(g => g.row.descriptionHash)
      .filter((hash): hash is string => hash !== null)

    // D-05: stablePrefix is the human-readable joined prefix (pre-escape)
    const stablePrefix = prefixString

    // D-05: residualVariablePart — tokens of the first sample beyond the stable prefix
    const firstNormalized = group[0].row.normalizedDescription
    const firstTokens = stripNumericTokens(firstNormalized)
    const residualTokens = firstTokens.slice(prefix.length)
    const residualVariablePart = residualTokens.join(' ')

    // D-05: sampleNormalized — normalized description of the first grouped row
    const sampleNormalized = firstNormalized

    // D-05: strippedByNormalization — true if ANY member row was stripped
    const strippedByNormalization = group.some(g => g.row.strippedByNormalization)

    suggestions.push({
      pattern: escaped,
      matchCount: group.length,
      sampleDescriptions,
      stablePrefix,
      strippedByNormalization,
      residualVariablePart,
      sampleNormalized,
      descriptionHashes,
    })
  }

  return suggestions
}
