---
phase: "15"
plan: "03"
---

# T03: Created ImportRowActions component and import-status utility so each /import row exposes only lifecycle-appropriate CTAs with exact importId transaction links and no duplicate in-progress controls.

**Created ImportRowActions component and import-status utility so each /import row exposes only lifecycle-appropriate CTAs with exact importId transaction links and no duplicate in-progress controls.**

## What Happened

Implemented the state-aware row action matrix in three coordinated changes:

1. Created lib/utils/import-status.ts — a client-safe shared module exporting UNKNOWN_FORMAT_ERROR (the canonical substring), isUnknownFormatFailed(), and isInProgress(). This centralizes the unknown-format predicate so the analyze page and the row-actions matrix cannot drift.

2. Created components/import/import-row-actions.tsx — a 'use client' component that maps each ImportListRow status to its lifecycle-appropriate CTAs:
   - pending_upload: no primary action (null)
   - uploaded: analyze link to /import/[fileId]/analyze
   - analyzing: disabled in-progress copy with accessible aria-label, no active links
   - analyzed: review-and-import link to /import/[fileId]/analyze
   - importing: disabled in-progress copy with accessible aria-label, no active links
   - imported: view-transactions link (/transactions?importId=<fileId>) + delete button
   - failed (unknown-format): configure-format link (/import/[fileId]/configure) + retry-analysis link
   - failed (other): retry-analysis link only (no configure)

3. Updated components/import/import-table.tsx to import and render ImportRowActions in the actions cell, replacing the previous inline delete-only button. The S02 rename pencil icon in the file name cell was preserved unchanged.

4. Updated app/(app)/import/[fileId]/analyze/page.tsx to import UNKNOWN_FORMAT_ERROR from lib/utils/import-status instead of redeclaring it locally, eliminating the divergence risk.

5. Created tests/import-table-actions.test.tsx with 21 assertions covering: every status in the file_status enum, accessible aria-labels on every CTA, exact href values (including /transactions?importId= scoping), absence of duplicate-operation controls for in-progress states, redaction-sensitive copy, and null/missing errorMessage boundary conditions.

## Verification

Ran all slice-level verification commands:
- yarn vitest run tests/import-table-actions.test.tsx tests/import-delete-impact-summary.test.tsx — 24 tests passed
- yarn vitest run tests/import-service.test.ts tests/import-actions.test.ts — 78 tests passed
- yarn vitest run lib/validations/__tests__/transactions.test.ts tests/transactions-dal.test.ts — 29 tests passed
- yarn lint — 0 errors (pre-existing warning in transaction-form-dialog.tsx, unrelated to T03)
- yarn check:language — passed

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest run tests/import-table-actions.test.tsx tests/import-delete-impact-summary.test.tsx` | 0 | 24 tests passed | 500ms |
| 2 | `yarn vitest run tests/import-service.test.ts tests/import-actions.test.ts` | 0 | 78 tests passed | 850ms |
| 3 | `yarn vitest run lib/validations/__tests__/transactions.test.ts tests/transactions-dal.test.ts` | 0 | 29 tests passed | 200ms |
| 4 | `yarn lint` | 0 | 0 errors | 8000ms |
| 5 | `yarn check:language` | 0 | passed | 3000ms |

## Deviations

The original task plan listed a 'Rinomina' text button in the actions cell alongside delete. The import-table.tsx already had a rename pencil icon in the file name cell (S02 behavior). Rather than duplicating rename into the actions cell, ImportRowActions does not render a rename control — rename stays in the file name cell as before. This matches the existing UX pattern and keeps the actions cell focused on lifecycle-primary CTAs.

## Known Issues

none

## Files Created/Modified

- `lib/utils/import-status.ts`
- `components/import/import-row-actions.tsx`
- `components/import/import-table.tsx`
- `app/(app)/import/[fileId]/analyze/page.tsx`
- `tests/import-table-actions.test.tsx`
