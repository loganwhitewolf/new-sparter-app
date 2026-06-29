import 'server-only'
import { and, desc, eq } from 'drizzle-orm'
import type { DbOrTx } from '@/lib/db'
import { expenseClassificationHistory } from '@/lib/db/schema'

export type ClassificationSource = WriteClassificationHistoryInput['source']

export type WriteClassificationHistoryInput = {
  userId: string
  expenseId: string
  fromSubCategoryId?: number | null
  toSubCategoryId: number
  fromStatus?: '1' | '2' | '3' | '4' | null
  toStatus: '1' | '2' | '3' | '4'
  source: 'system_pattern' | 'user_pattern' | 'manual' | 'override' | 'import_default'
  patternId?: number | null
  confidence?: string | null
  note?: string | null
}

export async function writeClassificationHistory(
  tx: DbOrTx,
  input: WriteClassificationHistoryInput,
): Promise<void> {
  await tx.insert(expenseClassificationHistory).values({
    userId: input.userId,
    expenseId: input.expenseId,
    fromSubCategoryId: input.fromSubCategoryId ?? null,
    toSubCategoryId: input.toSubCategoryId,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus,
    source: input.source,
    patternId: input.patternId ?? null,
    confidence: input.confidence ?? null,
    note: input.note ?? null,
  })
}

export async function getLatestClassificationSource(
  database: DbOrTx,
  input: { userId: string; expenseId: string },
): Promise<ClassificationSource | null> {
  const rows = await database
    .select({ source: expenseClassificationHistory.source })
    .from(expenseClassificationHistory)
    .where(
      and(
        eq(expenseClassificationHistory.userId, input.userId),
        eq(expenseClassificationHistory.expenseId, input.expenseId),
      ),
    )
    .orderBy(
      desc(expenseClassificationHistory.createdAt),
      desc(expenseClassificationHistory.id),
    )
    .limit(1)

  return rows[0]?.source ?? null
}
