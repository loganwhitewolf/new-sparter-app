---
phase: "12"
plan: "04"
---

# T04: Built the filtered, renameable, paginated import history UI for /import.

**Built the filtered, renameable, paginated import history UI for /import.**

## What Happened

Updated the /import server page to await Next 16 searchParams, parse import filters with the existing validation helper, fetch filtered imports, render URL-driven filters, and remount the table on filter changes so loaded rows reset cleanly. Added an ImportFilters client component that persists search/imported/reference date filters in URL query params and supports reset. Reworked ImportTable into a client component with local bounded append state, IntersectionObserver plus fallback load-more button, filtered empty-state copy, aria-live loading status, safe inline role=alert errors, and row rename controls. Added ImportRenameDialog to call the real rename server action, show localized toast plus inline error feedback, preserve blank-name reset semantics, and optimistically update only safe row fields. Extended tests/import.spec.ts with IMP-03 browser checks for filter URL persistence, malformed date normalization, reachable history states, conditional keyboard rename coverage, bounded load-more status, and absence of secret diagnostics.

## Verification

Ran the full slice verification set after the final code change. Vitest import validation/DAL/action suites passed with 28 tests across 3 files. IMP-03 Playwright checks passed with 3 browser tests. Lint exited 0 with one pre-existing warning in components/transactions/transaction-form-dialog.tsx. The English code convention check passed.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest lib/validations/__tests__/import.test.ts tests/imports-dal.test.ts tests/import-actions.test.ts` | 0 | ✅ pass | 1159ms |
| 2 | `yarn playwright test tests/import.spec.ts --grep "IMP-03"` | 0 | ✅ pass | 5238ms |
| 3 | `yarn lint` | 0 | ✅ pass | 2506ms |
| 4 | `yarn check:language` | 0 | ✅ pass | 477ms |

## Deviations

None.

## Known Issues

yarn lint still reports a pre-existing warning in components/transactions/transaction-form-dialog.tsx for an unused useCallback import; it is outside the T04 import UI changes and lint exits 0.

## Files Created/Modified

- `app/(app)/import/page.tsx`
- `components/import/import-filters.tsx`
- `components/import/import-table.tsx`
- `components/import/import-rename-dialog.tsx`
- `tests/import.spec.ts`
