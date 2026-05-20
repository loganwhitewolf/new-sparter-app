# S02 — Research

**Date:** 2026-05-04

## Summary

S02 is a targeted instrumentation and client retry slice on top of the completed S01 logger foundation. The server-side upload path already has clear seams: `app/api/files/initiate/route.ts` authenticates, validates, creates the DB file row, and asks `lib/services/r2.ts` for a presigned PUT URL; `app/api/files/confirm/route.ts` authenticates, validates file ownership, calls `headObject`, and marks the file uploaded/failed. `lib/services/r2.ts` already normalizes storage failures into `R2ServiceError` with `code` and `status`, so the main server work is to add structured decision/failure logs before responses/throws without changing the public API shape.

The client-side upload code in `components/import/import-uploader.tsx` currently performs one direct `fetch(presignedUrl, { method: 'PUT' })` and discards the real exception in `catch`, replacing it with the generic Italian message. The retry requirement should be implemented around just the PUT stage: 3 total attempts (initial + 2 retries), retry only network errors and HTTP 5xx, fail immediately for 4xx because presigned URL/CORS/auth problems are usually structural. Preserve existing Italian user-facing messages while emitting structured browser diagnostics that include attempt number, fileId, status/error type, and no presigned URL.

Requirements targeting: the preloaded `REQUIREMENTS.md` has no Active requirements, but the milestone context maps this slice to upload instrumentation/retry acceptance (`initiate`, `confirm`, `r2.ts`, client PUT retry) and mentions R002/R007/R003 as S02-owned even though they are not currently present in traceability. Research should therefore target the roadmap/S02 acceptance contract directly.

## Recommendation

Instrument decision points, not function entry/exit. Following the loaded `observability` skill, each log should answer a future debugging question: which upload stage failed, for which user/file/object key, with which normalized code/status/error type. Recommended event names: `upload_initiate_started`, `upload_initiate_succeeded`, `upload_initiate_failed`, `upload_confirm_started`, `upload_confirm_succeeded`, `upload_confirm_failed`, `r2_operation_failed`, and client-side `upload_put_attempt`, `upload_put_retrying`, `upload_put_failed`.

For route context, prefer `withLogContext({ userId: session.userId, stage: ... }, async () => ...)` after the existing `verifySession()` call, because both upload routes already resolve a session and `withUserId()` would perform an additional Better Auth lookup. This still uses the S01 AsyncLocalStorage/Pino mixin contract and preserves the “no per-log auth lookup” guarantee. If the planner wants to adhere strictly to the S01 forward-intelligence wording, wrapping with `withUserId()` is also viable, but it will duplicate auth work in these routes unless route auth is refactored.

Extract the client PUT retry loop into a small helper (for example `components/import/upload-put.ts` or `lib/import/upload-put.ts`) rather than embedding retry state in `ImportUploader`. This makes retry behavior unit-testable with mocked `fetch`, keeps the React component simple, and creates one controlled client diagnostic surface. Use a tiny injectable logger/delay in that helper so tests can assert attempts without sleeping.

## Implementation Landscape

### Key Files

- `lib/logger.ts` — S01 server-only Pino singleton with `logger`, `withLogContext`, `getLogContext`, and `withUserId`. Pino redacts `uploadUrl`/`presignedUrl` query strings, but S02 should avoid logging presigned URLs at all unless absolutely needed.
- `lib/services/r2.ts` — R2 service boundary. Defines `R2ServiceError`, `getR2Config`, `createPresignedPutUrl`, `headObject`, and `readObjectBody`. Natural central logging seam is `normalizeR2Error(...)`; add an `operation`/`objectKey` context argument or log in each catch before rethrowing. For missing env config, log only missing variable names, never values.
- `app/api/files/initiate/route.ts` — initiate endpoint. Existing flow: `verifySession()` → payload validation → `createFileRecord()` → `createPresignedPutUrl()` → JSON response; catch marks created file failed. Add context/logs for userId, fileId, objectKey, contentLength, mimeType, expiresIn, and normalized error code/status.
- `app/api/files/confirm/route.ts` — confirm endpoint. Existing flow: `verifySession()` → payload validation → `getFileForUser()` → metadata mismatch checks → `headObject()` → `markFileUploaded()`. Add logs for fileId/userId/objectKey at start, validation/mismatch failures at warn level, R2/DB failures at error level, and success with uploadedAt.
- `components/import/import-uploader.tsx` — client upload UI. Existing single PUT catch hides real error. Replace direct PUT block with retry helper and preserve stage/error UI behavior.
- `tests/import-api.test.ts` — existing route contract tests with hoisted mocks for auth/files/R2. Extend with a logger mock to assert initiate/confirm success/failure logs without touching real Pino.
- `tests/import.spec.ts` — existing Playwright import smoke tests. Can add a browser-level mocked upload test that routes `/api/files/initiate`, the external presigned PUT URL, and `/api/files/confirm` to verify retry count and redirect without needing DB/R2.
- Potential new `tests/r2.test.ts` — direct R2 service tests for logging before `R2ServiceError` throws, especially missing env config and normalized R2 failures.
- Potential new `tests/upload-put.test.ts` — pure unit tests for the client PUT retry helper if extracted from the component.

