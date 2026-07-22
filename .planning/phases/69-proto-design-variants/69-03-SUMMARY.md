---
phase: 69-proto-design-variants
plan: 03
subsystem: ui
tags: [nextjs, proto, marketing, design-lock, docs]

requires:
  - phase: 69-01
    provides: "Hub + ?variant= switcher, Variant A (shot-as-plane), scoped Fraunces display font"
  - phase: 69-02
    provides: "Variant B (editorial split) and Variant C (type-led stack) — three-way compare surface complete"
provides:
  - "app/proto/branding/NOTES.md as the BRAND-02 design-lock source of truth (D-07): Domanda / Come provarlo / Varianti / Verdetto PO"
  - "PO verdict recorded: Winner = c (Type-led stack), with Steal-from-losers and Do-not-ship notes for Phase 71"
  - "BRAND-02 marked complete in REQUIREMENTS.md (checkbox follows the written NOTES.md verdict, not the other way around — D-07)"
affects: [71-marketing-pages]

tech-stack:
  added: []
  patterns:
    - "NOTES.md winner ritual (Domanda/Come provarlo/Varianti/Verdetto PO) as the design-lock handoff artifact for the next phase — same ritual as the historical table-toolbar proto"

key-files:
  created:
    - app/proto/branding/NOTES.md
  modified:
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Winner = Variant C (Type-led stack) — PO's explicit call ('mi piace il prototipo 3') after comparing all three on /proto/branding"
  - "Steal from losers: pull a's dominant product-visual weight and b's editorial type/asymmetric-column treatment into the winning layout where useful, without reintroducing a's full-bleed hero or b's two-column split"
  - "Do not ship a or b as the primary homepage layout; no components/marketing/* extraction in this phase (D-09) — that is Phase 71's job"
  - "Winner line rewritten from '**Winner:** c' to '**Winner: c**' (bold closes after the value, not after the colon) — Rule 1 formatting fix so the plan's own automated verify regex (grep -E 'Winner:[[:space:]]*[abcABC]') matches; no semantic change"

requirements-completed: [BRAND-02]

coverage:
  - id: D1
    description: "app/proto/branding/NOTES.md exists with Domanda, Come provarlo, Varianti (a/b/c one-sentence structural summaries matching what was actually shipped), and Verdetto PO fields, per D-07"
    requirement: "BRAND-02"
    verification:
      - kind: other
        ref: "test -f app/proto/branding/NOTES.md && grep -q 'Verdetto PO' ... (Task 1 <verify>) — all pass"
        status: pass
    human_judgment: false
  - id: D2
    description: "After human Preview review, Verdetto PO records the winning variant (c) plus handoff notes for Phase 71; REQUIREMENTS.md BRAND-02 checkbox follows the written verdict, not the other way around"
    requirement: "BRAND-02"
    verification:
      - kind: other
        ref: "grep -E 'Winner:[[:space:]]*[abcABC]' app/proto/branding/NOTES.md (Task 2 <verify>) — pass, matches 'c'"
        status: pass
    human_judgment: false
  - id: D3
    description: "PO/stakeholder visual judgment that Variant C (Type-led stack) is the credible, non-generic finance brand direction to promote to production (the actual design-lock decision itself)"
    human_judgment: true
    verification: []
    rationale: "Subjective design-lock judgment belongs to the human PO, not to automated verification — this plan's job was only to scaffold the ritual and faithfully record the human's answer, never to originate or infer it"

duration: 3min (Task 1 + Task 2 execution; excludes the human review time between the checkpoint and the resumed session)
completed: 2026-07-22
status: complete
---

# Phase 69 Plan 03: NOTES.md Design-Lock Template + PO Verdict Summary

**BRAND-02 closed: `app/proto/branding/NOTES.md` design-lock ritual shipped and filled — PO picked Variant C (Type-led stack) as the production direction, with explicit steal/do-not-ship notes for Phase 71.**

## Performance

