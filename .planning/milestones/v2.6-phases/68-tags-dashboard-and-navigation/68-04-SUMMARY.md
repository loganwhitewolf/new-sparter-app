---
phase: 68-tags-dashboard-and-navigation
plan: 04
subsystem: database
tags: [drizzle, postgres, sql-filter, tags, dashboard-aggregate]

requires:
  - phase: 68-01
    provides: "tagScopedTransactions() EXISTS predicate, APP_ROUTES.dashboardTags route constant"
provides:
  - "getTagTotals(userId) — TAG-05's per-tag all-time, dashboard-exclusion-aware aggregate"
  - "buildTagTotalsData(rows) — pure zero-safe shaping + absolute-total-descending sort"
  - "archiveTagAction revalidates both /settings/tags and /dashboard/tags"
affects: [68-08]

tech-stack:
  added: []
  patterns:
    - "SQL FILTER (WHERE ...) inside aggregate expressions instead of the outer WHERE, to keep a LEFT JOIN's zero-transaction rows from being silently dropped by exclusion predicates"

key-files:
  created: []
  modified:
    - lib/dal/tags.ts
    - lib/actions/tags.ts
    - tests/tags-dal.test.ts
    - tests/tag-actions.test.ts

key-decisions:
  - "getTagTotals is rooted at FROM tag (never FROM transaction), with every join a LEFT JOIN, so a tag with zero transaction_tag rows still returns a row via COALESCE/FILTER defaults instead of being dropped"
  - "The dashboard exclusion set (expense.status inArray DASHBOARD_TOTAL_EXPENSE_STATUSES, direction.code != 'transfer', isNotSecondary()) is composed once as a reusable sql fragment and applied via FILTER (WHERE ...) inside count/MIN/MAX/SUM, never in the outer WHERE — the outer WHERE is only eq(tag.userId, userId)"
  - "tests/tags-dal.test.ts's drizzle-orm mock switched from a fully hand-rolled mock to importOriginal() + selective overrides (and/asc/eq/isNotNull stay mocked for existing exact-shape assertions; sql/inArray/ne pass through to the real drizzle-orm), avoiding a rewrite of the file's pre-existing tests while giving getTagTotals's FILTER-based SQL real drizzle-orm semantics"
  - "lib/dal/dashboard is mocked in tests/tags-dal.test.ts to export only the DASHBOARD_TOTAL_EXPENSE_STATUSES constant, avoiding a transitive real import of lib/dal/auth.ts -> next/headers that the real dashboard.ts module would otherwise pull in"

patterns-established:
  - "Zero-safe LEFT JOIN aggregate with exclusions inside FILTER (not outer WHERE) — the correct generalization of buildCategoryRankingData's COALESCE(0) idiom for a case where the exclusion predicate must not turn a present-but-fully-excluded row into an absent one"

requirements-completed: [TAG-05]

coverage:
  - id: D1
    description: "getTagTotals never drops a zero-transaction or fully-excluded tag (LEFT JOIN + FILTER, never outer WHERE)"
    requirement: "TAG-05"
    verification:
      - kind: unit
        ref: "tests/tags-dal.test.ts#getTagTotals (TAG-05 per-tag aggregate) > scopes the outer WHERE to ONLY eq(tag.userId, userId)"
        status: pass
      - kind: unit
        ref: "tests/tags-dal.test.ts#getTagTotals (TAG-05 per-tag aggregate) > never uses innerJoin"
        status: pass
      - kind: unit
        ref: "tests/tags-dal.test.ts#getTagTotals (TAG-05 per-tag aggregate) > embeds the dashboard exclusion set inside a FILTER clause"
        status: pass
    human_judgment: false
  - id: D2
    description: "buildTagTotalsData shapes zero-transaction rows to count:0/dates null/total '0.00', coerces driver string count/total, and sorts by absolute total descending"
    requirement: "TAG-05"
    verification:
      - kind: unit
        ref: "tests/tags-dal.test.ts#buildTagTotalsData (pure, unit-testable without a DB)"
        status: pass
    human_judgment: false
  - id: D3
    description: "archiveTagAction revalidates both /settings/tags and /dashboard/tags on success (Pitfall 3 fix)"
    requirement: "TAG-05"
    verification:
      - kind: unit
        ref: "tests/tag-actions.test.ts#archiveTagAction > revalidates BOTH /settings/tags and /dashboard/tags on success (Pitfall 3 fix — 68-04)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-07-21
status: complete
---

# Phase 68 Plan 04: TAG-05 per-tag aggregate + archive revalidate fix Summary

**`getTagTotals(userId)` — a zero-safe, FROM-tag LEFT JOIN aggregate applying the exact dashboard exclusion set (status/transfer/pair-netting) via SQL FILTER clauses, plus a second `revalidatePath` fixing `archiveTagAction`'s dashboard-Tag-section staleness bug.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2
- **Files modified:** 4 (2 source, 2 test)

