---
phase: 37
slug: flow-nature-chart
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-25
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `yarn test tests/dashboard-charts.test.tsx` |
| **Full suite command** | `yarn test` |
| **Estimated runtime** | ~30 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `yarn test tests/dashboard-charts.test.tsx`
- **After every plan wave:** Run `yarn test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 37-01-01 | 01 | 0 | R-FN-01 | — | N/A | unit | `yarn test tests/nature-labels.test.ts` | ❌ W0 | ⬜ pending |
| 37-01-02 | 01 | 0 | R-FN-04 | — | N/A | unit | `yarn test tests/dashboard-charts.test.tsx` | ✅ | ⬜ pending |
| 37-02-01 | 02 | 1 | R-FN-02 | — | Migration not run in prod via push | manual | verify migration file exists in `drizzle/migrations/` | ❌ W0 | ⬜ pending |
| 37-02-02 | 02 | 1 | R-FN-08 | — | N/A | unit | `yarn test tests/dashboard-dal.test.ts` | ❌ W0 | ⬜ pending |
| 37-03-01 | 03 | 2 | R-FN-04 | — | N/A | unit | `yarn test tests/dashboard-dal.test.ts` | ❌ W0 | ⬜ pending |
| 37-03-02 | 03 | 2 | R-FN-05 | — | N/A | manual | toggle URL param in browser | — | ⬜ pending |
| 37-03-03 | 03 | 2 | R-FN-06 | — | N/A | unit | `yarn test tests/nature-labels.test.ts` | ❌ W0 | ⬜ pending |
| 37-04-01 | 04 | 3 | R-FN-07 | — | N/A | manual | create subcategory with nature in settings | — | ⬜ pending |
| 37-04-02 | 04 | 3 | R-FN-03 | — | N/A | manual | run seed script, verify nature values | — | ⬜ pending |
| 37-04-03 | 04 | 3 | R-FN-09 | — | excludeFromTotals still excludes transfers | unit | `yarn test tests/dashboard-dal.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Update `tests/dashboard-charts.test.tsx` — replace `Entrate`/`Uscite` label assertions with nature labels (`Essenziale`, `Discrezionale`, etc.)
- [ ] Add stubs for `getMonthlyTrendByNature` DAL function tests
- [ ] Add stubs for `nature-labels.ts` utility tests

*Existing infrastructure (Jest, `yarn test`) covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Nature toggle via click on Recharts legend updates URL `?hidden=` | R-FN-05 | Browser interaction, URL persistence | Load dashboard, click nature in legend, check URL bar; navigate away and back, verify state persists |
| Nature override Select inline in settings saves on-change | R-FN-07 | Server action side-effect | Open `/settings/categories`, change nature for a subcategory, refresh page, verify persisted |
| System subcategories seeded with correct natures | R-FN-03 | Seed script execution | Run `yarn seed:dev` on fresh DB, query `SELECT name, nature FROM sub_category WHERE is_system = true` |
| "Non classificato" segment appears for null-nature transactions | R-FN-06 | Data-dependent | Import transactions with subcategories having null nature; verify chart shows "Non classificato" segment |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
