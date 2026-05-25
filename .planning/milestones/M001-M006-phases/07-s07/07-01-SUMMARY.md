---
phase: "07"
plan: "01"
---

# T01: Added nullable profile fields, validation normalization, and a Drizzle migration for the user profile contract.

**Added nullable profile fields, validation normalization, and a Drizzle migration for the user profile contract.**

## What Happened

Extended the Drizzle `user` table with nullable `firstName`, `lastName`, `jobTitle`, `location`, `phone`, and `timezone` columns mapped to snake_case database columns. Added `lib/validations/profile.ts` with bounded Zod validation, trimming, empty-string-to-null normalization, light phone validation, and timezone validation via `Intl.supportedValuesOf('timeZone')` with a fallback allowlist including `Europe/Rome`. Added focused profile validation tests for normalization, max-length boundaries, malformed phone/timezone inputs, and helper output. Generated and inspected `drizzle/migrations/0003_user_profile_fields.sql`; it only adds the six nullable profile columns. Better Auth `user.additionalFields` now exposes these profile fields as `input: false`, preserving non-editable account fields including subscription plan and role.

## Verification

Ran the task verification command and confirmed `lib/validations/__tests__/profile.test.ts` passed with 6/6 tests, the migration file exists, and the generated SQL contains no destructive operations. Ran the slice Vitest command; the available profile validation tests passed. Ran the slice Playwright command; it failed with `No tests found` because `tests/profile.spec.ts` has not been created yet in this first task. Ran `npm run build`; Next.js production build and TypeScript completed successfully.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx vitest run lib/validations/__tests__/profile.test.ts --reporter=verbose && test -f drizzle/migrations/0003_user_profile_fields.sql && if grep -Ei '\\b(drop|rename|alter column|set not null)\\b' drizzle/migrations/0003_user_profile_fields.sql; then exit 1; else echo 'No destructive SQL found in 0003_user_profile_fields.sql'; fi` | 0 | ✅ pass | 14900ms |
| 2 | `npx vitest run tests/profile-actions.test.ts lib/validations/__tests__/profile.test.ts --reporter=verbose` | 0 | ✅ pass | 5200ms |
| 3 | `npx playwright test tests/profile.spec.ts --reporter=list` | 1 | ❌ fail — No tests found (profile browser spec not created yet in T01) | 10300ms |
| 4 | `npm run build` | 0 | ✅ pass | 13800ms |

## Deviations

Added the profile fields to Better Auth `user.additionalFields` with `input: false` for session/client compatibility while preserving read-only account field behavior.

## Known Issues

`npx playwright test tests/profile.spec.ts --reporter=list` currently fails with `No tests found` because the profile UI/browser test belongs to later slice work and does not exist yet.

## Files Created/Modified

- `lib/db/schema.ts`
- `auth.ts`
- `lib/validations/profile.ts`
- `lib/validations/__tests__/profile.test.ts`
- `drizzle/migrations/0003_user_profile_fields.sql`
- `drizzle/migrations/meta/0003_snapshot.json`
- `drizzle/migrations/meta/_journal.json`
