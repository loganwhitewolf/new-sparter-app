# Phase 30: oauth-config - Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 9 (5 modify, 4 delete)
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `auth.ts` | config | request-response | `auth.ts` (self — modify) | exact |
| `lib/actions/auth.ts` | action | request-response | `lib/actions/auth.ts` (self — modify) | exact |
| `app/api/auth/[...all]/route.ts` | route | request-response | `app/api/auth/[...all]/route.ts` (self — simplify) | exact |
| `.env.example` | config | n/a | `.env.example` (self — modify) | exact |
| `docs/deploy/vercel-supabase-r2.md` | documentation | n/a | `docs/deploy/vercel-supabase-r2.md` (self — modify) | exact |
| `lib/auth/registration.ts` | utility | n/a | — (DELETE) | deleted |
| `tests/registration-config.test.ts` | test | n/a | — (DELETE) | deleted |
| `tests/auth-actions-registration.test.ts` | test | n/a | — (DELETE) | deleted |
| `tests/auth-route-registration.test.ts` | test | n/a | — (DELETE) | deleted |

---

## Pattern Assignments

### `auth.ts` (config — modify)

**Current file:** `auth.ts` (read in full above)

**What exists now** (lines 1–64):
```typescript
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { db } from '@/lib/db'

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
  },
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  user: {
    additionalFields: { /* firstName, lastName, jobTitle, location, phone, timezone, subscriptionPlan, role */ },
  },
  plugins: [nextCookies()],
})
```

**What to add — socialProviders block (D-03 / D-04):**

Insert `socialProviders` between `emailAndPassword` and `database`. Use per-provider conditional spread:

```typescript
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
```

**Key invariants:**
- Guard on `GOOGLE_CLIENT_ID` (not `GOOGLE_CLIENT_SECRET`); `!` on secret is intentional
- Both absent → `socialProviders: {}` (valid empty object)
- No other changes to the file

---

### `lib/actions/auth.ts` (action — modify)

**Current file:** `lib/actions/auth.ts` (read in full above)

**Lines to remove (D-01):**

Line 7 — import to delete:
```typescript
import { isRegistrationEnabled, REGISTRATION_DISABLED_MESSAGE } from '@/lib/auth/registration'
```

Lines 39–41 — guard block to delete from `signUpAction`:
```typescript
  if (!isRegistrationEnabled()) {
    return { error: REGISTRATION_DISABLED_MESSAGE }
  }
```

**Result:** `signUpAction` proceeds directly to `RegisterSchema.safeParse(...)` on what is currently line 43. All other code in this file is untouched.

**Preserved pattern after edit** (lines 35–38 and 43–67, renumbered):
```typescript
export async function signUpAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const parsed = RegisterSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  // ... rest of function unchanged
```

---

### `app/api/auth/[...all]/route.ts` (route — simplify)

**Current file:** `app/api/auth/[...all]/route.ts` (read in full above, 27 lines)

**Lines to remove:**
- Line 2: `import { REGISTRATION_DISABLED_MESSAGE, isRegistrationEnabled } from '@/lib/auth/registration'`
- Lines 5–10: `const authHandlers = ...` and `function isEmailSignUpRequest(...)` helpers
- Lines 11–27: the entire custom `GET` and `POST` exports with guard logic

**Target state after simplification (per RESEARCH.md §4):**
```typescript
import { auth } from '@/auth'
import { toNextJsHandler } from 'better-auth/next-js'

export const { GET, POST } = toNextJsHandler(auth)
```

Note: `export const { GET, POST }` (destructured) replaces the named function exports. This is valid Next.js App Router route handler syntax per Better Auth docs.

---

### `.env.example` (config — modify)

**Current file:** `.env.example` (read in full above, 89 lines)

**Line to remove (D-02):**

Lines 51–54 — entire registration guardrail comment block:
```
# Server-side production registration guardrail. Registration is enabled by
# default when this is unset, blank, or malformed. Set to false, 0, no, or off
# to block new signup server-side while keeping existing-user login available.
# Vercel environment changes require a redeploy before runtime behavior changes.
# REGISTRATION_ENABLED=true
```

**Section to add (D-06):**

