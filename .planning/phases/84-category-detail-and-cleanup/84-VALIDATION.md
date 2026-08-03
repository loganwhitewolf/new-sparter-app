---
phase: 84
slug: category-detail-and-cleanup
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-03
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
| **Quick run command** | `yarn test tests/category-detail-*.test.ts --run` |
| **Full suite command** | `yarn test --run` |
| **Estimated runtime** | ~quick <30s · full suite several minutes (1953+ tests) |

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

**Requirement → behaviour → command map (from RESEARCH.md, planner assigns task IDs):**

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CDET-01 | 12-month table renders with the month-over-month delta inside each cell | unit | `yarn test tests/category-detail-table.test.ts --run` | ❌ Wave 0 |
| CDET-02 | Previous-year row renders on the homologous window | unit | `yarn test tests/category-detail-table.test.ts --run` | ❌ Wave 0 |
| CDET-03 | `?year=&months=&from=` parses, clamps (D-03) and re-filters; window survives a year change (D-04) | integration | `yarn test tests/category-detail-window.test.ts --run` | ❌ Wave 0 |
| CDET-04 | Summary column total/average/comparison refer only to the selected window | unit | `yarn test tests/category-detail-summary.test.ts --run` | ❌ Wave 0 |
| CDET-05 | Subcategory contributions sum **exactly** to the parent difference, including one-period-only subcategories | unit | `yarn test tests/category-subcategory-contrib.test.ts --run` | ❌ Wave 0 |
| CDET-06 | Covered / current-hybrid / estimated / uncovered month states are each distinct; reduced denominator stated (D-10) | unit | `yarn test tests/category-detail-month-states.test.ts --run` | ❌ Wave 0 |
| CDET-07 | Previous-year total difference replaced by a stated reason below the coverage threshold; average comparison still renders | unit | `yarn test tests/category-detail-prev-year-gate.test.ts --run` | ❌ Wave 0 |
| RETIRE-01 | No retired-vocabulary references remain outside the agreed allowlist | smoke | D-19 grep at the scope RESEARCH.md pins (guard tests + `MonthMultiPicker` `PresetBtn` excluded) | ✅ Manual |
| RETIRE-02 | Regression suites pass unchanged against the new explicit-date-range DAL signatures | regression | `yarn test tests/amortization-lens-regression.test.ts tests/reimbursement-regression.test.ts --run` | ✅ Existing |

---

## Wave 0 Requirements

- [ ] `tests/category-detail-table.test.ts` — CDET-01/CDET-02 table structure, per-cell delta, previous-year row
- [ ] `tests/category-detail-window.test.ts` — D-01 parser, D-03 clamp, D-04 year-change re-anchoring, URL round-trip
- [ ] `tests/category-detail-summary.test.ts` — CDET-04 window-scoped total / average / comparison
- [ ] `tests/category-subcategory-contrib.test.ts` — CDET-05 contribution arithmetic via `@/lib/utils/decimal`, disappeared-subcategory case, sum-to-parent invariant
- [ ] `tests/category-detail-month-states.test.ts` — CDET-06 four month states and the D-10 reduced-denominator notes
- [ ] `tests/category-detail-prev-year-gate.test.ts` — CDET-07 `canShowPreviousYearTotalDifference` gate and stated reason
- [ ] Test fixtures spanning two years with partial coverage — reuse the existing Postgres harness conventions rather than adding a framework
- [ ] Framework install: **none needed** (Vitest, Postgres harness and Decimal.js already in use)

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`--run` on every command)
- [ ] Feedback latency < 30s for the quick command
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
