---
phase: 74-public-layout-and-proxy-allowlist
reviewed: 2026-07-23T16:52:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - app/(public)/_components/site-footer.tsx
  - app/(public)/_components/site-header.tsx
  - app/(public)/how-it-works/page.tsx
  - app/(public)/layout.tsx
  - app/(public)/page.tsx
  - app/(public)/privacy/page.tsx
  - app/(public)/terms/page.tsx
  - lib/routes.ts
  - proxy.ts
  - tests/proxy-auth.test.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 74: Code Review Report

**Reviewed:** 2026-07-23T16:52:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Traced every branch of `proxy()` against the `lib/routes.ts` allowlist (staging bypass, Server Action passthrough, auth-page bounce, smart root, deny-by-default gate, final `next()`) and cross-checked each against the D-01…D-12 decisions in `74-CONTEXT.md` and the D-07 truths in `74-01-PLAN.md`. Also verified every `href` emitted by `SiteHeader`/`SiteFooter`/stub pages resolves to a real route on disk (`/login`, `/register`, `/dashboard`, and the four marketing routes all exist) — no broken links. Ran `yarn vitest run tests/proxy-auth.test.ts` (7/7 green), `yarn check:language` (clean), `npx tsc --noEmit` (clean), and `npx eslint` on all ten files (clean) independently rather than trusting the phase's own self-check.

**No auth-bypass exists in the allowlist logic.** `isPublicPath`/`isAuthPath` are exact-match only (no `startsWith`, per D-04), the smart-root branch redirects only to the fixed `APP_ROUTES.dashboard` constant (no open-redirect surface, per D-02), `AUTH_ROUTES` contains only `/login`/`/register` so marketing deep links are never bounced while authenticated (D-03), and the pre-existing `next-action` / `STAGING_KEY` short-circuits are untouched and still ordered first. Session data is not read in `app/(public)/layout.tsx` or in any `(public)` page/component — no leakage of session state into the public RSC tree. The findings below are test-coverage gaps on security-relevant branches and cosmetic/a11y defects; none change the auth verdict for any request path exercised by the existing suite.

## Warnings

### WR-01: Authenticated auth-page bounce (`isAuthPath`) has zero test coverage after this diff's refactor

**File:** `proxy.ts:45-47`, `tests/proxy-auth.test.ts`
**Issue:** This diff (`e74e3b9`) replaced a locally hard-coded `AUTH_ROUTES.includes(path)` check with `isAuthPath(path)` sourced from the new `lib/routes.ts` SoT. This branch is security-relevant — an authenticated session must never be able to sit on `/login` or `/register` — yet `tests/proxy-auth.test.ts` never exercises `isAuthPath(path) && isAuthenticated`. The suite covers the anonymous-on-`/login` case and the smart-root home case, but not the direct auth-page bounce that this diff's own refactor touched. A future edit to `AUTH_ROUTES` / `isAuthPath` (added route, reordered array, typo in the exact-match string) would regress silently with no red test.
**Fix:**
```ts
it('redirects authenticated users away from the login page', async () => {
  mocks.getAuthSessionOrNull.mockResolvedValue({ user: { id: 'u1' } })

  const response = await proxy(request('/login'))

  expect(response.status).toBe(307)
  expect(response.headers.get('location')).toBe('https://app.example.test/dashboard')
})
```

### WR-02: Footer copyright year is computed with a request-time API but rendered on a statically-prerendered page

**File:** `app/(public)/_components/site-footer.tsx:38`
**Issue:** `© {new Date().getFullYear()} Sparter` runs inside `SiteFooter`, an RSC rendered by `app/(public)/layout.tsx` for every route in the group. `74-02-SUMMARY.md`'s own `yarn build` verification confirms `/` prerenders as static (`○`), meaning this expression is evaluated once at build time, not per-request. The displayed year will silently go stale (e.g. showing "© 2026" throughout 2027) for any deploy gap spanning a calendar-year boundary — plausible for a marketing shell that isn't rebuilt daily.
**Fix:** Not blocking for this phase; if exact accuracy matters, either accept the staleness with a code comment, hard-code the launch year instead of computing it, or move the computation into a small client component that re-evaluates on hydration (cheaper than forcing `dynamic = 'force-dynamic'`, which would kill the static win this phase explicitly verified).

### WR-03: Anonymous homepage (`app/(public)/page.tsx`) ships with no `<h1>`, unlike every other page in the group

**File:** `app/(public)/page.tsx:8`
**Issue:** The homepage renders the "Sparter" wordmark as a `<span>`. `SiteHeader`/`SiteFooter` also render their wordmark as a plain `<Link>` with no heading semantics. The result: the anonymous homepage — the single most important SEO/accessibility landing surface shipped by this phase — has zero `<h1>` on the page, while the three D-10 stub pages (`how-it-works`, `privacy`, `terms`) all correctly use `<h1>` for their heading. Screen readers and SEO crawlers rely on exactly one `<h1>` per page for document structure; this page currently has none.
**Fix:**
```tsx
<h1 className="text-2xl font-semibold tracking-tight text-foreground">Sparter</h1>
```
Note `74-UI-SPEC.md` scopes this homepage explicitly as an interim "minimal shell" pending Phase 75's full content promotion, so this may be an accepted interim state — but the fix costs nothing and removes a real a11y regression before Phase 75 builds on top of it.

## Info

### IN-01: `/proto` prefix bypass has no regression test in this file

**File:** `proxy.ts:42`
**Issue:** `isPublicRoute = isPublicPath(path) || path.startsWith('/proto')` retains the pre-existing `/proto` prefix exception (unchanged by this phase, carried forward per D-04). This line was touched by the diff (refactored from a local array to `isPublicPath`), and its real gating lives downstream in `app/proto/layout.tsx`'s `PROTOTYPES_ENABLED` check rather than here — but nothing in `tests/proxy-auth.test.ts` asserts `/proto/*` stays public post-refactor. A future accidental removal of the `startsWith('/proto')` clause while touching `isPublicRoute` wouldn't be caught by this suite; it would only surface downstream as a broken staging demo.
**Fix:** Low priority — a single `it('keeps /proto public regardless of auth', ...)` case would close the gap cheaply using the existing test scaffolding.

### IN-02: Exact-match allowlist is trailing-slash sensitive

**File:** `lib/routes.ts:44-50`
**Issue:** `isPublicPath`/`isAuthPath` use strict `Array.includes(path)` exact-string matching against `request.nextUrl.pathname`, with no trailing-slash normalization. A request to `/how-it-works/` (trailing slash) fails the allowlist check even though it is logically the same route. This fails *closed* — it bounces an anonymous visitor to `/login` rather than granting any unintended access — so it is not a security issue, but it is a latent UX bug for a mistyped or copy-pasted trailing-slash marketing URL.
**Fix:** Not blocking. If this surfaces in practice, strip a single trailing `/` (excluding the root `/`) from `path` in `proxy.ts` before calling `isPublicPath`/`isAuthPath`.

---

_Reviewed: 2026-07-23T16:52:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
