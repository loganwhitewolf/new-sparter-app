---
phase: 74-public-layout-and-proxy-allowlist
plan: 01
subsystem: infra
tags: [nextjs, proxy, routing, auth, better-auth, vitest]

requires:
  - phase: 73-proto-design-variants
    provides: "Locked design direction (Variant C) — not consumed structurally by this plan, only informs Phase 75 content"
provides:
  - "lib/routes.ts SoT: MARKETING_ROUTES, AUTH_PAGE_ROUTES named maps + PUBLIC_MARKETING_ROUTES/AUTH_ROUTES/PUBLIC_ROUTES arrays + isPublicPath/isAuthPath helpers"
  - "proxy.ts refactored to import allowlist from lib/routes.ts; smart-root branch (auth `/` -> /dashboard)"
  - "app/(public)/layout.tsx + app/(public)/page.tsx as sole owner of `/`; app/page.tsx deleted"
  - "tests/proxy-auth.test.ts D-07 coverage (anon home, auth home, auth deep link, gated path regression)"
affects: [75-marketing-pages, 76-legal-pages, 77-seo-and-auth-polish]

tech-stack:
  added: []
  patterns:
    - "Named route-constant objects (MARKETING_ROUTES/AUTH_PAGE_ROUTES) feed derived proxy-membership arrays (PUBLIC_MARKETING_ROUTES/AUTH_ROUTES/PUBLIC_ROUTES) — single source of truth for both chrome hrefs and proxy gating"
    - "Smart-root redirect lives only in proxy.ts, after session resolution and before the final next() — never duplicated in the RSC page"

key-files:
  created:
    - "app/(public)/layout.tsx"
    - "app/(public)/page.tsx"
  modified:
    - "lib/routes.ts"
    - "proxy.ts"
    - "tests/proxy-auth.test.ts"
  deleted:
    - "app/page.tsx"

key-decisions:
  - "Smart root (auth `/` -> /dashboard) implemented only in proxy.ts per D-01 — no redirect() call anywhere in app/(public)/page.tsx"
  - "Allowlist matching stays exact (.includes), not startsWith, for marketing/auth paths per D-04; /proto keeps its existing startsWith exception"
  - "(public)/layout.tsx ships a minimal inline top wordmark link (no SiteHeader/SiteFooter component split yet) — full chrome extraction is Plan 02 per the plan's own scope"

patterns-established:
  - "Routes SoT pattern: lib/routes.ts owns named constant objects; proxy.ts and future chrome components import from there, never hard-code path strings"

requirements-completed: [BRAND-04, BRAND-05]

coverage:
  - id: D1
    description: "Anonymous GET / passes proxy without 307 to /login and renders the (public) homepage shell"
    requirement: "BRAND-04"
    verification:
      - kind: unit
        ref: "tests/proxy-auth.test.ts#allows anonymous marketing home without redirect to login"
        status: pass
    human_judgment: false
  - id: D2
    description: "Authenticated GET / returns 307 Location /dashboard from proxy only"
    requirement: "BRAND-05"
    verification:
      - kind: unit
        ref: "tests/proxy-auth.test.ts#redirects authenticated home to dashboard"
        status: pass
    human_judgment: false
  - id: D3
    description: "Authenticated GET /how-it-works is not bounced by AUTH_ROUTES (200, no Location)"
    requirement: "BRAND-05"
    verification:
      - kind: unit
        ref: "tests/proxy-auth.test.ts#allows authenticated marketing deep link"
        status: pass
    human_judgment: false
  - id: D4
    description: "Anonymous GET /dashboard still 307 to /login (deny-by-default preserved)"
    requirement: "BRAND-04"
    verification:
      - kind: unit
        ref: "tests/proxy-auth.test.ts#still gates non-allowlisted paths for anonymous users"
        status: pass
    human_judgment: false
  - id: D5
    description: "app/(public)/page.tsx renders the minimal homepage shell (brand + supporting line + Registrati/Entra CTAs) — visual verification"
    verification: []
    human_judgment: true
    rationale: "No jsdom/RTL harness in this repo for rendered visual output; static grep confirms copy/structure but actual browser rendering needs human/UAT check in a later plan or phase gate"

duration: 15min
completed: 2026-07-23
status: complete
---

# Phase 74 Plan 01: SoT Allowlist + Proxy Smart Root + (public) Home Summary

**`lib/routes.ts` gains a routes SoT (`MARKETING_ROUTES`/`AUTH_PAGE_ROUTES` + derived arrays), `proxy.ts` is refactored to import it and add a proxy-only smart root, and `app/(public)/page.tsx` replaces the old unconditional `app/page.tsx` redirect as the sole owner of `/`.**

## Performance

- **Duration:** 15 min
- **Tasks:** 2 (1 tracer + 1 verification)
- **Files modified:** 6 (1 created layout, 1 created page, 1 deleted page, 3 modified)

## Accomplishments

