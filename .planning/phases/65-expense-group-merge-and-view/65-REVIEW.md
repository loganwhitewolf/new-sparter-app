---
phase: 65-expense-group-merge-and-view
reviewed: 2026-07-19T00:00:00Z
depth: standard
files_reviewed: 24
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
  critical: 1
  warning: 3
  info: 0
  total: 4
status: issues_found
---

# Phase 65: Code Review Report

**Reviewed:** 2026-07-19T00:00:00Z
**Depth:** standard
**Files Reviewed:** 24 (31 listed paths; 7 are test files reviewed for coverage gaps, not separately findable)
**Status:** issues_found

## Summary

Reviewed the Expense Group merge/view feature (ADR 0017): schema + migration for `expense_group`/`expense_group_membership`, the merge/rename server actions and service layer, read-time group composition in `getExpenses`/`getExpenseForDetail`/`getExpenseGroupForDetail`, the new group detail page/client, the merge dialog, and the touched table/detail components for expenses and transactions.

The merge write path itself is solid: `createExpenseGroup` does ownership + already-grouped checks before insert, closes the check-then-act race with a `23505` translation, and `mergeExpenses` re-validates category-sameness server-side even though the client also gates it. `categorizeExpense` has an explicit, tested guard (D-03) preventing a grouped member from being recategorized directly, which correctly protects the "shared category" invariant on the categorization side.

The one BLOCKER is that the equivalent guard is missing on the **deletion** side. The project's own phase research doc (`65-RESEARCH.md`, Pitfall/race section) explicitly calls out that "`deleteExpense` must NOT cascade-delete from group," but neither `deleteExpense`, `bulkDeleteExpenses`, nor the shared `deleteExpensesWithOptions` service check group membership before deleting — and the schema's `ON DELETE CASCADE` from `expense_group_membership.expense_id → expense.id` means deleting a grouped member's expense row silently drops it out of its group (and can orphan the group entirely) with no warning to the user and no test coverage anywhere in the suite for this interaction.

Three warnings cover a merge-dialog UX gap that lets a user walk into an already-known server rejection, an inconsistent error-parsing pattern in one new action, and a smaller UX/error-surfacing nit.

## Critical Issues

### CR-01: Deleting a grouped member expense is not guarded, contradicting the phase's own documented risk

**File:** `lib/actions/expenses.ts:151-177` (`deleteExpense`), `lib/actions/expenses.ts:179-208` (`bulkDeleteExpenses`), `lib/services/expense-deletion.ts:16-70` (`deleteExpensesWithOptions`)

**Issue:** `categorizeExpense` (same file, lines 307-317) added an explicit D-03 guard this phase: before starting the transaction it queries `expenseGroupMembership` for the target expense id and rejects with `'Questa spesa fa parte di un gruppo: categorizza dal gruppo.'` if the expense is a group member — protecting the "all members share one subCategoryId" invariant.

No equivalent guard exists for deletion. `deleteExpense`, `bulkDeleteExpenses`, and the underlying `deleteExpensesWithOptions` service delete by `expense.id` scoped only to `userId`, with zero awareness of `expenseGroupMembership`. Since `expenseGroupMembership.expenseId` has `ON DELETE CASCADE` to `expense.id` (`lib/db/schema.ts:511-513`, confirmed in `drizzle/migrations/0026_nervous_thena.sql:22`), deleting a grouped member's expense row:

