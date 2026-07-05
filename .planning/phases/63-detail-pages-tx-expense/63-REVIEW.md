---
phase: 63-detail-pages-tx-expense
reviewed: 2026-07-05T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - app/(app)/expenses/[id]/page.tsx
  - app/(app)/transactions/[id]/page.tsx
  - components/detail-pages/detail-page-shell.tsx
  - components/expenses/expense-detail-client.tsx
  - components/expenses/expense-notes-edit.tsx
  - components/expenses/expense-table.tsx
  - components/transactions/transaction-amount-edit.tsx
  - components/transactions/transaction-date-edit.tsx
  - components/transactions/transaction-detail-client.tsx
  - components/transactions/transaction-table.tsx
  - lib/dal/expenses.ts
  - lib/dal/transactions.ts
  - lib/routes.ts
  - tests/detail-page-shell.test.tsx
  - tests/expense-detail-dal.test.ts
  - tests/expense-detail-page.test.tsx
  - tests/expense-table-menu.test.tsx
  - tests/transaction-detail-dal.test.ts
  - tests/transaction-detail-page.test.tsx
  - tests/transaction-table-menu.test.tsx
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 63: Code Review Report

**Reviewed:** 2026-07-05T00:00:00Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Reviewed the new transaction/expense detail pages, their inline edit components,
the two new ownership-scoped DAL queries (`getExpenseForDetail`,
`getTransactionForDetail`), and their accompanying tests. The DAL layer is solid:
both detail queries are correctly scoped to `userId` in the WHERE clause, return
`undefined` instead of throwing for missing/non-owned rows, and the RSC pages
correctly call `notFound()` on that `undefined` (verified by both direct reading
and the existing test suite, which exercises the ownership-scoping guard
explicitly).

The one blocking issue is in `TransactionAmountEdit`: the value used to seed the
editable `<input>` is a fully localized currency string produced by
`Intl.NumberFormat` (e.g. `"-45,30 €"`), which is then submitted verbatim as
`amount` on save. The Zod validation for amount only strips a comma-for-dot, so
any string containing the currency symbol and space fails validation — meaning
a user who opens the amount editor and clicks "Salva" without retyping the
entire number from scratch will always get "Importo non valido." This defeats
the edit-in-place UX the feature exists to deliver and was not caught by the
existing unit tests because they mock `useActionState`/`useState` and never
exercise the real submit → Zod-parse path end-to-end.

Several smaller issues degrade robustness/maintainability: an unguarded,
non-debounced "Scollega rimborso" action on the transaction detail page (no
pending-state protection, unlike every other destructive/mutating action in
the same file and its table counterpart), a hardcoded route string bypassing
the `expenseDetailHref()` helper, and a duplicated, EUR-hardcoded amount
formatter that diverges from the shared `formatAbsoluteAmount` utility.

## Critical Issues

### CR-01: TransactionAmountEdit submits a currency-formatted string that fails validation on unmodified re-save

**File:** `components/transactions/transaction-amount-edit.tsx:18-32,74-79`
**Issue:**
`formatSignedAmount` renders the amount through `Intl.NumberFormat('it-IT', { style: 'currency', currency })`, producing a string like `"-45,30 €"`. This formatted string is used to seed `useState(displayAmount)`, and the same state (`value`) is bound to the `<input name="amount">` used for editing:

```tsx
const displayAmount = formatSignedAmount(amount, currency)   // "-45,30 €"
const [value, setValue] = useState(displayAmount)
...
<input name="amount" value={value} onChange={(e) => setValue(e.target.value)} ... />
```

If the user opens the editor (click → `setValue(displayAmount)`) and submits
without editing the text — or edits it but leaves the currency symbol/space in
place — the raw string `"-45,30 €"` is submitted as `amount`. Server-side,
`UpdateTransactionSchema` (`lib/validations/transaction-edit.ts:6-16`) only does
`v.replace(',', '.')` before `Number(normalized)`, so `"-45.30 €".replace(',', '.')`
stays `"-45.30 €"`, and `Number("-45.30 €")` is `NaN`. The refine fails and the
user sees "Importo non valido." on a completely valid, unmodified amount — the
inline editor is unusable for a no-op save and confusing for any edit that
doesn't fully retype the number cleanly.

