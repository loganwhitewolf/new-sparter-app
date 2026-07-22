# Quick Task 260722-iys: Nav Tags/Profilo/tema + /patterns - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

<domain>
## Task Boundary

Restructure app navigation and settings surfaces:

1. Promote **Tag** to primary left sidebar; public route becomes `/tags` (not `/settings/tags`).
2. Extract **Pattern** management out of the Categories page into a standalone `/patterns` route + sidebar entry.
3. **Profilo** remains reachable from the avatar dropdown only (remove hub card duplicate).
4. Move **Tema** (light/dark) from Impostazioni hub into the Profile page.
5. Desktop: remove the Impostazioni sidebar link once the hub is emptied.
6. Mobile bottom nav: keep Dashboard / Spese / Transazioni / Importazioni; replace Impostazioni with an **Altro** overflow that opens a bottom sheet listing sections not in the footer (Categorie, Tag, Pattern, Profilo).

</domain>

<decisions>
## Implementation Decisions

### Hub Impostazioni (`/settings`)
- Empty after moves → redirect `/settings` to Profilo (`APP_ROUTES.profileSettings`).
- Remove Impostazioni link from desktop sidebar.
- Keep `/settings/profile` and `/settings/categories` routes as-is for now (Categories URL not moved in this task).

### Tags route
- Canonical public route: `/tags`.
- Update `APP_ROUTES.tagSettings` (or rename to `tags` if cleaner — planner discretion, prefer clear naming) to `/tags`.
- Add redirect from legacy `/settings/tags` → `/tags` (via `lib/routes.ts` / `next.config.ts` pattern already used for legacy redirects).
- Move page from `app/(app)/settings/tags/` to `app/(app)/tags/` (or thin redirect page — prefer real move).

### Patterns route (NEW)
- Canonical public route: `/patterns`.
- Add `APP_ROUTES.patterns = '/patterns'`.
- New page under `app/(app)/patterns/` that hosts the pattern panel currently on Categories (`CategoryPatternPanel` / patterns UI).
- Categories page (`/settings/categories`) keeps taxonomy only — remove pattern panel + related data fetch (`getUserPatterns`) and copy that mentions patterns on the same page.
- Sidebar: add **Pattern** (Italian product label — planner: pick clear label e.g. "Pattern") after Tag / near Categorie.
- Mobile Altro sheet includes Pattern.

### Profilo
- Already in avatar dropdown — keep.
- Remove Profilo card from settings hub.
- Theme (Aspetto / ThemeToggle) moves into profile page UI.

### Theme
- Remove Aspetto block from settings hub.
- Add equivalent Aspetto section on profile page (reuse `ThemeToggle`).

### Mobile overflow ("toast menù")
- Not a toast — **bottom sheet** (vaul / existing sheet patterns in the project).
- 5th bottom-nav item: **Altro** (`MoreHorizontal`), opens sheet with links: Categorie, Tag, Pattern, Profilo.
- No avatar in mobile footer (locked).
- Active state for Altro when pathname matches any of those destinations.

### Desktop sidebar primary order (locked intent)
Dashboard → Transazioni → Spese → Importazioni → Categorie → Tag → Pattern  
(no Impostazioni item)

### Claude's Discretion
- Exact Italian labels for sidebar/sheet ("Tag", "Pattern" vs "Patterns").
- Icon choices (Tags, regex/Braces/Wand for patterns).
- Whether to delete settings hub component entirely vs keep as redirect-only page.
- Test updates for settings-hub / sidebar / bottom-nav / routes / language check.
- Active-state exclusions for `/settings/*` remnants (categories still under settings).

</decisions>

<specifics>
## Specific Ideas

- User confirmed discuss defaults except: tags route = `/tags`; add `/patterns` and remove patterns from categories.
- Stay on branch `quick`.

</specifics>

<canonical_refs>
## Canonical References

- `lib/routes.ts` — APP_ROUTES + legacy redirects
- `components/layout/sidebar.tsx` — primary nav + avatar menu
- `components/layout/bottom-nav.tsx` — mobile footer
- `components/settings/settings-hub.tsx` — hub cards + theme
- `app/(app)/settings/categories/page.tsx` — categories + CategoryPatternPanel today
- `components/categories/category-pattern-panel.tsx`
- `app/(app)/settings/profile/page.tsx` — theme destination
- `app/(app)/settings/tags/` — current tags page
- Language convention: English public route slugs; Italian product UI copy

</canonical_refs>
