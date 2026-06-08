---
phase: 44-overview-interactions
plan: "01"
subsystem: dashboard/overview
tags: [chart-utils, filter-helpers, tdd, pure-function, decimal]
dependency_graph:
  requires: []
  provides:
    - components/dashboard/overview/overview-chart-utils.ts
    - tests/overview-interactions.test.tsx
  affects:
    - components/dashboard/overview/overview-chart.tsx
tech_stack:
  added: []
  patterns:
    - "Pure utility module (no 'use client', no React, no I/O) — co-located with chart"
    - "TDD RED/GREEN cycle: test committed first, implementation committed second"
    - "Decimal-safe accumulation: toDecimal().plus() at every step, Number() only at Recharts boundary"
key_files:
  created:
    - components/dashboard/overview/overview-chart-utils.ts
    - tests/overview-interactions.test.tsx
  modified: []
decisions:
  - "Chose Record<string,string> for sumSelected parameter instead of narrower types to allow both income and out maps without overloads"
  - "TDD RED commit (848d322) committed before GREEN (b32ea17) — gate compliance verified"
metrics:
  duration: "4m 20s"
  completed: "2026-06-08T13:55:30Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 44 Plan 01: Chart Utils and Test Scaffold Summary

Pure filter-aware chart reduction helpers extracted from overview-chart.tsx private function, plus Wave 0 test scaffold for Phase 44 filter interactions (FILT-01/02/03).

## What Was Built

### Task 1: Extract pure filter-aware chart reduction helpers

Created `components/dashboard/overview/overview-chart-utils.ts` as a pure utility module (no `'use client'`, no React, no server boundary). Exports:

- `OUT_KEYS` — array of all 6 OUT nature keys as `const`
- `INCOME_KEYS` — array of both income nature keys as `const`
- `OutKey`, `IncomeKey` — derived types
- `sumSelected(values, includedKeys)` — Decimal-safe accumulation starting from `toDecimal('0.00')`, tolerates missing keys
- `deriveFilteredBarRow(point, includedIncome, includedOut)` — returns `{ label, entrate, uscite }` with `Number()` conversion only at the Recharts boundary

The function is a generalization of the private `deriveBarRow` in `overview-chart.tsx` that previously summed ALL buckets unconditionally. The new version accepts inclusion arrays, enabling Plans 02-03 to slice by selected filter chips.

### Task 2: Seed the shared Phase 44 test file

`tests/overview-interactions.test.tsx` was created as part of the TDD RED phase (Task 1) and already contains all required test cases:

- **income** test: toggling extraordinary income off drops entrate by exactly 200
- **expense** test: selecting only essential yields uscite = 300
- **KPI** independence test: returned row has exactly { label, entrate, uscite } keys
- all-off case: empty selections return { entrate: 0, uscite: 0 }, row still returned
- full-selection: all buckets totals match expected sums (1200 entrate, 650 uscite)
- `sumSelected` unit tests: partial keys, empty keys, missing key tolerance

All 8 tests pass. The file is the shared scaffold for Plans 02-03 to append to.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 848d322 | test (RED) | add failing tests for overview-chart-utils filter helpers |
| b32ea17 | feat (GREEN) | add overview-chart-utils — pure filter-aware chart reduction helpers |

## TDD Gate Compliance

- RED gate: `test(44-01)` commit `848d322` — tests failed (import error, module not found)
- GREEN gate: `feat(44-01)` commit `b32ea17` — all 8 tests pass
- REFACTOR gate: not needed (code is clean, no duplication to eliminate)

## Deviations from Plan

None — plan executed exactly as written.

The TDD process resulted in the test file being complete and fully correct at the RED phase. Task 2 added no new content (the test file created in Task 1 already satisfied all Task 2 requirements). This is expected when a well-specified TDD task produces a comprehensive test file.

## Threat Surface Scan

No new trust boundaries introduced. The utility is pure (no I/O, no network, no storage, no React, no server boundary). T-44-03 mitigation (FILT-03) verified: `deriveFilteredBarRow` returns only `{ label, entrate, uscite }` — KPI independence test asserts this at the unit level.

## Self-Check

| Check | Result |
|-------|--------|
| overview-chart-utils.ts exists | PASS |
| overview-interactions.test.tsx exists | PASS |
| 44-01-SUMMARY.md exists | PASS |
| commit 848d322 exists | PASS |
| commit b32ea17 exists | PASS |

**Self-Check: PASSED**
