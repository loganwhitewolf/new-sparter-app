---
phase: 68-tags-dashboard-and-navigation
plan: 01
subsystem: database
tags: [drizzle, postgres, zod, tags, dashboard, idor]

# Dependency graph
requires:
  - phase: 67-tags-foundation-and-assignment
    provides: tag/transaction_tag schema, getTag(userId, tagId) ownership-scoped lookup
provides:
  - tagScopedTransactions(tagId) — shared WHERE-EXISTS predicate for narrowing any query by tag without row fan-out
  - APP_ROUTES.dashboardTags route constant ('/dashboard/tags')
  - `tag` searchParam on the transactions filter contract (ParsedTransactionFilters.tagId / TransactionFilters.tagId)
  - parseTagIdParam(input) — sync candidate-tagId parser for the dashboard `?tag=` searchParam
  - resolveOwnedTagId(userId, candidateTagId?) — IDOR defense-in-depth ownership check wrapping getTag
affects: [68-02, 68-03, 68-04, 68-05, 68-06, 68-07, 68-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "WHERE-EXISTS predicate for N:M tag scoping — never a JOIN (mirrors isNotSecondary()/effectiveAmount() in lib/dal/transaction-pairs-sql.ts)"
    - "Numeric searchParam parse idiom: firstTrimmed -> Number() -> Number.isInteger && > 0 guard, falsy otherwise (matches subCategoryId)"
    - "IDOR defense-in-depth: transitive ownership scoping (eq(transaction.userId, userId)) plus an explicit fail-closed ownership check at the RSC/action boundary"

key-files:
  created:
    - lib/dal/transaction-tags-sql.ts
    - tests/transaction-tags-sql.test.ts
  modified:
    - lib/routes.ts
    - lib/validations/transactions.ts
    - lib/dal/transactions.ts
    - lib/validations/dashboard.ts
    - lib/dal/tags.ts
    - lib/validations/__tests__/transactions.test.ts
    - tests/transactions-dal.test.ts
    - tests/dashboard-filters.test.ts
    - tests/tags-dal.test.ts

key-decisions:
  - "tagScopedTransactions lives in a new sibling file (lib/dal/transaction-tags-sql.ts), not transaction-pairs-sql.ts, keeping pairing concerns and tag-scoping concerns in separate files (per 68-RESEARCH.md Open Question 3, resolved)"
  - "mapParsedTransactionFiltersToDal needed zero code changes for tagId — its existing ...rest spread passes the field through automatically since both types use the identical field name"

patterns-established:
  - "Pattern 1 (68-RESEARCH.md): WHERE-EXISTS predicate for N:M tag scoping — reused by every later plan in this phase (dashboard.ts, overview.ts, tags.ts getTagTotals)"

requirements-completed: [TAG-04, TAG-05]

coverage:
  - id: D1
    description: "tagScopedTransactions(tagId) returns undefined for falsy tagId (undefined or 0) and a truthy EXISTS SQL fragment for a positive tagId — never a JOIN"
    requirement: "TAG-04"
    verification:
      - kind: unit
        ref: "tests/transaction-tags-sql.test.ts#tagScopedTransactions"
        status: pass
    human_judgment: false
  - id: D2
    description: "APP_ROUTES.dashboardTags resolves to '/dashboard/tags'; no existing APP_ROUTES key removed/renamed/reordered"
    verification:
      - kind: unit
        ref: "tsc --noEmit (compile-time check on lib/routes.ts); manual grep confirms sibling keys unchanged"
        status: pass
    human_judgment: false
  - id: D3
    description: "/transactions?tag={tagId} narrows the list via the EXISTS predicate (parseTransactionFilters accepts `tag`, getTransactions applies tagScopedTransactions), never duplicating rows for multi-tag transactions"
    requirement: "TAG-04"
    verification:
      - kind: unit
        ref: "lib/validations/__tests__/transactions.test.ts#parses the tag click-through param as a positive integer"
        status: pass
      - kind: unit
        ref: "tests/transactions-dal.test.ts#narrows via the tagScopedTransactions EXISTS fragment when tagId is set"
        status: pass
    human_judgment: false
  - id: D4
    description: "parseTagIdParam and resolveOwnedTagId exist, are exported, and are independently unit-tested; resolveOwnedTagId is fail-closed (undefined) on ownership miss or absent candidateTagId, without an existing getTag/getTags behavior change"
    requirement: "TAG-04"
    verification:
      - kind: unit
        ref: "tests/dashboard-filters.test.ts#parseTagIdParam (68-01)"
        status: pass
      - kind: unit
        ref: "tests/tags-dal.test.ts#resolveOwnedTagId (68-01 IDOR defense-in-depth)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-07-21
status: complete
---

# Phase 68 Plan 01: Tag Filter Foundations Summary

**Shared `tagScopedTransactions` WHERE-EXISTS predicate, `/transactions?tag={id}` filter contract, and the `resolveOwnedTagId` IDOR defense-in-depth helper — the three primitives every later Phase 68 plan imports.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-21T11:42:48Z
- **Tasks:** 3
- **Files modified:** 9 (2 created, 7 modified)

## Accomplishments
- `tagScopedTransactions(tagId?)` in new `lib/dal/transaction-tags-sql.ts` — an EXISTS-based WHERE fragment that narrows any query to transactions carrying a given tag without row fan-out on multi-tag transactions (mirrors the existing `isNotSecondary()` precedent)
- `APP_ROUTES.dashboardTags` (`/dashboard/tags`) added as the canonical route constant for later Wave 3/4 plans
- `/transactions?tag={tagId}` is now a working filter: `ParsedTransactionFilters.tagId`/`TransactionFilters.tagId` parse and apply via the shared EXISTS predicate, never a `leftJoin`
- `parseTagIdParam`/`resolveOwnedTagId` — the fail-closed IDOR defense-in-depth pair every dashboard RSC page reading `?tag=` in later waves must call before trusting the value

## Task Commits

Each task was committed atomically:

1. **Task 1: Create tagScopedTransactions predicate + dashboardTags route constant** - `69f5f6b` (feat)
2. **Task 2: Add the `tag` filter to the transactions filter contract + DAL (LOCKED DECISION 3)** - `b87cbb3` (feat)
3. **Task 3: IDOR defense-in-depth foundation for the dashboard tag filter** - `2bd2880` (feat)

## Files Created/Modified
- `lib/dal/transaction-tags-sql.ts` - NEW: `tagScopedTransactions(tagId?)` EXISTS predicate
- `lib/routes.ts` - Added `APP_ROUTES.dashboardTags`
- `lib/validations/transactions.ts` - Added `tagId` to `ParsedTransactionFilters` + parse logic
- `lib/dal/transactions.ts` - Added `tagId` to `TransactionFilters` + `getTransactions` EXISTS condition
- `lib/validations/dashboard.ts` - NEW: `parseTagIdParam(input)`
- `lib/dal/tags.ts` - NEW: `resolveOwnedTagId(userId, candidateTagId?)`
- `tests/transaction-tags-sql.test.ts` - NEW: unit coverage for the predicate
- `lib/validations/__tests__/transactions.test.ts`, `tests/transactions-dal.test.ts`, `tests/dashboard-filters.test.ts`, `tests/tags-dal.test.ts` - extended with new test cases

## Decisions Made
- `tagScopedTransactions` lives in a new sibling file (`lib/dal/transaction-tags-sql.ts`) rather than being added to `transaction-pairs-sql.ts`, keeping the two concerns (pairing vs. tagging) in separate files per the research recommendation.
- No code change was needed in `mapParsedTransactionFiltersToDal` for `tagId` — its existing `...rest` spread already passes any identically-named field through, exactly like `subCategoryId`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
All three foundations (`tagScopedTransactions`, the `tag` transactions filter, `parseTagIdParam`/`resolveOwnedTagId`) are exported, unit-tested, and ready for Wave 3/4 plans to thread `tagId` through the dashboard/overview DAL functions, build the Tag section (TAG-05), and wire the NAV-01 click-through. Full test suite green (1664 passed, 1 pre-existing todo) and `yarn check:language` clean.

---
*Phase: 68-tags-dashboard-and-navigation*
*Completed: 2026-07-21*

## Self-Check: PASSED

All created/modified files found on disk; all three task commits (`69f5f6b`, `b87cbb3`, `2bd2880`) verified present in git log.
