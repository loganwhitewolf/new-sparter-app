---
phase: 67-tags-foundation-and-assignment
plan: 09
subsystem: ui
tags: [react, next, server-actions, tags, tag-suggestions, import]

# Dependency graph
requires:
  - phase: 67-tags-foundation-and-assignment
    provides: "lib/services/tag-suggestions.ts: computeAllTagSuggestions, type TagSuggestionGroup (Plan 67-05); lib/actions/tag-suggestions.ts: confirmTagSuggestionAction (Plan 67-05)"
provides:
  - "components/import/tag-suggestion-section.tsx: TagSuggestionSection, TagSuggestionCard"
  - "app/(app)/import/[fileId]/suggestions/page.tsx: calls computeAllTagSuggestions({ userId }), renders TagSuggestionSection"
affects: [68-tag-analytics-and-filtering]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-08b block-per-tag idiom: TagSuggestionSection renders one independently-confirmable TagSuggestionCard per TagSuggestionGroup — confirming one card does not dismiss or reload the others still pending on the same screen"
    - "Full re-scan on every page visit: the suggestions page calls computeAllTagSuggestions({ userId }) with no fileId/platformId, so re-visiting after a later import naturally re-proposes any newly-in-range, not-yet-tagged transactions (never scoped to a single import's rows)"
    - "TAG-03 empty edge: TagSuggestionSection returns null (not an empty wrapper) when groups is empty — the block is omitted entirely from the DOM, independent of the pre-existing pattern-suggestions empty state"

key-files:
  created:
    - components/import/tag-suggestion-section.tsx
  modified:
    - "app/(app)/import/[fileId]/suggestions/page.tsx"
    - tests/import-suggestions-page.test.tsx

key-decisions:
  - "TagSuggestionCard keeps a local `confirmed` boolean instead of removing itself from the list on success — since other tags' cards on the same screen may still be pending confirmation, the plan explicitly rules out a disappear/reload behavior in favor of a short inline 'Confermato.' success state."

requirements-completed: [TAG-03]

coverage:
  - id: D1
    description: "TagSuggestionSection renders null when groups is empty (TAG-03 empty edge), and one independently-confirmable TagSuggestionCard per group otherwise, matching pattern-suggestions block visual conventions (Card/CardHeader/CardTitle)"
    requirement: TAG-03
    verification:
      - kind: unit
        ref: "yarn tsc --noEmit exits with the same 21 pre-existing baseline errors, none new; grep -c 'confirmTagSuggestionAction' components/import/tag-suggestion-section.tsx >= 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "The post-import suggestions page calls computeAllTagSuggestions({ userId }) with no fileId/platformId argument, gated behind both existing notFound() guards, and renders TagSuggestionSection as a sibling block after the pattern-suggestions section/empty-state"
    requirement: TAG-03
    verification:
      - kind: unit
        ref: "node_modules/.bin/vitest tests/import-suggestions-page.test.tsx --run (16 tests: 13 pre-existing unaffected + 3 new TAG-03 cases covering empty-omission, non-empty rendering, and independence from the pattern-suggestions empty state)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Browser flow: create a dated tag, import matching transactions, visit the suggestions page, see a pre-checked 'Suggerimenti tag' block, confirm it, and confirm the now-tagged transactions no longer reappear on a later visit (D-10 dedup holds across page visits)"
    verification: []
    human_judgment: true
    rationale: "Requires a live browser session against a real import + a real dated tag with matching transactions; not independently driven in this session per the plan's <human-check> instruction — flagged for user UAT."

duration: 8min
completed: 2026-07-20
status: complete
---

# Phase 67 Plan 09: Post-Import "Suggerimenti tag" Summary Block (D-08b) Summary

**A "Suggerimenti tag" block attached to the existing post-import summary screen (`/import/[fileId]/suggestions`), rendering one pre-checked, independently-confirmable checklist per tag whose full date range has un-tagged matches — computed fresh via `computeAllTagSuggestions` on every page visit.**

## Performance

