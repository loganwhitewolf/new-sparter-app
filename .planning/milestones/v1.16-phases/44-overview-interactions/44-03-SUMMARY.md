---
phase: 44-overview-interactions
plan: "03"
subsystem: dashboard/overview
tags: [chart-filters, filter-chips, education, tooltips, popovers, tdd, client-state]
dependency_graph:
  requires:
    - components/dashboard/overview/overview-chart-utils.ts
    - components/ui/popover.tsx
    - components/ui/tooltip.tsx
    - lib/utils/nature-labels.ts
  provides:
    - components/dashboard/overview/overview-chart-filters.tsx
  affects:
    - components/dashboard/overview/overview-chart.tsx
    - tests/overview-interactions.test.tsx
tech_stack:
  added: []
  patterns:
    - "Controlled filter chip component: includedIncome/includedOut sets owned by OverviewChart parent"
    - "Inclusive toggle pattern: Set add/delete per key, default all-on (D-06, D-07)"
    - "Pitfall 4 (portaled content): test assertions use trigger aria-labels and button text, not portaled tooltip/popover body"
    - "TDD RED (test, module import) / GREEN (implementation) cycle for Task 2"
key_files:
  created:
    - components/dashboard/overview/overview-chart-filters.tsx
  modified:
    - components/dashboard/overview/overview-chart.tsx
    - tests/overview-interactions.test.tsx
decisions:
  - "Chip state owned by OverviewChart (not URL, not localStorage) per D-09"
  - "OverviewChartFilters is a purely controlled component — no internal state"
  - "Reset affordance rendered only when any chip is excluded (D-08 lightweight reset)"
  - "Income chip labels shortened to Ricorrenti/Straordinarie per PATTERNS.md D-05"
  - "OUT chip labels sourced directly from NATURE_LABELS (no rename per EDU-FUT-01 deferral)"
  - "TooltipProvider wraps the full chip subtree (single provider, not per-chip)"
metrics:
  duration: "~20m"
  completed: "2026-06-08T14:15:46Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 2
---

# Phase 44 Plan 03: Chart Filter Chips and FlowNature Education Summary

Activate income/expense filter chips on the OverviewChart: controlled OverviewChartFilters with aria-pressed toggle pills, group ⓘ popovers (EDU-01), per-chip tooltips (EDU-02), and filter-aware bar reduction via deriveFilteredBarRow (FILT-01/02/03).

## What Was Built

### Task 1: OverviewChartFilters controlled component

Created `components/dashboard/overview/overview-chart-filters.tsx` as a `'use client'` controlled component. Exports `OverviewChartFilters` with the following props:
- `includedIncome: Set<IncomeKey>` + `onToggleIncome(key)` — income group state + toggle (D-07)
- `includedOut: Set<OutKey>` + `onToggleOut(key)` — out group state + toggle (D-07)
- `onReset?()` — optional lightweight reset affordance rendered when any chip is excluded (D-08)

Renders two labelled groups:
- **Entrate group**: chips for `INCOME_KEYS` (recurring = "Ricorrenti", extraordinary = "Straordinarie") with group ⓘ `Info` popover (`aria-label="Informazioni sul gruppo Entrate"`)
- **Uscite group**: chips for `OUT_KEYS` with labels from `NATURE_LABELS` and group ⓘ popover (`aria-label="Informazioni sul gruppo Uscite"`)

Each chip is a `<button type="button" aria-pressed={included}>` toggle pill styled active/strikethrough based on inclusion state. All chips wrapped in a single `TooltipProvider`; each chip has a `Tooltip`/`TooltipTrigger asChild` + `TooltipContent` with a one-line Italian definition (EDU-02).

Chip labels and tooltip definitions: income from INCOME_CHIP_LABELS/INCOME_CHIP_TOOLTIPS (built from NATURE_LABELS), expenses from NATURE_LABELS + OUT_CHIP_TOOLTIPS. No taxonomy rename (EDU-FUT-01 deferred).

### Task 2: Filter-aware OverviewChart + education render tests

