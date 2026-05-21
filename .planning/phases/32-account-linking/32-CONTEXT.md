# Phase 32: account-linking - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase completes v1.9 Social Auth by adding connected social account management under settings. Users can see whether Google/GitHub are connected, start a link flow from settings, and unlink a provider only when another login method remains. It also reshapes settings navigation so profile and category settings live under a settings hub.

In scope: `/settings` hub, `/settings/categories` preservation, new canonical `/settings/profile`, `/profile` compatibility redirect/alias, connected account UI, same-email provider linking, safe unlinking.

Out of scope: additional providers, magic links, account linking across different emails, provider token refresh UI, detailed provider account metadata, and changing existing email/password profile fields beyond moving them under settings.

</domain>

<decisions>
## Implementation Decisions

### Settings information architecture
- **D-01:** `/settings` becomes a settings hub. It must no longer redirect directly to `/settings/categories`.
- **D-02:** `/settings/categories` remains the canonical page for category settings and categorization patterns. Existing category/pattern behavior stays there.
- **D-03:** Add `/settings/profile` as the canonical profile page. It contains the existing profile/account UI plus the new connected social accounts card.
- **D-04:** Keep `/profile` as a compatibility redirect or alias to `/settings/profile` so existing links and tests do not break.
- **D-05:** Update the topbar user menu profile link to point to `/settings/profile`.

### Provider display
- **D-06:** The user-facing connected accounts UI is status-only. For Google and GitHub, show `Collegato` or `Non collegato` plus the available action. Do not show provider account IDs, scopes, tokens, or linked dates.
- **D-07:** Hide providers that are not configured in env. If `GOOGLE_CLIENT_ID` is absent, Google does not appear as a linkable row. If `GITHUB_CLIENT_ID` is absent, GitHub does not appear as a linkable row.
- **D-08:** If no social providers are configured, keep the connected accounts card visible with an empty state such as `Nessun provider social configurato.`
- **D-09:** Render `Account collegati` as a separate card in `/settings/profile`, below the existing `Account` card.

### Linking policy
- **D-10:** Only allow linking when the provider email matches the current Sparter account email. Do not enable Better Auth `account.accountLinking.allowDifferentEmails` for this phase.
- **D-11:** Both successful and failed social linking attempts return to `/settings/profile`, where the connected accounts card shows the outcome.
- **D-12:** When Better Auth reports an email mismatch, show a specific Italian user-facing error explaining that the provider email does not match the Sparter account email.
- **D-13:** If a provider is already linked, do not show the `Collega` action for that provider. The row shows connected status and only the `Scollega` action.

### Unlink safety
- **D-14:** If unlinking would leave the user with zero login methods, disable the unlink action and show an explanation such as `Non puoi scollegare l'unico metodo di accesso.`
- **D-15:** When unlinking is allowed, require a confirmation dialog before removing the provider.
- **D-16:** A valid remaining login method can be either a credential password account or another linked social provider.
- **D-17:** After a successful unlink, update the connected accounts card immediately and show a success toast such as `Provider scollegato.`

### Agent's Discretion
- Exact visual layout of the `/settings` hub cards, as long as it clearly links to profile and category settings.
- Exact route implementation for `/profile` compatibility: redirect preferred if it keeps behavior and tests simple.
- Exact message transport for `/settings/profile` link success/error state: query params, action state, or another established Next.js-safe pattern.
- Whether account data is loaded through Better Auth client APIs, a server-side DAL over the `account` table, or a hybrid, as long as session scoping and token secrecy are preserved.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project and phase authority
- `AGENTS.md` — Repository rules, including Next.js version warning and English developer-facing language convention.
- `.planning/ROADMAP.md` — Phase 32 goal, requirements, and success criteria.
- `.planning/REQUIREMENTS.md` — LINK-01 through LINK-04 acceptance scope.
- `.planning/PROJECT.md` — v1.9 Social Auth project context and architecture constraints.
- `.planning/STATE.md` — Current milestone state and carry-forward decisions.

### Prior social auth context
- `.planning/phases/30-oauth-config/30-CONTEXT.md` — OAuth provider activation decisions and env variable handling.
- `.planning/phases/31-oauth-ui/31-CONTEXT.md` — Existing social button component, provider ordering, error handling, and env-driven provider visibility.

