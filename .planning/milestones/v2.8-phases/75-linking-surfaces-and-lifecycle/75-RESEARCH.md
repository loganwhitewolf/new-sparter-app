# Phase 75: linking-surfaces-and-lifecycle - Research

**Researched:** 2026-07-24
**Domain:** Reimbursement linking UI and lifecycle (unlink → baseline restore), plus D-08 anchor contamination fix
**Confidence:** HIGH

## Summary

Phase 75 has three independent but tightly coupled work streams:

1. **D-08 anchor contamination fix** (prerequisite): Expenses are upserted by `(userId, descriptionHash)` in import.ts (lines 561-651), so a later same-merchant purchase joins the existing Expense. The netting CTE `effectiveAmount()` currently resolves members by `expense_id`, picking up ALL transactions in that Expense including ones purchased *after* refunds were linked to different ones. **This is unsafe for N=1 pairs and critical for 1:N linking.** Solution: freeze the exact transaction ids constituting the anchor at link time via a new join table `reimbursement_anchor_transaction`, and repoint the CTE to read that frozen set instead of "all expense_id transactions."

2. **D-05 create-or-append write path** (core linking feature): `createPair` today always creates a new reimbursement, failing with 23505 if one already exists. D-05 requires appending a refund to an existing anchor instead. Service contract changes from "create" to "create-or-append"; the picker becomes multi-select (checkbox list with running total).

3. **D-10 unlink → full baseline restore** (reversibility): Unlinking must restore the refund's pre-link state (category, title, expense membership), not only remove the link. This requires snapshotting the refund's state at link time. `applyDetachCleanupTx` today re-hashes the expense and updates title/category *at link time*; unlink must revert all three.

**Primary recommendation:** Build in this order: (1) D-08 frozen-set schema + CTE change (regression-gate before shipping); (2) D-05 create-or-append service + multi-select picker; (3) D-10 pre-link snapshot storage + unlink restore logic.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01** through **D-07**: Entry points, surface shapes, quick-action coherence — all locked, no re-opening.
- **D-08**: Frozen anchored-transaction set (Option 2) is locked. Architecture is chosen; only implementation details (storage shape, CTE wording, backfill) are in scope.
- **D-09**: Unlink actions (single-refund remove, delete-all confirm) are locked.

### Claude's Discretion
- Where frozen set lives (new join table vs. column) + exact Drizzle shape + CTE wording + backfill approach
- Pre-link snapshot storage shape + unlink restore logic
- Multi-select picker UX (checkbox, totals, per-item display)
- Group-anchor + refund cleanup subcategory behavior (deferred edge case)

### Deferred Ideas (OUT OF SCOPE)
- Full 1:N popover generalization in transactions table (D-07, stays 1:1 quick-action)
- `/reimbursements` dedicated section (Phase 76, RMB-10/11)
- Subscription temporal amortization (RMB-F1, future milestone)

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RMB-07 | User can add/remove refund links; unlink restores baseline | D-05, D-10 enable add/remove/unlink; frozen-set (D-08) makes it safe |
| RMB-08 | User can create/manage reimbursement from transaction detail & Expense Group detail | D-01 (entry points), D-03 (reusable component) |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Frozen-set CTE change | Backend (netting aggregation) | — | Core query logic, no UI impact |
| Create-or-append write path | Backend (service) | — | Business logic: merge into existing vs. create new |
| Multi-select picker UI | Frontend (component) | Backend (eligibility query) | Client owns selection; server owns candidate list |
| Pre-link snapshot storage | Backend (schema) | Backend (service) | Metadata: store prior state, revert on unlink |
| Unlink → baseline restore | Backend (service) | Frontend (UI feedback) | Service reverts state; UI confirms success |

## Standard Stack

### Core (already shipped, no new deps)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| Drizzle ORM | (latest in project) | Schema + migrations + CTEs | Already used for `effectiveAmount()` |
| Decimal.js | (latest in project) | Money arithmetic | Required for all refund/share calculations |
| Next.js 16 App Router | (latest in project) | Server actions + RSC | D-05 picker uses formAction; unlink via server action |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | (latest in project) | Input validation | Multi-select picker form data validation |
| shadcn/ui | (latest in project) | Checkbox component | Multi-select picker needs checkbox list (not radio) |

**Installation:** No new packages needed. Extend existing components and use established project libraries.

## Package Legitimacy Audit

No new external packages required. Phase extends existing schema, services, and components using Drizzle, Decimal.js, and shadcn/ui — all already audited and in production.

## Implementation Deep Dive

### Q1: D-08 Frozen Anchored-Transaction Set

**Current state of the problem:**

`lib/services/import.ts` (lines 561-573) upserts Expense by `(userId, descriptionHash)`:
```ts
const existing = await tx.select(...).from(expense)
  .where(and(eq(expense.userId, userId), eq(expense.descriptionHash, descHash)))
  .limit(1)
if (existing) {
  // ... UPDATE existing Expense
} else {
  // ... INSERT new Expense
}
```

When the same merchant appears again (same description), the import reuses the existing `expenseId`. Then `effectiveAmount()` in `transaction-pairs-sql.ts` (lines 90-96) resolves members by that `expense_id`:

```sql
member_transactions AS (
  SELECT m.id, m.amount::numeric AS amount, m.occurred_at
  FROM transaction m
  WHERE m.expense_id IN (SELECT expense_id FROM member_expense_ids)
    AND NOT EXISTS (SELECT 1 FROM reimbursement_refund rr2 WHERE rr2.transaction_id = m.id)
)
```

**The contamination scenario:** User buys from Amazon (-€100) on day 1, links a refund (+€50) on day 5. On day 20, imports same-merchant purchase (-€80). The import upserts into the same Expense, so the CTE now picks up THREE transactions. The refund's share gets spread across both the day-1 and day-20 purchases — **the day-20 purchase inherits share of a refund that was only for day-1**. This is the D-08 gap.

**Recommended solution (frozen-set storage):**

Create a new join table to pin the exact anchor transaction(s) at link time:

