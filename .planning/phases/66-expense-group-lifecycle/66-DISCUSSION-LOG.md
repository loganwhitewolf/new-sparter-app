# Phase 66: expense-group-lifecycle - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-19
**Phase:** 66-expense-group-lifecycle
**Areas discussed:** Recategorize control placement, "Unisci" add-to-group flow, "Scomponi" placement & granularity, Dissolution & subcategory semantics

---

## GRP-05 — Recategorize control placement

| Option | Description | Selected |
|--------|-------------|----------|
| Detail page + table row | Editable subcategory on group detail page AND inline categorize on the collapsed group row in the expenses table (parity with individual expense rows) | ✓ |
| Detail page only | Recategorize only from the group detail page | |

**User's choice:** Detail page + table row
**Notes:** Rationale accepted: the expenses table is the primary post-import categorization surface, so the group row should offer the same categorize affordance as individual expense rows. One group-recategorize action underlies both entry points; writes each member's subcategory+status+Tier-2 history and the group column in one transaction.

---

## GRP-06 — "Unisci" add-to-group flow

| Option | Description | Selected |
|--------|-------------|----------|
| Expenses-table bulk bar | Selection = one group row + N ungrouped expenses → "Unisci" adds into that group; reuse MergeExpensesDialog; uncategorized get Phase-65 softening | ✓ |
| Group detail page action | An "Aggiungi spesa" picker on the detail page | |
| Both surfaces | Bulk-bar add AND detail-page add | |

**User's choice:** Expenses-table bulk bar
**Notes:** One mental model — same gesture as creating a group. Group-to-group merge (selecting two group rows) rejected; user did not object to the stated assumption.

---

## GRP-07 — "Scomponi" placement & granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Detail page: remove + dissolve | Per-member "Rimuovi dal gruppo" on each member row + a "Scomponi gruppo" dissolve button, both on the group detail page | ✓ |
| Detail page + table dissolve | Same detail-page controls plus a table bulk-bar "Scomponi" (dissolve whole group) | |

**User's choice:** Detail page: remove + dissolve
**Notes:** Auto-dissolve-at-one-member locked regardless of placement.

---

## GRP-07 / GRP-09 — Dissolution & subcategory semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Keep current (structural) | Dissolution only deletes group + membership rows; freed members keep their current (possibly recategorized) subcategory; nothing auto-reverted | ✓ |
| Revert to pre-merge subcat | Restore each member's pre-merge subcategory on dissolve (requires persisting per-member pre-merge state) | |

**User's choice:** Keep current (structural)
**Notes:** Matches ADR 0017 — reversibility is structural because grouping never rewrote members; recategorize is a separate, deliberate, persistent act. Fixes what the GRP-09 invariance test asserts: merge and dissolve are no-ops on transactions/categories; recategorize is the only category-moving step and its dashboard delta equals per-member recategorization.

## Claude's Discretion

- Dialog wording / whether to reuse MergeExpensesDialog directly or a thin variant for add-to-group.
- Whether group-recategorize is a new `categorizeExpenseGroup` action or a parameterized reuse (contract invariants fixed in CONTEXT D-02).
- Italian confirmation-dialog copy for dissolve/remove.

## Deferred Ideas

- Group-to-group merge — rejected for now.
- "Scomponi" from the expenses-table bulk bar — detail-page only this phase.
- Add-member picker on the group detail page — bulk bar only this phase.
- Import-time similarity hints (GRP-F01) — deferred forever per ADR 0017.
