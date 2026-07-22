---
phase: 69-proto-design-variants
plan: 02
subsystem: ui
tags: [nextjs, tailwind, next-image, proto, marketing]

requires:
  - phase: 69-01
    provides: "Hub + ?variant= switcher, Variant A (shot-as-plane), scoped Fraunces display font, shared hero placeholder asset"
provides:
  - "Variant B (editorial split): asymmetric type column + offset product frame in a rounded card, not full-bleed like A"
  - "Variant C (type-led stack): oversized brand+headline dominate the first screen; full-width product band immediately below the CTA block"
  - "Hub page.tsx mounts real VariantA/B/C for all three ?variant= keys — no stub panels remain"
affects: [69-03, 71-marketing-pages]

tech-stack:
  added: []
  patterns:
    - "Second and third structurally independent variant files (variant-b.tsx, variant-c.tsx) — no shared Layout shell, only shared fonts.ts/assets import"

key-files:
  created:
    - app/proto/branding/variant-b.tsx
    - app/proto/branding/variant-c.tsx
  modified:
    - app/proto/branding/page.tsx

key-decisions:
  - "Variant B silhouette: viewport-height split grid (7fr type column / 5fr image column), image in a rounded-2xl bordered card offset via lg:translate-y-6 — deliberately not full-bleed so it reads differently from A's edge-to-edge hero"
  - "Variant C silhouette: no image in the first viewport at all — pure centered type stack (brand + oversized headline + sub + CTAs), then a full-width aspect-[16/7] product band immediately below, bordered top/bottom — distinct from both A (image-as-background) and B (image-as-side-panel)"
  - "Below-fold benefit blocks vary shape per variant to reinforce the differing scroll silhouette: A = plain 2-col grid, B = numbered (01/02) 2-col grid with a border-top divider, C = single centered column, stacked"

patterns-established:
  - "Pattern: each variant file is a self-contained composition importing only fonts.ts CSS var (via className string, applied once in page.tsx) and the shared hero asset — zero cross-variant component coupling beyond Button/Link/Image primitives"

requirements-completed: [BRAND-01]

coverage:
  - id: D1
    description: "Variant B (editorial split) exports VariantB with Registrati (/register) and Entra (/login) CTAs, and page.tsx mounts it for ?variant=b, replacing the Plan 01 stub"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "grep -q 'export function VariantB' app/proto/branding/variant-b.tsx && grep -q 'VariantB' app/proto/branding/page.tsx && grep -q '/register' && grep -q '/login' variant-b.tsx — all pass; npx tsc --noEmit clean on app/proto/branding/**"
        status: pass
    human_judgment: false
  - id: D2
    description: "Variant C (type-led stack) exports VariantC with Registrati/Entra CTAs; page.tsx mounts VariantA, VariantB, and VariantC for all three variant keys with no stub panels remaining"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "grep -q 'export function VariantC' app/proto/branding/variant-c.tsx && grep -q 'VariantC|VariantA|VariantB' app/proto/branding/page.tsx — all pass; npx tsc --noEmit clean; yarn lint clean on touched files; yarn check:language passed; yarn build succeeds and lists /proto/branding as a compiled dynamic route"
        status: pass
    human_judgment: false
  - id: D3
    description: "Live visual check on Vercel Preview / local dev: cycling a→b→c shows three genuinely different scroll silhouettes (not color tweaks), CTAs work end-to-end, no cliché atmospheres (D-08), Italian import-first copy reads honest"
    human_judgment: true
    verification: []
    rationale: "This session's sandboxed shell could not complete a live HTTP round-trip against a local `yarn dev` server (see Issues Encountered) — code was verified via tsc/lint/build/grep only, not a rendered browser check. Subjective 'cool but credible' design judgment is explicitly BRAND-02's Preview review + NOTES.md verdict ritual (D-07), not this plan's bar, but even the functional runnability check needs a human/browser pass this session could not produce."

duration: 13min
completed: 2026-07-22
status: complete
---

# Phase 69 Plan 02: Variant B (editorial split) + Variant C (type-led stack) Summary

**Two additional structurally distinct A+touch-of-B compositions (asymmetric split-column vs. oversized type-then-band) replace the Plan 01 stubs, completing the three-way `/proto/branding` compare surface for BRAND-01.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-07-22T15:22:53Z
- **Completed:** 2026-07-22T15:35:56Z
- **Tasks:** 2 completed
- **Files modified:** 3 (1 modified, 2 created)

## Accomplishments

- `VariantB` (editorial split): viewport-height split grid — asymmetric type column (brand/headline/sub/CTA) beside a large, offset, rounded-2xl bordered product frame; distinctly not full-bleed like Variant A
- `VariantC` (type-led stack): oversized brand + headline dominate a pure centered first screen (no image at all in the hero), then a full-width `aspect-[16/7]` product band sits immediately under the CTA block — a third, visually distinct scroll silhouette
- Both variants keep the D-02/D-03/D-04 content contract: Sparter brand signal, one Italian outcome headline, one import-first sub, Registrati (primary)/Entra (secondary) CTAs to `/register`/`/login`, exactly two below-fold benefit blocks + closing CTA — no cards, stat strips, badges/overlays, or Pricing language
- Below-fold benefit blocks deliberately vary shape per variant (A: plain 2-col grid; B: numbered 01/02 2-col grid with divider; C: single centered stacked column) so the differing hierarchy carries through the whole scroll, not just the hero
- `app/proto/branding/page.tsx` now imports and mounts `VariantA`, `VariantB`, and `VariantC` for all three `?variant=` keys; the `VariantStub` helper and both stub panels are removed — BRAND-01's three-way compare surface is complete (D-05, D-06)
- Both variants reuse the shared Plan 01 hero asset (`overview-hero-placeholder.svg`) via `next/image`, without badges/overlays on the media, and the scoped `--font-branding-display` (Fraunces) CSS variable already applied at the page-wrapper level — no new fonts, no new packages

