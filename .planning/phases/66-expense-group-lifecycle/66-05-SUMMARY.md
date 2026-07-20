---
phase: 66-expense-group-lifecycle
plan: 05
subsystem: ui
tags: [react, next.js, expense-group, subcategory-picker, dialog, dropdown-menu, vitest, tdd]

# Dependency graph
requires:
  - phase: 66-expense-group-lifecycle
    plan: 02
    provides: categorizeExpenseGroup(_prev, formData), removeExpenseFromGroupAction(_prev, formData), dissolveExpenseGroupAction(_prev, formData) server actions
provides:
  - "GroupDetailClient editable Categoria control — GRP-05's second (detail-page) recategorize surface, same categorizeExpenseGroup action as Plan 66-04's table-row control (D-01)"
  - "RemoveGroupMemberButton component — GRP-07 per-member removal control"
  - "GroupDetailClient dissolve control (DetailPageShell overflowMenu) — GRP-07 whole-group dissolution, the ONLY remove/dissolve surface this phase"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Group detail page member row restructured from a single wrapping <Link> to a flex sibling layout (Link + amount + RemoveGroupMemberButton) to avoid a button nested inside an anchor (a11y)"
    - "DetailPageShell's overflowMenu slot hosts a DropdownMenu + Dialog pair where the Dialog wraps the DropdownMenu (not the reverse), so the confirm dialog outlives the menu closing on item select"

key-files:
  created:
    - components/expenses/remove-group-member-button.tsx
  modified:
    - "app/(app)/expenses/groups/[groupId]/page.tsx"
    - components/expenses/group-detail-client.tsx
    - tests/group-detail-page.test.tsx

key-decisions:
  - "GroupDetailClient's inline Cambia categoria control is NOT GroupCategorizeDialog (Plan 66-04's component) — built as an independent, equally-thin inline trigger per the plan's explicit instruction, since 66-04 has no dependency edge to this plan and both call the same categorizeExpenseGroup action"
  - "tests/group-detail-page.test.tsx mocks @/components/ui/dropdown-menu with a flat SSR stub (DropdownMenuContent always renders its children) — Radix's real DropdownMenu portals content and omits it from static markup when closed, matching the precedent in tests/expense-table-menu.test.tsx"

requirements-completed: [GRP-05, GRP-07]

coverage:
  - id: D1
    description: "Group detail page's Categoria section is editable via SubcategoryPicker, wired to categorizeExpenseGroup, refreshing the page on success"
    requirement: "GRP-05"
    verification:
      - kind: unit
        ref: "tests/group-detail-page.test.tsx#GroupDetailClient > renders the shared subcategory with a \"Cambia categoria\" trigger + cold-start empty-array case"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each member row has a working Rimuovi dal gruppo control (removeExpenseFromGroupAction), rendered as a sibling of the title Link (not nested inside it)"
    requirement: "GRP-07"
    verification:
      - kind: unit
        ref: "tests/group-detail-page.test.tsx#GroupDetailClient > renders a \"Rimuovi dal gruppo\" control per member, as a sibling of the title Link (not nested)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Page header exposes a working Scomponi gruppo control (dissolveExpenseGroupAction) with confirm copy that never implies restoration/undo (D-09), navigating to /expenses on success"
    requirement: "GRP-07"
    verification:
      - kind: unit
        ref: "tests/group-detail-page.test.tsx#GroupDetailClient > renders a \"Scomponi gruppo\" header action with no wording implying restoration/undo"
        status: pass
    human_judgment: false
  - id: D4
    description: "Live browser round-trip: Cambia categoria updates the category everywhere after refresh; removing a member turns it into a standalone row in the expenses table; dissolving a group navigates back to /expenses with all former members standalone"
    verification: []
    human_judgment: true
    rationale: "Plan's own <verify><human-check> step requires a live browser session (no jsdom/Playwright in this repo's test setup) — deferred to milestone UAT"

