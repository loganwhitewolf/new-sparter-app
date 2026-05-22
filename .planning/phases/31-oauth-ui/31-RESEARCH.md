# Phase 31: oauth-ui - Research

**Researched:** 2026-05-21
**Domain:** Next.js App Router server components + Better Auth client-side OAuth + shadcn/ui
**Confidence:** HIGH

## Summary

Phase 31 is a pure UI layer: Better Auth's social provider backend was fully wired in Phase 30 (`auth.ts` already conditionally registers Google and GitHub). This phase adds "Continua con Google" and "Continua con GitHub" buttons to the `/login` and `/register` pages. The critical architectural move is converting both pages from monolithic client components into server component wrappers that read `process.env.GOOGLE_CLIENT_ID` / `process.env.GITHUB_CLIENT_ID` and pass an `activeProviders` array down to client form components.

The OAuth flow itself is a client-side redirect: `authClient.signIn.social({ provider, callbackURL: '/dashboard', errorCallbackURL: '/login?error=...' })` triggers a server round-trip to `/api/auth/sign-in/social`, which redirects the browser to the provider. On success, Better Auth's `/api/auth/callback/:id` sets the session cookie and redirects to `callbackURL`. On error, it redirects to `errorURL` (stored in OAuth state) with `?error=<code>&error_description=<text>` appended — this is the query-param pattern the login page must read.

The `errorCallbackURL` option in `signIn.social()` is confirmed working in the installed version (v1.6.9): the source in `dist/api/routes/sign-in.mjs` shows it is stored in OAuth state as `errorURL`, and `callback.mjs` calls `redirectOnError(error, description)` which builds `${errorURL}?error=<code>&error_description=<text>`. The earlier GitHub issues reporting it as broken predate v1.6.x.

