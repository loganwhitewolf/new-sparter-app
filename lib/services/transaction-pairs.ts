import 'server-only'

import { and, eq } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import {
  expense,
  expenseGroup,
  expenseGroupMembership,
  reimbursement,
  reimbursementAnchorTransaction,
  reimbursementRefund,
  reimbursementRefundSnapshot,
  transaction,
} from '@/lib/db/schema'
import {
  assertInflowRefundAmount,
  assertOutflowAnchorAmount,
} from '@/lib/services/reimbursement-invariant'
import { applyDetachCleanupTx } from '@/lib/services/transaction-detach'
import { toDbDecimal, toDecimal } from '@/lib/utils/decimal'

/**
 * Extract the Postgres SQLSTATE error code from a Drizzle/pg error's `cause`.
 * Returns '' when no code is present. Used to detect unique-constraint
 * violations (23505) and surface a localized message (WR-03).
 */
function errorCauseCode(error: unknown): string {
  const cause =
    typeof error === 'object' && error !== null && 'cause' in error
      ? (error as { cause?: unknown }).cause
      : undefined

  if (typeof cause !== 'object' || cause === null || !('code' in cause)) {
    return ''
  }

  const code = (cause as { code?: unknown }).code
  return typeof code === 'string' ? code : ''
}

export type CreatePairResult = {
  /** The resolved secondary (refund) transaction id — used by the UI to repaint the row. */
  secondaryTransactionId: string
  /** The subcategory inherited by the refund expense, or undefined when the refund
   *  cleanup was skipped (donor uncategorized / defensive skip — decision 2). */
  inheritedSubCategoryId?: number
}

/**
 * Anchor shape (D-01/D-03, Phase 75 Plan 02, ADR 0018): either a single Expense-backed
 * transaction (today's 1:1/1:N case) or an Expense Group (the M:N case, RMB-08). Exactly one
 * of these resolves — never both — mirroring the DB's `reimbursement_anchor_xor` CHECK.
 */
export type CreatePairAnchor = { transactionId: string } | { groupId: number }

export type CreatePairInput = {
  userId: string
  counterpartId: string
  anchor: CreatePairAnchor
}

/**
 * Create-or-append core (D-05/D-06/D-08, Phase 75 Plan 02): accepts a `DbOrTx` so a future
 * caller that needs to link several refunds atomically (Plan 75-04's multi-select picker) can
 * run multiple `createPairTx` calls inside ONE `db.transaction`. The public `createPair` below
 * is a thin wrapper that opens its own transaction for a single link.
 *
 * Anchor resolution (D-02/D-03, generalized in this plan):
 *  - `{ transactionId }`: the transaction with the NEGATIVE amount is always the anchor (the
 *    outflow being refunded); the positive-amount transaction is always the refund — SIGN-based
 *    resolution, unchanged from Phase 73.
 *  - `{ groupId }`: the Expense Group IS the anchor (its member Expenses' `totalAmount` sum is
 *    the resolved outflow); the single `counterpartId` transaction is the refund, resolved by
 *    sign exactly as today — only the anchor side generalizes, never the refund side.
 *
 * Create-or-append (D-05): before inserting, this checks whether a `reimbursement` row already
 * exists for the resolved anchor (`expense_id` or `expense_group_id`, matching whichever column
 * the DB's own partial-unique index enforces). If found, APPEND — insert only the new
 * `reimbursement_refund` row. If not found, CREATE — insert `reimbursement` +
 * `reimbursement_refund`, then (Expense-anchor ONLY, D-08) freeze the anchor transaction into
 * `reimbursement_anchor_transaction`. The frozen-set write NEVER re-runs on append — Plan 75-01's
 * write only happens once, at first CREATE for an Expense anchor.
 */
