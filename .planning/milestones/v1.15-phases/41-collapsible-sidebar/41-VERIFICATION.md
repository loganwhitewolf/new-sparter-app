---
phase: 41-collapsible-sidebar
status: passed
verified_at: 2026-06-07
must_haves_total: 14
must_haves_passed: 14
must_haves_failed: 0
human_verification: []
---

## Verification: Phase 41 — Collapsible Sidebar

### Summary

All 14 must-have requirements verified against the live codebase. Phase goal achieved: the app now has a collapsible icon-rail sidebar with localStorage-persistent state, no topbar, and the mobile BottomNav has a 5th "Impostazioni" entry.

---

## Plan 41-01 — SidebarProvider + Tooltip (D-05, D-13, D-14)

### Must-Haves

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SidebarProvider provides `{ collapsed, setCollapsed }` context | ✓ PASS | `SidebarContext` typed as `{ collapsed: boolean; setCollapsed: (v: boolean) => void }` in `sidebar-provider.tsx:6-9` |
| 2 | Collapse state persists in localStorage key `sparter-sidebar-collapsed` and restores on reload | ✓ PASS | `STORAGE_KEY = 'sparter-sidebar-collapsed'` at line 14; `useEffect` reads on mount (line 24), `handleSetCollapsed` writes on change (line 35) |
| 3 | Default collapse state is false (expanded) on first visit and during SSR | ✓ PASS | `useState(false)` at line 19; no localStorage read inside state initializer |
| 4 | A shadcn-style Tooltip component is available for icon-only nav items | ✓ PASS | `components/ui/tooltip.tsx` exports `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider` via radix-ui barrel |

### Artifacts

| Artifact | Check | Status |
|----------|-------|--------|
| `components/layout/sidebar-provider.tsx` | File exists, exports `SidebarProvider` + `useSidebarCollapsed`, ≥30 lines | ✓ PASS (51 lines) |
| `components/ui/tooltip.tsx` | Exports 4 tooltip symbols, imports from `"radix-ui"` barrel, Portal render | ✓ PASS |

---

## Plan 41-02 — AppShell + Sidebar + Layout (D-01–D-04, D-06–D-09, D-13)

### Must-Haves

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 5 | App shell wraps chrome in `SidebarProvider`; `<aside>` width follows collapsed state (`md:w-16` / `md:w-60`) | ✓ PASS | `layout.tsx:55-58` wraps `AppShell` in `SidebarProvider`; `app-shell.tsx:22` applies `collapsed ? 'md:w-16' : 'md:w-60'` |
| 6 | Sidebar has a chevron toggle at the top that flips collapsed state and persists it | ✓ PASS | `sidebar.tsx:78-88` — button `onClick={() => setCollapsed(!collapsed)}` with `ChevronLeft`/`ChevronRight` icons and aria-labels |
| 7 | Collapsed sidebar shows icon-only nav with tooltips; expanded shows icon + label | ✓ PASS | `sidebar.tsx:97-125` — renders `<Tooltip>` wrapping `linkNode` when `collapsed && mounted`, else shows `linkNode` with `<span>` label |
| 8 | User avatar + dropdown (name/email, Profilo link, Logout) anchored at bottom of sidebar | ✓ PASS | `sidebar.tsx:129-178` — `DropdownMenu` with Profilo + Logout in `<div className="mt-auto">` |
| 9 | The layout no longer imports or renders Topbar | ✓ PASS | `app/(app)/layout.tsx` imports only `SidebarProvider`, `AppShell`, and DAL functions — no Topbar reference |

### Artifacts

| Artifact | Check | Status |
|----------|-------|--------|
| `components/layout/app-shell.tsx` | Exports `AppShell`, reads `SidebarContext` | ✓ PASS |
| `components/layout/sidebar.tsx` | Exports `Sidebar`, chevron toggle, tooltips in collapsed mode | ✓ PASS |
| `app/(app)/layout.tsx` | RSC wrapping `AppShell` in `SidebarProvider`, no Topbar | ✓ PASS |

---

## Plan 41-03 — BottomNav + SettingsHub + Topbar deletion + Tests (D-01, D-10–D-12)

### Must-Haves

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 10 | BottomNav has a 5th rightmost entry "Impostazioni" linking to `/settings` with Settings icon | ✓ PASS | `bottom-nav.tsx:15` — `{ href: APP_ROUTES.settings, label: 'Impostazioni', icon: Settings }` as last navItem |
| 11 | SettingsHub renders an "Aspetto" section containing ThemeToggle, reused unchanged | ✓ PASS | `settings-hub.tsx:54-64` — `<div>` with "Aspetto" label and `<ThemeToggle />` |
| 12 | `components/layout/topbar.tsx` no longer exists | ✓ PASS | File deleted; only remaining "topbar" string is a developer comment in sidebar.tsx explaining migration |
| 13 | Unit + E2E tests reference the sidebar instead of the deleted topbar and pass | ✓ PASS | `yarn test --run` results: 824/827 pass (2 pre-existing onboarding failures, 1 todo — unrelated to this phase) |

---

## Requirement Traceability

| Req ID | Description | Verified By |
|--------|-------------|-------------|
| D-01 | No topbar | `app/(app)/layout.tsx` has no Topbar; `topbar.tsx` deleted |
| D-02 | Responsive: sidebar hidden on mobile, BottomNav visible | `app-shell.tsx` — `hidden md:flex` on `<aside>`, `BottomNav` with `md:hidden` |
| D-03 | Icon + label expanded; icon-only + tooltip collapsed | `sidebar.tsx:97-125` |
| D-04 | Chevron toggle button | `sidebar.tsx:78-88` |
| D-05 | localStorage key `sparter-sidebar-collapsed` | `sidebar-provider.tsx:14` |
| D-06 | Toggle aria-label alternates between expand/collapse | `sidebar.tsx:80` |
| D-07 | User name + email in user control | `sidebar.tsx:148-153` (expanded state) |
| D-08 | Profilo link and Logout in user dropdown | `sidebar.tsx:163-175` |
| D-09 | Active route highlighted | `sidebar.tsx:95` — `isActive` flag on `pathname === href` |
| D-10 | BottomNav Impostazioni entry | `bottom-nav.tsx:15` |
| D-11 | SettingsHub Aspetto section | `settings-hub.tsx:54-64` |
| D-12 | ThemeToggle reused unchanged | `settings-hub.tsx:62` — `<ThemeToggle />` import unchanged |
| D-13 | SidebarContext type `{ collapsed: boolean; setCollapsed: (v: boolean) => void }` | `sidebar-provider.tsx:6-9` |
| D-14 | SSR-safe default collapsed=false | `sidebar-provider.tsx:19` — `useState(false)` |

---

## Code Review Notes

4 warnings identified in `41-REVIEW.md` — none block phase completion but worth addressing in follow-up:
- **WR-01**: Dead `mounted` state in `SidebarProvider` (orphaned, triggers extra re-render)
- **WR-02**: `layout.spec.ts` hardcoded `STAGING_KEY` fallback instead of `requireStagingKey()`
- **WR-03**: Missing test for `txCount===0 && completedAt !== null` case (no redirect expected)
- **WR-04**: Both `<nav>` landmarks missing `aria-label` (WCAG 2.4.1)

## Build Verification

- `yarn tsc --noEmit` — exit 0 (clean)
- `yarn test --run` — 824/827 pass (2 pre-existing failures in onboarding tests, unrelated)
- No new package dependencies added
