'use server'
import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/dal/auth'
import {
  parseTransactionFilters,
  UpdateTransactionCustomTitleSchema,
  type TransactionSearchParams,
} from '@/lib/validations/transactions'
import {
  updateTransactionCustomTitle as updateTransactionCustomTitleDAL,
  getTransactions,
  TRANSACTION_LIST_LIMIT,
} from '@/lib/dal/transactions'
import { db } from '@/lib/db'
import type { ActionState } from '@/lib/validations/expense'
import { APP_ROUTES } from '../routes'

type LoadMoreTransactionsInput = {
  filters?: TransactionSearchParams
  offset?: number
}

type LoadMoreTransactionsResult = {
  transactions: Awaited<ReturnType<typeof getTransactions>>
  hasMore: boolean
  error: string | null
}

function normalizeOffset(offset: number | undefined): number {
  const normalizedOffset = offset ?? 0

  if (!Number.isInteger(normalizedOffset) || normalizedOffset < 0) {
    return 0
  }

  return normalizedOffset
}

export async function loadMoreTransactions({
  filters = {},
  offset,
}: LoadMoreTransactionsInput): Promise<LoadMoreTransactionsResult> {
  try {
    const normalizedOffset = normalizeOffset(offset)
    const transactions = await getTransactions(parseTransactionFilters(filters), {
      limit: TRANSACTION_LIST_LIMIT,
      offset: normalizedOffset,
    })

    return {
      transactions,
      hasMore: transactions.length === TRANSACTION_LIST_LIMIT,
      error: null,
    }
  } catch {
    return {
      transactions: [],
      hasMore: false,
      error: 'Non è stato possibile caricare altre transazioni. Riprova.',
    }
  }
}

export async function updateTransactionCustomTitle(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = UpdateTransactionCustomTitleSchema.safeParse({
    id: formData.get('id'),
    customTitle: formData.get('customTitle'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }
  const { userId } = await verifySession()
  try {
    await updateTransactionCustomTitleDAL(
      db,
      parsed.data.id,
      userId,
      parsed.data.customTitle,
    )
  } catch {
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }
  revalidatePath(APP_ROUTES.transactions)
  return { error: null }
}
