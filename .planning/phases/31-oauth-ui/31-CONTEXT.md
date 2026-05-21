# Phase 31: oauth-ui - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Add "Continua con Google" and "Continua con GitHub" buttons to the `/login` and `/register` pages. Provider buttons are visible only when the corresponding `CLIENT_ID` env var is set on the server. No backend changes — Better Auth social providers are already wired in Phase 30.

</domain>

<decisions>
## Implementation Decisions

### Button placement and layout
- **D-01:** Social provider buttons appear **above** the email/password form on both pages.
- **D-02:** A horizontal divider with the text "— Oppure —" separates the social buttons from the email/password form below.
- **D-03:** Order within the social buttons section: Google first, GitHub second (when both are active).

### Button copy
- **D-04:** Both buttons use "Continua con Google" / "Continua con GitHub" — same wording on login and register pages. No context-specific variants.

### Provider detection (OAUTH-05)
- **D-05:** The page files (`login/page.tsx`, `register/page.tsx`) become server components that read `process.env.GOOGLE_CLIENT_ID` and `process.env.GITHUB_CLIENT_ID` and pass an `activeProviders: ('google' | 'github')[]` prop to a client-side form component. This keeps env vars server-side only (no `NEXT_PUBLIC_` vars needed).
- **D-06:** The client form component renders social buttons only for providers present in `activeProviders`. If the array is empty, the social section and divider are not rendered at all.

### OAuth error handling (OAUTH-05 UX)
- **D-07:** When the OAuth callback fails, Better Auth redirects to `/login?error=...`. The login (and register) pages read the `error` URL search param and display it using the existing `<Alert variant="destructive">` component — consistent with the email/password error pattern already in the pages.
- **D-08:** Map known error codes to human-readable Italian messages (e.g. `"OAuthCallbackError"` → "Accesso con social non riuscito. Riprova."). Unknown error codes fall back to a generic message.

### Shared component
- **D-09 (Claude's Discretion):** Extract a shared `SocialProviderButtons` component (receives `providers: ('google' | 'github')[]`) to avoid duplicating button markup between login and register pages.

### Claude's Discretion
- Exact loading state during OAuth redirect (spinner on button vs. nothing — redirect is near-instant)
- Icon choice for Google/GitHub buttons (SVG inline vs. Lucide)
- Tailwind spacing within the social buttons section

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing auth pages (to modify)
- `app/(auth)/login/page.tsx` — Current login page (client component using `useActionState`); becomes server component wrapper
- `app/(auth)/register/page.tsx` — Current register page; same refactor as login
- `app/(auth)/layout.tsx` — Auth shell (`max-w-sm` card, centered)

### Auth client
- `lib/auth-client.ts` — `authClient` from `better-auth/react`; `authClient.signIn.social({ provider, callbackURL })` is the method to call for OAuth redirect

### Better Auth server config
- `auth.ts` — Phase 30 added conditional `socialProviders` block; Phase 31 reads from `authClient` on client side

### Requirements
- `.planning/REQUIREMENTS.md` §OAUTH-01, OAUTH-02, OAUTH-03, OAUTH-04, OAUTH-05 — Acceptance criteria for this phase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `<Alert variant="destructive">` + `<AlertDescription>` — already imported in both auth pages; reuse for OAuth error display
- `<Button className="w-full">` — existing full-width button pattern; social buttons follow the same width
- `authClient.signIn.social({ provider, callbackURL: '/' })` — Better Auth client method; triggers OAuth redirect, no server action needed
- `<Loader2>` from lucide-react — already imported; available for loading state if needed

### Established Patterns
- Pages use `useActionState` for form state — refactoring to server component wrapper preserves this: server page reads env, renders `<LoginForm activeProviders={[...]} />`
- Error display: `state.error` → `<Alert>` — extend same pattern to `searchParams.error` for OAuth callback errors

### Integration Points
- `auth.ts` `socialProviders` block (added Phase 30) — client-side `authClient.signIn.social()` calls land here
- Better Auth callback URL: `/api/auth/callback/google` and `/api/auth/callback/github` (already documented in runbook)
- On successful OAuth, Better Auth redirects to `callbackURL` (pass `/` or `/dashboard`); first-time users get account created automatically (OAUTH-02, OAUTH-04)

</code_context>

<specifics>
## Specific Ideas

No product references or "I want it like X" moments — decisions are pattern-driven from existing UI and Better Auth conventions.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 31-oauth-ui*
*Context gathered: 2026-05-21*
