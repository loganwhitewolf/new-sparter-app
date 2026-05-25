---
phase: "06"
plan: "02"
---

# T02: Built import upload page, analyze preview page, ImportUploader and ImportPreview client components with 5 passing Playwright smoke tests and clean production build

**Built import upload page, analyze preview page, ImportUploader and ImportPreview client components with 5 passing Playwright smoke tests and clean production build**

## What Happened

S05 T04 produced zero files; this task built all four missing UI modules from scratch.

**app/(app)/import/page.tsx** — Server Component with Italian heading ('Importa file bancario'), accepted formats guidance (.csv, .xlsx), max file size display (5 MB derived from `MAX_IMPORT_FILE_SIZE_BYTES`), and the ImportUploader client leaf component mounted inside a Card.

**components/import/import-uploader.tsx** — Client Component implementing the three-step upload flow: (1) client-side file validation (extension, MIME type, size) with inline error display using `#import-file-error` ID for precise Playwright targeting; (2) `POST /api/files/initiate` to get presigned URL + fileId; (3) browser-direct `PUT` to R2 presigned URL (file bytes never proxied through server); (4) `POST /api/files/confirm` for R2 verification; (5) `router.push` to `/import/${fileId}/analyze`. Each failure mode has its own inline error state. A `UploadStage` type drives button label and `aria-busy` for accessibility.

**app/(app)/import/[fileId]/analyze/page.tsx** — Server Component that constructs a FormData with the fileId param and calls `analyzeImportAction` directly (avoids a redundant fetch). Handles three cases: (a) file not found/access denied → `notFound()`; (b) analysis error with no data → structured error card; (c) success → renders ImportPreview with the analysis result.

**components/import/import-preview.tsx** — Client Component displaying: summary tiles (rowCount, duplicateCount, platformName, confidence percentage); optional format override Select when multiple candidates exist; warnings Alert; errors Alert (hides confirm button when present); sample rows Table with date/description/amount/status badge columns; confirm button wired to `confirmImportAction` via direct async call (not `useActionState` — the server action signature takes FormData not state+payload, so `useActionState` would type-error). A `submitLock` ref prevents double-submit. Success redirects to `/spese`.

**tests/import.spec.ts** — 5 runnable Playwright smoke tests (3 DB-dependent tests marked fixme): page renders heading + upload form; upload button disabled with no file; unsupported .pdf shows #import-file-error alert; keyboard accessibility via `fileInput.focus()` + activeElement check; valid CSV clears error and enables button. Used `#import-file-error` ID selector instead of `getByRole('alert')` because Next.js injects a route announcer element with `role="alert"` that causes strict-mode violations.

**Key deviation**: `confirmImportAction` accepts `(formData: FormData)` not the `(state, payload)` signature required by `useActionState`. ImportPreview uses a plain async handler + useState instead of useActionState to avoid the type mismatch. This is consistent with how ImportUploader handles the upload flow.

## Verification

Ran `npx tsc --noEmit` — 0 type errors across all 5 new files. Ran `npx vitest run tests/*.test.ts --reporter=verbose` — 54/54 unit tests pass (no regressions). Ran `npx playwright test tests/import.spec.ts --reporter=list` — 5/5 runnable tests pass, 3 fixme skipped (require staging DB). Ran `npm run build` — clean production build; /import renders as static, /import/[fileId]/analyze as dynamic server-rendered.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsc --noEmit` | 0 | ✅ pass — 0 type errors | 8500ms |
| 2 | `npx vitest run tests/*.test.ts --reporter=verbose` | 0 | ✅ pass — 54/54 unit tests, no regressions | 287ms |
| 3 | `npx playwright test tests/import.spec.ts --reporter=list` | 0 | ✅ pass — 5/5 runnable tests pass, 3 fixme skipped | 1700ms |
| 4 | `npm run build` | 0 | ✅ pass — clean production build, /import static, /import/[fileId]/analyze dynamic | 12000ms |

## Deviations

confirmImportAction uses (formData: FormData) signature (not useActionState-compatible state+payload). ImportPreview uses plain async + useState instead of useActionState. This avoids a TypeScript type error and is functionally equivalent.

## Known Issues

Analyze page calls analyzeImportAction on every server render — if the user navigates back and re-enters the page, analyzeFile() runs again and re-reads R2. A future enhancement could cache the analysis result in the DB and serve it directly from a DAL query.

## Files Created/Modified

- `app/(app)/import/page.tsx`
- `app/(app)/import/[fileId]/analyze/page.tsx`
- `components/import/import-uploader.tsx`
- `components/import/import-preview.tsx`
- `tests/import.spec.ts`
