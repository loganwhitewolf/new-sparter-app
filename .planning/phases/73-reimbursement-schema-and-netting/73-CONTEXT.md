# Phase 73: reimbursement-schema-and-netting - Context

**Gathered:** 2026-07-23
**Status:** Ready for planning
**Source:** ADR Ingest Express Path (`docs/adr/0018-reimbursement-1n-linking-supersedes-net-by-subcategory.md`)

<domain>
## Phase Boundary

Generalize the 1:1 `transaction_pair` into a 1:N reimbursement data model (one outflow anchor → N
inflow refunds) and move the netting layer onto it, migrating every existing pair with **zero change
to dashboard numbers**.

In scope: the `reimbursement` + `reimbursement_refund` schema, the outflow-anchor / inflow-refund
invariant, the generalization of `effectiveAmount` / `isNotSecondary` from "the one secondary" to
"the set of linked refunds" at every aggregation site, the `transaction_pair` → reimbursement
migration, and the dashboard regression gate that proves the migration is numerically inert.

Out of scope for this phase: Group-anchor behaviour and residual (Phase 74), linking UI and
lifecycle (Phase 75), the `/reimbursements` section (Phase 76). This phase ships no new user-facing
surface — it is the schema + netting core, gated by regression.

**Requirements:** RMB-01, RMB-03, RMB-04, RMB-05

</domain>

<decisions>
## Implementation Decisions

All decisions below are **locked** by ADR 0018 (status: accepted; supersedes ADR 0016 §1). They are
not re-openable during planning or execution.

### Model — one mechanism, generalized

- **D-01:** Evolve the 1:1 pairing into an explicit link from **one outflow to N inflows**. The old
  `transaction_pair` becomes the N=1 case and is **migrated, not kept alongside** — after this phase
  there is exactly one netting mechanism. This supersedes ADR 0016 §1: reimbursements are recorded by
  explicit linking, never by unlinked net-by-subcategory. (ADR 0016 §2–§4 — Standalone Expense and
  the in-place single-transaction re-hash, shipped in v2.4 — remain valid and untouched.)
  → RMB-01

- **D-02:** **The anchor is always an outflow; refunds are always inflows.** A reimbursement group is
  defined by its spend. An inflow is never the anchor. This is a rule of *role*, not of *time* — a
  friend pre-paying before the spend still attaches to the outflow. Anchoring on an inflow, or linking
  an outflow as a refund, must be **rejected by the invariant** (DB constraint + service-level
  validation, not UI-only).
  → RMB-03

- **D-03:** **The anchor is an Expense XOR an Expense Group** (both in outflow). The schema lands with
  both columns and the XOR constraint **in this phase**, so no second migration is needed later —
  `reimbursement (id, userId, title, expenseId XOR expenseGroupId, createdAt)` plus the
  `reimbursement_refund` join (`reimbursementId → transactionId`). Netting stays **per-transaction**
  (`effectiveAmount`); the Expense / Expense Group is only the *selection* unit. Group-anchor
  *behaviour* (netting over group members, surfaces) is Phase 74 — this phase only guarantees the
  shape is right and the invariant holds.
  → RMB-01, RMB-03

### Netting — Mondo Netto

- **D-04:** **Mondo Netto (net at cost-time).** Linked refunds net into the **month of the cost**; the
  refund's own month does not show the inflow. Chosen over "Mondo Cash" for consistency with the
  existing pairing — the 1:1 is generalized, not rewritten. **Accepted cost:** a past month *can*
  change retroactively when a late refund is linked. This is already today's 1:1 behaviour, so it is
  not a new regression.
  → RMB-04

- **D-05:** `effectiveAmount` / `isNotSecondary` **generalize from "the one secondary" to "the set of
  linked refunds"**, and the generalization must be applied at **every** aggregation site — not only
  the ones the old pair touched. The current implementations live in `lib/dal/transaction-pairs-sql.ts`
  and are consumed across `lib/dal/dashboard.ts`, `lib/dal/overview.ts`, `lib/dal/transactions.ts`,
  `lib/dal/expenses.ts`, `lib/dal/tags.ts`. An inventory of call sites is a prerequisite, not an
  afterthought.
  → RMB-04