1. Silently removes it from its `expense_group` with no confirmation dialog copy mentioning the group (compare `ExpenseDetailClient`'s delete dialog, `components/expenses/expense-detail-client.tsx:357-401`, which never checks `expense.groupId` even though the same component already reads `expense.groupId` elsewhere to render the "Parte di" link and to hide the categorize button).
2. Is fully reachable in the UI: a grouped member's own `/expenses/[id]` page is directly linked from `GroupDetailClient`'s members list (`components/expenses/group-detail-client.tsx:112-123`, `href={expenseDetailHref(member.id)}`), and that page's "Elimina" action has no group check.
3. Is also reachable via a linked transaction: `TransactionDetailClient`/`TransactionTable`'s "Elimina" dialogs show an "elimina anche la spesa collegata" checkbox whenever `expenseTransactionCount === 1` (`isOneToOne`), which does not distinguish a grouped member with exactly one transaction from an ungrouped one — checking that checkbox deletes the grouped member's expense the same way.
4. If the deleted member is the group's last remaining member, the `expense_group` row becomes permanently orphaned (zero memberships, never surfaced or cleaned up anywhere — `getExpenses`/`getExpenseGroupForDetail` only ever reach a group through a still-existing member row).

This is exactly the race/risk the phase's own `65-RESEARCH.md` flags ("deleteExpense must NOT cascade-delete from group") and it is untested: no test in `tests/expense-actions.test.ts`, `tests/expense-detail-page.test.tsx`, `tests/transaction-detail-page.test.tsx`, or `tests/transaction-table-menu.test.tsx` exercises deleting a grouped expense.

**Fix:** Add the same D-03-style guard used in `categorizeExpense` to `deleteExpense`/`bulkDeleteExpenses` (or centrally in `deleteExpensesWithOptions`), and update both delete confirmation dialogs to warn when the target expense (or its linked expense, for the transaction-side "elimina anche" checkbox) is a group member.

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
(Or, if leaving/removing a member is intentionally deferred to a later phase, at minimum block deletion server-side rather than allowing a silent, un-warned removal.)

## Warnings

### WR-01: Merge dialog lets a mixed-category selection proceed into a foreseeable server rejection

**File:** `components/expenses/merge-expenses-dialog.tsx:49-53` (`nextStepAfterTitle`), `components/expenses/expense-table.tsx:95-101` (`mergeEligible`)

**Issue:** `mergeEligible` in `ExpenseTable` only checks that the *already-categorized* subset of the selection shares one `subCategoryId` (`categorizedSubCatIds.size <= 1`); it allows the "Unisci" bulk action to open whenever some items are still uncategorized. `nextStepAfterTitle` then routes any selection containing an uncategorized item straight to the `categorize` step, and that step's `SubcategoryPicker` lets the user pick **any** subcategory — it is never constrained or pre-filled to the subcategory already shared by the previously-categorized items in the same selection. If the user picks a different subcategory than the existing categorized items' shared one, `runCategorizeStep` categorizes the previously-uncategorized ids to the new value, and the final `handleConfirmMerge` → `mergeExpenses` call then fails server-side with `'Le spese devono avere la stessa categoria.'` (`lib/actions/expenses.ts:452-455`) — a failure that was fully predictable from client-side state before the categorize step even opened.

**Fix:** When the selection already has a shared non-null `subCategoryId` among its categorized members, pass that as a locked/pre-selected value to the categorize step (or disable other choices), so the categorize step can't produce a value that the final merge is guaranteed to reject.

### WR-02: Inconsistent JSON.parse error handling across sibling actions in the same file

**File:** `lib/actions/expenses.ts:210-217` (`bulkCategorize`)

**Issue:** `bulkDeleteExpenses` (line 184-188) and `mergeExpenses` (line 419-424, added this phase) both wrap `JSON.parse(formData.get('ids'/'selectedExpenseIds'))` in try/catch and return a graceful `{ error: 'Selezione non valida.' }` on malformed input. `bulkCategorize`, called from the same merge dialog flow (`runCategorizeStep` in `merge-expenses-dialog.tsx:59-70`), parses `formData.get('ids')` with no try/catch — a malformed or tampered `ids` payload throws an uncaught exception out of the server action instead of returning `ActionState`.

**Fix:**
```ts
export async function bulkCategorize(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let ids: unknown
  try {
    ids = JSON.parse((formData.get('ids') as string) ?? '[]')
  } catch {
    return { error: 'Selezione non valida.' }
  }
  const parsed = BulkCategorizeSchema.safeParse({ ids, subCategoryId: Number(formData.get('subCategoryId')) })
  // ...
}
```

### WR-03: Delete confirmation copy never mentions group membership even where `groupId` is already available

**File:** `components/expenses/expense-detail-client.tsx:357-386`

**Issue:** `ExpenseDetailClient` already receives `expense.groupId`/`expense.groupTitle` and uses them elsewhere in the same component (categoriaSection hides the "Cambia categoria" button when `expense.groupId !== null`; collegamentiCard renders a "Parte di" link). The delete dialog rendered a few lines later never checks `expense.groupId` at all, so a user deleting a grouped member sees the exact same generic confirmation text as for a standalone expense, with no indication the action also detaches it from its group (see CR-01 for the underlying missing guard — this is the UI-copy half of the same gap, listed separately because fixing CR-01 alone would still leave users unwarned unless the dialog copy is also updated).

**Fix:** Extend the delete dialog description to branch on `expense.groupId !== null` and state that the expense will be removed from group `expense.groupTitle`.

---

_Reviewed: 2026-07-19T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
