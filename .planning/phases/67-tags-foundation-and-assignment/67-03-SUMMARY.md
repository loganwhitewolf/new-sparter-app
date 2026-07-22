---
phase: 67-tags-foundation-and-assignment
plan: 03
subsystem: backend
tags: [drizzle, zod, server-actions, tags]

# Dependency graph
requires: ["67-01"]
provides:
  - "lib/dal/tags.ts: getTags, getTag, getActiveTagsWithDateRange, getTagByNormalizedName, insertTagRow, updateTagRow, archiveTagRow, type TagRow"
  - "lib/services/tag-operations.ts: TagMutationError, normalizeTagName, createTag, updateTag, archiveTag"
  - "lib/actions/tags.ts: createTagAction, updateTagAction, archiveTagAction, type CreateTagActionState"
affects: [67-04, 67-05, 67-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual uniqueness guard (D-02): service-level pre-check via getTagByNormalizedName PLUS a 23505 catch-and-remap fallback around the insert/update — the pre-check alone cannot close the concurrent-create race, only the DB constraint (from Plan 67-01) can"
    - "Partial-update semantics in updateTag: only fields explicitly passed (name and/or date range) are included in the DAL update payload, so an edit that changes only the range never touches the name/normalizedName columns"

key-files:
  created:
    - lib/dal/tags.ts
    - lib/services/tag-operations.ts
    - lib/actions/tags.ts
    - tests/tags-dal.test.ts
    - tests/tag-operations.test.ts
    - tests/tag-actions.test.ts
  modified: []

key-decisions:
  - "isUniqueConflict is duplicated (not imported) between lib/dal/categories.ts and lib/services/tag-operations.ts per the plan's read_first note — keeps the categories and tags domains independent rather than introducing a cross-domain import for a 6-line helper."
  - "updateTag builds its DAL update payload conditionally (only including name/normalizedName/dateRangeStart/dateRangeEnd keys that were actually provided), rather than always passing dateRangeStart/dateRangeEnd through — this preserves D-03's independent name-vs-range editing without accidentally nulling out an untouched range on a name-only edit."

requirements-completed: [TAG-01]

coverage:
  - id: D1
    description: "getTags/getTag/getActiveTagsWithDateRange/getTagByNormalizedName are IDOR-scoped by userId, empty-array-safe (never null/throw), and getTags/getActiveTagsWithDateRange are stably ordered by createdAt asc, id asc"
    requirement: TAG-01
    verification:
      - kind: unit
        ref: "node_modules/.bin/vitest tests/tags-dal.test.ts --run (9 tests, including empty-array and stable-ordering cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "createTag/updateTag enforce D-02 case/whitespace-insensitive uniqueness via a service pre-check AND a DB-constraint-catch fallback (simulated concurrent-duplicate case proven); archiveTag never deletes and is idempotent (D-04)"
    requirement: TAG-01
    verification:
      - kind: unit
        ref: "node_modules/.bin/vitest tests/tag-operations.test.ts --run (13 tests, including the simulated-race concurrency case and double-archive idempotency)"
        status: pass
    human_judgment: false
  - id: D3
    description: "createTagAction/updateTagAction/archiveTagAction validate input, call verifySession, delegate to the service, map TagMutationError to a user-facing inline message, and revalidate /settings/tags"
    requirement: TAG-01
    verification:
      - kind: unit
        ref: "node_modules/.bin/vitest tests/tag-actions.test.ts --run (10 tests, including duplicate/not_found error-message passthrough)"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-07-20
status: complete
---

# Phase 67 Plan 03: Tags Foundation Backend (DAL + Service + Actions) Summary

**userId-scoped tag DAL, a service layer owning the D-02 dual uniqueness guard (pre-check + DB-constraint catch), and the three thin server actions Plan 67-08's `/settings/tags` UI will call.**

## Performance

- **Duration:** ~3 min (task execution; excludes context-read time)
- **Tasks:** 3
- **Files modified:** 6 (all created — 3 source, 3 test)

## Accomplishments

- `lib/dal/tags.ts`: `getTags`, `getTag`, `getActiveTagsWithDateRange`, `getTagByNormalizedName` (all IDOR-scoped by `userId`, empty-safe, stably ordered by `createdAt` asc/`id` asc), `insertTagRow`, `updateTagRow`, `archiveTagRow` (the only write to `archived`), and `type TagRow`. No `db.delete(tag)` call exists anywhere in the file.
- `lib/services/tag-operations.ts`: `TagMutationError` (`'not_found' | 'duplicate'`), `normalizeTagName` (`trim().toLowerCase()`), `createTag`, `updateTag`, `archiveTag`. `createTag`/`updateTag` run a fast `getTagByNormalizedName` pre-check AND wrap the insert/update in a `23505`-catch fallback — proven by a test that simulates the pre-check finding nothing while the insert still conflicts (the race the pre-check alone cannot close). `updateTag` excludes the tag's own row from the uniqueness re-check and only touches fields explicitly provided (name and/or date range independently, per D-03). `archiveTag` is idempotent and calls only `archiveTagRow`.
- `lib/actions/tags.ts`: `createTagAction` (returns `{ error, tagId }` via `CreateTagActionState` — the widened state Plan 67-08 needs for the create-time suggestion trigger), `updateTagAction`, `archiveTagAction`. Each parses `FormData` via the Plan 67-01 Zod schemas, calls `verifySession()`, delegates to the service, maps `TagMutationError` straight to its own user-facing Italian message, and calls `revalidatePath(APP_ROUTES.tagSettings)` on success.
- 32 new unit tests across three files, all using the codebase's established mocked-drizzle-chain pattern (no live DB in tests).

## Task Commits

Each task was committed atomically:

1. **Task 1: lib/dal/tags.ts — userId-scoped tag queries** - `5dcfe50` (feat)
2. **Task 2: lib/services/tag-operations.ts — CRUD + D-02 uniqueness guard** - `214e30e` (feat)
3. **Task 3: lib/actions/tags.ts — createTagAction, updateTagAction, archiveTagAction** - `893d066` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `lib/dal/tags.ts` — DAL queries, `type TagRow`
- `lib/services/tag-operations.ts` — `TagMutationError`, `normalizeTagName`, `createTag`, `updateTag`, `archiveTag`
- `lib/actions/tags.ts` — `createTagAction`, `updateTagAction`, `archiveTagAction`, `type CreateTagActionState`
- `tests/tags-dal.test.ts`, `tests/tag-operations.test.ts`, `tests/tag-actions.test.ts` — unit test coverage for all three layers

## Decisions Made

- `isUniqueConflict` is duplicated (not imported) between `lib/dal/categories.ts` and `lib/services/tag-operations.ts`, per the plan's explicit instruction — avoids a cross-domain dependency between categories and tags for a 6-line helper.
- `updateTag` builds its DAL update payload conditionally, including only the keys the caller actually provided (`name`/`normalizedName` only when `input.name !== undefined`; `dateRangeStart`/`dateRangeEnd` only when explicitly passed) — this is what makes D-03's "changing the range does not disturb the name, and vice versa" guarantee hold at the DAL call boundary, not just at the type level.

## Deviations from Plan

None — plan executed exactly as written. All three tasks' `<action>` blocks were implemented as specified; the one refinement (partial-update payload construction in `updateTag`, described above) is a direct, literal reading of the plan's D-03 requirement and the `<behavior>` block's "re-checks uniqueness excluding the tag's own row" / "does not auto-re-run suggestions" language, not a deviation from it.

## Issues Encountered

- Pre-existing, unrelated TypeScript baseline errors (21 total, in `tests/suggestion-card.test.tsx`, `tests/suggestion-promote-form.test.tsx`, `tests/transactions-dal.test.ts` — same as documented in 67-01-SUMMARY.md) were confirmed present both before and after this plan's changes via `yarn tsc --noEmit`. Out of scope per the scope-boundary rule; not touched.

## User Setup Required

None — no external service configuration required. This plan only adds application code and tests; no migration or seed changes.

## Next Phase Readiness

- Plan 67-04 (bulk-assign/remove) can build on `lib/dal/tags.ts`'s `getTags`/`getTag` for tag-list rendering in the assignment dialog.
- Plan 67-05 (date-range suggestion flow) can build on `getActiveTagsWithDateRange` and reuse the `TagMutationError`/service patterns established here.
- Plan 67-08 (`/settings/tags` UI) has all three CRUD actions ready to call, including `createTagAction`'s `tagId` return value for the D-08a create-time suggestion trigger.
- No blockers for downstream plans in this phase.

---
*Phase: 67-tags-foundation-and-assignment*
*Completed: 2026-07-20*
