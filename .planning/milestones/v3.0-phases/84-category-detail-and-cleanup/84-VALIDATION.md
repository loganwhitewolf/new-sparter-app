---
phase: 84
slug: category-detail-and-cleanup
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-03
validated: 2026-08-03
---

# Phase 84 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `84-RESEARCH.md` §Validation Architecture. The Per-Task Verification Map is
> filled in by the planner once task IDs exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + real Postgres (`tests/helpers/reimbursement-test-db.ts` harness, isolated `sparter_test` DB) |
| **Config file** | `vitest.config.ts` (existing — no new framework install needed) |
| **Quick run command** | `./node_modules/.bin/vitest run tests/category-detail-*.test.ts tests/category-detail-*.test.tsx tests/category-subcategory-breakdown.test.tsx tests/retired-vocabulary-guard.test.ts` |
| **Full suite command** | `./node_modules/.bin/vitest run` |
| **Estimated runtime** | quick ~2s · full suite 14.3s (184 files / 2219 tests) |

> **Harness caveat (2026-08-03 audit):** invoke the direct binary. `npx`/`yarn test` are intercepted
> by the local rtk hook, which falsifies vitest and tsc output — a command that appears green there
> proves nothing. Same for `./node_modules/.bin/tsc --noEmit`.

---

## Sampling Rate

- **After every task commit:** Run `yarn test tests/category-detail-*.test.ts --run`
- **After every plan wave:** Run `yarn test --run` (full suite, includes the RETIRE-02 regression gate)
- **Before `/gsd-verify-work`:** Full suite green **plus** `yarn typecheck` and `yarn check:language` green,
  the D-19 retirement grep at its agreed scope, and Phase 82's RETIRE-05 byte-identical
  Overview/Tags baseline (`tests/pace-engine-lens-regression.test.ts`) still passing
- **Max feedback latency:** <30 seconds for the quick command

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _to be filled by planner_ | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Requirement → behaviour → command map — reconciled 2026-08-03 against the suite as delivered.**

Five seeded rows named files that were never created under those names; each is remapped below to
the file that actually carries the behaviour (see the Remapping note).

| Req ID | Behavior | Test Type | Automated Command | Status |
|--------|----------|-----------|-------------------|--------|
| CDET-01 | 12-month table renders with the month-over-month delta inside each cell; index 0 never carries one | unit | `vitest run tests/category-detail-table.test.tsx tests/category-detail-year-window-dal.test.ts` | ✅ green |
| CDET-02 | Previous-year row renders on the homologous window as plain amounts, no delta line | unit | `vitest run tests/category-detail-table.test.tsx` (describe: previous-year row) | ✅ green |
| CDET-03 | `?year=&months=&from=` parses, clamps (D-03) and re-filters; window survives a year change (D-04) | integration | `vitest run tests/category-detail-window.test.ts` | ✅ green |
| CDET-04 | Summary column total/average/comparison refer only to the selected window; D-10 reduced-denominator qualifiers | unit | `vitest run tests/category-detail-table.test.tsx tests/category-detail-year-window-dal.test.ts` | ✅ green |
| CDET-05 | Subcategory contributions sum **exactly** to the RAW parent difference, including one-period-only subcategories | unit | `vitest run tests/category-subcategory-breakdown.test.tsx tests/category-detail-year-window-dal.test.ts` | ✅ green |
| CDET-06 | Covered / current-hybrid / estimated / uncovered month states are each distinct; `non importato` is explicit | unit | `vitest run tests/category-detail-table.test.tsx tests/category-detail-year-window-dal.test.ts` | ✅ green |
| CDET-07 | Previous-year total difference replaced by a stated reason below the coverage threshold; average comparison still renders | unit | `vitest run tests/category-detail-table.test.tsx tests/category-detail-year-window-dal.test.ts` | ✅ green |
| RETIRE-01 | Zero occurrences of the retired identifiers and vocabulary families across `app/`, `lib/`, `components/` | smoke | `vitest run tests/retired-vocabulary-guard.test.ts` | ✅ green (**created by this audit**) |
| RETIRE-02 | Regression suites pass unchanged against the new explicit-date-range DAL signatures | regression | `vitest run tests/amortization-lens-regression.test.ts tests/pace-engine-lens-regression.test.ts tests/dashboard-year-contract.test.ts` | ✅ green |

