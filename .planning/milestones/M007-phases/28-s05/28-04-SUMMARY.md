---
phase: "28"
plan: "04"
---

# T04: Added an env-gated Playwright production browser smoke for auth, disabled signup, and R2 import with sanitized diagnostic assertions.

**Added an env-gated Playwright production browser smoke for auth, disabled signup, and R2 import with sanitized diagnostic assertions.**

## What Happened

Created `tests/production-smoke.spec.ts` as an explicitly gated Playwright spec. The spec skips by default unless `PLAYWRIGHT_PRODUCTION_SMOKE=1`, `PLAYWRIGHT_BASE_URL`, and disposable smoke account credentials are present. It includes an enabled-registration flow that registers and logs in to the dashboard, a disabled-registration flow that verifies direct signup returns HTTP 403 with `registration_disabled` while existing login still reaches the dashboard, and an optional R2 browser import flow gated by `PLAYWRIGHT_SMOKE_RUN_IMPORT=1` that uploads a tiny generated CSV and waits for the `/import/<fileId>/analyze` checkpoint. The import flow collects bounded browser upload diagnostics and console messages without printing credentials, then rejects forbidden presigned URL, object key, cookie, credential, file-content, and stack-like patterns. Updated the Vercel/Supabase/R2 deployment runbook with the exact Playwright env variable names, phase-specific commands, evidence expectations, and cleanup/free-tier guidance. Captured the reusable optional-production-smoke gating and diagnostic assertion pattern for future sessions.

## Verification

Ran the required safe default command `PLAYWRIGHT_PRODUCTION_SMOKE=0 yarn playwright test tests/production-smoke.spec.ts`; it exited 0 with all three live smoke tests skipped, proving local/CI default execution does not contact production. Ran `yarn check:language` because tests/docs changed; it passed. Ran `yarn lint tests/production-smoke.spec.ts`; it passed with no output.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `PLAYWRIGHT_PRODUCTION_SMOKE=0 yarn playwright test tests/production-smoke.spec.ts` | 0 | ✅ pass — 3 skipped safely | 6016ms |
| 2 | `yarn check:language` | 0 | ✅ pass | 520ms |
| 3 | `yarn lint tests/production-smoke.spec.ts` | 0 | ✅ pass | 1747ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `tests/production-smoke.spec.ts`
- `docs/deploy/vercel-supabase-r2.md`