## Task Commits

1. **Task 1: Variant B — editorial split axis** - `50b8b87` (feat)
2. **Task 2: Variant C — type-led stack axis** - `c1a7c80` (feat)

**Plan metadata:** committed with this SUMMARY

## Files Created/Modified

- `app/proto/branding/variant-b.tsx` - Editorial-split composition: `lg:grid-cols-[7fr_5fr]` split, type column left, offset bordered image card right, numbered (01/02) below-fold benefit grid, closing CTA
- `app/proto/branding/variant-c.tsx` - Type-led-stack composition: centered oversized brand+headline+sub+CTA hero with no image, full-width `aspect-[16/7]` product band immediately below, centered stacked below-fold benefits, closing CTA
- `app/proto/branding/page.tsx` - Wired `VariantB` (task 1) then `VariantC` (task 2) for `?variant=b|c`; removed the now-unused `VariantStub` helper and both stub render branches

## Decisions Made

- **Variant B is a split-grid, not full-bleed** — the image lives in a bordered, rounded, slightly offset card rather than as a background plane, which is the structural axis difference from A (D-06: layout/hierarchy must differ, not just color).
- **Variant C has zero image in the first viewport** — the "type-led" axis is expressed literally: brand+headline+sub+CTA is the entire hero, and the product visual is a full-width band that appears immediately on scroll, not blended behind text. This is the most extreme structural departure from A of the three variants.
- **Below-fold benefit block shape varies per variant** (grid vs. numbered-grid vs. stacked-centered) rather than reusing one shared component across all three — reinforces D-08's "no shared Layout shell that collapses structural difference" at the below-fold level too, not just the hero.
- **BRAND-01 marked complete in REQUIREMENTS.md** at the end of this plan (not Plan 01) — per 69-01-SUMMARY's explicit note that the three-way compare surface (not just Variant A + stubs) is what satisfies BRAND-01.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched their `<action>` blocks and passed their automated `<verify>` commands unchanged.

## Issues Encountered

- **Local `yarn dev` smoke test could not complete in this session's sandbox.** Following the Plan's `<verification>` step and the Plan 01 precedent (`PROTOTYPES_ENABLED=1 yarn dev -p 3099` + curl), I started a throwaway dev server on an alternate port and attempted to request `/proto/branding?variant=a|b|c`. The server bound and logged `✓ Ready`, but every HTTP request (via `curl` and via Node's `fetch`) against `127.0.0.1` either hung indefinitely with zero server-side compile log output, or failed immediately with `fetch failed` / `curl: (7) Failed to connect` depending on which sandbox network permission was granted for that specific call — inconsistent behavior pointing at this session's network-namespace handling of loopback connections, not at the code (outbound HTTPS to `fonts.googleapis.com` succeeded cleanly from the same shell). I did not spend further attempts chasing this once it was clearly environmental (three different reproduction angles: plain curl, curl with `full_network`, and Node `fetch`, plus a retry with the repo's own offline `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` mock to rule out a font-fetch cause).
- **Verification fallback used instead:** `yarn build` (which uses the repo's existing `.next-font-google-mocks.cjs` offline mock, no live network needed) completed successfully and listed `/proto/branding` as a compiled dynamic (`ƒ`) route alongside every other app route — confirming the module graph (both new variant files + the rewired `page.tsx`) type-checks and bundles cleanly end-to-end. Combined with per-task `npx tsc --noEmit`, `yarn lint` (0 errors, only pre-existing unrelated warnings), and `yarn check:language` (passed), this is strong static confidence, but it does **not** substitute for an actual rendered-in-browser check of the three scroll silhouettes. Logged as coverage item D3 (`human_judgment: true`) above — a human/browser pass against a working dev server or the Vercel Preview URL is still needed to confirm the visual/functional bar before BRAND-02's design-lock review.

## User Setup Required

None beyond the plan's documented local-preview note (`PROTOTYPES_ENABLED=1 yarn dev` locally; Vercel Preview already has the env scoped). See "Issues Encountered" above — the local smoke check itself needs to be re-run outside this session's sandbox (or on Preview) before treating D3 as verified.

## Next Phase Readiness

- BRAND-01's three-way compare surface is code-complete: `/proto/branding` mounts real `VariantA`/`VariantB`/`VariantC` behind the existing `?variant=` whitelist and floating switcher, no stub panels remain.
- Plan 03 (if scoped to NOTES.md / PO verdict ritual per D-07) can proceed once a human confirms the D3 live check — either locally outside this sandbox or directly on the Vercel Preview URL.
- No blockers to Plan 03; the only open item is the human/browser verification pass noted in D3, which is a review-scope task, not an implementation gap.

## Self-Check: PASSED

Both created files (`app/proto/branding/variant-b.tsx`, `app/proto/branding/variant-c.tsx`) verified present on disk; both task commits (`50b8b87`, `c1a7c80`) verified present in `git log --oneline --all`.

---
*Phase: 69-proto-design-variants*
*Completed: 2026-07-22*
