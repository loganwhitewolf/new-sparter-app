# Phase 30: oauth-config — Research

**Date:** 2026-05-21
**Phase goal:** Google + GitHub OAuth via env-driven activation; full guardrail removal.

---

## 1. Better Auth Social Provider API (v1.6.9)

`socialProviders` is a **top-level key** in `betterAuth()` config — not inside `plugins`. Type:

```typescript
type SocialProviders = {
  [K in SocialProviderList[number]]?: {
    clientId: string        // (string | string[] for Google only)
    clientSecret: string
    enabled?: boolean
    // provider-specific extras (e.g. accessType for Google)
  }
}
```

**Confirmed provider option shapes:**
- `google`: `{ clientId: string | string[], clientSecret: string, accessType?: "offline" | "online" }`
- `github`: `{ clientId: string, clientSecret: string }`

Both come from `ProviderOptions<T>` — `clientId` and `clientSecret` are the only required fields.

---

## 2. Conditional Spread Pattern (D-03 / D-04)

Correct implementation for `auth.ts` — independent per-provider activation:

```typescript
import { betterAuth } from 'better-auth'

export const auth = betterAuth({
  // ... existing config unchanged ...
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          },
        }
      : {}),
    ...(process.env.GITHUB_CLIENT_ID
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
          },
        }
      : {}),
  },
  plugins: [nextCookies()],
})
```

**Why `GOOGLE_CLIENT_ID` as the guard (not `GOOGLE_CLIENT_SECRET`):** The client ID is the primary public identifier; both must be set to use the provider, but checking ID is conventional. The `!` non-null assertion on `clientSecret` is safe because it is always paired with the ID in practice — acceptable given env discipline enforced by `.env.example`.

**Key invariants:**
- Google absent → `socialProviders.google` is not present in the config object at all
- GitHub absent → same
- Both absent → `socialProviders: {}` (empty object, valid)
- TypeScript compiles cleanly: spread of `{}` does not affect the object type

---

## 3. OAuth Callback URLs

Better Auth v1.x social callback route pattern:

```
{BETTER_AUTH_URL}/api/auth/callback/{provider-id}
```

Exact values for this phase:
- Google: `{BETTER_AUTH_URL}/api/auth/callback/google`
- GitHub: `{BETTER_AUTH_URL}/api/auth/callback/github`

The provider ID comes from `{ id: "google" }` / `{ id: "github" }` in the Better Auth social provider definitions — these are hardcoded in the library, not configurable.

**For OAuth app registration:**
- Google Cloud Console → Authorized redirect URIs → `https://<production-origin>/api/auth/callback/google`
- GitHub OAuth Apps → Authorization callback URL → `https://<production-origin>/api/auth/callback/github`

---

## 4. Files to Modify

### `auth.ts` (primary change)

Add `socialProviders` with conditional spread (pattern in §2). Insert after `emailAndPassword` block, before `database`. No other changes to existing config.

### `lib/actions/auth.ts`

Remove:
1. Import: `import { isRegistrationEnabled, REGISTRATION_DISABLED_MESSAGE } from '@/lib/auth/registration'`
2. Guard block in `signUpAction`:
   ```typescript
   if (!isRegistrationEnabled()) {
     return { error: REGISTRATION_DISABLED_MESSAGE }
   }
   ```

Result: `signUpAction` proceeds directly to `RegisterSchema.safeParse(...)`.

### `app/api/auth/[...all]/route.ts`

Remove registration guard from `POST`. Simplify from current complex form to:
```typescript
import { auth } from '@/auth'
import { toNextJsHandler } from 'better-auth/next-js'

export const { GET, POST } = toNextJsHandler(auth)
```
Remove: `isRegistrationEnabled`, `isEmailSignUpRequest`, `REGISTRATION_DISABLED_MESSAGE` imports + logic.

### `.env.example`

1. Add OAuth env vars section after Auth block:
   ```
   # -----------------------------------------------------------------------------
   # OAuth providers (optional — activate by adding both vars for a provider)
   # -----------------------------------------------------------------------------
   # Register at https://console.cloud.google.com/apis/credentials
   # Authorized redirect URI: {BETTER_AUTH_URL}/api/auth/callback/google
   # GOOGLE_CLIENT_ID=
   # GOOGLE_CLIENT_SECRET=

   # Register at https://github.com/settings/applications/new
   # Authorization callback URL: {BETTER_AUTH_URL}/api/auth/callback/github
   # GITHUB_CLIENT_ID=
   # GITHUB_CLIENT_SECRET=
   ```
2. Remove `REGISTRATION_ENABLED` entry (D-02).

### `docs/deploy/vercel-supabase-r2.md`

- Remove all `REGISTRATION_ENABLED` references (step 2 of the smoke checklist, step 8 "disable registration", step 9 "check direct disabled-signup rejection", step 11 "re-enable registration", failure tree item 5, evidence table rows for disabled-signup and re-enable, the optional browser variables table entry for `PLAYWRIGHT_SMOKE_EXPECT_REGISTRATION_DISABLED`).
- Add OAuth env var section to the Vercel runtime variables table listing all four vars as optional/secret.
- Add callback URL format note: `{BETTER_AUTH_URL}/api/auth/callback/google` and `…/github`.

---

## 5. Files to Delete

