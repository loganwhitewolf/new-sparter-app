---
phase: 32-account-linking
reviewed: 2026-05-22T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - tests/connected-accounts-card.test.tsx
  - tests/account-linking.spec.ts
  - tests/profile.spec.ts
  - components/settings/settings-hub.tsx
  - lib/routes.ts
  - app/(app)/settings/page.tsx
  - app/(app)/profile/page.tsx
  - components/layout/topbar.tsx
  - components/profile/connected-accounts-card.tsx
  - app/(app)/settings/profile/page.tsx
findings:
  critical: 3
  warning: 4
  info: 3
  total: 10
status: issues_found
---

# Phase 32: Code Review Report

**Reviewed:** 2026-05-22
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

The implementation covers the settings IA restructure (`/settings` hub, `/settings/profile` canonical route, `/profile` redirect) and the `ConnectedAccountsCard` OAuth linking UI. The overall structure is sound — server-side env-var gating for configured providers is correctly done without `NEXT_PUBLIC_*` exposure, the `canUnlink` guard logic is correct, and the `decodeAndMapError` function handles URI-encoded error codes properly.

Three blockers were identified: a hardcoded fallback staging key in E2E tests that will allow staging bypass to match any environment where `STAGING_KEY` is unset, an open-redirect vector via the unvalidated `linked` search param being forwarded to `toast.success`, and a missing `environment` declaration in `vitest.config.ts` that causes the unit test suite to run in Node (no DOM) which silently makes `renderToStaticMarkup` a lie — hooks like `useState`/`useEffect` are not executed, meaning the test coverage is weaker than it appears.

---

## Critical Issues

### CR-01: Hardcoded staging-key fallback enables bypass in CI/production-adjacent environments

**File:** `tests/account-linking.spec.ts:5,12,37` and `tests/profile.spec.ts:5,13,89`

**Issue:** Every helper that sets the staging bypass header falls back to the literal string `'test-staging-key'` when `STAGING_KEY` is not set in the environment:

```ts
'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key',
```

`proxy.ts` line 14–17 grants unconditional `NextResponse.next()` to any request whose `x-staging-key` header matches `process.env.STAGING_KEY`. If a staging/preview deployment is configured with `STAGING_KEY=test-staging-key` (the literal string any developer will reach for), these E2E tests — or any browser session that sends the same header — bypasses all authentication. The correct pattern is to fail the test explicitly when the variable is absent rather than substituting a guessable default.

**Fix:**
```ts
// In each helper function
async function openSettings(page: Page) {
  const stagingKey = process.env.STAGING_KEY
  if (!stagingKey) throw new Error('STAGING_KEY env var is required for E2E tests')
  await page.setExtraHTTPHeaders({ 'x-staging-key': stagingKey })
  await page.goto('/settings')
}
```

Apply the same pattern in `openSettingsProfile`, the inline header blocks in `account-linking.spec.ts:37`, and all three helpers in `profile.spec.ts`.

---

### CR-02: Unvalidated `initialLinked` search param forwarded directly to toast — open-redirect-adjacent XSS surface

**File:** `components/profile/connected-accounts-card.tsx:135-137`

**Issue:** The `initialLinked` prop comes from `params.linked` (a raw URL query string value passed from `app/(app)/settings/profile/page.tsx:92`). In the component it is cast with `as Provider` and then its label is resolved, but when the value is not a known provider key, `PROVIDER_LABELS[provider]` returns `undefined` and the code falls back to the raw string itself:

```ts
const provider = initialLinked as Provider          // line 135 — cast, not validation
const label = PROVIDER_LABELS[provider] ?? initialLinked  // line 136 — raw value in toast
toast.success(`${label} collegato.`)               // line 137 — raw user-controlled string
```

A crafted URL such as `/settings/profile?linked=<img src=x onerror=alert(1)>` passes `initialLinked` straight into `toast.success()`. While Sonner renders toast content as text nodes (not innerHTML), the `label` is also used in no other sanitization context. The more immediate correctness bug is that a non-provider value skips all lookup and displays the raw param to the user. Additionally, `initialLinked as Provider` is a type lie — TypeScript will not catch a runtime unknown value here.

**Fix:** Validate before use, rejecting unknowns:
```ts
useEffect(() => {
  if (!initialLinked) return
  if (!PROVIDER_ORDER.includes(initialLinked as Provider)) return  // unknown value — ignore
  const provider = initialLinked as Provider
  const label = PROVIDER_LABELS[provider]
  toast.success(`${label} collegato.`)
  const t = setTimeout(() => void refreshAccounts(), 400)
  return () => clearTimeout(t)
}, [initialLinked])
```

---

