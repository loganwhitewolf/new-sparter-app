# Roadmap

## M001: M001: Migration

- [x] **Phase 01: design-system** — Design System
- [x] **Phase 02: authentication** — Authentication
- [x] **Phase 03: expense-management** — Expense Management
- [x] **Phase 04: dashboard-kpi** — Dashboard Kpi
- [x] **Phase 05: s05** — S05
- [x] **Phase 06: s06** — S06
- [x] **Phase 07: s07** — S07

## M002: Observability

- [x] **Phase 08: s01** — S01
- [x] **Phase 09: s02** — S02
- [x] **Phase 10: s03** — S03

## M003: Transactions, Deduplication & Inline Categorization


## M004: Import Management

- [x] **Phase 11: s01** — S01
- [x] **Phase 12: s02** — S02
- [x] **Phase 13: s03** — S03
- [x] **Phase 14: s04** — S04
- [x] **Phase 15: s05** — S05
- [x] **Phase 16: s06** — S06

## M005: Category Management & UX Polish

- [x] **Phase 17: s01** — S01
- [x] **Phase 18: s02** — S02
- [x] **Phase 19: s03** — S03
- [x] **Phase 20: s04** — S04

## M006: Dashboard Insight Suite

- [x] **Phase 21: s01** — S01
- [x] **Phase 22: s02** — S02
- [x] **Phase 23: s03** — S03

## ✅ M007: Zero-cost Production Deploy — SHIPPED 2026-05-19

- [x] **Phase 24: s01** — S01 (env contract + DB pool config)
- [x] **Phase 25: s02** — S02 (production migration CLI)
- [x] **Phase 26: s03** — S03 (R2 upload + CORS)
- [x] **Phase 27: s04** — S04 (registration guardrail)
- [x] **Phase 28: s05** — S05 (runbook + smoke suite)

## M008: Dashboard Intelligence

- [ ] **Phase 29: dashboard-intelligence** — Deviation view + chart clarity

  **Goal:** Make the dashboard actionable at a glance: deviation view (vs 3-month baseline of the last completed calendar month) on category pages, plus the MonthlyTrendChart split into clearer Entrate/Uscite bars and a per-month colored Bilancio bar chart.

  **Plans:** 4 plans

  Plans:
  - [ ] 29-01-PLAN.md — Wave 0: D-01 last-month bug fix, deviation utilities (computeDeviation, buildDeviationMap), failing test scaffolds for downstream waves
  - [ ] 29-02-PLAN.md — Wave 1: getCategoryDeviations DAL + DeviationBadge component (depends on 29-01)
  - [ ] 29-03-PLAN.md — Wave 1: Split MonthlyTrendChart into EntrateUsciteChart + BilancioBarsChart and wire into overview page (depends on 29-01, parallel with 29-02)
  - [ ] 29-04-PLAN.md — Wave 2: Wire deviation into /dashboard/categories and /dashboard/categories/[id], add sort toggle (depends on 29-01, 29-02; contains manual checkpoint)
</content>
