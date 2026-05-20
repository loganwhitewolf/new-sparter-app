---
phase: 29
slug: dashboard-intelligence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-19
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `yarn vitest run --reporter=verbose` |
| **Full suite command** | `yarn vitest run && yarn check:language && yarn build` |
| **Estimated runtime** | ~30 seconds (vitest) + ~60 seconds (build) |

---

## Sampling Rate

- **After every task commit:** Run `yarn vitest run --reporter=verbose`
- **After every plan wave:** Run full suite (`yarn vitest run && yarn check:language && yarn build`)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| D-01 fix | 01 | 0 | D-01 | unit | `yarn vitest run tests/dashboard-dal.test.ts` | ⬜ pending |
| Deviation utils | 01 | 0 | D-04, D-05 | unit | `yarn vitest run tests/dashboard-utils.test.ts` | ⬜ pending |
| Baseline DAL | 01 | 1 | D-02, D-03, D-05 | unit | `yarn vitest run tests/dashboard-dal.test.ts` | ⬜ pending |
| DeviationBadge component | 02 | 0 | D-06, D-09 | unit | `yarn vitest run tests/deviation-badge.test.tsx` | ⬜ pending |
| Category list deviation | 02 | 1 | D-06, D-07 | unit | `yarn vitest run tests/category-ranking-list.test.tsx` | ⬜ pending |
| Subcategory deviation | 02 | 1 | D-08 | unit | `yarn vitest run tests/category-detail-components.test.tsx` | ⬜ pending |
| Chart A (bars) | 03 | 1 | D-10, D-11 | unit | `yarn vitest run tests/dashboard-charts.test.tsx` | ⬜ pending |
| Chart B (bilancio) | 03 | 1 | D-12 | unit | `yarn vitest run tests/dashboard-charts.test.tsx` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/dashboard-utils.test.ts` — stubs for `computeDeviation`, `buildDeviationMap`
- [ ] `tests/deviation-badge.test.tsx` — stubs for `DeviationBadge` component
- [ ] `tests/dashboard-charts.test.tsx` — stubs for `EntratUsciteChart` and `BilancioBarsChart`

*Existing infrastructure (vitest + @testing-library/react) covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Deviation coloring correct in browser | D-06 | Color rendering requires visual inspection | Open /dashboard/categories, verify red/green percentages match overspend/underspend |
| Chart B bar colors (green/red) | D-12 | SVG fill color requires visual inspection | Open /dashboard/overview, verify positive months are green, negative months are red |
| Sort toggle preserves type query param | D-07 | URL query param interaction | Toggle sort on /dashboard/categories, verify ?type=out is preserved |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
