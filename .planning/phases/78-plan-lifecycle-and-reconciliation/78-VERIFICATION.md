---
phase: 78-plan-lifecycle-and-reconciliation
verified: 2026-07-28T19:05:00Z
status: passed
score: 4/4 requirements verified (source-level, goal-backward)
behavior_unverified: 1
overrides_applied: 0
re_verification: false
---

# Phase 78: Plan Lifecycle & Reconciliation Verification Report

**Phase Goal:** A plan's remaining value can be resolved — closed outright, realized by a sale, or partially recovered by a reimbursement — without ever letting the source transaction silently drift out of sync with its plan.

**Verified:** 2026-07-28T19:05:00Z
**Status:** PASSED
**Score:** 4/4 requirements verified

> **Verification method note.** The `gsd-verifier` subagent was interrupted twice by session
> limits before it could emit VERIFICATION.md. This report was produced by an inline goal-backward
> analysis reading the **actual source files** (not SUMMARY claims) — the same evidence-gathering the
> verifier performs. Every must_have below cites a concrete file:line + observed code fact.

## Goal Achievement

The phase goal decomposes into four resolvable end-states for a plan's remaining value, each with a
"never desynchronize" invariant. All four are delivered and source-verified.

### AMORT-04 — Close & collapse (D-01) ✓
- `lib/services/amortization-lifecycle.ts:205` `closePlanTx` → `collapseAndCloseTx` with `extraAmount=0`.
- Past instalments never touched: the delete is gated `gte(amortizationInstalment.occurredAt, closureMonthStart)` (`:165-172`) — only future rows removed.
- Remaining value collapsed onto ONE closure-month instalment reusing the earliest cancelled `instalmentNumber` (`:176-189`), amount = Decimal `remainingSum` (`:159-162`).
- Empty-future edge (all instalments already past): plan closed, **no phantom zero-amount row** written (`:146-157`).

### AMORT-05 — Realize via sale (D-02) ✓
- `lib/services/amortization-lifecycle.ts:242` `realizePlanTx`: closure month = sale's own `occurredAt` (D-02a, `:264`); closure instalment amount = `remainingSum.plus(sale signed amount)` via `extraAmount` (`:265`, `:163`).
- **Sale sign preserved** (`toDecimal(sale.amount)`, not negated) → over-recovery flips the closure instalment positive (income); never blocked, never clamped.
- **No synthetic transaction:** the sale is a real, ownership-scoped row (`:250-259`, foreign/missing → `TRANSACTION_NOT_FOUND`); no direct insert into `transaction`.
- Scrapped asset = `closePlanTx` (no sale link) — same collapse, no `createPairTx`.

### AMORT-06 — Reimburse & re-spread (D-03) ✓
- `lib/services/amortization-lifecycle.ts:305` `reducePlanTx`: residual = Decimal-abs sum of future instalments from start-of-current-month (`:330-339`).
- **Over-residual BLOCK before any write:** `refundMagnitude.gt(residual)` → `OVER_RESIDUAL` with redirect to "chiudi per vendita" (`:343-348`).
- **Exact-equal boundary ALLOWED:** `gt` (strict) permits `refund == residual`; the empty-future branch materialises 0.00 (`:352-361`).
- Plan **stays open**; no v2.8 reimbursement link created on this path (the D-03 "instead" mechanic) — `createPairTx` appears only in `realizePlanTx`.
- Refund amount read **server-side** from the owned row (`:319-328`), never client-trusted.

### AMORT-07 — Edit invariant (D-04) ✓
- `lib/services/transaction-edit.ts:122-127`: blocks when `(input.amount !== undefined || input.occurredAt !== undefined) && row.amortizationPlanId != null`.
- `amortizationPlanId` is a correlated subquery filtered `ap.status = 'open'` (`:98-100`).
- Runs **before** the pre-existing amount-only pair-guard, so it also covers **date-only** edits (a gap the old guard missed).
- Subcategory/title edits unaffected (they never set `amount`/`occurredAt`).
- Exact Italian message: `"Rimuovi ammortamento per modificare l'importo o la data della transazione."`

## Critical Correctness — Double-Netting Trap (ADR 0019 §10)

**Verified structurally safe.** `grep -E 'effectiveAmount|isNotSecondary' lib/services/amortization-lifecycle.ts` → **0 hits**: the accrual write path never live-nets. The two lenses net the sale through **independent, single paths**:
- **Accrual lens:** the direct closure-instalment amount write only (`collapseAndCloseTx` `extraAmount`).
- **Cash lens:** `createPairTx` against the plan's ORIGINAL transaction only (`:273-277`), unmodified v2.8 Mondo Netto at cost-time.

No path nets the same sale twice within one lens.

## LENS-03 Invariant (cash lens byte-identical)

Full real-Postgres suite green at the final commit: **154 files, 1894 passed** (incl. `tests/reimbursement-regression.test.ts` with the new close/collapse + realize LENS-03 blocks). `tsc --noEmit` clean; `yarn check:language` clean.

## Requirement Traceability

| Req | Plan | Status |
|-----|------|--------|
| AMORT-04 | 78-01 | ✅ Complete |
| AMORT-05 | 78-02 | ✅ Complete |
| AMORT-06 | 78-02 | ✅ Complete |
| AMORT-07 | 78-03 | ✅ Complete |

All IDs marked Complete in `.planning/REQUIREMENTS.md`.

## Human Verification Needed (non-blocking UAT)

1. **Browser click-through of the D-03 intent prompt.** `AmortizationReimburseDialog` is wired into
   `components/transactions/transaction-detail-client.tsx:543` behind the `hasOpenAmortizationPlan`
   branch (`:508`), and `close-amortization-dialog.tsx` is wired into both the transaction row menu
   (`transaction-table.tsx`) and the detail page. The **wiring is source-verified**; only the live
   browser interaction (choosing "chiudi per vendita" vs "rimborso parziale" and observing the two
   downstream flows) was not driven this session. Recommended manual pass before shipping the milestone.

## Verdict

**PASSED** — all four requirements delivered and source-verified end-to-end; the phase's core
correctness risk (double-netting) is structurally eliminated and proven by the byte-identical
regression gate. One non-blocking browser UAT item is flagged above.
