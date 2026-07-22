---
phase: quick-260721-mrl
plan: 01
subsystem: layout
tags: [sidebar, navigation, settings]
dependency-graph:
  requires: []
  provides: []
  affects: [components/layout/sidebar.tsx, components/settings/settings-hub.tsx]
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - components/layout/sidebar.tsx
    - components/settings/settings-hub.tsx
    - tests/settings-hub.test.tsx
decisions:
  - "Removed the Categorie card from the Impostazioni hub rather than duplicating it in both the sidebar and the hub — 'spostiamo' (move) implies relocating the entry point, not adding a second path to the same page."
  - "Impostazioni active-state excludes /settings/categories explicitly (pathname.startsWith(settings/) && !pathname.startsWith(categorySettings)) so Categorie and Impostazioni never both highlight."
metrics:
  duration: 6min
  completed: 2026-07-21
status: complete
---

# Phase quick-260721-mrl Plan 01: Move Categorie into the primary left sidebar Summary

Promoted "Categorie" (taxonomy management, `/settings/categories`) from the Impostazioni hub into the primary left sidebar navigation, reachable in one click alongside Dashboard/Transazioni/Spese/Importazioni, instead of two clicks deep via Impostazioni.

## What Changed

- `components/layout/sidebar.tsx` — added `FolderTree` icon import; added a `Categorie` entry to `topNavItems` (after Importazioni, before the Impostazioni separator), pointing at `APP_ROUTES.categorySettings`. Fixed the Impostazioni link's active-state check so it no longer highlights while on `/settings/categories` — it now stays active only for `/settings` itself or other settings subpaths (e.g. `/settings/profile`), excluding the new Categorie route.
- `components/settings/settings-hub.tsx` — removed the Categorie card from `HUB_ITEMS` (Profilo remains as the sole card); dropped the now-unused `FolderTree` import; changed the `HubItem['icon']` type annotation from `typeof FolderTree` to `typeof UserCog`. Aspetto/ThemeToggle section untouched.
- `tests/settings-hub.test.tsx` — renamed the affected test to "renders a navigation link to Profilo settings" and dropped the `/settings/categories` assertion; removed the now-unused `categorySettings` key from the `@/lib/routes` mock and the `FolderTree` icon from the `lucide-react` mock.

No changes to `app/(app)/settings/categories/page.tsx`, `components/categories/*`, `lib/routes.ts`, or `components/layout/bottom-nav.tsx` — route, destination page, and mobile nav are unchanged per the locked plan decision.

## Deviations from Plan

None — plan executed exactly as written, including the Impostazioni active-state fix amendment in Task 1.

## Verification

- `yarn check:language` — passed, both after Task 1 and Task 2.
- `grep -n "FolderTree" components/layout/sidebar.tsx` — confirms import and `topNavItems` entry present.
- `yarn vitest run tests/settings-hub.test.tsx` — 5/5 passed.
- Manual/visual checkpoint (browser open of `/settings/categories` and the Impostazioni hub) was not driven in this session — no dev server was started; the automated checks above cover the behavioral contract (nav entry present, active-state logic, hub card removed, tests passing). Flagged as a verification gap for a follow-up human check if desired.

## Self-Check: PASSED

- FOUND: components/layout/sidebar.tsx (FolderTree import + Categorie entry + fixed Impostazioni active-state)
- FOUND: components/settings/settings-hub.tsx (HUB_ITEMS has only Profilo, no FolderTree import)
- FOUND: tests/settings-hub.test.tsx (updated test, mocks trimmed)
- FOUND commit 26a08c3: feat(quick-260721-mrl-01): add Categorie to primary sidebar nav
- FOUND commit eddc893: refactor(quick-260721-mrl-02): drop redundant Categorie card from Impostazioni hub
