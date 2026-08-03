---
phase: 83
slug: categories-list
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-31
validated: 2026-08-03
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

Completed retroactively by `/gsd-validate-phase 83` on 2026-08-03 against the delivered test suite.
Two rows were **remapped**: the file names seeded at plan time (`categories-direction-filter.test.ts`,
and CLIST-02/03's rendering assertions inside `categories-list-component.test.tsx`) were not the
files execution actually produced. The behavior is covered — by different, more precisely scoped
files. The seeded names never existed and are not gaps; see the Remapping note below.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| T-01.1 / T-04.1 | 83-01, 83-04 | 1, 2 | CLIST-01 | — | N/A | integration (real Postgres DAL) + component | `./node_modules/.bin/vitest run tests/categories-ranking-dal.test.ts tests/category-ranking-list.test.tsx` | ✅ | ✅ green |
| T-04.4 / T-04.5 | 83-04 | 2 | CLIST-02 | — | N/A | component (RSC render) | `./node_modules/.bin/vitest run tests/category-ranking-list.test.tsx` | ✅ | ✅ green |
| T-02.1 / T-04.3 | 83-02, 83-04 | 1, 2 | CLIST-03 | — | N/A | route contract + component | `./node_modules/.bin/vitest run tests/dashboard-year-contract.test.ts tests/categories-list-component.test.tsx` | ✅ | ✅ green |
| T-01.2 / T-03.x / T-04.2 | 83-01, 83-03, 83-04, 83-05 | 1, 2 | CLIST-04 | T-83-01 (userId scoping) | userId-scoped ranking query | integration (DAL predicate) + component + copy | `./node_modules/.bin/vitest run tests/categories-ranking-dal.test.ts tests/categories-list-component.test.tsx tests/category-direction-copy.test.ts tests/category-allocation-negative-domain.test.tsx` | ✅ | ✅ green |
| T-02.2 / T-02.3 | 83-02 | 1 | CLIST-05 | — | N/A | route assertion | `./node_modules/.bin/vitest run tests/dashboard-year-contract.test.ts tests/category-detail-link.test.ts` | ✅ | ✅ green |
| T-01.4 / T-03.4 | 83-01, 83-03, 83-04 | 1, 2 | CLIST-06 | — | N/A | unit (nudge predicate) + component + DAL | `./node_modules/.bin/vitest run tests/categories-nudge.test.tsx tests/category-sparkline.test.tsx tests/categories-ranking-dal.test.ts` | ✅ | ✅ green |
| T-02.4 / T-06.1 | 83-02, 83-06 | 1, 3 | CLIST-07 | — | N/A | integration (href round trip) + CR-01 guard | `./node_modules/.bin/vitest run tests/category-detail-link.test.ts tests/category-ranking-list.test.tsx` | ✅ | ✅ green |
| — | — | — | D-10 (regression gate) | — | N/A | integration (real Postgres) | `./node_modules/.bin/vitest run tests/pace-engine-lens-regression.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Remapping note (audit 2026-08-03).**

| Seeded reference | Actual coverage | Why |
|---|---|---|
| `tests/categories-direction-filter.test.ts` (CLIST-04) | `tests/categories-ranking-dal.test.ts` (D-09 predicate flip: `hidden=false` surfaces the allocation direction) + `tests/categories-list-component.test.tsx` (`DirectionFilter` renders exactly 3 links in Uscite/Entrate/Accantonamenti order) + `tests/category-direction-copy.test.ts` (per-direction copy set) + `tests/category-allocation-negative-domain.test.tsx` (83-05 negative-domain rendering) | Execution split the one planned file along the seam it actually has: the predicate lives in the DAL, the switch in a component, the copy in a service. Four narrow files replace one broad one; no behavior lost. |
| `tests/categories-list-component.test.tsx` for CLIST-02 row rendering | `tests/category-ranking-list.test.tsx` | The row component was extracted into `CategoryRankingList`, so its tests moved with it. `categories-list-component.test.tsx` retained the page-local controls (DirectionFilter, SortToggle, NoYearsEmptyState). |

---

## Wave 0 Requirements

- [x] `tests/categories-ranking-dal.test.ts` — CLIST-01: year-scoped ranking, ordering by total,
      share-of-total arithmetic, 12 zero-filled monthly points per category. **10/10 green**
      against real Postgres (`describeIfReachable` executed, not skipped — verified via
      `--reporter=verbose`).
- [x] `tests/category-ranking-list.test.tsx` — CLIST-02 / CLIST-03: projection rendered inline,
      subordinate and explicitly labelled; absent entirely when null (D-15); `compareByProjection`
      reorders with an amount fallback. **10/10 green.** (Seeded under
      `categories-list-component.test.tsx` — see Remapping note.)
- [x] `tests/categories-list-component.test.tsx` — CLIST-03 / CLIST-04 controls: sort toggle
      offers Totale and Proiezione (disabled `<span>` with a stated reason when unavailable);
      DirectionFilter renders exactly 3 always-enabled links. **6/6 green.**
- [x] CLIST-04 direction predicate — covered by `tests/categories-ranking-dal.test.ts`
      (`hidden=false` replaces `includedInTotals`, surfacing the allocation direction),
      `tests/category-direction-copy.test.ts` (per-direction copy, no retired vocabulary) and
      `tests/category-allocation-negative-domain.test.tsx`. **All green.** (Seeded as
      `categories-direction-filter.test.ts`, which was never created — see Remapping note.)
- [x] `tests/dashboard-year-contract.test.ts` — CLIST-05: `buildDashboardTabHref` propagates
      `year`, no longer emits `preset`, still carries `lens`. **13/13 green.**
- [x] `tests/categories-nudge.test.tsx` — CLIST-06 nudge predicate: shows at exactly 1 Covered
      Month, never at 0 or ≥2, respects dismissal-at-count. **6/6 green.** Absence of the
      projection figure in that branch is asserted in `tests/category-ranking-list.test.tsx`
      ("renders NO 'A questo passo' label or value when projection is null") and its `null`
      origin in `tests/categories-ranking-dal.test.ts` (D-15); the one-point series in
      `tests/category-sparkline.test.tsx`.
- [x] `tests/category-detail-link.test.ts` — CLIST-07: the row href carries the same year,
      round-tripped via `resolveYear` with no precision loss; the CR-01 guard (an allocation row
      emits no `<a>` and no `type=allocation`) sits in `tests/category-ranking-list.test.tsx`.
      **6/6 + guard green.**
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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references — zero MISSING at audit time
- [x] No watch-mode flags (use `vitest run`, never bare `vitest`)
- [x] Feedback latency < 120s — the 9-file phase subset runs in **2.13s**; full suite 16.15s
- [x] RETIRE-05 baseline passes unchanged after the D-09 predicate flip — `git log` on
      `tests/pace-engine-lens-regression.test.ts` shows its last three commits are all Phase 82
      (`3d367fb0`, `61bacd85`, `48e64095`); **no Phase 83 commit touched the file or its snapshot**,
      and it runs green after the flip
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-08-03 by `/gsd-validate-phase 83`

---

## Validation Audit 2026-08-03

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Rows remapped (stale file reference) | 2 |

**Method.** State A audit (VALIDATION.md present, seeded at plan time and never updated during
execution). All six SUMMARY files and 83-VERIFICATION.md were read, the requirement→test map was
rebuilt against the delivered suite, and every referenced command was executed with the direct
binary — never `npx`/`yarn` — per the harness caveat above.

**Evidence.**
```
./node_modules/.bin/vitest run tests/categories-ranking-dal.test.ts \
  tests/categories-list-component.test.tsx tests/categories-nudge.test.tsx \
  tests/dashboard-year-contract.test.ts tests/category-detail-link.test.ts \
  tests/category-ranking-list.test.tsx tests/category-direction-copy.test.ts \
  tests/category-sparkline.test.tsx tests/pace-engine-lens-regression.test.ts

Test Files  9 passed (9)
     Tests  73 passed (73)
  Duration  2.13s
```
Zero skipped. The real-Postgres DAL file was re-run under `--reporter=verbose` to prove its
`describeIfReachable` guard executed rather than silently skipping: all 10 tests listed as run.

**No auditor spawned** — the gap set was empty, so `/gsd-validate-phase` short-circuited to the
document update (workflow §3).

**What the audit did not change.** The three Manual-Only entries below remain manual by design:
each is a perceptual judgement (visual subordination, three-state sparkline legibility, Italian
copy correctness) whose *mechanical* substrate — label text, distinguishing class, distinct fills,
string equality — is already asserted automatically. They are not requirement-level gaps: every
one of CLIST-01…07 has automated verification, which is what `nyquist_compliant: true` asserts.