export async function createPairTx(
  tx: DbOrTx,
  input: CreatePairInput,
): Promise<CreatePairResult> {
  // 0. Self-pair guard (CR-01): a transaction cannot be paired with itself. Only meaningful for
  //    a single-transaction anchor — a Group id lives in a disjoint id space from a transaction id.
  if ('transactionId' in input.anchor && input.anchor.transactionId === input.counterpartId) {
    throw new Error('Non puoi collegare una transazione a se stessa.')
  }

  // 1. Resolve the anchor's amount/title/subCategoryId and the refund transaction, branching on
  //    anchor shape. Both branches converge on the same shared variables consumed by steps 2+.
  let anchorTitle: string
  let anchorSubCategoryId: number | null
  let anchorExpenseId: string | null = null
  let anchorGroupId: number | null = null
  // Every Expense id "under" the anchor — a single-element array for a transaction anchor, every
  // member Expense id for a Group anchor. Used below to generalize the refund-cleanup
  // same-expense skip (decision 2) to both anchor shapes.
  let anchorMemberExpenseIds: string[] = []
  // Only set for a transaction anchor — the frozen-set write (D-08) is Expense-anchor ONLY.
  let anchorTransactionIdForFrozenSet: string | null = null
  let refund: { id: string; expenseId: string | null }

  if ('transactionId' in input.anchor) {
    // ---- Expense-anchor branch (Phase 73/75-01 logic, unchanged) ----
    const [rowsA, rowsB] = await Promise.all([
      tx
        .select({
          id: transaction.id,
          amount: transaction.amount,
          occurredAt: transaction.occurredAt,
          userId: transaction.userId,
          expenseId: transaction.expenseId,
        })
        .from(transaction)
        .where(eq(transaction.id, input.anchor.transactionId))
        .limit(1),
      tx
        .select({
          id: transaction.id,
          amount: transaction.amount,
          occurredAt: transaction.occurredAt,
          userId: transaction.userId,
          expenseId: transaction.expenseId,
        })
        .from(transaction)
        .where(eq(transaction.id, input.counterpartId))
        .limit(1),
    ])

    const t1 = rowsA[0]
    const t2 = rowsB[0]

    if (!t1 || !t2) {
      throw new Error('Transazione non trovata.')
    }

    // Ownership check — IDOR block (T-50-01).
    if (t1.userId !== input.userId || t2.userId !== input.userId) {
      throw new Error('Non sei autorizzato a collegare queste transazioni.')
    }

    // Opposite-sign enforcement (CR-03): a pair only makes economic sense when the two legs
    // net against each other. Decimal.js comparison treats 0 as neither positive nor negative.
    const d1 = toDecimal(t1.amount)
    const d2 = toDecimal(t2.amount)
    const oppositeSign = (d1.gt(0) && d2.lt(0)) || (d1.lt(0) && d2.gt(0))
    if (!oppositeSign) {
      throw new Error('Le transazioni da collegare devono avere segno opposto.')
    }

    // Resolve anchor/refund by SIGN, not |amount| magnitude (D-02, Phase 73).
    const anchorRow = d1.lt(0) ? t1 : t2
    const refundRow = d1.lt(0) ? t2 : t1

    // Defense-in-depth (73-02's D-02 invariant module) on top of the sign resolution above.
    assertOutflowAnchorAmount(anchorRow.amount)
    assertInflowRefundAmount(refundRow.amount)

    // Load the anchor's Expense — required for the reimbursement's title/expenseId and for the
    // refund-cleanup categorization inherit (decision 2, unrelated to this plan's behavior change).
    const anchorExpenseRows = await tx
      .select({
        expenseId: expense.id,
        subCategoryId: expense.subCategoryId,
        title: expense.title,
      })
      .from(transaction)
      .innerJoin(expense, eq(transaction.expenseId, expense.id))
      .where(
        and(
          eq(transaction.id, anchorRow.id),
          eq(transaction.userId, input.userId),
          eq(expense.userId, input.userId),
        ),
      )
      .limit(1)

    const anchorExpense = anchorExpenseRows[0]

    if (!anchorExpense) {
      // A reimbursement cannot exist without a non-null anchor (D-03 XOR CHECK); an orphaned
      // transaction can never anchor one.
      throw new Error('La transazione da rimborsare non è associata a nessuna spesa.')
    }

    anchorTitle = anchorExpense.title
    anchorSubCategoryId = anchorExpense.subCategoryId
    anchorExpenseId = anchorExpense.expenseId
    anchorMemberExpenseIds = [anchorExpense.expenseId]
    anchorTransactionIdForFrozenSet = anchorRow.id
    refund = { id: refundRow.id, expenseId: refundRow.expenseId }
  } else {
    // ---- Expense-Group anchor branch (NEW, Phase 75 Plan 02, RMB-08) ----
    const groupId = input.anchor.groupId

    const refundRows = await tx
      .select({
        id: transaction.id,
        amount: transaction.amount,
        occurredAt: transaction.occurredAt,
        userId: transaction.userId,
        expenseId: transaction.expenseId,
      })
      .from(transaction)
      .where(eq(transaction.id, input.counterpartId))
      .limit(1)

    const refundRow = refundRows[0]

    if (!refundRow) {
      throw new Error('Transazione non trovata.')
    }

    if (refundRow.userId !== input.userId) {
      throw new Error('Non sei autorizzato a collegare queste transazioni.')
    }

    // Ownership-scoped group load (T-75-04): mirrors getExpenseGroupForDetail's WHERE shape — a
    // foreign-owned groupId resolves to "not found", never a silent cross-user link.
    const groupRows = await tx
      .select({
        id: expenseGroup.id,
        title: expenseGroup.title,
        subCategoryId: expenseGroup.subCategoryId,
      })
      .from(expenseGroup)
      .where(and(eq(expenseGroup.id, groupId), eq(expenseGroup.userId, input.userId)))
      .limit(1)

    const group = groupRows[0]

    if (!group) {
      throw new Error('Il gruppo di spesa non è stato trovato.')
    }

    // Resolve the Group's outflow amount as the SUM of member Expense totalAmounts (same
    // aggregate getReimbursementAggregates already computes for an existing Group-anchored
    // reimbursement) — Decimal.js end-to-end, never native arithmetic on DECIMAL strings.
    const memberRows = await tx
      .select({
        expenseId: expenseGroupMembership.expenseId,
        totalAmount: expense.totalAmount,
      })
      .from(expenseGroupMembership)
      .innerJoin(expense, eq(expenseGroupMembership.expenseId, expense.id))
      .where(eq(expenseGroupMembership.groupId, groupId))

    const groupSum = memberRows.reduce(
      (sum, m) => sum.plus(toDecimal(m.totalAmount)),
      toDecimal('0'),
    )

    // The anchor-level sign check (RMB-03 invariant) still runs against the resolved anchor
    // amount, exactly like the transaction-anchor branch — never skipped because the anchor is
    // now a Group. An empty/foreign group sums to 0, which is also rejected here (neither an
    // outflow nor an inflow).
    assertOutflowAnchorAmount(groupSum.toFixed(2))
    assertInflowRefundAmount(refundRow.amount)

    anchorTitle = group.title
    anchorSubCategoryId = group.subCategoryId
    anchorGroupId = groupId
    anchorMemberExpenseIds = memberRows.map((m) => m.expenseId)
    // anchorTransactionIdForFrozenSet stays null — the Group-anchor create path must never write
    // to reimbursement_anchor_transaction (D-08 is Expense-anchor-only; a Group anchor stays
    // resolved via expense_group_membership exclusively).
    refund = { id: refundRow.id, expenseId: refundRow.expenseId }
  }

  // 2. Create-or-append (D-05): does a reimbursement already exist for this anchor? Look up by
  //    whichever column the DB's own partial-unique index enforces uniqueness on.
  const existingReimbursementRows = await tx
    .select({ id: reimbursement.id })
    .from(reimbursement)
    .where(
      anchorExpenseId
        ? eq(reimbursement.expenseId, anchorExpenseId)
        : eq(reimbursement.expenseGroupId, anchorGroupId!),
    )
    .limit(1)

  let reimbursementId: number
  // Captured in both CREATE and APPEND branches — Task 1's pre-link snapshot (D-10) references
  // this id, and the write site is shared by both paths (Plan 75-02's single createPairTx core).
  let reimbursementRefundId: number

  try {
    if (existingReimbursementRows[0]) {
      // APPEND: an anchor whose frozen set was already recorded on its first link — insert only
      // the new refund row, never re-insert reimbursement, never re-run the frozen-set write.
      reimbursementId = existingReimbursementRows[0].id

      const insertedRefund = await tx
        .insert(reimbursementRefund)
        .values({
          reimbursementId,
          transactionId: refund.id,
        })
        .returning({ id: reimbursementRefund.id })

      reimbursementRefundId = insertedRefund[0].id
    } else {
      // CREATE: first link on this anchor.
      const insertedReimbursement = await tx
        .insert(reimbursement)
        .values({
          userId: input.userId,
          title: anchorTitle,
          expenseId: anchorExpenseId,
          expenseGroupId: anchorGroupId,
        })
        .returning({ id: reimbursement.id })

      reimbursementId = insertedReimbursement[0].id

      const insertedRefund = await tx
        .insert(reimbursementRefund)
        .values({
          reimbursementId,
          transactionId: refund.id,
        })
        .returning({ id: reimbursementRefund.id })

      reimbursementRefundId = insertedRefund[0].id

      // D-08 (Phase 75) — Expense-anchor ONLY: freeze the anchor transaction into the frozen
      // anchored-transaction set UNCONDITIONALLY on every CREATE (Pitfall 3: never skip this
      // because "there's only one transaction anyway"). Never runs for a Group anchor.
      if (anchorTransactionIdForFrozenSet) {
        await tx.insert(reimbursementAnchorTransaction).values({
          reimbursementId,
          transactionId: anchorTransactionIdForFrozenSet,
        })
      }
    }
  } catch (e) {
    if (errorCauseCode(e) === '23505') {
      throw new Error('Una delle transazioni è già collegata a un’altra.')
    }
    throw e
  }

  // 3. Refund cleanup (decision 2, UNRELATED to this plan's create-or-append behavior — kept
  //    exactly as-is, generalized only to compare against every anchor member Expense id instead
  //    of a single one): categorize the refund expense under the refunded spend's subcategory,
  //    isolating it as a standalone expense via the detach cleanup core. Only when the anchor has
  //    a categorized subcategory and the refund's own Expense is not itself an anchor member.
  const refundExpenseId = refund.expenseId

  if (
    anchorSubCategoryId !== null &&
    refundExpenseId &&
    !anchorMemberExpenseIds.includes(refundExpenseId)
  ) {
    // Read the refund's CURRENT expense state — used both for title composition (unchanged) and
    // as the pre-link snapshot (D-10, Phase 75 Plan 03) recorded BEFORE applyDetachCleanupTx
    // mutates title/descriptionHash/subCategoryId/status below.
    const refundExpenseRows = await tx
      .select({
        id: expense.id,
        title: expense.title,
        descriptionHash: expense.descriptionHash,
        subCategoryId: expense.subCategoryId,
        status: expense.status,
      })
      .from(transaction)
      .innerJoin(expense, eq(transaction.expenseId, expense.id))
      .where(
        and(
          eq(transaction.id, refund.id),
          eq(transaction.userId, input.userId),
          eq(expense.userId, input.userId),
        ),
      )
      .limit(1)

    const refundExpenseSnapshot = refundExpenseRows[0]

    // Compose the refund title as "{refund's own title} — rimborso {spend title}" so the refund
    // row keeps the sender's name and reads as a refund of that specific spend.
    const refundOwnTitle = refundExpenseSnapshot?.title?.trim() ?? ''
    const refundTitle = refundOwnTitle
      ? `${refundOwnTitle} — rimborso ${anchorTitle}`
      : `Rimborso ${anchorTitle}`

    // Pre-link snapshot (D-10): records exactly one row per reimbursement_refund link, capturing
    // the refund's expense state AS IT WAS before the mutation below — the same write site covers
    // both the create path and Plan 75-02's append path (createPairTx is the single core both
    // go through).
    if (refundExpenseSnapshot) {
      await tx.insert(reimbursementRefundSnapshot).values({
        reimbursementRefundId,
        expenseId: refundExpenseSnapshot.id,
        expenseTitle: refundExpenseSnapshot.title,
        expenseDescriptionHash: refundExpenseSnapshot.descriptionHash,
        expenseSubCategoryId: refundExpenseSnapshot.subCategoryId,
        expenseStatus: refundExpenseSnapshot.status,
      })
    }

    await applyDetachCleanupTx(tx, {
      userId: input.userId,
      transactionId: refund.id,
      title: refundTitle,
      subCategoryId: anchorSubCategoryId,
    })

    return {
      secondaryTransactionId: refund.id,
      inheritedSubCategoryId: anchorSubCategoryId,
    }
  }

  return { secondaryTransactionId: refund.id }
}

