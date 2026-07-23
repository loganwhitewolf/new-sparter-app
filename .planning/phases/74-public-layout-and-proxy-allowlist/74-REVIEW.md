---
phase: 74-public-layout-and-proxy-allowlist
reviewed: 2026-07-23T15:05:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - lib/routes.ts
  - proxy.ts
  - app/(public)/layout.tsx
  - app/(public)/page.tsx
  - app/(public)/_components/site-header.tsx
  - app/(public)/_components/site-footer.tsx
  - app/(public)/how-it-works/page.tsx
  - app/(public)/privacy/page.tsx
  - app/(public)/terms/page.tsx
  - tests/proxy-auth.test.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 74: Code Review Report

**Reviewed:** 2026-07-23T15:05:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Traced the full request path through `proxy.ts` against the `lib/routes.ts` allowlist for every documented branch (anon home, auth home smart-root, auth deep-link, anon gated path, auth-page bounce, Server Action passthrough, staging bypass), and confirmed the `(public)` route group has zero imports from `AppShell`/`SidebarProvider`/`dal/auth` — chrome isolation from the authenticated app shell holds. `yarn vitest run tests/proxy-auth.test.ts` reproduces green (7/7) independent of the phase's own self-check.

No auth-bypass or allowlist-correctness bug was found in the logic itself — the exact-match allowlist, smart-root ordering, and Server Action/staging-key short-circuits all behave as documented and as asserted by the tests that exist. The issues below are test-coverage gaps on security-relevant code and two minor UI/content defects, none of which change the auth verdict for the request paths that matter for this phase.

## Warnings

### WR-01: `isAuthPath` regression path has zero automated coverage after the allowlist refactor

**File:** `proxy.ts:45-47`, `tests/proxy-auth.test.ts`
**Issue:** This phase refactored the "bounce an already-authenticated user away from `/login`/`/register`" check from a locally hard-coded `AUTH_ROUTES.includes(path)` to `isAuthPath(path)` sourced from the new `lib/routes.ts` SoT (`e74e3b9`). This is a security-relevant branch (an authenticated session must never be able to sit on the login/register form), yet no test in `tests/proxy-auth.test.ts` exercises `isAuthPath(path) && isAuthenticated`. The suite covers the anon-on-auth-page case (`allows the login page when the auth session is unavailable`) and the smart-root home case, but not the direct auth-page-bounce case that this phase's own diff touched. A future edit to `AUTH_ROUTES`/`isAuthPath` (e.g. adding a route, changing the array order, or a typo in the exact-match string) would silently regress with no red test.
**Fix:**
```ts
it('redirects authenticated users away from the login page', async () => {
  mocks.getAuthSessionOrNull.mockResolvedValue({ user: { id: 'u1' } })

  const response = await proxy(request('/login'))

  expect(response.status).toBe(307)
  expect(response.headers.get('location')).toBe('https://app.example.test/dashboard')
})
```

### WR-02: Footer copyright year is baked in at build time on a statically-prerendered page

**File:** `app/(public)/_components/site-footer.tsx:38`
**Issue:** `© {new Date().getFullYear()} Sparter` runs inside `SiteFooter`, an RSC rendered as part of `app/(public)/layout.tsx` for every route in the group. Plan 74-02's own verification confirmed `yarn build` prerenders `/` as static (`○`), which means this expression is evaluated once at build time, not per-request. The displayed year will silently go stale (showing e.g. "© 2026" through all of 2027) for any deploy gap spanning a calendar year boundary — plausible for a low-traffic marketing shell that isn't rebuilt daily.
**Fix:** Either force the layout/page dynamic (`export const dynamic = 'force-dynamic'` — costly, kills the static win Plan 74-02 explicitly verified) or, simpler and free of that tradeoff, drop the year-precision requirement and hard-code the launch year, or compute it via a lightweight `<Suspense>`-free client component that re-evaluates on hydration. Given this is cosmetic copy, the pragmatic fix is a code comment documenting the staleness tradeoff, or moving the date computation to build metadata injected via `NEXT_PUBLIC_BUILD_YEAR` if exact accuracy matters.

### WR-03: `(public)/page.tsx` ships with no heading element, unlike every other page in the group

**File:** `app/(public)/page.tsx:8`
**Issue:** The homepage renders the "Sparter" wordmark as a `<span>`, not an `<h1>`. `SiteHeader` also renders its wordmark as a plain `<Link>` (no heading semantics). Combined, the anonymous homepage — the single most important SEO/accessibility landing surface in the app — has zero `<h1>` on the page, while the three D-10 stub pages (`how-it-works`, `privacy`, `terms`) all correctly use `<h1>` for their heading. Screen readers and SEO crawlers rely on exactly one `<h1>` per page for document structure.
**Fix:**
```tsx
<h1 className="text-2xl font-semibold tracking-tight text-foreground">Sparter</h1>
```
Note this is flagged as a defect relative to the rest of the section's own pattern, not a blocker — D-11 explicitly scopes this to a "minimal shell" pending Phase 75's full content promotion, so it may be an accepted interim state. Worth a one-line fix now since it costs nothing and removes an a11y regression before Phase 75 builds on top of it.

## Info

### IN-01: `/proto` startsWith exception is exercised by allowlist logic but has no regression test in this file

**File:** `proxy.ts:42`
**Issue:** `isPublicRoute = isPublicPath(path) || path.startsWith('/proto')` retains the pre-existing `/proto` prefix bypass (unchanged by this phase, carried over per D-04). This line was touched by the diff (refactored from a local array check to `isPublicPath`), and the phase's decisions log explicitly calls this out as a defense-in-depth exception whose real gating lives in `app/proto/layout.tsx`'s `PROTOTYPES_ENABLED` check, not in the proxy. No test in `tests/proxy-auth.test.ts` asserts `/proto/*` stays public post-refactor, so a future accidental removal of the `startsWith('/proto')` clause (while refactoring `isPublicRoute`) wouldn't be caught here — it would surface downstream as a broken staging demo rather than a proxy test failure.
**Fix:** Low priority; a single test (`it('keeps /proto public regardless of auth', ...)`) would close the gap cheaply since the test scaffolding already exists in this file.

### IN-02: Exact-match allowlist is trailing-slash sensitive

**File:** `lib/routes.ts:44-50`
**Issue:** `isPublicPath`/`isAuthPath` use strict `Array.includes(path)` exact-string matching. A request to `/how-it-works/` (trailing slash) would fail the allowlist check even though it's logically the same route, because `request.nextUrl.pathname` is compared before any trailing-slash normalization. This fails *closed* (redirects anon visitors to `/login` instead of granting an unintended bypass), so it is not a security issue, but it is a latent UX bug: a mistyped or copy-pasted trailing-slash marketing URL would bounce an anonymous visitor to the login page instead of serving the public page.
**Fix:** Not blocking. If this surfaces in practice, normalize `path` (strip a single trailing `/`, excluding the root `/`) before the `isPublicPath`/`isAuthPath` checks in `proxy.ts`.

---

_Reviewed: 2026-07-23T15:05:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
