---
phase: 58-platform-identity-and-access
plan: 02
subsystem: dal
tags: [drizzle, access-control, security, idor, visibility, tdd]

requires:
  - phase: 58-01
    provides: migration 0023 applied — platform.proposedByUserId exists, platform.visibility absent

provides:
  - relaxed accessibleWhere (two-branch OR): global-approved + format-owner with reviewStatus platform guard
  - isGlobalApproved keyed on platformReviewStatus===approved (no platformVisibility reference)
  - isOwnedBy keyed on ownerUserId + platform visibility guard (approved OR proposedByUserId===userId)
  - listPdfImportPlatformNames uses isNull(platform.proposedByUserId)
  - extended visibility-matrix unit test covering owner/non-owner/cross-user/pending-platform cases

affects: [58-03, import-format-detector, import-format-wizard]

tech-stack:
  added: []
  patterns:
    - "TDD RED/GREEN: failing test first encodes the security contract, then implementation makes it pass"
    - "Two-layer fail-closed access filter: SQL WHERE + in-memory isAccessibleImportFormat edited in lockstep to prevent silent row-drop or over-exposure"
    - "Discretion A3 applied: importFormatVersion.visibility kept in select/type/shape-guard but not referenced in accessibleWhere branch logic"

key-files:
  created:
    - tests/import-private-formats-dal.test.ts (extended — was existing)
  modified:
    - lib/dal/import-formats.ts
    - tests/import-private-formats-dal.test.ts

key-decisions:
  - "All four coupled surfaces (ImportFormatRow type, hasExpectedRowShape, isGlobalApproved/isOwnedBy validators, accessibleWhere SQL, .select() projection) updated in lockstep — RESEARCH Pitfall 3 prevention"
  - "importFormatVersion.visibility kept in select projection and shape guard per Discretion A3 — smallest change satisfying D-04 + D-05"
  - "makeRow in test includes visibility field to align with what .select() still returns; makeRow drops platformOwnerUserId and platformVisibility as per post-58-01 schema"
  - "check:language pre-existing failures in expenses.ts and transactions.ts are out of scope — deferred"

metrics:
  duration: ~3min
  completed: 2026-06-29
  tasks: 2
  files: 2

status: complete
---

# Phase 58 Plan 02: platform-identity-and-access — DAL Access Relaxation Summary

**Relaxed accessibleWhere in lockstep across all four coupled surfaces: private Import Format decoupled from private Platform, reviewStatus drives platform visibility lifecycle, global-approved path and six seeded formats unregressed**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-06-29T11:00:05Z
- **Completed:** 2026-06-29T11:03:16Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 2

## Accomplishments

### Task 1 (RED)
Updated `tests/import-private-formats-dal.test.ts`:
- `makeRow` updated to post-58-01 platform schema: `platformOwnerUserId` and `platformVisibility` removed; `platformProposedByUserId` (default `null`) and contract fields (`delimiter`, `timestampColumn`, etc.) added
- `visibility` field retained in `makeRow` since the DAL still projects it (Discretion A3)
- New test cases encoding the relaxed visibility matrix:
  - PLAT-03: owner-owned format on approved platform → visible to owner, hidden from non-owner
  - PLAT-02: pending platform format → visible to proposer only, hidden from other user
  - SC4 no-regression: global-approved format → visible to any user
  - Fail-closed guard: missing `reviewStatus` key → row dropped (defense-in-depth)
- File committed RED: 3 tests failing (new behavior not yet implemented), 4 passing

### Task 2 (GREEN)
Updated `lib/dal/import-formats.ts` across all four coupled surfaces:
1. **`ImportFormatRow` type + `hasExpectedRowShape`:** removed `platformOwnerUserId` and `platformVisibility`; added `platformProposedByUserId: string | null`. Removed `GLOBAL_VISIBILITY` and `PRIVATE_VISIBILITY` constants (no longer needed).
2. **Validators:** `isGlobalApproved` now keys on `platformReviewStatus === APPROVED_REVIEW_STATUS` (replacing old `platformVisibility === 'global'`); `isOwnedBy` keys on `row.ownerUserId === userId` plus platform visibility guard (`platformReviewStatus === approved` OR `platformProposedByUserId === userId`).
3. **`accessibleWhere`:** replaced 3-branch OR with 2-branch OR per RESEARCH Pattern 2 — Branch 1: `isNull(ownerUserId) + approved reviewStatus pair`; Branch 2: `eq(ownerUserId, userId) + or(approved platform, proposedByUserId===userId)`. Platform-owner branch 3 removed.
4. **`.select({...})`:** dropped `platformOwnerUserId: platform.ownerUserId` and `platformVisibility: platform.visibility`; added `platformProposedByUserId: platform.proposedByUserId`.
5. **`listPdfImportPlatformNames`:** changed `isNull(platform.ownerUserId)` → `isNull(platform.proposedByUserId)`.

Updated `tests/import-private-formats-dal.test.ts`: added `visibility: 'global'` to `makeRow` default (DAL still projects this field per Discretion A3).

**Result:** 36/36 tests pass (7 DAL visibility matrix + 29 import-detector seeded formats).

## Task Commits

Each task committed atomically:

