---
phase: "11"
plan: "04"
---

# T04: Rendered a safe server-backed import history surface on `/import` while preserving the upload flow.

**Rendered a safe server-backed import history surface on `/import` while preserving the upload flow.**

## What Happened

Added `components/import/import-table.tsx` as the import history UI surface with Italian empty/error copy, accessible table caption, muted uppercase headers, status badges, nullable placeholders, bounded filename/error rendering, and stat/date/total columns sourced from the S01 import DAL row model. Updated `app/(app)/import/page.tsx` to be an async App Router server page that loads `getImports()`, keeps the existing `ImportUploader` card intact, and renders the history section underneath. Non-navigation import-history load errors now render a safe unavailable state instead of breaking the upload entry point; Next redirect/not-found navigation errors are rethrown. Extended `tests/import.spec.ts` so the smoke test verifies the upload controls plus the new history surface without depending on ignored fixtures or a seeded local import table. Added `allowedDevOrigins: ['127.0.0.1']` to `next.config.ts` after Playwright showed Next 16 dev resource blocking prevented client hydration for local file-input tests.

## Verification

Verified the task and slice checks after the final code changes: import DAL/service/API Vitest suite passed, TypeScript passed, the full import Playwright smoke suite passed with upload validation/retry coverage, lint exited 0 with one unrelated pre-existing warning in `components/transactions/transaction-form-dialog.tsx`, and the English language convention check passed. A redaction scan of the new page/table code found no `objectKey`, presigned URL references, R2 references, stack traces, or raw file payload exposure in the new UI surface.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest run tests/import-service.test.ts tests/import-api.test.ts tests/imports-dal.test.ts` | 0 | ✅ pass | 886ms |
| 2 | `yarn tsc --noEmit` | 0 | ✅ pass | 1791ms |
| 3 | `yarn playwright test tests/import.spec.ts` | 0 | ✅ pass | 7556ms |
| 4 | `yarn lint` | 0 | ✅ pass | 3297ms |
| 5 | `yarn check:language` | 0 | ✅ pass | 765ms |
| 6 | `redaction scan for objectKey/presigned/r2/stack/raw in import page/table` | 0 | ✅ pass | 108ms |

## Deviations

Added `next.config.ts` to the touched files to allow `127.0.0.1` as a Next 16 dev origin for Playwright hydration. Added a safe history-unavailable state for ordinary DAL failures so stale local databases do not break the upload entry point; authenticated navigation errors still follow existing Next behavior.

## Known Issues

`yarn lint` exits 0 but still reports an unrelated warning: `components/transactions/transaction-form-dialog.tsx` imports unused `useCallback`. Local Playwright databases without the M004 migration render the safe history-unavailable state until migrated, while the upload flow remains usable.

## Files Created/Modified

- `app/(app)/import/page.tsx`
- `components/import/import-table.tsx`
- `tests/import.spec.ts`
- `next.config.ts`
