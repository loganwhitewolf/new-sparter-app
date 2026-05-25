# Phase 32: account-linking — Research

**Researched:** 2026-05-21
**Domain:** Better Auth account management, Next.js App Router settings IA, OAuth link/unlink flows
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Settings information architecture**
- D-01: `/settings` becomes a settings hub (no longer redirects to `/settings/categories`).
- D-02: `/settings/categories` remains unchanged as the canonical category settings page.
- D-03: Add `/settings/profile` as the canonical profile page. Contains existing profile/account UI plus the new connected social accounts card.
- D-04: Keep `/profile` as a compatibility redirect or alias to `/settings/profile`.
- D-05: Update the topbar user menu profile link to point to `/settings/profile`.

**Provider display**
- D-06: Connected accounts UI is status-only. Show `Collegato` / `Non collegato` + action. No IDs, scopes, tokens, or dates.
- D-07: Hide providers absent from env. If `GOOGLE_CLIENT_ID` is absent, Google does not appear. Same for GitHub.
- D-08: If no social providers are configured, show empty state `Nessun provider social configurato.`
- D-09: Render `Account collegati` as a separate card in `/settings/profile`, below the existing `Account` card.

**Linking policy**
- D-10: Only allow linking when provider email matches current Sparter account email (`allowDifferentEmails: false` — default behavior, do not enable it).
- D-11: Both successful and failed linking attempts return to `/settings/profile`.
- D-12: Email mismatch must show specific Italian error explaining the provider email does not match.
- D-13: If a provider is already linked, only show `Scollega`, not `Collega`.

**Unlink safety**
- D-14: Disable unlink action when it would leave zero login methods. Show `Non puoi scollegare l'unico metodo di accesso.`
- D-15: Require a confirmation dialog before removing a provider.
- D-16: A valid remaining login method is either a credential password account or another linked social provider.
- D-17: After successful unlink, update the card immediately and show toast `Provider scollegato.`

### Claude's Discretion
- Exact visual layout of the `/settings` hub cards.
- Exact route implementation for `/profile` compatibility (redirect preferred).
- Exact message transport for link success/error state on `/settings/profile` (query params, action state, or other Next.js-safe pattern).
- Whether account data is loaded via Better Auth client APIs, a server-side DAL over `account` table, or hybrid — as long as session scoping and token secrecy are preserved.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LINK-01 | User can link a Google account to their existing account from settings | `authClient.linkSocial({ provider: 'google', callbackURL, errorCallbackURL })` initiates the OAuth flow; callback.mjs creates an `account` row when email matches |
| LINK-02 | User can link a GitHub account to their existing account from settings | Same `authClient.linkSocial` with `provider: 'github'`; provider visibility controlled by env guard (GITHUB_CLIENT_ID present) |
| LINK-03 | User can unlink a linked provider only when at least one other auth method remains | `authClient.unlinkAccount({ providerId })` — Better Auth enforces last-account guard server-side; client must also guard via `listAccounts` result |
| LINK-04 | Settings page shows which providers are currently linked to the account | `authClient.listAccounts()` returns array with `providerId` field; filter for `'google'` and `'github'` |

</phase_requirements>

---

## Summary

Phase 32 extends v1.9 Social Auth by adding account management to settings. The core work has three parts: (1) reshaping the settings IA — `/settings` becomes a hub page, `/settings/profile` is the new canonical profile page, and `/profile` becomes a redirect; (2) a new "Account collegati" card on `/settings/profile` that reads linked accounts via Better Auth's `listAccounts` API and controls link/unlink actions; (3) the link/unlink flows themselves using Better Auth's `linkSocial` and `unlinkAccount` client methods.

All Better Auth server-side logic for this phase is already in place. The installed version (1.6.9) ships the `/list-accounts`, `/link-social`, and `/unlink-account` endpoints in `api/routes/account.mjs`. The callback handler in `api/routes/callback.mjs` enforces email matching when `link.email !== userInfo.email` (redirects with `email_doesn't_match` error code). The unlink endpoint enforces the last-account guard (`FAILED_TO_UNLINK_LAST_ACCOUNT` when `accounts.length === 1`). No `auth.ts` configuration changes are needed.