1. **Task 1: Extend access-matrix unit test (RED)** — `0e51bec` (test)
2. **Task 2: Relax accessibleWhere + adapt validators/type/select/listPdfImportPlatformNames (GREEN)** — `cb79156` (feat)

## Verification Results

- `yarn test run tests/import-private-formats-dal.test.ts tests/import-detector.test.ts`: **36/36 PASS**
- `grep -nE 'platform\.visibility|platform\.ownerUserId|platformVisibility|platformOwnerUserId' lib/dal/import-formats.ts`: **CLEAN** (zero hits)
- `isNull(platform.proposedByUserId)` in `listPdfImportPlatformNames`: **PASS**
- `yarn check:language`: pre-existing failures in `lib/dal/expenses.ts` and `lib/dal/transactions.ts` (out of scope — deferred)

## Files Created/Modified

- `lib/dal/import-formats.ts` — four coupled surfaces updated in lockstep
- `tests/import-private-formats-dal.test.ts` — extended visibility matrix with RED→GREEN TDD cycle

## Decisions Made

- **Lockstep edit discipline:** all four DAL surfaces changed together; SQL-only changes would pass unit tests while silently over-exposing or under-exposing rows at runtime (RESEARCH Pitfall 3).
- **Discretion A3 applied:** `importFormatVersion.visibility` kept in select/type/shape-guard — the column still exists on `import_format_version` and keeping it is the smallest change satisfying D-04 + D-05. It is not referenced in any access-control predicate.
- **`visibility` in test makeRow:** retained in `makeRow` default to match what `.select()` projects; the fail-closed guard keys on `reviewStatus` (still present) for the shape-missing test.
- **check:language pre-existing issues deferred:** `expenses.ts:82` and `transactions.ts:200` contain Italian developer comments that pre-date this phase. Out of scope — logged to deferred items.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `makeRow` missing `visibility` field caused global-approved test to fail**
- **Found during:** Task 2 GREEN (first test run)
- **Issue:** Task 1's `makeRow` omitted `visibility` (format-level field), but `hasExpectedRowShape` in Task 2's DAL still checks `typeof row.visibility === 'string'`. The global-approved test returned `[]` instead of 1 result.
- **Fix:** Added `visibility: 'global'` to `makeRow` defaults in the test file (the DAL retains this field per Discretion A3).
- **Files modified:** `tests/import-private-formats-dal.test.ts`
- **Commit:** `cb79156` (included in Task 2 commit)

**2. [Rule 1 - Bug] Comments in DAL contained forbidden column name strings**
- **Found during:** Task 2 post-implementation verify gate
- **Issue:** The negative-grep gate `! grep -nE 'platform\.visibility|...|platformOwnerUserId' lib/dal/import-formats.ts` matched three comment lines that referenced the dropped columns by name (as documentation of what was removed).
- **Fix:** Rewrote comments to avoid the forbidden identifier strings while preserving intent.
- **Files modified:** `lib/dal/import-formats.ts`
- **Commit:** `cb79156`

---

**Total deviations:** 2 auto-fixed (Rule 1 — bugs in test and comment that would have caused verify gate failures)

## Security Coverage

| Threat ID | Status |
|-----------|--------|
| T-58-02-01 (IDOR — branch 2 cross-user) | Mitigated: `eq(importFormatVersion.ownerUserId, userId)` in SQL + `row.ownerUserId === userId` in-memory; cross-user test asserts isolation |
| T-58-02-02 (pending platform disclosure) | Mitigated: `or(eq(platform.reviewStatus, approved), eq(platform.proposedByUserId, userId))` in SQL + `platformReviewStatus === approved OR platformProposedByUserId === userId` in-memory; pending-platform test asserts proposer-only |
| T-58-02-03 (SQL vs in-memory desync) | Mitigated: all four surfaces updated in lockstep; unit test exercises the in-memory layer |
| T-58-02-04 (global formats hidden) | Mitigated: Branch 1 unchanged; import-detector.test.ts 29/29 seeded-format tests pass |

## Success Criteria

- **SC2:** pending platform visible only to its proposer — SATISFIED (test asserts proposer sees it, other user does not)
- **SC3:** user-owned importFormatVersion visible to owner on global/approved platform — SATISFIED (PLAT-03 decoupling complete)
- **SC4 (partial — Plan 03 completes the build/full-suite gate):** global-approved path and six seeded formats unchanged — SATISFIED (36/36 tests pass)

## Known Stubs

None — DAL only, no UI rendering.

## Threat Flags

None — changes are scoped to access-control tightening; no new network endpoints or auth paths introduced.

## Self-Check: PASSED

- `lib/dal/import-formats.ts`: FOUND — proposedByUserId present, no platformOwnerUserId/platformVisibility references
- `tests/import-private-formats-dal.test.ts`: FOUND — makeRow updated, 7 tests covering full visibility matrix
- Commit `0e51bec` (Task 1 RED): FOUND
- Commit `cb79156` (Task 2 GREEN): FOUND
- `yarn test run tests/import-private-formats-dal.test.ts tests/import-detector.test.ts`: 36/36 PASS
- `grep` negative gate on forbidden column strings: CLEAN
- `isNull(platform.proposedByUserId)` in `listPdfImportPlatformNames`: CONFIRMED
