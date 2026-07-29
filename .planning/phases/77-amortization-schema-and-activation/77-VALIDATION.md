---
phase: 77
slug: amortization-schema-and-activation
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-28
validated: 2026-07-29
---

# Phase 77 — Validation Strategy

> Per-phase validation contract. Reconciled by /gsd-validate-phase 77 on 2026-07-29 (the
> plan-phase-seeded template stub was replaced with the real per-requirement coverage map).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.5 |
| **Config file** | vitest.config.ts (real-Postgres suites run against `sparter_test`) |
| **Quick run command** | `node_modules/.bin/vitest run <file>` |
| **Full suite command** | `node_modules/.bin/vitest run` |
| **Phase-77 scope runtime** | ~4.4s (56 tests across 5 files) |

*Binaries invoked directly from `node_modules/.bin` — RTK proxy rewrites `npx vitest`, so direct paths are used for reliable verification.*

---

## Sampling Rate

- **After every task commit:** Run `node_modules/.bin/vitest run <file>`
- **After every plan wave:** Run `node_modules/.bin/vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~4.4s (phase-scoped), ~13s (full suite)

---

## Per-Requirement Verification Map

| Requirement | Plans | Secure/Expected Behavior | Test Type | Test File | Automated Command | Status |
|-------------|-------|--------------------------|-----------|-----------|-------------------|--------|
| **AMORT-01** (activation) | 77-01, 77-02, 77-03 | Guard-gated atomic activation from row/detail/manual entry; all five eligibility guards short-circuit before any write | integration (real PG) | `tests/amortization-guards.test.ts` (7), `tests/amortization-manual-entry.test.ts` (3) | `node_modules/.bin/vitest run tests/amortization-guards.test.ts tests/amortization-manual-entry.test.ts` | ✅ green |
| **AMORT-02** (detach) | 77-01, 77-02 | Activation detaches into a synthetic-hash Standalone Expense; undo reverse-detaches to the shared per-merchant Expense (D-09) | integration (real PG) | `tests/amortization-guards.test.ts`, `tests/amortization-undo.test.ts` (7) | `node_modules/.bin/vitest run tests/amortization-undo.test.ts` | ✅ green |
| **AMORT-03** (instalment math) | 77-01 | Uniform instalments via Decimal.js; remainder folded onto first; per-instalment day-clamp (31/1 → 28/2); min-2-months + amount-in-cents cap | unit | `tests/amortization-math.test.ts` (15) | `node_modules/.bin/vitest run tests/amortization-math.test.ts` | ✅ green |
| **LENS-03** (cash byte-identical) | 77-01, 77-04, 77-05, 77-06 | All 10 aggregation functions read `ledger_entry_cash`; output byte-identical before/after amortization data exists | integration (real PG) | `tests/reimbursement-regression.test.ts` LENS-03 block (26) | `node_modules/.bin/vitest run tests/reimbursement-regression.test.ts` | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] Amortization instalment-math unit test file — remainder-on-first + day-clamp (AMORT-03) → `tests/amortization-math.test.ts`
- [x] `ledger_entry` cash-lens byte-identical regression extension of `tests/reimbursement-regression.test.ts` (LENS-03)
- [x] Eligibility-guard + activation-atomicity integration tests (AMORT-01/02) → `tests/amortization-guards.test.ts`, `tests/amortization-manual-entry.test.ts`, `tests/amortization-undo.test.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Activation dialog *preview render* matches the computed schedule before confirm | AMORT-01 | UI presentation only — the underlying `materializeInstalments` schedule computation IS automated (`amortization-math.test.ts`); only the visual rendering of it in the dialog is manual | Open a transaction row → Ammortizza → enter months → verify the previewed rows match ADR 0019 §3 (uniform amounts, remainder on first, day-clamped dates) |

*Note: live Playwright coverage of dashboard/transaction UI is blocked by a pre-existing `proxy.ts` staging-bypass redirect loop (commit cff3b7464, unrelated to this phase — see `.planning/phases/80-dashboard-accrual-lens/deferred-items.md`). Data-correctness is fully covered by the real-Postgres integration tests above.*

---

## Validation Sign-Off

- [x] All requirements have `<automated>` verify (the single manual-only entry is a redundant UI-render check of an already-automated behavior)
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
| Requirements audited | 4 (AMORT-01, AMORT-02, AMORT-03, LENS-03) |
| COVERED | 4 |
| PARTIAL | 0 |
| MISSING (gaps found) | 0 |
| Tests generated | 0 (full coverage already existed; template stub reconciled to real map) |
| Escalated | 0 |
| Phase-77 test count | 56 green (15 unit + 41 integration) |
