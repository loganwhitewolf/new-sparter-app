# Requirements: v2.9 Amortization

Scoped capability contract for milestone v2.9. Model locked in [ADR 0019](../docs/adr/0019-amortization-accrual-lens.md); charted via the `/wayfinder` map at `.scratch/amortization/`.

## v2.9 Requirements

### Plan lifecycle (AMORT)

- [ ] **AMORT-01**: User can amortize an outflow transaction over a chosen number of months from the transaction row, the transaction detail page, and manual entry.
- [ ] **AMORT-02**: When a user amortizes a transaction, the system detaches it into a Standalone Expense so a later same-description purchase is not swept into the plan.
- [ ] **AMORT-03**: User sees the amortized cost spread into uniform monthly instalments starting from the purchase month, with the rounding remainder on the first instalment and each instalment on the purchase's calendar day (clamped to month end).
- [ ] **AMORT-04**: User can close an amortization plan, collapsing every remaining instalment onto the closure month while past instalments stay in place.
- [ ] **AMORT-05**: User can close a plan with a realization value by linking a sale transaction (imported or created at closure) that nets against the closure month; closing with no linked transaction records a scrapped asset.
- [ ] **AMORT-06**: When a reimbursement is linked to an open plan, the system reduces the base and re-spreads the remaining instalments proportionally.
- [ ] **AMORT-07**: The system blocks or reconciles edits to an amortized transaction (amount, date) so a plan cannot silently desynchronize from its source transaction.

### Amortization registry (REG)

- [ ] **REG-01**: User can see all amortization plans in a dedicated `/amortizations` section showing description, transaction date, initial amount, consumed amount, net value, and remaining months per plan.
- [ ] **REG-02**: User can close a plan from the registry, optionally entering a sale/realization value.
- [ ] **REG-03**: User can distinguish open from closed plans in the registry.

### Dashboard lens (LENS)

- [ ] **LENS-01**: User can switch the whole dashboard between a "cassa" (cash) view and a "competenza" (accrual) view with one global control.
- [ ] **LENS-02**: Under the accrual view, every dashboard widget — bar chart, KPI cards, category breakdown, movers, deviations — reflects spread instalments instead of the purchase-day amount.
- [ ] **LENS-03**: Under the cash view, all dashboard figures remain byte-identical to today's behavior.
- [ ] **LENS-04**: Under the accrual view, the dashboard shows the whole selected year including future instalment months, with instalments past year-end appearing in the following year.
- [ ] **LENS-05**: The year and month selectors offer periods that exist only as instalments under the accrual view.

## Future Requirements (deferred)

- Configurable amortization day in settings (a user-chosen month day for all instalments) — deferred; every instalment falls on the purchase's calendar day for now.
- Amortizing `in` / `allocation` / `transfer` directions — outflows only for v2.9.
- Splitting widget semantics (future months dashed while KPIs stop at today) — a later UX iteration.

## Out of Scope (explicit exclusions)

- **Amortizing an Expense or an Expense Group** — the unit is the single transaction (ADR 0019 §1); the per-merchant `descriptionHash` aggregation cannot anchor a per-purchase plan.
- **Non-uniform plans** (variable instalments, depreciation curves) — the plan is uniform by decision (ADR 0019 §3).
- **Automatic or threshold-based activation** — activation is always manual (ADR 0019 §9).
- **A debt amortization schedule** (principal/interest split) — already excluded in CONTEXT.md; the whole instalment is OUT.
- **Asset depreciation / net-worth tracking** — needs an asset model Sparter does not have.

## Traceability

_Filled by the roadmap: each requirement maps to exactly one phase._
