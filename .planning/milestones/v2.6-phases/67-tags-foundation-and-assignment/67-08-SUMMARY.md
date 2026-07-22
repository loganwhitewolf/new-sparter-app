---
phase: 67-tags-foundation-and-assignment
plan: 08
subsystem: frontend
tags: [react, server-actions, tags, settings, suggestions]

# Dependency graph
requires: ["67-03", "67-05"]
provides:
  - "components/tags/tag-mutation-dialogs.tsx: hasCompleteDateRange, shouldOfferCreateSuggestions, runFetchNewTagSuggestions, CreateTagDialog, EditTagDialog, ArchiveTagDialog"
  - "components/tags/tag-settings-panel.tsx: TagSettingsPanel"
  - "components/tags/tag-creation-suggestions-dialog.tsx: TagCreationSuggestionsDialog"
  - "app/(app)/settings/tags/page.tsx: the /settings/tags RSC page"
  - "components/settings/settings-hub.tsx: new 'Tag' hub card (D-01)"
affects: [67-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CreateTagDialog does NOT reuse useDialogAction — it needs to inspect the action's result (tagId, whether a range was submitted) AFTER success to decide whether to trigger the suggestion fetch, so it manages its own useActionState + refs directly"
    - "hadRangeRef/submittedRef pair captures form-submission-time state BEFORE calling formAction, since the DOM form reset following a successful useActionState submission makes controlled inputs' post-submit values unreliable to re-read"
    - "shouldOfferCreateSuggestions is a TypeScript type-guard (state is {error: null; tagId: number}), narrowing the tagId for the caller without a redundant non-null assertion"
    - "useDialogAction is duplicated locally in tag-mutation-dialogs.tsx (not imported from category-mutation-dialogs.tsx) for EditTagDialog/ArchiveTagDialog — consistent with Plan 67-03's precedent of duplicating isUniqueConflict rather than creating a cross-domain import"

key-files:
  created:
    - components/tags/tag-mutation-dialogs.tsx
    - components/tags/tag-settings-panel.tsx
    - components/tags/tag-creation-suggestions-dialog.tsx
    - app/(app)/settings/tags/page.tsx
    - tests/tag-mutation-dialogs.test.tsx
    - tests/tag-settings-panel.test.tsx
  modified:
    - components/settings/settings-hub.tsx
    - tests/settings-hub.test.tsx

key-decisions:
  - "tests/settings-hub.test.tsx (not in this plan's files_modified list) was updated to add Tags/tagSettings to its lucide-react and @/lib/routes mocks — the new HUB_ITEMS entry would otherwise render an undefined icon component and throw under the existing mocked-module test. Rule 3 (blocking issue) auto-fix."
  - "TagCreationSuggestionsDialog was authored before tag-mutation-dialogs.tsx's tsc verification (Task 1 references it) but committed last (Task 3), matching the plan's task order — tsc checks the working tree, not git commit boundaries, so writing the file early and staging it later satisfies both the plan's stated task sequence and each task's own 'tsc --noEmit exits 0' acceptance criterion."

requirements-completed: [TAG-01, TAG-03]

coverage:
  - id: D1
    description: "/settings/tags is reachable from a new SettingsHub card (D-01) and renders a sidebar+detail tag manager (TagSettingsPanel) via getTags(userId), mirroring CategorySettingsPanel's layout"
    requirement: TAG-01
    verification:
      - kind: unit
        ref: "node_modules/.bin/vitest tests/tag-settings-panel.test.tsx tests/settings-hub.test.tsx --run (13 tests, including the new SettingsHub Tag-card link assertion)"
        status: pass
    human_judgment: false
  - id: D2
    description: "CreateTagDialog/EditTagDialog/ArchiveTagDialog cover create/edit/archive (D-01..D-04): duplicate-name errors surface inline via createTagAction/updateTagAction's ActionState (D-02); EditTagDialog changes name+range but never calls the suggestion path (D-03); ArchiveTagDialog calls only archiveTagAction, no delete option exists anywhere in the file (D-04, grep-verified 0 delete/elimina occurrences)"
    requirement: TAG-01
    verification:
      - kind: unit
        ref: "node_modules/.bin/vitest tests/tag-mutation-dialogs.test.tsx --run (14 tests, including hasCompleteDateRange/shouldOfferCreateSuggestions pure-function cases and the no-delete-wording assertion)"
        status: pass
      - kind: manual_procedural
        ref: "Live-browser duplicate-name-error flow (D-02) — this repo has no jsdom, so the inline-error UI cannot be driven by an automated test; requires a human browser session"
        status: unknown
    human_judgment: true
    rationale: "The plan's must_haves explicitly flag the D-02 inline-error confirmation as a Manual-Only Verification per 67-VALIDATION.md, exercised via <human-check> rather than an automated test (no jsdom in this repo)."
  - id: D3
    description: "Creating a date-ranged tag fetches getNewTagSuggestionsAction and opens TagCreationSuggestionsDialog (pre-checked, deselectable) only when matches exist; a zero-match range is a silent no-op (D-08a, TAG-03)"
    requirement: TAG-03
    verification:
      - kind: unit
        ref: "grep -c confirmTagSuggestionAction components/tags/tag-creation-suggestions-dialog.tsx >= 1; useState initializer equals full group.matches transactionId list (all pre-checked)"
        status: pass
      - kind: manual_procedural
        ref: "Plan's Task 3 <human-check>: create a date-ranged tag over existing transactions, confirm the pre-checked modal opens, deselect one, confirm, verify only the remaining selection carries the tag; repeat with a zero-match range and confirm silent no-op"
        status: unknown
    human_judgment: true
    rationale: "The suggestion-modal open/confirm flow is a live-browser interaction (auto-open on tag creation, checkbox deselection, downstream transaction-tag verification) that this repo's no-jsdom test setup cannot drive end-to-end; flagged in the plan itself as a <human-check>."

duration: 4min
completed: 2026-07-20
status: complete
---

# Phase 67 Plan 08: `/settings/tags` CRUD + Create-Time Suggestion Modal Summary

**Sidebar+detail `/settings/tags` management surface (create/edit/archive, D-01..D-04) plus the create-time suggestion trigger (D-08a) that fetches and offers a pre-checked confirm dialog for a newly-created date-ranged tag's matching transactions.**

## Performance

- **Duration:** ~4 min (task execution; excludes context-read time)
- **Started:** 2026-07-20T17:15:26+02:00 (first task commit)
- **Completed:** 2026-07-20T17:17:42+02:00 (last task commit)
- **Tasks:** 3
- **Files modified:** 8 (6 created, 2 modified)

## Accomplishments

- `components/tags/tag-mutation-dialogs.tsx`: `CreateTagDialog` (name + optional date range; on success, fetches `getNewTagSuggestionsAction` and opens the suggestion modal only when matches exist), `EditTagDialog` (name/range edit, D-03, never touches the suggestion path), `ArchiveTagDialog` (archive-only, D-04, no delete option). Three independently-tested pure/async helpers — `hasCompleteDateRange`, `shouldOfferCreateSuggestions` (a type-guard), `runFetchNewTagSuggestions` — extracted per the `merge-expenses-dialog.test.tsx` no-jsdom strategy.
- `components/tags/tag-settings-panel.tsx`: `TagSettingsPanel` — sidebar+detail layout mirroring `CategorySettingsPanel`, simplified (no hierarchy). Archived tags render inline with an "Archiviato" badge, never filtered (D-04).
- `components/tags/tag-creation-suggestions-dialog.tsx`: `TagCreationSuggestionsDialog` — opens fully pre-checked over `group.matches`, resets on `group.tagId` change, deselecting to zero swaps the confirm button to a plain "Salta" close (no forced empty submission), otherwise confirms via `confirmTagSuggestionAction`.
- `app/(app)/settings/tags/page.tsx`: fetches `getTags(userId)`, renders `TagSettingsPanel` — mirrors `app/(app)/settings/categories/page.tsx`'s shape.
- `components/settings/settings-hub.tsx`: new "Tag" `HUB_ITEMS` card using the `Tags` lucide icon, linking to `APP_ROUTES.tagSettings` (D-01 — no new primary sidebar entry).
- 21 new unit tests across `tests/tag-mutation-dialogs.test.tsx` and `tests/tag-settings-panel.test.tsx`, plus an updated `tests/settings-hub.test.tsx` (new mock coverage + a new Tag-card assertion).

## Task Commits

Each task was committed atomically:

1. **Task 1: tag-mutation-dialogs.tsx — Create/Edit/Archive + create-time suggestion helpers** - `bfc0dba` (feat)
2. **Task 2: TagSettingsPanel + /settings/tags page + SettingsHub entry (D-01)** - `736b8e4` (feat)
3. **Task 2 auto-fix: remove unused import flagged by eslint** - `aca5df7` (fix)
4. **Task 3: TagCreationSuggestionsDialog (D-08a modal)** - `d9b278f` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `components/tags/tag-mutation-dialogs.tsx` — `CreateTagDialog`, `EditTagDialog`, `ArchiveTagDialog`, pure helpers
- `components/tags/tag-settings-panel.tsx` — `TagSettingsPanel`
- `components/tags/tag-creation-suggestions-dialog.tsx` — `TagCreationSuggestionsDialog`
- `app/(app)/settings/tags/page.tsx` — the `/settings/tags` RSC page
- `components/settings/settings-hub.tsx` — new "Tag" hub card
- `tests/tag-mutation-dialogs.test.tsx`, `tests/tag-settings-panel.test.tsx` — new unit tests
- `tests/settings-hub.test.tsx` — updated mocks + new assertion for the Tag card

## Decisions Made

- `CreateTagDialog` manages its own `useActionState` + refs rather than reusing `useDialogAction`, since it needs the action's result (`tagId`, whether a range was submitted) after success to decide on the suggestion fetch — `useDialogAction`'s generic "close on success" shape has no hook for that decision.
- `useDialogAction` (the ~25-line hook from `category-mutation-dialogs.tsx`) is duplicated locally in `tag-mutation-dialogs.tsx` rather than cross-imported, per the plan's explicit instruction and Plan 67-03's established precedent (duplicating `isUniqueConflict`) — keeps the categories and tags domains independent.
- `tag-creation-suggestions-dialog.tsx` was written before Task 1's `tsc --noEmit` verification (since `tag-mutation-dialogs.tsx` imports it) but committed last, as Task 3 — `tsc` checks the working tree regardless of git staging, so this satisfies both the plan's stated task order and each task's own acceptance criteria.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] tests/settings-hub.test.tsx required new mock coverage**
- **Found during:** Task 2 (adding the new "Tag" entry to `settings-hub.tsx`'s `HUB_ITEMS`)
- **Issue:** The existing `tests/settings-hub.test.tsx` mocks `lucide-react` and `@/lib/routes` with a fixed, incomplete set of exports. Adding a `Tags` icon import and an `APP_ROUTES.tagSettings` reference to `settings-hub.tsx` would make the mocked `lucide-react` module return `undefined` for `Tags`, which React would attempt to render as a component and throw.
- **Fix:** Added `Tags`/`tagSettings` to the respective mocks in `tests/settings-hub.test.tsx` and a new test asserting the Tag card's link and icon render.
- **Files modified:** `tests/settings-hub.test.tsx`
- **Commit:** `736b8e4`

**2. [Rule 1 - Bug] Removed unused `ReactNode` import flagged by eslint**
- **Found during:** post-Task-2 eslint pass (not part of the plan's stated `<verify>` block, run as an additional quality check)
- **Issue:** `tests/tag-settings-panel.test.tsx` imported the `ReactNode` type but never used it, triggering `@typescript-eslint/no-unused-vars`.
- **Fix:** Removed the unused import.
- **Files modified:** `tests/tag-settings-panel.test.tsx`
- **Commit:** `aca5df7`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes were necessary to keep the existing and new test suites green under the current lint/type configuration. No scope creep — neither touched behavior outside this plan's files.

## Issues Encountered

- Pre-existing, unrelated TypeScript baseline errors (21 total, same set documented in every prior 67-* summary — `tests/suggestion-card.test.tsx`, `tests/suggestion-promote-form.test.tsx`, `tests/transactions-dal.test.ts`, `tests/cascade-options.test.ts`, `tests/category-combobox.test.tsx`, `tests/file-download-api.test.ts`) were confirmed present both before and after this plan's changes via `yarn tsc --noEmit` (21 before, 21 after — no new errors). Out of scope per the scope-boundary rule; not touched.
- `react-hooks/set-state-in-effect` fires as a warning (not an error, per the repo's eslint config) on both `CreateTagDialog`'s and `TagCreationSuggestionsDialog`'s effects — this is the same accepted "reset-on-close dialog" pattern already used throughout the app (e.g. `useDialogAction`) and explicitly downgraded to a warning in `eslint.config.mjs`'s own comment. Not treated as a blocking issue.
- The Task 3 `<human-check>` (create a date-ranged tag, confirm the pre-checked suggestion modal opens/confirms correctly, and the zero-match silent no-op) and the D-02 duplicate-name inline-error live-browser flow were NOT independently driven in a live browser this session (no jsdom in this repo, and this plan has no `type="checkpoint:*"` tasks — Pattern A, fully autonomous). Both are flagged under `coverage` above as `human_judgment: true` and remain open for the user's own UAT pass.

## User Setup Required

None — no external service configuration required. This plan only adds application code and tests; no migration or seed changes.

## Next Phase Readiness

- Plan 67-09 (post-import "Suggerimenti tag" summary block, D-08b) can reuse `TagCreationSuggestionsDialog`'s checkbox-list rendering conventions and `confirmTagSuggestionAction` call shape, though it consumes `computeAllTagSuggestions`'s multi-group output rather than this plan's single-group create-time flow.
- `/settings/tags` is now the canonical TAG-01 management surface every other plan's tag list (bulk-assign dialog, transaction row chips, detail-page tag section) ultimately points back to.
- No blockers for downstream plans in this phase. The two `human_judgment: true` coverage items above are recommended for the user's UAT pass before considering TAG-01's primary surface and TAG-03's create-time trigger fully proven end-to-end.

---
*Phase: 67-tags-foundation-and-assignment*
*Completed: 2026-07-20*

## Self-Check: PASSED

- FOUND: components/tags/tag-mutation-dialogs.tsx
- FOUND: components/tags/tag-settings-panel.tsx
- FOUND: components/tags/tag-creation-suggestions-dialog.tsx
- FOUND: app/(app)/settings/tags/page.tsx
- FOUND: tests/tag-mutation-dialogs.test.tsx
- FOUND: tests/tag-settings-panel.test.tsx
- FOUND: components/settings/settings-hub.tsx
- FOUND: tests/settings-hub.test.tsx
- FOUND: bfc0dba (Task 1 commit)
- FOUND: 736b8e4 (Task 2 commit)
- FOUND: aca5df7 (Task 2 auto-fix commit)
- FOUND: d9b278f (Task 3 commit)
