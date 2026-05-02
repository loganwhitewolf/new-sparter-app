import 'server-only'
import { and, asc, eq, isNull, or, sql } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import {
  categorizationPattern,
  expense,
  expenseClassificationHistory,
} from '@/lib/db/schema'
import Decimal from 'decimal.js'

export type ActivePattern = {
  id: number
  userId: string | null
  pattern: string
  subCategoryId: number
  amountSign: 'positive' | 'negative' | 'any'
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
      amountSign: categorizationPattern.amountSign,
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

function amountSignMatches(
  amountSign: 'positive' | 'negative' | 'any',
  amount: string,
): boolean {
  if (amountSign === 'any') return true
  try {
    const d = new Decimal(amount)
    if (amountSign === 'positive') return d.greaterThanOrEqualTo(0)
    if (amountSign === 'negative') return d.lessThan(0)
  } catch {
    // unparseable amount — skip sign check
  }
  return true
}

export function applyTier1Regex(
  description: string,
  amount: string,
  patterns: ActivePattern[],
): CategorizationResult {
  for (const p of patterns) {
    try {
      const regex = new RegExp(p.pattern, 'i')
      if (regex.test(description) && amountSignMatches(p.amountSign, amount)) {
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
  if (plan === 'free') return null

  // Tier 1: regex patterns (basic and pro)
  const tier1 = applyTier1Regex(description, amount, patterns)
  if (tier1) return tier1

  // Tier 2: classification history (basic and pro)
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