**Primary recommendation:** Convert `login/page.tsx` and `register/page.tsx` to async server components. Extract a shared `SocialProviderButtons` client component and a new `LoginForm` / `RegisterForm` client component that receives `activeProviders`. Wire `authClient.signIn.social()` on button click with `errorCallbackURL: '/login?error=OAuthCallbackError'`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Social provider buttons appear above the email/password form on both pages.
- **D-02:** A horizontal divider with the text "— Oppure —" separates the social buttons from the email/password form below.
- **D-03:** Order within the social buttons section: Google first, GitHub second (when both are active).
- **D-04:** Both buttons use "Continua con Google" / "Continua con GitHub" — same wording on login and register pages. No context-specific variants.
- **D-05:** The page files (`login/page.tsx`, `register/page.tsx`) become server components that read `process.env.GOOGLE_CLIENT_ID` and `process.env.GITHUB_CLIENT_ID` and pass an `activeProviders: ('google' | 'github')[]` prop to a client-side form component.
- **D-06:** The client form component renders social buttons only for providers present in `activeProviders`. If the array is empty, the social section and divider are not rendered at all.
- **D-07:** When the OAuth callback fails, Better Auth redirects to `/login?error=...`. The login (and register) pages read the `error` URL search param and display it using the existing `<Alert variant="destructive">` component.
- **D-08:** Map known error codes to human-readable Italian messages (e.g. `"OAuthCallbackError"` → "Accesso con social non riuscito. Riprova."). Unknown error codes fall back to a generic message.
- **D-09 (Claude's Discretion):** Extract a shared `SocialProviderButtons` component (receives `providers: ('google' | 'github')[]`) to avoid duplicating button markup between login and register pages.

### Claude's Discretion
- Exact loading state during OAuth redirect (spinner on button vs. nothing — redirect is near-instant)
- Icon choice for Google/GitHub buttons (SVG inline vs. Lucide)
- Tailwind spacing within the social buttons section

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OAUTH-01 | User can sign in with an existing Google account | `authClient.signIn.social({ provider: 'google' })` triggers the full OAuth flow; existing Google account matches by email via `handleOAuthUserInfo` |
| OAUTH-02 | User can create a new account using Google OAuth | Better Auth creates a new user record automatically on first OAuth callback if no matching account exists (`isRegister` path in `callback.mjs`) |
| OAUTH-03 | User can sign in with an existing GitHub account | Same as OAUTH-01 with `provider: 'github'` |
| OAUTH-04 | User can create a new account using GitHub OAuth | Same as OAUTH-02 with GitHub provider |
| OAUTH-05 | Social provider buttons are hidden when provider credentials are not configured in env | Server component reads `process.env.GOOGLE_CLIENT_ID` / `process.env.GITHUB_CLIENT_ID`; passes only truthy providers in `activeProviders`; client renders nothing when array is empty |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Read env vars for provider availability | Frontend Server (SSR) | — | `process.env` is server-only; never expose to client via `NEXT_PUBLIC_` |
| Render social buttons conditionally | Browser / Client | — | `authClient.signIn.social()` is a client call; button state (loading) is local |
| Initiate OAuth redirect | Browser / Client | API / Backend | Client calls `/api/auth/sign-in/social`; server builds the redirect URL |
| Handle OAuth callback, create session | API / Backend | — | Better Auth `/api/auth/callback/:id` — already wired in Phase 30 |
| Display OAuth error from searchParams | Browser / Client | Frontend Server (SSR) | `searchParams.error` read in server component wrapper, passed as prop to client form |
| Map error codes to Italian strings | Browser / Client | — | Pure UI mapping, co-located with `SocialProviderButtons` or error-map file |

## Standard Stack

### Core

| Library | Version (installed) | Purpose | Why Standard |
|---------|---------------------|---------|--------------|
| `better-auth` | 1.6.9 (npm: 1.6.11) | OAuth initiation + callback handling | Already in project; Phase 30 wired providers |
| `better-auth/react` | same | `authClient.signIn.social()` client call | Official React client for Better Auth |
| `next` | 16.x | Server component env-var read + `searchParams` prop | App Router convention |
| `lucide-react` | 1.14.0 (npm: 1.16.0) | Icons (Loader2 already imported; Github available) | Already used in both auth pages |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@/components/ui/button` | project | Full-width `variant="outline"` social buttons | Consistent with existing `w-full` button pattern |
| `@/components/ui/separator` | project | Horizontal divider for "— Oppure —" | Already installed — no new dependency |
| `@/components/ui/alert` | project | OAuth error display | Already imported in both auth pages |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline SVG for Google icon | Lucide `Chrome` or image | No official Google icon in Lucide; inline SVG is the standard for brand accuracy |
| `errorCallbackURL` in `signIn.social()` | Catch block on client | `errorCallbackURL` works in v1.6.9 and is the idiomatic Better Auth pattern; server-side errors (CSRF mismatch etc.) are also handled |

**Installation:** No new packages needed. All dependencies are present.

## Architecture Patterns

### System Architecture Diagram

```
Browser                     Next.js Server              Better Auth API
  |                              |                            |
  | GET /login                   |                            |
  |----------------------------->|                            |
  |          Server component reads process.env.*_CLIENT_ID  |
  |          Builds activeProviders[]                        |
  |<-----------------------------|                            |
  | Render LoginForm(activeProviders, oauthError)            |
  |                              |                            |
  | click "Continua con Google"  |                            |
  | authClient.signIn.social()   |                            |
  |----------------------------->| POST /api/auth/sign-in/social
  |                              |--------------------------->|
  |                              |    Builds state (callbackURL, errorURL)
  |                              |    Returns redirect → provider
  |<---------------------------302 to accounts.google.com----|
  |                              |                            |
  | [user consents at Google]    |                            |
  |                              |                            |
  | GET /api/auth/callback/google|                            |
  |----------------------------->|--------------------------->|
  |                              |    validateAuthorizationCode
  |                              |    getUserInfo             |
  |                              |    handleOAuthUserInfo     |
  |                              |    setSessionCookie        |
  |<---------------------------302 to /dashboard (success)---|
  |                              |                            |
  |   [on error]                 |                            |
  |<---------------------------302 to /login?error=<code>----|
  |                              |                            |
  | GET /login?error=<code>      |                            |
  |----------------------------->|                            |
  |          Server reads searchParams.error                 |
  |          Passes oauthError prop to LoginForm             |
  |<-----------------------------|                            |
  | Render Alert variant=destructive with Italian message    |
```

### Recommended Project Structure

```
app/(auth)/
├── login/
│   └── page.tsx          # async server component — reads env + searchParams
│                          # renders <LoginForm activeProviders={[...]} oauthError={...} />
└── register/
    └── page.tsx          # same pattern

components/
└── auth/
    ├── login-form.tsx     # 'use client' — existing form logic + SocialProviderButtons
    ├── register-form.tsx  # 'use client' — existing form logic + SocialProviderButtons
    └── social-provider-buttons.tsx  # 'use client' — shared, receives providers[]
```

### Pattern 1: Server Component Wrapper — Env Detection + searchParams

The existing `login/page.tsx` is a `'use client'` component using `useActionState`. After the refactor the file becomes an async server component; all `useActionState` logic moves to a new `LoginForm` client component.

```typescript
// app/(auth)/login/page.tsx — becomes server component
// Source: Next.js App Router docs (searchParams as prop, async server component)
import { LoginForm } from '@/components/auth/login-form'

type Props = {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams
  const activeProviders: ('google' | 'github')[] = []
  if (process.env.GOOGLE_CLIENT_ID) activeProviders.push('google')
  if (process.env.GITHUB_CLIENT_ID) activeProviders.push('github')

  return <LoginForm activeProviders={activeProviders} oauthError={error} />
}
```

**Key point:** `searchParams` in App Router is now a Promise in Next.js 15+; must be awaited. [VERIFIED: Next.js App Router conventions in project's node_modules/next]

### Pattern 2: SocialProviderButtons Client Component

```typescript
// components/auth/social-provider-buttons.tsx
// Source: better-auth/react authClient.signIn.social() — verified from dist/api/routes/sign-in.mjs
'use client'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'

type Provider = 'google' | 'github'

interface Props {
  providers: Provider[]
}

export function SocialProviderButtons({ providers }: Props) {
  const [pending, setPending] = useState<Provider | null>(null)

  async function handleSignIn(provider: Provider) {
    setPending(provider)
    await authClient.signIn.social({
      provider,
      callbackURL: '/dashboard',
      errorCallbackURL: '/login?error=OAuthCallbackError',
    })
    // redirect happens; setPending never fires on success
    setPending(null)
  }

  return (
    <div className="flex flex-col gap-2">
      {providers.includes('google') && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => handleSignIn('google')}
          disabled={pending !== null}
        >
          {pending === 'google'
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : <GoogleIcon />}
          Continua con Google
        </Button>
      )}
      {providers.includes('github') && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => handleSignIn('github')}
          disabled={pending !== null}
        >
          {pending === 'github'
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : <GithubIcon />}
          Continua con GitHub
        </Button>
      )}
    </div>
  )
}
```

### Pattern 3: OAuth Error Mapping

```typescript
// co-located in social-provider-buttons.tsx or a lib/auth-errors-oauth.ts file
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  OAuthCallbackError:      'Accesso con social non riuscito. Riprova.',
  access_denied:           'Hai annullato il login. Riprova se vuoi continuare.',
  invalid_code:            'Sessione scaduta. Riprova il login.',
  email_not_found:         'Il provider non ha fornito un\'email. Usa un altro metodo.',
  unable_to_get_user_info: 'Impossibile recuperare i dati del profilo. Riprova.',
  state_mismatch:          'Sessione non valida. Riprova il login.',
  oauth_provider_not_found:'Provider non configurato. Contatta il supporto.',
}

