---
phase: 31-oauth-ui
reviewed: 2026-05-21T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - tests/oauth-ui.test.tsx
  - tests/auth.spec.ts
  - components/auth/social-provider-buttons.tsx
  - components/auth/login-form.tsx
  - components/auth/register-form.tsx
  - app/(auth)/login/page.tsx
  - app/(auth)/register/page.tsx
  - app/api/auth/[...all]/route.ts
findings:
  critical: 3
  warning: 4
  info: 2
  total: 9
status: issues_found
---

# Phase 31: Code Review Report

**Reviewed:** 2026-05-21
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 31 delivers the OAuth UI layer: social provider buttons, updated login/register forms, and the Better Auth catch-all route handler. The core OAuth flow wiring is structurally correct. Three critical issues were found: internal infrastructure commands leaked into user-facing error messages in production, a non-null assertion on `GOOGLE_CLIENT_SECRET`/`GITHUB_CLIENT_SECRET` that will crash at startup when only the `_CLIENT_ID` vars are set, and a missing `name` field on the register form that breaks the `signUpAction` silently. Four warnings cover the vitest configuration missing JSX/environment support (making the React component tests unreliable), unguarded `oauthError` passthrough from query params, the `BETTER_AUTH_SECRET!` non-null assertion, and missing form field labels. Two info items cover minor code issues.

---

## Critical Issues

### CR-01: Internal infrastructure commands exposed in user-facing error messages

**File:** `lib/actions/auth-errors.ts:90-94`

**Issue:** `getSafeSignUpErrorMessage` returns messages that contain developer-only shell commands (`npm run db:up`, `npm run db:migrate`) directly to the end user via the register form's error banner. In any environment where Postgres is unreachable or a migration is missing, real users see: `"Database non raggiungibile. Avvia Postgres con \`npm run db:up\`, poi esegui \`npm run db:migrate\` e riprova."` These messages are only safe as developer diagnostics, not product copy. They also reveal the internal stack (Docker, npm, migration tooling) to anonymous users.

**Fix:**
```ts
// lib/actions/auth-errors.ts
export function getSafeSignUpErrorMessage(error: unknown): string {
  const text = collectErrorText(error)

  if (matchesAny(text, DB_UNAVAILABLE_PATTERNS)) {
    // Log the full text for operators; surface a generic message to the user
    logger.error({ event: 'db_unavailable_on_signup', hint: text.slice(0, 300) })
    return 'Servizio temporaneamente non disponibile. Riprova tra qualche minuto.'
  }

  if (matchesAny(text, DB_MIGRATION_PATTERNS)) {
    logger.error({ event: 'db_schema_mismatch_on_signup', hint: text.slice(0, 300) })
    return 'Si è verificato un errore. Contatta il supporto se il problema persiste.'
  }

  return GENERIC_SIGN_UP_ERROR
}
```

---

### CR-02: Non-null assertion on OAuth client secrets crashes when only `_CLIENT_ID` is set

**File:** `auth.ts:19,27`

**Issue:** The `auth.ts` configuration guards the entire social provider block on `process.env.GOOGLE_CLIENT_ID` being truthy, then uses a non-null assertion on `process.env.GOOGLE_CLIENT_SECRET!` (and the GitHub equivalent). If `GOOGLE_CLIENT_ID` is defined but `GOOGLE_CLIENT_SECRET` is not (a misconfiguration that is easy to make), the assertion does not throw at startup; `betterAuth` receives `clientSecret: undefined` cast as `string`, which will silently fail or produce a runtime error mid-flow with a confusing message. The login/register pages independently activate the provider button based only on `GOOGLE_CLIENT_ID`, meaning users will see the button and get a cryptic error after clicking.

**Fix:**
```ts
// auth.ts — guard both vars together
...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  ? {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET, // no ! needed
      },
    }
  : {}),
...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
  ? {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
      },
    }
  : {}),
```

Apply the same guard in the page components so the button is only shown when both vars are present:

```ts
// app/(auth)/login/page.tsx and app/(auth)/register/page.tsx
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) activeProviders.push('google')
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) activeProviders.push('github')
```

