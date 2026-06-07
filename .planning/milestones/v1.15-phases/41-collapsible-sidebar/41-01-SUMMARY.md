---
phase: 41-collapsible-sidebar
plan: "01"
subsystem: layout
tags: [sidebar, context, localStorage, radix-ui, tooltip]
dependency_graph:
  requires: []
  provides:
    - SidebarProvider (components/layout/sidebar-provider.tsx)
    - useSidebarCollapsed hook
    - Tooltip component set (components/ui/tooltip.tsx)
  affects:
    - components/layout/sidebar.tsx (Plan 02 — consumes SidebarContext)
    - app/(app)/layout.tsx (Plan 02 — wraps with SidebarProvider)
tech_stack:
  added: []
  patterns:
    - React Context as Client Component wrapper in RSC layout (Next.js 16 pattern)
    - shadcn-style Tooltip wrapper over radix-ui barrel (no extra package)
    - SSR-safe localStorage hydration: useState(false) + useEffect read after mount
key_files:
  created:
    - components/layout/sidebar-provider.tsx
    - components/ui/tooltip.tsx
  modified: []
decisions:
  - "SidebarContext value type is { collapsed: boolean; setCollapsed: (v: boolean) => void } (D-13 exact shape)"
  - "localStorage key is 'sparter-sidebar-collapsed' (D-05)"
  - "SSR default is false (expanded) — localStorage read only in useEffect to prevent hydration mismatch (D-14)"
  - "Tooltip imports from radix-ui barrel, not @radix-ui/react-tooltip directly — no new dependency"
  - "TooltipContent wraps in Portal with sideOffset=4 default and data-slot='tooltip-content'"
metrics:
  duration: "1m 32s"
  completed: "2026-06-07T09:27:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 41 Plan 01: Collapsible Sidebar — Foundation Summary

**One-liner:** React Context provider with SSR-safe localStorage persistence (key `sparter-sidebar-collapsed`) plus a shadcn-style Tooltip wrapper over the radix-ui barrel, shipped as zero-visual building blocks for Plan 02.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create SidebarProvider + useSidebarCollapsed hook | 9780f90 | components/layout/sidebar-provider.tsx |
| 2 | Create shadcn-style Tooltip wrapper | c98cadb | components/ui/tooltip.tsx |

## What Was Built

### `components/layout/sidebar-provider.tsx`

Client Component providing `SidebarContext` to the app-shell subtree:

- `SidebarContextValue = { collapsed: boolean; setCollapsed: (v: boolean) => void }` (D-13 exact shape)
- `STORAGE_KEY = 'sparter-sidebar-collapsed'` (D-05)
- `useState(false)` as initializer — SSR renders expanded, no hydration mismatch (D-14, Pitfall 1 from research)
- `useEffect` reads localStorage after mount and applies stored value
- `handleSetCollapsed` syncs React state + localStorage on user interaction
- `useSidebarCollapsed()` throws `'useSidebarCollapsed must be used within SidebarProvider'` when called outside provider

### `components/ui/tooltip.tsx`

shadcn-style Tooltip wrapper following the same pattern as `components/ui/dropdown-menu.tsx`:

- Imports from `"radix-ui"` barrel (`Tooltip as TooltipPrimitive`) — no new package
- Exports: `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`
- `TooltipContent` renders `TooltipPrimitive.Content` inside `TooltipPrimitive.Portal`
- Base classes: `z-50 overflow-hidden rounded-md bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md`
- `data-slot="tooltip-content"`, `sideOffset=4` default

## Verification

- `yarn tsc --noEmit` — no errors in either file
- `git diff --quiet package.json` — no new dependency added
- All source-level acceptance criteria verified (grep checks on key strings)

## Deviations from Plan

None — plan executed exactly as written.

The plan action for Task 1 mentioned `if (mounted) localStorage.setItem(...)` in the `handleSetCollapsed` wrapper; the implementation writes unconditionally to localStorage (which is always available at interaction time, post-mount). This is functionally equivalent because `handleSetCollapsed` can only be called from user interaction, which happens post-mount. The simpler implementation is correct.

## Known Stubs

None — both files are pure building blocks with no UI rendering. No stubs introduced.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes. The only trust boundary is browser localStorage (T-41-01, accepted — UI boolean only).

## Self-Check: PASSED

- `components/layout/sidebar-provider.tsx` exists: FOUND
- `components/ui/tooltip.tsx` exists: FOUND
- Commit 9780f90 exists: FOUND (git log)
- Commit c98cadb exists: FOUND (git log)
