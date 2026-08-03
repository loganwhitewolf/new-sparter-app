---
phase: 260803-e9w
plan: 01
subsystem: ui, categorization
tags: [accessibility, sr-only, aria-label, category-ranking-list, category-direction-copy]

requires:
  - phase: 83-categories-list
    provides: category-ranking-list.tsx allocation branch, category-direction-copy.ts (D-11)
provides:
  - CategoryDirectionCopy.rowAccessibleSuffix (out/in share wording, allocation distinct)
  - Allocation row sr-only accessible-name text (WR-01 closed)
  - Restored D-13/CLIST-07 rationale comment above the Link href (WR-02 closed)
affects: [83-categories-list, 84-category-detail-and-cleanup]

actuals:
  tokens: 1753
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Visually-hidden accessible-name text: sr-only <span> nested inside a non-<a> element, since author-naming attributes (aria-label) are prohibited on the implicit `generic` role"

key-files:
  created: []
  modified:
    - lib/services/category-direction-copy.ts
    - tests/category-direction-copy.test.ts
    - components/dashboard/category-ranking-list.tsx
    - tests/category-ranking-list.test.tsx

key-decisions:
  - "rowAccessibleSuffix is a suffix (not a template), honest per direction: 'apri dettaglio categoria' for out/in (byte-identical to the prior hardcoded string), 'dettaglio non disponibile' for allocation"
  - "sr-only nested text, not aria-label, for the allocation span — a bare <span> has implicit role generic, which the ARIA spec prohibits from taking an author-supplied name; this was locked before this plan started (see PLAN.md Context) and not re-derived"
  - "aria-disabled=\"true\" and no role attribute on the allocation span — unchanged, per locked decision"

requirements-completed: []

coverage:
  - id: D1
    description: "CategoryDirectionCopy exposes rowAccessibleSuffix for all three directions (out/in identical, allocation distinct); no branch consumes a dead value"
    verification:
      - kind: unit
        ref: "tests/category-direction-copy.test.ts#out and in share the identical rowAccessibleSuffix; allocation differs"
        status: pass
    human_judgment: false
  - id: D2
    description: "Allocation row's span keeps aria-disabled=\"true\" and no role attribute, gains a nested sr-only text node explaining the detail is unavailable (WR-01 closed), zero visible/layout change"
    verification:
      - kind: unit
        ref: 'tests/category-ranking-list.test.tsx#WR-01: out/in rows carry the copy-service aria-label; allocation row carries sr-only accessible text and stays aria-disabled'
        status: pass
    human_judgment: false
  - id: D3
    description: "out/in Link keeps its existing aria-label wording, now assembled from the copy service instead of hardcoded"
    verification:
      - kind: unit
        ref: 'tests/category-ranking-list.test.tsx#WR-01: out/in rows carry the copy-service aria-label; allocation row carries sr-only accessible text and stays aria-disabled'
        status: pass
    human_judgment: false
  - id: D4
    description: "D-13/CLIST-07 rationale comment restored above the Link's href expression, in addition to the existing CR-01 comment (WR-02 closed)"
    verification:
      - kind: other
        ref: "components/dashboard/category-ranking-list.tsx:108-109 (visual grep, no automated assertion — comments are not testable at runtime)"
        status: pass
    human_judgment: true
    rationale: "Comment presence/wording is not observable at runtime; confirmed by direct file inspection during execution, not a test"
  - id: D5
    description: "The two pre-existing 83-06 tests (aria-disabled present; zero <a> for allocation, intact links for out/in) pass unchanged; full suite shows no new failures against the 180-file/2198-passing/1-todo baseline"
    verification:
      - kind: unit
        ref: "node_modules/.bin/vitest run (180 files, 2200 passed, 1 todo — baseline 2198 + 2 new tests)"
        status: pass
      - kind: other
        ref: "node_modules/.bin/tsc --noEmit"
        status: pass
      - kind: other
        ref: "yarn check:language"
        status: pass
      - kind: other
        ref: "yarn build"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-08-03
status: complete
---

# Quick Task 260803-e9w: Allocation row accessible name + D-13/CLIST-07 comment Summary