**Remapping note.** The seeded map was written before the plans existed and named six speculative
files. Delivered instead:

| Seeded | Delivered | Why |
|---|---|---|
| `category-detail-table.test.ts` | `category-detail-table.test.tsx` | React component test — needs the `.tsx` extension |
| `category-detail-summary.test.ts` | summary-column tests inside `category-detail-table.test.tsx` + D-10 total/average in `category-detail-year-window-dal.test.ts` | The summary column is a column of the table, not a separate component |
| `category-subcategory-contrib.test.ts` | `category-subcategory-breakdown.test.tsx` + the exact-sum case in `category-detail-year-window-dal.test.ts` | Arithmetic lives in the DAL, rendering in the component |
| `category-detail-month-states.test.ts` | month-state tests inside `category-detail-table.test.tsx` + `category-detail-year-window-dal.test.ts` | Month state is computed in the DAL and rendered by the table; no separate module exists |
| `category-detail-prev-year-gate.test.ts` | previous-year/`totalDifference` tests in both files above | Same — the gate is a DAL field plus its rendering |
| — | `category-detail-difference-chart.test.tsx`, `category-detail-components.test.tsx` | Delivered beyond the seeded plan (D-08/D-09 chart, top-transactions) |

---

## Wave 0 Requirements

All Wave 0 coverage exists and is green (reconciled 2026-08-03), under the delivered file names:

- [x] `tests/category-detail-table.test.tsx` — CDET-01/02/04/06/07 table structure, per-cell delta, previous-year row, summary column, month states. 13 tests
- [x] `tests/category-detail-window.test.ts` — D-01 parser, D-03 clamp, D-04 year-change re-anchoring, URL round-trip. 22 tests
- [x] `tests/category-detail-year-window-dal.test.ts` — real-Postgres DAL: month states, hybrid current month, D-10 denominator, previous-year gate, CDET-05 exact-sum (the non-tautological CR-01 fix), window-scoped top transactions
- [x] `tests/category-subcategory-breakdown.test.tsx` — CDET-05 rendering, sum-to-parent row, present-in-one-period-only cases
- [x] `tests/retired-vocabulary-guard.test.ts` — **added 2026-08-03 by this audit.** RETIRE-01's first automated proof: repo-wide scan of `app/`, `lib/`, `components/` for 17 retired identifiers (whole-word) plus 4 vocabulary families (substring, so `DeviationBadge` and friends cannot slip through a name this list never anticipated). 25 tests
- [x] Test fixtures spanning two years with partial coverage — the existing Postgres harness, no new framework
- [x] Framework install: **none needed** (Vitest, Postgres harness and Decimal.js already in use)

