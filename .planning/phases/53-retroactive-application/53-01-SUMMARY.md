---
phase: "53"
plan: "01"
subsystem: retroactive-application
tags: [dal, service, tdd, platform-scope, APPLY-02]
dependency_graph:
  requires: []
  provides:
    - getUncategorizedExpensesForPlatformApply (lib/dal/regex-discovery.ts)
    - getPlatformIdForUserFile (lib/dal/files.ts)
    - PatternApplyResult (lib/services/pattern-application.ts)
    - applyNewPatternToPlatformExpenses (lib/services/pattern-application.ts)
  affects:
    - lib/services/pattern-application.ts (new sibling function)
    - lib/dal/regex-discovery.ts (extended with apply query)
    - lib/dal/files.ts (extended with platform resolver)
tech_stack:
  added: []
  patterns:
    - Platform-scoped Set B DAL query mirroring discovery read scope (Phase 51 D-03)
    - PatternApplyResult structured return type from single-pass scan
    - TDD RED/GREEN commit gates
key_files:
  created:
    - tests/pattern-application.test.ts
  modified:
    - lib/dal/regex-discovery.ts
    - lib/dal/files.ts
    - lib/services/pattern-application.ts
    - tests/regex-discovery-dal.test.ts
decisions:
  - "Added getUncategorizedExpensesForPlatformApply as sibling (not in-place extension of discovery query) to keep apply SELECT shape independent (id, title, totalAmount vs id, title, descriptionHash, descriptionStripPattern)"
  - "applyNewPatternToPlatformExpenses is a new sibling function — legacy applyNewPatternToExpenses unchanged for createPatternAction user-wide path (APPLY-02 locked decision)"
  - "invalid regex returns { updatedCount: 0, notUpdatedCount: uncategorized.length } without throwing, matching legacy pattern"
  - "PatternApplyResult exported from service layer (single source of truth); Plan 02 imports from there"
metrics:
  duration: "3 minutes"
  completed_date: "2026-06-16"
  tasks: 2
  files: 5
---

# Phase 53 Plan 01: Platform Apply Foundation Summary

Platform-scoped retroactive apply foundation (APPLY-02): three new exports enabling Plan 02 `promoteSuggestionAction` integration — DAL query, file→platform resolver, and platform-bounded apply service with structured counts.

## What Was Built

### DAL: `getUncategorizedExpensesForPlatformApply` (lib/dal/regex-discovery.ts)

Write-path mirror of `getUncategorizedExpensesForDiscovery` from Phase 51. Identical `expense → file → importFormatVersion → platform` join chain and `AND(eq(expense.userId), eq(platform.id), isNull(expense.subCategoryId))` WHERE. SELECT shape differs: `{ id, title, totalAmount }` for the apply matcher loop instead of `{ id, title, descriptionHash, descriptionStripPattern }`.

Platform scope is enforced at the DB layer: manual expenses without `importedFromFileId` are excluded by the `leftJoin + eq(platform.id)` filter — intentional per D-03 locked decision (Pitfall 4 accepted).

### DAL: `getPlatformIdForUserFile` (lib/dal/files.ts)

Single-row resolver joining `file → importFormatVersion → platform` with `eq(file.id, fileId) AND eq(file.userId, userId)`. Returns `number | null`. Ownership enforced in WHERE — cross-user access returns null. Accepts `DbOrTx` defaulting to `db`, consistent with other file helpers.

### Service: `PatternApplyResult` + `applyNewPatternToPlatformExpenses` (lib/services/pattern-application.ts)

New sibling to legacy `applyNewPatternToExpenses`. Key differences:
- Calls `getUncategorizedExpensesForPlatformApply(userId, platformId)` instead of inline query (no platform filter in legacy)
- Returns `PatternApplyResult { updatedCount, notUpdatedCount }` instead of `number`
- `notUpdatedCount = uncategorized.length - matchingIds.length` (single pass)
- Matcher (normalized + numeric-stripped dual-test) copied verbatim from lines 52–61 of legacy function to preserve Tier-1 fidelity (Pitfall 6)
- Invalid regex: returns `{ updatedCount: 0, notUpdatedCount: uncategorized.length }` without throwing
- Legacy `applyNewPatternToExpenses` body: UNCHANGED (grep: zero `platformId` occurrences in legacy function)

## Commits

| Task | Type | Hash | Description |
|------|------|------|-------------|
| 1 — RED | test | fb564af | Failing tests for applyNewPatternToPlatformExpenses + DAL WHERE contract |
| 2 — GREEN | feat | e619b56 | Implement platform DAL helpers + applyNewPatternToPlatformExpenses |

## TDD Gate Compliance

- RED commit: `test(53-01): fb564af` — 13 new tests, all failing (`TypeError: ... is not a function`)
- GREEN commit: `feat(53-01): e619b56` — all 25 tests pass

Gate sequence: RED → GREEN confirmed.

## Test Coverage

`tests/pattern-application.test.ts` (8 tests, all new):
- Platform boundary: DAL called with correct `(userId, platformId)` pair
- Platform isolation: only mocked platform rows processed; other platforms never passed in
- Count semantics: `{ 2, 1 }` when 3 scanned 2 match; `{ 0, scanned }` no match; `{ 0, 0 }` empty scope
- Invalid regex: `{ 0, scanned }` without throwing
- Numeric-stripped dual match: `"***** 114 data operazione"` matches via strip when number token removed
- History writes: `writeClassificationHistory` called per matched expense with `source: 'user_pattern'`

`tests/regex-discovery-dal.test.ts` (5 new tests added):
- Returns DAL fixture
- Exactly 3 leftJoins (file, importFormatVersion, platform)
- WHERE: `eq(expense.userId)`, `eq(platform.id)`, `isNull(expense.subCategoryId)`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no placeholder values or TODO data flows in the implemented code.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Threat mitigations from plan `<threat_model>`:

- **T-53-01** (cross-platform writes): mitigated — `eq(platform.id, platformId)` in DAL WHERE + test asserting platform boundary
- **T-53-02** (Set A re-categorization): mitigated — `isNull(expense.subCategoryId)` in SELECT + `inArray(expense.id, matchingIds)` in UPDATE restricts to scanned set only
- **T-53-03** (invalid regex DoS): accepted — invalid regex returns `{ 0, scanned }` gracefully

## Self-Check: PASSED

Files verified:
- `lib/dal/regex-discovery.ts` — FOUND, contains `getUncategorizedExpensesForPlatformApply`
- `lib/dal/files.ts` — FOUND, contains `getPlatformIdForUserFile`
- `lib/services/pattern-application.ts` — FOUND, contains `applyNewPatternToPlatformExpenses` + `PatternApplyResult`
- `tests/pattern-application.test.ts` — FOUND, 8 tests
- `tests/regex-discovery-dal.test.ts` — FOUND, extended with 5 new tests

Commits verified: `fb564af` (RED), `e619b56` (GREEN) — both in git log.
