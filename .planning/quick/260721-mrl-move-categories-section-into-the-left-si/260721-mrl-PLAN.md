---
phase: quick-260721-mrl
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/layout/sidebar.tsx
  - components/settings/settings-hub.tsx
  - tests/settings-hub.test.tsx
autonomous: true
requirements: [MRL-01]

must_haves:
  truths:
    - "Categorie is reachable directly from the primary left sidebar nav, without going through Impostazioni first."
    - "The categories taxonomy page still lives at /settings/categories (no route move, no redirects needed)."
    - "Impostazioni hub no longer shows a duplicate Categorie card once it is promoted to primary nav."
  artifacts:
    - components/layout/sidebar.tsx (topNavItems gains Categorie entry)
    - components/settings/settings-hub.tsx (HUB_ITEMS drops the Categorie entry)
  key_links:
    - "Sidebar Categorie link -> APP_ROUTES.categorySettings -> existing app/(app)/settings/categories/page.tsx (unchanged)"
---

<objective>
Promote "Categorie" (taxonomy management, `/settings/categories`) from the Impostazioni hub into the primary left sidebar navigation, so it is reachable in one click alongside Dashboard/Transazioni/Spese/Importazioni, per the user's request "spostiamo la sezione categorie e facciamo in modo che si possa raggiungere dal menù a sinistra".

Purpose: Categories/taxonomy management is used often enough that burying it two clicks deep (Impostazioni -> Categorie) is friction; the user wants it one click away from the main nav.
Output: `components/layout/sidebar.tsx` gains a "Categorie" primary nav item; `components/settings/settings-hub.tsx` drops the now-redundant Categorie card (Profilo + Aspetto remain); `tests/settings-hub.test.tsx` updated to match.
</objective>

<execution_context>
@$HOME/.cursor/gsd-core/workflows/execute-plan.md
@$HOME/.cursor/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@lib/routes.ts
@components/layout/sidebar.tsx
@components/settings/settings-hub.tsx
@tests/settings-hub.test.tsx

**Decision (locked for this task):** Keep the route at `APP_ROUTES.categorySettings` ('/settings/categories') — no route move, no redirects. Only the nav entry point changes. Do NOT touch `components/layout/bottom-nav.tsx` (already at 4 items on mobile; deferred per planning context note 5). Do NOT touch `app/(app)/settings/categories/page.tsx` or `components/categories/*` — the destination page is unchanged.

**Removing the hub card, not just adding a sidebar link:** "Spostiamo" (let's move it) implies relocating the entry point, not duplicating it. Leaving a second "Categorie" card in the Impostazioni hub while also adding it to the primary sidebar creates two visually distinct paths to the same page with no clear reason for either — pick removal (simplest option matching "move") over keeping both.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Categorie to the primary sidebar nav</name>
  <files>components/layout/sidebar.tsx</files>
  <action>
    In `components/layout/sidebar.tsx`, add a `FolderTree` icon import from `lucide-react` (alongside the existing `Settings`, `LayoutDashboard`, etc. imports). Add a new entry `{ href: APP_ROUTES.categorySettings, label: 'Categorie', icon: FolderTree }` to the `topNavItems` array, placed after the Importazioni entry (so the primary order becomes Dashboard, Transazioni, Spese, Importazioni, Categorie).

    Also fix the Impostazioni link active-state (currently `pathname === APP_ROUTES.settings || pathname.startsWith(\`${APP_ROUTES.settings}/\`)`) so it does **not** light up when the user is on `APP_ROUTES.categorySettings` — otherwise both Categorie and Impostazioni would highlight on `/settings/categories`. Use: active when `pathname === APP_ROUTES.settings` OR pathname is under settings but not under `categorySettings` (keep `/settings/profile` and the hub itself as Impostazioni-active). Do not alter the `<li>`/`<Tooltip>` rendering pattern.
  </action>
  <verify>
    <automated>yarn check:language && grep -n "FolderTree" components/layout/sidebar.tsx | grep -v '^#'</automated>
  </verify>
  <done>topNavItems includes a Categorie entry pointing at APP_ROUTES.categorySettings with the FolderTree icon; sidebar renders it as a normal top-level item with active-state highlighting on /settings/categories.</done>
</task>

<task type="auto">
  <name>Task 2: Remove the redundant Categorie card from the Impostazioni hub, update its test</name>
  <files>components/settings/settings-hub.tsx, tests/settings-hub.test.tsx</files>
  <action>
    In `components/settings/settings-hub.tsx`, remove the Categorie entry from the `HUB_ITEMS` array (keep only the Profilo entry). Remove the now-unused `FolderTree` import from `lucide-react` (keep `ChevronRight`, `UserCog`). The `HubItem['icon']` type annotation currently reads `typeof FolderTree` — change it to `typeof UserCog` since FolderTree is no longer referenced. Leave the "Aspetto" section (ThemeToggle) untouched.

    In `tests/settings-hub.test.tsx`, update the test named "renders navigation links to Profilo and Categorie settings" (line ~70) to assert only `/settings/profile` is present and rename it to reflect the new scope (e.g. "renders a navigation link to Profilo settings"); drop the `/settings/categories` assertion. Remove the now-unused `categorySettings` key from the `vi.mock('@/lib/routes', ...)` mock and the `FolderTree` icon from the `vi.mock('lucide-react', ...)` mock in that same file, since neither is imported by the component anymore.
  </action>
  <verify>
    <automated>yarn vitest run tests/settings-hub.test.tsx</automated>
  </verify>
  <done>HUB_ITEMS contains only the Profilo card; settings-hub.tsx has no FolderTree import; tests/settings-hub.test.tsx passes and no longer asserts a /settings/categories link inside the hub.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|--------------|
| None new | Pure client-side nav/UI reshuffle; no new data flow, no new trust boundary crossed. `verifySession()` on the destination page (`app/(app)/settings/categories/page.tsx`) is unchanged. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-260721mrl-01 | Information Disclosure | components/layout/sidebar.tsx | low | accept | The new nav item only links to an already-authenticated, already-existing route (`/settings/categories`); no new access path is created, no new data is exposed — the page's own `verifySession()` gate is unchanged. |
</threat_model>

<verification>
1. `yarn vitest run tests/settings-hub.test.tsx` passes.
2. `yarn check:language` passes (no new Italian leaking into dev-facing identifiers/comments; "Categorie" label is intentional product-surface Italian, consistent with existing sidebar labels).
3. Manual: open the app shell, confirm "Categorie" appears in the primary left sidebar between Importazioni and the Impostazioni separator, with FolderTree icon, and highlights active state on `/settings/categories`. Confirm the Impostazioni hub page now shows only the Profilo card (plus Aspetto section).
</verification>

<success_criteria>
- Sidebar primary nav has a working "Categorie" entry linking to `/settings/categories`.
- No route, redirect, or destination-page changes — `/settings/categories` behaves exactly as before.
- Impostazioni hub no longer duplicates the Categorie entry point.
- `components/layout/bottom-nav.tsx` is untouched (mobile nav unchanged, per locked interpretation).
- All touched tests pass; `yarn check:language` clean.
</success_criteria>

<output>
Create `.planning/quick/260721-mrl-move-categories-section-into-the-left-si/260721-mrl-SUMMARY.md` when done
</output>
