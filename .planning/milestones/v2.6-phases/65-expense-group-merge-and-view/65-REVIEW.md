---
phase: 65-expense-group-merge-and-view
reviewed: 2026-07-19T00:00:00Z
depth: standard
files_reviewed: 31
files_reviewed_list:
  - app/(app)/expenses/groups/[groupId]/page.tsx
  - components/expenses/bulk-action-bar.tsx
  - components/expenses/expense-detail-client.tsx
  - components/expenses/expense-table.tsx
  - components/expenses/group-detail-client.tsx
  - components/expenses/group-title-edit.tsx
  - components/expenses/merge-expenses-dialog.tsx
  - components/transactions/transaction-detail-client.tsx
  - components/transactions/transaction-table.tsx
  - drizzle/migrations/0026_nervous_thena.sql
  - drizzle/migrations/meta/0026_snapshot.json
  - drizzle/migrations/meta/_journal.json
  - lib/actions/expenses.ts
  - lib/dal/expenses.ts
  - lib/dal/transactions.ts
  - lib/db/schema.ts
  - lib/routes.ts
  - lib/services/expense-group.ts
  - lib/validations/expense.ts
  - tests/categorization-revalidation-actions.test.ts
  - tests/expense-actions.test.ts
  - tests/expense-bulk-action-bar.test.tsx
  - tests/expense-detail-dal.test.ts
  - tests/expense-detail-page.test.tsx
  - tests/expense-group-dal.test.ts
  - tests/expense-group-service.test.ts
  - tests/expense-table-menu.test.tsx
  - tests/group-detail-page.test.tsx
  - tests/merge-expenses-dialog.test.tsx
  - tests/transaction-detail-dal.test.ts
  - tests/transaction-detail-page.test.tsx
  - tests/transaction-table-menu.test.tsx
  - tests/transactions-dal.test.ts
findings:
  critical: 3
  warning: 5
  info: 2
  total: 10
status: issues_found
---

# Phase 65: Code Review Report

**Reviewed:** 2026-07-19T00:00:00Z
**Depth:** standard
**Files Reviewed:** 31
**Status:** issues_found

## Summary

Reviewed the Expense Group merge-and-view feature (ADR 0017): the new `expense_group`/`expense_group_membership` schema and migration, `createExpenseGroup`/`renameExpenseGroup` services, the `mergeExpenses`/`renameExpenseGroupAction` server actions and their Zod schemas, the group detail page/client, the merge dialog, and the expense/transaction table and detail-page integrations (grouped-row rendering, group-title precedence, transaction pairing UI).

The merge *write* path itself is solid: `createExpenseGroup` does ownership + already-grouped checks before insert, closes the check-then-act race with a `23505` translation, and `mergeExpenses` re-validates category-sameness server-side even though the client also gates it — all well covered by unit tests.

Three BLOCKERs were found. The most serious is a gap the phase's own research doc explicitly warned against: deleting a grouped expense is not guarded against the schema's `ON DELETE CASCADE`, so it silently falls out of its group (or orphans the group) with zero warning to the user. The other two are client-side staleness bugs: two of the newly-added multi-step dialogs (merge, and transaction pairing from the list view) succeed server-side but never sync the affected rows back into the table's local `useState`-held row list and never call `router.refresh()` either, so the UI shows stale data until a manual reload — this is inconsistent with sibling handlers (`BulkDeleteExpensesDialog`'s `onSuccess`, `handleUnpair`) that do update state correctly. Several smaller warnings cover a foreseeable-but-unprevented UX dead end in the merge dialog, an unscoped/racy new authorization guard, and a schema validation gap.

## Critical Issues

### CR-01: Deleting a grouped member expense cascades silently — contradicts the phase's own documented risk

**File:** `lib/actions/expenses.ts:151-177` (`deleteExpense`), `lib/actions/expenses.ts:179-208` (`bulkDeleteExpenses`), `lib/services/expense-deletion.ts:1-70` (`deleteExpensesWithOptions`)
**Issue:** `categorizeExpense` (same file, `lib/actions/expenses.ts:307-317`) added an explicit "D-03" guard this phase: before starting the transaction it queries `expenseGroupMembership` for the target expense id and rejects with `'Questa spesa fa parte di un gruppo: categorizza dal gruppo.'` when the expense is a group member — protecting the "all members share one subCategoryId" invariant.

No equivalent guard exists on the deletion path. `deleteExpense`, `bulkDeleteExpenses`, and the underlying `deleteExpensesWithOptions` service (which imports only `expense` and `transaction`, never `expenseGroupMembership`) delete by `expense.id` scoped only to `userId`, with zero awareness of group membership. Since `expense_group_membership.expense_id` has `ON DELETE CASCADE` to `expense.id` (`lib/db/schema.ts:511-513`; confirmed in `drizzle/migrations/0026_nervous_thena.sql:22`), deleting a grouped member's expense row:

