'use server'
import Decimal from 'decimal.js'
import { verifySession } from '@/lib/dal/auth'
import {
  BulkDeleteTransactionsSchema,
  CreateTransactionSchema,
  DeleteTransactionSchema,
  DetachTransactionSchema,
  parseTransactionFilters,
  UpdateTransactionCustomTitleSchema,
  type TransactionSearchParams,
} from '@/lib/validations/transactions'
import {
  insertManualTransaction,
  mapParsedTransactionFiltersToDal,
  updateTransactionCustomTitle as updateTransactionCustomTitleDAL,
  getTransactions,
  TRANSACTION_LIST_LIMIT,
} from '@/lib/dal/transactions'
import { deleteTransactionsAndReconcileExpenses } from '@/lib/services/transaction-deletion'
import {
  DetachTransactionError,
  detachTransactionToDedicatedExpense,
} from '@/lib/services/transaction-detach'
import { db } from '@/lib/db'
import { toDbDecimal } from '@/lib/utils/decimal'
import type { ActionState } from '@/lib/validations/expense'
import { revalidateCategorizationSurfaces } from '@/lib/actions/revalidation'

type LoadMoreTransactionsInput = {
  filters?: TransactionSearchParams
  offset?: number
}

type LoadMoreTransactionsResult = {
  transactions: Awaited<ReturnType<typeof getTransactions>>
  hasMore: boolean
  error: string | null
}

export async function createTransaction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = CreateTransactionSchema.safeParse({
    description: formData.get('description'),
    amount: formData.get('amount'),
    currency: formData.get('currency') || 'EUR',
    occurredAt: formData.get('occurredAt'),
    subCategoryId: formData.get('subCategoryId')
      ? Number(formData.get('subCategoryId'))
      : undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }
  const { userId } = await verifySession()
  try {
    const normalizedAmount = toDbDecimal(new Decimal(parsed.data.amount.replace(',', '.')))
    const occurredAt = new Date(parsed.data.occurredAt)
    if (Number.isNaN(occurredAt.getTime())) {
      return { error: 'Data non valida.' }
    }
    await insertManualTransaction({
      userId,
      description: parsed.data.description,
      amount: normalizedAmount,
      currency: parsed.data.currency,
      occurredAt,
      subCategoryId: parsed.data.subCategoryId,
    })
  } catch {
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }
  revalidateCategorizationSurfaces()
  return { error: null }
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
    const transactions = await getTransactions(
      mapParsedTransactionFiltersToDal(parseTransactionFilters(filters)),
      {
        limit: TRANSACTION_LIST_LIMIT,
        offset: normalizedOffset,
      },
    )

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
  revalidateCategorizationSurfaces()
  return { error: null }
}

export async function deleteTransaction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = DeleteTransactionSchema.safeParse({
    id: formData.get('id'),
    deleteLinkedExpenses: formData.get('deleteLinkedExpenses'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Transazione non valida.' }
  }
  const { userId } = await verifySession()
  try {
    const result = await deleteTransactionsAndReconcileExpenses({
      userId,
      transactionIds: [parsed.data.id],
      deleteLinkedExpenses: parsed.data.deleteLinkedExpenses,
    })
    if (result.deletedTransactionIds.length === 0) {
      return { error: 'Transazione non trovata o già eliminata.' }
    }
  } catch {
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }
  revalidateCategorizationSurfaces()
  return { error: null }
}

export type DetachTransactionResult = {
  newExpenseId: string
  newExpenseTitle: string
  error: string | null
}

export async function detachTransaction(input: {
  transactionId: string
  title: string
  subCategoryId?: number
}): Promise<DetachTransactionResult> {
  const parsed = DetachTransactionSchema.safeParse(input)
  if (!parsed.success) {
    return {
      newExpenseId: '',
      newExpenseTitle: '',
      error: parsed.error.issues[0]?.message ?? 'Dati non validi.',
    }
  }

  const { userId } = await verifySession()

  try {
    const result = await detachTransactionToDedicatedExpense({
      userId,
      transactionId: parsed.data.transactionId,
      title: parsed.data.title,
      subCategoryId: parsed.data.subCategoryId,
    })
    revalidateCategorizationSurfaces()
    return { ...result, error: null }
  } catch (error) {
    if (error instanceof DetachTransactionError) {
      return { newExpenseId: '', newExpenseTitle: '', error: error.message }
    }
    return {
      newExpenseId: '',
      newExpenseTitle: '',
      error: 'Si è verificato un errore. Riprova tra qualche secondo.',
    }
  }
}

export async function bulkDeleteTransactions(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ids: unknown
  try {
    ids = JSON.parse((formData.get('ids') as string) ?? '[]')
  } catch {
    return { error: 'Selezione non valida.' }
  }
  const parsed = BulkDeleteTransactionsSchema.safeParse({
    ids,
    deleteLinkedExpenses: formData.get('deleteLinkedExpenses'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Selezione non valida.' }
  }
  const { userId } = await verifySession()
  try {
    await deleteTransactionsAndReconcileExpenses({
      userId,
      transactionIds: parsed.data.ids,
      deleteLinkedExpenses: parsed.data.deleteLinkedExpenses,
    })
  } catch {
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }
  revalidateCategorizationSurfaces()
  return { error: null }
}