const OAUTH_ERROR_FALLBACK = 'Accesso con social non riuscito. Riprova.'

export function getOAuthErrorMessage(code: string | undefined): string | null {
  if (!code) return null
  return OAUTH_ERROR_MESSAGES[code] ?? OAUTH_ERROR_FALLBACK
}
```

**Error codes confirmed from source:** `callback.mjs` in better-auth v1.6.9 emits: `invalid_callback_request`, `state_not_found`, `state_mismatch`, `please_restart_the_process`, `no_code`, `oauth_provider_not_found`, `invalid_code`, `email_not_found`, `unable_to_get_user_info`, `no_callback_url`, `unable_to_link_account`, `email_doesn't_match`, `account_already_linked_to_different_user`. Provider-level errors (e.g. `access_denied`) come from the provider and are passed through as-is. [VERIFIED: dist/api/routes/callback.mjs]

### Pattern 4: Divider "— Oppure —"

```typescript
// No external component needed; inline in LoginForm/RegisterForm
{activeProviders.length > 0 && (
  <>
    <SocialProviderButtons providers={activeProviders} />
    <div className="relative flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted-foreground">Oppure</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  </>
)}
// then the email/password <form> follows
```

The `<Separator>` component from shadcn/ui is horizontal-only and doesn't support inline text, so a manual flex div pattern is standard for text-dividers. [VERIFIED: components/ui/separator.tsx in project]

