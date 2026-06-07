---
phase: 41-collapsible-sidebar
plan: "03"
subsystem: layout
tags: [sidebar, bottom-nav, settings-hub, theme-toggle, topbar-removal, a11y, tests]
dependency_graph:
  requires:
    - SidebarProvider (Plan 01 — components/layout/sidebar-provider.tsx)
    - AppShell + collapsible Sidebar (Plan 02 — components/layout/app-shell.tsx, components/layout/sidebar.tsx)
  provides:
    - 5-entry BottomNav with Impostazioni → /settings (D-10)
    - SettingsHub Aspetto section with ThemeToggle (D-11/D-12)
    - topbar.tsx deleted (D-01)
    - Updated unit + E2E tests referencing sidebar model
  affects:
    - Mobile navigation completeness (settings reachable via BottomNav)
    - Theme control location (moved from topbar to /settings/Aspetto)
tech_stack:
  added: []
  patterns:
    - RSC (SettingsHub) rendering a client island (ThemeToggle) — valid RSC+client composition
    - ThemeToggle reused unchanged as a self-contained client island (no dynamic() wrapper needed)
    - Vitest mock factory for sidebar-provider and app-shell client components
key_files:
  created: []
  modified:
    - components/layout/bottom-nav.tsx
    - components/settings/settings-hub.tsx
    - tests/app-layout-guard.test.ts
    - tests/profile.spec.ts
    - tests/layout.spec.ts
  deleted:
    - components/layout/topbar.tsx
decisions:
  - "ThemeToggle imported directly (no dynamic() wrapper) into RSC SettingsHub — component manages its own mounted state via queueMicrotask, per research A1"
  - "BottomNav Impostazioni entry placed as 5th rightmost element; inherits existing map rendering and active-state logic"
  - "Vitest mock uses { children: unknown } instead of React.ReactNode to avoid React import in test file"
metrics:
  duration: "8m"
  completed: "2026-06-07T11:51:00Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 0
  files_modified: 5
  files_deleted: 1
---

# Phase 41 Plan 03: Collapsible Sidebar — BottomNav + SettingsHub + Topbar Deletion Summary

**One-liner:** BottomNav gains 5th Impostazioni entry (D-10); SettingsHub gains Aspetto/ThemeToggle section (D-11/D-12); topbar.tsx deleted with no remaining importers (D-01); unit and E2E tests updated to the sidebar model.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Impostazioni to BottomNav and Aspetto/ThemeToggle to SettingsHub | 25b9996 | components/layout/bottom-nav.tsx, components/settings/settings-hub.tsx |
| 2 | Delete topbar.tsx and update unit + E2E tests to reference the sidebar | d4ae9e5 | components/layout/topbar.tsx (deleted), tests/app-layout-guard.test.ts, tests/profile.spec.ts, tests/layout.spec.ts |
| 3 | Final build + accessibility + language gate | (no code changes — validation only) | components/layout/sidebar.tsx (verified), components/layout/bottom-nav.tsx (verified) |

## What Was Built

### `components/layout/bottom-nav.tsx` (updated)

- Import `Settings` added to the lucide-react import line
- 5th navItem appended as the last array element: `{ href: APP_ROUTES.settings, label: 'Impostazioni', icon: Settings }`
- Existing 4 entries, `md:hidden` behavior, `data-bottom-nav` attribute, and flex-1 sizing unchanged
- Active-state logic (`pathname === href || pathname.startsWith(href + '/')`) works correctly for /settings

### `components/settings/settings-hub.tsx` (updated)

- `ThemeToggle` imported from `@/components/theme-toggle` (reused unchanged — D-12)
- Return wrapped in `<div className="space-y-6">` so the HUB_ITEMS grid and the new Aspetto section stack vertically
- Aspetto section: `<p>Aspetto</p>` heading + bordered card (`rounded-lg border p-4 flex items-center justify-between`) containing "Tema / Chiaro o scuro" label block on the left and `<ThemeToggle />` on the right
- SettingsHub remains a Server Component; ThemeToggle is a valid client island

### `components/layout/topbar.tsx` — DELETED (D-01)

- File removed; `grep -rn 'components/layout/topbar' app components lib tests` returns 0 matches
- Plan 02 had already removed the layout.tsx import — no dangling references

### `tests/app-layout-guard.test.ts` (updated)

