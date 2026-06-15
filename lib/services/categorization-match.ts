// Pure Tier-1 regex matcher — single source of truth for categorization coverage.
//
// This module deliberately carries NO `import 'server-only'` guard so it can be
// imported both from production server code (re-exported by categorization.ts) and
// from plain Node/tsx scripts (e.g. scripts/regex-discovery.ts). The `server-only`
// package throws unconditionally outside a React Server Component context, so a
// script can never import categorization.ts directly; it imports this module instead.

export type ActivePattern = {
  id: number
  userId: string | null
  pattern: string
  subCategoryId: number
  // amountSign removed — Phase 46: patterns are sign-agnostic (amount_sign removed, ADR 0012, supersedes ADR 0008)
  confidence: string
  priority: number
}

export type CategorizationResult = {
  subCategoryId: number
  confidence: string
  patternId: number | null
  source: 'system_pattern' | 'user_pattern'
} | null

// amountSignMatches removed — Phase 46: patterns are sign-agnostic (amount_sign removed, ADR 0012, supersedes ADR 0008)

export function applyTier1Regex(
  description: string,
  amount: string,
  patterns: ActivePattern[],
): CategorizationResult {
  for (const p of patterns) {
    try {
      const regex = new RegExp(p.pattern, 'i')
      const stripped = description.split(/\s+/).filter(t => t.length > 0 && !/^\d+$/.test(t)).join(' ')
      // Phase 46: patterns are sign-agnostic (ADR 0012) — amountSignMatches check removed
      if (regex.test(description) || regex.test(stripped)) {
        const source = p.userId === null ? 'system_pattern' : 'user_pattern'
        return {
          subCategoryId: p.subCategoryId,
          confidence: p.confidence,
          patternId: p.id,
          source,
        }
      }
    } catch {
      // invalid regex pattern — skip and continue, never fail whole import
    }
  }
  return null
}
