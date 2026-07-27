# Phase 74: group-anchor-and-reconciliation - Context

**Gathered:** 2026-07-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Let an outflow **Expense Group** (a group of transactions) carry a reimbursement, expose the
**residual** as a first-class computed value, and generalize the amount-edit guard coherently to the
1:N model. This phase completes the netting/residual/guard **core** on top of the Phase 73 schema — it
ships **no new user-facing management surface** (linking UI is Phase 75, the `/reimbursements` section
is Phase 76). Correctness is gated by the same dashboard regression discipline as Phase 73.

**Requirements:** RMB-02, RMB-06, RMB-09

**Carried forward from Phase 73 (locked, do not re-open):** one single netting mechanism (Mondo Netto,
net at cost-time), invariant anchor = outflow / refund = inflow (`lib/services/reimbursement-invariant.ts`),
the `reimbursement` + `reimbursement_refund` schema with `expenseGroupId` column and XOR constraint
**already landed** (migration 0029). Phase 73 deliberately left the `expense_group_id` branch of
`effectiveAmount()` **un-netted** as a documented gap — this phase fills it.

</domain>

<decisions>
## Implementation Decisions

All four ROADMAP gray areas were discussed and resolved. The netting decisions (D-01/D-02) and the
subcategory decision (D-05) are the **same mechanism** viewed from two angles.

### Group-anchor netting — proportional spread

- **D-01:** When a reimbursement is anchored on an Expense Group, the net of the linked refunds is
  **spread across the group's member transactions in proportion to each transaction's own amount**
  (each member absorbs `refundNet × memberAmount / ΣmemberOutflow`). This **replaces** the Phase 73
  "dump the whole net on the earliest transaction" resolution. Money math uses `Decimal.js`
  (`@/lib/utils/decimal`) — never native JS arithmetic. The rounding residual (fractional cent) is
  assigned by **largest-remainder to the largest-amount member transaction**, so per-transaction shares
  sum back to the exact net at the centesimo. — **Reversibility:** costly — undo re-writes the
  `effectiveAmount()` netting expression and every regression snapshot that froze the spread behaviour.

- **D-02:** **One netting mechanism, applied everywhere.** The proportional spread also governs an
  **Expense anchor with multiple transactions** — there is no special-case branch for Expense vs Group.
  The migrated 1:1 pairs are N=1 single-transaction anchors, where spread degenerates to "the whole net
  on the one transaction," so **the Phase 73 regression gate stays green unchanged**. The Q3
  earliest-transaction tie-break from Phase 73 is superseded by proportional spread for the N>1 case.
  → RMB-02

- **Accepted cost:** with the spread, linking a late refund can now change **more than one past month**
  (one per member transaction, each netting in its own `occurredAt` month), where Phase 73 changed at
  most one. This broadens — but is the same kind of — retroactive month mutation already accepted in
  Phase 73 (D-04). Do **not** add guards against it in this phase.

### Residual — computed, not persisted; surplus allowed

- **D-03:** `residual = Σoutflow + Σ(refunds linked so far)`, computed **on the fly** per reimbursement
  (not a stored column). Sign convention: **negative = money still owed** ("ancora dovuti €25"),
  **zero = saldato**, **positive = surplus** (refunds exceeded the outflow). Surplus is **allowed and
  surfaced as a distinct state — never blocked**. The Phase 73 invariant checks only the **sign** of
  each amount, never the magnitude of the sum; this phase adds **no magnitude guard**. This phase
  delivers the residual as a tested data-layer value ready for Phase 75/76 to render — it does not build
  a surface. → RMB-06 — **Reversibility:** reversible — a computed value with no schema footprint.

### Amount-edit guard (RMB-09) — hard-block, better message

