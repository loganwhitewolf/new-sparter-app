# Phase 75: linking-surfaces-and-lifecycle - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-24
**Phase:** 75-linking-surfaces-and-lifecycle
**Areas discussed:** Surface shape + net/residual, Add-refund flow, Coherence with existing pairing UI, Unlink/delete + baseline, Netting-model contamination gap

---

## Entry point (vocabulary alignment)

The user challenged the framing "Expense detail page" — clarifying that the anchor is **the transaction
or the Expense Group**, not `/expenses/[id]`. Reconciled: RMB-08's "Expense detail page" is read as
"the spend = the transaction."

| Option | Description | Selected |
|--------|-------------|----------|
| Transaction detail + Expense Group | Entry from `/transactions/[id]` and the Group page | ✓ |
| Expense detail + Expense Group | Literal RMB-08; linking moves to `/expenses/[id]` | |
| All three | tx + expense + group | |

**User's choice:** Transaction detail + Expense Group.

---

## Surface shape + net/residual

| Option | Description | Selected |
|--------|-------------|----------|
| Evolve existing pairing block | The 1:1 block on tx detail becomes the 1:N panel | ✓ |
| New dedicated "Rimborso" card | Standalone richer card | |
| Dedicated dialog | Management hidden behind a button | |

**Group host:** reuse the same component (anchor = Group) — selected over a Group-specific block.
**Net/residual:** show net + residual + status inline — selected over "list only, numbers to Phase 76."

---

## Add-refund flow

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-select picker | Tick several eligible inflows, link in one action | ✓ |
| One at a time | Reuse current 1:1 mechanic, repeat | |

**Group candidate window:** ±90 days on the Group's occurrence interval — selected over single-date logic.
**Notes:** implies a create-or-append write path (current `createPair` always creates a new reimbursement).

---

## Coherence with existing pairing UI

| Option | Description | Selected |
|--------|-------------|----------|
| Table action stays 1:1 quick-action | Inline "collega" = create/append single refund | ✓ |
| Popover shows all refunds | Full 1:N popover | |
| Out of scope: unchanged | Don't touch table/popover | |

**User's choice:** table inline stays a 1:1 quick-action; full N:1 only on the two new surfaces.

---

## Unlink/delete + baseline

| Option | Description | Selected |
|--------|-------------|----------|
| Undo the recategorization too | Refund returns to pre-link category/title + own month | ✓ |
| Only netting reverts | Link removed, categorization stays | |
| Create stops recategorizing | Remove detach-cleanup from create | |

**Actions:** remove-per-refund + delete-reimbursement (confirm on delete) — selected over remove-only.
**Notes:** requires snapshotting the refund's pre-link state to restore it.

---

## Netting-model contamination gap (the key finding)

User raised: "pay a dinner, receive 3 refunds; return to the same restaurant alone — the new spend must
not inherit the previous refunds." Verified in code: Expenses upsert by `descriptionHash`
(`import.ts:561-651`), and `effectiveAmount()` spreads refunds across all anchor-Expense transactions —
so a future same-merchant purchase IS contaminated. Real latent gap, also affects migrated 1:1 pairs.

Second user concern (refund side): would the 3 inflows sweep future income from the same friends?
Verified: refunds are pinned by `reimbursement_refund.transaction_id`, so future same-friend income is a
different tx and is never swept — the refund side is **already safe**. The gap is anchor-only.

| Option | Description | Selected |
|--------|-------------|----------|
| Isolate anchor as Standalone (Opt 1) | Reuse v2.4; but mutates Expense, bidirectional unlink, zoppica on multi-tx non-Group | |
| Freeze anchored-transaction set (Opt 2) | Anchor transaction-granular via stored set; covers all 3 cases; trivial unlink; spread math intact | ✓ |
| Transaction-granular re-architecture (Opt 3) | Cleanest but reopens Phase 74 schema/spread/gates | |
| Accept as known limit | Ship UI on unsafe model | |

**Deliberation:** user was torn between Opt 1 and Opt 3 (feared Opt 3's blast radius). Advisor initially
recommended Opt 1, then — once the locked "unlink restores baseline" requirement was factored in (Opt 1
needs bidirectional standalone surgery) — revised to **Opt 2** as the balance of correctness (like Opt 3,
for all three cases) and contained risk. User confirmed Opt 2.

---

## Claude's Discretion

- Storage shape of the frozen anchored-transaction set (D-08) and the migrated-pair backfill.
- Storage/restore of the refund pre-link snapshot (D-10).
- Multi-select picker UX and create-or-append service contract.
- Italian surface copy and confirm-dialog wording.
- Group-anchor + refund-cleanup categorization for a multi-subcategory Group (needs research).

## Deferred Ideas

- Full 1:N popover generalization (table/popover stay 1:1).
- `/reimbursements` list + per-reimbursement page — Phase 76.
- RMB-F1 subscription temporal amortization; RMB-F2 refund CSV export.