---

### CR-03: Register form omits the `name` field — `signUpAction` silently uses email as name placeholder

**File:** `components/auth/register-form.tsx:60-77`, `lib/actions/auth.ts:52`

**Issue:** `signUpAction` passes `name: parsed.data.email` to `auth.api.signUpEmail` (comment: "Better Auth requires 'name' — use email as placeholder"). The register form has no `name` input field and no `name` in `RegisterSchema`. This means every new user is stored with their email address as their display name. This is a silent data quality bug: the user never provides a real name, but the field is permanently set to the email. If a display name is later shown anywhere in the UI, or if the auth token payload includes `name`, users will see their own email address rendered as their name.

More critically, `RegisterSchema` (defined in `lib/validations/auth.ts`) has no `name` field, so there is no path for the user to provide it even if the form were extended. The workaround is baked into the action with no comment linking to a future fix.

**Fix:** Either add a `name` field to the form and schema (preferred — collects real data), or document and track this as an explicit known limitation with a plan to migrate it:

```ts
// Option A — add name to RegisterSchema
export const RegisterSchema = z.object({
  name: z.string().min(1, { error: 'Il nome è obbligatorio.' }).max(100).trim(),
  email: z.email({ error: 'Email non valida.' }).trim(),
  password: z.string().min(8, { error: 'La password deve essere di almeno 8 caratteri.' }),
})
```

```tsx
// components/auth/register-form.tsx — add before email input
<Input
  type="text"
  name="name"
  placeholder="Nome"
  autoComplete="name"
/>
```

If a name field is intentionally deferred, replace the silent placeholder with a generated or explicitly null value and ensure no UI surface renders the `name` field until it is properly collected.

---

## Warnings

### WR-01: Vitest config lacks JSX transform and DOM environment — React component tests may not run correctly

**File:** `vitest.config.ts:1-20`, `tests/oauth-ui.test.tsx`

**Issue:** `vitest.config.ts` declares no `environment` (defaults to `node`), has no React/JSX plugin (`@vitejs/plugin-react` is absent from `package.json`), and sets no `globals`. The test file `tests/oauth-ui.test.tsx` renders a React component with JSX and calls `renderToStaticMarkup`. Without a JSX transform configured, Vitest will fail to parse the JSX syntax. Without a DOM or SSR environment, `react-dom/server` may behave unexpectedly. The test file imports JSX but `vitest.config.ts` has no plugin to handle `.tsx` files.

**Fix:**
```ts
// vitest.config.ts
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: {
    environment: 'node', // renderToStaticMarkup works in node; for interactive tests use jsdom
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'lib/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.next/**', '**/.claude/**', '**/.gsd/**', '**/*.spec.ts'],
  },
})
```

Add to devDependencies: `@vitejs/plugin-react`.

---

### WR-02: `oauthError` from query params is passed directly to `getOAuthErrorMessage` without sanitisation

**File:** `app/(auth)/login/page.tsx:8,13`, `app/(auth)/register/page.tsx:8,13`

**Issue:** The `error` query parameter from `searchParams` is passed directly as `oauthError` to the form component, which calls `getOAuthErrorMessage(oauthError)`. While `getOAuthErrorMessage` maps known codes to safe Italian strings (and falls back to a generic message), the raw `code` value is never validated against a known allowlist before the lookup. An attacker can set `?error=<any string>` in the URL; the function always returns the fallback message, so no injection is possible through the error message itself. However, `oauthError` is also typed as `string | undefined` on the form props and passed through — if any downstream code were to render it raw (e.g. a future change that removes the `getOAuthErrorMessage` indirection), XSS becomes possible.

The immediate practical risk is reflected content: if a future developer adds `{oauthError}` directly in the template instead of going through `getOAuthErrorMessage`, the raw query param value is rendered. A defensive fix now is low-effort.

