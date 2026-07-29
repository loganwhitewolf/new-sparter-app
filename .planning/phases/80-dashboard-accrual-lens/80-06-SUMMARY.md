---
phase: 80-dashboard-accrual-lens
plan: 06
subsystem: ui
tags: [nextjs, react, url-state, dashboard, tags]

# Dependency graph
requires:
  - phase: 80-01
    provides: "LensSwitch component (disabled/note props), parseLensParam, Lens type — reused unmodified"
provides:
  - "/dashboard/tags renders the global LensSwitch in its disabled+noted state (D-05), so the control's presence is predictable across all four dashboard sub-routes"
  - "Confirmed /tags/[id] receives zero changes across the whole phase (D-06)"
affects: [80-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lens-invariant surface pattern: parse ?lens= for display-only switch state, never thread it into the page's data query — structural inertness, not a conditionally-gated UI"

key-files:
  created: []
  modified:
    - app/(app)/dashboard/tags/page.tsx

key-decisions:
  - "getTagTotals call site left exactly as getTagTotals(userId) — the lens value is parsed only to set LensSwitch's aria-pressed visual state, never passed as an argument (D-05)"
  - "LensSwitch rendered inside a new flex header row (title block + switch) rather than restructuring the existing <h1>/<p> block, matching OverviewHeader's side-by-side placement pattern"

patterns-established: []

requirements-completed: []

# Coverage metadata
coverage:
  - id: D1
    description: "/dashboard/tags always renders the LensSwitch (no conditional gate), disabled, with the Italian note 'i tag sono all-time: la lente non cambia i totali'"
    requirement: "LENS-01"
    verification:
      - kind: unit
        ref: "node_modules/.bin/tsc --noEmit (clean, confirms disabled/note props typed and wired)"
        status: pass
      - kind: manual_procedural
        ref: "grep -c \"getTagTotals(userId)\" app/(app)/dashboard/tags/page.tsx -> 1; no ledgerRowSource/lens argument added"
        status: pass
    human_judgment: true
    rationale: "Visual confirmation that the switch renders visibly disabled (opacity/cursor) with the note text next to the Tag heading requires a live browser render; this sandbox has no browser-automation tool. The structural guarantee (disabled prop passed, getTagTotals untouched) is proven by typecheck + grep."
  - id: D2
    description: "getTagTotals is never called with a ledgerRowSource argument — tags remain lens-invariant by construction"
    requirement: "LENS-01"
    verification:
      - kind: unit
        ref: "grep -c \"getTagTotals(userId)\" app/(app)/dashboard/tags/page.tsx == 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "/tags/[id] receives zero changes in this phase (D-06)"
    verification:
      - kind: unit
        ref: "git diff --quiet HEAD -- 'app/(app)/tags/[id]/page.tsx' (no diff)"
        status: pass
    human_judgment: false

# Metrics
duration: ~10min
completed: 2026-07-29
status: complete
---

# Phase 80 Plan 06: dashboard-accrual-lens tag surface Summary

**`/dashboard/tags` now renders the global LensSwitch disabled with the D-05 no-op note, parsing `?lens=` only for the switch's visual state while `getTagTotals` stays exactly `getTagTotals(userId)`; `/tags/[id]` remains untouched.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-07-29T09:30:43Z
- **Tasks:** 1/1
- **Files modified:** 1

## Accomplishments

- `app/(app)/dashboard/tags/page.tsx` now accepts `searchParams: Promise<{ lens?: string | string[] }>`, parses it via `parseLensParam` (imported from `@/lib/utils/search-params`), and renders `<LensSwitch lens={lens} disabled note="i tag sono all-time: la lente non cambia i totali" />` next to the existing `<h1>Tag</h1>` header block
- `getTagTotals(userId)` call site is byte-identical to before — the parsed `lens` value is used solely to set the switch's `aria-pressed` visual state and is never threaded into any DAL call
- Confirmed `/tags/[id]` (`app/(app)/tags/[id]/page.tsx`) has zero diff — untouched by this plan and by the whole of Phase 80, per D-06
- Contributes the Tags-route leg of D-03's "one global switch, shared identically across all four dashboard sub-routes" contract: the switch is now visibly present on `/dashboard/tags` (not omitted) and its inertness is explained by the note rather than reading as a bug — full D-03 satisfaction across all four routes lands once Plans 80-04/80-05 also complete

## Task Commits

Each task was committed atomically:

1. **Task 1: Render the disabled+noted LensSwitch on /dashboard/tags** - `22759672` (feat)

**Plan metadata:** committed separately at end of this SUMMARY's creation.

## Files Created/Modified

- `app/(app)/dashboard/tags/page.tsx` - gains `searchParams` prop, parses `?lens=` for display-only switch state, renders `<LensSwitch disabled note=...>` in the header row; `getTagTotals(userId)` call site unchanged

## Decisions Made

- **`getTagTotals` call site left untouched.** The parsed `lens` value only drives `LensSwitch`'s `aria-pressed` visual state (so the switch reflects whatever lens the user arrived with via tab navigation); it is never passed as an argument to `getTagTotals`, keeping tags lens-invariant by construction rather than by a disabled UI layered on top of a lens-aware query.
- **Header restructured into a flex row** (title block + switch) rather than appending the switch inside the existing `<div>` — mirrors `OverviewHeader`'s side-by-side year-selector/switch placement pattern from Plan 80-01.
- **`requirements.mark-complete` NOT run for LENS-01**, despite this plan's frontmatter listing it as its sole requirement. Plans 80-04 and 80-05 (the `/dashboard/overview` full-reflection wiring and `/dashboard/categories`/`/dashboard/categories/[id]` switch wiring) had not yet executed at the time this plan ran, so D-03's "all four sub-routes" contract is only partially satisfied. Deferred to Plan 80-07, the closure plan that depends on 80-04/80-05/80-06 together.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `node_modules/.bin/tsc --noEmit` clean on first attempt. `yarn check:language` passed (no new non-English dev-facing strings; the Italian note is an intentional product surface per CLAUDE.md's Language Convention). Acceptance criteria greps confirmed:
- `grep -c "getTagTotals(userId)" app/(app)/dashboard/tags/page.tsx` → `1`
- `git diff --quiet HEAD -- 'app/(app)/tags/[id]/page.tsx'` → no diff
- Post-commit deletion check: no files deleted by the commit

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four dashboard sub-routes (`/dashboard/overview`, `/dashboard/categories`, `/dashboard/categories/[id]`, `/dashboard/tags`) now render the global `LensSwitch` per D-03/D-04; Plan 80-07 (if scoped to the remaining categories/categories-detail wiring or final phase closure) can proceed.
- **Known gap (carried from Plan 80-01):** interactive browser click-through of the switch's disabled visual state (opacity/cursor-not-allowed, note text rendering) was not manually driven in this sandbox — same rationale as 80-01's D5. Recommend a quick manual spot-check of `/dashboard/tags` before considering the phase's UI fully signed off, or defer to the phase-level UAT pass at Phase 80 close.
- **`requirements.mark-complete` NOT run for LENS-01.** This plan's frontmatter lists `requirements: [LENS-01]`, but Plans 80-04 (`/dashboard/overview` full lens reflection + lens-aware year selector) and 80-05 (`/dashboard/categories`, `/dashboard/categories/[id]` switch wiring) have not yet executed — no `80-04-SUMMARY.md`/`80-05-SUMMARY.md` exist on disk at the time of this plan's execution. D-03's "one global switch, shared identically across all four dashboard sub-routes" is only fully satisfied once all four routes render/wire it; marking LENS-01 complete now would misstate coverage in REQUIREMENTS.md. Consistent with this phase's own established precedent (80-01/80-02/80-03 SUMMARYs). Plan 80-07 (which depends on 80-04, 80-05, AND 80-06) is the natural closure point for LENS-01/02/04/05.

## Self-Check: PASSED

- FOUND: app/(app)/dashboard/tags/page.tsx
- FOUND commit: 22759672

---
*Phase: 80-dashboard-accrual-lens*
*Completed: 2026-07-29*
