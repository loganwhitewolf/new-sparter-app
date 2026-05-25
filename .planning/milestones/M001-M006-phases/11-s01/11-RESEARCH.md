# M004/S01 — Research

**Date:** 2026-05-07

## Summary

S01 owns R007 and R008 directly: `/import` must become a management page that lists every file-backed import lifecycle state, and each row must expose status, platform, counts, totals, and reference date range. It also lays groundwork for R014/R015 by preserving lifecycle state in the row model and keeping the existing upload/analyze/import path usable.

The current implementation is upload-first: `app/(app)/import/page.tsx` renders only the upload card, `components/import/import-uploader.tsx` creates a pending `file` row via `/api/files/initiate`, confirms upload via `/api/files/confirm`, then redirects to `/import/[fileId]/analyze`. The DB table is already `file` with lifecycle timestamps, `rowCount`, and `duplicateCount`, but it does not persist display names, imported transaction count, positive/negative totals, or full reference date ranges. `lib/services/import.ts` computes normalized rows during analysis/import and currently throws most useful aggregate data away after updating only row/duplicate counts.

## Recommendation

Build S01 as a thin import-management layer over the existing `file` table, not a replacement flow. Add missing import-stat columns to `file`, compute/persist stats in the existing `analyzeFile`/`importFile` service seams, create an import-oriented DAL read model (`lib/dal/imports.ts` is preferable to overloading `lib/dal/files.ts`), and render a server-first import table below the existing upload entry point.

Persist statistics during import rather than deriving them only in the UI. The UI can then stay simple and fast, future slices can filter/sort on real columns, and delete/retry flows get stable row context. For pre-existing imported rows, either backfill from `transaction.fileId` in the migration or let the DAL compute fallback aggregates; the migration backfill is cleaner because S02 filters by reference range.

## Implementation Landscape

### Key Files

- `app/(app)/import/page.tsx` — currently an unauthenticated-by-itself server page that renders upload-only UI. Change it to an async server page that calls an import list DAL, keeps the existing upload card, and renders an import table section.
- `components/import/import-uploader.tsx` — existing client upload flow; do not rewrite for S01. It already validates file type/size, initiates a file row, uploads to R2, confirms upload, and redirects to analyze.
- `app/(app)/import/[fileId]/analyze/page.tsx` — calls `analyzeImportAction` server-side and renders `ImportPreview`. S01 must keep this route working after stats persistence changes.
- `components/import/import-preview.tsx` — current analysis preview. It displays row count, duplicate count, platform, and sample rows. It can remain mostly unchanged, but its service result may grow with full-file stats.
- `lib/db/schema.ts` — `file` currently has lifecycle fields and `rowCount`/`duplicateCount` only. Add import-oriented columns such as `displayName` (nullable), `importedCount`, `positiveTotal`, `negativeTotal`, `referenceStartedAt`, and `referenceEndedAt`; add indexes useful for user-scoped listing/filtering (`userId + uploadedAt/importedAt`, and later reference range).
- `drizzle/migrations/*` — add a new migration after `0006_transaction_nullable_file_id.sql`. Existing project uses hand-authored SQL migrations in `drizzle/migrations` and `yarn db:migrate` via `scripts/migrate.ts`.
- `lib/dal/files.ts` — lifecycle write functions (`createFileRecord`, `markFileUploaded`, `updateFileAnalysisState`, `updateFileImportState`) update `file`. Extend analysis/import state inputs to persist stats, but keep low-level file lifecycle naming here.
- `lib/dal/imports.ts` (new) — recommended import-oriented read model for `/import`. It should verify session internally, scope by `file.userId`, left join `file -> import_format_version -> platform`, order newest first, and return fields needed by S01: id, displayName/originalName, status, platform metadata, uploadedAt/importedAt/analyzedAt/importStartedAt, rowCount, importedCount, duplicateCount, positiveTotal, negativeTotal, referenceStartedAt/referenceEndedAt, errorMessage.
- `lib/services/import.ts` — natural seam for computing stats. `analyzeFile` already parses bytes, detects format, normalizes sample rows, and writes analysis state. `importFile` already normalizes every parsed row and knows exactly which rows were inserted. Add a helper for full-file import stats and pass results into `updateFileAnalysisState` / `updateFileImportState`.
- `lib/services/import-format-detector.ts` — detection preview is intentionally sample-limited (`PREVIEW_SAMPLE_SIZE = 25`); do not use `detected.preview.sampleRows` for persisted full-file stats.
- `lib/services/import-parsers.ts` — parser returns full `parsed.rows`, `rowCount`, and sample rows. Full stats should be based on `parsed.rows` after a best format is known.
- `lib/utils/import.ts` — use `normalizeTransactionRow`, `parseItalianAmount`, and existing hash/date normalization instead of hand-parsing amounts or dates again.
- `lib/dal/transactions.ts` — pattern to follow for scoped list read models: `verifySession()`, left joins to file/import format/platform, bounded limit, explicit returned select shape. Memory note MEM048 says transaction reads should scope both `transaction.userId` and `file.userId`; import reads should at minimum scope `file.userId`.
- `components/transactions/transaction-table.tsx` — table visual/accessibility pattern to reuse for a simple import table: rounded border wrapper, sr-only caption, muted uppercase headers, empty state card, Italian UI copy.
- `components/expenses/expense-table.tsx` — action/table styling reference for later S02/S05, but S01 can avoid client state if only rendering rows.
- `lib/validations/import.ts` — currently validates upload/analyze/import inputs. S01 likely does not need new validations unless the list page accepts query params; S02 owns filters.
- `tests/import-service.test.ts` — existing mocked unit coverage for `analyzeFile`/`importFile`; extend with stat persistence assertions. Update `makeFileRow` and schema mocks to include new file columns.
- `tests/import-api.test.ts` — file row fixtures include current `FileRow` shape; update fixtures for new non-null columns.
- `tests/import.spec.ts` — Playwright smoke currently expects only heading/upload form. Add/adjust a smoke assertion that the import history section/table exists while preserving upload behavior.
- `tests/transactions-dal.test.ts` — useful model for a DAL test that mocks Drizzle operators and proves user scoping, joins, ordering, and bounded list size.