The client surface is straightforward: `authClient.listAccounts()` for reading, `authClient.linkSocial(...)` for initiating the OAuth redirect, and `authClient.unlinkAccount({ providerId })` for removal. The main implementation challenges are: combining server-side env knowledge (which providers are configured) with client-side runtime state (which accounts are linked); routing the OAuth callback result back to `/settings/profile`; and translating the callback error code `email_doesn't_match` into an Italian UI message.

**Primary recommendation:** Use a hybrid data loading strategy — providers configured in env are passed as server props (no new `NEXT_PUBLIC_*` vars), linked accounts are fetched client-side via `authClient.listAccounts()` with a `useEffect` refresh after link/unlink, and link/unlink success/error state is transported via search params (`?linked=google` / `?error=email_doesn't_match`).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Settings hub page (`/settings`) | Frontend Server (SSR) | — | Server component; renders navigation links, no user-specific data needed |
| Profile page shell (`/settings/profile`) | Frontend Server (SSR) | — | `verifySession()` + `getUserProfile()` already run on server for existing profile content |
| Provider configuration visibility | Frontend Server (SSR) | — | `GOOGLE_CLIENT_ID` / `GITHUB_CLIENT_ID` are server-only env vars (D-07); passed as boolean props |
| Linked accounts state | Browser / Client | API / Backend | `authClient.listAccounts()` is a client call; server-side DAL read is an alternative hybrid approach |
| Link OAuth initiation | Browser / Client | API / Backend | `authClient.linkSocial()` triggers browser redirect to OAuth provider |
| Link OAuth callback | API / Backend | — | Better Auth's `/callback/:id` handles provider response and email matching |
| Unlink action | Browser / Client | API / Backend | `authClient.unlinkAccount()` is a client call via HTTP POST to `/api/auth/unlink-account` |
| Last-method guard | API / Backend | Browser / Client | Better Auth enforces server-side; client duplicates the check for disabled-button UX |
| `/profile` compatibility redirect | Frontend Server (SSR) | — | `redirect()` in Next.js page component; no DB or auth needed |
| Topbar link update | Browser / Client | — | `topbar.tsx` is a client component; change `/profile` href to `APP_ROUTES.profileSettings` |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-auth | 1.6.9 (installed) | listAccounts / linkSocial / unlinkAccount client methods | Already integrated; server endpoints exist |
| Next.js | 16 (project) | App Router pages, `redirect()`, search params | Project requirement |
| Drizzle ORM | installed | No new migrations needed; `account` table exists | Project requirement |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner (toast) | installed | `Provider scollegato.` success toast | Already used in profile-form pattern |
| shadcn/ui (Card, Button, Badge, Dialog, Alert) | installed | Connected accounts card and unlink confirmation dialog | Direct reuse of existing UI primitives |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `authClient.listAccounts()` (client) | Direct Drizzle query via server DAL | Server DAL avoids extra client round-trip but requires passing token-scrubbed data as props — either works; client approach is simpler for post-link refresh |
| Search params for link result state | `useActionState` + server action | Server actions cannot initiate OAuth redirect; link must use `authClient.linkSocial()` which is a client call; search params are the established Next.js pattern for OAuth callback state transport |

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (/settings/profile)
  |
  +-- [Server Component] reads: verifySession(), getUserProfile()
  |                              + configuredProviders (from env, boolean flags)
  |
  +-- [Client Component: ConnectedAccountsCard]
        |
        +--> authClient.listAccounts()        --> GET /api/auth/list-accounts
        |                                         (session cookie, returns [{providerId, ...}])
        |
        +--> authClient.linkSocial({          --> POST /api/auth/link-social
        |      provider, callbackURL,              (redirects browser to OAuth provider)
        |      errorCallbackURL })
        |         |
        |         +-- OAuth round-trip -->
        |         |    GET /api/auth/callback/:id
        |         |    (email matching, account row creation)
        |         |
        |         +--> browser redirect to callbackURL or errorCallbackURL
        |               (/settings/profile?linked=google  OR  /settings/profile?error=email_doesn%27t_match)
        |
        +--> [Unlink Confirmation Dialog]
        |     |
        |     +--> authClient.unlinkAccount({ providerId })
        |                --> POST /api/auth/unlink-account
        |                    (last-account guard enforced server-side)
        |
        +--> on success/failure: refresh listAccounts(), show toast
```

### Recommended Project Structure

```
app/(app)/
  settings/
    page.tsx              # Hub (replaces current redirect — D-01)
    categories/
      page.tsx            # Unchanged (D-02)
    profile/
      page.tsx            # New canonical profile page (D-03)
  profile/
    page.tsx              # Compatibility redirect to /settings/profile (D-04)