### Build Order

1. **Server logging helper shape first.** Decide whether S02 uses `withLogContext` (recommended after `verifySession`) or `withUserId` (strict S01 wording). Add a small local `errorLogFields(error)` helper in route/R2 code if needed so all logs include `{ errorName, errorMessage, code, status }` without leaking raw SDK internals.
2. **Instrument `lib/services/r2.ts`.** This retires the riskiest diagnostic gap: R2 config/timeout/404/presign failures currently become responses without a low-level storage log. Centralize as much as possible in `normalizeR2Error` or in a `logAndNormalizeR2Error(operation, objectKey, error, fallback...)` wrapper.
3. **Instrument initiate/confirm routes.** Add high-level upload lifecycle logs around existing behavior. Do not change response bodies/status codes except if tests reveal an existing bug.
4. **Extract and wire PUT retry helper.** Implement 3 total attempts, retry network errors and 5xx only, structured browser diagnostics, no URL/token logging, and preserve existing Italian UI messages.
5. **Add/extend tests.** Route tests and retry helper tests can run independently. Add Playwright only if the planner wants browser proof of the real component integration; otherwise unit tests plus existing import smoke may be enough for task-level verification.

### Verification Approach

- Unit/API: `yarn vitest run tests/import-api.test.ts tests/logger.test.ts` after route instrumentation. If adding direct tests: include `tests/r2.test.ts` and `tests/upload-put.test.ts`.
- Client retry: unit-test helper cases: success on first try; network error then success; two 5xx then success; 4xx fails with one attempt; three network/5xx attempts fail with an error preserving real message/status for diagnostic logging.
- Browser smoke (optional but strong): add Playwright route mocks so `/import` uploads a fake CSV, `/api/files/initiate` returns a fake fileId and `https://r2.example.test/signed-put`, first two PUTs fail/return 503, third succeeds, `/api/files/confirm` succeeds, and the page navigates to `/import/<fileId>/analyze`.
- Static gate: keep the existing critical scan passing or explicitly adjust it if client diagnostics require a dedicated console wrapper: `! rg "console\.(log|error|warn|debug|info)" lib/services/r2.ts app/api/files/initiate/route.ts app/api/files/confirm/route.ts components/import/import-uploader.tsx`.
- Full quality gates before slice completion: `yarn lint` and `yarn build`.

## Constraints

- `lib/logger.ts` imports `server-only`; do not import it from `components/import/import-uploader.tsx` or any client-side helper consumed by that component.
- Upload routes already export `runtime = 'nodejs'`; keep R2 SDK usage on Node runtime.
- The direct PUT goes from browser to R2, so the server cannot observe PUT status. Server logs can cover `initiate` and `confirm`; browser diagnostics must cover PUT attempts.
- Do not log presigned URLs or query strings. S01 redaction exists, but the safest S02 approach is to log `objectKey`, `fileId`, status/error metadata, and omit `upload.url`.
- Existing API tests import modules after `vi.mock(...)`; if routes start importing `@/lib/logger`, add that mock before the route imports.

## Common Pitfalls

- **Duplicate auth lookup by wrapping upload routes with `withUserId()` after `verifySession()`.** Avoid by using `withLogContext({ userId: session.userId, ... })` around route work once the existing session is available, or refactor route auth so `withUserId()` is the sole session lookup.
- **Logging raw AWS SDK errors or presigned URLs.** Raw objects may contain noisy metadata; presigned URLs contain credentials in query params. Prefer explicit sanitized fields plus `objectKey` and normalized code/status.
- **Retrying 4xx PUT failures.** 403/404/signature/CORS-like failures are usually structural and should fail fast; retry network exceptions and 5xx only.
- **Breaking the “no console in critical files” gate.** The roadmap asks for browser attempt logs, but S01’s verification scan forbids `console.*` in `import-uploader.tsx`. If browser console diagnostics are required, route them through a dedicated client helper and keep the component scan-clean, or update the scan consciously in the plan.

## Open Risks

- The client logging requirement is slightly ambiguous: milestone text says the client should log every PUT attempt, while the critical console scan forbids `console.*` in `components/import/import-uploader.tsx`. Planner should decide whether a dedicated client diagnostic helper is acceptable or whether the manual scan should remain limited to the four original critical files.
- Directly unit-testing `lib/services/r2.ts` normalized AWS SDK failures may require module isolation/mocking of `@aws-sdk/client-s3` because the service caches `S3Client` by endpoint. The missing-env case is straightforward; HeadObject/PutObject failure tests need more setup.

## Skills Discovered

| Technology | Skill | Status |
|------------|-------|--------|
| Observability/logging | installed `observability` skill | Used; key rule applied: log decisions/failures, not generic activity. |
| Cloudflare R2 | `jezweb/claude-skills@cloudflare-r2` (468 installs) | Available via `npx skills add jezweb/claude-skills@cloudflare-r2`; not installed. Could help if executor needs R2-specific CORS/presign guidance. |
| Better Auth | `better-auth/skills@better-auth-best-practices` (45.3K installs) | Available via `npx skills add better-auth/skills@better-auth-best-practices`; not installed. Probably not necessary if using existing `verifySession`/`withLogContext` pattern. |