- `lib/routes.ts` now exports `MARKETING_ROUTES`, `AUTH_PAGE_ROUTES` named maps and `PUBLIC_MARKETING_ROUTES`, `AUTH_ROUTES`, `PUBLIC_ROUTES` derived arrays plus `isPublicPath`/`isAuthPath` exact-match helpers (D-05/D-06) — `APP_ROUTES` left untouched.
- `proxy.ts` deleted its local hard-coded `PUBLIC_ROUTES`/`AUTH_ROUTES` arrays, now imports the SoT, and adds the BRAND-05 smart-root branch (`path === MARKETING_ROUTES.home && isAuthenticated` → redirect to `APP_ROUTES.dashboard`) positioned after session resolution and before the final `next()`. Staging-key bypass and `next-action` short-circuit preserved verbatim at the top, in original order.
- `app/page.tsx` deleted and `app/(public)/layout.tsx` + `app/(public)/page.tsx` created in the same changeset — no dual ownership of `/`. Homepage shell renders the Italian supporting line, brand wordmark, and primary/outline CTA pair (`Registrati`/`Entra`) per D-11/UI-SPEC; no `redirect()` call anywhere in the page (smart root stays proxy-only, D-01).
- `tests/proxy-auth.test.ts` extended with the four D-07 cases (anon home, auth home → dashboard, auth deep-link to `/how-it-works`, anon `/dashboard` gated regression) — all 7 tests (3 pre-existing + 4 new) pass.
- Task 2 confirmed the isolation fence held with zero code changes needed: no `app-shell`/`sidebar-provider`/`dal/auth` imports under `app/(public)/`, no `components/marketing` directory, `next-action` check still precedes `getAuthSessionOrNull`, `yarn check:language` exits 0.

## Task Commits

1. **Task 1: End-to-end public / tracer — SoT allowlist + smart root + (public) home** - `e74e3b9` (feat)
2. **Task 2: Isolation + language gates for tracer artifacts** - no commit (verification-only; all acceptance criteria already satisfied by Task 1's implementation, no code changes required)

**Plan metadata:** committed separately (see final commit below)

## Files Created/Modified

- `lib/routes.ts` - Added `MARKETING_ROUTES`, `AUTH_PAGE_ROUTES`, `PUBLIC_MARKETING_ROUTES`, `AUTH_ROUTES`, `PUBLIC_ROUTES`, `isPublicPath`, `isAuthPath`
- `proxy.ts` - Imports SoT from `@/lib/routes`; deleted local arrays; added smart-root branch
- `app/(public)/layout.tsx` - New sibling public layout shell (flex column, minimal top wordmark link, `main.flex-1`)
- `app/(public)/page.tsx` - New homepage shell owning `/` (brand, Italian supporting line, CTA pair)
- `app/page.tsx` - Deleted (was the sole prior owner of `/`, unconditional redirect to `/dashboard`)
- `tests/proxy-auth.test.ts` - Added 4 D-07 test cases

## Decisions Made

- Smart root implemented exclusively in `proxy.ts` (D-01) — confirmed no `redirect(` call exists anywhere in `app/(public)/page.tsx`.
- `app/(public)/layout.tsx` ships only a minimal inline top wordmark link in this plan (no `SiteHeader`/`SiteFooter` component split, no Sheet mobile nav) — the plan's own `<action>` block scoped this tracer to proving the allowlist + smart-root + `/` ownership path; full chrome (header/footer/Sheet/stub pages) is Plan 02's responsibility per the phase's plan split.
- Task 2 required no code changes: every acceptance criterion (no forbidden imports, no `components/marketing` directory, `next-action` order preserved, `yarn check:language` clean) was already satisfied by Task 1's implementation. No commit was created for Task 2 since there was nothing to stage.

## Deviations from Plan

None - plan executed exactly as written. `lib/routes.ts`, `proxy.ts`, and the `(public)` route group were built following the locked D-01…D-12 decisions and the RESEARCH/PATTERNS code shapes without modification.

## Issues Encountered

- `yarn tsc --noEmit` initially reported 4 stale-type errors referencing the deleted `app/page.tsx` from `.next/types/` — these are Next.js's auto-generated route-typing cache artifacts (`.next/` is gitignored), not source errors. Removing the stale `.next/` directory and re-running the typecheck produced a clean pass with zero errors.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- BRAND-04 (allowlist SoT) and BRAND-05 (smart root) truths are proven end-to-end and locked by the D-07 Vitest suite (7/7 passing).
- Plan 02 can now build `SiteHeader`/`SiteFooter`/stub pages (`/how-it-works`, `/privacy`, `/terms`) on top of the `(public)` layout shell and import `MARKETING_ROUTES`/`AUTH_PAGE_ROUTES`/`APP_ROUTES` constants without touching the proxy or allowlist again.
- No blockers. Homepage shell visual rendering (brand/typography/spacing per UI-SPEC) has not been checked in a running browser — flagged as `human_judgment: true` (D5) for a later phase-gate UAT pass, consistent with the plan's own "Claude's Discretion" note that light RTL/browser checks were deferred to Plan 03's human checkpoint.

---
*Phase: 74-public-layout-and-proxy-allowlist*
*Completed: 2026-07-23*
