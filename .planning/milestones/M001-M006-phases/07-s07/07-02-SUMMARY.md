---
phase: "07"
plan: "02"
---

# T02: Added user-scoped profile DAL, updateProfileAction server action, and 14 passing tests covering auth, validation, DAL scoping, and error paths

**Added user-scoped profile DAL, updateProfileAction server action, and 14 passing tests covering auth, validation, DAL scoping, and error paths**

## What Happened

Implemented the profile mutation boundary as three coordinated pieces:

**lib/dal/users.ts** — server-only DAL with a `UserProfile` DTO, `getUserProfile(userId)` (returns a safe `EMPTY_PROFILE` constant when no row exists, so staging smoke tests render without seeded DB state), and `updateUserProfile(userId, input)` (returns `null` when no row is updated, signalling missing/access-denied). Both functions are scoped strictly to `user.id` via `eq(user.id, userId)`. Account metadata (`email`, `subscriptionPlan`, `role`) is returned as read-only output; those columns are not in the update `.set()`.

**lib/validations/profile.ts** — added `ActionState = { error: string | null }` export to keep the type co-located with `ProfileSchema`.

**lib/actions/profile.ts** — top-level `'use server'`, `useActionState`-compatible `(prevState, formData)` signature. Calls `verifySession()` first; any auth failure propagates as a redirect (framework-owned). Parses only the six allowed profile fields from `FormData` — `userId`, `email`, `subscriptionPlan`, and `role` are never read from submitted data. On validation failure returns the first Zod issue message (Italian). On DAL returning `null` returns a safe Italian not-found error. On DAL throwing returns a generic Italian error without leaking internals. On success calls `revalidatePath('/profile')`.

**tests/profile-actions.test.ts** — 14 test cases using `vi.hoisted()` / `vi.mock('@/...')` pattern consistent with existing tests. Covers: success + revalidation, session userId scoping, read-only field exclusion from DAL payload, unauthenticated rejection, validation errors for oversized fields/invalid phone/invalid timezone, null/empty field normalisation to null, DAL throw returning generic error, DAL null returning safe error, and no stack-trace leakage. Vitest alias gotcha (MEM003) addressed by using `vi.importActual('../lib/validations/profile')` with relative path.

## Verification

Ran: npx vitest run tests/profile-actions.test.ts lib/validations/__tests__/profile.test.ts --reporter=verbose

Result: 2 test files, 20 tests — all passed in 830ms. Profile action tests: 14/14 pass. Validation schema tests from T01: 6/6 still pass (no regression).

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx vitest run tests/profile-actions.test.ts lib/validations/__tests__/profile.test.ts --reporter=verbose` | 0 | ✅ pass — 20/20 tests passed (2 files) | 830ms |

## Deviations

none

## Known Issues

none

## Files Created/Modified

- `lib/dal/users.ts`
- `lib/actions/profile.ts`
- `lib/validations/profile.ts`
- `tests/profile-actions.test.ts`
