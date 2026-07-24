---
phase: 75
slug: linking-surfaces-and-lifecycle
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-24
---

# Phase 75 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + real-Postgres fixture (Docker) |
| **Config file** | `vitest.config.ts` (exists; Phase 73 reimbursement harness operational) |
| **Quick run command** | `yarn test:unit -- tests/reimbursement-phase-75.test.ts` |
| **Full suite command** | `yarn test:unit -- tests/reimbursement-*.test.ts` |
| **Estimated runtime** | ~30–60 seconds (single file quick-run ~10s) |

---

## Sampling Rate

- **After every task commit:** Run `yarn test:unit -- tests/reimbursement-phase-75.test.ts`
- **After every plan wave:** Run `yarn test:unit -- tests/reimbursement-*.test.ts`
- **Before `/gsd-verify-work`:** Full reimbursement suite must be green + manual E2E (create multi-refund on transaction detail, unlink, verify baseline restore)
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

> Task IDs are TBD until PLAN.md files exist; seeded from RESEARCH §Validation Architecture. validate-phase fills concrete task IDs.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 1 | D-08 | — | Frozen-set CTE equals pre-frozen results at N=1 (inertness) | unit | `yarn test:unit -- tests/reimbursement-regression.test.ts -t "frozen-set inertness"` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | D-08 | — | Later same-merchant import does NOT inherit refund's share | unit | `yarn test:unit -- tests/reimbursement-phase-75.test.ts -t "contamination guard"` | ❌ W0 | ⬜ pending |
| TBD | 02 | 2 | RMB-07 | — | Second refund appends to same reimbursement (no 23505) | unit | `yarn test:unit -- tests/reimbursement-phase-75.test.ts -t "dinner 1:N append"` | ❌ W0 | ⬜ pending |
| TBD | 02 | 2 | RMB-08 | — | Reimbursement-management component mounts on tx detail + Group detail | manual | Manual: `/transactions/[id]` and Group detail render | ❌ W0 | ⬜ pending |
| TBD | 03 | 3 | RMB-07 | — | Unlink refund reverts pre-link expense state (title, subCategoryId) | unit | `yarn test:unit -- tests/reimbursement-phase-75.test.ts -t "unlink reverts state"` | ❌ W0 | ⬜ pending |
| TBD | 03 | 3 | RMB-07 | — | Unlink last refund deletes now-empty reimbursement | unit | `yarn test:unit -- tests/reimbursement-phase-75.test.ts -t "unlink final"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/reimbursement-phase-75.test.ts` — new suite: frozen-set inertness @ N=1, contamination guard, dinner 1:N create-or-append, vacation M:N Group anchor, unlink → baseline restore
- [ ] `tests/fixtures/reimbursement-seed.ts` — extend with `seedMultiRefundReimbursement` and `seedReimbursementOnGroupWithRefunds`
- [ ] `tests/helpers/reimbursement-test-db.ts` — queries to load `reimbursement_anchor_transaction` (frozen-set) and `reimbursement_refund_snapshot` (snapshot) rows

*Existing infrastructure (`vitest.config.ts`, Docker Postgres fixture, `reimbursement-regression.test.ts`) covers the framework; new scenarios above are the Wave 0 gaps.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reimbursement-management panel renders inline on `/transactions/[id]` (1:N panel evolves 1:1 block) | RMB-08 | RSC page render + interaction, not unit-testable | Open an outflow tx detail; confirm the pairing block shows the 1:N panel with net/residual/status + add/remove |
| Group anchor hosts the same reused panel | RMB-08 | Page render on Group detail | Open an Expense Group detail; confirm the same management panel mounts (anchor = Group) |
| Multi-select picker links several refunds in one action | RMB-07 | Interactive picker with running total | Open the picker on an anchor; tick ≥2 eligible inflows; confirm running total + single link action |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