duration: 6min
completed: 2026-07-20
status: complete
---

# Phase 66 Plan 05: Group Detail Page Lifecycle Controls Summary

**Group detail page gains its own Cambia categoria trigger (GRP-05's second surface, same `categorizeExpenseGroup` action as the table row), a per-member Rimuovi dal gruppo control, and a header Scomponi gruppo dissolve control — the only remove/dissolve entry points in this phase**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-20T09:30:46+02:00 (first task commit)
- **Completed:** 2026-07-20T09:36:10+02:00 (last task commit)
- **Tasks:** 3
- **Files modified:** 4 (+1 created)

## Accomplishments
- `app/(app)/expenses/groups/[groupId]/page.tsx` now fetches `getCategories()`/`getMostUsedSubcategories(['in','out','transfer','allocation'])` in parallel, only after `getExpenseGroupForDetail` resolves (never on the `notFound()` path), and passes both to `GroupDetailClient`.
- `GroupDetailClient`'s Categoria card gained a "Cambia categoria" trigger opening an inline `SubcategoryPicker`; picking a subcategory calls `categorizeExpenseGroup({groupId, subCategoryId})` and refreshes the router on success — an independent, equally-thin mirror of `ExpenseCategorizeDialog`'s shape, not a reuse of Plan 66-04's `GroupCategorizeDialog` (no dependency edge between the two plans, per the plan's explicit instruction).
- New `components/expenses/remove-group-member-button.tsx` (`RemoveGroupMemberButton`): a `Dialog`-confirmed "Rimuovi" button per member row, calling `removeExpenseFromGroupAction({groupId, expenseId})`; on success toasts and calls `onSuccess` (parent `router.refresh()`), covering the auto-dissolve case where the group itself may disappear.
- Member row markup restructured from one wrapping `<Link>` to a flex sibling layout: `<Link>` wraps only the title text, with the amount `<span>` and `<RemoveGroupMemberButton>` as siblings — avoids a button nested inside an anchor.
- `GroupDetailClient`'s header now passes a `dissolveControl` to `DetailPageShell`'s `overflowMenu` slot: a `DropdownMenu` ("Azioni gruppo", `MoreHorizontal` icon) with one destructive "Scomponi gruppo" item, opening a `Dialog` whose copy ("Il gruppo verrà sciolto e le spese torneranno indipendenti, mantenendo la categoria attuale.") never implies restoration/undo (D-09); confirming calls `dissolveExpenseGroupAction({groupId})` and on success navigates via `router.push(APP_ROUTES.expenses)`.

## Task Commits

Each task was executed TDD-first (RED test commit, then GREEN implementation commit):

1. **Task 1: Editable group subcategory (GRP-05, D-01a)** — `bfd1bf2` (test, RED) → `4e3b8fa` (feat, GREEN)
2. **Task 2: Per-member Rimuovi dal gruppo control (GRP-07)** — `811fb6e` (test, RED) → `29c9bdd` (feat, GREEN)
3. **Task 3: Scomponi gruppo dissolve control (GRP-07)** — `6b123db` (test, RED) → `9b6f712` (feat, GREEN)

**Plan metadata:** commit pending (final docs commit, see below)

## TDD Gate Compliance

