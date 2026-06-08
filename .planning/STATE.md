---
gsd_state_version: 1.0
milestone: v1.16
milestone_name: Dashboard Overview Redesign
status: executing
stopped_at: Phase 44 complete — UAT 10/10 passed
last_updated: "2026-06-08T17:15:00.000Z"
last_activity: 2026-06-08 -- Phase 44 verified complete (UAT 10/10)
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 10
  completed_plans: 10
  percent: 75
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-07)

**Core value:** The user can safely import real bank transactions, see where their money goes categorized by month, and instantly spot deviations from their baseline spending — all running on a zero-cost personal deploy.
**Current focus:** Phase 45 — overview-movers

## Current Position

Phase: 44 (overview-interactions) — COMPLETE
Phase: 45 (overview-movers) — NEXT
Status: Ready to plan Phase 45
Last activity: 2026-06-08 -- Phase 44 verified complete (UAT 10/10)

Progress: [███████░░░] 75%

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

## Session Continuity

Last session: 2026-06-08T17:15:00Z
Stopped at: Phase 44 complete — UAT 10/10 passed
Resume file: .planning/phases/44-overview-interactions/44-CONTEXT.md

**Next:** `/gsd-plan-phase 45`
