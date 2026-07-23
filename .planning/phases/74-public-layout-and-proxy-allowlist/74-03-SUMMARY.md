---
phase: 74-public-layout-and-proxy-allowlist
plan: 03
subsystem: ui
tags: [nextjs, marketing, stub-pages, chrome]

requires:
  - phase: 74-public-layout-and-proxy-allowlist
    plan: 02
    provides: "app/(public)/layout.tsx wired with SiteHeader/SiteFooter chrome; MARKETING_ROUTES exported from lib/routes.ts"
provides:
  - "app/(public)/how-it-works/page.tsx, app/(public)/privacy/page.tsx, app/(public)/terms/page.tsx — D-10 stub RSCs closing the chrome link inventory"
  - "Human-verified sign-off on the full Phase 74 chrome + allowlist + smart-root experience (BRAND-03 completion)"
affects: [75-marketing-pages, 76-legal-pages, 77-seo-and-auth-polish]

tech-stack:
  added: []
  patterns:
    - "D-10 stub RSC pattern: heading (text-xl font-semibold) + fixed body 'Contenuto in arrivo.' (text-base) + 'Torna alla home' text link to MARKETING_ROUTES.home, inside mx-auto max-w-xl px-4 py-12 sm:px-6"

key-files:
  created:
    - "app/(public)/how-it-works/page.tsx"
    - "app/(public)/privacy/page.tsx"
    - "app/(public)/terms/page.tsx"
  modified: []

key-decisions:
  - "Stub pages import MARKETING_ROUTES.home directly for the back-link href, matching the PATTERNS.md shared stub shape verbatim — no shared component/helper extracted for three near-identical pages (D-12 scope fence keeps components/marketing/* out of this phase)"

patterns-established:
  - "D-10 stub RSC pattern (see tech-stack.patterns) — reusable if Phase 75/76 need a placeholder before real content lands"

requirements-completed: [BRAND-03]

coverage:
  - id: D1
    description: "Anon visitor opens /how-it-works, /privacy, /terms under (public) chrome and sees heading + 'Contenuto in arrivo.' + Torna alla home -> MARKETING_ROUTES.home"
    requirement: "BRAND-03"
    verification:
      - kind: unit
        ref: "static grep — 'Contenuto in arrivo', 'Torna alla home', 'MARKETING_ROUTES' present in all three page files"
        status: pass
      - kind: manual_procedural
        ref: "human-verify checkpoint step 2 — anon click-through Come funziona/Privacy/Termini, chrome persists"
        status: pass
    human_judgment: false
  - id: D2
    description: "No fake legal/GDPR prose on stub pages"
    requirement: "BRAND-03"
    verification:
      - kind: unit
        ref: "static grep — zero matches for GDPR|sub-processor|trattamento dei dati across the three stub files"
        status: pass
    human_judgment: false
  - id: D3
    description: "No components/marketing/* extraction, no Fraunces — scope fence held (D-12)"
    requirement: "BRAND-03"
    verification:
      - kind: unit
        ref: "static check — components/marketing directory absent"
        status: pass
    human_judgment: false
  - id: D4
    description: "Proxy allowlist/smart-root regression suite from Plan 74-01 stays green after stub pages land"
    requirement: "BRAND-04, BRAND-05"
    verification:
      - kind: unit
        ref: "yarn vitest run tests/proxy-auth.test.ts — 7/7 passing"
        status: pass
    human_judgment: false
  - id: D5
    description: "Developer-facing code stays English; Italian only on stub UI copy"
    requirement: "BRAND-03"
    verification:
      - kind: unit
        ref: "yarn check:language — exit 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "Full Phase 74 end-to-end human sign-off: anon marketing shell, stub navigation, Dashboard footer gate to /login, authenticated smart-root to /dashboard, authenticated deep-link to /how-it-works not bounced, mobile Sheet order/close-on-navigate"
    requirement: "BRAND-03"
    verification:
      - kind: manual_procedural
        ref: "checkpoint:human-verify — user responded 'approved'"
        status: pass
    human_judgment: true
    rationale: "Cross-cutting visual/interaction/session sign-off spanning Plans 01-03 (chrome, allowlist, smart-root) requires a live browser walk-through no automated harness in this repo covers; user explicitly approved all six verification steps"

