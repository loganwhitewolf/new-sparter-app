---
phase: 65-expense-group-merge-and-view
plan: 05
subsystem: ui
tags: [next.js, react, expense-group, detail-page, server-actions]

# Dependency graph
requires:
  - phase: 65-02
    provides: "renameExpenseGroupAction server action"
  - phase: 65-03
    provides: "getExpenseGroupForDetail (ownership-scoped group detail query), expenseGroupDetailHref"
provides:
  - "/expenses/groups/[groupId] RSC page — the canonical group-detail landing route"
  - "GroupDetailClient (shared category read-only, per-member own title/total, combined transactions)"
  - "GroupTitleEdit inline rename control"
affects: [65-06, 66-expense-group-lifecycle]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Group detail RSC page mirrors /expenses/[id]'s exact shape: parseGroupId guard (mirrors parseCategoryId) rejects malformed ids before any DAL call, then verifySession -> getExpenseGroupForDetail -> notFound() on undefined is the entire ownership boundary (T-65-10)"
    - "collegamentiCard slot repurposed as 'Membri' — each member IS a cross-reference to its own /expenses/[id] page, rendered with its own title/totalAmount (never the group's composed total)"
    - "GroupTitleEdit mirrors ExpenseTitleEdit's useActionState/submittedRef/pendingValueRef pattern exactly, but drops the outer self-link (the control lives ON the group's own page) and uses a hidden groupId field instead of id"

key-files:
  created:
    - app/(app)/expenses/groups/[groupId]/page.tsx
    - components/expenses/group-detail-client.tsx
    - components/expenses/group-title-edit.tsx
    - tests/group-detail-page.test.tsx
  modified: []

key-decisions:
  - "No 'cambia categoria' control anywhere on this page (D-03) — group recategorization is Phase 66 scope; the page only displays group.subCategoryName/categoryName read-only"
  - "categoriaCard slot deliberately omitted/folded into datiCard — no interactive picker exists this phase to warrant a separate card"
  - "No azioniCard — no delete/dissolve action exists for a group in this phase"

requirements-completed: [GRP-04]

coverage:
  - id: D1
    description: "/expenses/groups/[groupId] RSC page: ownership-scoped entirely via getExpenseGroupForDetail's undefined result, malformed ids rejected before any DAL call"
    requirement: "GRP-04"
    verification:
      - kind: unit
        ref: "tests/group-detail-page.test.tsx describe('/expenses/groups/[groupId] page') (3 tests: happy path, missing/non-owned groupId, malformed groupId short-circuits before the DAL call)"
        status: pass
    human_judgment: false
  - id: D2
    description: "GroupDetailClient: read-only shared category (no Cambia categoria control), each member with its own title/total linking to expenseDetailHref, zero-transaction member renders without crashing, combined transaction list in DAL-provided occurredAt DESC order"
    requirement: "GRP-04"
    verification:
      - kind: unit
        ref: "tests/group-detail-page.test.tsx describe('GroupDetailClient') (4 tests: read-only category text assertion, per-member own title/total/href, zero-transaction member, combined-transaction ordering)"
        status: pass
    human_judgment: false
  - id: D3
    description: "GroupTitleEdit: pencil edit/view toggle with hidden groupId field (no id field), Salva disabled below 2 trimmed chars, no self-link"
    requirement: "GRP-04"
    verification:
      - kind: unit
        ref: "tests/group-detail-page.test.tsx describe('GroupTitleEdit') (3 tests: no self-link when not editing, groupId/title fields present with no id field, Salva disabled below 2 chars)"
        status: pass
    human_judgment: false

duration: 2min
completed: 2026-07-19
status: complete
---

# Phase 65 Plan 5: expense-group-merge-and-view Summary

**Group detail page `/expenses/groups/[groupId]`: the canonical GRP-04 landing route showing a group's shared subcategory read-only, each member with its own title/total linking to its own expense detail page, the full combined transaction list, and an inline `GroupTitleEdit` rename control.**

## Performance

- **Duration:** ~2 min (task commits span 15:30:21–15:32:01)
- **Started:** 2026-07-19T15:30:21+02:00
- **Completed:** 2026-07-19T15:32:01+02:00
- **Tasks:** 3
- **Files modified:** 4 (4 created, 0 modified)

