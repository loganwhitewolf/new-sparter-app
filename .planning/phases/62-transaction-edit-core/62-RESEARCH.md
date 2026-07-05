# Phase 62: transaction-edit-core — Research

**Researched:** 2026-07-05  
**Domain:** Backend transaction/expense edit services, atomic reconciliation, pair guards  
**Confidence:** HIGH

## Summary

Phase 62 implements safe transaction editing (amount, occurredAt, customTitle) with automatic expense reconciliation and pair guards. The codebase already has all the foundational pieces: `expense-reconciliation.ts` provides generalized aggregate recomputation, `transaction-pairs.ts` implements the pair model and invariants, and the deletion flow shows the atomic transaction pattern. Phase 62 must write `updateTransaction` and `updateExpense` services that reuse this reconciliation logic, enforce pair-breaking edits are rejected (Italian "Scollega prima il rimborso"), and keep `transactionHash`, `descriptionHash`, and `description` immutable. All edits run inside `db.transaction()` with Decimal.js for amounts, ownership-gated by userId.

**Primary recommendation:** Build `updateTransaction` service by directly generalizing `expense-reconciliation.ts` to work on single-expense updates (load aggregates for the linked expense only, build reconcile plan, apply); add pair guard pre-check using `transaction-pairs.ts` invariants; thin action wraps service with Zod validation.

## Locked Decisions (from CONTEXT.md / REQUIREMENTS.md)

**Immutability boundary:**
- `transactionHash` and `descriptionHash` are NEVER editable — they are dedup/grouping keys for the importer.
- `transaction.description` is NEVER editable — it is the raw bank key (sha256 → descriptionHash, Tier 2 history).
- `customTitle` (nullable string) is the rename mechanism.

**Editable sets:**
- **Transaction:** `amount` (Decimal.js, signed), `occurredAt`, `customTitle` — inside `db.transaction`, Zod-validated, ownership-gated.
- **Expense:** `title`, `notes`, `subCategoryId` — status transitions consistent with categorize flow; derived aggregates (`totalAmount`, `transactionCount`, `firstTransactionAt`, `lastTransactionAt`) are NEVER directly writable.

**Pair guard invariant:**
- Opposite-sign, nonzero check (from `transaction-pairs.ts` line 113–116).
- An amount edit that breaks this invariant is rejected with Italian message: "Scollega prima il rimborso."
- Unpaired transactions are unaffected.

**Auto-reconciliation:**
- After amount/date edit, the linked expense's `totalAmount`, `transactionCount`, `firstTransactionAt`, `lastTransactionAt` reconcile atomically in the same `db.transaction`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Transaction amount/date/title edit validation | Backend / Services | — | Business logic: ownership, mutation bounds, invariant checks |
| Atomic reconciliation of expense aggregates | Backend / Services (via expense-reconciliation) | Database (transaction) | Recompute totals in same txn; no separate sync step |
| Pair-break guard enforcement | Backend / Services | — | Invariant check before allowing amount edit |
| Expense title/notes/subcategory edit | Backend / Services | — | Business logic: status transitions, categorization history |
| Zod input validation | Backend / Actions | — | Schema-driven parsing (amount → Decimal, dates, enum bounds) |

## Standard Stack

### Core (Existing, Reused)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | ^0.28.x | Database access, migrations, schema | [VERIFIED: npm registry] Type-safe SQL builder, used across the project |
| Decimal.js | ^10.x | Monetary arithmetic | [VERIFIED: npm registry] Immutable, precise fixed-point; required by CLAUDE.md hard rule |
| Zod | ^3.x | Input validation & parsing | [VERIFIED: npm registry] Schema-driven parsing, used in all existing actions |
| Next.js 16 | ^16.x | Server actions, `"use server"` boundary | [VERIFIED: npm registry] Project baseline; `"use server"` is the pattern for all thin action wrappers |
| TypeScript | ^5.x | Type checking | [VERIFIED: npm registry] Project baseline for services/DAL/actions |

