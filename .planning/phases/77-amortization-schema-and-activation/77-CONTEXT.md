# Phase 77: amortization-schema-and-activation - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the foundation of amortization: the materialised plan + instalment schema, the
`ledger_entry` seam (cash = transactions, accrual = non-amortized transactions `UNION ALL`
instalment rows), and the activation entry points (transaction row, transaction detail page,
manual entry) that detach the source transaction into a Standalone Expense.

A user can spread a one-off **outflow** transaction into N uniform monthly instalments from any
entry point, and the existing cash-basis dashboard keeps reporting **byte-identically** to today.

Requirements: **AMORT-01, AMORT-02, AMORT-03, LENS-03**.

The model is locked by **ADR 0019** — no discovery to redo. This discussion only settles HOW to
implement the activation UX, the eligibility guards, and the undo path within the locked model.

</domain>

<decisions>
## Implementation Decisions

### Activation flow & preview
- **D-01:** Activation from the transaction row and the detail page opens a **dialog with a plan
  preview** — the user enters the number of months and immediately sees the computed schedule
  (each instalment's date + amount, with the rounding remainder on the first instalment) **before
  confirming**. No silent activation. — **Reversibility:** reversible — UI-level; the preview
  computation reuses the same materialisation logic the plan write path uses.
- **D-02:** Plan duration N: **minimum 2, no maximum**. N=1 is meaningless (no spreading). There is
  a **natural cap = the amount in cents** (every instalment must be ≥ 0,01), enforced as dialog
  validation, not a fixed ceiling. — **Reversibility:** reversible. **Downstream constraint:** an
  arbitrarily long plan (e.g. 240 months) stretches the lens-aware year/month selector horizon in
  Phase 80 — `getYearsWithData` / `getMonthsWithData` must handle unbounded instalment horizons.
- **D-03:** Confirming the plan performs the forced detach into a Standalone Expense + plan +
  instalment materialisation **atomically** (single `db.transaction`), per ADR 0019 §1/§4.

### Eligibility guards (which outflows can be amortized)
- **D-04:** **Block** activation when the transaction is involved in a reimbursement (v2.8) —
  whether it is the anchor (Expense-in-uscita) or a secondary/refund row. Keeps the netting +
  spreading interaction out of the foundation phase; realization-via-sale still arrives through the
  reimbursement mechanism in Phase 78. — **Reversibility:** reversible — a guard predicate, loosened
  later if AMORT-06 needs it.
- **D-05:** **Block** activation when the transaction already has an active amortization plan (one
  plan per transaction).
- **D-06:** **Block** activation when the transaction belongs to an Expense Group (v2.6) — the
  forced detach into a Standalone Expense would tear it out of the group; incompatible with
  "unit = single transaction".
- **D-07:** **Validate** that every instalment is ≥ 0,01 given N (rejects N greater than the amount
  in cents). This is the concrete form of the "importo troppo piccolo" guard.
- **D-08:** The entry point (row action / detail-page action / manual-entry option) is
  **shown/hidden or disabled** according to D-04..D-07 — an ineligible transaction never reaches a
  confirmable dialog.

### Undo / remove a plan (within this phase)
- **D-09:** This phase ships a **"rimuovi ammortamento"** action (from the row and detail page) that
  deletes the plan + all its instalment rows **and reverts the detach** — re-attaching the
  transaction to its shared Expense by its **original** `descriptionHash` (merging back into the
  per-merchant Expense when one exists). Clean recovery from a mis-activation, available immediately.
  — **Reversibility:** costly — reverting a detach is a reconciliation operation (see canonical
  concern below), not a simple delete; get the reverse-detach invariant right in the foundation.

### Manual-entry activation (Claude's discretion — user delegated)
- **D-10:** On the manual create-transaction form (`createTransaction`), amortization is offered
  **inline**: a "Ammortizza" checkbox + months field. When checked, create + detach + plan +
  instalment materialisation run **atomically**, reusing the same preview affordance as D-01. This
  keeps AMORT-01's three entry points behaviourally consistent. — **Reversibility:** reversible.

### Seam & regression (locked by ADR 0019 — recorded for planning, not re-decided)
- **D-11:** The lens is **one swappable `ledger_entry` row source per lens**, NOT a `lens` parameter
  threaded through the aggregation functions (ADR 0019 §10). Aggregations read `ledger.amount` and
  stop calling `effectiveAmount()` / `isNotSecondary()` directly. — **Reversibility:** one-way — the
  seam replaces ~16 call sites of a fragment pair and reshapes the DAL read layer; undoing it after
  aggregations depend on it means re-threading every site.
- **D-12:** **LENS-03 is an invariant, not an option**: the v2.8 real-Postgres byte-identical
  regression suite (`tests/reimbursement-regression.test.ts`) is the gate — every aggregation site
  must stay byte-identical under the cash lens once `ledger_entry`, plans and instalments exist.
  Regression-gate the cash lens **before** any lifecycle or lens-visual work.
- **D-13:** Instalment rows carry their plan's `expense_id`, their own date, and their own amount
  (ADR 0019 §10). **Subcategory derives via the Expense** — no subcategory snapshot on the instalment
  (transactions already have no subcategory column; category lives on the Expense).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked model (read first)
- `docs/adr/0019-amortization-accrual-lens.md` — the full amortization model: unit = transaction,
  forced detach, uniform plan from purchase month, remainder on first instalment, day-clamp,
  materialised instalments, `ledger_entry` seam (§10), double-netting trap, realization-as-reimbursement.
- `.planning/REQUIREMENTS.md` — v2.9 capability contract; AMORT-01/02/03 + LENS-03 are this phase.
- `.planning/ROADMAP.md` — Phase 77 goal, success criteria, and the "regression-gate cash lens first" risk note.

### Reused-model ADRs
- `docs/adr/0016-shared-costs-net-by-subcategory-inflows-isolated-per-transaction.md` §2–§4 — the
  forced-detach / Standalone Expense mechanism reused for amortization.
- `docs/adr/0017-expense-group-over-physical-merge.md` — why the unit is the transaction, not the group (feeds D-06).
- `docs/adr/0018-reimbursement-1n-linking-supersedes-net-by-subcategory.md` — the reimbursement
  mechanism amortization reuses later (Phase 78 realization); relevant here for the D-04 guard.

### Domain vocabulary
- `CONTEXT.md` (repo root) — canonical domain language (Transaction vs Expense, Standalone Expense,
  cassa/competenza, Reference Period). "Ammortamento" is the agreed domain term; the user-facing
  labels for the two lenses (cassa / competenza) are still parked (Phase 80).

### Wayfinder charting (background, not authoritative over ADR)
- `.scratch/amortization/map.md` — the 10 locked premises + open/not-yet-specified list.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/services/transaction-detach.ts` — `detachTransactionToDedicatedExpense()` /
  `applyDetachCleanupTx(tx, input)` (tx-aware) is the forced detach for D-03/D-10. Note
  `syntheticDescriptionHash(transactionId)` — the detach assigns a synthetic hash; the D-09 undo
  must recompute the **original** `descriptionHash` to re-attach, which this service does not do today.
- `lib/dal/transaction-pairs-sql.ts` — `effectiveAmount()` (line 86) and `isNotSecondary()` (line 22):
  the "never one without the other" fragment pair the `ledger_entry` seam collapses into one definition (D-11).
- `lib/dal/dashboard.ts` + `lib/dal/overview.ts` — the aggregation sites that must go byte-identical
  under the cash lens (D-12). ADR notes `dateScopedTransactions()` and
  `expenseStatusIncludedInDashboardTotals()` are duplicated privately in both — extract during seam work.
- `tests/reimbursement-regression.test.ts` — the v2.8 real-Postgres byte-identical suite = the LENS-03 gate.
- `lib/actions/transactions.ts` — `createTransaction()` (line 41) is the manual-entry action to extend for D-10.

### Established Patterns
- Money is `Decimal.js` via `@/lib/utils/decimal`; `DECIMAL` columns are strings (`toDbDecimal`).
  Instalment materialisation and remainder-on-first must use Decimal, never native arithmetic.
- Full multi-write flows run inside `db.transaction`; write helpers accept `DbOrTx`. Both activation
  (D-03) and undo (D-09) are multi-write and must be atomic.
- Schema/category model: `transaction` has `expenseId` FK (`onDelete: set null`), **no** subcategory
  column — category lives on the Expense (confirms D-13).
- Guards model: v2.5 pair-guard and v2.8 D-02 write-path invariants are the precedent for D-04..D-08.

### Integration Points
- Entry points: `app/(app)/transactions/page.tsx` + `TransactionsToolbar.tsx` (row action),
  `app/(app)/transactions/[id]/page.tsx` (detail page), and the manual create form (D-10).
- New schema: `amortization_plan` (transaction FK, months, start date, status open/closed) + N
  `amortization_instalment` rows (plan FK, expense_id, date, amount). Exact columns/indexes/constraints
  left to plan-phase (`gsd-pattern-mapper` against live schema). Migration via `drizzle-kit generate`
  + `scripts/migrate.ts` — never `drizzle-kit push`.

</code_context>

<specifics>
## Specific Ideas

- Preview example (ADR 0019 §3): purchase 14/8 over 4 months → instalments 14/8, 14/9, 14/10, 14/11;
  €1000 / 3 → 333,34 · 333,33 · 333,33 (remainder on first). Day clamps to month end (31/1 → 28/2).
- **Canonical concern for research/plan (D-09 undo):** reverting a detach is not a delete — it must
  recompute the original `descriptionHash` and re-link/merge the transaction back into the shared
  per-merchant Expense (creating it if it no longer exists). Define the reverse-detach invariant
  explicitly; `transaction-detach.ts` has no reverse today.

</specifics>

<deferred>
## Deferred Ideas

- Reimbursement interaction with an amortized plan (reduce base + re-spread, AMORT-06) — **Phase 78**;
  this phase only *blocks* activation on reimbursement-involved transactions (D-04).
- Plan close / collapse remaining instalments onto closure month (AMORT-04), realization via sale /
  scrapped asset (AMORT-05), edit block/reconcile on amortized transaction (AMORT-07) — **Phase 78**.
- `/amortizations` registry (REG-01/02/03) — **Phase 79**.
- Global cassa/competenza dashboard switch, accrual widgets, lens-aware year/month selectors, whole-year
  accrual view with year-end spillover (LENS-01/02/04/05) — **Phase 80**. The unbounded-N horizon
  (D-02) is a constraint the Phase 80 selectors must honour.
- Final Italian copy for the two lens labels (cassa / competenza) — parked (Phase 80).
- Plain Postgres view vs materialized view for `ledger_entry` — performance-driven, decided at plan
  time; the seam shape (D-11) is independent of it.
- Configurable amortization day in settings; amortizing `in`/`allocation`/`transfer`; amortizing an
  Expense/Expense Group; non-uniform plans; automatic/threshold activation — **out of scope** (ADR 0019).

</deferred>

---

*Phase: 77-amortization-schema-and-activation*
*Context gathered: 2026-07-28*
