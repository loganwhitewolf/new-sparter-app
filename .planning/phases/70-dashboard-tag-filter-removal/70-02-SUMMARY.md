---
phase: 70-dashboard-tag-filter-removal
plan: 02
subsystem: data
tags: [drizzle, dal, dashboard, tags, validation, tests]

# Dependency graph
requires:
  - phase: 70-01
    provides: every dashboard call site already tag-free, so removing the DAL params is a pure signature narrowing
provides:
  - "lib/dal/overview.ts and lib/dal/dashboard.ts with zero tag parameters and no tag-scoping import"
  - "a validations module with no candidate-tag-id parser"
affects: [tag-analysis, dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Signature narrowing after call-site removal: wave 2 drops the optional params wave 1 left dangling, so tsc stays clean at every task boundary"
    - "tsc gate read as 'no new errors' against a captured pre-existing error set, not as 'zero errors'"

key-files:
  created: []
  modified:
    - lib/dal/overview.ts
    - lib/dal/dashboard.ts
    - tests/overview-dal.test.ts
    - tests/dashboard-dal.test.ts
    - lib/validations/dashboard.ts
    - tests/dashboard-filters.test.ts
    - lib/dal/tags.ts
  deleted:
    - components/dashboard/tag-filter-select.tsx
    - tests/tag-filter-select.test.tsx

key-decisions:
  - "Tag-threading tests deleted, not skipped (D4) — every case asserted only a parameter that no longer exists"
  - "whereArgs recorders removed from both DAL test harnesses once their only readers were deleted; rowsQueue kept in both (it feeds the shared select mock chain used by surviving tests)"
  - "resolveOwnedTagId kept verbatim — only its JSDoc framing moved from the dashboard filter to the transactions ?tag= filter (TAG-14)"

patterns-established:
  - "Regression fence proven by an exact-survivor grep plus a byte-unchanged git diff anchored to the phase-base commit, re-run at every task boundary"

requirements-completed: []

coverage:
  - id: C1
    description: "getOverview, getOverviewChart and getMonthOverMonthCategoryChanges expose no tag parameter; lib/dal/overview.ts no longer imports the tag-scoping predicate"
    requirement: "TAG-13"
    verification:
      - kind: other
        ref: "/usr/bin/grep -n 'tagScopedTransactions|tagId' lib/dal/overview.ts (zero hits)"
        status: pass
      - kind: unit
        ref: "./node_modules/.bin/vitest run — tests/overview-dal.test.ts green, no surviving assertion edited"
        status: pass
    human_judgment: false
  - id: C2
    description: "getUncategorizedCount, getOverviewAmountTotals, getCategoryRanking, getCategoryDetail and CategoryDeviationsInput expose no tag parameter; lib/dal/dashboard.ts no longer imports the predicate"
    requirement: "TAG-13"
    verification:
      - kind: other
        ref: "/usr/bin/grep -n 'tagScopedTransactions|tagId' lib/dal/dashboard.ts (zero hits)"
        status: pass
      - kind: unit
        ref: "./node_modules/.bin/vitest run — tests/dashboard-dal.test.ts green"
        status: pass
    human_judgment: false
  - id: C3
    description: "The tag-select component, its search helper, parseTagIdParam and the tag empty-state variant have zero references across app/lib/components/tests; both orphan files are gone from disk"
    requirement: "TAG-13"
    verification:
      - kind: other
        ref: "! /usr/bin/grep -rnE 'TagFilterSelect|buildTagFilterSearch|parseTagIdParam|no-data-for-tag' app lib components tests (zero hits) + [ ! -f ... ] on both files"
        status: pass
    human_judgment: false
  - id: C4
    description: "REGRESSION FENCE: tagScopedTransactions survives in exactly three lib/ files and its definition file plus lib/dal/transactions.ts are byte-unchanged since the phase-base commit"
    requirement: "TAG-13"
    verification:
      - kind: other
        ref: "survivor-list equality gate (LC_ALL=C sort) + git diff --name-only c26b48c -- lib/dal/transaction-tags-sql.ts lib/dal/transactions.ts (empty), both re-run after each task"
        status: pass
      - kind: unit
        ref: "tests/transaction-tags-sql.test.ts, tests/transactions-dal.test.ts green in the full run"
        status: pass
    human_judgment: true
    rationale: "The automated half proves the code is untouched; only a human click on /transactions?tag=<id> and the TAG-14 toolbar filter proves the narrowing still applies end-to-end. PENDING — see Task 3."
  - id: C5
    description: "resolveOwnedTagId still exists and is still called by app/(app)/transactions/page.tsx; only its docstring changed"
    requirement: "TAG-13"
    verification:
      - kind: other
        ref: "/usr/bin/grep -q 'export async function resolveOwnedTagId' lib/dal/tags.ts + /usr/bin/grep -q 'resolveOwnedTagId' 'app/(app)/transactions/page.tsx'"
        status: pass
      - kind: unit
        ref: "tests/tags-dal.test.ts guard cases green"
        status: pass
    human_judgment: false
  - id: C6
    description: "Legacy /dashboard/*?tag= URLs render the normal unfiltered dashboard; numbers equal the pre-existing unfiltered values"
    requirement: "TAG-13"
    verification:
      - kind: other
        ref: "Task 3 human-verify steps 1-4"
        status: pending
    human_judgment: true
    rationale: "Route-level rendering behaviour with no automated UI coverage."

# Metrics
duration: 5min
completed: 2026-07-22
status: awaiting-human-verify
---

# Phase 70 Plan 02: Dashboard DAL tag-parameter removal Summary

**The two dashboard DAL modules no longer carry a tag parameter anywhere — thirteen predicate call sites, seven signatures, one input-type field and two imports removed — and the orphaned tag-select control plus `parseTagIdParam` are deleted, while `tagScopedTransactions` and `resolveOwnedTagId` survive byte-unchanged for the transactions filter.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-22T15:42:00Z
- **Completed (code tasks):** 2026-07-22T15:47:00Z
- **Tasks:** 2/3 automated tasks complete; task 3 is a blocking human-verify checkpoint, **not performed**
- **Files:** 7 modified, 2 deleted

## Accomplishments

- `lib/dal/overview.ts` — `getOverview`, `getMonthOverMonthCategoryChanges` (whose `limit = 10` default is now the last parameter) and `getOverviewChart` lost their trailing optional tag parameter; the five `tagScopedTransactions(...)` calls (two allocation-grain, two in/out-grain, one chart) and the module import are gone. Four internal `getOverviewAmountTotals`/`getUncategorizedCount` calls lost their trailing argument.
- `lib/dal/dashboard.ts` — `getUncategorizedCount`, `getOverviewAmountTotals`, `getCategoryRanking` and `getCategoryDetail` lost the parameter; `CategoryDeviationsInput` lost its `tagId` field (`type` and `categoryId` kept). All eight predicate calls (including the deviations reference + baseline queries and all three `getCategoryDetail` data queries) and the module import removed. The category-metadata lookup never carried one and is untouched.
- `components/dashboard/tag-filter-select.tsx` and `tests/tag-filter-select.test.tsx` deleted from disk.
- `lib/validations/dashboard.ts` — `parseTagIdParam` and its JSDoc removed; all zod schemas, exported types and `parseDashboardFilters` untouched.
- `lib/dal/tags.ts` — `resolveOwnedTagId` body, signature and fail-closed behaviour unchanged; its JSDoc now frames the guard around the transactions `?tag=` filter (TAG-14) and names `app/(app)/transactions/page.tsx` as the caller, replacing the sentence about "Wave 3/4 of this phase" (a phase that no longer exists).
- No tombstone comments were left behind: the zero-hit greps pass over the whole of `app lib components tests`.

## Task Commits

1. **Task 1: de-thread tagId from the two dashboard DAL modules** — `fc2ee1b` (refactor) — 4 files, +32/−295
2. **Task 2: delete the orphaned control + validator, reframe the docstring** — `38814c9` (refactor) — 5 files, +4/−224
3. **Task 3: human-verify** — NOT RUN (blocking checkpoint, see below)

## Files Created/Modified

- `lib/dal/overview.ts` — three tag-free exported signatures, five predicate call sites and one import removed.
- `lib/dal/dashboard.ts` — four tag-free exported signatures plus `CategoryDeviationsInput`, eight predicate call sites and one import removed.
- `tests/overview-dal.test.ts` — three tag-threading describes, the `vi.mock('@/lib/dal/transaction-tags-sql', …)` block, the `tagScopedTransactions` spy field and the `whereArgs` recorder removed; the `categorySlug` describes and their `rowsQueue` harness kept.
- `tests/dashboard-dal.test.ts` — three tag-threading describes, the two EXISTS-locating helpers (`findTagCondition`, `hasTagCondition`), the `whereArgs` recorder and the five now-unused DAL imports removed; `rowsQueue` kept (it feeds the shared `select` mock chain).
- `lib/validations/dashboard.ts` — `parseTagIdParam` + JSDoc removed.
- `tests/dashboard-filters.test.ts` — the parser describe and the symbol in the import removed.
- `lib/dal/tags.ts` — docstring only.
- `components/dashboard/tag-filter-select.tsx`, `tests/tag-filter-select.test.tsx` — **deleted**.

## Test Coverage Delta

- **Deleted files:** `tests/tag-filter-select.test.tsx` (7 cases).
- **Deleted describes:** three in `tests/overview-dal.test.ts` (8 cases), three in `tests/dashboard-dal.test.ts` (10 cases), one in `tests/dashboard-filters.test.ts` (4 cases). All asserted only removed parameters — deletion over skipping per D4.
- **Net effect:** 140 files / 1754 tests → **139 files / 1726 tests (1725 passed + 1 todo), all green.**
- **No surviving assertion was edited (D3):** every removed parameter was `undefined` on the default path, so no aggregate moved.
- **Residual gap (carried from 70-01, unchanged here):** `lib/actions/overview.ts` (`fetchMovers`) still has no dedicated unit test after `tests/overview-movers-action.test.ts` was deleted in wave 1. Logged in `deferred-items.md`.

## Verification Results

All gates run with `/usr/bin/grep` and the direct `node_modules/.bin` binaries (the repo's RTK shell hook rewrites bare `grep`/`npx` and returns summarised output unsafe for a gate decision).

| Gate | Result |
|------|--------|
| `! /usr/bin/grep -rn "tagScopedTransactions\|tagId" lib/dal/overview.ts lib/dal/dashboard.ts` | zero hits |
| `! /usr/bin/grep -rnE "TagFilterSelect\|buildTagFilterSearch\|parseTagIdParam\|no-data-for-tag" app lib components tests` | zero hits |
| both orphan files absent from disk | pass |
| survivor list = `lib/dal/tags.ts,lib/dal/transaction-tags-sql.ts,lib/dal/transactions.ts` (`LC_ALL=C sort`) | pass, after **both** tasks |
| `git diff --name-only c26b48c26b8feb483bb5b8f36c65a3593aa0083c -- lib/dal/transaction-tags-sql.ts lib/dal/transactions.ts` | empty, after **both** tasks |
| `resolveOwnedTagId` export + transactions-page call site | both present |
| `./node_modules/.bin/tsc --noEmit` | **no new errors** — error set byte-identical to the captured baseline (21 errors in 6 unrelated test files) |
| `./node_modules/.bin/vitest run` | 139 files / 1726 tests green |
| `./node_modules/.bin/eslint <7 touched files>` | clean |
| `yarn check:language` | passes |

## Decisions Made

None beyond the plan — D1/D3/D4 from CONTEXT.md were followed as specified.

## Deviations from Plan

None. Two plan instructions resolved to no-ops on inspection, documented for the record:

1. **Task 1(a) "trim the v2.6/68-0x sentences describing the tag narrowing"** — no such prose exists in either DAL module. A case-insensitive grep for `tag` outside the code references matched only the substring inside `percentage`. Nothing to trim; every explanatory comment (D-06, D-07, D-08, WR-06, T-42-05, Phase 49, 260709-kp1/lkw, PAIR-03) is verbatim.
2. **Task 1(c)/(d) `whereArgs` re-grep rule** — in both test files the only remaining occurrences after the describe deletions were the harness itself (declaration, recorder push, `beforeEach` reset, header comment), so the harness was removed in both, exactly as the conditional instructed. `rowsQueue` was kept in both files.

## Issues Encountered

- **Pre-existing `tsc --noEmit` errors (out of scope, not introduced here).** The baseline tree fails type-check with **21 `error TS` lines across 6 unrelated test files**: `tests/suggestion-card.test.tsx` (7), `tests/suggestion-promote-form.test.tsx` (6), `tests/cascade-options.test.ts` (4), `tests/category-combobox.test.tsx` (2), `tests/transactions-dal.test.ts` (1), `tests/file-download-api.test.ts` (1). The set was captured before the first edit and `diff`-compared after each task — **byte-identical every time**. None touches a file this plan modified. Per the executor scope boundary they were not fixed; already logged in `deferred-items.md` by 70-01.
- No auth gates, no package installs, no architectural decisions.

## Regression Fence

Held, and re-proven at both task boundaries:

- `lib/dal/transaction-tags-sql.ts:24` — `tagScopedTransactions` definition intact, file byte-unchanged since `c26b48c`.
- `lib/dal/transactions.ts:8,340` — import + `conditions.push(tagScopedTransactions(filters.tagId))` intact, file byte-unchanged since `c26b48c`.
- `lib/dal/tags.ts:124` — the surviving comment mention (the only remaining `lib/` reference outside the two files above).
- `app/(app)/transactions/**` — not in this plan's diff at all.
- `tests/transaction-tags-sql.test.ts` and `tests/transactions-dal.test.ts` — untouched and green.

## PENDING — Task 3: blocking human-verify checkpoint

**Status: pending operator.** Not performed by the executor. TAG-13 is not discharged and this plan is not complete until an operator runs the dev server and confirms:

**Removal (TAG-13)**
1. `/dashboard/overview` — no tag control next to the year selector; KPI cards / chart / movers show pre-phase numbers.
2. `/dashboard/categories` and `/dashboard/categories/{id}` — no tag control; normal rankings/details render.
3. Legacy URLs (D1) — `/dashboard/overview?tag=<id>`, `/dashboard/categories?tag=<id>`, `/dashboard/categories/<categoryId>?tag=<id>` each render the normal unfiltered page: no redirect, no error, no tag empty state, numbers equal the same URL without `?tag=`.
4. `/dashboard/overview?year=<empty year>&tag=<id>` — ordinary "no data for this year" empty state, not a tag-specific one.

**Regression — the key check (C4 human half)**
5. `/transactions` — the "Tag" select is still in the Filtri popover; selecting a tag adds `?tag=<id>`, narrows the table, shows an active chip with the tag NAME; clearing works via the chip X and "Cancella tutto".
6. `/transactions?tag=<id>` directly — still filters.
7. `/dashboard/tags` → `/tags/[id]` — the dedicated all-time page still renders totals, per-category breakdown and transaction list (Phase 69, untouched).

If any of 5-7 fails, the regression fence was crossed — report rather than approve.

**Resume signal:** "approved", or a description of what broke.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Code work for TAG-13 is complete; the requirement should be marked done **only after** the task 3 checkpoint is approved.
- `STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md` were deliberately **not** advanced, because a blocking gate is still open.
- After approval: `/gsd-verify-work` or `/gsd-ship` for the `gsd/v2.7-tag-dedicated-view` branch.

## Self-Check: PASSED

- Both task commits exist in git: `fc2ee1b`, `38814c9`.
- `components/dashboard/tag-filter-select.tsx` and `tests/tag-filter-select.test.tsx` confirmed absent from disk.
- `lib/dal/transaction-tags-sql.ts` and `lib/dal/transactions.ts` confirmed byte-unchanged vs `c26b48c`.
- `git status --short` clean after both commits; the only file deletions in the diff are the two intentional ones.

---
*Phase: 70-dashboard-tag-filter-removal*
*Code tasks completed: 2026-07-22 — awaiting human verification*
</content>
</invoke>