/**
 * Create a reimbursement link between two transactions, or (D-05) append a refund to an
 * existing anchor's reimbursement. Thin `db.transaction` wrapper around `createPairTx` — the
 * full read-then-write must be atomic (project hard rule: ownership-validating writes run inside
 * `db.transaction`).
 *
 * Security (D-01 / T-50-01): reimbursement/reimbursement_refund carry no per-row ownership check
 * of their own beyond the `userId` column on `reimbursement` itself. `createPairTx` is the sole
 * ownership gate: it verifies every transaction/group involved belongs to `input.userId` before
 * any insert.
 */
export async function createPair(input: CreatePairInput): Promise<CreatePairResult> {
  // Short-circuit before ever opening a transaction (CR-01) — mirrors the pre-Phase-75
  // behavior where the self-pair guard rejects before touching the DB at all. createPairTx
  // repeats this same guard (defense-in-depth for a caller that invokes it directly, e.g. a
  // future multi-link caller composing several createPairTx calls inside its own transaction).
  if ('transactionId' in input.anchor && input.anchor.transactionId === input.counterpartId) {
    throw new Error('Non puoi collegare una transazione a se stessa.')
  }
  return db.transaction((tx) => createPairTx(tx, input))
}

/**
 * Restore a refund's pre-link baseline (D-10, Phase 75 Plan 03, RMB-07): reverts the
 * recategorization `applyDetachCleanupTx` applied at link time, using the snapshot
 * `createPairTx` recorded immediately before that mutation ran. Shared by both unlink paths
 * (`deletePairByTransactionId`'s refund-side branch and `deleteReimbursementForAnchor`) so
 * "remove one refund" and "delete the whole reimbursement" restore identically.
 *
 * No-op (nothing to restore) when no snapshot row exists — matches a refund whose link never
 * triggered cleanup in the first place (donor uncategorized, or refund shares the anchor's own
 * Expense). Idempotent: calling this a second time for an already-restored/already-unlinked
 * refund finds no snapshot (it was deleted alongside its reimbursement_refund row via ON DELETE
 * CASCADE) and no-ops again — matches deletePairByTransactionId's existing silent-no-op
 * convention for an already-unlinked transaction (Edge RMB-07/idempotency).
 *
 * Security (T-75-07): the expense UPDATE's WHERE clause always includes
 * `expense.userId = input.userId` in addition to the snapshot's expenseId — a cross-user
 * snapshot reference (which should never exist given ownership-scoped inserts) still cannot
 * mutate a foreign row even if it did.
 */
