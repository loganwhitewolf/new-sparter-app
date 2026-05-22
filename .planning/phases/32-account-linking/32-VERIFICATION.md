---
phase: 32-account-linking
verified: 2026-05-22T09:47:00Z
status: human_needed
score: 10/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Navigate to /settings/profile with a real authenticated session and click 'Collega' on the Google row. Complete the OAuth round-trip."
    expected: "Browser redirects to Google, completes auth, returns to /settings/profile?linked=google. Toast 'Google collegato.' fires. The Google row Badge changes from 'Non collegato' to 'Collegato' and the Scollega button appears instead of Collega."
    why_human: "Requires real GOOGLE_CLIENT_ID/SECRET configured for the dev URL and a live Google account. Cannot simulate the full OAuth redirect-and-cookie-set flow with grep or static analysis."
  - test: "Navigate to /settings/profile with a real authenticated session and click 'Collega' on the GitHub row. Complete the OAuth round-trip."
    expected: "Browser redirects to GitHub, completes auth, returns to /settings/profile?linked=github. Toast 'GitHub collegato.' fires. The GitHub row Badge changes from 'Non collegato' to 'Collegato'."
    why_human: "Requires real GITHUB_CLIENT_ID/SECRET and a live GitHub account. Same constraint as LINK-01."
  - test: "With a provider linked (post LINK-01 or LINK-02 above), click 'Scollega' on the linked row. Confirm the dialog."
    expected: "Confirmation Dialog opens ('Scollegare Google?'/'Scollegare GitHub?'). Clicking 'Conferma' calls unlinkAccount. Toast 'Provider scollegato.' fires. The Badge reverts to 'Non collegato'."
    why_human: "Requires an already-linked provider (depends on LINK-01/LINK-02 human test above). The unlink API call requires a live session cookie."
  - test: "With exactly one auth method remaining (e.g., only Google linked, no password credential), inspect the Scollega button for that row."
    expected: "Scollega button is disabled. The title attribute contains 'Non puoi scollegare l'unico metodo di accesso.' Clicking does nothing."
    why_human: "The canUnlink guard reads linkedAccounts from authClient.listAccounts(). This live state can only be verified with a real session in the specific account configuration."
  - test: "Trigger LINK-01 or LINK-02 with a provider account whose email differs from the Sparter account email."
    expected: "Better Auth callback redirects to /settings/profile?error=email_doesn%27t_match. The page shows the Alert: 'L'email del provider non corrisponde all'email del tuo account Sparter.'"
    why_human: "Requires two separate accounts with different emails. The URL-encoded error code (email_doesn%27t_match) is parsed by decodeAndMapError — the client logic is unit-tested, but the full E2E flow requires a real OAuth mismatch scenario."
---

# Phase 32: Account Linking Verification Report

