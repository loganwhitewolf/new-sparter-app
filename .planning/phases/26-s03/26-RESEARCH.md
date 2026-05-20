# S03 Research: Cloudflare R2 production upload readiness

## Summary
S03 is a targeted integration/readiness slice. The app already has a complete R2-backed import upload path: authenticated browser selects a CSV/XLSX, `/api/files/initiate` creates a DB row and returns a presigned PUT URL, the browser PUTs directly to R2, `/api/files/confirm` verifies `HeadObject`, then the user is redirected to the analyze flow. `/api/health` already reports R2 readiness by checking required env names only.

The main gap is operational readiness/documentation for production R2 setup and a production-like smoke proof. One implementation risk surfaced in the browser PUT helper: `components/import/upload-put.ts` sets `Content-Length` from browser fetch. `Content-Length` is a forbidden request header in browser contexts and can break a real browser/R2 smoke even if unit tests pass with mocked fetch. S03 should address or explicitly verify this before claiming upload readiness.

Active requirements supported/owned: R041 (R2 production upload/import readiness), R043 (health readiness surface), R044 (runbook without secrets), R045 (free-tier constraints), and R038 (Vercel production baseline).

## Recommendation
Do not rewrite the R2 architecture. Keep the existing server-side AWS SDK S3-compatible client, server-side presigning, browser direct-to-R2 PUT, and sanitized health/logging pattern. Focus S03 on hardening the real browser upload path and documenting/verifying the Cloudflare R2 setup.

Recommended work:
- Update `docs/deploy/vercel-supabase-r2.md` with a Cloudflare R2 production section: bucket, API token/access key scope, Vercel env names, CORS JSON/policy, redeploy-after-env-change, `/api/health` expectation, and small-file smoke steps.
- Keep `.env.example` env names from S01, but verify it includes all R2 names and optional TTL. Add comments only if CORS/smoke wording belongs there.
- Fix/verify browser PUT headers. Prefer removing manual `Content-Length` from `uploadFileToPresignedUrl`; if a content type header is needed, return a safe header such as `Content-Type` from initiate and include it in CORS allowed headers.
- Consider including `ContentType` in `PutObjectCommand` if the confirm route relies on object content type for validation. Today `createPresignedPutUrl` accepts `contentType` but does not pass it to `PutObjectCommand`.
- Add/update tests so diagnostics still never expose presigned URLs and browser-visible errors do not leak object keys/secrets.

## Implementation landscape
Key files:
- `lib/services/r2.ts` — R2 SDK client, env validation, presigned PUT, HeadObject, ReadObject, sanitized error serialization/logging. Already has `REQUIRED_R2_ENV_VARS`, TTL cap, and no-secret diagnostics.
- `lib/services/health.ts` and `app/api/health/route.ts` — R2 readiness reports `{ ok: false, missing: [...] }` without values. This is the production readiness surface for missing R2 env.
- `app/api/files/initiate/route.ts` — authenticated initiate endpoint; creates file row and returns `upload.method`, `upload.url`, `upload.expiresIn`, and currently empty `headers`.
- `components/import/import-uploader.tsx` — browser flow: hash, initiate, PUT, confirm, redirect to analyze.
- `components/import/upload-put.ts` — browser direct PUT helper with retry diagnostics. High-priority review target because it sets `Content-Length`.
- `app/api/files/confirm/route.ts` — verifies R2 object metadata via `headObject`, compares size/content type when available, marks upload as uploaded.
- `tests/r2.test.ts`, `tests/upload-put.test.ts`, `tests/import-api.test.ts`, `tests/import.spec.ts`, `tests/health.test.ts` — existing coverage seams.
- `docs/deploy/vercel-supabase-r2.md` — production contract/runbook to expand.

Existing strengths:
- Missing R2 env names are reported safely through health and service errors.
- Presigned URLs are redacted by logger tests and upload diagnostics omit URLs.
- Browser PUT has retry events and Playwright coverage for transient mocked failures.
- Confirm endpoint prevents a DB-only false positive by requiring `HeadObject` before marking uploaded.

