---
phase: 75-linking-surfaces-and-lifecycle
plan: 04
subsystem: frontend
tags: [react, nextjs, reimbursement, ui, dal, server-actions, vitest]

# Dependency graph
requires:
  - phase: 75-02
    provides: "createPairTx / createPair (create-or-append, dual anchor) + getEligibleCounterparts — the write + candidate paths the picker calls"
  - phase: 75-03
    provides: "removeRefundAction / deleteReimbursementAction + snapshot-restore — the unlink/delete lifecycle the panel drives"
provides:
  - "ReimbursementPanel — outflow-anchor management panel (create, running-total multi-add, net/residual/status, remove refund, delete reimbursement)"
  - "RefundMembershipCard — read-only state for an inflow that is itself a linked refund (Rimborso di «…» + Scollega); an inflow can never be an anchor (ADR 0018)"
  - "RefundPickerDialog — multi-select refund picker with live running total"
  - "getReimbursementPanelData / getRefundMembership DAL — direction-aware read models, IDOR-safe"
  - "createMultiRefundAction — link N refunds to an anchor in one action"
  - "Transaction detail host (/transactions/[id]) wired end to end"
affects: [76-reimbursements-section]

status: complete
---

# 75-04 — Reimbursement linking UI (SUMMARY)

Surfaces RMB-07 (create/manage/unlink-restore) to the user on the **transaction detail page**,
backed by the 75-02/75-03 backend. Shipped through a manual E2E checkpoint (user-approved) plus a
round of UAT-driven gap-closure.

## What shipped

- **DAL** (`lib/dal/reimbursement.ts`): `getReimbursementPanelData` (anchor read model — refunds,
  residual, state) and `getRefundMembership` (is-this-inflow-a-linked-refund + parent anchor).
- **Components** (`components/transactions/`): `ReimbursementPanel`, `RefundMembershipCard`,
  `RefundPickerDialog`, `reimbursement-row-indicator.tsx`.
- **Action**: `createMultiRefundAction` (+ `removeRefundAction`/`deleteReimbursementAction` reused).
- **Host**: `/transactions/[id]` renders the panel for an outflow, the read-only refund card for a
  linked-refund inflow, and nothing for a plain inflow (direction-gated via `toDecimal().isPositive()`).

## Key decisions (LOCKED this session)

- **Ship only the single-Expense anchor; defer the trip/vacation case.** The Expense-Group anchor
  UI was **removed** from the Group detail page (user decision): a Group unifies the *same* expense
  across platforms, so it cannot bundle different expenses (hotel + restaurants + …) for one
  reimbursement. The natural future primitive is a **tag-anchored** reimbursement. The Group-anchor
  **backend stays dormant** (create-or-append `{groupId}` path + DAL branch kept, no UI entry point)
  — see `deferred-items.md`. Consequence: Success Criterion #1's "from an Expense Group" clause is
  intentionally out of scope; RMB-08's Group-host is deferred (transaction-host linking is shipped).
- **Inflow ≠ anchor.** A linked-refund inflow shows a read-only "Rimborso di «…»" + Scollega, never
  the "Aggiungi rimborso" CTA (closed a raw-error bug from mounting the anchor panel on every tx).
- **Table indicator.** The stale 1:1 `TransactionPairPopover` (dead link) → an icon-only
  `ReimbursementRowIndicator` next to the tags chip (no popover; details live on the detail page),
  gated on `pairedNetAmount != null`.
- **Detail-page polish** (UAT): removed the duplicated, ellipsis-clipped header title/amount
  (shell header now optional — title/total live un-truncated in the Dati card, title wraps via
  `TransactionTitleEdit variant="detail"`); "Descrizione bancaria" → "Descrizione originale",
  shown whenever the displayed title differs from the raw description (custom title OR group/expense
  fallback, table + detail consistent); "Collegamenti" links to the **group** when the tx's expense
  is grouped (reverses GRP-08 / 65-06).
- **Test harness isolated** to a dedicated auto-created `sparter_test` DB with hard guards
  (localhost-only, `_test`-suffix, ignores app `DATABASE_URL`, no NODE_ENV=production) — commit
  `80ddb30`; the reimbursement real-Postgres suite no longer truncates the dev DB.

## Verification

- Full suite green: **146 files / 1815 tests** (1 todo), incl. the reimbursement real-Postgres suite
  against `sparter_test`. `tsc --noEmit` clean; `yarn check:language` clean.
- Manual E2E: user-approved (create → multi-add with running total → remove one → delete →
  inflow-refund read state → group host shows no reimbursement UI → detail-page polish).

## Requirements

- **RMB-07** — met (create/manage/unlink with baseline restore, transaction-detail host).
- **RMB-08** — user-facing linking shipped on the transaction detail host; the Expense-Group host is
  **deferred** by product decision (see above), not a gap.