Verified reproduction of the formatted string:
```
$ node -e "console.log(new Intl.NumberFormat('it-IT', {style:'currency', currency:'EUR'}).format(-45.30))"
-45,30 €
```

None of the existing tests catch this because `tests/transaction-table-menu.test.tsx`
mocks `useActionState`/`useState` and never drives a real form submission through
`UpdateTransactionSchema`.

**Fix:** Seed the editable input with a plain numeric string (not the
currency-formatted display string), e.g.:

```tsx
function toEditableAmount(amount: string): string {
  // Plain decimal string, comma as separator, no currency symbol/spacing.
  return toDecimal(amount).toFixed(2).replace('.', ',')
}

const displayAmount = formatSignedAmount(amount, currency) // for read-only view only
const [value, setValue] = useState(() => toEditableAmount(amount))
...
onClick={() => {
  setValue(toEditableAmount(amount))
  setIsEditing(true)
}}
```

This keeps `displayAmount` for the read-only view, while the input always
starts from (and can be safely resubmitted as) a value the Zod refine accepts.

## Warnings

### WR-01: "Scollega rimborso" on the transaction detail page has no pending/disabled guard

**File:** `components/transactions/transaction-detail-client.tsx:93-102,306-316`
**Issue:** `handleUnpair` is invoked directly from the dropdown item's `onSelect`
with no `isPending`/`useTransition` guard:

```tsx
async function handleUnpair() {
  const fd = new FormData()
  fd.set('transactionId', transaction.id)
  const result = await deleteTransactionPairAction({ error: null }, fd)
  if (result.error) { toast.error(result.error) } else { router.refresh() }
}
...
onSelect={(e) => { e.preventDefault(); void handleUnpair() }}
```

Every other mutating action in this same component (`handleDelete`, the delete
dialog) tracks a `pending` boolean and disables its trigger button while the
request is in flight. `handleUnpair` has none, so a user can reopen the
dropdown and click "Scollega rimborso" again before the first request resolves,
firing a second `deleteTransactionPairAction` call against a pair that may
already be unlinked. Also note it never shows a success toast (see WR-02),
so nothing visually indicates the action even started, increasing the chance
of a repeat click.

**Fix:** Track pending state and disable/hide the menu item while in flight, mirroring `transaction-table.tsx`'s pattern:
```tsx
const [unpairPending, setUnpairPending] = useState(false)

async function handleUnpair() {
  setUnpairPending(true)
  try {
    const fd = new FormData()
    fd.set('transactionId', transaction.id)
    const result = await deleteTransactionPairAction({ error: null }, fd)
    if (result.error) toast.error(result.error)
    else { toast.success('Collegamento rimosso.'); router.refresh() }
  } finally {
    setUnpairPending(false)
  }
}
...
<DropdownMenuItem disabled={unpairPending} onSelect={(e) => { e.preventDefault(); void handleUnpair() }}>
```

### WR-02: Unpairing from the detail page gives no success feedback, inconsistent with the table's unpair flow

**File:** `components/transactions/transaction-detail-client.tsx:93-102`
**Issue:** `transaction-table.tsx`'s `handleUnpair` (line 232-254) shows
`toast.success('Collegamento rimosso.')` on success. The detail page's
`handleUnpair` only calls `router.refresh()` on success with no toast — a
silent success is inconsistent UX and, combined with WR-01, makes it easy to
believe the click "didn't register" and retry.
**Fix:** Add `toast.success('Collegamento rimosso.')` before/alongside `router.refresh()`, matching the table's copy.

### WR-03: Hardcoded route string bypasses the `expenseDetailHref()` helper

**File:** `components/transactions/transaction-detail-client.tsx:222`
**Issue:** The "Spesa collegata" link builds its `href` manually:
```tsx
<Link href={`/expenses/${encodeURIComponent(transaction.expenseId)}`} ...>
```
while `lib/routes.ts` already exports `expenseDetailHref(id)` for exactly this
purpose, and is used correctly elsewhere in the same file/codebase (e.g.
`transactionDetailHref` a few lines below at line 274). If `APP_ROUTES.expenses`
ever changes, this literal silently drifts out of sync with the rest of the app.
**Fix:**
```tsx
import { expenseDetailHref } from '@/lib/routes'
...
<Link href={expenseDetailHref(transaction.expenseId)} ...>
```