**Gaps rationale:** all Wave 0 files are new unit/integration suites for the rewritten detail page.
RETIRE-02 adds no new file — it reuses the existing amortization and reimbursement regression suites,
whose *expected values must not change* (D-16); only their call sites move from the preset filter to an
explicit date range. Note the snapshot-shape tension recorded in RESEARCH.md: deleting
`getCategoryDeviations` removes a key from the regression snapshot object even though every surviving
key's value must stay byte-identical.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The three month states are *visually* distinguishable from one another and from uncovered months | CDET-06 | Distinctness is a perceptual property; a test can assert the class/marker but not that they read as different | Open a category detail on a year with a partial current month and at least one uncovered month; confirm covered, current-hybrid, estimate and uncovered are each identifiable without reading the legend |
| Sticky first column + sticky summary column behaviour on narrow viewports | CDET-01 (Claude's Discretion) | Layout/scroll behaviour under real viewport constraints | Below ~1040px, scroll the table horizontally; confirm the month-label column stays left and the summary column stays right (or that the agreed fallback applies) |
| `"non importato"` renders inside a cell without breaking column alignment | CDET-06 (open prototype item) | Visual alignment | Render a year containing uncovered months; confirm column widths do not shift |
| Difference-chart legend makes above/below unambiguous without signs | CDET-01 / D-09 | Comprehension, not computation | Confirm the legend states what above and below the zero line mean for the category's direction |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references — one genuine MISSING found (RETIRE-01) and filled
- [x] No watch-mode flags — `vitest run` everywhere, direct binary never `npx`/`yarn`
- [x] Feedback latency < 30s — phase subset ~2s, full suite 14.3s
- [x] Phase 82's RETIRE-05 byte-identical Overview/Tags baseline still green after this audit
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-08-03 via `/gsd-validate-phase 84`

---

## Validation Audit 2026-08-03

| Metric | Count |
|--------|-------|
| Requirements audited | 9 |
| COVERED on entry | 8 |
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |
| Rows remapped (stale file reference) | 5 |

**Method.** State A audit — VALIDATION.md seeded at plan time, never updated during execution. All
four SUMMARY files and 84-VERIFICATION.md were read, the requirement→test map was rebuilt against
the delivered suite, and every command was executed with the direct binary.

**Gap: RETIRE-01 (MISSING).** The requirement's proof was a *manual* repo grep plus three
single-file source assertions scoped to Phase 83's own files (`tests/category-detail-link.test.ts`).
Nothing automated stopped the retired vocabulary from returning. Same shape as Phase 82's IN-01.

**Resolution.** `tests/retired-vocabulary-guard.test.ts` created — 25 tests: 17 whole-word
identifier scans, 4 substring family scans, 4 anti-vacuity controls.

**Anti-vacuity checks performed.** The auditor's first version passed 17/17 while leaving four
declared identifiers (`Deviation`, `Deviazione`, `NoiseThreshold`, `noiseThreshold`) in an unused
constant with no test asserting them, and allowlisted nine files — including
`app/(app)/dashboard/categories/page.tsx` and `components/dashboard/dashboard-tab-nav.tsx`, the two
files where a Deviation regression would actually land. Corrected before sign-off:

| Check | Method | Result |
|---|---|---|
| Is any allowlist entry necessary? | Emptied the allowlist and scanned every identifier and family across all three roots | Zero hits. No production file needs an exemption, so the allowlist shrank to this guard file alone, and a test now asserts it can never exempt a production file again |
| Are all declared identifiers asserted? | Drove the assertions from the array via `test.each` instead of hand-written cases | 17 identifiers asserted, up from 16 hand-written of 20 declared; dead constant eliminated |
| Does the guard fail on regression? | Appended `computeDeviation` to `app/(app)/dashboard/categories/page.tsx` (previously exempt) and `DeviationBadge` to `components/dashboard/category-detail-table.tsx`, ran the suite, reverted via `git checkout --` | 2 of 25 failed under mutation — the whole-word scan on the formerly-exempt page and the substring family scan; 25/25 green after revert; `git diff --stat` empty, implementation byte-unchanged |
| Do the positive controls resolve? | `buildYearSeries` (whole-word) and `YearSerie` (substring) must be found; walk must reach >200 files across all three roots | All resolve — the scan is not reading an empty set |

Why `Baseline`/`baseline` is scanned only as `baselineAmount`: both have live unrelated senses —
`restoreRefundBaseline` (v2.8 reimbursement lifecycle) and Tailwind's `items-baseline`. A bare
word-boundary scan would flag `items-baseline`, since `-` is not a word character.

**Suite after audit:** 184 files / 2219 passed / 0 failed / 1 pre-existing todo (baseline 183 /
2194). `./node_modules/.bin/tsc --noEmit` clean. `node scripts/check-code-language.mjs` clean.

**Manual-Only entries below stay manual by design** — all four are perceptual or layout judgements
(state distinctness, sticky-column behaviour, cell alignment, legend comprehension) whose mechanical
substrate is already asserted automatically. None is a requirement-level gap: every one of
CDET-01…07, RETIRE-01 and RETIRE-02 now has automated verification, which is what
`nyquist_compliant: true` asserts.