async function restoreRefundBaseline(
  tx: DbOrTx,
  input: { refundTransactionId: string; userId: string },
): Promise<void> {
  const snapshotRows = await tx
    .select({
      expenseId: reimbursementRefundSnapshot.expenseId,
      expenseTitle: reimbursementRefundSnapshot.expenseTitle,
      expenseDescriptionHash: reimbursementRefundSnapshot.expenseDescriptionHash,
      expenseSubCategoryId: reimbursementRefundSnapshot.expenseSubCategoryId,
      expenseStatus: reimbursementRefundSnapshot.expenseStatus,
    })
    .from(reimbursementRefund)
    .innerJoin(
      reimbursementRefundSnapshot,
      eq(reimbursementRefundSnapshot.reimbursementRefundId, reimbursementRefund.id),
    )
    .where(eq(reimbursementRefund.transactionId, input.refundTransactionId))
    .limit(1)

  const snapshotRow = snapshotRows[0]

  // No snapshot recorded — the refund-cleanup never ran on link (Test 2, Task 1). Nothing to
  // restore; also covers the idempotent-no-op case (the snapshot cascaded away already).
  if (!snapshotRow) {
    return
  }

  if (snapshotRow.expenseId) {
    // The original expense still exists (Pitfall 2 branch A) — restore its fields in place.
    // Covers `applyDetachCleanupTx`'s single-transaction re-hash-in-place branch, where the
    // refund transaction's expenseId never changed at link time.
    await tx
      .update(expense)
      .set({
        title: snapshotRow.expenseTitle ?? '',
        descriptionHash: snapshotRow.expenseDescriptionHash,
        subCategoryId: snapshotRow.expenseSubCategoryId,
        status: snapshotRow.expenseStatus ?? '1',
        updatedAt: new Date(),
      })
      .where(and(eq(expense.id, snapshotRow.expenseId), eq(expense.userId, input.userId)))
    return
  }

  // snapshotRow.expenseId is null — the onDelete:'set null' FK fired: the original expense was
  // deleted after linking (Pitfall 2 branch B). Insert a fresh replacement expense from the
  // snapshot's stored field values (mirrors applyDetachCleanupTx's multi-transaction-branch
  // insert shape) and repoint the refund transaction back to it.
  const refundTxRows = await tx
    .select({ amount: transaction.amount, occurredAt: transaction.occurredAt })
    .from(transaction)
    .where(and(eq(transaction.id, input.refundTransactionId), eq(transaction.userId, input.userId)))
    .limit(1)

  const refundTxRow = refundTxRows[0]
  if (!refundTxRow) {
    return
  }

  const newExpenseId = crypto.randomUUID()

  await tx.insert(expense).values({
    id: newExpenseId,
    userId: input.userId,
    title: snapshotRow.expenseTitle ?? 'Rimborso',
    descriptionHash: snapshotRow.expenseDescriptionHash,
    subCategoryId: snapshotRow.expenseSubCategoryId,
    totalAmount: toDbDecimal(toDecimal(refundTxRow.amount)),
    transactionCount: 1,
    firstTransactionAt: refundTxRow.occurredAt,
    lastTransactionAt: refundTxRow.occurredAt,
    status: snapshotRow.expenseStatus ?? '1',
  })

  await tx
    .update(transaction)
    .set({ expenseId: newExpenseId })
    .where(and(eq(transaction.id, input.refundTransactionId), eq(transaction.userId, input.userId)))
}

