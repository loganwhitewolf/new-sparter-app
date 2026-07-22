---
phase: quick-260722-iys
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/routes.ts
  - lib/actions/tags.ts
  - lib/actions/revalidation.ts
  - app/(app)/layout.tsx
  - app/(app)/tags/page.tsx
  - app/(app)/settings/tags/page.tsx
  - app/(app)/patterns/page.tsx
  - components/dashboard/tag-ranking-list.tsx
  - tests/tag-actions.test.ts
  - tests/tag-ranking-list.test.tsx
  - tests/app-layout-guard.test.ts
  - tests/categorization-revalidation-actions.test.ts
  - app/(app)/settings/categories/page.tsx
  - app/(app)/settings/page.tsx
  - app/(app)/settings/profile/page.tsx
  - components/settings/settings-hub.tsx
  - tests/settings-hub.test.tsx
  - tests/category-settings-ui.test.tsx
  - tests/categories-settings.spec.ts
  - tests/patterns-page.test.tsx
  - components/layout/sidebar.tsx
  - components/layout/bottom-nav.tsx
  - components/layout/mobile-more-sheet.tsx
  - tests/bottom-nav.test.tsx
  - tests/mobile-more-sheet.test.tsx
autonomous: true
requirements: [IYS-01]

must_haves:
  truths:
    - "Tag is reachable in one click from the primary left sidebar at the canonical route /tags, no longer nested under Impostazioni."
    - "Pattern management lives at its own /patterns route reachable from the sidebar; the Categories page (/settings/categories) shows taxonomy only, no pattern panel."
    - "Profilo is reachable only via the avatar dropdown menu; there is no duplicate Profilo card anywhere."
    - "Theme (light/dark) toggle lives on the Profile page; visiting /settings redirects there since the hub has nothing left to show."
    - "Legacy /settings/tags redirects to /tags; the desktop sidebar has no Impostazioni link and its primary order is Dashboard, Transazioni, Spese, Importazioni, Categorie, Tag, Pattern."
    - "Mobile bottom nav keeps exactly 4 primary items (Dashboard, Spese, Transazioni, Importazioni) plus a 5th Altro item that opens a bottom sheet listing Categorie, Tag, Pattern, Profilo."
    - "A brand-new user with zero transactions can still open /tags and /patterns without being bounced to /onboarding (parity with the legacy /settings/* exemption)."
  artifacts:
    - lib/routes.ts (APP_ROUTES.tags replaces tagSettings; APP_ROUTES.patterns added)
    - app/(app)/tags/page.tsx (real Tags page content, moved from app/(app)/settings/tags/)
    - app/(app)/patterns/page.tsx (new — hosts CategoryPatternPanel + getUserPatterns)
    - app/(app)/settings/page.tsx and app/(app)/settings/tags/page.tsx (both thin redirect pages)
    - components/layout/sidebar.tsx (Tag + Pattern nav items, no Impostazioni link)
    - components/layout/bottom-nav.tsx + components/layout/mobile-more-sheet.tsx (Altro bottom sheet)
  key_links:
    - "Sidebar Tag link -> APP_ROUTES.tags -> app/(app)/tags/page.tsx -> getTags/TagSettingsPanel (unchanged component)"
    - "Sidebar Pattern link -> APP_ROUTES.patterns -> app/(app)/patterns/page.tsx -> CategoryPatternPanel (relocated, unchanged component)"
    - "createPatternAction/updatePatternAction/deletePatternAction -> revalidateCategorizationSurfaces() -> revalidatePath(APP_ROUTES.patterns) so the new page is never stale after a mutation"
    - "BottomNav 'Altro' trigger -> MobileMoreSheet -> Links to categorySettings/tags/patterns/profileSettings"
    - "app/(app)/layout.tsx isExempt check -> APP_ROUTES.tags / APP_ROUTES.patterns, so the onboarding redirect guard does not trap zero-transaction users on the newly-promoted routes"
---