components/
  settings/               # NEW: settings hub components
    settings-hub.tsx      # Hub card grid
  profile/
    profile-form.tsx      # Existing — unchanged
    connected-accounts-card.tsx  # NEW: linked accounts UI (D-09)

lib/
  routes.ts               # Add profileSettings and settingsHub constants
```

### Pattern 1: Configured Providers as Server Props

Server components know which providers are configured via env vars. Pass booleans as props to client components — do not introduce `NEXT_PUBLIC_*` vars (D-07, Phase 30 D-03 precedent).

```typescript
// Source: auth.ts (verified in codebase) + CONTEXT.md D-07
// In app/(app)/settings/profile/page.tsx (server component)

const configuredProviders: Provider[] = [
  ...(process.env.GOOGLE_CLIENT_ID ? (['google'] as Provider[]) : []),
  ...(process.env.GITHUB_CLIENT_ID ? (['github'] as Provider[]) : []),
]

return (
  <ConnectedAccountsCard configuredProviders={configuredProviders} />
)
```

**Why:** Same pattern used in Phase 31 — server pages pass `providers: Provider[]` to `SocialProviderButtons`. Provider type and `Provider` union are already defined in `components/auth/social-provider-buttons.tsx`.

### Pattern 2: Client-side Account List with Post-Action Refresh

```typescript
// Source: CONTEXT.md code_context + account.mjs verified in node_modules
// In components/profile/connected-accounts-card.tsx

'use client'

import { useEffect, useState } from 'react'
import { authClient } from '@/lib/auth-client'

type LinkedAccount = { providerId: string; id: string }

export function ConnectedAccountsCard({ configuredProviders }: { configuredProviders: Provider[] }) {
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([])
  const [loading, setLoading] = useState(true)

  async function refreshAccounts() {
    setLoading(true)
    const { data } = await authClient.listAccounts()
    setLinkedAccounts(data ?? [])
    setLoading(false)
  }

  useEffect(() => { refreshAccounts() }, [])

  // ...
}
```

**Note:** `authClient.listAccounts()` is the camelCase client proxy for the `/list-accounts` endpoint. Confirmed via `CamelCase<"list-accounts">` → `listAccounts` in `path-to-object.d.mts`. [VERIFIED: node_modules/better-auth/dist/client/path-to-object.d.mts]

### Pattern 3: linkSocial with Callback to /settings/profile

```typescript
// Source: account.mjs (verified) + CONTEXT.md D-11
// In ConnectedAccountsCard

async function handleLink(provider: Provider) {
  setPending(provider)
  try {
    await authClient.linkSocial({
      provider,
      callbackURL: '/settings/profile?linked=' + provider,
      errorCallbackURL: '/settings/profile?error=OAuthCallbackError',
    })
  } finally {
    setPending(null)
  }
}
```

**Callback URL handling:** After the OAuth round-trip, Better Auth's `callback.mjs` redirects to `callbackURL` on success or `errorCallbackURL` (with `?error=<code>`) on failure. The component reads `useSearchParams()` on mount to show toasts / error messages.

**Email mismatch error code:** Verified in `callback.mjs` line 107 — the redirect error code is `email_doesn't_match` (with apostrophe and underscore). The component must map this to the Italian message from D-12.

### Pattern 4: Unlink with Last-Method Guard

```typescript
// Source: account.mjs lines 218-223 (verified)
// In ConnectedAccountsCard

// Server-side guard: Better Auth throws FAILED_TO_UNLINK_LAST_ACCOUNT
// when accounts.length === 1 (regardless of credential type).
// Client-side guard: check linkedAccounts array + whether credential account exists.

function canUnlink(providerId: string): boolean {
  const credentialAccount = linkedAccounts.find(a => a.providerId === 'credential')
  const otherSocialAccounts = linkedAccounts.filter(
    a => a.providerId !== 'credential' && a.providerId !== providerId
  )
  return !!(credentialAccount || otherSocialAccounts.length > 0)
}

async function handleUnlink(providerId: string) {
  const { data, error } = await authClient.unlinkAccount({ providerId })
  if (error) {
    toast.error('Errore durante la disconnessione.')
    return
  }
  await refreshAccounts()
  toast.success('Provider scollegato.')
}
```

