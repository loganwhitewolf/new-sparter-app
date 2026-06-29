import 'server-only'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import type { DbOrTx } from '@/lib/db'
import { expense } from '@/lib/db/schema'
import { writeClassificationHistory } from '@/lib/dal/classification-history'
import { getUncategorizedExpensesForPlatformApply } from '@/lib/dal/regex-discovery'
import { normalizeDescription } from '@/lib/utils/import'

/**
 * Structured result returned by applyNewPatternToPlatformExpenses (APPLY-02).
 *
 * updatedCount:    expenses that matched the pattern and were categorized.
 * notUpdatedCount: expenses within the platform scope that did not match
 *                  (uncategorized.length − updatedCount, single pass).
 *
 * Expenses outside the apply scope (other platforms, already categorized) are
 * NOT included in either count.
 */
export type PatternApplyResult = {
  updatedCount: number
  notUpdatedCount: number
}

function errorCause(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'cause' in error
    ? (error as { cause?: unknown }).cause
    : undefined
}

// totalAmountMatchesSign removed — Phase 46: patterns are sign-agnostic (amount_sign removed, ADR 0012, supersedes ADR 0008)

export async function applyNewPatternToExpenses(
  database: DbOrTx,
  userId: string,
  patternId: number,
  patternString: string,
  subCategoryId: number,
  // amountSign parameter removed — Phase 46: patterns are sign-agnostic (ADR 0012)
  confidence: number,
): Promise<number> {
  console.info('[applyNewPatternToExpenses] start', { userId, patternId, patternString, confidence })

  let regex: RegExp
  try {
    regex = new RegExp(patternString, 'i')
  } catch {
    console.warn('[applyNewPatternToExpenses] invalid regex', { userId, patternId, patternString })
    return 0
  }

  const uncategorized = await database
    .select({ id: expense.id, title: expense.title, totalAmount: expense.totalAmount })
    .from(expense)
    .where(and(eq(expense.userId, userId), isNull(expense.subCategoryId)))
    .orderBy(asc(expense.createdAt))
    .catch((err: unknown) => {
      console.error(
        '[applyNewPatternToExpenses] db error',
        { userId, patternId, stage: 'select' },
        err instanceof Error ? err.message : err,
        errorCause(err),
      )
      throw err
    })

  console.info('[applyNewPatternToExpenses] scanned', { userId, patternId, uncategorizedCount: uncategorized.length })

  const matchingIds = uncategorized
    .filter((e) => {
      const normalized = normalizeDescription(e.title)
      // Patterns generated from suggestions strip pure-numeric tokens (e.g. "114" in
      // "***** 114 data operazione"). Test against both the full normalized title and
      // the stripped form so suggestion-generated patterns still match.
      const stripped = normalized.split(/\s+/).filter(t => t.length > 0 && !/^\d+$/.test(t)).join(' ')
      // Phase 46: patterns are sign-agnostic (ADR 0012) — totalAmountMatchesSign check removed
      return regex.test(normalized) || regex.test(stripped)
    })
    .map((e) => e.id)

  console.info('[applyNewPatternToExpenses] matched', { userId, patternId, matchedCount: matchingIds.length, sample: matchingIds.slice(0, 5) })

  if (matchingIds.length === 0) return 0

  await database
    .update(expense)
    .set({ subCategoryId, status: '3' })
    .where(and(eq(expense.userId, userId), inArray(expense.id, matchingIds)))
    .catch((err: unknown) => {
      console.error(
        '[applyNewPatternToExpenses] db error',
        { userId, patternId, stage: 'update' },
        err instanceof Error ? err.message : err,
        errorCause(err),
      )
      throw err
    })

  console.info('[applyNewPatternToExpenses] updated', { userId, patternId, updatedCount: matchingIds.length })

  for (const expenseId of matchingIds) {
    try {
      await writeClassificationHistory(database, {
        userId,
        expenseId,
        toSubCategoryId: subCategoryId,
        toStatus: '3',
        source: 'user_pattern',
        patternId,
        confidence: confidence.toFixed(2),
      })
    } catch {
      // classification history is non-fatal
    }
  }

  return matchingIds.length
}

