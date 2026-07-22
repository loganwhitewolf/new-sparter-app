---
phase: 67-tags-foundation-and-assignment
plan: 05
subsystem: backend
tags: [drizzle, zod, server-actions, tags, tag-suggestions]

# Dependency graph
requires: ["67-03", "67-04"]
provides:
  - "lib/dal/tag-suggestions.ts: getTransactionsInDateRange, type TransactionForSuggestion"
  - "lib/services/tag-suggestions.ts: isOccurredAtInRange, computeSuggestionsForTag, computeSuggestionsForNewTag, computeAllTagSuggestions, type TagSuggestionMatch, type TagSuggestionGroup"
  - "lib/actions/tag-suggestions.ts: getNewTagSuggestionsAction, confirmTagSuggestionAction"
affects: [67-08, 67-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-08 single shared core: computeSuggestionsForTag is the only matching implementation; both computeSuggestionsForNewTag (create-time, D-08a) and computeAllTagSuggestions (post-import, D-08b) delegate to it — no divergent matching logic"
    - "D-09 belt-and-suspenders inclusive boundary: the DB query (gte/lte) AND a pure isOccurredAtInRange helper both encode the inclusive-boundary contract independently, so a caller re-filtering an already-fetched list gets the same semantics as the query"
    - "D-10 dedup at the matcher core: computeSuggestionsForTag itself (not its callers) filters through getAlreadyTaggedTransactionIds, so both triggers get dedup for free"
    - "Group-level empty-omission differs by caller: computeSuggestionsForNewTag always returns its one group (even with empty matches — the create-time caller decides UI visibility); computeAllTagSuggestions omits empty-match groups (it feeds a multi-tag summary block)"

key-files:
  created:
    - lib/dal/tag-suggestions.ts
    - lib/services/tag-suggestions.ts
    - lib/actions/tag-suggestions.ts
    - tests/tag-suggestions.test.ts
  modified: []

key-decisions:
  - "Test file mocking strategy deviates from the plan's literal instruction to mock @/lib/dal/tag-suggestions in Task 2's tests and @/lib/services/tag-suggestions in Task 3's tests. Since all three tasks accumulate into ONE test file (tests/tag-suggestions.test.ts) and vi.mock calls are hoisted file-wide, mocking a module that Task 1 (or Task 2) tests via its REAL implementation would silently replace that real implementation everywhere in the file, breaking the DAL/service-level assertions those earlier tasks depend on. Instead: Task 2's tests exercise the REAL lib/dal/tag-suggestions (backed by Task 1's mocked @/lib/db/drizzle-orm/schema) and only mock the tag-lookup/dedup DAL boundaries (@/lib/dal/tags, @/lib/dal/transaction-tags); Task 3's tests exercise the REAL lib/services/tag-suggestions (backed by Task 2's DAL mocks) and only mock @/lib/dal/auth, tag-assignment's bulkAssignTags, and next/cache. This achieves the same isolation goal (each task's own logic is under test, its dependencies are controlled) without the file-wide vi.mock hoisting conflict, and keeps the single-file structure the plan's files_modified list specifies."
  - "computeSuggestionsForNewTag always returns its one group (even with empty matches) for a found tag, per the plan's <action> block's literal code spec — not null for a range-less tag, despite the <behavior> block's summary prose reading ambiguously ('...or has no date range'). The <action> block is the authoritative, code-level instruction and was followed exactly; a tag with no date range naturally yields matches: [] via computeSuggestionsForTag's own no-range short-circuit, never a null group."

requirements-completed: [TAG-03]

coverage:
  - id: D1
    description: "getTransactionsInDateRange is inclusive at both boundaries (gte/lte, zero gt/lt occurrences), stably ordered by occurredAt asc/id asc, and resolves to [] (never an error) when nothing matches"
    requirement: TAG-03
    verification:
      - kind: unit
        ref: "node_modules/.bin/vitest tests/tag-suggestions.test.ts --run (Task 1: 4 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "computeSuggestionsForTag is the single core both triggers share: no-range tags short-circuit to [] without querying; matches are D-10-deduped via getAlreadyTaggedTransactionIds; isOccurredAtInRange is true at exactly start/end (D-09); computeSuggestionsForNewTag/computeAllTagSuggestions both delegate to it and never call bulkAssignTags/bulkRemoveTags (D-08, grep-verified 0 occurrences)"
    requirement: TAG-03
    verification:
      - kind: unit
        ref: "node_modules/.bin/vitest tests/tag-suggestions.test.ts --run (Task 2: 10 tests, including the boundary/dedup/empty-group-omission cases)"
        status: pass
      - kind: unit
        ref: "grep -cF 'bulkAssignTags' lib/services/tag-suggestions.ts and grep -cF 'bulkRemoveTags' lib/services/tag-suggestions.ts both return 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "getNewTagSuggestionsAction returns the computed group unchanged, resolves { group: null } for a forged/absent tagId (T-67-12, IDOR-safe via getTag); confirmTagSuggestionAction rejects malformed input before verifySession, delegates to Plan 67-04's ownership-verified bulkAssignTags with tagIds: [tagId] (T-67-13), and maps TagAssignmentError to its own message"
    requirement: TAG-03
    verification:
      - kind: unit
        ref: "node_modules/.bin/vitest tests/tag-suggestions.test.ts --run (Task 3: 7 tests, including the malformed-JSON, IDOR, and error-passthrough cases)"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-07-20
status: complete
---

# Phase 67 Plan 05: Tag Suggestion Backend (date-range matcher + dedup + actions) Summary

**A single date-range suggestion matcher (D-09 inclusive boundary, D-10 already-tagged dedup) shared by both suggestion triggers, plus the two server actions the create-time modal (67-08) and post-import summary block (67-09) will call — the confirm path delegates entirely to Plan 67-04's ownership-verified bulkAssignTags.**

## Performance

- **Duration:** ~5 min (task execution; excludes context-read time)
- **Started:** 2026-07-20T16:44:00+02:00 (first task commit)
- **Completed:** 2026-07-20T16:48:17+02:00 (last task commit)
- **Tasks:** 3
- **Files modified:** 4 (all created — 3 source, 1 accumulated test file)

## Accomplishments

- `lib/dal/tag-suggestions.ts`: `getTransactionsInDateRange` (inclusive `gte`/`lte` bounds on `occurredAt`, scoped to `userId`, ordered `occurredAt` asc/`id` asc — mirrors `buildTransactionOrderBy`'s tiebreaker idiom without importing from `lib/dal/transactions.ts`) and `type TransactionForSuggestion` (carries display fields `description`/`customTitle`/`amount`/`currency`, not just `id`/`occurredAt`).
- `lib/services/tag-suggestions.ts`: `isOccurredAtInRange` (pure, inclusive-boundary predicate — belt-and-suspenders alongside the DB query's own `gte`/`lte`), `computeSuggestionsForTag` (the single shared core: no-range tags short-circuit to `[]` without querying; D-10 dedup via `getAlreadyTaggedTransactionIds` from Plan 67-04), `computeSuggestionsForNewTag` (D-08a — loads the one tag via `getTag`, IDOR-safe, always returns its group for a found tag), `computeAllTagSuggestions` (D-08b — re-scans every active date-ranged tag's FULL range against ALL transactions on every call, omits empty-match groups). No import of `bulkAssignTags`/`bulkRemoveTags` anywhere in the file.
- `lib/actions/tag-suggestions.ts`: `getNewTagSuggestionsAction` (plain data-returning function, the `detachTransaction` shape — not a form submission) and `confirmTagSuggestionAction` (delegates entirely to Plan 67-04's `bulkAssignTags`, no re-implemented assignment path).
- 21 new unit tests in `tests/tag-suggestions.test.ts`, accumulated across all three tasks per the plan's `files_modified` list, using the codebase's established mocked-drizzle-chain pattern (no live DB in tests) plus targeted DAL/service mocking at each task's own dependency boundary.

## Task Commits

Each task was committed atomically:

1. **Task 1: lib/dal/tag-suggestions.ts — date-range transaction query** - `1e0286c` (feat)
2. **Task 2: lib/services/tag-suggestions.ts — shared matcher + dedup (D-09, D-10)** - `fb8a76d` (feat)
3. **Task 3: lib/actions/tag-suggestions.ts — fetch + confirm actions** - `1635b86` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `lib/dal/tag-suggestions.ts` — `getTransactionsInDateRange`, `type TransactionForSuggestion`
- `lib/services/tag-suggestions.ts` — `isOccurredAtInRange`, `computeSuggestionsForTag`, `computeSuggestionsForNewTag`, `computeAllTagSuggestions`, `type TagSuggestionMatch`, `type TagSuggestionGroup`
- `lib/actions/tag-suggestions.ts` — `getNewTagSuggestionsAction`, `confirmTagSuggestionAction`
- `tests/tag-suggestions.test.ts` — accumulated unit test coverage for all three layers (21 tests)

## Decisions Made

- **Test-file mocking strategy** (documented in full in `key-decisions` frontmatter above): rather than mocking each task's own module wholesale per the plan's literal per-task instructions (which would conflict via `vi.mock`'s file-wide hoisting once accumulated into one file), each task's tests exercise the REAL implementation of the module built by the PRIOR task, backed by that prior task's already-established lower-level mocks, and only mock the NEW dependency boundary introduced at that task's own layer. This achieves the same isolation intent (each task's own logic under test, its true external dependencies controlled) while keeping the single accumulated test file the plan specifies.
- `computeSuggestionsForNewTag` always returns its one group (never `null`) for a found tag, including one with no date range (`matches: []`) — followed the `<action>` block's literal code specification over the `<behavior>` block's more ambiguous summary prose, since the action block is the authoritative code-level instruction.

## Deviations from Plan

### Auto-fixed Issues

None — no bugs, missing functionality, or blocking issues encountered during implementation of the specified behavior.

**1. [Rule 3 - Blocking issue] Test-file mocking strategy adjusted from the plan's literal per-task mock instructions**
- **Found during:** Task 2 (writing tests before implementing Task 2's assertions revealed the conflict)
- **Issue:** The plan instructs Task 2's tests to mock `@/lib/dal/tag-suggestions` (among others) and Task 3's tests to mock `@/lib/services/tag-suggestions` — but both modules are tested via their REAL implementation in the SAME accumulated test file by an earlier task (Task 1 tests the real DAL; Task 2 tests the real service). `vi.mock` calls are hoisted to the top of the file regardless of where they're written, so introducing a mock of a module whose real implementation an earlier `describe` block depends on would silently replace that real implementation everywhere in the file — breaking the earlier task's own assertions, not just isolating the later task.
- **Fix:** Task 2's tests exercise the real `lib/dal/tag-suggestions` (backed by Task 1's mocked `@/lib/db`/`drizzle-orm`/`@/lib/db/schema`) and only mock `@/lib/dal/tags`/`@/lib/dal/transaction-tags` (dependencies Task 1 never touched, so no conflict). Task 3's tests exercise the real `lib/services/tag-suggestions` (backed by Task 2's DAL mocks) and only mock `@/lib/dal/auth`, `tag-assignment`'s `bulkAssignTags`, and `next/cache`.
- **Files modified:** `tests/tag-suggestions.test.ts`
- **Commits:** `fb8a76d`, `1635b86`

## Issues Encountered

- Pre-existing, unrelated TypeScript baseline errors (21 total, in `tests/suggestion-card.test.tsx`, `tests/suggestion-promote-form.test.tsx`, `tests/transactions-dal.test.ts` — same as documented in 67-01/67-03/67-04 summaries) were confirmed present both before and after this plan's changes via `yarn tsc --noEmit`. Out of scope per the scope-boundary rule; not touched.
- `grep -c`/`rg` in this environment (via the RTK proxy) treats parenthesized alternation patterns like `gte(...)` as regex groups and errors on plain substrings containing `(` — used `grep -cF` (fixed-string) for all acceptance-criteria substring checks instead.

## User Setup Required

None — no external service configuration required. This plan only adds application code and tests; no migration or seed changes.

## Next Phase Readiness

- Plan 67-08 (`/settings/tags` create-time suggestion modal) can call `getNewTagSuggestionsAction({ tagId })` directly after `createTagAction` returns its `tagId`, and `confirmTagSuggestionAction` for the confirm button.
- Plan 67-09 (post-import "Suggerimenti tag" summary block) can call `computeAllTagSuggestions({ userId })` server-side (RSC) to render one pre-checked checklist per matching tag, and `confirmTagSuggestionAction` per tag's confirm action.
- No blockers for downstream plans in this phase.

---
*Phase: 67-tags-foundation-and-assignment*
*Completed: 2026-07-20*

## Self-Check: PASSED

- FOUND: lib/dal/tag-suggestions.ts
- FOUND: lib/services/tag-suggestions.ts
- FOUND: lib/actions/tag-suggestions.ts
- FOUND: tests/tag-suggestions.test.ts
- FOUND: 1e0286c (Task 1 commit)
- FOUND: fb8a76d (Task 2 commit)
- FOUND: 1635b86 (Task 3 commit)
