---
quick_id: 260703-gwa
slug: pairing-a-refund-cleans-up-its-expense-i
branch: gsd/quick-refund-pair-cleanup
type: quick
autonomous: false
files_modified:
  - lib/services/transaction-detach.ts
  - lib/services/transaction-pairs.ts
  - components/transactions/transaction-table.tsx
  - components/transactions/counterpart-picker-dialog.tsx
  - lib/actions/transaction-pairs.ts
  - tests/transaction-pairs-service.test.ts
  - tests/transaction-detach-service.test.ts
must_haves:
  truths:
    - "Pairing a refund whose refunded spend is categorized leaves the refund expense categorized (status '3') under the spend's subcategory, isolated with a synthetic descriptionHash."
    - "Pairing when the refunded spend is uncategorized leaves the refund expense untouched (no isolation, no status change)."
    - "Unpairing never reverts the inherited subcategory or synthetic hash."
    - "primary/secondary resolution, opposite-sign, and ownership guards in createPair are unchanged."
  artifacts:
    - "lib/services/transaction-detach.ts exports a tx-accepting core (applyDetachCleanupTx)."
    - "lib/services/transaction-pairs.ts createPair calls the cleanup core inside its transaction, gated on decision 2."
  key_links:
    - "createPair -> applyDetachCleanupTx(tx, ...) executes inside the same db.transaction as the pair insert."
    - "Refund row in the transactions table repaints as categorized after a successful pairing."
---

<objective>
Fix the bug where linking a transaction as a refund (`transaction_pair`, Phase 50) leaves
the refund's Expense at `status '1'` ("da categorizzare"). On pairing, the refund's expense
must inherit the refunded spend's subcategory and undergo the "spesa a sé" cleanup (synthetic
`descriptionHash` isolation, `status '3'`), reusing the v2.4 detach logic.

Purpose: refunds are categorized under the same subcategory as the spend they offset
(CONTEXT.md:113, ADR 0004 netting-by-subcategory); the 1:1 pairing must drive that
categorization instead of leaving the refund uncategorized.
Output: a refactored detach service with a tx-accepting core, a wired `createPair`, a
repainting UI, and service tests. Future pairings only — no backfill of existing pairs.

All approach decisions are LOCKED in CONTEXT.md. Do NOT re-open them. In particular:
donor-uncategorized skips (decision 2), title inherits from the spend's expense (decision 3),
unpair does not revert (decision 4).
</objective>

<context>
@.planning/quick/260703-gwa-pairing-a-refund-cleans-up-its-expense-i/CONTEXT.md
@CLAUDE.md
@CONTEXT.md
@lib/services/transaction-detach.ts
@lib/services/transaction-pairs.ts
@lib/services/expense-reconciliation.ts
@lib/actions/transaction-pairs.ts
@components/transactions/transaction-table.tsx
@components/transactions/counterpart-picker-dialog.tsx
@tests/transaction-detach-service.test.ts
@tests/transaction-pairs-service.test.ts