### CR-03: `vitest.config.ts` declares no `environment` — unit tests run in Node, making hook-based assertions meaningless

**File:** `tests/connected-accounts-card.test.tsx:24` (all `renderToStaticMarkup` calls), cross-referenced against `vitest.config.ts`

**Issue:** `vitest.config.ts` has no `environment` or `environmentOptions` field (defaults to `node`). The test file uses `renderToStaticMarkup` from `react-dom/server`, which works in Node. However, `ConnectedAccountsCard` is a client component that uses `useState`, `useEffect`, and `useMemo`. `renderToStaticMarkup` in a Node environment renders the initial state only — hooks execute, but effects are never flushed, and there is no DOM. This means:

1. The test comment on line 66 ("useEffect with mocked listAccounts hasn't resolved during static render") is aware of this, but frames it as a feature. In reality, `loadingAccounts` starts as `true`, so the "Collega" button is **never rendered** during static markup. The test at line 62–67 asserts `'Non collegato'` is present, which is always true since the `Badge` always shows the initial state — but it cannot distinguish between "loading state" and "correctly unlinked state". The test gives false confidence.

2. The `authClient.listAccounts` mock at line 8 is set up correctly but is never invoked because no `act()`/`waitFor` wrapper is present and static markup does not process async effects.

3. Any future developer who adds a test expecting interactive behavior will get silent false positives.

**Fix:** Add `environment: 'jsdom'` (and install `@vitest/browser` or `jsdom` dev dependency) to `vitest.config.ts`, then migrate the assertions to `@testing-library/react` with `render`+`waitFor`. The placeholder test at line 101 ("exists so Plan 02 implements canUnlink") acknowledges this debt but the config gap means the entire suite is structurally mismatched regardless of which render API is used.

```ts
// vitest.config.ts
test: {
  environment: 'jsdom',   // add this
  include: [...],
  ...
}
```

---

## Warnings

### WR-01: `handleUnlink` closes dialog before confirming refreshAccounts completes — state flicker

**File:** `components/profile/connected-accounts-card.tsx:184-186`

**Issue:** On successful unlink, `refreshAccounts()` is awaited, then `toast.success()` is called, then `setUnlinkDialog(null)` closes the dialog. This order is correct for the happy path. However, `refreshAccounts()` internally calls `setLoadingAccounts(true)` before the fetch. If `refreshAccounts` is slow, the dialog closes while the card is in a loading state (`loadingAccounts=true`), which hides the "Collega" button (line 242: `!isLinked && !loadingAccounts`). The row briefly shows neither "Collega" nor "Scollega" — an invisible transition that's jarring if the list refresh is slow.

**Fix:** Close the dialog immediately on user confirmation (optimistic close) before awaiting the refresh, matching the common pattern for destructive-action dialogs:
```ts
async function handleUnlink(provider: Provider) {
  setPendingUnlink(provider)
  setUnlinkDialog(null)  // close dialog immediately
  try {
    const result = await authClient.unlinkAccount({ providerId: provider })
    if (result?.error) { toast.error(UNLINK_ERROR_TOAST); return }
    await refreshAccounts()
    toast.success(UNLINK_SUCCESS_TOAST)
  } catch {
    toast.error(UNLINK_ERROR_TOAST)
  } finally {
    setPendingUnlink(null)
  }
}
```

---

### WR-02: Topbar displays `email` in both label and sub-label slots — duplicate and misleading UI

**File:** `components/layout/topbar.tsx:57-60`

**Issue:** The dropdown menu label renders email in two adjacent `<p>` tags:
```tsx
<p className="truncate text-sm font-medium">{email || 'Utente'}</p>
<p className="truncate text-xs text-muted-foreground">{email || 'utente@example.com'}</p>
```

The second line was almost certainly intended to show the email (subtitle) while the first shows the user's display name. Since `authClient.useSession()` only exposes `email` (no `name` field accessed in this component), both lines render the same value. When the session is absent both fallbacks differ (`'Utente'` vs `'utente@example.com'`) making the placeholder also inconsistent. This is a logic/copy-paste bug that will require a name or combined display.

**Fix:** Either derive a display name from the session (e.g. `session?.user?.name`) or collapse to a single line:
```tsx
<DropdownMenuLabel className="font-normal">
  <p className="truncate text-sm font-medium">{session?.user?.name || email || 'Utente'}</p>
  <p className="truncate text-xs text-muted-foreground">{email}</p>
</DropdownMenuLabel>
```

---

### WR-03: `configuredProviders` prop accepts unknown strings at runtime — no runtime guard before `PROVIDER_LABELS` lookup

**File:** `components/profile/connected-accounts-card.tsx:209,225`