**Important:** Better Auth's unlink guard counts all `account` rows, not just social ones. A credential account (email/password) has `providerId === 'credential'`. [VERIFIED: account.mjs line 219 — checks `accounts.length === 1`, unlinking is blocked only when there is exactly 1 account total]

### Pattern 5: Search Params for Link Result State

```typescript
// Source: Next.js App Router pattern + CONTEXT.md Agent's Discretion
// In app/(app)/settings/profile/page.tsx or ConnectedAccountsCard

// Option A (recommended): Read in client component via useSearchParams
// App Router: server page passes searchParams prop to client component

// Option B: Read as server component prop and pass as initial state
// app/(app)/settings/profile/page.tsx (server):
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ linked?: string; error?: string }>
}) {
  const params = await searchParams
  // pass to ConnectedAccountsCard as initialLinked / initialError
}
```

**Recommended:** Option B — pass searchParams from server component as props. Avoids hydration mismatch from `useSearchParams` in Suspense boundary. [ASSUMED — Next.js 16 searchParams is async Promise; check `node_modules/next/` if needed]

### Anti-Patterns to Avoid

- **Introducing `NEXT_PUBLIC_GOOGLE_CLIENT_ID`:** CONTEXT.md code_context explicitly prohibits this. Provider env vars are server-only.
- **Calling `authClient.listAccounts()` in a server component:** The auth client is for browser use. Use server-side Drizzle query if you need accounts in a server component (but a client component refresh is simpler here).
- **Hardcoding `/settings/profile` as `errorCallbackURL`:** The error code is appended as `?error=<code>` by Better Auth — the component must parse `searchParams.error`, not assume a fixed URL.
- **Assuming `unlinkAccount` error means "last account":** The API can fail for other reasons (`ACCOUNT_NOT_FOUND`). Map error codes explicitly.
- **Checking `linkedAccounts.length === 1` as the sole unlink guard:** The correct guard is whether at least one *other* account remains (either a credential account or another social account), not just the count. Better Auth's server guard does check count = 1, but the client should check the same condition per D-14 / D-16.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth link redirect + state handoff | Custom OAuth flow in a server action | `authClient.linkSocial()` | Better Auth encodes userId + email in encrypted state; handles PKCE, CSRF, code verifier |
| Email matching during link | Custom email comparison in server action | Better Auth callback.mjs automatic check | Already enforced: redirects with `email_doesn't_match` if emails differ |
| Last-account protection (server) | Custom middleware check | `unlinkAccount` server-side guard | Better Auth throws `FAILED_TO_UNLINK_LAST_ACCOUNT` automatically |
| Account row persistence | Custom INSERT after OAuth | Better Auth `/callback/:id` handler | Creates account row; updates if already exists for same provider+userId |

**Key insight:** The OAuth linking flow *must* go through the browser redirect — it cannot be a server action or API route call. `authClient.linkSocial()` triggers `POST /api/auth/link-social` which sets a `Location` header to the provider's authorization URL.

---

## Common Pitfalls

### Pitfall 1: Callback Error Code `email_doesn't_match` Contains Apostrophe

**What goes wrong:** Manually constructing the error URL check as `params.error === "email_doesnt_match"` (without apostrophe) misses the actual code.

**Why it happens:** `callback.mjs` line 107 uses the literal string `"email_doesn't_match"` (with apostrophe). URL-encoding renders it as `email_doesn%27t_match`.

**How to avoid:** Use `decodeURIComponent(params.error ?? '')` before comparing, or use `params.error?.includes("email_doesn")` as a defensive check. Define a constant.

**Warning signs:** Italian error message never shows on email mismatch despite the error param being present in the URL.

[VERIFIED: node_modules/better-auth/dist/api/routes/callback.mjs line 107]

### Pitfall 2: `listAccounts()` Returns Empty Before Session Cookie Propagates

**What goes wrong:** After `linkSocial()` redirect returns to `/settings/profile?linked=google`, the `listAccounts()` call in `useEffect` fires before the session cookie (or account table row) is fully committed, returning the old list.

**Why it happens:** The OAuth callback sets cookies and writes DB in the same request; the redirect arrives at the page before the browser has processed the `Set-Cookie` headers from the callback response.

**How to avoid:** Add a short re-fetch delay after detecting `searchParams.linked`, or use a retry with `setTimeout(refreshAccounts, 300)`. Alternatively, show a loading state for 1–2 seconds when `linked` param is present.