All three `tdd="true"` tasks followed RED → GREEN:
- Task 1: `bfd1bf2` (test — 2 new/changed cases fail: "Cambia categoria" absent, cold-start case fails) → `4e3b8fa` (feat — all 11 tests pass)
- Task 2: `811fb6e` (test — 1 new case fails: "dal gruppo" text absent) → `29c9bdd` (feat — all 12 tests pass)
- Task 3: `6b123db` (test — 1 new case fails: "Scomponi gruppo" text absent) → `9b6f712` (feat — all 13 tests pass; required adding a `@/components/ui/dropdown-menu` SSR stub mock alongside the implementation, since Radix's real dropdown portals closed-menu content out of static markup)

No REFACTOR commits were needed.

## Files Created/Modified
- `app/(app)/expenses/groups/[groupId]/page.tsx` — fetches `categories`/`mostUsed` via `Promise.all` after the group-exists guard, passes both to `GroupDetailClient`
- `components/expenses/group-detail-client.tsx` — `Props` extended with `categories`/`mostUsed`; Categoria section gained a `Cambia categoria` trigger + inline `SubcategoryPicker`; member row restructured to a flex sibling layout with `RemoveGroupMemberButton`; new `dissolveControl` (DropdownMenu + Dialog) passed to `DetailPageShell`'s `overflowMenu`
- `components/expenses/remove-group-member-button.tsx` (new) — `RemoveGroupMemberButton({ groupId, expenseId, expenseTitle, onSuccess })`
- `tests/group-detail-page.test.tsx` — `renderGroupDetailClient` helper extended to pass `categories`/`mostUsed`; flipped the old "no Cambia categoria" assertion; added cold-start, Rimuovi-sibling, and Scomponi-gruppo-copy test cases; added `@/lib/dal/categories`/`@/lib/dal/subcategory-usage` RSC page mocks and a `@/components/ui/dropdown-menu` SSR stub mock

## Decisions Made
- The detail page's Cambia categoria control is a fresh, independent inline trigger (not a reuse of Plan 66-04's `GroupCategorizeDialog`) — both plans are parallel Wave-3 plans with no dependency edge, and the plan explicitly called for an equally-thin standalone shape calling the same `categorizeExpenseGroup` action, avoiding a false coupling between sibling plans.
- Added a `@/components/ui/dropdown-menu` SSR stub mock to the test file (flat render of `DropdownMenuContent`'s children regardless of open state) — required because Radix's real `DropdownMenu` portals its content and Task 3's "Scomponi gruppo" text is otherwise unreachable in `renderToStaticMarkup` output. This mirrors the existing precedent in `tests/expense-table-menu.test.tsx`.

## Deviations from Plan

None — plan executed exactly as written (exact prop/action shapes, exact confirm copy for both Dialogs, exact `overflowMenu` wiring). The dropdown-menu SSR test mock is test-infrastructure needed to make Task 3's own specified assertion (`expect(html).toContain('Scomponi gruppo')`) observable at all — not a behavior change (Rule 3 spirit: unblocking the specified verification, matching the established `tests/expense-table-menu.test.tsx` pattern).

## Issues Encountered
None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- GRP-05 and GRP-07 are both fully wired: the expenses table (Plan 66-04) and the group detail page (this plan) are the two GRP-05 recategorize surfaces, both calling the same `categorizeExpenseGroup`; the group detail page is the sole GRP-07 remove/dissolve surface, as designed.
- Full test suite (124 files, 1526 tests + 1 todo) passes; `yarn lint` shows 0 errors (37 pre-existing warnings, unrelated to this plan); `yarn check:language` passes; `tsc --noEmit` shows no new errors in files touched by this plan.
- Live browser verification (Cambia categoria round-trip, member removal → standalone row, group dissolution → /expenses redirect) is the one remaining human-check from the plan's `<verify>` block — deferred to milestone UAT (D4 above), consistent with this repo's no-jsdom/no-Playwright test environment.
- Phase 66 (expense-group-lifecycle) is now complete: all 5 plans (66-01 through 66-05) executed. GRP-05, GRP-06, GRP-07 requirements satisfied.

---
*Phase: 66-expense-group-lifecycle*
*Completed: 2026-07-20*

## Self-Check: PASSED

All modified/created files exist on disk (`app/(app)/expenses/groups/[groupId]/page.tsx`,
`components/expenses/group-detail-client.tsx`, `components/expenses/remove-group-member-button.tsx`,
`tests/group-detail-page.test.tsx`); all 6 task commit hashes (bfd1bf2, 4e3b8fa, 811fb6e, 29c9bdd,
6b123db, 9b6f712) verified present in git log.
