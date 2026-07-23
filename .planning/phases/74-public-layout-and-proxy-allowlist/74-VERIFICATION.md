---
phase: 74-public-layout-and-proxy-allowlist
verified: 2026-07-23T13:00:00Z
status: passed
score: 11/11 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 74: Public Layout and Proxy Allowlist Verification Report

**Phase Goal:** Create the production (public) route group with SiteHeader/SiteFooter chrome (Geist only, no authenticated app chrome), wire marketing/auth path allowlist as SoT in `lib/routes.ts` into `proxy.ts`, implement smart-root (auth `/` → `/dashboard` in proxy only), delete redirect-only `app/page.tsx` so anonymous `/` is owned by `(public)/page.tsx`, and ship D-10 stub pages for chrome-linked paths so nav never 404s.
**Requirements:** BRAND-03, BRAND-04, BRAND-05
**Verified:** 2026-07-23
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Anonymous visitor can reach marketing paths under a dedicated `(public)` layout with header/nav/footer — no AppShell, sidebar, or onboarding gate (Roadmap SC1, BRAND-03) | ✓ VERIFIED | `app/(public)/layout.tsx` renders `SiteHeader`/`SiteFooter` only; grep for `app-shell\|sidebar-provider\|dal/auth` across `app/(public)/**` returns zero matches; no session reads in layout/header/footer (grep for `session` returns zero matches) |
| 2 | Public marketing paths are allowlisted in `proxy.ts` via a single SoT in `lib/routes.ts` (anon access without 307 to `/login`) (Roadmap SC2, BRAND-04) | ✓ VERIFIED | `lib/routes.ts` exports `PUBLIC_MARKETING_ROUTES`/`AUTH_ROUTES`/`PUBLIC_ROUTES`/`isPublicPath`/`isAuthPath`; `proxy.ts` imports these (no local array redeclaration); `tests/proxy-auth.test.ts` "allows anonymous marketing home without redirect to login" passes (7/7 suite green) |
| 3 | Unauthenticated `/` serves the marketing homepage; authenticated `/` redirects to `/dashboard` (Roadmap SC3, BRAND-05) | ✓ VERIFIED | `proxy.ts:52-54` smart-root branch `path === MARKETING_ROUTES.home && isAuthenticated` → redirect to `APP_ROUTES.dashboard`, positioned after session resolution, before final `next()`; no `redirect(` call anywhere in `app/(public)/page.tsx`; vitest cases "redirects authenticated home to dashboard" and "allows anonymous marketing home..." both pass |
| 4 | Authenticated `GET /how-it-works` is not bounced by `AUTH_ROUTES` (200, no Location) | ✓ VERIFIED | `isAuthPath()` restricted to `AUTH_PAGE_ROUTES` (login/register) only; vitest "allows authenticated marketing deep link" passes |
| 5 | Anonymous `GET /dashboard` still 307s to `/login` (deny-by-default preserved) | ✓ VERIFIED | vitest "still gates non-allowlisted paths for anonymous users" and pre-existing "redirects protected app routes to login" both pass |
| 6 | Every `(public)` page renders sticky SiteHeader + SiteFooter chrome with Italian labels and English hrefs from named route constants (BRAND-03) | ✓ VERIFIED | `app/(public)/layout.tsx` wraps `children` with `SiteHeader`/`SiteFooter` unconditionally (applies to every page in the route group); both components import `MARKETING_ROUTES`/`AUTH_PAGE_ROUTES`/`APP_ROUTES` exclusively — zero hard-coded path literals found |
| 7 | Desktop header exposes Come funziona + Entra + Registrati; legal links stay footer-only | ✓ VERIFIED | `site-header.tsx` desktop `nav` (md+) contains only "Come funziona"; Entra/Registrati buttons present; zero "Privacy"/"Termini" occurrences outside the mobile Sheet block |
| 8 | Mobile Sheet (side right) lists Come funziona → Entra → Registrati → separator → Privacy → Termini → Dashboard, closes on navigate | ✓ VERIFIED (code) + human-approved | `SheetContent side="right"`; link order in code matches exactly; every link has `onClick={() => setOpen(false)}`; interactive open/close/touch-target behavior was exercised and approved by the developer during the phase's own `checkpoint:human-verify` (74-03-SUMMARY.md D6, step 6, response "approved") — this is a genuine human test result, not a Claude self-report |
| 9 | Footer always shows Dashboard text link to `APP_ROUTES.dashboard`; anon click is gated by proxy to login | ✓ VERIFIED | `site-footer.tsx` renders `<Link href={APP_ROUTES.dashboard}>Dashboard</Link>` unconditionally (no session gate); proxy's deny-by-default (`isPublicRoute` check) covers `/dashboard` since it is not in `PUBLIC_ROUTES` — same code path proven by truth #5 |
| 10 | Anon visitor can open `/how-it-works`, `/privacy`, `/terms` under `(public)` chrome and see heading + body `Contenuto in arrivo.` + `Torna alla home` → `/` (D-10, BRAND-03) | ✓ VERIFIED | All three files exist under `app/(public)/{how-it-works,privacy,terms}/page.tsx`, each with exact body string, back-link label, and `MARKETING_ROUTES.home` import; all three paths are members of `PUBLIC_MARKETING_ROUTES` so proxy allows anon access |
| 11 | No fake legal/GDPR prose on stub pages (D-10) | ✓ VERIFIED | Grep for `GDPR\|sub-processor\|trattamento dei dati` across the three stub files returns zero matches |

