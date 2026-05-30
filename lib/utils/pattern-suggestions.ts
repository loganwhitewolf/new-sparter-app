import Decimal from 'decimal.js'

export interface PatternDetectorRow {
  description: string
  normalizedDescription: string
  amount: string | null
  valid: boolean
  covered: boolean
}

export interface CoveragePattern {
  pattern: string
  amountSign: 'positive' | 'negative' | 'any'
}

export interface PatternSuggestion {
  pattern: string
  matchCount: number
  detectedAmountSign: 'positive' | 'negative' | 'any'
  sampleDescriptions: string[]
}

function isNumericToken(token: string): boolean {
  return /^\d+$/.test(token)
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&')
}

function amountSignMatches(
  amountSign: 'positive' | 'negative' | 'any',
  amount: string | null,
): boolean {
  if (amountSign === 'any') return true
  if (amount === null) return false
  try {
    const d = new Decimal(amount)
    if (amountSign === 'positive') return d.greaterThanOrEqualTo(0)
    if (amountSign === 'negative') return d.lessThan(0)
  } catch {
    // unparseable amount — cannot confirm sign, do not claim coverage
  }
  return false
}

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
      if (
        (regex.test(row.normalizedDescription) || regex.test(strippedDescription)) &&
        amountSignMatches(p.amountSign, row.amount)
      ) {
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

function inferAmountSign(amounts: (string | null)[]): 'positive' | 'negative' | 'any' {
  const signs = new Set<'positive' | 'negative'>()
  for (const amount of amounts) {
    if (amount === null) continue
    try {
      const d = new Decimal(amount)
      if (d.lessThan(0)) signs.add('negative')
      else signs.add('positive')
    } catch {
      // unparseable — skip
    }
  }
  if (signs.size === 1) {
    return signs.has('positive') ? 'positive' : 'negative'
  }
  return 'any'
}

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
    const amounts = group.map(g => g.row.amount)
    const sampleDescriptions = group.slice(0, 3).map(g => g.row.description)

    suggestions.push({
      pattern: escaped,
      matchCount: group.length,
      detectedAmountSign: inferAmountSign(amounts),
      sampleDescriptions,
    })
  }

  return suggestions
}
