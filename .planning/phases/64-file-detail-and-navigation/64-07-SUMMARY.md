---
phase: 64-file-detail-and-navigation
plan: 07
subsystem: ui
tags: [react, tailwind, nextjs, client-component, navigation]

# Dependency graph
requires:
  - phase: 64-file-detail-and-navigation (plans 01-06)
    provides: DetailPageShell, TransactionDetailClient, ExpenseDetailClient, smart-back handleBackClick + attachPopstateRefresh (64-06)
provides:
  - .group ancestor on the three detail-page title wrappers so the shared inline-edit pencil is discoverable on hover (CR-01)
  - hasInAppHistory(historyLength) pure export replacing the document.referrer-based smart-back signal (WR-02)
affects: [64-VERIFICATION.md re-verification, any future work touching detail-page-shell.tsx or the tx/expense datiCard Titolo field]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tailwind .group ancestor on the exact wrapper of a shared group-hover pencil component, without touching the shared component itself"
    - "Pure, DOM-free helper functions (hasInAppHistory, alongside attachPopstateRefresh) exported from a client component for direct unit testing without jsdom"

key-files:
  created: []
  modified:
    - components/detail-pages/detail-page-shell.tsx
    - components/transactions/transaction-detail-client.tsx
    - components/expenses/expense-detail-client.tsx
    - tests/detail-page-shell.test.tsx

key-decisions:
  - "Ancestor-only .group fix chosen over rewriting the shared pencil components to an always-visible-at-reduced-opacity pattern, to avoid risking the tables' already-correct hover behavior and to stay out of the WR-04/IN-05 keyboard-focus scope"
  - "hasInAppHistory(historyLength) is the sole smart-back signal; document.referrer removed entirely because it is fixed at hard navigation and never updated by client-side App Router transitions"

patterns-established:
  - "When a shared group-hover component (pencil, badge, etc.) is reused across a table row and a standalone detail page, verify the ancestor also carries .group on the detail page — TableRow supplies it for free in tables, detail pages do not"

requirements-completed: [DET-08, DET-09]

coverage:
  - id: D1
    description: "Inline-edit pencil is visually discoverable on hover on /transactions/[id], /expenses/[id], and /import/[fileId] (CR-01 closed)"
    requirement: "DET-08"
    verification:
      - kind: unit
        ref: "tests/detail-page-shell.test.tsx#header title wrapper carries the .group class so the inline-edit pencil can reveal on hover (CR-01)"
        status: pass
      - kind: manual_procedural
        ref: "Hover title/displayName on each of the three detail pages; confirm pencil fades in; click to confirm inline edit still opens/saves; confirm table-row pencils unaffected"
        status: unknown
    human_judgment: true
    rationale: "Tailwind's :hover pseudo-class and visual opacity transition cannot be exercised in vitest's node environment; the .group ancestor's presence in rendered HTML is the deterministic proxy, but actual visual discoverability requires a human to look at a real browser"
  - id: D2
    description: "handleBackClick branches solely on hasInAppHistory(window.history.length); document.referrer is never read, so smart-back no longer silently disables itself for a tab that ever loaded from an external referrer (WR-02 closed)"
    requirement: "DET-09"
    verification:
      - kind: unit
        ref: "tests/detail-page-shell.test.tsx#hasInAppHistory (historyLength 0/1/2 cases)"
        status: pass
      - kind: manual_procedural
        ref: "Paste a detail-page URL into a fresh tab (simulating external referrer), navigate to a filtered table, open a detail page, click Indietro — confirm in-app back (filters preserved) is used"
        status: unknown
    human_judgment: true
    rationale: "Requires observing real browser history/back-navigation behavior across a tab that has an external document.referrer; vitest/node cannot simulate window.history.length semantics across real navigations"

duration: 12min
completed: 2026-07-06
status: complete
---

# Phase 64 Plan 07: CR-01 pencil visibility + WR-02 smart-back reliability fix Summary

**Added `.group` Tailwind ancestor to the three detail-page title wrappers so the shared inline-edit pencil is finally discoverable on hover, and replaced the broken `document.referrer` smart-back check with a pure `hasInAppHistory(historyLength)` helper.**

## Performance

- **Duration:** 12 min
- **Completed:** 2026-07-06T14:56:04Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- CR-01 closed: `detail-page-shell.tsx`'s header title wrapper, `transaction-detail-client.tsx`'s Titolo field wrapper, and `expense-detail-client.tsx`'s Titolo field wrapper each gained `.group`, restoring the `opacity-0 group-hover:opacity-100` pencil's hover-reveal on all three detail pages, with zero changes to the shared pencil components themselves or to the tables' own (already-correct) hover behavior.
- WR-02 closed: new pure export `hasInAppHistory(historyLength: number): boolean` (`historyLength > 1`) is now the sole condition driving `handleBackClick`'s branch; the `document.referrer`/`isExternalReferrer` IIFE was removed entirely, so a tab that ever loaded from an external referrer no longer silently and permanently disables smart-back for the rest of its lifetime.
- Both fixes compose cleanly with Plan 64-06's `attachPopstateRefresh` Client-Cache-busting logic — the `else` branch's call order/pairing is byte-for-byte unchanged.

## Task Commits

Each task followed RED → GREEN (tdd="true"):

1. **Task 1: Add `.group` ancestor so the inline-edit pencil is visible (CR-01)**
   - `8f1c9b7` test(64-07): add failing test for header .group class (CR-01)
   - `3b6568e` feat(64-07): add .group ancestor so inline-edit pencil is visible on hover (CR-01)
2. **Task 2: Replace external-referrer check with pure history-length signal (WR-02)**
   - `c08bf06` test(64-07): add failing test for hasInAppHistory pure helper (WR-02)
   - `4cb5a82` feat(64-07): branch handleBackClick solely on hasInAppHistory (WR-02)

**Plan metadata:** committed separately after this summary.

## Files Created/Modified
- `components/detail-pages/detail-page-shell.tsx` - header title wrapper gains `.group`; new `hasInAppHistory` export; `handleBackClick` branches solely on it; `document.referrer`/`isExternalReferrer` removed; JSDoc updated
- `components/transactions/transaction-detail-client.tsx` - Titolo field wrapper (only) gains `.group`
- `components/expenses/expense-detail-client.tsx` - Titolo field wrapper (only) gains `.group`
- `tests/detail-page-shell.test.tsx` - new assertion on the header wrapper's class list; new `describe('hasInAppHistory', ...)` block (historyLength 0/1/2)

## Decisions Made
- Ancestor-only `.group` fix (not a pencil-component rewrite) — see key-decisions above; avoids risking the tables' working hover behavior and keeps WR-04/IN-05 keyboard-focus work out of scope.
- `hasInAppHistory` is a pure, DOM-free function (same "no jsdom needed" precedent as `attachPopstateRefresh` from Plan 64-06) directly unit-testable with plain numbers.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched their `<action>` blocks precisely; grep gates and vitest all passed on the first GREEN attempt.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

CR-01 and WR-02 are closed at the code level. Two items remain human-verification-only (both already flagged `human_judgment: true` in coverage above, consistent with 64-VERIFICATION.md's original human-check requirements):
1. Visual hover-reveal check across all three detail pages + confirmation that table-row pencils are unaffected.
2. Real-browser smart-back check from a tab with an external referrer, confirming in-app history is now preferred whenever `window.history.length > 1`.

No blockers. Ready for re-verification of Phase 64 (`/gsd-plan-phase` re-verify or direct human UAT) to close out the milestone.

---
*Phase: 64-file-detail-and-navigation*
*Completed: 2026-07-06*