**Phase Goal:** Account linking UI in settings — users can view, link, and unlink Google and GitHub OAuth accounts from /settings/profile (LINK-01..04)
**Verified:** 2026-05-22T09:47:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Unit test file exists with failing/stub specs for ConnectedAccountsCard covering LINK-03 and LINK-04 | VERIFIED | `tests/connected-accounts-card.test.tsx` exists (104 lines), 3 describe blocks covering LINK-04 render, LINK-04 initial state, LINK-03 unlink guard |
| 2 | E2E spec file exists with navigation tests for /settings, /settings/profile, /profile redirect, plus test.fixme stubs for live OAuth (LINK-01..04) | VERIFIED | `tests/account-linking.spec.ts` exists with 12 tests; 7 fixme stubs; navigation tests for LINK-04 automated; LINK-01/02/03 live flows marked fixme |
| 3 | tests/profile.spec.ts is updated so PROF-01..PROF-06 navigate to /settings/profile and PROF-04 asserts the new topbar target | VERIFIED | openProfile() and PROF-01 goto `/settings/profile` (lines 7, 15); PROF-04 assertion is `/\/settings\/profile/` (line 99); PROF-06 retains `page.goto('/profile')` (line 116) |
| 4 | /settings renders a hub page (Impostazioni) with links to /settings/profile and /settings/categories — no redirect | VERIFIED | `app/(app)/settings/page.tsx`: no redirect(), contains "Impostazioni" H1, renders `<SettingsHub />` which emits links to APP_ROUTES.profileSettings and APP_ROUTES.categorySettings |
| 5 | /profile redirects to /settings/profile via Next.js server redirect() | VERIFIED | `app/(app)/profile/page.tsx` is 6 lines: imports redirect + APP_ROUTES, calls `redirect(APP_ROUTES.profileSettings)` |
| 6 | Topbar 'Profilo' menu item links to /settings/profile | VERIFIED | `components/layout/topbar.tsx` imports APP_ROUTES (line 17) and uses `href={APP_ROUTES.profileSettings}` (line 64); no hardcoded `/profile` href remains |
| 7 | lib/routes.ts exports APP_ROUTES.profile = '/profile' and APP_ROUTES.profileSettings = '/settings/profile' | VERIFIED | Both entries confirmed in `lib/routes.ts` lines 12-13; all pre-existing keys preserved; helper functions intact |
| 8 | /settings/profile renders the existing Account card and ProfileForm AND a new Account collegati card | VERIFIED | `app/(app)/settings/profile/page.tsx`: verifySession + getUserProfile called; id=account-email/plan/role present; `<ProfileForm profile={profile} />`; `<ConnectedAccountsCard ... />` rendered after ProfileForm |
| 9 | ConnectedAccountsCard: shows Collegato/Non collegato, link/unlink flows, canUnlink guard, confirmation Dialog, error mapping, empty state | VERIFIED | `components/profile/connected-accounts-card.tsx` (308 lines): 'use client'; authClient.listAccounts/linkSocial/unlinkAccount present; canUnlink helper with credential+otherSocial check; Dialog with Scollega confirm; decodeAndMapError with decodeURIComponent; PROVIDER_ORDER for stable render order; all required string constants verified |
| 10 | All 8 Wave 0 unit tests are GREEN | VERIFIED | `yarn test tests/connected-accounts-card.test.tsx --run` exits 0: 8 passed in 334ms |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/connected-accounts-card.test.tsx` | Vitest specs for ConnectedAccountsCard (LINK-03/04) | VERIFIED | 104 lines, 3 describe blocks, 8 tests passing |
| `tests/account-linking.spec.ts` | Playwright E2E navigation + fixme stubs | VERIFIED | 12 tests listed, 7 fixme stubs for live OAuth |
| `tests/profile.spec.ts` | Profile spec retargeted to /settings/profile | VERIFIED | 2 gotos to /settings/profile, 1 retained goto to /profile (PROF-06) |
| `lib/routes.ts` | APP_ROUTES with profile + profileSettings | VERIFIED | Both entries present; helper functions intact |
| `app/(app)/settings/page.tsx` | Settings hub (no redirect) | VERIFIED | Renders Impostazioni + SettingsHub; no redirect() |
| `app/(app)/profile/page.tsx` | /profile compatibility redirect shim | VERIFIED | 6 lines; redirect(APP_ROUTES.profileSettings) |
| `components/layout/topbar.tsx` | Topbar Profilo targets APP_ROUTES.profileSettings | VERIFIED | href={APP_ROUTES.profileSettings}; no old /profile hardcode |
| `components/settings/settings-hub.tsx` | Hub card component for /settings | VERIFIED | Links to APP_ROUTES.profileSettings and APP_ROUTES.categorySettings |
| `components/profile/connected-accounts-card.tsx` | Client component, link/unlink flows | VERIFIED | 308 lines (>180 minimum); 'use client'; all required behaviors wired |
| `app/(app)/settings/profile/page.tsx` | New canonical profile page | VERIFIED | 97 lines (>60 minimum); server component; ConnectedAccountsCard composed |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/(app)/settings/page.tsx` | `components/settings/settings-hub.tsx` | `from '@/components/settings/settings-hub'` | WIRED | Import confirmed + `<SettingsHub />` used |
| `app/(app)/profile/page.tsx` | `/settings/profile` | `redirect(APP_ROUTES.profileSettings)` | WIRED | Pattern confirmed in 6-line shim file |
| `components/layout/topbar.tsx` | `APP_ROUTES.profileSettings` | `href={APP_ROUTES.profileSettings}` | WIRED | Import + usage confirmed on line 17 and 64 |
| `app/(app)/settings/profile/page.tsx` | `components/profile/connected-accounts-card.tsx` | `from '@/components/profile/connected-accounts-card'` | WIRED | Import + `<ConnectedAccountsCard configuredProviders={...} initialLinked={...} initialError={...} />` |
| `components/profile/connected-accounts-card.tsx` | Better Auth endpoints | `authClient.listAccounts / linkSocial / unlinkAccount` | WIRED | All three calls present with proper arguments |
| `app/(app)/settings/profile/page.tsx` | `process.env.GOOGLE_CLIENT_ID + GITHUB_CLIENT_ID` | `process.env.GOOGLE_CLIENT_ID ? ['google'] : []` | WIRED | Both env checks present; configuredProviders passed to card |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `connected-accounts-card.tsx` | `linkedAccounts` | `authClient.listAccounts()` on mount via `refreshAccounts()` | Yes — live Better Auth API call returning real account rows | FLOWING |
| `settings/profile/page.tsx` | `profile` (email, plan, role) | `getUserProfile(session.userId)` — DAL query | Yes — Drizzle DB call via dal/users | FLOWING |
| `settings/profile/page.tsx` | `configuredProviders` | `process.env.GOOGLE_CLIENT_ID` / `GITHUB_CLIENT_ID` — runtime env | Yes — boolean presence of real env vars | FLOWING |
| `settings/profile/page.tsx` | `initialLinked`, `initialError` | `await searchParams` (Next.js 16 Promise) | Yes — real URL params from OAuth callback | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit tests green (ConnectedAccountsCard) | `yarn test tests/connected-accounts-card.test.tsx --run` | 8 passed, 0 failed | PASS |
| Playwright test list parses without errors | `yarn playwright test --list tests/account-linking.spec.ts tests/profile.spec.ts` | 23 tests listed | PASS |
| profile.spec.ts retargeted correctly | `grep goto tests/profile.spec.ts` | 2x /settings/profile, 1x /profile | PASS |
| ConnectedAccountsCard 'use client' first line | `head -1 connected-accounts-card.tsx` | `'use client'` | PASS |
| profile/page.tsx redirect shim (< 12 lines) | `wc -l app/(app)/profile/page.tsx` | 6 lines | PASS |
| Live OAuth link/unlink flows (Google, GitHub) | N/A — requires real OAuth credentials and live session | N/A | SKIP (human needed) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| LINK-01 | 32-02 | User can link a Google account to their existing account from settings | VERIFIED (code) / human needed (E2E) | `handleLink('google')` calls `authClient.linkSocial`; Collega button rendered for unlinked Google; callbackURL=`/settings/profile?linked=google`. Live round-trip needs human verification. |
| LINK-02 | 32-02 | User can link a GitHub account to their existing account from settings | VERIFIED (code) / human needed (E2E) | Same `handleLink` path for GitHub; GitHub row rendered when `GITHUB_CLIENT_ID` set. Live round-trip needs human verification. |
| LINK-03 | 32-02 | User can unlink a linked provider (only when at least one other auth method remains) | VERIFIED (code) / human needed (E2E) | `canUnlink` guard: checks `hasCredential || otherSocial`; Scollega button disabled with `LAST_METHOD_TOOLTIP` when false; Dialog confirmation before `authClient.unlinkAccount`. Unit test LINK-03 placeholder exists. Live unlink needs human verification. |
| LINK-04 | 32-00, 32-01, 32-02 | Settings page shows which providers are currently linked to the account | VERIFIED | `/settings/profile` renders Account collegati card; Collegato/Non collegato Badge per provider; `listAccounts` on mount populates `linkedProviders` Set |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `tests/connected-accounts-card.test.tsx` | 101-102 | LINK-03 unlink guard is a `expect(true).toBe(true)` placeholder | Info | The unit test spec for LINK-03 is a stub acknowledging that the canUnlink behavior needs @testing-library/react for async effects. The actual canUnlink logic IS implemented in the component (lines 149-157). The unit test doc-comment explains this accurately. Not a blocker — the plan's acceptance criteria explicitly allowed this. |