1. Silently removes it from its `expense_group` — the delete confirmation dialogs never mention this. `ExpenseDetailClient`'s delete dialog (`components/expenses/expense-detail-client.tsx:357-401`) already reads `expense.groupId` elsewhere in the same component (to hide "Cambia categoria" and to render the "Parte di" link) but never checks it before rendering the generic delete confirmation.
2. Is fully reachable in the UI: `GroupDetailClient`'s members list links directly to each member's own detail page (`components/expenses/group-detail-client.tsx:112-123`, `href={expenseDetailHref(member.id)}`), and that page's "Elimina" action has no group check.
3. Is also reachable via a linked transaction: both `TransactionDetailClient` and `TransactionTable`'s delete dialogs show an "elimina anche la spesa collegata" checkbox whenever `expenseTransactionCount === 1` (the `isOneToOne` gate), which does not distinguish a grouped member with exactly one transaction from an ungrouped one.
4. If the deleted member is a group's last remaining member, the `expense_group` row is permanently orphaned (zero memberships) — nothing surfaces or cleans this up; `getExpenses`/`getExpenseGroupForDetail` only ever reach a group through a still-existing member row.

This is exactly the risk `65-RESEARCH.md` calls out under its race-condition table: *"Race condition: group created + member removed simultaneously | ... deleteExpense must NOT cascade-delete from group"* (line 871). It is untested — no test in `tests/expense-actions.test.ts`, `tests/expense-detail-page.test.tsx`, `tests/transaction-detail-page.test.tsx`, or `tests/transaction-table-menu.test.tsx` exercises deleting a grouped expense.
**Fix:** Add the same style of guard used in `categorizeExpense` to `deleteExpense`/`bulkDeleteExpenses` (or centrally inside `deleteExpensesWithOptions`), and update both delete-confirmation dialogs to warn when the target expense (or, for the transaction-side "elimina anche" checkbox, its linked expense) is a group member:
```ts
// lib/services/expense-deletion.ts — before deleting, reject any id that is a group member
const groupedIds = await tx
  .select({ expenseId: expenseGroupMembership.expenseId })
  .from(expenseGroupMembership)
  .where(inArray(expenseGroupMembership.expenseId, expenseIdsToDelete))

if (groupedIds.length > 0) {
  throw new Error('Una o più spese fanno parte di un gruppo: rimuovile dal gruppo prima di eliminarle.')
}
```
(If leaving/removing a single member is intentionally deferred to a later phase, at minimum block deletion server-side rather than allowing a silent, un-warned removal.)

### CR-02: Merging expenses leaves the Expenses table showing stale, ungrouped rows

**File:** `components/expenses/expense-table.tsx:478-488`
**Issue:** `MergeExpensesDialog`'s `onSuccess` handler only clears selection and closes the dialog:
```tsx
<MergeExpensesDialog
  ...
  onSuccess={() => {
    setSelectedIds([])
    setMergeDialogOpen(false)
  }}
/>
```
It never removes/replaces the merged rows in `loadedExpenses`, and the component never calls `router.refresh()` anywhere (no `router`/`refresh` reference exists in this file). Contrast this with the sibling `BulkDeleteExpensesDialog.onSuccess` a few lines above, which explicitly filters `loadedExpenses` on success.

