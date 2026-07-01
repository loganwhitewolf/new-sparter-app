---
phase: 61-standalone-expense
verified: 2026-07-01T12:10:00Z
status: passed
score: 8/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 61: standalone-expense Verification Report

**Phase Goal:** The user can peel a single ambiguous inflow (or any transaction) out of its shared-`descriptionHash` aggregate and categorize it on its own — capturing a title and a subcategory — without polluting the sender's aggregate or the Tier 2 history. This surfaces the existing `detachTransactionToDedicatedExpense` capability inline and extends it to the single-transaction case.
**Verified:** 2026-07-01T12:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | On any transaction, the user can invoke a "standalone expense / do not aggregate" action, supply a title + subcategory, and detach into a dedicated expense with synthetic `descriptionHash` [STEXP-01] | ✓ VERIFIED | `lib/services/transaction-detach.ts:31-136` accepts `subCategoryId`, computes `syntheticDescriptionHash`; `components/transactions/transaction-table.tsx:622-640` menu item gated only on `transaction.expenseId` (no counterparty scoping); `detach-expense-dialog.tsx:65-90` captures title then subcategory via reused `SubcategoryPicker`, forwards both to `detachTransaction`. Unit tests pass (`transaction-detach-service.test.ts`, `transaction-detach-action.test.ts`); Task 3 human checkpoint approved ("approvato") in 61-02-SUMMARY.md |
| 2 | The action works when the expense holds only one transaction — in-place re-hash, same id, no new expense, no orphan, `SINGLE_TRANSACTION_EXPENSE` guard lifted [STEXP-02] | ✓ VERIFIED | `transaction-detach.ts:83-101`: `expenseTransactionCount <= 1` branch does an in-place `UPDATE ... WHERE expense.id = sourceExpenseId AND expense.userId = input.userId`, returns `{ newExpenseId: sourceExpenseId }`, never calls `reconcileExpensesAfterTransactionRemoval`. `DetachTransactionErrorCode` no longer includes `SINGLE_TRANSACTION_EXPENSE` (grep confirms zero references anywhere in codebase). Test `re-hashes the source expense in place ... without inserting or reconciling` asserts no insert call and no reconcile call — PASS. UI menu gate reduced to `transaction.expenseId` only (count check removed) — human-verified single-tx case in Task 3 checkpoint, approved |
| 3 | A standalone expense is excluded from `descriptionHash` aggregation — a later transaction sharing the original description arrives fresh, not merged [STEXP-03] | ✓ VERIFIED | `syntheticDescriptionHash(txId) = sha256('detached:'+txId)` is independent of the description; unit test `differs from the original-description hash` compares against `computeDescriptionHash` (the actual import-pipeline hash) and asserts inequality — PASS. Since aggregation is keyed on `expense_userId_descriptionHash_unique`, a fresh description-based hash cannot collide with the synthetic row |
| 4 | A standalone expense does not teach Tier 2 history — isolation is per-transaction, no standing per-sender rule [STEXP-03] | ✓ VERIFIED | `applyTier2History` (unmodified, confirmed via git log — no phase-61 commits touch `lib/services/categorization.ts`) joins `expenseClassificationHistory` on `expense.descriptionHash`; a future transaction queries by the ORIGINAL hash, never the synthetic one. Test suite documents and asserts the hash-distinctness invariant this relies on; no persisted per-sender flag exists anywhere in the diff |
| 5 | The detach service/action reject transactions the session user does not own (IDOR guard preserved) | ✓ VERIFIED | Loading `SELECT` in `transaction-detach.ts:43-62` inner-joins `expense` and filters `transactionTable.userId = input.userId AND expense.userId = input.userId`; a foreign transaction never loads, falling into the `TRANSACTION_NOT_FOUND` path (tested). In-place `UPDATE` re-applies `expense.userId = input.userId` in its `WHERE`. Action calls `verifySession()` before the service (`lib/actions/transactions.ts:189-197`) |
| 6 | After a successful standalone detach, the row reflects the new expense + chosen category without a full reload | ✓ VERIFIED | `transaction-table.tsx:750-758` `onSuccess` calls `markExpenseDetached` then, when `subCategoryId` is defined, `markExpensesCategorized([newExpenseId], String(subCategoryId))` — pure client-state update, no `router.refresh()`/reload. Human-verified in Task 3 checkpoint ("row shows the chosen category… no full reload") |
| 7 | Row title displays the standalone expense's chosen title, not the raw bank description, after detach (checkpoint bug fix) | ✓ VERIFIED | `TransactionTitleEdit.fallbackTitle` prop added (`transaction-title-edit.tsx:11,19,22,46`), precedence `customTitle ?? fallbackTitle ?? description`; wired at call site `transaction-table.tsx:440` (`fallbackTitle={transaction.expenseTitle}`) and in `transactionRowLabel()` (line 110). Covered by `tests/transaction-title-edit.test.tsx` (4 tests, all passing) proving precedence and that the "Originale: {description}" caption is untouched (still shows raw description) |
| 8 | ADR 0016 scope fence held — no normalized Subscriptions view, no inflow-splitting, no counterparty category, no netting/aggregation/dashboard code touched | ✓ VERIFIED | Full commit list for this phase (175a0c9, 0e30a97, 963ce31, 2606416, 3391a1f, b2fc326, 9af9475, 899541f) touches only: `lib/services/transaction-detach.ts`, `lib/actions/transactions.ts`, `lib/validations/transactions.ts`, `components/transactions/detach-expense-dialog.tsx`, `components/transactions/transaction-table.tsx`, `components/transactions/transaction-title-edit.tsx`, 3 test files, `deferred-items.md`. No commit touches `lib/services/categorization.ts`, `lib/services/expense-reconciliation.ts`, `lib/dal/expenses.ts`, `lib/dal/transactions.ts`, or any `app/(app)/dashboard` file (confirmed via `git log` scoped to those paths — zero phase-61 commits). Action copy reads "Spesa a sé (non aggregare)" — general, not counterparty-labeled |

