---
phase: 74-public-layout-and-proxy-allowlist
plan: 02
subsystem: frontend
tags: [nextjs, chrome, header, footer, sheet, shadcn]

requires:
  - phase: 74-public-layout-and-proxy-allowlist
    plan: 01
    provides: "app/(public)/layout.tsx tracer shell + lib/routes.ts SoT (MARKETING_ROUTES, AUTH_PAGE_ROUTES, APP_ROUTES)"
provides:
  - "SiteHeader colocated client component: sticky desktop nav + mobile Sheet (side right) with full link inventory including Dashboard"
  - "SiteFooter colocated RSC component: text-link inventory including Dashboard (D-08), copyright line"
  - "app/(public)/layout.tsx wired to full UI-SPEC chrome (SiteHeader + main.flex-1 + SiteFooter), tracer wordmark removed"
affects: [75-marketing-pages, 76-legal-pages, 77-seo-and-auth-polish]

tech-stack:
  added: []
  patterns:
    - "Active-route nav styling via usePathname() + text-foreground/font-semibold (no underline) — reused for both desktop nav and Sheet product/legal links"
    - "Sheet mobile nav follows MobileMoreSheet's close-on-navigate Link pattern but with side=right (UI-SPEC) and a custom Chiudi-menu close control (showCloseButton=false + SheetClose asChild)"

key-files:
  created:
    - "app/(public)/_components/site-header.tsx"
    - "app/(public)/_components/site-footer.tsx"
  modified:
    - "app/(public)/layout.tsx"

key-decisions:
  - "Sheet order locked as Come funziona → Entra → Registrati → separator → Privacy → Termini → Dashboard (Dashboard last, per plan's own discretion note and D-08)"
  - "Footer and Sheet both surface the full nav+auth+legal+Dashboard inventory; desktop header keeps only Come funziona + Entra/Registrati (no Privacy/Termini in desktop header, per UI-SPEC)"
  - "SheetContent showCloseButton set to false with a custom SheetClose button carrying aria-label=\"Chiudi menu\" (Italian a11y label) instead of the primitive's built-in English \"Close\" control"

requirements-completed: [BRAND-03]

coverage:
  - id: D1
    description: "SiteHeader exports a sticky desktop nav (wordmark, Come funziona, Entra, Registrati) and a mobile Sheet (side=right) with the full D-08 link inventory"
    requirement: "BRAND-03"
    verification:
      - kind: unit
        ref: "static grep — 'SiteHeader', 'use client', MARKETING_ROUTES/AUTH_PAGE_ROUTES/APP_ROUTES imports, 'Apri menu', 'font-semibold', 'usePathname', no '/pricing', no side=\"bottom\""
        status: pass
    human_judgment: true
    rationale: "No jsdom/RTL harness in this repo for interactive Sheet open/close and touch-target sizing — visual/interaction confirmation deferred to a later UAT pass, consistent with 74-01's same rationale for the homepage shell"
  - id: D2
    description: "SiteFooter exports the link inventory (Come funziona, Privacy, Termini, Entra, Registrati, Dashboard) with Dashboard from APP_ROUTES.dashboard, and a copyright line"
    requirement: "BRAND-03"
    verification:
      - kind: unit
        ref: "static grep — 'SiteFooter', 'Dashboard', 'APP_ROUTES' present in site-footer.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "PublicLayout imports SiteHeader + SiteFooter, no forbidden app-shell/sidebar-provider/dal/auth imports anywhere under app/(public)/, no components/marketing directory"
    requirement: "BRAND-03"
    verification:
      - kind: unit
        ref: "static grep across app/(public)/ for app-shell|sidebar-provider|dal/auth (zero matches) + directory existence check for components/marketing (absent)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Developer-facing code stays English; Italian only on product-facing chrome copy"
    requirement: "BRAND-03"
    verification:
      - kind: unit
        ref: "yarn check:language — exit 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "Proxy allowlist/smart-root regression suite from Plan 74-01 stays green after chrome changes"
    requirement: "BRAND-04, BRAND-05"
    verification:
      - kind: unit
        ref: "yarn vitest run tests/proxy-auth.test.ts — 7/7 passing"
        status: pass
    human_judgment: false
  - id: D6
    description: "Full chrome compiles and the anonymous homepage still prerenders statically (no session read leaked into layout/header/footer)"
    requirement: "BRAND-03"
    verification:
      - kind: integration
        ref: "yarn build — compiled successfully, route table shows `○ /` (static), yarn tsc --noEmit clean, yarn lint zero errors in new files"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-07-23
status: complete
---

# Phase 74 Plan 02: SiteHeader + SiteFooter + Full Public Layout Chrome Summary

**`app/(public)/` gains colocated `SiteHeader` (sticky desktop nav + mobile Sheet) and `SiteFooter` (text-link inventory with Dashboard) components, and `app/(public)/layout.tsx` is rewired to render them in place of the Plan 74-01 tracer wordmark — all hrefs sourced from `lib/routes.ts` named constants.**

