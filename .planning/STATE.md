---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Nature/Direction Model Realignment
status: planning
last_updated: "2026-06-10"
last_activity: 2026-06-10
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-10)

**Core value:** The user can safely import real bank transactions, see where their money goes categorized by month, and instantly spot deviations from their baseline spending — all running on a zero-cost personal deploy.
**Current focus:** Phase 46 — direction-nature-schema

## Current Position

Phase: 0 of 5 (roadmap created, ready to plan Phase 46)
Plan: —
Status: Ready to plan
Last activity: 2026-06-10 — v2.0 roadmap created (Phases 46–50)

Progress: [░░░░░░░░░░] 0%

## Accumulated Context

### Decisions

Design contract is LOCKED. Do not re-open or re-derive the data model:
- ADR 0012: direction derived from nature; 4th direction `allocation`; `category.type` removed
- CONTEXT.md: canonical nature/direction vocabulary + categorization rules
- `.planning/nature-remapping-WORKING.md`: 23 categories / ~65 subcats / 9 natures — final remap confirmed 2026-06-09

Key constraints active for v2.0:
- Migrations: `drizzle-kit generate` + `scripts/migrate.ts` only — never `drizzle-kit push`
- Seeds: additive model — append steps to `seed-extras.ts`, never edit shipped `seed-data.ts` shapes
- Monetary arithmetic: Decimal.js throughout
- Layering: dal / services / actions

### Planning Risk

**8-vs-9 nature row count:** ADR 0012 "Consequences" enumerates 8 natures; the ADR data-model section and the working-doc summary both say 9. DATA-02 is written against the enumerated 8. Resolve in Phase 46 planning before building the `nature` table. Options: (a) 8 is correct and "9" references are stale; (b) a 9th row such as `uncategorized`/null-sentinel nature is intended.

### Blockers/Concerns

None.

### Quick Tasks Completed (carried from v1.16)

| # | Description | Date | Commit |
|---|-------------|------|--------|
| 260609-fru | Dashboard overview prototype fixes | 2026-06-09 | 5ebd690 |
| 260609-k2d | Transactions nature + in/out/transfer filters; 7 UI fixes | 2026-06-09 | cdc5997 |
| 260609-lcp | Cascading filters (type→nature, category→subcat); amount sign strip | 2026-06-09 | ffd4fc3 |

## Deferred Items

| Category | Item | Status |
|----------|------|--------|
| operator | R038/R039/R041 | live deploy operator-pending |
| backlog | R029 | partial revalidation coverage |
| backlog | REVAL-01 | parked |

## Session Continuity

Last session: 2026-06-10
Stopped at: Roadmap created for v2.0 (Phases 46–50)
Resume file: None

**Next:** `/gsd-plan-phase 46`
