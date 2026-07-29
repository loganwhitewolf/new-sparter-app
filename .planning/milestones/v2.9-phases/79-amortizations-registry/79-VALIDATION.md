---
phase: 79
slug: amortizations-registry
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-28
validated: 2026-07-29
---

# Phase 79 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 + PostgreSQL (real-Postgres regression gate, harness db `sparter_test`) |
| **Config file** | `vitest.config.ts` + `.env.test` |
| **Quick run command** | `./node_modules/.bin/vitest run tests/amortization-registry-table.test.ts` |
| **Registry regression command** | `./node_modules/.bin/vitest run tests/amortization-registry-dal.test.ts tests/amortization-registry-table.test.ts` |
| **Full suite command** | `yarn test --run` |
| **Estimated runtime** | ~1s quick · ~2s registry regression · full suite ~156 files / 1915 tests |

---

## Sampling Rate

- **After every task commit:** Run `./node_modules/.bin/vitest run tests/amortization-registry-table.test.ts` (~1s, jsdom-free pure functions)
- **After every plan wave:** Run both registry test files (`amortization-registry-dal` + `amortization-registry-table`, ~2s)
- **Before `/gsd-verify-work`:** Full suite must be green (including `tests/reimbursement-regression.test.ts` — LENS-03, 26 tests)
- **Max feedback latency:** ~2 seconds (registry regression)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 79-01-01 | 01 | 1 | REG-01, REG-03 | — | `getAmortizationPlanList` IDOR-safe (only `WHERE p.user_id = ${userId}` outer predicate); no cross-user rows returned | integration | `./node_modules/.bin/vitest run tests/amortization-registry-dal.test.ts` | ✅ | ✅ green |
| 79-01-02 | 01 | 1 | REG-01 | — | `computeTotalOpenResidual` Decimal.js sum excludes closed plans | unit | `./node_modules/.bin/vitest run tests/amortization-registry-table.test.ts` | ✅ | ✅ green |
| 79-02-01 | 02 | 2 | REG-02 | — | `resolveRowActions` gates Chiudi/Realizza to open plans only (`showActions: status === 'open'`) | unit | `./node_modules/.bin/vitest run tests/amortization-registry-table.test.ts` | ✅ | ✅ green |
| 79-02-02 | 02 | 2 | REG-02 | — | Registry read path (`getAmortizationPlanList`) and `closePlanTx` write path never numerically diverge (status/remainingMonths/consumed/net reconcile) | integration | `./node_modules/.bin/vitest run tests/amortization-registry-dal.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* Both test files were authored during execution (Plan 79-01 created them, Plan 79-02 extended them) and are green:

- ✅ `tests/amortization-registry-dal.test.ts` — 7 real-Postgres cases: REG-01 list/Decimal-precision/IDOR/ordering + REG-02 read↔`closePlanTx` write consistency
- ✅ `tests/amortization-registry-table.test.ts` — 14 jsdom-free pure-function cases: `sortAmortizationRows`, `resolveEffectiveStatusFilter` (open-only default override), `computeTotalOpenResidual`, `resolveRowActions` (REG-02 action gating)

---

## Manual-Only Verifications

These are held-out visual / client-round-trip UI-state checks flagged `backstop` in both plans' `must_haves`. The underlying data correctness (Decimal values, action gating, read/write consistency) is fully automated above; only the rendered presentation is manual. This does **not** reduce Nyquist compliance — every requirement has automated verification of its behavior.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Progress-bar fill, open/closed badge color, description truncation, toolbar reflow, EmptyState variants | REG-03 | Visual rendering not exercised by automated test (no jsdom in this repo) | Load `/amortizations` with mixed open/closed plans; verify X/N progress bar fills proportionally, badge colors, and empty-state degradation |
| Dialog → `closePlanAction` → `router.refresh()` click-to-refresh round-trip | REG-02 | Client-side UI flow not exercised (no jsdom); DAL-level consistency proof covers numerical correctness | Click "Chiudi" on an open row → confirm dialog → verify row status/remainingMonths/netValue update without full page reload |
| Pending/disabled button state during close action, action-group presentation at narrow/mobile widths | REG-02 | Interaction-state visuals not exercised by automated test | Trigger close on mobile viewport; verify button disabled state and action-group layout |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — all requirements covered by execution-authored tests)
- [x] No watch-mode flags
- [x] Feedback latency < 2s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-29

---

## Validation Audit 2026-07-29

| Metric | Count |
|--------|-------|
| Requirements audited | 3 (REG-01, REG-02, REG-03) |
| COVERED | 3 |
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Tests verified green | 21 (7 integration + 14 unit) |

All three phase requirements have automated verification. No gaps required the nyquist auditor. Manual-only items are visual/UI-state backstops, not primary behavior verification.
