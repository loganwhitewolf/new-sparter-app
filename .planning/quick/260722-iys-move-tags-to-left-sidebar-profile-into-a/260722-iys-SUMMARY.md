---
phase: quick-260722-iys
plan: 01
subsystem: ui
tags: [navigation, routing, sidebar, next.js, lucide-react]

requires:
  - phase: 68-tags-dashboard-and-navigation
    provides: Tag entity, dashboard Tag section, tag settings panel
provides:
  - "/tags canonical route (Tag settings panel promoted out of /settings/tags)"
  - "/patterns canonical route (CategoryPatternPanel extracted from Categories page)"
  - "Emptied Impostazioni hub — /settings redirects to /settings/profile"
  - "Profile page Aspetto/theme section"
  - "Reordered desktop sidebar (Dashboard/Transazioni/Spese/Importazioni/Categorie/Tag/Pattern)"
  - "Mobile bottom nav Altro bottom sheet (Categorie/Tag/Pattern/Profilo)"
affects: [navigation, settings, tags, patterns, categories]

tech-stack:
  added: []
  patterns:
    - "Thin redirect Server Component (metadata robots noindex,nofollow + redirect()) reused for /settings, /settings/tags"
    - "Mobile overflow items ship as a MORE_SHEET_ROUTES export consumed by both the sheet and the bottom-nav active-state check"

key-files:
  created:
    - app/(app)/tags/page.tsx
    - app/(app)/patterns/page.tsx
    - components/layout/mobile-more-sheet.tsx
    - tests/patterns-page.test.tsx
    - tests/bottom-nav.test.tsx
    - tests/mobile-more-sheet.test.tsx
  modified:
    - lib/routes.ts
    - lib/actions/tags.ts
    - lib/actions/revalidation.ts
    - app/(app)/layout.tsx
    - app/(app)/settings/tags/page.tsx
    - app/(app)/settings/page.tsx
    - app/(app)/settings/categories/page.tsx
    - app/(app)/settings/profile/page.tsx
    - components/layout/sidebar.tsx
    - components/layout/bottom-nav.tsx
    - components/dashboard/tag-ranking-list.tsx
    - components/tags/bulk-assign-tags-dialog.tsx

key-decisions:
  - "APP_ROUTES.tagSettings renamed to APP_ROUTES.tags ('/tags') rather than keeping the *Settings suffix, since the route no longer lives under /settings"
  - "settings-hub.tsx deleted outright (not kept as a dead redirect-only component) — nothing left to render once Tag/Profilo/theme moved out"
  - "CategoryPatternPanel rendered on /patterns with its own component defaults (heading 'Pattern personalizzati' etc.) instead of the Categories page's prop overrides, since it is now the pattern's dedicated home"

requirements-completed: [IYS-01]

duration: 45min
completed: 2026-07-22
status: complete
---

# Quick Task 260722-iys: Nav Tags/Profilo/tema + /patterns Summary

**Promoted Tag and a new Pattern management page to the primary sidebar at `/tags`/`/patterns`, emptied the Impostazioni hub (theme moved to Profile, `/settings` now redirects there), and replaced the mobile bottom nav's Impostazioni item with an "Altro" bottom sheet.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3 (all `type="auto"`, autonomous)
- **Files modified/created:** 24

## Accomplishments

- `/tags` is now the canonical Tag page (real content moved from `/settings/tags`, which is a thin redirect); `/patterns` is a brand-new standalone page hosting `CategoryPatternPanel`, extracted from the Categories page.
- Onboarding-guard `isExempt` check extended to `/tags`/`/patterns` so zero-transaction users aren't bounced to `/onboarding` from the newly-promoted routes.
- Categories page (`/settings/categories`) now shows taxonomy only; `settings-hub.tsx` deleted; `/settings` redirects to `/settings/profile`; Profile page gained its own Aspetto/theme section (`ThemeToggle`).
- Desktop sidebar reordered to Dashboard → Transazioni → Spese → Importazioni → Categorie → Tag → Pattern, with the Impostazioni link removed entirely.
- Mobile bottom nav keeps 4 primary items + a new "Altro" button opening `MobileMoreSheet` (Categorie/Tag/Pattern/Profilo), closing on navigation.

## Task Commits

1. **Task 1: Canonical /tags + /patterns routes, legacy redirect, onboarding-guard parity** - `62a80d4` (feat)
2. **Task 2: Trim Categories page, empty Impostazioni hub, add theme to Profile** - `cfd68f3` (feat)
3. **Task 3: Sidebar reorder + mobile Altro bottom sheet** - `fcb1646` (feat, includes deviation fixes below)

## Files Created/Modified

