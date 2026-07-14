---
quick_id: 260714-u73
slug: fix-high-security-finding-h-1-staging-ke
date: 2026-07-14
---

# Quick Task: Fix H-1 — staging-key auth bypass

Source: `docs/security/audit-2026-07-14.md` finding **H-1** (HIGH).

## Problem

The `x-staging-key` bypass in `proxy.ts`, `lib/dal/auth.ts`, and `lib/logger.ts`
was activated by mere presence of `STAGING_KEY`, not gated on environment. A
mis-scoped env var on Vercel Production would silently enable a full auth bypass.
Comparison used plain `===` (timing-attackable). Comment referenced Railway (stale).

## Plan

1. Add `lib/auth-staging.ts` — shared helper `isStagingBypass(header)`:
   - returns `false` when `process.env.VERCEL_ENV === 'production'` (inert in prod)
   - constant-time compare via `crypto.timingSafeEqual` (length-guarded)
   - plus `stagingUserId()` helper
2. Replace the inline check in all three call sites with the helper.
3. Fix the stale "Railway" comment.

## Constraints

- Behaviour identical in non-production (preview/dev/local): bypass still active
  when `STAGING_KEY` is set and `VERCEL_ENV !== 'production'`.
- No change to session shape returned by `verifySession`.
