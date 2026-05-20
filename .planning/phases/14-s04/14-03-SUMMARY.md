---
phase: "14"
plan: "03"
---

# T03: Rendered the private unknown-format recovery wizard and wired analyze retry navigation for saved formats.

**Rendered the private unknown-format recovery wizard and wired analyze retry navigation for saved formats.**

## What Happened

Updated the analyze page to distinguish recoverable unknown-format analysis results from unrecoverable read/parse errors. Unknown-format results now show an Italian recovery CTA that preserves the same fileId and links to a private configure route, while retry analysis can consume formatVersionId from the query string. Added the configure route and a client wizard that loads safe header context, renders accessible Italian form controls for platform, delimiter, date, description, and amount mapping, validates malformed/duplicate column choices before submit, shows action errors in an alert region, caps large header lists, and redirects back to the same file analysis with the created private format version. Added Vitest coverage for wizard rendering, validation errors, many-header boundaries, missing-header context, and configure-page context-load failure. Updated the Playwright import spec with staging/fixme coverage for the recovery CTA and for ensuring parse/read failures do not show misleading configuration controls.

## Verification

Ran the slice-required verification command set and an additional TypeScript check after the last code change. `yarn vitest tests/import-format-wizard-ui.test.tsx` passed 5/5 tests; `yarn check:language` passed; `yarn tsc --noEmit --pretty false` passed. LSP diagnostics were attempted but no language server was available in this workspace, so TypeScript CLI was used instead.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest tests/import-format-wizard-ui.test.tsx` | 0 | ✅ pass | 915ms |
| 2 | `yarn check:language` | 0 | ✅ pass | 670ms |
| 3 | `yarn tsc --noEmit --pretty false` | 0 | ✅ pass | 1913ms |

## Deviations

Full browser exercise of the authenticated configure flow was not run locally because the existing analyze/import Playwright flows require seeded DB/R2/session state and are marked staging-only fixme; this task added the requested browser/spec assertions in that existing pattern and verified the UI through component tests.

## Known Issues

None.

## Files Created/Modified

- `app/(app)/import/[fileId]/analyze/page.tsx`
- `app/(app)/import/[fileId]/configure/page.tsx`
- `components/import/import-format-wizard.tsx`
- `tests/import-format-wizard-ui.test.tsx`
- `tests/import.spec.ts`