- **Duration:** ~8 min (task execution; excludes context-read time)
- **Started:** 2026-07-20T15:15:00Z (approx, first task commit)
- **Completed:** 2026-07-20T15:23:49Z (last task commit)
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `components/import/tag-suggestion-section.tsx`: `TagSuggestionSection` (returns `null` when `groups` is empty per TAG-03's empty edge; otherwise renders a "Suggerimenti tag" heading + intro line + one `TagSuggestionCard` per group) and `TagSuggestionCard` (pre-checked checklist mirroring `TagCreationSuggestionsDialog`'s idiom adapted from a modal to an inline `Card`, independently confirmable via `confirmTagSuggestionAction`, shows a short "Confermato." success state instead of disappearing so sibling cards' pending state is unaffected).
- `app/(app)/import/[fileId]/suggestions/page.tsx`: extended the existing `Promise.all([discoverRegexCandidates, getCategories])` with a third `computeAllTagSuggestions({ userId })` call — still gated behind both `notFound()` guards, never passed `fileId`/`platformId` (full-range re-scan per D-08b). Renders `<TagSuggestionSection groups={tagSuggestionGroups} />` as a new sibling block after the existing pattern-suggestions conditional.
- `tests/import-suggestions-page.test.tsx`: added `computeAllTagSuggestions` to the hoisted mocks + a new `vi.mock('@/lib/services/tag-suggestions', ...)`, defaulted it to `[]` in `beforeEach` so all 13 pre-existing cases stay green, and added a `TAG-03: post-import tag suggestions (D-08b)` describe block with 3 new cases (empty-omission, non-empty rendering with tag name + both match descriptions, and independence from the pattern-suggestions empty state).

## Task Commits

Each task was committed atomically:

1. **Task 1: TagSuggestionSection — per-tag pre-checked checklist block** - `7981076` (feat)
2. **Task 2: Wire computeAllTagSuggestions into the post-import summary page (D-08b)** - `a8a8124` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `components/import/tag-suggestion-section.tsx` — `TagSuggestionSection`, `TagSuggestionCard` (created)
- `app/(app)/import/[fileId]/suggestions/page.tsx` — extended `Promise.all`, renders `TagSuggestionSection`
- `tests/import-suggestions-page.test.tsx` — new mock + 3 new TAG-03 test cases, 13 pre-existing cases unaffected

## Decisions Made

- `TagSuggestionCard` keeps a local `confirmed` boolean and swaps to a short "Confermato." success state on the same card, rather than removing the card from the list or reloading the page — the plan explicitly requires this since multiple tags' cards render on the same screen and confirming one must not disturb the others' pending state.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' `<action>` blocks were implemented as specified.

## Issues Encountered

- Pre-existing, unrelated TypeScript baseline errors (21 total, same set documented in 67-01/67-03/67-04/67-05/67-06/67-08 summaries) were confirmed present both before and after this plan's changes via `yarn tsc --noEmit`. Out of scope per the scope-boundary rule; not touched.
- The plan's Task 2 `<verify>` block includes a `<human-check>` manual browser-interaction step (create a dated tag → import matching transactions → visit suggestions page → confirm the block → re-visit and confirm D-10 dedup holds across visits). This plan has no `type="checkpoint:*"` tasks (fully autonomous, Pattern A), so execution did not pause for it; it was not independently driven in a live browser this session. Flagged under `coverage: D3` above and open for the user's own UAT pass.

## User Setup Required

None — no external service configuration required. This plan only adds application code and tests; no migration or seed changes.

## Next Phase Readiness

- This is the final plan (67-09) of Phase 67-tags-foundation-and-assignment. Both TAG-03 suggestion triggers (D-08a create-time modal from Plan 67-08, D-08b post-import block from this plan) are now wired to Plan 67-05's shared backend.
- TAG-01/TAG-02/TAG-03/TAG-06 are all addressed across this phase's 9 plans. Phase 68 (dashboard global tag-filter TAG-04, Tag section with per-tag totals TAG-05, dashboard→transactions navigation NAV-01) can build directly on this phase's `tag`/`transaction_tag` schema and `lib/dal/tags.ts`/`lib/services/tag-operations.ts` without further backend changes.
- No blockers for downstream phases.

---
*Phase: 67-tags-foundation-and-assignment*
*Completed: 2026-07-20*

## Self-Check: PASSED

- FOUND: components/import/tag-suggestion-section.tsx
- FOUND: app/(app)/import/[fileId]/suggestions/page.tsx
- FOUND: tests/import-suggestions-page.test.tsx
- FOUND: 7981076 (Task 1 commit)
- FOUND: a8a8124 (Task 2 commit)