No production code anti-patterns found. No hardcoded empty arrays flowing to render. No TODO/FIXME in implementation files. No `return null` or `return {}` in wired paths.

### Human Verification Required

#### 1. LINK-01: Google OAuth link round-trip

**Test:** From `/settings/profile` with a real authenticated Sparter session, click "Collega" on the Google row. Complete the OAuth flow with a Google account whose email matches the Sparter account email.
**Expected:** Return to `/settings/profile?linked=google`. Toast "Google collegato." fires. Google row Badge shows "Collegato". Only "Scollega" button remains visible for that row.
**Why human:** Requires GOOGLE_CLIENT_ID/SECRET configured for the dev URL and a live Google session. Cannot simulate the OAuth redirect-and-cookie-set cycle statically.

#### 2. LINK-02: GitHub OAuth link round-trip

**Test:** From `/settings/profile` with a real authenticated Sparter session, click "Collega" on the GitHub row. Complete the OAuth flow with a GitHub account whose email matches.
**Expected:** Return to `/settings/profile?linked=github`. Toast "GitHub collegato." fires. GitHub row Badge shows "Collegato".
**Why human:** Same constraint as LINK-01 but for GITHUB_CLIENT_ID/SECRET.

#### 3. LINK-03: Unlink a linked provider

**Test:** After completing LINK-01 or LINK-02 above, click "Scollega" on the linked row. Click "Conferma" in the confirmation dialog.
**Expected:** Dialog closes. Toast "Provider scollegato." fires. Badge reverts to "Non collegato". Collega button reappears.
**Why human:** Depends on LINK-01/02 completing first. The unlink API call requires a live session cookie; cannot simulate without a real session.

