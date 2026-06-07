---
phase: 41-collapsible-sidebar
plan: "02"
subsystem: layout
tags: [sidebar, collapse, app-shell, tooltip, dropdown, user-avatar, topbar-removal]
dependency_graph:
  requires:
    - SidebarProvider (Plan 01 — components/layout/sidebar-provider.tsx)
    - Tooltip component set (Plan 01 — components/ui/tooltip.tsx)
  provides:
    - AppShell (components/layout/app-shell.tsx)
    - Sidebar rewrite (components/layout/sidebar.tsx)
    - Topbar-free RSC layout (app/(app)/layout.tsx)
  affects:
    - Plan 03 — responsive/mobile polish, BottomNav sync, final integration
tech_stack:
  added: []
  patterns:
    - Client shell reading SidebarContext via useSidebarCollapsed (RSC-safe pattern)
    - Tooltip wrapping only after mount (queueMicrotask mounted flag, Pitfall 6)
    - Single TooltipProvider wrapping nav list (Pitfall 2)
    - User avatar dropdown migrated 1:1 from Topbar to sidebar bottom slot
key_files:
  created:
    - components/layout/app-shell.tsx
  modified:
    - components/layout/sidebar.tsx
    - app/(app)/layout.tsx
decisions:
  - "AppShell is a client component that reads SidebarContext; RSC layout (app/(app)/layout.tsx) stays async server component — SidebarProvider bridges the boundary"
  - "aside width uses only md:w-16 (collapsed) and md:w-60 (expanded) per D-03; transition-[width] duration-200 ease-in-out added at Claude's discretion"
  - "Tooltip rendered only when collapsed && mounted to prevent SSR mismatch (Pitfall 6); bare Link rendered otherwise"
  - "Impostazioni removed from sidebar nav; user controls (Profilo + Logout) migrated to bottom Avatar dropdown (D-07/D-08)"
  - "aria-label='Menu utente' preserved exactly for profile.spec.ts compatibility"
metrics:
  duration: "12m"
  completed: "2026-06-07T10:10:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 2
---

# Phase 41 Plan 02: Collapsible Sidebar — App Shell + Sidebar Rewrite Summary

**One-liner:** AppShell client component drives aside width (md:w-16/md:w-60) from SidebarContext; Sidebar rewritten with chevron toggle, icon-only-with-tooltips collapsed nav, and bottom Avatar dropdown migrating user controls from the removed Topbar.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create AppShell client component and wire SidebarProvider into RSC layout | 9583643 | components/layout/app-shell.tsx, app/(app)/layout.tsx |
| 2 | Rewrite Sidebar with toggle, collapsible nav + tooltips, and bottom user controls | b2589db | components/layout/sidebar.tsx |

## What Was Built

### `components/layout/app-shell.tsx` (new)

Client component (`"use client"`) exporting `AppShell`:

- Reads `collapsed` from `useSidebarCollapsed()` (SidebarContext)
- Renders `<aside data-sidebar>` with conditional width: `md:w-16` when collapsed, `md:w-60` when expanded
- `transition-[width] duration-200 ease-in-out overflow-hidden` applied to aside for smooth animation (D-03)
- `data-sidebar` attribute preserved for layout test compatibility
- Renders `<Sidebar />` inside aside and `<BottomNav className="md:hidden" />` in the content column
- No Topbar import or usage (D-01)

### `app/(app)/layout.tsx` (refactored)

RSC async layout:

- Removed `Topbar` import and usage (D-01/D-09)
- Added `SidebarProvider` and `AppShell` imports
- Guard logic unchanged: `verifySession`, `x-pathname` read, `isExempt` check, `isOnboarding` bypass returning `<>{children}</>`
- Final return now: `<SidebarProvider><AppShell>{children}</AppShell></SidebarProvider>`

### `components/layout/sidebar.tsx` (rewritten)

Collapsible icon-rail sidebar:

**Top slot (D-04/D-06):**
- When expanded: "Sparter" wordmark (`text-lg font-semibold tracking-tight`) + `ChevronLeft` toggle button on the right
- When collapsed: only `ChevronRight` toggle button centered
- `aria-label` on toggle: `'Comprimi barra laterale'` (expanded) / `'Espandi barra laterale'` (collapsed)
- Button calls `setCollapsed(!collapsed)` from SidebarContext

**Nav list (D-03):**
- topNavItems: Dashboard, Transazioni, Spese, Importazioni (Impostazioni removed from sidebar nav)
- When expanded: `ClientMountIcon` + label span, `gap-3 px-3` layout
- When collapsed: icon-only, centered, `justify-center px-2`
- Tooltip wrappers (`<Tooltip><TooltipTrigger asChild>...<TooltipContent side="right">`) applied only when `collapsed && mounted` (Pitfall 6 — prevents SSR hydration mismatch)
- Whole list wrapped in single `<TooltipProvider>` (Pitfall 2 — avoids multiple provider nesting)

**Bottom slot (D-07/D-08):**
- `<div className="mt-auto">` + `<Separator>`
- `DropdownMenuTrigger aria-label="Menu utente"` (exact string preserved for profile.spec.ts)
- When expanded: Avatar + name/email text beside it
- When collapsed: Avatar circle only
- `DropdownMenuContent align="end"`: DropdownMenuLabel (name + email), Separator, Profilo Link to `APP_ROUTES.profileSettings`, Logout onClick `signOutAction()` — mirrors topbar 1:1

## Deviations from Plan

None — plan executed exactly as written.

The plan mentioned "keep `Settings`/Impostazioni" statement was negative (remove it), which matches the implementation. The `bottomNavItems` array was removed entirely and replaced with the user dropdown bottom slot.

## Known Stubs

None — all navigation links route to real routes. User session data reads from `authClient.useSession()`. No placeholder text flows to rendering.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced.

The two accepted threats from the plan's threat model apply:
- T-41-02: `signOutAction` invocation from sidebar dropdown — accepted (Next.js Server Actions carry implicit CSRF token; behavior unchanged from topbar)
- T-41-03: session email/name rendered in sidebar — accepted (same data the topbar already rendered to the authenticated owner)

## Self-Check: PASSED

- `components/layout/app-shell.tsx` exists: FOUND
- `components/layout/sidebar.tsx` exists: FOUND
- `app/(app)/layout.tsx` modified: FOUND
- Commit 9583643 exists: FOUND (git log)
- Commit b2589db exists: FOUND (git log)
- No Topbar reference in layout.tsx: VERIFIED
- md:w-16 and md:w-60 in app-shell.tsx: VERIFIED
- Menu utente aria-label in sidebar.tsx: VERIFIED
- signOutAction in sidebar.tsx: VERIFIED