## Accomplishments
- `getTagTotals(userId)` in `lib/dal/tags.ts` — rooted at `FROM tag` with LEFT JOINs down through `transaction_tag -> transaction -> expense -> subCategory -> category -> userSubcategoryOverride -> nature -> direction`; the dashboard exclusion predicate (`expenseStatusIncludedInDashboardTotals()`-equivalent via `DASHBOARD_TOTAL_EXPENSE_STATUSES`, `direction.code != 'transfer'`, `isNotSecondary()`) is composed once and applied inside `count(...)/MIN(...)/MAX(...)/SUM(...)` via `FILTER (WHERE ...)`, never the outer `WHERE` — so a tag with zero transactions, or whose only transactions are all excluded, still surfaces a row instead of being silently dropped.
- `buildTagTotalsData(rows)` — pure shaping function (no DB), coerces driver string count/total into `number`/formatted-decimal, defaults nulls, and sorts by absolute total descending.
- `TagTotalItem` type exported alongside both functions.
- `archiveTagAction` now calls `revalidatePath(APP_ROUTES.dashboardTags)` immediately after the existing `revalidatePath(APP_ROUTES.tagSettings)` call, fixing the Pitfall 3 staleness bug the new dashboard Tag section (Plan 68-08) would otherwise hit.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add getTagTotals — all-time, dashboard-exclusion-aware, zero-safe per-tag aggregate** - `a4f81f2` (feat)
2. **Task 2: Fix archiveTagAction's single hardcoded revalidatePath (Pitfall 3)** - `4714b13` (fix)

_Note: both commits also include their extended test coverage (tests/tags-dal.test.ts, tests/tag-actions.test.ts) — this plan's tasks were not marked `tdd="true"`, but tests were added proactively per the phase's Test Map (RESEARCH.md) and to make the FILTER-vs-outer-WHERE correctness property machine-verifiable._

## Files Created/Modified
- `lib/dal/tags.ts` - Adds `getTagTotals`, `buildTagTotalsData`, `TagTotalItem` and the new imports (`category, direction, expense, nature, subCategory, transaction, transactionTag, userSubcategoryOverride` from schema; `inArray, ne, sql` from drizzle-orm; `effectiveAmount, isNotSecondary` from transaction-pairs-sql; `DASHBOARD_TOTAL_EXPENSE_STATUSES` from dashboard; `toDecimal` from decimal utils)
- `lib/actions/tags.ts` - `archiveTagAction` gains a second `revalidatePath(APP_ROUTES.dashboardTags)` call
- `tests/tags-dal.test.ts` - Extended `@/lib/db` chain mock (`leftJoin`/`innerJoin`/`groupBy` tracking + `selectArgs` capture), `drizzle-orm` mock switched to `importOriginal()` + selective overrides, added `@/lib/dal/dashboard` mock (constant only) and the full schema table mocks `getTagTotals` needs; added `buildTagTotalsData` and `getTagTotals` describe blocks (9 new tests)
- `tests/tag-actions.test.ts` - Added 2 tests asserting the double-`revalidatePath` call and its absence on failure

## Decisions Made
See `key-decisions` in frontmatter — most notably: exclusions are composed once as a reusable `sql` fragment and applied via `FILTER (WHERE ...)` on each aggregate expression rather than the outer `WHERE`, which is the entire correctness bar this plan exists to hit (a naive outer-WHERE approach would silently drop zero-transaction or fully-excluded tags via the LEFT JOIN chain).

## Deviations from Plan

None — plan executed exactly as written. The plan's `<read_first>`/`<action>` blocks specified the exact join chain, exclusion composition, and pure-shaping-function split; implementation followed this literally. Test additions were not explicitly scoped as a task in this plan (tasks are `type="auto"`, not `tdd="true"`), but are additive coverage matching 68-RESEARCH.md's Test Map (`tests/tags-dal.test.ts` / `tests/tag-actions.test.ts`, both flagged "extend") and the task-level `<verify>` blocks that name these exact files — not treated as a deviation since it directly fulfills the plan's own verification instructions.

## Issues Encountered

`tests/tags-dal.test.ts`'s pre-existing `vi.mock('drizzle-orm', ...)` only stubbed `and/asc/eq/isNotNull` with simplified `{ op, ... }` objects — insufficient for `getTagTotals`'s real `sql`/`inArray`/`ne` usage and for the real (unmocked) `effectiveAmount()`/`isNotSecondary()` it imports from `transaction-pairs-sql.ts`. Resolved by switching the mock factory to `importOriginal()` and only overriding the four previously-mocked exports, leaving everything else (including `sql`, `inArray`, `ne`) as the real drizzle-orm implementation — preserves all pre-existing test assertions unchanged while giving the new code correct real-SQL semantics. Also mocked `@/lib/dal/dashboard` (constant-only) rather than importing the real module, avoiding a transitive `next/headers` import via `lib/dal/auth.ts` that the real dashboard.ts pulls in for its other (unrelated) exports.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`getTagTotals`/`TagTotalItem` are ready for Plan 68-08 to render the dashboard Tag section's card list. `archiveTagAction` now correctly revalidates that future route. No blockers.

---
*Phase: 68-tags-dashboard-and-navigation*
*Completed: 2026-07-21*
