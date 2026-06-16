import 'server-only'
import { db } from '@/lib/db'
import { getUncategorizedExpensesForDiscovery } from '@/lib/dal/regex-discovery'
import { loadActivePatterns } from '@/lib/services/categorization'
import {
  detectPatternSuggestionsWithMeta,
  type PatternDetectorRowWithMeta,
  type PatternSuggestionWithMeta,
} from '@/lib/utils/pattern-suggestions'
import { normalizeDescription } from '@/lib/utils/import'

export type DiscoveryScope = { platformId: number }

export type DiscoveryResult = {
  candidates: PatternSuggestionWithMeta[]
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
      amount: null, // amount not needed for description-only discovery clustering
      valid: true,
      covered: false,
      rawTitle,
      strippedByNormalization: stripped !== rawTitle,
    }
  })

  // 4. Delegate to pure util — coverage filtering + prefix/variable clustering
  const candidates = detectPatternSuggestionsWithMeta(detectorRows, activePatterns)
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, 10) // cap at 10; Phase 55 renders these in the import summary

  return {
    candidates,
    totalUncategorized: expenses.length,
    platformId: scope.platformId,
  }
}
