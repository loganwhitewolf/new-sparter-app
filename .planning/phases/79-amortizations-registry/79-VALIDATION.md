---
phase: 79
slug: amortizations-registry
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-28
---

# Phase 79 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + PostgreSQL (real-Postgres regression gate) |
| **Config file** | `vitest.config.ts` + `.env.test` |
| **Quick run command** | `yarn test --run lib/dal/amortization.test.ts` |
| **Full suite command** | `yarn test --run` |
| **Estimated runtime** | ~{N} seconds |

---

## Sampling Rate

- **After every task commit:** Run `yarn test --run lib/dal/amortization.test.ts`
- **After every plan wave:** Run `yarn test --run`
- **Before `/gsd-verify-work`:** Full suite must be green (including `tests/reimbursement-regression.test.ts` — LENS-03)
- **Max feedback latency:** {N} seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | REQ-{XX} | T-{N}-01 / — | {expected secure behavior or "N/A"} | unit | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/dal/amortization.test.ts` — stubs for REG-01 (DAL list query Decimal precision, consumed/net/remaining computation, IDOR-safety, ordering)
- [ ] `tests/components/amortizations/amortization-table.test.tsx` — filter/sort/search, row rendering, close/realizza action wiring
- [ ] `tests/components/amortizations/amortization-summary-header.test.tsx` — open-only net-residual aggregation
- [ ] shared fixtures for amortization plans (open + closed)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| {behavior} | REQ-{XX} | {reason} | {steps} |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < {N}s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** {pending / approved YYYY-MM-DD}
