---
phase: "13"
plan: "03"
---

# T03: Added the import deletion dialog, impact summary, table delete action, and redaction-focused UI tests for safe imported-file removal.

**Added the import deletion dialog, impact summary, table delete action, and redaction-focused UI tests for safe imported-file removal.**

## What Happened

Verified the existing partial T03 implementation, then tightened the final UI integration. The `/import` table now exposes deletion only for imported rows alongside rename, keeps client state unchanged until the delete action returns success, and removes the row after a successful deletion callback. The delete dialog loads the T02 preview action, blocks confirmation while preview/delete is pending or failed, guards duplicate preview/delete submissions, keeps localized preview/delete errors visible in the dialog, and uses explicit destructive confirmation copy. The impact summary renders only sanitized preview counts and Italian manual/override preservation guidance. I also disabled the shared dialog's default English screen-reader close label for this localized destructive dialog and updated the table caption to include safe deletion actions.

## Verification

Fresh verification after the last code change passed: the combined slice/UI command ran 3 Vitest files with 30 passing tests, TypeScript typecheck, ESLint on touched UI/test files, and `yarn check:language` with exit code 0. Browser smoke verification started the local Next dev server, visited `http://localhost:3000/import`, confirmed the route redirects unauthenticated users to `/login`, and asserted no console errors or failed requests; authenticated table interaction could not be exercised in this environment without credentials/seeded session, so it remains covered by component/action tests.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest run tests/import-deletion-service.test.ts tests/import-delete-impact-summary.test.tsx tests/import-actions.test.ts && yarn tsc --noEmit --pretty false && yarn lint components/import/import-delete-dialog.tsx components/import/import-delete-impact-summary.tsx components/import/import-table.tsx tests/import-delete-impact-summary.test.tsx && yarn check:language` | 0 | ✅ pass | 8556ms |
| 2 | `Browser smoke: `browser_navigate http://localhost:3000/import` redirected to `/login`; `browser_assert` passed url_contains `/login`, text_visible `Accedi`, no_console_errors, and no_failed_requests.` | -1 | unknown (coerced from string) | 0ms |

## Deviations

A prior partial implementation already existed for the planned files. I preserved it, then made targeted accessibility/localization and caption fixes instead of rewriting the components. Added browser smoke verification of unauthenticated route behavior beyond the planned CLI command; authenticated delete interaction was not possible without credentials.

## Known Issues

Authenticated browser verification of the delete dialog was not exercised because `/import` redirects to `/login` in this environment and auto-mode cannot request credentials. The behavior is covered by the import action tests and rendered impact summary tests.

## Files Created/Modified

- `components/import/import-delete-impact-summary.tsx`
- `components/import/import-delete-dialog.tsx`
- `components/import/import-table.tsx`
- `tests/import-delete-impact-summary.test.tsx`
