---
phase: 68-tags-dashboard-and-navigation
plan: 08
subsystem: ui
tags: [react, nextjs, rsc, dashboard, tags, decimal]

requires:
  - phase: 68-01
    provides: "APP_ROUTES.dashboardTags route constant, tagScopedTransactions() EXISTS predicate (used by the card's click-through target)"
  - phase: 68-04
    provides: "getTagTotals(userId) — TAG-05's per-tag all-time, dashboard-exclusion-aware aggregate; archiveTagAction's second revalidatePath(APP_ROUTES.dashboardTags)"
  - phase: 68-05
    provides: "3rd 'Tag' tab in DashboardTabNav already pointing at /dashboard/tags"
provides:
  - "/dashboard/tags — the working TAG-05 Tag section route"
  - "TagRankingList — card grid rendering every tag's independent all-time total, Archiviato badge, and click-through to /transactions?tag={tagId}"
  - "TagRankingSkeleton — loading-state card grid mirroring CategoryRankingSkeleton"
affects: []

tech-stack:
  added: []
  patterns:
    - "Sign-based amount tone (text-[var(--total-in)]/text-[var(--total-out)] by Number(total) >= 0) instead of a fixed in/out bar-color rule, since a tag has no fixed direction — copied from OverviewMoversPanel's allocation column, not CategoryRankingList's bar-color rule"
    - "Minimal-shape TagRow construction for ArchiveTagDialog reuse (only id/name/archived are read; unused fields filled with structurally-valid placeholders) instead of fetching a second, separate TagRow[] just for the archive action"
    - "Async RSC content component resolves its try/catch BEFORE constructing any JSX (assigns to a local variable, then branches) to satisfy the react-hooks/error-boundaries lint rule while still catching a real DAL fetch failure server-side"

key-files:
  created:
    - components/dashboard/tag-ranking-list.tsx
    - components/dashboard/tag-ranking-skeleton.tsx
    - app/(app)/dashboard/tags/page.tsx
    - tests/tag-ranking-list.test.tsx
  modified: []

key-decisions:
  - "TagRankingList constructs a minimal TagRow-shaped object (id/name/archived from TagTotalItem, placeholder values for the rest) to pass to ArchiveTagDialog, rather than fetching a separate TagRow[] — ArchiveTagDialog only reads tag.id/tag.name internally, verified by reading its source"
  - "Error-state markup in the page's async content component is a small inline duplicate of the empty-state's dashed-box shape (not a shared exported component) — the plan's artifact list scopes this plan to exactly 3 files, and the duplication is ~5 lines"
  - "TagRankingContent resolves getTagTotals in a try/catch BEFORE returning any JSX (assigns to a local variable first) instead of returning JSX from inside the try/catch block, to satisfy the repo's react-hooks/error-boundaries eslint rule"

patterns-established:
  - "Sign-colored per-tag total tone rule for any future net-can-be-either-sign entity (mirrors the Expense Group / tag precedent, not the fixed-direction category bar-color rule)"

requirements-completed: [TAG-05]