**Warning signs:** Connected accounts card does not reflect the newly linked provider immediately after the OAuth round-trip.

### Pitfall 3: `/profile` Redirect Breaking Playwright Tests

**What goes wrong:** `tests/profile.spec.ts` navigates to `/profile` directly. After D-04, if the redirect is implemented as a 301/302 `redirect()`, Playwright's `page.goto('/profile')` will follow the redirect to `/settings/profile` — tests that assert `page.url()` to contain `/profile` (not `/settings/profile`) will fail.

**Why it happens:** `tests/profile.spec.ts` line 98 asserts `expect(page).toHaveURL(/\/profile/)`. The regex `/\/profile/` matches both `/profile` and `/settings/profile` — so this particular assertion is safe. However, line 15 (`page.goto('/profile')` then `response.status() === 200`) will receive the final URL after redirect.

**How to avoid:** Review each assertion in `tests/profile.spec.ts`. The `/\/profile/` regex tests will pass for `/settings/profile`. Assertions that expect the URL to be exactly `/profile` will need updating. Update `openProfile()` helper to go to `/settings/profile` directly.

**Warning signs:** Playwright spec `PROF-04` asserts topbar navigates to `/profile` — after D-05 the topbar now points to `/settings/profile`, so this test needs the assertion updated to `/settings/profile`.

[VERIFIED: tests/profile.spec.ts lines 15, 98-99]

### Pitfall 4: `verifySession()` Returns Staging Fixture Without Real Accounts

**What goes wrong:** During Playwright runs with `x-staging-key`, `verifySession()` returns a fake `userId: 'staging-user'`. `authClient.listAccounts()` is a client call that uses the real session cookie — in staging bypass mode there is no real cookie, so it will return an empty list or error.

**Why it happens:** Staging bypass sets headers not a cookie; Better Auth's `list-accounts` endpoint requires a valid session cookie (uses `sessionMiddleware`).

**How to avoid:** Design the connected accounts card to handle an empty/error `listAccounts()` result gracefully (show all providers as "Non collegato"). Playwright tests for the connected accounts UI should be marked `test.fixme()` for live OAuth operations and covered by Vitest unit tests for the component rendering logic.

**Warning signs:** Connected accounts card shows all providers as unlinked even in production; investigate whether `listAccounts()` call is erroring silently.

---

## Code Examples

### listAccounts — Account with credential detection

```typescript
// Source: node_modules/better-auth/dist/api/routes/account.mjs (verified)
// /list-accounts returns: Array<{ id, providerId, accountId, userId, createdAt, updatedAt, scopes }>
// providerId values: 'credential' for email/password accounts, 'google', 'github' for social

const { data: accounts } = await authClient.listAccounts()
const hasCredential = accounts?.some(a => a.providerId === 'credential') ?? false
const linkedGoogle = accounts?.some(a => a.providerId === 'google') ?? false
const linkedGithub = accounts?.some(a => a.providerId === 'github') ?? false
```

### linkSocial — Initiating link from settings

```typescript
// Source: node_modules/better-auth/dist/api/routes/account.mjs (verified)
// linkSocial body: { provider, callbackURL?, errorCallbackURL?, scopes?, disableRedirect? }

await authClient.linkSocial({
  provider: 'google', // or 'github'
  callbackURL: '/settings/profile?linked=google',
  errorCallbackURL: '/settings/profile?error=OAuthCallbackError',
})
// This POST returns { url, redirect: true } and sets Location header
// The browser follows the redirect automatically
```

### unlinkAccount — With error handling

```typescript
// Source: node_modules/better-auth/dist/api/routes/account.mjs (verified)
// unlinkAccount body: { providerId, accountId? }
// Error: FAILED_TO_UNLINK_LAST_ACCOUNT when accounts.length === 1

const { error } = await authClient.unlinkAccount({ providerId: 'google' })
if (error) {
  // error.code may be 'FAILED_TO_UNLINK_LAST_ACCOUNT' or other
  toast.error('Errore durante la disconnessione.')
  return
}
toast.success('Provider scollegato.')
```

### Callback error code mapping (extending existing pattern)

