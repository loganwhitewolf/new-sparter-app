---
slug: allocation-filter-dashboard
status: complete
completed: 2026-06-22
reconciled: 2026-07-07
---

# Quick Task allocation-filter-dashboard — Summary

**One-liner:** The "Risparmio" and "Investimento" chips in the dashboard
Accantonamento group are now interactive toggles, filtering the chart and
tooltip exactly like the Entrate/Uscite chips.

## Reconciliation note

Executed on 2026-06-22 (commit `3d99988` — "feat(dashboard): make allocation
chips (risparmio/investimento) filterable") but never closed with a SUMMARY, so
the milestone-close audit reported it as `missing`. Reconciled 2026-07-07:
implementation verified in the codebase against the PLAN's file list.

## Plan → implementation verification

- `overview-chart-utils.ts`: `deriveFilteredBarRow` and `deriveNatureBreakdown`
  accept `includedAllocation` and filter allocation keys ✓
- `overview-chart-filters.tsx`: `includedAllocation: Set<AllocationKey>` +
  `onToggleAllocation` props; allocation chips render as `FilterChip`;
  `allIncluded` checks all three groups ✓
- `overview-chart.tsx`: `includedAllocation` state (default all included),
  `handleToggleAllocation`, reset covers allocation, props flow to
  `OverviewChartFilters` and `NatureTooltip` ✓
- No DAL changes (UI-only, as planned) ✓

Test fixtures for the new required props were aligned on 2026-07-07 in commit
`c9dc08a` (overview-interactions.test.tsx).