Hard rules (CLAUDE.md): monetary math via `Decimal.js` (`@/lib/utils/decimal`); Drizzle
DECIMAL columns are strings; ownership-validating writes run inside `db.transaction` and
helpers accept a tx; layers DAL / services / actions; developer strings English, Italian only
for product/UI copy. Run `yarn check:language` after touching services/components/tests.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extract a tx-accepting cleanup core from transaction-detach</name>
  <files>lib/services/transaction-detach.ts, tests/transaction-detach-service.test.ts</files>
  <behavior>
    - Existing behavior of detachTransactionToDedicatedExpense is unchanged: 1:1 source
      expense (transactionCount ≤ 1) re-hashes in place (synthetic descriptionHash, title,
      and when subCategoryId is provided sets subCategoryId + status '3'); multi-transaction
      source inserts a new dedicated expense, repoints the transaction, and calls
      reconcileExpensesAfterTransactionRemoval.
    - Empty/whitespace title still throws before any write (existing test "rejects empty
      title after trim" stays green).
    - The extracted core runs against a passed-in tx handle, not its own transaction.
  </behavior>
  <action>
    Extract a new exported async function applyDetachCleanupTx(tx, input) holding the current
    body of the db.transaction callback in detachTransactionToDedicatedExpense — the ownership
    join select (transaction innerJoin expense), the transactionCount ≤ 1 re-hash-in-place
    branch, and the multi-transaction new-expense + reconcile branch. Move the title trim and
    empty-title guard into the core so both callers get it. Type the tx parameter with the
    project DbOrTx pattern (a handle accepting select/insert/update); reuse the existing
    DetachTransactionError codes and syntheticDescriptionHash helper. Rewrite the public
    detachTransactionToDedicatedExpense to a thin wrapper: db.transaction(async (tx) =>
    applyDetachCleanupTx(tx, input)). Keep the exported result shape (newExpenseId,
    newExpenseTitle) and all thrown error messages identical. Do not change the reconcile
    call, the Decimal usage, or any status/hash logic — this is a pure extraction. The
    existing detach-service tests exercise the wrapper and must pass without edits; only add
    a mock/import adjustment if the extraction changes an import path.
  </action>
  <verify>
    <automated>yarn test tests/transaction-detach-service.test.ts tests/transaction-detach-action.test.ts</automated>
  </verify>
  <done>applyDetachCleanupTx is exported and tx-accepting; detachTransactionToDedicatedExpense delegates to it; all existing detach tests pass; `npx tsc --noEmit` clean for the touched file.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire refund cleanup into createPair (gated on decision 2)</name>
  <files>lib/services/transaction-pairs.ts, tests/transaction-pairs-service.test.ts</files>
  <behavior>
    - After the pair insert, inside the SAME db.transaction, when the primary (refunded spend)
      has a non-null subCategoryId AND the secondary's expense differs from the primary's
      expense AND the secondary has a linked expense, createPair calls applyDetachCleanupTx
      with { userId, transactionId: secondaryId, title: <primary expense title>,
      subCategoryId: <primary expense subCategoryId> }.
    - When the primary's subCategoryId is null → cleanup is NOT called (refund untouched).
    - When primary and secondary share the same expense, or the secondary has no expense →
      cleanup is NOT called (defensive).
    - primary/secondary resolution (larger |amount|, tie-break earlier occurredAt),
      opposite-sign enforcement, self-pair guard, ownership check, and the 23505 unique-
      violation message are all unchanged.
  </behavior>
  <action>
    In createPair, add `expenseId: transaction.expenseId` to both per-leg select projections
    (rowsA/rowsB) so both legs' expense ids are known. Keep the existing primary/secondary
    resolution untouched. After the pair insert succeeds, within the same tx: load the
    primary's expense via `tx.select({ expenseId: expense.id, subCategoryId:
    expense.subCategoryId, title: expense.title }).from(transaction).innerJoin(expense,
    eq(transaction.expenseId, expense.id)).where(and(eq(transaction.id, primaryId),
    eq(transaction.userId, userId), eq(expense.userId, userId))).limit(1)`. Derive
    secondaryExpenseId from the already-loaded legs (secondaryId === t1.id ? t1.expenseId :
    t2.expenseId). Gate (decision 2): only when primaryExpense exists, primaryExpense
    subCategoryId is not null, secondaryExpenseId is present, and secondaryExpenseId is not
    equal to primaryExpense expenseId, call applyDetachCleanupTx(tx, { userId, transactionId:
    secondaryId, title: primaryExpense.title, subCategoryId: primaryExpense.subCategoryId }).
    Otherwise skip. Import applyDetachCleanupTx from '@/lib/services/transaction-detach'. Add
    `expense` to the imports from '@/lib/db/schema'. Use no native monetary arithmetic
    (unchanged — resolution already uses Decimal). Do NOT touch deletePairByTransactionId
    (decision 4). Then update the existing tests/transaction-pairs-service.test.ts harness so
    it stays green: add `expense` (with id, userId, subCategoryId, title) to the mocked
    '@/lib/db/schema'; add `innerJoin: vi.fn(() => chain)` to makeSelectChain; and mock
    '@/lib/services/transaction-detach' exposing applyDetachCleanupTx as a vi.fn plus a
    passthrough for any other symbol createPair imports. Adjust the existing pair tests'
    select-chain expectations only as needed to accommodate the extra primary-expense select
    — do NOT weaken existing assertions on resolution/ownership/opposite-sign.
  </action>
  <verify>
    <automated>yarn test tests/transaction-pairs-service.test.ts tests/transaction-pairs-dal.test.ts</automated>
  </verify>
  <done>createPair calls applyDetachCleanupTx with the primary's title+subCategoryId only when the gate holds; all pre-existing pairs-service assertions pass; `npx tsc --noEmit` clean.</done>
</task>

<task type="auto">
  <name>Task 3: Verify (and only if needed, fix) the refund row status repaint after pairing</name>
  <files>components/transactions/transaction-table.tsx, components/transactions/counterpart-picker-dialog.tsx, lib/actions/transaction-pairs.ts</files>
  <action>
    Determine empirically whether the refund row in the transactions table shows its new
    categorized status/subcategory chip immediately after a successful pairing. Facts already
    established: TransactionTable holds `loadedTransactions` via `useState(transactions)` with
    NO prop-sync effect (the only useEffect is the infinite-scroll observer), and pair-creation
    has NO optimistic update path (unlike unpair/detach/categorize which call
    setLoadedTransactions). createTransactionPairAction calls revalidatePath('/transactions').
    So the refund row will very likely NOT repaint until a manual reload. Confirm this by
    tracing the render path (run `yarn dev` is out of scope — reason from the code and, if
    ambiguous, add a focused component/render assertion).

    If it already repaints: add no UI code; record the trace in the SUMMARY.
    If it does NOT repaint (expected): implement the minimal optimistic update mirroring the
    detach flow's markExpensesCategorized. Recommended shape: (a) have createPair return, and
    createTransactionPairAction surface, the resolved secondary transactionId plus the inherited
    subCategoryId (undefined when the gate skipped) — extend createPair's return type and the
    action's ActionState-compatible result without breaking existing callers; (b) expose an
    onPaired callback prop on CounterpartPickerDialog fired after a successful submit with that
    payload; (c) in TransactionTable, wire onPaired to markExpensesCategorized([secondary
    expenseId], subCategoryId) and set the pair badge fields on the affected legs, matching how
    markExpensesCategorized already maps subCategoryId → category/subcategory names. Keep all
    UI copy Italian; keep identifiers/comments English. Do not change netting/effectiveAmount
    display or the unpair path.
  </action>
  <verify>
    <human-check>
      After pairing a refund of a categorized spend in the transactions list, the refund row
      shows a categorized status and the inherited subcategory chip without a manual page
      reload; pairing a refund of an uncategorized spend leaves the refund row unchanged.
    </human-check>
  </verify>
  <done>Either a documented trace proving the row already repaints, or a minimal optimistic update that repaints the refund row's categorized status + subcategory on successful pairing; `npx tsc --noEmit`, `yarn lint`, and `yarn check:language` clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Service tests for refund pairing cleanup + regression guards</name>
  <files>tests/transaction-pairs-service.test.ts, tests/transaction-detach-service.test.ts</files>
  <behavior>
    In transaction-pairs-service.test.ts (applyDetachCleanupTx mocked as a spy):
    - 1:1 inherit path: primary expense has a subCategoryId; secondary expense differs →
      applyDetachCleanupTx called once with { userId, transactionId: secondaryId, title:
      primary expense title, subCategoryId: primary expense subCategoryId }.
    - Donor uncategorized: primary expense subCategoryId is null → applyDetachCleanupTx NOT
      called; the pair is still inserted.
    - Same-expense / missing-secondary-expense defensive skip: applyDetachCleanupTx NOT called.
    - Resolution intact: when the initiating transaction is the smaller-|amount| leg, the
      larger leg is primary and cleanup targets the smaller (secondary); tie on |amount| uses
      earlier occurredAt as primary. Opposite-sign and ownership guards still throw as before.
    In transaction-detach-service.test.ts (real core, db mocked):
    - Confirm applyDetachCleanupTx directly: 1:1 source re-hashes in place with synthetic
      descriptionHash + subCategoryId + status '3'; multi-transaction source inserts a new
      dedicated expense (status '3', synthetic hash, transactionCount 1) and calls
      reconcileExpensesAfterTransactionRemoval — asserting the core, not only the wrapper.
    Unpair regression (either file, using existing deletePair coverage): deletePairByTransactionId
    still only removes the pair and never touches expense subCategoryId/descriptionHash.
  </behavior>
  <action>
    Add the test cases above. Reuse the existing hoisted-mock harness in each file (vi.hoisted
    db chains, schema mock, drizzle-orm mock, db.transaction(cb) => cb(db)). For the pairs
    file, assert against the applyDetachCleanupTx spy from Task 2's transaction-detach mock —
    verify call count and exact argument object for each scenario, and assert it is NOT called
    for the donor-uncategorized and defensive-skip cases. For the detach file, add a describe
    block that imports and calls applyDetachCleanupTx with a mock tx handle to cover the core
    directly (the wrapper tests remain). Keep monetary fixture amounts as DECIMAL strings.
    Developer test names and comments in English.
  </action>
  <verify>
    <automated>yarn test tests/transaction-pairs-service.test.ts tests/transaction-detach-service.test.ts</automated>
  </verify>
  <done>All listed scenarios pass; full `yarn test` green.</done>
</task>

</tasks>

<verification>
Run the full gate before finalizing:
- `yarn test tests/transaction-detach-service.test.ts tests/transaction-pairs-service.test.ts tests/transaction-pairs-dal.test.ts tests/transaction-detach-action.test.ts`
- `yarn test` (full suite green)
- `npx tsc --noEmit` (no `typecheck` script exists)
- `yarn lint`
- `yarn check:language`
</verification>

<success_criteria>
- Pairing a refund of a categorized spend: refund expense gets the spend's subcategory,
  synthetic descriptionHash, and status '3' — via applyDetachCleanupTx inside createPair's
  transaction (1:1 re-hash in place; multi-transaction → new dedicated expense + reconcile).
- Pairing a refund of an uncategorized spend leaves the refund expense untouched.
- primary/secondary resolution, opposite-sign, self-pair, ownership, and 23505 handling
  unchanged; deletePairByTransactionId unchanged (no revert).
- Refund row repaints as categorized after pairing (verified, fixed only if needed).
- No native monetary arithmetic; all writes inside db.transaction; DAL/services/actions
  layering preserved; language check clean.
- No backfill of existing pairs — future pairings only.
</success_criteria>

<output>
Create `.planning/quick/260703-gwa-pairing-a-refund-cleans-up-its-expense-i/SUMMARY.md` when done.
</output>