/**
 * Remove a reimbursement link by either transaction in it (anchor or refund).
 *
 * Security (D-01 / T-50-01): verifies the transaction belongs to `input.userId`
 * before deleting. Restores baseline regardless of whether the transaction is
 * the anchor or a refund side (PAIR-03 unlink-restores-baseline):
 *  - Unlinking a refund restores its pre-link baseline (D-10, RMB-07) via
 *    `restoreRefundBaseline`, THEN removes its reimbursement_refund row; if it
 *    was the reimbursement's only refund, also removes the now-empty
 *    reimbursement row.
 *  - Unlinking the anchor removes the reimbursement row (cascades its
 *    reimbursement_refund rows via ON DELETE CASCADE).
 */
export async function deletePairByTransactionId(input: {
  userId: string
  transactionId: string
}): Promise<void> {
  // Ownership read and the delete must be atomic (CR-02): reimbursement/
  // reimbursement_refund carry no per-row ownership column beyond
  // reimbursement.userId, so the unscoped delete is only safe when no other
  // request can mutate the row between the ownership check and the delete.
  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ userId: transaction.userId, expenseId: transaction.expenseId })
      .from(transaction)
      .where(eq(transaction.id, input.transactionId))
      .limit(1)

    const row = rows[0]
    if (!row || row.userId !== input.userId) {
      throw new Error('Non sei autorizzato a scollegare questa transazione.')
    }

    // Resolve role: is this transaction a refund (reimbursement_refund), or does
    // it resolve to an anchor (its expense_id matches some reimbursement's
    // expenseId)? A transaction can only ever be one or the other (or unpaired).
    const refundRows = await tx
      .select({
        id: reimbursementRefund.id,
        reimbursementId: reimbursementRefund.reimbursementId,
      })
      .from(reimbursementRefund)
      .where(eq(reimbursementRefund.transactionId, input.transactionId))
      .limit(1)

    const refundRow = refundRows[0]

    if (refundRow) {
      // Refund side (D-10): restore baseline BEFORE deleting the link row — restore reads the
      // snapshot via the still-existing reimbursement_refund row.
      await restoreRefundBaseline(tx, { refundTransactionId: input.transactionId, userId: input.userId })

      await tx.delete(reimbursementRefund).where(eq(reimbursementRefund.id, refundRow.id))

      // If this was the reimbursement's ONLY refund, remove the now-empty
      // reimbursement row too (unlink-restores-baseline, PAIR-03).
      const remainingRows = await tx
        .select({ id: reimbursementRefund.id })
        .from(reimbursementRefund)
        .where(eq(reimbursementRefund.reimbursementId, refundRow.reimbursementId))
        .limit(1)

      if (remainingRows.length === 0) {
        await tx.delete(reimbursement).where(eq(reimbursement.id, refundRow.reimbursementId))
      }

      return
    }

    if (row.expenseId) {
      const anchorRows = await tx
        .select({ id: reimbursement.id })
        .from(reimbursement)
        .where(eq(reimbursement.expenseId, row.expenseId))
        .limit(1)

      const anchorRow = anchorRows[0]
      if (anchorRow) {
        // Anchor side: removing the reimbursement cascades its
        // reimbursement_refund rows via ON DELETE CASCADE (D-03 FK).
        await tx.delete(reimbursement).where(eq(reimbursement.id, anchorRow.id))
      }
    }
  })
}