### Migration — subsuming `transaction_pair`

- **D-06:** Every existing `transaction_pair` row is migrated to a reimbursement: **anchor = the
  primary's Expense, refund = the secondary**. After migration `transaction_pair` is **no longer the
  live netting source** — the netting layer reads the new tables only.
  → RMB-05

- **D-07:** **Dashboard regression gate before any expansion.** Entrate / uscite / per-category totals
  must be **identical before and after** the migration, verified across every aggregation site. This
  gate is the phase's defining acceptance condition: no netting change ships without it green. Money
  comparisons use `Decimal.js` (`@/lib/utils/decimal`) — never native JS arithmetic.
  → RMB-05

### Rejected alternative (recorded, do not revisit)

- **Mondo Cash** — every transaction stays immutable in its own month, the dashboard never nets, and
  net/residual live only on the reimbursement-group page. Coherent, but it abandons the pairing
  premise and would make the refund appear as a normal inflow, contradicting "one mechanism". *[informational]*

### Claude's Discretion

The ADR explicitly leaves these to the discuss/plan phase — they are **details, not architecture**.
Resolve them during research/planning with the stated leaning; do not escalate unless the codebase
contradicts the leaning.

- **(Q2) Multi-month anchors** — whether an anchor is constrained to a single netting-month or
  attributed per-transaction. Leaning: **single-period** (the holiday case was confirmed
  "single-period" during the ADR discussion). Verify against how `effectiveAmount` currently resolves
  the month before locking.
- **(Q3) Per-transaction `effectiveAmount` attribution when an Expense anchor has multiple
  transactions** — verify the attribution still holds; this is a correctness check to perform, not a
  choice to make. If it does not hold, it is a blocker to surface, not to silently work around.
- Naming of the new tables/columns beyond the ADR-specified shape, index strategy, and the mechanics
  of the regression harness (fixtures vs. snapshot of live aggregates) are open.
- Whether `transaction_pair` is dropped in this phase or left as a dormant table post-migration — the
  only locked part is that it stops being the live netting source (D-06).

</decisions>

<specifics>
## Specific Ideas

- The motivating case is **the dinner split**: one outflow, N friends repaying. Today only one of the
  N reimbursements can be linked and the others are orphaned. Every design choice should be sanity-
  checked against that case, plus the Amazon order/refund (N=1, must keep working identically after
  migration) and the holiday (N outflows — Group anchor, Phase 74).
- A verified mechanical fact grounds the temporal decision: in `transaction-pairs-sql.ts` the
  secondary is **excluded** from every aggregation (`isNotSecondary()`) and the primary shows the
  algebraic net (`effectiveAmount()`) **in its own month**. Pairing is therefore *not* cash-basis —
  it deliberately shows the true net cost at cost-time. The 1:N model inherits exactly this.
- Risk is concentrated here: the ROADMAP calls for **regression-gating dashboard totals before any
  UI**. Treat the regression gate as the tracer, not as a final QA step.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Reimbursement model (locked)
- `docs/adr/0018-reimbursement-1n-linking-supersedes-net-by-subcategory.md` — **the locked model**:
  1:N linking, outflow anchor invariant, Mondo Netto, new schema shape, migration of `transaction_pair`
- `docs/adr/0016-shared-costs-net-by-subcategory-inflows-isolated-per-transaction.md` — §1 is
  **superseded** by ADR 0018; §2–§4 (Standalone Expense, in-place re-hash) remain valid and untouched
- `docs/adr/0004-nature-segments-algebraic-sum.md` — the original 1:1 pairing decision being generalized
- `docs/adr/0017-expense-group-over-physical-merge.md` — the Expense Group model the anchor XOR references

### Existing pairing implementation (the code being generalized)
- `lib/dal/transaction-pairs-sql.ts` — `effectiveAmount()` / `isNotSecondary()`, the exact functions to generalize
- `lib/dal/transaction-pairs.ts`, `lib/services/transaction-pairs.ts`, `lib/actions/transaction-pairs.ts`,
  `lib/validations/transaction-pairs.ts` — the full pairing stack
- `lib/dal/dashboard.ts`, `lib/dal/overview.ts`, `lib/dal/transactions.ts`, `lib/dal/expenses.ts`,
  `lib/dal/tags.ts` — aggregation sites the regression gate must cover

