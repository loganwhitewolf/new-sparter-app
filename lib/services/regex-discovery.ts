import 'server-only'
import { db } from '@/lib/db'
import {
  getManuallyCategorizedHashes,
  getUncategorizedExpensesForDiscovery,
} from '@/lib/dal/regex-discovery'
import { loadActivePatterns } from '@/lib/services/categorization'
import {
  candidateCoveredByExistingPattern,
  detectPatternSuggestionsWithMeta,
  type PatternDetectorRowWithMeta,
  type PatternSuggestionWithMeta,
} from '@/lib/utils/pattern-suggestions'
import { normalizeDescription } from '@/lib/utils/import'

export type DiscoveryScope = { platformId: number }

export type SingleCategorizationSuggestion = {
  normalizedDescription: string
  sampleDescriptions: string[]
  sampleAmounts: (string | null)[]
  matchCount: number
  descriptionHashes: string[]
}

export type DiscoveryResult = {
  candidates: PatternSuggestionWithMeta[]
  singleCategorizationSuggestions: SingleCategorizationSuggestion[]
  totalUncategorized: number
  platformId: number
}

/**
 * Applies the platform descriptionStripPattern (a seed/operator-controlled value)
 * to the raw title. The pattern is compiled once per-call in the service and is
 * never derived from user-supplied free text (T-51-07).
 */
function applyStrip(rawTitle: string, stripPattern: string | null): string {
  if (!stripPattern) return rawTitle
  try {
    return rawTitle.replace(new RegExp(stripPattern, 'i'), '').trim()
  } catch {
    return rawTitle
  }
}

function toSingleCategorization(
  suggestion: PatternSuggestionWithMeta,
): SingleCategorizationSuggestion {
  return {
    normalizedDescription: suggestion.sampleNormalized,
    sampleDescriptions: suggestion.sampleDescriptions,
    sampleAmounts: suggestion.sampleAmounts,
    matchCount: suggestion.matchCount,
    descriptionHashes: suggestion.descriptionHashes,
  }
}

/**
 * Fetches the persisted uncategorized expense set (Set B) for a given userId and
 * platformId, applies platform normalization (strip + normalizeDescription), loads
 * active patterns for coverage filtering, then delegates prefix/variable clustering
 * to detectPatternSuggestionsWithMeta.
 *
 * Designed as a standalone service (PIPE-02): callable with userId + platformId only,
 * with no fileId, no parsed file bytes, no R2 handle, and no db.transaction.
 * Discovery runs post-import (D-01) after categorizePipeline has committed results.
 *
 * Shaped to support both Phase 54 entry points (post-import auto-run + Files-table
 * on-demand) without building them here.
 *
 * Auth responsibility lies with the caller; this service does not call verifySession.
 */
export async function discoverRegexCandidates(input: {
  userId: string
  scope: DiscoveryScope
}): Promise<DiscoveryResult> {
  const { userId, scope } = input

  // 1. Fetch Set B — persisted uncategorized expenses for this user + platform
  const expenses = await getUncategorizedExpensesForDiscovery(userId, scope.platformId)

  // 2. Load active patterns for coverage filtering (excludes Set A / already-covered descriptions)
  const activePatterns = await loadActivePatterns(db, userId)

  // 3. Apply strip normalization and build detector rows (D-03: platform-scoped, PIPE-03)
  // descriptionStripPattern is identical for all rows (it is a platform-level value)
  const stripPattern = expenses[0]?.descriptionStripPattern ?? null

  const detectorRows: PatternDetectorRowWithMeta[] = expenses.map((e) => {
    const rawTitle = e.title
    const stripped = applyStrip(rawTitle, stripPattern)
    const normalizedDescription = normalizeDescription(stripped)
    return {
      description: rawTitle, // human-readable label for sampleDescriptions
      normalizedDescription,
      amount: e.totalAmount,
      valid: true,
      covered: false,
      rawTitle,
      strippedByNormalization: stripped !== rawTitle,
      descriptionHash: e.descriptionHash ?? null,
    }
  })

  // 4. Delegate to pure util — coverage filtering + prefix/variable clustering
  const clustered = detectPatternSuggestionsWithMeta(detectorRows, activePatterns)

  // 5. RDISC-01/02: non-empty residuals are regex families; empty residuals are
  // identical-after-normalization groups surfaced as single-categorization suggestions.
  let regexFamilies = clustered.filter(s => s.residualVariablePart.trim() !== '')
  const identicalGroups = clustered.filter(s => s.residualVariablePart.trim() === '')

  // 6. RDISC-03 Check 1: drop regex families covered by an existing active pattern.
  regexFamilies = regexFamilies.filter(
    s => !candidateCoveredByExistingPattern(s, activePatterns),
  )

  // 7. RDISC-04 Check 2: drop any regex or single suggestion with a member hash the
  // user has already manually categorized anywhere in their history.
  const allHashes = [...regexFamilies, ...identicalGroups].flatMap(s => s.descriptionHashes)
  const manualHashes = await getManuallyCategorizedHashes(userId, allHashes)
  const notManuallyCovered = (s: { descriptionHashes: string[] }) =>
    !s.descriptionHashes.some(hash => manualHashes.has(hash))

  const candidates = regexFamilies
    .filter(notManuallyCovered)
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, 10) // cap at 10; Phase 55 renders these in the import summary

  const singleCategorizationSuggestions = identicalGroups
    .filter(notManuallyCovered)
    .map(toSingleCategorization)
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, 10)

  return {
    candidates,
    singleCategorizationSuggestions,
    totalUncategorized: expenses.length,
    platformId: scope.platformId,
  }
}
