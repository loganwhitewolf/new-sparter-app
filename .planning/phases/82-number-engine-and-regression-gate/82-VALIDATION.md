---
phase: 82
slug: number-engine-and-regression-gate
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-30
validated: 2026-08-03
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

Reconciled by `/gsd-validate-phase 82` on 2026-08-03 against the shipped test suite.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| T-82-01 | 82-01 | 1 | PACE-01 | T-82-01 (userId scoping) | Covered-month + zero-fill queries scoped to the authenticated user | unit (composition) + integration (real Postgres) | `node_modules/.bin/vitest run tests/pace-and-projection.test.ts -t "PACE-01"` and `node_modules/.bin/vitest run tests/pace-engine-lens-regression.test.ts -t "zero-fills"` | ✅ | ✅ green |
| — | 82-03 | 1 | PACE-02 | — | N/A | unit (month classification) | `node_modules/.bin/vitest run tests/pace-and-projection.test.ts -t "Partial Month classification"` | ✅ | ✅ green |
| — | 82-01 | 1 | PACE-03 | — | N/A | unit (boundary at exactly 1 and exactly 2) | `node_modules/.bin/vitest run tests/pace-and-projection.test.ts -t "Pace availability boundary"` | ✅ | ✅ green |
| — | 82-03 | 1 | PACE-04 | — | N/A | unit (hybrid current month, incl. tie + pace±1 probe) | `node_modules/.bin/vitest run tests/pace-and-projection.test.ts -t "Current month hybrid value"` | ✅ | ✅ green |
| — | 82-03 | 1 | PACE-05 | — | N/A | unit (total = sum of series invariant, exact not approximate) | `node_modules/.bin/vitest run tests/pace-and-projection.test.ts -t "Total equals sum of series"` | ✅ | ✅ green |
| — | 82-03 | 1 | PACE-06 | — | N/A | unit (current − previous + per-direction judgement) | `node_modules/.bin/vitest run tests/pace-and-projection.test.ts -t "Comparison sign convention"` | ✅ | ✅ green |
| — | 82-02 | 2 | RETIRE-03 | — | N/A | static analysis (import-graph walk, one hop, with positive control) | `node_modules/.bin/vitest run tests/lens-switch-placement.test.tsx` | ✅ | ✅ green |
| — | 82-02 | 2 | RETIRE-04 | — | N/A | unit (`buildDashboardTabHref` parameter allowlist) | `node_modules/.bin/vitest run tests/dashboard-tab-nav.test.ts -t "RETIRE-04"` | ✅ | ✅ green |
| — | 82-01 | 2 | RETIRE-05 | — | N/A | integration (byte-identical Overview + Tags totals, CI-guarded) | `node_modules/.bin/vitest run tests/pace-engine-lens-regression.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**RETIRE-04 — coverage regression found and repaired during this audit.** The command in the
original table pointed at `tests/dashboard-filters.test.ts`, which no longer exists: it was deleted
in commit `613e8f01` ("feat(84-04): delete dead Deviation/CategoryDetail components, trim
dashboard.ts") when Phase 84's retirement sweep removed the `dashboard-filters.tsx` component and
took its sibling test file along with it. That file held this phase's only assertions that
`buildDashboardTabHref` drops `?tag=` (D-14) and preserves `?lens=` (D-13) — 82-VERIFICATION.md
cites it for D-13 lens threading. From `613e8f01` until this audit, both behaviors were live in
`components/dashboard/dashboard-tab-nav.tsx:14-44` with zero test coverage. Replaced by
`tests/dashboard-tab-nav.test.ts` (9 tests), which asserts the emitted **key set** rather than
substring absence, so a future param addition cannot slip through. Mutation-verified: making the
implementation propagate `tag` again fails 3 of the 9 tests.

**RETIRE-03 — strengthened past the single-file grep (closes review finding IN-01).** The test now
walks each page's import graph one hop and asserts no imported module renders `<LensSwitch`, which
catches the realistic regression a single-file grep cannot see: a page pulling in a *wrapper*
component that renders the switch. The walk carries a mandatory positive control
(`resolvesTheImportGraph`) asserting it *does* find the switch one hop from the Overview page via
`overview-header`. That control is load-bearing: the first version of this walk mapped `@/` to
`app/` instead of the project root (`tsconfig.json` → `{"@/*": ["./*"]}`), so every import failed
to resolve, every failure was swallowed by a `catch`, and the strengthened assertions passed
vacuously for all three pages. The control makes that failure mode impossible to reintroduce
silently. `resolveLedgerRowSource(` stays a direct-source assertion — the page is the only correct
level for "does not resolve the lens from the URL".

**Wave note.** RETIRE-05's regression baseline must be **captured before** the engine lands and
re-asserted after, so its fixture-capture task belongs to the earliest wave even though the
assertion completes later. The planner must not schedule the baseline capture after the engine
change — a baseline taken post-change proves nothing.

---

## Wave 0 Requirements

All Wave 0 files exist and are green (reconciled 2026-08-03).

New test files this phase must create before its implementation tasks can be verified:

- [x] `tests/pace-and-projection.test.ts` — unit coverage for the engine: Covered/Partial month
      classification (PACE-01, PACE-02), the `< 2 Covered Months` insufficient-coverage outcome
      (PACE-03), `max(spent so far, pace)` for the current month (PACE-04), the
      total-equals-sum-of-series invariant (PACE-05), and `current − previous` plus the single
      per-direction judgement function (PACE-06). Decimal.js assertions throughout — never
      compare coerced JS numbers.
- [x] `tests/pace-engine-lens-regression.test.ts` — real-Postgres suite proving Overview and Tags
      totals byte-identical before/after the engine change (RETIRE-05). Reuses
      `captureAggregationSnapshot()` and `connectReimbursementTestDb()` from
      `tests/helpers/reimbursement-test-db.ts`; follows
      `tests/amortization-lens-regression.test.ts` and
      `tests/amortization-lens-regression-overview.test.ts` as the v2.9 precedent. The harness
      must be re-runnable unchanged by Phase 83's `direction.hidden` predicate flip (D-16).
- [x] `tests/lens-switch-placement.test.tsx` — asserts the lens switch renders on Overview and
      **not** on Categories or Tags (RETIRE-03). Component-level, so a regression is caught
      without a full build. Since 2026-08-03 it also walks the import graph one hop, with a
      positive control proving the walk resolves.
- [x] `tests/dashboard-tab-nav.test.ts` — added 2026-08-03 by this audit, replacing the coverage
      lost when `tests/dashboard-filters.test.ts` was deleted in `613e8f01` (RETIRE-04, D-13/D-14).

Existing infrastructure that needs **no** Wave 0 work:

- ~~`tests/dashboard-filters.test.ts` already exercises `buildDashboardTabHref` including a
  `tag=5` propagation case — RETIRE-04 turns that existing assertion inside out (assert `tag`
  is dropped, `lens` preserved per D-13). Extend, do not create.~~ **Superseded:** that file was
  deleted in `613e8f01` during Phase 84's retirement sweep. RETIRE-04 now lives in the dedicated
  `tests/dashboard-tab-nav.test.ts` — named for the requirement so it cannot be collected as
  collateral by a future component deletion.
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

- [x] All tasks have `<automated>` verify or a Wave 0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] RETIRE-05 baseline captured **before** the engine change lands
- [x] No watch-mode flags (`--watch`, `--ui`) in any command
- [x] Commands invoke `node_modules/.bin/vitest` directly, not `npx`
- [x] Feedback latency < 120s (full suite 17.8s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-08-03 via `/gsd-validate-phase 82`

---

## Validation Audit 2026-08-03

| Metric | Count |
|--------|-------|
| Requirements audited | 9 |
| COVERED on entry | 7 |
| Gaps found | 2 |
| Resolved | 2 |
| Escalated | 0 |

**Gaps:** RETIRE-04 (PARTIAL — mapped command pointed at a test file deleted in `613e8f01`;
the `tag`-drop and `lens`-preserve behaviors had no coverage at all) and RETIRE-03 (PARTIAL —
absence verified by single-file source grep, review finding IN-01).

**Resolution:** `tests/dashboard-tab-nav.test.ts` created (9 tests, key-set allowlist);
`tests/lens-switch-placement.test.tsx` strengthened with a one-hop import-graph walk plus a
positive control.

**Anti-vacuity checks performed** — both gaps were proven to actually detect regressions, not
merely to pass:

| Check | Method | Result |
|---|---|---|
| RETIRE-04 tests fail on regression | Mutated `dashboard-tab-nav.tsx` to propagate `tag` again, ran the suite, reverted via `git checkout --` | 3 of 9 tests failed under mutation; all 9 green after revert; implementation byte-unchanged |
| RETIRE-03 walk actually resolves modules | Ran the walk against the Overview page, which reaches `<LensSwitch` one hop away via `overview-header` | Detected. The first version of the walk did **not** — it resolved 0 of 12 imports and passed vacuously; caught and fixed before sign-off, now locked by the `resolvesTheImportGraph` control |

**Suite after audit:** 183 files / 2194 passed / 0 failed / 1 pre-existing todo (baseline 182 /
2184). `node_modules/.bin/tsc --noEmit` clean. `yarn check:language` clean. RETIRE-05 hardcoded
baseline (100.00 / -100.00) unchanged and green.

**Process note for future phases.** Deleting a component should not silently delete a *different*
phase's requirement coverage. `tests/dashboard-filters.test.ts` was named after the component it
happened to live beside, not after the requirement it guarded, which is why a Phase 84 cleanup
could remove it without anyone noticing that RETIRE-04 lost its proof — and why two subsequent
verification passes cited a file that no longer existed. Requirement-critical assertions should
live in files named for the requirement or the function under test.
