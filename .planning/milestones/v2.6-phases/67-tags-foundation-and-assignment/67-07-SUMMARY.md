---
phase: 67-tags-foundation-and-assignment
plan: 07
subsystem: ui
tags: [react, server-actions, tags, transactions, detail-page]

# Dependency graph
requires:
  - phase: 67-tags-foundation-and-assignment
    provides: "Plan 67-04's addTransactionTagAction/removeTransactionTagAction single-item wrappers; Plan 67-03's getTags/TagRow"
provides:
  - "app/(app)/transactions/[id]/page.tsx: fetches getTransactionTagsForTransaction(userId, id) + getTags(userId) after the notFound() guard, passes currentTags/allTags to TransactionDetailClient"
  - "components/transactions/transaction-detail-client.tsx: Tag section (tagSection) — removable Badge chips + 'Aggiungi tag' Select picker, delegating to Plan 67-04's single-item actions"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-07b single add/remove implemented via local optimistic state (setTags) synced from FormData round-trips through addTransactionTagAction/removeTransactionTagAction — never the bulk actions with a one-element array"
    - "Radix Select portal content is invisible to renderToStaticMarkup (no DOM in Node test env); tests mock @/components/ui/select as passthrough divs, following the same pattern tests/subcategory-picker.test.tsx already uses for @/components/ui/sheet"

key-files:
  created: []
  modified:
    - "app/(app)/transactions/[id]/page.tsx"
    - "components/transactions/transaction-detail-client.tsx"
    - "tests/transaction-detail-page.test.tsx"

key-decisions:
  - "Tag section reuses the existing categoriaSection visual idiom (header row + Button, muted bordered card) rather than inventing new styling — same rounded-md border bg-muted/30 p-4 wrapper, rendered as a sibling immediately after categoriaSection inside datiCard."
  - "Picker uses shadcn Select (not a bottom-sheet) per the plan's explicit discretion note — a single-item add doesn't need Plan 67-06's two-tab multi-select Dialog."
  - "Test coverage for the Select-based picker's option list required mocking @/components/ui/select as plain passthrough divs, since Radix's SelectContent renders via a document.body Portal that produces no output under renderToStaticMarkup in this repo's Node-only (non-jsdom) test environment. This mirrors the established Sheet-mock pattern in tests/subcategory-picker.test.tsx rather than inventing a new testing approach."

requirements-completed: [TAG-02]

coverage:
  - id: D1
    description: "The transaction detail page renders a Tag section: current tags as chips each with an individual 'Rimuovi tag {name}' remove control, plus an 'Aggiungi tag' picker offering every tag not already on the transaction (archived tags included per D-04)"
    requirement: TAG-02
    verification:
      - kind: unit
        ref: "node_modules/.bin/vitest tests/transaction-detail-page.test.tsx --run (21 tests total; 'Tag section (TAG-02, D-07b)' describe block covers chip+remove-control rendering, picker exclusion of already-assigned tags, and archived-tag pickability)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Add/remove on the detail page calls addTransactionTagAction/removeTransactionTagAction (Plan 67-04's single-item wrappers) exclusively — never the bulk actions with a one-element array built ad hoc"
    requirement: TAG-02
    verification:
      - kind: unit
        ref: "grep -c \"addTransactionTagAction\\|removeTransactionTagAction\" components/transactions/transaction-detail-client.tsx -> 3 (import + one call site each)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The detail RSC page fetches tag data only after the notFound() ownership guard — no wasted queries on a 404/non-owned path"
    requirement: TAG-02
    verification:
      - kind: unit
        ref: "node_modules/.bin/vitest tests/transaction-detail-page.test.tsx --run ('does not fetch tag data on the 404 path' asserts getTransactionTagsForTransaction/getTags not called when getTransactionForDetail resolves undefined)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Manually verify the live add/remove/archived-pickable flow on /transactions/[id] in a browser"
    verification: []
    human_judgment: true
    rationale: "This plan has no checkpoint task (fully autonomous, Pattern A); the plan's <human-check> (open a transaction, add a tag via the picker, confirm the chip appears, remove it, confirm an archived tag remains pickable) was not independently driven in a live browser this session — flagged for the user's own UAT pass, consistent with how Plan 67-06's equivalent human-check was handled."

duration: 8min
completed: 2026-07-20
status: complete
---

# Phase 67 Plan 07: Transaction Detail-Page Tag Section (single add/remove, D-07b) Summary

**A Tag section on `/transactions/[id]` with removable chips and an "Aggiungi tag" Select picker (archived tags included), calling Plan 67-04's single-item `addTransactionTagAction`/`removeTransactionTagAction` exclusively — the second, narrower TAG-02 surface alongside Plan 67-06's bulk-assign dialog.**

## Performance

