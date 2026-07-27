# Phase 74: group-anchor-and-reconciliation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-24
**Phase:** 74-group-anchor-and-reconciliation
**Areas discussed:** Group-anchor netting, Residual semantics, Amount-edit guard (RMB-09), Subcategory attribution (Q1)

---

## Group-anchor netting target

| Option | Description | Selected |
|--------|-------------|----------|
| Tx più vecchia del gruppo (single-period) | Generalize Q3 tie-break: the earliest member transaction absorbs the whole net; one month changes | |
| Spread tra i membri | Net is distributed across member transactions; multiple months can change; fractional allocation | ✓ |

**User's choice:** Spread tra i membri
**Notes:** Diverged from the Phase 73 single-period leaning. Chosen together with proportional
subcategory split — the two are one mechanism.

## Group-anchor netting — allocation weight (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Proporzionale all'importo | Each member absorbs a share proportional to its own amount; largest-remainder cent to the largest member | ✓ |
| Uguale tra i membri | Net split evenly, independent of amount | |
| Per data (cascata) | Net fills the oldest transaction first, overflow to the next | |

**User's choice:** Proporzionale all'importo

## Group-anchor netting — anchor coherence (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Un solo meccanismo (spread ovunque) | Multi-transaction Expense anchors also spread; N=1 migrated case identical → regression gate green | ✓ |
| Solo Group | Expense keeps Phase 73 earliest-tx behaviour; only Group spreads | |

**User's choice:** Un solo meccanismo (spread ovunque)

## Residual semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Ammesso, residuo positivo | residual computed on the fly; negative=owed, zero=settled, positive=surplus surfaced but not blocked; sign-only invariant, no magnitude guard | ✓ |
| Bloccato | Prevent Σrefund from exceeding the outflow; adds a magnitude guard | |

**User's choice:** Ammesso, residuo positivo

## Amount-edit guard (RMB-09)

| Option | Description | Selected |
|--------|-------------|----------|
| Blocco, msg migliorato | Keep hard-block "Scollega prima il rimborso"; improve the N>1 message to name the blocking reimbursement; no auto-adjust | ✓ |
| Riconciliazione | Accept the edit and auto-reconcile the net | |

**User's choice:** Blocco, msg migliorato

## Subcategory attribution (Q1)

| Option | Description | Selected |
|--------|-------------|----------|
| Segue la tx di netting | Net attributes to the subcategory of the single netting transaction | |
| Split proporzionale | Net split across the group's subcategories proportionally | ✓ |

**User's choice:** Split proporzionale
**Notes:** Falls out of the proportional spread (D-01) automatically — each member's proportional
share lands in its own subcategory. No separate allocation mechanism.

---

## Claude's Discretion

- Exact SQL shape of the proportional `effectiveAmount()` expression and group-membership resolution path.
- Whether largest-remainder cent assignment is computed in SQL or a DAL helper.
- Where the `residual` computation lives and its exact return shape (Decimal-safe).
- Exact wording of the improved N>1 guard message.
- Index/query strategy for the new group-netting subqueries.

## Deferred Ideas

- RMB-F1 (subscription temporal amortization) — later milestone; distinct from this phase's spatial spread.
- RMB-F2 (refund CSV export).
- Linking/management surfaces → Phase 75; `/reimbursements` section → Phase 76.