| File | Reason |
|------|--------|
| `lib/auth/registration.ts` | Module being deleted (D-01) |
| `tests/registration-config.test.ts` | Tests `isRegistrationEnabled()` which no longer exists |
| `tests/auth-actions-registration.test.ts` | Tests the `signUpAction` registration guard being removed |
| `tests/auth-route-registration.test.ts` | Tests the `POST /api/auth/sign-up/email` route guard being removed |

---

## 6. Files to Update — Smoke Tests

### `tests/production-smoke.test.ts`

Remove/update all `registration_disabled` references (lines ~153, ~181, ~264). The smoke script no longer tests the registration guardrail.

### `tests/production-smoke.spec.ts`

Remove or `.skip` the registration-disabled Playwright test branches (~lines 78, 132–148, 152). The `enabled registration creates a disposable user` test remains.

### `tests/auth-errors.test.ts`

Line ~43: the comment "keeps unknown registration errors generic to avoid account enumeration" is a test description for `signUpEmail` failure handling — keep this test as-is. The word "registration" in the description refers to the sign-up flow, not the guardrail module. No code change needed.

---

## 7. No Migration Required

`lib/db/schema.ts` §account (L97) already defines the `account` table. Better Auth uses this table for social provider account storage. Phase 30 adds no new columns. Confirmed: no `drizzle-kit generate` or migration needed.

---

## 8. Import Consumer Audit

All files importing from `lib/auth/registration`:

| File | Import used | Action |
|------|-------------|--------|
| `lib/actions/auth.ts` | `isRegistrationEnabled`, `REGISTRATION_DISABLED_MESSAGE` | Remove import + guard |
| `app/api/auth/[...all]/route.ts` | `isRegistrationEnabled`, `REGISTRATION_DISABLED_MESSAGE` | Remove import + guard |
| `tests/registration-config.test.ts` | `isRegistrationEnabled`, `REGISTRATION_DISABLED_MESSAGE`, `RegistrationEnv` | Delete file |
| `tests/auth-actions-registration.test.ts` | `REGISTRATION_DISABLED_MESSAGE` | Delete file |
| `tests/auth-route-registration.test.ts` | `REGISTRATION_DISABLED_MESSAGE` | Delete file |

No other consumers. After these changes, `lib/auth/registration.ts` is safe to delete.

---

## 9. Risks & Pitfalls

1. **TypeScript strict-null on `clientSecret`**: The `!` assertion is deliberate — if only `GOOGLE_CLIENT_ID` is set without `GOOGLE_CLIENT_SECRET`, Better Auth will runtime-fail. Document in `.env.example` that both vars must be set together (comment: "activate by adding both vars").

2. **`GOOGLE_CLIENT_SECRET` used with `!` after guard on ID**: The guard checks `GOOGLE_CLIENT_ID`, not `GOOGLE_CLIENT_SECRET`. If someone sets only the ID, `process.env.GOOGLE_CLIENT_SECRET` is undefined and the `!` suppresses the compile error. Acceptable for this project's risk profile — the deploy runbook documents the pairing requirement.

3. **Production smoke tests**: `tests/production-smoke.test.ts` and `.spec.ts` have tightly-coupled `registration_disabled` assertions. Leaving them untouched would cause test failures after D-01 is applied. Must be updated in the same wave as deletion.

4. **`app/api/auth/[...all]/route.ts` simplification**: After removing the registration guard, the `POST` export changes from a named function to a destructured export. Ensure the Next.js App Router route exports are valid — `export const { GET, POST } = toNextJsHandler(auth)` is the correct form per Better Auth Next.js docs.

5. **Better Auth URL for callback**: `BETTER_AUTH_URL` must be set correctly in production for OAuth redirects to work. This is already in `.env.example` and the runbook. No code change needed for this.

---

## Validation Architecture

### Test Strategy

Phase 30 is config-level only — no new business logic, no new DB schema. Tests should verify:

**Unit: `auth.ts` conditional spread (new test file or inline snapshot)**
- When `GOOGLE_CLIENT_ID` is set → `betterAuth()` config includes `socialProviders.google`
- When `GOOGLE_CLIENT_ID` is unset → `socialProviders.google` is absent
- Same for GitHub
- When both absent → `socialProviders` is `{}` or omitted cleanly

**Unit: `signUpAction` no longer guarded (existing `auth-actions-registration.test.ts` is deleted)**
- After deletion: verify `signUpAction` no longer returns `registration_disabled` error — no new test needed; the file is gone. The remaining behavior (`signUpEmail` call, redirect) is already covered by non-registration tests.

**Unit: `route.ts` simplification**
- `tests/auth-route-registration.test.ts` is deleted. The new route is `toNextJsHandler(auth)` — no custom logic to test.

**Integration: TypeScript compilation**
- `yarn tsc --noEmit` must pass after all changes. This is the primary correctness gate for the conditional spread types.

**Smoke: No REGISTRATION_ENABLED check**
- `tests/production-smoke.spec.ts` — retained tests (enabled signup/login, R2 import) must still pass.

### Acceptance Validation Commands

```bash
# TypeScript gate (primary)
yarn tsc --noEmit

# Unit tests (delete the 3 registration test files first)
yarn test

# Verify no residual registration imports
grep -r "registration" lib/ app/ --include="*.ts" --include="*.tsx"
# Expected: zero matches

# Verify no REGISTRATION_ENABLED in .env.example
grep "REGISTRATION_ENABLED" .env.example
# Expected: zero matches
```

---

## RESEARCH COMPLETE
