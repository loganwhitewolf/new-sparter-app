---
phase: 68-tags-dashboard-and-navigation
plan: 02
subsystem: database
tags: [drizzle, postgres, tags, dashboard]

# Dependency graph
requires:
  - phase: 68-tags-dashboard-and-navigation (Plan 01)
    provides: tagScopedTransactions(tagId) shared WHERE-EXISTS predicate
provides:
  - "getUncategorizedCount(userId, from, to, tagId?) — trailing optional tagId, narrows via tagScopedTransactions"
  - "getOverviewAmountTotals(userId, from, to, tagId?) — trailing optional tagId, narrows via tagScopedTransactions"
  - "getCategoryRanking(filters, tagId?) — trailing optional tagId, narrows via tagScopedTransactions"
  - "CategoryDeviationsInput.tagId — consumed by getCategoryDeviations, applied to BOTH its parallel reference/baseline queries"
  - "getCategoryDetail(categoryId, filters, tagId?) — trailing optional tagId, applied to all 3 of its data-bearing queries (trend, subcategory breakdown, top transactions); metadata lookup untouched"
affects: [68-03, 68-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "WHERE-EXISTS predicate for N:M tag scoping, slotted into existing and(...) WHERE arrays alongside isNotSecondary() — same idiom as the existing typeFilter/categoryScope conditional-filter convention"

key-files:
  created: []
  modified:
    - lib/dal/dashboard.ts
    - tests/dashboard-dal.test.ts

key-decisions:
  - "tests/dashboard-dal.test.ts previously mocked @/lib/db as a bare {} (only pure builder functions were under test) — extended it with a real chain mock (from/leftJoin/innerJoin/where/groupBy/orderBy/limit, all returning the same thenable chain object) so the 5 actual DB-querying exports could be invoked directly and their WHERE conditions inspected"
  - "No drizzle-orm mock was added — verified empirically that the real and()/eq()/sql() functions from drizzle-orm work fine against the file's existing plain-string schema-column mocks, producing inspectable serializable query-chunk trees (JSON.stringify + substring check for 'transaction_tag' and the tagId value)"

patterns-established:
  - "findTagCondition/hasTagCondition helpers in tests/dashboard-dal.test.ts: JSON.stringify a where() arg and substring-search for the EXISTS(transaction_tag) fragment and tagId value — reusable for any later dashboard.ts/overview.ts tagId test"

requirements-completed: [TAG-04]

coverage:
  - id: D1
    description: "getUncategorizedCount and getOverviewAmountTotals accept an optional trailing tagId; no tagId leaves the WHERE unchanged, tagId=5 adds the EXISTS(transaction_tag) fragment"
    requirement: "TAG-04"
    verification:
      - kind: unit
        ref: "tests/dashboard-dal.test.ts#getUncategorizedCount / getOverviewAmountTotals tagId threading (68-02, TAG-04)"
        status: pass
    human_judgment: false
  - id: D2
    description: "getCategoryRanking accepts a trailing tagId and narrows correctly; CategoryDeviationsInput carries tagId and getCategoryDeviations applies it to BOTH its parallel reference and baseline queries"
    requirement: "TAG-04"
    verification:
      - kind: unit
        ref: "tests/dashboard-dal.test.ts#getCategoryRanking / getCategoryDeviations tagId threading (68-02, TAG-04)"
        status: pass
    human_judgment: false
  - id: D3
    description: "getCategoryDetail accepts a trailing tagId and applies it to all 3 of its data-bearing queries (trend, subcategory breakdown, top transactions) while leaving the category-metadata lookup query untouched — the resolved Open Question #2 (drill-down page narrows too)"
    requirement: "TAG-04"
    verification:
      - kind: unit
        ref: "tests/dashboard-dal.test.ts#getCategoryDetail tagId threading (68-02, TAG-04, resolved Open Question #2)"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-07-21
status: complete
---

# Phase 68 Plan 02: Dashboard DAL Tag Threading Summary

**Five `lib/dal/dashboard.ts` exports (`getUncategorizedCount`, `getOverviewAmountTotals`, `getCategoryRanking`, `getCategoryDeviations`, `getCategoryDetail`) now accept an optional trailing `tagId` and narrow via the shared `tagScopedTransactions()` EXISTS predicate — fully backward-compatible when omitted, and including the category drill-down page per the phase's resolved Open Question #2.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-07-21T11:52:26Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- `getUncategorizedCount(userId, from, to, tagId?)` and `getOverviewAmountTotals(userId, from, to, tagId?)` narrow via `tagScopedTransactions(tagId)` — the two functions `lib/dal/overview.ts`'s `getOverview` (Plan 68-03) will call directly
- `getCategoryRanking(filters, tagId?)` narrows its single aggregate query; `CategoryDeviationsInput.tagId` is applied to BOTH of `getCategoryDeviations`'s parallel reference/baseline queries (missing either would silently skew deviation math for tag-filtered views)
- `getCategoryDetail(categoryId, filters, tagId?)` narrows all 3 of its data-bearing queries (trend, subcategory breakdown, top transactions) — the RESOLVED Open Question #2: the drill-down page narrows too, since TAG-04's "every widget narrows" is taken literally. Its category-metadata-only lookup query is untouched (no transaction join to scope).
- All 5 signatures are purely additive (trailing optional parameter) — no existing 3-arg/2-arg/1-arg call site anywhere in the codebase needed updating; verified with the full test suite (1674 passed, 1 pre-existing todo) and `tsc --noEmit` clean on all touched files.
- Extended `tests/dashboard-dal.test.ts` with a real chain-based `@/lib/db` mock (this file previously mocked `db` as a bare `{}` since only pure builder functions were under test) — added 10 new test cases covering both the no-tagId regression path and the tagId-narrowing path for all 5 functions.

## Task Commits

Each task was committed atomically:

1. **Task 1: Thread tagId through getUncategorizedCount + getOverviewAmountTotals** - `92fb98b` (feat)
2. **Task 2: Thread tagId through getCategoryRanking + getCategoryDeviations** - `280c56f` (feat)
3. **Task 3: Thread tagId through getCategoryDetail (category drill-down, resolved Open Question #2)** - `8992947` (feat)

## Files Created/Modified
- `lib/dal/dashboard.ts` - Added `tagScopedTransactions` import; threaded optional trailing `tagId` through 5 exports (`getUncategorizedCount`, `getOverviewAmountTotals`, `getCategoryRanking`, `getCategoryDeviations` via `CategoryDeviationsInput.tagId`, `getCategoryDetail`)
- `tests/dashboard-dal.test.ts` - Replaced the bare `db: {}` mock with a real chain mock (from/leftJoin/innerJoin/where/groupBy/orderBy/limit, thenable); added `verifySession` resolved-value setup and `beforeEach` reset; added 10 new test cases across 3 new `describe` blocks covering all 5 functions' tagId threading

## Decisions Made
- Extended `tests/dashboard-dal.test.ts`'s mock infrastructure (previously `db: {}`, exercising only pure builder functions) with a full chain mock, rather than mocking `drizzle-orm` itself — empirically verified the real `and()`/`eq()`/`sql()` functions work correctly against the file's existing plain-string schema-column mocks, producing serializable query-chunk trees inspectable via `JSON.stringify` + substring search. This kept the change additive to the existing file's style instead of introducing the heavier `drizzle-orm` full-mock pattern used in `tests/transactions-dal.test.ts`.
- Added test coverage for all 5 functions in this task, even though the plan's `<tasks>` `<action>` blocks only specified implementation — the plan's own `<verification>` block ("covering both the no-tagId regression path and the tagId-narrowing path for all 5 functions") and per-task `<acceptance_criteria>` explicitly required this behavior to be testable, and 68-RESEARCH.md's sampling table calls for extending `tests/dashboard-dal.test.ts`. Applied under deviation Rule 2 (missing critical functionality — test coverage required by the plan's own acceptance criteria).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added chain-mock test infrastructure + tagId test coverage for all 5 functions**
- **Found during:** Task 1 (before writing any test)
- **Issue:** `tests/dashboard-dal.test.ts` mocked `@/lib/db` as a bare `{}`, meaning none of the actual async DB-querying functions (`getUncategorizedCount`, `getOverviewAmountTotals`, `getCategoryRanking`, `getCategoryDeviations`, `getCategoryDetail`) could be invoked or have their WHERE conditions inspected — only their pure `build*` helper counterparts were under test. The plan's `<verification>` block and per-task `<acceptance_criteria>` explicitly required verifying tagId-narrowing behavior for all 5 functions, which the existing test infra could not do.
- **Fix:** Added a hoisted `dalMocks` state object and a real chain-based `db.select` mock (from/leftJoin/innerJoin/where/groupBy/orderBy/limit, all returning the same thenable chain) capturing each query's `where()` argument in call order. Added `findTagCondition`/`hasTagCondition` helpers that serialize the WHERE arg and substring-search for the `transaction_tag` EXISTS fragment and tagId value. Added `verifySession` resolved-value setup for the 3 functions that call it internally.
- **Files modified:** tests/dashboard-dal.test.ts
- **Verification:** `yarn vitest run tests/dashboard-dal.test.ts` — 52/52 pass; full suite `yarn vitest run` — 1674 passed, 1 pre-existing todo
- **Committed in:** `92fb98b`, `280c56f`, `8992947` (incrementally, one function pair/function per task commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing test coverage, spread across all 3 task commits)
**Impact on plan:** Necessary to satisfy the plan's own stated verification requirements. No scope creep beyond `lib/dal/dashboard.ts` and its dedicated test file.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
All 5 exports are ready for Plan 68-03 (`lib/dal/overview.ts`'s `getOverview` calls `getOverviewAmountTotals`/`getUncategorizedCount` directly with a `tagId` forward) and Plan 68-06 (Categories tab RSC pages call `getCategoryRanking`/`getCategoryDeviations`/`getCategoryDetail` directly). Full test suite green (1674 passed, 1 pre-existing todo) and `yarn check:language` clean.

---
*Phase: 68-tags-dashboard-and-navigation*
*Completed: 2026-07-21*

## Self-Check: PASSED

SUMMARY.md found on disk; all three task commits (`92fb98b`, `280c56f`, `8992947`) verified present in git log.