### Project rules
- `CLAUDE.md` — Decimal.js for money, `drizzle-kit generate` + `scripts/migrate.ts` (never
  `drizzle-kit push` in prod), `dal` / `services` / `actions` layering, additive seeds, English code
- `CONTEXT.md` (repo root) — canonical domain language (Transaction vs Expense, Reference Period, Deviation)
- `.planning/REQUIREMENTS.md` — RMB-01, RMB-03, RMB-04, RMB-05 wording

</canonical_refs>

<scope_fence>
## Scope Fence

**Explicitly NOT in this phase — do not plan, do not implement:**

| Item | Where it belongs |
|---|---|
| Expense Group anchor *behaviour* (netting over member transactions, group surfaces) | Phase 74 (RMB-02) — this phase lands the schema shape only (D-03) |
| Residual as a first-class value (`Σoutflow + Σrefunds`, "still owed €25") | Phase 74 (RMB-06) |
| Amount-edit guard generalized to 1:N | Phase 74 (RMB-09) |
| Create/manage a reimbursement from the Expense detail page or Expense Group; add/remove refunds; unlink/delete restores baseline | Phase 75 (RMB-07, RMB-08) |
| `/reimbursements` list and per-reimbursement page | Phase 76 (RMB-10, RMB-11) |
| Subscription temporal amortization (spreading one annual inflow across N monthly, often future, charges) | RMB-F1 — deferred milestone. Needs fan-out + fractional allocation, capabilities 1:N does not have (ADR 0018 §6) |
| Inflow-anchored reimbursements | Rejected by invariant D-02 |
| One inflow split across multiple anchors (fan-out) | Out of the 1:N fan-in model — belongs to RMB-F1 |
| Net-by-subcategory as the reimbursement mechanism | Superseded by ADR 0018 |
| Refund CSV export | RMB-F2 — deferred |

**This phase ships no new user-facing surface.** If a plan proposes a page, a form, or a button, it is
out of the fence.

</scope_fence>

<deferred>
## Deferred Ideas

- **RMB-F1 — subscription temporal amortization**: spread one inflow (e.g. an annual lump
  reimbursement) across the N covered months so each month shows the true net cost. Explicitly a later
  milestone (ADR 0018 §6); it is projection, not reconciliation.
- **RMB-F2 — refund CSV export** from a reimbursement page.
- **Subcategory attribution of a refund when the anchor spans multiple subcategories** (ADR 0018
  "left to discuss/plan" #1) — assigned to **Phase 74** by the ROADMAP, since it only arises with a
  Group anchor. Invisible on top-line entrate/uscite; matters only for the per-category breakdown.

</deferred>

## Success Criteria

Derived from ADR 0018 consequences and the ROADMAP phase criteria:

1. A single outflow anchor carries N linked inflow refunds in `reimbursement` + `reimbursement_refund`;
   the former 1:1 pair is the N=1 case.
2. Every existing `transaction_pair` row is migrated (anchor = the primary's Expense, refund = the
   secondary), and `transaction_pair` is no longer the live netting source.
3. Dashboard entrate / uscite / per-category totals are **identical before and after** the migration —
   the regression gate is green across every aggregation site.
4. A linked refund is excluded from its own month and its amount nets into the anchor's cost month
   everywhere `effectiveAmount` / `isNotSecondary` are applied.
5. Anchoring on an inflow, or linking an outflow as a refund, is rejected by the invariant.

## Risk Summary

- **Retroactive month mutation** (consequence of D-04): a closed past month can change when a late
  refund is linked. Accepted — it is already today's behaviour, not a new regression. Do not add
  guards against it in this phase.
- **Migration is the sharp edge**: the migration must be numerically inert. A silent drift in totals
  is worse than a hard failure — prefer a gate that fails loudly over one that tolerates rounding.
- **Missed aggregation sites**: `effectiveAmount` / `isNotSecondary` are consumed in more places than
  the pairing feature itself. An incomplete inventory produces totals that are right on the dashboard
  and wrong elsewhere (D-05).

---

*Phase: 73-reimbursement-schema-and-netting*
*Context generated from ADR 0018: 2026-07-23*