### Pattern 5: Icon Strategy

No official Google icon exists in Lucide. The standard approach for brand-accurate icons is an inline SVG component. Lucide does have `Github` (capital G) — use it for GitHub.

```typescript
// Inline SVG for Google brand icon (4-path multicolor)
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

// Lucide Github for GitHub
import { Github } from 'lucide-react'
// <Github className="h-4 w-4" />
```

[ASSUMED: The Google multicolor SVG paths above are from training knowledge; the exact path data should be verified against Google's brand guidelines before finalizing. The color hex values (#4285F4, #34A853, #FBBC05, #EA4335) are Google's official brand colors — well-established.]

### Anti-Patterns to Avoid

- **`NEXT_PUBLIC_` env vars for provider detection:** Never expose `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. The server component reads bare `process.env.GOOGLE_CLIENT_ID` and passes a boolean/array to the client.
- **Calling `signIn.social()` in a Server Action:** It is a client-side redirect trigger, not a server action. The call must be inside a `'use client'` onClick handler.
- **Reading `searchParams` as a plain object in Next.js 15+:** `searchParams` is now a Promise and must be `await`ed in async server components.
- **Using `<Separator>` for the text divider:** The Radix Separator does not support inline text children. Use a flex div pattern.
- **Passing `errorCallbackURL` pointing to `/register?error=...`:** The error always lands on `/login?error=...` per D-07 — even when initiated from the register page. The register page also reads `searchParams.error` for the same reason.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth redirect + state + PKCE | Custom OAuth client | `authClient.signIn.social()` | Better Auth handles state, code verifier, CSRF cookie, provider redirect, callback, session creation — all in one call |
| Session creation for new OAuth users | Manual user insert | Better Auth callback | `handleOAuthUserInfo` in `callback.mjs` auto-creates user on first login (OAUTH-02, OAUTH-04) |
| Secure state validation | Custom state cookie | Better Auth state mechanism | PKCE + signed state cookie — already in `dist/oauth2/state.mjs` |

## Common Pitfalls

### Pitfall 1: `searchParams` as Sync Object (Next.js 15+ Breaking Change)

**What goes wrong:** `searchParams.error` returns undefined or Next.js throws a warning about sync access to dynamic APIs.
**Why it happens:** Next.js 15 made `searchParams` (and `params`) a Promise in App Router page components.
**How to avoid:** Declare `searchParams: Promise<{ error?: string }>` in the Props type and `await searchParams` before reading.
**Warning signs:** TypeScript error on `searchParams.error` if the type is correct; runtime warning in dev console.

### Pitfall 2: `errorCallbackURL` Lands on `/login?error=...` for Both Pages

**What goes wrong:** Register page initiates OAuth but on error the user lands on `/login` instead of `/register`.
**Why it happens:** `errorCallbackURL` is hardcoded to `/login?error=OAuthCallbackError` in `signIn.social()`. The register page does not have its own error route.
**How to avoid:** Both pages read `searchParams.error`. The CONTEXT.md decision (D-07) says display on the initiating page — but since both pages share the same error display pattern and the register page also reads `searchParams.error`, passing `errorCallbackURL: '/register?error=OAuthCallbackError'` from the register button is the consistent approach.
**Decision needed:** The planner should decide whether to use `/login?error=...` uniformly or page-specific error URLs. Research supports per-page error URLs since both pages implement the same pattern. [ASSUMED: D-07 says "redirect to /login?error=..." but this may intend the login page only for both initiations. The planner should confirm with D-07's exact intent.]

### Pitfall 3: `signIn.social()` is Fire-and-Redirect

**What goes wrong:** Code after `await authClient.signIn.social()` runs on error but not on success (because the browser redirected away).
**Why it happens:** On success the browser navigates away; the Promise resolves the redirect response before completion on the client. On network error the Promise rejects.
**How to avoid:** Always call `setPending(null)` after the await as a safety reset, but accept that it will not execute on successful redirect. Wrap in try/catch to handle network-level failures gracefully.

### Pitfall 4: No Google Icon in Lucide

**What goes wrong:** Developer uses `Chrome` icon from Lucide for Google, or `Google` which does not exist in Lucide 1.14.0.
**Why it happens:** Lucide has no official Google brand icon.
**How to avoid:** Use an inline SVG for Google; use `Github` (capital G, exists in Lucide) for GitHub. [VERIFIED: lucide-react@1.14.0 installed in project]

### Pitfall 5: Both `activeProviders` Empty — No Structural Debris

**What goes wrong:** When both providers are unconfigured, the social section renders an empty `<div>` or the divider appears without buttons.
**Why it happens:** Conditional rendering logic wraps individual buttons but not the section wrapper.
**How to avoid:** Gate the entire social section + divider on `activeProviders.length > 0` (D-06). The `SocialProviderButtons` component itself should also return `null` if `providers` is empty.

## Code Examples

### signIn.social() — Confirmed API (v1.6.9)

```typescript
// Source: dist/api/routes/sign-in.mjs — socialSignInBodySchema
await authClient.signIn.social({
  provider: 'google',           // required: SocialProviderListEnum
  callbackURL: '/dashboard',    // optional — default '/'
  errorCallbackURL: '/login?error=OAuthCallbackError', // optional — stored in OAuth state as errorURL
  newUserCallbackURL: '/dashboard', // optional — for first-time registrations
  disableRedirect: false,       // optional — default false
})
```

### Error Redirect Format from callback.mjs

```
// Source: dist/api/routes/callback.mjs — redirectOnError()
/login?error=<code>&error_description=<url-encoded-description>

