---
phase: 77
slug: amortization-schema-and-activation
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-28
---

# Phase 77 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts (real-Postgres suites run against `sparter_test`) |
| **Quick run command** | `node_modules/.bin/vitest run <file>` |
| **Full suite command** | `node_modules/.bin/vitest run` |
| **Estimated runtime** | ~TBD seconds |

---

## Sampling Rate

- **After every task commit:** Run `node_modules/.bin/vitest run <file>`
- **After every plan wave:** Run `node_modules/.bin/vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** TBD seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | AMORT-{XX} | T-77-01 / — | {expected secure behavior or "N/A"} | unit | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Amortization instalment-math unit test file — remainder-on-first + day-clamp (AMORT-03)
- [ ] `ledger_entry` cash-lens byte-identical regression extension of `tests/reimbursement-regression.test.ts` (LENS-03)
- [ ] Eligibility-guard + activation-atomicity integration tests (AMORT-01/02)

*Planner refines against the RESEARCH.md `## Validation Architecture` section.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Activation dialog preview renders computed schedule before confirm | AMORT-01 | UI interaction | Open a transaction row → Ammortizza → enter months → verify preview matches ADR 0019 §3 |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < TBDs
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