**Issue:** `renderOrder` is built by filtering `PROVIDER_ORDER` against `configuredProviders`, which constrains the rendered set correctly. However, `configuredProviders` is typed as `Provider[]` but the server page constructs it via conditional spreads and casts (`as Provider[]`). If a future provider is added to the server env check but not to `PROVIDER_ORDER` or `PROVIDER_LABELS`, `PROVIDER_LABELS[provider]` on line 225 silently returns `undefined`, rendering a broken label in the badge and aria text.

**Fix:** Add a fallback or guard at the label lookup:
```ts
const label = PROVIDER_LABELS[provider] ?? provider  // at minimum: show raw id
```
And add a dev-time assertion to `PROVIDER_LABELS` that all entries in `PROVIDER_ORDER` are covered (or use a satisfies check):
```ts
const PROVIDER_LABELS = {
  google: 'Google',
  github: 'GitHub',
} satisfies Record<Provider, string>
```

---

### WR-04: `errorCallbackURL` in `handleLink` is a hardcoded static string, not the actual Better Auth callback error

**File:** `components/profile/connected-accounts-card.tsx:166`

**Issue:**
```ts
errorCallbackURL: `${APP_ROUTES.profileSettings}?error=OAuthCallbackError`,
```

The `errorCallbackURL` is set to a static `?error=OAuthCallbackError` regardless of what Better Auth actually puts in the error. Better Auth's OAuth callback may set a more specific error code (e.g. `email_doesn't_match`, `account_already_linked_to_different_user`) in the redirect URL it generates internally. However, by overriding `errorCallbackURL` with a static `?error=OAuthCallbackError`, all errors from the OAuth flow arrive as `OAuthCallbackError` — the more specific error codes in `LINK_ERROR_MESSAGES` (lines 43–48) for `email_doesn't_match` and `account_already_linked_to_different_user` can never be surfaced through this path.

Better Auth's link flow places the actual error code in the redirect URL it controls; `errorCallbackURL` is only used for catch-all failures before the provider round-trip completes. Verify against Better Auth source whether `email_doesn't_match` errors are appended to `errorCallbackURL` or to a separate redirect — if to the former, the current code strips the actual code. The test at `connected-accounts-card.test.tsx:70-82` verifies the component can render the `email_doesn't_match` message, but that test passes `initialError` manually; it does not verify that the error code actually arrives from the OAuth flow.

**Fix:** Pass `errorCallbackURL` without a pre-baked error code and let Better Auth append its code, or document explicitly (with a source reference) that Better Auth always overwrites the query param:
```ts
errorCallbackURL: APP_ROUTES.profileSettings,  // Better Auth appends ?error=<code>
```

---

## Info

### IN-01: `app/(app)/profile/page.tsx` — redirect-only page has no `metadata` export

**File:** `app/(app)/profile/page.tsx:1-6`

**Issue:** The `/profile` redirect page performs an immediate `redirect()` but exports no `metadata`. Next.js may attempt to generate a document title for this route during static analysis. While the redirect fires before the page is rendered, a `noindex` or canonical `metadata` export is good hygiene for redirect pages that appear in build output.

**Fix:**
```ts
export const metadata = { robots: 'noindex, nofollow' }
```

---

### IN-02: `tests/connected-accounts-card.test.tsx:101` — placeholder test with `expect(true).toBe(true)` will always pass

**File:** `tests/connected-accounts-card.test.tsx:101`

**Issue:** The "unlink guard" describe block contains a single test that asserts `true === true`. This is a permanently green placeholder that adds zero signal. If the test suite is used as a gate, this block looks covered when it is not.

**Fix:** Either remove the placeholder test and the describe block, or use `test.todo('canUnlink guard — implement with @testing-library/react in Plan 02')` which Vitest will flag as a pending test rather than a passing one.

---

### IN-03: `components/layout/topbar.tsx` — `AvatarImage` has an empty `src` prop

**File:** `components/layout/topbar.tsx:49`

**Issue:**
```tsx
<AvatarImage src="" alt="Avatar utente" />
```

An empty `src` string will cause the browser to issue a request to the current page URL (in some browsers) or generate a console warning. Radix UI's `AvatarImage` handles broken images by falling back to `AvatarFallback`, but the empty string `src` generates a network request or error depending on browser. If user avatars are not yet implemented, omit the `AvatarImage` entirely or conditionally include it only when a URL is available.

**Fix:**
```tsx
{session?.user?.image && (
  <AvatarImage src={session.user.image} alt="Avatar utente" />
)}
<AvatarFallback className="bg-primary text-xs font-medium text-primary-foreground">
  {fallback}
</AvatarFallback>
```

---

_Reviewed: 2026-05-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
