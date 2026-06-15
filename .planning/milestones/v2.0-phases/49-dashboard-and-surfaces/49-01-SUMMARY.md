---
phase: 49-dashboard-and-surfaces
plan: "01"
subsystem: tests
tags: [tdd, red-tests, dashboard, cascade-options, money-correctness]
dependency_graph:
  requires: []
  provides:
    - RED tests pinning ADR 0012 algebraic-sum contract (DASH-01/02/03/04)
    - RED test pinning buildDirectionNatureMap direction-keying contract (CAT-01)
  affects:
    - tests/dashboard-dal.test.ts
    - tests/overview-dal.test.ts
    - tests/cascade-options.test.ts
tech_stack:
  added: []
  patterns:
    - "@ts-expect-error for compile-time RED pinning on non-existing fields"
    - "direction.includedInTotals mock replacing stale excludeFromTotals/nature mocks"
key_files:
  created: []
  modified:
    - tests/dashboard-dal.test.ts
    - tests/overview-dal.test.ts
    - tests/cascade-options.test.ts
decisions:
  - "savingsRate expected value corrected to 33.3 (computeSavingsRate rounds to 1dp, not to integer — RESEARCH.md said 33 but function uses toDecimalPlaces(1))"
  - "buildDirectionNatureMap imported with @ts-expect-error rather than a separate dynamic import — simpler and produces identical RED behavior since the export does not exist"
metrics:
  duration: "~5 minutes"
  completed: "2026-06-12"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 3
---

# Phase 49 Plan 01: Wave 0 RED money-correctness + cascade-options tests Summary

Wave 0 test-first slice: committed RED automated tests that pin the four money-correctness behaviors (ADR 0012) plus the cascade-options direction-keying contract. All 12 new tests are RED at commit time — they serve as the executable acceptance contract for Plans 02/03/05.

## What Was Built

Three test files extended/created with RED acceptance tests:

### tests/dashboard-dal.test.ts

- Updated schema mock: removed stale `subCategory.excludeFromTotals` and `subCategory.nature` fields (Pitfall 6); added `direction.includedInTotals`, `direction.code`, `nature.directionId`, `subCategory.natureId`.
- Added `describe('DASH money-correctness (Phase 49 — ADR 0012)')` with 5 failing tests:
  - **DASH-02 refund netting**: `+€30` refund under OUT direction lowers `totalOut` to `'70.00'` (not `'100.00'` or `'130.00'`)
  - **DASH-03 allocation isolation**: `-€500` savings deposit → `totalAllocation === '500.00'`, `totalOut === '0.00'`
  - **DASH-02 net divestment**: `+€800` deposit + `+€300` divestment nets to `'500.00'` (algebraic, not `'1100.00'`)
  - **DASH-01 transfer exclusion**: transfer direction → `totalIn`, `totalOut`, `totalAllocation` all `'0.00'`
  - **DASH-04 savings rate**: `(3000−2000)/3000*100 = 33.3` with `totalAllocation` excluded from denominator

### tests/overview-dal.test.ts

- Added test in `describe('getOverviewChart')`: allocation bucket assertion — `jan.allocation` must be defined with `savings` and `investment` keys; `jan.out` must NOT contain those keys.

### tests/cascade-options.test.ts

- Added import `buildDirectionNatureMap` (with `@ts-expect-error`) from `@/lib/utils/cascade-options`
- Added direction-aware taxonomy fixture: categories with `type` = `'out'`, `'allocation'`, `'in'`, `'system'`, `null`
- Added `describe('buildDirectionNatureMap (Phase 49 — CAT-01)')` with 6 failing tests:
  - Returns record keyed by direction code
  - `result['allocation']` non-empty, contains `savings` + `investment`
  - `result['out']` contains `essential` + `discretionary`, NOT `savings`/`investment`
  - `type === null` skipped without crash; valid buckets still produced
  - `type === 'system'` excluded from all buckets
  - Empty input returns `{}`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] savingsRate expected value corrected from 33 to 33.3**
- **Found during:** Task 1 DASH-04 test execution
- **Issue:** RESEARCH.md Key Correctness Assertions specified `expect(result.savingsRate).toBe(33)` with the note "existing computeSavingsRate rounds". However, `computeSavingsRate` in `lib/utils/dashboard.ts` uses `toDecimalPlaces(1)` which yields 33.3, not 33.
- **Fix:** Updated assertion to `toBe(33.3)`. Added comment explaining the distinction and the wrong-case value (16.7 if allocation were included in denominator).
- **Files modified:** tests/dashboard-dal.test.ts
- **Commit:** cc068d4

## TDD Gate Compliance

This plan is `type: tdd`, Wave 0 — RED phase only.

| Gate | Status | Notes |
|------|--------|-------|
| RED committed | PASSED | `test(49-01)` commits land before any production code |
| GREEN | DEFERRED | Plans 02/03 (DASH) and Plan 05 (CAT-01) will turn these GREEN |
| REFACTOR | N/A | No production code in this plan |

## Test Run Evidence

```
Test Files  3 failed | 77 passed (80)
Tests       12 failed | 957 passed | 1 todo (970)
```

12 new RED tests; all failures reference `totalAllocation`, `allocation` bucket, or `buildDirectionNatureMap` — proving they target the new contract, not typos.

## Known Stubs

None — this plan only authors test files; no production code stubs introduced.

## Threat Flags

None — test-only plan; no runtime trust boundaries introduced.

## Self-Check: PASSED

Verified:
- `tests/dashboard-dal.test.ts` contains `totalAllocation` (30 occurrences): YES
- `tests/dashboard-dal.test.ts` contains `'70.00'` assertion: YES
- `tests/dashboard-dal.test.ts` contains `'500.00'` assertion: YES
- `tests/overview-dal.test.ts` contains `.allocation` bucket assertion: YES
- `yarn test -- dashboard-dal overview-dal cascade-options` exits non-zero (12 failures): YES
- No `subCategory.excludeFromTotals` or `subCategory.nature` in schema mock: YES (removed)
- Commits cc068d4 and afc7389 exist in git log: YES
