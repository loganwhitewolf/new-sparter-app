import 'server-only'
import Decimal from 'decimal.js'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import type { DbOrTx } from '@/lib/db'
import { expense } from '@/lib/db/schema'
import { writeClassificationHistory } from '@/lib/dal/classification-history'
import { normalizeDescription } from '@/lib/utils/import'

function errorCause(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'cause' in error
    ? (error as { cause?: unknown }).cause
    : undefined
}

function totalAmountMatchesSign(
  sign: 'positive' | 'negative' | 'any',
  totalAmount: string,
): boolean {
  if (sign === 'any') return true
  try {
    const d = new Decimal(totalAmount)
    if (sign === 'positive') return d.greaterThanOrEqualTo(0)
    if (sign === 'negative') return d.lessThan(0)
  } catch {
    return false
  }
  return false
}

export async function applyNewPatternToExpenses(
  database: DbOrTx,
  userId: string,
  patternId: number,
  patternString: string,
  subCategoryId: number,
  amountSign: 'positive' | 'negative' | 'any',
  confidence: number,
): Promise<number> {
  console.info('[applyNewPatternToExpenses] start', { userId, patternId, patternString, amountSign, confidence })

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
      return (regex.test(normalized) || regex.test(stripped)) && totalAmountMatchesSign(amountSign, e.totalAmount)
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