Insert after the Auth block (after line 47 `# AUTH_DEBUG=1`), before the R2 block:

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

---

### `docs/deploy/vercel-supabase-r2.md` (documentation — modify)

**Current file:** `docs/deploy/vercel-supabase-r2.md` (read in full, 270 lines)

**Exact references to remove (D-02 / D-05):**

All content related to `REGISTRATION_ENABLED` and the registration guardrail feature:

1. **Step 2 of smoke sequence** (line 10): remove `, and \`REGISTRATION_ENABLED\`` from the list of vars to configure
2. **Step 7** (line 15): remove "`With \`REGISTRATION_ENABLED\` unset or true-like and after redeploy`" preamble
3. **Step 8** (line 16): delete entire step ("Disable registration and redeploy...")
4. **Step 9** (line 17): delete entire step ("Check direct disabled-signup rejection...")
5. **Step 11** (line 19): delete entire step ("Re-enable registration if desired...")
6. **Optional browser smoke table** (line 41): delete row for `PLAYWRIGHT_SMOKE_EXPECT_REGISTRATION_DISABLED`
7. **Recommended phase sequence** (lines 46–48): delete step 2 (disabled-registration Playwright run)
8. **Safe evidence table** rows (lines 61, 62): delete `disabled direct signup` and `preserved login` rows
9. **Failure tree item 5** (lines 74–75): delete "Registration behavior does not match `REGISTRATION_ENABLED`..."
10. **Vercel runtime variables table** (line 102): delete `REGISTRATION_ENABLED` row
11. **Entire "Registration toggle smoke and recovery" section** (lines 106–125): delete
12. **No-secret verification commands** (line 254): remove `grep -q "REGISTRATION_ENABLED" .env.example` line
13. **Small-file R2 import smoke** (line 182): remove "S04 registration guardrail" reference in last paragraph

**Content to add (D-05):**

1. In the Vercel runtime variables table (after the auth secret rows, around line 91), add 4 new rows:

```markdown
| `GOOGLE_CLIENT_ID` | No | Optional | Google OAuth client ID. When set (together with `GOOGLE_CLIENT_SECRET`), activates the Google social login provider. Register at https://console.cloud.google.com/apis/credentials. Callback URL: `{BETTER_AUTH_URL}/api/auth/callback/google`. |
| `GOOGLE_CLIENT_SECRET` | No | Optional (paired with ID) | Google OAuth client secret. Must be set together with `GOOGLE_CLIENT_ID`. |
| `GITHUB_CLIENT_ID` | No | Optional | GitHub OAuth client ID. When set (together with `GITHUB_CLIENT_SECRET`), activates the GitHub social login provider. Register at https://github.com/settings/applications/new. Callback URL: `{BETTER_AUTH_URL}/api/auth/callback/github`. |
| `GITHUB_CLIENT_SECRET` | No | Optional (paired with ID) | GitHub OAuth client secret. Must be set together with `GITHUB_CLIENT_ID`. |
```

2. Add a note near the Auth section about callback URL construction:

```
OAuth callback URLs follow the pattern `{BETTER_AUTH_URL}/api/auth/callback/{provider-id}`. For Google: `.../callback/google`. For GitHub: `.../callback/github`. `BETTER_AUTH_URL` must be set to the correct production HTTPS origin for OAuth redirects to work.
```

---

## Files to Delete

| File | Current Content Summary | Reason |
|---|---|---|
| `lib/auth/registration.ts` | 30 lines — exports `isRegistrationEnabled()`, `REGISTRATION_DISABLED_MESSAGE`, `RegistrationEnv` type | D-01: module fully removed |
| `tests/registration-config.test.ts` | 70 lines — tests `isRegistrationEnabled()` with various env values | D-01: module it tests no longer exists |
| `tests/auth-actions-registration.test.ts` | 72 lines — tests `signUpAction` returning disabled-registration message | D-01: guard being removed from `signUpAction` |
| `tests/auth-route-registration.test.ts` | 105 lines — tests `POST /api/auth/sign-up/email` returning `403 registration_disabled` | D-01: route guard being removed |

---

## Smoke Test Modifications (keep, not delete)

