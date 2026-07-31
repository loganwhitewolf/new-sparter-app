---
phase: 83
slug: categories-list
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-31
---

# Phase 83 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `83-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (unit/integration) + React `renderToStaticMarkup` (RSC, no jsdom) |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `./node_modules/.bin/vitest run tests/{file}` |
| **Full suite command** | `./node_modules/.bin/vitest run` |
| **Estimated runtime** | ~60–120 seconds full suite (real Postgres in DAL tests) |

**Harness caveat (project-specific).** Invoke the Vitest and TypeScript binaries **directly from
`node_modules/.bin/`**, not via `npx` or a `yarn` alias — the RTK proxy has been observed
intercepting `npx tsc` / `npx vitest` and reporting results that do not match a direct run. Any
test outcome used as evidence in an `<acceptance_criteria>` must come from a direct-binary
invocation.

**Real Postgres for DAL work.** Harness `tests/helpers/reimbursement-test-db.ts`; target database
`sparter_test` (auto-created), connection via `TEST_DATABASE_URL`
(default `postgres://postgres:sparter@localhost:5432/sparter_test`). Four safety guards:
`NODE_ENV` check, localhost-only, `_test` suffix required, `TEST_DATABASE_URL` isolation. Setup
`connectReimbursementTestDb()`; teardown `afterAll(() => pool.end())`. Cross-file isolation via
advisory lock key `731_302`. Seeding helpers in `tests/fixtures/reimbursement-seed.ts`:
`seedUser`, `seedMinimalTaxonomy`, `seedSecondEssentialCategory`, `seedExpenseWithTransaction`,
`seedTag`, `attachTagToTransaction`.

---

## Sampling Rate

- **After every task commit:** Run `./node_modules/.bin/vitest run tests/{changed-feature}`
- **After every plan wave:** Run `./node_modules/.bin/vitest run` (full suite, including
  `tests/pace-engine-lens-regression.test.ts`)
- **Before `/gsd-verify-work`:** Full suite green **and** the RETIRE-05 baseline passing unchanged
- **Max feedback latency:** 120 seconds

**Hard gate — RETIRE-05.** `tests/pace-engine-lens-regression.test.ts` compares
`getOverviewAmountTotals` and `getTagTotals` against a hardcoded snapshot. Phase 83 flips the
category ranking predicate from `eq(direction.includedInTotals, true)` to
`eq(direction.hidden, false)` (D-09). That baseline must pass **unchanged, with no edit to the
test or its snapshot** after the flip. A failing RETIRE-05 means the flip reached a shared
aggregation site it must not touch — it is never a signal to update the snapshot.

---

## Per-Task Verification Map

Task IDs are assigned when `*-PLAN.md` files are written; this map is seeded at requirement level
and must be completed by the planner so that every task carries an automated `<verify>` or an
explicit Wave 0 dependency.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | CLIST-01 | — | N/A | integration (DAL + builder) | `./node_modules/.bin/vitest run tests/categories-ranking-dal.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CLIST-02 | — | N/A | component (RSC render) | `./node_modules/.bin/vitest run tests/categories-list-component.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CLIST-03 | — | N/A | component + route | `./node_modules/.bin/vitest run tests/categories-list-component.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CLIST-04 | — | N/A | integration (DAL predicate) | `./node_modules/.bin/vitest run tests/categories-direction-filter.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CLIST-05 | — | N/A | route assertion | `./node_modules/.bin/vitest run tests/dashboard-year-contract.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CLIST-06 | — | N/A | component | `./node_modules/.bin/vitest run tests/categories-nudge.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CLIST-07 | — | N/A | integration (href + DAL) | `./node_modules/.bin/vitest run tests/category-detail-link.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-10 (regression gate) | — | N/A | integration (real Postgres) | `./node_modules/.bin/vitest run tests/pace-engine-lens-regression.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/categories-ranking-dal.test.ts` — CLIST-01: year-scoped ranking, ordering by total,
      share-of-total arithmetic, 12 zero-filled monthly points per category
- [ ] `tests/categories-list-component.test.tsx` — CLIST-02 / CLIST-03: projection rendered
      inline, subordinate and explicitly labelled; sort toggle offers total and projection
- [ ] `tests/categories-direction-filter.test.ts` — CLIST-04: `eq(direction.hidden, false)`
      admits `in` / `out` / `allocation` and excludes `transfer`; Accantonamenti categories
      appear in the ranking
- [ ] `tests/dashboard-year-contract.test.ts` — CLIST-05: `buildDashboardTabHref` propagates
      `year`, no longer emits `preset`, still carries `lens`
- [ ] `tests/categories-nudge.test.tsx` — CLIST-06: with one Covered Month the list renders
      total, share and a one-point series, plus the explicit missing-data statement; no
      projection figure is rendered (the engine's insufficient-coverage branch has no numeric
      field — assert absence, not zero)
- [ ] `tests/category-detail-link.test.ts` — CLIST-07: the row href carries the same year, and
      the row total equals the detail page's total for that year
- [x] Framework install — Vitest already present; no new dependency

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The projection reads as *visually subordinate* to the total | CLIST-02 (D-06) | "Subordinate" is a perceptual judgement. A test can assert the label text and a distinguishing class, but not that a human reads one figure as secondary to the other. | Open `/dashboard/categories?year=2026`. Confirm at a glance that each row has one dominant figure (the total) and one attenuated, explicitly labelled figure (the projection) — not two figures of equal weight. |
| Uncovered, current and estimated months are distinguishable in the sparkline | CLIST-01 / Risk Summary | Three visual states in a 112×36px SVG; a DOM assertion can prove three distinct fills exist but not that they are tellable apart. | Import a year with a gap month. Confirm the gap is an explicit signal, never a silent flat segment, and that the current month differs from both past facts and future estimates. |
| The per-direction copy set reads correctly on `Accantonamenti` | CLIST-04 (D-11) | Copy correctness in Italian is a language judgement, not a string equality. | Switch to Accantonamenti. Confirm no outflow vocabulary survives ("dove spendi di più", "% del totale speso") and the colour judgement is inverted relative to Uscite. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (use `vitest run`, never bare `vitest`)
- [ ] Feedback latency < 120s
- [ ] RETIRE-05 baseline passes unchanged after the D-09 predicate flip
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
