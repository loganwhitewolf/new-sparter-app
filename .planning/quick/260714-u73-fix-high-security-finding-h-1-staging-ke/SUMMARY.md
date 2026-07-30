---
quick_id: 260714-u73
slug: fix-high-security-finding-h-1-staging-ke
date: 2026-07-14
status: complete
---

# Summary: Fix H-1 — staging-key auth bypass

## What changed

- **New** `lib/auth-staging.ts` — centralizes the staging-bypass check:
  - Inert in production (`VERCEL_ENV === 'production'` → `false`).
  - Constant-time comparison via `crypto.timingSafeEqual` (length-guarded, since
    it throws on length mismatch).
  - `stagingUserId()` helper for the impersonated id.
- **`proxy.ts`** — uses `isStagingBypass()`; stale Railway comment replaced.
- **`lib/dal/auth.ts`** — `verifySession` uses `isStagingBypass()` + `stagingUserId()`.
- **`lib/logger.ts`** — `withUserId` uses `isStagingBypass()` + `stagingUserId()`.

## Verification

- `yarn tsc --noEmit`: the 4 touched files are error-free. The 21 remaining tsc
  errors are pre-existing (confirmed identical count on the pre-change tree) and
  live in test files / dashboard types unrelated to this change.
- `yarn check:language`: passed.

## Result

The bypass can no longer fire on Vercel Production regardless of whether
`STAGING_KEY` is set there, and the credential comparison is now constant-time.
Non-production behaviour is unchanged.

## Residual (tracked in audit report, not this task)

H-2 (email pre-verification) and H-3 (ReDoS on user regexes) remain open — see
`docs/security/audit-2026-07-14.md`.