**Score:** 11/11 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/routes.ts` | `MARKETING_ROUTES`, `AUTH_PAGE_ROUTES`, `PUBLIC_MARKETING_ROUTES`, `AUTH_ROUTES`, `PUBLIC_ROUTES`, `isPublicPath`, `isAuthPath` | ✓ VERIFIED | All seven identifiers present, exact array/exact-match semantics (`.includes`, not `startsWith`), `APP_ROUTES` untouched |
| `proxy.ts` | SoT-imported allowlist + smart-root; staging/next-action early returns preserved | ✓ VERIFIED | Imports all 5 symbols from `@/lib/routes`; zero local `PUBLIC_ROUTES`/`AUTH_ROUTES` redeclaration; staging-key bypass and `next-action` short-circuit both precede the session call, unchanged in order |
| `app/(public)/page.tsx` | Minimal type-led homepage shell owning `/` | ✓ VERIFIED | Contains exact supporting line "Carica i tuoi estratti. Sparter li categorizza — senza collegare la banca."; Registrati/Entra CTA pair; no `redirect(` call |
| `app/(public)/layout.tsx` | Sibling public shell, no authenticated app layout imports | ✓ VERIFIED | `flex min-h-screen flex-col bg-background`; imports only colocated `SiteHeader`/`SiteFooter` |
| `app/(public)/_components/site-header.tsx` | Sticky desktop nav + mobile Sheet island | ✓ VERIFIED | `'use client'`; sticky classes; Sheet `side="right"`; `aria-label="Apri menu"`/`"Chiudi menu"`; active-route styling via `usePathname()` |
| `app/(public)/_components/site-footer.tsx` | Footer link inventory including Dashboard | ✓ VERIFIED | RSC; full link inventory + Dashboard via `APP_ROUTES.dashboard`; copyright line |
| `app/(public)/how-it-works/page.tsx`, `privacy/page.tsx`, `terms/page.tsx` | D-10 stub RSCs | ✓ VERIFIED | All three present with exact stub shape |
| `tests/proxy-auth.test.ts` | D-07 Vitest cases | ✓ VERIFIED | 7/7 tests pass (`yarn vitest run tests/proxy-auth.test.ts`) |
| `app/page.tsx` | Must NOT exist (deleted, single owner of `/`) | ✓ VERIFIED | `test -f app/page.tsx` → absent |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `proxy.ts` | `lib/routes.ts` | imports `isPublicPath`/`isAuthPath`/`MARKETING_ROUTES`/`AUTH_PAGE_ROUTES`/`APP_ROUTES` | ✓ WIRED | No local allowlist arrays remain in `proxy.ts` |
| `proxy.ts` smart-root branch | `APP_ROUTES.dashboard` | `path === MARKETING_ROUTES.home && isAuthenticated` → redirect | ✓ WIRED | Positioned after session resolution, before final `next()`; test-proven |
| `app/page.tsx` deletion + `app/(public)/page.tsx` creation | single owner of `/` | same changeset (commit `e74e3b9`) | ✓ WIRED | Confirmed via `git log` — both changes in the same commit |
| `site-header.tsx` / `site-footer.tsx` hrefs | `lib/routes.ts` constants | `MARKETING_ROUTES` / `AUTH_PAGE_ROUTES` / `APP_ROUTES` imports | ✓ WIRED | Zero hard-coded path string literals found in either file |
| `layout.tsx` | `_components/site-header.tsx`, `_components/site-footer.tsx` | relative imports | ✓ WIRED | Both imported and rendered unconditionally around `children` |
| Stub pages | `MARKETING_ROUTES.home` | back-link `href` | ✓ WIRED | All three stub files import and use `MARKETING_ROUTES.home` |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full D-07 proxy suite (anon home, auth home→dashboard, auth deep link, anon gated path, plus 3 pre-existing cases) | `yarn vitest run tests/proxy-auth.test.ts` | 7/7 passed, 159ms | ✓ PASS |
| Type safety across all touched files | `yarn tsc --noEmit` | 0 errors | ✓ PASS |
| Lint on all touched files | `yarn eslint <touched files>` | 0 errors/warnings | ✓ PASS |
| Language convention (English identifiers / Italian product copy only) | `yarn check:language` | "English code convention check passed." | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| BRAND-03 | 74-02, 74-03 | Anonymous visitor sees marketing pages under a dedicated `(public)` layout without AppShell/sidebar/onboarding gate | ✓ SATISFIED | Truths #1, #6-11; REQUIREMENTS.md already checked `[x]` |
| BRAND-04 | 74-01 | Public marketing paths allowlisted in `proxy.ts` via SoT in `lib/routes.ts` | ✓ SATISFIED | Truth #2; REQUIREMENTS.md already checked `[x]` |
| BRAND-05 | 74-01 | Smart root — anon `/` → marketing home; auth `/` → `/dashboard` | ✓ SATISFIED | Truth #3; REQUIREMENTS.md already checked `[x]` |

No orphaned requirements: `.planning/REQUIREMENTS.md` maps exactly BRAND-03/04/05 to Phase 74, and all three appear in at least one plan's `requirements` frontmatter (74-01: BRAND-04/05; 74-02: BRAND-03; 74-03: BRAND-03).

### Anti-Patterns Found

None. Scanned all phase-touched files (`lib/routes.ts`, `proxy.ts`, `app/(public)/layout.tsx`, `app/(public)/page.tsx`, `app/(public)/_components/site-header.tsx`, `app/(public)/_components/site-footer.tsx`, `app/(public)/{how-it-works,privacy,terms}/page.tsx`, `tests/proxy-auth.test.ts`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` and stub-indicator patterns — zero matches.

### Prohibitions Check (from PLAN frontmatter)

| Prohibition | Status | Evidence |
|-------------|--------|----------|
| No `redirect()` inside `app/(public)/page.tsx` or any `(public)` RSC (D-01) | ✓ Held | Grep for `redirect(` in the page returns zero matches |
| No prefix match for marketing/auth paths — exact includes only (D-04) | ✓ Held | `isPublicPath`/`isAuthPath` use `Array.includes`, not `startsWith`; `/proto` correctly keeps its separate `startsWith` exception |
| No authenticated-app layout chrome/sidebar/verifySession imported into `(public)` (BRAND-03) | ✓ Held | Zero matches for `app-shell\|sidebar-provider\|dal/auth` under `app/(public)/` |
| No `components/marketing/*` directory; no Fraunces/display font (D-12) | ✓ Held | `components/marketing` absent; no font-load additions found |
| No fake legal prose on stub pages (D-10) | ✓ Held | Zero `GDPR\|sub-processor\|trattamento dei dati` matches |
| No Pricing link anywhere in public chrome | ✓ Held | Zero `/pricing` matches under `app/(public)/` |
| No session-aware hide of Registrati (Phase 77 deferred) | ✓ Held | Zero `session` references in layout/header/footer |

### Human Verification Required

None outstanding. The one item requiring interactive/visual confirmation (mobile Sheet open/close animation, touch-target sizing, sticky header behavior, full end-to-end click-through) was already exercised and explicitly approved by the developer during this phase's own `checkpoint:human-verify` task (74-03-PLAN.md Task 2 / 74-03-SUMMARY.md coverage item D6: "user responded 'approved'" across all six listed verification steps — anon marketing shell, stub click-through, anon Dashboard→`/login` gate, authenticated `/`→`/dashboard` smart root, authenticated `/how-it-works` deep link not bounced, mobile Sheet order/close-on-navigate). This is genuine human-sourced verification evidence, distinct from a Claude self-report, and is treated as satisfying the interactive/visual truths.

### Gaps Summary

No gaps. Every ROADMAP success criterion and every PLAN-frontmatter must-have (truths, artifacts, key links, prohibitions) across all three plans (74-01, 74-02, 74-03) is independently confirmed against the current codebase state: `lib/routes.ts`/`proxy.ts` wiring, `(public)` route-group files, chrome components, and stub pages all exist, are substantive, and are wired — with the D-07 Vitest suite (7/7), `tsc --noEmit` (0 errors), `eslint` (0 errors), and `check:language` (pass) all independently re-run and green. `app/page.tsx` is confirmed deleted with no dual ownership of `/`. All three requirement IDs (BRAND-03, BRAND-04, BRAND-05) are satisfied and correctly reflected as complete in `.planning/REQUIREMENTS.md`.

---

_Verified: 2026-07-23_
_Verifier: Claude (gsd-verifier)_
