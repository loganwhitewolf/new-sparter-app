---
phase: 50-transaction-pairing
reviewed: 2026-06-14T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - lib/db/schema.ts
  - lib/dal/transaction-pairs-sql.ts
  - lib/dal/transaction-pairs.ts
  - lib/dal/transactions.ts
  - lib/dal/dashboard.ts
  - lib/dal/overview.ts
  - lib/services/transaction-pairs.ts
  - lib/actions/transaction-pairs.ts
  - lib/validations/transaction-pairs.ts
  - components/transactions/counterpart-picker-dialog.tsx
  - components/transactions/transaction-pair-popover.tsx
  - components/transactions/transaction-table.tsx
  - app/(app)/transactions/page.tsx
  - drizzle/migrations/0020_transaction_pair.sql
  - tests/transaction-pairs-service.test.ts
  - tests/transaction-pairs-dal.test.ts
  - tests/dashboard-dal.test.ts
  - tests/transactions-dal.test.ts
findings:
  critical: 3
  warning: 7
  info: 4
  total: 14
status: issues_found
---

# Phase 50: Code Review Report

**Reviewed:** 2026-06-14
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Transaction-pairing feature for the Sparter Italian finance app. The architecture is sound: shared netting fragments (`isNotSecondary` / `effectiveAmount`) are correctly centralized in `transaction-pairs-sql.ts` and reused across `dashboard.ts` and `overview.ts`, the service layer is the documented sole ownership gate (D-01), monetary arithmetic consistently uses Decimal.js in TS code, and the SQL uses Drizzle parameter binding (no string interpolation of user values).