Even adding `router.refresh()` here would not fix it alone: `loadedExpenses` is seeded via `useState(() => dedupeExpenseRows(expenses))`, and React does not re-run a `useState` initializer on a parent re-render with new props — only an explicit state update (as `BulkDeleteExpensesDialog`'s handler and `updateTransactionTitle`/`markExpensesCategorized` in the transaction table do) can reflect the new group.

Result: after a successful "Unisci" (toast: "Spese unite."), the merged expenses keep rendering as separate, individually-selectable rows — no "Unita" badge, checkboxes still enabled — until a full page reload. A user who then selects one of those (now actually grouped) rows and tries to merge/act on it again gets a confusing server-side rejection ("Una spesa selezionata fa già parte di un gruppo.") for what still looks like an ordinary ungrouped row.
**Fix:** Update `loadedExpenses` on success (drop the merged ids and/or trigger a refetch), mirroring `BulkDeleteExpensesDialog`'s pattern:
```tsx
onSuccess={() => {
  const mergedIds = new Set(selectedRows.map((e) => e.id))
  setLoadedExpenses((prev) => prev.filter((e) => !mergedIds.has(e.id)))
  // optionally router.refresh() afterwards to pick up the new composed group row
  setSelectedIds([])
  setMergeDialogOpen(false)
}}
```

### CR-03: Pairing a transaction from the list view doesn't update the row locally — pair badge never appears without a reload

**File:** `components/transactions/transaction-table.tsx:752-767`
**Issue:** The row-level "Collega rimborso" flow wires `CounterpartPickerDialog.onPaired` to only repaint categorization, never the pairing fields:
```tsx
onPaired={({ secondaryTransactionId, subCategoryId }) => {
  if (subCategoryId !== undefined) {
    markExpenseCategorized(secondaryTransactionId, String(subCategoryId))
  }
}}
```
Nothing sets `pairedWithId` / `pairedNetAmount` / `pairedAmount` / `pairedDescription` / `pairedOccurredAt` on either leg of the newly-created pair. This is the exact inverse of `handleUnpair` (lines 237-259 in this same file), which *does* optimistically clear those fields on both legs after a successful unpair. Because `loadedTransactions` is local `useState` seeded once from the `transactions` prop (see CR-02's note on why prop updates don't reset `useState`), neither row will show the `TransactionPairPopover` badge (guarded on `pairedWithId && pairedNetAmount && pairedAmount && pairedOccurredAt`, lines 450-461) until a full page reload — even though the server-side pair was created successfully. This is inconsistent with `TransactionDetailClient`'s pairing flow (`transaction-detail-client.tsx:356-366`), which correctly calls `router.refresh()` because that page has no intervening local list state to go stale.
**Fix:** Mirror `handleUnpair`'s optimistic-update pattern — have `onPaired` set the pairing fields on both the primary (`pairTarget.id`) and `secondaryTransactionId` rows in `loadedTransactions` using the pair data returned by the picker (amount/description/occurredAt/net), not just the subcategory repaint.

## Warnings

### WR-01: Merge dialog lets a mixed-category selection walk into a foreseeable server rejection

**File:** `components/expenses/merge-expenses-dialog.tsx:49-53, 191-202` (`nextStepAfterTitle`, categorize-step `SubcategoryPicker`), `components/expenses/expense-table.tsx:95-101` (`mergeEligible`)
**Issue:** `mergeEligible` only checks that the *already-categorized* subset of the selection shares one `subCategoryId`; it allows "Unisci" whenever some items are still uncategorized. `nextStepAfterTitle` then routes any selection containing an uncategorized item straight to the `categorize` step, and that step's `SubcategoryPicker` lets the user pick **any** subcategory — it is never constrained or pre-filled to the subcategory already shared by the previously-categorized items in the same selection. If the user picks a different subcategory, `runCategorizeStep` categorizes the previously-uncategorized ids to that new value, and the final `handleConfirmMerge` → `mergeExpenses` call then fails server-side with `'Le spese devono avere la stessa categoria.'` (`lib/actions/expenses.ts:452-455`) — a failure that was fully predictable from client-side state before the categorize step even opened.
**Fix:** When the selection already has a shared non-null `subCategoryId` among its categorized members, pass that as a locked/pre-selected value to the categorize step (or filter the picker to it), so the categorize step can't produce a value the final merge is guaranteed to reject.

### WR-02: New group-membership guard in `categorizeExpense` is unscoped to the caller's userId and racy against the write it guards

**File:** `lib/actions/expenses.ts:307-317`
**Issue:** The new D-03 guard queries `expenseGroupMembership` by `expenseId` alone, before opening the transaction:
```ts
const groupMembership = await db
  .select({ id: expenseGroupMembership.id })
  .from(expenseGroupMembership)
  .where(eq(expenseGroupMembership.expenseId, parsed.data.id))
  .limit(1)
```
Two problems: (1) every other write in this file follows the documented convention "SECURITY: verifySession() first, then scope update to userId (IDOR prevention)" — this check has no join/filter on `expense.userId`, so a caller can submit any UUID (including one they don't own) and learn, via the distinct error response, whether that arbitrary expense is grouped, before ownership is ever checked. (2) the check runs against `db` and returns *before* the transaction opens, so between this check and the transaction's own update, a concurrent `mergeExpenses` call could add the same expense to a group — a TOCTOU race that could still let a group member's `subCategoryId` diverge from its group's shared value, which is precisely what the guard exists to prevent.
**Fix:** Join through `expense` and scope the guard by `userId` (or fold it into the existing transaction's ownership-scoped `before` select so the check and the write are atomic).

### WR-03: `MergeExpensesSchema` doesn't enforce distinct expense ids

**File:** `lib/validations/expense.ts:63-73`
**Issue:** `MergeExpensesSchema.selectedExpenseIds` only requires `.min(2)` on the raw array, not on the distinct set. `mergeExpenses` (`lib/actions/expenses.ts:434-465`) dedupes via `[...new Set(parsed.data.selectedExpenseIds)]` *after* validation and then checks `rows.length !== dedupedIds.length`. A request with a duplicated id, e.g. `["a", "a"]`, passes the `.min(2)` schema gate but dedupes to a single real expense, and `createExpenseGroup` will create a one-member "group" — silently bypassing the "at least two distinct expenses" invariant the schema's own error message ("Seleziona almeno due spese per unire.") promises.
**Fix:** Add `.refine((ids) => new Set(ids).size === ids.length, { error: 'Spese duplicate nella selezione.' })` (or dedupe before validating length) so `.min(2)` is enforced on the distinct set.

### WR-04: `bulkCategorize`'s unguarded `JSON.parse` is now exercised by the new merge flow

**File:** `lib/actions/expenses.ts:210-217`
**Issue:** `bulkDeleteExpenses` and `mergeExpenses` (added this phase, `lib/actions/expenses.ts:419-424`) both wrap `JSON.parse(formData.get(...))` in try/catch and return a graceful `{ error: 'Selezione non valida.' }` on malformed input. `bulkCategorize` — now also invoked from the new merge dialog's categorize step (`runCategorizeStep` in `merge-expenses-dialog.tsx:59-70`) — parses `formData.get('ids')` with no try/catch:
```ts
const parsed = BulkCategorizeSchema.safeParse({
  ids: JSON.parse((formData.get('ids') as string) ?? '[]'),
  subCategoryId: Number(formData.get('subCategoryId')),
})
```
A malformed/tampered `ids` payload throws an uncaught exception out of the server action instead of returning `ActionState`, which is inconsistent with its sibling actions in the same file and the same merge flow.
**Fix:**
```ts
let ids: unknown
try {
  ids = JSON.parse((formData.get('ids') as string) ?? '[]')
} catch {
  return { error: 'Selezione non valida.' }
}
const parsed = BulkCategorizeSchema.safeParse({ ids, subCategoryId: Number(formData.get('subCategoryId')) })
```

### WR-05: Group aggregate can silently reflect only a subset of a group's members when combined with per-row filters

**File:** `lib/dal/expenses.ts:175-247, 307-418`
**Issue:** `getExpenses` applies `status`/`nature`/`direction`/`categorySlug`/`platform`/`subCategoryId` filters as SQL `WHERE` conditions on the raw per-expense rows (lines 328-368) *before* `composeExpenseRows` groups rows sharing `expenseGroupMembership.groupId` into one composed row (totals summed only over whatever raw rows survived the filter). `mergeExpenses` only requires every selected expense to share one non-null `subCategoryId` — it does not require members to share the same `status`. Since `ignoreExpense` sets `status = '4'` without clearing `subCategoryId`, and the expense table's row checkbox is only disabled for already-grouped rows (not ignored ones), a group can end up with members whose `status` differs (e.g. one member `'4'`, others `'2'`/`'3'`). Under `status=uncategorized` (`inArray(['1','4'])`), the SQL filter keeps only the `'4'` member's raw row, and `composeExpenseRows` builds the "group" composed row from that partial subset only — its `totalAmount`/`transactionCount` silently under-represents the actual group while still rendering under the group's title/badge.
**Fix:** Either (a) have `mergeExpenses` also reject members whose `status` is `'4'` (ignored), or (b) compose groups from ALL of a group's members regardless of the row-level filter and apply the filters to the composed result instead (the amount-range filter already does this correctly — status/nature/direction/platform do not).

## Info

### IN-01: Dead code left in `transaction-table.tsx` with a comment acknowledging it's unused

**File:** `components/transactions/transaction-table.tsx:68-99`
**Issue:** `amountFormatterCache` and `getAmountFormatter` are defined but never called — `formatAmount` (the only active call site, per its own doc comment) delegates directly to `formatAbsoluteAmount`. The comment even says the cache/helper are "kept to avoid breaking any possible future references," i.e. a rationale for keeping dead code rather than removing it.
**Fix:** Remove `amountFormatterCache`/`getAmountFormatter`, or actually wire `formatAmount` to use them.

### IN-02: Redundant defensive dedupe in `expense-table.tsx`

**File:** `components/expenses/expense-table.tsx:62-71, 74`
**Issue:** `dedupeExpenseRows` is applied to the initial `expenses` prop and to `loadMore` results, but `composeExpenseRows` (the DAL function producing these rows) already guarantees unique composed ids via its `Map`-keyed grouping (`group:${groupId}` / `own:${id}`). The extra client-side dedupe pass is inert under normal operation.
**Fix:** Either document why it's kept defensively (e.g. protecting against overlapping `loadMore` pages if a merge shifts the composed-row offset mid-pagination — a real but distinct concern) or drop it if unreachable.

---

_Reviewed: 2026-07-19T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
