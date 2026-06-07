# Collapsible sidebar replaces topbar

The app shell moves from a two-zone layout (left sidebar + top topbar) to a single-zone layout where the sidebar owns all chrome: app name, navigation, user controls, and the collapse toggle. The topbar is removed entirely on all breakpoints.

## Decision

- **Topbar removed** on desktop and mobile. All controls it held (app name, theme toggle, user avatar/dropdown) migrate into the sidebar or `/settings`.
- **Sidebar is collapsible** between an expanded state (`w-60`, icon + label) and an icon rail (`w-16`, icon only). Collapsed state is persisted in `localStorage`.
- **Toggle** is a chevron button fixed at the top of the sidebar. In expanded mode it sits beside the "Sparter" wordmark; in collapsed mode it is the only element in that slot.
- **User controls** (avatar, name/email, profile link, logout) anchor to the **bottom** of the sidebar, consistent with the existing Impostazioni placement.
- **Theme toggle** moves from the topbar into the `/settings` page.
- **Mobile**: the topbar is also removed. The BottomNav gains an "Impostazioni" entry pointing to `/settings` so profile and theme controls remain reachable without a sidebar.

## Alternatives rejected

**Keep topbar on mobile, remove only on desktop.** Rejected: the topbar on mobile only held the "Sparter" wordmark and user avatar. The wordmark adds no value on mobile; the avatar can be reached via the Settings route in BottomNav. A topbar on mobile wastes 56 px of vertical space.

**Drawer (fully hidden) instead of icon rail.** Rejected: the icon rail keeps navigation landmarks visible in peripheral vision without a dedicated open gesture. The drawer model requires an explicit hamburger trigger, breaking keyboard and mouse navigation habits.

**Session-only collapse state (no persistence).** Rejected: a sidebar that resets to expanded on every reload forces repeated interactions for users who prefer the compact view.
