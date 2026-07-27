---
phase: 76-reimbursements-section
plan: 06
subsystem: reimbursements
tags: [uat, human-verify, nextjs, rsc, gap-closure]

# Dependency graph
requires:
  - phase: 76-reimbursements-section (Plans 76-01..76-05)
    provides: the full /reimbursements list + detail surfaces, transactions row-indicator + sidebar nav, and the /transactions/[id] summary panel this checkpoint exercises end-to-end
provides:
  - "Human confirmation that the Phase 76 Rimborsi journey (sidebar -> list -> filter/sort/search -> detail -> edit-title -> add/remove refund -> delete -> tx-page summary -> badge link) works in a running app"
  - "Two UAT-driven gap fixes: no-404 redirect on reimbursement removal, and removal of the synthetic 'rimborso <anchor>' refund-title rewrite"
affects: [reimbursements, transaction-pairs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional onGone callback on ReimbursementPanel decouples 'reimbursement no longer exists' from router.refresh(), letting the detail host navigate to the list instead of refreshing into a notFound() 404"

key-files:
  created: []
  modified:
    - components/transactions/reimbursement-panel.tsx
    - components/reimbursements/reimbursement-detail-client.tsx
    - lib/services/transaction-pairs.ts
    - tests/transaction-pairs-service.test.ts

key-decisions:
  - "UAT gap #2 scoped to title-only (user choice): the refund expense keeps its own title; the ADR 0016 decision-2 recategorization/isolation (subcategory + synthetic descriptionHash) is deliberately UNCHANGED, so dashboard netting/per-category totals are untouched"
  - "onGone fires on delete AND on removing the LAST refund (data.refunds.length === 1), since dissolving the last refund also removes the reimbursement row"

patterns-established:
  - "Checkpoint-only verification plan: no code of its own, but UAT-discovered gaps are fixed inline within the same execute-phase run and re-verified before the phase is sealed"

requirements-completed: [RMB-10, RMB-11]

coverage:
  - id: D1
    description: "Full Rimborsi user journey (sidebar, list search/status-filter/sort + colored badges, detail, edit-title with empty-title fallback, add/remove refund, delete, tx-page read-only summary + 'Gestisci rimborso' link, clickable transactions badge) works in the running app"
    requirement: "RMB-10"
    verification:
      - kind: manual_procedural
        ref: "76-06-PLAN.md checkpoint — 9-step manual UAT, dev server http://localhost:3000"
        status: pass
    human_judgment: true
    rationale: "Browser-level RSC rendering + client interaction; this repo has no jsdom/e2e runner, so only a human can confirm the rendered journey"
  - id: D2
    description: "Per-reimbursement page shows anchor / refunds / net / residual with in-place management, and no Group-anchored reimbursement is reachable anywhere in the new UI (RMB-08 descope in force)"
    requirement: "RMB-11"
    verification:
      - kind: manual_procedural
        ref: "76-06-PLAN.md checkpoint steps 3-9"
        status: pass
    human_judgment: true
    rationale: "Group-anchor invisibility and net/residual correctness must be confirmed by direct observation, not only by DAL-level filters/tests"
  - id: D3
    description: "Removing a reimbursement (delete, or unlinking the last refund) from /reimbursements/[id] returns to the list instead of a 404 (UAT gap #1)"
    verification:
      - kind: unit
        ref: "tests/reimbursement-panel.test.ts (37 pass) + manual UAT re-verification"
        status: pass
      - kind: manual_procedural
        ref: "76-06 re-verification — delete + remove-last-refund land on /reimbursements"
        status: pass
    human_judgment: false
  - id: D4
    description: "Linking a refund no longer rewrites its expense title to 'rimborso <anchor>'; the refund keeps its own title, recategorization unchanged (UAT gap #2)"
    requirement: "RMB-11"
    verification:
      - kind: unit
        ref: "tests/transaction-pairs-service.test.ts#createPair — refund cleanup (decision 2)"
        status: pass
      - kind: manual_procedural
        ref: "76-06 re-verification — refund keeps its own name after link/unlink/relink"
        status: pass
    human_judgment: false

# Metrics
duration: ~45min
completed: 2026-07-27
status: complete
---

# Phase 76 Plan 06: Full Rimborsi journey — human UAT + two gap fixes

**Human-approved end-to-end confirmation of the dedicated Rimborsi section, plus two UAT-discovered fixes: a no-404 redirect when a reimbursement is removed, and removal of the synthetic "rimborso &lt;anchor&gt;" refund-title rewrite.**

## Performance

- **Duration:** ~45 min (checkpoint + two inline gap fixes + full-suite re-verification)
- **Completed:** 2026-07-27
- **Tasks:** 1 checkpoint (approved) + 2 gap fixes
- **Files modified:** 4

## Accomplishments
- Manual UAT of the whole Phase 76 journey approved by the user in a running app — the browser-level confirmation every prior plan explicitly deferred here (this repo has no jsdom/e2e runner).
- Fixed UAT gap #1: `ReimbursementPanel` gained an optional `onGone` callback; deleting a reimbursement or unlinking its last refund from `/reimbursements/[id]` now navigates to `/reimbursements` instead of `router.refresh()`-ing into a `notFound()` 404.
- Fixed UAT gap #2: `createPairTx` no longer rewrites the refund expense title to `"{own title} — rimborso {anchor}"`; the refund keeps its own title. The decision-2 recategorization/isolation is unchanged, so netting/per-category totals are untouched.
- Full suite green after fixes: 149 files / 1833 passed / 1 todo; `tsc --noEmit` clean; `check:language` passed.

## Task Commits

Checkpoint plan (no code of its own). UAT-driven gap fixes committed atomically:

1. **Gap #1 — no-404 redirect on reimbursement removal** - `40f27c1` (fix)
2. **Gap #2 — stop auto-renaming the refund expense** - `3eead2e` (fix)

## Files Created/Modified
- `components/transactions/reimbursement-panel.tsx` - added optional `onGone`; fired on delete and on removing the last refund
- `components/reimbursements/reimbursement-detail-client.tsx` - passes `onGone={() => router.push(APP_ROUTES.reimbursements)}`
- `lib/services/transaction-pairs.ts` - refund title kept unchanged at link time (no "rimborso {anchor}" prefix)
- `tests/transaction-pairs-service.test.ts` - three title assertions updated to expect the refund's own title; comment updated

## Decisions Made
- **Gap #2 scope (user choice): title-only.** Only the title rewrite was removed; the ADR 0016 decision-2 recategorization + standalone-expense isolation stay, so dashboard netting and per-category breakdown are unaffected.
- **`onGone` trigger on last-refund removal** uses `data.refunds.length === 1` (the pre-removal count), because dissolving the last refund removes the reimbursement row and would otherwise 404 on refresh.

## Deviations from Plan
None for the checkpoint itself — the plan is a verification gate. The two fixes are UAT-driven gap closures handled inline within the same execute-phase run and re-verified before sealing the phase.

## Issues Encountered
Two issues surfaced during UAT and were resolved (see gap fixes above): the detail-page 404 on reimbursement removal, and the unwanted "rimborso &lt;titolo&gt;" description added to refunds at link time.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Phase 76 is the last phase of milestone v2.8 (Reimbursements 1:N). RMB-10 and RMB-11 are complete. The dedicated Rimborsi section (list + per-reimbursement page + linking surfaces) ships the milestone's user-facing home for reimbursements.

---
*Phase: 76-reimbursements-section*
*Completed: 2026-07-27*