coverage:
  - id: D1
    description: "TagRankingList renders the dashed empty-state box with the locked 'Nessun tag creato' copy and a working /settings/tags link when zero tags exist"
    requirement: "TAG-05"
    verification:
      - kind: unit
        ref: "tests/tag-ranking-list.test.tsx#TagRankingList > renders the dashed empty-state box with the locked copy and a working settings link"
        status: pass
    human_judgment: false
  - id: D2
    description: "Populated Tag section renders every tag (0/1/many, no cap), each card clickable to /transactions?tag={tagId}, long names truncate with title=, archived tags keep the Archivia action present/enabled with the Archiviato badge, and the total is colored by sign (not a fixed direction)"
    requirement: "TAG-05"
    verification:
      - kind: unit
        ref: "tests/tag-ranking-list.test.tsx#TagRankingList > renders a single card with no layout awkwardness for one tag"
        status: pass
      - kind: unit
        ref: "tests/tag-ranking-list.test.tsx#TagRankingList > renders every tag in a many-tags list, no cap"
        status: pass
      - kind: unit
        ref: "tests/tag-ranking-list.test.tsx#TagRankingList > truncates a long tag name and sets title= to the full name"
        status: pass
      - kind: unit
        ref: "tests/tag-ranking-list.test.tsx#TagRankingList > shows the Archiviato badge and keeps the Archivia action present/enabled for an archived tag"
        status: pass
      - kind: unit
        ref: "tests/tag-ranking-list.test.tsx#TagRankingList > colors the total green for a non-negative sum and red for a negative sum"
        status: pass
    human_judgment: false
  - id: D3
    description: "A tag with zero matching transactions (minDate/maxDate null) renders identically to the populated shape — name/badge/total/caption/archive action always present, caption reads '0 movimenti' with no dangling date range, and singular '1 movimento' is used for count===1"
    requirement: "TAG-05"
    verification:
      - kind: unit
        ref: "tests/tag-ranking-list.test.tsx#TagRankingList > renders \"0 movimenti\" with no date range for a zero-transaction tag (partial/zero-total case)"
        status: pass
      - kind: unit
        ref: "tests/tag-ranking-list.test.tsx#TagRankingList > uses singular \"1 movimento\" when count is exactly 1"
        status: pass
    human_judgment: false
  - id: D4
    description: "TagRankingSkeleton renders a pulse-box card grid under Suspense, mirroring CategoryRankingSkeleton's shape"
    requirement: "TAG-05"
    verification:
      - kind: unit
        ref: "tests/tag-ranking-list.test.tsx#TagRankingSkeleton > renders a pulse-box card grid"
        status: pass
    human_judgment: false
  - id: D5
    description: "/dashboard/tags is a working, reachable RSC page calling verifySession()+getTagTotals(userId) inside a Suspense boundary, reading no preset/year/tag searchParams, and the 3-tab nav's 'Tag' tab already points here"
    requirement: "TAG-05"
    verification: []
    human_judgment: true
    rationale: "No jsdom/live-route harness exists in this repo to drive an actual page navigation and observe the 3-tab nav's active-state highlighting or the real getTagTotals(userId) round-trip against a live session — verified by static analysis (tsc --noEmit, eslint, full test suite) and manual code-path reading; live-browser confirmation is a human verify-time check per the plan's own note"

duration: 20min
completed: 2026-07-21
status: complete
---

# Phase 68 Plan 08: TAG-05 Tag section dashboard page Summary

**New `/dashboard/tags` RSC page rendering every one of the user's tags with an independent all-time total (sign-colored), an "Archiviato" badge, and a click-through to `/transactions?tag={tagId}` — reusing `ArchiveTagDialog` verbatim from Phase 67.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2
- **Files modified:** 4 (3 source, 1 test)

## Accomplishments
- `TagRankingList` (`components/dashboard/tag-ranking-list.tsx`) — card grid mirroring `CategoryRankingList`'s shell minus the percentage bar/sparkline, with a tag-name click-through `<Link>`, "Archiviato" badge, sign-colored `font-mono` total, `"{count} movimenti · {minDate}–{maxDate}"` caption, and the reused `ArchiveTagDialog` action. Dashed-box empty state with the locked "Nessun tag creato" copy and a `/settings/tags` link.
- `TagRankingSkeleton` (`components/dashboard/tag-ranking-skeleton.tsx`) — pulse-box card grid under `Suspense`, mirroring `CategoryRankingSkeleton`'s shape with the percentage-bar row dropped.
- `/dashboard/tags` page (`app/(app)/dashboard/tags/page.tsx`) — async RSC page calling `verifySession()` then `getTagTotals(userId)` inside a `Suspense`-wrapped content component. Reads no `searchParams` at all (no `preset`/`year`/`tag`), per LOCKED DECISION 1. A `getTagTotals` fetch failure surfaces the locked "Non è stato possibile caricare i tag. Ricarica la pagina." copy in the same dashed-box shape as the empty state.
- `tests/tag-ranking-list.test.tsx` — 9 tests covering empty/populated/many-tags/long-name/archived/sign-tone/zero-total/singular-count states for `TagRankingList`, plus a skeleton smoke test.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build TagRankingList + TagRankingSkeleton** - `210327c` (feat)
2. **Task 2: Wire the /dashboard/tags page** - `2477957` (feat)