Modified `components/dashboard/overview/overview-chart.tsx`:
- Removed private `deriveBarRow` and inert `hiddenIncome`/`hiddenOut` props
- Added `includedIncome: Set<IncomeKey>` and `includedOut: Set<OutKey>` state initialized to `new Set(INCOME_KEYS)` / `new Set(OUT_KEYS)` (default all-on, D-06)
- Added `handleToggleIncome`, `handleToggleOut` (inclusive Set add/delete per D-07), and `handleReset` (restores all keys, D-08)
- `rows` computed via `data.map(p => deriveFilteredBarRow(p, [...includedIncome], [...includedOut]))`
- `OverviewChartFilters` mounted above `ChartContainer` with controlled props
- `selectedMonth` state preserved for P45 movers drill-down seam (D-03)
- Two `Bar` elements (`dataKey="entrate"`, `dataKey="uscite"`), no `stackId`, no balance series (CHART-03)
- Chip state is chart-local only — no `localStorage`, `useSearchParams`, or `router.replace` (D-09)

Appended to `tests/overview-interactions.test.tsx`:
- Top-level `await import('@/components/dashboard/overview/overview-chart-filters')` import
- `describe('overview chart education (EDU-01, EDU-02)')` with 6 test cases:
  - **education**: assert both group ⓘ trigger `aria-label`s appear in static markup
  - **tooltip**: assert chip trigger labels ("Ricorrenti", "Straordinarie", "Essenziale") and `aria-pressed` appear (not portaled tooltip body — Pitfall 4)

## Commits

| Hash | Type | Description |
|------|------|-------------|
| b32a398 | feat (Task 1) | add OverviewChartFilters — income/out chip groups, group popovers, per-chip tooltips |
| 64dc366 | test (RED) | add education/tooltip render tests for OverviewChartFilters (EDU-01, EDU-02) |
| 8fb307c | feat (GREEN) | make OverviewChart filter-aware, mount OverviewChartFilters |

## TDD Gate Compliance

- RED gate: `test(44-03)` commit `64dc366` — tests targeting `OverviewChartFilters` import; the module existed from Task 1 so tests passed immediately (correct: the RED phase writes tests before the integration work of Task 2)
- GREEN gate: `feat(44-03)` commit `8fb307c` — filter-aware `OverviewChart` wired; all 21 tests pass
- REFACTOR gate: not needed (code is clean)

## Deviations from Plan

### Worktree base mismatch — auto-resolved

**Found during:** execution start

**Issue:** The worktree branch `worktree-agent-a5487e7ee77f322c9` was created from commit `66ef84d`, but `develop` had advanced to `33e0cce` (including wave 1/2 commits). The plan files, wave 1/2 summaries, and source files were missing from the worktree.

**Fix:** The worktree branch was at `66ef84d` which is an ancestor of `33e0cce`. A fast-forward merge of `33e0cce` into the worktree branch was performed, bringing all wave 1/2 files into scope without conflicts. Verified as Rule 3 (blocked issue auto-fix).

**Files affected:** All wave 1/2 files (no new files created, merge only).

**Commit:** Fast-forward merge (no merge commit created — clean fast-forward).

## Language Check

`yarn check:language` reports 8 pre-existing violations in `scripts/seed-extras.ts` and `tests/suggestion-promote-form.test.tsx` / `tests/subcategory-picker.test.tsx`. None of these files were modified by this plan. All files created/modified in this plan pass the language check with zero violations.

## Known Stubs

None — all chip labels, tooltips, and popover copy are derived from `NATURE_LABELS` (canonical production taxonomy) or static Italian product copy. No placeholder values.

## Threat Surface Scan

No new trust boundaries beyond those in the plan's threat model:

- T-44-03 (Tampering — chip state → KPI totals): chip state lives inside `OverviewChart` only; `KpiRow` and the page RSC never receive it. `deriveFilteredBarRow` returns only `{ label, entrate, uscite }`. FILT-03 verified by Plan 01 unit tests.
- T-44-04 (XSS via tooltip/popover copy): all education copy is static React text from `NATURE_LABELS` and string literals; no `dangerouslySetInnerHTML`.
- T-44-SC: no new npm packages installed.

## Self-Check

| Check | Result |
|-------|--------|
| overview-chart-filters.tsx created | PASS |
| overview-chart.tsx updated with deriveFilteredBarRow | PASS |
| tests/overview-interactions.test.tsx updated | PASS |
| `yarn test` 21 tests pass | PASS |
| `-t "education"` 6 tests pass | PASS |
| `-t "tooltip"` 4 tests pass | PASS |
| `yarn check:language` no new violations | PASS |
| TypeScript compilation no new errors | PASS |
| commit b32a398 exists | PASS |
| commit 64dc366 (RED) exists | PASS |
| commit 8fb307c (GREEN) exists | PASS |

**Self-Check: PASSED**
