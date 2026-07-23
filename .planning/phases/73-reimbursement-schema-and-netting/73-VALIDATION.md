---
phase: 73
slug: reimbursement-schema-and-netting
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-23
---

# Phase 73 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.5 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `./node_modules/.bin/vitest run` (same as full — the suite is fast enough that scoping is pointless) |
| **Full suite command** | `./node_modules/.bin/vitest run` |
| **Estimated runtime** | ~6 seconds (measured 2026-07-23: 139 files, 1727 tests, 5.58s) |

**Command form is deliberate.** Use the direct binary in `node_modules/.bin/`, not `npx vitest` and
not `yarn test` — per project memory, `npx` invocations are intercepted by a token-optimizing proxy
and return unreliable output. A netting regression that "passes" because the runner was proxied is
the worst possible failure here.

---

## Sampling Rate

The full suite costs ~6 seconds. There is no reason to sample below it.

- **After every task commit:** `./node_modules/.bin/vitest run` (full suite)
- **After every plan wave:** `./node_modules/.bin/vitest run` + the regression harness explicitly
- **Before `/gsd-verify-work`:** full suite green AND regression harness green across the full gate
  surface (see below)
- **Max feedback latency:** ~6 seconds

**Baseline to protect:** 139 files / 1727 tests / 1 todo, all green as of 2026-07-23. Any task that
reduces the passing count without an explicit, planned deletion is a regression.

---

## Gate Surface (D-07)

Per the orchestrator-verified inventory correction in `73-RESEARCH.md`, further verified directly
against source on 2026-07-23 during plan revision (see `73-01-PLAN.md` Task 3), the regression gate
is **not** satisfied by diffing dashboard totals alone, and the underlying function inventory is
**10 aggregation functions**, not the 8 `73-RESEARCH.md` originally named (it missed
`getMonthlyTrendByNature` entirely, only vaguely described `overview.ts`'s two functions, and
misnamed `getTagTotals` as `getTotalByTag`, which does not exist). All six surfaces below must be
compared before/after migration (surfaces 1-4 cover the 10 functions collectively):

| # | Surface | Where (verified function names) | Why it is in the gate |
|---|---------|----------------------------------|-----------------------|
| 1 | Dashboard entrate / uscite (top-line KPIs) | `lib/dal/dashboard.ts::getOverviewAmountTotals` | Primary success criterion |
| 2 | Per-category breakdown, ranking, deviations, detail, monthly-by-nature trend | `lib/dal/dashboard.ts::getCategoriesBreakdown`, `getCategoryRanking`, `getCategoryDeviations`, `getCategoryDetail`, `getMonthlyTrendByNature` | Netting can be right in total and wrong per category/month; `getMonthlyTrendByNature` was missing from the original inventory entirely |
| 3 | Overview month-over-month & yearly chart | `lib/dal/overview.ts::getMonthOverMonthCategoryChanges`, `getOverviewChart` | Separate aggregation path over the same helpers; the original inventory only said "overview.ts" without naming either function (`getOverview` itself merely delegates to `getOverviewAmountTotals` and needs no separate assertion) |
| 4 | Tag totals & tag detail | `lib/dal/tags.ts::getTagTotals`, `getTagDetail` | Separate aggregation path over the same helpers; corrects the original inventory's `getTotalByTag`, which does not exist — the real export is `getTagTotals` |
| 5 | Transaction-list `paired*` fields | `lib/dal/transactions.ts` (5 raw-SQL subqueries) | Bypass the helpers entirely; `LIMIT 1` is semantically wrong under 1:N |
| 6 | Amount-edit guard firing behaviour | `lib/services/transaction-edit.ts` | Reads `transaction_pair` directly; can silently stop firing with totals still correct |

Surfaces 5 and 6 are the ones a naive gate misses. Surfaces 1-4 (the 10 aggregation functions) are
asserted before/after via `73-01-PLAN.md` Task 3's `captureAggregationSnapshot` helper (N=1) and
`73-02-PLAN.md` Task 2's expanded scenario matrix (N=3 dinner, adjacency, ordering, Q3).

---

## Per-Task Verification Map

*Seeded at plan time — filled by `/gsd-validate-phase` once PLAN.md task IDs exist.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | RMB-03 | Invariant D-02 | Inflow anchor / outflow refund rejected, exception thrown, no write | unit | `./node_modules/.bin/vitest run tests/reimbursement-invariant.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | RMB-04, RMB-05 | Silent netting drift | Totals identical before/after across all 10 verified aggregation functions (gate surfaces 1-4) | integration | `./node_modules/.bin/vitest run tests/reimbursement-regression.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | RMB-05 | Row loss during backfill | Row counts and mapping verified pair→reimbursement | integration | `./node_modules/.bin/vitest run tests/migration-backfill.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1+ | RMB-01 | — | Schema shape + XOR constraint generate cleanly | schema | `yarn db:generate` (then review the emitted SQL) | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 must land the harness **before** any netting code changes — the gate only means something if
it captures the pre-migration baseline first.

- [ ] `tests/reimbursement-regression.test.ts` — before/after comparison across all 10 verified
      aggregation functions (gate surfaces 1-4). Shape: seed known transactions → capture old-model
      results via `captureAggregationSnapshot({ useFrozenFragment: true })` → run migration →
      capture new-model results via `captureAggregationSnapshot({ useFrozenFragment: false })` →
      assert equality per function. **All money comparisons via `Decimal.js`**
      (`@/lib/utils/decimal`), never native JS arithmetic on the DECIMAL strings.
- [ ] `tests/reimbursement-invariant.test.ts` — D-02 enforcement: outflow anchor + inflow refunds
      succeeds; inflow anchor throws; any outflow refund throws.
- [ ] `tests/migration-backfill.test.ts` — every `transaction_pair` row maps to exactly one
      reimbursement (anchor = primary's Expense, refund = secondary); counts reconcile; no orphans.
- [ ] Shared fixtures (e.g. `tests/fixtures/reimbursement-seed.ts`) — outflow/inflow transactions
      with explicit `direction`, at least one multi-transaction Expense anchor (covers Q3) and one
      N>1 refund set (the dinner case, which no existing fixture can express).

Existing infrastructure (vitest + the mocking pattern in `tests/dashboard-dal.test.ts`) covers the
runner; only the three files above and the fixtures are missing.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration against real production-shaped data | RMB-05 | The harness runs on seeded fixtures; only real data exercises the actual pair population and its edge shapes | Run `yarn db:migrate` then `yarn db:verify` against a restored copy; compare dashboard entrate/uscite for the 3 most recent months before and after |

Everything else in this phase has automated verification. This phase ships no user-facing surface,
so there is no UI to verify manually.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (3 test files + fixtures)
- [ ] Regression harness covers all 6 gate surfaces (10 aggregation functions + transaction-list paired-* fields + amount-edit guard), not just dashboard totals
- [ ] No watch-mode flags (`vitest run`, never bare `vitest`)
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