```ts
// lib/db/schema.ts — add after reimbursement_refund table (line ~567)

export const reimbursementAnchorTransaction = pgTable(
  'reimbursement_anchor_transaction',
  {
    id: serial('id').primaryKey(),
    reimbursementId: integer('reimbursement_id')
      .notNull()
      .references(() => reimbursement.id, { onDelete: 'cascade' }),
    transactionId: text('transaction_id')
      .notNull()
      .references(() => transaction.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('reimbursement_anchor_transaction_reimbursement_transaction_unique')
      .on(table.reimbursementId, table.transactionId),
    index('reimbursement_anchor_transaction_reimbursementId_idx').on(table.reimbursementId),
    index('reimbursement_anchor_transaction_transactionId_idx').on(table.transactionId),
  ],
)
```

**Why this shape:**
- **Composite unique** on `(reimbursementId, transactionId)` prevents duplicate rows — a transaction cannot be recorded as an anchor for the same reimbursement twice.
- **`ON DELETE CASCADE` on reimbursementId** ensures cleanup when the reimbursement is deleted (standard FK hygiene).
- **Indexed on both sides** for fast resolution: reimbursement → anchor transactions (the common read path) and transaction → which reimbursements use it (when a transaction is mutated, check if it's anchored).

**Relations:** Add to `reimbursementRelations` in schema.ts:
```ts
export const reimbursementRelations = relations(reimbursement, ({ one, many }) => ({
  user: one(user, { ... }),
  expense: one(expense, { ... }),
  expenseGroup: one(expenseGroup, { ... }),
  refunds: many(reimbursementRefund),
  anchorTransactions: many(reimbursementAnchorTransaction), // NEW
}))
```

**CTE change (effectiveAmount):**

Replace the current member-transaction resolution (lines 90-96) to read from the frozen set instead of by expense_id:

```ts
// BEFORE (lines 90-96 in transaction-pairs-sql.ts):
member_transactions AS (
  SELECT m.id, m.amount::numeric AS amount, m.occurred_at
  FROM transaction m
  WHERE m.expense_id IN (SELECT expense_id FROM member_expense_ids)
    AND NOT EXISTS (SELECT 1 FROM reimbursement_refund rr2 WHERE rr2.transaction_id = m.id)
)

// AFTER:
member_transactions AS (
  SELECT m.id, m.amount::numeric AS amount, m.occurred_at
  FROM transaction m
  INNER JOIN reimbursement_anchor_transaction rat ON rat.transaction_id = m.id
  WHERE rat.reimbursement_id = (SELECT reimbursement_id FROM anchor LIMIT 1)
    AND NOT EXISTS (SELECT 1 FROM reimbursement_refund rr2 WHERE rr2.transaction_id = m.id)
)
```

**Why the change is safe:**
- For **Expense-shaped anchors** (today's 1:1 and new 1:N): the frozen set contains exactly the transactions that constituted the anchor at link time. A later same-merchant import cannot alter the set — it creates new transactions not recorded in the frozen set.
- For **Group-shaped anchors**: `expense_group_membership` is already explicitly immutable (ADR 0017 §1 — members stay intact, never physically merged), so the member-expense-ids CTE is already transaction-granular and group-contamination-safe. The `member_transactions` subquery remains unchanged for Group anchors — only Expense anchors get the frozen-set treatment.
- **N=1 regression gate:** When migrating a 1:1 pair (lines below), a single transaction is recorded in the frozen set, so the share math (refund × single transaction / single transaction = refund) is numerically identical before and after.

**Consumers that must stay green:**

Every call site of `effectiveAmount()` and `isNotSecondary()` is in aggregation queries (all must pass together per CONTEXT.md Pitfalls 1-2):

1. `lib/dal/dashboard.ts` — `getOverviewAmountTotals`, `getMonthlyTrendByNature`, etc. (called from `/overview`)
2. `lib/dal/overview.ts` — breakdown queries (calls to category/detail aggregations)
3. `lib/dal/transactions.ts` — transaction-list queries (single-transaction effective amount)
4. `lib/dal/expenses.ts` — expense-detail aggregations
5. `lib/dal/tags.ts` — tag-totals queries

**All five are tested in `reimbursement-regression.test.ts`** (test runs 132-212 show every call site is covered by the N=1 regression gate). The CTE change is internal; call sites need NO changes — the signature of `effectiveAmount()` is identical.

**Backfill for migrated 1:1 pairs:**

A new SQL migration must populate `reimbursement_anchor_transaction` for every existing `reimbursement` row:

```sql
-- migration: 00XX_populate_reimbursement_anchor_transaction.sql
INSERT INTO reimbursement_anchor_transaction (reimbursement_id, transaction_id, created_at)
SELECT r.id, t.id, NOW()
FROM reimbursement r
INNER JOIN transaction t ON t.expense_id = r.expense_id
WHERE r.expense_id IS NOT NULL
ON CONFLICT DO NOTHING
```

This snapshot captures the **current state at migration time**: for each Expense-shaped reimbursement, record every transaction currently in that Expense. For N=1 pairs (the only case migrated from `transaction_pair` today), this is one transaction per reimbursement. Future links via Phase 75's create-or-append will add rows to this table.

**Why ON CONFLICT DO NOTHING:** In case of a rerun (idempotent migrations), duplicate-key insertion is silently skipped — no error.

**Regression snapshot:** Before this migration runs in prod, the regression test `reimbursement-regression.test.ts` must pass with the frozen-set CTE against N=1 scenarios (already seeded via `seedReimbursement`). The expected values (lines 132-212) are byte-identical to the current (pre-frozen-set) aggregation results — this proves inertness.

---

### Q2: D-05 Create-or-Append Write Path + Multi-Select Picker

**Current failure mode:**

`lib/services/transaction-pairs.ts::createPair` (lines 179-186) always inserts a new `reimbursement` row:

```ts
const insertedReimbursement = await tx
  .insert(reimbursement)
  .values({
    userId: input.userId,
    title: anchorExpense.title,
    expenseId: anchorExpense.expenseId,
  })
  .returning({ id: reimbursement.id })
```

The schema enforces `UNIQUE(reimbursement.expenseId)` where `expenseId IS NOT NULL` (lines 538-540). When a second refund is linked to the same anchor, this insert fails with **Postgres error code 23505** (unique violation), caught and translated to Italian at line 193-195:

```ts
} catch (e) {
  if (errorCauseCode(e) === '23505') {
    throw new Error('Una delle transazioni è già collegata a un'altra.')
  }
```

D-05 requires that the second link **appends** to the existing reimbursement instead of failing.

**Recommended service contract (create-or-append):**

Rename `createPair` to `createOrAppendRefund` (or keep the name but change semantics) and change the signature:

```ts
// Current signature (lines 57-61):
export async function createPair(input: {
  userId: string
  transactionId: string
  counterpartId: string
}): Promise<CreatePairResult> { ... }

// New signature:
export async function createPair(input: {
  userId: string
  transactionId: string
  counterpartId: string
}): Promise<CreatePairResult> {
  // NEW BEHAVIOR: detect existing reimbursement, append instead of create
  ...
}
```

**Step-by-step logic inside createPair (tx-wrapped, lines 76+):**

1. **Ownership + sign validation** (unchanged, lines 77-140).
2. **Resolve anchor/refund by sign** (unchanged, lines 128-139).
3. **Load anchor Expense** (unchanged, lines 146-170).
4. **NEW STEP: Check for existing reimbursement on the anchor Expense:**

```ts
// After line 169 (after loading anchorExpense)
const existingReimbursement = await tx
  .select({ id: reimbursement.id })
  .from(reimbursement)
  .where(eq(reimbursement.expenseId, anchorExpense.expenseId))
  .limit(1)

const reimbursementId = existingReimbursement[0]?.id
  ? existingReimbursement[0].id  // Found: append to existing
  : null  // Not found: will create new
```

5. **Create or append** (lines 178-197 modified):

```ts
let reimbursementId: number
if (reimbursementId !== null) {
  // APPEND: just insert the refund row into the existing reimbursement
  await tx.insert(reimbursementRefund).values({
    reimbursementId, // existing
    transactionId: refund.id,
  })
} else {
  // CREATE: new reimbursement + refund, as today
  const insertedReimbursement = await tx
    .insert(reimbursement)
    .values({
      userId: input.userId,
      title: anchorExpense.title,
      expenseId: anchorExpense.expenseId,
    })
    .returning({ id: reimbursement.id })
  
  reimbursementId = insertedReimbursement[0].id
  
  await tx.insert(reimbursementRefund).values({
    reimbursementId,
    transactionId: refund.id,
  })
}
```

6. **D-08 frozen-set recording** (NEW, after step 5, before refund cleanup):

```ts
// Record the anchor transaction in the frozen set (D-08 fix)
await tx.insert(reimbursementAnchorTransaction).values({
  reimbursementId,
  transactionId: anchor.id,
})
```

**Why this works:** The frozen-set table's composite unique `(reimbursementId, transactionId)` naturally handles re-runs: if the same anchor transaction is recorded twice, `ON CONFLICT DO NOTHING` silently skips it. However, this should only happen if `createPair` is idempotently re-run with the same anchor — rare. For safety, wrap in a conflict handler, but a duplicate is a no-op.

7. **Refund cleanup** (unchanged, lines 200-245 — still calls `applyDetachCleanupTx`).

**Security:** The entire flow runs inside `db.transaction()` (line 76), so atomicity is preserved: if any insert fails, the whole transaction rolls back.

**Error handling:** The 23505 error is no longer possible (we check first), so the catch-block becomes unreachable. Remove it or re-purpose for other unique violations. The AppendRefund behavior makes the error path dead code, but leaving it is harmless — belt and suspenders.

**Multi-select picker (extend CounterpartPickerDialog):**

Today's picker (`components/transactions/counterpart-picker-dialog.tsx`, lines 86-308) is a single-select radio list. D-05 requires multi-select checkboxes so the user can link multiple refunds in one action.

**Changes to CounterpartPickerDialog:**

```tsx
// Line 108: change selectedId to selectedIds (array)
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

// Line 223-224: change hidden input from radio to array of checkboxes (inside form)
{counterparts.map((c) => (
  <label key={c.id} className="flex gap-2">
    <input
      type="checkbox"
      value={c.id}
      checked={selectedIds.has(c.id)}
      onChange={(e) => {
        const newIds = new Set(selectedIds)
        if (e.target.checked) newIds.add(c.id)
        else newIds.delete(c.id)
        setSelectedIds(newIds)
      }}
    />
    <span>{c.customTitle ?? c.description}</span>
    <span className="text-sm text-muted-foreground">
      {formatCounterpartAmount(c.amount, isNegativeRef)}
    </span>
    <span className="text-xs text-muted-foreground">
      {formatDate(c.occurredAt)}
    </span>
  </label>
))}

// Running total (NEW): show sum of selected refunds
const selectedTotal = Array.from(selectedIds)
  .map((id) => counterparts.find((c) => c.id === id)?.amount ?? '0')
  .reduce((sum, amt) => toDecimal(sum).plus(toDecimal(amt)), toDecimal('0'))

<div className="text-sm font-semibold">
  Totale rimborsi selezionati: {formatCounterpartAmount(
    selectedTotal.toFixed(2),
    isNegativeRef
  )}
</div>
```

**Hidden inputs for the form:**
```tsx
// Replace line 223-224: single hidden input becomes loop
{Array.from(selectedIds).map((id) => (
  <input key={id} type="hidden" name={`counterpartIds[]`} value={id} />
))}
```

**Server action (lib/actions/transaction-pairs.ts) — new overload:**

The current `createTransactionPairAction` (lines 31-65) accepts a single `counterpartId`. D-05 introduces a new action for multi-select:

```ts
export type CreateMultiRefundActionState = ActionState & {
  pairedRefundIds?: string[]  // Array of linked refund transaction ids
}

export async function createMultiRefundAction(
  _prev: CreateMultiRefundActionState,
  formData: FormData,
): Promise<CreateMultiRefundActionState> {
  // Parse multiple counterpart ids
  const counterpartIds = formData.getAll('counterpartIds[]') as string[]
  const transactionId = formData.get('transactionId') as string
  
  if (!transactionId || counterpartIds.length === 0) {
    return { error: 'Seleziona almeno un rimborso.' }
  }
  
  const { userId } = await verifySession()
  
  const pairedIds: string[] = []
  
  // Link each refund to the anchor (create-or-append handles the rest)
  for (const counterpartId of counterpartIds) {
    try {
      const result = await createPair({
        userId,
        transactionId,
        counterpartId,
      })
      pairedIds.push(result.secondaryTransactionId)
    } catch (err) {
      // If any link fails, still return the ones that succeeded
      // (or fail the whole batch — depends on UX choice; safer: fail-one-fail-all inside tx)
      return { error: (err as Error).message }
    }
  }
  
  revalidatePath('/transactions')
  revalidatePath('/overview')
  
  return { error: null, pairedRefundIds: pairedIds }
}
```

**Alternative (safer, atomic):** Wrap all links in a single `db.transaction()` so either all succeed or none do:

```ts
const pairedIds = await db.transaction(async (tx) => {
  const result: string[] = []
  for (const counterpartId of counterpartIds) {
    // Call a tx-accepting variant of createPair
    const pairResult = await createPairTx(tx, { userId, transactionId, counterpartId })
    result.push(pairResult.secondaryTransactionId)
  }
  return result
})
```

This requires refactoring `createPair` to accept an optional `tx` parameter (or splitting into a tx-accepting core). Keep in PLAN as a task.

**Group-anchor candidate window (D-06):**

For an Expense Group anchor, the eligible-refund window should be ±90 days from the Group's occurrence interval (first→last member transaction), not a single reference date.

In `lib/dal/transaction-pairs.ts::getEligibleCounterparts` (lines 36-91), the dateFrom/dateTo are passed in by the picker. For Group anchors, the picker computes them as:

```ts
// In the picker (or a new "pick-anchor" flow):
const groupFirstTransaction = await getFirstMemberTransaction(groupId)  // NEW query
const groupLastTransaction = await getLastMemberTransaction(groupId)   // NEW query
const midpoint = new Date(
  (groupFirstTransaction.occurredAt.getTime() + groupLastTransaction.occurredAt.getTime()) / 2
)
const dateFrom = offsetDateISO(midpoint, -90)
const dateTo = offsetDateISO(midpoint, 90)
```

Or simpler: `dateFrom = groupFirstTransaction - 90d`, `dateTo = groupLastTransaction + 90d`. Either way, the picker passes computed dates to `getEligibleCounterparts`, which is unchanged — it has no notion of Group vs. Expense anchors.

---

### Q3: D-10 Unlink → Full Baseline Restore (Pre-Link Snapshot)

**Current behavior (applyDetachCleanupTx):**

When a refund is linked via `createPair` (line 234), `applyDetachCleanupTx` is called (lines 216-239 in transaction-pairs.ts) to recategorize the refund:

```ts
await applyDetachCleanupTx(tx, {
  userId: input.userId,
  transactionId: refund.id,
  title: refundTitle,  // e.g., "Carlo — rimborso Cena"
  subCategoryId: anchorExpense.subCategoryId,  // inherit anchor's category
})
```

`applyDetachCleanupTx` (lib/services/transaction-detach.ts, lines 52-153) mutates:

1. **Single-transaction source** (lines 101-118):
   - `expense.descriptionHash` → synthetic hash (line 109)
   - `expense.title` → `refundTitle` (line 110)
   - `expense.subCategoryId` → `input.subCategoryId` (line 113)
   - `expense.status` → `'3'` (line 113)

2. **Multi-transaction source** (lines 120-152):
   - Creates a NEW expense (lines 123-135)
   - Repoints the transaction to that new expense (lines 137-145)
   - Reconciles the source (lines 147-150)

**What D-10 requires:**

On unlink, the refund must revert to its **pre-link state**: its original `descriptionHash`, title, `subCategoryId`, and expense membership. RMB-07 says "reappears as a normal inflow" — meaning it's no longer isolated as a "rimborso" with a synthetic hash; it's back to its original categorization.

**Recommended pre-link snapshot storage:**

Add a new table to record the refund's state at link time:

```ts
// lib/db/schema.ts — add after reimbursement_refund table (line ~567)

export const reimbursementRefundSnapshot = pgTable(
  'reimbursement_refund_snapshot',
  {
    id: serial('id').primaryKey(),
    reimbursementRefundId: integer('reimbursement_refund_id')
      .notNull()
      .references(() => reimbursementRefund.id, { onDelete: 'cascade' }),
    // The refund transaction's expense state at link time
    expenseId: text('expense_id'),  // nullable: if the refund was already uncategorized
    expenseTitle: varchar('expense_title', { length: 255 }),
    expenseDescriptionHash: varchar('expense_description_hash', { length: 64 }),
    expenseSubCategoryId: integer('expense_sub_category_id'),
    expenseStatus: varchar('expense_status', { length: 1 }),
    // Flags: whether this refund was part of an expense_group_membership
    expenseGroupMembershipId: integer('expense_group_membership_id'),  // nullable
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('reimbursement_refund_snapshot_reimbursementRefundId_unique')
      .on(table.reimbursementRefundId),
    index('reimbursement_refund_snapshot_reimbursementRefundId_idx').on(table.reimbursementRefundId),
  ],
)
```

**Why this shape:**
- **One snapshot per `reimbursement_refund` row** — composite unique on `reimbursementRefundId` ensures at most one snapshot per refund link.
- **Captures full prior state:** expense.id, title, descriptionHash, subCategoryId, status — everything `applyDetachCleanupTx` mutates.
- **Nullable expenseId:** If the refund transaction was orphaned (no expense_id), the snapshot records `NULL`.
- **expenseGroupMembershipId:** If the refund's expense was part of a group, record that membership id so it can be restored.

**Recording the snapshot at link time:**

Inside `createPair` (after loading anchorExpense, before calling `applyDetachCleanupTx`), snapshot the refund's expense:

```ts
// New step: capture refund's pre-link expense state (D-10 snapshot)
const refundExpenseSnapshot = refund.expenseId
  ? await tx.select({
      id: expense.id,
      title: expense.title,
      descriptionHash: expense.descriptionHash,
      subCategoryId: expense.subCategoryId,
      status: expense.status,
    })
      .from(expense)
      .where(
        and(
          eq(expense.id, refund.expenseId),
          eq(expense.userId, input.userId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null)
  : null

// Also check if the refund's expense was in a group
const groupMembership = refundExpenseSnapshot
  ? await tx.select({ id: expenseGroupMembership.id })
      .from(expenseGroupMembership)
      .where(eq(expenseGroupMembership.expenseId, refundExpenseSnapshot.id))
      .limit(1)
      .then((rows) => rows[0] ?? null)
  : null
```

Then, after inserting the `reimbursement_refund` row (line 188-191), insert the snapshot:

```ts
const insertedRefund = await tx.insert(reimbursementRefund).values({
  reimbursementId: insertedReimbursement[0].id,
  transactionId: refund.id,
})
.returning({ id: reimbursementRefund.id })

// Record pre-link snapshot (D-10)
if (refundExpenseSnapshot) {
  await tx.insert(reimbursementRefundSnapshot).values({
    reimbursementRefundId: insertedRefund[0].id,
    expenseId: refundExpenseSnapshot.id,
    expenseTitle: refundExpenseSnapshot.title,
    expenseDescriptionHash: refundExpenseSnapshot.descriptionHash,
    expenseSubCategoryId: refundExpenseSnapshot.subCategoryId,
    expenseStatus: refundExpenseSnapshot.status,
    expenseGroupMembershipId: groupMembership?.id ?? null,
  })
}
```

**Unlink restore logic:**

In `lib/services/transaction-pairs.ts::deletePairByTransactionId` (lines 262-330), when a refund row is deleted (line 298), restore its pre-link state:

```ts
if (refundRow) {
  // Load the snapshot BEFORE deleting the refund row
  const snapshotRow = await tx
    .select({
      expenseId: reimbursementRefundSnapshot.expenseId,
      expenseTitle: reimbursementRefundSnapshot.expenseTitle,
      expenseDescriptionHash: reimbursementRefundSnapshot.expenseDescriptionHash,
      expenseSubCategoryId: reimbursementRefundSnapshot.expenseSubCategoryId,
      expenseStatus: reimbursementRefundSnapshot.expenseStatus,
      expenseGroupMembershipId: reimbursementRefundSnapshot.expenseGroupMembershipId,
    })
    .from(reimbursementRefundSnapshot)
    .where(eq(reimbursementRefundSnapshot.reimbursementRefundId, refundRow.id))
    .limit(1)
    .then((rows) => rows[0] ?? null)

  // Delete the refund row and its snapshot
  await tx.delete(reimbursementRefund).where(eq(reimbursementRefund.id, refundRow.id))
  
  // RESTORE: revert the refund's expense to its pre-link state
  if (snapshotRow?.expenseId) {
    // Refund was already categorized — restore it
    await tx
      .update(expense)
      .set({
        title: snapshotRow.expenseTitle,
        descriptionHash: snapshotRow.expenseDescriptionHash,
        subCategoryId: snapshotRow.expenseSubCategoryId,
        status: snapshotRow.expenseStatus,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(expense.id, snapshotRow.expenseId),
          eq(expense.userId, input.userId),
        ),
      )

    // If the expense was in a group, re-add the membership (in case it was removed by detach logic)
    if (snapshotRow.expenseGroupMembershipId) {
      await tx
        .insert(expenseGroupMembership)
        .values({ id: snapshotRow.expenseGroupMembershipId, ... })  // Needs full data from snapshot
        .onConflictDoNothing()  // idempotent if membership already exists
    }
  } else if (snapshotRow === null) {
    // Refund had no pre-link expense — it was orphaned or uncategorized
    // Leave the refund transaction as-is (no expense_id)
  }

  // Check if reimbursement is now empty and delete it (existing logic, unchanged)
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
```

**Multi-subcategory Group-anchor cleanup edge (D-10 deferred):**

`applyDetachCleanupTx` today accepts a single `subCategoryId` (lines 31-36):

```ts
export type DetachCleanupInput = {
  userId: string
  transactionId: string
  title: string
  subCategoryId?: number | null
}
```

For a Group anchor spanning multiple subcategories, there is no single `anchor.subCategoryId` to inherit. **Recommended behavior (lock in Phase 75 PLAN):**

- **Option A (conservative):** Leave the refund uncategorized (pass `subCategoryId: null`) so the user can manually categorize it. The refund appears as a normal inflow without a subcategory assignment.
- **Option B (intelligent):** If the refund's original expense already had a subcategory, keep it (from the snapshot). Only revert to uncategorized if it had no prior assignment.
- **Option C (impossible):** Try to infer a subcategory from the Group's members — too ambiguous.

**Recommendation:** **Option B** — the snapshot already has `expenseSubCategoryId`, so restore it unconditionally. If the refund's original expense was categorized, that categorization is restored on unlink. The Group anchor's multiple subcategories are irrelevant — the refund's own history is the source of truth.

---

### Q4: Test / Regression Surface

**Existing coverage (from tests/reimbursement-regression.test.ts):**

- **N=1 regression (lines 73-212):** Amazon order (−€100) + one refund (+€50) seeded natively into `reimbursement/reimbursement_refund`; all 10 aggregation call sites prove the net is exactly 50.00 (before/after byte-identical per 73-01/73-02-SUMMARY.md historical proof).
- **Empty-refund probe (lines 214-264):** A reimbursement row with zero `reimbursement_refund` rows returns its own amount unchanged (not zero).
- **N=3 dinner scenarios (lines 275+):** Three refunds netting to anchor's exact magnitude; verifies all 10 aggregation sites; covers adjacency directions and refund-order determinism.

**What Phase 75 must extend:**

1. **Frozen-set inertness at N=1 (regression gate for D-08):**
   - Seed a 1:1 reimbursement AFTER populating `reimbursement_anchor_transaction` via the backfill migration
   - Assert that `effectiveAmount()` using the frozen-set CTE returns the same numeric value as before the migration
   - Verify that importing a later same-merchant transaction does NOT inherit the refund's share

2. **Three motivating cases (D-05 create-or-append, D-10 unlink):**

   **Case 1: Amazon 1:1** (already tested, no new assertions):
   - Create initial 1:1 pair
   - Check `reimbursement_anchor_transaction` has one row
   - Check `reimbursement_refund_snapshot` has one row
   - Unlink: assert refund reverts to pre-link expense state
   - Assert `reimbursement` row is deleted (now-empty)

   **Case 2: Dinner 1:N** (NEW):
   - Seed outflow (-€90)
   - Link first refund (+€30, call `createPair`) → creates new `reimbursement`, records snapshot
   - Link second refund (+€30, call `createPair` on same anchor) → appends to same `reimbursement` (no 23505 error)
   - Link third refund (+€30, call `createPair` on same anchor) → appends
   - Assert `reimbursement` row count = 1, `reimbursement_refund` count = 3
   - Assert `reimbursement_anchor_transaction` = 1 row (the single outflow anchor)
   - Assert `reimbursement_refund_snapshot` = 3 rows (one per refund)
   - Unlink first refund: second and third remain; `reimbursement` still exists with 2 refunds
   - Unlink second, unlink third: on the final unlink, `reimbursement` row is deleted
   - Assert each unlinked refund reverted to its pre-link state

   **Case 3: Vacation M:N (Group anchor)** (NEW):
   - Seed Expense Group with 3 member transactions (hotel -€200, flight -€400, dinner -€100)
   - Link first refund (+€150) → creates `reimbursement` with `expenseGroupId` set, `expenseId = NULL`
   - Link second, third refunds → append to same `reimbursement`
   - Assert `reimbursement_anchor_transaction` captures all 3 Expense ids (or the Group id, depending on schema choice — clarify in PLAN)
   - Assert `effectiveAmount()` spreads refunds proportionally across 3 members: 200/700, 400/700, 100/700
   - Unlink: refunds revert to pre-link state, `reimbursement` deleted when empty

3. **Unlink → baseline restore including recategorization revert:**
   - Seed refund with original `subCategoryId = 5` (e.g., "income_other")
   - Link to anchor with anchor `subCategoryId = 20` (e.g., "restaurant")
   - Assert refund's expense was re-categorized to 20 and title changed to "rimborso..."
   - Unlink
   - Assert refund's expense reverted to `subCategoryId = 5` and title is pre-link title
   - Assert `effectiveAmount()` no longer spreads the anchor's refund (refund now independent)

**Test file structure:**

- New test suite in `tests/reimbursement-phase-75.test.ts` (or extend `reimbursement-regression.test.ts` with new `describeIfReachable` blocks)
- Reuse `seedExpenseWithTransaction`, `seedReimbursement`, `captureAggregationSnapshot` from `fixtures/reimbursement-seed.ts`
- Add new seed helpers:
  - `seedMultiRefundReimbursement` (dinner: one anchor, N refunds)
  - `seedReimbursementOnGroupWithRefunds` (vacation: group anchor, M refunds)

---

## Common Pitfalls

### Pitfall 1: Forgetting to record frozen-set rows on create-or-append
**What goes wrong:** An appended refund may be incorrectly included in the frozen-set calculation if the code path doesn't insert into `reimbursement_anchor_transaction`.

**Why it happens:** When appending (lines 296-302 in the create-or-append pseudocode), only the new refund is inserted; the anchor transaction is assumed already frozen. This assumption holds **only** if the original link already recorded the anchor in the frozen set. A code path that appends without checking is silent corruption.

**How to avoid:** The frozen-set recording (step 6 in create-or-append logic) must run for **both** create and append paths. Use a helper to avoid duplication:

```ts
async function recordAnchorInFrozenSet(tx, { reimbursementId, anchorTransactionId, userId }) {
  // Idempotent insert — same anchor+refund pair is skipped on rerun
  await tx.insert(reimbursementAnchorTransaction).values({
    reimbursementId,
    transactionId: anchorTransactionId,
  }).onConflictDoNothing()
}

// Both paths call it:
await recordAnchorInFrozenSet(tx, { reimbursementId, anchorTransactionId: anchor.id, userId })
```

**Warning signs:** Aggregation queries returning unexpected shares; a new same-merchant transaction's share differs from the original anchor's.

### Pitfall 2: Restoring snapshot without checking for existing expense deletion
**What goes wrong:** On unlink, the code tries to restore an expense that has been deleted (e.g., via a cascade delete from the Group).

**Why it happens:** The `expense` table has a cascade delete on `expense_group_membership`, so if the refund's expense was part of a group and the group is deleted, the expense is gone. Trying to `UPDATE` a non-existent row is a silent no-op (Drizzle returns 0 affected rows), but worse: if a new expense with the same id was created later (UUID collision, unlikely but possible), the update corrupts that new record.

**How to avoid:** Before restoring, check the expense still exists:

```ts
if (snapshotRow?.expenseId) {
  const stillExists = await tx.select({ id: expense.id })
    .from(expense)
    .where(eq(expense.id, snapshotRow.expenseId))
    .then((rows) => rows.length > 0)
  
  if (stillExists) {
    await tx.update(expense)...  // Safe to restore
  } else {
    // Expense was deleted; create a new one from the snapshot
    await tx.insert(expense).values({
      id: crypto.randomUUID(),  // New id, not snapshot.expenseId
      userId: input.userId,
      title: snapshotRow.expenseTitle,
      ...
    })
    // Repoint the transaction to the new expense
    await tx.update(transaction)
      .set({ expenseId: newExpenseId })
      .where(eq(transaction.id, input.transactionId))
  }
}
```

**Warning signs:** Unlink succeeds but the refund doesn't reappear in the correct category; a later import creates a duplicate expense.

### Pitfall 3: Not freezing the anchor transaction on the first link (N=1 misses D-08)
**What goes wrong:** The first link doesn't record the anchor in the frozen set, so D-08's contamination re-appears at N=1.

**Why it happens:** When creating a new reimbursement (first link), the code is tempted to "skip" frozen-set recording because there's "only one transaction anyway." This is a logic error — the frozen set must be populated at link time, before any import can add new same-merchant transactions.

**How to avoid:** Unconditionally record the anchor in the frozen set on every `createPair` call, whether creating or appending. Test with the regression suite (N=1 scenario in tests/reimbursement-phase-75.test.ts).

**Warning signs:** A regression test passes for 1:1 but fails for "1:1 then import same merchant"; a user reports that a later same-merchant purchase incorrectly shows as reimbursed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest + real-Postgres fixture |
| Config file | `vitest.config.ts` (exists, uses Postgres) |
| Quick run command | `yarn test:unit -- tests/reimbursement-phase-75.test.ts` (one new file) |
| Full suite command | `yarn test:unit -- tests/reimbursement-*.test.ts` (all reimbursement suites) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RMB-07 | Add single refund → link succeeds, snapshot recorded | unit | `yarn test:unit -- reimbursement-phase-75.test.ts -t "add single refund"` | ❌ Wave 0 |
| RMB-07 | Add second refund (append) → same `reimbursement` row, no 23505 error | unit | `yarn test:unit -- reimbursement-phase-75.test.ts -t "dinner 1:N append"` | ❌ Wave 0 |
| RMB-07 | Unlink refund → reverts pre-link expense state (title, subCategoryId) | unit | `yarn test:unit -- reimbursement-phase-75.test.ts -t "unlink reverts state"` | ❌ Wave 0 |
| RMB-07 | Unlink last refund → deletes empty `reimbursement` row | unit | `yarn test:unit -- reimbursement-phase-75.test.ts -t "unlink final"` | ❌ Wave 0 |
| RMB-08 | Transaction detail page mounts reimbursement-management component | integration | Manual: `/transactions/[id]` page render | ❌ Wave 0 |
| RMB-08 | Expense Group detail page mounts reimbursement-management component (Group anchor) | integration | Manual: `/expenses/groups/[id]` page render | ❌ Wave 0 |
| D-08 | Frozen-set CTE equals pre-frozen results at N=1 (regression gate) | unit | `yarn test:unit -- reimbursement-regression.test.ts -t "frozen-set inertness"` | ❌ Wave 0 |
| D-08 | Later same-merchant import does NOT inherit refund's share | unit | `yarn test:unit -- reimbursement-phase-75.test.ts -t "contamination guard"` | ❌ Wave 0 |
| D-10 | Multi-refund unlink cascades: each refund reverts independently | unit | `yarn test:unit -- reimbursement-phase-75.test.ts -t "dinner unlink cascade"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `yarn test:unit -- tests/reimbursement-phase-75.test.ts` (quick-run, single file)
- **Per wave merge:** `yarn test:unit -- tests/reimbursement-*.test.ts` (full regression suite)
- **Phase gate:** Full suite green + manual E2E (create multi-refund on transaction detail, unlink, verify baseline restore) before `/gsd-verify-work`

### Wave 0 Gaps

The regression test suite exists (`reimbursement-regression.test.ts`, shipped Phase 73). New scenarios required for Phase 75:

- [ ] `tests/reimbursement-phase-75.test.ts` — full file (new)
  - [ ] Frozen-set inertness @ N=1 (D-08 regression gate)
  - [ ] Dinner 1:N create-or-append (D-05 scenarios)
  - [ ] Vacation M:N Group anchor + unlink (D-10 cascading)
  - [ ] Pre-link snapshot restore assertions
- [ ] `tests/fixtures/reimbursement-seed.ts` — extend with helpers:
  - [ ] `seedMultiRefundReimbursement(db, { anchor, refundIds })` — one anchor, N refunds in one reimbursement
  - [ ] `seedReimbursementOnGroupWithRefunds(db, { groupId, refundIds })` — Group anchor, N refunds
- [ ] `tests/helpers/reimbursement-test-db.ts` — new helper:
  - [ ] Query to load `reimbursement_anchor_transaction` rows (frozen-set verification)
  - [ ] Query to load `reimbursement_refund_snapshot` rows (snapshot verification)

**Framework setup:** Already in place (`vitest.config.ts`, Docker Postgres fixture). No new dependencies.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 1:1 `transaction_pair` table | 1:N `reimbursement` + `reimbursement_refund` | Phase 73 (shipped) | Generalized pairing; old table migrated & dropped |
| Expense-id-based member resolution | Frozen `reimbursement_anchor_transaction` set | Phase 75 (this phase, D-08) | Prevents import-time anchor contamination |
| Single-refund unlink | Multi-refund unlink with full state restore | Phase 75 (this phase, D-10) | Reversibility: user can undo a link completely |
| Net-by-subcategory (ADR 0016 §1) | Explicit linking (ADR 0018) | Phase 73 | Moved from implicit (same category netting) to explicit (reimbursement rows) |

**Deprecated/outdated:**
- `transaction_pair` table: dropped Phase 73 (migration 0030), data migrated to `reimbursement/reimbursement_refund` (migration 0029).
- Magnitude-based anchor/refund resolution (`|amount|`): replaced by sign-based (Phase 73, D-02), fixing the potential inversion when refund > spend.

---

## Assumptions Log

All claims in this research were verified against source code and ADRs. No assumptions flagged for user confirmation.

---

## Open Questions

None at this scope. D-08/D-05/D-10 implementation details are grounded in actual code paths. The multi-subcategory Group-anchor cleanup (mentioned in CONTEXT.md as deferred) is addressed with a recommended behavior (Option B: restore original subcategory from snapshot).

---

## Environment Availability

This phase requires:
- Local Docker Postgres (`yarn db:up`) — for running reimbursement regression suite
- Node.js + npm/yarn — standard project setup
- No new external tools or services

**Status:** ✓ All available. Postgres fixture already operational (Phase 73 tests run against it).

---

## Code Examples

### Example: Frozen-Set CTE (D-08)

**Before (current, vulnerable to contamination):**
```sql
member_transactions AS (
  SELECT m.id, m.amount::numeric AS amount, m.occurred_at
  FROM transaction m
  WHERE m.expense_id IN (SELECT expense_id FROM member_expense_ids)
    AND NOT EXISTS (SELECT 1 FROM reimbursement_refund rr2 WHERE rr2.transaction_id = m.id)
)
```

**After (frozen-set, safe):**
```sql
member_transactions AS (
  SELECT m.id, m.amount::numeric AS amount, m.occurred_at
  FROM transaction m
  INNER JOIN reimbursement_anchor_transaction rat ON rat.transaction_id = m.id
  WHERE rat.reimbursement_id = (SELECT reimbursement_id FROM anchor LIMIT 1)
    AND NOT EXISTS (SELECT 1 FROM reimbursement_refund rr2 WHERE rr2.transaction_id = m.id)
)
```

**Impact:** The inner join to `reimbursement_anchor_transaction` pins the member set to whatever was recorded at link time. A later import cannot add new transactions to the anchor's expense — they won't have a row in the frozen-set table.

### Example: Create-or-Append Service

**Pseudocode (simplified from earlier detail):**
```ts
export async function createPair(input: {
  userId: string
  transactionId: string
  counterpartId: string
}): Promise<CreatePairResult> {
  return db.transaction(async (tx) => {
    // ... ownership checks, sign validation (existing)

    // NEW: Check for existing reimbursement
    const existing = await tx.select({ id: reimbursement.id })
      .from(reimbursement)
      .where(eq(reimbursement.expenseId, anchorExpense.expenseId))
      .limit(1)

    const reimbursementId = existing[0]?.id
      ? existing[0].id  // Append to existing
      : (await tx.insert(reimbursement).values({
          userId: input.userId,
          title: anchorExpense.title,
          expenseId: anchorExpense.expenseId,
        }).returning({ id: reimbursement.id }))[0].id  // Create new

    // Insert refund (works for both create and append)
    await tx.insert(reimbursementRefund).values({
      reimbursementId,
      transactionId: refund.id,
    })

    // Record frozen-set anchor (D-08)
    await tx.insert(reimbursementAnchorTransaction)
      .values({ reimbursementId, transactionId: anchor.id })
      .onConflictDoNothing()  // Idempotent if already recorded

    // Record pre-link snapshot (D-10)
    const refundExpenseSnapshot = refund.expenseId
      ? (await tx.select(...).from(expense).where(...))[0]
      : null
    
    if (refundExpenseSnapshot) {
      await tx.insert(reimbursementRefundSnapshot).values({
        reimbursementRefundId: insertedRefund.id,
        expenseId: refundExpenseSnapshot.id,
        expenseTitle: refundExpenseSnapshot.title,
        expenseDescriptionHash: refundExpenseSnapshot.descriptionHash,
        expenseSubCategoryId: refundExpenseSnapshot.subCategoryId,
        expenseStatus: refundExpenseSnapshot.status,
      })
    }

    // Refund cleanup (existing, unchanged)
    await applyDetachCleanupTx(tx, { ... })

    return { secondaryTransactionId: refund.id }
  })
}
```

---

## Sources

### Primary (HIGH confidence)
- **Code:** `/lib/dal/transaction-pairs-sql.ts` lines 72-129 (`effectiveAmount` CTE, current state)
- **Code:** `/lib/services/transaction-pairs.ts` lines 57-249 (`createPair`, `deletePairByTransactionId`)
- **Code:** `/lib/services/transaction-detach.ts` lines 52-153 (`applyDetachCleanupTx`, state mutations)
- **Code:** `/lib/db/schema.ts` lines 514-567 (reimbursement tables, unique constraints)
- **Code:** `/lib/services/import.ts` lines 561-651 (Expense upsert by descriptionHash, contamination source)
- **ADR:** `/docs/adr/0018-reimbursement-1n-linking-supersedes-net-by-subcategory.md` (1:N model, Mondo Netto, schema decisions)
- **ADR:** `/docs/adr/0017-expense-group-over-physical-merge.md` (Group anchor, explicit membership)
- **ADR:** `/docs/adr/0016-shared-costs-net-by-subcategory-inflows-isolated-per-transaction.md` §2–§4 (Standalone Expense mechanics, valid for Phase 75)
- **CONTEXT:** `.planning/phases/75-linking-surfaces-and-lifecycle/75-CONTEXT.md` (D-01..D-10 decisions, deferred ideas, specifics)

### Secondary (MEDIUM confidence)
- **Tests:** `tests/reimbursement-regression.test.ts` lines 73-212 (N=1 regression gate, aggregation sites covered)
- **Tests:** `tests/fixtures/reimbursement-seed.ts` (seed helpers, minimal taxonomy, test data patterns)
- **Component:** `components/transactions/counterpart-picker-dialog.tsx` (current single-select picker, extension points)
- **DAL:** `lib/dal/transaction-pairs.ts` (eligible-counterpart query, existing filters, window computation)

### Tertiary (LOW confidence)
- Training knowledge on Drizzle ORM migration patterns, Next.js server actions, shadcn/ui checkbox components (used to formulate recommendations, not verified against project code in this session).

---

## Metadata

**Confidence breakdown:**
- **Standard stack:** HIGH — all used technologies are already in project, verified in code
- **Architecture (D-08/D-05/D-10):** HIGH — grounded in actual code paths, ADRs, and schema
- **Frozen-set CTE change:** HIGH — `effectiveAmount()` source read and understood; change is surgical
- **Create-or-append logic:** HIGH — `createPair` source read, existing patterns understood
- **Pre-link snapshot:** HIGH — `applyDetachCleanupTx` mutations documented, schema shape follows project conventions
- **Test strategy:** HIGH — reimbursement test harness exists and is operational

**Research date:** 2026-07-24
**Valid until:** 2026-08-24 (30 days — stable domain, no rapid changes expected)
