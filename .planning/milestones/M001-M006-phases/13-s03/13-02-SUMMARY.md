---
phase: "13"
plan: "02"
---

# T02: Exposed safe import deletion preview and confirm Server Actions with session-scoped service calls, localized errors, route revalidation, and redaction tests.

**Exposed safe import deletion preview and confirm Server Actions with session-scoped service calls, localized errors, route revalidation, and redaction tests.**

## What Happened

Added `DeleteImportSchema` to validate only `fileId` from client/FormData input. Wired `previewImportDeletionAction(formData)` to validate before auth, verify the session internally, ignore any client-provided `userId`, call `getImportDeletePreview` with the session `userId`, and return the existing `ImportActionState` shape with preview data. Wired `deleteImportAction(prev, formData)` for form/useActionState usage with the same validation/auth boundary, calling the T01 deletion service with only the session `userId` and revalidating `/import`, `/expenses`, and `/transactions` after successful deletion. Added safe Italian error mapping for validation, expired sessions, not-found/non-owned imports, not-deletable/retry cases, preview failures, delete failures, and revalidation failures without serializing object keys, raw rows, presigned URLs, stack traces, SQL, SDK/DB errors, or attacker-supplied user IDs. Extended `tests/import-actions.test.ts` for preview/delete happy paths, malformed UUIDs, unauthenticated sessions, user-id tampering resistance, service not-found/not-deletable errors, unsafe diagnostic redaction, and route revalidation.

## Verification

Ran the required task verification `yarn vitest run tests/import-actions.test.ts`: 1 file passed with 19 tests. Also ran `yarn tsc --noEmit --pretty false`, `yarn lint lib/actions/import.ts lib/validations/import.ts tests/import-actions.test.ts`, `yarn check:language`, and the available slice verification command `yarn vitest run tests/import-deletion-service.test.ts tests/import-actions.test.ts tests/import-delete-impact-summary.test.tsx`: 2 files passed with 27 tests. LSP diagnostics were attempted for changed TypeScript files but no language server was available, so CLI typecheck/lint served as diagnostics.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest run tests/import-actions.test.ts` | 0 | ✅ pass | 1052ms |
| 2 | `yarn tsc --noEmit --pretty false` | 0 | ✅ pass | 2357ms |
| 3 | `yarn lint lib/actions/import.ts lib/validations/import.ts tests/import-actions.test.ts` | 0 | ✅ pass | 1760ms |
| 4 | `yarn check:language` | 0 | ✅ pass | 578ms |
| 5 | `yarn vitest run tests/import-deletion-service.test.ts tests/import-actions.test.ts tests/import-delete-impact-summary.test.tsx` | 0 | ✅ pass | 1218ms |

## Deviations

Added a safe revalidation-failure branch that returns the deletion result plus a localized refresh message instead of exposing internals. Added typecheck and lint verification beyond the task's scoped Vitest command. The slice verification command passed the currently available T01/T02 tests; the T03 UI summary test file is not present yet and will be introduced by the next task.

## Known Issues

None.

## Files Created/Modified

- `lib/validations/import.ts`
- `lib/actions/import.ts`
- `tests/import-actions.test.ts`