Gaps:
- Production CORS instructions are not yet documented.
- Real R2 smoke cannot be proven by unit tests alone.
- Browser `Content-Length` header is likely incompatible with real browser fetch.
- `contentType` is accepted by `createPresignedPutUrl` but not bound into `PutObjectCommand`; confirm tolerates absent `ContentType` but can fail if mismatched.

## Natural seams for planning
1. **Browser PUT compatibility seam**: adjust `components/import/upload-put.ts` and tests to avoid forbidden headers while preserving retry/no-secret diagnostics.
2. **R2 presign metadata seam**: decide whether to pass `ContentType` into `PutObjectCommand` and return a `Content-Type` header from initiate; align CORS docs/tests with that decision.
3. **Production docs seam**: add R2 setup/CORS/smoke sections to the deploy doc, including required Vercel env names and zero-cost constraints.
4. **Health/smoke seam**: document `/api/health` expected R2 states and add any missing targeted tests for env diagnostics.

## First proof
The highest-risk first proof is a local/prod-like browser upload path that does not rely on forbidden browser headers. Before writing broad docs, update the upload PUT helper/tests so the request shape is compatible with real browser fetch and still omits presigned URLs from diagnostics. Then S05 can run the same flow against real R2.

A useful targeted proof before real R2 credentials are available:
- Mock initiate to return a presigned URL and headers.
- Route the PUT in Playwright.
- Assert the client does not attempt to set `Content-Length` and still performs retry/confirm behavior.
- Assert visible page and diagnostics do not include `presigned`, signatures, or object keys.

## Verification
Static/command checks:
- `yarn vitest tests/r2.test.ts tests/upload-put.test.ts tests/import-api.test.ts tests/health.test.ts`
- `yarn playwright test tests/import.spec.ts` if local app/test setup supports it; otherwise keep Playwright smoke for S05.
- `yarn lint`
- `yarn check:language`
- `yarn build`

Production-like/manual checks for S03/S05:
- Configure R2 env vars in Vercel and redeploy.
- `curl --fail --silent --show-error https://<production-origin>/api/health` should show `components.r2.ok: true`; missing env should list names only.
- Browser smoke: log in, open `/import`, upload a tiny CSV, observe redirect to `/import/<fileId>/analyze` or uploaded/analyze-ready state.
- Inspect browser-visible errors/logs to ensure no presigned URL, R2 secret, object key, or stack trace is exposed.

## Risks and constraints
- R2 CORS must allow the production origin, `PUT`, and any headers the browser sends (`Content-Type` if explicitly used). Do not document wildcard origins for production unless clearly marked as temporary/demo-only.
- Do not add client-prefixed R2 env vars; all R2 credentials remain server-side.
- R2 Free constraints are accepted: limited free storage/operations/egress assumptions should be documented, along with when to disable signup or clean imports.
- Live R2 proof requires real credentials and Cloudflare dashboard setup; unit tests cannot validate CORS.

## Skill discovery
Relevant installed skills: `observability` (no-secret diagnostics), `write-docs` (production setup/runbook), `agent-browser` could help S05 with live browser smoke if invoked in an interactive verification session. No external skill installation is required.

## Sources
- Memory: MEM030 no presigned URLs/raw SDK/credentials/file contents in R2 diagnostics; MEM029 browser upload diagnostics via `upload-put-diagnostic`; MEM017 retry policy.
- Code scan: `lib/services/r2.ts`, `lib/services/health.ts`, `app/api/files/initiate/route.ts`, `app/api/files/confirm/route.ts`, `components/import/import-uploader.tsx`, `components/import/upload-put.ts`, `tests/r2.test.ts`, `tests/upload-put.test.ts`, `tests/import.spec.ts`, `docs/deploy/vercel-supabase-r2.md`, S01 summary.
