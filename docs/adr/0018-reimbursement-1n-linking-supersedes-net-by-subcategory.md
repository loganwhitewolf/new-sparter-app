# Reimbursements are explicit 1:N links from an outflow to many inflows (supersedes ADR 0016 §1)

## Status

accepted (supersedes the classification decision — §1 — of [ADR 0016](./0016-shared-costs-net-by-subcategory-inflows-isolated-per-transaction.md); generalizes the 1:1 pairing of [ADR 0004](./0004-nature-segments-algebraic-sum.md) / Phase 50; keeps the categorization doctrine in [CONTEXT.md](../../CONTEXT.md))

## Context

Two mechanisms for "money came back" coexisted:

1. **Explicit 1:1 pairing** (`transaction_pair`, Phase 50 / ADR 0004): one outflow transaction ↔ one inflow transaction, algebraic net, `UNIQUE` on both sides → each transaction sits in at most one pair. Structurally 1:1.
2. **Net-by-subcategory** (ADR 0016 §1): shared/reimbursed costs are *not* linked; the inflow is categorized under the spend's subcategory and nets by algebraic sum. Cash-basis, no linking object.

Real cases the 1:1 pairing cannot express:

| Case | Outflows | Inflows |
|---|---|---|
| Amazon order / refund | 1 | 1 |
| Dinner split among friends | 1 | N (each friend repays their share) |
| Holiday split | N (hotel, flights, restaurants) | M |

The dinner is the motivating gap: today only one of the N reimbursements can be linked; the others are orphaned. ADR 0016 §1 handled the *numbers* (the N inflows net by subcategory) but produced no explicit "this expense was reimbursed by these transactions" object — no residual, no reconciliation, no dedicated view.

A verified mechanical fact grounds the temporal decision. In `transaction-pairs-sql.ts`, the secondary (inflow) is **excluded** from every aggregation (`isNotSecondary()`) and the primary (outflow) shows the algebraic net (`effectiveAmount()`) **in its own month**. So a linked refund is teleported into the cost's month; the refund's own month shows nothing. Pairing is therefore *not* cash-basis — it deliberately shows the true net cost at cost-time. Net-by-subcategory (ADR 0016 §1) *is* cash-basis. The two mechanisms differed precisely on temporal treatment.

## Decision

**1. One mechanism, generalized to 1:N.** Evolve the 1:1 pairing into an explicit link from **one outflow to N inflows**. The old `transaction_pair` becomes the N=1 case and is migrated, not kept alongside. This supersedes ADR 0016 §1: reimbursements are now recorded by explicit linking, not by unlinked net-by-subcategory. (ADR 0016 §2–§4 — the general "Standalone Expense" action and the in-place single-transaction re-hash, shipped in v2.4 — remain valid and untouched.)

**2. The anchor is always an outflow; refunds are inflows.** A reimbursement group is defined by its spend. An inflow is never the anchor — a positive-anchored flow is managed on someone else's account, and for us the outflow is the real cost. This is a rule of *role*, not of *time*: a friend pre-paying before the spend still attaches to the outflow.

**3. The anchor is an Expense or an Expense Group (both in outflow).** This lets a *group* of transactions carry a reimbursement (the motivating request: today Expense Groups cannot). A dinner = one Expense anchor; a holiday = one Expense Group anchor; an Amazon order = one Expense anchor. Netting stays per-transaction (`effectiveAmount`), but the *selection* unit is the Expense / Expense Group.

**4. Mondo Netto (net at cost-time).** Linked refunds net into the **month of the cost**; the refund's own month does not show the inflow. Chosen over "Mondo Cash" (each transaction immutable in its own month, net shown only on the group page) for consistency with the existing pairing — the 1:1 is generalized, not rewritten. Accepted cost: a past month **can change retroactively** when a late refund is linked. This is already the behavior of today's 1:1 pairing.

Rejected — **Mondo Cash**: every transaction stays immutable in its month; the dashboard never nets; the net/residual lives only on the reimbursement-group page. Coherent, but it abandons the pairing premise and would require the refund to appear as a normal inflow, contradicting "one mechanism."

**5. Residual / reconciliation is first-class.** `residual = Σoutflow + Σ(refunds linked so far)`, surfaced while negative ("still owed €25"). It falls out of the model for free.

**6. Subscription temporal amortization stays out of scope.** Spreading one annual inflow across N monthly (often *future*, not-yet-existing) charges is amortization/projection, not linking — it needs fan-out (one inflow → many months) and fractional allocation, capabilities 1:N does not have. It remains the deferred "Subscriptions view" (ADR 0016 Consequences), to be built as a focused later milestone.

## Consequences

- **New schema:** a `reimbursement` entity (`id, userId, title, anchor = expenseId XOR expenseGroupId, createdAt`) plus a `reimbursement_refund` join (`reimbursementId → transactionId`). `transaction_pair` is subsumed: a migration maps each existing pair to a `reimbursement` (anchor = the primary's Expense, refund = the secondary).
- `effectiveAmount` / `isNotSecondary` generalize from "the one secondary" to "the set of linked refunds."
- A dedicated section (`/reimbursements` + a per-group page) reuses the RSC scaffolding of `/tags/[id]` and the Expense Group view.
- **Left to the discuss/plan phase (details, not architecture):**
  1. Subcategory attribution of a refund when the anchor spans multiple subcategories (invisible on the top-line entrate/uscite; matters only for the per-category breakdown).
  2. Multi-month anchors: whether to constrain an anchor to a single netting-month or attribute per-transaction (holiday confirmed "single-period").
  3. Verifying per-transaction `effectiveAmount` attribution holds when an Expense anchor has multiple transactions.
- Retroactive month mutation (Consequence of §4) can surprise users who expect closed months to be stable; accepted, and the same as today.
