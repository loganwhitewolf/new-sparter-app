import 'server-only'
import type { DbOrTx } from '@/lib/db'
import { expenseClassificationHistory } from '@/lib/db/schema'

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
