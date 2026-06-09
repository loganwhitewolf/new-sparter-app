---
gsd_state_version: 1.0
milestone: v1.16
milestone_name: Dashboard Overview Redesign
status: Awaiting next milestone
stopped_at: Phase 45 context gathered
last_updated: "2026-06-09T08:57:34.051Z"
last_activity: 2026-06-09 — Milestone v1.16 completed and archived
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 13
  completed_plans: 13
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-07)

**Core value:** The user can safely import real bank transactions, see where their money goes categorized by month, and instantly spot deviations from their baseline spending — all running on a zero-cost personal deploy.
**Current focus:** Phase 45 — overview-movers

## Current Position

Phase: Milestone v1.16 complete
Plan: —
Status: v1.17 released (tag on develop) — develop→main open as PR #16
Last activity: 2026-06-09 - Shipped v1.17; opened/updated PR #16 (develop → main)

## Accumulated Context

### Decisions

All milestones M001–v1.15 complete. Full decision log in PROJECT.md.

v1.16 design decisions (LOCKED — do not re-open):

- Chart variant A: side-by-side Entrate/Uscite bars, no stack-by-nature, no balance series
- Header H1: year-selector pill inline on same row as title
- KPIs: 4 cards only (drop "Da categorizzare"); qualitative reading line per card
- Nudge: inline amber on title row, localStorage dismiss, lastSeenCount reappear logic, OUT-only count
- Movers: per-month drill-down via recharts bar click (not static last-two-months block)
- FlowNature taxonomy rename deferred to future quick task (EDU-FUT-01)

### Planning Risk

FILT-01 (income recurring/extraordinary split) is an open question that may touch the schema: does it map to existing `nature` on the `in` side (`income` vs `extraordinary`) or require a dedicated field? Resolve in Phase 42 planning before writing DAL code.

### Blockers/Concerns

None.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260609-fru | Dashboard overview prototype fixes (movers top-5 + colors, chart per-nature tooltip, nudge on title row, conditional KPI reading, remove highlight rect, two-row nature legend) | 2026-06-09 | 5ebd690 | [260609-fru-dashboard-prototype-fixes-movers-top5-co](./quick/260609-fru-dashboard-prototype-fixes-movers-top5-co/) |

## Deferred Items

| Category | Item | Status |
|----------|------|--------|
| quick_task | 260524-pha | empty dir — dup of pnk variant |
| quick_task | 260524-pnk | shipped (889ae56) |
| quick_task | 260525-ga2 | shipped (4a722f2) |
| quick_task | 260530-bib-description-strip-pattern | shipped migration 0015 |
| operator | R038/R039/R041 | live deploy operator-pending |
| backlog | R029 | partial revalidation coverage |
| backlog | REVAL-01 | parked |

Items acknowledged and deferred at milestone close on 2026-06-09:

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Phase 43 43-UAT.md — 4 pending scenarios | testing |
| uat_gap | Phase 45 45-UAT.md — 6 pending scenarios | passed |
| verification_gap | Phase 43 43-VERIFICATION.md | human_needed |
| verification_gap | Phase 44 44-VERIFICATION.md | human_needed |

## Session Continuity

Last session: 2026-06-08T15:28:53.161Z
Stopped at: Phase 45 context gathered
Resume file: .planning/phases/45-overview-movers/45-CONTEXT.md

**Next:** `/gsd-plan-phase 45`

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
