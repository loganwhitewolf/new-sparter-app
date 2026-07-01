# Requirements — Milestone v2.4: Standalone Expense

**Defined:** 2026-07-01
**Decision contract:** LOCKED — `docs/adr/0016-shared-costs-net-by-subcategory-inflows-isolated-per-transaction.md` + `CONTEXT.md` (Standalone Expense glossary entry)

**Goal:** Give the user a way to isolate a single transaction from `descriptionHash` aggregation at categorization time — a general "treat as a standalone expense / do not aggregate" action — so shared-subscription reimbursements and other ambiguous person-to-person inflows can be categorized correctly without polluting the sender's aggregate or the Tier 2 history.

**Context:** The option-A netting doctrine (a reimbursement for a shared expense is categorized under the spend's subcategory and nets by algebraic sum, ADR 0004) is already usable today with zero code. What is missing is the ability to peel one transaction out of its `descriptionHash`-keyed expense, because a person is not a merchant: the same sender's transfers collapse into one expense and cannot carry different subcategories. This milestone builds only that isolation capability.

---

## v2.4 Requirements

### Standalone Expense

- [ ] **STEXP-01**: In the categorization flow, the user can mark a single transaction as a standalone expense ("do not aggregate"), supplying a title and a subcategory; the transaction is detached into a dedicated expense with a synthetic `descriptionHash` (`sha256("detached:{id}")`). The action is general — available on any transaction — not a counterparty-specific category.
- [ ] **STEXP-02**: The standalone action works on an expense that already holds a single transaction, by re-hashing the existing expense row in place (same id) — lifting the `SINGLE_TRANSACTION_EXPENSE` guard in `lib/services/transaction-detach.ts` without creating a new expense or leaving an orphaned empty source.
- [ ] **STEXP-03**: A standalone expense is excluded from both `descriptionHash` aggregation and Tier 2 history learning; a future transaction sharing the original description arrives fresh and uncategorized (isolation is per-transaction, not a standing per-sender rule).

---

## Future Requirements (deferred)

- **SUBS-VIEW** — Normalized "Subscriptions" view showing net cost per covered month for shared/recurring expenses. Explicitly deferred by ADR 0016; the main entrate/uscite dashboard stays cash-basis and is not amortized.
- **SPLIT-01** — Split a single inflow across multiple subcategories (e.g. €50 subscription + €20 pizza in one transfer). Out of scope for v2.4; the one-transaction → one-subcategory limit holds.

## Out of Scope

- A "money received from a person" (counterparty) category — rejected by ADR 0016; violates the categorization doctrine (classify by purpose, not by who) and is not reliably auto-detectable.
- Amortizing a lump-sum reimbursement across the months it covers in the monthly cashflow chart — rejected by ADR 0016 (would break the cash-basis main dashboard).

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| STEXP-01 | Phase 61 | Pending |
| STEXP-02 | Phase 61 | Pending |
| STEXP-03 | Phase 61 | Pending |

**Coverage:** 3/3 requirements mapped — no orphans, no duplicates. All v2.4 scope lands in a single phase (Phase 61: standalone-expense).