<objective>
Restructure the app's navigation IA per the user's request: promote Tag to the primary left sidebar at its own canonical route `/tags`; extract pattern management out of the Categories page into a new standalone `/patterns` route + sidebar entry; keep Profilo reachable only from the avatar dropdown (drop the hub's duplicate card); move the theme toggle from the Impostazioni hub into the Profile page; remove the now-empty Impostazioni sidebar link entirely; and replace the mobile bottom nav's Impostazioni item with an "Altro" bottom-sheet overflow listing the sections that no longer fit in the 4-item footer (Categorie, Tag, Pattern, Profilo).

Purpose: Tag and Pattern are used often enough that burying them two clicks deep behind a hub that also duplicated Profilo/theme was pure friction; this collapses the settings hub to nothing and promotes its useful content to first-class primary nav.

Output: `/tags` (canonical, real page moved from `/settings/tags`, which becomes a redirect), a brand-new `/patterns` page, a trimmed `/settings/categories` (taxonomy only), an emptied `/settings` hub (now a redirect to Profilo), a Profile page with its own Aspetto/theme section, a reordered sidebar (Dashboard → Transazioni → Spese → Importazioni → Categorie → Tag → Pattern, no Impostazioni), and a mobile bottom nav with a working Altro bottom sheet.
</objective>

<execution_context>
@$HOME/.cursor/gsd-core/workflows/execute-plan.md
@$HOME/.cursor/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260722-iys-move-tags-to-left-sidebar-profile-into-a/260722-iys-CONTEXT.md
@lib/routes.ts
@components/layout/sidebar.tsx
@components/layout/bottom-nav.tsx
@components/settings/settings-hub.tsx
@app/(app)/settings/categories/page.tsx
@app/(app)/settings/tags/page.tsx
@app/(app)/settings/profile/page.tsx
@app/(app)/profile/page.tsx
@components/categories/category-pattern-panel.tsx
@components/ui/sheet.tsx
@components/theme-toggle.tsx

**Decisions locked in CONTEXT.md (do not revisit):** Tags canonical route is `/tags` with a redirect from `/settings/tags`; a new `/patterns` route replaces the pattern panel on the Categories page; the Impostazioni hub is emptied and `/settings` redirects to Profilo; the sidebar drops the Impostazioni link entirely; desktop sidebar order is Dashboard, Transazioni, Spese, Importazioni, Categorie, Tag, Pattern; mobile keeps 4 primary items + an Altro **bottom sheet** (not a toast) with Categorie/Tag/Pattern/Profilo; no avatar in the mobile footer; stay on branch `quick`.

**Redirect pattern precedent (reuse exactly):** `app/(app)/profile/page.tsx` is a one-line `redirect(APP_ROUTES.profileSettings)` Server Component with `export const metadata = { robots: 'noindex, nofollow' }`. Use this exact shape for both new redirect pages.

**Icon choices (Claude's discretion, resolved):** `Tags` for the Tag nav item (already used elsewhere in this codebase for tags), `Regex` for Pattern (both are confirmed real named exports of the installed `lucide-react` package — verified against `node_modules/lucide-react`). `MoreHorizontal` for the mobile Altro item (locked in CONTEXT.md).

**Onboarding-guard reachability gap (not explicitly in CONTEXT.md, found during planning):** `app/(app)/layout.tsx` redirects zero-transaction users to `/onboarding` unless the pathname starts with `APP_ROUTES.onboarding`, `APP_ROUTES.settings`, or `APP_ROUTES.import`. Because Tag and Pattern move OUT of `/settings/*` onto their own top-level routes, they would silently lose that exemption and trap brand-new users. Extend the exemption to `APP_ROUTES.tags` and `APP_ROUTES.patterns` in the same task that introduces those routes — this is a correctness fix required to preserve existing reachability, not a scope addition.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Canonical /tags + /patterns routes, legacy redirect, and onboarding-guard parity</name>
  <files>lib/routes.ts, lib/actions/tags.ts, lib/actions/revalidation.ts, app/(app)/layout.tsx, app/(app)/tags/page.tsx, app/(app)/settings/tags/page.tsx, app/(app)/patterns/page.tsx, components/dashboard/tag-ranking-list.tsx, tests/tag-actions.test.ts, tests/tag-ranking-list.test.tsx, tests/app-layout-guard.test.ts, tests/categorization-revalidation-actions.test.ts</files>
  <action>
    In `lib/routes.ts`: rename the `tagSettings: '/settings/tags'` entry to `tags: '/tags'` (per D-01 discretion note — clearer naming, no other key on `APP_ROUTES` uses the `*Settings` suffix pattern for a route that no longer lives under `/settings`). Add a new entry `patterns: '/patterns'` directly after it. Leave `categorySettings`, `dashboardTags`, `profile`, `profileSettings` untouched.

    In `lib/actions/tags.ts`: update all three `revalidatePath(APP_ROUTES.tagSettings)` call sites (in `createTagAction`, `updateTagAction`, `archiveTagAction`) to `revalidatePath(APP_ROUTES.tags)`. Leave the paired `revalidatePath(APP_ROUTES.dashboardTags)` calls untouched.

    In `lib/actions/revalidation.ts`: add `revalidatePath(APP_ROUTES.patterns)` to `revalidateCategorizationSurfaces()`, alongside the existing `revalidatePath(APP_ROUTES.categorySettings)` line (keep that line too — category CRUD actions still call this same helper and still need `/settings/categories` revalidated). Pattern CRUD (`createPatternAction`/`updatePatternAction`/`deletePatternAction`/`promoteSuggestionAction` in `lib/actions/patterns.ts`) already calls this shared helper, so no changes are needed there — the new `/patterns` revalidation is picked up automatically.

    In `app/(app)/layout.tsx`: extend the `isExempt` check (used to skip the zero-transaction → `/onboarding` redirect) to also match `pathname.startsWith(APP_ROUTES.tags)` and `pathname.startsWith(APP_ROUTES.patterns)`, alongside the existing `onboarding`/`settings`/`import` checks. This preserves the exemption Tag and Pattern had while living under `/settings/*`.

    Move the Tags page: create `app/(app)/tags/page.tsx` with the exact same content currently in `app/(app)/settings/tags/page.tsx` (the `verifySession` + `getTags` + `TagSettingsPanel` render, `metadata = { title: 'Tag' }`). Then replace the contents of `app/(app)/settings/tags/page.tsx` with a thin redirect Server Component mirroring `app/(app)/profile/page.tsx`'s exact shape: `export const metadata = { robots: 'noindex, nofollow' }` and a default export that calls `redirect(APP_ROUTES.tags)`.

    Create `app/(app)/patterns/page.tsx`: an async Server Component with `export const metadata = { title: 'Pattern' }`. Call `verifySession()` from `@/lib/dal/auth` to get `userId, subscriptionPlan`, compute `isPaid = subscriptionPlan === 'basic' || subscriptionPlan === 'pro'` (identical inline check to the one currently in the Categories page), fetch `categories` via `getCategories()` and `allPatterns` via `getUserPatterns(userId)` (both already used by the Categories page today — same imports, same `Promise.all`), then render a page heading ("Pattern") + intro paragraph, followed by `<CategoryPatternPanel categories={categories} patterns={allPatterns} isPaid={isPaid} />` with no prop overrides (let the component's own defaults — "Pattern personalizzati" heading/description/empty-state copy — apply, since this is now the pattern's dedicated home, not a shared section on someone else's page).

    Fix the one remaining hardcoded legacy link: in `components/dashboard/tag-ranking-list.tsx`, the empty-state `<Link href="/settings/tags">` with copy "Vai a Impostazioni &rarr; Tag" is now stale on two counts — the URL moved and Tag is no longer under Impostazioni. Change the href literal to `/tags` and reword the surrounding sentence to drop the "Impostazioni" reference, e.g. "Crea un tag per raggruppare le transazioni di un viaggio, evento o progetto. Vai alla sezione Tag." (keep it a single sentence + inline link, same structure as today, just no "Impostazioni &rarr;").

    Update tests to match: in `tests/tag-actions.test.ts`, change the four `'/settings/tags'` string literals asserted against `mocks.revalidatePath` (createTagAction, updateTagAction, archiveTagAction's two-call test, and the nth-call assertions) to `'/tags'`; leave every `'/dashboard/tags'` assertion untouched. In `tests/tag-ranking-list.test.tsx`, change the `expect(html).toContain('href="/settings/tags"')` assertion to `href="/tags"`. In `tests/app-layout-guard.test.ts`, add `tags: '/tags'` and `patterns: '/patterns'` to the `vi.mock('@/lib/routes', ...)` object, and add two new `it()` cases mirroring the existing "/settings" exemption case: one asserting no redirect when `txCount === 0` and pathname is `/tags`, one for `/patterns`. In `tests/categorization-revalidation-actions.test.ts`, add `'/patterns'` to the `EXPECTED_CATEGORY_REVALIDATION_ROUTES` array (keep `/settings/categories` in the list — it is still revalidated by the same shared helper).
  </action>
  <verify>
    <automated>yarn vitest run tests/tag-actions.test.ts tests/tag-ranking-list.test.tsx tests/app-layout-guard.test.ts tests/categorization-revalidation-actions.test.ts && yarn check:language</automated>
  </verify>
  <done>APP_ROUTES.tags = '/tags' and APP_ROUTES.patterns = '/patterns' exist; app/(app)/tags/page.tsx renders the real Tag settings UI; app/(app)/settings/tags/page.tsx is a redirect to /tags; app/(app)/patterns/page.tsx renders CategoryPatternPanel scoped to the user; zero-transaction users are not redirected to /onboarding from /tags or /patterns; all four listed test files pass; yarn check:language is clean.</done>
</task>

<task type="auto">
  <name>Task 2: Trim Categories page, empty the Impostazioni hub, add theme to Profile</name>
  <files>app/(app)/settings/categories/page.tsx, app/(app)/settings/page.tsx, app/(app)/settings/profile/page.tsx, components/settings/settings-hub.tsx, tests/settings-hub.test.tsx, tests/category-settings-ui.test.tsx, tests/categories-settings.spec.ts, tests/patterns-page.test.tsx</files>
  <action>
    In `app/(app)/settings/categories/page.tsx`: remove the `getUserPatterns` import (`@/lib/dal/patterns`) and the `CategoryPatternPanel` import/usage entirely — the page keeps only `verifySession`, `getCategories`, and `CategorySettingsPanel`. Drop `isPaid`/`subscriptionPlan` destructuring if no longer used by anything else on the page (it currently exists only to feed `CategoryPatternPanel`). Reword the intro paragraph, which currently says "Gestisci la tua tassonomia personale e assegna pattern di categorizzazione dalla stessa pagina" — since patterns no longer live here, change it to something like "Gestisci la tua tassonomia personale: categorie e sottocategorie di entrate e uscite."

    Delete `components/settings/settings-hub.tsx` and `tests/settings-hub.test.tsx` outright — Tag is being promoted to the primary sidebar (Task 3) and Profilo/theme move to the avatar menu and Profile page (this task), so `HUB_ITEMS` would be left empty and the component would render nothing useful; the hub is being emptied per the locked decision, so there is no reason to keep a dead component around versus deleting it plus its test.

    Replace the contents of `app/(app)/settings/page.tsx` with a thin redirect Server Component, same shape as `app/(app)/profile/page.tsx`: `export const metadata = { robots: 'noindex, nofollow' }`, default export calling `redirect(APP_ROUTES.profileSettings)`. Remove the now-unused `SettingsHub` import.

    In `app/(app)/settings/profile/page.tsx`: import `ThemeToggle` from `@/components/theme-toggle`. Add an "Aspetto" section reusing the exact block currently in `components/settings/settings-hub.tsx` (a `<p>` label "Aspetto" over a bordered row containing a "Tema" / "Chiaro o scuro" text pair and the `<ThemeToggle />` control), placed as its own section between the existing "Account" `Card` and `<ProfileForm profile={profile} />`.

    Trim `tests/category-settings-ui.test.tsx`: remove the `getUserPatterns` mock (`vi.mock('@/lib/dal/patterns', ...)`) and its `mocks.getUserPatterns` hoisted entry and `beforeEach` call; remove the `vi.mock('@/lib/actions/patterns', ...)` block and its three hoisted mocks (`createPatternAction`/`updatePatternAction`/`deletePatternAction`) since the page no longer imports anything from that module transitively through `CategoryPatternPanel`; drop the `patterns` fixture array; update the first `it()` (currently named "...and pattern panel") to drop the `'Pattern di categorizzazione'`, `'Nuovo pattern'`, `'Spese → Alimentari speciali'`, and `'Sottocategoria non trovata (#999)'` assertions and rename it to drop "and pattern panel" from its description.

    Create `tests/patterns-page.test.tsx` covering the new `/patterns` page, mirroring `tests/category-settings-ui.test.tsx`'s mocking strategy (mock `server-only`, `@/lib/dal/auth` (`verifySession`), `@/lib/dal/categories` (`getCategories`), `@/lib/dal/patterns` (`getUserPatterns`), `@/lib/actions/patterns` (`createPatternAction`/`updatePatternAction`/`deletePatternAction`)) and reusing the same `categories`/`patterns` fixture shapes. Import the page from `../app/(app)/patterns/page`. Assert: the page renders without throwing; renders the "Pattern" heading; renders "Nuovo pattern" and the pattern row content (destination label, confidence, description) when `subscriptionPlan: 'basic'`; renders the upgrade-plan message instead of the create button when `subscriptionPlan: 'free'`.

    Update the Playwright e2e spec `tests/categories-settings.spec.ts` to match the split: remove the `await expect(page.getByText('Pattern di categorizzazione', { exact: true })).toBeVisible()` assertion from the initial `/settings/categories` visit (patterns no longer render there); change `createPatternFromCategoriesPage`'s first step to `await page.goto('/patterns')` before opening the "Nuovo pattern" dialog (the dialog interaction itself is unchanged); rename the function to `createPatternFromPatternsPage` and update its one call site in the `test()` body. This spec is gated by `canRunCategorySettingsFlow()` (`DATABASE_URL` + `STAGING_KEY`) and is not part of the automated verify command below — it only needs to stay internally consistent with the new page split.
  </action>
  <verify>
    <automated>yarn vitest run tests/category-settings-ui.test.tsx tests/patterns-page.test.tsx && yarn check:language</automated>
  </verify>
  <done>Categories page renders taxonomy only (no pattern panel, no patterns copy); components/settings/settings-hub.tsx no longer exists; /settings redirects to /settings/profile; the Profile page renders an Aspetto section with a working ThemeToggle; tests/category-settings-ui.test.tsx and the new tests/patterns-page.test.tsx pass; the e2e spec's pattern-creation step targets /patterns.</done>
</task>

<task type="auto">
  <name>Task 3: Sidebar reorder + mobile Altro bottom sheet</name>
  <files>components/layout/sidebar.tsx, components/layout/bottom-nav.tsx, components/layout/mobile-more-sheet.tsx, tests/bottom-nav.test.tsx, tests/mobile-more-sheet.test.tsx</files>
  <action>
    In `components/layout/sidebar.tsx`: add `Regex` and `Tags` to the `lucide-react` import list; remove `Settings` (no longer referenced once the Impostazioni link is gone). Append two entries to `topNavItems`, after the existing Categorie entry: `{ href: APP_ROUTES.tags, label: 'Tag', icon: Tags }` and `{ href: APP_ROUTES.patterns, label: 'Pattern', icon: Regex }` — giving the locked primary order Dashboard, Transazioni, Spese, Importazioni, Categorie, Tag, Pattern. Delete the entire "SETTINGS LINK" block (the `<Separator className="my-2" />` plus the IIFE rendering the Impostazioni link with its active-state check) that currently sits between the `topNavItems` list and the bottom user-avatar slot — there is nothing left in the Impostazioni hub to link to. Leave the bottom avatar `DropdownMenu` (Profilo + Logout) completely untouched.

    In `components/layout/bottom-nav.tsx`: remove `Settings` from the `navItems` array (drop the `{ href: APP_ROUTES.settings, ... }` entry entirely) so `navItems` holds exactly the 4 primary items (Dashboard, Spese, Transazioni, Importazioni). Add local `useState` for `moreOpen` (boolean, default `false`). After mapping `navItems` to `Link`s inside the `<nav>`, render a 5th item as a `<button type="button">` (not a `Link`, since it opens a sheet rather than navigating) with the same layout classes as the existing nav links (`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-1 py-2 text-xs`), `aria-label="Altro"`, `onClick={() => setMoreOpen(true)}`, containing a `ClientMountIcon` with the `MoreHorizontal` icon and the text "Altro". Compute its active/inactive text color the same way as the other items, but based on whether `pathname` matches any of the four destinations the sheet links to (Categorie/Tag/Pattern/Profilo) — import the `MORE_SHEET_ROUTES` array exported by the new `mobile-more-sheet.tsx` module and reuse it for this check instead of duplicating the route list. Render `<MobileMoreSheet open={moreOpen} onOpenChange={setMoreOpen} />` as a sibling of the `<nav>` (not inside it), so the sheet's fixed-position portal isn't nested under `nav`'s `fixed inset-x-0 bottom-0` positioning context.

    Create `components/layout/mobile-more-sheet.tsx` as a `'use client'` component. Export a `MORE_SHEET_ROUTES` constant: `[APP_ROUTES.categorySettings, APP_ROUTES.tags, APP_ROUTES.patterns, APP_ROUTES.profileSettings]`. Export `MobileMoreSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void })` that renders `Sheet`/`SheetContent side="bottom"`/`SheetHeader`/`SheetTitle` from `@/components/ui/sheet` (same primitives `SubcategoryPicker` uses for its bottom sheet, per the existing project pattern — rounded top corners via `rounded-t-2xl` on `SheetContent`), with `SheetTitle` text "Altro". Inside, render a `<nav aria-label="Altre sezioni">` with four `Link`s built from an internal items array pairing each `MORE_SHEET_ROUTES` entry with its Italian label and icon: Categorie (`FolderTree`), Tag (`Tags`), Pattern (`Regex`), Profilo (`User`) — all four icons already exist as `lucide-react` named exports used elsewhere in this codebase. Each `Link`'s `onClick` calls `onOpenChange(false)` so the sheet closes on navigation (Radix `Sheet` does not auto-close on an internal link click since it's not a `SheetClose`).

    Create `tests/bottom-nav.test.tsx`: mock `next/navigation` (`usePathname: () => '/dashboard'`), `next/link` (passthrough `<a>`), `@/lib/utils/client-mount-icon`'s dependency-free rendering is fine as-is (no mock needed — it already has a deterministic pre-mount branch), and `lucide-react` (stub the icons actually imported by `bottom-nav.tsx`: `LayoutDashboard`, `List`, `Receipt`, `Upload`, `MoreHorizontal`). Mock `@/components/layout/mobile-more-sheet` to render a `data-testid="mobile-more-sheet"` marker div reflecting the `open` prop, so the test can assert `BottomNav` renders it (rather than re-testing the real sheet). Assert: `BottomNav` renders exactly 4 `Link`s with hrefs `/dashboard`, `/expenses`, `/transactions`, `/import`; renders an "Altro" button; does NOT render "Impostazioni" or an `/settings` href anywhere.

    Create `tests/mobile-more-sheet.test.tsx` using the same `@/components/ui/sheet` passthrough-div mock as `tests/subcategory-picker.test.tsx` (Radix `Sheet` portals to `document.body`, so it renders nothing under `renderToStaticMarkup` without this mock) and a `next/link` passthrough mock. Assert `MobileMoreSheet` (rendered with `open: true`) contains links to `/settings/categories`, `/tags`, `/patterns`, and `/settings/profile`, with the labels "Categorie", "Tag", "Pattern", "Profilo".
  </action>
  <verify>
    <automated>yarn vitest run tests/bottom-nav.test.tsx tests/mobile-more-sheet.test.tsx && yarn check:language</automated>
  </verify>
  <done>Desktop sidebar shows Dashboard, Transazioni, Spese, Importazioni, Categorie, Tag, Pattern with no Impostazioni link; mobile bottom nav shows 4 primary items plus a working Altro button that opens a bottom sheet listing Categorie/Tag/Pattern/Profilo; both new test files pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|--------------|
| Authenticated user → relocated pages | `/tags` and `/patterns` are new top-level entry points to data that was previously only reachable under `/settings/*`; both still sit behind `app/(app)/layout.tsx`'s `verifySession()` gate (unchanged) and each page's own `verifySession()` call before any DAL read. |
| Authenticated user → redirect pages | `/settings` and `/settings/tags` become fixed, non-parameterized redirects (`redirect(APP_ROUTES.profileSettings)` / `redirect(APP_ROUTES.tags)`) — no user input flows into the redirect target. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-260722iys-01 | Information Disclosure | app/(app)/tags/page.tsx, app/(app)/patterns/page.tsx | low | accept | Both call `verifySession()` and scope every DAL read (`getTags(userId)`, `getUserPatterns(userId)`) to the authenticated user — identical gating to the pages they were extracted from; relocating the route does not add a new access path. |
| T-260722iys-02 | Elevation of Privilege | app/(app)/patterns/page.tsx | low | accept | The plan-gate check (`isPaid`) is UI-only convenience; the real enforcement is server-side in `requireCustomPatternsAccess` inside `createPatternAction`/`updatePatternAction`/`deletePatternAction` (`lib/actions/patterns.ts`, untouched by this plan) — a free-plan user hitting `/patterns` directly still cannot mutate patterns. |
| T-260722iys-03 | Tampering | app/(app)/settings/page.tsx, app/(app)/settings/tags/page.tsx | low | accept | Both redirect targets are hardcoded `APP_ROUTES` constants, not derived from any request input (no open-redirect surface). |
| T-260722iys-04 | Denial of Service (reachability) | app/(app)/layout.tsx | medium | mitigate | Fixed in Task 1 by adding `APP_ROUTES.tags`/`APP_ROUTES.patterns` to the onboarding-guard `isExempt` check — without this, every zero-transaction user would be bounced to `/onboarding` when following the new sidebar Tag/Pattern links, a functional regression this plan explicitly closes. |
</threat_model>

<verification>
1. `yarn vitest run` (full suite) passes — no regressions in files this plan does not directly touch (e.g. `tests/tags-dal.test.ts`, `tests/pattern-actions.test.ts` stay green since no DAL/action business logic changed, only routes/UI).
2. `yarn check:language` passes — all renamed/added identifiers (`tags`, `patterns`, `MobileMoreSheet`, `MORE_SHEET_ROUTES`) are English; Italian stays confined to product-surface labels ("Tag", "Pattern", "Categorie", "Profilo", "Altro", "Aspetto", "Tema").
3. `npx tsc --noEmit` passes — no type errors from the `APP_ROUTES.tagSettings` → `APP_ROUTES.tags` rename or the new `patterns` key (any stale reference would be a compile error, not just a runtime miss).
4. Manual: open the app, confirm the sidebar order (Dashboard, Transazioni, Spese, Importazioni, Categorie, Tag, Pattern), confirm `/settings` and `/settings/tags` redirect, confirm the Profile page shows the Tema toggle, confirm the mobile viewport's Altro button opens a bottom sheet with the 4 links and that tapping one navigates and closes the sheet.
</verification>

<success_criteria>
- `/tags` is the canonical Tag page, reachable from the sidebar; `/settings/tags` redirects to it.
- `/patterns` is a new, standalone page hosting pattern management; `/settings/categories` no longer shows patterns.
- The Impostazioni hub component is deleted; `/settings` redirects to `/settings/profile`.
- The Profile page has a working Aspetto/theme section; the sidebar has no Impostazioni link.
- Desktop sidebar primary order matches the locked spec exactly; mobile bottom nav has 4 primary items + a functional Altro bottom sheet with Categorie/Tag/Pattern/Profilo.
- Zero-transaction users are not redirected away from `/tags` or `/patterns`.
- All touched/created automated tests pass; `yarn check:language` and `npx tsc --noEmit` are clean.
</success_criteria>

<output>
Create `.planning/quick/260722-iys-move-tags-to-left-sidebar-profile-into-a/260722-iys-SUMMARY.md` when done
</output>