- **Duration:** ~3 min of executor work across two sessions (Task 1, then a human checkpoint, then Task 2 in this continuation)
- **Started:** 2026-07-22T17:39:xxZ (Task 1)
- **Completed:** 2026-07-22T16:13:xxZ (Task 2, this session)
- **Tasks:** 2 completed (1 automated, 1 human checkpoint)
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- `app/proto/branding/NOTES.md` created as the BRAND-02 design-lock source of truth (D-07): Domanda (which A+B direction becomes the production homepage), Come provarlo (local `PROTOTYPES_ENABLED=1 yarn dev` path + Vercel Preview path + Production-404 note), Varianti (one-sentence structural summary per a/b/c matching what Plan 01/02 actually shipped), and a blank Verdetto PO template
- Human checkpoint executed per plan (`autonomous: false`, `gate="blocking"` on Task 2) — no winner was fabricated; the executor stopped and returned a structured checkpoint after Task 1, confirming the `app/proto/layout.tsx` gate (`PROTOTYPES_ENABLED`, `force-dynamic`, `robots noindex`) was still intact before the Preview review
- PO verdict recorded after Preview compare: **Winner = c (Type-led stack)**; Steal from losers = a's dominant product-visual weight + b's editorial type/asymmetric-column treatment; Do not ship = a/b as primary homepage layout, and no `components/marketing/*` extraction yet (D-09, Phase 71's job)
- `REQUIREMENTS.md` BRAND-02 checkbox and traceability row flipped to complete — done *after* the written verdict existed in NOTES.md, consistent with D-07 (NOTES.md is the source of truth; the checkbox follows it, never precedes it)

## Task Commits

1. **Task 1: Write NOTES.md design-lock template** - `0d9a9cc` (feat)
2. **Task 2: PO Preview compare + fill NOTES verdict** - `807787a` (docs)

**Plan metadata:** committed with this SUMMARY

_Note: Task 2 spanned a human checkpoint — the executor stopped after Task 1, returned a `checkpoint:human-verify` (gate: blocking), and resumed only once the PO's verdict was available._

## Files Created/Modified

- `app/proto/branding/NOTES.md` - Design-lock handoff for Phase 71: Domanda/Come provarlo/Varianti template (Task 1), then filled Verdetto PO with Winner=c, Steal from losers, Do not ship (Task 2)
- `.planning/REQUIREMENTS.md` - BRAND-02 checkbox + traceability row marked complete via `requirements.mark-complete`, run only after the NOTES.md verdict was written

## Decisions Made

- **Winner = Variant C (Type-led stack)** — PO's direct call ("mi piace il prototipo 3") after comparing all three structural variants on `/proto/branding`. No AI-inferred or default winner; the executor never proposed a or b as a fallback.
- **Steal-from-losers notes are directional, not a task list** — they flag which visual qualities of a (dominant product screenshot) and b (editorial type weight, asymmetric column) are worth carrying into the Phase 71 production build of C, without prescribing exact implementation. That's Phase 71's planning job.
- **Rule 1 formatting fix on the Winner line** — the plan's own automated verify (`grep -E 'Winner:[[:space:]]*[abcABC]'`) requires whitespace immediately after `Winner:`, but the natural Markdown phrasing `**Winner:** c` places the closing `**` bold marker between the colon and the value, which the regex doesn't match. Rewrote to `**Winner: c**` (bold wraps the whole label+value, matching the historical table-toolbar NOTES.md precedent's `**Vincitore: A — …**` style) — semantically identical, verify now passes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Winner line format broke the plan's own verify regex**
- **Found during:** Task 2 verification, immediately after the orchestrator filled in the Verdetto PO
- **Issue:** `- **Winner:** c` places `**` (bold-close) directly between `Winner:` and the value, so `grep -E 'Winner:[[:space:]]*[abcABC]'` (the plan's Task 2 `<verify>` command) does not match — `[[:space:]]*` cannot skip over the two asterisk characters.
- **Fix:** Reworded to `- **Winner: c** — Type-led stack. Confermato dall'utente ("mi piace il prototipo 3", 2026-07-22).` — bold now wraps the whole `Winner: c` string, matching the historical `**Vincitore: A — …**` precedent from `app/proto/table-toolbar/NOTES.md` @ `e51aff2`. Content/meaning unchanged.
- **Files modified:** `app/proto/branding/NOTES.md`
- **Verification:** `grep -E 'Winner:[[:space:]]*[abcABC]' app/proto/branding/NOTES.md` now matches; `yarn check:language` still passes.
- **Committed in:** `807787a` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (cosmetic formatting fix to satisfy the plan's own automated verify)
**Impact on plan:** No scope creep, no content change to the PO's actual verdict — the fix only adjusted where a Markdown bold marker closes.

## Issues Encountered

None beyond the deviation above. The `app/proto/layout.tsx` gate was re-confirmed intact (`PROTOTYPES_ENABLED` check, `force-dynamic`, `robots: noindex`) before treating the checkpoint as satisfied, per the task's `read_first` instruction.

## User Setup Required

None. The human action required by this plan (the PO Preview review + verdict itself) is the checkpoint that was just satisfied — not an external service configuration step.

## Next Phase Readiness

- **BRAND-02 is satisfied.** `app/proto/branding/NOTES.md` is the locked design-lock artifact: Winner = c (Type-led stack), with explicit steal/do-not-ship notes. Phase 71 (marketing-pages) can read this file directly as its design-direction input — no further PO sign-off needed for the *which layout* question.
- Phase 71 should treat Variant C's structure (`app/proto/branding/variant-c.tsx`) as the closest analog for the production homepage, while pulling in the noted steal items (a's product-visual weight, b's editorial type treatment) during that phase's own planning — this plan intentionally does not prescribe how.
- Per D-09, no `components/marketing/*` extraction happened in this phase — `app/proto/branding/**` remains throwaway, Preview-gated, `noindex`. Phase 71 owns the promotion.
- No blockers. Phase 69 (proto-design-variants) is now fully complete: BRAND-01 (Plan 02) and BRAND-02 (this plan) are both satisfied.

## Self-Check: PASSED

`app/proto/branding/NOTES.md` verified present on disk with Verdetto PO filled (Winner: c). Both task commits (`0d9a9cc`, `807787a`) verified present in `git log --oneline --all`.

---
*Phase: 69-proto-design-variants*
*Completed: 2026-07-22*