```typescript
// Source: components/auth/social-provider-buttons.tsx OAUTH_ERROR_MESSAGES (verified)
// Extend the existing map or create a new one for link-specific errors

const LINK_ERROR_MESSAGES: Record<string, string> = {
  'email_doesn\'t_match':
    "L'email del provider non corrisponde all'email del tuo account Sparter.",
  'account_already_linked_to_different_user':
    'Questo account social è già collegato a un altro utente.',
  'unable_to_link_account': 'Impossibile collegare l\'account. Riprova.',
  OAuthCallbackError: 'Collegamento non riuscito. Riprova.',
}
// Default fallback:
const LINK_ERROR_FALLBACK = 'Collegamento non riuscito. Riprova.'
```

[VERIFIED: callback.mjs lines 105-128 for error codes]

### Route constants — additions to lib/routes.ts

```typescript
// Source: lib/routes.ts (verified — currently missing profile and profileSettings)

export const APP_ROUTES = {
  // ... existing routes ...
  profile: '/profile',                  // compatibility alias (D-04)
  profileSettings: '/settings/profile', // canonical (D-03)
} as const
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 31: `SocialProviderButtons` handles OAuth sign-in/register | Phase 32: `ConnectedAccountsCard` handles OAuth link (different callback, uses `linkSocial` not `signIn.social`) | Phase 32 | New component; do not reuse `SocialProviderButtons` for linking |
| `/settings` redirects to `/settings/categories` | `/settings` becomes a hub with links to `/settings/categories` and `/settings/profile` | Phase 32 (D-01) | Existing redirect in `settings/page.tsx` is replaced |
| `/profile` is canonical profile route | `/settings/profile` is canonical; `/profile` redirects | Phase 32 (D-03, D-04) | `tests/profile.spec.ts` and topbar link need updating |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `searchParams` in Next.js 16 App Router is a `Promise<{...}>` requiring `await` | Pattern 5 | If not async, `await searchParams` still works (await on a plain object is a no-op); low risk |
| A2 | Better Auth `listAccounts()` client method returns `{ data: Array<{providerId, ...}>, error }` shaped like other client methods | Code Examples | If shape differs, type error at compile time; check `account.d.mts` to confirm |

**Note:** A2 is based on the `BetterFetchResponse` wrapper pattern visible in `path-to-object.d.mts`. The `listUserAccounts` endpoint returns a JSON array, so `data` will be the array. Confidence: HIGH based on consistent pattern across all Better Auth client calls.

---

## Open Questions

1. **Should `ConnectedAccountsCard` use a server-side DAL to avoid the empty-list timing issue on link return?**
   - What we know: Client-side `listAccounts()` may show stale state for 200–500ms after the OAuth redirect returns. Server-side DAL reads from the same `account` table but would need the profile page to do a full server re-render.
   - What's unclear: Whether Next.js 16 `router.refresh()` after detecting `searchParams.linked` triggers a fast enough re-render.
   - Recommendation: Start with client-side + `setTimeout(refreshAccounts, 400)` on link return. If stale display is observed, switch to server DAL + `router.refresh()`.

2. **Should `/profile` redirect use `redirect()` (permanent) or a client redirect?**
   - What we know: `next/navigation` `redirect()` uses 307 (temporary) by default in App Router.
   - What's unclear: If existing bookmarks or external links use `/profile`, a permanent 301 would be better for SEO but irrelevant for a personal finance app.
   - Recommendation: Use `redirect(APP_ROUTES.profileSettings)` — the default 307 is fine; no SEO concern for a private app.

---

## Environment Availability

This phase is code/config only — no external tools beyond the running dev server.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| better-auth | listAccounts / linkSocial / unlinkAccount | Yes | 1.6.9 | — |
| Next.js | App Router pages | Yes | 16 | — |
| Google OAuth credentials | LINK-01 live test | Dev env (unknown) | — | Manual test only (test.fixme) |
| GitHub OAuth credentials | LINK-02 live test | Dev env (unknown) | — | Manual test only (test.fixme) |

**Missing dependencies with no fallback:** None — all implementation dependencies are present. Live OAuth tests require real credentials and are deferred to manual/fixme stubs as with OAUTH-01..04.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 (unit) + Playwright (E2E specs) |
| Config file | `vitest.config.ts` (unit: `tests/**/*.test.ts(x)`), `playwright.config.ts` (E2E: `tests/**/*.spec.ts`) |
| Quick run command | `yarn test` (vitest run) |
| Full suite command | `yarn test && yarn test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LINK-04 | Connected accounts card renders with configured providers | unit | `yarn test tests/connected-accounts-card.test.tsx` | Wave 0 |
| LINK-04 | Card shows `Collegato` / `Non collegato` based on linkedAccounts | unit | `yarn test tests/connected-accounts-card.test.tsx` | Wave 0 |
| LINK-04 | Empty state when `configuredProviders` is empty | unit | `yarn test tests/connected-accounts-card.test.tsx` | Wave 0 |
| LINK-03 | Unlink button disabled when only one account remains | unit | `yarn test tests/connected-accounts-card.test.tsx` | Wave 0 |
| LINK-01/02 | Settings page renders hub structure | E2E (spec) | `yarn test:e2e --grep "LINK"` | Wave 0 |
| LINK-01/02 | `/settings/profile` accessible and shows Account + Account collegati cards | E2E (spec) | `yarn test:e2e` | Wave 0 |
| LINK-01/02 | Live OAuth link flow | manual | test.fixme stub | Wave 0 |
| LINK-03 | Live unlink flow | manual | test.fixme stub | Wave 0 |