- `lib/routes.ts` — `tagSettings` renamed to `tags` ('/tags'); new `patterns` ('/patterns') key
- `app/(app)/tags/page.tsx` — real Tag settings page (moved)
- `app/(app)/settings/tags/page.tsx` — thin redirect to `/tags`
- `app/(app)/patterns/page.tsx` — new page hosting `CategoryPatternPanel` scoped to the user
- `app/(app)/layout.tsx` — onboarding-guard `isExempt` extended to `/tags`/`/patterns`
- `lib/actions/tags.ts` / `lib/actions/revalidation.ts` — revalidate the new `/tags`/`/patterns` paths
- `components/dashboard/tag-ranking-list.tsx` — empty-state link/copy updated (no more "Impostazioni")
- `app/(app)/settings/categories/page.tsx` — pattern panel/data fetch removed, taxonomy-only copy
- `components/settings/settings-hub.tsx` — deleted
- `app/(app)/settings/page.tsx` — thin redirect to `/settings/profile`
- `app/(app)/settings/profile/page.tsx` — new Aspetto/theme section
- `components/layout/sidebar.tsx` — Tag/Pattern nav items added, Impostazioni link block removed
- `components/layout/bottom-nav.tsx` — Impostazioni item replaced by Altro button + sheet
- `components/layout/mobile-more-sheet.tsx` — new bottom-sheet component + `MORE_SHEET_ROUTES` export
- `components/tags/bulk-assign-tags-dialog.tsx` — stale "Impostazioni → Tag" empty-state copy fixed (deviation)
- Tests: `tests/tag-actions.test.ts`, `tests/tag-ranking-list.test.tsx`, `tests/app-layout-guard.test.ts`, `tests/categorization-revalidation-actions.test.ts`, `tests/category-settings-ui.test.tsx`, `tests/patterns-page.test.tsx` (new), `tests/bottom-nav.test.tsx` (new), `tests/mobile-more-sheet.test.tsx` (new), `tests/pattern-actions.test.ts`, `tests/category-actions.test.ts`, `tests/categories-settings.spec.ts`, `tests/layout.spec.ts`, `tests/account-linking.spec.ts`

## Decisions Made

See `key-decisions` in frontmatter — none contradicted the locked `260722-iys-CONTEXT.md` decisions; all three were planner/executor discretion points explicitly called out as open in the plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `EXPECTED_CATEGORY_REVALIDATION_ROUTES` stale in two test files not listed in `files_modified`**
- **Found during:** Full-suite `yarn vitest run` verification after Task 3
- **Issue:** `tests/category-actions.test.ts` and `tests/pattern-actions.test.ts` each hardcode a local copy of the expected revalidation-route list; Task 1's addition of `revalidatePath(APP_ROUTES.patterns)` to `revalidateCategorizationSurfaces()` broke both (12 failing assertions total)
- **Fix:** Added `/patterns` to both local arrays, matching the fix already applied to `tests/categorization-revalidation-actions.test.ts` in Task 1
- **Files modified:** `tests/category-actions.test.ts`, `tests/pattern-actions.test.ts`
- **Verification:** `yarn vitest run` — full suite (139 files, 1737 tests, 1 todo) green
- **Committed in:** `fcb1646` (Task 3 commit)

**2. [Rule 1 - Bug] Stale hardcoded "Impostazioni" references outside the plan's `files_modified` list**
- **Found during:** Repo-wide grep sweep for `Impostazioni`/`tagSettings`/`/settings/tags` per the orchestrator's explicit constraint
- **Issue:** `components/tags/bulk-assign-tags-dialog.tsx` had a stale empty-state string ("...da Impostazioni → Tag"); `tests/layout.spec.ts` asserted the mobile bottom nav's now-removed `/settings` link; `tests/account-linking.spec.ts` asserted the deleted settings-hub heading and its now-removed card links
- **Fix:** Reworded the dialog copy to reference the Tag section directly (no link, matching the plain-text style already there); rewrote the layout.spec.ts test to assert the Altro button/sheet instead; rewrote the account-linking.spec.ts test to assert the `/settings` → `/settings/profile` redirect instead of the deleted hub
- **Files modified:** `components/tags/bulk-assign-tags-dialog.tsx`, `tests/layout.spec.ts`, `tests/account-linking.spec.ts`
- **Verification:** `yarn check:language` clean; repo-wide grep for `tagSettings`/`Impostazioni`/`/settings/tags` shows no remaining stale hits (the two matches left in `bottom-nav.test.tsx`/`layout.spec.ts` are negative assertions confirming the link is gone)
- **Committed in:** `fcb1646` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs caused by this plan's own changes surfacing in files outside `files_modified`)
**Impact on plan:** No scope creep — both fixes were direct consequences of Task 1/Task 3 code changes rippling into test files and one copy string the plan's author didn't enumerate. Repo-wide grep confirms no remaining stale `tagSettings`/`/settings/tags`/hub references.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `/tags`, `/patterns`, `/settings` (redirect), `/settings/tags` (redirect) are all live and tested.
- Full `yarn vitest run` (139 files / 1737 tests / 1 todo) and `yarn check:language` are green.
- `npx tsc --noEmit` shows the same 21 pre-existing errors in 6 unrelated test files present before this plan (verified via `git stash` diff) — zero new type errors introduced.
- Playwright e2e specs (`tests/categories-settings.spec.ts`, `tests/layout.spec.ts`, `tests/account-linking.spec.ts`) updated for internal consistency but not run (gated behind `DATABASE_URL`/`STAGING_KEY`, not part of this plan's automated verify).
- Manual verification (sidebar visual order, mobile Altro sheet interaction, light/dark theme toggle on Profile) is a `human_needed` item per the plan's `<verification>` step 4 — not driven in this session (no browser/staging environment available to this executor).

---
*Phase: quick-260722-iys*
*Completed: 2026-07-22*

## Self-Check: PASSED

- Created files verified present: `app/(app)/tags/page.tsx`, `app/(app)/patterns/page.tsx`, `components/layout/mobile-more-sheet.tsx`, `tests/patterns-page.test.tsx`, `tests/bottom-nav.test.tsx`, `tests/mobile-more-sheet.test.tsx`
- Task commits verified in git log: `62a80d4`, `cfd68f3`, `fcb1646`
