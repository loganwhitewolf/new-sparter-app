---
phase: 62
slug: transaction-edit-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-05
---

# Phase 62 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `yarn vitest run tests/transaction-edit.test.ts tests/expense-edit.test.ts` |
| **Full suite command** | `yarn vitest run` |
| **Estimated runtime** | ~60 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `yarn vitest run tests/transaction-edit.test.ts tests/expense-edit.test.ts`
- **After every plan wave:** Run `yarn vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | DET-01 | TBD | ownership-gated; hashes/description immutable | unit | `yarn vitest run tests/transaction-edit.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | DET-02 | TBD | reconciliation atomic in same db.transaction | unit | `yarn vitest run tests/transaction-edit.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | DET-03 | TBD | pair-breaking edit rejected with Italian message | unit | `yarn vitest run tests/transaction-edit.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | DET-04 | TBD | derived expense fields never writable | unit | `yarn vitest run tests/expense-edit.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*(Task IDs filled by the planner; this map is the contract the plans must satisfy.)*

---

## Wave 0 Requirements

- [ ] `tests/transaction-edit.test.ts` — stubs for DET-01 (basic edit), DET-02 (reconciliation), DET-03 (pair guard)
- [ ] `tests/expense-edit.test.ts` — stubs for DET-04 (title/notes/category edit, status consistency)
- [ ] Fixtures: seedUser + seedTransaction + seedExpense helpers following existing test setup patterns
- [ ] Use real `db.transaction` in service tests (atomicity is the behavior under test — do not stub it)

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
