---
phase: 69-tag-dedicated-page
plan: 03
subsystem: tags
tags: [next.js, rsc, tags, entry-points, revalidate-path]

# Dependency graph
requires:
  - phase: 69-tag-dedicated-page
    plan: 01
    provides: "/tags/[id] RSC + tagDetail(id) route helper + TagDetailReport"
  - phase: 69-tag-dedicated-page
    plan: 02
    provides: "getTagDetail per-category breakdown on TagDetailReport"
provides:
  - "/tags as an index of links into /tags/[id] (inline TagDetailView retired)"
  - "/dashboard/tags ranking primary name link re-pointed to tagDetail(id)"
  - "updateTagAction/archiveTagAction revalidating the detail route for in-place edit/archive"
affects: [70-dashboard-tag-filter-removal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Index panel is a plain server component (no client state): each row is a Next.js Link into the dedicated RSC"
    - "Server action revalidates all three surfaces (index, dashboard section, dedicated detail route) so an in-place mutation reflects without a hard reload"

key-files:
  created: []
  modified:
    - components/tags/tag-settings-panel.tsx
    - tests/tag-settings-panel.test.tsx
    - components/dashboard/tag-ranking-list.tsx
    - lib/actions/tags.ts
    - tests/tag-actions.test.ts

key-decisions:
  - "Panel dropped 'use client' — with the inline TagDetailView, selection state and on-demand fetch gone it has no client-only surface left, so it renders as a server component"
  - "revalidatePath uses the standalone tagDetail(id) export from lib/routes (matching 69-01's helper convention); the must_haves phrasing APP_ROUTES.tagDetail is satisfied by the module-level export"
  - "Index rows keep the date-range caption (formatDateRange → 'Nessun intervallo' when unset) so the retained panel test cases still apply"
  - "Kept the /transactions?tag= wiring on the dashboard untouched (Phase 70 scope fence); no secondary 'vedi transazioni' affordance was added (optional, Claude discretion)"

patterns-established:
  - "A tag is now reachable from exactly two entry points, both funneling to /tags/[id]: the /tags index list and the /dashboard/tags ranking name link"

requirements-completed: [TAG-12]

coverage:
  - id: tags-index-links
    description: "/tags renders a single-column index; every tag row is a link to /tags/[id]; inline TagDetailView + its getTagDetailAction fetch are gone; CreateTagDialog, active/archived grouping and Archiviato badges remain (D2, TAG-12)"
    requirement: "TAG-12"
    verification:
      - kind: unit
        ref: "tests/tag-settings-panel.test.tsx#renders each tag row as a link to its dedicated /tags/[id] page (href=/tags/1, /tags/2) + retained empty-state / mixed / badge / Nessun intervallo cases"
        status: pass
    human_judgment: false
  - id: dashboard-entry-point
    description: "/dashboard/tags ranking primary name link points to tagDetail(id) instead of /transactions?tag= (D6, TAG-12)"
    requirement: "TAG-12"
    verification:
      - kind: unit
        ref: "tsc clean — tagDetail(item.tagId) type-checks; eslint clean on tag-ranking-list.tsx"
        status: pass
    human_judgment: true
    rationale: "Runtime navigation from the dashboard name link to the correct /tags/[id] page is verified at the Task 3 human-verify checkpoint (pending operator)."
  - id: orphaned-action-removed
    description: "getTagDetailAction + TagDetailResult removed from lib/actions/tags.ts; getTagDetail/resolveOwnedTagId/TagDetail imports dropped (all used only by the removed action) — tsc proves no dangling references (D2)"
    requirement: "TAG-12"
    verification:
      - kind: unit
        ref: "grep 'getTagDetailAction|TagDetailResult' lib components app tests → none remaining; tsc --noEmit clean on touched files"
        status: pass
    human_judgment: false
  - id: detail-route-revalidation
    description: "updateTagAction and archiveTagAction additionally revalidatePath(tagDetail(id)) alongside /tags and /dashboard/tags so an in-place edit/archive on the dedicated page refreshes without a hard reload (D5)"
    requirement: "TAG-11"
    verification:
      - kind: unit
        ref: "tests/tag-actions.test.ts#revalidates /tags, /dashboard/tags AND the detail route on success (3 calls, nth-called-with /tags, /dashboard/tags, /tags/1)"
        status: pass
    human_judgment: true
    rationale: "Live in-place refresh (stay-on-page after archive, Archiviato badge appears) is client behaviour verified at the Task 3 human-verify checkpoint (pending operator)."

# Metrics
duration: 6min
completed: 2026-07-22
status: complete
---

# Phase 69 Plan 03: Entry Points + Cleanup Summary

**Turned `/tags` into an index of links into `/tags/[id]` (retiring the inline `TagDetailView`), re-pointed the `/dashboard/tags` ranking primary name link to the dedicated page, removed the now-orphaned `getTagDetailAction`/`TagDetailResult`, and added detail-route `revalidatePath` to the edit/archive actions — both entry points now funnel to the canonical dedicated page.**

## Performance

- **Duration:** ~6 min
- **Tasks:** 2 of 3 automated (Task 3 is a human-verify checkpoint, deliberately not executed — see below)
- **Files modified:** 5 (0 created, 5 modified)

## Accomplishments
- `components/tags/tag-settings-panel.tsx` is now a single-column **index**: each tag row is a `<Link href={tagDetail(tag.id)}>` (name truncate + date-range caption + "Archiviato" badge). The inline `TagDetailView`, its `getTagDetailAction` fetch effect, the KPI/count/tx-list helpers (`StatCard`, amount/date formatters, tone/count-label helpers), the selection state and the two-column detail layout are all gone — that rendering lives on the dedicated page (`tag-detail-report.tsx`). `CreateTagDialog`, the empty state, the active-vs-archived grouping under "Archiviati", and the archived badges are kept (D2). With no client-only surface left the panel dropped `'use client'` and now renders as a server component; the unused `EditTagDialog`/`ArchiveTagDialog` imports (moved to the page header in 69-01) were removed.
- `components/dashboard/tag-ranking-list.tsx`: the **primary** tag-name `<Link>` `href` now targets `tagDetail(item.tagId)` instead of `/transactions?tag=${item.tagId}`, with the `aria-label` updated to "apri il tag" (D6). No dashboard period/`?tag=` filter wiring was touched — Phase 70 scope fence honored.
- `lib/actions/tags.ts`: removed the orphaned `getTagDetailAction` function and `TagDetailResult` type (the dedicated RSC reads the DAL directly, so the client action had no remaining caller — grep of `lib components app tests` confirmed). Dropped the now-unused `getTagDetail`, `resolveOwnedTagId` and `TagDetail` imports (all three were referenced only inside the removed action). Added `revalidatePath(tagDetail(parsed.data.id))` to both `updateTagAction` and `archiveTagAction` alongside their existing `/tags` and `/dashboard/tags` revalidations so an in-place edit/archive on the dedicated page refreshes without a hard reload (D5). `createTagAction` was left untouched (no detail page exists for a brand-new tag).
- Tests updated: the panel test asserts each row links to `/tags/{id}` (`href="/tags/1"`, `href="/tags/2"`) and keeps the empty-state / mixed active+archived / archived-badge / "Nessun intervallo" / it-IT date-range cases; the removed detail-pane Edit+Archive assertion was dropped. The tag-actions test's archive-revalidation assertion was extended to the third `revalidatePath('/tags/1')` call.

## Task Commits

1. **Task 1: Convert /tags panel into an index of links (remove inline TagDetailView)** - `965b1b9` (refactor)
2. **Task 2: Re-point dashboard entry point and retire the orphaned action** - `96570fe` (feat)

## Files Created/Modified
- `components/tags/tag-settings-panel.tsx` - Server-component index of `<Link>` rows into `/tags/[id]`; inline detail, selection state, on-demand fetch and detail-only helpers removed; CreateTagDialog + grouping + badges retained.
- `tests/tag-settings-panel.test.tsx` - Asserts row links to `/tags/[id]`; drops the detail-pane Edit/Archive assertion; retained cases updated for the index shape.
- `components/dashboard/tag-ranking-list.tsx` - Primary name link re-pointed to `tagDetail(id)`; `aria-label` updated; `tagDetail` imported from `@/lib/routes`.
- `lib/actions/tags.ts` - `getTagDetailAction`/`TagDetailResult` removed; unused DAL imports dropped; `revalidatePath(tagDetail(id))` added to update/archive actions.
- `tests/tag-actions.test.ts` - Archive-revalidation assertion extended to the detail-route call (3 total, nth-called-with `/tags`, `/dashboard/tags`, `/tags/1`).

## Decisions Made
- Panel dropped `'use client'`: with the inline detail, selection state and on-demand fetch removed it has no client-only surface, so it renders as a server component (the plan flagged this as Claude's discretion).
- `revalidatePath` uses the standalone `tagDetail(id)` export from `lib/routes` (matching 69-01's helper convention). The must_haves phrasing `APP_ROUTES.tagDetail` is satisfied by the module-level export, consistent with `dashboardCategoryDetail`/`transactionDetailHref`.
- Index rows retain the date-range caption (`formatDateRange`, returning "Nessun intervallo" when unset) so the panel test's "Nessun intervallo" and it-IT date-range cases still apply.
- No secondary "vedi transazioni" affordance was added on the dashboard ranking (optional per the plan); the `/transactions?tag=` wiring elsewhere is untouched (Phase 70 scope fence, TAG-13).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test contract] Updated tag-actions archive-revalidation assertion**
- **Found during:** Task 2
- **Issue:** `tests/tag-actions.test.ts` asserted `revalidatePath` was called exactly twice (`toHaveBeenCalledTimes(2)`) on archive — encoding the pre-D5 contract. The plan mandates a third `revalidatePath(tagDetail(id))` call (D5), so the assertion failed after the intended change.
- **Fix:** Extended the assertion to expect 3 calls with the third being `/tags/1` (`tagDetail(1)`). The test file was not in the plan's `files_modified` list, but updating it is required for the mandated D5 behavior; the plan's Task 2 `verify` block includes this suite.
- **Files modified:** `tests/tag-actions.test.ts`
- **Commit:** `96570fe`

## Issues Encountered
- `tsc --noEmit` reports one error in `.next/dev/types/validator.ts` (`Cannot find module '../../../app/proto/tag-view/page.js'`). This is a **stale generated Next.js dev artifact** referencing the throwaway `app/proto/tag-view` prototype that lives on branch `proto/tag-view` and is not present on this branch (noted in 69-01-SUMMARY). It is not in any touched file and is unrelated to this plan — pre-existing, out of scope. All touched files are `tsc`-clean.

## Verification Results
- `./node_modules/.bin/vitest run tests/tag-settings-panel.test.tsx` — 7/7 passing.
- `./node_modules/.bin/vitest run tests/tag-actions.test.ts` — 12/12 passing.
- `./node_modules/.bin/tsc --noEmit` — no errors in any touched file; only the unrelated stale `.next` proto validator error (see Issues). `grep 'getTagDetailAction|TagDetailResult'` over `lib components app tests` returns no matches — no dangling references to the removed action.
- `./node_modules/.bin/eslint` on all five touched files — clean.
- `yarn check:language` — passed.

## Task 3 human-verify checkpoint — APPROVED (operator, 2026-07-22)
The operator ran the app and confirmed all five checks pass ("ok ora funziona"). Two refinements were applied during the checkpoint and committed before approval: transaction description added to the tx list (2278d26), and the Entrate/Uscite sign-classification bug fixed (6b44d09). gsd-verifier subsequently returned GOAL ACHIEVED (5/5). Checks confirmed:
1. `/tags` is a list; clicking a tag lands on `/tags/{id}` for that tag (TAG-12, D2).
2. `/dashboard/tags` name link lands on the same `/tags/{id}` page (TAG-12, D6); note the tag's total there.
3. On `/tags/{id}`, the "Valore finale" KPI equals that dashboard total (cross-query reconciliation, TAG-07); "Entrate"/"Uscite" are sign-colored; "{n} transazioni incluse" matches the list length (TAG-08); "Per categoria" bars are sign-colored and sorted largest-first (TAG-09); the transaction list is date-descending (TAG-10).
4. "Modifica" → rename → save updates the header name in place; if active, "Archivia" → confirm keeps you on the page with an "Archiviato" badge appearing (TAG-11, D5).
5. `/tags/999999` (foreign/non-existent) and `/tags/abc` (malformed) both render the not-found page (D1).

Resume signal: operator types "approved" if all five checks pass, otherwise describes what did not reconcile/render.

## Next Phase Readiness
- Both entry points now funnel to the canonical `/tags/[id]` page; the orphaned action is gone; edit/archive refresh the detail route in place.
- Phase 70 (TAG-13) can now remove the period-scoped `?tag=` filter from the dashboard views; the `/transactions?tag=` table filter remains intact and out of Phase 70's scope.

## Self-Check: PASSED
- FOUND: components/tags/tag-settings-panel.tsx (index of Links, no TagDetailView)
- FOUND: tests/tag-settings-panel.test.tsx (href=/tags/[id] assertion)
- FOUND: components/dashboard/tag-ranking-list.tsx (tagDetail(id) link)
- FOUND: lib/actions/tags.ts (getTagDetailAction removed; detail-route revalidation added)
- FOUND: tests/tag-actions.test.ts (3-call revalidation assertion)
- FOUND: commit 965b1b9
- FOUND: commit 96570fe

---
*Phase: 69-tag-dedicated-page*
*Completed: 2026-07-22*