- **Duration:** ~8 min (task execution; excludes context-read time)
- **Started:** 2026-07-20T17:00:58+02:00 (first task commit)
- **Completed:** 2026-07-20T17:07:13+02:00 (last task commit)
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `app/(app)/transactions/[id]/page.tsx`: extended the existing `Promise.all([getTransactionForDetail, getCategories, getMostUsedSubcategories])` block with a second, sequenced `Promise.all([getTransactionTagsForTransaction(userId, id), getTags(userId)])` that runs only after the `notFound()` guard — no wasted queries on a 404/non-owned path. Both are passed to `TransactionDetailClient` as new `currentTags`/`allTags` props.
- `components/transactions/transaction-detail-client.tsx`: extended `Props` with `currentTags: { tagId, tagName, archived }[]` and `allTags: TagRow[]` (imported as `TagRow`, never `Tag`, to avoid colliding with the `Tag` icon already imported from `lucide-react` and used by `categoriaSection`). Added local `tags` state seeded from `currentTags`, `handleAddTag`/`handleRemoveTag` (each builds a `FormData` and calls `addTransactionTagAction`/`removeTransactionTagAction` directly — no bulk-action detour), and a new `tagSection` block rendered as a sibling immediately after `categoriaSection` inside `datiCard`: a header row with a shadcn `Select` picker (options = `allTags` minus already-assigned ids, archived tags shown with an inline "(Archiviato)" suffix, never filtered out per D-04) + "Aggiungi" button, and the current tags rendered as `Badge` chips each with an `X`-icon remove button (`aria-label="Rimuovi tag {name}"`).
- `tests/transaction-detail-page.test.tsx`: added `getTransactionTagsForTransaction`/`getTags` to the page's mock harness (default-resolved to `[]`), added a "does not fetch tag data on the 404 path" regression test, mocked `@/components/ui/select` as passthrough divs (Radix's `SelectContent` portals into `document.body`, which produces no output under `renderToStaticMarkup` in this repo's Node-only test environment — the same constraint and mock pattern `tests/subcategory-picker.test.tsx` already established for `@/components/ui/sheet`), and added a new `describe('Tag section (TAG-02, D-07b)', ...)` block with three cases: chip + remove-control rendering, picker excludes already-assigned tags, and an archived tag still appears as a pickable option.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fetch tag data in the detail RSC page** - `436ef06` (feat)
2. **Task 2: Tag section in TransactionDetailClient (D-07b single add/remove)** - `aff9725` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `app/(app)/transactions/[id]/page.tsx` — fetches `currentTags`/`allTags` after the 404 guard, passes to `TransactionDetailClient`
- `components/transactions/transaction-detail-client.tsx` — extended `Props`, `tagSection` (chips + picker), `handleAddTag`/`handleRemoveTag`
- `tests/transaction-detail-page.test.tsx` — extended page-mock harness, new 404-path regression test, new Tag-section describe block (3 tests), `@/components/ui/select` passthrough mock

## Decisions Made

- Tag section styling mirrors `categoriaSection`'s existing card idiom (`rounded-md border bg-muted/30 p-4` header + body) rather than introducing a new visual pattern — consistent with the rest of `datiCard`.
- Used shadcn `Select` (not a bottom-sheet picker) for the single-item add control, per the plan's explicit discretion note that a plain dropdown is sufficient here (unlike Plan 67-06's multi-select bulk dialog).
- `@/components/ui/select` mocked as passthrough divs in the test file — required because Radix's `SelectContent` renders through a `document.body` Portal, which never appears in `renderToStaticMarkup` output under this repo's Node-only (non-jsdom) Vitest environment. This is the same mocking pattern `tests/subcategory-picker.test.tsx` already uses for `@/components/ui/sheet`'s Portal-based `SheetContent`, not a new testing approach.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' `<action>` blocks were implemented as specified, including the exact prop/state/handler shapes described. The test-infrastructure mock for `@/components/ui/select` was necessary to make the plan's own acceptance criteria (picker options in the rendered test output) achievable given this repo's existing SSR-only test harness — not a deviation from specified behavior.

## Issues Encountered

- Confirmed empirically (scratch test, not committed) that Radix `SelectContent`/`SelectItem` render nothing under `renderToStaticMarkup` because the component tree is portaled into `document.body`, which doesn't exist in this repo's Node-only Vitest environment. Resolved by mocking `@/components/ui/select` as passthrough divs in the test file only — production code is untouched.
- Pre-existing, unrelated TypeScript baseline errors (21 total, same set documented in 67-01/67-03/67-04/67-06-SUMMARY.md) confirmed present both before and after this plan's changes via `yarn tsc --noEmit`. Out of scope per the scope-boundary rule; not touched.

## User Setup Required

None — no external service configuration required. This plan only adds application code and tests; no migration or seed changes.

## Next Phase Readiness

- Both TAG-02 surfaces (Plan 67-06's bulk-assign dialog, this plan's detail-page single add/remove) are now built on the same Plan 67-04 action layer, with no duplicated write paths.
- The plan's `<human-check>` (open a transaction, add a tag, confirm the chip, remove it, confirm an archived tag stays pickable) was not independently driven in a live browser this session — flagged for the user's own UAT pass, consistent with how Plan 67-06 handled its equivalent manual-check item.
- No blockers for downstream plans (67-08, 67-09) in this phase.

---
*Phase: 67-tags-foundation-and-assignment*
*Completed: 2026-07-20*

## Self-Check: PASSED

- FOUND: app/(app)/transactions/[id]/page.tsx
- FOUND: components/transactions/transaction-detail-client.tsx
- FOUND: tests/transaction-detail-page.test.tsx
- FOUND: 436ef06 (Task 1 commit)
- FOUND: aff9725 (Task 2 commit)
