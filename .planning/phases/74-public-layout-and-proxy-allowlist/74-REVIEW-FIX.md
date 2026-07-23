---
phase: 74-public-layout-and-proxy-allowlist
fixed_at: 2026-07-23T16:58:00Z
review_path: .planning/phases/74-public-layout-and-proxy-allowlist/74-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 2
status: all_fixed
---

# Phase 74: Code Review Fix Report

**Fixed at:** 2026-07-23T16:58:00Z
**Source review:** .planning/phases/74-public-layout-and-proxy-allowlist/74-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (critical + warning): 3
- Fixed: 3
- Skipped (out of scope — Info): 2

## Fixed Issues

### WR-01: Authenticated auth-page bounce (`isAuthPath`) has zero test coverage after this diff's refactor

**Files modified:** `tests/proxy-auth.test.ts`
**Commit:** `fec77a8`
**Applied fix:** Added two test cases exercising `isAuthPath(path) && isAuthenticated` — one for `/login`, one for `/register` (the review's suggested fix covered only `/login`; `/register` was added per explicit instruction) — each asserting a 307 redirect to `/dashboard`. Ran `yarn vitest run tests/proxy-auth.test.ts`: 9/9 passed (7 pre-existing + 2 new).

### WR-02: Footer copyright year is computed with a request-time API but rendered on a statically-prerendered page

**Files modified:** `app/(public)/_components/site-footer.tsx`
**Commit:** `5d5e5af`
**Applied fix:** Chose the simplest of the review's three suggested options — accepted the staleness with an explanatory code comment above the copyright line, documenting that the `(public)` group is statically prerendered so the year is baked in at build time and goes stale across a calendar-year boundary until the next deploy. No behavior change; avoids sacrificing the static prerender win the phase's own `yarn build` verification confirmed.

### WR-03: Anonymous homepage (`app/(public)/page.tsx`) ships with no `<h1>`, unlike every other page in the group

**Files modified:** `app/(public)/page.tsx`
**Commit:** `4975236`
**Applied fix:** Changed the "Sparter" wordmark from a `<span>` to an `<h1>` with the same className, exactly as suggested in REVIEW.md. Verified with `npx tsc --noEmit` and `npx eslint` on the file — no errors.

## Skipped Issues

### IN-01: `/proto` prefix bypass has no regression test in this file

**File:** `proxy.ts:42`
**Reason:** Out of fix scope for this run — `fix_scope: critical_warning` explicitly excludes Info findings per instructions.
**Original issue:** `isPublicRoute = isPublicPath(path) || path.startsWith('/proto')` has no test asserting `/proto/*` stays public post-refactor; low-priority gap, not a security issue (real gating lives downstream in `app/proto/layout.tsx`).

### IN-02: Exact-match allowlist is trailing-slash sensitive

**File:** `lib/routes.ts:44-50`
**Reason:** Out of fix scope for this run — `fix_scope: critical_warning` explicitly excludes Info findings per instructions.
**Original issue:** `isPublicPath`/`isAuthPath` exact-match against `pathname` with no trailing-slash normalization; fails closed (bounces to `/login`), not a security issue — latent UX bug only.

---

_Fixed: 2026-07-23T16:58:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
