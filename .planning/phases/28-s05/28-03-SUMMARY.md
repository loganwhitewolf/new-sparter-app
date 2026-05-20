---
phase: "28"
plan: "03"
---

# T03: Added a sanitized JSONL production smoke CLI for health and disabled-signup checks with no-secret fake-server coverage.

**Added a sanitized JSONL production smoke CLI for health and disabled-signup checks with no-secret fake-server coverage.**

## What Happened

Implemented `scripts/production-smoke.mjs` as a dependency-light Node CLI. It accepts `PRODUCTION_SMOKE_ORIGIN` or `--origin`, supports `--expect-disabled-signup`, provides `--check-env`, and requires `--local-test-mode`/`PRODUCTION_SMOKE_LOCAL_TEST_MODE=true` for localhost or non-HTTPS local test origins. Origin validation rejects missing values, unsupported protocols, localhost in normal production mode, credentials, query strings, fragments, and paths. Runtime checks call only `GET /api/health` and, when requested, `POST /api/auth/sign-up/email` with generated disposable credentials that are never printed. Output is JSONL with whitelisted safe fields: phase, ok, HTTP status, health status, sanitized component names/ok/code/missing/latency, disabled-signup error code, and bounded latency. The CLI maps config errors, health failures, disabled-signup mismatches, and unexpected runtime failures to stable exit codes. Added `yarn production:smoke` to `package.json` and `tests/production-smoke.test.ts` with a local fake HTTP server covering success, config validation, degraded/malformed health, signup mismatches, timeout behavior, and stdout/stderr redaction scans.

## Verification

Ran the task-required Vitest command covering the new CLI plus existing health and registration contracts; all 4 files and 33 tests passed. Ran `yarn production:smoke --check-env`; it exited 0 and emitted one sanitized `check_env` JSONL event without requiring secrets or an origin. Ran the project language guard because the task added developer-facing script/test strings; it passed.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest tests/production-smoke.test.ts tests/health.test.ts tests/registration-config.test.ts tests/auth-route-registration.test.ts` | 0 | ✅ pass — 4 test files and 33 tests passed | 1743ms |
| 2 | `yarn production:smoke --check-env` | 0 | ✅ pass — emitted sanitized check_env JSONL without secrets | 692ms |
| 3 | `yarn check:language` | 0 | ✅ pass — English code convention check passed | 544ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `scripts/production-smoke.mjs`
- `tests/production-smoke.test.ts`
- `package.json`
