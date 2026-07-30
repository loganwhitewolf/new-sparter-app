---
id: 260730-m2x
title: Amortization refund-linking, re-amortize after delete, dashboard→transactions link
status: complete
date: 2026-07-30
subsystem: amortization, transactions, dashboard
tags: [amortization, reimbursement, transaction-table, dashboard, overview-movers]
dependency-graph:
  requires: [Phase 78 D-02/D-03 (realizePlanTx/reducePlanTx), v2.8 reimbursement mechanism, Phase 76 pairing fields]
  provides: [reducePlanTx refund linking, applyAmortizationRemovedUpdate helper, OverviewMoversPanel month link]
  affects: [lib/services/amortization-lifecycle.ts, components/transactions/transaction-table.tsx, components/dashboard/overview/overview-movers-panel.tsx]
tech-stack:
  added: []
  patterns: [createPairTx reuse for refund linking, pure row-update helper for optimistic client state, zero-padded months= link pattern]
key-files:
  created:
    - tests/transaction-table-amortization-removed-update.test.ts
  modified:
    - lib/services/amortization-lifecycle.ts
    - tests/amortization-lifecycle.test.ts
    - tests/reimbursement-regression.test.ts
    - components/transactions/transaction-table.tsx
    - components/dashboard/overview/overview-movers-panel.tsx
    - tests/overview-movers.test.tsx
decisions:
  - "reducePlanTx links the refund via createPairTx anchored on plan.transactionId, called right after newTotalAmount is computed — runs exactly once regardless of the futureInstalments.length===0 branch"
  - "applyAmortizationRemovedUpdate clears amortizationPlanId + reimbursementId + all four pairing fields on the target row, and the pairing fields (not amortizationPlanId) on the counterpart row found via pairedWithId"
  - "OverviewMoversPanel's new month link is a single panel-level link (not per-column), placed above the 4-column grid"
metrics:
  duration: ~35min
  completed: 2026-07-30
---

# Quick Task 260730-m2x: Amortization + dashboard fixes Summary

Three independent small fixes: `reducePlanTx` now links a partial refund to the amortized transaction exactly like `realizePlanTx` links a sale; "Rimuovi ammortamento" now fully resets a transaction row's client-side pairing/reimbursement state so it is immediately amortizable again without a hard reload; the dashboard's month-breakdown panel gained a link into the transactions list filtered for that month.

## Task 1: Link refund transactions like sale (Bug 1)

`reducePlanTx` (`lib/services/amortization-lifecycle.ts`) now calls `createPairTx(tx, { userId, anchor: { transactionId: plan.transactionId }, counterpartId: input.refundTransactionId })` right after computing `newTotalAmount`, before the `futureInstalments.length === 0` branch — so it runs exactly once regardless of which branch executes. This is the same call `realizePlanTx` already made for its sale transaction. The plan still ends `status: 'open'`. Updated the stale "D-03 instead mechanic — no v2.8 reimbursement link is ever created here" doc comments on both `reducePlanTx` and `realizePlanTx` (both claims are now false).

`tests/amortization-lifecycle.test.ts`'s "normal re-spread" test now asserts `reimbursements === 1` / `refunds === 1` (was `0`/`0`).

## Task 2: Fix stale client state after "Rimuovi ammortamento" (Bug 2)

Extracted `markAmortizationRemoved`'s row-update logic into an exported pure helper, `applyAmortizationRemovedUpdate(transactions, transactionId)`, in `components/transactions/transaction-table.tsx`. On the target row it clears `amortizationPlanId`, `reimbursementId`, `pairedWithId`, `pairedNetAmount`, `pairedDescription`, `pairedOccurredAt` — the same field list `handleUnpair`'s optimistic update already clears. On the counterpart row (found via `pairedWithId`, same lookup-then-map pattern as `handleUnpair`), it clears the pairing fields and `reimbursementId` but leaves that row's own `amortizationPlanId` untouched, since it is a separate transaction. `markAmortizationRemoved` now just calls this helper via `setLoadedTransactions`.

New test file `tests/transaction-table-amortization-removed-update.test.ts` — plain Vitest unit tests, no rendering — cover: target row clears both fields, counterpart row clears its pairing fields, and an unrelated third row is unaffected.

## Task 3: Dashboard month → filtered transactions link (Bug 3)

`OverviewMoversPanel` (`components/dashboard/overview/overview-movers-panel.tsx`) now renders a single panel-level link, "Vedi tutte le transazioni di {mese}", above the 4-column grid, pointing to `` /transactions?months=${year}-${String(selectedMonth + 1).padStart(2, '0')}`` — the same zero-padded format the per-category mover links already use, without `&category=`.

