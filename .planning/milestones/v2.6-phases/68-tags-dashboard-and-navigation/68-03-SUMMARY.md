---
phase: 68-tags-dashboard-and-navigation
plan: 03
subsystem: database
tags: [drizzle, postgres, tags, dashboard, overview]

# Dependency graph
requires:
  - phase: 68-tags-dashboard-and-navigation (Plan 01)
    provides: tagScopedTransactions(tagId) shared WHERE-EXISTS predicate
  - phase: 68-tags-dashboard-and-navigation (Plan 02)
    provides: getOverviewAmountTotals(userId, from, to, tagId?) / getUncategorizedCount(userId, from, to, tagId?)
provides:
  - "getOverview(year, tagId?) — forwards tagId to getOverviewAmountTotals/getUncategorizedCount (current+previous period, both totals+uncategorized)"
  - "getOverviewChart(year, tagId?) — narrows every month bucket via tagScopedTransactions(tagId)"
  - "MonthOverMonthChange.categorySlug — NAV-01 slug-vs-id fix, non-null for in/out-grain rows, null for allocation-grain rows"
  - "getMonthOverMonthCategoryChanges(year, monthIndex, directionParam, limit, tagId?) — 5th optional param applied to all four internal WHERE blocks (allocation current/previous, in/out current/previous)"
  - "fetchMovers(year, monthIndex, direction, tagId?) — 4th optional param with defensive Number.isInteger && > 0 bound, forwarded as 5th arg to getMonthOverMonthCategoryChanges"
