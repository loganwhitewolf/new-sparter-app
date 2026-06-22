---
phase: 51-discovery-pipeline-reorder
plan: "02"
subsystem: dal
tags: [dal, drizzle, set-b, discovery, platform-join, tdd]
dependency_graph:
  requires: []
  provides:
    - "getUncategorizedExpensesForDiscovery(userId, platformId): UncategorizedExpenseForDiscovery[]"
    - "UncategorizedExpenseForDiscovery type"
  affects:
    - lib/services/regex-discovery.ts (Plan 51-03 consumes DAL output)
tech_stack:
  added: []
  patterns:
    - "DAL query with server-only guard, no cache(), no verifySession()"
    - "Platform join chain: expense → file → importFormatVersion → platform"
    - "Set B filter via isNull(expense.subCategoryId) — mirrors applyNewPatternToExpenses"
key_files:
  created:
    - lib/dal/regex-discovery.ts
    - tests/regex-discovery-dal.test.ts
  modified: []
decisions:
  - "Used isNull(expense.subCategoryId) as the sole Set B filter per RESEARCH resolution; covers statuses 1 and 4 without enumerating them"
  - "No cache() or verifySession() — userId passed as parameter, following loadActivePatterns pattern"
  - "No DbOrTx parameter — discovery is post-commit, never inside a transaction"
metrics:
  duration: "15min"
  completed: "2026-06-16"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 51 Plan 02: DAL Query — getUncategorizedExpensesForDiscovery Summary

**One-liner:** DAL query with three-join platform chain returning Set B (subCategoryId IS NULL) uncategorized expenses scoped by userId and platformId, server-only guarded, with unit tests asserting WHERE conditions and join count.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Add failing test for getUncategorizedExpensesForDiscovery | 953d15a | tests/regex-discovery-dal.test.ts |
| 1 (GREEN) | Implement getUncategorizedExpensesForDiscovery DAL query | 6dc63da | lib/dal/regex-discovery.ts |

## What Was Built

### lib/dal/regex-discovery.ts (NEW)

Exports `UncategorizedExpenseForDiscovery` type and `getUncategorizedExpensesForDiscovery(userId, platformId)` function:

- Starts with `import 'server-only'` — boundary guard (T-51-05)
- Three `leftJoin` calls: `expense → file → importFormatVersion → platform` (mirrors expenses.ts lines 183–185)
- WHERE clause: `and(eq(expense.userId, userId), eq(platform.id, platformId), isNull(expense.subCategoryId))`
  - `eq(expense.userId, userId)` — cross-user isolation (T-51-03)
  - `eq(platform.id, platformId)` — cross-platform isolation T-51-04; also implicitly excludes manually-created expenses with null importedFromFileId
  - `isNull(expense.subCategoryId)` — Set B signal per PIPE-01, mirrors applyNewPatternToExpenses line 38
- Returns `{ id, title, descriptionHash, descriptionStripPattern }` — descriptionStripPattern from platform table (PIPE-03)
- No `cache()` — not called from an RSC
- No `verifySession()` — auth responsibility lies with the caller service

### tests/regex-discovery-dal.test.ts (NEW)

Five unit tests using the mocked-db-query-chain pattern from expenses-dal.test.ts:

- `vi.hoisted` state for `whereArgs` and `leftJoinCount`
- `makeQueryChainWithFixture` stub recording leftJoin count and where arguments
- `vi.mock('drizzle-orm')` wrapping `and`/`eq`/`isNull` as opaque inspection objects
- Tests assert: fixture array returned, three leftJoins invoked, userId condition in WHERE, platformId condition in WHERE, isNull(subCategoryId) condition in WHERE

## Verification

```
npx vitest run tests/regex-discovery-dal.test.ts → PASS (5) FAIL (0)
head -1 lib/dal/regex-discovery.ts → import 'server-only'
grep isNull(expense.subCategoryId) → line 47 confirmed
grep eq(platform.id, platformId) → line 46 confirmed
grep eq(expense.userId, userId) → line 45 confirmed
Three leftJoin calls → lines 40, 41, 42 confirmed
yarn check:language → all failures are pre-existing (not from new files)
```

## Deviations from Plan

None — plan executed exactly as written.

TDD gate compliance:
- RED commit: 953d15a (test file, no implementation — suite error "Cannot find module")
- GREEN commit: 6dc63da (implementation — 5/5 tests passing)

## Known Stubs

None — the query returns real data columns from the expense and platform tables. No hardcoded empty values or placeholder text.

## Threat Flags

No new security-relevant surface beyond what the plan's threat_model covers. All three threats mitigated:

- T-51-03 (cross-user leakage): eq(expense.userId, userId) in WHERE — asserted by unit test
- T-51-04 (cross-platform leakage): eq(platform.id, platformId) in WHERE — asserted by unit test
- T-51-05 (server-only boundary): import 'server-only' is first line — acceptance criteria confirmed

## Self-Check: PASSED

- lib/dal/regex-discovery.ts exists: FOUND
- tests/regex-discovery-dal.test.ts exists: FOUND
- RED commit 953d15a: FOUND (git log confirmed)
- GREEN commit 6dc63da: FOUND (git log confirmed)
- All 5 tests pass: CONFIRMED
