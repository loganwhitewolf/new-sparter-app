---
phase: 42-overview-data-layer
plan: 01
subsystem: database
tags: [drizzle, postgres, typescript, vitest, enum, migration]

requires: []

provides:
  - FlowNature union extended with income_extraordinary (9 members total)
  - NATURE_LABELS relabeled income to 'Entrate ricorrenti', income_extraordinary 'Straordinaria'
  - NATURE_ORDER and NATURE_COLORS updated with income_extraordinary
  - flowNatureEnum Postgres enum extended via migration 0017
  - getOverviewAmountTotals and getUncategorizedCount exported from dashboard.ts
  - emptySegments() in buildMonthlyNatureTrendData includes income_extraordinary
  - tests/overview-dal.test.ts failing scaffold for 4 future DAL functions
  - drizzle/migrations/0017_tearful_the_stranger.sql single ADD VALUE IF NOT EXISTS statement

affects:
  - 42-02 (seed-extras slug membership for income_extraordinary)
  - 42-03 (lib/dal/overview.ts — depends on exported helpers and new union member)
  - dashboard (emptySegments updated — MonthlyNatureTrendPoint shape change)
  - tests/dashboard-charts (NATURE_ORDER now has 10 elements including income_extraordinary)

tech-stack:
  added: []
  patterns:
    - Single-statement enum migration (ADD VALUE IF NOT EXISTS) isolated in its own SQL file
    - export keyword added to private helpers for cross-DAL reuse (no behavior change)
    - TDD RED scaffold: test file imports from non-existent module to establish failing state

key-files:
  created:
    - drizzle/migrations/0017_tearful_the_stranger.sql
    - drizzle/migrations/meta/0017_snapshot.json
    - tests/overview-dal.test.ts
  modified:
    - lib/db/schema.ts
    - lib/utils/nature-labels.ts
    - lib/dal/dashboard.ts
    - scripts/seed-extras.ts
    - drizzle/migrations/meta/_journal.json
    - tests/nature-labels.test.ts
    - tests/dashboard-dal.test.ts

key-decisions:
  - "Hand-edited generated migration to use IF NOT EXISTS and AFTER 'income' (drizzle-kit emitted BEFORE 'debt' without IF NOT EXISTS — functionally equivalent but less idempotent)"
  - "income_extraordinary slug list left empty in NATURE_SLUGS — PO confirmation deferred to plan 42-02 which owns the seed step"
  - "dashboard-charts.test.tsx needed no explicit change — test is dynamic via NATURE_ORDER.filter and passes automatically once NATURE_ORDER is updated"

patterns-established:
  - "Enum blast-radius absorbed in one plan wave: extend schema + union + all Record<FlowNature,...> literals before any consuming code"
  - "vi.mock chain for DAL scaffold: server-only, react/cache, db.execute, verifySession — mirrors months-with-data-dal.test.ts"

requirements-completed: [DATA-04]

duration: 35min
completed: 2026-06-07
---

# Phase 42 Plan 01: Overview Data Layer — Type Substrate Summary

**FlowNature union extended to 9 members with income_extraordinary, standalone ADD VALUE migration generated, two dashboard helpers exported, and failing test scaffold created for overview DAL**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-06-07T19:45:00Z
- **Completed:** 2026-06-07T20:20:00Z
- **Tasks:** 2
- **Files modified:** 10 (3 new, 7 modified)

## Accomplishments

- Extended `FlowNature` union from 8 to 9 members; `income_extraordinary` positioned after `income` in all Record literals, NATURE_ORDER, NATURE_COLORS, and the Postgres enum
- Relabeled `income` from 'Entrate' to 'Entrate ricorrenti' and added `income_extraordinary: 'Straordinaria'` across NATURE_LABELS
- Generated and hand-verified single-statement migration `0017_tearful_the_stranger.sql` using `ALTER TYPE ADD VALUE IF NOT EXISTS 'income_extraordinary' AFTER 'income'`
- Exported `getOverviewAmountTotals` and `getUncategorizedCount` from `dashboard.ts` for reuse in plan 42-03
- Created `tests/overview-dal.test.ts` as intentional RED scaffold (15 tests fail with "Cannot find module @/lib/dal/overview")
- Updated 3 existing test files: 61 tests pass GREEN after union extension

## Task Commits

1. **Task 1: Create failing overview-dal test scaffold + update 3 existing tests** - `2fe8cbc` (test)
2. **Task 2: Extend flowNatureEnum + FlowNature + labels/order/colors + dashboard blast-radius + generate migration** - `0577d23` (feat)

## Files Created/Modified

