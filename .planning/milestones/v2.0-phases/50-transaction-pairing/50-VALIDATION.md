---
phase: 50
slug: transaction-pairing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-13
---

# Phase 50 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `50-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `yarn test` (`vitest run`) |
| **Full suite command** | `yarn test` |
| **Estimated runtime** | ~30 seconds (~50 test files) |

---

## Sampling Rate

- **After every task commit:** Run `yarn test`
- **After every plan wave:** Run `yarn test`
- **Before `/gsd-verify-work`:** Full suite green + `yarn build` green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

> The planner fills concrete task IDs (`50-0X-0Y`) during planning. Rows below are the
> requirement→behavior targets every task must map onto (from RESEARCH.md).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | 0X | W | PAIR-01 | T-50-01 | `createPair` validates both transactions belong to session user before insert | unit | `yarn test tests/transaction-pairs-service.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 0X | W | PAIR-01 | — | `createPair` resolves primary by `|amount|` (tie-break by `occurredAt`) | unit | `yarn test tests/transaction-pairs-service.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 0X | W | PAIR-01 | T-50-02 | `createPair` rejects a transaction already in a pair (unique constraint + service guard) | unit | `yarn test tests/transaction-pairs-service.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 0X | W | PAIR-02 | — | `TransactionListRow` exposes `pairedWithId` + `pairedNetAmount` (signed Decimal net) | unit | `yarn test tests/transactions-dal.test.ts` | ✅ extend | ⬜ pending |
| TBD | 0X | W | PAIR-03 | — | Netting: paired secondary excluded; net attributed to primary's month + direction | unit | `yarn test tests/dashboard-dal.test.ts` | ✅ extend | ⬜ pending |
| TBD | 0X | W | PAIR-03 | — | `getOverviewAmountTotals` reflects net, not sum of both legs | unit | `yarn test tests/dashboard-dal.test.ts` | ✅ extend | ⬜ pending |
| TBD | 0X | W | PAIR-03 | — | After unlink, both transactions aggregate independently (baseline restored) | unit | `yarn test tests/transaction-pairs-service.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 0X | W | PAIR-03 | — | Unpaired transactions unaffected — ADR 0004 algebraic-sum baseline unchanged | regression | `yarn test tests/dashboard-dal.test.ts` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/transaction-pairs-service.test.ts` — `createPair` (ownership, primary resolution, double-link guard) + `deletePairByTransactionId` + unlink-restores-baseline (PAIR-01, PAIR-03)
- [ ] `tests/transaction-pairs-dal.test.ts` — eligible-counterpart picker filter logic (opposite sign, ±date range, exclude already-paired)
- [ ] Extend `tests/dashboard-dal.test.ts` — netting scenarios on `buildOverviewData` / `getOverviewAmountTotals` (PAIR-03)
- [ ] Extend `tests/transactions-dal.test.ts` — assert `pairedWithId` / `pairedNetAmount` in select shape (PAIR-02)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pair badge renders inline with link icon + signed net amount; popover shows counterpart details | PAIR-02 | Visual/interaction surface (no headless render harness configured) | In transactions list: pair two opposite transactions → confirm 🔗 badge + net on both rows; click badge → popover shows counterpart description/amount/date + "Vai alla transazione" |
| "Collega rimborso" / "Scollega" row actions toggle correctly by pair state | PAIR-01/PAIR-03 | DOM-driven dropdown state | Unpaired row shows "Collega rimborso"; paired row shows "Scollega"; counterpart picker excludes already-paired and same-sign transactions |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`vitest run`, not `vitest --watch`)
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
