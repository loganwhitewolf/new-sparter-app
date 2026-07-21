---
phase: 260721-mm0
plan: 01
subsystem: import
tags: [import-format-wizard, server-actions, bugfix]
dependency-graph:
  requires: []
  provides: []
  affects: [lib/actions/import.ts]
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - lib/actions/import.ts
    - tests/import-format-wizard-actions.test.ts
decisions:
  - "Regression test reuses the existing 'Importo' header as the secondary description column value (fixture-free) instead of adding a new header to parsedFile."
metrics:
  duration: 5min
  completed: 2026-07-21
status: complete
---

# Phase 260721-mm0 Plan 01: Fix dropped secondaryDescriptionColumn on private format creation Summary

`createPrivateImportFormatAction` never read `secondaryDescriptionColumn` from the submitted `FormData` — the field was silently omitted from the object passed to `CreatePrivateImportFormatSchema.safeParse`, so it always resolved to `undefined` and got persisted as `null`, dropping a user-configured secondary description column ("Primary — @secondary", e.g. Satispay-style payer/payee context) on every newly created private import format.

## What Changed

- `lib/actions/import.ts` — `createPrivateImportFormatAction` now extracts `secondaryDescriptionColumn` via the existing `formString()` helper, alongside `amountColumn`/`positiveAmountColumn`/`negativeAmountColumn`. No other field in the schema-building block was touched.
- `tests/import-format-wizard-actions.test.ts` — two new regression tests in the `import format wizard Server Actions` describe block:
  - submitting `secondaryDescriptionColumn: 'Importo'` (reusing an existing header from `parsedFile.headers`, no fixture changes) now asserts `insertedVersions[0].secondaryDescriptionColumn === 'Importo'`.
  - omitting the field (default `validCreateForm()`) still asserts `insertedVersions[0].secondaryDescriptionColumn === null`, guarding against a regression in the opposite direction.

No changes were made to `lib/validations/import.ts`, `lib/services/import-format-wizard.ts`, `lib/dal/import-formats.ts`, or `components/import/import-format-wizard.tsx` — all were already correct; the single point of failure was the Server Action's manual `FormData` parsing.

## Deviations from Plan

None - plan executed exactly as written.

## Verification

`yarn vitest run tests/import-format-wizard-actions.test.ts` — 20/20 passed (18 pre-existing + 2 new).

## Self-Check: PASSED

- FOUND: lib/actions/import.ts (secondaryDescriptionColumn extraction present)
- FOUND: tests/import-format-wizard-actions.test.ts (2 new regression tests present)
- FOUND commit d134cb2: fix(260721-mm0-01): forward secondaryDescriptionColumn from form data
- FOUND commit 7904df5: test(260721-mm0-01): lock in secondaryDescriptionColumn persistence
