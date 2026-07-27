---
phase: 76-reimbursements-section
plan: 05
subsystem: reimbursements
tags: [drizzle, raw-sql, decimal, rsc, nextjs, server-actions]

# Dependency graph
requires:
  - phase: 76-reimbursements-section (Plan 76-01)
    provides: getReimbursementList DAL, deriveResidualFromAggregates, reimbursement-format helpers, APP_ROUTES.reimbursements + reimbursementHref(id)
  - phase: 76-reimbursements-section (Plan 76-04)
    provides: "ReimbursementPanel variant prop ('summary' | 'management', default 'management') — the dedicated page mounts it with no variant prop to inherit the full management body unchanged"
provides:
  - "getReimbursement(userId, reimbursementId) — IDOR + T-76-05 Group-anchor guard, returns ReimbursementHeader | undefined"
  - "getReimbursementPanelDataById({userId, reimbursementId}) — id-based counterpart to getReimbursementPanelData, sharing assemblePanelDataForReimbursement so both entry points can never numerically diverge"
  - "getReimbursementAnchorTransaction({userId, reimbursementId}) — resolves one representative D-08 frozen anchor-transaction member for RefundPickerDialog's anchor prop"
  - "updateReimbursementTitle({userId, reimbursementId, title}) — ownership-scoped, idempotent title write"
  - "updateReimbursementTitleAction (lib/actions/reimbursement.ts) + UpdateReimbursementTitleSchema (lib/validations/reimbursement.ts, deliberately no .min(1))"
  - "/reimbursements/[id] — the per-reimbursement detail page (RMB-11's complete contract: anchor, refunds, net, residual, edit-title, add/remove/delete refund)"
