---
phase: 32
plan: "02"
subsystem: auth/ui
tags: [auth, oauth, account-linking, ui, settings, profile, client-component]
dependency_graph:
  requires:
    - "32-00: Wave 0 unit + E2E test stubs (connected-accounts-card.test.tsx)"
    - "32-01: APP_ROUTES.profileSettings, /profile redirect shim, topbar retargeted"
  provides:
    - "components/profile/connected-accounts-card.tsx (LINK-01..04 client component)"
    - "app/(app)/settings/profile/page.tsx (canonical profile page with ConnectedAccountsCard)"
  affects:
    - "tests/profile.spec.ts: PROF-01..05 now target /settings/profile (functional)"
    - "tests/account-linking.spec.ts: LINK-04 navigation test now has real target page"
tech_stack:
  added: []
  patterns:
    - "renderToStaticMarkup Wave 0 unit testing with HTML-entity-aware assertions"
    - "listAccounts on mount + 400ms delay refresh after linkSocial return (Pitfall 2)"
    - "decodeAndMapError: decodeURIComponent + LINK_ERROR_MESSAGES record (Pitfall 1)"
    - "canUnlink guard: credential OR other social means unlinkable"
    - "Next.js 16 searchParams as Promise<{...}> in server component (Pattern 5)"
    - "configuredProviders from process.env booleans — no NEXT_PUBLIC_* (D-07)"
key_files:
  created:
    - components/profile/connected-accounts-card.tsx
    - app/(app)/settings/profile/page.tsx
  modified:
    - tests/connected-accounts-card.test.tsx
decisions:
  - "React 19 renderToStaticMarkup encodes apostrophes as &#x27; — Wave 0 test toContain assertion updated to use HTML-encoded form (Rule 1 auto-fix)"
  - "ConnectedAccountsCard uses inline SVG icons (not imported from social-provider-buttons.tsx which does not export them)"
  - "canUnlink checks both credential + other social — more robust than checking total count"
  - "useMemo for linkedProviders Set avoids re-computation on every render"
metrics:
  duration: "~5 minutes"
  completed_date: "2026-05-22"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
---

# Phase 32 Plan 02: ConnectedAccountsCard + /settings/profile Page Summary

**One-liner:** ConnectedAccountsCard client component with listAccounts/linkSocial/unlinkAccount flows and /settings/profile server page composing Account card + ProfileForm + ConnectedAccountsCard with Next.js 16 async searchParams.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create ConnectedAccountsCard (D-06..D-17, LINK-01..04) | cb9cdcf | components/profile/connected-accounts-card.tsx, tests/connected-accounts-card.test.tsx |
| 2 | Create /settings/profile page with Account + ProfileForm + ConnectedAccountsCard | 3ef5f72 | app/(app)/settings/profile/page.tsx |

## What Was Built

**Task 1 — ConnectedAccountsCard client component:**

`components/profile/connected-accounts-card.tsx` is a `'use client'` component implementing the full account linking UI. Key behaviors:

- **D-06**: Each provider row shows `Collegato` (default variant Badge) or `Non collegato` (secondary variant Badge) based on `authClient.listAccounts()` result
- **D-07**: `renderOrder` filters `PROVIDER_ORDER` (always `['google', 'github']`) by `configuredProviders` prop — only configured providers appear
- **D-08**: When `configuredProviders=[]`, renders a Card with title "Account collegati" and body "Nessun provider social configurato."
- **D-11**: `handleLink` calls `authClient.linkSocial` with `callbackURL=${APP_ROUTES.profileSettings}?linked={provider}` and `errorCallbackURL=...?error=OAuthCallbackError`
- **D-12**: `decodeAndMapError` first `decodeURIComponent`s the raw query param (handles `email_doesn%27t_match`), then maps the decoded key via `LINK_ERROR_MESSAGES` record
- **D-14/D-16**: `canUnlink(provider)` returns `true` only when a credential account OR another social (not being unlinked) exists — Scollega is `disabled` with `title="Non puoi scollegare l'unico metodo di accesso."` when false
- **D-15**: Scollega wraps a `Dialog` (same pattern as `DeleteCategoryDialog`) with cancel + Conferma (destructive) buttons
- **D-17**: After successful `authClient.unlinkAccount`, calls `refreshAccounts()` and fires `toast.success('Provider scollegato.')`
- **LINK-04 (Pitfall 2)**: `useEffect` on `initialLinked` fires `setTimeout(refreshAccounts, 400)` to handle auth session propagation delay after OAuth redirect