**Score:** 8/8 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/services/transaction-detach.ts` | subCategoryId param + single-tx in-place branch | ✓ VERIFIED | Present, substantive, matches plan spec exactly (lines 31-136) |
| `lib/actions/transactions.ts` | `detachTransaction` accepts/forwards subCategoryId | ✓ VERIFIED | Lines 175-210 — parses via schema, forwards `parsed.data.subCategoryId` |
| `lib/validations/transactions.ts` | `DetachTransactionSchema` includes subCategoryId | ✓ VERIFIED | Line 53 — optional positive integer |
| `tests/transaction-detach-service.test.ts` | subcategory persistence, in-place branch, isolation property | ✓ VERIFIED | 8 tests present, all covering the plan's acceptance criteria; all pass |
| `tests/transaction-detach-action.test.ts` | subCategoryId forwarding + validation | ✓ VERIFIED | 3 tests present, all pass |
| `components/transactions/detach-expense-dialog.tsx` | title + subcategory capture, forwards subCategoryId | ✓ VERIFIED | Reuses `SubcategoryPicker`; forwards `subCategoryId`; `onSuccess` payload includes it |
| `components/transactions/transaction-table.tsx` | standalone action on any transaction; optimistic row update | ✓ VERIFIED | Gate reduced to `transaction.expenseId`; `categories`/`mostUsed` passed to dialog; optimistic update wired |
| `components/transactions/transaction-title-edit.tsx` (checkpoint fix) | fallbackTitle precedence | ✓ VERIFIED | New prop, correct precedence, tested |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `expense_userId_descriptionHash_unique` | in-place UPDATE | descriptionHash collision avoidance | ✓ WIRED | Synthetic hash `sha256('detached:'+txId)` is unique per transaction id; no collision risk with existing rows |
| `applyTier2History` (categorization.ts) | `expenseClassificationHistory.descriptionHash` | isolation from Tier 2 | ✓ WIRED (untouched, confirmed unmodified) | Query still keys on original description hash; standalone's synthetic hash never matches |
| `reconcileExpensesAfterTransactionRemoval` | multi-tx path only | must NOT be called on in-place branch | ✓ WIRED | Test explicitly asserts `.not.toHaveBeenCalled()` on the in-place branch |
| `detach-expense-dialog.tsx` → `detachTransaction` action → `detachTransactionToDedicatedExpense` | subCategoryId flow | ✓ WIRED | Traced end-to-end: `Number(subCategoryIdRaw)` at dialog → schema-validated positive int → service param |
| `SubcategoryPicker` reuse | dialog subcategory capture | no new picker built | ✓ WIRED | `detach-expense-dialog.tsx` imports and renders `@/components/categorization/subcategory-picker` |
| `transaction-table.tsx` `markExpenseDetached`/`markExpensesCategorized` | optimistic row update | ✓ WIRED | `onSuccess` handler calls both helpers with correct `String()` coercion for `subCategoryId` |
| `TransactionTitleEdit.fallbackTitle` | `transaction.expenseTitle` | row-title checkpoint fix | ✓ WIRED | Prop passed at table call site; precedence tested |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Service + action + title-edit test suites pass | `yarn vitest run tests/transaction-detach-service.test.ts tests/transaction-detach-action.test.ts tests/transaction-title-edit.test.tsx` | 3 files, 18/18 tests passed | ✓ PASS |
| `SINGLE_TRANSACTION_EXPENSE` fully removed | `grep -r SINGLE_TRANSACTION_EXPENSE` | zero matches anywhere in codebase | ✓ PASS |
| `tsc --noEmit` clean for phase-modified files | `yarn tsc --noEmit \| grep -E "transaction-detach\|detach-expense-dialog\|transaction-table.tsx\|transaction-title-edit\|actions/transactions.ts\|validations/transactions.ts"` | no output (clean) | ✓ PASS |
| Pre-existing unrelated tsc/vitest/check:language failures do not touch phase-61 files | manual grep of full `tsc`/`check:language` output against phase-61 file list | confirmed disjoint; matches `deferred-items.md` claims | ✓ PASS |
| Scope fence — no commits touch aggregation/netting/dashboard/DAL files | `git log --oneline -- lib/services/expense-reconciliation.ts lib/services/categorization.ts lib/dal/expenses.ts lib/dal/transactions.ts app/(app)/dashboard` filtered for phase-61 commit hashes | zero matches | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| STEXP-01 | 61-01, 61-02 | Standalone action, general, title+subcategory capture, synthetic hash | ✓ SATISFIED | Backend (transaction-detach.ts) + UI (detach-expense-dialog.tsx, transaction-table.tsx) both wired; tests pass; human checkpoint approved |
| STEXP-02 | 61-01, 61-02 | Single-transaction in-place re-hash, guard lifted, no orphan | ✓ SATISFIED | In-place UPDATE branch present and tested; UI count-gate removed; human-verified |
| STEXP-03 | 61-01 | Isolation from descriptionHash aggregation and Tier 2 history | ✓ SATISFIED | Hash-level property test proves the invariant; `applyTier2History` confirmed unmodified |

No orphaned requirements — REQUIREMENTS.md maps exactly STEXP-01/02/03 to Phase 61, and both plans' frontmatter `requirements` fields cover all three IDs collectively (61-01: all three; 61-02: STEXP-01, STEXP-02).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TODO/FIXME/XXX/HACK/PLACEHOLDER markers found in any phase-61-modified file | — | none |
| `.planning/ROADMAP.md` | 27 | Top-level Phase 61 checkbox still shows `- [ ]` while the Progress table (line 314) and both plan checkboxes (lines 34, 38) show complete | ℹ️ Info | Documentation-only inconsistency; does not affect code behavior or goal achievement. Recommend fixing the checkbox on next roadmap touch |
| `.planning/ROADMAP.md` | 254-271 (Phase 59 section) | Stray duplicated plan list (`61-01-PLAN.md`/`61-02-PLAN.md` lines appear inside the archived Phase 59 "Plans:" block, before the real 59-01..59-04 wave listing) | ℹ️ Info | Pre-existing documentation artifact in an archived/completed phase section, unrelated to Phase 61's code; not introduced by this phase's commits |

No blockers. No debt markers requiring `#issue` references.

