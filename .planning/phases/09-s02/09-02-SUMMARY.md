---
phase: "09"
plan: "02"
---

# T02: Extracted retry-aware browser PUT upload helper with sanitized diagnostics and wired the import uploader to use it.

**Extracted retry-aware browser PUT upload helper with sanitized diagnostics and wired the import uploader to use it.**

## What Happened

Created `components/import/upload-put.ts` as a client-safe helper with injectable `fetch`, diagnostics, and delay seams. The helper performs exactly three total PUT attempts, retries only network exceptions and HTTP 5xx responses, fails fast for HTTP 4xx, and emits sanitized `upload_put_attempt`, `upload_put_retrying`, and `upload_put_failed` payloads without the presigned URL. Wired `ImportUploader` to delegate browser-to-R2 PUTs to the helper while preserving Italian user-facing messages and redirect behavior. Added `tests/upload-put.test.ts` covering first-try success, network retry success, two 503 retries before success, 4xx fail-fast, retry exhaustion, and diagnostics safety. Also fixed a narrow T01 TypeScript tuple inference issue in `lib/services/r2.ts` so the full slice build passes without changing runtime behavior.

## Verification

Verified retry semantics, diagnostics sanitization, component delegation, critical no-console gate, lint, Playwright import smoke coverage, and production build.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest run tests/upload-put.test.ts` | 0 | ✅ pass | 806ms |
| 2 | `yarn vitest run tests/r2.test.ts tests/import-api.test.ts tests/upload-put.test.ts tests/logger.test.ts` | 0 | ✅ pass | 900ms |
| 3 | `yarn playwright test tests/import.spec.ts --reporter=list` | 0 | ✅ pass | 2762ms |
| 4 | `bash -lc '! rg "console\\.(log|error|warn|debug|info)" lib/services/r2.ts app/api/files/initiate/route.ts app/api/files/confirm/route.ts components/import/import-uploader.tsx'` | 0 | ✅ pass | 36ms |
| 5 | `yarn lint` | 0 | ✅ pass | 2870ms |
| 6 | `yarn build` | 0 | ✅ pass | 14130ms |

## Deviations

Added a small type-only fix in `lib/services/r2.ts` from the prior T01 work because the slice build failed on nullable tuple inference for `missingEnvVars`. Runtime behavior was unchanged.

## Known Issues

`yarn lint` still reports three warnings in pre-existing files outside this task (`app/(app)/dashboard/page.tsx`, `components/dashboard/spending-by-category-card.ts`, and `tests/import-service.test.ts`), but exits 0.

## Files Created/Modified

- `components/import/upload-put.ts`
- `components/import/import-uploader.tsx`
- `tests/upload-put.test.ts`
- `lib/services/r2.ts`
