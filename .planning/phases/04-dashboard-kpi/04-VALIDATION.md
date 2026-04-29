---
phase: 4
slug: dashboard-kpi
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-28
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright |
| **Config file** | `playwright.config.ts` (root) |
| **Quick run command** | `npx playwright test tests/dashboard.spec.ts` |
| **Full suite command** | `npx playwright test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test tests/dashboard.spec.ts --reporter=list`
- **After every plan wave:** Run `npx playwright test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-00-01 | 00 | 0 | DASH-01 | — | N/A | stub | `npx playwright test tests/dashboard.spec.ts` | ❌ W0 | ⬜ pending |
| 04-00-02 | 00 | 0 | DASH-01 | — | N/A | install | `npx shadcn@latest add chart` exits 0 | ❌ W0 | ⬜ pending |
| 04-01-01 | 01 | 1 | DASH-01 | T-4-01 | session verified before DAL call | unit | `npx playwright test tests/dashboard.spec.ts -g "DASH-01"` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | DASH-01 | T-4-01 | userId scoped in all queries | E2E smoke | `npx playwright test tests/dashboard.spec.ts -g "delta"` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | DASH-02 | T-4-02 | preset param validated with Zod | E2E | `npx playwright test tests/dashboard.spec.ts -g "DASH-02"` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | DASH-03 | T-4-02 | type param validated with Zod | E2E | `npx playwright test tests/dashboard.spec.ts -g "DASH-03"` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 3 | DASH-01 | — | N/A | E2E smoke | `npx playwright test tests/dashboard.spec.ts -g "KPI"` | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 3 | DASH-02 | — | N/A | E2E | `npx playwright test tests/dashboard.spec.ts -g "breakdown"` | ❌ W0 | ⬜ pending |
| 04-03-03 | 03 | 3 | DASH-03 | — | N/A | E2E smoke | `npx playwright test tests/dashboard.spec.ts -g "trend"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/dashboard.spec.ts` — stubs for DASH-01, DASH-02, DASH-03 with fixme gates for DB-dependent assertions
- [ ] `npx shadcn@latest add chart` — installs `components/ui/chart.tsx` + recharts
- [ ] `npx shadcn@latest add tabs` — installs `components/ui/tabs.tsx` (or confirm Button-group alternative)
- [ ] Move `periodToDateRange` from `lib/dal/expenses.ts` → `lib/utils/date.ts`
- [ ] Create `lib/utils/dashboard.ts` with pure functions: `computeSavingsRate(totalIn, totalOut)`, `computeBreakdownPercentages(rows)` — unit testable without DB

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Legend click toggles series bar visibility | DASH-03 | DOM introspection of SVG bars unreliable in Playwright | Click legend item → confirm bar disappears visually |
| Horizontal bar drill-down accordion animation | DASH-02 | Animation state difficult to assert | Click category row → subcategory rows expand smoothly |
| Mobile 2-column card layout | DASH-01 | Requires visual viewport check | Open at 375px width → confirm 2×2+1 card layout |
| Color accuracy (emerald/red) on KPI deltas | DASH-01 | CSS variable rendering | Negative delta shows red, positive shows emerald |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