// Examples:
/login?error=access_denied&error_description=User+denied+access
/login?error=invalid_code
/login?error=email_not_found
/login?error=OAuthCallbackError   // when errorCallbackURL itself is the error URL
```

### Register Page — Same Server Component Pattern

```typescript
// app/(auth)/register/page.tsx
import { RegisterForm } from '@/components/auth/register-form'

type Props = {
  searchParams: Promise<{ error?: string }>
}

export default async function RegisterPage({ searchParams }: Props) {
  const { error } = await searchParams
  const activeProviders: ('google' | 'github')[] = []
  if (process.env.GOOGLE_CLIENT_ID) activeProviders.push('google')
  if (process.env.GITHUB_CLIENT_ID) activeProviders.push('github')

  return <RegisterForm activeProviders={activeProviders} oauthError={error} />
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `searchParams` as sync object | `searchParams` is a `Promise` | Next.js 15 | Must `await` before reading `.error` |
| `errorCallbackURL` broken (BA < 1.4) | Works in v1.6.9 | better-auth ~1.4+ | Safe to use `errorCallbackURL` in `signIn.social()` |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Google SVG path data in Code Examples / Icon pattern section | Code Examples | Icon renders incorrectly or violates Google brand guidelines — visual issue only, easily corrected |
| A2 | D-07 intent is that register-page OAuth errors also redirect to `/login?error=...` (not `/register?error=...`) | Common Pitfalls #2 | If register should redirect to `/register?error=...`, the `errorCallbackURL` value in `SocialProviderButtons` needs to be configurable per page |

## Open Questions (RESOLVED)

1. **OAuth error URL for register page**
   - What we know: D-07 says "redirect to /login?error=..." but the register page also reads `searchParams.error`
   - What's unclear: Should the register page use `errorCallbackURL: '/register?error=OAuthCallbackError'` so errors appear on the page the user was on?
   - Recommendation: Use per-page error URLs (`/login?error=...` from login, `/register?error=...` from register). Both pages implement the same display pattern. Planner should confirm.
   - **RESOLVED:** Plan 03 Task 2 usa per-page error URLs — `/login?error=OAuthCallbackError` dal login, `/register?error=OAuthCallbackError` dal register. Entrambe le pagine leggono il proprio `searchParams.error`. (Risolve assumption A2.)

## Environment Availability

Step 2.6: SKIPPED — phase is purely client UI + server component changes; no external tools, CLIs, or services beyond the already-running Next.js dev server and the Better Auth backend wired in Phase 30.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `yarn test --reporter=verbose` |
| Full suite command | `yarn test` |

Spec files (`*.spec.ts`) are excluded from Vitest; Playwright handles those.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OAUTH-01 | Existing Google user signs in successfully | e2e (Playwright) | `yarn test:e2e --grep "OAUTH-01"` | ❌ Wave 0 |
| OAUTH-02 | New Google user gets account created | e2e (Playwright) | `yarn test:e2e --grep "OAUTH-02"` | ❌ Wave 0 |
| OAUTH-03 | Existing GitHub user signs in successfully | e2e (Playwright) | `yarn test:e2e --grep "OAUTH-03"` | ❌ Wave 0 |
| OAUTH-04 | New GitHub user gets account created | e2e (Playwright) | `yarn test:e2e --grep "OAUTH-04"` | ❌ Wave 0 |
| OAUTH-05 | Provider button absent when CLIENT_ID env not set | unit (Vitest) | `yarn test tests/oauth-ui.test.tsx` | ❌ Wave 0 |
| OAUTH-05 | Provider button present when CLIENT_ID env is set | unit (Vitest) | `yarn test tests/oauth-ui.test.tsx` | ❌ Wave 0 |
| OAUTH-05 | Social section + divider hidden when activeProviders=[] | unit (Vitest) | `yarn test tests/oauth-ui.test.tsx` | ❌ Wave 0 |
| D-07/D-08 | OAuth error code maps to Italian message | unit (Vitest) | `yarn test tests/oauth-ui.test.tsx` | ❌ Wave 0 |

**Note:** OAUTH-01 through OAUTH-04 require real provider credentials and a live callback — these are practical manual-only tests in CI-less personal deploys. The Playwright spec stubs can be created with `test.fixme()` following the pattern in `tests/auth.spec.ts`. The unit tests for OAUTH-05 and error mapping are fully automatable with Vitest + React Testing Library (project already uses it in `tests/category-combobox.test.tsx`).

### Sampling Rate
- **Per task commit:** `yarn test tests/oauth-ui.test.tsx`
- **Per wave merge:** `yarn test`
- **Phase gate:** Full Vitest suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/oauth-ui.test.tsx` — covers OAUTH-05 (conditional rendering) and D-07/D-08 (error message mapping)
- [ ] `tests/auth.spec.ts` — add `test.fixme()` stubs for OAUTH-01 through OAUTH-04 following existing pattern
- [ ] `@testing-library/react` — verify installed (used in `category-combobox.test.tsx`, likely present)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better Auth handles token exchange, PKCE, session cookie — no custom auth logic in this phase |
| V3 Session Management | yes | Better Auth sets HttpOnly session cookie on callback — no UI change to session handling |
| V4 Access Control | no | No new protected routes |
| V5 Input Validation | yes | `searchParams.error` is a string read from URL — display only, never executed; map to Italian via lookup table (no XSS risk with React's JSX escaping) |
| V6 Cryptography | no | PKCE and state handled by Better Auth internals |

### Known Threat Patterns for OAuth UI

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Open redirect via `callbackURL` | Tampering | Better Auth validates `callbackURL` against trusted origins — no user-controlled input reaches `callbackURL` in this implementation (it is hardcoded to `/dashboard`) |
| XSS via `searchParams.error` | Tampering | React JSX auto-escapes string interpolation; the error code is passed to a lookup table, not rendered raw |
| State forgery / CSRF | Spoofing | Better Auth PKCE + signed state cookie — no UI action needed |
| Env var leakage to client | Information Disclosure | Server component reads bare `process.env.*_CLIENT_ID` (not `NEXT_PUBLIC_`); `activeProviders` array contains only `'google'`/`'github'` strings, not the secret values |

## Sources

### Primary (HIGH confidence)
- `node_modules/better-auth/dist/api/routes/callback.mjs` — OAuth callback flow, `redirectOnError()` format, error codes emitted
- `node_modules/better-auth/dist/api/routes/sign-in.mjs` — `socialSignInBodySchema` with `errorCallbackURL` field
- `node_modules/better-auth/dist/oauth2/state.mjs` — `generateState` stores `errorCallbackURL` as `errorURL`; `parseState` falls back to `defaultErrorURL`
- `node_modules/@better-auth/core/src/error/codes.ts` — `BASE_ERROR_CODES` enum, confirmed error code names
- `app/(auth)/login/page.tsx`, `register/page.tsx` — current structure being refactored
- `auth.ts` — Phase 30 conditional `socialProviders` block
- `lib/auth-client.ts` — `authClient` export
- `components/ui/button.tsx`, `separator.tsx`, `alert.tsx` — available UI primitives
- `vitest.config.ts` — test include/exclude patterns

### Secondary (MEDIUM confidence)
- [Better Auth Basic Usage docs](https://better-auth.com/docs/basic-usage) — `signIn.social()` parameter names confirmed
- [GitHub issue #4694](https://github.com/better-auth/better-auth/issues/4694) — `errorCallbackURL` history; confirmed working in 1.6.9 via source inspection

### Tertiary (LOW confidence)
- [openreplay.com social login article](https://blog.openreplay.com/add-social-login-betterauth/) — loading state pattern; cross-verified against source

## Metadata

**Confidence breakdown:**
- Better Auth client API: HIGH — read directly from installed dist
- Error redirect format: HIGH — read directly from `callback.mjs` source
- `errorCallbackURL` behaviour: HIGH — traced through `sign-in.mjs` → `state.mjs` → `callback.mjs`
- Next.js `searchParams` as Promise: HIGH — established Next.js 15 convention
- Google icon SVG paths: LOW (A1) — training knowledge, verify against Google brand kit
- D-07 error URL intent for register page: LOW (A2) — ambiguous in context

**Research date:** 2026-05-21
**Valid until:** 2026-06-21 (stable stack)