However, the review surfaced three blockers. The most serious is a **self-pairing bug** in `createPair`: nothing prevents `transactionId === counterpartId`, which inserts a `(X, X)` row that passes both unique constraints and then poisons every netting query (`effectiveAmount` doubles X's own amount). The second is a **concurrency / non-atomicity gap** in `createPair` — ownership read and pair insert run on the autocommit `db` handle outside any transaction, and `deletePairByTransactionId`'s delete is unscoped to the verified transaction. The third is a **non-opposite-sign / equal-amount netting hazard** combined with the zero-amount sign filter that can silently pick a same-sign or self counterpart. Several warnings concern swallowed errors masking real failures and missing input validation on a server action.

## Critical Issues

### CR-01: `createPair` allows self-pairing (transactionId === counterpartId), corrupting all netting

**File:** `lib/services/transaction-pairs.ts:20-96`
**Issue:** The service never checks that `input.transactionId !== input.counterpartId`. The UI excludes self via `ne(transaction.id, referenceId)` in `getEligibleCounterparts`, but `createTransactionPairAction` reads `counterpartId` straight from `FormData` and passes it through — the action/service is the real trust boundary. When both IDs are equal, both `select` queries return the same row, ownership passes, `abs1.gt(abs2)` is false and `abs2.gt(abs1)` is false, `date1 <= date2` is true, so the insert is `{ transactionAId: X, transactionBId: X }`. The two unique constraints (`a_unique`, `b_unique`) are independent columns, so a `(X, X)` row inserts cleanly. Thereafter `effectiveAmount()` matches `tp.transaction_a_id = X` and adds `X.amount + (SELECT t2.amount WHERE t2.id = tp.transaction_b_id = X)` → the transaction's own amount is **doubled** in every dashboard/overview total, and `isNotSecondary()` excludes X from aggregation while `effectiveAmount` still references it — a silently wrong total with no error surfaced to the user.
**Fix:**
```ts
if (input.transactionId === input.counterpartId) {
  throw new Error('Non puoi collegare una transazione a sé stessa.')
}
```
Add immediately after the ownership check (or before the DB reads). Also consider a DB-level CHECK constraint `transaction_a_id <> transaction_b_id` for defense in depth.

### CR-02: `createPair` ownership-check-then-insert is non-atomic; `deletePairByTransactionId` delete is unscoped

**File:** `lib/services/transaction-pairs.ts:27-95` and `lib/services/transaction-pairs.ts:105-130`
**Issue:** Two related correctness/security gaps, neither wrapped in `db.transaction`:

1. **createPair TOCTOU + partial-failure:** The two ownership `SELECT`s and the `INSERT` run as three independent statements on the autocommit `db` handle. Between the read and the insert, the row's `userId` is established only from the earlier snapshot. More importantly, there is no transactional guarantee — if a concurrent request or constraint interaction occurs, the ownership decision and the write are not isolated. The project hard rule is that multi-statement write workflows that depend on a prior read run inside `db.transaction(async (tx) => …)` with helpers taking `DbOrTx`. This write path ignores that pattern.

2. **deletePairByTransactionId deletes by transactionId only, not by the verified ownership:** The ownership check confirms `transaction.userId === input.userId`, but the subsequent `delete(transactionPair).where(or(eq(transactionAId, txId), eq(transactionBId, txId)))` is keyed solely on the transaction id. That happens to be safe today because the ownership check precedes it, but the delete and the check are not atomic and the delete carries no ownership predicate of its own. Since `transaction_pair` has no `userId` (D-01), the delete relies entirely on the preceding read being still valid at delete time. Wrap both in a single transaction so the check and the mutation are isolated:
**Fix:**
```ts
await db.transaction(async (tx) => {
  const rows = await tx.select(...).from(transaction).where(eq(transaction.id, input.transactionId)).limit(1)
  const t = rows[0]
  if (!t || t.userId !== input.userId) throw new Error('Non sei autorizzato a scollegare questa transazione.')
  await tx.delete(transactionPair).where(or(...))
})
```
Apply the same `db.transaction` wrapping to `createPair` (reads + insert in one tx).

### CR-03: opposite-sign pairing is not enforced server-side; equal-|amount| / zero-amount counterparts net incorrectly

**File:** `lib/services/transaction-pairs.ts:63-95`, `lib/dal/transaction-pairs.ts:47-58`
**Issue:** The feature's economic model (expense ↔ reimbursement) assumes the two legs have opposite signs so the net is meaningful. `getEligibleCounterparts` enforces opposite sign for the *candidate list* via `signFilter`, but:

- `createPair` performs **no sign validation**. `counterpartId` is attacker/script-controllable via `FormData`; a caller can pair two same-sign transactions (e.g. two −€100 expenses). The result: `effectiveAmount` for the primary becomes `-100 + -100 = -200`, *inflating* `totalOut` rather than netting it, and the secondary is excluded — a corrupt total with no validation barrier.
- The sign filter in `getEligibleCounterparts` uses `refDecimal.isNegative()` with a binary else-branch. A **zero-amount** reference (`'0.00'`) is not negative, so it falls into `lt(transaction.amount, '0')` — silently treating a zero transaction as positive. Zero-amount references should be rejected (pairing a €0 transaction is meaningless) rather than defaulting a branch.

**Fix:** In `createPair`, after loading both rows, validate opposite signs with Decimal.js and reject equal/zero degenerate cases:
```ts
const d1 = toDecimal(t1.amount)
const d2 = toDecimal(t2.amount)
if (d1.isZero() || d2.isZero() || d1.isNegative() === d2.isNegative()) {
  throw new Error('Le transazioni collegate devono avere segno opposto.')
}
```
In `getEligibleCounterparts`, reject a zero/empty `referenceAmount` explicitly instead of letting the else-branch absorb it.

## Warnings

### WR-01: Blanket `catch {}` returning empty/zero data masks real DB failures across the dashboard DAL

**File:** `lib/dal/dashboard.ts:411-431, 433-473, 901-960, 962-1020, 1022-1128, 1130-1347, 1349-1404` and `lib/dal/overview.ts:86-101, 113-154, 196-358, 452-497`
**Issue:** Nearly every aggregation query is wrapped in `try { … } catch { return ZERO/[] }`. A malformed `effectiveAmount`/`isNotSecondary` fragment, a missing index, a type-cast error, or a genuine outage all silently degrade to "€0.00 / no data" with no log and no error surfaced. During this phase specifically — where new correlated subqueries were introduced into these exact queries — a broken pairing fragment would render as an empty dashboard rather than a visible failure, making regressions extremely hard to detect. At minimum log the caught error (`console.error`) before returning the empty fallback so failures are observable.
**Fix:** Add `catch (err) { console.error('getOverviewAmountTotals failed', err); return … }` (and equivalents) to each handler; consider distinguishing "no rows" from "query threw".

### WR-02: `loadEligibleCounterpartsAction` has no Zod validation and trusts client-supplied `referenceId` / `referenceAmount`

**File:** `lib/actions/transaction-pairs.ts:60-73`
**Issue:** Unlike `createTransactionPairAction` / `deleteTransactionPairAction`, this action does not validate its params with a Zod schema, and it passes `referenceId` and `referenceAmount` to the DAL unchecked. `getEligibleCounterparts` never verifies that `referenceId` belongs to the session user, and `referenceAmount` is taken verbatim (used only to choose the sign filter, so no cross-user leak — the candidate list is `userId`-scoped — but a caller can drive the query with an arbitrary amount/sign decoupled from the real reference transaction). Add a schema and, defensively, derive `referenceAmount` server-side by loading the reference transaction under the session user rather than trusting the client value.
**Fix:** Introduce `LoadCounterpartsSchema` (validate `referenceId` non-empty, `referenceAmount` numeric-string, `dateFrom <= dateTo`) and look up the reference transaction's amount/ownership in the DAL instead of trusting the client.

### WR-03: `createPair` does not translate the unique-constraint violation into a user-facing message

**File:** `lib/services/transaction-pairs.ts:90-95`
**Issue:** D-02 / T-50-02 rely on the DB unique constraints to block double-linking, and the comment says the error is "surfaced … for T-50-02." But the raw Postgres error (`duplicate key value violates unique constraint "transaction_pair_a_unique"`) is thrown verbatim and propagated to `createTransactionPairAction`, which returns `err.message` directly to the client (`actions/transaction-pairs.ts:41`). The user sees an English DB internals string in an otherwise Italian UI, and internal constraint names leak. Catch the unique violation and throw a localized message.
**Fix:**
```ts
try {
  await db.insert(transactionPair).values({ transactionAId: primaryId, transactionBId: secondaryId })
} catch (e) {
  if (isUniqueViolation(e)) throw new Error('Una delle transazioni è già collegata a un’altra.')
  throw e
}
```

### WR-04: `pairedNetAmount` correlated subquery does not exclude self-pairs / assumes exactly one counterpart

**File:** `lib/dal/transactions.ts:93-147`
**Issue:** The five paired-field subqueries each `JOIN transaction t2 ON t2.id = CASE … END … LIMIT 1`. They rely on the invariant that a transaction is in at most one pair (enforced by the unique constraints) and that A≠B. If CR-01's self-pair row exists, `pairedWithId` resolves to the row's own id and `pairedNetAmount` doubles its amount — the popover then renders nonsense ("Rimborso collegato" pointing at itself). Even absent the self-pair bug, these are five separate correlated subqueries computing the same `CASE` join per row (the netting logic is re-derived here rather than reusing the shared fragment), which diverges from the "reuse, don't re-derive" guidance and risks drift if the pairing rule changes.
**Fix:** Resolve CR-01 first; then consider collapsing the five subqueries into a single `LEFT JOIN LATERAL` (or reusing a shared fragment) so the counterpart-resolution logic lives in one place.

### WR-05: `transaction-table` falls back `pairedAmount ?? pairedNetAmount` and `pairedOccurredAt ?? new Date()`, rendering wrong data instead of hiding the badge

**File:** `components/transactions/transaction-table.tsx:395-403`
**Issue:** The badge renders when `pairedWithId && pairedNetAmount` are present, but then passes `pairedAmount={transaction.pairedAmount ?? transaction.pairedNetAmount}` and `pairedOccurredAt={transaction.pairedOccurredAt ?? new Date()}`. If the DAL ever returns a paired row with null `pairedAmount`/`pairedOccurredAt` (e.g. partial data, or a future query change), the popover silently shows the *net* as if it were the counterpart's own amount, and today's date as the counterpart date — misleading financial information presented as fact. Prefer not rendering the popover (or showing a neutral placeholder) when these fields are null, rather than substituting plausible-but-wrong values.
**Fix:** Gate the popover on all required fields being non-null, or pass nulls through and have `TransactionPairPopover` render a fallback when a field is missing.

### WR-06: `getMonthOverMonthCategoryChanges` reconciliation loop has a dead/incorrect guard for the allocation grain

**File:** `lib/dal/overview.ts:384-402`
**Issue:** The "include rows present in prev but not curr" loop does `if (changes.some((c) => c.categoryId === prev.id)) continue`. For the allocation grain, every pushed change has `categoryId: null` (lines 375, 396), so `c.categoryId === prev.id` is always false for real ids — the first guard never matches in allocation mode, and de-duplication relies solely on the second guard (`currRows.some((r) => r.id === prev.id)`). Worse, if two different prev natures were ever processed, the `categoryId === null` collision could mis-match. The logic happens to work because of the second guard, but the first guard is misleading dead code that will bite a future editor. Use the row id consistently for de-dup regardless of grain.
**Fix:** Track processed ids in a `Set<number>` keyed on the raw `id`, independent of the `categoryId` projection that is nulled for allocation.

### WR-07: `offsetDateISO` uses local-time `toISOString().slice(0,10)`, producing off-by-one date windows near midnight / DST

**File:** `components/transactions/counterpart-picker-dialog.tsx:52-56, 70-71`
**Issue:** `offsetDateISO` builds the ±90-day window by mutating a `Date` and calling `toISOString()` (UTC) on a value derived from local `setDate`. For users in a positive UTC offset (Italy is UTC+1/+2), a transaction dated near midnight can shift the computed `from`/`to` by a day, subtly narrowing or widening the eligible window versus what the user expects. The new `Date(from)` in `fetchCounterparts` then re-parses that `YYYY-MM-DD` as UTC midnight, compounding the boundary ambiguity. Use a date-only helper that operates in the intended timezone consistently.
**Fix:** Compute the offset using UTC date parts (or a date-only utility) so the string and the re-parsed `Date` agree on the boundary.

## Info

### IN-01: Dead formatter cache in `transaction-table.tsx`

**File:** `components/transactions/transaction-table.tsx:62-83, 91-93`
**Issue:** `amountFormatterCache` and `getAmountFormatter` are no longer called — `formatAmount` delegates to `formatAbsoluteAmount`. The comment admits they are "kept to avoid breaking any possible future references." This is dead code carrying an unused `Intl.NumberFormat` cache.
**Fix:** Remove `amountFormatterCache` and `getAmountFormatter`.

### IN-02: Duplicated `dateScopedTransactions` / `expenseStatusIncludedInDashboardTotals` helpers across DAL files

**File:** `lib/dal/overview.ts:51-61` vs `lib/dal/dashboard.ts:395-409`
**Issue:** `dateScopedTransactions` and `expenseStatusIncludedInDashboardTotals` are defined independently in both files with identical bodies. The phase brief emphasizes reusing shared fragments; these two should also be centralized (e.g. alongside `transaction-pairs-sql.ts` or a shared dashboard-sql module) to prevent the two copies drifting.
**Fix:** Export them once and import in both DAL modules.

### IN-03: Duplicated `formatDate` / `dateFormatter` and amount-formatting helpers across pairing components

**File:** `components/transactions/counterpart-picker-dialog.tsx:41-49`, `components/transactions/transaction-pair-popover.tsx:18-58`, `components/transactions/transaction-table.tsx:63-67`
**Issue:** Three components each declare their own `it-IT` `Intl.DateTimeFormat` and near-identical `formatAmount`/`formatCounterpartAmount`/`formatNet` helpers (sign + `€` + comma-decimal). This is benign duplication but a maintenance hazard if the display format changes.
**Fix:** Extract a shared `formatSignedAmount` / `formatItDate` into `lib/utils/format-amount` and reuse.

### IN-04: `getEligibleCounterparts` does not exclude the reference transaction's own expense / cross-currency mismatches

**File:** `lib/dal/transaction-pairs.ts:60-78`
**Issue:** The candidate query filters by sign, date window, self-id, and already-paired, but does not consider `currency`. Pairing an EUR expense with a USD reimbursement would net two different-currency DECIMAL strings algebraically in `effectiveAmount` (`amount::numeric + amount::numeric`) producing a meaningless number. Most data is EUR so impact is low, but a currency guard (or at least a same-currency filter) would prevent silent cross-currency netting.
**Fix:** Add `eq(transaction.currency, referenceCurrency)` to the candidate filter and validate currency equality in `createPair`.

---

_Reviewed: 2026-06-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