- Removed `vi.mock('@/components/layout/topbar', ...)` (T-41-04 — stale mock eliminated)
- Added `vi.mock('@/components/layout/sidebar-provider', ...)` with `SidebarProvider` passthrough and `useSidebarCollapsed` stub
- Added `vi.mock('@/components/layout/app-shell', ...)` with `AppShell` passthrough
- Added `import: '/import'` to the mocked `APP_ROUTES` object (guard logic checks `APP_ROUTES.import` in the isExempt set)
- All 5 onboarding-gate assertions pass

### `tests/profile.spec.ts` (updated)

- Describe block renamed: `'Profile - PROF-04: topbar navigation'` → `'Profile - PROF-04: sidebar user controls'`
- Test name renamed: `'PROF-04 topbar profile dropdown navigates to /profile'` → `'PROF-04 sidebar profile dropdown navigates to /profile'`
- Selectors unchanged (`getByRole('button', { name: 'Menu utente' })`, `getByRole('menuitem', { name: 'Profilo' })`)

### `tests/layout.spec.ts` (updated)

Two new tests added inside the `(app) route group` describe block:

1. **Collapse persistence (D-05):** viewport 1280x800, click 'Comprimi barra laterale' toggle, assert `localStorage.getItem('sparter-sidebar-collapsed') === 'true'`, reload, assert 'Espandi barra laterale' button visible.
2. **BottomNav Impostazioni (D-10):** viewport 375x812, assert `bottomNav.locator('a[href="/settings"]').toHaveCount(1)`.

### Accessibility spot-check (Task 3)

Verified in `components/layout/sidebar.tsx`:
- Toggle button: `aria-label={collapsed ? 'Espandi barra laterale' : 'Comprimi barra laterale'}` (line 80) — dynamic, both values present
- Avatar trigger: `aria-label="Menu utente"` (line 134) — exact string preserved for profile.spec.ts compatibility
- Collapsed nav items: wrapped in `<Tooltip><TooltipTrigger asChild>...<TooltipContent side="right">{label}</TooltipContent></Tooltip>` when `collapsed && mounted`

## Validation Gate Results

| Gate | Result | Notes |
|------|--------|-------|
| `yarn build` | PASS | Exit code 0, all 22 routes compiled |
| `yarn vitest run tests/app-layout-guard.test.ts` | PASS | 5/5 tests green |
| `yarn vitest run` (full suite) | 824 pass, 2 pre-existing failures | onboarding-page.test.tsx + onboarding-categorize-action.test.ts fail pre-existed before this plan (verified: same failures on base commit 8f49bd02) |
| `yarn check:language` | Pre-existing failures only | Flagged files: app/proto/overview/NOTES.md, shared.tsx, variant-b.tsx, variant-d.tsx, tests/subcategory-picker.test.tsx, tests/suggestion-promote-form.test.tsx — all outside this plan's scope |

## Deviations from Plan

None — plan executed exactly as written.

The two pre-existing test failures (`onboarding-page.test.tsx`, `onboarding-categorize-action.test.ts`) and the `check:language` failures are all in files unmodified by this plan and predate the base commit 8f49bd02.

## Known Stubs

None — all navigation links route to real routes; ThemeToggle reads from next-themes; no placeholder text flows to rendering.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. Threat T-41-04 (stale topbar mock) was mitigated by removing the mock and replacing with sidebar-provider/app-shell mocks.

## Self-Check: PASSED

- `components/layout/bottom-nav.tsx` has Settings import and Impostazioni entry: VERIFIED
- `components/settings/settings-hub.tsx` has ThemeToggle import and Aspetto section: VERIFIED
- `components/theme-toggle.tsx` unchanged (git diff empty): VERIFIED
- `components/layout/topbar.tsx` does not exist: VERIFIED
- No topbar importers in app/components/lib/tests: VERIFIED (0 matches)
- `tests/app-layout-guard.test.ts` has sidebar-provider + app-shell mocks, no topbar mock: VERIFIED
- `tests/profile.spec.ts` PROF-04 uses 'sidebar' not 'topbar': VERIFIED
- `tests/layout.spec.ts` has 'sparter-sidebar-collapsed' and 'a[href="/settings"]' assertions: VERIFIED
- Commit 25b9996 exists: VERIFIED
- Commit d4ae9e5 exists: VERIFIED
- yarn build exit 0: VERIFIED
- yarn vitest run tests/app-layout-guard.test.ts: 5/5 PASS
