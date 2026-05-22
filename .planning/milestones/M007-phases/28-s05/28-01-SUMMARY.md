---
phase: "28"
plan: "01"
---

# T01: Made the R2 CORS helper production-safe by requiring a concrete origin, limiting browser upload policy to PUT plus Content-Type, and emitting only sanitized status lines.

**Made the R2 CORS helper production-safe by requiring a concrete origin, limiting browser upload policy to PUT plus Content-Type, and emitting only sanitized status lines.**

## What Happened

Refactored `scripts/set-r2-cors.mjs` into an import-safe module with exported origin validation, policy construction, safe status-line formatting, and a mocked-call-friendly `setR2Cors` function. Production use now requires `R2_CORS_ALLOWED_ORIGIN` to be a concrete deployed HTTPS origin; wildcard, empty, unsupported protocol, and localhost production origins are rejected before any Cloudflare request. Localhost is only allowed when `R2_CORS_DEV_MODE=true` is explicitly set for development. The generated Cloudflare R2 CORS policy now follows the documented browser upload contract: a single allowed origin, `PUT`, `Content-Type`, no exposed headers, and bounded max-age. The CLI no longer prints account IDs, bucket names, full CORS config, provider response bodies, raw errors, stacks, tokens, object keys, or URLs; it prints JSON status lines containing only event, phase, safe code, and HTTP status when applicable. Added `tests/set-r2-cors.test.ts` to verify positive policy construction, negative origin cases, no-network validation failures, safe successful mocked requests, provider-error redaction, and malformed provider response handling.

## Verification

Ran focused Vitest coverage for the new helper and the existing R2 contract tests: `yarn vitest tests/set-r2-cors.test.ts tests/r2.test.ts` passed with 2 files and 22 tests. Ran the project language guard required after touching developer-facing comments/tests: `yarn check:language` passed. Also exercised the real Node CLI with fake environment values and `R2_CORS_ALLOWED_ORIGIN='*'`; it exited non-zero before any provider call and emitted only `{event, phase, code}` with `invalid_origin_wildcard`, confirming the malformed-origin failure mode is safe.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest tests/set-r2-cors.test.ts tests/r2.test.ts` | 0 | ✅ pass | 733ms |
| 2 | `yarn check:language` | 0 | ✅ pass | 796ms |
| 3 | `CLOUDFLARE_API_TOKEN=fake-token R2_ACCOUNT_ID=fake-account R2_BUCKET_NAME=fake-bucket R2_CORS_ALLOWED_ORIGIN='*' node scripts/set-r2-cors.mjs` | 1 | ✅ pass (expected safe rejection) | 96ms |

## Deviations

Added a non-secret `R2_CORS_ALLOWED_ORIGIN` environment variable requirement to the helper usage so production origin is explicit rather than inferred. No package script or dependency changes were needed.

## Known Issues

None.

## Files Created/Modified

- `scripts/set-r2-cors.mjs`
- `tests/set-r2-cors.test.ts`
