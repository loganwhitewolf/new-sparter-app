---
phase: "14"
plan: "02"
---

# T02: Added private import format wizard validation, server actions, atomic creation service, and coverage for safe retry-ready format setup.

**Added private import format wizard validation, server actions, atomic creation service, and coverage for safe retry-ready format setup.**

## What Happened

Added the private import format wizard contract in `lib/validations/import.ts`, including file id, platform name, delimiter, timestamp/description columns, amount mode consistency, and parsed-header column validation. Added `lib/services/import-format-wizard.ts` to load an owned file, read only bounded header/sample content through the existing parser, return a safe header context, and create private `platform` plus `import_format_version` rows in one transaction. The creation flow updates the failed file back to a retry-ready uploaded state with `importFormatVersionId`, clears the sanitized error message, and logs only safe event metadata. Added server actions in `lib/actions/import.ts` for loading context and creating private formats, with session verification, localized Italian error mapping, `/import` revalidation on success, and no object key/raw content exposure. Added tests for happy-path context and creation, invalid column/mode rejection, missing/cross-user files, parser redaction, unauthorized sessions, private ownership fields, and no writes on rejection.

## Verification

Ran the required slice/task Vitest command successfully: `yarn vitest tests/import-format-wizard-actions.test.ts lib/validations/__tests__/import.test.ts` passed with 2 files and 17 tests. Also ran targeted ESLint, `yarn tsc --noEmit`, and `yarn check:language`; all exited 0. LSP diagnostics were attempted for `lib/services/import-format-wizard.ts`, but no language server was available in the harness, so CLI lint/typecheck covered static verification.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest tests/import-format-wizard-actions.test.ts lib/validations/__tests__/import.test.ts` | 0 | ✅ pass | 1190ms |
| 2 | `yarn lint lib/services/import-format-wizard.ts lib/actions/import.ts lib/validations/import.ts tests/import-format-wizard-actions.test.ts lib/validations/__tests__/import.test.ts` | 0 | ✅ pass | 1813ms |
| 3 | `yarn tsc --noEmit` | 0 | ✅ pass | 2340ms |
| 4 | `yarn check:language` | 0 | ✅ pass | 647ms |

## Deviations

The task plan noted duplicate private slugs across users should remain allowed by the chosen schema/constraint strategy, but the current `platform.slug` column is globally unique. I adapted by generating deterministic private slugs with a user/file/name hash suffix so different users can create the same display name without violating the existing global unique constraint.

## Known Issues

No known issues.

## Files Created/Modified

- `lib/validations/import.ts`
- `lib/actions/import.ts`
- `lib/services/import-format-wizard.ts`
- `tests/import-format-wizard-actions.test.ts`
- `lib/validations/__tests__/import.test.ts`