- **D-04:** The v2.5 pair guard already generalizes to 1:N in `lib/services/transaction-edit.ts`
  (SUM over the refund set, correct for any N). RMB-09 resolves the remaining UX choice as **hard-block,
  no auto-reconciliation**: an edit that would break the reimbursement's opposite-sign/nonzero invariant
  is rejected with the Italian message `"Scollega prima il rimborso"` before any write, exactly as
  today. The **only** additive work is a **clearer message when N>1** — identify which reimbursement
  (and, where feasible, which refund) is blocking, so the user knows what to unlink. Auto-reconciliation
  is explicitly **rejected**: silently re-nudging totals is the exact silent-corruption failure RMB-09
  exists to prevent. → RMB-09 — **Reversibility:** reversible — message/logic local to `updateTransaction`.

### Subcategory attribution (Q1) — falls out of the spread

- **D-05:** When a Group anchor spans multiple subcategories, a refund's net attributes to a subcategory
  **by the same proportional spread as D-01**: each member transaction absorbs its proportional share of
  the net **in its own subcategory**. There is **no separate subcategory-allocation mechanism** — the
  per-category breakdown is correct automatically because the netting already lands per-transaction, and
  each transaction already carries its subcategory. Invisible on top-line entrate/uscite; correct on the
  per-category breakdown. → RMB-02 (Q1)

### Claude's Discretion (details, not architecture)