### Build Order

1. **Schema/migration first.** Add `file` columns and update TypeScript schema/fixtures. This unblocks typed DAL/service changes and avoids carrying optional ad-hoc stats through UI only.
2. **Stats helper second.** In `lib/services/import.ts`, add a pure helper that takes normalized full rows and duplicate information and returns `importedCount`, `duplicateCount`, `positiveTotal`, `negativeTotal`, `referenceStartedAt`, `referenceEndedAt`. Use `Decimal`/`toDbDecimal` for totals.
3. **Persist stats in lifecycle writes.** Extend `updateFileAnalysisState` and `updateFileImportState`. During analysis, compute full-file `rowCount`, duplicate/skipped count, totals, and reference range only when a best candidate exists; unknown-format failures can still persist `rowCount` and leave totals/range zero/null. During import, persist actual `importedCount = insertedTxs.length` and final duplicate/skipped count.
4. **Add import list DAL.** Implement `getImports`/`getImportRows` in a new `lib/dal/imports.ts`. Keep it server-only, session-scoped, ordered newest first, and left-join platform metadata so failed/unmatched files still appear.
5. **Render the table.** Add `components/import/import-table.tsx` or inline a server component section. Keep S01 read-only: status badges, platform, uploaded/imported dates, row/imported/duplicate counts, totals, reference range, and empty state. Retain the upload card.
6. **Tests.** Start with DAL and service unit tests, then page/UI smoke. This makes S02/S03/S04 planners inherit a stable contract.

### Verification Approach

- Run targeted tests first after implementation:
  - `yarn vitest run tests/import-service.test.ts tests/import-api.test.ts tests/transactions-dal.test.ts`
  - add a new `tests/imports-dal.test.ts` or equivalent and include it in the targeted run.
- Run type/language checks because schema changes ripple through many fixtures:
  - `yarn tsc --noEmit`
  - `yarn check:language`
- Run lint after UI/table changes:
  - `yarn lint`
- Browser/UI smoke once the page renders:
  - existing Playwright route: `yarn playwright test tests/import.spec.ts` if the project exposes a script, otherwise `npx playwright test tests/import.spec.ts`.
  - Observable behavior: `/import` still shows the upload form and also shows an import history section/table or empty state; rows in failed/uploaded/analyzing/analyzed/importing/imported states are not filtered out by joins.
