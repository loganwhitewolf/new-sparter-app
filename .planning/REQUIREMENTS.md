# Requirements: Sparter — Milestone v2.8 Reimbursements 1:N

**Defined:** 2026-07-23
**Core Value:** Safely import real bank transactions, see where money goes categorized by month, and instantly spot deviations — on a zero-cost personal deploy.

Model locked in **ADR 0018** (`docs/adr/0018-reimbursement-1n-linking-supersedes-net-by-subcategory.md`), which supersedes ADR 0016 §1. New REQ category `RMB`.

## v2.8 Requirements

### Model & Netting

- [ ] **RMB-01**: A user can link **N inflow transactions** to a single outflow anchor (one-to-many), generalizing the current 1:1 pairing. The old `transaction_pair` becomes the N=1 case.
- [ ] **RMB-02**: The anchor of a reimbursement is an **outflow Expense** or an **outflow Expense Group** — a group of transactions can carry a reimbursement (impossible today).
- [ ] **RMB-03**: The model enforces the invariant that **only an outflow can be an anchor** and **only an inflow can be a refund** (a positive-anchored reimbursement is rejected).
- [ ] **RMB-04**: Linked refunds net into the anchor's cost following **Mondo Netto** — the anchor shows `outflow + Σ(linked refunds)` in the **cost's month**, and each linked refund is **excluded from its own month**, consistent across every dashboard aggregation site (`effectiveAmount` / `isNotSecondary` generalized from the single secondary to the refund set). Dashboard entrate/uscite/per-category totals stay correct.
- [ ] **RMB-05**: Existing `transaction_pair` rows are **migrated** into the new reimbursement model (anchor = the primary's Expense, refund = the secondary) with no change to dashboard numbers before/after migration.

### Reconciliation

- [ ] **RMB-06**: Each reimbursement exposes a **residual** = `Σoutflow + Σ(refunds linked so far)`, surfaced while still negative ("still owed €25"), so partial reimbursement (3 of 4 friends repaid) is visible.
- [ ] **RMB-07**: A user can **add** and **remove** individual refund links on a reimbursement; **unlinking a refund or deleting the reimbursement restores baseline** — the refund reappears as a normal inflow in its own month and the anchor's net reverts.

### Linking Surfaces

- [ ] **RMB-08**: A user can create and manage a reimbursement from the **Expense detail page** (`/expenses/[id]`) and from the **Expense Group** — pick the outflow anchor, attach eligible inflow transactions.
- [ ] **RMB-09**: The amount-edit **pair guard** (v2.5: an edit breaking a pair's invariant is blocked) generalizes to the 1:N model — editing an anchor or refund amount that would break the reimbursement is handled coherently (block with an Italian message or reconcile), never silently corrupting the net.

### Dedicated Section

- [ ] **RMB-10**: A dedicated **`/reimbursements`** section lists all reimbursement groups with title, anchor, net, and residual/status, reusing the unified table + RSC scaffolding.
- [ ] **RMB-11**: A per-reimbursement page shows the **anchor outflow(s), the linked refunds, the net, and the residual**, with edit-title / add-remove-refund / delete in place — reusing the `/tags/[id]` and Expense Group detail scaffolding.

## Future Requirements (deferred)

- **RMB-F1**: **Subscription temporal amortization** — spread one inflow (e.g. an annual lump reimbursement) across the N covered months so each month shows the true net cost. Requires fan-out (one inflow → many months) + fractional allocation + forward projection over not-yet-existing charges. Different model from linking; the deferred "Subscriptions view" of ADR 0016. Explicitly a later milestone.
- **RMB-F2**: Refund CSV export from a reimbursement page.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Subscription amortization / per-month spreading | RMB-F1 — it's projection, not reconciliation; needs fan-out + fractional + future-month allocation. Deferred by explicit scope decision (2026-07-23). |
| Inflow-anchored reimbursements | Invariant RMB-03 — the anchor is always the outflow (a positive-anchored flow is managed on someone else's account). |
| One inflow split across multiple anchors (fan-out) | Out of the 1:N (fan-in) model; belongs to the amortization work (RMB-F1). |
| Net-by-subcategory as the reimbursement mechanism | Superseded by ADR 0018; ADR 0016 §2–§4 (Standalone Expense) remain valid and untouched. |

## Traceability

Filled at roadmap creation (2026-07-23). 11/11 RMB requirements mapped across Phases 73–76, none orphaned.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RMB-01 | Phase 73 | Pending |
| RMB-02 | Phase 74 | Pending |
| RMB-03 | Phase 73 | Pending |
| RMB-04 | Phase 73 | Pending |
| RMB-05 | Phase 73 | Pending |
| RMB-06 | Phase 74 | Pending |
| RMB-07 | Phase 75 | Pending |
| RMB-08 | Phase 75 | Pending |
| RMB-09 | Phase 74 | Pending |
| RMB-10 | Phase 76 | Pending |
| RMB-11 | Phase 76 | Pending |