affects: [68-06, 68-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Spying on tagScopedTransactions directly (vi.mock('@/lib/dal/transaction-tags-sql')) to assert tagId-threading call args, avoiding JSON.stringify on real drizzle-orm/schema objects (circular refs) — an alternative to dashboard-dal.test.ts's schema-mock approach, used where the test file doesn't already mock @/lib/db/schema"
    - "Thenable @/lib/db mock chain (from/leftJoin/innerJoin/where/groupBy/orderBy/limit + a `then` implementation) — queries that await the chain directly after .where()/.groupBy() with no terminal .limit() previously resolved to a non-array chain object, silently short-circuiting to empty results in every test"

key-files:
  created:
    - tests/overview-movers-action.test.ts
  modified:
    - lib/dal/overview.ts
    - lib/actions/overview.ts
    - tests/overview-dal.test.ts
    - tests/overview-movers.test.tsx

key-decisions:
  - "MonthOverMonthChange.categorySlug is a required field (string | null), not optional — matching the plan's literal type addition. This required updating every object-literal fixture in tests/overview-movers.test.tsx (11 sites) to add a categorySlug value; not an architectural change, just fixture fallout from a type-shape change."
  - "tests/overview-movers.test.tsx does not test fetchMovers (only the pure overview-movers-format.ts helpers) despite the plan's Task 3 <verify> pointing at that file — created a new tests/overview-movers-action.test.ts instead, since the plan's own acceptance criteria required fetchMovers's defensive-bound behavior to be testable and no existing test file covered the action."

patterns-established:
  - "Rule 3 fix: tests/overview-dal.test.ts's drizzle-orm mock was missing countDistinct, silently throwing inside getUncategorizedCount's try/catch (dashboard.ts) before ever reaching its WHERE clause — any future dashboard.ts import addition to this mock factory should be checked against the real drizzle-orm import list"

requirements-completed: [TAG-04, NAV-01]

coverage:
  - id: D1
    description: "getOverview and getOverviewChart both accept an optional trailing tagId; omitted forwards undefined unchanged, tagId=5 forwards 5 to every underlying query (4 calls for getOverview, 1 for getOverviewChart)"
    requirement: "TAG-04"
    verification:
      - kind: unit
        ref: "tests/overview-dal.test.ts#getOverview tagId threading (68-03, TAG-04) / getOverviewChart tagId threading (68-03, TAG-04)"
        status: pass
    human_judgment: false
  - id: D2
    description: "MonthOverMonthChange carries categorySlug for in/out-grain rows (matching the category's actual slug) and null for allocation-grain rows; all four internal getMonthOverMonthCategoryChanges WHERE blocks (allocation current/previous, in/out current/previous) apply tagId when present"
    requirement: "NAV-01"
    verification:
      - kind: unit
        ref: "tests/overview-dal.test.ts#getMonthOverMonthCategoryChanges tagId threading (68-03, TAG-04) / categorySlug (68-03, NAV-01 slug-vs-id fix)"
        status: pass
    human_judgment: false
  - id: D3
    description: "fetchMovers accepts an optional 4th tagId param, defensively bounds it (non-integer or non-positive dropped to undefined), and forwards the sanitized value as getMonthOverMonthCategoryChanges's 5th argument — re-fetching movers on month reselection no longer silently drops an active tag filter"
    requirement: "TAG-04"
    verification:
      - kind: unit
        ref: "tests/overview-movers-action.test.ts#fetchMovers tagId threading (68-03, Pitfall 4)"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-07-21
status: complete
---

# Phase 68 Plan 03: Overview DAL Tag Threading + NAV-01 Slug Fix Summary

**All three `lib/dal/overview.ts` exports powering the Overview tab (`getOverview`, `getOverviewChart`, `getMonthOverMonthCategoryChanges`) now accept an optional trailing `tagId`; `MonthOverMonthChange` gains `categorySlug` fixing NAV-01's slug-vs-id mismatch; `fetchMovers` no longer silently drops an active tag filter on month reselection.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-21T14:21:00+02:00
- **Tasks:** 3
- **Files modified:** 4 (1 created, 3 modified — excluding this SUMMARY)

## Accomplishments
- `getOverview(year, tagId?)` forwards `tagId` to all four `getOverviewAmountTotals`/`getUncategorizedCount` calls (current+previous period, both totals and uncategorized count)
- `getOverviewChart(year, tagId?)` adds `tagScopedTransactions(tagId)` to its single WHERE clause, narrowing every zero-filled month bucket
- `MonthOverMonthChange.categorySlug` — the NAV-01 fix this whole phase's research flagged as the one real gotcha: the transactions filter contract matches `category` by slug, not numeric id. In/out-grain rows now carry `category.slug`; allocation-grain rows (grouped by nature, no category join) keep `categorySlug: null`
- `getMonthOverMonthCategoryChanges`'s 5th optional `tagId` param is applied to all four internal `.where(and(...))` blocks (allocation current/previous, in/out current/previous) — missing any one would silently produce wrong month-over-month deltas for a tag-filtered view
- `fetchMovers(year, monthIndex, direction, tagId?)` — Pitfall 4 fixed: a defensive `Number.isInteger(tagId) && tagId > 0` bound (matching this file's existing `year`/`monthIndex` guard style) drops invalid values instead of forwarding them, and the sanitized value is forwarded as the 5th argument to the DAL
- Full test suite green (1710 passed, 1 pre-existing todo) and `yarn check:language` clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Thread tagId through getOverview + getOverviewChart** - `845a02c` (feat)
2. **Task 2: Add category.slug to getMonthOverMonthCategoryChanges + thread tagId (NAV-01 slug fix)** - `1685eb5` (feat)
3. **Task 3: Fix fetchMovers's dropped-tagId regression on month reselection (Pitfall 4)** - `ad6c33a` (fix)

## Files Created/Modified
- `lib/dal/overview.ts` - Added `tagScopedTransactions` import; threaded optional trailing `tagId` through `getOverview`, `getOverviewChart`, `getMonthOverMonthCategoryChanges`; added `categorySlug` to `MonthOverMonthChange`, the in/out-grain SELECT projections, `AmountRow`, row-mapping, and both `changes.push({...})` call sites
- `lib/actions/overview.ts` - Added 4th optional `tagId` param to `fetchMovers` with a defensive bound; forwards `safeTagId` as the 5th arg to `getMonthOverMonthCategoryChanges`
- `tests/overview-dal.test.ts` - Extended the `@/lib/db` mock to be a thenable chain capturing WHERE args; added a direct spy mock for `tagScopedTransactions`; added `countDistinct` to the drizzle-orm mock (Rule 3 fix); added 4 new `describe` blocks covering tagId threading (getOverview, getOverviewChart, getMonthOverMonthCategoryChanges both grains) and `categorySlug` correctness
- `tests/overview-movers.test.tsx` - Updated all `MonthOverMonthChange` object-literal fixtures (11 sites) to include `categorySlug`, required by the type addition
- `tests/overview-movers-action.test.ts` - NEW: dedicated unit coverage for `fetchMovers`'s tagId defensive bound and forwarding (no prior test exercised this action)

## Decisions Made
- `MonthOverMonthChange.categorySlug` is required (`string | null`), not optional — matching the plan's literal type addition. Required updating every fixture in `tests/overview-movers.test.tsx`, not an architectural change.
- `fetchMovers` has no existing dedicated test file (the plan's Task 3 `<verify>` pointed at `tests/overview-movers.test.tsx`, which only tests the pure `overview-movers-format.ts` helpers) — created `tests/overview-movers-action.test.ts` to satisfy the plan's own acceptance criteria requiring the defensive-bound behavior be testable.
- Chose to spy on `tagScopedTransactions` directly (mocking `@/lib/dal/transaction-tags-sql`) in `tests/overview-dal.test.ts` rather than mocking `@/lib/db/schema` (the approach `tests/dashboard-dal.test.ts` used in Plan 68-02) — this file doesn't currently mock the schema module, and doing so risked circular-reference JSON.stringify errors on real Drizzle table/column objects. The spy approach gives equivalent call-argument assertions without that risk.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added missing `countDistinct` to tests/overview-dal.test.ts's drizzle-orm mock**
- **Found during:** Task 1 (writing the `getOverview` tagId-threading test)
- **Issue:** `lib/dal/dashboard.ts`'s `getUncategorizedCount` (called internally by `getOverview`) imports `countDistinct` from `drizzle-orm`, but the test file's `drizzle-orm` mock factory didn't provide it. Calling `countDistinct(expense.id)` as an import resolved to `undefined`, so `undefined(...)` threw a `TypeError` that was silently caught by `getUncategorizedCount`'s own `try/catch`, returning `0` before ever reaching its `.where(...)` clause — meaning `tagScopedTransactions` was never invoked for that function, undercounting expected spy calls (2 instead of 4).
- **Fix:** Added `countDistinct: (...args) => ({ op: 'countDistinct', args })` to the mock factory.
- **Files modified:** tests/overview-dal.test.ts
- **Verification:** `yarn vitest run tests/overview-dal.test.ts` — all 20 tests pass with the corrected 4-call assertion
- **Committed in:** `845a02c` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed non-thenable `@/lib/db` select-chain mock silently short-circuiting to empty results**
- **Found during:** Task 1 (designing tagId-threading assertions)
- **Issue:** The pre-existing `@/lib/db` mock's `.where()`/`.groupBy()` returned `this` (via `mockReturnThis()`), a plain object with no `then`. Several functions under test (`getOverviewAmountTotals`, `getUncategorizedCount`, `getMonthOverMonthCategoryChanges`, `getOverviewChart`) `await` the chain directly with no terminal `.limit()` call — awaiting a non-thenable object resolves to that object itself, not an array, so `Array.isArray(rows)` was always `false` and every query silently returned empty/default results regardless of seeded mock data.
- **Fix:** Rewrote the mock's `select()` to build a proper thenable chain object (adding a `then` implementation resolving to the seeded rows) and added a `rowsQueue` for per-call row seeding, mirroring the pattern established in `tests/dashboard-dal.test.ts` (Plan 68-02).
- **Files modified:** tests/overview-dal.test.ts
- **Verification:** Confirmed existing 16 tests in this file still pass unchanged after the fix (their behavior was preserved since they seed empty rows); new categorySlug tests require this fix to inject real row data.
- **Committed in:** `845a02c` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3/Rule 1 test-infrastructure fixes, no production-code scope creep)
**Impact on plan:** Both fixes were necessary to make the plan's own acceptance criteria ("verify via a mock/spy asserting call arguments") actually provable. No scope creep beyond `lib/dal/overview.ts`, `lib/actions/overview.ts`, and their test files.

## Issues Encountered
None beyond the two auto-fixed test-infrastructure issues above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
All three threaded exports (`getOverview`, `getOverviewChart`, `getMonthOverMonthCategoryChanges`), `MonthOverMonthChange.categorySlug`, and the fixed `fetchMovers` are ready for Plan 68-06 (Overview tab page wiring — passing `tagId` from the resolved `?tag=` searchParam) and Plan 68-07 (movers-row `Link` using `categorySlug` for the NAV-01 click-through to `/transactions?category={slug}`). Full test suite green (1710 passed, 1 pre-existing todo) and `yarn check:language` clean.

---
*Phase: 68-tags-dashboard-and-navigation*
*Completed: 2026-07-21*

## Self-Check: PASSED

SUMMARY.md found on disk; all three task commits (`845a02c`, `1685eb5`, `ad6c33a`) verified present in git log; all created/modified files (`lib/dal/overview.ts`, `lib/actions/overview.ts`, `tests/overview-movers-action.test.ts`) found on disk.
