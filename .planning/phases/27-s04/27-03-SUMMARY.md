---
phase: "27"
plan: "03"
---

# T03: Blocked direct Better Auth email signup API calls when REGISTRATION_ENABLED is disabled while preserving signin and session delegation.

**Blocked direct Better Auth email signup API calls when REGISTRATION_ENABLED is disabled while preserving signin and session delegation.**

## What Happened

Refactored `app/api/auth/[...all]/route.ts` so the Better Auth Next.js handlers are assigned internally, `GET` remains a direct pass-through, and `POST` performs a narrow pathname check for `/api/auth/sign-up/email` before delegating. When `REGISTRATION_ENABLED` resolves disabled, direct email signup now returns a stable 403 JSON response with `registration_disabled` and the shared disabled-registration message, without reading or echoing request body, cookies, credentials, tokens, or raw Better Auth errors. Added mocked route-handler tests that prove disabled signup does not call Better Auth, disabled signin-like POST still delegates, enabled signup delegates, and GET/session-style requests delegate independently of the registration flag.

## Verification

Ran the required focused Vitest suite for registration config plus auth route registration guard; it passed with 2 files and 12 tests. Also ran `yarn check:language` because the change touched route/test developer-facing strings; it passed.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest tests/registration-config.test.ts tests/auth-route-registration.test.ts` | 0 | ✅ pass | 732ms |
| 2 | `yarn check:language` | 0 | ✅ pass | 596ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `app/api/auth/[...all]/route.ts`
- `tests/auth-route-registration.test.ts`
