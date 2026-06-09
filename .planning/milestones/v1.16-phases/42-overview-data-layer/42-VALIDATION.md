---
phase: 42
slug: overview-data-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-07
---

# Phase 42 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `yarn test` |
| **Full suite command** | `yarn test` (runs all `tests/**/*.test.ts` + `tests/**/*.test.tsx` + `lib/**/*.test.ts`; excludes `*.spec.ts` Playwright e2e) |
| **Estimated runtime** | ~30 seconds |

> DAL unit tests use `vi.mock` for `db`, `server-only`, `react`, and `verifySession`. Mirror the mock pattern from `tests/months-with-data-dal.test.ts`.

---

## Sampling Rate

- **After every task commit:** Run `yarn test`
- **After every plan wave:** Run `yarn test && yarn build`
- **Before `/gsd-verify-work`:** `yarn test && yarn build` must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command | File Exists | Status |
|-----|----------|-----------|-------------------|-------------|--------|
| DATA-01 | `getOverview(year)` returns correct KPI strings from aggregate rows | unit | `yarn test tests/overview-dal.test.ts` | ❌ W0 | ⬜ pending |
| DATA-01 | YTD bound = last month with data (not partial current month) | unit | `yarn test tests/overview-dal.test.ts` | ❌ W0 | ⬜ pending |
| DATA-01 | Prior-year comparison uses same month span | unit | `yarn test tests/overview-dal.test.ts` | ❌ W0 | ⬜ pending |
| DATA-02 | Movers returned only for OUT transactions | unit | `yarn test tests/overview-dal.test.ts` | ❌ W0 | ⬜ pending |
| DATA-02 | €15 \|Δ€\| threshold filters noise correctly | unit | `yarn test tests/overview-dal.test.ts` | ❌ W0 | ⬜ pending |
| DATA-02 | `isNew = true` when prevAmount = 0 | unit | `yarn test tests/overview-dal.test.ts` | ❌ W0 | ⬜ pending |
| DATA-02 | Year-crossing: Jan 2026 compares against Dec 2025 | unit | `yarn test tests/overview-dal.test.ts` | ❌ W0 | ⬜ pending |
| DATA-02 | Sort by \|Δ€\| descending | unit | `yarn test tests/overview-dal.test.ts` | ❌ W0 | ⬜ pending |
| DATA-03 | `getYearsWithData()` returns distinct years DESC | unit | `yarn test tests/overview-dal.test.ts` | ❌ W0 | ⬜ pending |
| DATA-03 | Empty array when no transactions | unit | `yarn test tests/overview-dal.test.ts` | ❌ W0 | ⬜ pending |
| DATA-04 | `FlowNature` union has 10 members after adding `income_extraordinary` | unit | `yarn test tests/nature-labels.test.ts` | ✅ needs update | ⬜ pending |
| DATA-04 | `NATURE_LABELS` has correct Italian label for `income_extraordinary` | unit | `yarn test tests/nature-labels.test.ts` | ✅ needs update | ⬜ pending |
| DATA-04 | `NATURE_LABELS` for `income` relabeled to 'Entrate ricorrenti' | unit | `yarn test tests/nature-labels.test.ts` | ✅ needs update | ⬜ pending |
| — | `buildMonthlyNatureTrendData` emptySegments includes `income_extraordinary` | unit | `yarn test tests/dashboard-dal.test.ts` | ✅ needs update | ⬜ pending |
| — | `dashboard-charts` renders one segment per nature in `NATURE_ORDER` (9 non-null) | unit | `yarn test tests/dashboard-charts.test.tsx` | ✅ needs update | ⬜ pending |
| — | `yarn build` exits 0 after all changes | build-check | `yarn build` | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/overview-dal.test.ts` — new test file covering all four DAL functions in `lib/dal/overview.ts`. Mirror the mock pattern from `tests/months-with-data-dal.test.ts` (`vi.mock` for `db`, `server-only`, `react`, `verifySession`).
- [ ] `tests/nature-labels.test.ts` — update existing: change key count 9 → 10, add `income_extraordinary` to `ALL_NATURE_KEYS` / `EXPECTED_LABELS`, update `income` expected label to `'Entrate ricorrenti'`.
- [ ] `tests/dashboard-dal.test.ts` — update `buildMonthlyNatureTrendData` test: add `income_extraordinary` to the sorted expected segment-keys array.
- [ ] `tests/dashboard-charts.test.tsx` — update `renders one segment per nature in NATURE_ORDER`: expected non-null count 8 → 9.

*Vitest 4.x is already installed and configured — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `income_extraordinary` enum value exists in live DB | DATA-04 | Requires a real DB migration apply; unit tests mock `db` | After `yarn db:migrate`, run `SELECT enum_range(NULL::flow_nature);` and confirm `income_extraordinary` is present |
| Seed-extras re-bucketing UPDATEs the candidate slugs | DATA-04 | PO confirms exact slug membership during execution; idempotent UPDATE by slug | After `yarn db:seed-extras`, spot-check `SELECT slug, nature FROM sub_category WHERE nature IN ('income','income_extraordinary')` against the PO-confirmed list |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`tests/overview-dal.test.ts` + 3 updates)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
