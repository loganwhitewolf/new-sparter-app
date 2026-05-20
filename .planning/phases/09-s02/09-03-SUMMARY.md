---
phase: "09"
plan: "03"
---

# T03: Added Playwright proof that the real import UI retries two transient presigned PUT failures before confirming upload success.

**Added Playwright proof that the real import UI retries two transient presigned PUT failures before confirming upload success.**

## What Happened

Extended `tests/import.spec.ts` with a focused integration scenario that drives the real `/import` page and `ImportUploader` through generated CSV selection, mocked `/api/files/initiate`, a fake cross-origin presigned R2 PUT URL, and mocked `/api/files/confirm`. The fake PUT boundary returns two deterministic 503 responses and then a 200, while the test asserts exactly three PUT requests, verifies confirm is called only after the third successful PUT, waits for the real analyze-page redirect, and inspects browser `upload-put-diagnostic` events. The diagnostic assertions prove three attempt events and two retry events while confirming the presigned URL signature is not exposed in the browser diagnostic payload. Added CORS preflight/header handling to the external route mock so the test exercises the browser fetch path rather than failing before the retry helper runs.

## Verification

Ran the slice verification gates after the final code change. `yarn vitest run tests/r2.test.ts tests/import-api.test.ts tests/upload-put.test.ts tests/logger.test.ts` passed with 4 files and 32 tests. `yarn playwright test tests/import.spec.ts --reporter=list` passed with 6 tests and 3 existing fixme/skipped tests. The critical console scan exited 0 with no matches in the guarded upload files. `yarn lint` exited 0 with the same three pre-existing warnings noted in prior task summaries. `yarn build` exited 0 and produced the Next.js route summary. LSP diagnostics were attempted for `tests/import.spec.ts`, but no language server was available in this harness, so LSP was not used as pass/fail evidence.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest run tests/r2.test.ts tests/import-api.test.ts tests/upload-put.test.ts tests/logger.test.ts` | 0 | ✅ pass | 801ms |
| 2 | `yarn playwright test tests/import.spec.ts --reporter=list` | 0 | ✅ pass | 6561ms |
| 3 | `bash -lc '! rg "console\\.(log|error|warn|debug|info)" lib/services/r2.ts app/api/files/initiate/route.ts app/api/files/confirm/route.ts components/import/import-uploader.tsx'` | 0 | ✅ pass | 19ms |
| 4 | `yarn lint` | 0 | ✅ pass | 2834ms |
| 5 | `yarn build` | 0 | ✅ pass | 13498ms |

## Deviations

None.

## Known Issues

`yarn lint` still reports three pre-existing warnings outside this task, but exits 0: unused `monthlyAverage` in `app/(app)/dashboard/page.tsx`, unused `count` in `components/dashboard/spending-by-category-card.ts`, and unused `_args` in `tests/import-service.test.ts`. No new known issues were introduced.

## Files Created/Modified

- `tests/import.spec.ts`