## Performance

- **Duration:** 6 min
- **Tasks:** 2 (both `type="auto"`)
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- `app/(public)/_components/site-header.tsx` — `'use client'` component exporting `SiteHeader`: sticky desktop bar (wordmark → `MARKETING_ROUTES.home`, "Come funziona" nav link → `MARKETING_ROUTES.howItWorks`, outline "Entra" → `AUTH_PAGE_ROUTES.login`, primary "Registrati" → `AUTH_PAGE_ROUTES.register`); mobile row (wordmark, always-visible "Registrati", `Menu` trigger `aria-label="Apri menu"`) opening a shadcn `Sheet` from the right with the full ordered inventory (Come funziona → Entra → Registrati → separator → Privacy → Termini → Dashboard) and a custom `aria-label="Chiudi menu"` close control. Active-route links use `usePathname()` + `text-foreground font-semibold` (no underline), inactive links use `text-muted-foreground hover:text-foreground`.
- `app/(public)/_components/site-footer.tsx` — RSC component exporting `SiteFooter`: `border-t border-border py-8` shell with wordmark, a flex-wrap text-link row (Come funziona, Privacy, Termini, Entra, Registrati, Dashboard — Dashboard via `APP_ROUTES.dashboard`, D-08), and a `© {currentYear} Sparter` line.
- `app/(public)/layout.tsx` rewired to `SiteHeader` → `main.flex-1` → `SiteFooter`, removing the Plan 74-01 tracer's inline wordmark-only header. Still no session reads and no imports from the authenticated `(app)` layout.
- Verified BRAND-03 isolation held with zero forbidden imports (`app-shell`, `sidebar-provider`, `dal/auth`) anywhere under `app/(public)/`, no `components/marketing` directory created, zero `/pricing` matches in either new component.
- `yarn check:language` clean, `yarn tsc --noEmit` clean, `yarn lint` reports zero errors/warnings in the three touched files (all pre-existing warnings are in unrelated files), `yarn vitest run tests/proxy-auth.test.ts` still 7/7 green, and `yarn build` compiles successfully with `/` still prerendering as static content (`○`) — confirming the new chrome introduced no session read into the layout tree.

## Task Commits

1. **Task 1: Build SiteHeader — desktop nav + mobile Sheet** - `f94ad00` (feat)
2. **Task 2: Build SiteFooter + wire PublicLayout chrome** - `bb821aa` (feat)

**Plan metadata:** committed separately (see final commit below)

## Files Created/Modified

- `app/(public)/_components/site-header.tsx` - New: sticky desktop nav + mobile Sheet client component
- `app/(public)/_components/site-footer.tsx` - New: RSC footer with Dashboard link (D-08)
- `app/(public)/layout.tsx` - Modified: renders `SiteHeader` + `main.flex-1` + `SiteFooter`, tracer wordmark removed

## Decisions Made

- Sheet link order locked to `Come funziona → Entra → Registrati → separator → Privacy → Termini → Dashboard` (Dashboard last), following the plan's own "Claude's Discretion" note and D-08.
- Both footer and Sheet carry the complete nav+auth+legal+Dashboard inventory; the desktop header stays minimal (wordmark, Come funziona, Entra, Registrati only) — Privacy/Termini remain footer-only per UI-SPEC.
- `SheetContent`'s built-in close button (`showCloseButton`) was disabled in favor of a custom `SheetClose` button carrying the Italian `aria-label="Chiudi menu"`, since the shadcn primitive's default close control hardcodes an English "Close" sr-only label with no prop to localize it.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance criteria (grep-verifiable file contents, forbidden-import absence, `components/marketing` absence, language check, proxy regression suite) were satisfied without needing any Rule 1-4 deviation.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Full UI-SPEC chrome (header/nav/Sheet/footer) is now end-to-end clickable on every `(public)` route, satisfying the plan's stated purpose of making marketing navigation navigable before Plan 03's stub pages land.
- BRAND-03 isolation (no `AppShell`/`SidebarProvider`/onboarding gate leak into `(public)`) remains proven by static grep, same as Plan 74-01.
- Plan 03 can now build the `/how-it-works`, `/privacy`, `/terms` stub pages and the homepage-shell polish knowing every chrome link target already resolves inside the `(public)` layout.
- Visual/interactive confirmation of the Sheet (open/close animation, 44px touch targets, active-route highlighting in a running browser) is flagged `human_judgment: true` (D1) for a later UAT pass — consistent with 74-01's same deferral pattern for the homepage shell.

## Self-Check: PASSED

All created files confirmed on disk (`site-header.tsx`, `site-footer.tsx`, this summary) and both task commits (`f94ad00`, `bb821aa`) confirmed in `git log`.

---
*Phase: 74-public-layout-and-proxy-allowlist*
*Completed: 2026-07-23*