### Existing settings/profile routes
- `app/(app)/settings/page.tsx` — Currently redirects to `APP_ROUTES.categorySettings`; Phase 32 replaces this with the settings hub.
- `app/(app)/settings/categories/page.tsx` — Existing category/pattern settings page that must remain under `/settings/categories`.
- `app/(app)/profile/page.tsx` — Existing profile page to move or alias to `/settings/profile`.
- `lib/routes.ts` — Central route constants; add profile/settings routes here.
- `components/layout/topbar.tsx` — User menu currently links to `/profile`; update to `/settings/profile`.
- `components/layout/sidebar.tsx` — Settings navigation entry currently points to `APP_ROUTES.settings`.

### Auth and account integration
- `auth.ts` — Better Auth config with env-conditional Google/GitHub social providers.
- `lib/auth-client.ts` — Better Auth React client; runtime methods include `listAccounts`, `linkSocial`, `unlinkAccount`, and `signIn.social`.
- `lib/dal/auth.ts` — `verifySession()` pattern for server-side session scoping.
- `lib/db/schema.ts` — Better Auth `account` table; credential and social providers are represented here.
- `node_modules/better-auth/dist/api/routes/account.mjs` — Installed Better Auth account endpoints: `/list-accounts`, `/link-social`, `/unlink-account`.
- `node_modules/better-auth/dist/api/routes/callback.mjs` — Link callback behavior and email mismatch error codes.

### UI patterns and tests
- `components/profile/profile-form.tsx` — Existing profile form and toast pattern.
- `components/categories/category-settings-panel.tsx` — Existing settings-area card layout pattern.
- `components/categories/category-mutation-dialogs.tsx` — Existing confirmation/action dialog and toast patterns.
- `components/auth/social-provider-buttons.tsx` — Provider type, Google/GitHub icons, and OAuth error message mapping to reuse or mirror.
- `components/ui/card.tsx`, `components/ui/button.tsx`, `components/ui/badge.tsx`, `components/ui/dialog.tsx`, `components/ui/alert.tsx` — UI primitives for the connected accounts card and unlink confirmation.
- `tests/profile.spec.ts` — Existing profile route expectations that must be updated for `/settings/profile` and `/profile` compatibility.
- `tests/auth.spec.ts` — Existing OAuth traceability stubs; add link/unlink manual traceability where appropriate.
- `tests/oauth-ui.test.tsx` — Existing social provider unit test patterns.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `authClient.listAccounts()` can list linked Better Auth accounts for the current session.
- `authClient.linkSocial({ provider, callbackURL, errorCallbackURL })` can start the social account linking flow.
- `authClient.unlinkAccount({ providerId })` can remove a linked account and already enforces Better Auth's last-account guard unless `allowUnlinkingAll` is enabled.
- `components/auth/social-provider-buttons.tsx` already defines the `Provider` union, provider order, icons, and Italian OAuth error mapping.
- Existing UI primitives cover the needed surface: `Card`, `Badge`, `Button`, `Dialog`, `Alert`, and `toast`.

### Established Patterns
- Protected app pages load user context through `verifySession()` in server components.
- User-facing mutations use either server actions with `useActionState` or Better Auth client calls with local pending state and `toast`.
- Sensitive account operations use confirmation dialogs in existing category mutation patterns.
- Routes should be centralized in `lib/routes.ts` instead of hardcoded in new components where practical.
- Env-based provider activation is server-side only. Do not introduce `NEXT_PUBLIC_GOOGLE_CLIENT_ID` or `NEXT_PUBLIC_GITHUB_CLIENT_ID`.

### Integration Points
- `/settings` hub must link to `/settings/categories` and `/settings/profile`.
- `/settings/profile` must render existing account/profile content plus the new connected accounts card.
- `/profile` compatibility must preserve existing user-menu and test expectations while moving the canonical route under settings.
- The connected accounts UI must combine configured provider information from server env with linked account state from Better Auth.
- Unlink safety must consider both `credential` accounts with a password and other social provider accounts.

</code_context>

<specifics>
## Specific Ideas

- `/settings` hub should expose two areas: categories and profile.
- `/settings/profile` is the canonical profile route.
- The connected accounts card user-facing title is `Account collegati`.
- Simple provider labels/states are enough: `Collegato`, `Non collegato`, `Collega`, `Scollega`.
- Empty state when no providers are configured: `Nessun provider social configurato.`
- Last-method guard copy can be: `Non puoi scollegare l'unico metodo di accesso.`
- Successful unlink toast can be: `Provider scollegato.`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 32-account-linking*
*Context gathered: 2026-05-21*