- Exact SQL shape of the proportional `effectiveAmount()` expression (per-transaction share as a
  correlated subquery over the anchor's member set) and the group-membership resolution path
  (`expense_group_membership` → member expenses → their transactions).
- Whether the largest-remainder residual-cent assignment is computed in SQL or in a DAL helper — pick
  whichever keeps the regression gate exact and the aggregation sites consistent.
- Where the `residual` computation lives (a DAL/service function keyed by `reimbursementId`) and its
  exact return shape — no UI consumer exists yet, so the contract is agent's choice, but keep it
  Decimal-safe (`DECIMAL` columns are strings).
- The exact wording of the improved N>1 guard message, within the existing Italian tone.
- Index/query strategy for the new group-netting subqueries.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Reimbursement model (locked)
- `docs/adr/0018-reimbursement-1n-linking-supersedes-net-by-subcategory.md` — the locked 1:N model,
  outflow-anchor invariant, Mondo Netto, schema shape, Group-anchor deferral to this phase
- `docs/adr/0017-expense-group-over-physical-merge.md` — the Expense Group model the anchor references
  (membership via `expense_group_membership`, group totals computed at read time, not persisted)
- `docs/adr/0016-shared-costs-net-by-subcategory-inflows-isolated-per-transaction.md` — §1 superseded by
  0018; §2–§4 (Standalone Expense) remain valid and untouched
- `docs/adr/0004-nature-segments-algebraic-sum.md` — the original 1:1 pairing being generalized

### Phase 73 output — the code this phase extends
- `.planning/phases/73-reimbursement-schema-and-netting/73-CONTEXT.md` — the parent decisions (D-01…D-07)
- `lib/dal/transaction-pairs-sql.ts` — `effectiveAmount()` / `isNotSecondary()`; the `expense_group_id`
  branch is the documented gap to fill, and `effectiveAmount()` is where proportional spread lands
- `lib/services/reimbursement-invariant.ts` — the sign-only invariant to reuse (do not duplicate); D-03
  confirms it stays sign-only (no magnitude guard for surplus)
- `lib/services/transaction-edit.ts` — the amount-edit guard (`updateTransaction`) already 1:N-correct;
  RMB-09 only improves the N>1 message here
- `lib/db/schema.ts` — `reimbursement` (expenseId XOR expenseGroupId), `reimbursement_refund`,
  `expense_group` + `expense_group_membership`

### Aggregation sites the regression gate must cover
- `lib/dal/dashboard.ts`, `lib/dal/overview.ts`, `lib/dal/transactions.ts`, `lib/dal/expenses.ts`,
  `lib/dal/tags.ts` — every consumer of `effectiveAmount()` / `isNotSecondary()`; the spread must be
  numerically inert for N=1 across all of them
- `tests/reimbursement-regression.test.ts`, `tests/reimbursement-invariant.test.ts`,
  `tests/fixtures/reimbursement-seed.ts` — the existing regression + invariant harness to extend

### Project rules
- `CLAUDE.md` — Decimal.js for money, `drizzle-kit generate` + `scripts/migrate.ts` (never
  `drizzle-kit push` in prod), `dal` / `services` / `actions` layering, English code / Italian product
  surfaces
- `CONTEXT.md` (repo root) — canonical domain language (Transaction vs Expense, Expense Group, Reference
  Period, Deviation)
- `.planning/REQUIREMENTS.md` — RMB-02, RMB-06, RMB-09 wording

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `effectiveAmount()` / `isNotSecondary()` (`lib/dal/transaction-pairs-sql.ts`): the netting expressions
  to extend — spread replaces the single-anchor CASE with a per-transaction proportional share; the
  `expense_group_id` branch is currently a no-op awaiting exactly this.
- `assertOutflowAnchorAmount` / `assertInflowRefundAmount` / `assertReimbursementAmounts`
  (`lib/services/reimbursement-invariant.ts`): sign-only invariant, reused as-is — D-03 confirms no
  magnitude check is added.
- The 1:N amount-edit guard in `updateTransaction` (`lib/services/transaction-edit.ts`): already SUMs
  over the refund set for any N; only the N>1 message text changes.
- `expense_group` + `expense_group_membership` (`lib/db/schema.ts`, Phase 65/ADR 0017): the group→member
  expenses→transactions resolution path for spread.

### Established Patterns
- Netting is **per-transaction** at every aggregation site; the Expense / Group is only the *selection*
  unit (Phase 73 D-03). Spread keeps this — it stays per-transaction, just weighted.
- Money is `Decimal.js` end-to-end; `DECIMAL` columns are strings. Largest-remainder cent assignment
  must keep the per-transaction shares summing to the exact net.
- Regression-gate-as-tracer: prove numerical inertness for N=1 before expanding, same discipline as
  Phase 73 (the gate must fail loudly on drift, never tolerate rounding).

### Integration Points
- `effectiveAmount()` spread flows into all five aggregation DALs unchanged at the call site (the
  expression changes, the callers do not).
- The `residual` function is a new DAL/service read with no current UI consumer (Phase 75/76 will
  render it).

</code_context>

<specifics>
## Specific Ideas

- Motivating cases to sanity-check every decision against: the **dinner split** (one/few outflows, N
  friends repaying — partial repayment surfaces via residual "ancora dovuti €25"); the **holiday**
  (N outflow transactions → the Group anchor this phase enables, spread across member months); the
  **Amazon order/refund** (N=1, must net identically after the spread generalization — the regression
  anchor).
- The user deliberately chose **proportional spread over single-period**, accepting multi-month
  retroactive mutation, because it keeps the per-category breakdown honest without a separate
  subcategory-allocation mechanism (D-01 and D-05 are one mechanism).
- **Surplus (over-repayment) is a real state, not an error** — friends can repay more than owed; the
  residual goes positive and is shown, never blocked.

</specifics>

<deferred>
## Deferred Ideas

- **RMB-F1 — subscription temporal amortization** (spread one inflow across N covered months): still a
  later milestone (ADR 0018 §6). Note: this phase's *spatial* spread across member transactions is
  **not** the same as F1's *temporal* fan-out of a single inflow — do not conflate them.
- **RMB-F2 — refund CSV export** from a reimbursement page.
- **Linking/management surfaces** — create/manage a reimbursement from the Expense detail page or Group,
  add/remove refunds, unlink/delete restores baseline: **Phase 75** (RMB-07, RMB-08).
- **`/reimbursements` list + per-reimbursement page** rendering the residual/net delivered here:
  **Phase 76** (RMB-10, RMB-11).

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 74-group-anchor-and-reconciliation*
*Context gathered: 2026-07-24*