### WR-04: Duplicated, EUR-hardcoded amount formatter diverges from the shared utility

**File:** `components/transactions/transaction-detail-client.tsx:65-73`
**Issue:** `formatAbsoluteSigned` hand-builds the currency string instead of
using `Intl.NumberFormat` (as every other formatter in this same file does) or
the shared `formatAbsoluteAmount` from `lib/utils/format-amount.ts`:
```tsx
function formatAbsoluteSigned(amount: string): string {
  try {
    const d = toDecimal(amount)
    const sign = d.isNegative() ? '-' : '+'
    return `${sign}€${d.abs().toFixed(2).replace('.', ',')}`
  } catch {
    return amount
  }
}
```
This hardcodes the `€` symbol and Italian decimal-comma formatting manually,
ignoring the paired transaction's actual `currency` field entirely (the
counterpart transaction is not guaranteed to be EUR). It also duplicates logic
that already exists, correctly internationalized, in `formatSignedAmount` a few
lines above and in `lib/utils/format-amount.ts`.
**Fix:** Reuse the existing signed formatter with the counterpart's currency, or extend `formatAbsoluteAmount` with a signed variant:
```tsx
function formatAbsoluteSigned(amount: string, currency: string): string {
  const d = toDecimal(amount)
  const sign = d.isNegative() ? '+' : '-' // adjust per net-amount convention
  return formatSignedAmount(d.abs().toString(), currency)
}
```
(Note: the pairing sub-query in `lib/dal/transactions.ts` does not currently
expose the counterpart's currency to the client — if pairs are only ever
same-currency by construction, document that invariant at the call site;
otherwise thread `currency` through `TransactionDetailRow.pairedCurrency`.)

## Info

### IN-01: Escape key does not restore the original value before closing the inline editors

**File:** `components/expenses/expense-notes-edit.tsx:76-78`, `components/transactions/transaction-amount-edit.tsx:81-83`, `components/transactions/transaction-date-edit.tsx:78-80`
**Issue:** All three inline editors reset `isEditing` to `false` on `Escape`
but — unlike their "Annulla" button handlers — do not also reset `value` back
to the original prop-derived value:
```tsx
onKeyDown={(e) => {
  if (e.key === 'Escape') setIsEditing(false)
}}
```
This self-heals the next time the field is opened (the `onClick` handler
re-seeds `value` before entering edit mode), so there's no persistent bug, but
it's an inconsistency with the "Annulla" button in the same component and could
show a stale edited value for a frame if re-entered via a path that skips the
seeding `onClick` (e.g. a future keyboard shortcut).
**Fix:** Mirror the Annulla handler in the Escape handler for consistency, e.g. in `expense-notes-edit.tsx`:
```tsx
onKeyDown={(e) => {
  if (e.key === 'Escape') {
    setValue(notes ?? '')
    setIsEditing(false)
  }
}}
```

### IN-02: `getUncategorizedExpenseCount`/`getExpenseForDetail` etc. rely on `expense.transactionCount` as a source of truth that can drift from the live join

**File:** `lib/dal/expenses.ts:330-424`
**Issue:** `ExpenseDetailRow.transactionCount` comes from the denormalized
`expense.transactionCount` counter column, while `ExpenseDetailRow.transactions`
is populated from a live `SELECT ... FROM transaction WHERE expenseId = ...`
query in the same function. These two are not queried atomically and have no
reconciliation — if the counter column is ever out of sync with the actual
linked-transaction rows (e.g. due to a partial failure in a write path not
covered by this phase), the detail page's "Transazioni: N" summary
(`expense-detail-client.tsx:222-224`) and delete-dialog copy ("Elimina anche N
transazioni collegate") would show a different count than the transactions
table actually rendered below it, which is user-visible and could mislead the
delete confirmation.
**Fix:** Not a regression introduced by this phase (the counter column
predates it), but since this phase is the first to render both values
side-by-side on one screen, consider deriving the displayed count from
`expense.transactions.length` instead of the separate counter field for
`ExpenseDetailRow` specifically, to guarantee the two numbers can never disagree.

---

_Reviewed: 2026-07-05T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
