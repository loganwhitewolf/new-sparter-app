# Phase 41: collapsible-sidebar — Context

**Gathered:** 2026-06-07
**Status:** Ready for planning
**Source:** ADR Ingest + grill-with-docs session (2026-06-07)

<domain>
## Phase Boundary

Replace the two-zone app shell (Topbar + Sidebar) with a single-zone sidebar that owns all chrome:
app name/wordmark, navigation, user controls, and the collapse toggle.
The topbar is deleted on all breakpoints. The sidebar collapses to an icon rail on desktop.
On mobile, the BottomNav gains an "Impostazioni" entry so settings remain reachable.
The theme toggle migrates from the topbar to the `/settings` page (new "Aspetto" section in `SettingsHub`).

Scope:
- `components/layout/sidebar.tsx` — rewrite to collapsible icon rail with toggle, app name, user controls
- `components/layout/topbar.tsx` — delete
- `components/layout/bottom-nav.tsx` — add Impostazioni entry
- `app/(app)/layout.tsx` — remove Topbar, wire sidebar width from context
- `components/settings/settings-hub.tsx` — add Aspetto section with ThemeToggle
- `components/theme-toggle.tsx` — reuse as-is in settings hub

Out of scope: sidebar on mobile (BottomNav already handles mobile nav), new logo/icon asset,
per-route page title in the content area, drawer/overlay variant.

</domain>

<decisions>
## Implementation Decisions

### Topbar (ADR 0011 — LOCKED)
- D-01: **Topbar deleted on all breakpoints.** `components/layout/topbar.tsx` is removed and its import in `app/(app)/layout.tsx` is dropped.
- D-02: Everything the topbar held (app name, ThemeToggle, user avatar/dropdown) migrates to the sidebar or `/settings`.

### Sidebar collapse (ADR 0011 — LOCKED)
- D-03: **Icon rail only.** Two widths: `w-60` (expanded) and `w-16` (collapsed). The sidebar is always visible on desktop; there is no fully-hidden / overlay variant.
- D-04: **Toggle button at the top.** In expanded mode the toggle sits beside the "Sparter" wordmark. In collapsed mode the toggle is the only element in that slot (acts as logo placeholder).
- D-05: **Collapse state persisted in `localStorage`** under a stable key (e.g. `sparter-sidebar-collapsed`). Restores on next page load; defaults to expanded on first visit.
- D-06: The toggle uses `ChevronLeft` (expanded → collapse) / `ChevronRight` (collapsed → expand) Lucide icons.

### User controls (ADR 0011 — LOCKED)
- D-07: **User avatar + dropdown anchored at the bottom of the sidebar.** Dropdown contains: user name/email label, link to `/settings/profile`, Logout action. Mirrors the existing Topbar dropdown items exactly.
- D-08: In collapsed mode the avatar button shows only the avatar circle (no name/email text). In expanded mode it shows avatar + name + email.

### Mobile (ADR 0011 — LOCKED)
- D-09: **Topbar removed on mobile too.** There is no mobile topbar after this phase.
- D-10: **BottomNav gains "Impostazioni" entry** pointing to `APP_ROUTES.settings`. Icon: `Settings` (Lucide). Positioned as the rightmost (5th) item.

### Theme toggle (ADR 0011 — LOCKED)
- D-11: **ThemeToggle moves to `/settings` page.** It is removed from the topbar (which is deleted) and added as an "Aspetto" card/section in `SettingsHub` (`components/settings/settings-hub.tsx`).
- D-12: The existing `ThemeToggle` component (`components/theme-toggle.tsx`) is reused as-is — no changes to the component itself.

### State management
- D-13: Sidebar collapsed state lives in a React context (`SidebarContext`) provided at the app-shell level so the layout (`aside` width) and the sidebar content both read the same value.
- D-14: `useSidebarCollapsed()` hook reads/writes `localStorage` and syncs to the context.

### Claude's Discretion
- Exact Tailwind transition class for the width animation (e.g. `transition-[width] duration-200`)
- Whether to wrap the sidebar content in `SidebarProvider` at `app/(app)/layout.tsx` level or inline in the `<aside>` subtree
- Tooltip on icon-only nav items in collapsed mode (recommended: shadcn `Tooltip` on each nav item showing the label)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### ADR
- `docs/adr/0011-collapsible-sidebar-no-topbar.md` — Locked decisions for this phase (topbar removal, icon rail, localStorage, user controls at bottom, mobile BottomNav)

### Layout
- `app/(app)/layout.tsx` — App shell to be refactored (Topbar import to drop, sidebar width to wire from context)
- `components/layout/sidebar.tsx` — Current sidebar (to be rewritten)
- `components/layout/topbar.tsx` — Current topbar (to be deleted)
- `components/layout/bottom-nav.tsx` — Current BottomNav (gains Impostazioni entry)

### Settings
- `components/settings/settings-hub.tsx` — SettingsHub (gains Aspetto section with ThemeToggle)
- `components/theme-toggle.tsx` — Existing ThemeToggle component (reused as-is)
- `app/(app)/settings/page.tsx` — Settings page (renders SettingsHub)

### Auth / user controls
- `lib/auth-client.ts` (or `lib/actions/auth.ts`) — `signOutAction` used in the existing Topbar dropdown; must be wired in the new sidebar user controls
- `lib/routes.ts` — `APP_ROUTES.settings`, `APP_ROUTES.profileSettings` for nav links

</canonical_refs>

<specifics>
## Specific Ideas

- Collapsed sidebar tooltip: shadcn `Tooltip` wrapping each nav `Link` in icon-only mode, showing the label on hover. Prevents "mystery icon" UX.
- The `data-sidebar` attribute already exists on the `<aside>` in the layout — keep it for E2E selectors.
- The toggle button should be `aria-label="Comprimi barra laterale"` / `"Espandi barra laterale"` based on state.
- User dropdown in the sidebar: use `DropdownMenu` (already imported in topbar) anchored to the avatar trigger. In collapsed mode, the trigger is only the avatar circle.
- `SidebarContext` can be a simple `{ collapsed: boolean; setCollapsed: (v: boolean) => void }`.

</specifics>

<deferred>
## Deferred Ideas

- Logo/icon asset for Sparter (would replace the text "Sparter" in expanded mode and a logo circle in collapsed mode) — deferred until brand assets exist.
- Sidebar on mobile as a slide-in drawer — BottomNav covers mobile nav needs.
- Per-route page title inside the content area — out of scope for this phase.

</deferred>

---

*Phase: 41-collapsible-sidebar*
*Context gathered: 2026-06-07 via grill-with-docs + ADR 0011*