/**
 * Platform-scoped retroactive apply (APPLY-02).
 *
 * Applies a newly created pattern to ALL uncategorized expenses for the same
 * platform as the promoted suggestion — never user-wide. This is the apply path
 * for `promoteSuggestionAction`; the legacy `applyNewPatternToExpenses` (user-wide)
 * remains unchanged for `createPatternAction`.
 *
 * Write scope mirrors the Phase 51 D-03 discovery read scope:
 * expense → file → importFormatVersion → platform, isNull(subCategoryId), eq(platform.id).
 *
 * Matcher fidelity: dual-test on full normalized title and numeric-stripped form
 * (copied verbatim from applyNewPatternToExpenses lines 52–61) to preserve
 * Tier-1 suggestion-generated pattern behavior (Pitfall 6).
 *
 * Returns PatternApplyResult with single-pass counts:
 *   updatedCount    = matchingIds.length
 *   notUpdatedCount = uncategorized.length − matchingIds.length
 *
 * Invalid regex returns { updatedCount: 0, notUpdatedCount: uncategorized.length }
 * without throwing (mirrors legacy behavior).
 */
export async function applyNewPatternToPlatformExpenses(
  database: DbOrTx,
  input: {
    userId: string
    platformId: number
    patternId: number
    patternString: string
    subCategoryId: number
    confidence: number
  },
): Promise<PatternApplyResult> {
  const { userId, platformId, patternId, patternString, subCategoryId, confidence } = input

  console.info('[applyNewPatternToPlatformExpenses] start', { userId, platformId, patternId, patternString })

  const uncategorized = await getUncategorizedExpensesForPlatformApply(userId, platformId)

  console.info('[applyNewPatternToPlatformExpenses] scanned', { userId, platformId, uncategorizedCount: uncategorized.length })

  let regex: RegExp
  try {
    regex = new RegExp(patternString, 'i')
  } catch {
    console.warn('[applyNewPatternToPlatformExpenses] invalid regex', { userId, platformId, patternId, patternString })
    return { updatedCount: 0, notUpdatedCount: uncategorized.length }
  }

  const matchingIds = uncategorized
    .filter((e) => {
      // Mirror the discovery pipeline (CR-02): apply import format version descriptionStripPattern before
      // normalizing so patterns generated from stripped titles continue to match on apply.
      const rawTitle = e.title
      const preStripped = e.descriptionStripPattern
        ? rawTitle.replace(new RegExp(e.descriptionStripPattern, 'i'), '').trim()
        : rawTitle
      const normalized = normalizeDescription(preStripped)
      // Patterns generated from suggestions strip pure-numeric tokens (e.g. "114" in
      // "***** 114 data operazione"). Test against both the full normalized title and
      // the stripped form so suggestion-generated patterns still match (Pitfall 6).
      const stripped = normalized.split(/\s+/).filter(t => t.length > 0 && !/^\d+$/.test(t)).join(' ')
      // Phase 46: patterns are sign-agnostic (ADR 0012)
      return regex.test(normalized) || regex.test(stripped)
    })
    .map((e) => e.id)

  console.info('[applyNewPatternToPlatformExpenses] matched', { userId, platformId, patternId, matchedCount: matchingIds.length })

  if (matchingIds.length > 0) {
    await database
      .update(expense)
      .set({ subCategoryId, status: '3' })
      .where(and(eq(expense.userId, userId), inArray(expense.id, matchingIds)))
      .catch((err: unknown) => {
        console.error(
          '[applyNewPatternToPlatformExpenses] db error',
          { userId, platformId, patternId, stage: 'update' },
          err instanceof Error ? err.message : err,
          errorCause(err),
        )
        throw err
      })

    console.info('[applyNewPatternToPlatformExpenses] updated', { userId, platformId, patternId, updatedCount: matchingIds.length })

    for (const expenseId of matchingIds) {
      try {
        await writeClassificationHistory(database, {
          userId,
          expenseId,
          toSubCategoryId: subCategoryId,
          toStatus: '3',
          source: 'user_pattern',
          patternId,
          confidence: confidence.toFixed(2),
        })
      } catch {
        // classification history is non-fatal
      }
    }
  }

  return {
    updatedCount: matchingIds.length,
    notUpdatedCount: uncategorized.length - matchingIds.length,
  }
}
