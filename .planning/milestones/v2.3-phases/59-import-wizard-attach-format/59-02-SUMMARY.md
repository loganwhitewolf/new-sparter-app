---
phase: 59-import-wizard-attach-format
plan: "02"
subsystem: service,validation,action
tags: [zod, service, action, tdd, import-wizard, platform, attach]
dependency_graph:
  requires: [Phase 59-01 — listAttachablePlatforms DAL, Phase 58 — proposedByUserId/reviewStatus schema]
  provides: [existingPlatformId Zod schema, createPrivateRows attach branch, listAttachablePlatformsAction]
  affects:
    - lib/validations/import.ts
    - lib/services/import-format-wizard.ts
    - lib/actions/import.ts
    - lib/validations/__tests__/import.test.ts
    - tests/import-format-wizard-actions.test.ts
tech_stack:
  added: []
  patterns: [Zod superRefine conditional required, Drizzle SELECT TOCTOU guard, Server Action thin wrapper]
key_files:
  created: []
  modified:
    - lib/validations/import.ts
    - lib/services/import-format-wizard.ts
    - lib/actions/import.ts
    - lib/validations/__tests__/import.test.ts
    - tests/import-format-wizard-actions.test.ts
decisions:
  - "existingPlatformId extracted in Task 2 GREEN (not Task 3) as Rule-3 deviation to unblock test verification"
  - "platformName changed to formString() in Task 3 so absent name is undefined (cleaner than empty string)"
  - "TOCTOU guard via SELECT before version insert — no ownership check needed per ADR 0015 (any approved platform attachable)"
  - "import_format_wizard.attached log event added after version insert when all resolved data is available"
metrics:
  duration: "13min"
  completed: "2026-06-29"
status: complete
---

# Phase 59 Plan 02: Backend Attach Branch Summary

**One-liner:** `existingPlatformId` optional field in Zod schema + `createPrivateRows` attach/create fork with TOCTOU guard + `listAttachablePlatformsAction` thin wrapper.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | Failing tests for existingPlatformId optional schema | c2e59ef | lib/validations/__tests__/import.test.ts |
| 1 GREEN | Make existingPlatformId optional in Zod schema with platformName guard | a894c5a | lib/validations/import.ts |
| 2 RED | Failing tests for createPrivateRows attach branch | 71e1927 | tests/import-format-wizard-actions.test.ts |
| 2 GREEN | Fork createPrivateRows into attach vs create-platform branches | a51259a | lib/services/import-format-wizard.ts, lib/actions/import.ts |
| 3 | Propagate existingPlatformId and add listAttachablePlatformsAction | 9ecf0da | lib/actions/import.ts, tests/import-format-wizard-actions.test.ts |

## What Was Built

### lib/validations/import.ts

`CreatePrivateImportFormatSchema` gains two changes:

- `existingPlatformId: z.number().int().positive().optional()` — accepts positive integer id for the attach branch; Zod strips unknown fields so no pre-existing tests break
- `platformName` demoted from required (`z.string().min(1)`) to optional (`z.string().trim().max(100).optional()`)
- `superRefine` gains a guard at the top: when `existingPlatformId === undefined` AND `platformName?.trim()` is falsy → adds custom issue on `['platformName']` path with message `'Platform name is required when creating a new platform.'`
- Existing amountMode superRefine checks unchanged

`CreatePrivateImportFormatInput` type updates automatically via `z.infer`.

### lib/services/import-format-wizard.ts

`createPrivateRows` refactored with attach/create fork:

**Attach branch** (`input.existingPlatformId !== undefined`):
- Skips `syncPlatformIdSequence` (no new platform id allocated)
- Skips `platform` insert (reuses existing platform)
- `SELECT { id, name, slug } FROM platform WHERE id = existingPlatformId` — TOCTOU guard (T-59-03); throws `ImportFormatWizardError('db_write_failed', ...)` if row absent
- Inserts `importFormatVersion` with `platformId = existingPlatformId`
- Logs `import_format_wizard.attached` after version insert

**Create branch** (`input.existingPlatformId === undefined`):
- Unchanged: `syncPlatformIdSequence` → insert `platform` with `reviewStatus: 'pending'` and `proposedByUserId` → insert `importFormatVersion`
- `platformName` is narrowed with non-null assertion (`input.platformName!`) — safe because Zod superRefine guarantees presence

Both branches converge: update `fileTable.status = 'uploaded'`, return `CreatePrivateImportFormatResult`.

### lib/actions/import.ts