**Fix:**
```ts
// app/(auth)/login/page.tsx and app/(auth)/register/page.tsx
const KNOWN_OAUTH_ERRORS = new Set([
  'OAuthCallbackError', 'access_denied', 'invalid_code',
  'email_not_found', 'unable_to_get_user_info', 'state_mismatch',
  'oauth_provider_not_found',
])

const safeError = error && KNOWN_OAUTH_ERRORS.has(error) ? error : undefined
return <LoginForm activeProviders={activeProviders} oauthError={safeError} />
```

---

### WR-03: `BETTER_AUTH_SECRET!` non-null assertion — silent undefined in production if env var missing

**File:** `auth.ts:7`

**Issue:** `process.env.BETTER_AUTH_SECRET!` uses a TypeScript non-null assertion, which is erased at runtime. If `BETTER_AUTH_SECRET` is not set, `betterAuth` receives `undefined` for `secret`. Depending on the Better Auth version, this may result in a session that uses an empty or predictable secret, creating a security hole where session tokens could be forged. At minimum it should fail loudly at startup.

**Fix:**
```ts
// auth.ts
const secret = process.env.BETTER_AUTH_SECRET
if (!secret) throw new Error('BETTER_AUTH_SECRET environment variable is required')

export const auth = betterAuth({
  secret,
  // ...
})
```

---

### WR-04: Form inputs have no associated `<label>` elements — accessibility and autocomplete failure

**File:** `components/auth/login-form.tsx:61-72`, `components/auth/register-form.tsx:60-76`

**Issue:** Email and password `<Input>` elements use only `placeholder` attributes without `htmlFor`/`id` pairs or `aria-label`. Screen readers cannot announce the field purpose; password managers that rely on label-to-input association may not fill credentials correctly. `placeholder` text disappears on focus and is not a substitute for labels per WCAG 2.1 SC 1.3.1 and 3.3.2.

**Fix:**
```tsx
// components/auth/login-form.tsx (and register-form.tsx equivalently)
<div className="flex flex-col gap-1">
  <label htmlFor="email" className="sr-only">Email</label>
  <Input
    id="email"
    type="email"
    name="email"
    placeholder="Email"
    autoComplete="email"
  />
</div>
<div className="flex flex-col gap-1">
  <label htmlFor="password" className="sr-only">Password</label>
  <Input
    id="password"
    type="password"
    name="password"
    placeholder="Password"
    autoComplete="current-password"
  />
</div>
```

---

## Info

### IN-01: Top-level `await import(...)` in test file depends on ESM module execution order

**File:** `tests/oauth-ui.test.tsx:14-16`

**Issue:** The component is imported via a top-level `await import(...)` placed after `vi.mock(...)`. This relies on the fact that Vitest hoists `vi.mock` calls to run before any imports (as documented). The pattern works but is unusual compared to the standard `import ... from` approach used after mocking. If the mock registration is ever moved inside a `beforeAll` or a `beforeEach`, the hoisting guarantee no longer applies and the component will import the real `authClient`. The current structure is fragile if reorganised.

**Fix:** Prefer the standard import-with-inline-mock pattern:

```ts
vi.mock('@/lib/auth-client', () => ({ authClient: { signIn: { social: vi.fn() } } }))
import { SocialProviderButtons, getOAuthErrorMessage } from '@/components/auth/social-provider-buttons'
```

---

### IN-02: `auth.spec.ts` Playwright test makes a live network request without `test.fixme()`

**File:** `tests/auth.spec.ts:55-60`

**Issue:** The test `'unauthenticated /dashboard redirects to /login'` calls `page.goto('/dashboard')` and asserts `response?.url()` contains `/login`. This test is not marked `test.fixme()` — it is an active Playwright E2E test. The comment says "Before Plan 04: proxy.ts passes all requests, page returns 200 — this test intentionally fails." An intentionally failing active test pollutes CI signal: it will count as a genuine failure and mask real regressions.

**Fix:** Mark it `test.fixme()` with the same explanatory comment until `proxy.ts` route protection (Plan 04) is implemented, consistent with all other tests in the file that use `test.fixme()` for unimplemented behaviour.

---

_Reviewed: 2026-05-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