- `lib/db/schema.ts` — flowNatureEnum values array: added 'income_extraordinary' after 'income'
- `lib/utils/nature-labels.ts` — FlowNature union, NATURE_LABELS (relabel + new key), NATURE_ORDER, NATURE_COLORS all extended
- `lib/dal/dashboard.ts` — export keyword added to getUncategorizedCount and getOverviewAmountTotals; income_extraordinary added to emptySegments()
- `scripts/seed-extras.ts` — income_extraordinary key added to NATURE_SLUGS (empty list); rebucketIncomeNatures step added with isNull(subCategory.userId) guard
- `drizzle/migrations/0017_tearful_the_stranger.sql` — single `ALTER TYPE ADD VALUE IF NOT EXISTS 'income_extraordinary' AFTER 'income'` statement
- `drizzle/migrations/meta/0017_snapshot.json` — drizzle-kit schema snapshot
- `drizzle/migrations/meta/_journal.json` — updated migration journal
- `tests/overview-dal.test.ts` — RED scaffold: 4 describe blocks for getYearsWithData, getOverview, getMonthOverMonthCategoryChanges, getOverviewChart
- `tests/nature-labels.test.ts` — key counts 9→10, non-null natures 8→9, income label updated, income_extraordinary added
- `tests/dashboard-dal.test.ts` — income_extraordinary added to expected segment-keys assertion

## Decisions Made

- Hand-edited migration SQL to use `IF NOT EXISTS` and `AFTER 'income'` instead of drizzle-kit's generated `BEFORE 'debt'` (no IF NOT EXISTS). Semantically equivalent position but the edited form is more idempotent and matches the plan specification.
- Left `income_extraordinary: []` in NATURE_SLUGS — slug membership is a PO concern deferred to plan 42-02 which owns the rebucket seed step.
- `tests/dashboard-charts.test.tsx` required no explicit numeric change — the test iterates dynamically over `NATURE_ORDER.filter(n => n !== null)` and passes automatically after NATURE_ORDER grows to 10 entries.

## Deviations from Plan

None - plan executed exactly as written, except:

**1. [Rule 1 - Bug] Hand-corrected drizzle-kit generated migration**
- **Found during:** Task 2 (generate migration)
- **Issue:** drizzle-kit emitted `ADD VALUE 'income_extraordinary' BEFORE 'debt'` without `IF NOT EXISTS` — missing idempotency guard specified in plan and Pitfall 1
- **Fix:** Replaced SQL content with `ADD VALUE IF NOT EXISTS 'income_extraordinary' AFTER 'income'` — idempotent, matches plan, positions enum value correctly
- **Files modified:** drizzle/migrations/0017_tearful_the_stranger.sql
- **Verification:** File contains single statement, re-runnable safely
- **Committed in:** 0577d23

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug: generated migration lacked IF NOT EXISTS)
**Impact on plan:** Fix aligns with plan's Pitfall 1 constraint. No scope creep.

## Issues Encountered

- **Vitest configuration excludes `.claude/`** — the worktree lives under `.claude/worktrees/` which is in the Vitest exclude list. Tests were run via direct invocation of the `node_modules/.bin/vitest` binary from the worktree root rather than `yarn test`. Both `yarn build` and `yarn check:language` were run from the main repo directory (which builds from the worktree's modified files via git checkout). This is the expected worktree execution model and does not affect test correctness.
- **Pre-existing language violations** — `yarn check:language` reports violations in `app/proto/overview/NOTES.md`, `tests/subcategory-picker.test.tsx`, and `tests/suggestion-promote-form.test.tsx`. These are pre-existing and unrelated to this plan. No violations in files modified by this plan.

## Known Stubs

- `scripts/seed-extras.ts` NATURE_SLUGS `income_extraordinary: []` — intentional empty list; plan 42-02 owns PO-confirmed slug membership. The rebucketIncomeNatures step skips gracefully when the list is empty.

## Threat Flags

None — no new auth/input/network surface introduced. The two newly-exported dashboard helpers remain server-only and maintain their verifySession() auth gate in the calling DAL function (plan 42-03).

## Next Phase Readiness

- Plan 42-02 can immediately add slug membership to `income_extraordinary: []` in NATURE_SLUGS and run the seed step
- Plan 42-03 can write `lib/dal/overview.ts` — the exported helpers and new union member are ready; the RED scaffold (tests/overview-dal.test.ts) defines the expected contract
- `yarn db:migrate` must be run against the DB to apply 0017 before 42-03 integration tests are meaningful
- Dashboard components consuming `emptySegments()` will now receive an additional `income_extraordinary` key in the segments Record — this is additive and backward-compatible

---
*Phase: 42-overview-data-layer*
*Completed: 2026-06-07*