### Human Verification Required

None outstanding. The single `checkpoint:human-verify` task (61-02 Task 3) was executed during the phase and resolved: human tested both the multi-transaction and single-transaction cases in-browser, found and had fixed the row-title regression (commit `899541f`), re-tested, and responded "approvato" (61-02-SUMMARY.md, "Human Verification (Task 3)" section). No new human-verification needs were identified during this verification pass.

### Gaps Summary

None. All observable truths from ROADMAP.md Success Criteria (STEXP-01 through STEXP-03, 4 numbered criteria) and all PLAN frontmatter must-haves are verified against actual code — not just SUMMARY.md claims. Backend service, validation schema, server action, and UI components were read directly and cross-checked against test assertions, which were re-run and confirmed passing (18/18). The ADR 0016 scope fence (no Subscriptions view, no inflow-splitting, no counterparty category, no aggregation/netting/dashboard changes) was verified by enumerating every commit's file list for this phase and confirming disjointness from the fenced files. The mid-phase bug fix (row title fallback, commit `899541f`) is real, correctly scoped to `TransactionTitleEdit`/`transactionRowLabel` display logic only (no touch to `transaction.description`, `descriptionHash`, aggregation, or Tier 2 code), and is covered by a new dedicated test file (`tests/transaction-title-edit.test.tsx`, 4/4 passing).

---

_Verified: 2026-07-01T12:10:00Z_
_Verifier: Claude (gsd-verifier)_