#### 4. LINK-03: canUnlink guard disables Scollega for last auth method

**Test:** With a Sparter account that has ONLY one auth method (e.g., only Google, no password credential), inspect the Scollega button.
**Expected:** Button is `disabled`. Its `title` attribute reads "Non puoi scollegare l'unico metodo di accesso."
**Why human:** The guard reads `linkedAccounts` from `authClient.listAccounts()`. This live state requires a real session in the specific account configuration (no credential account, no other social).

#### 5. LINK-01/02: Email mismatch error display

**Test:** Attempt to link a Google or GitHub account whose email differs from the Sparter account email.
**Expected:** Better Auth redirects to `/settings/profile?error=email_doesn%27t_match`. Alert renders: "L'email del provider non corrisponde all'email del tuo account Sparter."
**Why human:** Requires two distinct email addresses (provider account and Sparter account differ). The client-side `decodeAndMapError` logic is fully unit-tested, but the E2E path requires a real OAuth mismatch scenario.

### Gaps Summary

No gaps. All 10 automated must-haves are VERIFIED. The 5 human verification items above cover the live OAuth flows (LINK-01, LINK-02, LINK-03) that cannot be verified without real OAuth credentials and live sessions. These are expected for any OAuth integration and are acknowledged by the plan's `test.fixme()` stubs.

---

_Verified: 2026-05-22T09:47:00Z_
_Verifier: Claude (gsd-verifier)_