Three changes:

1. **Import**: `listAttachablePlatforms` and `AttachablePlatform` from `@/lib/dal/import-formats`
2. **createPrivateImportFormatAction**: `existingPlatformId: optionalPositiveInteger(formData, 'existingPlatformId')` added to safeParse; `platformName` changed to `formString(formData, 'platformName')` (undefined when absent, not empty string)
3. **New export**: `listAttachablePlatformsAction(): Promise<ImportActionState<AttachablePlatform[]>>` — thin wrapper: `verifySession` → `listAttachablePlatforms(userId)` → `{ error: null, data }`. Session error → Italian localized message. DAL error → `'Impossibile caricare le piattaforme. Riprova.'`

### Test coverage

**lib/validations/__tests__/import.test.ts** — 6 new tests in new `describe` block:
- Attach branch accepts no platformName when existingPlatformId provided
- Create branch requires platformName (path `['platformName']`)
- Create branch regression with platformName only
- Rejects non-integer existingPlatformId
- Rejects non-positive (zero) existingPlatformId
- amountMode superRefine still fires in attach branch

**tests/import-format-wizard-actions.test.ts** — 6 new tests:
- Attach branch: skips platform insert, skips txExecute, inserts version with platformId=301
- TOCTOU guard: returns db_write_failed error when platform row absent
- listAttachablePlatformsAction: returns data for authenticated session
- listAttachablePlatformsAction: returns session-expired error
- listAttachablePlatformsAction: returns error when DAL throws
- Create branch regression: still inserts pending platform, calls txExecute once

## Verification Results

```
Tests: 39 passed (39)
  - lib/validations/__tests__/import.test.ts: 24 passed
  - tests/import-format-wizard-actions.test.ts: 15 passed
TypeScript: no errors in modified files (pre-existing errors in cascade-options.test.ts,
  category-combobox.test.tsx, overview-interactions.test.tsx, suggestion-card.test.tsx — out of scope)
check:language: violations only in pre-existing files (expenses.ts:82, transactions.ts:200) — out of scope
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added existingPlatformId extraction to action in Task 2 GREEN**
- **Found during:** Task 2 GREEN (service fork implementation)
- **Issue:** Task 2's verification tests call through the action layer. Without extracting `existingPlatformId` from FormData in the action, the service never receives it and the attach branch tests can't pass. The plan put this extraction in Task 3, but Task 2's `<verify>` runs before Task 3 is implemented.
- **Fix:** Added `existingPlatformId: optionalPositiveInteger(formData, 'existingPlatformId')` to `createPrivateImportFormatAction`'s safeParse call as part of Task 2 GREEN. Task 3 then completed the action changes (`platformName: formString(...)` + `listAttachablePlatformsAction`).
- **Files modified:** `lib/actions/import.ts`
- **Commit:** a51259a

## TDD Gate Compliance

- Task 1 RED gate: 4 tests failed (attach accepts no platformName; non-integer id passes current schema; non-positive id passes current schema; amountMode superRefine doesn't fire when field validation fails in Zod v4)
- Task 1 GREEN gate: 24/24 tests pass
- Task 2 RED gate: 2 tests failed (attach tests — action didn't extract existingPlatformId yet)
- Task 2 GREEN gate: 15/15 tests pass (after minimal action deviation)

## Threat Flags

No new security-relevant surface beyond what is in the plan's `<threat_model>`:
- T-59-03 mitigated: TOCTOU SELECT in attach branch
- T-59-04 mitigated: Zod `.int().positive().optional()` rejects malformed ids
- T-59-05 mitigated: `listAttachablePlatformsAction` uses `userId` from `verifySession`

## Self-Check: PASSED

- [x] lib/validations/import.ts modified with existingPlatformId field
- [x] lib/services/import-format-wizard.ts modified with attach/create fork
- [x] lib/actions/import.ts modified with existingPlatformId extraction and listAttachablePlatformsAction
- [x] lib/validations/__tests__/import.test.ts modified with 6 new tests
- [x] tests/import-format-wizard-actions.test.ts modified with 6 new tests
- [x] Commit c2e59ef exists: test(59-02) RED schema tests
- [x] Commit a894c5a exists: feat(59-02) GREEN schema implementation
- [x] Commit 71e1927 exists: test(59-02) RED service tests
- [x] Commit a51259a exists: feat(59-02) GREEN service fork
- [x] Commit 9ecf0da exists: feat(59-02) action propagation + listAttachablePlatformsAction