/**
 * Delete a whole reimbursement (D-09's second lifecycle action): restores baseline for EVERY
 * linked refund (not just the last one removed), THEN deletes the reimbursement row (cascades
 * reimbursement_refund / reimbursement_anchor_transaction / reimbursement_refund_snapshot rows
 * via ON DELETE CASCADE).
 *
 * Security (T-75-08, Repudiation): every refund's restore runs BEFORE the reimbursement row (and
 * its cascading refund rows) is deleted, inside ONE db.transaction — a mid-loop failure rolls
 * back the whole batch, never leaving some refunds restored and others not.
 * Security (T-75-07): ownership-scoped — a foreign-owned reimbursementId resolves to "not
 * found" (silent no-op), never a cross-user delete.
 */
export async function deleteReimbursementForAnchor(input: {
  userId: string
  reimbursementId: number
}): Promise<void> {
  await db.transaction(async (tx) => {
    const reimbursementRows = await tx
      .select({ id: reimbursement.id })
      .from(reimbursement)
      .where(and(eq(reimbursement.id, input.reimbursementId), eq(reimbursement.userId, input.userId)))
      .limit(1)

    const reimbursementRow = reimbursementRows[0]
    if (!reimbursementRow) {
      // Ownership-scoped: a foreign-owned or already-deleted reimbursementId is a silent no-op
      // (Edge RMB-07/idempotency), never a thrown error.
      return
    }

    const refundRows = await tx
      .select({ transactionId: reimbursementRefund.transactionId })
      .from(reimbursementRefund)
      .where(eq(reimbursementRefund.reimbursementId, reimbursementRow.id))

    // Restore EVERY linked refund IN ORDER before any delete (T-75-08) — never just the last one
    // removed.
    for (const { transactionId } of refundRows) {
      await restoreRefundBaseline(tx, { refundTransactionId: transactionId, userId: input.userId })
    }

    await tx.delete(reimbursement).where(eq(reimbursement.id, reimbursementRow.id))
  })
}
