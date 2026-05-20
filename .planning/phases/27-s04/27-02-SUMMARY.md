---
phase: "27"
plan: "02"
---

# T02: Guarded the signup server action with REGISTRATION_ENABLED while keeping signin delegation independent.

**Guarded the signup server action with REGISTRATION_ENABLED while keeping signin delegation independent.**

## What Happened

Imported the shared registration flag helper and disabled-registration message into `lib/actions/auth.ts`, then added an early `signUpAction` short-circuit before form parsing, `headers()`, or Better Auth signup can run. Existing signup validation and generic safe error handling remain unchanged for enabled registration, and `signInAction` was left behaviorally untouched. Added focused Vitest coverage for the disabled-registration action path, including proof that signup does not call Better Auth or headers and that signin still delegates to Better Auth and redirects to `/dashboard` when registration is disabled.

## Verification

Ran the required focused Vitest command for registration config and auth action behavior; both files passed with 10 tests total. Also ran `yarn check:language` because developer-facing test code was added; it passed. The new tests verify disabled signup returns `REGISTRATION_DISABLED_MESSAGE`, does not call `auth.api.signUpEmail`, does not call `headers()`, and does not block `signInAction` from calling `auth.api.signInEmail` for valid credentials.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest tests/registration-config.test.ts tests/auth-actions-registration.test.ts` | 0 | ✅ pass | 665ms |
| 2 | `yarn check:language` | 0 | ✅ pass | 534ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `lib/actions/auth.ts`
- `tests/auth-actions-registration.test.ts`
