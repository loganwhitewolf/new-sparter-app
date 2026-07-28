import 'server-only'

import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import type { DbOrTx } from '@/lib/db'
import {
  amortizationInstalment,
  amortizationPlan,
  expense,
  transaction as transactionTable,
} from '@/lib/db/schema'
import { applyDetachCleanupTx } from '@/lib/services/transaction-detach'
import { materializeInstalments, validateMonthsForAmount } from '@/lib/services/amortization-math'
import { toDbDecimal, toDecimal } from '@/lib/utils/decimal'
import type { Instalment } from '@/lib/services/amortization-math'

export type ActivatePlanErrorCode = 'TRANSACTION_NOT_FOUND' | 'INVALID_MONTHS'

export class ActivatePlanError extends Error {
  readonly code: ActivatePlanErrorCode

  constructor(code: ActivatePlanErrorCode, message: string) {
    super(message)
    this.name = 'ActivatePlanError'
    this.code = code
  }
}

export type ActivatePlanInput = {
  userId: string
  transactionId: string
  months: number
}

export type ActivatePlanResult = {
  planId: string
  expenseId: string
  instalments: Instalment[]
}

/**
 * Tx-accepting activation core (D-03/AMORT-02): loads the transaction (ownership-checked,
 * mirroring applyDetachCleanupTx's own SELECT+join+WHERE), forces the D-03 detach into a
 * Standalone Expense (preserving the transaction's current subCategory), inserts one
 * amortization_plan row, then materialises + bulk-inserts N amortization_instalment rows. All
 * writes run against the SAME passed-in `tx` — no nested db.transaction call, so callers can
 * compose this inside a larger db.transaction (matching applyDetachCleanupTx's own pattern).
 *
 * Eligibility (D-04..D-07 + outflow-only) is NOT checked here — that guard call is wired in by
 * the eligibility-guards task as the first step of this function; this tracer proves the
 * detach+plan+instalment write path end-to-end on an already-eligible transaction.
 */
export async function activatePlanTx(
  tx: DbOrTx,
  input: ActivatePlanInput,
): Promise<ActivatePlanResult> {
  const rows = await tx
    .select({
      transactionId: transactionTable.id,
      amount: transactionTable.amount,
      occurredAt: transactionTable.occurredAt,
      customTitle: transactionTable.customTitle,
      description: transactionTable.description,
      expenseId: transactionTable.expenseId,
      subCategoryId: expense.subCategoryId,
    })
    .from(transactionTable)
    .innerJoin(expense, eq(transactionTable.expenseId, expense.id))
    .where(
      and(
        eq(transactionTable.id, input.transactionId),
        eq(transactionTable.userId, input.userId),
        eq(expense.userId, input.userId),
      ),
    )
    .limit(1)

  const row = rows[0]
  if (!row) {
    throw new ActivatePlanError('TRANSACTION_NOT_FOUND', 'Transazione non trovata.')
  }

  // Defense-in-depth (T-77-02): re-validate server-side even though the dialog already blocks an
  // invalid N client-side — a stale/tampered request must never reach the write below.
  const validation = validateMonthsForAmount(row.amount, input.months)
  if (!validation.valid) {
    throw new ActivatePlanError('INVALID_MONTHS', validation.reason ?? 'Mesi non validi.')
  }

  const detachResult = await applyDetachCleanupTx(tx, {
    userId: input.userId,
    transactionId: input.transactionId,
    title: row.customTitle?.trim() || row.description,
    subCategoryId: row.subCategoryId,
  })

  const planId = randomUUID()
  const instalments = materializeInstalments(row.amount, row.occurredAt, input.months)

  await tx.insert(amortizationPlan).values({
    id: planId,
    userId: input.userId,
    transactionId: input.transactionId,
    months: input.months,
    startDate: row.occurredAt,
    status: 'open',
    totalAmount: toDbDecimal(toDecimal(row.amount)),
  })

  await tx.insert(amortizationInstalment).values(
    instalments.map((instalment, index) => ({
      id: randomUUID(),
      userId: input.userId,
      planId,
      instalmentNumber: index + 1,
      expenseId: detachResult.newExpenseId,
      amount: instalment.amount,
      occurredAt: instalment.date,
    })),
  )

  return { planId, expenseId: detachResult.newExpenseId, instalments }
}