- Full milestone-level commands remain for later slices: `yarn vitest run`, `yarn tsc --noEmit`, `yarn lint`, `yarn check:language`, `yarn build`.

## Don't Hand-Roll

| Problem | Existing Solution | Why Use It |
|---------|------------------|------------|
| Amount/date parsing for stats | `normalizeTransactionRow`, `parseItalianAmount`, `parseBankDate`, `Decimal`, `toDbDecimal` | Keeps totals/date ranges aligned with dedupe/import behavior and avoids subtle Italian decimal/date drift. |
| User scoping | `verifySession()` inside DAL/actions | Existing pattern prevents client-supplied userId/IDOR mistakes. |
| Import state persistence | `updateFileAnalysisState`, `updateFileImportState` | Existing file lifecycle mutation points keep the flow coherent and reduce duplicated SQL. |
| Table styling | `components/transactions/transaction-table.tsx` / `components/expenses/expense-table.tsx` | Matches existing list pages and accessibility conventions. |

## Constraints

- The DB table remains `file`; expose import-oriented names above it only (D013 / MEM085).
- Developer-facing identifiers/routes/comments/tests must be English; Italian is appropriate for UI copy.
- Next.js version is 16.2.4 and project guidance says this is not “the Next.js you know”; implementation agents should read relevant `node_modules/next/dist/docs/` docs before changing route/page conventions.
- Upload diagnostics must never expose presigned URLs, raw R2 SDK objects, credentials, raw file contents, or stack traces to users (MEM030). S01 UI should show bounded `errorMessage` only.
- `detectImportFormat` preview rows are sample-limited to 25; full stats must use `parsed.rows` after detection, not preview rows.
- Existing transaction dedupe identity excludes platformId (MEM042/MEM066); stats must not reintroduce platform into duplicate identity.
- Left joins are necessary for platform metadata because failed/unknown/pending files may not have `importFormatVersionId`.

## Common Pitfalls

- **Counting only preview duplicates** — current analysis duplicate count is sample-based. S01 requires per-import stats, so compute duplicate/skipped count across all parsed rows.
- **Losing failed/pending rows through inner joins** — join platform metadata with left joins so uploaded, failed, pending, and unknown-format files remain visible.
- **Using row count as imported count** — `rowCount` is parsed/read rows; `importedCount` should be actual inserted transactions after duplicate/invalid skips.
- **In-file duplicate hashes** — `insertTransactionBatch(...).onConflictDoNothing()` is only a safety net. If duplicate count should explain skipped rows, count both pre-existing hashes and repeated hashes within the same file.
- **Totals sign semantics** — define and test positive/negative totals explicitly. Recommended: `positiveTotal` sums amounts greater than zero; `negativeTotal` sums amounts less than zero as a negative number to preserve transaction sign.
- **Existing data backfill** — adding default-zero columns without backfill may make old imported files appear to have no stats. Prefer a migration backfill from `transaction.fileId`, or document that only new imports receive stats.

## Open Risks

- Existing tests heavily mock schema shapes and `FileRow`; schema additions will require broad fixture updates even if app code changes are modest.
- It is not yet clear whether product wants analyzed-but-not-imported rows to show “importable count” or only actual imported count. Recommendation: store/display actual `importedCount`, and let analyzed rows show zero imported until confirmed.
- Unknown-format failures cannot produce platform-specific totals/range until a format is selected; S04 will improve this. S01 should still show the row with status/error and row count when available.

## Skills Discovered

| Technology | Skill | Status |
|------------|-------|--------|
| React / Next.js | `react-best-practices` | installed |
| Next.js | `vercel/next.js@update-docs` | available via `npx skills add vercel/next.js@update-docs` (2.3K installs) |
| Drizzle ORM | `bobmatnyc/claude-mpm-skills@drizzle-orm` | available via `npx skills add bobmatnyc/claude-mpm-skills@drizzle-orm` (4.2K installs) |
| Testing | `test`, `tdd`, `verify-before-complete` | installed |
| Observability/log safety | `observability`, `security-review` | installed |