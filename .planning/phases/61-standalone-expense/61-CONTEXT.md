# Phase 61: standalone-expense - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning
**Source:** ADR Ingest Express Path (`docs/adr/0016-shared-costs-net-by-subcategory-inflows-isolated-per-transaction.md`)

<domain>
## Phase Boundary

Give the user a general **"treat as a standalone expense / do not aggregate"** action in the categorization flow that peels a single transaction out of its `descriptionHash`-keyed expense, capturing a **title + subcategory**, so shared-subscription reimbursements and other ambiguous person-to-person inflows can be categorized correctly without polluting the sender's aggregate or the Tier 2 history.

**What this phase delivers (STEXP-01/02/03):**
1. An inline "standalone expense" affordance in the categorization flow, on **any** transaction — captures title + subcategory and detaches the transaction into a dedicated expense with a synthetic `descriptionHash`.
2. A **single-transaction in-place path** that lifts the `SINGLE_TRANSACTION_EXPENSE` guard by re-hashing the existing expense row (same id) — no new expense, no orphan.
3. Isolation semantics: the standalone expense is excluded from `descriptionHash` aggregation and Tier 2 history; a future same-description transaction arrives fresh. Per-transaction, not a standing per-sender rule.

**Not from zero:** the `detachTransactionToDedicatedExpense` service + synthetic-hash mechanism (`sha256("detached:{id}")`) already exist (quick task `260629-m9i`, commit `90bfa69`). This phase (a) surfaces it inline in categorization, (b) adds subcategory capture (the service currently writes `subCategoryId: null`), (c) adds the single-transaction in-place branch + lifts the guard.
</domain>

<decisions>
## Implementation Decisions (LOCKED — ADR 0016)

- **Netting is option A (already usable, no code here):** a reimbursement for a shared expense is categorized under the *same* subcategory as the spend and nets by algebraic sum (ADR 0004). No new income classification, no transaction linking. Rejected: (B) classify inflow as `income_extraordinary` (doctrinally false, mixes IN/OUT directions); (C) exclude like a `transfer` (loses the liquidity signal). *This phase does not implement netting — it is doctrine already in effect. It builds only the isolation capability that makes option A usable with person-senders.*
- **Isolation is a general action, NOT a counterparty category.** Rejected: a "money received from a person" category — classifies by counterparty (violates CONTEXT.md categorization rule #1: by purpose, not by who) and is not reliably auto-detectable. The action is available on any transaction in the categorization flow.
- **Isolation is per-transaction, not a standing rule.** Detaching frees the original `description_hash`; the next same-description transaction arrives fresh and uncategorized. No persisted "never aggregate this sender" flag — the same description legitimately means different things, so no single rule is correct.
- **Single-transaction case re-hashes the expense in place; the guard is lifted, not patched.** The `SINGLE_TRANSACTION_EXPENSE` guard in `lib/services/transaction-detach.ts` exists because the multi-transaction detach path (create new expense + move + surviving source) leaves an empty orphan when the source held only the moved transaction *and* already carried classification history. Instead of removing the guard and reconciling the orphan downstream, the single-transaction case gets a dedicated path: rewrite the existing expense's `description_hash` to the synthetic value in place (same row, same id). No new expense, no orphan, classification history preserved. Observable outcome identical to a normal detach.

### Claude's Discretion (resolve during planning)
- Exact placement of the affordance in the categorization flow / `SubcategoryPicker` bottom sheet (entry point, copy, whether it's a toggle inside the picker or a separate action).
- How to handle the edge case "expense already categorized → then made standalone" (the multi-tx path's orphan-with-history scenario; the in-place branch should sidestep it, but confirm the code path).
- Whether the inline action reuses `detachTransactionToDedicatedExpense` with a new subcategory parameter, or a thin new service entry point.
- Test strategy (the detach service already has coverage; extend for the subcategory-capture + single-transaction in-place branch).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Decision contract
- `docs/adr/0016-shared-costs-net-by-subcategory-inflows-isolated-per-transaction.md` — the full locked design (this phase's source).
- `docs/adr/0004-nature-segments-algebraic-sum.md` — the netting-by-subcategory model (option A rests on it).
- `CONTEXT.md` — glossary: **Standalone Expense (Spesa a sé)** entry, categorization rule #1 (by purpose not counterparty), refund/netting doctrine.

### Existing code to extend
- `lib/services/transaction-detach.ts` — `detachTransactionToDedicatedExpense()`; synthetic hash `sha256("detached:{id}")`; the `SINGLE_TRANSACTION_EXPENSE` guard (`expenseTransactionCount <= 1`) to lift; `reconcileExpensesAfterTransactionRemoval()`. **Currently sets `subCategoryId: null`** — needs subcategory capture.
- `lib/actions/transactions.ts` — `detachTransaction()` action wrapper.
- `components/transactions/detach-expense-dialog.tsx` — existing detach UI (title capture); the inline affordance likely builds on/near this.
- `lib/services/categorization.ts` — `applyTier2History()` (keys on `descriptionHash`, `source='manual'`, ≥3 threshold); confirm the synthetic hash keeps standalone expenses out of Tier 2.
- The unified `SubcategoryPicker` bottom sheet (subcategory capture surface reused across all selection points).
- `lib/db/schema.ts` — `expense` (unique `(userId, descriptionHash)`), `transaction.expenseId`, `expenseClassificationHistory`.
</canonical_refs>

<specifics>
## Specific Ideas
- Motivating scenario: a friend's yearly reimbursement for a shared YouTube subscription. Categorized under `streaming` it nets correctly (option A), but the friend's `descriptionHash` aggregates all their transfers into one expense — so the YouTube reimbursement and next month's pizza reimbursement collapse into one expense and cannot carry different subcategories. The standalone action isolates the specific transaction.
- The action should read as "this is a one-off / don't aggregate" and capture both a human title and the subcategory in one step.
</specifics>

<scope_fence>
## Scope Fence (OUT — per ADR 0016)
- **Normalized "Subscriptions" view** (net cost per covered month for shared/recurring expenses) — deferred; the main entrate/uscite dashboard stays cash-basis and is not amortized.
- **Splitting a single inflow across multiple subcategories** (e.g. €50 subscription + €20 pizza in one transfer) — out; the one-transaction → one-subcategory limit holds.
- **A counterparty ("money from a person") category** — rejected outright.
- **Any change to the netting/aggregation engine or the dashboard** — option A netting is already in effect; this phase does not touch aggregation math.
</scope_fence>

<deferred>
## Deferred Ideas
- SUBS-VIEW — normalized Subscriptions view (future milestone).
- SPLIT-01 — split one inflow across subcategories (future).
</deferred>

## Success Criteria (from ADR consequences)
- No schema change and no new code required to record shared/reimbursed costs *correctly* — that is option A (ADR 0004) already in effect. The only build is the inline standalone affordance + the in-place single-transaction path.
- A reimbursement from a person can be isolated and categorized on its own without polluting the sender's aggregate or Tier 2.

## Risk Summary (from ADR consequences)
- The month a lump-sum reimbursement lands shows distorted Deviation/MonthOverMonth for that subcategory (positive month vs negative baseline) — expected, not corrected here (motivates the deferred Subscriptions view).
- Isolating a person's reimbursement is manual each time (irreducible: a person's description is an unreliable categorization key).
- A single inflow covering multiple purposes cannot be split — one-transaction → one-subcategory limit.

---

*Phase: 61-standalone-expense*
*Context gathered: 2026-07-01 via ADR Ingest Express Path*