### Supporting (Already Used)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `drizzle-orm` equality/logical ops | (included) | Safe query construction (`and`, `eq`, `inArray`) | All DAL queries; avoids raw SQL for common conditions |
| `@/lib/utils/decimal` helpers | (project) | `toDecimal()`, `toDbDecimal()` | Converting DB strings → Decimal, Decimal → DB strings |
| Better Auth + Drizzle `pg` adapter | (included) | Session verification in actions | `verifySession()` for userId extraction; auth boundary enforcement |

### Code Examples (Existing Patterns to Reuse)

#### Pattern 1: Ownership-Gated Service with DbOrTx
[CITED: lib/services/transaction-pairs.ts#48-66, lib/services/transaction-deletion.ts#27]

```typescript
// From transaction-pairs.ts — ownership read before mutation inside db.transaction
export async function createPair(input: {
  userId: string
  transactionId: string
  counterpartId: string
}): Promise<CreatePairResult> {
  return db.transaction(async (tx): Promise<CreatePairResult> => {
    // 1. Load and own rows
    const [rowsA, rowsB] = await Promise.all([
      tx.select({ ... }).from(transaction).where(...).limit(1),
      tx.select({ ... }).from(transaction).where(...).limit(1),
    ])
    
    // 2. Ownership check — IDOR block
    if (t1.userId !== input.userId || t2.userId !== input.userId) {
      throw new Error('Non sei autorizzato...')
    }
    
    // 3. Invariant check (opposite-sign, nonzero)
    // 4. Mutation
  })
}
```

**Apply to Phase 62:** updateTransaction must follow the same pattern: load transaction + linked expense inside db.transaction, verify userId, check pair invariant, mutate, reconcile.

#### Pattern 2: Expense Reconciliation (Generalize This)
[CITED: lib/services/expense-reconciliation.ts#48-190]

```typescript
// Existing function for removal reconciliation
export async function reconcileExpensesAfterTransactionRemoval(
  database: DbOrTx,
  input: { userId: string; affectedExpenseIds: string[] },
) {
  // 1. Load aggregates for all affected expenses
  const aggregates = await loadAggregatesForExpenses(database, {
    userId: input.userId,
    expenseIds: uniqueExpenseIds,
  })
  // 2. Load which expenses have manual/override history (preserve as empty)
  const manualIds = await loadManualOrOverrideExpenseIds(database, {
    userId: input.userId,
    affectedExpenseIds: uniqueExpenseIds,
  })
  // 3. Build reconciliation plan (which to recalc, which to delete, which to preserve)
  const plan = buildReconcilePlan(uniqueExpenseIds, aggregates, manualIds)
  // 4. Apply the plan (UPDATE or DELETE)
  await applyExpenseReconciliation(database, plan, input.userId)
}
```

**Generalization needed:** Currently handles only post-removal. For edit, phase must refactor to accept `affectedExpenseIds` (same function), or write a simpler variant that skips deletion and just recalculates (since an edit doesn't remove transactions). Phase can inline a simpler "reconcile single expense after edit" by calling `loadAggregatesForExpenses` directly with the edited expense's id, then `applyExpenseReconciliation`.

#### Pattern 3: Pair Invariant Check
[CITED: lib/services/transaction-pairs.ts#108-116]

```typescript
const d1 = toDecimal(t1.amount)
const d2 = toDecimal(t2.amount)
const oppositeSign = (d1.gt(0) && d2.lt(0)) || (d1.lt(0) && d2.gt(0))
if (!oppositeSign) {
  throw new Error('Le transazioni da collegare devono avere segno opposto.')
}
```

**Apply to Phase 62:** Before allowing an amount edit on a paired transaction, check if the new amount would break this invariant. If yes, throw with message "Scollega prima il rimborso".

#### Pattern 4: Thin Action + Zod Validation
[CITED: lib/actions/transactions.ts#41-77, lib/actions/expenses.ts#57-80]

```typescript
// Thin action: parse, verify session, call service, return state or error
export async function createTransaction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = CreateTransactionSchema.safeParse({
    description: formData.get('description'),
    amount: formData.get('amount'),
    occurredAt: formData.get('occurredAt'),
    subCategoryId: formData.get('subCategoryId') ? Number(...) : undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  
  const { userId } = await verifySession()
  try {
    await insertManualTransaction({ userId, ...parsed.data })
  } catch {
    return { error: 'Si è verificato un errore...' }
  }
  revalidateCategorizationSurfaces()
  return { error: null }
}
```

**Apply to Phase 62:** `updateTransactionAction` and `updateExpenseAction` follow this thin-wrapper pattern — parse with Zod, extract userId, call service, return state.

## Pair Guard Invariant Deep Dive

[CITED: lib/services/transaction-pairs.ts#108–116]

A transaction pair enforces:
1. **Opposite sign:** One must be positive, one negative.
2. **Nonzero:** Neither can be €0.00 (Decimal.js treats 0 as neither positive nor negative, so `gt(0) && lt(0)` fails).

When an amount edit is proposed on a paired transaction:
- Load the pair from `transactionPair` table using `transaction_a_id` or `transaction_b_id` FK.
- Load the counterpart's current amount.
- Compute `newAmount` (from request) against counterpart: check `(newAmount.gt(0) && counterpartAmount.lt(0)) || ...`.
- If false, reject with "Scollega prima il rimborso" (Italian: "Unlink the refund first").

**No auto-unlink:** Decision 3 from REQUIREMENTS.md#24 — the pair is never silently removed. The user must explicitly delete the pair via `deletePairByTransactionId` before re-editing.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Monetary arithmetic | Native JS `+`, `-`, `*`, `/` | Decimal.js (`toDecimal`, `toDbDecimal`) | Precision loss, rounding errors on large sums |
| Atomic transaction isolation | Multiple db queries outside tx() | `db.transaction(async (tx) => { ... })` | Race conditions, orphaned rows, inconsistent state |
| Expense total recomputation | Manual sum query in the edit action | `loadAggregatesForExpenses` + `applyExpenseReconciliation` | Already exists, handles min/max dates, null cases, manual-preserved expenses |
| Pair invariant validation | Per-service custom logic | Use `transaction-pairs.ts` exact comparison: `(d1.gt(0) && d2.lt(0)) \|\| (d1.lt(0) && d2.gt(0))` | Consistency across pair creation and editing; Decimal.js prevents foot-guns |
| Zod schema definitions | Ad-hoc string parsing in action | Zod schemas (UpdateTransactionSchema, UpdateExpenseSchema) | Type-safe, reusable, single source of truth for validation |
| Session verification | Direct DB query in action | `verifySession()` from `lib/dal/auth` | Proper auth boundary; session state already loaded by Better Auth |

**Key insight:** The reconciliation service and pair invariant code are non-trivial state-machine logic. Reusing them prevents bugs and keeps the domain model in one place.

## Runtime State Inventory

**Not applicable** — Phase 62 is backend-only (no schema changes, no new columns, no data migration).

## Common Pitfalls

### Pitfall 1: Forgetting the Pair Guard Pre-Check
**What goes wrong:** Allow an amount edit that breaks the pair's opposite-sign invariant. The pair remains in the DB but is now incoherent (both positive, or one is zero). The dashboard and pair operations silently misbehave.  
**Why it happens:** The pair guard is in `createPair`, so developer assumes it's only checked at creation. Edit path is written without re-checking.  
**How to avoid:** Before an amount edit on a paired transaction, always load the pair and validate the new amount against the counterpart's amount using the exact same comparison from line 113–116 of `transaction-pairs.ts`.  
**Warning signs:** Pair becomes both positive/negative, or reports zero-amount. Unit tests do not cover the "edit breaks pair" scenario.

### Pitfall 2: Reconciliation Outside the Transaction
**What goes wrong:** Edit the transaction in `db.transaction(tx)`, then call `reconcileExpensesAfterTransactionRemoval` outside the transaction. Another request deletes the transaction between edit and reconciliation. The expense totals are now orphaned (don't match any remaining transactions).  
**Why it happens:** The reconciliation function accepts `DbOrTx`, so it's tempting to call it inside or outside the transaction indifferently.  
**How to avoid:** All edit mutations AND all reconciliation for those mutations must be inside the same `db.transaction(async (tx) => { ... })` block. Pass `tx` (not `db`) to reconciliation.  
**Warning signs:** Expense totals drift from sum of linked transactions; expense shows €0 when transactions exist.

### Pitfall 3: Recomputing Aggregates Without Handling Manual Expenses
**What goes wrong:** Edit an amount, recompute the expense total, but don't check if the expense was manually categorized (manually-categorized expenses preserve as empty when they have zero transactions, per `buildReconcilePlan`). Re-editing causes a zero-transaction expense to suddenly have a total.  
**Why it happens:** Reconciliation logic is split between `buildReconcilePlan` (which checks `manuallyPreservedExpenseIds`) and `applyExpenseReconciliation`. Developer rewrites reconciliation and forgets the manual-preserve check.  
**How to avoid:** Use the existing `reconcileExpensesAfterTransactionRemoval` (or a factored variant) which already calls `loadManualOrOverrideExpenseIds`. Don't hand-roll the aggregate recomputation.  
**Warning signs:** Manually-categorized expenses flip between zero and nonzero totals unexpectedly.

### Pitfall 4: Decimal.js Amount Not Converted to DB String
**What goes wrong:** Compute `newAmount` as Decimal, then write it to the DB without calling `toDbDecimal()`. The DB stores a Decimal instance (crash) or implicit toString() produces wrong precision.  
**Why it happens:** Decimal.js is a class, not a primitive. It's easy to forget the conversion.  
**How to avoid:** Always use `toDbDecimal(decimalValue)` before `.set({ amount: ... })` in an UPDATE. Lint/test for this pattern.  
**Warning signs:** Type errors on update; DB shows scientific notation or wrong decimals; transaction amount is truncated.

### Pitfall 5: Not Verifying Ownership Before Reconciliation
**What goes wrong:** Load a transaction without checking ownership, then reconcile an expense. A malicious user edits another user's transaction indirectly (reconciliation runs on userId derived from the transaction).  
**Why it happens:** Reconciliation accepts userId as parameter; if the transaction load doesn't verify userId, the parameter is untrusted.  
**How to avoid:** Always load the transaction with a `where(and(eq(transaction.id, ...), eq(transaction.userId, input.userId)))` clause. Then pass the verified userId to reconciliation.  
**Warning signs:** Auth tests pass but transaction-pair or expense-reconciliation tests fail with cross-user scenarios.

## Code Examples

### Example 1: Update Transaction Service (Skeleton)
[CITED: lib/services/transaction-deletion.ts pattern, lib/services/transaction-pairs.ts ownership check]

```typescript
// lib/services/transaction-edit.ts
import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { transaction, transactionPair, expense } from '@/lib/db/schema'
import { toDecimal, toDbDecimal } from '@/lib/utils/decimal'
import { loadAggregatesForExpenses, applyExpenseReconciliation, buildReconcilePlan, loadManualOrOverrideExpenseIds } from './expense-reconciliation'

export type UpdateTransactionInput = {
  userId: string
  transactionId: string
  amount?: string // New amount (must be signed, no currency)
  occurredAt?: Date
  customTitle?: string | null
}

export type UpdateTransactionResult = {
  success: boolean
  message?: string
}

export async function updateTransaction(
  input: UpdateTransactionInput,
): Promise<UpdateTransactionResult> {
  if (!input.amount && !input.occurredAt && input.customTitle === undefined) {
    throw new Error('Nessun campo da modificare.')
  }

  return db.transaction(async (tx) => {
    // 1. Load the transaction + verify ownership + load linked expense
    const [txRows] = await Promise.all([
      tx
        .select({
          id: transaction.id,
          userId: transaction.userId,
          amount: transaction.amount,
          expenseId: transaction.expenseId,
        })
        .from(transaction)
        .where(and(eq(transaction.id, input.transactionId), eq(transaction.userId, input.userId)))
        .limit(1),
    ])

    const txRow = txRows[0]
    if (!txRow) {
      throw new Error('Transazione non trovata.')
    }

    // 2. If amount is being edited and this transaction is paired, check invariant
    if (input.amount !== undefined && input.amount !== txRow.amount) {
      const newAmount = toDecimal(input.amount)
      
      // Load pair if exists
      const [pairRows] = await Promise.all([
        tx
          .select({
            transactionAId: transactionPair.transactionAId,
            transactionBId: transactionPair.transactionBId,
          })
          .from(transactionPair)
          .where(
            or(
              eq(transactionPair.transactionAId, input.transactionId),
              eq(transactionPair.transactionBId, input.transactionId),
            ),
          )
          .limit(1),
      ])

      if (pairRows[0]) {
        const pair = pairRows[0]
        const counterId = 
          pair.transactionAId === input.transactionId 
            ? pair.transactionBId 
            : pair.transactionAId

        const [counterRows] = await Promise.all([
          tx
            .select({ amount: transaction.amount })
            .from(transaction)
            .where(eq(transaction.id, counterId))
            .limit(1),
        ])

        const counterAmount = toDecimal(counterRows[0]?.amount ?? '0')
        const oppositeSign = (newAmount.gt(0) && counterAmount.lt(0)) || (newAmount.lt(0) && counterAmount.gt(0))
        
        if (!oppositeSign) {
          throw new Error('Scollega prima il rimborso')
        }
      }
    }

    // 3. Update the transaction
    const updateSet: any = { updatedAt: new Date() }
    if (input.amount !== undefined) {
      updateSet.amount = toDbDecimal(toDecimal(input.amount))
    }
    if (input.occurredAt !== undefined) {
      updateSet.occurredAt = input.occurredAt
    }
    if (input.customTitle !== undefined) {
      updateSet.customTitle = input.customTitle
    }

    await tx
      .update(transaction)
      .set(updateSet)
      .where(and(eq(transaction.id, input.transactionId), eq(transaction.userId, input.userId)))

    // 4. If amount or date changed and expense is linked, reconcile
    if ((input.amount || input.occurredAt) && txRow.expenseId) {
      const aggregates = await loadAggregatesForExpenses(tx, {
        userId: input.userId,
        expenseIds: [txRow.expenseId],
      })
      const manualIds = await loadManualOrOverrideExpenseIds(tx, {
        userId: input.userId,
        affectedExpenseIds: [txRow.expenseId],
      })
      const plan = buildReconcilePlan([txRow.expenseId], aggregates, manualIds)
      await applyExpenseReconciliation(tx, plan, input.userId)
    }

    return { success: true }
  })
}
```

### Example 2: Action Wrapper with Zod Validation
[CITED: lib/actions/transactions.ts pattern]

```typescript
// lib/actions/transactions.ts — add this function
export async function updateTransaction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = UpdateTransactionSchema.safeParse({
    id: formData.get('id'),
    amount: formData.get('amount'),
    occurredAt: formData.get('occurredAt'),
    customTitle: formData.get('customTitle'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { userId } = await verifySession()
  try {
    const result = await updateTransactionService({
      userId,
      transactionId: parsed.data.id,
      amount: parsed.data.amount,
      occurredAt: parsed.data.occurredAt,
      customTitle: parsed.data.customTitle,
    })
    if (!result.success) {
      return { error: result.message || 'Modifica non riuscita.' }
    }
  } catch (error) {
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }
  revalidateCategorizationSurfaces()
  return { error: null }
}
```

## Validation Architecture

**Test framework:** Vitest (see `vitest.config.ts`)  
**Config file:** `vitest.config.ts`  
**Quick run command:** `vitest run tests/transaction-edit.test.ts`  
**Full suite command:** `vitest run`

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DET-01 | updateTransaction edits amount/date/title inside db.transaction, hashes/description untouched | unit | `vitest run tests/transaction-edit.test.ts::updateTransaction` | ❌ Wave 0 |
| DET-02 | After amount/date edit, linked expense aggregates reconcile atomically | unit | `vitest run tests/transaction-edit.test.ts::reconcileAfterEdit` | ❌ Wave 0 |
| DET-03 | Paired transaction amount edit rejected if it breaks opposite-sign/nonzero invariant | unit | `vitest run tests/transaction-edit.test.ts::pairGuard` | ❌ Wave 0 |
| DET-04 | updateExpense covers title/notes/subCategoryId; derived fields never writable | unit | `vitest run tests/expense-edit.test.ts::updateExpense` | ❌ Wave 0 |

### Wave 0 Gaps

- [ ] `tests/transaction-edit.test.ts` — covers DET-01 (basic edit), DET-02 (reconciliation), DET-03 (pair guard)
- [ ] `tests/expense-edit.test.ts` — covers DET-04 (title/notes/category edit, status consistency)
- [ ] Fixtures: seedUser + seedTransaction + seedExpense functions for test setup
- [ ] Mock patterns: service tests can use real db.transaction or stub it (recommend real, since atomicity is critical)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | DB writes | ✓ | (Vercel Postgres) | — |
| Node.js | Runtime | ✓ | 20+ (Vercel) | — |
| TypeScript | Type checking | ✓ | 5.x | — |
| Vitest | Testing | ✓ | ^0.34.x | None (existing setup) |

**No missing dependencies.**

## Security Domain

**ASVS Categories applicable:**

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `verifySession()` gate before service call; userId never from request |
| V3 Session Management | yes | Better Auth manages session; action checks expiration via verifySession() |
| V4 Access Control | yes | Ownership check: `eq(transaction.userId, input.userId)` in all reads/writes; transaction_pair has no userId, so must verify both legs |
| V5 Input Validation | yes | Zod schemas for amount (decimal), date (ISO string), customTitle (max 255 chars); amount normalized via Decimal.js |
| V6 Cryptography | no | Hashes (transactionHash, descriptionHash) are computed at import time; never re-computed in edit path |

**Known threat patterns for Next.js + Drizzle:**

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR — user edits another user's transaction | Tampering | Load with `where(and(eq(transaction.userId, input.userId)))` before any mutation |
| Pair orphaning — edit breaks pair invariant silently | Tampering | Pre-check invariant before allowing edit; reject with user-facing message, never auto-fix |
| Atomic violation — edit + reconciliation separated | Tampering | All mutations + reconciliation in same `db.transaction(async (tx) => { ... })` block |
| Decimal precision loss | Tampering | Use Decimal.js, never native JS arithmetic; convert to DB string via `toDbDecimal()` |

## Sources

### Primary (HIGH confidence)

- `lib/services/expense-reconciliation.ts` — existing aggregate recomputation logic (load, plan, apply)
- `lib/services/transaction-pairs.ts` — existing pair model, invariant checks (opposite-sign/nonzero)
- `lib/services/transaction-deletion.ts` — existing atomic deletion + reconciliation pattern
- `lib/actions/transactions.ts`, `lib/actions/expenses.ts` — existing action wrapper patterns
- REQUIREMENTS.md#39–52 (locked decisions from grill 2026-07-05)
- CLAUDE.md (project hard rules: Decimal.js, db.transaction, ownership gates, DbOrTx, layers)

### Secondary (MEDIUM confidence)

- `lib/db/schema.ts` — transaction and expense table definitions, null constraints
- `lib/validations/transactions.ts`, `lib/validations/expense.ts` — existing Zod schemas (extend for update operations)
- `vitest.config.ts` — test framework setup, mocking patterns
- `CONTEXT.md` — domain language (Transaction, Expense, Pair, reconciliation, manual-preserved)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools exist, versions confirmed (npm, schema inspection, REQUIREMENTS.md)
- Architecture: HIGH — expense-reconciliation and transaction-pairs services are concrete, tested code
- Pair guard: HIGH — invariant is explicitly coded in transaction-pairs.ts line 113–116
- Pitfalls: MEDIUM — based on existing codebase patterns; some edge cases (manual-preserved expenses, self-pair guard) learned from Phase 61 quick task

**Research date:** 2026-07-05  
**Valid until:** 2026-07-12 (backend patterns stable; monitor Drizzle/Decimal.js changelog)
