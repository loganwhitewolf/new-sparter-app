---
phase: 82
slug: number-engine-and-regression-gate
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-30
---

# Phase 82 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `82-RESEARCH.md` §Validation Architecture. Task IDs are filled in once
> `82-*-PLAN.md` exists.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.5 (`vitest.config.ts`) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `node_modules/.bin/vitest run tests/<file>.test.ts --reporter=verbose` |
| **Full suite command** | `node_modules/.bin/vitest run` |
| **Real-Postgres prerequisite** | `yarn db:up` → isolated `sparter_test` database (harness: `tests/helpers/reimbursement-test-db.ts`) |
| **Build check** | `yarn build` |
| **Estimated runtime** | ~90s full suite (real-Postgres regression tests dominate) |

> **Invoke the vitest binary directly from `node_modules/.bin/`.** RTK intercepts and can
> falsify `npx vitest` / `npx tsc` output in this environment — a green `npx` run is not
> evidence. Same for `yarn test`, which shells through to `vitest run`: prefer the direct
> binary when the result is being used as proof.

---

## Sampling Rate

- **After every task commit:** the quick run for the file that task touched (unit level).
- **After every plan wave:** `node_modules/.bin/vitest run` — full suite green, including the
  byte-identical regression assertions.
- **Before `/gsd-verify-work`:** full suite green **and** `yarn build` clean.
- **Max feedback latency:** 120 seconds.

---

## Per-Task Verification Map

Task IDs are assigned by the planner; this table is seeded at the requirement level and is
refined to per-task granularity once plans exist.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 1 | PACE-01 | — | N/A | integration (SQL + Decimal) | `node_modules/.bin/vitest run tests/pace-and-projection-regression.test.ts -t "covered month"` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | PACE-02 | — | N/A | unit (month classification) | `node_modules/.bin/vitest run tests/pace-and-projection.test.ts -t "partial month"` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | PACE-03 | — | N/A | unit (insufficient coverage) | `node_modules/.bin/vitest run tests/pace-and-projection.test.ts -t "insufficient"` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | PACE-04 | — | N/A | unit (hybrid current month) | `node_modules/.bin/vitest run tests/pace-and-projection.test.ts -t "hybrid"` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | PACE-05 | — | N/A | unit + integration (total = sum of series invariant) | `node_modules/.bin/vitest run tests/pace-and-projection.test.ts -t "sum of series"` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | PACE-06 | — | N/A | unit (current − previous + per-direction judgement) | `node_modules/.bin/vitest run tests/pace-and-projection.test.ts -t "current minus previous"` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | RETIRE-03 | — | N/A | component + build | `node_modules/.bin/vitest run tests/lens-switch-placement.test.tsx` + `yarn build` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | RETIRE-04 | — | N/A | unit (`buildDashboardTabHref`) | `node_modules/.bin/vitest run tests/dashboard-filters.test.ts -t "buildDashboardTabHref"` | ✅ | ⬜ pending |
| TBD | TBD | 2 | RETIRE-05 | — | N/A | integration (byte-identical Overview + Tags totals) | `node_modules/.bin/vitest run tests/pace-engine-lens-regression.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Wave note.** RETIRE-05's regression baseline must be **captured before** the engine lands and
re-asserted after, so its fixture-capture task belongs to the earliest wave even though the
assertion completes later. The planner must not schedule the baseline capture after the engine
change — a baseline taken post-change proves nothing.

---

## Wave 0 Requirements

New test files this phase must create before its implementation tasks can be verified:

- [ ] `tests/pace-and-projection.test.ts` — unit coverage for the engine: Covered/Partial month
      classification (PACE-01, PACE-02), the `< 2 Covered Months` insufficient-coverage outcome
      (PACE-03), `max(spent so far, pace)` for the current month (PACE-04), the
      total-equals-sum-of-series invariant (PACE-05), and `current − previous` plus the single
      per-direction judgement function (PACE-06). Decimal.js assertions throughout — never
      compare coerced JS numbers.
- [ ] `tests/pace-engine-lens-regression.test.ts` — real-Postgres suite proving Overview and Tags
      totals byte-identical before/after the engine change (RETIRE-05). Reuses
      `captureAggregationSnapshot()` and `connectReimbursementTestDb()` from
      `tests/helpers/reimbursement-test-db.ts`; follows
      `tests/amortization-lens-regression.test.ts` and
      `tests/amortization-lens-regression-overview.test.ts` as the v2.9 precedent. The harness
      must be re-runnable unchanged by Phase 83's `direction.hidden` predicate flip (D-16).
- [ ] `tests/lens-switch-placement.test.tsx` — asserts the lens switch renders on Overview and
      **not** on Categories or Tags (RETIRE-03). Component-level, so a regression is caught
      without a full build.

Existing infrastructure that needs **no** Wave 0 work:

- `tests/dashboard-filters.test.ts` already exercises `buildDashboardTabHref` including a
  `tag=5` propagation case — RETIRE-04 turns that existing assertion inside out (assert `tag`
  is dropped, `lens` preserved per D-13). Extend, do not create.
- `tests/helpers/reimbursement-test-db.ts` — real-Postgres harness, already in place.
- vitest is configured; no framework install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Lens state survives Overview-competenza → Categories → Overview | RETIRE-04 / D-13 | Cross-route client-state + URL round-trip; the component test asserts render placement, not navigation continuity | `yarn dev`, set Overview to competenza, click the Categories tab, click back to Overview. Overview must still read competenza, and `?lens=` must be present in the URL on both hops. |
| No visible lens control anywhere outside Overview | RETIRE-03 | Visual absence across three routes, including the previously-disabled Tags switch | `yarn dev`, visit `/dashboard/categories`, `/dashboard/categories/<id>`, `/dashboard/tags` — no lens switch, enabled or disabled, in any of them. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] RETIRE-05 baseline captured **before** the engine change lands
- [ ] No watch-mode flags (`--watch`, `--ui`) in any command
- [ ] Commands invoke `node_modules/.bin/vitest` directly, not `npx`
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