## Accomplishments
- `app/(app)/expenses/groups/[groupId]/page.tsx`: async RSC page parsing `groupId` with a `parseGroupId` guard (mirrors `parseCategoryId`'s positive-safe-integer check on `/dashboard/categories/[id]`) that rejects malformed ids before ever touching the DAL; `verifySession()` -> `getExpenseGroupForDetail({ userId, groupId })` -> `notFound()` on `undefined` is the entire ownership boundary (T-65-10) — malformed, missing, and non-owned ids all resolve identically
- `components/expenses/group-detail-client.tsx`: `GroupDetailClient` rendering `DetailPageShell` two-column with `datiCard` (Titolo via `GroupTitleEdit` + a read-only Categoria block, no "Cambia categoria" button per D-03), `collegamentiCard` repurposed as "Membri" (each `group.members[]` entry linking to `expenseDetailHref(member.id)` with its own title/total, a zero-transaction member rendering its `0,00 €` total normally), `riepilogoCard` (total/count/created), and `transactionsCard` (the full combined, already-sorted `occurredAt DESC` transaction list, previewed exactly like `expense-detail-client.tsx`'s transactions table)
- `components/expenses/group-title-edit.tsx`: `GroupTitleEdit`, an exact mirror of `ExpenseTitleEdit`'s `useActionState`/edit-toggle/submit-cancel pattern wired to `renameExpenseGroupAction`, minus the outer self-link (this control lives ON the group's own detail page) and using a hidden `groupId` field instead of `id`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the /expenses/groups/[groupId] RSC page** - `6841c4e` (feat)
2. **Task 2: Build GroupDetailClient (subcategory, members, combined transactions)** - `9fb9674` (feat)
3. **Task 3: Create GroupTitleEdit inline rename control** - `5665df8` (feat)

**Plan metadata:** (pending — final commit below)

## Files Created/Modified
- `app/(app)/expenses/groups/[groupId]/page.tsx` - new RSC page, ownership-scoped via `getExpenseGroupForDetail`
- `components/expenses/group-detail-client.tsx` - `GroupDetailClient`: category read-only display, Membri list, Riepilogo, combined Transazioni table
- `components/expenses/group-title-edit.tsx` - `GroupTitleEdit`: inline rename control wired to `renameExpenseGroupAction`
- `tests/group-detail-page.test.tsx` - new file: 10 tests across the RSC page (3), `GroupDetailClient` (4), and `GroupTitleEdit` (3)

## Decisions Made
- None beyond what the plan already locked — followed the plan's `<action>`/`<behavior>` blocks as specified (D-03 no-recategorize-here, categoriaCard folded into datiCard, no azioniCard).

## Deviations from Plan

None - plan executed exactly as written. `GroupDetailClient` (Task 2) references `GroupTitleEdit` (Task 3) per the plan's own action text; both components were authored together and committed in their respective task's file scope, matching the plan's stated `<files>` per task.

## Issues Encountered

**`yarn test -- <path>` filters do not narrow the vitest run in this environment** (the RTK proxy/hook rewrites the command such that the full suite runs regardless of the path argument). Used `npx vitest run <path>` directly instead for per-task verification, matching the precedent already established in Plans 65-02/65-03's SUMMARY.md. Full-suite (`npx vitest run`) and `yarn tsc --noEmit`/`yarn check:language` were also run to confirm no regressions.

**Pre-existing `tsc` type errors** (6 files: `tests/cascade-options.test.ts`, `tests/category-combobox.test.tsx`, `tests/file-download-api.test.ts`, `tests/suggestion-card.test.tsx`, `tests/suggestion-promote-form.test.tsx`, `tests/transactions-dal.test.ts`), already logged in `deferred-items.md` from Plans 65-02/65-03, remain unchanged and unrelated to this plan's 3 commits — confirmed via `yarn tsc --noEmit` showing zero errors touching `group-detail-client.tsx`, `group-title-edit.tsx`, or `app/(app)/expenses/groups/[groupId]/page.tsx`. Not fixed (out of scope, pre-existing).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `/expenses/groups/[groupId]` is live and is the target of the `Dettagli` link on grouped rows in `ExpenseTable` (wired in Plan 65-04) and any future "Unita" badge/cross-reference in this phase.
- Group-level recategorization (GRP-05) and other lifecycle actions (rename already covered here) are Phase 66 scope — this page intentionally has no `azioniCard` or category-change control.
- Pre-existing `tsc` type errors (6 files, unrelated, logged in `deferred-items.md`) remain outstanding — not a blocker for subsequent 65-xx/66-xx plans.

## Self-Check: PASSED

All created files found on disk; all task commit hashes (6841c4e, 9fb9674, 5665df8) found in git log.

---
*Phase: 65-expense-group-merge-and-view*
*Completed: 2026-07-19*