affects: [76-06-phase-checkpoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "assemblePanelDataForReimbursement: private tail extracted from getReimbursementPanelData, shared by the anchor-based and id-based panel-data lookups — one assembly path, two entry points, so they can never numerically diverge"
    - "Reimbursement-property action module (lib/actions/reimbursement.ts) kept distinct from lib/actions/transaction-pairs.ts's linking-mechanics actions"

key-files:
  created:
    - lib/validations/reimbursement.ts
    - lib/actions/reimbursement.ts
    - "app/(app)/reimbursements/[id]/page.tsx"
    - components/reimbursements/reimbursement-detail-client.tsx
    - components/reimbursements/reimbursement-title-edit.tsx
    - tests/reimbursement-detail-dal.test.ts
  modified:
    - lib/dal/reimbursement.ts

key-decisions:
  - "Badge in the detail-client's status card omits the `variant` prop entirely (relies on residualBadgeClassName's className override via twMerge) — the plan's own acceptance criteria required zero `variant=` occurrences anywhere in reimbursement-detail-client.tsx, a stricter constraint than the pre-existing reimbursement-table.tsx convention (which does pass variant=\"outline\"); verified the resulting Tailwind class merge is visually equivalent since residualBadgeClassName already sets border-0/bg-*/text-* which twMerge resolves over the default variant's base classes."

patterns-established:
  - "Id-based DAL lookup sharing its assembly tail with an existing anchor-based lookup, rather than duplicating the refunds+residual query — reusable for any future id-first detail surface."

requirements-completed: [RMB-11]

coverage:
  - id: D1
    description: "getReimbursement scopes on BOTH userId AND expenseId IS NOT NULL — a foreign-owned id and a Group-anchored id (same user) both resolve to undefined -> notFound()"
    requirement: RMB-11
    verification:
      - kind: integration
        ref: "tests/reimbursement-detail-dal.test.ts — getReimbursement suite (3 tests: owned header, cross-user IDOR, Group-anchor exclusion)"
        status: pass
    human_judgment: false
  - id: D2
    description: "getReimbursementPanelDataById returns the identical shape as getReimbursementPanelData({anchor: {transactionId}}) for the same reimbursement (RMB-11 precision, one assembly path)"
    requirement: RMB-11
    verification:
      - kind: integration
        ref: "tests/reimbursement-detail-dal.test.ts — 'returns the identical shape' test (toEqual on both results) + Group-anchor exclusion test"
        status: pass
    human_judgment: false
  - id: D3
    description: "getReimbursementAnchorTransaction resolves a genuine outflow member of the D-08 frozen anchor set, IDOR-scoped"
    requirement: RMB-11
    verification:
      - kind: integration
        ref: "tests/reimbursement-detail-dal.test.ts — getReimbursementAnchorTransaction suite (2 tests: negative-amount outflow assertion, cross-user IDOR)"
        status: pass
    human_judgment: false
  - id: D4
    description: "updateReimbursementTitle is idempotent (double-submit safe) and ownership-scoped (a tampered userId throws and leaves the title unchanged)"
    requirement: RMB-11
    verification:
      - kind: integration
        ref: "tests/reimbursement-detail-dal.test.ts — updateReimbursementTitle suite (2 tests: idempotent double-submit, concurrency/ownership guard)"
        status: pass
    human_judgment: false
  - id: D5
    description: "getReimbursementPanelData's existing tests and every other reimbursement DAL consumer test pass unmodified after the assemblePanelDataForReimbursement extraction"
    verification:
      - kind: integration
        ref: "yarn vitest run across tests/reimbursement-list.test.ts, tests/reimbursement-phase-75.test.ts, tests/reimbursement-residual.test.ts, tests/reimbursement-panel.test.ts, tests/reimbursement-invariant.test.ts, tests/reimbursement-guard-group-anchor.test.ts, tests/reimbursement-table-sort.test.ts, tests/reimbursement-regression.test.ts — 76 tests, all pass"
        status: pass
    human_judgment: false
  - id: D6
    description: "/reimbursements/[id] renders the full header + management panel end-to-end (DB -> DAL -> route -> page) for an owned Expense-anchored reimbursement, and the panel is mounted with no variant prop (inherits the full-management default)"
    requirement: RMB-11
    verification:
      - kind: other
        ref: "yarn tsc --noEmit (clean); grep -c \"notFound()\" page.tsx == 2; grep -c \"variant=\" reimbursement-detail-client.tsx == 0; grep -c \"resolveReimbursementDisplayTitle\" reimbursement-title-edit.tsx > 0"
        status: pass
      - kind: manual_procedural
        ref: "Deferred to the Plan 76-06 phase checkpoint per this plan's own <verification> section (no jsdom in this repo for render-branch assertions)"
        status: pending
    human_judgment: true
    rationale: "Visual/interactive confirmation of the full page (header, edit-title, add/remove/delete refund) requires a running dev server — deferred to the Plan 76-06 checkpoint, matching the established Phase 75/76 precedent for every UI-only acceptance item in this phase."

duration: ~35min
completed: 2026-07-27
status: complete
---

# Phase 76 Plan 05: Per-Reimbursement Detail Page Summary

**`/reimbursements/[id]` — header (editable title + D-07 status KPI + anchor link) over the reused Plan 76-04 `ReimbursementPanel` full-management variant, closing RMB-11's complete contract**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-07-27
- **Tasks:** 3
- **Files modified:** 7 (6 created, 1 modified)

## Accomplishments
- Extracted `assemblePanelDataForReimbursement` as a private tail out of `getReimbursementPanelData`, shared by the new id-based `getReimbursementPanelDataById` — one assembly path, two entry points, proven identical by a direct `toEqual` comparison in the new test suite (RMB-11 precision).
- Added `getReimbursement(userId, reimbursementId)`: the page's IDOR-guard lookup, scoped on BOTH `userId` AND `expenseId IS NOT NULL` in one WHERE clause — a foreign-owned id and a Group-anchored id (even owned by the same user) both resolve to `undefined`, no distinguishing signal (T-76-01, T-76-05).
- Added `getReimbursementAnchorTransaction`: resolves one representative D-08 frozen anchor-transaction member (`occurredAt ASC, id ASC` tie-break), the source for `RefundPickerDialog`'s anchor prop.
- Added `updateReimbursementTitle`: ownership-scoped UPDATE, throws `'Rimborso non trovato.'` on a zero-row update (never silently no-ops), proven idempotent under double-submit.
- `lib/validations/reimbursement.ts` + `lib/actions/reimbursement.ts`: the edit-title Zod schema (deliberately no `.min(1)` — D-03, an empty title is a valid fallback-triggering state) and server action (parse → verifySession → ownership-scoped DAL write → revalidate both the detail and list routes).
- `/reimbursements/[id]`: IDOR/Group-anchor guard via `getReimbursement` → `notFound()` (mirrors `/tags/[id]`'s skeleton), then `getReimbursementPanelDataById` + `getReimbursementAnchorTransaction` resolved in parallel and handed to a client shell.
- `ReimbursementDetailClient`: header (inline title edit, D-07 KPI-style status Card, anchor link to the Expense) + the reused `ReimbursementPanel` mounted with **no** `variant` prop (inherits the full add/remove/delete `management` default from Plan 76-04, unchanged) + `RefundPickerDialog` for add-refund, guarded on `anchorTransaction` being defined.
- `ReimbursementTitleEdit`: inline pencil-toggle edit mirroring `TransactionTitleEdit`'s detail variant — displayed text goes through `resolveReimbursementDisplayTitle` (D-03 fallback), while the edit input is seeded with the raw title so clearing it back to `''` is possible and meaningful.
- 9 new real-Postgres integration tests (`tests/reimbursement-detail-dal.test.ts`) covering all four new DAL functions, including cross-user IDOR, Group-anchor exclusion (T-76-05 defense in depth), panel-data parity between the two entry points, anchor-transaction outflow-sign correctness, and title idempotency/concurrency.
- Confirmed behavior-preservation: all 76 pre-existing tests across 8 reimbursement test files (list, phase-75, residual, panel, invariant, guard-group-anchor, table-sort, regression) pass unmodified after the extraction.

## Task Commits

Each task was committed atomically:

1. **Task 1: DAL — header lookup, panel-data-by-id, anchor transaction, edit-title write** - `82c67df` (feat)
2. **Task 2: Edit-title validation + server action** - `abffb9e` (feat)
3. **Task 3: /reimbursements/[id] page + detail client + inline title edit** - `d580710` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `lib/dal/reimbursement.ts` - extracted `assemblePanelDataForReimbursement`; added `getReimbursementPanelDataById`, `getReimbursement` (+ `ReimbursementHeader` type), `getReimbursementAnchorTransaction` (+ `ReimbursementAnchorTransaction` type), `updateReimbursementTitle`
- `tests/reimbursement-detail-dal.test.ts` - new: 9 real-Postgres integration tests for the four new DAL functions
- `lib/validations/reimbursement.ts` - new: `UpdateReimbursementTitleSchema` (no `.min(1)` on title)
- `lib/actions/reimbursement.ts` - new: `updateReimbursementTitleAction`
- `app/(app)/reimbursements/[id]/page.tsx` - new: the detail route, IDOR/Group-anchor guard, parallel panel-data + anchor-tx fetch
- `components/reimbursements/reimbursement-detail-client.tsx` - new: client shell (header, KPI status card, panel, refund picker dialog)
- `components/reimbursements/reimbursement-title-edit.tsx` - new: inline edit-title control

## Decisions Made
- The status `Badge` in `ReimbursementDetailClient` omits the `variant` prop entirely, relying on `residualBadgeClassName`'s `className` override (`border-0 bg-*-100 text-*-700`) merged via `twMerge` over the default variant's base classes — chosen specifically to satisfy this plan's own acceptance criterion (`grep -c "variant=" reimbursement-detail-client.tsx` must be `0`), a stricter constraint than the pre-existing `reimbursement-table.tsx` convention which does pass `variant="outline"` alongside the same `className`. Verified visually equivalent: `residualBadgeClassName` already owns `border-0`/`bg-*`/`text-*`, which fully override the default variant's `bg-primary text-primary-foreground` via Tailwind class-conflict resolution.

## Deviations from Plan

None - plan executed exactly as written. (One acceptance-criteria-driven implementation choice, documented above under Decisions Made, not a deviation from the plan's intent.)

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- RMB-11 is now fully implemented end-to-end (already marked complete in REQUIREMENTS.md by Plan 76-04, whose D-09 summary variant work was the other half of this requirement's contract).
- `/reimbursements/[id]` is ready for the Plan 76-06 phase checkpoint's human-verify pass (header, edit-title double-submit, add/remove/delete refund, foreign/Group-anchor 404, empty-title fallback) — all deferred UI-only acceptance items from this plan's `<verification>` section land there.

---
*Phase: 76-reimbursements-section*
*Completed: 2026-07-27*

## Self-Check: PASSED
- FOUND: lib/dal/reimbursement.ts
- FOUND: lib/validations/reimbursement.ts
- FOUND: lib/actions/reimbursement.ts
- FOUND: app/(app)/reimbursements/[id]/page.tsx
- FOUND: components/reimbursements/reimbursement-detail-client.tsx
- FOUND: components/reimbursements/reimbursement-title-edit.tsx
- FOUND: tests/reimbursement-detail-dal.test.ts
- FOUND: commit 82c67df (Task 1)
- FOUND: commit abffb9e (Task 2)
- FOUND: commit d580710 (Task 3)
