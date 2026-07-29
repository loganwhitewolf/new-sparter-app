# Phase 81: inline-net-display-for-paired-transactions - Context

**Gathered:** 2026-07-29
**Status:** Ready for planning
**Source:** Locked design decisions (session 2026-07-29) — no discuss-phase; decisions mirrored in memory `project_paired_tx_inline_net_display`.

<domain>
## Phase Boundary

v2.9 **closure phase** for the non-blocking UAT gap flagged in `.planning/v2.9-MILESTONE-AUDIT.md`
(Phase 78 item). When a user closes an amortization plan "per vendita" — and, by the identical
mechanism, for **every v2.8 reimbursement** — the detail page and dashboard net correctly, but the
**transactions table row** still shows only the gross `transaction.amount`, and the sale/refund
counterpart reads as a plain positive inflow with nothing marking it as a reduction of another
transaction.

Deliver, in the transactions table only:
1. A paired **outflow anchor** renders its **net** amount as the primary figure with the **gross
   initial amount struck-through/opaque** beneath it.
2. The paired **counterpart** (the sale/refund positive) shows a **"riduzione di …" badge** linking
   to its anchor, with an **attenuated** amount, so it no longer reads as an asset/inflow.

**Critical architectural fact (de-risks the whole phase):** amortization-sale realization reuses
`createPairTx` (`lib/services/transaction-pairs.ts`), which writes the generalized
`reimbursement`/`reimbursement_refund` tables — the v2.8 legacy 1:1 `transaction_pair` was subsumed
(ADR 0018, `lib/dal/transactions.ts:207-209`). So amortization sales and v2.8 reimbursements are
**one and the same DAL path**. The locked "all pairings" scope therefore falls out of a single code
path — there is no amortization-specific branch to write.

**This is a presentational / read-render phase.** No write path, no netting-math change.

**Not in this phase:**
- Any change to `effectiveAmount()` (`lib/dal/transaction-pairs-sql.ts`), netting semantics,
  aggregation totals, or dashboard/lens figures. The cash lens stays byte-identical (LENS-03).
- The detail page and `/reimbursements` page (they already net correctly — the user confirmed).
- The dashboard (already correct under both lenses).
- Lens-awareness of the transactions table — it stays **cash-only**; the net shown is the cash net
  (initial + Σ linked refund amounts, which for an outflow anchor reduces magnitude).
- Multi-counterpart display — the DAL is a documented single-displayed-counterpart model
  (`T-73-11`); this phase does not change that.
</domain>

<decisions>
## Implementation Decisions (LOCKED)

### Scope
- **D-N1 (LOCKED):** The new display applies to **all pairings** — amortization-sale anchors **and**
  v2.8 reimbursement anchors — via the single `reimbursement`/`reimbursement_refund` path. This
  intentionally supersedes v2.8's "indicator badge + defer breakdown to the dedicated page" choice
  in favor of an inline net on the row. — *Reversibility: reversible (render-layer only).*

### Anchor row (the paid/reimbursed outflow)
- **D-N2 (LOCKED):** Render **`pairedNetAmount`** as the primary amount, with **`amount`** (gross
  initial) shown struck-through/opaque directly beneath. Applies only when the row is the **anchor**
  of a pairing (has a counterpart AND is the outflow side). — *Reversibility: reversible.*

### Counterpart row (the sale/refund inflow)
- **D-N3 (LOCKED):** Render a **"riduzione di …" badge** that **links to the anchor transaction**
  and render the row's amount **attenuated** (muted/opacity), so it does not read as a standalone
  asset. The anchor label + id are already on the row as `pairedDescription` + `pairedWithId`
  (for a refund row these resolve to the anchor). — *Reversibility: reversible.*

### Invariant
- **D-N4 (LOCKED):** **Purely presentational.** `effectiveAmount()`, netting, every total, and every
  dashboard/lens figure stay unchanged. The full test suite — including
  `tests/reimbursement-regression.test.ts` LENS-03 byte-identical assertions — must stay green.

## Claude's Discretion (planner decides)
- **Role discriminator:** how to decide "this row is the anchor" vs "this row is the counterpart".
  Candidates already on the row: sign of `amount` (anchor = out/negative, counterpart = in/positive)
  combined with `pairedWithId != null`; or resolve role explicitly. Prefer the most robust, and
  confirm it against the `pairedCounterpartIdExpr()` role rules
  (`lib/dal/transactions.ts:82-160`). If a per-row `pairRole` ('anchor'|'refund'|null) column makes
  the render unambiguous and is cheap, adding it to `transactionListSelect` is in scope — but only
  if genuinely needed (goal: zero or minimal DAL change).
- **Reuse vs replace `ReimbursementRowIndicator`** (`components/transactions/reimbursement-row-indicator.tsx`):
  decide whether the counterpart badge extends that component or is a new sibling. The existing
  indicator links to `/reimbursements/[id]`; D-N3 wants the counterpart badge to link to the
  **anchor transaction**. Reconcile the two link intents (an amortization sale may not warrant a
  `/reimbursements` deep link the way a reimbursement does).
- Exact visual treatment (typography scale of net vs struck gross, badge copy, opacity value) within
  shadcn/Tailwind conventions already used in the table.
</decisions>

<canonical_refs>
## Files & seams

- `lib/dal/transactions.ts` — `transactionListSelect` already exposes per row: `pairedWithId`,
  **`pairedNetAmount`** (net computed in SQL, lines 212-229), `pairedAmount`, `pairedDescription`,
  `pairedOccurredAt`, `reimbursementId` (anchor|refund participation), `amortizationPlanId/Status`.
  `TransactionListRow` type at lines 266-300. **The data for the display already exists on the row.**
- `components/transactions/transaction-table.tsx:603-610` — the amount `<TableCell>` that today
  renders only `formatAmount(transaction.amount, …)` (gross). This is the primary edit site.
  The optimistic-update path at ~1026-1045 already sets `pairedNetAmount`/`pairedWithId` on rows,
  confirming the fields are part of the client row model.
- `components/transactions/reimbursement-row-indicator.tsx` — current pairing signal (badge → /reimbursements/[id]).
- `lib/dal/transaction-pairs-sql.ts` — `effectiveAmount()`; **do not touch** (D-N4).
- `lib/services/transaction-pairs.ts::createPairTx` — the shared write path proving one-model scope.
- `lib/routes.ts` — `transactionDetailHref` (anchor link target) and `reimbursementHref`.
- `tests/reimbursement-regression.test.ts` — LENS-03 byte-identical gate; must stay green.
</canonical_refs>

<success_criteria>
1. A paired outflow anchor (amortization closed-for-sale OR v2.8 reimbursement) renders in the
   transactions table with `pairedNetAmount` as the primary figure and the gross `amount`
   struck-through/opaque beneath — for **all** pairing types, one code path.
2. The counterpart row shows a "riduzione di …" badge linking to its anchor transaction, amount
   attenuated — no longer reading as a plain asset/inflow.
3. No change to any total, `effectiveAmount()` result, netting math, or dashboard/lens figure; the
   full test suite (incl. LENS-03 byte-identical regression) stays green.
</success_criteria>

<risk_summary>
Low. Render-layer change over data that already exists on the row. Main risks: (a) mis-identifying
anchor vs counterpart role → wrong side gets the net/badge (mitigate with the DAL role rules +
a table-render test over a paired fixture); (b) accidentally reading `pairedNetAmount` into any
aggregation or total (out of scope — it is display-only; the regression suite guards this).
</risk_summary>
