import 'server-only'
import { and, asc, eq, isNull, or, sql } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import {
  categorizationPattern,
  expense,
  expenseClassificationHistory,
} from '@/lib/db/schema'
import {
  canUseHistoryCategorization,
  canUseRegexCategorization,
} from '@/lib/config/categorization'

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

export async function loadActivePatterns(
  database: DbOrTx,
  userId: string,
): Promise<ActivePattern[]> {
  const rows = await database
    .select({
      id: categorizationPattern.id,
      userId: categorizationPattern.userId,
      pattern: categorizationPattern.pattern,
      subCategoryId: categorizationPattern.subCategoryId,
      // amountSign removed — Phase 46: patterns are sign-agnostic (ADR 0012)
      confidence: categorizationPattern.confidence,
      priority: categorizationPattern.priority,
    })
    .from(categorizationPattern)
    .where(
      and(
        eq(categorizationPattern.isActive, true),
        or(
          isNull(categorizationPattern.userId),
          eq(categorizationPattern.userId, userId),
        ),
      ),
    )
    .orderBy(
      sql`case when ${categorizationPattern.userId} is null then 1 else 0 end`,
      asc(categorizationPattern.priority),
    )

  return rows as ActivePattern[]
}

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

export async function applyTier2History(
  database: DbOrTx,
  userId: string,
  descriptionHash: string,
): Promise<number | null> {
  // Find the most frequent manual classification for this descriptionHash with weight >= 3.
  // Uses raw SQL count so we can apply HAVING without Drizzle alias issues.
  const rows = await database
    .select({
      toSubCategoryId: expenseClassificationHistory.toSubCategoryId,
      weight: sql<number>`count(${expenseClassificationHistory.id})::int`,
    })
    .from(expenseClassificationHistory)
    .innerJoin(expense, eq(expenseClassificationHistory.expenseId, expense.id))
    .where(
      and(
        eq(expenseClassificationHistory.userId, userId),
        eq(expense.descriptionHash, descriptionHash),
        eq(expenseClassificationHistory.source, 'manual'),
      ),
    )
    .groupBy(expenseClassificationHistory.toSubCategoryId)
    .having(sql`count(${expenseClassificationHistory.id}) >= 3`)
    .orderBy(sql`count(${expenseClassificationHistory.id}) desc`)
    .limit(1)
    .catch(() => [] as { toSubCategoryId: number | null; weight: number }[])

  return rows[0]?.toSubCategoryId ?? null
}

export type SubscriptionPlan = 'free' | 'basic' | 'pro'

export async function categorizePipeline(
  database: DbOrTx,
  userId: string,
  plan: SubscriptionPlan,
  description: string,
  amount: string,
  descriptionHash: string,
  patterns: ActivePattern[],
): Promise<CategorizationResult> {
  // Alpha default: regex categorization is available to every plan. The minimum
  // plan is configurable through CATEGORIZATION_REGEX_MIN_PLAN for post-alpha
  // pricing changes without touching the pipeline logic.
  if (canUseRegexCategorization(plan)) {
    const tier1 = applyTier1Regex(description, amount, patterns)
    if (tier1) return tier1
  }

  // Alpha default: history-based categorization is available to every plan. The
  // minimum plan is configurable through CATEGORIZATION_HISTORY_MIN_PLAN.
  if (!canUseHistoryCategorization(plan)) return null

  const tier2SubCategoryId = await applyTier2History(database, userId, descriptionHash)
  if (tier2SubCategoryId !== null) {
    return {
      subCategoryId: tier2SubCategoryId,
      confidence: '0.70',
      patternId: null,
      source: 'system_pattern',
    }
  }

  return null
}

export { db }