**Task 2 — /settings/profile server page:**

`app/(app)/settings/profile/page.tsx` is a server component (no `'use client'`) that:

- Awaits `searchParams` as `Promise<{linked?,error?}>` per Next.js 16 App Router shape (Pattern 5)
- Calls `verifySession()` + `getUserProfile(session.userId)` for server-side auth + data
- Computes `configuredProviders` from `process.env.GOOGLE_CLIENT_ID` and `process.env.GITHUB_CLIENT_ID` — only boolean presence crosses the server→client boundary (D-07, T-32-11)
- Renders in D-09 order: heading, Account (read-only) Card, ProfileForm, ConnectedAccountsCard
- Preserves `id="account-email"`, `id="account-plan"`, `id="account-role"` for PROF-03 Playwright assertions

## Verification

- `yarn test tests/connected-accounts-card.test.tsx --run` — 8 tests passed (all Wave 0 specs GREEN)
- `yarn tsc --noEmit` — 0 new errors in touched files (pre-existing errors in production-smoke.test.ts / set-r2-cors.test.ts only)
- `yarn playwright test --list tests/account-linking.spec.ts tests/profile.spec.ts` — 23 tests listed, 0 parse errors
- `yarn check:language` — English code convention check passed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] React 19 encodes apostrophes in renderToStaticMarkup output**

- **Found during:** Task 1, running Wave 0 tests (GREEN phase)
- **Issue:** `renderToStaticMarkup` in React 19.2.5 HTML-encodes `'` (U+0027) as `&#x27;` in text content. The Wave 0 test `toContain("L'email del provider non corrisponde all'email del tuo account Sparter.")` searched for the literal apostrophe but the HTML output contained `&#x27;`.
- **Fix:** Updated `tests/connected-accounts-card.test.tsx` `toContain` assertion to use the HTML-encoded form: `"L&#x27;email del provider non corrisponde all&#x27;email del tuo account Sparter."` with a clarifying comment explaining the React 19 encoding behavior.
- **Files modified:** `tests/connected-accounts-card.test.tsx`
- **Commit:** cb9cdcf

## TDD Gate Compliance

Both tasks followed the RED/GREEN pattern:

1. **Task 1 RED gate**: Wave 0 unit tests failed with `Cannot find package '@/components/profile/connected-accounts-card'` — correct RED state verified before implementation.
2. **Task 1 GREEN gate**: After creating the component (and fixing the encoding bug in the test), all 8 unit specs passed.
3. **Task 2**: Server page verified by TypeScript + Playwright list + unit test re-run (still 8 passed).

## Threat Surface Scan

Trust boundaries from the plan's threat model confirmed in implementation:

- **T-32-05/10**: `authClient.linkSocial` used (Better Auth handles encrypted state + email-match enforcement); `allowDifferentEmails` not overridden.
- **T-32-06**: `canUnlink` client guard + `authClient.unlinkAccount` server guard as defense-in-depth. Dialog (D-15) prevents accidental clicks.
- **T-32-07**: No `accountId`, scopes, tokens, or dates rendered — only `Collegato`/`Non collegato` + provider label.
- **T-32-11**: `configuredProviders` prop receives only the string values `'google'`/`'github'` derived from boolean presence of env vars — env values never cross the boundary.

No new threat surfaces beyond the plan's threat register.

## Known Stubs

None — all data is wired. `listAccounts` provides live linked state; `configuredProviders` from real env vars; `initialLinked`/`initialError` from real Next.js searchParams. No hardcoded empty arrays or placeholder text flowing to UI.

## Self-Check: PASSED

- `components/profile/connected-accounts-card.tsx` — FOUND
- `app/(app)/settings/profile/page.tsx` — FOUND
- Commits cb9cdcf, 3ef5f72 — verified in git log