duration: 5min
completed: 2026-07-23
status: complete
---

# Phase 74 Plan 03: D-10 Stub Pages + Phase 74 Human Sign-Off Summary

**Three D-10 stub RSCs (`how-it-works`, `privacy`, `terms`) close the chrome link inventory under `(public)`, and the full Phase 74 chrome + allowlist + smart-root experience received explicit human approval.**

## Performance

- **Duration:** 5 min
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify)
- **Files modified:** 3 (all created)

## Accomplishments

- `app/(public)/how-it-works/page.tsx`, `app/(public)/privacy/page.tsx`, `app/(public)/terms/page.tsx` created following the exact D-10/PATTERNS.md stub shape: `h1` heading (Come funziona / Privacy / Termini), fixed body `Contenuto in arrivo.`, and a `Torna alla home` text link to `MARKETING_ROUTES.home` — no fake legal/GDPR prose, no `components/marketing/*` extraction, no Fraunces.
- All acceptance-criteria greps passed (stub body string, link label, `MARKETING_ROUTES` import, absence of `GDPR`/`sub-processor`/`trattamento dei dati`, absence of `components/marketing`), plus `yarn check:language` (exit 0) and `yarn vitest run tests/proxy-auth.test.ts` (7/7 green — no proxy regression from the new routes).
- Human checkpoint covering the entire Phase 74 slice (SoT allowlist + smart root from Plan 01, SiteHeader/SiteFooter chrome from Plan 02, stub pages from this plan) was presented with all six verification steps (anon marketing shell, stub click-through, anon Dashboard→`/login` gate, authenticated `/`→`/dashboard` smart root, authenticated `/how-it-works` deep link not bounced, mobile Sheet order/close-on-navigate) — user responded **"approved"**.

## Task Commits

1. **Task 1: Ship stub pages for how-it-works, privacy, terms** - `a9e324b` (feat)
2. **Task 2: Human verify public chrome + smart root + stubs** - no commit (checkpoint approval only, no code changes)

**Plan metadata:** committed separately (see final commit below)

## Files Created/Modified

- `app/(public)/how-it-works/page.tsx` - D-10 stub RSC, heading "Come funziona"
- `app/(public)/privacy/page.tsx` - D-10 stub RSC, heading "Privacy"
- `app/(public)/terms/page.tsx` - D-10 stub RSC, heading "Termini"

## Decisions Made

- Stub pages each import `MARKETING_ROUTES` directly and inline the shared JSX shape from `74-PATTERNS.md` verbatim, rather than extracting a shared `StubPage` component — three nearly-identical ~15-line files did not justify an abstraction, and D-12 explicitly fences off new component extraction (`components/marketing/*`) for this phase.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance criteria (grep-verifiable stub content, language check, proxy regression suite, full human checkpoint walk-through) were satisfied without needing any Rule 1-4 deviation.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 74 (BRAND-03, BRAND-04, BRAND-05) is now fully complete and human-approved end-to-end: SoT allowlist + proxy smart root (Plan 01), full SiteHeader/SiteFooter chrome (Plan 02), and D-10 stub pages closing every chrome-linked destination (this plan).
- Phase 75 (marketing-pages) can now promote the homepage shell to full Variant C content and expand `/how-it-works` into its 3-5 step explainer, on top of a chrome and allowlist that are already proven and locked by the D-07 Vitest suite and this plan's human sign-off.
- Phase 76 (legal-pages) can fill the `/privacy` and `/terms` stub bodies with real legal MDX without touching chrome, routing, or the proxy allowlist.
- No blockers.

## Self-Check: PASSED

All three created files confirmed present on disk and commit `a9e324b` confirmed in `git log --oneline --all`.

---
*Phase: 74-public-layout-and-proxy-allowlist*
*Completed: 2026-07-23*
