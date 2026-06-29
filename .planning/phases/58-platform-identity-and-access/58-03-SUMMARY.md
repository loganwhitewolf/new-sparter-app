---
phase: 58-platform-identity-and-access
plan: 03
subsystem: testing
tags: [vitest, import-format-wizard, platform, drizzle, tdd]

requires:
  - phase: 58-01
    provides: platform.proposedByUserId column (renamed from ownerUserId), platform.visibility dropped
  - phase: 58-02
    provides: accessibleWhere relaxed; isGlobalApproved/isOwnedBy validators updated

provides:
  - createPrivateRows writes proposedByUserId (not ownerUserId) and reviewStatus='pending' on platform insert
  - platform insert no longer writes the dropped visibility column (T-58-03-02 mitigated)
  - PENDING_REVIEW_STATUS='pending' constant replaces DRAFT_REVIEW_STATUS='draft' in wizard service
  - wizard-actions test suite (9 tests) GREEN against the new platform schema

affects: [58-04, import-wizard-attach-format, seed-slug-linkage-and-docs]

tech-stack:
  added: []
  patterns:
    - "TDD RED/GREEN for schema-breaking column rename: write failing assertion first (RED), then adapt the writer to the new column name (GREEN)"

key-files:
  created: []
  modified:
    - lib/services/import-format-wizard.ts
    - tests/import-format-wizard-actions.test.ts

key-decisions:
  - "DRAFT_REVIEW_STATUS constant removed; replaced by PENDING_REVIEW_STATUS='pending' — aligns lifecycle value for the relaxed accessibleWhere guard (D-03)"
  - "Platform insert drops visibility write entirely — the column no longer exists post-migration 0023; writing it would be a runtime error (T-58-03-02)"
  - "importFormatVersion insert retains ownerUserId/visibility (Discretion A3: format-level columns unchanged this phase)"
  - "check:language failures in lib/dal/expenses.ts and lib/dal/transactions.ts are pre-existing out-of-scope issues; wizard file itself passes the check"

patterns-established:
  - "Pattern: when dropping a DB column, add an explicit not.toHaveProperty assertion in the unit test to catch any future regression that re-introduces the write"

requirements-completed: [PLAT-01]

coverage:
  - id: D1
    description: "createPrivateRows platform insert uses proposedByUserId (not ownerUserId) and does not write visibility"
    requirement: PLAT-01
    verification:
      - kind: unit
        ref: "tests/import-format-wizard-actions.test.ts#creates private platform/version rows and makes the file retry-ready"
        status: pass
    human_judgment: false
  - id: D2
    description: "Platform insert sets reviewStatus='pending' (not 'draft') so newly created platforms are visible to their proposer under the relaxed accessibleWhere"
    requirement: PLAT-01
    verification:
      - kind: unit
        ref: "tests/import-format-wizard-actions.test.ts#creates private platform/version rows and makes the file retry-ready"
        status: pass
    human_judgment: false
  - id: D3
    description: "importFormatVersion insert retains ownerUserId/visibility and sets reviewStatus='pending'"
    requirement: PLAT-01
    verification:
      - kind: unit
        ref: "tests/import-format-wizard-actions.test.ts#creates private platform/version rows and makes the file retry-ready"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-06-29
status: complete
---

# Phase 58 Plan 03: platform-identity-and-access — Wizard Write-Path Glue Summary

**createPrivateRows adapted to post-ADR-0015 schema: proposedByUserId replaces ownerUserId, visibility write removed, reviewStatus aligned to 'pending' — wizard-actions test suite GREEN (9/9)**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-29T13:06:07Z
- **Completed:** 2026-06-29T13:11:00Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 2

## Accomplishments

- `lib/services/import-format-wizard.ts` `createPrivateRows()` adapted: `ownerUserId` → `proposedByUserId` in platform insert, `visibility: PRIVATE_VISIBILITY` write removed (column dropped in migration 0023), `DRAFT_REVIEW_STATUS='draft'` constant replaced by `PENDING_REVIEW_STATUS='pending'`
- `importFormatVersion` insert unchanged except `reviewStatus` aligned to `'pending'`; `ownerUserId`/`visibility` retained per Discretion A3
- `tests/import-format-wizard-actions.test.ts` updated: platform assertions use `proposedByUserId`, add `not.toHaveProperty('visibility')` guard, `reviewStatus: 'pending'` on both platform and version
- Full wizard-actions test suite passes: 9/9 tests GREEN

## Task Commits

Each task was committed atomically:

1. **Task 1: Update wizard-actions test platform-insert assertions (RED)** — `e6135dd` (test)
2. **Task 2: Adapt createPrivateRows to new platform schema (GREEN)** — `b2e1d91` (feat)

## Files Created/Modified

- `lib/services/import-format-wizard.ts` — `createPrivateRows`: `proposedByUserId` replaces `ownerUserId`, visibility write removed from platform insert, `PENDING_REVIEW_STATUS='pending'` replaces `DRAFT_REVIEW_STATUS='draft'`
- `tests/import-format-wizard-actions.test.ts` — platform-insert assertions updated to post-ADR-0015 shape; explicit `not.toHaveProperty('visibility')` added

## Decisions Made

- Replaced `DRAFT_REVIEW_STATUS = 'draft'` constant with `PENDING_REVIEW_STATUS = 'pending'` — the new constant name is unambiguous and any future attempt to re-introduce 'draft' would need to add it explicitly
- `importFormatVersion.visibility` and `ownerUserId` retained this phase (Discretion A3 — ADR 0015 only mandates dropping platform.visibility; format-level columns are Phase 59/60 territory)
- `check:language` pre-existing failures in `lib/dal/expenses.ts` and `lib/dal/transactions.ts` are out-of-scope; `import-format-wizard.ts` itself passes the check cleanly

## Deviations from Plan

None — plan executed exactly as written. TDD RED/GREEN cycle followed; all acceptance criteria met.

## Issues Encountered

- `yarn check:language` exits non-zero due to pre-existing Italian comments in `lib/dal/expenses.ts:82` and `lib/dal/transactions.ts:200`. These files were not touched by this plan. Verified `lib/services/import-format-wizard.ts` passes the check individually. Logged to `deferred-items.md` for cleanup.

## Known Stubs

None — this plan is write-path glue only. No UI rendering or data stubs.

## Threat Flags

None — all three threats in the plan's threat model were mitigated:
- T-58-03-01: platform insert uses `proposedByUserId: input.userId` (session-derived); pending platform visible only to proposer via Plan 02 guard
- T-58-03-02: `not.toHaveProperty('visibility')` test guard added; `visibility` write removed from platform insert
- T-58-03-03: `reviewStatus` aligned to `'pending'`; `'draft'` literal and `DRAFT_REVIEW_STATUS` constant removed from the file

## Next Phase Readiness

- Phase 58 complete: schema (Plan 01) + DAL access relaxation (Plan 02) + wizard write-path glue (Plan 03) all green
- Per-wave merge gate: `yarn test` full suite + `yarn build` should be run to confirm no regression before merging
- Phase 59 (import-wizard-attach-format) can proceed: the data layer and write path are consistent with ADR 0015

---
*Phase: 58-platform-identity-and-access*
*Completed: 2026-06-29*
