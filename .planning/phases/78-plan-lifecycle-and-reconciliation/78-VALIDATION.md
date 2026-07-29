---
phase: 78
slug: plan-lifecycle-and-reconciliation
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-28
validated: 2026-07-29
---

# Phase 78 — Validation Strategy

> Per-phase validation contract. Reconciled by /gsd-validate-phase 78 on 2026-07-29 (the
> plan-phase-seeded template stub was replaced with the real per-requirement coverage map).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.5 |
| **Config file** | vitest.config.ts (real-Postgres suites run against `sparter_test`) |
| **Quick run command** | `node_modules/.bin/vitest run <file>` |
| **Full suite command** | `node_modules/.bin/vitest run` |
| **Phase-78 scope runtime** | ~2.5s (38 tests across 2 files, + LENS-03 regression) |

*Binaries invoked directly from `node_modules/.bin` — RTK proxy rewrites `npx vitest`, so direct paths are used for reliable verification.*

---

## Sampling Rate

- **After every task commit:** Run `node_modules/.bin/vitest run <file>`
- **After every plan wave:** Run `node_modules/.bin/vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~2.5s (phase-scoped), ~13s (full suite)

---

## Per-Requirement Verification Map

| Requirement | Plans | Secure/Expected Behavior | Test Type | Test File | Automated Command | Status |
|-------------|-------|--------------------------|-----------|-----------|-------------------|--------|
| **AMORT-04** (close & collapse) | 78-01 | Closing collapses remaining instalments onto the closure month; past instalments untouched; empty-future edge writes no phantom zero row | integration (real PG) | `tests/amortization-lifecycle.test.ts` | `node_modules/.bin/vitest run tests/amortization-lifecycle.test.ts` | ✅ green |
| **AMORT-05** (realize via sale) | 78-02 | Sale nets against closure month (sign preserved, over-recovery flips positive); real ownership-scoped row (no synthetic tx); scrap = plain close | integration (real PG) | `tests/amortization-lifecycle.test.ts`, `tests/reimbursement-regression.test.ts` (dual-lens LENS-03) | `node_modules/.bin/vitest run tests/amortization-lifecycle.test.ts tests/reimbursement-regression.test.ts` | ✅ green |
| **AMORT-06** (reimburse & re-spread) | 78-02 | Refund reduces base + re-spreads future instalments; over-residual BLOCK before any write; exact-equal boundary allowed; plan stays open | integration (real PG) | `tests/amortization-lifecycle.test.ts` | `node_modules/.bin/vitest run tests/amortization-lifecycle.test.ts` | ✅ green |
| **AMORT-07** (edit guard) | 78-03 | Amount OR date edit on an OPEN-plan transaction blocked before any write with the exact Italian message; subcategory/title edits unaffected | unit | `tests/transaction-edit.test.ts` (AMORT-07 describe block, lines 449–496) | `node_modules/.bin/vitest run tests/transaction-edit.test.ts` | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] Plan-lifecycle integration tests — close/collapse, realize-via-sale, reimburse-respread (AMORT-04/05/06) → `tests/amortization-lifecycle.test.ts` (17)
- [x] Amount/date edit-guard tests incl. date-only edit (AMORT-07) → `tests/transaction-edit.test.ts` AMORT-07 block
- [x] Dual-lens LENS-03 close/realize regression extension of `tests/reimbursement-regression.test.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| D-03 intent prompt: choosing "chiudi per vendita" vs "rimborso parziale" on an open plan, then observing the two downstream flows | AMORT-05 / AMORT-06 | UI branch selection — the two downstream services (`realizePlanTx`, `reducePlanTx`) are fully automated; only the dialog choice + navigation is manual | On a transaction with an open plan: open the amortization dialog → pick "chiudi per vendita" (link sale) and "rimborso parziale" (re-spread) in turn → confirm each downstream flow behaves per Phase 78 CONTEXT D-02/D-03 |

*Note: the dialog/menu wiring is source-verified and unit-tested (`tests/transaction-table-menu.test.tsx`, `tests/transaction-detail-page.test.tsx`); live Playwright click-through is blocked by the pre-existing `proxy.ts` staging-bypass redirect loop (see `.planning/phases/80-dashboard-accrual-lens/deferred-items.md`). Data-correctness is fully covered by the real-Postgres integration tests above.*

---

## Validation Sign-Off

- [x] All requirements have `<automated>` verify (the single manual-only entry is a UI branch-selection check of two already-automated services)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none remained MISSING — all COVERED)
- [x] No watch-mode flags
- [x] Feedback latency < 5s (phase-scoped)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-07-29 — Nyquist-compliant.

---

## Validation Audit 2026-07-29

| Metric | Count |
|--------|-------|
| Requirements audited | 4 (AMORT-04, AMORT-05, AMORT-06, AMORT-07) |
| COVERED | 4 |
| PARTIAL | 0 |
| MISSING (gaps found) | 0 |
| Tests generated | 0 (full coverage already existed; template stub reconciled to real map) |
| Escalated | 0 |
| Phase-78 test count | 38 green (21 unit edit-guard + 17 integration lifecycle) + dual-lens LENS-03 regression |
