---
phase: "12"
plan: "02"
---

# T02: Added scoped import display-name validation and safe user-owned rename updates.

**Added scoped import display-name validation and safe user-owned rename updates.**

## What Happened

Implemented the import rename contract with a red-green cycle. `UpdateImportDisplayNameSchema` now validates a UUID `fileId` and trims nullable display names up to 255 characters, while allowing blank strings to reach the DAL reset path. `updateImportDisplayName(database, { userId, fileId, displayName })` now performs one scoped `UPDATE file SET display_name, updated_at WHERE id = fileId AND user_id = userId`, normalizes blank names to `null`, returns `null` when the row is missing or owned by another user, and returns only rename-safe columns (`id`, `displayName`, `updatedAt`) instead of full file records with storage fields. Tests cover invalid UUIDs, 255/256 character boundaries, blank reset normalization, user-scoped predicates, not-owned row behavior, and storage-field redaction from rename return columns.

## Verification

Verified the task contract with `yarn vitest lib/validations/__tests__/import.test.ts tests/imports-dal.test.ts` after implementation: 2 files and 17 tests passed. Supplemental verification passed with `yarn tsc --noEmit`, `yarn check:language`, and `yarn lint` (exit 0 with a pre-existing warning in `components/transactions/transaction-form-dialog.tsx`). The slice Playwright command still exits 1 with "No tests found" because the IMP-03 browser flow is planned for later UI tasks, matching the prior task state.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest lib/validations/__tests__/import.test.ts tests/imports-dal.test.ts` | 0 | ✅ pass | 637ms |
| 2 | `yarn tsc --noEmit` | 0 | ✅ pass | 2207ms |
| 3 | `yarn check:language` | 0 | ✅ pass | 569ms |
| 4 | `yarn lint` | 0 | ✅ pass | 3884ms |
| 5 | `yarn playwright test tests/import.spec.ts --grep "IMP-03"` | 1 | ❌ fail | 3059ms |

## Deviations

Tightened the DAL return value beyond the task wording by returning only rename-safe columns rather than a full `file` row, to satisfy the slice requirement that storage diagnostics and object keys are not browser/action visible.

## Known Issues

`yarn lint` still reports the pre-existing unused `useCallback` warning in `components/transactions/transaction-form-dialog.tsx`. `yarn playwright test tests/import.spec.ts --grep "IMP-03"` still finds no matching tests until later UI tasks add the IMP-03 flow.

## Files Created/Modified

- `lib/validations/import.ts`
- `lib/validations/__tests__/import.test.ts`
- `lib/dal/imports.ts`
- `tests/imports-dal.test.ts`