### `tests/production-smoke.test.ts` (modify — keep file)

**Current file:** `tests/production-smoke.test.ts` (274 lines)

**What to remove:**

1. **Lines 142–188** — the entire `'passes healthy runtime and disabled-signup rejection...'` test that calls `--expect-disabled-signup` and asserts `registration_disabled` phase output
2. **Lines 235–273** — the entire `'production-smoke CLI disabled-signup phase'` describe block with its two test cases about disabled-signup behavior

**What to preserve:** All other tests (config validation, health phase healthy/degraded/malformed).

**Key pattern of what these tests look like** (so executor knows what to delete):
```typescript
// Lines 142–188: delete this entire it() block
it('passes healthy runtime and disabled-signup rejection while printing only safe fields', async () => {
  // ... server with /api/auth/sign-up/email returning 403 registration_disabled ...
  const run = await runSmoke(['--origin', origin, '--local-test-mode', '--expect-disabled-signup'])
  // ... assertions on disabled_signup phase ...
})

// Lines 235–273: delete this entire describe() block
describe('production-smoke CLI disabled-signup phase', () => {
  it.each([...])('fails safely when disabled signup returns $status', ...)
  it('fails safely on timeout without printing stack traces', ...)
})
```

---

### `tests/production-smoke.spec.ts` (modify — keep file)

**Current file:** `tests/production-smoke.spec.ts` (189 lines)

**What to remove:**

1. **Lines 66–79** — `expectDisabledSignup()` helper function (used only by the disabled-registration test)
2. **Lines 147–159** — the entire `'disabled registration rejects direct signup while existing login still works'` test block
3. **Line 133** — inside the `'enabled registration creates a disposable user...'` test, remove the `test.skip(envFlag('PLAYWRIGHT_SMOKE_EXPECT_REGISTRATION_DISABLED'), ...)` guard line (the test should run unconditionally)

**What to preserve:**
- `'enabled registration creates a disposable user and reaches dashboard'` test (lines 132–145) — keep, remove only the inner skip guard
- `'optional R2 browser import reaches analyze route...'` test (lines 161–188) — keep entirely

---

## Shared Patterns

### Env-conditional activation (auth.ts D-03 / D-04)

No prior analog in this codebase for runtime-conditional Better Auth config. The pattern is idiomatic TypeScript conditional spread:

```typescript
...(process.env.SOME_KEY ? { key: value } : {})
```

Guard on the primary identifier (`CLIENT_ID`), not the secret. `!` non-null assertion on the secret is acceptable given env discipline enforced by `.env.example` pairing note.

### Import removal pattern (lib/actions/auth.ts, route.ts)

Both files follow the same removal pattern:
1. Delete the named import from `@/lib/auth/registration`
2. Delete the guard block that references the imported symbols
3. No other changes — surrounding code structure is preserved

### toNextJsHandler destructured export (route.ts)

Better Auth Next.js adapter canonical form:
```typescript
export const { GET, POST } = toNextJsHandler(auth)
```
This replaces any custom `GET`/`POST` functions that wrap the handler. The import from `better-auth/next-js` is already present in the current route file — only the registration import and guard logic are removed.

---

## Residual Reference Audit

After all changes, run:
```bash
grep -r "registration" lib/ app/ --include="*.ts" --include="*.tsx"
# Expected: zero matches

grep "REGISTRATION_ENABLED" .env.example
# Expected: zero matches

grep -r "isRegistrationEnabled\|REGISTRATION_DISABLED_MESSAGE\|RegistrationEnv" . --include="*.ts" --include="*.tsx"
# Expected: zero matches (all consumers deleted or modified)
```

---

## Metadata

**Analog search scope:** `auth.ts`, `lib/actions/auth.ts`, `app/api/auth/[...all]/route.ts`, `lib/auth/registration.ts`, `.env.example`, `docs/deploy/vercel-supabase-r2.md`, `tests/registration-config.test.ts`, `tests/auth-actions-registration.test.ts`, `tests/auth-route-registration.test.ts`, `tests/production-smoke.test.ts`, `tests/production-smoke.spec.ts`
**Files scanned:** 11
**Pattern extraction date:** 2026-05-21