**Allocation-direction rows now carry a nested sr-only "dettaglio non disponibile" explaining why `aria-disabled="true"` is set; the D-13/CLIST-07 href-coherence comment is restored above the `Link`, both routed through `CategoryDirectionCopy.rowAccessibleSuffix` (D-11) with zero visible/layout change.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2/2
- **Files modified:** 4

## Accomplishments

- `CategoryDirectionCopy` gained `rowAccessibleSuffix`: `'apri dettaglio categoria'` for `out`/`in` (byte-identical to the string that was previously hardcoded in the component), `'dettaglio non disponibile'` for `allocation`.
- The `allocation` `<span>` now nests `<span className="sr-only">{copy.rowAccessibleSuffix}</span>` right after the visible category name — a screen-reader user now gets "CategoryName dettaglio non disponibile" instead of silence after `aria-disabled="true"`. No `role` attribute added; no visible pixels or layout change (`sr-only` is Tailwind's built-in visually-hidden utility, already used 15+ times in this codebase).
- The `out`/`in` `<Link>`'s `aria-label` is now assembled from the copy service (`` `${category.name}: ${copy.rowAccessibleSuffix}` ``) instead of a hardcoded string — resulting text is unchanged.
- Restored the `D-13/CLIST-07` rationale comment directly above the `<Link>`'s `href=` expression, in addition to (not instead of) the existing `CR-01` comment above the ternary.

## Task Commits

1. **Task 1: Add `rowAccessibleSuffix` to the copy service (D-11)** - `19ea3e86` (feat)
2. **Task 2: Consume the field in the component; restore the D-13/CLIST-07 comment** - `64403c6a` (fix)

## Files Created/Modified

- `lib/services/category-direction-copy.ts` - added `rowAccessibleSuffix` field, exhaustive over the 3-direction switch
- `tests/category-direction-copy.test.ts` - assertions on the new field per direction + a dedicated out/in-shared-vs-allocation-distinct test
- `components/dashboard/category-ranking-list.tsx` - allocation span gains nested sr-only text; Link `aria-label` sourced from copy; restored D-13/CLIST-07 comment
- `tests/category-ranking-list.test.tsx` - new test asserting the copy-sourced `aria-label` on out/in and the exact sr-only element on allocation, alongside the pre-existing `aria-disabled="true"` guard

## Decisions Made

None beyond what the plan already locked (see plan Context: `sr-only` mechanism chosen over `aria-label`/`role="link"` before this execution started — not re-derived here).

## Deviations from Plan

None - plan executed exactly as written.

## Auth Gates

None.

## Known Stubs

None.

## Threat Flags

None — comment/aria-only surface, no new network/auth/schema surface introduced.

## Issues Encountered

None.

## must_haves verification

- [x] `CategoryDirectionCopy` exposes `rowAccessibleSuffix` for all three directions; `out`/`in` identical, `allocation` distinct.
- [x] Allocation row's `<span>` keeps `aria-disabled="true"`, no `role` attribute, new nested `sr-only` text node.
- [x] `out`/`in` `<Link>` keeps existing `aria-label` wording, now sourced from the copy service.
- [x] `D-13/CLIST-07` comment present above the `<Link>`'s `href=`, in addition to `CR-01`.
- [x] The two pre-existing 83-06 tests pass unchanged.
- [x] `yarn build` and `yarn check:language` pass; full suite (180 files, 2200 passed + 1 todo) shows no new failures against the 180/2198/1 baseline (2 new tests added).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Both non-blocking warnings from `83-REVIEW.md` (WR-01, WR-02) are closed. No open items block Phase 84 (`category-detail-and-cleanup`).

## Self-Check: PASSED

- FOUND: lib/services/category-direction-copy.ts
- FOUND: tests/category-direction-copy.test.ts
- FOUND: components/dashboard/category-ranking-list.tsx
- FOUND: tests/category-ranking-list.test.tsx
- FOUND: commits 19ea3e86, 64403c6a

---
*Quick task: 260803-e9w*
*Completed: 2026-08-03*
