# Shared and reimbursed recurring costs net by subcategory; ambiguous inflows are isolated per transaction

## Status

accepted, **§1 superseded by [ADR 0018](./0018-reimbursement-1n-linking-supersedes-net-by-subcategory.md)** (reimbursements are now recorded by explicit 1:N linking, not by unlinked net-by-subcategory). §2–§4 (the general "Standalone Expense" action and the in-place single-transaction re-hash, shipped in v2.4) remain valid. Extends [ADR 0004](./0004-nature-segments-algebraic-sum.md) on the refund/netting model; applies the categorization doctrine in [CONTEXT.md](../../CONTEXT.md).

## Context

A user pays a recurring subscription monthly (e.g. €20/mo) but shares it with friends who reimburse their share as a single lump sum once a year. The user wants their *real* cost reflected (≈ net per month) and asked how to record the friends' inflows.

Two distinct problems hide here; only one is in scope.

1. **Classification** — where do the friends' inflows go, and how do they avoid polluting unrelated categorization?
2. **Temporal normalization** — the reimbursement lands in one month but the cost recurs across twelve, so the monthly cashflow chart spikes.

This ADR settles (1). (2) is explicitly deferred (see Consequences).

A second-order issue surfaced while resolving (1). Every transaction is keyed by `descriptionHash`, and transactions sharing a normalized description aggregate into a single `expense` (`UNIQUE (user_id, description_hash)`). A person is not a merchant: the same sender ("Andrea") transfers money for the shared subscription one month and for last night's pizza the next, both under the same bank description — so both collapse into the same expense and cannot carry different subcategories.

## Decision

**1. Shared/reimbursed recurring costs net under the spend's subcategory (option A).** A reimbursement for a shared expense is categorized under the *same* subcategory as the expense it offsets (e.g. `streaming`) and nets by algebraic sum, per ADR 0004. No new income classification, no transaction-linking, no new model — the annual net is correct automatically. The known cost is accepted as correct cash-basis behavior, not a bug: the month the lump sum lands shows a net-positive (or reduced) OUT segment for that subcategory.

Rejected:
- **(B) Classify the inflow as `income_extraordinary`.** Doctrinally false — it is not new money and does not increase net worth — and it would force combining opposite directions (IN vs OUT) to recover the net.
- **(C) Exclude the inflow from totals like a `transfer`.** Loses the liquidity signal (the money really did arrive that month) and contradicts the cash-truthful main dashboard.

**2. Ambiguous inflows are isolated per transaction via a general "standalone expense" action — not a counterparty category.** The categorization flow gains an explicit option to treat a single transaction as its own expense (do not aggregate), capturing a title and a subcategory. This surfaces the existing `detachTransactionToDedicatedExpense` capability inline. It is deliberately general — available on any transaction — not a "money from a person" feature.

Rejected: a dedicated **"money received from a person"** category with a sub-flow. It classifies by *counterparty*, which the categorization doctrine (CONTEXT.md, rule #1: "per scopo, non per beneficiario") forbids — Sparter classifies by purpose, never by who. It also cannot be reliably auto-detected (a salary is also "from a person"), so it collapses into a manual routing hop with no added power.

**3. Isolation is per-transaction, not a standing rule.** Isolating a transaction frees the original `description_hash`; the next same-description transaction arrives fresh and uncategorized. There is deliberately no persisted "never aggregate this sender" rule — because the same description legitimately means different things, no single rule would be correct. The recurring manual cost is accepted; relieving it is the job of the deferred Subscriptions view, not a per-description flag.

**4. Single-transaction isolation re-hashes the expense in place; the guard is lifted, not patched.** The `SINGLE_TRANSACTION_EXPENSE` guard in `lib/services/transaction-detach.ts` exists because the multi-transaction detach path (create a new expense, move the transaction, leave the source surviving with its remaining transactions) leaves an empty orphan source when the source held only the moved transaction *and* already carried classification history. Rather than remove the guard and reconcile the orphan downstream, the single-transaction case gets a dedicated path: rewrite the existing expense's `description_hash` to the synthetic value (`sha256("detached:{id}")`) in place — same row, same id. No new expense, no orphan, classification history preserved. The observable outcome is identical to a normal detach.

## Consequences

- No schema change and no new code are required to record shared/reimbursed costs *correctly* — it is an application of ADR 0004. The only build is the inline "standalone expense" affordance plus the in-place single-transaction path.
- The month a lump-sum reimbursement lands will show distorted Deviation and MonthOverMonth for that subcategory (a positive month against a negative baseline). This is expected and is the motivating symptom for the deferred Subscriptions view; it is not corrected here.
- A reimbursement from a person must be categorized manually each time and, when it would pollute the sender's aggregate, isolated manually. This is irreducible given that a person's description is an unreliable categorization key.
- **Temporal normalization (a "Subscriptions" view showing net cost per covered month) is explicitly deferred** to a future GSD phase. The main entrate/uscite dashboard stays cash-basis by design; the monthly chart is not amortized.
- A single inflow covering multiple purposes (e.g. €50 subscription + €20 pizza in one transfer) cannot be split across subcategories — the one-transaction → one-subcategory limit holds. Out of scope.