### Sampling Rate

- **Per task commit:** `yarn test` (vitest only — fast)
- **Per wave merge:** `yarn test && yarn test:e2e`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/connected-accounts-card.test.tsx` — covers LINK-03, LINK-04 component rendering
- [ ] `tests/account-linking.spec.ts` — covers LINK-01..04 E2E navigation (with fixme stubs for live OAuth)
- [ ] Update `tests/profile.spec.ts` — change route expectations from `/profile` to `/settings/profile`, update PROF-04 topbar nav assertion

*(Existing vitest and Playwright infrastructure cover all other cases — no new config needed)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better Auth session middleware on all account endpoints |
| V3 Session Management | yes | Better Auth `freshSessionMiddleware` on `/unlink-account` requires fresh session |
| V4 Access Control | yes | Better Auth `sessionMiddleware` on `/list-accounts` and `/link-social` — session required |
| V5 Input Validation | yes | Better Auth validates `providerId` as `SocialProviderListEnum` on link; Zod on unlink body |
| V6 Cryptography | no | No new cryptographic operations in this phase |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CSRF on link/unlink | Tampering | Better Auth origin check + CORS; `requireHeaders: true` on `/link-social` |
| OAuth state tampering (CSRF in link flow) | Tampering | Better Auth generates encrypted state with `userId + email`; validated in callback |
| Account takeover via email mismatch | Elevation of Privilege | Better Auth enforces email matching in callback (D-10); `allowDifferentEmails` remains disabled |
| Session fixation after link | Spoofing | `freshSessionMiddleware` on unlink requires fresh session; link uses existing `sessionMiddleware` |
| Provider account already linked to different user | Spoofing | `callback.mjs` line 110: redirects `account_already_linked_to_different_user` — map to Italian error |

[VERIFIED: account.mjs and callback.mjs in node_modules/better-auth/dist/api/routes/]

---

## Sources

### Primary (HIGH confidence)
- `node_modules/better-auth/dist/api/routes/account.mjs` — listUserAccounts, linkSocialAccount, unlinkAccount endpoint implementations
- `node_modules/better-auth/dist/api/routes/callback.mjs` — Link callback email matching logic, error codes
- `node_modules/better-auth/dist/client/path-to-object.d.mts` — CamelCase type transform confirming client method names
- `lib/auth-client.ts`, `auth.ts`, `lib/db/schema.ts` — Current project auth configuration
- `app/(app)/settings/page.tsx`, `app/(app)/profile/page.tsx` — Existing route implementations
- `lib/routes.ts` — Current route constants
- `components/auth/social-provider-buttons.tsx` — Provider type, icons, error message map
- `components/profile/profile-form.tsx` — Server action + toast pattern
- `components/categories/category-mutation-dialogs.tsx` — Dialog + confirmation pattern
- `tests/profile.spec.ts` — Existing Playwright tests that need updating
- `tests/auth.spec.ts` — Existing auth spec test stubs

### Secondary (MEDIUM confidence)
- `node_modules/better-auth/package.json` — version 1.6.9 confirmed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all APIs verified in installed node_modules source
- Architecture: HIGH — all referenced files exist and were read
- Pitfalls: HIGH (P1/P3/P4) / MEDIUM (P2 — timing issue is architectural inference, not directly measured)
- Test mapping: HIGH — existing test infrastructure verified

**Research date:** 2026-05-21
**Valid until:** 2026-06-21 (stable — Better Auth 1.x APIs, Next.js 16 App Router)