## Files Created/Modified
- `components/dashboard/tag-ranking-list.tsx` - NEW: `TagRankingList({ items })` — card grid, empty state, click-through, Archivia action
- `components/dashboard/tag-ranking-skeleton.tsx` - NEW: `TagRankingSkeleton()` — loading-state card grid
- `app/(app)/dashboard/tags/page.tsx` - NEW: the TAG-05 route, `verifySession()` + `getTagTotals(userId)` under `Suspense`
- `tests/tag-ranking-list.test.tsx` - NEW: 9 tests (empty state, single/many cards, long-name truncation, archived badge + Archivia presence, sign-based tone, zero-total/singular-count captions, skeleton smoke test)

## Decisions Made
See `key-decisions` in frontmatter — most notably: `ArchiveTagDialog` is called with a minimal hand-built `TagRow`-shaped object (only `id`/`name`/`archived` populated from `TagTotalItem`, structurally-valid placeholders for the rest) instead of fetching a second, separate `TagRow[]`, since `ArchiveTagDialog` only reads `tag.id`/`tag.name` internally (confirmed by reading `components/tags/tag-mutation-dialogs.tsx`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Restructured the page's async content component to satisfy react-hooks/error-boundaries**
- **Found during:** Task 2 (wiring `/dashboard/tags`)
- **Issue:** The plan's suggested "try/catch returning the error-state markup" shape constructs JSX directly inside the `try`/`catch` blocks, which the repo's `react-hooks/error-boundaries` eslint rule flags (`Avoid constructing JSX within try/catch`) — `yarn eslint` failed on the initial implementation.
- **Fix:** `getTagTotals(userId)` is awaited into a local variable inside the try/catch (no JSX constructed there); a single `if (items === null)` branch after the try/catch returns either the error markup or `<TagRankingList items={items} />`. Behavior is identical (a real DAL throw still hits the `catch` and still renders the locked error copy in the same dashed-box shape), only the JSX-construction site moved outside the try/catch.
- **Files modified:** `app/(app)/dashboard/tags/page.tsx`
- **Verification:** `yarn eslint` clean on the file; `tsc --noEmit` clean; full test suite (1719 tests) still passes.
- **Committed in:** `2477957` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug fix — lint-rule violation from following the plan's literal try/catch-with-JSX suggestion)
**Impact on plan:** Purely a code-shape fix; the observable error-handling behavior described in the plan (fetch failure surfaces the locked copy in the same dashed-box shape) is unchanged. No scope creep.

## Issues Encountered

Initial `tests/tag-ranking-list.test.tsx` assertion `expect(html).not.toContain('disabled')` was overly broad — it also matched the Tailwind `disabled:pointer-events-none`/`disabled:opacity-50` utility-class variants present on every shadcn `Button`, which are always in the rendered class string regardless of the button's actual `disabled` attribute. Replaced with a regex (`/\sdisabled(?!:)/`) that only matches a real `disabled` HTML attribute, not the `disabled:` Tailwind variant prefix — confirmed the archived-tag Archivia button has no real `disabled` attribute.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

TAG-05 is fully delivered: `/dashboard/tags` renders every tag with an independent all-time total, an always-visible Archivia action, and a click-through to `/transactions?tag={tagId}` (closing the loop with Plan 68-01's `tagScopedTransactions`/`tag` filter). The 3-tab nav (Plan 68-05) already routes here. `yarn check:language` clean, `tsc --noEmit` clean (pre-existing unrelated errors in `tests/suggestion-*.test.tsx`/`tests/transactions-dal.test.ts` untouched by this plan), full test suite green (1719 passed, 1 pre-existing todo). No blockers for Plans 68-06/68-07 (unrelated NAV-01/TAG-04 surfaces, not yet executed at the time of this plan).

---
*Phase: 68-tags-dashboard-and-navigation*
*Completed: 2026-07-21*
