---
phase: 81
slug: inline-net-display-for-paired-transactions
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-29
validated: 2026-07-29
---

# Phase 81 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Reconstructed from artifacts (State B): no gaps found — every phase behavior is covered by a
> green test authored during execution, so no auditor pass was required.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 + Testing Library (jsdom render) + PostgreSQL (real-Postgres regression gate, harness db `sparter_test`) |
| **Config file** | `vitest.config.ts` + `.env.test` |
| **Quick run command** | `./node_modules/.bin/vitest run tests/transaction-table-paired-net-display.test.tsx` |
| **Phase regression command** | `./node_modules/.bin/vitest run tests/transaction-table-paired-net-display.test.tsx tests/reimbursement-regression.test.ts` |
| **Full suite command** | `yarn vitest run` |
| **Estimated runtime** | ~1s quick · ~30 tests phase regression · full suite ~161 files / 1957 tests |

---

## Sampling Rate

- **After every task commit:** Run `./node_modules/.bin/vitest run tests/transaction-table-paired-net-display.test.tsx` (~1s, jsdom render of the amount cell + badge)
- **After the plan wave:** Run the phase regression command (render test + `tests/reimbursement-regression.test.ts` LENS-03, 30 tests)
- **Before ship:** Full suite green (`tsc --noEmit` + `yarn check:language` + `yarn vitest run`)
- **Max feedback latency:** ~1 second (render test)

Rationale (Nyquist): this phase changes exactly three observable behaviors (anchor amount-cell
render, counterpart row indicator swap, and the invariant that netting/totals do not change). The
render test samples all three render behaviors directly (anchor split, unpaired unchanged,
counterpart swap, anchor-non-swap) and the LENS-03 byte-identical block samples the netting
invariant — sampling rate exceeds the behavior-change rate on every commit.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|----------|-----------|-------------------|-------------|--------|
| 81-01-01 | 01 | 1 | D-N2 (anchor net display) | — | Paired outflow anchor renders `pairedNetAmount` primary + gross `amount` struck-through/opaque; unpaired row emits no `line-through` (zero visual regression). Role via `resolvePairRole` (`pairedWithId` + sign of `amount`). | component/render | `./node_modules/.bin/vitest run tests/transaction-table-paired-net-display.test.tsx` | ✅ | ✅ green |
| 81-01-02 | 01 | 1 | D-N3 (counterpart badge) | — | Counterpart row swaps `ReimbursementRowIndicator` for `PairedReductionBadge` ("riduzione di …") linking to `transactionDetailHref(pairedWithId)`, amount attenuated; anchor row keeps `ReimbursementRowIndicator` (swap is exclusive, not additive). | component/render | `./node_modules/.bin/vitest run tests/transaction-table-paired-net-display.test.tsx` | ✅ | ✅ green |
| 81-01-02 | 01 | 1 | D-N4 (zero data-layer change) | — | `effectiveAmount()`/netting/totals unchanged — `git diff` on `lib/dal/transactions.ts` + `lib/dal/transaction-pairs-sql.ts` empty across phase commits; cash-lens figures byte-identical. | integration (regression) | `./node_modules/.bin/vitest run tests/reimbursement-regression.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase behaviors.* The render test file was authored during
execution (Plan 81-01, Task 1 created it, Task 2 extended it) and the netting-invariant regression
predates this phase; both are green:

- ✅ `tests/transaction-table-paired-net-display.test.tsx` — 4 jsdom render cases: anchor net+struck-gross (D-N2), unpaired unchanged (D-N2 zero-regression), counterpart badge swap+link (D-N3), anchor non-swap (D-N3 exclusivity).
- ✅ `tests/reimbursement-regression.test.ts` — LENS-03 byte-identical cash-lens block (D-N4 invariant), unchanged by this presentational phase.

## Manual-Only

- **Live-browser visual UAT** (non-blocking, tracked in `81-VERIFICATION.md`): eyeball the amount
  treatment on a real closed-for-sale amortization plan and a real reimbursed transaction. This is
  the human-verification item this closure phase was created to satisfy; it is inherently visual and
  not automatable at the render-test level.
