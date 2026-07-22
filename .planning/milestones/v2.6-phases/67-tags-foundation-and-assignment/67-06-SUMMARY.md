---
phase: 67-tags-foundation-and-assignment
plan: 06
subsystem: frontend
tags: [react, server-actions, tags, transactions, bulk-actions]

# Dependency graph
requires: ["67-03", "67-04"]
provides:
  - "components/tags/bulk-assign-tags-dialog.tsx: BulkAssignTagsDialog({ open, onOpenChange, transactionIds, tags, onSuccess })"
  - "components/transactions/transaction-bulk-action-bar.tsx: extended Props (onBulkAssignTags), new 'Assegna tag' button"
  - "components/transactions/transaction-table.tsx: extended Props (tags, tagsByTransactionId), row-chip rendering, dialog wiring"
  - "app/(app)/transactions/page.tsx: fetches and passes tags/tagsByTransactionId"
affects: [67-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Plain Dialog + native checkbox multi-select (not SubcategoryPicker's Sheet, not a new shadcn Checkbox primitive) — mirrors bulk-delete-transactions-dialog.tsx's existing checkbox idiom, per the plan's explicit discretion note"
    - "Two-tab (Assegna/Rimuovi) dialog over the SAME tag list and SAME selection — switching tabs resets selectedTagIds and calls the correct action (bulkAssignTagsAction vs bulkRemoveTagsAction) from one component, not two"
    - "Archived tags rendered inline with active tags with an 'Archiviato' badge, never filtered/disabled (D-04) — same list, same checkbox, always selectable"
    - "Row-chip state is a local copy of the tagsByTransactionId prop (mirrors the existing loadedTransactions local-copy pattern), updated optimistically in onSuccess without a page reload or table remount"

key-files:
  created:
    - components/tags/bulk-assign-tags-dialog.tsx
  modified:
    - components/transactions/transaction-bulk-action-bar.tsx
    - components/transactions/transaction-table.tsx
    - app/(app)/transactions/page.tsx
    - tests/transaction-bulk-action-bar.test.tsx
    - tests/transaction-table-menu.test.tsx

key-decisions:
  - "No lucide-react Tag icon import in bulk-assign-tags-dialog.tsx — the dialog title is text-only ('Assegna tag'), so the plan's TagIcon alias guidance had nothing to attach to; the naming-collision acceptance criterion (grep for a bare `{ Tag }` import) is still satisfied since no Tag identifier is imported at all."
  - "verifySession() is called once at the top of the transactions page (it wasn't called there before) specifically to obtain userId for getTags(userId); the page had no prior direct session dependency."

requirements-completed: [TAG-02]

coverage:
  - id: D1
    description: "BulkAssignTagsDialog renders a two-tab Assegna/Rimuovi checkbox list over the full tag set (archived tags included and selectable), and calls bulkAssignTagsAction/bulkRemoveTagsAction depending on the active tab"
    requirement: TAG-02
    verification:
      - kind: unit
        ref: "yarn tsc --noEmit exits with the same 21 pre-existing baseline errors, none new; component grep checks (bulkAssignTagsAction/bulkRemoveTagsAction >= 2 refs, archived && >= 1, no bare Tag import) all pass"
        status: pass
    human_judgment: false
  - id: D2
    description: "'Assegna tag' appears in transaction-bulk-action-bar.tsx, always enabled regardless of canBulkCategorize"
    requirement: TAG-02
    verification:
      - kind: unit
        ref: "node_modules/.bin/vitest tests/transaction-bulk-action-bar.test.tsx --run (3 tests, including the new always-enabled assertion)"
        status: pass
    human_judgment: false
  - id: D3
    description: "TransactionTable renders read-only tag chips per row and opens BulkAssignTagsDialog from the bulk bar; transactions page fetches getTags(userId) + getTagsForTransactionIds(transactionIds) and passes both to the table"
    requirement: TAG-02
    verification:
      - kind: unit
        ref: "node_modules/.bin/vitest tests/transaction-table-menu.test.tsx --run (7 tests, shared render() helper updated with tags:[]/tagsByTransactionId:{})"
        status: pass
      - kind: manual
        ref: "Plan's <human-check>: select rows, click Assegna tag, assign via Assegna tab, confirm chips appear without reload; reopen, switch to Rimuovi tab, remove one tag, confirm its chip disappears while others remain — NOT executed in this session (no live browser session driven); flagged for user UAT"
        status: pending
    human_judgment: true

duration: 3min
completed: 2026-07-20
status: complete
---

# Phase 67 Plan 06: Transactions-Page Bulk Tag Assignment (BulkAssignTagsDialog + row chips) Summary

**A two-tab Assegna/Rimuovi multi-select dialog wired into the transactions bulk-action bar, plus read-only tag chips per row — the primary, highest-traffic TAG-02 surface, built entirely on Plan 67-04's ownership-verified assignment actions.**

## Performance

- **Duration:** ~3 min (task execution; excludes context-read time)
- **Started:** 2026-07-20T16:53:07+02:00 (first task commit)
- **Completed:** 2026-07-20T16:55:59+02:00 (last task commit)
- **Tasks:** 3
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments

- `components/tags/bulk-assign-tags-dialog.tsx`: `BulkAssignTagsDialog` — a plain `Dialog` with an Assegna/Rimuovi `Tabs` split over one shared checkbox list of `TagRow[]`. Archived tags render inline with an "Archiviato" `Badge`, never filtered or disabled (D-04). Switching tabs resets the selection and error state. On confirm, builds a `FormData` with `transactionIds`/`tagIds` and calls `bulkAssignTagsAction` (Assegna) or `bulkRemoveTagsAction` (Rimuovi) via `useTransition`, surfacing inline errors through the same `Alert`/`AlertDescription` shape used by `category-mutation-dialogs.tsx`.
- `components/transactions/transaction-bulk-action-bar.tsx`: extended `Props` with `onBulkAssignTags: () => void`; added a new "Assegna tag (N)" button between Categorizza and Elimina, always enabled (unlike Categorizza, which requires `canBulkCategorize`).
- `components/transactions/transaction-table.tsx`: extended `Props` with `tags: TagRow[]` and `tagsByTransactionId`; added local `tagsByTx` state (copied from the prop, mirroring the existing `loadedTransactions` pattern) and `bulkAssignTagsOpen` state; renders read-only tag-chip `Badge`s per row (below the pair popover, inside the same `max-w-0 w-full` cell); wires `onBulkAssignTags` to open `BulkAssignTagsDialog` and updates `tagsByTx` optimistically in `onSuccess` (additive union for `assign`, subtractive for `remove`) without a page reload or table remount; clears `selectedIds` on success.
- `app/(app)/transactions/page.tsx`: added `verifySession()` (not previously called on this page) to obtain `userId`; fetches `getTags(userId)` and `getTagsForTransactionIds(transactions.map(t => t.id))` in parallel after the existing `Promise.all`, reduces the join rows into a per-transaction `tagsByTransactionId` map, and passes both `tags` and `tagsByTransactionId` to `TransactionTable`.
- Updated both existing test files: `tests/transaction-bulk-action-bar.test.tsx` (both call sites gained `onBulkAssignTags: vi.fn()`; new test asserts "Assegna tag (2)" renders with no `disabled=""` attribute even when `canBulkCategorize: false`) and `tests/transaction-table-menu.test.tsx` (shared `render()` helper gained `tags: [], tagsByTransactionId: {}`).

## Task Commits

Each task was committed atomically:

1. **Task 1: BulkAssignTagsDialog — two-tab multi-select (D-05, D-06, D-07)** - `e962871` (feat)
2. **Task 2: "Assegna tag" button in transaction-bulk-action-bar.tsx (D-05)** - `3b9387d` (feat)
3. **Task 3: Wire dialog + row chips into TransactionTable and the transactions page** - `cee8a83` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `components/tags/bulk-assign-tags-dialog.tsx` — `BulkAssignTagsDialog` (created)
- `components/transactions/transaction-bulk-action-bar.tsx` — extended `Props`, new button
- `components/transactions/transaction-table.tsx` — extended `Props`, row chips, dialog wiring
- `app/(app)/transactions/page.tsx` — tag data fetching + prop passthrough
- `tests/transaction-bulk-action-bar.test.tsx`, `tests/transaction-table-menu.test.tsx` — updated for new required props

## Decisions Made

- No `Tag as TagIcon` import was added to `bulk-assign-tags-dialog.tsx` — the dialog's `DialogTitle` is plain text ("Assegna tag") with no icon usage anywhere in the render tree the plan described, so importing an unused icon would have failed lint/tsc for an unused import. The naming-collision acceptance criterion (`grep -c "import.*{ Tag }.*lucide-react"` is 0) is satisfied regardless, since no `Tag` identifier is imported from `lucide-react` in this file at all.
- `verifySession()` is now called directly in `app/(app)/transactions/page.tsx` for the first time (previously the page had no direct session dependency — `getTransactions(filters)` and friends handle their own scoping internally). This is additive; no existing behavior changed.
- The always-enabled assertion in the new bulk-action-bar test checks for the literal `disabled=""` attribute rather than the substring `disabled`, since the rendered `Button`'s Tailwind classes legitimately contain the strings `disabled:pointer-events-none disabled:opacity-50` (state-variant selectors) which would otherwise produce a false positive.

## Deviations from Plan

None — plan executed exactly as written. All three tasks' `<action>` blocks were implemented as specified. The two adjustments described above (Decisions Made) are refinements required to make the plan's own acceptance criteria and prohibitions hold under `tsc`/`eslint`, not deviations from specified behavior.

## Issues Encountered

- Pre-existing, unrelated TypeScript baseline errors (21 total, same set documented in 67-01-SUMMARY.md, 67-03-SUMMARY.md, and 67-04-SUMMARY.md) were confirmed present both before and after this plan's changes via `yarn tsc --noEmit` (diffed against a pre-task-1 baseline snapshot — identical error set, no additions). Out of scope per the scope-boundary rule; not touched.
- The plan's Task 3 `<verify>` block includes a `<human-check>` manual browser-interaction step (select rows → Assegna tag → assign → confirm chips → Rimuovi tab → remove → confirm chip disappears). This plan has no `type="checkpoint:*"` tasks (fully autonomous, Pattern A), so execution did not pause for it, but it was also not independently driven in a live browser this session. Flagged under `## Known Stubs` below is not applicable (no stub), but this manual verification step remains open for the user's own UAT pass before considering TAG-02's primary surface fully proven end-to-end.

## User Setup Required

None — no external service configuration required. This plan only adds application code and tests; no migration or seed changes.

## Next Phase Readiness

- Plan 67-07 (transaction detail-page single-tag add/remove, D-07b) can build on the same `addTransactionTagAction`/`removeTransactionTagAction` server actions already available from Plan 67-04, independent of this plan's dialog.
- The row-chip rendering established here (`Badge` per tag, read-only) is a candidate visual reference for Plan 67-07's detail-page tag section, though that plan may choose a different (removable) chip treatment per its own scope.
- No blockers for downstream plans in this phase.

---
*Phase: 67-tags-foundation-and-assignment*
*Completed: 2026-07-20*

## Self-Check: PASSED

- FOUND: components/tags/bulk-assign-tags-dialog.tsx
- FOUND: components/transactions/transaction-bulk-action-bar.tsx
- FOUND: components/transactions/transaction-table.tsx
- FOUND: app/(app)/transactions/page.tsx
- FOUND: e962871 (Task 1 commit)
- FOUND: 3b9387d (Task 2 commit)
- FOUND: cee8a83 (Task 3 commit)