Added a test in `tests/overview-movers.test.tsx` asserting the rendered markup contains `href="/transactions?months=2026-03"` for `year={2026} selectedMonth={2}`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two pre-existing overview-movers tests broke because they asserted "no `<a>` anywhere in the whole panel"**
- **Found during:** Task 3, running `yarn vitest run tests/overview-movers.test.tsx`
- **Issue:** "renders the Accantonamenti column as plain non-clickable text" and "renders a defensive non-linked row when categorySlug is null" both asserted `expect(html).not.toContain('<a')` against the FULL rendered panel. The new panel-level month link always renders an `<a>`, so both assertions started failing even though the columns under test still correctly render no link of their own.
- **Fix:** Scoped both assertions to the specific column's HTML slice (`html.split('Accantonamenti')[1]` and the entrate-column slice between its own heading and the next one) instead of the whole document.
- **Files modified:** `tests/overview-movers.test.tsx`
- **Commit:** `963f213b`

**2. [Rule 1 - Bug] `tests/reimbursement-regression.test.ts`'s reducePlanTx cash-lens test asserted the old (now incorrect) "no v2.8 link is ever created" invariant**
- **Found during:** Task 1, running the full `yarn vitest run` suite
- **Issue:** A separate regression test (not in the plan's file list) directly encoded the pre-fix behavior: it asserted the tagged anchor transaction's all-time `getTagTotals` total stayed byte-identical after `reducePlanTx`. Since `getTagTotals` is all-time (not calendar-scoped) and now nets via `effectiveAmount()` against the newly-linked refund, the total legitimately changes from `-1200.00` to `-900.00` — the same behavior `realizePlanTx`'s sale-link already produces elsewhere in this same test file.
- **Fix:** Renamed the test to describe the new invariant, added a comment explaining why the two month-scoped aggregates (`getOverviewAmountTotals`, `getCategoriesBreakdown`) still stay byte-identical for THIS fixture's dates (the anchor's cost-month and the refund's month both fall outside the probed "last month" window), and updated the tag-total assertions to the new expected values (`-1200.00` before, `-900.00` after).
- **Files modified:** `tests/reimbursement-regression.test.ts`
- **Commit:** `93f3220a`

## Verification

- `yarn vitest run tests/amortization-lifecycle.test.ts` — 17/17 passed (real Postgres via `yarn db:up`; container was already provisioned, just needed `docker start sparter-postgres`).
- `yarn vitest run tests/transaction-table-amortization-removed-update.test.ts` — 3/3 passed.
- `yarn vitest run tests/overview-movers.test.tsx` — 33/33 passed.
- `yarn vitest run tests/reimbursement-regression.test.ts` — 26/26 passed (post-fix).
- Full suite (`yarn vitest run`): 2002 passed / 17 failed / 1 todo across 170 files. All 17 failures are `tests/import-suggestions-page.test.tsx`, `tests/patterns-amount-sign.test.ts`, and `lib/validations/__tests__/pattern.test.ts` failing on `Cannot find package 'safe-regex'` — a pre-existing missing `node_modules` dependency unrelated to this task (declared in `package.json`, absent from `node_modules`, predates this task by several commits per `git log -- lib/validations/pattern.ts`). Not fixed here — out of scope (Rule 3's package-install exclusion: reinstalling/verifying a third-party package is a checkpoint-gated action, not an inline auto-fix).
- `yarn check:language` — passed.
- `yarn eslint` on all touched files — 0 errors, 2 pre-existing warnings unrelated to this task's changes (`getAmountFormatter` unused, a `set-state-in-effect` warning in the pre-existing delete-transaction dialog).
- `yarn tsc --noEmit` — only pre-existing, unrelated errors (stale `.next/types` artifacts, the same missing `safe-regex` module).

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes; `createPairTx`'s existing self-pair/ownership/sign-invariant guards are reused unmodified.

## Self-Check: PASSED

- `lib/services/amortization-lifecycle.ts` — FOUND
- `components/transactions/transaction-table.tsx` — FOUND
- `components/dashboard/overview/overview-movers-panel.tsx` — FOUND
- `tests/transaction-table-amortization-removed-update.test.ts` — FOUND
- Commit `93f3220a` — FOUND in `git log --oneline`
- Commit `6c1b3eff` — FOUND in `git log --oneline`
- Commit `963f213b` — FOUND in `git log --oneline`
